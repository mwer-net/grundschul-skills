import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { createReadStream, createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { readdir, readFile, rename, rm, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { createGzip, gunzipSync } from 'node:zlib';

import { ID_MUSTER } from '@schoolbox/kern';

/**
 * Die Mitschrift jedes Laufs von `claude` (233): `_ki-mitschrift/<mappe>/<zeit>-<art>[-<dok>].jsonl.gz` in der Ablage. Die
 * erste Zeile (`typ: 'kopf'`) hält Auftrag, Systemauftrag und Argumente, dann folgt jede Zeile von `stream-json`
 * (Nachrichten, Werkzeugaufrufe und ihre Ergebnisse), die letzte (`typ: 'ende'`) zählt die Werkzeuge und nennt die
 * fehlgeschlagenen. Während des Laufs ist die Datei ungepackt; bleibt sie das, endete der Server mitten im Lauf.
 */
export const MITSCHRIFT_ORDNER = '_ki-mitschrift';
export const MITSCHRIFT_TAGE = 30;
const TAG_MS = 24 * 60 * 60 * 1000;
/** Dateiinhalte und Werkzeugergebnisse werden gekürzt, Bilddaten fallen ganz weg: Ein Lauf hat sonst bis zu 80 MB. */
export const MITSCHRIFT_TEXT_ZEICHEN = 20_000;
const AUFTRAG_ZEICHEN = 200_000;
const STDERR_ZEICHEN = 8_000;
const FEHLER_ZEICHEN = 1_000;
const MAX_FEHLER = 50;
const BINAER = /^[A-Za-z0-9+/=\r\n]+$/;
const ID_REGEX = new RegExp(ID_MUSTER);

export interface MitschriftZiel {
	materialDir: string;
	mappe: string | null | undefined;
	dok?: string | null;
	/** Wofür der Lauf war, etwa `einheit-bau` oder `blatt-plan`; steht im Dateinamen. */
	art: string;
}

const gekuerzt = (text: string, zeichen: number) =>
	text.length > zeichen ? `${text.slice(0, zeichen)} … [gekürzt, ${text.length} Zeichen]` : text;

export const kuerze = (wert: unknown): unknown => {
	if (typeof wert === 'string') {
		return wert.length > 1000 && BINAER.test(wert)
			? `[Binärdaten, ${wert.length} Zeichen]`
			: gekuerzt(wert, MITSCHRIFT_TEXT_ZEICHEN);
	}
	if (Array.isArray(wert)) {
		return wert.map(kuerze);
	}
	if (wert !== null && typeof wert === 'object') {
		return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, kuerze(v)]));
	}
	return wert;
};

const sicher = (wert: string | null | undefined) => (wert && ID_REGEX.test(wert) ? wert : null);

export const mitschriftDatei = (ziel: MitschriftZiel, zeit: Date) => {
	const art = ziel.art.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const dok = sicher(ziel.dok);
	return path.join(
		ziel.materialDir,
		MITSCHRIFT_ORDNER,
		sicher(ziel.mappe) ?? 'ohne-mappe',
		`${zeit.toISOString().replace(/[:.]/g, '-')}-${art}${dok ? `-${dok}` : ''}.jsonl`,
	);
};

const systemAuftrag = (argumente: string[]) => {
	const i = argumente.indexOf('--append-system-prompt-file');
	const datei = i >= 0 ? argumente[i + 1] : undefined;
	if (!datei) {
		return null;
	}
	try {
		return { datei, text: gekuerzt(readFileSync(datei, 'utf8'), AUFTRAG_ZEICHEN) };
	} catch {
		return { datei, text: null };
	}
};

const textVon = (inhalt: unknown): string => {
	if (typeof inhalt === 'string') {
		return inhalt;
	}
	return Array.isArray(inhalt)
		? (inhalt as { type?: unknown; text?: unknown }[])
				.map((t) => (t.type === 'text' ? String(t.text) : ''))
				.join(' ')
		: '';
};

/**
 * Schreibt einen gestarteten Lauf mit, ohne ihn zu stören: Jeder Fehler beim Schreiben beendet nur das
 * Mitschreiben. Ohne `ziel` (Tests, Limit-Prüfung) geschieht nichts.
 */
export const schreibeMitschrift = (
	ziel: MitschriftZiel | undefined,
	kind: ChildProcessWithoutNullStreams,
	lauf: { argumente: string[]; auftrag: string; cwd: string },
) => {
	if (!ziel) {
		return;
	}
	const beginn = new Date();
	const datei = mitschriftDatei(ziel, beginn);
	try {
		mkdirSync(path.dirname(datei), { recursive: true });
	} catch (fehler) {
		console.error('Mitschrift:', fehler);
		return;
	}
	const aus = createWriteStream(datei, { flags: 'a' });
	let kaputt = false;
	aus.on('error', (fehler) => {
		if (!kaputt) {
			console.error('Mitschrift:', fehler);
		}
		kaputt = true;
	});
	const schreibe = (zeile: unknown) => {
		if (!kaputt) {
			aus.write(`${JSON.stringify(zeile)}\n`);
		}
	};
	schreibe({
		typ: 'kopf',
		zeit: beginn.toISOString(),
		art: ziel.art,
		mappe: ziel.mappe ?? null,
		dok: ziel.dok ?? null,
		cwd: lauf.cwd,
		argumente: lauf.argumente.map((a) => gekuerzt(a, MITSCHRIFT_TEXT_ZEICHEN)),
		systemAuftrag: systemAuftrag(lauf.argumente),
		auftrag: gekuerzt(lauf.auftrag, AUFTRAG_ZEICHEN),
	});

	const werkzeuge: Record<string, number> = {};
	const namen = new Map<string, string>();
	const fehlerhaft: { werkzeug: string; text: string }[] = [];
	const merke = (e: Record<string, unknown>) => {
		const inhalt = (e.message as { content?: unknown } | undefined)?.content;
		if (!Array.isArray(inhalt)) {
			return;
		}
		for (const teil of inhalt as Record<string, unknown>[]) {
			if (e.type === 'assistant' && teil.type === 'tool_use' && typeof teil.name === 'string') {
				werkzeuge[teil.name] = (werkzeuge[teil.name] ?? 0) + 1;
				if (typeof teil.id === 'string') {
					namen.set(teil.id, teil.name);
				}
			} else if (
				e.type === 'user' &&
				teil.type === 'tool_result' &&
				teil.is_error === true &&
				fehlerhaft.length < MAX_FEHLER
			) {
				fehlerhaft.push({
					werkzeug: namen.get(String(teil.tool_use_id)) ?? 'unbekannt',
					text: gekuerzt(textVon(teil.content), FEHLER_ZEICHEN),
				});
			}
		}
	};

	createInterface({ input: kind.stdout }).on('line', (zeile) => {
		let e: unknown;
		try {
			e = JSON.parse(zeile);
		} catch {
			schreibe({ typ: 'text', zeile: kuerze(zeile) });
			return;
		}
		if (e !== null && typeof e === 'object' && !Array.isArray(e)) {
			merke(e as Record<string, unknown>);
		}
		schreibe(kuerze(e));
	});
	let stderr = '';
	kind.stderr.on('data', (teil: Buffer) => {
		stderr = (stderr + teil.toString('utf8')).slice(-STDERR_ZEICHEN);
	});
	kind.on('close', (code, signal) => {
		schreibe({
			typ: 'ende',
			zeit: new Date().toISOString(),
			sekunden: Math.round((Date.now() - beginn.getTime()) / 1000),
			code,
			signal,
			werkzeuge,
			fehlerhaft,
			stderr: stderr || null,
		});
		aus.end(() => {
			if (kaputt) {
				return;
			}
			// Erst fertig gepackt umbenannt: Eine `.gz` ist immer ganz. Misslingt das Packen, bleibt die ungepackte Datei.
			const teil = `${datei}.gz.teil`;
			pipeline(createReadStream(datei), createGzip(), createWriteStream(teil))
				.then(
					() => rename(teil, `${datei}.gz`).then(() => rm(datei, { force: true })),
					() => rm(teil, { force: true }),
				)
				.catch(() => undefined);
		});
	});
};

/** Mitschriften älter als `tage` gehen, leere Mappen-Ordner mit ihnen. */
export const raeumeMitschriftenAuf = async (materialDir: string, tage = MITSCHRIFT_TAGE, jetzt = Date.now()) => {
	const wurzel = path.join(materialDir, MITSCHRIFT_ORDNER);
	let weg = 0;
	for (const mappe of await readdir(wurzel).catch(() => [] as string[])) {
		const ordner = path.join(wurzel, mappe);
		const dateien = await readdir(ordner).catch(() => [] as string[]);
		for (const n of dateien) {
			const datei = path.join(ordner, n);
			const { mtimeMs } = await stat(datei).catch(() => ({ mtimeMs: jetzt }));
			if (jetzt - mtimeMs > tage * TAG_MS) {
				await rm(datei, { force: true });
				weg += 1;
			}
		}
		await rmdir(ordner).catch(() => undefined);
	}
	return weg;
};

/** Liest eine Mitschrift, gepackt oder (nach einem Absturz) ungepackt, als Liste ihrer Zeilen. */
export const leseMitschrift = async (datei: string) => {
	const roh = await readFile(datei);
	return (datei.endsWith('.gz') ? gunzipSync(roh) : roh)
		.toString('utf8')
		.trim()
		.split('\n')
		.map((z) => JSON.parse(z) as Record<string, unknown>);
};
