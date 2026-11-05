import type { AbschnittName } from './abschnitte';
/**
 * Einstellungen der Kit-Bausteine und des ganzen Blatts (046), als Daten: Das Panel zeichnet die Felder, hier stehen die
 * Grenzen und die Wirkung auf die Quelle. Jede Änderung ist ein Text-Patch, also ein Schritt im Verlauf.
 */
import { formatAusHtml, setzeTitel, titelAusHtml } from './html';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	entferne,
	fuegeEin,
	fuegeInnenEin,
	innenVon,
	klassenVon,
	quelleVon,
	setzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';
import type { Nummerierung } from './struktur';
import { nummeriere } from './struktur';
import type { Format, Klasse } from './werte';
import { FORMATE, STANDARD_FORMAT } from './werte';

interface FeldBasis {
	name: string;
	titel: string;
	/** Steht auch in der Leiste am Baustein: was man beim Durchgehen eines Blatts am häufigsten ändert (071). */
	leiste?: boolean;
	/** Kürzerer Name für die Leiste; im Inspektor bleibt `titel`. */
	leisteName?: string;
	/** Wo das Feld im Inspektor steht; ohne Angabe unter „Darstellung“. */
	abschnitt?: AbschnittName;
	/** Erklärt das Feld hinter dem ⓘ. */
	hilfe?: string;
}
type ZahlFeld = FeldBasis & {
	typ: 'zahl';
	min: number;
	max: number;
	schritt: number;
	einheit: string;
	standard: number;
};
type WahlFeld = FeldBasis & { typ: 'wahl'; optionen: readonly { wert: string; titel: string }[] };
type SchalterFeld = FeldBasis & { typ: 'schalter' };
type TextFeld = FeldBasis & { typ: 'text' };
export type KitFeld = ZahlFeld | WahlFeld | SchalterFeld | TextFeld;

type Wert = string | number | boolean;

const HOEHE = { typ: 'zahl', name: 'hoehe', titel: 'Höhe', min: 40, max: 600, schritt: 10, einheit: 'px' } as const;
const BREITE = {
	typ: 'zahl',
	name: 'breite',
	titel: 'Breite',
	min: 20,
	max: 100,
	schritt: 5,
	einheit: '%',
	standard: 100,
} as const;

export const KIT_FELDER: Readonly<Record<string, readonly KitFeld[]>> = {
	schreiblinie: [
		{
			typ: 'zahl',
			name: 'anzahl',
			titel: 'Anzahl',
			min: 1,
			max: 12,
			schritt: 1,
			einheit: '',
			standard: 1,
			leiste: true,
		},
		{ typ: 'zahl', name: 'abstand', titel: 'Abstand', min: 20, max: 60, schritt: 2, einheit: 'px', standard: 34 },
	],
	antwort: [
		{
			typ: 'wahl',
			name: 'breite',
			titel: 'Breite',
			leiste: true,
			optionen: [
				{ wert: 'kurz', titel: 'Kurz' },
				{ wert: '', titel: 'Normal' },
				{ wert: 'breit', titel: 'Breit' },
				{ wert: 'lang', titel: 'Ganze Zeile' },
			],
		},
		{ typ: 'text', name: 'loesung', titel: 'Lösung', abschnitt: 'loesung' },
	],
	malfeld: [{ ...HOEHE, standard: 160, leiste: true }, BREITE],
	leerstelle: [{ ...HOEHE, standard: 80 }, BREITE],
	box: [{ typ: 'zahl', name: 'groesse', titel: 'Größe', min: 12, max: 60, schritt: 2, einheit: 'px', standard: 20 }],
	aufgabe: [
		{
			typ: 'schalter',
			name: 'stern',
			titel: 'Sternchenaufgabe',
			leiste: true,
			leisteName: 'Sternchen',
			abschnitt: 'inhalt',
		},
		{
			typ: 'zahl',
			name: 'niveau',
			titel: 'Schwierigkeit',
			min: 0,
			max: 3,
			schritt: 1,
			einheit: '',
			standard: 0,
			abschnitt: 'inhalt',
			hilfe: 'Ein bis drei Kreise oben rechts an der Aufgabe.',
		},
		{
			typ: 'zahl',
			name: 'punkte',
			titel: 'Punkte',
			min: 0,
			max: 50,
			schritt: 0.5,
			einheit: '',
			standard: 0,
			leiste: true,
			abschnitt: 'bewertung',
		},
		{
			typ: 'wahl',
			name: 'afb',
			titel: 'Anforderung',
			abschnitt: 'bewertung',
			hilfe: 'Anforderungsbereich I bis III aus dem Bildungsplan',
			optionen: [
				{ wert: '', titel: 'Keiner' },
				{ wert: 'I', titel: 'I' },
				{ wert: 'II', titel: 'II' },
				{ wert: 'III', titel: 'III' },
			],
		},
	],
	kopf: [
		{ typ: 'schalter', name: 'ziel', titel: 'Lernziel zeigen' },
		{ typ: 'schalter', name: 'wahlhilfe', titel: 'Wahlhilfe zeigen' },
		{ typ: 'schalter', name: 'namenszeile', titel: 'Namenszeile zeigen' },
	],
	absatz: [{ typ: 'schalter', name: 'liste', titel: 'Als Liste' }],
	tabelle: [
		{ typ: 'schalter', name: 'kopfspalte', titel: 'Kopfspalte' },
		{
			typ: 'wahl',
			name: 'spaltenbreite',
			titel: 'Spaltenbreite',
			optionen: [
				{ wert: '', titel: 'Gleich' },
				{ wert: 'nach-inhalt', titel: 'Nach Inhalt' },
				{ wert: 'erste-schmal', titel: 'Erste schmal' },
			],
		},
		{
			typ: 'wahl',
			name: 'zeilenhoehe',
			titel: 'Zeilenhöhe',
			optionen: [
				{ wert: '', titel: 'Normal' },
				{ wert: 'kompakt', titel: 'Kompakt' },
				{ wert: 'schreibzeilen', titel: 'Schreibzeile' },
			],
		},
		{ typ: 'schalter', name: 'ohne-linien-innen', titel: 'Ohne Linien innen' },
	],
	tabellenzeile: [{ typ: 'schalter', name: 'beispiel', titel: 'Als Beispiel zeigen' }],
	tabellenzelle: [{ typ: 'text', name: 'loesung', titel: 'Lösung' }],
};

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));
const stilVon = (k: Knoten) => attribut(k, 'style')?.wert ?? '';
const stilWert = (k: Knoten, name: string) =>
	new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(stilVon(k))?.[1]?.trim() ?? null;
const setzeStil = (z: Zerlegung, k: Knoten, name: string, wert: string | null) => {
	const rest = stilVon(k)
		.split(';')
		.map((t) => t.trim())
		.filter((t) => t && !t.startsWith(`${name}:`));
	const neu = [...rest, ...(wert === null ? [] : [`${name}:${wert}`])].join(';');
	return setzeAttribut(z, k, 'style', neu || null);
};
const pxVon = (k: Knoten, name: string) => {
	const n = parseFloat(stilWert(k, name) ?? '');
	return Number.isFinite(n) ? n : null;
};

const kindMit = (k: Knoten, klasse: string) => k.kinder.find((c) => hat(c, klasse));
const nachfahre = (k: Knoten, klasse: string): Knoten | undefined => {
	for (const c of k.kinder) {
		const t = hat(c, klasse) ? c : nachfahre(c, klasse);
		if (t) {
			return t;
		}
	}
	return undefined;
};
const seiteVon = (k: Knoten) => {
	let e = k.eltern;
	while (e && !hat(e, 'seite')) {
		e = e.eltern;
	}
	return e;
};
const gleicheFolge = (k: Knoten) => {
	const geschwister = k.eltern?.kinder ?? [k];
	const i = geschwister.indexOf(k);
	let ende = i;
	while (hat(geschwister[ende + 1], 'schreiblinie')) {
		ende += 1;
	}
	return geschwister.slice(i, ende + 1);
};
const klassenOhne = (k: Knoten, weg: readonly string[], dazu: string) =>
	[...klassenVon(k).filter((c) => !weg.includes(c)), ...(dazu ? [dazu] : [])].join(' ');

const BREITEN = ['kurz', 'breit', 'lang'];

interface Regel {
	lies: (k: Knoten, z: Zerlegung) => Wert;
	setze: (z: Zerlegung, k: Knoten, wert: Wert) => Aenderung[];
}

const kindAnAus = (klasse: string, html: string): Regel => ({
	lies: (k) => Boolean(nachfahre(k, klasse)),
	setze: (z, k, an) => {
		const da = nachfahre(k, klasse);
		if (an === Boolean(da)) {
			return [];
		}
		if (da) {
			return entferne(z, da);
		}
		const titel = nachfahre(k, 'titel');
		return fuegeInnenEin(z, titel ?? k, 'ende', html);
	},
});

const klasseAnAus = (klasse: string): Regel => ({
	lies: (k) => hat(k, klasse),
	setze: (z, k, an) => setzeAttribut(z, k, 'class', klassenOhne(k, [klasse], an ? klasse : '') || null),
});
const klassenWahl = (werte: readonly string[]): Regel => ({
	lies: (k) => werte.find((w) => hat(k, w)) ?? '',
	setze: (z, k, wert) => setzeAttribut(z, k, 'class', klassenOhne(k, werte, String(wert))),
});

const REGELN: Readonly<Record<string, Regel>> = {
	'tabelle.kopfspalte': klasseAnAus('kopfspalte'),
	'tabelle.ohne-linien-innen': klasseAnAus('ohne-linien-innen'),
	'tabelle.spaltenbreite': klassenWahl(['nach-inhalt', 'erste-schmal']),
	'tabelle.zeilenhoehe': klassenWahl(['kompakt', 'schreibzeilen']),
	'tabellenzeile.beispiel': klasseAnAus('beispiel'),
	'tabellenzelle.loesung': {
		lies: (k) => attribut(k, 'data-l')?.wert ?? '',
		setze: (z, k, wert) => setzeAttribut(z, k, 'data-l', String(wert).trim() || null),
	},
	'schreiblinie.anzahl': {
		lies: (k) => gleicheFolge(k).length,
		setze: (z, k, wert) => {
			const folge = gleicheFolge(k);
			const n = Number(wert);
			if (n > folge.length) {
				return fuegeEin(z, folge.at(-1) ?? k, 'nach', quelleVon(z, k).repeat(n - folge.length));
			}
			return folge.slice(n).flatMap((e) => entferne(z, e));
		},
	},
	'schreiblinie.abstand': {
		lies: (k) => pxVon(k, 'height') ?? 34,
		setze: (z, k, wert) => gleicheFolge(k).flatMap((e) => setzeStil(z, e, 'height', `${wert}px`)),
	},
	'antwort.breite': {
		lies: (k) => BREITEN.find((b) => hat(k, b)) ?? '',
		setze: (z, k, wert) => setzeAttribut(z, k, 'class', klassenOhne(k, BREITEN, String(wert))),
	},
	'antwort.loesung': {
		lies: (k) => attribut(k, 'data-l')?.wert ?? '',
		setze: (z, k, wert) => setzeAttribut(z, k, 'data-l', String(wert).trim() || null),
	},
	'malfeld.hoehe': { lies: (k) => pxVon(k, '--h') ?? 160, setze: (z, k, w) => setzeStil(z, k, '--h', `${w}px`) },
	'malfeld.breite': {
		lies: (k) => pxVon(k, 'width') ?? 100,
		setze: (z, k, w) => setzeStil(z, k, 'width', Number(w) === 100 ? null : `${w}%`),
	},
	'leerstelle.hoehe': { lies: (k) => pxVon(k, '--h') ?? 80, setze: (z, k, w) => setzeStil(z, k, '--h', `${w}px`) },
	'leerstelle.breite': {
		lies: (k) => pxVon(k, 'width') ?? 100,
		setze: (z, k, w) => setzeStil(z, k, 'width', Number(w) === 100 ? null : `${w}%`),
	},
	'box.groesse': {
		lies: (k) => pxVon(k, 'width') ?? 20,
		setze: (z, k, w) => {
			const rest = stilVon(k)
				.split(';')
				.map((t) => t.trim())
				.filter((t) => t && !/^(width|height):/.test(t));
			return setzeAttribut(z, k, 'style', [...rest, `width:${w}px`, `height:${w}px`].join(';'));
		},
	},
	'aufgabe.niveau': {
		lies: (k) => k.kinder.flatMap((c) => (hat(c, 'anw') ? (kindMit(c, 'niveau')?.kinder ?? []) : [])).length,
		setze: (z, k, wert) => {
			const anw = kindMit(k, 'anw');
			if (!anw) {
				throw new Error('Diese Aufgabe hat keinen Aufgabentext.');
			}
			const da = kindMit(anw, 'niveau');
			const n = Number(wert);
			const html = n > 0 ? `<span class="niveau">${'<i></i>'.repeat(n)}</span>` : '';
			if (da) {
				return n > 0 ? [{ von: da.start, bis: da.ende, text: html }] : entferne(z, da);
			}
			return n > 0 ? fuegeInnenEin(z, anw, 'anfang', html) : [];
		},
	},
	'aufgabe.stern': {
		lies: (k) => hat(kindMit(k, 'nr'), 'stern'),
		setze: (z, k, an) => {
			const nr = kindMit(k, 'nr');
			if (!nr) {
				throw new Error('Diese Aufgabe hat keine Nummer.');
			}
			return [
				{
					von: nr.start,
					bis: nr.ende,
					text: an ? '<span class="nr stern">★</span>' : '<span class="nr">0</span>',
				},
			];
		},
	},
	'aufgabe.punkte': {
		lies: (k, z) => {
			const p = nachfahre(k, 'punkte');
			const t = p ? innenVon(z, p) : '';
			const m = /(\d+(?:[.,]\d+)?)\s*P/.exec(t) ?? /(\d+(?:[.,]\d+)?)/.exec(t);
			return m?.[1] ? Number(m[1].replace(',', '.')) : 0;
		},
		setze: (z, k, wert) => {
			const anw = kindMit(k, 'anw');
			if (!anw) {
				throw new Error('Diese Aufgabe hat keinen Aufgabentext.');
			}
			const da = kindMit(anw, 'punkte');
			const n = Number(wert);
			const html = n > 0 ? `<span class="punkte">(${String(n).replace('.', ',')} P.)</span>` : '';
			if (da) {
				return n > 0 ? [{ von: da.start, bis: da.ende, text: html }] : entferne(z, da);
			}
			return n > 0 ? fuegeInnenEin(z, anw, 'ende', html) : [];
		},
	},
	'aufgabe.afb': {
		lies: (k) => attribut(k, 'data-afb')?.wert ?? '',
		setze: (z, k, wert) => setzeAttribut(z, k, 'data-afb', String(wert) === '' ? null : String(wert)),
	},
	'kopf.ziel': kindAnAus('ziel', '<div class="ziel">Ich kann …</div>'),
	'kopf.wahlhilfe': kindAnAus('wahlhilfe', '<div class="wahlhilfe">Wähle deine Aufgaben.</div>'),
	'kopf.namenszeile': {
		lies: (k) => Boolean(seiteVon(k)?.kinder.some((c) => hat(c, 'namenszeile'))),
		setze: (z, k, an) => {
			const seite = seiteVon(k);
			const da = seite?.kinder.find((c) => hat(c, 'namenszeile'));
			if (!seite || an === Boolean(da)) {
				return [];
			}
			return da
				? entferne(z, da)
				: fuegeEin(
						z,
						k,
						'vor',
						'<div class="namenszeile"><span class="name">Name:</span><span class="datum">Datum:</span></div>',
					);
		},
	},
	'absatz.liste': {
		lies: (k) => k.tag === 'li',
		setze: (z, k, an) => {
			if (an && k.tag === 'p') {
				return [{ von: k.start, bis: k.ende, text: `<ul><li>${innenVon(z, k)}</li></ul>` }];
			}
			const liste = k.eltern;
			if (!an && k.tag === 'li' && liste) {
				const absaetze = liste.kinder.filter((c) => c.tag === 'li').map((c) => `<p>${innenVon(z, c)}</p>`);
				return [{ von: liste.start, bis: liste.ende, text: absaetze.join('') }];
			}
			return [];
		},
	},
};

const knotenVon = (z: Zerlegung, nr: number) => {
	const k = z.knoten[nr];
	if (!k) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	return k;
};

/** Was das Panel zu `art` am Element `nr` anzeigt. */
export const leseKit = (quelle: string, nr: number, art: string): Record<string, Wert> => {
	const z = zerlege(quelle);
	const k = knotenVon(z, nr);
	return Object.fromEntries(
		(KIT_FELDER[art] ?? []).flatMap((f) => {
			const regel = REGELN[`${art}.${f.name}`];
			return regel ? [[f.name, regel.lies(k, z)] as const] : [];
		}),
	);
};

/** Grenzen stehen nur in `KIT_FELDER`: Was darüber hinausgeht, wird nicht geschrieben, sondern begrenzt. */
export const setzeKit = (
	quelle: string,
	nr: number,
	art: string,
	name: string,
	wert: Wert,
	n: Nummerierung = { jeSeite: false },
) => {
	const regel = REGELN[`${art}.${name}`];
	const feld = KIT_FELDER[art]?.find((f) => f.name === name);
	if (!regel || !feld) {
		throw new Error(`Die Einstellung „${name}“ gibt es hier nicht.`);
	}
	const z = zerlege(quelle);
	const begrenzt = feld.typ === 'zahl' ? Math.min(feld.max, Math.max(feld.min, Number(wert))) : wert;
	const neu = wendeAn(quelle, regel.setze(z, knotenVon(z, nr), begrenzt));
	return name === 'stern' ? nummeriere(neu, n) : neu;
};

export const SICHTBARKEITEN = [
	{ wert: '', titel: 'Arbeitsblatt und Lösung', klasse: '' },
	{ wert: 'arbeitsblatt', titel: 'Nur Arbeitsblatt', klasse: 'nicht-loesung' },
	{ wert: 'loesung', titel: 'Nur Lösung', klasse: 'nur-loesung' },
] as const;
const SICHT_KLASSEN = ['nicht-loesung', 'nur-loesung'];

export const leseSichtbarkeit = (quelle: string, nr: number) => {
	const k = knotenVon(zerlege(quelle), nr);
	return SICHTBARKEITEN.find((s) => s.klasse && hat(k, s.klasse))?.wert ?? '';
};

/**
 * Wo `blatt.css` die Sichtbarkeit fest vorgibt, wirkt die Wahl nicht: Der Erwartungshorizont steht nur in der Lösung,
 * die Notiz nur in der Präsentation. Panel und Menü bieten sie dort nicht an, die Quelle bleibt, wie sie ist (084, E-B1).
 */
export const sichtbarkeitFest = (quelle: string, nr: number) => {
	const k = knotenVon(zerlege(quelle), nr);
	return k.tag === 'x-erwartungshorizont' || hat(k, 'notiz');
};

export const setzeSichtbarkeit = (quelle: string, nr: number, wert: string) => {
	const z = zerlege(quelle);
	const k = knotenVon(z, nr);
	const klasse = SICHTBARKEITEN.find((s) => s.wert === wert)?.klasse ?? '';
	return wendeAn(quelle, setzeAttribut(z, k, 'class', klassenOhne(k, SICHT_KLASSEN, klasse) || null));
};

export const PALETTEN = ['sonnig', 'himmel', 'wiese', 'beere'] as const;
export type Palette = (typeof PALETTEN)[number];

export const PALETTEN_FARBNAME: Record<Palette, string> = {
	sonnig: 'Orange und Türkis',
	himmel: 'Blau und Gelb',
	wiese: 'Grün und Orange',
	beere: 'Koralle und Violett',
};
export const BLATT_FORMATE: readonly Format[] = FORMATE.filter((f) => f !== 'minibuch');

export interface BlattWerte {
	titel: string;
	klasse: Klasse;
	palette: Palette | null;
	format: Format;
	/** Punkte zeigen (053, 082). */
	punkte: boolean;
	/** Der Schalter wirkt: Das Blatt hat Bewertungspunkte oder blendet sie aus. Die Kreise von `.niveau` zählen nicht. */
	hatPunkte: boolean;
}

const bodyVon = (z: Zerlegung) => {
	const body = z.knoten.find((k) => k.tag === 'body');
	if (!body) {
		throw new Error('Das Material hat kein <body>.');
	}
	return body;
};

export const leseBlatt = (quelle: string): BlattWerte => {
	const z = zerlege(quelle);
	const klassen = klassenVon(bodyVon(z));
	const kl = klassen.find((k) => /^kl[1-4]$/.test(k));
	return {
		titel: titelAusHtml(quelle) ?? '',
		klasse: kl ? (Number(kl.slice(2)) as Klasse) : 'gemischt',
		palette: (klassen.find((k) => k.startsWith('palette-'))?.slice(8) as Palette | undefined) ?? null,
		format: formatAusHtml(quelle),
		punkte: !klassen.includes('ohne-punkte'),
		hatPunkte:
			klassen.includes('ohne-punkte') ||
			z.knoten.some((k) => k.tag === 'x-gesamtpunkte' || klassenVon(k).includes('punkte')),
	};
};

/** Ändert genau das Genannte am Blatt: nur Klassen am `<body>` und, beim Titel, `<title>`. */
export const setzeBlatt = (quelle: string, neu: Partial<BlattWerte>) => {
	const z = zerlege(quelle);
	const body = bodyVon(z);
	let klassen = klassenVon(body);
	const tausche = (weg: (k: string) => boolean, dazu: string | null) => {
		const i = klassen.findIndex(weg);
		const ohne = klassen.filter((k) => !weg(k));
		if (dazu) {
			ohne.splice(i < 0 ? ohne.length : i, 0, dazu);
		}
		klassen = ohne;
	};
	if (neu.klasse !== undefined) {
		tausche((k) => /^kl[1-4]$/.test(k), neu.klasse === 'gemischt' ? null : `kl${neu.klasse}`);
	}
	if (neu.palette !== undefined) {
		tausche((k) => k.startsWith('palette-'), neu.palette ? `palette-${neu.palette}` : null);
	}
	if (neu.format !== undefined) {
		tausche((k) => (FORMATE as readonly string[]).includes(k), neu.format === STANDARD_FORMAT ? null : neu.format);
	}
	if (neu.punkte !== undefined) {
		tausche((k) => k === 'ohne-punkte', neu.punkte ? null : 'ohne-punkte');
	}
	const mitKlassen = wendeAn(quelle, setzeAttribut(z, body, 'class', klassen.join(' ')));
	return neu.titel === undefined ? mitKlassen : setzeTitel(mitKlassen, neu.titel);
};
