/**
 * Schema der Abbildungen aus `abbildungen.js` (018): welche Attribute ein `x-…`-Element hat, wie sie heißen, welche
 * Werte gelten und welche Regeln zwischen ihnen. Das Abbildungs-Panel baut daraus seine Eingaben; ein neues Element
 * braucht nur einen Eintrag hier. Rechnet nur über Text-Patches auf der Quelle, wie die anderen Editor-Befehle.
 */

import type { Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	entschluessele,
	ersetzeInnen,
	innenVon,
	schuetzeText,
	setzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';
import type { StrukturErgebnis } from './struktur';
import type { Art, Fach, Klasse } from './werte';

/** Ein zweites Attribut für denselben Wert, das `abbildungen.js` nur im Beispiel und auf dem Lösungsblatt zeichnet. */
interface Loesung {
	attribut: string;
	/** Beschriftung des Schalters, z. B. „Zeiger nur in der Lösung“. */
	name: string;
	/** Stehen beide Attribute in der Quelle, zeichnet `abbildungen.js` dieses (sonst das sichtbare). */
	vorrang?: boolean;
}

interface FeldBasis {
	attribut: string;
	name: string;
	hilfe?: string;
	loesung?: Loesung;
	/** Abschnitt im Panel; außer dem ersten bleiben Abschnitte zunächst eingeklappt. */
	gruppe?: string;
	/** Der Wert ist der Text im Element (`<x-silben>Ro|si|ne</x-silben>`), nicht ein Attribut. */
	quelle?: 'inhalt';
	/** Steht auch in der Leiste am Baustein: was man beim Durchgehen eines Blatts am häufigsten ändert (071). */
	leiste?: boolean;
}

/** Vorschlag für den Notenschlüssel in Prozent (053); dieselbe Angabe steht in `abbildungen.js`, ein Test hält beide gleich. */
export const NOTEN_VORSCHLAG = '1:95; 2:80; 3:65; 4:50; 5:25';

export interface ZahlFeld extends FeldBasis {
	art: 'zahl';
	min: number;
	max: number;
	/** Was `abbildungen.js` ohne Attribut nimmt. */
	standard: number;
	/** Hängt der Standard von anderen Feldern ab, liefert das den wirksamen Wert; `standard` gilt dann für die Grundwerte. */
	standardJe?: (w: Werte) => number;
	schritt?: number;
	einheit?: string;
}

export interface UhrzeitFeld extends FeldBasis {
	art: 'uhrzeit';
}

export interface AuswahlFeld extends FeldBasis {
	art: 'auswahl';
	/** `wert: null` entfernt das Attribut, dann gilt der Standard aus `abbildungen.js`. */
	optionen: { wert: string | null; name: string }[];
	/** Was `abbildungen.js` ohne Attribut zeichnet, wenn es dafür eine eigene Option gibt. */
	standard?: string;
	/** Zurück und Vor unter der Auswahl: Man sieht jede Option gleich im Blatt. */
	blaettern?: boolean;
	/** Weitere Optionen aus einem Feld mit `|`-Teilen, z. B. die Bausteine eines Worts. */
	optionenAus?: string;
	/** Pfad eines kleinen Bilds zur gewählten Option; `{wert}` steht für den Wert. */
	vorschau?: string;
}

export interface SchalterFeld extends FeldBasis {
	art: 'schalter';
	an: string;
	aus: string;
	standard: boolean;
}

/** Eine Liste von Zahlen, z. B. die beschrifteten Zahlen am Zahlenstrahl. */
export interface ZahlenFeld extends FeldBasis {
	art: 'zahlen';
	beispiel: string;
}

/** Eine Zahl je Stelle einer Stellentafel; die Stellen stehen im Feld `stellen`. */
export interface ZiffernFeld extends FeldBasis {
	art: 'ziffern';
	stellen: string;
}

/** Ein einzeiliges oder mehrzeiliges Textfeld. */
export interface TextFeld extends FeldBasis {
	art: 'text';
	max?: number;
	/** Regulärer Ausdruck für den ganzen Text; `musterHilfe` sagt der Lehrkraft, was erlaubt ist. */
	muster?: string;
	musterHilfe?: string;
	zeilen?: number;
	beispiel?: string;
	/** Knopf, der das Zeichen an der Cursor-Stelle einfügt, z. B. den Silbenstrich; mit `bis` umschließt er die Markierung. */
	einfuegen?: { zeichen: string; name: string; bis?: string };
}

const NUR_BUCHSTABEN = /^[A-Za-zÄÖÜäöüß]+$/;

export interface Option {
	wert: string;
	name: string;
}

export interface UnterFeld {
	name: string;
	art: 'text' | 'zahl' | 'auswahl' | 'muster' | 'schalter' | 'bild' | 'mini';
	optionen?: Option[];
	min?: number;
	max?: number;
	/** Neue Zeilen beginnen damit. */
	standard?: string;
	/** Darf leer bleiben (fällt am Zeilenende weg). */
	leer?: boolean;
	/** Nur `art: 'schalter'`: Wert, wenn der Haken gesetzt ist. */
	an?: string;
}

/** Zeilen aus Unterfeldern: `Hund: 7; Katze: 4`. Zeilen hinzufügen, löschen, verschieben. */
export interface ListeFeld extends FeldBasis {
	art: 'liste';
	unter: UnterFeld[];
	min?: number;
	max?: number;
	/** Zwischen den Zeilen; Standard `;`. */
	zeilenTrenner?: ';' | ' ' | '/';
	/** Zwischen den Unterfeldern einer Zeile; Standard `:`. */
	feldTrenner?: ':' | ': ' | '-' | ' ' | '';
}

/** Mehrere Haken aus festen Optionen; im Attribut mit Leerzeichen getrennt. */
export interface MehrfachFeld extends FeldBasis {
	art: 'mehrfach';
	optionen: Option[];
	/** Was ohne Attribut gilt. */
	standard?: string[];
	mindestens?: number;
	/** Die Optionen hängen von einem anderen Feld ab; der erste Eintrag gilt, solange es fehlt. */
	optionenJe?: { feld: string; werte: Record<string, Option[]> };
}

/** Ein Zustand einer Rasterzelle; `zeichen` steht im Panel in der Zelle. */
export interface RasterZustand {
	wert: string;
	name: string;
	zeichen?: string;
}

/** Eine Zelle in der Gestalt des Elements; das Element meldet sie beim Zeichnen (`meldeZellen`). */
export interface FormZelle {
	id: string;
	x: number;
	y: number;
	b?: number;
	h?: number;
	/** Grau in der Zelle, z. B. die berechnete Lösung. */
	text?: string;
	/** Gewählt, solange das Attribut fehlt. */
	an?: boolean;
}

/**
 * Kleines Gitter im Panel. Ohne `form`: `0 1 1 / 0 1 0` im Attribut, Antippen schaltet die Zustände durch oder nimmt mit
 * `zahlen` eine Zahl auf. Mit `form`: Felder in der Gestalt des Elements (Mauer, Haus, Tafel …), im Attribut stehen die
 * gewählten Felder als Liste.
 */
export interface RasterFeld extends FeldBasis {
	art: 'raster';
	/** Attribut mit der Spaltenzahl, feste Zahl, oder `wachsen` für Knöpfe Zeile/Spalte ±. */
	spalten?: string | number;
	zeilen?: string | number;
	zustaende?: RasterZustand[];
	zahlen?: { min: number; max: number };
	wachsen?: { spalten: number; zeilen: number };
	form?: boolean;
}

/** Auswahl mit Vorschau: im s/w-Blatt das Muster, im Farbblatt die Farbe. */
export interface MusterFeld extends FeldBasis {
	art: 'muster';
	optionen: Option[];
	standard?: string;
}

/** Knopf „Neu mischen“: setzt das Attribut neu, gleiche Inhalte in anderer Anordnung. */
export interface MischenFeld extends FeldBasis {
	art: 'mischen';
	knopf?: string;
}

type FeldAus018 = ZahlFeld | UhrzeitFeld | AuswahlFeld | SchalterFeld | ZahlenFeld | ZiffernFeld;
type FeldAus023 = TextFeld | ListeFeld | MehrfachFeld | RasterFeld | MusterFeld | MischenFeld;

/** Ein Bild aus der Sammlung oder hochgeladen (049); im Attribut steht nur der Pfad. */
export interface BildFeld extends FeldBasis {
	art: 'bild';
}

/** Punkte auf dem Bild `bild`, mit Maus oder Finger gesetzt: `x,y: Wort; …` in Prozent (049). */
export interface PunkteFeld extends FeldBasis {
	art: 'punkte';
}

/** Der Inhalt als Wort-Chips: Wort antippen, Markierung wählen; mit `gruppen` lassen sich Nachbarn verbinden. */
export interface MarkierungFeld extends FeldBasis {
	art: 'markierung';
	/** Wie die Auswahl im Panel heißt, z. B. „Wortart“. */
	markeName: string;
	optionen: Option[];
	gruppen?: boolean;
	beispiel?: string;
}

/** Ein Gitter im Panel für zwei Attribute: Kästchen antippen, Fläche (`boden`) und Symbol (`objekte`) wählen. */
export interface PlanFeld extends FeldBasis {
	art: 'plan';
	objekte: string;
	flaechen: Option[];
	/** Symbole je Wert von `art`. */
	symbole: Record<string, Option[]>;
}

/** Noten als Text; im Panel eine Leiste zum Anfügen. `tonhoehe`: `c'4`, sonst nur der Wert wie `4`. */
export interface NotenFeld extends FeldBasis {
	art: 'noten';
	tonhoehe: boolean;
}

export type Feld = BildFeld | PunkteFeld | FeldAus018 | FeldAus023 | MarkierungFeld | PlanFeld | NotenFeld;

/** Attributname → Wert in der Quelle, `null` = fehlt. Enthält auch die Lösungs-Attribute. */
export type Werte = Record<string, string | null>;

/** Feld (`attribut`) → Meldung für die Lehrkraft. */
export type Fehler = Record<string, string>;

export const KATALOG_KATEGORIEN = [
	'Kopf und Rahmen',
	'Bewerten',
	'Aufgabe und Text',
	'Schreiben',
	'Bilder',
	'Zahlen',
	'Rechnen',
	'Geometrie',
	'Größen',
	'Daten und Zufall',
	'Sprache',
	'Sachunterricht',
	'Musik',
	'Spiele und Rätsel',
	'Selbstkontrolle',
	'Folien',
] as const;

/** Wo ein Baustein stehen darf: im Blatt als Ganzem, auf der Seite, in einer Aufgabe (`.koerper`) oder einer Zeile. */
export const KATALOG_ORTE = ['blatt', 'seite', 'aufgabe', 'zeile'] as const;

export interface KatalogAngaben {
	kategorie: (typeof KATALOG_KATEGORIEN)[number];
	suchbegriffe: readonly string[];
	ort: (typeof KATALOG_ORTE)[number];
	/** Nur als Filter; was wofür taugt, entscheidet der Skill. Ohne Angabe: alle. */
	faecher?: readonly Fach[];
	klassen?: readonly Klasse[];
	/** Nur bei diesen Materialarten. */
	arten?: readonly Art[];
}

export interface AbbildungSchema {
	name: string;
	/** Angaben für den Katalog (`katalog.ts`); fehlen nur bei `x-probe`, das es nur für Tests gibt. */
	katalog?: KatalogAngaben;
	felder: Feld[];
	/** Dieses Attribut erzeugt „Neue Zahlen“ aus den übrigen Feldern; ändert sich ein anderes Feld, entsteht es neu (050). */
	generiert?: string;
	/** Regeln über mehrere Felder; laufen nur, wenn jedes Feld für sich gültig ist. */
	regeln?: (w: Lesen) => Fehler;
}

/** Zugriff auf die wirksamen Werte innerhalb einer Regel. */
export interface Lesen {
	zahl: (attribut: string) => number;
	zahlen: (attribut: string) => number[];
	text: (attribut: string) => string | null;
	/** Zeilen einer `liste`, je Zeile die Unterfelder. */
	zeilen: (attribut: string) => string[][];
	/** Zellen eines `raster`. */
	raster: (attribut: string) => string[][];
	/** Gewählte Werte eines `mehrfach`-Feldes oder Einträge eines Attributs. */
	liste: (attribut: string) => string[];
}

const STELLEN_STANDARD = 'Z E';

const GROESSE = { attribut: 'groesse', name: 'Größe', einheit: 'px' } as const;

const ZEHNER_EINER = (zehner: string, einer: string): AbbildungSchema['felder'] => [
	{ art: 'zahl', attribut: 'z', name: zehner, min: 0, max: 10, standard: 0 },
	{ art: 'zahl', attribut: 'e', name: einer, min: 0, max: 20, standard: 0 },
];

const mindestensEins = (w: Lesen): Fehler =>
	w.zahl('z') + w.zahl('e') === 0 ? { e: 'Mindestens ein Zehner oder ein Einer.' } : {};

export const FARBEN: Option[] = [
	{ wert: 'rot', name: 'Rot' },
	{ wert: 'blau', name: 'Blau' },
	{ wert: 'gruen', name: 'Grün' },
	{ wert: 'gelb', name: 'Gelb' },
	{ wert: 'orange', name: 'Orange' },
	{ wert: 'lila', name: 'Lila' },
	{ wert: 'grau', name: 'Grau' },
	{ wert: 'leer', name: 'Weiß' },
];

const ZAHL = /^-?\d+([.,]\d+)?$/;
export const alsZahl = (wert: string) => (ZAHL.test(wert.trim()) ? Number(wert.trim().replace(',', '.')) : NaN);

const WUERFELBAU_TEILE = [
	{ wert: 'schraegbild', name: 'Schrägbild' },
	{ wert: 'bauplan', name: 'Bauplan' },
	{ wert: 'vorne', name: 'Ansicht von vorne' },
	{ wert: 'rechts', name: 'Ansicht von rechts' },
	{ wert: 'links', name: 'Ansicht von links' },
	{ wert: 'oben', name: 'Ansicht von oben' },
];

const FIGUR_MARKEN: Option[] = [
	{ wert: 'rechter-winkel', name: 'Rechte Winkel' },
	{ wert: 'parallel', name: 'Parallele Seiten' },
	{ wert: 'gleich-lang', name: 'Gleich lange Seiten' },
];

const STUFEN_DREI = ['unmöglich', 'möglich', 'sicher'];
const STUFEN_FUENF: Option[] = ['unmöglich', 'wenig wahrscheinlich', 'möglich', 'sehr wahrscheinlich', 'sicher'].map(
	(wert) => ({ wert, name: wert }),
);

/** Satz als Wörter mit Markierung; bei `gruppen` gehören benachbarte Wörter mit gleicher `gruppe` zu einem Satzglied. */
export interface MarkWort {
	wort: string;
	marke: string | null;
	gruppe: number;
	/** Was bis zum nächsten Wort folgt: Leerzeichen, Satzzeichen. */
	nach: string;
}

export interface MarkSatz {
	vor: string;
	woerter: MarkWort[];
}

const WORT = /[\p{L}\p{N}-]+/gu;

const woerterIn = (text: string, marke: string | null, gruppe: () => number): MarkSatz => {
	const treffer = [...text.matchAll(WORT)];
	const woerter = treffer.map((t, i): MarkWort => {
		const ende = (t.index ?? 0) + t[0].length;
		return { wort: t[0], marke, gruppe: gruppe(), nach: text.slice(ende, treffer[i + 1]?.index ?? text.length) };
	});
	return { vor: treffer.length === 0 ? text : text.slice(0, treffer[0]?.index ?? 0), woerter };
};

const lesenEinzeln = (wert: string): MarkSatz => {
	const treffer = [...wert.matchAll(/([\p{L}\p{N}-]+)(?:\/(\p{L}*))?/gu)];
	const woerter = treffer.map((t, i): MarkWort => {
		const ende = (t.index ?? 0) + t[0].length;
		return {
			wort: t[1] ?? '',
			marke: t[2] ?? null,
			gruppe: i,
			nach: wert.slice(ende, treffer[i + 1]?.index ?? wert.length),
		};
	});
	return { vor: treffer.length === 0 ? wert : wert.slice(0, treffer[0]?.index ?? 0), woerter };
};

const lesenGruppen = (wert: string): MarkSatz => {
	let nr = 0;
	const neueGruppe = () => nr++;
	const satz: MarkSatz = { vor: '', woerter: [] };
	const anhaengen = (teil: MarkSatz) => {
		const letztes = satz.woerter.at(-1);
		if (letztes) {
			letztes.nach += teil.vor;
		} else {
			satz.vor += teil.vor;
		}
		satz.woerter.push(...teil.woerter);
	};
	for (const t of wert.matchAll(/\[([^[\]]*)\](\p{L}*)|[^[\]]+|[[\]]/gu)) {
		if (t[1] === undefined) {
			anhaengen(woerterIn(t[0], null, neueGruppe));
		} else {
			const gruppe = neueGruppe();
			anhaengen(woerterIn(t[1], t[2] || null, () => gruppe));
		}
	}
	return satz;
};

export const markierungLesen = (wert: string, gruppen = false) => (gruppen ? lesenGruppen(wert) : lesenEinzeln(wert));

export const markierungKlartext = (satz: MarkSatz) => satz.vor + satz.woerter.map((w) => `${w.wort}${w.nach}`).join('');

/** Einzelne Wörter und Gruppen ohne Rolle bleiben ohne Klammer, wenn sie allein stehen. */
export const markierungText = (satz: MarkSatz, gruppen = false) => {
	if (!gruppen) {
		return satz.vor + satz.woerter.map((w) => `${w.wort}${w.marke ? `/${w.marke}` : ''}${w.nach}`).join('');
	}
	let text = satz.vor;
	satz.woerter.forEach((w, i) => {
		const vorher = satz.woerter[i - 1];
		const nachher = satz.woerter[i + 1];
		const offen = vorher?.gruppe !== w.gruppe;
		const schluss = nachher?.gruppe !== w.gruppe;
		const klammer = w.marke !== null || !offen || !schluss;
		text += `${klammer && offen ? '[' : ''}${w.wort}${klammer && schluss ? `]${w.marke ?? ''}` : ''}${w.nach}`;
	});
	return text;
};

/** Überträgt die Markierungen auf einen neuen Satz: Wörter, die gleich bleiben, behalten ihre (längste gemeinsame Folge). */
export const markierungNeuerText = (alt: MarkSatz, klartext: string): MarkSatz => {
	let nr = Math.max(-1, ...alt.woerter.map((w) => w.gruppe)) + 1;
	const neu = woerterIn(klartext, null, () => nr++);
	const a = alt.woerter;
	const b = neu.woerter;
	const laenge = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
	const feld = (i: number, j: number) => laenge[i]?.[j] ?? 0;
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			const gleich = a[i]?.wort === b[j]?.wort;
			(laenge[i] as number[])[j] = gleich ? feld(i + 1, j + 1) + 1 : Math.max(feld(i + 1, j), feld(i, j + 1));
		}
	}
	let i = 0;
	let j = 0;
	const herkunft = new Map<number, MarkWort>();
	while (i < a.length && j < b.length) {
		const quelle = a[i];
		if (quelle && quelle.wort === b[j]?.wort) {
			herkunft.set(j, quelle);
			i++;
			j++;
		} else if (feld(i + 1, j) >= feld(i, j + 1)) {
			i++;
		} else {
			j++;
		}
	}
	b.forEach((w, k) => {
		const quelle = herkunft.get(k);
		if (quelle) {
			w.marke = quelle.marke;
			w.gruppe = quelle.gruppe;
		}
	});
	// Ein neues Wort mitten in einer Gruppe gehört dazu, sonst zerfiele sie.
	b.forEach((w, k) => {
		if (herkunft.has(k)) {
			return;
		}
		const links = [...b.slice(0, k)].reverse().find((_, r) => herkunft.has(k - 1 - r));
		const rechts = b.slice(k + 1).find((_, r) => herkunft.has(k + 1 + r));
		if (links && rechts && links.gruppe === rechts.gruppe) {
			w.gruppe = links.gruppe;
			w.marke = links.marke;
		}
	});
	return neu;
};

export const markeSetzen = (satz: MarkSatz, i: number, marke: string | null): MarkSatz => {
	const gruppe = satz.woerter[i]?.gruppe;
	return { ...satz, woerter: satz.woerter.map((w) => (w.gruppe === gruppe ? { ...w, marke } : w)) };
};

/** Verbindet die Gruppe von Wort `i` mit der des nächsten Worts; die erste vorhandene Markierung gilt. */
export const markeVerbinden = (satz: MarkSatz, i: number): MarkSatz => {
	const links = satz.woerter[i];
	const rechts = satz.woerter[i + 1];
	if (!links || !rechts || links.gruppe === rechts.gruppe) {
		return satz;
	}
	const marke = links.marke ?? rechts.marke;
	return {
		...satz,
		woerter: satz.woerter.map((w) =>
			w.gruppe === links.gruppe || w.gruppe === rechts.gruppe ? { ...w, gruppe: links.gruppe, marke } : w,
		),
	};
};

/** Trennt die Gruppe zwischen Wort `i` und dem nächsten; beide Teile behalten die Markierung. */
export const markeTrennen = (satz: MarkSatz, i: number): MarkSatz => {
	const links = satz.woerter[i];
	const rechts = satz.woerter[i + 1];
	if (!links || !rechts || links.gruppe !== rechts.gruppe) {
		return satz;
	}
	const neu = Math.max(...satz.woerter.map((w) => w.gruppe)) + 1;
	return {
		...satz,
		woerter: satz.woerter.map((w, k) => (k > i && w.gruppe === links.gruppe ? { ...w, gruppe: neu } : w)),
	};
};

const namenOptionen = (namen: string[]): Option[] => namen.map((wert) => ({ wert, name: wert }));

const KREIS_OPTIONEN: Record<string, Option[]> = {
	jahr: namenOptionen([
		'Januar',
		'Februar',
		'März',
		'April',
		'Mai',
		'Juni',
		'Juli',
		'August',
		'September',
		'Oktober',
		'November',
		'Dezember',
	]),
	woche: namenOptionen(['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']),
	tag: namenOptionen(['Morgen', 'Mittag', 'Abend', 'Nacht']),
	stunden: namenOptionen(Array.from({ length: 24 }, (_, i) => String(i))),
};

const PLAN_FLAECHEN: Option[] = [
	{ wert: 'leer', name: 'Frei' },
	{ wert: 'strasse', name: 'Straße' },
	{ wert: 'wasser', name: 'Wasser' },
	{ wert: 'wald', name: 'Wald' },
	{ wert: 'wiese', name: 'Wiese' },
	{ wert: 'platz', name: 'Platz' },
];

const PLAN_SYMBOLE: Record<string, Option[]> = {
	ort: [
		{ wert: 'schule', name: 'Schule' },
		{ wert: 'kirche', name: 'Kirche' },
		{ wert: 'rathaus', name: 'Rathaus' },
		{ wert: 'bahnhof', name: 'Bahnhof' },
		{ wert: 'bushaltestelle', name: 'Bushaltestelle' },
		{ wert: 'spielplatz', name: 'Spielplatz' },
		{ wert: 'haus', name: 'Haus' },
		{ wert: 'baum', name: 'Baum' },
		{ wert: 'bruecke', name: 'Brücke' },
		{ wert: 'post', name: 'Post' },
		{ wert: 'krankenhaus', name: 'Krankenhaus' },
		{ wert: 'parkplatz', name: 'Parkplatz' },
	],
	raum: [
		{ wert: 'tisch', name: 'Tisch' },
		{ wert: 'stuhl', name: 'Stuhl' },
		{ wert: 'tafel', name: 'Tafel' },
		{ wert: 'tuer', name: 'Tür' },
		{ wert: 'fenster', name: 'Fenster' },
		{ wert: 'schrank', name: 'Schrank' },
		{ wert: 'teppich', name: 'Teppich' },
	],
};

/** `B3` als Spalte und Zeile, `null`, wenn es außerhalb liegt. */
export const planLage = (q: string, spalten: number, zeilen: number) => {
	const m = /^([A-Z])(\d+)$/.exec(q);
	if (!m) {
		return null;
	}
	const x = (m[1] ?? 'A').charCodeAt(0) - 65;
	const y = Number(m[2]) - 1;
	return x < spalten && y >= 0 && y < zeilen ? { x, y } : null;
};

/** `schule: B3; baum: A2 A3` als Planquadrat → Symbol. */
export const planObjekteVon = (wert: string | null) => {
	const orte = new Map<string, string>();
	for (const teil of (wert ?? '').split(';')) {
		const [name, quadrate] = teil.split(':');
		for (const q of (quadrate ?? '').split(/\s+/).filter(Boolean)) {
			orte.set(q, (name ?? '').trim());
		}
	}
	return orte;
};

export const planObjekteText = (orte: Map<string, string>) => {
	const je = new Map<string, string[]>();
	for (const [q, name] of orte) {
		je.set(name, [...(je.get(name) ?? []), q]);
	}
	return [...je].map(([name, quadrate]) => `${name}: ${quadrate.join(' ')}`).join('; ') || null;
};

const WORTART_OPTIONEN: Option[] = [
	{ wert: 'N', name: 'Nomen' },
	{ wert: 'Art', name: 'Artikel' },
	{ wert: 'V', name: 'Verb' },
	{ wert: 'A', name: 'Adjektiv' },
	{ wert: 'P', name: 'Pronomen' },
	{ wert: 'Pr', name: 'Präposition' },
	{ wert: 'K', name: 'Konjunktion' },
	{ wert: 'Adv', name: 'Adverb' },
];

const ROLLEN_OPTIONEN: Option[] = [
	{ wert: 'S', name: 'Subjekt' },
	{ wert: 'P', name: 'Prädikat' },
	{ wert: 'AkO', name: 'Akkusativobjekt' },
	{ wert: 'DaO', name: 'Dativobjekt' },
	{ wert: 'Ort', name: 'Ortsangabe' },
	{ wert: 'Zeit', name: 'Zeitangabe' },
];

const STROM_TEILE: Option[] = [
	{ wert: 'batterie', name: 'Batterie' },
	{ wert: 'schalter:offen', name: 'Schalter offen' },
	{ wert: 'schalter:zu', name: 'Schalter zu' },
	{ wert: 'lampe', name: 'Lampe' },
	{ wert: 'motor', name: 'Motor' },
	{ wert: 'summer', name: 'Summer' },
	{ wert: 'kabel', name: 'Kabel' },
	{ wert: 'eisen', name: 'Eisen (Leiter)' },
	{ wert: 'kupfer', name: 'Kupfer (Leiter)' },
	{ wert: 'alufolie', name: 'Alufolie (Leiter)' },
	{ wert: 'holz', name: 'Holz (Nichtleiter)' },
	{ wert: 'gummi', name: 'Gummi (Nichtleiter)' },
	{ wert: 'plastik', name: 'Plastik (Nichtleiter)' },
	{ wert: 'glas', name: 'Glas (Nichtleiter)' },
	{ wert: 'papier', name: 'Papier (Nichtleiter)' },
];

/** Auch `abbildungen.js` und `assets/bilder/verkehrszeichen/QUELLEN.md` führen diese Nummern; ein Test vergleicht sie. */
export const VERKEHRSZEICHEN: Option[] = [
	{ wert: '101', name: 'Gefahrstelle (101)' },
	{ wert: '102', name: 'Kreuzung mit Vorfahrt von rechts (102)' },
	{ wert: '136', name: 'Kinder (136)' },
	{ wert: '138', name: 'Radverkehr (138)' },
	{ wert: '205', name: 'Vorfahrt gewähren (205)' },
	{ wert: '206', name: 'Halt! Vorfahrt gewähren (206)' },
	{ wert: '220', name: 'Einbahnstraße (220)' },
	{ wert: '237', name: 'Radweg (237)' },
	{ wert: '239', name: 'Gehweg (239)' },
	{ wert: '240', name: 'Gemeinsamer Geh- und Radweg (240)' },
	{ wert: '250', name: 'Verbot für Fahrzeuge aller Art (250)' },
	{ wert: '254', name: 'Verbot für Radverkehr (254)' },
	{ wert: '267', name: 'Verbot der Einfahrt (267)' },
	{ wert: '274', name: 'Höchstgeschwindigkeit 50 (274)' },
	{ wert: '301', name: 'Vorfahrt (301)' },
	{ wert: '306', name: 'Vorfahrtstraße (306)' },
	{ wert: '350', name: 'Fußgängerüberweg (350)' },
	{ wert: '357', name: 'Sackgasse (357)' },
];

const WETTER: Option[] = [
	{ wert: 'sonne', name: 'Sonne' },
	{ wert: 'heiter', name: 'Heiter' },
	{ wert: 'wolke', name: 'Wolke' },
	{ wert: 'regen', name: 'Regen' },
	{ wert: 'schnee', name: 'Schnee' },
	{ wert: 'gewitter', name: 'Gewitter' },
	{ wert: 'nebel', name: 'Nebel' },
];

const NOTEN_TAKTARTEN: Option[] = [
	{ wert: '2/4', name: '2/4' },
	{ wert: '3/4', name: '3/4' },
	{ wert: '4/4', name: '4/4' },
];

const NOTEN_ACHTEL: Record<string, number> = { 1: 8, 2: 4, 4: 2, 8: 1 };
const NOTEN_TAKT_ACHTEL: Record<string, number> = { '2/4': 4, '3/4': 6, '4/4': 8 };
const NOTEN_STUFEN = ['c', 'd', 'e', 'f', 'g', 'a', 'h'];

const wortAchtel = (wort: string) => {
	const t = /(1|2|4|8)(\.?)$/.exec(wort);
	return t ? (NOTEN_ACHTEL[t[1] ?? ''] ?? 0) * (t[2] ? 1.5 : 1) : 0;
};

/** Hängt eine Note an; ist der letzte Takt voll, beginnt ein neuer. */
export const notenAnfuegen = (text: string, wort: string, takt: string) => {
	const roh = text.trim();
	if (!roh) {
		return wort;
	}
	const letzter = roh.split('|').at(-1) ?? '';
	const summe = letzter
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.reduce((s, w) => s + wortAchtel(w), 0);
	return summe >= (NOTEN_TAKT_ACHTEL[takt] ?? 8) ? `${roh} | ${wort}` : `${roh} ${wort}`;
};

export const notenZuruecknehmen = (text: string) =>
	text
		.trim()
		.replace(/\S+$/, '')
		.replace(/[\s|]+$/, '');

/** Setzt oder nimmt den Punkt der letzten Note; punktierte Achtel gibt es nicht. */
export const notenPunkt = (text: string) => {
	const roh = text.trim();
	if (/\.$/.test(roh)) {
		return roh.slice(0, -1);
	}
	return /[124]$/.test(roh) ? `${roh}.` : roh;
};

/** Die Noten mit Tonhöhe, ohne Pausen und Taktstriche. */
export const notenMitTon = (text: string) => text.split(/[\s|]+/).filter((w) => /^[a-h]'/.test(w));

/** Verschiebt die `nr`-te Note (ab 0) um Stufen; bleibt in c' bis a''. */
export const notenTon = (text: string, nr: number, schritt: number) => {
	let i = -1;
	return text.replace(
		/(^|[\s|])([a-h])('{1,2})(?=[1248])/g,
		(ganz: string, vor: string, ton: string, oktave: string) => {
			i += 1;
			if (i !== nr) {
				return ganz;
			}
			const alt = NOTEN_STUFEN.indexOf(ton === 'b' ? 'h' : ton) + (oktave.length - 1) * 7;
			const neu = Math.min(12, Math.max(0, alt + schritt));
			return `${vor}${NOTEN_STUFEN[neu % 7] ?? ''}${String.raw`'`.repeat(neu >= 7 ? 2 : 1)}`;
		},
	);
};

/** Von, bis und Teilung je Messgerät und Einheit, wie `SKALA_STANDARD` in `abbildungen.js`. */
export const SKALA_STANDARD: Record<string, [number, number, string]> = {
	'lineal|cm': [0, 15, '1 0.1'],
	'lineal|mm': [0, 150, '10 1'],
	'massband|cm': [0, 100, '10 1'],
	'massband|m': [0, 5, '1 0.1'],
	'messbecher|ml': [0, 500, '100 20'],
	'messbecher|l': [0, 2, '1 0.1'],
	'thermometer|°C': [-20, 40, '10 2'],
	'waage|g': [0, 1000, '100 20'],
	'waage|kg': [0, 5, '1 0.1'],
};

const skalaStandard = (w: Werte): [number, number, string] => {
	const art = w.art ?? 'lineal';
	const einheit =
		w.einheit ??
		Object.keys(SKALA_STANDARD)
			.find((k) => k.startsWith(`${art}|`))
			?.split('|')[1];
	return SKALA_STANDARD[`${art}|${einheit}`] ?? [0, 15, '1 0.1'];
};

/** Der wirksame Standard eines Zahlenfeldes bei den übrigen Werten. */
export const zahlStandard = (feld: ZahlFeld, w: Werte | null | undefined) =>
	feld.standardJe && w ? feld.standardJe(w) : feld.standard;

export const ABBILDUNG_SCHEMA = {
	'x-uhr': {
		name: 'Uhr',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Uhrzeit', 'Zifferblatt', 'Zeiger', 'Uhr', 'lesen', 'digital'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'uhrzeit',
				attribut: 'zeit',
				name: 'Uhrzeit',
				leiste: true,
				hilfe: 'Ohne Uhrzeit bleibt die Uhr leer, zum Einzeichnen.',
				loesung: { attribut: 'loesung', name: 'Zeiger nur in der Lösung' },
			},
			{ art: 'schalter', attribut: 'ziffern', name: 'Ziffern 1 bis 12', an: 'ja', aus: 'nein', standard: true },
			{ art: 'zahl', ...GROESSE, min: 48, max: 300, standard: 88, schritt: 8 },
			{
				art: 'auswahl',
				attribut: 'digital',
				name: 'Digitalanzeige',
				gruppe: 'Mehr',
				standard: 'nein',
				optionen: [
					{ wert: 'nein', name: 'Keine' },
					{ wert: 'ja', name: 'Unter der Uhr' },
					{ wert: 'nur', name: 'Nur digital' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'format',
				name: 'Digital im Format',
				gruppe: 'Mehr',
				standard: '24',
				optionen: [
					{ wert: '24', name: '24 Stunden' },
					{ wert: '12', name: '12 Stunden' },
				],
			},
			{
				art: 'text',
				attribut: 'sektor',
				name: 'Zeitspanne als Fläche',
				gruppe: 'Mehr',
				beispiel: '4:30-4:50',
				muster: '\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}',
				musterHilfe: 'Zwei Uhrzeiten wie 4:30-4:50.',
				loesung: { attribut: 'sektor-loesung', name: 'Fläche nur in der Lösung' },
			},
			{
				art: 'schalter',
				attribut: 'minuten',
				name: 'Außenring 5, 10, …',
				gruppe: 'Mehr',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'schalter',
				attribut: 'ziffern24',
				name: 'Innerer Ring 13 bis 24',
				gruppe: 'Mehr',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
		],
	},
	'x-menge': {
		name: 'Menge',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Zählen', 'Bündeln', 'Plättchen', 'Nüsse', 'Anzahl', 'Mengenbild'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'n', name: 'Anzahl', min: 1, max: 100, standard: 10 },
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Form',
				standard: 'kreis',
				optionen: [
					{ wert: 'kreis', name: 'Kreise' },
					{ wert: 'plaettchen', name: 'Plättchen' },
					{ wert: 'nuss', name: 'Nüsse' },
				],
			},
			{ art: 'zahl', attribut: 'reihe', name: 'In einer Reihe', min: 1, max: 10, standard: 10 },
			{
				art: 'zahl',
				attribut: 'buendel',
				name: 'Eingekreiste Zehner',
				min: 0,
				max: 10,
				standard: 0,
				loesung: { attribut: 'buendel-loesung', name: 'Nur in der Lösung einkreisen', vorrang: true },
			},
			{ art: 'zahl', ...GROESSE, min: 8, max: 40, standard: 16, schritt: 2 },
		],
		regeln: (w): Fehler => {
			const buendel = w.zahl('buendel');
			if (buendel > 0 && w.zahl('reihe') !== 10) {
				return { buendel: 'Zehner einkreisen geht nur mit 10 in einer Reihe.' };
			}
			const voll = Math.floor(w.zahl('n') / 10);
			if (buendel > voll) {
				return {
					buendel:
						voll === 0
							? 'Es gibt keinen vollen Zehner zum Einkreisen.'
							: `Es gibt nur ${voll} volle ${voll === 1 ? 'Zehnerreihe' : 'Zehnerreihen'}.`,
				};
			}
			return {};
		},
	},
	'x-dienes': {
		name: 'Mehrsystemblöcke',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Dienes', 'Zehnerstange', 'Einerwürfel', 'Stellenwert', 'Mehrsystem'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 't', name: 'Tausenderwürfel', min: 0, max: 9, standard: 0 },
			{ art: 'zahl', attribut: 'h', name: 'Hunderterplatten', min: 0, max: 9, standard: 0 },
			...ZEHNER_EINER('Zehnerstangen', 'Einerwürfel'),
			{
				art: 'zahlen',
				attribut: 'loesung',
				name: 'Nur in der Lösung zeigen',
				beispiel: '1 2 3 4',
				hilfe: 'Vier Zahlen: Tausender, Hunderter, Zehner, Einer.',
			},
			{ art: 'zahl', ...GROESSE, min: 4, max: 16, standard: 8 },
		],
		regeln: (w): Fehler =>
			w.zahl('t') + w.zahl('h') + w.zahl('z') + w.zahl('e') === 0 && w.zahlen('loesung').length === 0
				? { e: 'Mindestens ein Block, auf dem Blatt oder in der Lösung.' }
				: {},
	},
	'x-strichpunkt': {
		name: 'Strich-Punkt-Bild',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Zehner', 'Einer', 'Stellenwert', 'Striche', 'Punkte'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			...ZEHNER_EINER('Striche (Zehner)', 'Punkte (Einer)'),
			{ art: 'zahl', ...GROESSE, min: 20, max: 80, standard: 40, schritt: 4 },
		],
		regeln: mindestensEins,
	},
	'x-stellentafel': {
		name: 'Stellentafel',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Stellenwerttafel', 'Hunderter', 'Zehner', 'Einer', 'Tausender', 'Plättchen'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'stellen',
				name: 'Stellen',
				standard: STELLEN_STANDARD,
				optionen: [
					{ wert: 'E', name: 'E' },
					{ wert: 'Z E', name: 'Z E' },
					{ wert: 'H Z E', name: 'H Z E' },
					{ wert: 'T H Z E', name: 'T H Z E' },
					{ wert: 'ZT T H Z E', name: 'ZT T H Z E' },
					{ wert: 'HT ZT T H Z E', name: 'HT ZT T H Z E' },
					{ wert: 'M HT ZT T H Z E', name: 'M HT ZT T H Z E' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Darstellung',
				standard: 'ziffern',
				optionen: [
					{ wert: 'ziffern', name: 'Ziffern' },
					{ wert: 'plaettchen', name: 'Plättchen' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'plaettchen',
				name: 'Plättchen je Stelle',
				beispiel: '3 0 12',
				hilfe: 'Von links nach rechts, bis 15 je Stelle. In der Lösung steht dieselbe Angabe unter „Nur in der Lösung zeigen“.',
			},
			{
				art: 'ziffern',
				attribut: 'werte',
				name: 'Zahlen in der Tafel',
				stellen: 'stellen',
				loesung: { attribut: 'loesung', name: 'Nur in der Lösung zeigen' },
			},
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 6, standard: 1 },
		],
	},
	'x-zwanzigerfeld': {
		name: 'Zwanzigerfeld',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Zwanzigerraum', 'Zehnerfeld', 'Fünferfeld', 'Wendeplättchen', 'Kraft', 'Fünf'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Feld',
				standard: 'zwanziger',
				optionen: [
					{ wert: 'fuenfer', name: 'Fünferfeld' },
					{ wert: 'zehner', name: 'Zehnerfeld' },
					{ wert: 'zwanziger', name: 'Zwanzigerfeld' },
				],
			},
			{ art: 'zahl', attribut: 'n', name: 'Plättchen', min: 0, max: 20, standard: 0 },
			{ art: 'zahl', attribut: 'n2', name: 'Plättchen, zweite Sorte', min: 0, max: 20, standard: 0 },
			{
				art: 'zahlen',
				attribut: 'loesung',
				name: 'Nur in der Lösung zeigen',
				beispiel: '5 2',
				hilfe: 'Plättchen und zweite Sorte.',
			},
			{ art: 'zahl', ...GROESSE, min: 12, max: 40, standard: 22, schritt: 2 },
		],
	},
	'x-zahlenstrahl': {
		name: 'Zahlenstrahl',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Zahlengerade', 'Zahlenreihe', 'Nachbarzahlen', 'Hunderterraum'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'von', name: 'Von', min: 0, max: 1000000, standard: 0 },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: 1, max: 1000000, standard: 20 },
			{ art: 'zahl', attribut: 'schritt', name: 'Abstand der Striche', min: 1, max: 100000, standard: 1 },
			{ art: 'zahl', attribut: 'marken', name: 'Mittlere Striche alle', min: 1, max: 100, standard: 5 },
			{
				art: 'zahlen',
				attribut: 'zahlen',
				name: 'Beschriftete Zahlen',
				beispiel: '0 5 10',
				hilfe: 'Leer: nur Anfang und Ende.',
			},
			{
				art: 'zahlen',
				attribut: 'pfeile',
				name: 'Pfeile mit Kästchen',
				beispiel: '7 13',
				hilfe: 'Die Zahl im Kästchen steht nur in der Lösung.',
			},
			{
				art: 'zahl',
				attribut: 'breite',
				name: 'Breite',
				einheit: 'px',
				min: 200,
				max: 1000,
				standard: 560,
				schritt: 20,
			},
			{ art: 'zahl', attribut: 'schrift', name: 'Schriftgröße', einheit: 'px', min: 10, max: 28, standard: 16 },
		],
		regeln: (w): Fehler => {
			const von = w.zahl('von');
			const bis = w.zahl('bis');
			if (von >= bis) {
				return { bis: '„Bis“ muss größer sein als „Von“.' };
			}
			const striche = (bis - von) / w.zahl('schritt');
			if (striche > 200) {
				return {
					schritt: `Das wären ${Math.ceil(striche)} Striche. Nimm einen größeren Abstand (höchstens 200).`,
				};
			}
			const fehler: Fehler = {};
			for (const feld of ['zahlen', 'pfeile']) {
				const draussen = w.zahlen(feld).find((z) => z < von || z > bis);
				if (draussen !== undefined) {
					fehler[feld] = `${draussen} liegt nicht zwischen ${von} und ${bis}.`;
				}
			}
			return fehler;
		},
	},
	'x-timer': {
		name: 'Timer',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Zeitscheibe', 'Zeit', 'Minuten', 'Countdown', 'Stoppuhr'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'minuten', name: 'Minuten', min: 1, max: 120, standard: 10 },
			{
				art: 'auswahl',
				attribut: 'skala',
				name: 'Skala',
				hilfe: 'Für kurze Phasen 5 oder 10 Minuten, sonst ist die Scheibe kaum zu sehen.',
				optionen: [
					{ wert: null, name: 'Passend (60 bzw. 120)' },
					{ wert: '5', name: '5 Minuten' },
					{ wert: '10', name: '10 Minuten' },
					{ wert: '15', name: '15 Minuten' },
					{ wert: '30', name: '30 Minuten' },
					{ wert: '60', name: '60 Minuten' },
					{ wert: '120', name: '120 Minuten' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 120, max: 600, standard: 360, schritt: 20 },
		],
		regeln: (w): Fehler => {
			const skala = w.text('skala');
			return skala !== null && w.zahl('minuten') > Number(skala)
				? { skala: `Die Skala reicht nur bis ${skala}. Nimm eine größere oder „Passend“.` }
				: {};
		},
	},
	/** Nur für die Tests der Feldtypen (023); kommt in Material nicht vor. */
	'x-probe': {
		name: 'Probe',
		felder: [
			{ art: 'text', attribut: 'titel', name: 'Titel', max: 20, gruppe: 'Einfach' },
			{
				art: 'text',
				attribut: 'inhalt',
				name: 'Wort',
				quelle: 'inhalt',
				muster: '[A-Za-zÄÖÜäöüß|&<]*',
				musterHilfe: 'Nur Buchstaben und |.',
				einfuegen: { zeichen: '|', name: 'Strich einfügen' },
				gruppe: 'Einfach',
			},
			{ art: 'muster', attribut: 'farbe', name: 'Füllung', optionen: FARBEN, standard: 'rot', gruppe: 'Einfach' },
			{
				art: 'mehrfach',
				attribut: 'arten',
				name: 'Arten',
				optionen: [
					{ wert: 'eins', name: 'Eins' },
					{ wert: 'zwei', name: 'Zwei' },
					{ wert: 'drei', name: 'Drei' },
				],
				gruppe: 'Einfach',
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung', gruppe: 'Einfach' },
			{
				art: 'liste',
				attribut: 'eintraege',
				name: 'Einträge',
				unter: [
					{ name: 'Name', art: 'text', standard: 'Neu' },
					{ name: 'Zahl', art: 'zahl', min: 0, max: 99, standard: '1' },
				],
				min: 1,
				max: 5,
				gruppe: 'Listen',
			},
			{ art: 'raster', attribut: 'feld', name: 'Feld', spalten: 3, zeilen: 2, gruppe: 'Raster' },
			{
				art: 'raster',
				attribut: 'hoehen',
				name: 'Höhen',
				zahlen: { min: 0, max: 5 },
				wachsen: { spalten: 4, zeilen: 4 },
				gruppe: 'Raster',
			},
			{ art: 'raster', attribut: 'form', name: 'Form', form: true, gruppe: 'Raster' },
		],
		regeln: (w): Fehler => (w.zeilen('eintraege').length === 4 ? { eintraege: 'Vier geht nicht.' } : {}),
	},
	'x-gluecksrad': {
		name: 'Glücksrad',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Drehrad', 'Zufall', 'Wahrscheinlichkeit', 'Rad'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'liste',
				attribut: 'felder',
				name: 'Felder',
				unter: [
					{ name: 'Füllung', art: 'muster', optionen: FARBEN, standard: 'rot' },
					{ name: 'Beschriftung', art: 'text', leer: true },
				],
				min: 2,
				max: 12,
			},
			{
				art: 'zahlen',
				attribut: 'anteile',
				name: 'Anteile',
				beispiel: '1 1 2',
				hilfe: 'Eine Zahl je Feld. Leer heißt: alle Felder gleich groß.',
			},
			{
				art: 'text',
				attribut: 'loesung',
				name: 'Füllungen erst in der Lösung',
				hilfe: 'Auf dem Blatt bleiben alle Felder weiß, z. B. „rot blau rot“.',
				beispiel: 'rot blau rot',
			},
			{ art: 'schalter', attribut: 'zeiger', name: 'Zeiger', an: 'ja', aus: 'nein', standard: true },
			{ art: 'schalter', attribut: 'legende', name: 'Legende', an: 'ja', aus: 'nein', standard: true },
			{
				art: 'schalter',
				attribut: 'bastel',
				name: 'Bastelvorlage (12 cm)',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'zahl', ...GROESSE, min: 100, max: 460, standard: 200, schritt: 20 },
		],
		regeln: (w): Fehler => {
			const felder = w.zeilen('felder').length;
			const anteile = w.zahlen('anteile');
			if (anteile.length > 0 && anteile.reduce((a, b) => a + b, 0) <= 0) {
				return { anteile: 'Die Anteile müssen zusammen mehr als 0 ergeben.' };
			}
			if (anteile.length > 0 && felder > 0 && anteile.length !== felder) {
				return { anteile: `Bitte genau ${felder} Zahlen, eine je Feld.` };
			}
			return {};
		},
	},
	'x-wuerfel': {
		name: 'Würfel',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Würfelaugen', 'Augenzahl', 'Zufall'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Seite zeigt',
				standard: 'augen',
				optionen: [
					{ wert: 'augen', name: 'Augen' },
					{ wert: 'zahl', name: 'Zahl' },
					{ wert: 'muster', name: 'Füllung' },
					{ wert: 'text', name: 'Text' },
				],
			},
			{ art: 'zahl', attribut: 'augen', name: 'Augen', min: 0, max: 6, standard: 0 },
			{ art: 'text', attribut: 'inhalt', name: 'Zahl, Text oder Füllung', max: 6 },
			{ art: 'text', attribut: 'loesung', name: 'Nur in der Lösung', max: 6 },
			{
				art: 'auswahl',
				attribut: 'ansicht',
				name: 'Ansicht',
				standard: 'flach',
				optionen: [
					{ wert: 'flach', name: 'Flach' },
					{ wert: 'raeumlich', name: 'Räumlich' },
				],
			},
			{ art: 'zahl', attribut: 'oben', name: 'Oben', min: 0, max: 6, standard: 1 },
			{ art: 'zahl', attribut: 'vorne', name: 'Vorne', min: 0, max: 6, standard: 2 },
			{ art: 'zahl', attribut: 'rechts', name: 'Rechts', min: 0, max: 6, standard: 3 },
			{ art: 'zahl', ...GROESSE, min: 32, max: 200, standard: 60, schritt: 4 },
		],
	},
	'x-strichliste': {
		name: 'Strichliste',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Häufigkeit', 'Zählen', 'Strichtabelle', 'Fünferbündel'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'liste',
				attribut: 'werte',
				name: 'Zeilen',
				unter: [
					{ name: 'Name', art: 'text', standard: 'Neu' },
					{ name: 'Anzahl', art: 'zahl', min: 0, max: 30, standard: '1' },
				],
				min: 1,
				max: 8,
			},
			{
				art: 'auswahl',
				attribut: 'zeige',
				name: 'Auf dem Blatt steht',
				standard: 'striche',
				optionen: [
					{ wert: 'striche', name: 'Striche' },
					{ wert: 'zahl', name: 'Anzahl' },
					{ wert: 'leer', name: 'Nichts' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 28, max: 60, standard: 34, schritt: 2 },
		],
	},
	'x-diagramm': {
		name: 'Diagramm',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Säulendiagramm', 'Balkendiagramm', 'Bilddiagramm', 'Schaubild', 'Statistik'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'saeulen',
				optionen: [
					{ wert: 'saeulen', name: 'Säulen' },
					{ wert: 'balken', name: 'Balken' },
					{ wert: 'bild', name: 'Bilder' },
					{ wert: 'linie', name: 'Linie' },
				],
			},
			{
				art: 'liste',
				attribut: 'werte',
				name: 'Werte',
				unter: [
					{ name: 'Name', art: 'text', standard: 'Neu' },
					{ name: 'Wert', art: 'zahl', min: -100000, max: 100000, standard: '1', leer: true },
				],
				min: 1,
				max: 12,
			},
			{
				art: 'zahlen',
				attribut: 'offen',
				name: 'Offen zum Zeichnen',
				beispiel: '2 3',
				hilfe: 'Nummern der Einträge, die die Kinder selbst zeichnen.',
			},
			{ art: 'zahl', attribut: 'skala', name: 'Skalenschritt', min: 1, max: 100000, standard: 1 },
			{
				art: 'zahl',
				attribut: 'von',
				name: 'Von',
				min: -1000,
				max: 1000,
				standard: 0,
				hilfe: 'Nur beim Liniendiagramm, z. B. −10 für Temperaturen unter null.',
			},
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: 1, max: 100000, standard: 10 },
			{ art: 'text', attribut: 'einheit', name: 'Achse', max: 20 },
			{
				art: 'auswahl',
				attribut: 'symbol',
				name: 'Symbol',
				standard: 'kreis',
				optionen: [
					{ wert: 'kreis', name: 'Kreis' },
					{ wert: 'quadrat', name: 'Quadrat' },
					{ wert: 'stern', name: 'Stern' },
					{ wert: 'herz', name: 'Herz' },
				],
			},
			{ art: 'zahl', attribut: 'je', name: 'Ein Symbol steht für', min: 1, max: 1000, standard: 1 },
			{ art: 'zahl', ...GROESSE, min: 100, max: 400, standard: 200, schritt: 20 },
		],
		regeln: (w): Fehler => {
			const bis = w.text('bis');
			const zahlen = w.zeilen('werte').map((z) => alsZahl(z[1] || '0'));
			if (w.text('art') !== 'linie' && zahlen.some((v) => v < 0)) {
				return { werte: 'Werte unter null gehen nur beim Liniendiagramm.' };
			}
			if (w.text('art') !== 'linie' && w.zeilen('werte').some((z) => !z[1])) {
				return { werte: 'Leere Werte gehen nur beim Liniendiagramm.' };
			}
			return bis !== null && Math.max(0, ...zahlen) > alsZahl(bis)
				? { bis: `Ein Wert ist größer als ${bis}.` }
				: {};
		},
	},
	'x-urne': {
		name: 'Kugeln im Säckchen',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Kugeln', 'Säckchen', 'Ziehen', 'Zufall'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'liste',
				attribut: 'kugeln',
				name: 'Kugeln',
				unter: [
					{ name: 'Füllung', art: 'muster', optionen: FARBEN, standard: 'rot' },
					{ name: 'Anzahl', art: 'zahl', min: 0, max: 20, standard: '1' },
				],
				max: 8,
			},
			{
				art: 'text',
				attribut: 'loesung',
				name: 'Kugeln erst in der Lösung',
				hilfe: 'Auf dem Blatt bleibt das Gefäß leer, z. B. „rot: 3; blau: 1“.',
				beispiel: 'rot: 3; blau: 1',
			},
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Gefäß',
				standard: 'sack',
				optionen: [
					{ wert: 'sack', name: 'Säckchen' },
					{ wert: 'glas', name: 'Glas' },
				],
			},
			{ art: 'schalter', attribut: 'legende', name: 'Legende', an: 'ja', aus: 'nein', standard: true },
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung' },
			{ art: 'zahl', ...GROESSE, min: 100, max: 300, standard: 160, schritt: 10 },
		],
		regeln: (w): Fehler => {
			const summe = w.zeilen('kugeln').reduce((a, z) => a + alsZahl(z[1] ?? '0'), 0);
			return summe > 20 ? { kugeln: `Höchstens 20 Kugeln, hier sind es ${summe}.` } : {};
		},
	},
	'x-wahrscheinlichkeit': {
		name: 'Wahrscheinlichkeit',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['sicher', 'möglich', 'unmöglich', 'Skala', 'Ereignis'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'stufen',
				name: 'Stufen',
				standard: '3',
				optionen: [
					{ wert: '3', name: '3: unmöglich, möglich, sicher' },
					{ wert: '5', name: '5: auch wenig und sehr wahrscheinlich' },
				],
			},
			{
				art: 'liste',
				attribut: 'ereignisse',
				name: 'Ereignisse',
				unter: [
					{ name: 'Buchstabe', art: 'text', standard: 'A' },
					{ name: 'Stufe', art: 'auswahl', standard: 'möglich', optionen: STUFEN_FUENF },
				],
				max: 10,
			},
		],
		regeln: (w): Fehler => {
			const erlaubt = w.text('stufen') === '5' ? STUFEN_FUENF.map((o) => o.wert) : STUFEN_DREI;
			const falsch = w.zeilen('ereignisse').find((z) => !erlaubt.includes(z[1] ?? ''));
			return falsch ? { ereignisse: `„${falsch[1] ?? ''}“ steht nicht auf dieser Skala.` } : {};
		},
	},
	'x-kombinatorik': {
		name: 'Möglichkeiten',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Kombinationen', 'Baumdiagramm', 'Möglichkeiten', 'Eisbecher'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Darstellung',
				standard: 'baum',
				optionen: [
					{ wert: 'baum', name: 'Baum' },
					{ wert: 'tabelle', name: 'Tabelle' },
					{ wert: 'liste', name: 'Liste' },
				],
			},
			{
				art: 'liste',
				attribut: 'stufen',
				name: 'Stufen',
				zeilenTrenner: '/',
				hilfe: 'Je Stufe die Wörter mit Leerzeichen, z. B. „Waffel Becher“.',
				unter: [{ name: 'Wörter', art: 'text', standard: 'A B' }],
				min: 1,
				max: 3,
			},
			{
				art: 'schalter',
				attribut: 'wiederholung',
				name: 'Mit Wiederholung',
				an: 'ja',
				aus: 'nein',
				standard: true,
			},
			{
				art: 'schalter',
				attribut: 'reihenfolge',
				name: 'Reihenfolge zählt',
				an: 'ja',
				aus: 'nein',
				standard: true,
			},
			{ art: 'zahl', attribut: 'vorgegeben', name: 'Schon ausgefüllt', min: 0, max: 24, standard: 1 },
		],
	},
	'x-gitter': {
		name: 'Gitter',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: [
				'Karos',
				'Kästchen',
				'Spiegeln',
				'Achsensymmetrie',
				'Muster',
				'fortsetzen',
				'Vergrößern',
				'Wege',
			],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'karo',
				gruppe: 'Gitter',
				optionen: [
					{ wert: 'karo', name: 'Kästchen' },
					{ wert: 'punkte', name: 'Punkte' },
					{ wert: 'geobrett', name: 'Geobrett' },
				],
			},
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 40, standard: 10, gruppe: 'Gitter' },
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 40, standard: 8, gruppe: 'Gitter' },
			{
				art: 'auswahl',
				attribut: 'kaestchen',
				name: 'Kästchen',
				gruppe: 'Gitter',
				optionen: [
					{ wert: null, name: 'Wie im Heft der Klasse' },
					{ wert: '0.5', name: '0,5 cm' },
					{ wert: '1', name: '1 cm' },
				],
			},
			{ art: 'raster', attribut: 'figur', name: 'Figur', spalten: 'spalten', zeilen: 'zeilen', gruppe: 'Figur' },
			{
				art: 'text',
				attribut: 'linien',
				name: 'Figur aus Linien',
				gruppe: 'Figur',
				muster: '[-0-9.,; ]*',
				musterHilfe: 'Punkte wie 0,0 3,0 3,2; mehrere Figuren mit ; trennen.',
				hilfe: 'Diese Figur besteht aus Linien und lässt sich nur über Claude ändern.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'spiegeln', name: 'Spiegeln' },
					{ wert: 'fortsetzen', name: 'Fortsetzen' },
					{ wert: 'vergroessern', name: 'Vergrößern' },
					{ wert: 'weg', name: 'Weg' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'achse',
				name: 'Achse',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: null, name: 'Keine' },
					{ wert: 'senkrecht', name: 'Senkrecht' },
					{ wert: 'waagerecht', name: 'Waagerecht' },
				],
			},
			{
				art: 'zahl',
				attribut: 'achse-bei',
				name: 'Achse nach Kästchen',
				min: 1,
				max: 39,
				standard: 5,
				gruppe: 'Aufgabe',
			},
			{
				art: 'zahl',
				attribut: 'rapport',
				name: 'Breite eines Musters',
				min: 1,
				max: 40,
				standard: 4,
				gruppe: 'Aufgabe',
			},
			{
				art: 'zahl',
				attribut: 'rapporte',
				name: 'Muster vorgegeben',
				min: 1,
				max: 10,
				standard: 2,
				gruppe: 'Aufgabe',
			},
			{
				art: 'auswahl',
				attribut: 'rapportart',
				name: 'Fortsetzen durch',
				standard: 'schieben',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: 'schieben', name: 'Schieben' },
					{ wert: 'spiegeln', name: 'Spiegeln im Wechsel' },
					{ wert: 'drehen', name: 'Drehen im Wechsel' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'faktor',
				name: 'Größe',
				standard: '2',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: '2', name: 'Doppelt so groß' },
					{ wert: '0.3', name: 'Klein' },
					{ wert: '0.5', name: 'Halb so groß' },
				],
			},
			{
				art: 'liste',
				attribut: 'weg',
				name: 'Weg',
				zeilenTrenner: ' ',
				feldTrenner: '',
				gruppe: 'Aufgabe',
				unter: [
					{ name: 'Schritte', art: 'zahl', min: 1, max: 40, standard: '1' },
					{
						name: 'Richtung',
						art: 'auswahl',
						standard: '→',
						optionen: [
							{ wert: '→', name: '→ rechts' },
							{ wert: '←', name: '← links' },
							{ wert: '↑', name: '↑ hoch' },
							{ wert: '↓', name: '↓ runter' },
						],
					},
				],
			},
			{
				art: 'auswahl',
				attribut: 'wegart',
				name: 'Beim Weg',
				standard: 'gehen',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: 'gehen', name: 'Kinder gehen die Pfeile' },
					{ wert: 'beschreiben', name: 'Kinder schreiben die Pfeile' },
				],
			},
			{
				art: 'text',
				attribut: 'start',
				name: 'Start (Spalte,Zeile)',
				gruppe: 'Aufgabe',
				muster: '\\d+,\\d+',
				musterHilfe: 'Zum Beispiel 2,3. Das Kästchen oben links ist 0,0.',
			},
			{
				art: 'mehrfach',
				attribut: 'zaehlen',
				name: 'Zählen lassen',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: 'flaeche', name: 'Fläche' },
					{ wert: 'umfang', name: 'Umfang' },
				],
			},
		],
	},
	'x-figur': {
		name: 'Figur',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Dreieck', 'Viereck', 'Rechteck', 'Kreis', 'Fläche', 'Formen', 'rechter', 'Winkel'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Form',
				standard: 'quadrat',
				optionen: [
					{ wert: 'quadrat', name: 'Quadrat' },
					{ wert: 'rechteck', name: 'Rechteck' },
					{ wert: 'dreieck', name: 'Dreieck' },
					{ wert: 'kreis', name: 'Kreis' },
					{ wert: 'trapez', name: 'Trapez' },
					{ wert: 'parallelogramm', name: 'Parallelogramm' },
					{ wert: 'raute', name: 'Raute' },
					{ wert: 'fuenfeck', name: 'Fünfeck' },
					{ wert: 'sechseck', name: 'Sechseck' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'typ',
				name: 'Dreieck',
				standard: 'rechtwinklig',
				optionen: [
					{ wert: 'rechtwinklig', name: 'Rechtwinklig' },
					{ wert: 'gleichseitig', name: 'Gleichseitig' },
					{ wert: 'gleichschenklig', name: 'Gleichschenklig' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'masse',
				name: 'Maße in cm',
				beispiel: '4 3',
				hilfe: 'Mit Maßen zeichnet die Figur in echten Zentimetern.',
			},
			{ art: 'zahl', attribut: 'drehung', name: 'Drehung in Grad', min: 0, max: 359, standard: 0, schritt: 15 },
			{ art: 'mehrfach', attribut: 'markierung', name: 'Kennzeichnen', optionen: FIGUR_MARKEN },
			{ art: 'mehrfach', attribut: 'loesung', name: 'Kennzeichnen nur in der Lösung', optionen: FIGUR_MARKEN },
			{
				art: 'schalter',
				attribut: 'beschriftung',
				name: 'Ecken A, B, C',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'zahl', ...GROESSE, min: 60, max: 400, standard: 120, schritt: 10 },
		],
	},
	'x-hunderterfeld': {
		name: 'Hunderterfeld',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Hunderterraum', 'Punktefeld', 'Malwinkel', '100er-Feld'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'n', name: 'Plättchen', min: 0, max: 100, standard: 0 },
			{ art: 'zahl', attribut: 'n2', name: 'Plättchen, zweite Sorte', min: 0, max: 100, standard: 0 },
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 10, standard: 10 },
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 10, standard: 10 },
			{
				art: 'text',
				attribut: 'malwinkel',
				name: 'Malwinkel',
				muster: '([0-9]+x[0-9]+)?',
				musterHilfe: 'So: 3x7.',
			},
			{
				art: 'text',
				attribut: 'loesung',
				name: 'Nur in der Lösung zeigen',
				muster: '[0-9 x]*',
				musterHilfe: 'Plättchen wie 30 6 oder Malwinkel wie 3x7.',
			},
			{ art: 'zahl', ...GROESSE, min: 12, max: 40, standard: 22, schritt: 2 },
		],
	},
	'x-hundertertafel': {
		name: 'Hundertertafel',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Hunderterraum', 'Hunderterblatt', 'Tausendertafel', 'Zahlentafel'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'von', name: 'Von', min: 1, max: 9901, standard: 1 },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: 1, max: 10000, standard: 100 },
			{
				art: 'auswahl',
				attribut: 'ausschnitt',
				name: 'Ausschnitt',
				standard: 'ganz',
				optionen: [
					{ wert: 'ganz', name: 'Ganze Tafel' },
					{ wert: 'zeile', name: 'Zeile' },
					{ wert: 'spalte', name: 'Spalte' },
					{ wert: 'kreuz', name: 'Kreuz' },
					{ wert: 'block', name: 'Block' },
					{ wert: 'treppe', name: 'Treppe' },
				],
			},
			{ art: 'zahl', attribut: 'mitte', name: 'Mittelzahl', min: 1, max: 10000, standard: 45 },
			{ art: 'raster', attribut: 'luecken', name: 'Lücken', form: true, gruppe: 'Lücken' },
			{
				art: 'zahl',
				attribut: 'zufall',
				name: 'Zufällige Lücken',
				min: 0,
				max: 100,
				standard: 0,
				gruppe: 'Lücken',
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung', gruppe: 'Lücken' },
			{ art: 'raster', attribut: 'markiert', name: 'Markierte Zahlen', form: true, gruppe: 'Markierung' },
			{ art: 'zahl', ...GROESSE, min: 20, max: 50, standard: 32, schritt: 2 },
		],
	},
	'x-rechenrahmen': {
		name: 'Rechenrahmen',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Abakus', 'Rechenschieber', 'Kugeln', 'Zwanzigerrahmen'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Rahmen',
				standard: '20',
				optionen: [
					{ wert: '20', name: '20er' },
					{ wert: '100', name: '100er' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'stellung',
				name: 'Kugeln links je Reihe',
				beispiel: '7 3',
			},
			{ art: 'zahlen', attribut: 'loesung', name: 'Nur in der Lösung zeigen', beispiel: '7 3' },
			{ art: 'zahl', ...GROESSE, min: 10, max: 30, standard: 18, schritt: 2 },
		],
	},
	'x-rechenstrich': {
		name: 'Rechenstrich',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['leerer', 'Zahlenstrahl', 'Rechenweg', 'Sprünge', 'Halbschriftlich'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'start', name: 'Start', min: 0, max: 1000000, standard: 0 },
			{
				art: 'liste',
				attribut: 'spruenge',
				name: 'Sprünge',
				zeilenTrenner: ' ',
				feldTrenner: ' ',
				min: 1,
				max: 8,
				unter: [{ art: 'text', name: 'Sprung' }],
				hilfe: 'Zum Beispiel +30 oder −4.',
			},
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Schon vorgegeben',
				standard: ['start', 'spruenge'],
				optionen: [
					{ wert: 'start', name: 'Start' },
					{ wert: 'spruenge', name: 'Sprünge' },
					{ wert: 'zwischen', name: 'Zwischenergebnisse' },
					{ wert: 'ziel', name: 'Ziel' },
				],
				hilfe: 'Alles andere ist ein Kästchen; die Lösung wird berechnet.',
			},
			{ art: 'schalter', attribut: 'massstab', name: 'Bögen im Maßstab', an: 'ja', aus: 'nein', standard: false },
			{
				art: 'schalter',
				attribut: 'gemischt',
				name: 'Gemischte Sprünge',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'zahl',
				attribut: 'breite',
				name: 'Breite',
				einheit: 'px',
				min: 200,
				max: 620,
				standard: 560,
				schritt: 20,
			},
		],
	},
	'x-lineatur': {
		name: 'Schreiblinien',
		katalog: {
			kategorie: 'Schreiben',
			suchbegriffe: ['Schreiblinien', 'Lineatur', 'Zeilen', 'Hilfslinien', 'Schreiben', 'lernen'],
			ort: 'aufgabe',
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Lineatur',
				standard: '1',
				blaettern: true,
				optionen: [
					{ wert: '1', name: 'Lineatur 1' },
					{ wert: '2', name: 'Lineatur 2' },
					{ wert: '3', name: 'Lineatur 3' },
					{ wert: '4', name: 'Lineatur 4' },
					{ wert: 'karo', name: 'Karo 1 cm' },
					{ wert: 'karo-klein', name: 'Karo 0,5 cm' },
				],
			},
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 30, standard: 3 },
			{ art: 'text', attribut: 'vorlage', name: 'Zum Nachspuren', beispiel: 'Rosine' },
			{ art: 'zahl', attribut: 'vorlage-zeilen', name: 'Zeilen mit Vorlage', min: 1, max: 30, standard: 1 },
			{ art: 'text', attribut: 'anfang', name: 'Vorbild am Zeilenanfang', beispiel: 'Ro' },
			{ art: 'text', attribut: 'loesung', name: 'Text in der Lösung', beispiel: 'Der Hund bellt.' },
			{
				art: 'auswahl',
				attribut: 'mittelband',
				name: 'Mittelband',
				standard: 'linie',
				gruppe: 'Maße',
				hilfe: 'Getönt erscheint nur beim Farbdruck.',
				optionen: [
					{ wert: 'linie', name: 'Graue Linien' },
					{ wert: 'getoent', name: 'Getönt' },
				],
			},
			{
				art: 'text',
				attribut: 'band',
				name: 'Mittelband in mm',
				beispiel: '4',
				gruppe: 'Maße',
				muster: '\\d+([.,]\\d+)?',
				musterHilfe: 'Eine Zahl wie 4 oder 3,5.',
			},
			{
				art: 'zahl',
				attribut: 'breite',
				name: 'Breite',
				einheit: 'px',
				min: 100,
				max: 620,
				standard: 620,
				schritt: 20,
				gruppe: 'Maße',
			},
		],
	},
	'x-lueckentext': {
		name: 'Lückentext',
		katalog: { kategorie: 'Schreiben', suchbegriffe: ['Lücke', 'Einsetzen', 'Ergänzen', 'Text'], ort: 'aufgabe' },
		felder: [
			{
				art: 'text',
				attribut: 'inhalt',
				name: 'Text',
				quelle: 'inhalt',
				zeilen: 5,
				beispiel: 'Der [Hund] bellt, die [[Katze]] miaut.',
				einfuegen: { zeichen: '[', bis: ']', name: 'Lücke' },
				hilfe: 'Lücke: [Wort]. Schon eingetragen: [[Wort]].',
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Darstellung',
				standard: 'linie',
				optionen: [
					{ wert: 'linie', name: 'Linie' },
					{ wert: 'kasten', name: 'Kasten' },
					{ wert: 'gepunktet', name: 'Gepunktet' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'breite',
				name: 'Breite',
				standard: 'einheitlich',
				optionen: [
					{ wert: 'einheitlich', name: 'Alle gleich breit' },
					{ wert: 'wortlaenge', name: 'Nach Wortlänge' },
				],
			},
		],
	},
	'x-wortspeicher': {
		name: 'Wortspeicher',
		katalog: { kategorie: 'Schreiben', suchbegriffe: ['Wörter', 'Wortkasten', 'Lücke'], ort: 'aufgabe' },
		felder: [
			{
				art: 'text',
				attribut: 'woerter',
				name: 'Wörter',
				zeilen: 3,
				beispiel: 'Hund; Maus; Pferd',
				hilfe: 'Leer: die Wörter aus den Lücken dieser Aufgabe.',
			},
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 6, standard: 4 },
			{
				art: 'auswahl',
				attribut: 'reihenfolge',
				name: 'Reihenfolge',
				standard: 'alphabetisch',
				optionen: [
					{ wert: 'alphabetisch', name: 'Alphabetisch' },
					{ wert: 'gemischt', name: 'Gemischt' },
				],
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung' },
			{ art: 'schalter', attribut: 'rahmen', name: 'Rahmen', an: '1', aus: '0', standard: true },
		],
	},
	'x-ankreuzen': {
		name: 'Ankreuzen',
		katalog: {
			kategorie: 'Schreiben',
			suchbegriffe: ['Multiple Choice', 'Auswahl', 'Kreuzen', 'Antworten'],
			ort: 'aufgabe',
		},
		felder: [
			{
				art: 'text',
				attribut: 'fragen',
				name: 'Fragen',
				zeilen: 5,
				beispiel: 'Wie viele Beine hat ein Hund?: *4, 3, 6',
				hilfe: 'Frage: Antworten mit Komma; * markiert die richtige; ; trennt die Fragen.',
			},
			{ art: 'schalter', attribut: 'mehrfach', name: 'Mehrere richtig', an: '1', aus: '0', standard: false },
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 4, standard: 1 },
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung' },
		],
	},
	'x-zuordnen': {
		name: 'Zuordnen',
		katalog: {
			kategorie: 'Schreiben',
			suchbegriffe: ['Verbinden', 'Paare', 'Linien', 'Was gehört zusammen', 'Zuordnung'],
			ort: 'aufgabe',
		},
		felder: [
			{
				art: 'liste',
				attribut: 'paare',
				name: 'Paare',
				unter: [
					{ name: 'Links', art: 'text', standard: 'Neu' },
					{ name: 'Rechts', art: 'text', standard: 'Neu' },
					{ name: 'Bild links', art: 'bild', leer: true },
					{ name: 'Bild rechts', art: 'bild', leer: true },
				],
				min: 2,
				max: 10,
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Darstellung',
				standard: 'linien',
				optionen: [
					{ wert: 'linien', name: 'Mit Linien verbinden' },
					{ wert: 'ziffern', name: 'Ziffer eintragen' },
				],
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung' },
		],
	},
	'x-sortieren': {
		name: 'Sortieren',
		katalog: {
			kategorie: 'Schreiben',
			suchbegriffe: ['Reihenfolge', 'Ordnen', 'Satz ordnen', 'Bilderfolge', 'Nummerieren'],
			ort: 'aufgabe',
		},
		felder: [
			{
				art: 'liste',
				attribut: 'eintraege',
				name: 'Einträge in richtiger Reihenfolge',
				unter: [
					{ name: 'Text', art: 'text', standard: 'Neu' },
					{ name: 'Bild', art: 'bild', leer: true },
				],
				min: 2,
				max: 12,
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'saetze',
				optionen: [
					{ wert: 'saetze', name: 'Sätze' },
					{ wert: 'woerter', name: 'Wörter' },
					{ wert: 'bilder', name: 'Bilder' },
					{ wert: 'zahlen', name: 'Zahlen' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Darstellung',
				standard: 'ziffer',
				optionen: [
					{ wert: 'ziffer', name: 'Ziffer im Kästchen' },
					{ wert: 'linien', name: 'Linien zum Abschreiben' },
				],
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung' },
		],
	},
	'x-beschriften': {
		name: 'Beschriften',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Bild beschriften', 'Pflanze', 'Körper', 'Fahrrad', 'Teile benennen'],
			ort: 'aufgabe',
		},
		felder: [
			{ art: 'bild', attribut: 'bild', name: 'Bild' },
			{
				art: 'text',
				attribut: 'alt',
				name: 'Was zeigt das Bild?',
				hilfe: 'Für Vorlesegeräte und wenn das Bild fehlt.',
			},
			{ art: 'punkte', attribut: 'punkte', name: 'Punkte' },
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Darstellung',
				standard: 'linien',
				optionen: [
					{ wert: 'linien', name: 'Linien nach außen' },
					{ wert: 'nummer', name: 'Nummern im Bild' },
				],
			},
			{ art: 'schalter', attribut: 'wortspeicher', name: 'Wortspeicher', an: '1', aus: '0', standard: false },
		],
	},
	'x-schreibrahmen': {
		name: 'Schreibrahmen',
		katalog: {
			kategorie: 'Schreiben',
			suchbegriffe: ['Satzanfänge', 'Schreibhilfe', 'Text schreiben', 'Aufsatz', 'Planung'],
			ort: 'aufgabe',
		},
		felder: [
			{
				art: 'text',
				attribut: 'satzanfaenge',
				name: 'Satzanfänge',
				zeilen: 4,
				beispiel: 'Zuerst; Dann; Am Ende',
				hilfe: '; trennt die Satzanfänge.',
			},
			{ art: 'zahl', attribut: 'linien', name: 'Linien je Satz', min: 1, max: 6, standard: 2 },
			{
				art: 'auswahl',
				attribut: 'lineatur',
				name: 'Lineatur',
				optionen: [
					{ wert: null, name: 'Nach der Klasse' },
					{ wert: '1', name: 'Lineatur 1' },
					{ wert: '2', name: 'Lineatur 2' },
					{ wert: '3', name: 'Lineatur 3' },
					{ wert: '4', name: 'Lineatur 4' },
				],
			},
			{ art: 'text', attribut: 'wortspeicher', name: 'Wortspeicher', hilfe: '; trennt die Wörter.' },
			{ art: 'schalter', attribut: 'planung', name: 'Planung', an: '1', aus: '0', standard: false },
			{
				art: 'text',
				attribut: 'beispiel',
				name: 'Beispieltext',
				zeilen: 3,
				hilfe: 'Steht nur auf dem Lösungsblatt.',
			},
		],
	},
	'x-richtigfalsch': {
		name: 'Richtig oder falsch',
		katalog: { kategorie: 'Schreiben', suchbegriffe: ['Aussagen', 'Stimmt', 'Ja Nein', 'Wahr'], ort: 'aufgabe' },
		felder: [
			{
				art: 'text',
				attribut: 'aussagen',
				name: 'Aussagen',
				zeilen: 5,
				beispiel: 'Hunde bellen: r; Katzen fliegen: f',
				hilfe: 'Aussage: r oder f; ; trennt die Aussagen.',
			},
			{
				art: 'auswahl',
				attribut: 'koepfe',
				name: 'Spaltenköpfe',
				standard: 'richtigfalsch',
				optionen: [
					{ wert: 'richtigfalsch', name: 'richtig / falsch' },
					{ wert: 'janein', name: 'ja / nein' },
					{ wert: 'daumen', name: 'Daumen' },
				],
			},
		],
	},
	'x-gesamtpunkte': {
		name: 'Gesamtpunkte',
		katalog: { kategorie: 'Bewerten', suchbegriffe: ['Punkte', 'Summe', 'Klassenarbeit'], ort: 'aufgabe' },
		felder: [],
	},
	'x-notenschluessel': {
		name: 'Notenschlüssel',
		katalog: { kategorie: 'Bewerten', suchbegriffe: ['Noten', 'Grenzen', 'Klassenarbeit'], ort: 'aufgabe' },
		felder: [
			{
				art: 'text',
				attribut: 'grenzen',
				name: 'Grenzen in Prozent',
				beispiel: NOTEN_VORSCHLAG,
				muster: '(\\s*[1-5]:\\d+\\s*;?){5}\\s*',
				musterHilfe: `Fünf Grenzen von oben nach unten, z. B. ${NOTEN_VORSCHLAG}.`,
				hilfe: 'Leer lassen für den Vorschlag. Deine Grenzen bleiben, bis du sie löschst.',
			},
			{
				art: 'zahl',
				attribut: 'gesamt',
				name: 'Gesamtpunkte',
				min: 0,
				max: 500,
				standard: 0,
				hilfe: '0 heißt: aus den Aufgaben zählen.',
			},
		],
	},
	'x-notenspiegel': {
		name: 'Notenspiegel',
		katalog: {
			kategorie: 'Bewerten',
			suchbegriffe: ['Verteilung', 'Durchschnitt', 'Klassenarbeit'],
			ort: 'aufgabe',
		},
		felder: [],
	},
	'x-unterschrift': {
		name: 'Unterschrift und Datum',
		katalog: { kategorie: 'Bewerten', suchbegriffe: ['Eltern', 'Datumszeile', 'Klassenarbeit'], ort: 'aufgabe' },
		felder: [
			{
				art: 'auswahl',
				attribut: 'felder',
				name: 'Felder',
				standard: 'beides',
				optionen: [
					{ wert: 'beides', name: 'Datum und Unterschrift' },
					{ wert: 'datum', name: 'Nur Datum' },
					{ wert: 'unterschrift', name: 'Nur Unterschrift' },
				],
			},
			{ art: 'text', attribut: 'text', name: 'Beschriftung', beispiel: 'Unterschrift' },
		],
	},
	'x-erwartungshorizont': {
		name: 'Erwartungshorizont',
		katalog: {
			kategorie: 'Bewerten',
			suchbegriffe: ['Lösung', 'Teilpunkte', 'Anforderungsbereich', 'Klassenarbeit'],
			ort: 'seite',
		},
		felder: [],
	},
	'x-silben': {
		name: 'Silben',
		katalog: {
			kategorie: 'Sprache',
			suchbegriffe: ['Silbenbögen', 'Silbe', 'Klatschen', 'Lesen', 'lernen'],
			ort: 'aufgabe',
			faecher: ['deutsch'],
		},
		felder: [
			{
				art: 'text',
				attribut: 'inhalt',
				name: 'Text',
				quelle: 'inhalt',
				zeilen: 4,
				beispiel: 'Die Ro|si|ne ist süß.',
				einfuegen: { zeichen: '|', name: 'Silbenstrich einfügen' },
				hilfe: 'Nach Sprechsilben: A|bend, Was|ser, Zu|cker.',
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Darstellung',
				standard: 'boegen',
				optionen: [
					{ wert: 'boegen', name: 'Bögen' },
					{ wert: 'farbe', name: 'Farben' },
					{ wert: 'beides', name: 'Farben und Bögen' },
				],
			},
			{
				art: 'text',
				attribut: 'farben',
				name: 'Farben der Klasse',
				beispiel: 'blau rot',
				hilfe: 'Zwei aus blau, rot, gruen, lila, braun, schwarz.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'boegen', name: 'Bögen zeichnen' },
					{ wert: 'trennen', name: 'Trennstriche setzen' },
				],
			},
		],
		regeln: (w): Fehler => {
			const wort = w.text('inhalt') ?? '';
			if (wort.includes('||')) {
				return { inhalt: 'Zwei Silbenstriche stehen direkt nebeneinander.' };
			}
			if (/(^|[\s„"'(])\||\|($|[\s.,;:!?“"')])/.test(wort)) {
				return { inhalt: 'Ein Silbenstrich steht am Anfang oder Ende eines Worts.' };
			}
			return /^[\p{L}\s|.,;:!?„“"'()\-–…]*$/u.test(wort)
				? {}
				: { inhalt: 'Erlaubt sind Buchstaben, Satzzeichen, Leerzeichen und der Silbenstrich.' };
		},
	},
	'x-wortarten': {
		name: 'Wortarten',
		katalog: {
			kategorie: 'Sprache',
			suchbegriffe: ['Nomen', 'Verb', 'Adjektiv', 'Montessori', 'Symbole', 'Grammatik'],
			ort: 'aufgabe',
			faecher: ['deutsch'],
		},
		felder: [
			{
				art: 'markierung',
				attribut: 'inhalt',
				name: 'Satz',
				quelle: 'inhalt',
				markeName: 'Wortart',
				beispiel: 'Der Hund bellt laut.',
				optionen: WORTART_OPTIONEN,
				hilfe: 'Wort antippen und die Wortart wählen.',
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Darstellung',
				standard: 'symbole',
				optionen: [
					{ wert: 'symbole', name: 'Symbole' },
					{ wert: 'unterstreichen', name: 'Unterstreichen' },
				],
			},
			{ art: 'mehrfach', attribut: 'nur', name: 'Nur diese zeigen', optionen: WORTART_OPTIONEN, gruppe: 'Mehr' },
			{
				art: 'liste',
				attribut: 'farben',
				name: 'Farben der Klasse',
				gruppe: 'Mehr',
				unter: [
					{ name: 'Wortart', art: 'auswahl', standard: 'N', optionen: WORTART_OPTIONEN },
					{
						name: 'Farbe',
						art: 'auswahl',
						standard: 'blau',
						optionen: [
							'blau',
							'rot',
							'gruen',
							'lila',
							'braun',
							'schwarz',
							'hellblau',
							'rosa',
							'orange',
						].map((f) => ({ wert: f, name: f === 'gruen' ? 'grün' : f })),
					},
				],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'bestimmen', name: 'Wortarten bestimmen' },
				],
			},
		],
		regeln: (w): Fehler => {
			const unbekannt = markierungLesen(w.text('inhalt') ?? '').woerter.find(
				(t) => t.marke !== null && !WORTART_OPTIONEN.some((o) => o.wert === t.marke),
			);
			return unbekannt ? { inhalt: `Das Kürzel „${unbekannt.marke ?? ''}“ gibt es nicht.` } : {};
		},
	},
	'x-satzglieder': {
		name: 'Satzglieder',
		katalog: {
			kategorie: 'Sprache',
			suchbegriffe: ['Subjekt', 'Prädikat', 'Objekt', 'Satzbau', 'Umstellprobe'],
			ort: 'aufgabe',
			faecher: ['deutsch'],
		},
		felder: [
			{
				art: 'markierung',
				attribut: 'inhalt',
				name: 'Satz',
				quelle: 'inhalt',
				markeName: 'Satzglied',
				gruppen: true,
				beispiel: 'Der Hund bellt den Briefträger an.',
				optionen: ROLLEN_OPTIONEN,
				hilfe: 'Wort antippen, Nachbarn verbinden und das Satzglied wählen.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'bestimmen', name: 'Satzglieder bestimmen' },
					{ wert: 'umstellen', name: 'Satz umstellen' },
					{ wert: 'fragen', name: 'Fragen stellen' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'vorn',
				name: 'Beim Umstellen nach vorn',
				gruppe: 'Mehr',
				optionen: [
					{ wert: null, name: 'Nächstes Satzglied' },
					...ROLLEN_OPTIONEN.filter((o) => o.wert !== 'P'),
				],
			},
			{
				art: 'schalter',
				attribut: 'ausschneiden',
				name: 'Satzstreifen zum Ausschneiden',
				an: 'ja',
				aus: 'nein',
				standard: false,
				gruppe: 'Mehr',
			},
		],
		regeln: (w): Fehler => {
			const wert = w.text('inhalt');
			if (wert === null) {
				return {};
			}
			const zaehler = [...wert].filter((z) => z === '[').length;
			if (zaehler !== [...wert].filter((z) => z === ']').length) {
				return { inhalt: 'Eine eckige Klammer ist nicht geschlossen.' };
			}
			const { woerter } = markierungLesen(wert, true);
			const unbekannt = woerter.find((t) => t.marke !== null && !ROLLEN_OPTIONEN.some((o) => o.wert === t.marke));
			if (unbekannt) {
				return { inhalt: `Das Satzglied „${unbekannt.marke ?? ''}“ gibt es nicht.` };
			}
			return woerter.some((t) => t.marke === 'P') ? {} : { inhalt: 'Jeder Satz braucht ein Prädikat.' };
		},
	},
	'x-wortbausteine': {
		name: 'Wortbausteine',
		katalog: {
			kategorie: 'Sprache',
			suchbegriffe: ['Wortfamilie', 'Stamm', 'Vorsilbe', 'Endung', 'Morphem'],
			ort: 'aufgabe',
			faecher: ['deutsch'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'wort',
				optionen: [
					{ wert: 'wort', name: 'Ein Wort zerlegt' },
					{ wert: 'familie', name: 'Wortfamilie' },
				],
			},
			{
				art: 'text',
				attribut: 'inhalt',
				name: 'Bausteine',
				quelle: 'inhalt',
				beispiel: 'ver|fahr|en',
				einfuegen: { zeichen: '|', name: 'Trennstrich einfügen' },
				hilfe: 'Bei einer Wortfamilie nur der Stamm.',
			},
			{
				art: 'auswahl',
				attribut: 'stamm',
				name: 'Stamm',
				optionen: [{ wert: null, name: 'Nicht hervorheben' }],
				optionenAus: 'inhalt',
			},
			{
				art: 'liste',
				attribut: 'woerter',
				name: 'Wörter der Familie',
				max: 8,
				unter: [{ name: 'Wort', art: 'text', standard: 'Wort' }],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'zerlegen', name: 'Wort zerlegen' },
					{ wert: 'zusammensetzen', name: 'Wort zusammensetzen' },
					{ wert: 'familie', name: 'Wortfamilie finden' },
				],
			},
		],
		regeln: (w): Fehler => {
			const wort = w.text('inhalt') ?? '';
			const familie = w.text('art') === 'familie';
			const teile = wort.split('|').map((t) => t.trim());
			const stamm = w.text('stamm');
			const aufgabe = w.text('aufgabe');
			if (wort !== '' && teile.some((t) => !/^[\p{L}-]+$/u.test(t))) {
				return { inhalt: 'Bausteine bestehen aus Buchstaben, dazwischen je ein Strich.' };
			}
			if (stamm !== null && !teile.some((t) => t.toLowerCase() === stamm.toLowerCase())) {
				return { stamm: `Der Stamm „${stamm}“ ist keiner der Bausteine.` };
			}
			if (familie && teile.length > 1) {
				return { inhalt: 'Bei einer Wortfamilie steht in der Mitte nur der Stamm.' };
			}
			if (familie && w.zeilen('woerter').length === 0) {
				return { woerter: 'Eine Wortfamilie braucht Wörter.' };
			}
			const passt = familie ? aufgabe !== 'zerlegen' && aufgabe !== 'zusammensetzen' : aufgabe !== 'familie';
			return passt ? {} : { aufgabe: 'Diese Aufgabe passt nicht zur Art.' };
		},
	},
	'x-zeitleiste': {
		name: 'Zeitleiste',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Zeitstrahl', 'Geschichte', 'Jahre', 'Ablauf'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'jahre',
				optionen: [
					{ wert: 'jahre', name: 'Jahreszahlen' },
					{ wert: 'leben', name: 'Lebensjahre' },
				],
			},
			{ art: 'zahl', attribut: 'von', name: 'Von', min: -5000, max: 2100, standard: 1900 },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: -5000, max: 2100, standard: 2020 },
			{
				art: 'zahl',
				attribut: 'schritt',
				name: 'Markierung alle',
				min: 1,
				max: 1000,
				standard: 10,
				einheit: 'Jahre',
			},
			{
				art: 'liste',
				attribut: 'ereignisse',
				name: 'Ereignisse',
				hilfe: 'Jahr oder Zeitraum: 1914 oder 1900-1914, vor Christus mit Minus: -500.',
				unter: [
					{ name: 'Jahr', art: 'text', standard: '2000' },
					{ name: 'Ereignis', art: 'text', standard: 'Ereignis' },
					{ name: 'Kinder tragen ein', art: 'schalter', an: 'offen', leer: true },
				],
			},
			{
				art: 'schalter',
				attribut: 'ereignisliste',
				name: 'Offene Ereignisse als Liste',
				an: 'ja',
				aus: 'nein',
				standard: true,
				gruppe: 'Mehr',
			},
			{
				art: 'zahl',
				attribut: 'breite',
				name: 'Breite',
				min: 200,
				max: 1600,
				standard: 620,
				einheit: 'px',
				gruppe: 'Mehr',
			},
		],
		regeln: (w): Fehler => {
			const leben = w.text('art') === 'leben';
			const von = w.zahl('von');
			const bis = w.zahl('bis');
			if (von >= bis) {
				return { bis: 'Das Ende liegt nach dem Anfang.' };
			}
			for (const zeile of w.zeilen('ereignisse')) {
				const m = /^(-?\d+)(?:-(-?\d+))?$/.exec((zeile[0] ?? '').trim());
				if (!m) {
					return { ereignisse: `„${zeile[0] ?? ''}“ ist kein Jahr und kein Zeitraum.` };
				}
				const jahre = [m[1], m[2]].filter((j) => j !== undefined).map(Number);
				if (!leben && jahre.includes(0)) {
					return { ereignisse: 'Ein Jahr 0 gibt es nicht.' };
				}
				if (jahre.some((j) => j < von || j > bis)) {
					return { ereignisse: `${zeile[0] ?? ''} liegt außerhalb der Leiste.` };
				}
			}
			return {};
		},
	},
	'x-jahreskreis': {
		name: 'Jahreskreis',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Jahreszeiten', 'Monate', 'Jahreslauf', 'Feste'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'jahr',
				optionen: [
					{ wert: 'jahr', name: 'Jahreskreis' },
					{ wert: 'woche', name: 'Woche' },
					{ wert: 'tag', name: 'Tageskreis: vier Tageszeiten' },
					{ wert: 'stunden', name: 'Tageskreis: 24 Stunden' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'beschriftung',
				name: 'Beschriftung',
				standard: 'voll',
				optionen: [
					{ wert: 'voll', name: 'Beschriftet' },
					{ wert: 'leer', name: 'Leer, Kinder tragen ein' },
				],
			},
			{ art: 'schalter', attribut: 'jahreszeiten', name: 'Jahreszeiten', an: 'ja', aus: 'nein', standard: false },
			{
				art: 'mehrfach',
				attribut: 'markiert',
				name: 'Markiert',
				optionen: [],
				optionenJe: { feld: 'art', werte: KREIS_OPTIONEN },
				gruppe: 'Mehr',
			},
			{
				art: 'zahl',
				attribut: 'groesse',
				name: 'Größe',
				min: 200,
				max: 1200,
				standard: 320,
				einheit: 'px',
				gruppe: 'Mehr',
			},
		],
		regeln: (w): Fehler => {
			const art = w.text('art') ?? 'jahr';
			if (w.text('jahreszeiten') === 'ja' && art !== 'jahr') {
				return { jahreszeiten: 'Jahreszeiten gibt es nur beim Jahreskreis.' };
			}
			const erlaubt = KREIS_OPTIONEN[art] ?? [];
			const falsch = w.liste('markiert').find((m) => !erlaubt.some((o) => o.wert === m));
			return falsch ? { markiert: `„${falsch}“ gehört nicht zu diesem Kreis.` } : {};
		},
	},
	'x-windrose': {
		name: 'Windrose',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Himmelsrichtungen', 'Norden', 'Kompass', 'Karte'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'richtungen',
				name: 'Richtungen',
				standard: '4',
				optionen: [
					{ wert: '4', name: '4 Richtungen' },
					{ wert: '8', name: '8 Richtungen' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'beschriftung',
				name: 'Beschriftung',
				standard: 'voll',
				optionen: [
					{ wert: 'voll', name: 'Alle Richtungen' },
					{ wert: 'norden', name: 'Nur Norden' },
					{ wert: 'leer', name: 'Leer, Kinder tragen ein' },
				],
			},
			{ art: 'zahl', attribut: 'groesse', name: 'Größe', min: 120, max: 600, standard: 170, einheit: 'px' },
		],
	},
	'x-schaltplan': {
		name: 'Stromkreis',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Schaltung', 'Batterie', 'Lampe', 'Strom', 'Stromkreis'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'liste',
				attribut: 'teile',
				name: 'Teile im Kreis',
				unter: [{ name: 'Teil', art: 'auswahl', optionen: STROM_TEILE, standard: 'lampe' }],
				zeilenTrenner: ' ',
				min: 1,
				max: 6,
			},
			{
				art: 'liste',
				attribut: 'zweig',
				name: 'Zweiter Zweig',
				hilfe: 'Liegt parallel zu allen Teilen außer der Batterie.',
				unter: [
					{
						name: 'Teil',
						art: 'auswahl',
						optionen: STROM_TEILE.filter((o) => o.wert !== 'batterie'),
						standard: 'kabel',
					},
				],
				zeilenTrenner: ' ',
				max: 5,
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Darstellung',
				standard: 'symbole',
				optionen: [
					{ wert: 'symbole', name: 'Schaltzeichen' },
					{ wert: 'bild', name: 'Bildhaft' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'leuchtet', name: 'Leuchtet die Lampe?' },
					{ wert: 'vervollstaendigen', name: 'Kabel ergänzen' },
					{ wert: 'benennen', name: 'Teile benennen' },
				],
			},
		],
		regeln: (w): Fehler =>
			w.zeilen('teile').some((z) => z[0] === 'batterie') ? {} : { teile: 'Im Kreis fehlt die Batterie.' },
	},
	'x-kreislauf': {
		name: 'Kreislauf',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Wasserkreislauf', 'Zyklus', 'Lebenskreislauf', 'Pfeile'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Form',
				standard: 'kreis',
				optionen: [
					{ wert: 'kreis', name: 'Kreis' },
					{ wert: 'ablauf', name: 'Ablauf' },
				],
			},
			{
				art: 'liste',
				attribut: 'stationen',
				name: 'Stationen',
				unter: [
					{ name: 'Text', art: 'text', standard: 'Neu' },
					{ name: 'Bild', art: 'bild', leer: true },
				],
				min: 3,
				max: 8,
			},
			{
				art: 'text',
				attribut: 'pfeile',
				name: 'Pfeile',
				beispiel: 'verdunsten; aufsteigen; regnen',
				hilfe: 'Beschriftung je Pfeil, mit Semikolon getrennt.',
			},
			{
				art: 'text',
				attribut: 'offen',
				name: 'Offen zum Eintragen',
				beispiel: '3 p2',
				muster: '\\s*(p?\\d+\\s*)*',
				musterHilfe: 'Nummern der Stationen, p und Nummer für einen Pfeil, z. B. 3 p2.',
			},
		],
	},
	'x-verkehrszeichen': {
		name: 'Verkehrszeichen',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Verkehr', 'Schild', 'Radfahren', 'Straße'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'nummer',
				name: 'Zeichen',
				standard: '205',
				optionen: VERKEHRSZEICHEN,
				vorschau: 'bilder/verkehrszeichen/{wert}.svg',
			},
			{ art: 'zahl', ...GROESSE, min: 40, max: 300, standard: 90, schritt: 10 },
			{
				art: 'schalter',
				attribut: 'ausmalen',
				name: 'Nur Umriss zum Ausmalen',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
		],
	},
	'x-wetter': {
		name: 'Wettersymbol',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Wetter', 'Sonne', 'Regen', 'Wolken', 'Wetterbogen'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'symbol',
				name: 'Symbol',
				optionen: [{ wert: null, name: 'Keins' }, ...WETTER],
			},
			{
				art: 'auswahl',
				attribut: 'loesung',
				name: 'Symbol erst in der Lösung',
				optionen: [{ wert: null, name: 'Keins' }, ...WETTER],
			},
			{ art: 'zahl', attribut: 'wind', name: 'Wind (Striche)', min: 0, max: 3, standard: 0 },
			{ art: 'zahl', ...GROESSE, min: 24, max: 200, standard: 60, schritt: 4 },
		],
		regeln: (w): Fehler => (w.text('symbol') || w.text('loesung') ? {} : { symbol: 'Bitte ein Symbol wählen.' }),
	},
	'x-suchsel': {
		name: 'Suchsel',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Wörtersuche', 'Buchstabengitter', 'Wortsuchrätsel', 'Suchrätsel'],
			ort: 'aufgabe',
		},
		felder: [
			{ art: 'mischen', attribut: 'seed', name: 'Gitter' },
			{
				art: 'liste',
				attribut: 'woerter',
				name: 'Wörter',
				hilfe: 'Nur Buchstaben. Das Bild braucht nur die Wortliste „Bilder“.',
				unter: [
					{ name: 'Wort', art: 'text', standard: 'Wort' },
					{ name: 'Bild', art: 'mini', leer: true },
				],
				feldTrenner: ': ',
				min: 2,
				max: 20,
			},
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 5, max: 20, standard: 10 },
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 5, max: 20, standard: 10 },
			{
				art: 'mehrfach',
				attribut: 'richtungen',
				name: 'Richtungen',
				hilfe: 'Ohne Haken gilt der Standard der Klasse.',
				optionen: [
					{ wert: 'rechts', name: 'Nach rechts' },
					{ wert: 'runter', name: 'Nach unten' },
					{ wert: 'diagonal', name: 'Schräg' },
					{ wert: 'rueckwaerts', name: 'Rückwärts' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'buchstaben',
				name: 'Buchstaben',
				optionen: [
					{ wert: null, name: 'Nach Klasse' },
					{ wert: 'gross', name: 'Großbuchstaben' },
					{ wert: 'wie-geschrieben', name: 'Wie geschrieben' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'wortliste',
				name: 'Wortliste',
				standard: 'text',
				optionen: [
					{ wert: 'text', name: 'Text' },
					{ wert: 'bilder', name: 'Bilder' },
					{ wert: 'keine', name: 'Keine' },
				],
			},
		],
		regeln: (w): Fehler => {
			const breite = Math.max(w.zahl('spalten'), w.zahl('zeilen'));
			for (const [wort = ''] of w.zeilen('woerter')) {
				if (!NUR_BUCHSTABEN.test(wort)) {
					return { woerter: `„${wort}“ darf nur aus Buchstaben bestehen.` };
				}
				if ([...wort].length > breite) {
					return { woerter: `„${wort}“ ist länger als das Gitter.` };
				}
			}
			return {};
		},
	},
	'x-kreuzwort': {
		name: 'Kreuzworträtsel',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Kreuzworträtsel', 'Rätsel', 'Wörter'],
			ort: 'aufgabe',
		},
		felder: [
			{ art: 'mischen', attribut: 'seed', name: 'Gitter' },
			{
				art: 'liste',
				attribut: 'eintraege',
				name: 'Einträge',
				hilfe: 'Hinweis als Text oder Bild, dazu das Wort. Höchstens 12.',
				unter: [
					{ name: 'Hinweis', art: 'mini', standard: 'Hinweis' },
					{ name: 'Wort', art: 'text', standard: 'Wort' },
				],
				feldTrenner: ': ',
				min: 2,
				max: 12,
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'kreuz',
				optionen: [
					{ wert: 'kreuz', name: 'Frei gekreuzt' },
					{ wert: 'senkrecht', name: 'Lösungswort senkrecht' },
				],
			},
			{ art: 'text', attribut: 'loesungswort', name: 'Lösungswort' },
		],
		regeln: (w): Fehler => {
			for (const [, wort = ''] of w.zeilen('eintraege')) {
				if (!NUR_BUCHSTABEN.test(wort)) {
					return { eintraege: `„${wort}“ darf nur aus Buchstaben bestehen.` };
				}
			}
			const geheim = w.text('loesungswort');
			if (geheim && !NUR_BUCHSTABEN.test(geheim)) {
				return { loesungswort: 'Das Lösungswort darf nur aus Buchstaben bestehen.' };
			}
			return w.text('art') === 'senkrecht' && !geheim ? { loesungswort: 'Hier fehlt das Lösungswort.' } : {};
		},
	},
	'x-loesungswort': {
		name: 'Lösungswort',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Lösungswort', 'Selbstkontrolle', 'Geheimwort'],
			ort: 'aufgabe',
		},
		felder: [
			{ art: 'text', attribut: 'wort', name: 'Wort', beispiel: 'SONNE' },
			{
				art: 'text',
				attribut: 'bezug',
				name: 'Aufgabe',
				hilfe: 'Nummer der Aufgabe, deren Lösungen die Buchstaben liefern.',
			},
			{
				art: 'liste',
				attribut: 'zuordnung',
				name: 'Legende',
				hilfe: 'Jedes richtige Ergebnis mit seinem Buchstaben.',
				unter: [
					{ name: 'Ergebnis', art: 'text', standard: '1' },
					{ name: 'Buchstabe', art: 'text', standard: 'A' },
				],
				feldTrenner: ': ',
				min: 0,
				max: 26,
			},
			{
				art: 'liste',
				attribut: 'ablenker',
				name: 'Ablenker',
				hilfe: 'Typische falsche Ergebnisse mit eigenem Buchstaben.',
				unter: [
					{ name: 'Ergebnis', art: 'text', standard: '1' },
					{ name: 'Buchstabe', art: 'text', standard: 'X' },
				],
				feldTrenner: ': ',
				min: 0,
				max: 10,
			},
		],
		regeln: (w): Fehler =>
			NUR_BUCHSTABEN.test(w.text('wort') ?? '') ? {} : { wort: 'Das Wort darf nur aus Buchstaben bestehen.' },
	},
	'x-bingo': {
		name: 'Bingo',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Bingo', 'Spiel', 'Karten', 'Rufliste'],
			ort: 'seite',
		},
		felder: [
			{ art: 'mischen', attribut: 'seed', name: 'Karten' },
			{
				art: 'liste',
				attribut: 'eintraege',
				name: 'Einträge',
				hilfe: 'Ruf und Feld, zum Beispiel 7·8 und 56. Nötig sind Felder × Felder + 4 Einträge.',
				unter: [
					{ name: 'Ruf', art: 'text', standard: 'Neu' },
					{ name: 'Feld', art: 'mini', leer: true },
				],
				feldTrenner: ': ',
				min: 8,
				max: 60,
			},
			{ art: 'zahl', attribut: 'felder', name: 'Felder je Reihe', min: 3, max: 5, standard: 4 },
			{ art: 'zahl', attribut: 'karten', name: 'Karten', min: 1, max: 40, standard: 4 },
			{
				art: 'auswahl',
				attribut: 'je-seite',
				name: 'Karten je Seite',
				standard: '2',
				optionen: [
					{ wert: '1', name: '1' },
					{ wert: '2', name: '2' },
					{ wert: '4', name: '4' },
				],
			},
			{ art: 'schalter', attribut: 'frei', name: 'Joker in der Mitte', an: 'ja', aus: 'nein', standard: false },
			{ art: 'schalter', attribut: 'rufliste', name: 'Rufliste', an: 'ja', aus: 'nein', standard: true },
		],
		regeln: (w): Fehler => {
			const seite = w.zahl('felder');
			const noetig = seite * seite - (w.text('frei') === 'ja' && seite % 2 === 1 ? 1 : 0) + 4;
			const anzahl = w.zeilen('eintraege').length;
			return anzahl < noetig
				? { eintraege: `Das sind ${anzahl} Einträge; für verschiedene Karten braucht es mindestens ${noetig}.` }
				: {};
		},
	},
	'x-domino': {
		name: 'Domino',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Domino', 'Spiel', 'Kette', 'Steine', 'Klammerkarten'],
			ort: 'seite',
		},
		felder: [
			{ art: 'mischen', attribut: 'seed', name: 'Lage der Steine' },
			{
				art: 'liste',
				attribut: 'paare',
				name: 'Paare',
				unter: [
					{ name: 'Aufgabe', art: 'mini', standard: 'Neu' },
					{ name: 'Lösung', art: 'mini', standard: 'Neu' },
				],
				feldTrenner: ': ',
				min: 12,
				max: 24,
			},
			{
				art: 'auswahl',
				attribut: 'kette',
				name: 'Kette',
				standard: 'geschlossen',
				optionen: [
					{ wert: 'geschlossen', name: 'Geschlossen' },
					{ wert: 'offen', name: 'Offen, mit Start und Ende' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'je-seite',
				name: 'Steine je Seite',
				standard: '12',
				optionen: ['8', '10', '12', '14', '16'].map((wert) => ({ wert, name: wert })),
			},
			{
				art: 'schalter',
				attribut: 'rueckseite',
				name: 'Nummer auf dem Stein',
				an: 'nummer',
				aus: 'nein',
				standard: false,
			},
		],
		regeln: (w): Fehler => {
			const zeilen = w.zeilen('paare');
			const aufgaben = zeilen.map((z) => z[0] ?? '');
			const loesungen = zeilen.map((z) => z[1] ?? '');
			const doppelt = loesungen.find((l, i) => loesungen.indexOf(l) !== i);
			if (doppelt) {
				return { paare: `Die Lösung „${doppelt}“ kommt zweimal vor. Dann ist die Kette nicht eindeutig.` };
			}
			const auchAufgabe = loesungen.find((l) => aufgaben.includes(l));
			return auchAufgabe
				? { paare: `„${auchAufgabe}“ ist zugleich Lösung und Aufgabe. Dann ist die Kette nicht eindeutig.` }
				: {};
		},
	},
	'x-spielplan': {
		name: 'Spielplan',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Brettspiel', 'Würfelspiel', 'Leiterspiel', 'Laufspiel', 'Spielfeld'],
			ort: 'seite',
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'spiel',
				optionen: [
					{ wert: 'spiel', name: 'Spielplan' },
					{ wert: 'lernlandkarte', name: 'Lernlandkarte' },
				],
			},
			{ art: 'zahl', attribut: 'felder', name: 'Felder', min: 20, max: 40, standard: 30 },
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Form',
				standard: 'schlange',
				optionen: [
					{ wert: 'schlange', name: 'Schlange' },
					{ wert: 'spirale', name: 'Spirale' },
					{ wert: 'rundweg', name: 'Rundweg' },
					{ wert: 'leiter', name: 'Leiterspiel' },
				],
			},
			{
				art: 'liste',
				attribut: 'inhalt',
				name: 'Inhalt je Feld',
				hilfe: 'Text, Aufgabe oder Sonderfeld: ?, ★, +3, −2. Eine leere Zeile lässt das Feld frei.',
				unter: [{ name: 'Inhalt', art: 'mini', leer: true }],
				max: 40,
			},
			{
				art: 'liste',
				attribut: 'leitern',
				name: 'Leitern und Rutschen',
				hilfe: 'Von Feld, bis Feld. Führt der Weg zurück, ist es eine Rutsche.',
				unter: [
					{ name: 'Von', art: 'zahl', min: 1, max: 40, standard: '2' },
					{ name: 'Bis', art: 'zahl', min: 1, max: 40, standard: '9' },
				],
				feldTrenner: '-',
			},
			{ art: 'text', attribut: 'start', name: 'Start' },
			{ art: 'text', attribut: 'ziel', name: 'Ziel' },
			{
				art: 'liste',
				attribut: 'loesungen',
				name: 'Kontrollkarte',
				unter: [
					{ name: 'Feld', art: 'zahl', min: 1, max: 40, standard: '2' },
					{ name: 'Lösung', art: 'text', standard: 'Neu' },
				],
				feldTrenner: ': ',
			},
		],
	},
	'x-rhythmus': {
		name: 'Rhythmus',
		katalog: {
			kategorie: 'Musik',
			suchbegriffe: ['Takt', 'Klatschen', 'Notenwerte', 'Rhythmuskarten'],
			ort: 'aufgabe',
			faecher: ['musik'],
		},
		felder: [
			{ art: 'auswahl', attribut: 'takt', name: 'Takt', standard: '4/4', optionen: NOTEN_TAKTARTEN },
			{ art: 'noten', attribut: 'noten', name: 'Noten', tonhoehe: false },
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'zeile',
				optionen: [
					{ wert: 'zeile', name: 'Zeile mit mehreren Takten' },
					{ wert: 'karte', name: 'Karte mit einem Takt' },
					{ wert: 'grafisch', name: 'Grafisch: Strich und Punkt' },
				],
			},
			{
				art: 'text',
				attribut: 'silben',
				name: 'Silben',
				beispiel: 'ta',
				hilfe: '„keine“, „ta“ für ta, ti-ti, ta-a oder die Silben der Klasse, mit Leerzeichen getrennt.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'silben', name: 'Silben schreiben' },
					{ wert: 'noten', name: 'Noten schreiben' },
					{ wert: 'ergaenzen', name: 'Note ergänzen' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'offen',
				name: 'Fehlende Noten',
				beispiel: '5',
				hilfe: 'Nummern der Noten zum Ergänzen; ohne Angabe die letzte.',
			},
			{ art: 'schalter', attribut: 'linie', name: 'Rhythmuslinie', an: 'ja', aus: 'nein', standard: false },
			{ art: 'schalter', attribut: 'auftakt', name: 'Mit Auftakt', an: 'ja', aus: 'nein', standard: false },
			{ art: 'zahl', attribut: 'breite', name: 'Breite', min: 120, max: 620, standard: 620, einheit: 'px' },
		],
	},
	'x-noten': {
		name: 'Noten',
		katalog: {
			kategorie: 'Musik',
			suchbegriffe: ['Notenzeile', 'Notensystem', 'Melodie', 'Violinschlüssel', 'Lied'],
			ort: 'aufgabe',
			faecher: ['musik'],
		},
		felder: [
			{ art: 'auswahl', attribut: 'takt', name: 'Takt', standard: '4/4', optionen: NOTEN_TAKTARTEN },
			{ art: 'noten', attribut: 'noten', name: 'Noten', tonhoehe: true },
			{ art: 'schalter', attribut: 'namen', name: 'Notennamen darunter', an: 'ja', aus: 'nein', standard: false },
			{
				art: 'text',
				attribut: 'text',
				name: 'Liedtext',
				beispiel: 'Al le mei ne Ent chen',
				hilfe: 'Silben mit Leerzeichen getrennt, eine je Note.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'benennen', name: 'Noten benennen' },
					{ wert: 'zeichnen', name: 'Noten zeichnen' },
				],
			},
			{ art: 'zahl', attribut: 'systeme', name: 'Leere Notenzeilen', min: 0, max: 8, standard: 0 },
			{
				art: 'auswahl',
				attribut: 'vorzeichen',
				name: 'Vorzeichen',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'b', name: 'Ein b (F-Dur)' },
					{ wert: 'kreuz', name: 'Ein Kreuz (G-Dur)' },
				],
			},
			{ art: 'schalter', attribut: 'auftakt', name: 'Mit Auftakt', an: 'ja', aus: 'nein', standard: false },
			{ art: 'zahl', attribut: 'breite', name: 'Breite', min: 200, max: 620, standard: 620, einheit: 'px' },
		],
	},
	'x-plan': {
		name: 'Plan',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Lageplan', 'Ortsplan', 'Karte', 'Klassenzimmer', 'Wegbeschreibung'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'ort',
				optionen: [
					{ wert: 'ort', name: 'Ortsplan' },
					{ wert: 'raum', name: 'Raumplan' },
				],
			},
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 26, standard: 6 },
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 30, standard: 5 },
			{
				art: 'plan',
				attribut: 'boden',
				objekte: 'objekte',
				name: 'Plan',
				hilfe: 'Kästchen antippen, dann Fläche und Symbol wählen. Die Legende entsteht von selbst.',
				flaechen: PLAN_FLAECHEN,
				symbole: PLAN_SYMBOLE,
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'finden', name: 'Planquadrate finden' },
					{ wert: 'einzeichnen', name: 'Symbole einzeichnen' },
					{ wert: 'weg', name: 'Weg einzeichnen' },
				],
			},
			{
				art: 'text',
				attribut: 'weg',
				name: 'Weg',
				beispiel: 'A1 A2 B2',
				hilfe: 'Planquadrate von Start bis Ziel.',
			},
			{
				art: 'schalter',
				attribut: 'planquadrate',
				name: 'Planquadrate',
				an: 'ja',
				aus: 'nein',
				standard: true,
				gruppe: 'Mehr',
			},
			{
				art: 'schalter',
				attribut: 'legende',
				name: 'Legende',
				an: 'ja',
				aus: 'nein',
				standard: true,
				gruppe: 'Mehr',
			},
			{
				art: 'schalter',
				attribut: 'nordpfeil',
				name: 'Nordpfeil',
				an: 'ja',
				aus: 'nein',
				standard: false,
				gruppe: 'Mehr',
			},
			{ art: 'text', attribut: 'massstab', name: 'Maßstab', beispiel: '1 Kästchen = 100 m', gruppe: 'Mehr' },
			{
				art: 'zahl',
				attribut: 'kaestchen',
				name: 'Kästchen',
				min: 0.8,
				max: 3,
				standard: 1.2,
				schritt: 0.1,
				einheit: 'cm',
				gruppe: 'Mehr',
			},
		],
		regeln: (w): Fehler => {
			const spalten = w.zahl('spalten');
			const zeilen = w.zahl('zeilen');
			if (spalten * w.zahl('kaestchen') * (96 / 2.54) + 26 > 620) {
				return { spalten: 'Der Plan ist zu breit für die Seite. Nimm weniger Spalten.' };
			}
			const symbole = PLAN_SYMBOLE[w.text('art') ?? 'ort'] ?? [];
			const objekte = planObjekteVon(w.text('objekte'));
			const falsch = [...objekte.values()].find((name) => !symbole.some((o) => o.wert === name));
			if (falsch) {
				return { boden: `Das Symbol „${falsch}“ gibt es hier nicht.` };
			}
			const draussen = [...objekte.keys()].find((q) => planLage(q, spalten, zeilen) === null);
			if (draussen) {
				return { boden: `Das Planquadrat ${draussen} liegt außerhalb des Plans.` };
			}
			const weg = (w.text('weg') ?? '').split(/\s+/).filter(Boolean);
			if (w.text('aufgabe') !== 'weg') {
				return {};
			}
			const lagen = weg.map((q) => planLage(q, spalten, zeilen));
			if (weg.length < 2 || lagen.some((l) => l === null)) {
				return { weg: 'Ein Weg hat mindestens zwei Planquadrate im Plan.' };
			}
			const nebeneinander = lagen.every((l, i) => {
				const v = lagen[i - 1];
				return !v || !l || Math.abs(l.x - v.x) + Math.abs(l.y - v.y) === 1;
			});
			return nebeneinander ? {} : { weg: 'Die Planquadrate des Wegs liegen nebeneinander.' };
		},
	},
	'x-geld': {
		name: 'Geld',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Euro', 'Cent', 'Münzen', 'Scheine', 'Rechengeld'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'liste',
				attribut: 'stuecke',
				name: 'Stücke',
				zeilenTrenner: ' ',
				unter: [
					{
						name: 'Stück',
						art: 'auswahl',
						standard: '1€',
						optionen: [
							{ wert: '1ct', name: '1 ct' },
							{ wert: '2ct', name: '2 ct' },
							{ wert: '5ct', name: '5 ct' },
							{ wert: '10ct', name: '10 ct' },
							{ wert: '20ct', name: '20 ct' },
							{ wert: '50ct', name: '50 ct' },
							{ wert: '1€', name: '1 €' },
							{ wert: '2€', name: '2 €' },
							{ wert: '5€', name: '5 €' },
							{ wert: '10€', name: '10 €' },
							{ wert: '20€', name: '20 €' },
							{ wert: '50€', name: '50 €' },
							{ wert: '100€', name: '100 €' },
							{ wert: '200€', name: '200 €' },
						],
					},
				],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'betrag', name: 'Betrag bestimmen' },
					{ wert: 'legen', name: 'Betrag legen' },
				],
			},
			{
				art: 'text',
				attribut: 'betrag',
				name: 'Betrag zum Legen',
				beispiel: '3,45',
				muster: '\\d+([.,]\\d{1,2})?',
				musterHilfe: 'Ein Betrag wie 3,45.',
			},
			{
				art: 'auswahl',
				attribut: 'anordnung',
				name: 'Anordnung',
				standard: 'reihe',
				optionen: [
					{ wert: 'reihe', name: 'In einer Reihe' },
					{ wert: 'gruppiert', name: 'Nach Wert sortiert' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'seite',
				name: 'Münzseite',
				standard: 'wert',
				optionen: [
					{ wert: 'wert', name: 'Wertseite' },
					{ wert: 'rueck', name: 'Rückseite' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'massstab',
				name: 'Größe',
				standard: '0.5',
				hilfe: 'Scheine bleiben immer höchstens 75 % groß.',
				optionen: [
					{ wert: '0.3', name: 'Klein' },
					{ wert: '0.5', name: 'Halb so groß' },
					{ wert: '0.75', name: 'Dreiviertel' },
					{ wert: 'original', name: 'Originalgröße' },
				],
			},
		],
		regeln: (w): Fehler =>
			w.text('aufgabe') === 'legen' && !w.text('betrag') ? { betrag: 'Welcher Betrag soll gelegt werden?' } : {},
	},
	'x-skala': {
		name: 'Messgerät',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Lineal', 'Messbecher', 'Thermometer', 'Waage', 'Maßband', 'Messen'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Gerät',
				standard: 'lineal',
				optionen: [
					{ wert: 'lineal', name: 'Lineal' },
					{ wert: 'massband', name: 'Maßband' },
					{ wert: 'messbecher', name: 'Messbecher' },
					{ wert: 'thermometer', name: 'Thermometer' },
					{ wert: 'waage', name: 'Waage' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'einheit',
				name: 'Einheit',
				hilfe: 'Lineal: cm, mm; Maßband: cm, m; Messbecher: ml, l; Thermometer: °C; Waage: g, kg.',
				optionen: [
					{ wert: null, name: 'Passend zum Gerät' },
					{ wert: 'cm', name: 'cm' },
					{ wert: 'mm', name: 'mm' },
					{ wert: 'm', name: 'm' },
					{ wert: 'ml', name: 'ml' },
					{ wert: 'l', name: 'l' },
					{ wert: '°C', name: '°C' },
					{ wert: 'g', name: 'g' },
					{ wert: 'kg', name: 'kg' },
				],
			},
			{
				art: 'text',
				attribut: 'wert',
				name: 'Wert',
				beispiel: '7',
				muster: '-?\\d+([.,]\\d+)?',
				musterHilfe: 'Eine Zahl wie 7 oder 2,5.',
				loesung: { attribut: 'loesung', name: 'Wert nur in der Lösung' },
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				optionen: [
					{ wert: null, name: 'Nur zeigen' },
					{ wert: 'ablesen', name: 'Ablesen' },
					{ wert: 'einzeichnen', name: 'Einzeichnen' },
				],
			},
			{ art: 'zahlen', attribut: 'teilung', name: 'Striche: Haupt, Zwischen', beispiel: '10 1', gruppe: 'Skala' },
			{
				art: 'zahl',
				attribut: 'von',
				name: 'Von',
				min: -50,
				max: 10000,
				standard: 0,
				standardJe: (w) => skalaStandard(w)[0],
				gruppe: 'Skala',
			},
			{
				art: 'zahl',
				attribut: 'bis',
				name: 'Bis',
				min: -50,
				max: 100000,
				standard: 15,
				standardJe: (w) => skalaStandard(w)[1],
				gruppe: 'Skala',
			},
			{
				art: 'auswahl',
				attribut: 'massstab',
				name: 'Lineal',
				gruppe: 'Skala',
				optionen: [
					{ wert: null, name: 'Originalgröße' },
					{ wert: 'nein', name: 'Verkleinert, nicht zum Messen' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 120, max: 600, standard: 240, schritt: 20, gruppe: 'Skala' },
		],
	},
	'x-strecke': {
		name: 'Strecke',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Länge', 'Zentimeter', 'Messen', 'Linie'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'text',
				attribut: 'laenge',
				name: 'Länge',
				beispiel: '7 cm',
				muster: '\\d+([.,]\\d+)? ?(cm|mm)?',
				musterHilfe: 'Zum Beispiel 7 cm oder 45 mm.',
			},
			{ art: 'text', attribut: 'beschriftung', name: 'Buchstaben an den Enden', beispiel: 'A B' },
			{
				art: 'auswahl',
				attribut: 'richtung',
				name: 'Richtung',
				standard: 'waagerecht',
				optionen: [
					{ wert: 'waagerecht', name: 'Waagerecht' },
					{ wert: 'schraeg', name: 'Schräg' },
				],
			},
		],
	},
	'x-kalender': {
		name: 'Kalender',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Monat', 'Datum', 'Wochentage', 'Jahr'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'monat',
				optionen: [
					{ wert: 'monat', name: 'Ein Monat' },
					{ wert: 'jahr', name: 'Ganzes Jahr' },
				],
			},
			{ art: 'zahl', attribut: 'monat', name: 'Monat', min: 1, max: 12, standard: 1 },
			{ art: 'zahl', attribut: 'jahr', name: 'Jahr', min: 1900, max: 2100, standard: 2026 },
			{ art: 'raster', attribut: 'markiert', name: 'Markierte Tage', form: true },
			{ art: 'raster', attribut: 'luecken', name: 'Tage ohne Zahl', form: true },
			{ art: 'schalter', attribut: 'kw', name: 'Kalenderwochen', an: 'ja', aus: 'nein', standard: false },
		],
	},
	'x-zeitspanne': {
		name: 'Zeitspanne',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Dauer', 'Uhrzeit', 'Zeitpunkt', 'von', 'bis'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'uhrzeit', attribut: 'von', name: 'Von' },
			{ art: 'uhrzeit', attribut: 'bis', name: 'Bis' },
			{
				art: 'text',
				attribut: 'spruenge',
				name: 'Sprünge',
				beispiel: 'bis 9:00, +40 min',
				hilfe: 'Leer: zur vollen Stunde und dann weiter.',
			},
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Im Blatt steht schon',
				standard: ['von', 'bis'],
				optionen: [
					{ wert: 'von', name: 'Anfang' },
					{ wert: 'bis', name: 'Ende' },
					{ wert: 'spruenge', name: 'Sprünge' },
					{ wert: 'dauer', name: 'Dauer' },
				],
			},
		],
	},
	'x-punktfeld': {
		name: 'Punktfeld',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Malfeld', 'Einmaleins', 'Punktebild', 'Multiplikation'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 10, standard: 5 },
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 10, standard: 5 },
			{
				art: 'zahlen',
				attribut: 'trenner',
				name: 'Zerlegungslinie nach',
				beispiel: '5',
				hilfe: 'Kernaufgaben: nach 1, 2 oder 5.',
			},
			{
				art: 'auswahl',
				attribut: 'richtung',
				name: 'Linie zerlegt die',
				standard: 'zeilen',
				optionen: [
					{ wert: 'zeilen', name: 'Zeilen' },
					{ wert: 'spalten', name: 'Spalten' },
				],
			},
			{
				art: 'schalter',
				attribut: 'loesung',
				name: 'Linie nur in der Lösung',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'zahlen',
				attribut: 'abdecken',
				name: 'Frei bleiben',
				beispiel: '3 4',
				hilfe: 'Zeilen und Spalten, der Rest ist grau abgedeckt wie mit dem Malwinkel.',
			},
			{ art: 'zahl', ...GROESSE, min: 14, max: 40, standard: 20, schritt: 2 },
		],
		regeln: (w): Fehler => {
			const fehler: Fehler = {};
			const trenner = w.zahlen('trenner');
			const grenze = w.zahl(w.text('richtung') === 'spalten' ? 'spalten' : 'zeilen');
			if (trenner.length > 1 || trenner.some((k) => k < 1 || k >= grenze)) {
				fehler.trenner = `Eine Linie innerhalb des Feldes: 1 bis ${grenze - 1}.`;
			}
			const frei = w.zahlen('abdecken');
			const [freiZeilen = 0, freiSpalten = 0] = frei;
			const passt = frei.length === 2 && freiZeilen <= w.zahl('zeilen') && freiSpalten <= w.zahl('spalten');
			if (frei.length > 0 && !passt) {
				fehler.abdecken = 'Zwei Zahlen, die im Feld liegen.';
			}
			return fehler;
		},
	},
	'x-malkreuz': {
		name: 'Malkreuz',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Malnehmen', 'Multiplikation', 'halbschriftlich', 'Malkreuz'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'a', name: 'Erste Zahl', min: 1, max: 99, standard: 34 },
			{ art: 'zahl', attribut: 'b', name: 'Zweite Zahl', min: 1, max: 99, standard: 6 },
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Im Blatt steht schon',
				standard: ['zerlegung'],
				optionen: [
					{ wert: 'zerlegung', name: 'Zerlegung' },
					{ wert: 'teilprodukte', name: 'Teilprodukte' },
					{ wert: 'summe', name: 'Summe' },
				],
			},
		],
	},
	'x-schriftlich': {
		name: 'Schriftliche Rechnung',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['schriftliche', 'Addition', 'Subtraktion', 'Multiplikation', 'Division', 'Übertrag'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Rechnung',
				standard: 'plus',
				optionen: [
					{ wert: 'plus', name: 'Plus' },
					{ wert: 'minus', name: 'Minus' },
					{ wert: 'mal', name: 'Mal' },
					{ wert: 'geteilt', name: 'Geteilt' },
				],
			},
			{ art: 'zahlen', attribut: 'zahlen', name: 'Zahlen', beispiel: '345 278' },
			{
				art: 'auswahl',
				attribut: 'verfahren',
				name: 'Verfahren bei Minus',
				hilfe: 'So, wie es die Klasse gelernt hat.',
				optionen: [
					{ wert: null, name: 'Bitte wählen' },
					{ wert: 'abziehen-entbuendeln', name: 'Abziehen, Entbündeln' },
					{ wert: 'abziehen-erweitern', name: 'Abziehen, Erweitern' },
					{ wert: 'ergaenzen-entbuendeln', name: 'Ergänzen, Entbündeln' },
					{ wert: 'ergaenzen-erweitern', name: 'Ergänzen, Erweitern' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'uebertrag',
				name: 'Überträge',
				standard: 'zeile',
				optionen: [
					{ wert: 'zeile', name: 'Notieren' },
					{ wert: 'keine', name: 'Nicht notieren' },
				],
			},
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Im Blatt steht schon',
				standard: ['aufgabe'],
				optionen: [
					{ wert: 'aufgabe', name: 'Aufgabe' },
					{ wert: 'uebertraege', name: 'Überträge' },
					{ wert: 'ergebnis', name: 'Ergebnis' },
				],
			},
			{
				art: 'zahl',
				attribut: 'kaestchen',
				name: 'Kästchen',
				einheit: 'cm',
				min: 0.4,
				max: 1,
				standard: 0.5,
				schritt: 0.1,
			},
			{
				art: 'schalter',
				attribut: 'fehlerhaft',
				name: 'Rechnung mit Fehler zum Finden',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'mischen', attribut: 'seed', name: 'Fehler', knopf: 'Anderer Fehler' },
		],
		regeln: (w): Fehler => {
			const art = w.text('art') ?? 'plus';
			const zahlen = w.zahlen('zahlen');
			const [erste = 0, zweite = 0] = zahlen;
			if (zahlen.some((z) => String(z).length > 7)) {
				return { zahlen: 'Eine Zahl hat höchstens 7 Stellen.' };
			}
			if (art === 'plus' && (zahlen.length < 2 || zahlen.length > 4)) {
				return { zahlen: 'Bei Plus stehen 2 bis 4 Zahlen untereinander.' };
			}
			if (art !== 'plus' && zahlen.length !== 2) {
				return { zahlen: 'Hier gehören genau 2 Zahlen hinein.' };
			}
			if (art === 'minus' && erste < zweite) {
				return { zahlen: 'Die erste Zahl muss mindestens so groß sein wie die zweite.' };
			}
			if (art === 'minus' && !w.text('verfahren')) {
				return { verfahren: 'Bitte das Verfahren wählen, das die Klasse gelernt hat.' };
			}
			if (art === 'geteilt' && (zweite < 2 || zweite > 9)) {
				return { zahlen: 'Geteilt wird durch 2 bis 9.' };
			}
			return art === 'mal' && String(zweite).length > 3
				? { zahlen: 'Der zweite Faktor hat höchstens 3 Stellen.' }
				: {};
		},
	},
	'x-zahlenmauer': {
		name: 'Zahlenmauer',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Rechenmauer', 'Zahlenpyramide', 'Mauer'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahlen', attribut: 'basis', name: 'Unterste Reihe', beispiel: '3 5 2' },
			{ art: 'raster', attribut: 'offen', name: 'Leere Steine', form: true },
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Rechnung',
				standard: 'plus',
				optionen: [
					{ wert: 'plus', name: 'Plus' },
					{ wert: 'minus', name: 'Minus' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 24, max: 80, standard: 44, schritt: 2 },
		],
		regeln: (w): Fehler => {
			const anzahl = w.zahlen('basis').length;
			return anzahl < 2 || anzahl > 5 ? { basis: 'Eine Zahlenmauer hat unten 2 bis 5 Steine.' } : {};
		},
	},
	'x-rechenreihe': {
		name: 'Rechenreihe',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Päckchen', 'Plusaufgaben', 'Minusaufgaben', 'Einmaleins', 'Platzhalter', 'Zehnerübergang'],
			ort: 'aufgabe',
		},
		generiert: 'aufgaben',
		felder: [
			{
				art: 'auswahl',
				attribut: 'rechenart',
				name: 'Rechenart',
				standard: '+',
				optionen: [
					{ wert: '+', name: 'Plus' },
					{ wert: '−', name: 'Minus' },
					{ wert: '·', name: 'Mal' },
					{ wert: ':', name: 'Geteilt' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'zahlenraum',
				name: 'Zahlenraum',
				standard: '20',
				optionen: [
					{ wert: '10', name: 'bis 10' },
					{ wert: '20', name: 'bis 20' },
					{ wert: '100', name: 'bis 100' },
					{ wert: '1000', name: 'bis 1000' },
					{ wert: '1000000', name: 'bis 1 Million' },
				],
			},
			{ art: 'zahl', attribut: 'anzahl', name: 'Anzahl', min: 1, max: 60, standard: 10 },
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 4, standard: 2 },
			{
				art: 'auswahl',
				attribut: 'uebergang',
				name: 'Zehnerübergang',
				standard: 'egal',
				optionen: [
					{ wert: 'egal', name: 'Egal' },
					{ wert: 'mit', name: 'Mit Übergang' },
					{ wert: 'ohne', name: 'Ohne Übergang' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'platzhalter',
				name: 'Platzhalter',
				standard: 'ergebnis',
				optionen: [
					{ wert: 'ergebnis', name: 'Beim Ergebnis' },
					{ wert: 'erste', name: 'Erste Zahl' },
					{ wert: 'zweite', name: 'Zweite Zahl' },
					{ wert: 'gemischt', name: 'Gemischt' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'beziehung',
				name: 'Aufgabenpaare',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'tausch', name: 'Tauschaufgaben' },
					{ wert: 'umkehr', name: 'Umkehraufgaben' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'reihe',
				name: 'Einmaleins-Reihe',
				optionen: [
					{ wert: null, name: 'Alle' },
					...['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((r) => ({
						wert: r,
						name: `${r}er-Reihe`,
					})),
				],
			},
			{ art: 'schalter', attribut: 'rest', name: 'Mit Rest', an: '1', aus: '0', standard: false },
			{
				art: 'text',
				attribut: 'aufgaben',
				name: 'Aufgaben',
				zeilen: 4,
				hilfe: 'Je Aufgabe genau ein _. ; trennt die Aufgaben. Die Lösung wird berechnet.',
			},
		],
	},
	'x-rechendreieck': {
		name: 'Rechendreieck',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Zahlendreieck', 'Rechendreieck'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahlen', attribut: 'innen', name: 'Innenzahlen', beispiel: '3 5 2' },
			{ art: 'raster', attribut: 'offen', name: 'Leere Felder', form: true },
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Innen',
				standard: 'zahlen',
				optionen: [
					{ wert: 'zahlen', name: 'Zahlen' },
					{ wert: 'plaettchen', name: 'Plättchen' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 140, max: 360, standard: 220, schritt: 10 },
		],
	},
	'x-zahlenhaus': {
		name: 'Zahlenhaus',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Zerlegen', 'Zerlegungshaus', 'Zahlzerlegung', 'Dach'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'dach', name: 'Dach', min: 0, max: 1000000, standard: 7 },
			{
				art: 'liste',
				attribut: 'zerlegungen',
				name: 'Stockwerke',
				feldTrenner: ' ',
				unter: [
					{ art: 'zahl', name: 'Links' },
					{ art: 'zahl', name: 'Rechts' },
				],
			},
			{
				art: 'schalter',
				attribut: 'alle',
				name: 'Alle Zerlegungen der Reihe nach',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'raster', attribut: 'offen', name: 'Leere Felder', form: true },
			{ art: 'zahl', ...GROESSE, min: 24, max: 70, standard: 40, schritt: 2 },
		],
	},
	'x-zahlenkette': {
		name: 'Rechenkette',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Rechenkette', 'Kettenaufgabe', 'Pfeile'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'start', name: 'Start', min: 0, max: 1000000, standard: 0 },
			{
				art: 'liste',
				attribut: 'operatoren',
				name: 'Rechenschritte',
				zeilenTrenner: ' ',
				feldTrenner: ' ',
				min: 1,
				max: 8,
				unter: [{ art: 'text', name: 'Schritt' }],
				hilfe: 'Zum Beispiel +5, −3, ·2 oder :4.',
			},
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Schon vorgegeben',
				standard: ['start', 'operatoren'],
				optionen: [
					{ wert: 'start', name: 'Start' },
					{ wert: 'operatoren', name: 'Rechenschritte' },
					{ wert: 'zwischen', name: 'Zwischenergebnisse' },
					{ wert: 'ziel', name: 'Ziel' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Darstellung',
				standard: 'kette',
				optionen: [
					{ wert: 'kette', name: 'Kette' },
					{ wert: 'pfeilbild', name: 'Pfeilbild' },
				],
			},
			{
				art: 'schalter',
				attribut: 'rueckwaerts',
				name: 'Rückwärts (Ziel gegeben)',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
		],
	},
	'x-zauberdreieck': {
		name: 'Zauberdreieck',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['magisches', 'Dreieck', 'Zauberquadrat'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Form',
				standard: 'dreieck',
				optionen: [
					{ wert: 'dreieck', name: 'Zauberdreieck (6 Zahlen)' },
					{ wert: 'quadrat', name: 'Magisches Quadrat (9 Zahlen)' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'zahlen',
				name: 'Zahlen',
				beispiel: '1 2 3 4 5 6',
				hilfe: 'Leer: 1 bis 6 oder 1 bis 9.',
			},
			{
				art: 'zahl',
				attribut: 'summe',
				name: 'Summe je Linie',
				min: 0,
				max: 100000,
				standard: 0,
				hilfe: '0: ohne Summe, eine Forscheraufgabe.',
			},
			{ art: 'raster', attribut: 'vorgegeben', name: 'Vorgegebene Felder', form: true },
			{ art: 'mischen', attribut: 'seed', name: 'Lösung' },
			{ art: 'zahl', ...GROESSE, min: 26, max: 70, standard: 44, schritt: 2 },
		],
	},
	'x-rechenrad': {
		name: 'Rechenrad',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Rechenblume', 'Einmaleins', 'Kreis'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'text',
				attribut: 'mitte',
				name: 'In der Mitte',
				muster: '[+\\-−·×*:] ?[0-9]+',
				musterHilfe: 'Zum Beispiel ·7 oder :4.',
			},
			{
				art: 'zahlen',
				attribut: 'zahlen',
				name: 'Innerer Ring',
				beispiel: '1 2 3 4 5 6',
				hilfe: '6 bis 10 Zahlen.',
			},
			{
				art: 'auswahl',
				attribut: 'offen',
				name: 'Offen',
				standard: 'aussen',
				optionen: [
					{ wert: 'aussen', name: 'Außen' },
					{ wert: 'innen', name: 'Innen' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 160, max: 400, standard: 240, schritt: 10 },
		],
	},
	'x-wuerfelbau': {
		name: 'Würfelgebäude',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Würfelgebäude', 'Bauplan', 'Schrägbild', 'räumlich', 'Ansichten'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'raster',
				attribut: 'bauplan',
				name: 'Bauplan (Turmhöhen)',
				zahlen: { min: 0, max: 5 },
				wachsen: { spalten: 4, zeilen: 4 },
				hilfe: 'Die unterste Zeile ist vorne.',
			},
			{ art: 'mehrfach', attribut: 'zeige', name: 'Vorgegeben', optionen: WUERFELBAU_TEILE },
			{
				art: 'mehrfach',
				attribut: 'fragen',
				name: 'Gefragt',
				optionen: [{ wert: 'anzahl', name: 'Anzahl der Würfel' }, ...WUERFELBAU_TEILE.slice(1)],
			},
			{
				art: 'auswahl',
				attribut: 'projektion',
				name: 'Schrägbild',
				standard: 'schraeg',
				optionen: [
					{ wert: 'schraeg', name: 'Schräg' },
					{ wert: 'iso', name: 'Isometrisch' },
				],
			},
			{
				art: 'schalter',
				attribut: 'verdeckt',
				name: 'Verdeckte Würfel zeigen',
				an: 'zeigen',
				aus: 'nicht',
				standard: false,
			},
			{
				art: 'zahl',
				attribut: 'einheit',
				name: 'Würfelkante',
				min: 14,
				max: 50,
				standard: 26,
				schritt: 2,
				einheit: 'px',
			},
		],
	},
	'x-wuerfelnetz': {
		name: 'Würfelnetz',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Netz', 'Basteln', 'Faltnetz', 'Würfel', 'räumlich'],
			ort: 'seite',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'netz',
				name: 'Netz',
				standard: '1',
				blaettern: true,
				optionen: [
					...Array.from({ length: 11 }, (_, i) => ({ wert: String(i + 1), name: `Netz ${i + 1}` })),
					...Array.from({ length: 8 }, (_, i) => ({ wert: `n${i + 1}`, name: `Kein Netz ${i + 1}` })),
				],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'netz-oder-nicht', name: 'Netz oder nicht?' },
					{ wert: 'gegenueber', name: 'Gegenüberliegende Fläche' },
					{ wert: 'augen-ergaenzen', name: 'Augen ergänzen' },
				],
			},
			{ art: 'zahl', attribut: 'markiere', name: 'Markierte Fläche', min: 1, max: 6, standard: 1 },
			{
				art: 'schalter',
				attribut: 'augen',
				name: 'Standardwürfel (gegenüber 7)',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'liste',
				attribut: 'flaechen',
				name: 'Flächen',
				zeilenTrenner: ' ',
				feldTrenner: ' ',
				min: 6,
				max: 6,
				unter: [{ art: 'text', name: 'Inhalt' }],
				hilfe: '1 bis 6 sind Augen, 0 ist leer, #12 eine Zahl; sonst Wort oder Farbe, ohne Leerzeichen.',
			},
			{ art: 'schalter', attribut: 'laschen', name: 'Laschen', an: 'ja', aus: 'nein', standard: false },
			{
				art: 'schalter',
				attribut: 'bastel',
				name: 'Bastelvorlage',
				an: 'ja',
				aus: 'nein',
				standard: false,
				gruppe: 'Bastelvorlage',
			},
			{
				art: 'zahl',
				attribut: 'kante',
				name: 'Kante',
				min: 1,
				max: 8,
				standard: 4,
				schritt: 0.5,
				einheit: 'cm',
				gruppe: 'Bastelvorlage',
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Körper',
				standard: 'wuerfel',
				gruppe: 'Weitere Angaben',
				optionen: [
					{ wert: 'wuerfel', name: 'Würfel' },
					{ wert: 'quader', name: 'Quader' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'masse',
				name: 'Maße des Quaders',
				beispiel: '4 2 1',
				gruppe: 'Weitere Angaben',
			},
			{
				art: 'zahl',
				attribut: 'drehung',
				name: 'Drehung in Grad',
				min: 0,
				max: 270,
				standard: 0,
				schritt: 90,
				gruppe: 'Weitere Angaben',
			},
			{ art: 'zahl', ...GROESSE, min: 16, max: 80, standard: 30, schritt: 2, gruppe: 'Weitere Angaben' },
			{ art: 'text', attribut: 'seed', name: 'Mischung', gruppe: 'Weitere Angaben' },
		],
	},
	'x-koerper': {
		name: 'Körper',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Quader', 'Kugel', 'Pyramide', 'Zylinder', 'Kegel', 'Kanten', 'Ecken'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Form',
				standard: 'wuerfel',
				optionen: [
					{ wert: 'wuerfel', name: 'Würfel' },
					{ wert: 'quader', name: 'Quader' },
					{ wert: 'kugel', name: 'Kugel' },
					{ wert: 'zylinder', name: 'Zylinder' },
					{ wert: 'kegel', name: 'Kegel' },
					{ wert: 'pyramide', name: 'Pyramide' },
					{ wert: 'prisma', name: 'Prisma' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'ansicht',
				name: 'Ansicht',
				standard: 'schraegbild',
				optionen: [
					{ wert: 'schraegbild', name: 'Schrägbild' },
					{ wert: 'kantenmodell', name: 'Kantenmodell' },
				],
			},
			{
				art: 'schalter',
				attribut: 'verdeckt',
				name: 'Verdeckte Kanten gestrichelt',
				an: 'gestrichelt',
				aus: 'aus',
				standard: true,
			},
			{
				art: 'mehrfach',
				attribut: 'markiere',
				name: 'Gefragt und in der Lösung markiert',
				optionen: [
					{ wert: 'ecken', name: 'Ecken' },
					{ wert: 'kanten', name: 'Kanten' },
					{ wert: 'flaechen', name: 'Flächen' },
				],
			},
			{ art: 'zahlen', attribut: 'masse', name: 'Maße', beispiel: '4 2 2', gruppe: 'Weitere Angaben' },
			{
				art: 'zahl',
				attribut: 'drehung',
				name: 'Drehung in Grad',
				min: 0,
				max: 359,
				standard: 0,
				schritt: 15,
				gruppe: 'Weitere Angaben',
			},
			{ art: 'zahl', ...GROESSE, min: 14, max: 60, standard: 30, schritt: 2, gruppe: 'Weitere Angaben' },
		],
	},
	'x-tangram': {
		name: 'Tangram',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Legespiel', 'Formen', 'Puzzle'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'umriss',
				name: 'Umriss',
				standard: 'haus',
				optionen: [
					{ wert: 'haus', name: 'Haus' },
					{ wert: 'katze', name: 'Katze' },
					{ wert: 'schiff', name: 'Schiff' },
					{ wert: 'fisch', name: 'Fisch' },
					{ wert: 'kerze', name: 'Kerze' },
				],
			},
			{
				art: 'mehrfach',
				attribut: 'teile',
				name: 'Schon eingezeichnet',
				optionen: [
					{ wert: 'gross1', name: 'Großes Dreieck 1' },
					{ wert: 'gross2', name: 'Großes Dreieck 2' },
					{ wert: 'mittel', name: 'Mittleres Dreieck' },
					{ wert: 'klein1', name: 'Kleines Dreieck 1' },
					{ wert: 'klein2', name: 'Kleines Dreieck 2' },
					{ wert: 'quadrat', name: 'Quadrat' },
					{ wert: 'raute', name: 'Parallelogramm' },
				],
			},
			{
				art: 'schalter',
				attribut: 'bogen',
				name: 'Bogen zum Ausschneiden (12 cm)',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'zahl', ...GROESSE, min: 14, max: 60, standard: 30, schritt: 2 },
		],
	},
} satisfies Record<string, AbbildungSchema>;

export type Abbildung = keyof typeof ABBILDUNG_SCHEMA;

/**
 * Attribute, die `abbildungen.js` liest, die das Panel aber bewusst nicht anbietet: `rest` setzt `praesentation.js`
 * zur Laufzeit, während ein Timer abläuft.
 */
export const NUR_ZUR_LAUFZEIT = ['rest'];

export const schemaVon = (tag: string): AbbildungSchema | undefined =>
	(ABBILDUNG_SCHEMA as Record<string, AbbildungSchema>)[tag];

export const attributeVon = (schema: AbbildungSchema) =>
	schema.felder.flatMap((f) => {
		if (f.art === 'plan') {
			return [f.attribut, f.objekte];
		}
		return f.loesung ? [f.attribut, f.loesung.attribut] : [f.attribut];
	});

// ── Werte lesen und schreiben ───────────────────────────────────────────────

const amInhalt = (schema: AbbildungSchema, a: string) =>
	schema.felder.some((f) => f.attribut === a && f.quelle === 'inhalt');

/** Mit `quelle: 'inhalt'` braucht es die Zerlegung, weil der Wert der Text im Element ist. */
export const werteVon = (schema: AbbildungSchema, k: Knoten, z?: Zerlegung): Werte =>
	Object.fromEntries(
		attributeVon(schema).map((a) => {
			if (amInhalt(schema, a)) {
				const roh = z ? entschluessele(innenVon(z, k)).trim() : '';
				return [a, roh === '' ? null : roh];
			}
			return [a, attribut(k, a)?.wert ?? null];
		}),
	);

/** Wert eines Feldes und ob er nur in der Lösung steht; mit beiden Attributen gilt, was `abbildungen.js` zeichnet. */
export const feldWert = (feld: Feld, w: Werte): { wert: string | null; nurLoesung: boolean } => {
	const sichtbar = w[feld.attribut] ?? null;
	const loesung = feld.loesung ? (w[feld.loesung.attribut] ?? null) : null;
	if (loesung !== null && (sichtbar === null || feld.loesung?.vorrang)) {
		return { wert: loesung, nurLoesung: true };
	}
	return { wert: sichtbar, nurLoesung: false };
};

export const stellenVon = (w: Werte, attributName: string) =>
	(w[attributName] ?? STELLEN_STANDARD).split(/\s+/).filter(Boolean);

export const listeVon = (wert: string | null) => (wert ?? '').split(/[\s,;]+/).filter(Boolean);

/** Platzhalter für ein leeres Unterfeld im Entwurf, damit die Zeile beim Tippen nicht wegfällt. */
export const LEER = '∅';

const teile = (text: string, trenner: string, anzahl: number): string[] => {
	if (trenner === '') {
		const t = new RegExp(`^(${LEER}|\\d*)(.*)$`, 's').exec(text);
		return [t?.[1] ?? '', t?.[2] ?? ''];
	}
	if (trenner === ' ') {
		return text.split(/\s+/).filter(Boolean);
	}
	const i = text.indexOf(trenner);
	return i < 0 || anzahl < 2
		? [text.trim()]
		: [text.slice(0, i).trim(), ...teile(text.slice(i + trenner.length), trenner, anzahl - 1)];
};

/** `Hund: 7; Katze: 4` → `[['Hund', '7'], ['Katze', '4']]`. Eine leere letzte Zeile (`…;`) zählt nicht. */
export const zeilenVon = (feld: ListeFeld, wert: string | null): string[][] => {
	const { feldTrenner = ':', unter, zeilenTrenner = ';' } = feld;
	if (!wert?.trim()) {
		return [];
	}
	const zeilen = zeilenTrenner === ' ' ? wert.trim().split(/\s+/) : wert.split(zeilenTrenner);
	if (zeilen.at(-1)?.trim() === '') {
		zeilen.pop();
	}
	return zeilen.map((z) => {
		const werte = teile(z.trim(), feldTrenner, unter.length);
		return unter.map((_, i) => {
			const w = werte[i] ?? '';
			return w === LEER ? '' : w;
		});
	});
};

export const MINI_ARTEN: Option[] = [
	{ wert: '', name: 'Text' },
	{ wert: 'bild', name: 'Bild' },
	{ wert: 'uhr', name: 'Uhr' },
	{ wert: 'wuerfel', name: 'Würfel' },
	{ wert: 'menge', name: 'Menge' },
	{ wert: 'geld', name: 'Geld' },
	{ wert: 'rhythmus', name: 'Rhythmus' },
];

/** `uhr:7:30` → Art und Wert; ohne bekannte Art ist alles Text. */
export const miniTeile = (wert: string): { art: string; inhalt: string } => {
	const t = /^(uhr|wuerfel|menge|geld|rhythmus|bild):(.*)$/s.exec(wert);
	return t ? { art: t[1] ?? '', inhalt: t[2] ?? '' } : { art: '', inhalt: wert };
};

export const zeilenText = (feld: ListeFeld, zeilen: string[][]): string | null => {
	const { feldTrenner = ':', unter, zeilenTrenner = ';' } = feld;
	if (zeilen.length === 0) {
		return null;
	}
	const zwischen = feldTrenner === ':' ? ': ' : feldTrenner;
	let trenner = '; ';
	if (zeilenTrenner === ' ') {
		trenner = ' ';
	} else if (zeilenTrenner === '/') {
		trenner = ' / ';
	}
	return zeilen
		.map((z) => {
			const werte = unter.map((u, i) => (z[i] ?? '').trim() || (u.leer ? '' : LEER));
			while (werte.length > 1 && werte.at(-1) === '') {
				werte.pop();
			}
			return werte.join(zwischen);
		})
		.join(trenner);
};

export const rasterVon = (wert: string | null): string[][] =>
	(wert ?? '')
		.split('/')
		.map((z) => z.trim())
		.filter(Boolean)
		.map((z) => z.split(/\s+/));

export const rasterText = (zeilen: string[][]) => {
	const text = zeilen.map((z) => z.join(' ')).join(' / ');
	return text === '' ? null : text;
};

/** Ziffern je Stelle als Attributwert; leere Stellen am Ende fallen weg, eine ganz leere Tafel hat keinen Wert. */
export const ziffernText = (liste: string[]) => {
	const bis = liste.findLastIndex((z) => z.trim() !== '');
	return bis < 0
		? null
		: liste
				.slice(0, bis + 1)
				.map((z) => z.trim() || '?')
				.join(' ');
};

/**
 * Ändert ein Feld. Mit Lösungs-Gegenstück steht der Wert danach in genau einem der beiden Attribute. Ändern sich die
 * Stellen einer Stellentafel, bleiben die Zahlen rechtsbündig an ihrer Stelle (der Einer bleibt der Einer).
 */
export const aendereFeld = (
	schema: AbbildungSchema,
	w: Werte,
	feld: Feld,
	wert: string | null,
	nurLoesung = feldWert(feld, w).nurLoesung,
): Werte => {
	const neu = { ...w };
	if (feld.loesung) {
		neu[feld.attribut] = nurLoesung ? null : wert;
		neu[feld.loesung.attribut] = nurLoesung ? wert : null;
	} else {
		neu[feld.attribut] = wert;
	}
	for (const f of schema.felder) {
		if (f.art !== 'ziffern' || f.stellen !== feld.attribut) {
			continue;
		}
		const alt = stellenVon(w, f.stellen).length;
		const jetzt = stellenVon(neu, f.stellen).length;
		const { nurLoesung: nur, wert: ziffern } = feldWert(f, neu);
		if (ziffern === null || alt === jetzt) {
			continue;
		}
		const liste = Array.from({ length: alt }, (_, i) => listeVon(ziffern)[i] ?? '');
		const gerueckt = jetzt > alt ? [...Array<string>(jetzt - alt).fill(''), ...liste] : liste.slice(alt - jetzt);
		Object.assign(neu, aendereFeld(schema, neu, f, ziffernText(gerueckt), nur));
	}
	return neu;
};

/** Die Attribute, die sich zwischen zwei Fassungen unterscheiden. */
export const unterschiede = (alt: Werte, neu: Werte) =>
	Object.keys(neu).filter((a) => (alt[a] ?? null) !== (neu[a] ?? null));

// ── Prüfen ──────────────────────────────────────────────────────────────────

const zahlText = (n: number) => String(n).replace('.', ',');

const pruefeUnterfeld = (u: UnterFeld, wert: string): string | null => {
	if (wert === '') {
		return u.leer ? null : `„${u.name}“ fehlt.`;
	}
	if (u.art === 'zahl') {
		const n = alsZahl(wert);
		if (Number.isNaN(n)) {
			return `„${wert}“ ist keine Zahl.`;
		}
		if ((u.min !== undefined && n < u.min) || (u.max !== undefined && n > u.max)) {
			return `„${u.name}“: bitte von ${u.min ?? ''} bis ${u.max ?? ''}.`;
		}
	}
	if ((u.art === 'auswahl' || u.art === 'muster') && u.optionen && !u.optionen.some((o) => o.wert === wert)) {
		return `„${wert}“ gibt es bei „${u.name}“ nicht.`;
	}
	return null;
};

const pruefeListe = (feld: ListeFeld, wert: string | null): string | null => {
	const zeilen = zeilenVon(feld, wert);
	if (wert !== null && feld.min !== undefined && zeilen.length < feld.min) {
		return `Bitte mindestens ${feld.min} ${feld.min === 1 ? 'Zeile' : 'Zeilen'}.`;
	}
	if (feld.max !== undefined && zeilen.length > feld.max) {
		return `Höchstens ${feld.max} Zeilen.`;
	}
	for (const [i, zeile] of zeilen.entries()) {
		for (const [j, u] of feld.unter.entries()) {
			const meldung = pruefeUnterfeld(u, zeile[j] ?? '');
			if (meldung) {
				return `Zeile ${i + 1}: ${meldung}`;
			}
		}
	}
	return null;
};

const pruefeRaster = (feld: RasterFeld, wert: string | null): string | null => {
	if (feld.form) {
		return null;
	}
	const { max = Infinity, min = -Infinity } = feld.zahlen ?? {};
	const erlaubt = feld.zustaende?.map((z) => z.wert) ?? ['0', '1'];
	for (const zelle of rasterVon(wert).flat()) {
		if (feld.zahlen) {
			const n = alsZahl(zelle);
			if (!Number.isInteger(n) || n < min || n > max) {
				return `Bitte Zahlen von ${min} bis ${max}.`;
			}
		} else if (!erlaubt.includes(zelle)) {
			return `„${zelle}“ geht in diesem Feld nicht.`;
		}
	}
	return null;
};

const pruefeZahl = (feld: ZahlFeld, wert: string | null) => {
	if (wert === null) {
		return null;
	}
	const n = alsZahl(wert);
	const schritt = feld.schritt ?? 1;
	const ganz = Number.isInteger(schritt);
	const passt = ganz ? Number.isInteger(n) : Math.abs(n / schritt - Math.round(n / schritt)) < 1e-6;
	if (passt && n >= feld.min && n <= feld.max) {
		return null;
	}
	return ganz
		? `Bitte eine ganze Zahl von ${zahlText(feld.min)} bis ${zahlText(feld.max)}.`
		: `Bitte eine Zahl von ${zahlText(feld.min)} bis ${zahlText(feld.max)} in Schritten von ${zahlText(schritt)}.`;
};

const pruefeUhrzeit = (wert: string | null) => {
	if (wert === null) {
		return null;
	}
	const treffer = /^(\d{1,2}):(\d{2})$/.exec(wert.trim());
	const [stunde, minute] = [Number(treffer?.[1]), Number(treffer?.[2])];
	return !treffer || stunde > 23 || minute > 59 ? 'Bitte eine Uhrzeit wie 4:30 (Minuten 0 bis 59).' : null;
};

const pruefeZiffern = (feld: ZiffernFeld, wert: string | null, w: Werte) => {
	const stellen = stellenVon(w, feld.stellen);
	const liste = listeVon(wert);
	if (liste.length > stellen.length) {
		return `Die Tafel hat nur ${stellen.length} ${stellen.length === 1 ? 'Stelle' : 'Stellen'}.`;
	}
	const luecke = liste.findIndex((z) => z === '?');
	if (luecke >= 0) {
		return `Bei „${stellen[luecke] ?? ''}“ fehlt eine Zahl. Trag eine ein oder nimm weniger Stellen.`;
	}
	const falsch = liste.find((z) => !/^\d{1,2}$/.test(z));
	return falsch === undefined ? null : `„${falsch}“ geht nicht. Bitte je Stelle eine Zahl von 0 bis 99.`;
};

const pruefeText = (feld: TextFeld, wert: string | null) => {
	if (wert === null) {
		return null;
	}
	if (feld.max !== undefined && wert.length > feld.max) {
		return `Höchstens ${feld.max} Zeichen.`;
	}
	return feld.muster && !new RegExp(`^(?:${feld.muster})$`, 'su').test(wert)
		? (feld.musterHilfe ?? 'Diese Zeichen gehen hier nicht.')
		: null;
};

const pruefeMehrfach = (feld: MehrfachFeld, wert: string | null) => {
	const gewaehlt = listeVon(wert ?? feld.standard?.join(' ') ?? null);
	const falsch = feld.optionenJe ? undefined : gewaehlt.find((g) => !feld.optionen.some((o) => o.wert === g));
	if (falsch !== undefined) {
		return `„${falsch}“ gibt es hier nicht.`;
	}
	return feld.mindestens !== undefined && gewaehlt.length < feld.mindestens
		? `Bitte mindestens ${feld.mindestens} auswählen.`
		: null;
};

const pruefeFeld = (feld: Feld, w: Werte): string | null => {
	const { wert } = feldWert(feld, w);
	switch (feld.art) {
		case 'zahl':
			return pruefeZahl(feld, wert);
		case 'uhrzeit':
			return pruefeUhrzeit(wert);
		case 'schalter':
			return wert === null || wert === feld.an || wert === feld.aus
				? null
				: `Nur „${feld.an}“ oder „${feld.aus}“.`;
		case 'zahlen': {
			const falsch = listeVon(wert).find((z) => Number.isNaN(alsZahl(z)));
			return falsch === undefined ? null : `„${falsch}“ ist keine Zahl. Trenne die Zahlen mit Leerzeichen.`;
		}
		case 'ziffern':
			return pruefeZiffern(feld, wert, w);
		case 'text':
			return pruefeText(feld, wert);
		case 'liste':
			return pruefeListe(feld, wert);
		case 'mehrfach':
			return pruefeMehrfach(feld, wert);
		case 'raster':
			return pruefeRaster(feld, wert);
		case 'muster':
			return wert === null || feld.optionen.some((o) => o.wert === wert) ? null : `„${wert}“ gibt es hier nicht.`;
		default:
			return null;
	}
};

const leser = (schema: AbbildungSchema, w: Werte): Lesen => {
	const feld = (a: string) => schema.felder.find((f) => f.attribut === a);
	return {
		text: (a) => {
			const f = feld(a);
			return f ? feldWert(f, w).wert : (w[a] ?? null);
		},
		zahl: (a) => {
			const f = feld(a);
			const wert = f ? feldWert(f, w).wert : null;
			if (wert !== null) {
				return alsZahl(wert);
			}
			return f?.art === 'zahl' ? zahlStandard(f, w) : 0;
		},
		zahlen: (a) => {
			const f = feld(a);
			return listeVon(f ? feldWert(f, w).wert : null).map(alsZahl);
		},
		zeilen: (a) => {
			const f = feld(a);
			return f?.art === 'liste' ? zeilenVon(f, feldWert(f, w).wert) : [];
		},
		raster: (a) => {
			const f = feld(a);
			return rasterVon(f ? feldWert(f, w).wert : null);
		},
		liste: (a) => {
			const f = feld(a);
			if (f?.art === 'mehrfach') {
				return listeVon(feldWert(f, w).wert ?? f.standard?.join(' ') ?? null);
			}
			return listeVon(f ? feldWert(f, w).wert : (w[a] ?? null));
		},
	};
};

/** Leer heißt gültig. Erst jedes Feld für sich, dann die Regeln zwischen den Feldern. */
export const pruefeWerte = (schema: AbbildungSchema, w: Werte): Fehler => {
	const fehler: Fehler = {};
	for (const feld of schema.felder) {
		const meldung = pruefeFeld(feld, w);
		if (meldung) {
			fehler[feld.attribut] = meldung;
		}
	}
	return Object.keys(fehler).length > 0 || !schema.regeln ? fehler : schema.regeln(leser(schema, w));
};

// ── Befehl ──────────────────────────────────────────────────────────────────

/**
 * Setzt die Attribute einer Abbildung (`null` entfernt eines). Nur diese Attribute ändern sich in der Quelle; die
 * Nummern der Elemente bleiben, die Auswahl auch.
 */
export const setzeAbbildung = (quelle: string, nr: number, werte: Werte): StrukturErgebnis => {
	const k = zerlege(quelle).knoten[nr];
	const schema = k ? schemaVon(k.tag) : undefined;
	if (!k || !schema) {
		throw new Error(`Das Element ${nr} ist keine Abbildung.`);
	}
	const fehler = Object.values(pruefeWerte(schema, { ...werteVon(schema, k, zerlege(quelle)), ...werte }));
	if (fehler.length > 0) {
		throw new Error(fehler[0]);
	}
	let neu = quelle;
	for (const [name, wert] of Object.entries(werte)) {
		const z = zerlege(neu);
		const knoten = z.knoten[nr];
		if (knoten) {
			neu = wendeAn(
				neu,
				amInhalt(schema, name)
					? ersetzeInnen(z, knoten, schuetzeText(wert ?? ''))
					: setzeAttribut(z, knoten, name, wert),
			);
		}
	}
	return { quelle: neu, nr };
};
