import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

import type { KiAktion, Konfig, Meldung, Pruefbericht } from '@schoolbox/kern';
import { dokumentDir, leseMeta, quelleVon, schreibeAtomar, WURZEL, zerlege } from '@schoolbox/kern';
import { liesReferenzen, loeseReferenz, pfadText } from '@schoolbox/kern/src/referenz';

import { leseQuelle } from './dokumente';
import type { Ereignisse } from './ereignisse';
import { HttpFehler } from './fehler';

/** Grenzen eines Auftrags. Aus den Messungen in Issue 056: Ein ganzes Blatt differenzieren brauchte 16 Runden und 2 min. */
export const KI_GRENZEN = {
	zeitMs: 8 * 60_000,
	runden: 40,
	budgetUsd: 1.5,
	auftragZeichen: 4000,
	materialBytes: 5 * 1024 * 1024,
	ausgabeBytes: 50 * 1024 * 1024,
	warten: 5,
};
/** Der Status `allowed_warning` kam in 056 schon bei 43 %: Für den Hinweis zählt darum die Auslastung. */
export const KI_WARN_AB = 0.8;
const ANMELDUNG_GILT_MS = 60_000;
const BEENDEN_MS = 4000;
const WORKFILE = 'material.html';
export const VORSCHLAG_ORDNER = 'vorschlag';
const VORSCHLAG_META = 'vorschlag.json';
const VERBRAUCH_DATEI = '_ki-verbrauch.jsonl';
/** Das Rechtesystem sperrt das schon (Issue 056); das ist die zweite Schicht für das, was nie gelesen werden darf. */
const NIE_LESEN = ['Read(~/.claude/**)', 'Read(~/.ssh/**)', 'Read(**/.env)', 'Read(**/materialien/**)'];

export type KiStatus = 'wartet' | 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen';

export interface KiFenster {
	auslastung: number | null;
	zurueck: string | null;
}

export interface KiLimit {
	status: string;
	fenster: { fuenfStunden: KiFenster; sieben: KiFenster };
	zurueck: string | null;
}

export interface KiAuftrag {
	id: string;
	mappe: string;
	dok: string;
	status: KiStatus;
	schritte: string[];
	fehler: string | null;
}

export interface VorschlagMeta {
	auftrag: string;
	umfang: string;
	zeit: string;
	basis: string;
	antwort: string;
	meldungen: Meldung[];
	fehler: number;
}

export interface KiWunsch {
	mappe: string;
	dok: string;
	auftrag: string;
	/** `[sb:…]`-Referenz (`kern/src/referenz.ts`); ohne das ganze Blatt. */
	referenz?: string;
	/** Nachbessern: arbeitet auf dem vorhandenen Vorschlag statt auf der Quelle. */
	aufVorschlag?: boolean;
	/** Skills, die der Auftrag sicher braucht (059). */
	skills?: string[];
	/** So steht der Auftrag beim Vorschlag, wenn der Prompt ein anderer Text ist (059). */
	anzeige?: string;
}

export type KiPruefer = (dokDir: string, html: string) => Promise<Pruefbericht>;

type KiKonfig = Pick<Konfig, 'claudeBin' | 'kiAn' | 'kiModell' | 'materialDir'>;

interface Abhaengigkeiten {
	konfig: KiKonfig;
	ereignisse: Ereignisse;
	pruefer: KiPruefer;
}

/** Der Aufruf aus Issue 056: Skills ja, sonst nichts. Der Prompt kommt über stdin, weil `--tools` Werte schluckt. */
export const kiArgumente = (o: { ablage: string; auftragDatei: string; modell: string; sitzung?: string | null }) => [
	'-p',
	'--output-format',
	'stream-json',
	'--verbose',
	'--model',
	o.modell,
	'--setting-sources',
	'project',
	'--add-dir',
	o.ablage,
	'--strict-mcp-config',
	'--tools',
	'Read,Edit,Skill',
	'--allowedTools',
	`Edit(./${WORKFILE})`,
	'Skill',
	'--disallowedTools',
	...NIE_LESEN,
	'--permission-mode',
	'dontAsk',
	'--max-turns',
	String(KI_GRENZEN.runden),
	'--max-budget-usd',
	String(KI_GRENZEN.budgetUsd),
	'--append-system-prompt-file',
	o.auftragDatei,
	...(o.sitzung ? ['--resume', o.sitzung] : []),
];

export const kiPfad = (konfig: Pick<Konfig, 'claudeBin'>) => {
	if (konfig.claudeBin) {
		return konfig.claudeBin;
	}
	// PM2 und systemd haben oft einen kürzeren PATH als die Shell, in der `claude` installiert wurde.
	const ueblich = path.join(homedir(), '.local', 'bin', 'claude');
	return existsSync(ueblich) ? ueblich : 'claude';
};

/** Nur was `claude` braucht: das echte HOME wegen der Anmeldung, kein Schlüssel und kein Geheimnis aus der `.env`. */
export const kiUmgebung = (bin: string): Record<string, string> => ({
	PATH: [path.isAbsolute(bin) ? path.dirname(bin) : '', process.env.PATH ?? ''].filter(Boolean).join(path.delimiter),
	HOME: homedir(),
	LANG: 'C.UTF-8',
});

const kennung = (inhalt: string) => createHash('sha256').update(inhalt).digest('hex').slice(0, 16);

const SCHRITT_NAMEN: Record<string, string> = {
	Read: 'Liest das Blatt',
	Edit: 'Ändert das Blatt',
};

const textSchritt = (name: string, eingabe: { skill?: unknown }) =>
	name === 'Skill' && typeof eingabe.skill === 'string'
		? `Liest die Regeln: ${eingabe.skill}`
		: (SCHRITT_NAMEN[name] ?? null);

const zeitpunkt = (sekunden: unknown) =>
	typeof sekunden === 'number' ? new Date(sekunden * 1000).toISOString() : null;

const fenster = (roh: { utilization?: unknown; resetsAt?: unknown } | undefined): KiFenster => ({
	auslastung: typeof roh?.utilization === 'number' ? roh.utilization : null,
	zurueck: zeitpunkt(roh?.resetsAt),
});

export const liesLimit = (info: Record<string, unknown>): KiLimit => {
	const fenster2 = (info.unifiedWindows ?? {}) as Record<string, { utilization?: unknown; resetsAt?: unknown }>;
	return {
		status: typeof info.status === 'string' ? info.status : 'unbekannt',
		fenster: { fuenfStunden: fenster(fenster2.five_hour), sieben: fenster(fenster2.seven_day) },
		zurueck: zeitpunkt(info.resetsAt),
	};
};

const uhrzeit = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleString('de-DE', {
				weekday: 'long',
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'Europe/Berlin',
			})
		: null;

export const limitErreichtText = (zurueck: string | null) => {
	const wann = uhrzeit(zurueck);
	return `Das Limit des Claude-Kontos ist erreicht${wann ? `. Wieder möglich ab ${wann} Uhr` : ''}. Auch die Claude-App ist so lange betroffen.`;
};

const FEHLER_TEXTE: Record<string, string> = {
	authentication_failed: 'Claude ist auf dem Server nicht angemeldet. Der Admin meldet es dort mit „claude“ an.',
	error_max_turns: 'Der Auftrag war zu umfangreich. Wähle einen kleineren Teil des Blatts.',
	error_max_budget_usd: 'Der Auftrag war zu umfangreich. Wähle einen kleineren Teil des Blatts.',
};
const FEHLER_UNBEKANNT = 'Claude konnte den Auftrag nicht ausführen. Bitte versuch es noch einmal.';

interface Ergebnis {
	fehler: string | null;
	sitzung: string | null;
	antwort: string;
	verbrauch: Record<string, unknown>;
}

/** Wertet ein Ereignis aus `stream-json` aus. Text aus dem Material wandert nie in Schritte oder Log. */
const werteAus = (
	e: Record<string, unknown>,
	stand: { sitzung: string | null; fehlerCode: string | null; ergebnis: Partial<Ergebnis> },
	mitteile: { schritt: (text: string) => void; limit: (limit: KiLimit) => void },
) => {
	if (typeof e.session_id === 'string') {
		stand.sitzung = e.session_id;
	}
	if (e.type === 'rate_limit_event') {
		mitteile.limit(liesLimit((e.rate_limit_info ?? {}) as Record<string, unknown>));
	}
	if (e.type === 'assistant') {
		if (typeof e.error === 'string') {
			stand.fehlerCode = e.error;
		}
		const inhalt = ((e.message as { content?: unknown[] } | undefined)?.content ?? []) as {
			type?: string;
			name?: string;
			input?: { skill?: unknown };
		}[];
		for (const teil of inhalt) {
			const text = teil.type === 'tool_use' && teil.name ? textSchritt(teil.name, teil.input ?? {}) : null;
			if (text) {
				mitteile.schritt(text);
			}
		}
	}
	if (e.type === 'result') {
		const u = (e.usage ?? {}) as Record<string, unknown>;
		stand.ergebnis = {
			// Ohne Anmeldung meldet `claude` subtype „success“ mit is_error (Issue 056): subtype allein reicht nicht.
			fehler: e.is_error ? (stand.fehlerCode ?? (typeof e.subtype === 'string' ? e.subtype : 'unbekannt')) : null,
			antwort: typeof e.result === 'string' ? e.result : '',
			verbrauch: {
				runden: e.num_turns,
				kostenUsd: e.total_cost_usd,
				ausgabe: u.output_tokens,
				cacheLesen: u.cache_read_input_tokens,
				cacheSchreiben: u.cache_creation_input_tokens,
				abgelehnt: Array.isArray(e.permission_denials) ? e.permission_denials.length : 0,
			},
		};
	}
};

/** Skills derselben Version wie der Server, als Kopie: Durch einen Symlink lehnt `Read` die `references/` ab (056). */
const legeAblageAn = async (ablage: string, wurzelSkills: string) => {
	const ziel = path.join(ablage, '.claude', 'skills');
	await mkdir(ziel, { recursive: true });
	const namen = (await readdir(wurzelSkills, { withFileTypes: true })).filter((d) => d.isDirectory());
	await Promise.all(
		namen.map(async ({ name }) => {
			await mkdir(path.join(ziel, name));
			await cp(path.join(wurzelSkills, name, 'SKILL.md'), path.join(ziel, name, 'SKILL.md')).catch(
				() => undefined,
			);
			const references = path.join(wurzelSkills, name, 'references');
			if (existsSync(references)) {
				await cp(references, path.join(ziel, name, 'references'), { recursive: true });
			}
		}),
	);
};

export const vorschlagDir = (materialDir: string, mappe: string, dok: string) =>
	path.join(dokumentDir(materialDir, mappe, dok), VORSCHLAG_ORDNER);

export const leseVorschlag = async (materialDir: string, mappe: string, dok: string) => {
	const dir = vorschlagDir(materialDir, mappe, dok);
	try {
		const [quelle, meta] = await Promise.all([
			readFile(path.join(dir, WORKFILE), 'utf8'),
			readFile(path.join(dir, VORSCHLAG_META), 'utf8'),
		]);
		return { quelle, meta: JSON.parse(meta) as VorschlagMeta };
	} catch {
		return null;
	}
};

export const verwirfVorschlag = (materialDir: string, mappe: string, dok: string) =>
	rm(vorschlagDir(materialDir, mappe, dok), { recursive: true, force: true });

interface Ausschnitt {
	text: string;
	umfang: string;
	/** Setzt das Ergebnis wieder ins ganze Blatt ein. */
	einsetzen: (neu: string) => string;
}

const waehleAusschnitt = (quelle: string, w: KiWunsch): Ausschnitt => {
	const ganz: Ausschnitt = { text: quelle, umfang: 'Ganzes Blatt', einsetzen: (neu) => neu };
	if (!w.referenz) {
		return ganz;
	}
	const z = zerlege(quelle);
	const [ref] = liesReferenzen(w.referenz);
	if (!ref || ref.mappe !== w.mappe || ref.dok !== w.dok) {
		throw new HttpFehler(400, 'Der gewählte Teil gehört nicht zu diesem Blatt.');
	}
	const { befund, ziel } = loeseReferenz(z, ref);
	if (befund === 'dokument') {
		return ganz;
	}
	if (!ziel) {
		throw new HttpFehler(409, 'Der gewählte Teil ist nicht mehr eindeutig zu finden. Bitte wähle ihn neu.');
	}
	const { k, pfad } = ziel;
	return {
		text: quelleVon(z, k),
		umfang: pfadText(pfad),
		einsetzen: (neu) => `${quelle.slice(0, k.start)}${neu.trim()}${quelle.slice(k.ende)}`,
	};
};

const prompt = (w: KiWunsch, ausschnitt: Ausschnitt, kopf: string) =>
	[
		w.skills?.length ? `Lade zuerst diese Skills: ${w.skills.join(', ')}.` : null,
		`Auftrag der Lehrkraft: ${w.auftrag}`,
		kopf,
		ausschnitt.umfang === 'Ganzes Blatt'
			? null
			: `material.html enthält nur diesen Teil des Blatts: ${ausschnitt.umfang}. Ändere nur ihn und lass das äußere Element bestehen.`,
	]
		.filter(Boolean)
		.join('\n\n');

/** Je Ablage ein Ordner: Entwicklung und Produktion dürfen einander beim Aufräumen nicht treffen. */
export const kiTempWurzel = (materialDir: string) => path.join(tmpdir(), `schoolbox-ki-${kennung(materialDir)}`);

/** Der fertige Auftrag einer Aktion samt ihrer Skills. Fach- und Material-Skill nur, wenn es sie im Repo gibt. */
export const aktionWunsch = async (
	aktion: KiAktion,
	ort: { fach: string; art: string },
): Promise<Pick<KiWunsch, 'anzeige' | 'auftrag' | 'skills'>> => {
	const gibtEs = (name: string) => existsSync(path.join(WURZEL, 'skills', name, 'SKILL.md'));
	const dazu = aktion.ohneFachSkill ? [] : [`fach-${ort.fach}`, ort.art].filter(gibtEs);
	return {
		anzeige: aktion.name,
		auftrag: (await readFile(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', `${aktion.id}.md`), 'utf8')).trim(),
		skills: [...new Set([...aktion.skills, ...dazu])],
	};
};

export const erstelleKi = ({ ereignisse, konfig, pruefer }: Abhaengigkeiten) => {
	const wurzelTmp = kiTempWurzel(konfig.materialDir);
	const pidDatei = path.join(wurzelTmp, 'pid');
	const auftraege = new Map<string, KiAuftrag>();
	const warteschlange: { auftrag: KiAuftrag; wunsch: KiWunsch }[] = [];
	let aktiv: { auftrag: KiAuftrag; kind: ChildProcessWithoutNullStreams | null; abbruch: boolean } | null = null;
	let limit: KiLimit | null = null;
	let anmeldung: { wert: boolean; bis: number } | null = null;
	const bin = kiPfad(konfig);
	const auftragDatei = path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'auftrag.md');
	const projekte = () => path.join(homedir(), '.claude', 'projects');
	const sitzungsPrefix = wurzelTmp.replace(/[^a-zA-Z0-9]/g, '-');

	const melde = (a: KiAuftrag) => {
		ereignisse.sende({ typ: 'ki-stand', daten: { mappe: a.mappe, dok: a.dok, id: a.id } });
	};

	const raeumeSitzungenAuf = async () => {
		const namen = await readdir(projekte()).catch(() => [] as string[]);
		await Promise.all(
			namen
				.filter((n) => n.startsWith(sitzungsPrefix))
				.map((n) => rm(path.join(projekte(), n), { recursive: true, force: true })),
		);
	};

	/** Reste eines abgestürzten Servers: Der Prozess läuft sonst weiter und verbraucht Limit. */
	const beendeReste = async () => {
		try {
			const pid = Number(readFileSync(pidDatei, 'utf8'));
			if (readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(wurzelTmp)) {
				process.kill(pid, 'SIGTERM');
			}
		} catch {
			// Keine Datei oder kein Prozess: nichts zu tun.
		}
		await rm(wurzelTmp, { recursive: true, force: true });
		await raeumeSitzungenAuf();
	};

	const angemeldet = async (): Promise<boolean> => {
		if (!konfig.kiAn) {
			return false;
		}
		if (anmeldung && anmeldung.bis > Date.now()) {
			return anmeldung.wert;
		}
		const wert = await new Promise<boolean>((resolve) => {
			// Nur der Status, den `claude` selbst meldet: Die Schoolbox liest keine Anmeldedaten.
			const kind = spawn(bin, ['auth', 'status'], { env: kiUmgebung(bin), timeout: 15_000 });
			let aus = '';
			kind.stdout.on('data', (d: Buffer) => {
				aus += d.toString();
			});
			kind.on('error', () => resolve(false));
			kind.on('close', (code) => {
				try {
					resolve(code === 0 && (JSON.parse(aus) as { loggedIn?: unknown }).loggedIn === true);
				} catch {
					resolve(false);
				}
			});
		});
		anmeldung = { wert, bis: Date.now() + ANMELDUNG_GILT_MS };
		return wert;
	};

	const limitErreicht = () =>
		limit?.status === 'rejected' && (!limit.zurueck || new Date(limit.zurueck).getTime() > Date.now());

	const beendeKind = (kind: ChildProcessWithoutNullStreams) => {
		kind.kill('SIGINT');
		const hart = setTimeout(() => kind.kill('SIGTERM'), BEENDEN_MS);
		const ganzHart = setTimeout(() => kind.kill('SIGKILL'), BEENDEN_MS * 2);
		kind.once('close', () => {
			clearTimeout(hart);
			clearTimeout(ganzHart);
		});
	};

	/** Ein Lauf von `claude`. Grenzen: Zeit und Menge der Ausgabe; Runden und Budget über die Argumente. */
	const lauf = (arbeit: string, ablage: string, text: string, sitzung: string | null, a: KiAuftrag) =>
		new Promise<Ergebnis>((resolve) => {
			const stand = { sitzung, fehlerCode: null as string | null, ergebnis: {} as Partial<Ergebnis> };
			// Abgebrochen, bevor der Prozess lief (die Ablage braucht einen Moment): gar nicht erst starten.
			if (aktiv?.abbruch) {
				resolve({ fehler: null, sitzung, antwort: '', verbrauch: {} });
				return;
			}
			const kind = spawn(bin, kiArgumente({ ablage, auftragDatei, modell: konfig.kiModell, sitzung }), {
				cwd: arbeit,
				env: kiUmgebung(bin),
			});
			if (aktiv) {
				aktiv.kind = kind;
			}
			if (kind.pid) {
				writeFileSync(pidDatei, String(kind.pid));
			}
			let grund: string | null = null;
			let bytes = 0;
			const stoppe = (warum: string) => {
				grund = warum;
				beendeKind(kind);
			};
			const frist = setTimeout(
				() => stoppe('Der Auftrag hat zu lange gedauert und wurde beendet.'),
				KI_GRENZEN.zeitMs,
			);
			kind.stdin.on('error', () => undefined);
			kind.stdin.end(text);
			kind.stderr.resume();
			createInterface({ input: kind.stdout }).on('line', (zeile) => {
				bytes += zeile.length;
				if (bytes > KI_GRENZEN.ausgabeBytes) {
					stoppe('Die Antwort von Claude war zu groß.');
					return;
				}
				try {
					werteAus(JSON.parse(zeile) as Record<string, unknown>, stand, {
						schritt: (schritt) => {
							if (a.schritte.at(-1) !== schritt) {
								a.schritte.push(schritt);
								melde(a);
							}
						},
						limit: (neu) => {
							limit = neu;
						},
					});
				} catch {
					// Keine JSON-Zeile: gehört nicht zum Protokoll.
				}
			});
			kind.on('error', (fehler: Error & { code?: string }) => {
				grund = fehler.code === 'ENOENT' ? 'Claude ist auf dem Server nicht installiert.' : FEHLER_UNBEKANNT;
			});
			kind.on('close', (code) => {
				clearTimeout(frist);
				const fehler =
					grund ??
					(stand.fehlerCode && !stand.ergebnis.fehler ? stand.fehlerCode : null) ??
					stand.ergebnis.fehler ??
					(code === 0 ? null : (stand.fehlerCode ?? 'unbekannt'));
				resolve({
					fehler,
					sitzung: stand.sitzung,
					antwort: stand.ergebnis.antwort ?? '',
					verbrauch: stand.ergebnis.verbrauch ?? {},
				});
			});
		});

	const fehlerText = (code: string) => {
		if (code === 'rate_limit' || limitErreicht()) {
			if (limit && !limitErreicht()) {
				limit = { ...limit, status: 'rejected' };
			}
			return limitErreichtText(limit?.zurueck ?? null);
		}
		return FEHLER_TEXTE[code] ?? (code.includes(' ') ? code : FEHLER_UNBEKANNT);
	};

	const notiereVerbrauch = async (
		a: KiAuftrag,
		status: KiStatus,
		umfang: string,
		start: number,
		verbrauch: Record<string, unknown>,
	) => {
		const zeile = {
			zeit: new Date().toISOString(),
			mappe: a.mappe,
			dok: a.dok,
			status,
			umfang: umfang === 'Ganzes Blatt' ? 'blatt' : 'teil',
			sekunden: Math.round((Date.now() - start) / 1000),
			...verbrauch,
		};
		await writeFile(path.join(konfig.materialDir, VERBRAUCH_DATEI), `${JSON.stringify(zeile)}\n`, {
			flag: 'a',
		}).catch(() => undefined);
	};

	const leseErgebnis = async (arbeit: string) => {
		const datei = path.join(arbeit, WORKFILE);
		// Was Claude sonst noch anlegt, wird nie gelesen.
		const { size } = await stat(datei);
		if (size > KI_GRENZEN.materialBytes) {
			throw new HttpFehler(422, 'Das Ergebnis von Claude ist zu groß und wurde verworfen.');
		}
		return readFile(datei, 'utf8');
	};

	const berichtText = (m: Meldung[]) =>
		m
			.filter((x) => x.stufe === 'FEHLER')
			.map((x) => `Seite ${x.seite}: ${x.text}`)
			.join('\n');

	/** Scheitert nur die Prüfung, wäre die Arbeit von Claude sonst umsonst verbraucht: Der Vorschlag bleibt, mit Hinweis. */
	const pruefeSicher = async (dir: string, html: string): Promise<Pruefbericht> => {
		try {
			return await pruefer(dir, html);
		} catch (fehler) {
			console.error('Prüfung eines Vorschlags:', fehler);
			return {
				seiten: [],
				fehler: 0,
				meldungen: [
					{
						stufe: 'WARNUNG',
						seite: 1,
						text: 'Das Blatt ließ sich nicht automatisch prüfen. Sieh es dir genau an.',
					},
				],
			};
		}
	};

	const arbeite = async (a: KiAuftrag, w: KiWunsch) => {
		const start = Date.now();
		const dir = dokumentDir(konfig.materialDir, w.mappe, w.dok);
		const vorhanden = await leseVorschlag(konfig.materialDir, w.mappe, w.dok);
		const auf = w.aufVorschlag ? vorhanden : null;
		const quelle = auf ? auf.quelle : await leseQuelle(dir);
		const basis = auf ? auf.meta.basis : kennung(await leseQuelle(dir));
		const ausschnitt = waehleAusschnitt(quelle, w);
		const meta = await leseMeta(konfig.materialDir, w.mappe, w.dok);
		await mkdir(wurzelTmp, { recursive: true, mode: 0o700 });
		const tmp = await mkdtemp(path.join(wurzelTmp, 'lauf-'));
		const arbeit = path.join(tmp, 'arbeit');
		const ablage = path.join(tmp, 'ablage');
		let verbrauch: Record<string, unknown> = {};
		let ende: KiStatus = 'fehler';
		try {
			await mkdir(arbeit);
			await legeAblageAn(ablage, path.join(WURZEL, 'skills'));
			await writeFile(path.join(arbeit, WORKFILE), ausschnitt.text);
			const kopf = `Das Blatt: „${meta.titel}“, Art ${meta.art}.`;
			const erst = await lauf(arbeit, ablage, prompt(w, ausschnitt, kopf), null, a);
			verbrauch = erst.verbrauch;
			if (aktiv?.abbruch) {
				ende = 'abgebrochen';
				return;
			}
			if (erst.fehler) {
				throw new HttpFehler(500, fehlerText(erst.fehler));
			}
			let neu = await leseErgebnis(arbeit);
			if (neu === ausschnitt.text) {
				throw new HttpFehler(422, erst.antwort || 'Claude hat nichts am Blatt geändert.');
			}
			a.schritte.push('Prüft das Ergebnis');
			melde(a);
			let bericht = await pruefeSicher(dir, ausschnitt.einsetzen(neu));
			let antwort = erst.antwort;
			// Höchstens eine Korrekturrunde: Sie geht wie alles ans geteilte Limit.
			if (bericht.fehler > 0 && erst.sitzung) {
				a.schritte.push('Bessert nach');
				melde(a);
				const zweit = await lauf(
					arbeit,
					ablage,
					`Die Prüfung meldet diese Fehler. Behebe sie in material.html:\n${berichtText(bericht.meldungen)}`,
					erst.sitzung,
					a,
				);
				if (aktiv?.abbruch) {
					ende = 'abgebrochen';
					return;
				}
				if (!zweit.fehler) {
					neu = await leseErgebnis(arbeit);
					bericht = await pruefeSicher(dir, ausschnitt.einsetzen(neu));
					antwort = zweit.antwort || antwort;
				}
			}
			const ziel = vorschlagDir(konfig.materialDir, w.mappe, w.dok);
			await rm(ziel, { recursive: true, force: true });
			await mkdir(ziel);
			const vorschlag: VorschlagMeta = {
				auftrag: w.anzeige ?? w.auftrag,
				umfang: ausschnitt.umfang,
				zeit: new Date().toISOString(),
				basis,
				antwort,
				meldungen: bericht.meldungen.map(({ code, seite, stufe, text }) => ({ code, seite, stufe, text })),
				fehler: bericht.fehler,
			};
			await schreibeAtomar(path.join(ziel, WORKFILE), ausschnitt.einsetzen(neu));
			await schreibeAtomar(path.join(ziel, VORSCHLAG_META), JSON.stringify(vorschlag, null, '\t'));
			ende = 'fertig';
		} finally {
			await rm(tmp, { recursive: true, force: true });
			await raeumeSitzungenAuf();
			await rm(pidDatei, { force: true });
			await notiereVerbrauch(a, ende, ausschnitt.umfang, start, verbrauch);
		}
	};

	const naechster = () => {
		if (aktiv) {
			return;
		}
		const eintrag = warteschlange.shift();
		if (!eintrag) {
			return;
		}
		const { auftrag: a, wunsch } = eintrag;
		aktiv = { auftrag: a, kind: null, abbruch: false };
		a.status = 'laeuft';
		melde(a);
		arbeite(a, wunsch)
			.then(() => {
				a.status = aktiv?.abbruch ? 'abgebrochen' : 'fertig';
			})
			.catch((fehler: unknown) => {
				a.status = 'fehler';
				a.fehler = fehler instanceof HttpFehler ? fehler.message : FEHLER_UNBEKANNT;
				if (!(fehler instanceof HttpFehler)) {
					console.error('Auftrag an Claude:', fehler);
				}
			})
			.finally(() => {
				aktiv = null;
				melde(a);
				naechster();
			});
	};

	return {
		beendeReste,
		angemeldet,
		limit: () => limit,
		auftrag: (id: string) => auftraege.get(id) ?? null,
		/** Laufende und wartende Aufträge eines Dokuments, damit ein neu geöffneter Editor sie wiederfindet. */
		offene: (mappe: string, dok: string) =>
			[...auftraege.values()].filter(
				(a) => a.mappe === mappe && a.dok === dok && (a.status === 'laeuft' || a.status === 'wartet'),
			),
		starte: async (wunsch: KiWunsch): Promise<KiAuftrag> => {
			if (!(await angemeldet())) {
				throw new HttpFehler(409, FEHLER_TEXTE.authentication_failed ?? FEHLER_UNBEKANNT);
			}
			if (limitErreicht()) {
				throw new HttpFehler(429, limitErreichtText(limit?.zurueck ?? null));
			}
			if (!wunsch.auftrag.trim() || wunsch.auftrag.length > KI_GRENZEN.auftragZeichen) {
				throw new HttpFehler(
					400,
					`Der Auftrag muss zwischen 1 und ${KI_GRENZEN.auftragZeichen} Zeichen lang sein.`,
				);
			}
			if (warteschlange.length >= KI_GRENZEN.warten) {
				throw new HttpFehler(429, 'Es warten schon mehrere Aufträge. Bitte warte, bis einer fertig ist.');
			}
			// Falsche Referenz gleich melden, nicht erst, wenn der Auftrag an der Reihe ist.
			const dir = dokumentDir(konfig.materialDir, wunsch.mappe, wunsch.dok);
			waehleAusschnitt(await leseQuelle(dir), wunsch.aufVorschlag ? { ...wunsch, referenz: undefined } : wunsch);
			const auftrag: KiAuftrag = {
				id: randomUUID(),
				mappe: wunsch.mappe,
				dok: wunsch.dok,
				status: 'wartet',
				schritte: [],
				fehler: null,
			};
			auftraege.set(auftrag.id, auftrag);
			warteschlange.push({ auftrag, wunsch });
			melde(auftrag);
			naechster();
			return auftrag;
		},
		abbrechen: (id: string) => {
			const a = auftraege.get(id);
			if (!a) {
				return false;
			}
			const stelle = warteschlange.findIndex((w) => w.auftrag.id === id);
			if (stelle >= 0) {
				warteschlange.splice(stelle, 1);
				a.status = 'abgebrochen';
				melde(a);
				return true;
			}
			if (aktiv?.auftrag.id === id) {
				aktiv.abbruch = true;
				if (aktiv.kind) {
					beendeKind(aktiv.kind);
				}
				return true;
			}
			return false;
		},
		/** Beim Beenden des Servers: nichts darf weiterlaufen und Limit verbrauchen. */
		stop: () => {
			if (aktiv?.kind) {
				aktiv.abbruch = true;
				aktiv.kind.kill('SIGTERM');
			}
			warteschlange.length = 0;
			rmSync(wurzelTmp, { recursive: true, force: true });
		},
	};
};

export type Ki = ReturnType<typeof erstelleKi>;
