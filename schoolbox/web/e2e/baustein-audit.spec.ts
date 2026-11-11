/**
 * Prüfmaschine aus Ticket 084: schleift über `KATALOG` und `ABBILDUNG_SCHEMA`, keine Liste von Hand. Je Eintrag: auf
 * leerem Blatt einfügen, gewählten Baustein und Inspektor prüfen, dann jedes Feld mit allen Werten auf dem Schnellweg
 * (Attribut setzen, neu zeichnen). Je Feldart ein Vertreter läuft den vollen Weg über die Oberfläche.
 * `W1`…`W9` wie im Ticket. Läuft nur mit `pnpm test:audit`.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Frame, Page } from '@playwright/test';
import type { AbbildungSchema, Feld, Werte } from '@schoolbox/kern/src/abbildungen';
import { abschnittVon, schemaVon, setzeAbbildung, werteVon } from '@schoolbox/kern/src/abbildungen';
import { ABSCHNITT_TITEL } from '@schoolbox/kern/src/abschnitte';
import type { KatalogEintrag } from '@schoolbox/kern/src/katalog';
import { KATALOG } from '@schoolbox/kern/src/katalog';
import type { KitFeld } from '@schoolbox/kern/src/kit-einstellungen';
import { KIT_FELDER, leseKit, setzeKit } from '@schoolbox/kern/src/kit-einstellungen';
import { zerlege } from '@schoolbox/kern/src/quelltext';

import { BEKANNT, BEKANNT_HOECHSTENS } from './baustein-audit-bekannt';
import type { Fall } from './baustein-audit-werte';
import { faelleVon } from './baustein-audit-werte';
import { aendere, oeffne, quelle } from './editorhilfe';
import { dokumentOrdner, expect, legeMappeAn, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const HIER = __dirname;
const STANDARD_ZIEL = path.join(HIER, '../../../lokal/ux-analyse/baustein-audit');
const ZIEL =
	process.env.AUDIT_BERICHT ??
	(existsSync(path.dirname(STANDARD_ZIEL)) ? STANDARD_ZIEL : path.join(HIER, '../test-results/audit-bericht'));
/** Kontaktbilder und Inspektor-Fotos brauchen viel länger als die Regeln, deshalb nur auf Wunsch. */
const BILDER = process.env.AUDIT_BILDER === '1';
const SICHTBAR = 795;
/** Ab dieser Höhe gilt ein Inspektor als zu lang: doppelte Bildschirmhöhe, wie im Ticket. */
const ZU_HOCH = 2 * 860;

interface Verstoss {
	regel: string;
	schluessel: string;
	text: string;
}

interface Ergebnis {
	id: string;
	name: string;
	bereich: string;
	pfad: string;
	seiten: number;
	hoehe: number;
	felder: number;
	raus: number;
	faelle: number;
	ohneWirkung: number;
	verstoesse: Verstoss[];
	kontakt: boolean;
	abgewiesen: string[];
	bekannt: string[];
}

// ── Im Rahmen ────────────────────────────────────────────────────────────────

interface Zeichnung {
	feld: string;
	wert: string;
	/** Abdruck im Arbeitsblatt und in der Lösung. */
	blatt: string;
	loesung: string;
	fehler: string | null;
	ausnahme: string | null;
	bild: string;
	fehlerPruefung: string[];
}

/**
 * Setzt je Fall die Attribute, zeichnet in beiden Ansichten und setzt zurück. Läuft im Rahmen; Text und Hash sind
 * bewusst schlicht, es zählt nur, ob sich das Gezeichnete ändert. Im Rahmen läuft kein Code dieses Moduls.
 */
const zeichneFaelle = async (
	rahmen: Frame,
	nr: number,
	faelle: Pick<Fall, 'aenderung' | 'feld' | 'wert' | 'werte'>[],
	inhaltFelder: string[],
	generiert: string | null,
	tag: string,
) =>
	rahmen.evaluate(
		({ faelle: alle, generiert: gen, inhaltFelder: inhalt, nr: n, tag: t }) => {
			type Z = Window & {
				zeichneAbbildungen: (e: Element) => void;
				setzeAbbildungsInhalt: (e: Element, w: string) => void;
				schoolboxAbbildungen: {
					neueZahlen: (t: string, w: unknown, s: string) => Record<string, string> | null;
				};
			};
			const f = window as unknown as Z;
			const el = document.querySelector(`[data-sb="${n}"]`) as HTMLElement & { _abbInhalt?: string };
			const body = document.body;
			const warLoesung = body.classList.contains('loesung');
			const setze = (name: string, wert: string | null) => {
				if (inhalt.includes(name)) {
					f.setzeAbbildungsInhalt(el, wert ?? '');
				} else if (wert === null) {
					el.removeAttribute(name);
				} else {
					el.setAttribute(name, wert);
				}
			};
			const abdruck = (loesung: boolean) => {
				body.classList.toggle('loesung', loesung);
				el.removeAttribute('data-fehler');
				f.zeichneAbbildungen(el);
				// Bingo, Domino und Spielplan legen Folgeseiten hinter die Seite des Elements.
				const folge = [...document.querySelectorAll(`.seite[data-erzeugt][data-sb="${n}"]`)]
					.map((s) => s.innerHTML)
					.join('|');
				// Zeichnungen zählen ihre Kennungen (Muster, Schnittpfade) je Aufruf hoch; das ist keine Wirkung.
				return `${el.innerHTML}|${el.getAttribute('style') ?? ''}|${folge}`.replace(
					/(\bid="|url\(#|href="#)[^")]*/g,
					'$1',
				);
			};
			// Die volle Prüfung wartet auf Schriften und dauert je Fall zu lang; die Fehler aus Optionen sind Überläufe.
			const fehlerVonPruefung = () => {
				body.classList.remove('loesung');
				f.zeichneAbbildungen(el);
				const seite = el.closest('.seite');
				if (!seite) {
					return [];
				}
				const stil = getComputedStyle(seite);
				const r = seite.getBoundingClientRect();
				const e = el.getBoundingClientRect();
				const unten = r.bottom - parseFloat(stil.paddingBottom) + 1;
				const rechts = r.right - parseFloat(stil.paddingRight) + 1;
				return e.bottom > unten || e.right > rechts ? ['ueberlauf'] : [];
			};
			const zeichnungen: unknown[] = [];
			for (const fall of alle) {
				const alt = Object.keys(fall.aenderung).map<[string, string | null]>((a) => [
					a,
					inhalt.includes(a) ? (el._abbInhalt ?? '') : el.getAttribute(a),
				]);
				const dazu: [string, string | null][] = [];
				let ausnahme: string | null = null;
				try {
					for (const [a, w] of Object.entries(fall.aenderung)) {
						setze(a, w);
					}
					if (gen && fall.feld !== gen && !(gen in fall.aenderung)) {
						const neu = f.schoolboxAbbildungen.neueZahlen(t, fall.werte, 'audit')?.[gen] ?? null;
						dazu.push([gen, el.getAttribute(gen)]);
						setze(gen, neu);
					}
				} catch (e) {
					ausnahme = String(e);
				}
				let blatt = '';
				let loesung = '';
				let fehler: string | null = null;
				let bild = '';
				try {
					loesung = abdruck(true);
					blatt = abdruck(false);
					fehler = el.getAttribute('data-fehler');
					bild = el.innerHTML;
				} catch (e) {
					ausnahme = String(e);
				}
				const fehlerPruefung = fehlerVonPruefung();
				zeichnungen.push({
					feld: fall.feld,
					wert: fall.wert,
					blatt,
					loesung,
					fehler,
					ausnahme,
					bild,
					fehlerPruefung,
				});
				for (const [a, w] of [...alt, ...dazu]) {
					setze(a, w);
				}
			}
			body.classList.toggle('loesung', warLoesung);
			el.removeAttribute('data-fehler');
			f.zeichneAbbildungen(el);
			return zeichnungen;
		},
		{ nr, faelle, inhaltFelder, generiert, tag },
	) as Promise<Zeichnung[]>;

const zellenVon = (rahmen: Frame, nr: number) =>
	rahmen.evaluate((n) => {
		const el = document.querySelector<Element & { _abbZellen?: Record<string, { id: string }[]> }>(
			`[data-sb="${n}"]`,
		);
		return Object.fromEntries(Object.entries(el?._abbZellen ?? {}).map(([k, v]) => [k, v.map((z) => z.id)]));
	}, nr);

// ── Inspektor ────────────────────────────────────────────────────────────────

const leseInspektor = (page: Page) =>
	page.evaluate(() => {
		const r = document.querySelector('[data-inspektor]');
		if (!r) {
			return null;
		}
		const rb = r.getBoundingClientRect();
		const raus = [...r.querySelectorAll('*')].filter((x) => {
			const q = x.getBoundingClientRect();
			return q.width > 0 && q.right > rb.right + 1;
		});
		const zeilen = [...r.querySelectorAll('section')].map((s) => ({
			titel: s.querySelector('h3')?.textContent?.trim() ?? '',
			namen: [...s.querySelectorAll('[data-feld]')].map(
				(f) => f.querySelector('label, [data-zeile] span')?.textContent?.trim() ?? '',
			),
		}));
		return {
			art: r.querySelector('[data-auswahl]')?.getAttribute('data-auswahl') ?? null,
			pfad: [...r.querySelectorAll('[data-breadcrumb] button')].map((b) => b.textContent?.trim() ?? '').join('›'),
			hoehe: r.scrollHeight,
			felder: r.querySelectorAll('input:not([type=file]), select, textarea, [role=switch]').length,
			raus: raus.length,
			rausBeispiel: raus.slice(0, 3).map((x) => `${x.tagName}:${(x.textContent ?? '').slice(0, 18)}`),
			zeilen,
		};
	});

const rahmenVon = async (page: Page): Promise<Frame> => {
	// Jede neue Quelle lädt in einem neuen Rahmen, der alte verschwindet erst danach.
	const griff = page.locator('iframe[data-editor-rahmen="sichtbar"]').first();
	await griff.waitFor({ state: 'attached', timeout: 15_000 });
	for (let i = 0; i < 100; i += 1) {
		const griffElement = await griff.elementHandle().catch(() => null);
		const rahmen = await griffElement?.contentFrame().catch(() => null);
		if (rahmen) {
			return rahmen;
		}
		await page.waitForTimeout(100);
	}
	throw new Error('Rahmen fehlt');
};

const seitenUndFehler = async (rahmen: Frame) =>
	rahmen.evaluate(async () => {
		type P = {
			pruefeBlatt?: (o: {
				warten: boolean;
			}) => Promise<{ meldungen: { stufe: string; code: string; text: string }[] }>;
		};
		const bericht = await (window as unknown as P).pruefeBlatt?.({ warten: false });
		return {
			// Mit den Folgeseiten: Genau die sprengt ein zu großer Start (Bingo mit 28 Karten).
			seiten: document.querySelectorAll('.seite').length,
			fehler: (bericht?.meldungen ?? [])
				.filter((m) => m.stufe === 'FEHLER')
				.map((m) => ({ code: m.code, text: m.text })),
		};
	});

// ── Blatt ────────────────────────────────────────────────────────────────────

const LEERE_SEITE = /<body([^>]*)>[\s\S]*<\/body>/;

const leeresBlatt = async (klasse: 2 | 4 = 2) => {
	const { dokumente, id } = await legeMappeAn('Audit', 'mathematik', klasse, [
		{ titel: 'Leeres Blatt', vorlage: 'arbeitsblatt' },
	]);
	const dok = dokumente[0] ?? '';
	const datei = path.join(dokumentOrdner(id, dok), 'material.html');
	const leer = (await readFile(datei, 'utf8')).replace(
		LEERE_SEITE,
		'<body$1>\n<section class="seite">\n</section>\n</body>',
	);
	await writeFile(datei, leer);
	return { id, dok, leer };
};

/** `-1`, solange gerade kein Rahmen fertig ist: Jede neue Fassung lädt in einem neuen. */
const kinderAufDerSeite = async (page: Page) => {
	if ((await page.locator('[data-editor-rahmen="laedt"]').count()) > 0) {
		return -1;
	}
	try {
		const rahmen = await rahmenVon(page);
		return await rahmen.evaluate(() => document.querySelector('.seite')?.children.length ?? -1);
	} catch {
		return -1;
	}
};

const aufLeeresBlatt = async (page: Page, leer: string) => {
	await expect(async () => {
		if ((await quelle(page)) !== leer) {
			// Die alte Auswahl gibt es im leeren Blatt nicht mehr.
			const weg = page.getByRole('button', { name: 'Auswahl aufheben' });
			if (await weg.isVisible()) {
				await weg.click();
			}
			await aendere(page, leer);
		}
		await expect.poll(() => kinderAufDerSeite(page), { timeout: 2000 }).toBe(0);
	}).toPass({ timeout: 15_000 });
};

const fuegeEin = async (page: Page, e: KatalogEintrag) => {
	const suche = page.getByRole('searchbox', { name: 'Baustein suchen' }).first();
	await suche.fill(e.name);
	const vorher = await quelle(page);
	await page.locator(`[data-einfuegen="${e.id}"]`).first().click();
	await expect.poll(() => quelle(page)).not.toBe(vorher);
	await expect.poll(() => kinderAufDerSeite(page)).toBeGreaterThan(0);
};

const nrDesElements = async (page: Page, tag: string) => {
	const k = zerlege(await quelle(page)).knoten.find((n) => n.tag === tag);
	return k?.nr ?? null;
};

// ── Regeln je Eintrag ────────────────────────────────────────────────────────

const bekannt = (v: Verstoss, gesehen: Set<string>) => {
	const breit = v.schluessel.split('=')[0] ?? v.schluessel;
	for (const s of [`${v.regel} ${v.schluessel}`, `${v.regel} ${breit}`]) {
		if (BEKANNT[s]) {
			gesehen.add(s);
			return true;
		}
	}
	return false;
};

/**
 * Nur auf Wunsch (`AUDIT_ABHAENGIG=1`): Für jedes Feld ohne Wirkung steht in `abhaengig/<id>.json`, unter welchem Wert
 * eines anderen Felds es doch wirkt. Das ist die Vorlage für `nurWenn`.
 */
const sucheAbhaengige = async (
	rahmen: Frame,
	e: KatalogEintrag,
	schema: AbbildungSchema,
	nr: number,
	basis: Werte,
	zellen: Record<string, string[]>,
	inhaltFelder: string[],
	verstoesse: Verstoss[],
) => {
	const felder = schema.felder;
	const stumm = [
		...new Set(
			verstoesse.filter((v) => v.regel === 'W2').map((v) => v.schluessel.split('.')[1]?.split('=')[0] ?? ''),
		),
	];
	const ergebnis: Record<string, string[]> = {};
	for (const attr of stumm) {
		const feld = felder.find((f) => f.attribut === attr);
		if (!feld) {
			continue;
		}
		const wirktUnter: string[] = [];
		for (const anderes of felder.filter((f) => f !== feld && ['auswahl', 'schalter', 'zahl'].includes(f.art))) {
			for (const kontext of faelleVon(schema, anderes, basis, zellen).faelle) {
				const proben = faelleVon(schema, feld, kontext.werte, zellen).faelle.slice(0, 4);
				const mit = proben.map((p) => ({ ...p, aenderung: diff(basis, p.werte) }));
				const stand = { aenderung: diff(basis, kontext.werte), feld: '_', wert: 'Stand', werte: kontext.werte };
				const [bezug, ...rest] = await zeichneFaelle(rahmen, nr, [stand, ...mit], inhaltFelder, null, e.id);
				if (
					!bezug?.fehler &&
					rest.some((z) => !z.fehler && (z.blatt !== bezug?.blatt || z.loesung !== bezug?.loesung))
				) {
					wirktUnter.push(`${anderes.attribut}=${kontext.wert}`);
				}
			}
		}
		ergebnis[attr] = wirktUnter;
	}
	mkdirSync(path.join(ZIEL, 'abhaengig'), { recursive: true });
	writeFileSync(path.join(ZIEL, 'abhaengig', `${e.id}.json`), JSON.stringify(ergebnis, null, 1));
};

/**
 * Hängt das Feld an einem anderen: dort einen Stand suchen, in dem es gilt. Hängt die Bedingung am Inhalt (gleiche
 * Wörter, gemischte Sprünge), bleibt nur die Probe im Ausgangsstand.
 */
const standFuer = (felder: readonly Feld[], feld: Feld, basis: Werte): Werte => {
	const kandidaten = felder.flatMap((f) =>
		f === feld || f.art !== 'auswahl' ? [] : f.optionen.map((o) => ({ ...basis, [f.attribut]: o.wert || null })),
	);
	return kandidaten.find((w) => feld.nurWenn?.(w)) ?? basis;
};

const pruefeFelder = async (
	rahmen: Frame,
	e: KatalogEintrag,
	schema: AbbildungSchema,
	nr: number,
	basis: Werte,
	verstoesse: Verstoss[],
) => {
	const inhaltFelder = schema.felder.filter((f) => f.quelle === 'inhalt').map((f) => f.attribut);
	const gen = schema.generiert ?? null;
	const zellen = await zellenVon(rahmen, nr);
	const melde = (regel: string, feld: string, wert: string | null, text: string) =>
		verstoesse.push({ regel, schluessel: `${e.id}.${feld}${wert ? `=${wert}` : ''}`, text });

	const leer = { aenderung: {}, feld: '_', wert: 'Stand', werte: basis };
	const [anfang, nochmal] = await zeichneFaelle(rahmen, nr, [leer, leer], inhaltFelder, null, e.id);
	if (!anfang || !nochmal) {
		throw new Error('Keine Zeichnung');
	}
	if (anfang.fehler) {
		melde('W7', '_', null, `Der Starter bricht ab: ${anfang.fehler}`);
	}
	if (anfang.blatt !== nochmal.blatt) {
		melde('W2', '_', null, 'Zeichnet bei gleichen Werten verschieden (Zufall ohne seed).');
	}

	let zahl = 0;
	let ohne = 0;
	const abgewiesen: string[] = [];
	const kontakt: { feld: string; wert: string; bild: string; wirkt: boolean }[] = [];
	const felder = schema.felder;
	const pruefeErgebnisse = (feld: Feld, ergebnisse: Zeichnung[], bezug: Zeichnung | undefined) => {
		const einerReicht = feld.art === 'text' || feld.art === 'zahlen';
		const wirktEiner = ergebnisse.some((z) => z.blatt !== bezug?.blatt || z.loesung !== bezug?.loesung);
		for (const z of ergebnisse) {
			zahl += 1;
			const wirkt = z.blatt !== bezug?.blatt || z.loesung !== bezug?.loesung;
			if (kontakt.length < 72) {
				kontakt.push({ feld: feld.name, wert: z.wert, bild: z.bild, wirkt });
			}
			if (z.ausnahme) {
				melde('W7', feld.attribut, z.wert, z.ausnahme);
			} else if (z.fehler) {
				// Eine verständliche Meldung auf eine Kombination ist kein Zeichenfehler: Das Feld zeigt sie und übernimmt nichts.
				abgewiesen.push(`\`${feld.attribut}=${z.wert}\`: ${z.fehler}`);
			} else if (!wirkt && !(einerReicht && wirktEiner) && feld.art !== 'mischen' && z.wert !== 'standard') {
				ohne += 1;
				melde('W2', feld.attribut, z.wert, 'Das Gezeichnete ändert sich nicht.');
			}
			const neu = z.fehlerPruefung.filter((c) => !anfang.fehlerPruefung.includes(c));
			if (neu.length > 0 && !z.fehler) {
				melde('W6', feld.attribut, z.wert, `Prüfung meldet neu: ${neu.join(', ')}`);
			}
		}
	};
	for (const feld of felder) {
		const sichtbar = !feld.nurWenn || feld.nurWenn(basis);
		// Hängt das Feld an einem anderen: dort einen Stand suchen, in dem es gilt, und zusätzlich prüfen, dass es
		// im Ausgangsstand wirklich nichts tut.
		const stand = sichtbar ? basis : standFuer(felder, feld, basis);
		const erreichbar = sichtbar || stand !== basis;
		const { faelle } = erreichbar ? faelleVon(schema, feld, stand, zellen) : { faelle: [] };
		const mitStand =
			stand === basis ? faelle : faelle.map((f) => ({ ...f, aenderung: { ...diff(basis, f.werte) } }));
		const standFall = { aenderung: diff(basis, stand), feld: '_', wert: 'Stand', werte: stand };
		const [bezug] =
			stand === basis ? [anfang] : await zeichneFaelle(rahmen, nr, [standFall], inhaltFelder, null, e.id);
		const ergebnisse = await zeichneFaelle(rahmen, nr, mitStand, inhaltFelder, gen, e.id);
		// Text und Zahlen reichen mit einem wirksamen Wert: Der andere ist oft der Standard oder wird abgewiesen.
		pruefeErgebnisse(feld, ergebnisse, bezug);
		if (!sichtbar) {
			const verborgen = faelleVon(schema, feld, basis, zellen).faelle;
			const proben = await zeichneFaelle(rahmen, nr, verborgen, inhaltFelder, null, e.id);
			for (const z of proben) {
				if (!z.fehler && (z.blatt !== anfang.blatt || z.loesung !== anfang.loesung)) {
					melde('W2', feld.attribut, z.wert, 'Ist per `nurWenn` verborgen, wirkt aber.');
				}
			}
		}
	}
	if (process.env.AUDIT_ABHAENGIG) {
		await sucheAbhaengige(rahmen, e, schema, nr, basis, zellen, inhaltFelder, verstoesse);
	}
	return { zahl, ohne, kontakt, abgewiesen };
};

const diff = (alt: Werte, neu: Werte): Werte =>
	Object.fromEntries(
		Object.keys({ ...alt, ...neu })
			.filter((a) => (alt[a] ?? null) !== (neu[a] ?? null))
			.map((a) => [a, neu[a] ?? null]),
	);

const pruefeW1 = async (page: Page, e: KatalogEintrag, nr: number, schema: AbbildungSchema, verstoesse: Verstoss[]) => {
	const q = await quelle(page);
	const z = zerlege(q);
	const knoten = z.knoten[nr];
	if (!knoten) {
		return;
	}
	const basis = werteVon(schema, knoten, z);
	for (const feld of schema.felder) {
		for (const fall of faelleVon(schema, feld, basis, {}).faelle) {
			try {
				if (setzeAbbildung(q, nr, fall.aenderung).quelle === q) {
					verstoesse.push({
						regel: 'W1',
						schluessel: `${e.id}.${feld.attribut}=${fall.wert}`,
						text: 'Die Quelle ändert sich nicht.',
					});
				}
			} catch (fehler) {
				verstoesse.push({
					regel: 'W1',
					schluessel: `${e.id}.${feld.attribut}=${fall.wert}`,
					text: String(fehler),
				});
			}
		}
	}
};

/** W9: Innerhalb eines Abschnitts kein Name doppelt, kein Feld heißt wie sein Abschnitt. */
const pruefeNamen = (e: KatalogEintrag, schema: AbbildungSchema | undefined, verstoesse: Verstoss[]) => {
	const titel = new Map<string, Set<string>>();
	for (const f of (schema?.felder ?? []).filter((x) => !x.ohneFeld)) {
		const abschnitt = ABSCHNITT_TITEL[abschnittVon(f)];
		if (!f.name.trim()) {
			verstoesse.push({ regel: 'W9', schluessel: `${e.id}.${f.attribut}`, text: 'Feld ohne Namen.' });
		}
		if (f.name === abschnitt) {
			verstoesse.push({
				regel: 'W9',
				schluessel: `${e.id}.${f.attribut}`,
				text: `Feld heißt wie sein Abschnitt „${abschnitt}“.`,
			});
		}
		const schluessel = `${abschnitt}/${f.gruppe ?? ''}`;
		const namen = titel.get(schluessel) ?? new Set<string>();
		if (namen.has(f.name)) {
			verstoesse.push({ regel: 'W9', schluessel: `${e.id}.${f.attribut}`, text: `Name „${f.name}“ doppelt.` });
		}
		namen.add(f.name);
		titel.set(schluessel, namen);
	}
};

const ist = (e: KatalogEintrag, nurLoesung: boolean) => {
	// Die Anweisung ist Teil der Aufgabe und hat keine eigene Auswahl.
	if (e.herkunft === 'paket' || e.id === 'aufgabe' || e.id === 'anweisung') {
		return /^Aufgabe/;
	}
	return nurLoesung ? /./ : null;
};

const KIT_GEPRUEFT = new Set<string>();

const kitKandidaten = (f: KitFeld): (string | number | boolean)[] => {
	if (f.typ === 'zahl') {
		return [f.min, f.max];
	}
	if (f.typ === 'wahl') {
		return f.optionen.map((o) => o.wert);
	}
	if (f.typ === 'schalter') {
		return [true, false];
	}
	return ['Ab'];
};

const pruefeKit = async (page: Page, e: KatalogEintrag, art: string, verstoesse: Verstoss[]) => {
	const felder = KIT_FELDER[art] ?? [];
	const q = await quelle(page);
	const pfadStufe = await page.locator('[data-breadcrumb]').count();
	if (felder.length === 0 || pfadStufe === 0) {
		return 0;
	}
	const nr = await page.evaluate(() =>
		Number(document.querySelector('[data-pfad-stufe]:last-of-type')?.getAttribute('data-pfad-stufe') ?? -1),
	);
	const rahmen = await rahmenVon(page);
	const auswahl = await rahmen.evaluate((a) => {
		type T = { schoolboxEditor?: { art: (el: Element) => string | null } };
		const ed = (window.parent as unknown as T).schoolboxEditor;
		const treffer = [...document.querySelectorAll('[data-sb]')].filter((el) => ed?.art(el) === a);
		return treffer.at(-1)?.getAttribute('data-sb') ?? null;
	}, art);
	const n = auswahl === null ? nr : Number(auswahl);
	const werte = leseKit(q, n, art);
	const seite = async () => {
		await expect
			.poll(async () => {
				const r = await rahmenVon(page);
				return r
					.locator('.seite')
					.count()
					.catch(() => 0);
			})
			.toBeGreaterThan(0);
		return (await rahmenVon(page)).locator('.seite').first().screenshot();
	};
	const bezug = await seite();
	let zahl = 0;
	for (const f of felder) {
		const kandidaten = kitKandidaten(f);
		for (const w of kandidaten) {
			if (w === werte[f.name]) {
				continue;
			}
			zahl += 1;
			const neu = setzeKit(q, n, art, f.name, w, { jeSeite: false });
			if (neu === q) {
				verstoesse.push({
					regel: 'W1',
					schluessel: `${e.id}.${f.name}=${String(w)}`,
					text: 'Die Quelle ändert sich nicht.',
				});
				continue;
			}
			// Kit-Bausteine haben keinen Schnellweg: Einmal je Art und Feld wirklich neu laden und das Bild vergleichen.
			const schluessel = `${art}.${f.name}`;
			if (!KIT_GEPRUEFT.has(schluessel) && f.typ !== 'text') {
				KIT_GEPRUEFT.add(schluessel);
				await aendere(page, neu);
				if ((await seite()).equals(bezug)) {
					verstoesse.push({
						regel: 'W2',
						schluessel: `${e.id}.${f.name}=${String(w)}`,
						text: 'Das Gezeichnete ändert sich nicht.',
					});
				}
				await aendere(page, q);
			}
		}
	}
	return zahl;
};

// ── Kontaktbild ──────────────────────────────────────────────────────────────

const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const schreibeKontakt = async (
	kontaktSeite: Page,
	rahmen: Frame,
	id: string,
	bilder: { feld: string; wert: string; bild: string; wirkt: boolean }[],
) => {
	const { base, klasse } = await rahmen.evaluate(() => ({
		base: document.querySelector('base')?.href ?? document.baseURI,
		klasse: document.body.className.replace(/\bloesung\b/, ''),
	}));
	const zellen = bilder
		.map(
			(b) =>
				`<div class="k${b.wirkt ? '' : ' ohne'}"><p>${escape(b.feld)}: ${escape(b.wert)}</p><div class="f"><${id}>${b.bild}</${id}></div></div>`,
		)
		.join('');
	await kontaktSeite.setContent(
		`<!doctype html><html><head><base href="${base}"><link rel="stylesheet" href="blatt.css"><style>
		@media screen{body{background:#fff!important;padding:8px!important;display:grid!important;grid-template-columns:repeat(4,1fr);gap:6px}}
		.k{border:1px solid #bbb;padding:4px;overflow:hidden;max-height:300px}.k.ohne{border:3px solid #d00}
		.k p{font:11px sans-serif;margin:0 0 4px;color:#333}.f{zoom:.6}
		</style></head><body class="${klasse}">${zellen}</body></html>`,
		{ waitUntil: 'load' },
	);
	await kontaktSeite.screenshot({ path: path.join(ZIEL, 'optionen', `${id}.png`), fullPage: true });
};

const fotoInspektor = async (page: Page, id: string, hoehe: number) => {
	const anders = hoehe + 80 > SICHTBAR;
	if (anders) {
		await page.setViewportSize({ width: 1512, height: Math.min(hoehe + 200, 4600) });
	}
	await page.locator('[data-inspektor]').screenshot({ path: path.join(ZIEL, 'inspektor', `${id}.png`) });
	if (anders) {
		await page.setViewportSize({ width: 1512, height: 860 });
	}
};

// ── Bericht ──────────────────────────────────────────────────────────────────

const rohDatei = (bereich: string) => path.join(ZIEL, 'roh', `${bereich.replace(/\W+/g, '-')}.json`);

const schreibeBericht = () => {
	const roh = readdirSync(path.join(ZIEL, 'roh')).filter((d) => d.endsWith('.json'));
	const alle = roh.flatMap((d) => JSON.parse(readFileSync(path.join(ZIEL, 'roh', d), 'utf8')) as Ergebnis[]);
	const zeilen = [
		'# Prüfmaschine 084: Bericht',
		'',
		`Stand: ${new Date().toISOString().slice(0, 16)}. Einträge: ${alle.length}. Inspektor sichtbar: ${SICHTBAR} px.`,
		'',
		'| Bereich | id | Gewählt | Seiten | Höhe | Felder | Rechts | Fälle | ohne Wirkung | Verstöße |',
		'|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
		...alle.map(
			(e) =>
				`| ${e.bereich} | \`${e.id}\` | ${e.pfad.split('›').at(-1) ?? ''} | ${e.seiten} | ${e.hoehe} | ${e.felder} | ${e.raus || ''} | ${e.faelle} | ${e.ohneWirkung || ''} | ${e.verstoesse.length || ''} |`,
		),
		'',
		'## Verstöße',
		'',
		...alle.flatMap((e) =>
			e.verstoesse.map((v) => `- ${v.regel} \`${v.schluessel}\`: ${v.text.replace(/\n/g, ' ').slice(0, 160)}`),
		),
		'',
		'## Abgewiesen mit Meldung',
		'',
		'Kein Verstoß: Die Oberfläche zeigt die Meldung und übernimmt den Wert nicht. Trotzdem lesen, denn hier stolpert man.',
		'',
		...alle.flatMap((e) => (e.abgewiesen ?? []).map((a) => `- \`${e.id}\` ${a.replace(/\n/g, ' ').slice(0, 160)}`)),
		'',
	];
	writeFileSync(path.join(ZIEL, 'bericht.md'), zeilen.join('\n'));
};

// ── Tests ────────────────────────────────────────────────────────────────────

type Kasten = ReturnType<Page['locator']>;
const eingabeWert = (k: Kasten) => k.locator('input, textarea').first().inputValue();
/** Je Feldart ein Vertreter über die echte Oberfläche; der Schnellweg deckt alle Werte ab, nicht aber W3 bis W5. */
const VOLLER_WEG: Record<
	string,
	{ tu: (k: Kasten) => Promise<void>; lese: (k: Kasten) => Promise<string>; fokus: boolean }
> = {
	auswahl: {
		tu: async (k) => {
			const s = k.locator('select').first();
			const werte = await s.locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
			const jetzt = await s.inputValue();
			await s.focus();
			await s.selectOption(werte.find((w) => w !== jetzt) ?? jetzt);
		},
		lese: (k) => k.locator('select').first().inputValue(),
		fokus: true,
	},
	schalter: {
		tu: (k) => k.locator('input[type=checkbox], [role=switch]').first().click({ force: true }),
		lese: async (k) => String(await k.locator('input[type=checkbox], [role=switch]').first().isChecked()),
		fokus: false,
	},
	zahl: {
		tu: async (k) => {
			await k.locator('input').first().focus();
			await k.locator('input').first().press('ArrowUp');
			await k.locator('button:not([disabled])').last().click();
		},
		lese: eingabeWert,
		fokus: false,
	},
	text: {
		tu: async (k) => {
			const e = k.locator('input, textarea').first();
			await e.fill(`${await e.inputValue()}x`);
		},
		lese: eingabeWert,
		fokus: true,
	},
	zahlen: {
		tu: async (k) => {
			const e = k.locator('input').first();
			await e.fill(`${await e.inputValue()} 1`);
		},
		lese: eingabeWert,
		fokus: true,
	},
	liste: {
		// Der Griff tauscht per Pfeiltaste; eine neue, leere Zeile wäre noch ungültig und bliebe Entwurf.
		tu: async (k) => {
			await k.locator('[data-zeile-griff="0"]').focus();
			await k.page().keyboard.press('ArrowDown');
		},
		lese: (k) => k.locator('[data-zeile="0"] input').first().inputValue(),
		fokus: true,
	},
	mehrfach: {
		tu: (k) => k.locator('input[type=checkbox], [role=switch]').first().click({ force: true }),
		lese: async (k) => String(await k.locator('input[type=checkbox], [role=switch]').first().isChecked()),
		fokus: false,
	},
	raster: {
		tu: (k) => k.locator('[data-zelle], [data-raster] button').first().click(),
		lese: async (k) => (await k.locator('[data-zelle], [data-raster] button').first().getAttribute('class')) ?? '',
		fokus: false,
	},
	muster: {
		tu: async (k) => {
			await k.locator('button[aria-pressed="false"]').first().click();
		},
		lese: async (k) => (await k.locator('button[aria-pressed="true"]').first().getAttribute('data-muster')) ?? '',
		fokus: false,
	},
};

type Inspektor = Awaited<ReturnType<typeof leseInspektor>>;

/** G1: Der Baustein selbst ist gewählt, bei Aufgabenpaketen die Aufgabe. */
const stimmtAuswahl = (e: KatalogEintrag, schema: AbbildungSchema | undefined, nurLoesung: boolean, pfad: string) => {
	const soll = ist(e, nurLoesung);
	const letzte = pfad.split('›').at(-1) ?? '';
	if (soll) {
		return soll.test(letzte);
	}
	return schema ? letzte === schema.name : !/^Aufgabe \d/.test(letzte);
};

/** G1, G4, W8, G3: Was gleich nach dem Einfügen gilt. */
const pruefeEinfuegen = (
	e: KatalogEintrag,
	schema: AbbildungSchema | undefined,
	nurLoesung: boolean,
	pfad: string,
	stand: Awaited<ReturnType<typeof seitenUndFehler>>,
	inspektor: Inspektor,
	verstoesse: Verstoss[],
) => {
	if (!stimmtAuswahl(e, schema, nurLoesung, pfad)) {
		verstoesse.push({
			regel: 'G1',
			schluessel: e.id,
			text: `Nach dem Einfügen gewählt: ${pfad || '(nichts)'}`,
		});
	}
	if (stand.seiten > 1 || stand.fehler.length > 0) {
		verstoesse.push({
			regel: 'G4',
			schluessel: e.id,
			text: `Leeres Blatt: ${stand.seiten} Seiten, ${stand.fehler.map((f) => f.text).join(' / ')}`,
		});
	}
	if (inspektor && inspektor.raus > 0) {
		verstoesse.push({
			regel: 'W8',
			schluessel: e.id,
			text: `${inspektor.raus} Elemente: ${inspektor.rausBeispiel.join(', ')}`,
		});
	}
	if (inspektor && inspektor.hoehe > ZU_HOCH) {
		verstoesse.push({ regel: 'G3', schluessel: e.id, text: `Inspektor ${inspektor.hoehe} px hoch` });
	}
};

/** Abbildungen über ihr Schema (W1, Felder), Kit-Bausteine über ihre Einstellungen. */
const pruefeInhalt = async (
	page: Page,
	rahmen: Frame,
	kontaktSeite: Page,
	e: KatalogEintrag,
	schema: AbbildungSchema | undefined,
	inspektor: Inspektor,
	verstoesse: Verstoss[],
) => {
	let abgewiesen: string[] = [];
	let faelle = 0;
	let ohneWirkung = 0;
	let kontakt = false;
	if (schema) {
		const nr = await nrDesElements(page, e.id);
		const q = zerlege(await quelle(page));
		const knoten = nr === null ? undefined : q.knoten[nr];
		if (nr !== null && knoten) {
			await pruefeW1(page, e, nr, schema, verstoesse);
			const r = await pruefeFelder(rahmen, e, schema, nr, werteVon(schema, knoten, q), verstoesse);
			faelle = r.zahl;
			ohneWirkung = r.ohne;
			abgewiesen = r.abgewiesen;
			if (BILDER && r.kontakt.length > 0) {
				await schreibeKontakt(kontaktSeite, rahmen, e.id, r.kontakt);
				kontakt = true;
			}
		}
	} else if (inspektor?.art) {
		faelle = await pruefeKit(page, e, inspektor.art, verstoesse);
	}
	return { abgewiesen, faelle, ohneWirkung, kontakt };
};

const BEREICHE = [...new Set(KATALOG.map((e) => e.kategorie))];
const FILTER = process.env.AUDIT_NUR?.split(',');

test.beforeAll(() => {
	for (const d of ['roh', 'optionen', 'inspektor']) {
		mkdirSync(path.join(ZIEL, d), { recursive: true });
	}
});

test.describe('Prüfmaschine', () => {
	for (const bereich of BEREICHE) {
		test(`Bereich ${bereich}`, async ({ page }) => {
			const fehlerImFenster: string[] = [];
			page.on('pageerror', (e) => fehlerImFenster.push(e.message));
			page.on('console', (m) => {
				if (m.type() === 'error' && !/favicon|Failed to load resource|Refused to apply style/.test(m.text())) {
					fehlerImFenster.push(m.text());
				}
			});
			const { dok, id, leer } = await leeresBlatt();
			await oeffne(page, id, dok);
			await oeffneSchublade(page, 'bausteine');
			const kontaktSeite = await page.context().newPage();
			const ergebnisse: Ergebnis[] = [];
			let blatt4: Awaited<ReturnType<typeof leeresBlatt>> | null = null;
			let auf4 = false;
			for (const e of KATALOG.filter(
				(k) => k.kategorie === bereich && !k.klasse && (!FILTER || FILTER.includes(k.id)),
			)) {
				if (auf4) {
					await oeffne(page, id, dok);
					await oeffneSchublade(page, 'bausteine');
					auf4 = false;
				}
				await aufLeeresBlatt(page, leer);
				await fuegeEin(page, e);
				await page.waitForTimeout(120);
				const verstoesse: Verstoss[] = [];
				const gesehen = new Set<string>();
				const schema = schemaVon(e.id);
				const nurLoesung = ['x-erwartungshorizont', 'notiz'].includes(e.id);
				pruefeNamen(e, schema, verstoesse);
				let rahmen = await rahmenVon(page);
				let stand = await seitenUndFehler(rahmen);
				// Manche Starter gehören in höhere Klassen (Malkreuz, schriftlich): Dort einsetzen, sonst sagt die Prüfung nichts.
				if (stand.fehler.some((f) => /Klasse|über 100|Zahlenraum/.test(f.text))) {
					await aufLeeresBlatt(page, leer);
					blatt4 ??= await leeresBlatt(4);
					await oeffne(page, blatt4.id, blatt4.dok);
					await oeffneSchublade(page, 'bausteine');
					auf4 = true;
					await aufLeeresBlatt(page, blatt4.leer);
					await fuegeEin(page, e);
					await page.waitForTimeout(120);
					rahmen = await rahmenVon(page);
					stand = await seitenUndFehler(rahmen);
				}
				await expect
					.poll(() => leseInspektor(page).then((i) => i?.pfad ?? ''), { timeout: 3000 })
					.not.toBe('')
					.catch(() => undefined);
				const inspektor = await leseInspektor(page);
				const pfad = inspektor?.pfad ?? '';
				pruefeEinfuegen(e, schema, nurLoesung, pfad, stand, inspektor, verstoesse);
				const { abgewiesen, faelle, kontakt, ohneWirkung } = await pruefeInhalt(
					page,
					rahmen,
					kontaktSeite,
					e,
					schema,
					inspektor,
					verstoesse,
				);
				if (BILDER && inspektor) {
					await fotoInspektor(page, e.id, inspektor.hoehe);
				}
				for (const f of fehlerImFenster.splice(0)) {
					verstoesse.push({ regel: 'W7', schluessel: e.id, text: `Konsole: ${f}` });
				}
				ergebnisse.push({
					id: e.id,
					name: e.name,
					bereich,
					pfad,
					seiten: stand.seiten,
					hoehe: inspektor?.hoehe ?? 0,
					felder: inspektor?.felder ?? 0,
					raus: inspektor?.raus ?? 0,
					faelle,
					ohneWirkung,
					verstoesse: verstoesse.filter((v) => !bekannt(v, gesehen)),
					kontakt,
					abgewiesen,
					bekannt: [...gesehen],
				});
			}
			await kontaktSeite.close();
			if (!FILTER) {
				writeFileSync(rohDatei(bereich), JSON.stringify(ergebnisse, null, 1));
				schreibeBericht();
			}
			const offen = ergebnisse.flatMap((e) => e.verstoesse);
			expect.soft(offen.map((v) => `${v.regel} ${v.schluessel}: ${v.text}`)).toEqual([]);
		});
	}

	test('Voller Weg je Feldart', async ({ page }) => {
		const { dok, id, leer } = await leeresBlatt();
		await oeffne(page, id, dok);
		await oeffneSchublade(page, 'bausteine');
		for (const [art, fall] of Object.entries(VOLLER_WEG)) {
			const treffer = KATALOG.flatMap((e) => {
				const schema = schemaVon(e.id);
				const feld = schema?.felder.find(
					(f) =>
						f.art === art &&
						!f.ohneFeld &&
						!f.nurWenn &&
						abschnittVon(f) !== 'weitere' &&
						// Freier Text: Ein Feld mit festem Muster würde die Probe zu Recht abweisen.
						(f.art !== 'text' || (!f.muster && e.id === 'x-unterschrift')) &&
						(f.art !== 'zahlen' || abschnittVon(f) === 'inhalt') &&
						e.id !== 'x-probe',
				);
				return schema && feld ? [{ e, feld, schema }] : [];
			}).find(({ e }) => !FILTER || FILTER.includes(e.id));
			if (!treffer) {
				continue;
			}
			const { e, feld, schema } = treffer;
			await aufLeeresBlatt(page, leer);
			await fuegeEin(page, e);
			const name = schema.name;
			const kasten = page.locator(`[data-inspektor] [data-feld="${feld.attribut}"]`);
			await kasten.first().scrollIntoViewIfNeeded();
			const vorher = await quelle(page);
			const lesen = () => fall.lese(kasten.first());
			const alt = await lesen();
			await fall.tu(kasten.first());
			await page.waitForTimeout(300);
			if (fall.fokus) {
				const imFeld = await page.evaluate(
					(a) => !!document.activeElement?.closest(`[data-feld="${a}"]`),
					feld.attribut,
				);
				expect.soft(imFeld, `W5 ${art}: Fokus bleibt im Feld`).toBe(true);
			}
			// Text landet beim Verlassen des Felds im Verlauf.
			await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
			await expect.poll(() => quelle(page), `W1 ${art}: Quelle ändert sich`).not.toBe(vorher);
			const wert = await lesen();
			expect.soft(wert, `W3 ${art}: Der Inspektor zeigt den neuen Wert`).not.toBe(alt);
			const pfad = await leseInspektor(page);
			expect.soft(pfad?.pfad.split('›').at(-1), `W5 ${art}: Baustein bleibt gewählt`).toBe(name);
			await page.getByRole('button', { name: 'Rückgängig' }).first().click();
			await expect.poll(() => quelle(page), `W4 ${art}: Rückgängig ist zeichengleich`).toBe(vorher);
			// Nach dem Schritt wählt der Editor den betroffenen Baustein; die Nummer gilt nur in dieser Fassung.
			await page.waitForTimeout(400);
		}
	});

	test('Liste BEKANNT schrumpft nur', () => {
		expect(
			Object.keys(BEKANNT).length,
			'Neue Einträge sind nicht erlaubt: beheben statt eintragen',
		).toBeLessThanOrEqual(BEKANNT_HOECHSTENS);
		for (const [schluessel, grund] of Object.entries(BEKANNT)) {
			expect(grund.length, `${schluessel} braucht eine Begründung`).toBeGreaterThan(20);
		}
		const roh = path.join(ZIEL, 'roh');
		if (FILTER || !existsSync(roh)) {
			return;
		}
		const alle = readdirSync(roh).flatMap((d) => JSON.parse(readFileSync(path.join(roh, d), 'utf8')) as Ergebnis[]);
		const benutzt = new Set(alle.flatMap((e) => e.bekannt ?? []));
		expect(
			Object.keys(BEKANNT).filter((k) => !benutzt.has(k)),
			'Verwaist: Dieser Eintrag trifft nichts mehr und muss raus',
		).toEqual([]);
	});
});
