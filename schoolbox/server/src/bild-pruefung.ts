/**
 * Die Bildprüfung mit frischem Blick (268): Nach dem Bilderlauf prüft je Kapitel ein eigener Lauf (nur Read, neue
 * Sitzung) die Viertel und den Ausschnitt jedes neuen Bildes gegen Vertrag, Kanon und Bildvorschlag. Hier stehen die
 * Teile, die Server und Prüfstand gleich brauchen: die Bilder aus `bilder.json` mit ihrer Kennung (248), die Läufe je
 * Kapitel, der Prüfordner, der Auftrag und welcher Befund zu welchem Bild gehört.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { BildPruefEintrag, EinheitPlan, PruefBefund, PruefBild } from '@schoolbox/kern';
import { bildPruefText, nenntBild } from '@schoolbox/kern';
import type { KanonNachtrag } from '@schoolbox/kern/src/einheit-kanon';
import { bildKapitel, bildVorschlag, kanonText } from '@schoolbox/kern/src/einheit-kanon';

import { ANSICHT_BILDER, leseBildListe } from './bild-datei';

/** Mit den Zeilen aus dem Kanon (248) wird ein Vertrag länger; abgeschnitten fiele `verboten` am Ende weg. */
export const MAX_VERTRAG = 3000;

/** Ein KI-Bild aus `bilder.json`, das in `bilder/` liegt. */
export interface KiBild {
	datei: string;
	motiv: string;
	/** `platz`, `blickpunkt` und `vertrag` als JSON, wie Prüflauf und Bildprüfung ihn sehen. */
	vertrag: string;
	/** Der Vertrag aus der Liste (`pflicht`, `buehne`, `verboten`). */
	roh: unknown;
	/** 248: Inhalt, Motiv und Vertrag als Hash; `null`, wenn die Datei fehlt. */
	kennung: string | null;
}

const leseListe = async (arbeit: string) =>
	(await leseBildListe(arbeit)).filter(
		(e): e is Record<string, unknown> =>
			typeof e === 'object' && e !== null && typeof (e as { datei?: unknown }).datei === 'string',
	);

/** Ein Eintrag der Liste mit Kennung; dieselbe Rechnung für Prüflauf und Bildprüfung, sonst passt `bilderGeprueft` nicht. */
export const kiBildAus = async (arbeit: string, e: Record<string, unknown>): Promise<KiBild> => {
	const datei = String(e.datei);
	const vertrag = JSON.stringify({ platz: e.platz, blickpunkt: e.blickpunkt, vertrag: e.vertrag });
	const motiv = typeof e.motiv === 'string' ? e.motiv.slice(0, 200) : '';
	const inhalt = /^[a-z0-9][a-z0-9-]{0,59}\.(png|jpg)$/.test(datei)
		? await readFile(path.join(arbeit, 'bilder', datei)).catch(() => null)
		: null;
	return {
		datei,
		motiv,
		vertrag,
		roh: e.vertrag,
		kennung: inhalt
			? createHash('sha256').update(inhalt).update(motiv).update(vertrag).digest('hex').slice(0, 16)
			: null,
	};
};

/** Die Einträge aus `bilder.json` nach Datei. */
export const leseKiBildEintraege = async (arbeit: string) =>
	new Map((await leseListe(arbeit)).map((e) => [String(e.datei), e]));

/** Alle KI-Bilder, die in `bilder/` liegen, in der Reihenfolge der Liste. */
export const leseKiBilder = async (arbeit: string): Promise<KiBild[]> => {
	const bilder: KiBild[] = [];
	for (const e of await leseListe(arbeit)) {
		const b = await kiBildAus(arbeit, e);
		if (b.kennung && !bilder.some((x) => x.datei === b.datei)) {
			bilder.push(b);
		}
	}
	return bilder;
};

const stammVon = (datei: string) => datei.replace(/\.(png|jpg)$/, '');

/**
 * Kopiert die Prüfbilder eines Bildes aus `ansicht/bilder/` nach `<ordner>/bilder/`: mit `nurPlatz` den Ausschnitt,
 * sonst Viertel und Ausschnitt. Gibt die Pfade relativ zum Ordner zurück.
 */
export const legePruefbilderAb = async (ordner: string, arbeit: string, datei: string, nurPlatz: boolean) => {
	const muster = new RegExp(`^${stammVon(datei)}-(${nurPlatz ? 'platz' : 'v[1-4]|platz'})\\.png$`);
	const namen = (await readdir(path.join(arbeit, ANSICHT_BILDER)).catch(() => [] as string[]))
		.filter((n) => muster.test(n))
		.sort();
	if (namen.length) {
		await mkdir(path.join(ordner, 'bilder'), { recursive: true });
		for (const n of namen) {
			await cp(path.join(arbeit, ANSICHT_BILDER, n), path.join(ordner, 'bilder', n));
		}
	}
	return namen.map((n) => `bilder/${n}`);
};

/** Ein Lauf der Bildprüfung: die Bilder eines Kapitels, bei vielen Bildern ein Teil davon. */
export interface BildPruefLauf {
	kapitel: number | null;
	bilder: KiBild[];
	teil?: { nr: number; von: number };
}

/**
 * Je Kapitel ein Lauf, höchstens `jeLauf` Bilder (sonst sprengen die Viertel die Runden); Bilder ohne Kapitel
 * (Grundposen, Posen, Deckblatt) zuerst, dann die Kapitel der Reihe nach.
 */
export const bildPruefLaeufe = (
	plan: Pick<EinheitPlan, 'geschichte'>,
	bilder: readonly KiBild[],
	jeLauf: number,
): BildPruefLauf[] => {
	const gruppen = new Map<number | null, KiBild[]>();
	for (const b of bilder) {
		const k = bildKapitel(plan, b.datei, b.motiv);
		gruppen.set(k, [...(gruppen.get(k) ?? []), b]);
	}
	const reihe = [...gruppen.keys()].sort((a, b) => (a ?? -1) - (b ?? -1));
	return reihe.flatMap((kapitel) => {
		const liste = gruppen.get(kapitel) ?? [];
		const von = Math.ceil(liste.length / jeLauf);
		return Array.from({ length: von }, (_, i) => ({
			kapitel,
			bilder: liste.slice(i * jeLauf, (i + 1) * jeLauf),
			...(von > 1 ? { teil: { nr: i + 1, von } } : {}),
		}));
	});
};

/** Alle Texte eines Werts aus `bilder.json`, für den Vorschlag aus dem Kanon. */
const texteIn = (wert: unknown): string[] => {
	if (typeof wert === 'string') {
		return [wert];
	}
	if (Array.isArray(wert)) {
		return wert.flatMap(texteIn);
	}
	return typeof wert === 'object' && wert !== null ? Object.values(wert).flatMap(texteIn) : [];
};

/**
 * Richtet den Ordner eines Laufs ein (Viertel und Ausschnitt je Bild) und schreibt seinen Auftrag: Vertrag, den
 * Vorschlag aus dem Kanon (`bildVorschlag`, wie `bild_erzeugen` ihn verlangt) und den Kanon mit dem Kapitel vorn.
 */
export const bildPruefAuftrag = async (o: {
	ordner: string;
	arbeit: string;
	plan: Pick<EinheitPlan, 'kanon' | 'geschichte' | 'figuren'>;
	lauf: BildPruefLauf;
	kopf: { klasse: string; fach: string; auftrag?: string };
	runde: 1 | 2;
	nachtrag?: readonly KanonNachtrag[];
}) => {
	const { kanon } = o.plan;
	const bilder: BildPruefEintrag[] = [];
	for (const b of o.lauf.bilder) {
		const pflicht = texteIn((b.roh as { pflicht?: unknown } | null)?.pflicht);
		bilder.push({
			datei: b.datei,
			motiv: b.motiv,
			vertrag: b.vertrag.slice(0, MAX_VERTRAG),
			pruefbilder: await legePruefbilderAb(o.ordner, o.arbeit, b.datei, false),
			...(b.kennung ? { kennung: b.kennung } : {}),
			vorschlag: kanon ? bildVorschlag(kanon, o.lauf.kapitel, [b.motiv, ...pflicht].join('\n')) : null,
		});
	}
	const text = bildPruefText({
		kapitel: o.lauf.kapitel,
		...o.kopf,
		figuren: o.plan.figuren ?? [],
		...(kanon ? { kanon: kanonText(kanon, { kapitel: o.lauf.kapitel ?? 0, nachtrag: o.nachtrag ?? [] }) } : {}),
		bilder,
		runde: o.runde,
		...(o.lauf.teil ? { teil: o.lauf.teil } : {}),
	});
	return { text, bilder: bilder as PruefBild[] };
};

/**
 * Welcher Befund zu welchem Bild gehört: was ihn nennt (`bild`, Text oder Aufgabe). Ein Befund, der kein Bild des Laufs
 * nennt, gilt im Prüfstand für jedes; der Server (`ohneBildAnAlle: false`) gibt ihn einmal an den Bilderlauf und nimmt
 * kein Bild des Laufs ab.
 */
export const befundeJeBild = (
	bilder: readonly PruefBild[],
	befunde: readonly PruefBefund[],
	o: { ohneBildAnAlle: boolean } = { ohneBildAnAlle: true },
) => {
	const je = new Map<string, PruefBefund[]>();
	for (const b of befunde) {
		const genannt = bilder.filter((x) => nenntBild(b, x.datei));
		for (const x of genannt.length ? genannt : o.ohneBildAnAlle ? bilder : []) {
			je.set(x.datei, [...(je.get(x.datei) ?? []), b]);
		}
	}
	return je;
};
