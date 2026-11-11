/**
 * Unterrichtseinheit im Server (139): ein großer Lauf von `claude`, der einen Ordner mit mehreren Dokumenten füllt.
 * Der Server übernimmt jedes Dokument, sobald Claude es in `einheit.json` als fertig meldet, und prüft es dabei.
 *
 * Der Arbeitsordner liegt außerhalb von `kiTempWurzel`: Den räumt jeder Neustart ab, eine Einheit soll aber
 * „Weiterbauen“ überstehen. Der eigene Prefix schützt die Sitzungen vor dem Aufräumen der Gespräche (087).
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

import type { EinheitAngaben, EinheitBefund, EinheitStand, PlanDokument, Pruefbericht } from '@schoolbox/kern';
import {
	dokKnotenSchluessel,
	dokumentDir,
	EINHEIT_AUFTRAG_ZEICHEN,
	EINHEIT_PLAN,
	EINHEIT_THEMA,
	einheitAuftragAus,
	formatBefund,
	freierName,
	lebenderOrdner,
	lesePlan,
	mappenDir,
	namenIn,
	neueFunde,
	neueMappe,
	neuesDokument,
	pruefeEinheitAngaben,
	schreibeAtomar,
	themaBefund,
	uebernimmBilder,
	wendeAktionAn,
	wendeBilderAn,
	WURZEL,
} from '@schoolbox/kern';
import type { Router as RouterTyp } from 'express';

import type { BildLader } from './canva-bild';
import { erstelleBildLader, notiereCanvaId } from './canva-bild';
import { schreibeQuelle } from './dokumente';
import { HttpFehler } from './fehler';
import type { Ergebnis, KiPruefer, LaufStand } from './ki';
import { beendeKind, KI_GRENZEN, kiArgumente, kiPfad, kiUmgebung, legeAblageAn, VERBRAUCH_DATEI, werteAus } from './ki';
import type { Kontext } from './kontext';
import { dokSchluessel } from './kontext';
import { umgebung, wendeEffekteAn } from './ordner';

const ID = /^[a-f0-9]{12}$/;
const STAND = 'stand.json';
const PID = 'pid';
const TAKT_MS = 2000;
const MAX_PLAN_BYTES = 256 * 1024;
const BILD_IM_DOKUMENT = /\.\.\/\.\.\/bilder\/([a-z0-9][a-z0-9-]{0,59}\.(?:png|jpg))/g;

const kennung = (inhalt: string) => createHash('sha256').update(inhalt).digest('hex').slice(0, 16);

export const einheitenWurzel = (materialDir: string) =>
	path.join(tmpdir(), `schoolbox-einheit-${kennung(materialDir)}`);

export const pruefeEinheitId = (wert: unknown) => {
	if (typeof wert !== 'string' || !ID.test(wert)) {
		throw new HttpFehler(404, 'Diese Einheit gibt es nicht.');
	}
	return wert;
};

const KORREKTUR = (befunde: EinheitBefund[]) =>
	[
		'Korrekturrunde. Die Prüfung der Schoolbox meldet bei diesen Materialien Fehler:',
		...befunde.map((b) => `- dokumente/${b.slug}/material.html: ${b.texte.join(' · ')}`),
		'Behebe nur diese Fehler in den genannten Dateien und setze danach in einheit.json „fertig“ für diese Materialien wieder auf true. Antworte am Ende in höchstens drei Zeilen.',
	].join('\n');

const WEITER = (stand: EinheitStand) =>
	[
		'Weiterbauen. Der vorige Lauf wurde unterbrochen.',
		`Schon in der Schoolbox: ${Object.keys(stand.importiert).join(', ') || 'noch nichts'}.`,
		'Lies einheit.json und baue nur die Materialien, die noch nicht fertig sind. Ändere fertige nicht.',
	].join('\n');

export const erstelleEinheiten = (kontext: Kontext, pruefer: KiPruefer) => {
	const { materialDir } = kontext.konfig;
	const wurzel = einheitenWurzel(materialDir);
	const bin = kiPfad(kontext.konfig);
	const auftragDatei = path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit.md');
	const projekte = () => path.join(homedir(), '.claude', 'projects');
	const projektName = (arbeit: string) => arbeit.replace(/[^a-zA-Z0-9]/g, '-');

	const dir = (id: string) => path.join(wurzel, `einheit-${id}`);
	const arbeitDir = (id: string) => path.join(dir(id), 'arbeit');
	const ablageDir = (id: string) => path.join(dir(id), 'ablage');

	let aktiv: {
		stand: EinheitStand;
		kind: ChildProcessWithoutNullStreams | null;
		abbruch: boolean;
		lader: BildLader | null;
		takt: ReturnType<typeof setInterval> | null;
		/** Ein Abgleich zur Zeit; der Takt wartet sonst auf sich selbst. */
		abgleich: Promise<void>;
		letzterPlan: string;
		letztesThema: string;
		/** Der zuletzt gemeldete Stand: Der Takt meldet nur Änderungen. */
		gemeldet: string;
	} | null = null;
	let aufraeumTakt: ReturnType<typeof setInterval> | null = null;

	const melde = (s: EinheitStand) => {
		kontext.ereignisse.sende({ typ: 'einheit-stand', daten: { id: s.id, ordner: s.ordner } });
	};

	const merke = async (s: EinheitStand) => {
		await schreibeAtomar(path.join(dir(s.id), STAND), JSON.stringify(s));
		melde(s);
	};

	const lese = async (id: string): Promise<EinheitStand | null> => {
		try {
			return JSON.parse(await readFile(path.join(dir(id), STAND), 'utf8')) as EinheitStand;
		} catch {
			return null;
		}
	};

	const alle = async () => {
		const namen = (await readdir(wurzel).catch(() => [] as string[])).filter((n) => n.startsWith('einheit-'));
		const staende = await Promise.all(namen.map((n) => lese(n.slice('einheit-'.length))));
		return staende.filter((s): s is EinheitStand => s !== null);
	};

	const loesche = async (id: string) => {
		await rm(dir(id), { recursive: true, force: true });
		await rm(path.join(projekte(), projektName(arbeitDir(id))), { recursive: true, force: true });
	};

	const notiereVerbrauch = async (
		s: EinheitStand,
		status: string,
		start: number,
		verbrauch: Record<string, unknown>,
	) => {
		const zeile = {
			zeit: new Date().toISOString(),
			mappe: s.mappe,
			dok: '',
			status,
			umfang: 'einheit',
			sekunden: Math.round((Date.now() - start) / 1000),
			dokumente: Object.keys(s.importiert).length,
			...verbrauch,
		};
		await appendFile(path.join(materialDir, VERBRAUCH_DATEI), `${JSON.stringify(zeile)}\n`).catch(() => undefined);
	};

	const budget = () => {
		const limit = kontext.ki.limit();
		const ueberGuthaben =
			(limit?.status === 'rejected' || limit?.laeuftUeberGuthaben === true) &&
			(!limit.zurueck || new Date(limit.zurueck).getTime() > Date.now());
		return ueberGuthaben ? KI_GRENZEN.einheit.budgetGuthabenUsd : KI_GRENZEN.einheit.budgetUsd;
	};

	// ── Übernahme ──

	const befund = (s: EinheitStand, slug: string, dok: string | null, texte: string[]) => {
		s.befunde = [...s.befunde.filter((b) => b.slug !== slug), ...(texte.length ? [{ slug, dok, texte }] : [])];
	};

	const ordnerLebt = () => {
		const s = aktiv?.stand;
		return s ? lebenderOrdner(kontext.ordner.baum(), s.ordner) !== null : false;
	};

	const uebernimmThema = async (s: EinheitStand) => {
		const datei = path.join(arbeitDir(s.id), EINHEIT_THEMA);
		if (!aktiv || !existsSync(datei)) {
			return;
		}
		const css = await readFile(datei, 'utf8');
		if (css === aktiv.letztesThema) {
			return;
		}
		aktiv.letztesThema = css;
		const grund = themaBefund(css);
		befund(s, EINHEIT_THEMA, null, grund ? [grund] : []);
		if (!grund) {
			await schreibeAtomar(path.join(mappenDir(materialDir, s.mappe), EINHEIT_THEMA), css);
		}
	};

	/** Legt das Dokument im Behälter an, beim ersten Mal auch im Ordner. Text und Bilder kommen danach. */
	const dokumentFuer = async (s: EinheitStand, d: PlanDokument) => {
		const da = s.importiert[d.slug];
		if (da) {
			return da.dok;
		}
		return kontext.ordner.aendere(async (baum) => {
			const { id } = await neuesDokument(materialDir, s.mappe, {
				titel: d.titel,
				art: d.art,
				format: d.format,
				druckprofil: 'farbe',
				druckhinweise: [],
				urheber: 'claude',
			});
			const neu = structuredClone(baum);
			neu.rev += 1;
			neu.dokumente[dokKnotenSchluessel(s.mappe, id)] = { ordner: s.ordner, geloescht: null };
			return { baum: neu, ergebnis: id };
		});
	};

	/** Der Kopf, den jedes Blatt hat (Gerüst aus der Ablage) plus das Thema der Einheit: Bestand, keine neuen Funde. */
	const ERLAUBTER_KOPF =
		'<meta charset="utf-8"><link rel="stylesheet" href="blatt.css"><link rel="stylesheet" href="../../thema.css"><script src="abbildungen.js"></script>';

	const importiere = async (s: EinheitStand, d: PlanDokument) => {
		const datei = path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html');
		if (!existsSync(datei) || (await stat(datei)).size > KI_GRENZEN.materialBytes) {
			befund(s, d.slug, null, ['Die Quelle fehlt oder ist zu groß.']);
			return;
		}
		const roh = await readFile(datei, 'utf8');
		const k = kennung(roh);
		if (s.importiert[d.slug]?.kennung === k) {
			return;
		}
		// Verbotenes kommt gar nicht erst in die Ablage; die Korrekturrunde bekommt den Befund.
		const sperre = [...neueFunde(ERLAUBTER_KOPF, roh).map((f) => f.text), formatBefund(roh)].filter(
			(t): t is string => typeof t === 'string',
		);
		if (sperre.length) {
			befund(s, d.slug, s.importiert[d.slug]?.dok ?? null, sperre);
			return;
		}
		const mappeDir = mappenDir(materialDir, s.mappe);
		const bilder = [...new Set([...roh.matchAll(BILD_IM_DOKUMENT)].map((t) => `bilder/${t[1]}`))].filter((b) =>
			existsSync(path.join(arbeitDir(s.id), b)),
		);
		const umbenannt = await uebernimmBilder(arbeitDir(s.id), mappeDir, bilder);
		for (const b of bilder) {
			const w = aktiv?.lader?.wunsch(path.basename(b));
			if (w) {
				await notiereCanvaId(path.join(mappeDir, 'bilder'), { ...w, datei: path.basename(umbenannt[b] ?? b) });
			}
		}
		const html = wendeBilderAn(roh, umbenannt);
		const dok = await dokumentFuer(s, d);
		await kontext.sperre(dokSchluessel(s.mappe, dok), () =>
			schreibeQuelle(kontext, s.mappe, dok, html, { urheber: 'claude', zusammenfassen: false }),
		);
		s.importiert[d.slug] = { dok, kennung: k };
		const bericht: Pruefbericht = await pruefer(dokumentDir(materialDir, s.mappe, dok), html).catch(() => ({
			seiten: [],
			fehler: 0,
			meldungen: [],
		}));
		befund(
			s,
			d.slug,
			dok,
			bericht.meldungen.filter((m) => m.stufe === 'FEHLER').map((m) => `Seite ${m.seite}: ${m.text}`),
		);
	};

	const stoppe = (grund: string) => {
		if (aktiv && !aktiv.abbruch) {
			aktiv.abbruch = true;
			aktiv.stand.grund = grund;
			if (aktiv.kind) {
				beendeKind(aktiv.kind);
			}
		}
	};

	/** Ein Durchgang: Bilder laden, Plan lesen, Thema und fertige Dokumente übernehmen. */
	const gleicheAb = async () => {
		const a = aktiv;
		if (!a) {
			return;
		}
		const s = a.stand;
		if (!ordnerLebt()) {
			// Der Ordner wurde gelöscht: nichts mehr hineinlegen (140, Fallen).
			stoppe('Der Ordner der Einheit wurde gelöscht.');
			return;
		}
		await a.lader?.pruefe();
		const planDatei = path.join(arbeitDir(s.id), EINHEIT_PLAN);
		if (existsSync(planDatei) && (await stat(planDatei)).size <= MAX_PLAN_BYTES) {
			const text = await readFile(planDatei, 'utf8');
			if (text !== a.letzterPlan) {
				a.letzterPlan = text;
				try {
					const plan = lesePlan(JSON.parse(text), KI_GRENZEN.einheit.dokumente);
					if (plan) {
						s.plan = plan;
					}
				} catch {
					// Halb geschrieben: beim nächsten Takt wieder.
				}
			}
		}
		await uebernimmThema(s);
		for (const d of s.plan?.dokumente ?? []) {
			if (d.fertig) {
				try {
					await importiere(s, d);
				} catch (fehler) {
					console.error('Einheit übernehmen:', (fehler as Error).message);
					befund(s, d.slug, s.importiert[d.slug]?.dok ?? null, ['Die Übernahme ist gescheitert.']);
				}
			}
		}
		if (a.lader) {
			const stand = a.lader.stand();
			s.geladeneBilder = stand.filter((b) => b.ok).length;
			s.fehlgeschlageneBilder = stand.length - s.geladeneBilder;
		}
		const jetzt = JSON.stringify(s);
		if (jetzt !== a.gemeldet) {
			a.gemeldet = jetzt;
			await merke(s);
		}
	};

	const abgleich = () => {
		const a = aktiv;
		if (!a) {
			return Promise.resolve();
		}
		a.abgleich = a.abgleich.then(gleicheAb, gleicheAb).catch((fehler: unknown) => {
			console.error('Einheit abgleichen:', fehler);
		});
		return a.abgleich;
	};

	// ── Lauf ──

	const lauf = (s: EinheitStand, text: string, sitzung: string | null) =>
		new Promise<Ergebnis>((resolve) => {
			const stand: LaufStand = { sitzung, fehlerCode: null, ergebnis: {} };
			const kind = spawn(
				bin,
				kiArgumente({
					ablage: ablageDir(s.id),
					auftragDatei,
					budgetUsd: budget(),
					modell: kontext.konfig.kiModell,
					sitzung,
					einheit: true,
					mitCanva: s.bilder,
				}),
				{ cwd: arbeitDir(s.id), env: kiUmgebung(bin) },
			);
			if (aktiv) {
				aktiv.kind = kind;
			}
			if (kind.pid) {
				writeFileSync(path.join(dir(s.id), PID), String(kind.pid));
			}
			let grund: string | null = null;
			let bytes = 0;
			const frist = setTimeout(() => {
				grund = 'Die Zeit für die Einheit ist abgelaufen.';
				beendeKind(kind);
			}, KI_GRENZEN.einheit.zeitMs);
			kind.stdin.on('error', () => undefined);
			kind.stdin.end(text);
			kind.stderr.resume();
			createInterface({ input: kind.stdout }).on('line', (zeile) => {
				bytes += zeile.length;
				if (bytes > KI_GRENZEN.ausgabeBytes * 4) {
					grund = 'Die Antwort von Claude war zu groß.';
					beendeKind(kind);
					return;
				}
				try {
					werteAus(JSON.parse(zeile) as Record<string, unknown>, stand, {
						schritt: () => undefined,
						limit: () => undefined,
					});
				} catch {
					// Keine JSON-Zeile.
				}
			});
			kind.on('error', () => {
				grund = 'Claude ist auf dem Server nicht installiert.';
			});
			kind.on('close', (code) => {
				clearTimeout(frist);
				const fehler =
					grund ?? stand.ergebnis.fehler ?? (code === 0 ? null : (stand.fehlerCode ?? 'unbekannt'));
				resolve({
					fehler,
					sitzung: stand.sitzung,
					antwort: stand.ergebnis.antwort ?? '',
					verbrauch: stand.ergebnis.verbrauch ?? {},
					kontext: stand.kontext ?? 0,
					gearbeitet: stand.gearbeitet ?? false,
				});
			});
		});

	const FEHLER_TEXT: Record<string, string> = {
		rate_limit: 'Das Limit des Claude-Kontos ist erreicht.',
		error_max_turns: 'Die Einheit hat die Zahl der Schritte ausgeschöpft.',
		error_max_budget_usd: 'Das Budget der Einheit ist aufgebraucht.',
	};

	const fuehreAus = async (s: EinheitStand, text: string, sitzung: string | null) => {
		const start = Date.now();
		const takt = setInterval(() => void abgleich(), TAKT_MS);
		if (aktiv) {
			aktiv.takt = takt;
		}
		let ergebnis: Ergebnis;
		try {
			ergebnis = await lauf(s, text, sitzung);
			s.sitzung = ergebnis.sitzung ?? s.sitzung;
			await abgleich();
			await notiereVerbrauch(s, ergebnis.fehler ? 'unvollstaendig' : 'fertig', start, ergebnis.verbrauch);
			// Eine Korrekturrunde mit allen Befunden, wie bei einem Blatt (139).
			const offen = s.befunde.filter((b) => b.slug !== EINHEIT_THEMA || b.texte.length);
			if (!ergebnis.fehler && !aktiv?.abbruch && offen.length && !s.korrigiert && s.sitzung) {
				s.korrigiert = true;
				await merke(s);
				const start2 = Date.now();
				ergebnis = await lauf(s, KORREKTUR(offen), s.sitzung);
				await abgleich();
				await notiereVerbrauch(s, ergebnis.fehler ? 'unvollstaendig' : 'fertig', start2, ergebnis.verbrauch);
			}
		} finally {
			clearInterval(takt);
		}
		const plan = s.plan?.dokumente ?? [];
		const alleDa = plan.length > 0 && plan.every((d) => s.importiert[d.slug]);
		const abgebrochen = aktiv?.abbruch === true;
		s.status = !ergebnis.fehler && !abgebrochen && alleDa ? 'fertig' : 'unvollstaendig';
		s.grund =
			s.status === 'fertig'
				? null
				: (s.grund ??
					(ergebnis.fehler ? (FEHLER_TEXT[ergebnis.fehler] ?? ergebnis.fehler) : null) ??
					(alleDa ? null : 'Claude hat nicht alle geplanten Materialien fertig gemeldet.'));
		s.ende = new Date().toISOString();
		aktiv = null;
		await merke(s);
		await rm(path.join(dir(s.id), PID), { force: true });
	};

	const beginne = async (s: EinheitStand, text: string, sitzung: string | null) => {
		aktiv = {
			stand: s,
			kind: null,
			abbruch: false,
			lader: s.bilder ? erstelleBildLader(arbeitDir(s.id), path.join(arbeitDir(s.id), 'bilder')) : null,
			takt: null,
			abgleich: Promise.resolve(),
			letzterPlan: '',
			letztesThema: '',
			gemeldet: '',
		};
		s.status = 'laeuft';
		s.grund = null;
		s.ende = null;
		await merke(s);
		fuehreAus(s, text, sitzung).catch(async (fehler: unknown) => {
			console.error('Einheit:', fehler);
			aktiv = null;
			s.status = 'unvollstaendig';
			s.grund = 'Die Einheit ist mit einem Fehler stehen geblieben.';
			await merke(s).catch(() => undefined);
		});
	};

	const verlangeFrei = () => {
		if (aktiv) {
			throw new HttpFehler(
				409,
				`Claude baut gerade die Einheit „${aktiv.stand.titel}“. Es geht nur eine zur Zeit.`,
			);
		}
	};

	const starte = async (roh: { angaben: unknown; ordner: unknown; auftragText?: unknown }) => {
		verlangeFrei();
		if (!(await kontext.ki.angemeldet())) {
			throw new HttpFehler(503, 'Claude ist auf dem Server nicht verfügbar.');
		}
		let angaben: EinheitAngaben;
		try {
			angaben = pruefeEinheitAngaben(roh.angaben);
		} catch (fehler) {
			throw new HttpFehler(400, (fehler as Error).message);
		}
		const ziel = roh.ordner === null || roh.ordner === undefined ? null : roh.ordner;
		if (ziel !== null && typeof ziel !== 'string') {
			throw new HttpFehler(400, 'Der Ordner ist ungültig.');
		}
		let teil = einheitAuftragAus(angaben);
		if (roh.auftragText !== undefined) {
			if (
				typeof roh.auftragText !== 'string' ||
				roh.auftragText.trim() === '' ||
				roh.auftragText.length > EINHEIT_AUFTRAG_ZEICHEN
			) {
				throw new HttpFehler(400, 'Der Auftrag ist leer oder zu lang.');
			}
			teil = roh.auftragText.trim();
		}
		// Ordner und Behälter entstehen sofort; die Oberfläche öffnet den Ordner und wartet dort (140).
		const { mappe, ordner } = await kontext.ordner.aendere(async (baum) => {
			if (ziel !== null && !lebenderOrdner(baum, ziel)) {
				throw new HttpFehler(404, 'Diesen Ordner gibt es nicht mehr.');
			}
			const u = await umgebung(materialDir);
			const name = freierName(angaben.titel, namenIn(baum, ziel, u));
			const r = wendeAktionAn(baum, { art: 'neu', eltern: ziel, name }, u);
			await wendeEffekteAn(kontext, r.effekte, u.jetzt);
			const behaelter = (
				await neueMappe(materialDir, { titel: name, fach: angaben.fach, klasse: angaben.klasse })
			).mappe.id;
			const eintrag = r.baum.ordner.find((o) => o.id === r.neu);
			if (!eintrag || !r.neu) {
				throw new Error('Der neue Ordner fehlt im Baum.');
			}
			eintrag.behaelter = behaelter;
			return { baum: r.baum, ergebnis: { mappe: behaelter, ordner: r.neu } };
		});
		const id = randomBytes(6).toString('hex');
		await mkdir(path.join(arbeitDir(id), 'dokumente'), { recursive: true });
		await legeAblageAn(ablageDir(id), path.join(WURZEL, 'skills'));
		const s: EinheitStand = {
			id,
			titel: angaben.titel,
			ordner,
			mappe,
			status: 'laeuft',
			grund: null,
			start: new Date().toISOString(),
			ende: null,
			sitzung: null,
			plan: null,
			importiert: {},
			befunde: [],
			korrigiert: false,
			auftrag: teil,
			bilder: angaben.bilder,
			geladeneBilder: 0,
			fehlgeschlageneBilder: 0,
		};
		await beginne(s, `Auftrag der Lehrkraft (aus dem Assistenten):\n${teil}`, null);
		const fenster = kontext.ki.limit()?.fenster.fuenfStunden.auslastung ?? null;
		return {
			id,
			ordner,
			mappe,
			warnung:
				fenster !== null && fenster >= KI_GRENZEN.einheit.warnAb
					? `Dein 5-Stunden-Fenster ist schon zu ${Math.round(fenster * 100)} % genutzt. Die Einheit kann daran scheitern; „Weiterbauen“ geht danach.`
					: null,
		};
	};

	const verlange = async (id: string) => {
		const s = aktiv?.stand.id === id ? aktiv.stand : await lese(pruefeEinheitId(id));
		if (!s || s.status === 'verworfen') {
			throw new HttpFehler(404, 'Diese Einheit gibt es nicht mehr.');
		}
		return s;
	};

	const weiter = async (id: string) => {
		verlangeFrei();
		const s = await verlange(id);
		if (s.status !== 'unvollstaendig') {
			throw new HttpFehler(409, 'Diese Einheit ist nicht unterbrochen.');
		}
		if (!lebenderOrdner(kontext.ordner.baum(), s.ordner)) {
			throw new HttpFehler(409, 'Der Ordner der Einheit liegt im Papierkorb.');
		}
		s.korrigiert = false;
		// Die Sitzung kennt den Plan schon; ohne sie trägt der Prompt den Stand.
		const sitzung = s.sitzung && existsSync(path.join(projekte(), projektName(arbeitDir(s.id)))) ? s.sitzung : null;
		await beginne(
			s,
			sitzung ? WEITER(s) : `Auftrag der Lehrkraft (aus dem Assistenten):\n${s.auftrag}\n\n${WEITER(s)}`,
			sitzung,
		);
		return s;
	};

	const abbrechen = async (id: string) => {
		const s = await verlange(id);
		if (aktiv?.stand.id !== s.id) {
			return s;
		}
		stoppe('Abgebrochen.');
		return s;
	};

	/** Ordner in den Papierkorb (F3), Lauf beenden, Arbeitsordner weg. Wiederherstellbar ist der Ordner. */
	const verwirf = async (id: string) => {
		const s = await verlange(id);
		if (aktiv?.stand.id === s.id) {
			stoppe('Verworfen.');
			await new Promise<void>((resolve) => {
				const warte = setInterval(() => {
					if (aktiv?.stand.id !== s.id) {
						clearInterval(warte);
						resolve();
					}
				}, 200);
			});
		}
		await kontext.ordner.aendere(async (baum) => {
			if (!lebenderOrdner(baum, s.ordner)) {
				return { baum, ergebnis: null };
			}
			const u = await umgebung(materialDir);
			const r = wendeAktionAn(baum, { art: 'papierkorb', knoten: [{ ordner: s.ordner }] }, u);
			await wendeEffekteAn(kontext, r.effekte, u.jetzt);
			return { baum: r.baum, ergebnis: null, loescht: r.loescht };
		});
		s.status = 'verworfen';
		melde(s);
		await loesche(s.id);
	};

	/** Was ein Neustart hinterlässt: laufende werden unvollständig, alte Arbeitsordner gehen. */
	const raeumeAuf = async () => {
		for (const s of await alle()) {
			if (aktiv?.stand.id === s.id) {
				continue;
			}
			const alter = Date.now() - new Date(s.ende ?? s.start).getTime();
			if (s.status === 'fertig' || s.status === 'verworfen' || alter > KI_GRENZEN.einheit.aufhebenMs) {
				await loesche(s.id);
			} else if (s.status === 'laeuft') {
				s.status = 'unvollstaendig';
				s.grund = 'Der Server wurde neu gestartet.';
				s.ende = new Date().toISOString();
				await merke(s);
			}
		}
	};

	/** Ein Prozess eines abgestürzten Servers läuft sonst weiter und verbraucht Limit. */
	const beendeReste = async () => {
		for (const name of await readdir(wurzel).catch(() => [] as string[])) {
			try {
				const pid = Number(readFileSync(path.join(wurzel, name, PID), 'utf8'));
				if (readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(wurzel)) {
					process.kill(pid, 'SIGTERM');
				}
			} catch {
				// Keine Datei oder kein Prozess.
			}
		}
		await raeumeAuf();
	};

	return {
		starte,
		weiter,
		abbrechen,
		verwirf,
		beendeReste,
		/** Die Einheiten, die die Oberfläche zeigt: laufende und unterbrochene; fertige nur bis zum nächsten Aufräumen. */
		liste: async () => (await alle()).filter((s) => s.status !== 'verworfen'),
		stand: (id: string) => verlange(id),
		laeuft: () => aktiv?.stand ?? null,
		starteAufraeumen: () => {
			aufraeumTakt ??= setInterval(() => {
				raeumeAuf().catch((fehler: unknown) => console.error('Einheiten aufräumen:', fehler));
			}, 60 * 60_000);
			aufraeumTakt.unref();
		},
		/** Beim Beenden: Der Lauf endet, der Stand bleibt für „Weiterbauen“. */
		stop: () => {
			if (aufraeumTakt) {
				clearInterval(aufraeumTakt);
			}
			if (aktiv) {
				const s = aktiv.stand;
				aktiv.abbruch = true;
				aktiv.kind?.kill('SIGTERM');
				if (aktiv.takt) {
					clearInterval(aktiv.takt);
				}
				s.status = 'unvollstaendig';
				s.grund = 'Der Server wurde neu gestartet.';
				s.ende = new Date().toISOString();
				try {
					writeFileSync(path.join(dir(s.id), STAND), JSON.stringify(s));
				} catch {
					// Beim Beenden zählt nur, dass der Prozess endet.
				}
				rmSync(path.join(dir(s.id), PID), { force: true });
			}
		},
	};
};

export type Einheiten = ReturnType<typeof erstelleEinheiten>;

/** Die Routen (139). Hängt am `apiRouter`: nur mit Sitzung, nie über Teilen-Links. */
export const einheitApi = (router: RouterTyp, kontext: Kontext) => {
	const { einheiten } = kontext;
	router.get('/einheiten', async (_req, res) => {
		res.json({ einheiten: await einheiten.liste(), laeuft: einheiten.laeuft()?.id ?? null });
	});
	router.post('/einheiten', async (req, res) => {
		const b = (req.body ?? {}) as { angaben?: unknown; ordner?: unknown; auftragText?: unknown };
		res.status(201).json(
			await einheiten.starte({ angaben: b.angaben, ordner: b.ordner, auftragText: b.auftragText }),
		);
	});
	router.get('/einheiten/:id', async (req, res) => {
		res.json(await einheiten.stand(pruefeEinheitId(req.params.id)));
	});
	router.post('/einheiten/:id/abbrechen', async (req, res) => {
		res.json(await einheiten.abbrechen(pruefeEinheitId(req.params.id)));
	});
	router.post('/einheiten/:id/weiter', async (req, res) => {
		res.json(await einheiten.weiter(pruefeEinheitId(req.params.id)));
	});
	router.post('/einheiten/:id/verwerfen', async (req, res) => {
		await einheiten.verwirf(pruefeEinheitId(req.params.id));
		res.json({ ok: true });
	});
};
