/**
 * Der Prüfstand (239): die Prüfläufe einer Einheit gegen eine feste Kopie mit bekannten Fehlern, ohne Server. Jedes
 * Material bekommt seinen Prüflauf so, wie ihn `pruefeMaterial` in `einheit.ts` startet: dieselbe Vorlage, dieselben
 * Grenzen, Modell und Gründlichkeit aus der Einstellung, dieselbe Ansicht und derselbe Prüfordner, der Auftrag aus
 * `auftrag.txt`, die Figuren aus `plan.json` und bei mehr als 24 Seiten dieselben getrennten Läufe (`pruefTeile`, 241).
 *
 *   pnpm --filter @schoolbox/server exec tsx scripts/pruefstand.ts <prüfstand> [--nur a,b] [--teil kind,blick]
 *     [--trocken] [--ja] [--abgleich <ergebnis.json>]
 *
 * Der Ordner `<prüfstand>` hält `mappe/` (Kopie der Mappe mit `bilder.json` und den Prüfbildern unter
 * `ansicht/bilder/`), `plan.json` (wie `einheit.json`), `zuordnung.json` (Slug des Plans → Dokument der Mappe),
 * `auftrag.txt` und `fehler.json`. `--trocken` baut Ansicht, Prüfordner und Auftrag unter /tmp und startet kein Claude;
 * ohne `--ja` zeigt das Skript nur, was es starten würde, und was es ungefähr kostet.
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { EinheitPlan, Fach, PlanDokument, PruefAuftrag, PruefBefund, PruefTeil } from '@schoolbox/kern';
import {
	ART_NAME,
	baueAnsichtAus,
	befundeDerTeile,
	blickRegeln,
	EINHEIT_BILDER_SATZ,
	FACH_NAME,
	formateDesMaterials,
	klasseText,
	ladeKonfig,
	lesePlan,
	pruefTeile,
	pruefText,
	pruefWeise,
	rolleVon,
	WURZEL,
} from '@schoolbox/kern';

import type { PruefErgebnis } from '../src/ki';
import { beendeKind, KI_GRENZEN, kiPfad, legeAblageAn, pruefeLauf, richtePruefOrdnerEin } from '../src/ki';
import { kiLaufJetzt } from '../src/ki-einstellung';
import type { KatalogEintrag, MaterialErgebnis, Teil } from './pruefstand-abgleich';
import { abgleichTabelle, GEBAUTE_TEILE, gleicheAb, leseKatalog, TEILE } from './pruefstand-abgleich';

/** Gemessen in 238: ein Prüflauf 0,7 bis 1,4 USD, im Mittel 1,1. */
const KOSTEN_JE_LAUF = { min: 0.7, mittel: 1.1, max: 1.4 };
const BILD_IM_DOKUMENT = /\.\.\/\.\.\/bilder\/([a-z0-9][a-z0-9-]{0,59}\.(?:png|jpg))/g;
const NOCH_NICHT: Partial<Record<Teil, string>> = { fach: '244', plan: '247' };

class Abbruch extends Error {}

interface Optionen {
	ordner: string;
	nur: string[] | null;
	teile: Teil[];
	trocken: boolean;
	ja: boolean;
	abgleich: string | null;
}

const leseOptionen = (argv: string[]): Optionen => {
	const o: Optionen = { ordner: '', nur: null, teile: ['kind', 'blick'], trocken: false, ja: false, abgleich: null };
	const wert = (i: number, name: string) => {
		const w = argv[i + 1];
		if (!w || w.startsWith('--')) {
			throw new Abbruch(`${name} braucht einen Wert.`);
		}
		return w;
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i] ?? '';
		if (a === '--nur') {
			o.nur = wert(i, a)
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			i++;
		} else if (a === '--teil') {
			const teile = wert(i, a)
				.split(',')
				.map((s) => s.trim());
			const falsch = teile.filter((t) => !(TEILE as readonly string[]).includes(t));
			if (falsch.length || !teile.length) {
				throw new Abbruch(`Unbekannter Teil ${falsch.join(', ')}. Erlaubt: ${TEILE.join(', ')}.`);
			}
			o.teile = [...new Set(teile as Teil[])];
			i++;
		} else if (a === '--abgleich') {
			o.abgleich = wert(i, a);
			i++;
		} else if (a === '--trocken') {
			o.trocken = true;
		} else if (a === '--ja') {
			o.ja = true;
		} else if (!a.startsWith('--') && !o.ordner) {
			o.ordner = path.resolve(a);
		} else {
			throw new Abbruch(`Unbekanntes Argument: ${a}`);
		}
	}
	if (!o.ordner) {
		throw new Abbruch('Pfad zum Prüfstand fehlt.');
	}
	return o;
};

const leseJson = async (datei: string): Promise<unknown> => {
	try {
		return JSON.parse(await readFile(datei, 'utf8')) as unknown;
	} catch (fehler) {
		throw new Abbruch(`${path.basename(datei)} lässt sich nicht lesen: ${(fehler as Error).message}`);
	}
};

interface Pruefstand {
	ordner: string;
	mappe: string;
	plan: EinheitPlan;
	/** In der Reihenfolge des Baus, wie die Mappe sie übernommen hat. */
	zuordnung: [string, string][];
	auftrag: string;
	klasse: number | string | undefined;
	fach: Fach;
	katalog: KatalogEintrag[];
	bilderListe: Set<string>;
}

const ladePruefstand = async (ordner: string): Promise<Pruefstand> => {
	const mappe = path.join(ordner, 'mappe');
	const plan = lesePlan(await leseJson(path.join(ordner, 'plan.json')), KI_GRENZEN.einheit.dokumente);
	if (!plan?.dokumente.length || !plan.geschichte || !plan.stunden?.length) {
		throw new Abbruch('plan.json ergibt keinen vollständigen Plan (Dokumente, Geschichte, Stunden).');
	}
	const slugs = new Set(plan.dokumente.map((d) => d.slug));
	const roh = await leseJson(path.join(ordner, 'zuordnung.json'));
	const zuordnung = Object.entries((roh ?? {}) as Record<string, unknown>).map(([slug, dok]): [string, string] => {
		if (!slugs.has(slug) || typeof dok !== 'string' || !existsSync(path.join(mappe, 'dokumente', dok))) {
			throw new Abbruch(`zuordnung.json: ${slug} → ${String(dok)} passt nicht zu Plan und Mappe.`);
		}
		return [slug, dok];
	});
	const ohne = [...slugs].filter((s) => !zuordnung.some(([z]) => z === s));
	if (ohne.length) {
		throw new Abbruch(`zuordnung.json: ohne Dokument: ${ohne.join(', ')}`);
	}
	const meta = (await leseJson(path.join(mappe, 'mappe.json'))) as { klasse?: number | string; fach?: Fach };
	let katalog: KatalogEintrag[];
	try {
		katalog = leseKatalog(await leseJson(path.join(ordner, 'fehler.json')), slugs);
	} catch (fehler) {
		throw new Abbruch((fehler as Error).message);
	}
	const liste = await leseJson(path.join(mappe, 'bilder.json')).catch(() => []);
	return {
		ordner,
		mappe,
		plan,
		zuordnung,
		auftrag: await readFile(path.join(ordner, 'auftrag.txt'), 'utf8'),
		klasse: meta.klasse,
		fach: meta.fach ?? 'faecheruebergreifend',
		katalog,
		bilderListe: new Set(
			(Array.isArray(liste) ? (liste as { datei?: unknown }[]) : [])
				.map((b) => b.datei)
				.filter((d): d is string => typeof d === 'string'),
		),
	};
};

/** `--nur` nimmt den Slug oder einen eindeutigen Anfang davon (`kapitel-4`, `hinweise`). */
const waehleMaterialien = (p: Pruefstand, nur: string[] | null): PlanDokument[] => {
	const reihe = p.zuordnung.map(([slug]) => p.plan.dokumente.find((d) => d.slug === slug) as PlanDokument);
	if (!nur) {
		return reihe;
	}
	return nur.map((wunsch) => {
		const genau = reihe.find((d) => d.slug === wunsch);
		const passend = genau ? [genau] : reihe.filter((d) => d.slug.startsWith(wunsch));
		if (passend.length !== 1) {
			throw new Abbruch(
				`--nur ${wunsch}: ${passend.length ? 'nicht eindeutig' : 'unbekannt'}. Slugs: ${reihe.map((d) => d.slug).join(', ')}`,
			);
		}
		return passend[0] as PlanDokument;
	});
};

interface Vorhaben {
	d: PlanDokument;
	dok: string;
	quelle: string;
	html: string;
	kind: boolean;
	bilder: boolean;
	regeln: string[];
	geprueft: Teil[];
}

/**
 * Was der Lauf für ein Material prüft. `kind,blick`: genau wie der Server (`pruefWeise`, ein Lauf). `kind`: nur
 * Kinderaugen, auch für Materialien, die der Server so nicht prüft. `blick`: nur der zweite Blick mit Bildern.
 */
const vorhabenFuer = async (p: Pruefstand, d: PlanDokument, teile: Teil[]): Promise<Vorhaben | string> => {
	const dok = p.zuordnung.find(([s]) => s === d.slug)?.[1] ?? '';
	const quelle = path.join(p.mappe, 'dokumente', dok, 'material.html');
	if (!existsSync(quelle) || (await stat(quelle)).size > KI_GRENZEN.materialBytes) {
		return 'kein material.html (oder zu groß)';
	}
	const html = await readFile(quelle, 'utf8');
	const rolle = rolleVon(d);
	const mitKiBildern =
		p.auftrag.includes(EINHEIT_BILDER_SATZ.mit) &&
		[...html.matchAll(BILD_IM_DOKUMENT)].some((t) => p.bilderListe.has(t[1] ?? ''));
	const kindTeil = teile.includes('kind');
	const blickTeil = teile.includes('blick');
	let kind: boolean;
	let bilder: boolean;
	let regeln: string[];
	if (kindTeil && blickTeil) {
		const weise = pruefWeise(rolle, mitKiBildern);
		if (!weise.kind && !weise.blick) {
			return `der Server prüft „${rolle}“ nicht (--teil kind erzwingt Kinderaugen)`;
		}
		kind = weise.kind;
		bilder = weise.blick && mitKiBildern;
		regeln = blickRegeln(rolle, bilder);
	} else if (kindTeil) {
		kind = true;
		bilder = false;
		regeln = [];
	} else {
		kind = false;
		bilder = mitKiBildern;
		regeln = blickRegeln(rolle, bilder);
		if (!regeln.length) {
			return `kein zweiter Blick für „${rolle}“ ohne KI-Bilder`;
		}
	}
	const geprueft: Teil[] = [...(kind ? ['kind' as const] : []), ...(regeln.length ? ['blick' as const] : [])];
	return { d, dok, quelle, html, kind, bilder, regeln, geprueft };
};

/** Wie `formateDerReihe` im Server: die Formate der Materialien, die vor diesem gebaut wurden. */
const formateDavor = (p: Pruefstand, slug: string) => {
	const davor = p.zuordnung.slice(
		0,
		p.zuordnung.findIndex(([s]) => s === slug),
	);
	return davor
		.map(([s]) => p.plan.dokumente.find((d) => d.slug === s) as PlanDokument)
		.filter((d) => formateDesMaterials(p.plan, d.slug).length)
		.map((d) => `„${d.titel}“: ${formateDesMaterials(p.plan, d.slug).join('; ')}`);
};

const zeitstempel = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

const zahlAus = (wert: unknown) => (typeof wert === 'number' && Number.isFinite(wert) ? wert : 0);

const usd = (n: number) => `${n.toFixed(2).replace('.', ',')} USD`;

const pruefeGebaut = (teile: Teil[]) => {
	const fehlt = teile.filter((t) => !GEBAUTE_TEILE.includes(t));
	if (fehlt.length) {
		throw new Abbruch(
			`${fehlt.map((t) => `Teil ${t}: noch nicht gebaut (${NOCH_NICHT[t] ?? '?'}).`).join(' ')} Abbruch, nichts gestartet.`,
		);
	}
};

const planeVorhaben = async (p: Pruefstand, o: Optionen) => {
	const vorhaben: Vorhaben[] = [];
	for (const d of waehleMaterialien(p, o.nur)) {
		const v = await vorhabenFuer(p, d, o.teile);
		if (typeof v === 'string') {
			console.log(`- ${d.slug}: kein Prüflauf, ${v}`);
		} else {
			vorhaben.push(v);
			console.log(
				`- ${d.slug}: ${v.kind ? 'Kinderaugen' : ''}${v.kind && v.regeln.length ? ' + ' : ''}${v.regeln.length ? `zweiter Blick (${v.regeln.length} Regeln${v.bilder ? ', mit KI-Bildern' : ''})` : ''}`,
			);
		}
	}
	return vorhaben;
};

type KiLauf = Awaited<ReturnType<typeof kiLaufJetzt>>;
type Ergebnis = MaterialErgebnis & Record<string, unknown>;
type Lauf = PruefErgebnis & { teil: PruefTeil | null; gelesen: string[] };

/** Was alle Materialien eines Aufrufs teilen; `abgebrochen` und `laufend` setzt auch Strg+C. */
interface Kontext {
	p: Pruefstand;
	konfig: ReturnType<typeof ladeKonfig>;
	ki: KiLauf;
	ablage: string;
	ausgabe: string | null;
	teilName: string;
	zustand: { abgebrochen: boolean; laufend: ChildProcessWithoutNullStreams | null };
}

const teileFuer = async (k: Kontext, v: Vorhaben, ordner: string) => {
	const ansicht = await baueAnsichtAus(k.konfig, v.quelle, ordner, { sw: false });
	const ein = await richtePruefOrdnerEin(ordner, ansicht.bilder, v.html, k.p.mappe, v.kind);
	return pruefTeile({
		titel: v.d.titel,
		artName: ART_NAME[v.d.art],
		klasse: klasseText(k.p.klasse),
		fach: FACH_NAME[k.p.fach],
		...ein,
		...(v.bilder ? {} : { bilder: [] }),
		formate: formateDavor(k.p, v.d.slug),
		kind: v.kind,
		regeln: v.regeln.map((r) => path.join(k.ablage, '.claude', 'skills', r)),
		auftrag: k.p.auftrag,
		figuren: k.p.plan.figuren ?? [],
	});
};

const schreibeTrocken = async (ausgabe: string, k: Kontext, v: Vorhaben, teile: PruefAuftrag[]) => {
	for (const t of teile) {
		const datei = path.join(ausgabe, `${v.d.slug}-${k.teilName}${t.teil ? `-lauf-${t.teil.nr}` : ''}.txt`);
		await writeFile(datei, `${pruefText(t)}\n`);
		console.log(
			`${v.d.slug}${t.teil ? ` (Prüflauf ${t.teil.nr} von ${t.teil.von})` : ''}: ${t.seiten.length} Seiten, ${t.loesungen.length} Lösungsseiten, ${t.ausschnitte.length} Ausschnitte, ${t.bilder.length} KI-Bilder → ${datei}`,
		);
	}
};

const laufeTeile = async (k: Kontext, v: Vorhaben, ordner: string, teile: PruefAuftrag[]) => {
	const laeufe: Lauf[] = [];
	for (const t of teile) {
		if (k.zustand.abgebrochen) {
			break;
		}
		console.log(`${v.d.slug}: ${t.teil ? `Prüflauf ${t.teil.nr} von ${t.teil.von}` : 'Prüflauf'} läuft …`);
		const gelesen: string[] = [];
		const e = await pruefeLauf({
			bin: kiPfad(k.konfig),
			...k.ki,
			ordner,
			ablage: k.ablage,
			text: pruefText(t),
			grenzen: KI_GRENZEN.einheit.pruefung,
			gestartet: (kind) => {
				k.zustand.laufend = kind;
			},
			werkzeug: (werkzeug, eingabe) => {
				if (werkzeug === 'Read' && typeof eingabe.file_path === 'string') {
					gelesen.push(
						path.relative(eingabe.file_path.startsWith(k.ablage) ? k.ablage : ordner, eingabe.file_path),
					);
				}
			},
			mitschrift: {
				materialDir: k.p.ordner,
				mappe: 'pruefstand',
				dok: v.d.slug,
				art: `pruefstand-${k.teilName}`,
			},
		});
		k.zustand.laufend = null;
		laeufe.push({ ...e, teil: t.teil ?? null, gelesen });
		if (e.fehler) {
			break;
		}
	}
	return laeufe;
};

const ergebnisAus = (v: Vorhaben, laeufe: Lauf[], teile: number, beginn: number): Ergebnis => {
	const kosten = laeufe.reduce((summe, e) => summe + zahlAus(e.verbrauch.kostenUsd), 0);
	const fehler = laeufe.find((e) => e.fehler)?.fehler ?? (laeufe.length < teile ? 'Abgebrochen.' : null);
	const befunde = befundeDerTeile(laeufe.map((e) => e.befunde));
	console.log(
		`${v.d.slug}: ${fehler ? `gescheitert (${fehler})` : `${befunde.length} Befunde`}${laeufe.length > 1 ? ` aus ${laeufe.length} Prüfläufen` : ''}, ${usd(kosten)}`,
	);
	return {
		slug: v.d.slug,
		geprueft: fehler ? [] : v.geprueft,
		befunde,
		fehler,
		lesbar: laeufe.every((e) => e.lesbar),
		kostenUsd: kosten,
		runden: laeufe.reduce((summe, e) => summe + zahlAus(e.verbrauch.runden), 0),
		sekunden: Math.round((Date.now() - beginn) / 1000),
		laeufe: laeufe.map((e) => ({
			teil: e.teil,
			befunde: e.befunde.length,
			fehler: e.fehler,
			lesbar: e.lesbar,
			verbrauch: e.verbrauch,
			gelesen: e.gelesen,
		})),
	};
};

/** Ein Material: im Trockenlauf nur die Aufträge (ohne Ergebnis), sonst die Prüfläufe. */
const pruefeMaterial = async (k: Kontext, v: Vorhaben): Promise<Ergebnis | null> => {
	const ordner = k.ausgabe
		? path.join(k.ausgabe, v.d.slug)
		: await mkdtemp(path.join(tmpdir(), 'schoolbox-pruefstand-'));
	await mkdir(ordner, { recursive: true });
	const beginn = Date.now();
	try {
		const teile = await teileFuer(k, v, ordner);
		if (k.ausgabe) {
			await schreibeTrocken(k.ausgabe, k, v, teile);
			return null;
		}
		return ergebnisAus(v, await laufeTeile(k, v, ordner, teile), teile.length, beginn);
	} catch (fehler) {
		console.error(`${v.d.slug}: ${(fehler as Error).message}`);
		return {
			slug: v.d.slug,
			geprueft: [],
			befunde: [] as PruefBefund[],
			fehler: 'Die Seiten ließen sich nicht bauen.',
		};
	} finally {
		if (!k.ausgabe) {
			await rm(ordner, { recursive: true, force: true });
		}
	}
};

const schreibeErgebnis = async (p: Pruefstand, o: Optionen, ki: KiLauf, ergebnisse: Ergebnis[]) => {
	const abgleich = gleicheAb(p.katalog, ergebnisse);
	const tabelle = abgleichTabelle(p.katalog, abgleich);
	const summe = ergebnisse.reduce((s, e) => s + zahlAus(e.kostenUsd), 0);
	const name = `ergebnis-${zeitstempel()}-${o.teile.join('-')}`;
	await writeFile(
		path.join(p.ordner, `${name}.json`),
		`${JSON.stringify({ datum: new Date().toISOString(), teile: o.teile, ki, kostenUsd: summe, materialien: ergebnisse, abgleich }, null, '\t')}\n`,
	);
	await writeFile(path.join(p.ordner, `${name}.md`), `# Prüfstand ${name}\n\nKosten ${usd(summe)}.\n\n${tabelle}\n`);
	console.log(`\n${tabelle}\n\nKosten ${usd(summe)}. Geschrieben: ${name}.json und ${name}.md`);
};

const fuehreAus = async (o: Optionen) => {
	pruefeGebaut(o.teile);
	const p = await ladePruefstand(o.ordner);
	if (o.abgleich) {
		const alt = (await leseJson(path.resolve(o.abgleich))) as { materialien?: MaterialErgebnis[] };
		console.log(abgleichTabelle(p.katalog, gleicheAb(p.katalog, alt.materialien ?? [])));
		return;
	}
	const vorhaben = await planeVorhaben(p, o);
	const ki = await kiLaufJetzt(ladeKonfig(), 'gross');
	const n = vorhaben.length;
	console.log(
		`\n${n} Materialien (über 24 Seiten ein Prüflauf je 16 Seiten), Modell ${ki.modell}, Gründlichkeit ${ki.effort}. Geschätzt je Material ein Lauf, rund ${usd(n * KOSTEN_JE_LAUF.mittel)} (${usd(n * KOSTEN_JE_LAUF.min)} bis ${usd(n * KOSTEN_JE_LAUF.max)}).`,
	);
	if (!n) {
		return;
	}
	if (!o.trocken && !o.ja) {
		console.log('Nichts gestartet. Mit --ja starten, mit --trocken nur Ordner und Aufträge bauen.');
		return;
	}
	const k: Kontext = {
		p,
		konfig: ladeKonfig(),
		ki,
		ablage: await mkdtemp(path.join(tmpdir(), 'schoolbox-pruefstand-ablage-')),
		ausgabe: o.trocken ? path.join(tmpdir(), `pruefstand-trocken-${zeitstempel()}`) : null,
		teilName: o.teile.join('-'),
		zustand: { abgebrochen: false, laufend: null },
	};
	process.on('SIGINT', () => {
		k.zustand.abgebrochen = true;
		if (k.zustand.laufend) {
			beendeKind(k.zustand.laufend);
		}
	});
	const ergebnisse: Ergebnis[] = [];
	try {
		await legeAblageAn(k.ablage, path.join(WURZEL, 'skills'));
		for (const v of vorhaben) {
			if (k.zustand.abgebrochen) {
				break;
			}
			const e = await pruefeMaterial(k, v);
			if (e) {
				ergebnisse.push(e);
			}
		}
	} finally {
		await rm(k.ablage, { recursive: true, force: true });
	}
	if (k.ausgabe) {
		console.log(`\nTrockenlauf: Ordner und Aufträge unter ${k.ausgabe}. Kein Claude gestartet.`);
		return;
	}
	await schreibeErgebnis(p, o, ki, ergebnisse);
};

Promise.resolve()
	.then(() => fuehreAus(leseOptionen(process.argv.slice(2))))
	.catch((fehler: unknown) => {
		console.error(fehler instanceof Abbruch ? fehler.message : fehler);
		process.exit(fehler instanceof Abbruch ? 2 : 1);
	});
