/**
 * Baustein-Katalog (043): was sich einfügen lässt. Setzt die Liste aus `ABBILDUNG_SCHEMA` und `KIT_KATALOG` zusammen und
 * enthält selbst nur die Aufgabenpakete (Entscheidung 27): Ein neues Element bleibt ein Eintrag an einem Ort. Ohne
 * Node-Abhängigkeit, die Oberfläche liest ihn auch. Das Starter-HTML liest `katalog-starter.ts` aus den Mustern.
 */

import type { AbbildungSchema, KatalogAngaben, Kategorie } from './abbildungen';
import { ABBILDUNG_SCHEMA, KATALOG_BEREICHE, KATALOG_KATEGORIEN } from './abbildungen';
import { BAUSTEINE, KIT_KATALOG } from './bausteine';
import type { Art, Fach, Klasse } from './werte';

export interface KatalogEintrag extends KatalogAngaben {
	id: string;
	name: string;
	herkunft: 'abbildung' | 'eigen' | 'kit' | 'paket';
	/** Kennung `data-katalog` im Muster; fehlt, wenn der Eintrag nur eine Klasse setzt. */
	starter?: string;
	klasse?: string;
	/** Nur Aufgabenpakete: Starter, die zusammen den Körper der Aufgabe ergeben; `aufgabe` steht für die Hülle. */
	teile?: readonly string[];
}

const uhr = (zeit: string, ablesen: string, beispiel = false) =>
	`<div class="zelle${beispiel ? ' beispiel' : ''}"><x-uhr zeit="${zeit}" groesse="88"></x-uhr>` +
	`<span class="antwort breit" data-l="${ablesen}"></span></div>`;
const satz = (anfang: string) => `<div class="zeile"><b>${anfang}</b> <span class="antwort lang"></span></div>`;

/** Fertige Aufgaben: Nummer, Aufgabentext und Inhalt. Der Inhalt sind Starter aus den Mustern (`teile`) oder `html`. */
const AUFGABENPAKETE: readonly Omit<KatalogEintrag, 'herkunft'>[] = [
	{
		id: 'paket-malen',
		name: 'Malen und schreiben',
		kategorie: 'Aufgaben',
		suchbegriffe: ['Malfeld', 'Lineatur', 'Zeichnen', 'Schreiben'],
		ort: 'seite',
		html: '<div class="malfeld" style="--h:160px"></div><x-lineatur zeilen="3"></x-lineatur>',
		anweisung: 'Male. Schreibe dazu.',
	},
	{
		id: 'paket-verlaufsplan',
		name: 'Verlaufsplan',
		kategorie: 'Aufgaben',
		suchbegriffe: ['Tabelle', 'Stunde', 'Planung'],
		ort: 'seite',
		arten: ['unterrichtsplanung'],
		teile: ['aufgabe', 'tabelle-verlauf'],
		anweisung: 'So läuft die Stunde.',
	},
	{
		id: 'paket-sachaufgabe',
		name: 'Sachaufgabe',
		kategorie: 'Rechnen',
		suchbegriffe: ['Textaufgabe', 'Frage', 'Rechnung', 'Antwort', 'Sachrechnen'],
		ort: 'seite',
		faecher: ['mathematik'],
		html:
			`<p>Hier steht die Sachaufgabe.</p>${satz('Frage:')}<div class="zeile"><b>Rechnung:</b></div>` +
			`<x-lineatur art="karo-klein" zeilen="4"></x-lineatur>${satz('Antwort:')}`,
		anweisung: 'Lies die Aufgabe. Schreibe Frage, Rechnung und Antwort.',
	},
	{
		id: 'paket-rechenuebersicht',
		name: 'Überschlagen und rechnen',
		kategorie: 'Rechnen',
		suchbegriffe: ['Rechenübersicht', 'Tabelle', 'Überschlag', 'Ergebnis'],
		ort: 'seite',
		faecher: ['mathematik'],
		teile: ['aufgabe', 'tabelle-rechnen'],
		anweisung: 'Rechne und trage ein.',
	},
	{
		id: 'paket-wertetabelle',
		name: 'Wertetabelle',
		kategorie: 'Rechnen',
		suchbegriffe: ['Tabelle', 'Einmaleins', 'Zuordnung'],
		ort: 'seite',
		faecher: ['mathematik'],
		teile: ['aufgabe', 'tabelle-werte'],
		anweisung: 'Fülle die Tabelle aus.',
	},
	{
		id: 'paket-uhr',
		name: 'Uhrzeit ablesen',
		kategorie: 'Größen',
		suchbegriffe: ['Uhr', 'Zeit', 'lesen', 'Wie spät'],
		ort: 'seite',
		faecher: ['mathematik'],
		// 203-01: vier Uhren mit Zeigern, die erste als Beispiel, wie Aufgabe 1 im Blatt „Uhrzeit“.
		html: `<div class="reihe" style="--spalten:4">${uhr('3:00', '3 Uhr', true)}${uhr('4:30', 'halb 5')}${uhr('7:00', '7 Uhr')}${uhr('9:30', 'halb 10')}</div>`,
		anweisung: 'Wie spät ist es? Schreibe die Uhrzeit auf.',
	},
	{
		id: 'paket-diagramm',
		name: 'Diagramm auswerten',
		kategorie: 'Daten und Zufall',
		suchbegriffe: ['Säulendiagramm', 'Schaubild', 'Statistik'],
		ort: 'seite',
		faecher: ['mathematik'],
		teile: ['aufgabe', 'x-diagramm', 'schreiblinie'],
		anweisung: 'Lies im Diagramm ab und antworte.',
	},
	{
		id: 'paket-vermutung',
		name: 'Vermutung und Ergebnis',
		kategorie: 'Sachunterricht',
		suchbegriffe: ['Versuch', 'Forschen', 'Vermuten', 'Ergebnis', 'Experiment'],
		ort: 'seite',
		faecher: ['sachunterricht'],
		html: `${satz('Ich vermute:')}<div class="schreiblinie"></div>${satz('Ich habe herausgefunden:')}<div class="schreiblinie"></div>`,
		anweisung: 'Was passiert? Vermute zuerst. Probiere es dann aus.',
	},
	{
		id: 'paket-beobachtung',
		name: 'Beobachtungsbogen',
		kategorie: 'Sachunterricht',
		suchbegriffe: ['Tabelle', 'Forschen', 'Versuch'],
		ort: 'seite',
		faecher: ['sachunterricht'],
		teile: ['aufgabe', 'tabelle-beobachtung'],
		anweisung: 'Beobachte und notiere.',
	},
];

/**
 * Reihenfolge im Angebot (203-11): je Kategorie so, wie man die Bausteine sucht, nicht wie sie in der Quelle stehen.
 * Aufgabenpakete stehen in der Schublade danach unter „Fertige Aufgaben“.
 */
export const REIHENFOLGE: readonly string[] = [
	// Blatt
	...['namenszeile', 'kopf', 'tipp', 'platzhalter', 'flaeche', 'fuss', 'abschluss', 'auswertung'],
	// Aufgaben
	...['aufgabe', 'text', 'reihe', 'tabelle', 'antwort', 'schreiblinie', 'x-lineatur', 'malfeld', 'paket-malen'],
	'paket-verlaufsplan',
	// Aufgabenformate
	...['x-lueckentext', 'x-wortspeicher', 'x-ankreuzen', 'x-richtigfalsch', 'x-zuordnen', 'x-sortieren'],
	...['x-beschriften', 'x-schreibrahmen'],
	// Zahlen
	...['x-menge', 'x-zwanzigerfeld', 'x-hunderterfeld', 'x-hundertertafel', 'x-rechenrahmen', 'x-dienes'],
	...['x-strichpunkt', 'x-stellentafel', 'x-zahlenstrahl'],
	// Rechnen
	...['x-rechenreihe', 'x-rechenstrich', 'x-zahlenmauer', 'x-rechendreieck', 'x-zahlenhaus', 'x-zahlenkette'],
	...['x-zauberdreieck', 'x-rechenrad', 'x-punktfeld', 'x-malkreuz', 'x-schriftlich'],
	...['paket-sachaufgabe', 'paket-rechenuebersicht', 'paket-wertetabelle'],
	// Geometrie
	...['x-figur', 'x-gitter', 'x-symmetrie-sortieren', 'x-tangram', 'x-koerper', 'x-wuerfelbau', 'x-wuerfelnetz'],
	// Größen
	...['x-uhr', 'paket-uhr', 'x-zeitspanne', 'x-kalender', 'x-geld', 'x-skala', 'x-strecke'],
	// Daten und Zufall
	...['x-strichliste', 'x-diagramm', 'paket-diagramm', 'x-wuerfel', 'x-gluecksrad', 'x-urne'],
	...['x-wahrscheinlichkeit', 'x-kombinatorik'],
	// Deutsch
	...['lesetext-zeilennummern', 'x-silben', 'x-wortarten', 'x-satzglieder', 'x-wortbausteine'],
	// Sachunterricht
	...['paket-vermutung', 'paket-beobachtung', 'x-zeitleiste', 'x-jahreskreis', 'x-windrose', 'x-plan'],
	...['x-schaltplan', 'x-kreislauf', 'x-verkehrszeichen', 'x-wetter'],
	// Musik
	...['x-rhythmus', 'x-noten', 'rhythmuskarten'],
	// Spiele und Rätsel
	...['x-suchsel', 'x-kreuzwort', 'x-loesungswort', 'x-bingo', 'x-domino', 'x-spielplan', 'karten'],
	// Folien
	...['folie-bild', 'vermutung', 'folie-schritte', 'folie-merksatz', 'folie-arbeitszeit', 'x-timer', 'notiz'],
];

/** Kategorie der eigenen Bausteine (051); sie steht nur da, wenn es welche gibt. */
export const MEINE_BAUSTEINE = 'Meine Bausteine';
/** Die Zeile der eigenen Bausteine; Namen wie in `BEREICH_SYMBOL`. */
export const MEINE_BAUSTEINE_SYMBOL = 'stern';

const nameImRegister = (art: string) => BAUSTEINE.find((b) => b.art === art)?.name;

const stelleIn = (e: KatalogEintrag) => {
	const i = REIHENFOLGE.indexOf(e.id);
	return KATALOG_KATEGORIEN.indexOf(e.kategorie) * 1000 + (i < 0 ? 999 : i);
};

/**
 * Die ganze Liste, auch was nicht mehr angeboten wird (Suche per Kennung, Vorschau). Jedes Element aus dem Schema steht
 * mit Name und Angaben aus seinem Schema-Eintrag darin. Sortiert nach Kategorie und `REIHENFOLGE`.
 */
export const KATALOG: readonly KatalogEintrag[] = [
	...KIT_KATALOG.map(({ art, id, klasse, name, ...angaben }): KatalogEintrag => {
		const anzeige = name ?? (art === undefined ? undefined : nameImRegister(art));
		if (anzeige === undefined) {
			throw new Error(`Kit-Baustein ${id} hat keinen Namen.`);
		}
		return { ...angaben, id, name: anzeige, herkunft: 'kit', ...(klasse ? { klasse } : { starter: id }) };
	}),
	...(Object.entries(ABBILDUNG_SCHEMA) as [string, AbbildungSchema][]).flatMap(([tag, { anzeige, katalog, name }]) =>
		katalog ? [{ ...katalog, id: tag, name: anzeige ?? name, herkunft: 'abbildung' as const, starter: tag }] : [],
	),
	...AUFGABENPAKETE.map((p): KatalogEintrag => ({ ...p, herkunft: 'paket' })),
].toSorted((a, b) => stelleIn(a) - stelleIn(b));

/** Was Schublade, Schnellauswahl, Slash und Palette anbieten (203-04). */
export const istAngeboten = (e: Pick<KatalogEintrag, 'angeboten'>) => e.angeboten !== false;
export const ANGEBOT: readonly KatalogEintrag[] = KATALOG.filter(istAngeboten);

export interface FuerBlatt {
	fach: Fach;
	klasse: Klasse;
	art: Art;
}

/** „Für dieses Blatt“: Fach, Klasse und Materialart passen. Ohne Angabe am Eintrag passt alles. */
export const passtZuBlatt = (e: Pick<KatalogEintrag, 'arten' | 'faecher' | 'klassen'>, b: FuerBlatt) =>
	(!e.faecher || e.faecher.includes(b.fach)) &&
	(!e.klassen || e.klassen.includes(b.klasse)) &&
	(!e.arten || e.arten.includes(b.art));

/**
 * Der harte Filter (203-02, 203-N01): Was in diesem Blatt nicht fehlerfrei zeichnet, bietet kein Weg an, weder „Alle“
 * noch Suche, Schnellauswahl, Slash, Palette oder „Zuletzt“. Das sind Einträge außerhalb ihrer `klassen` (die
 * Zeichnung meldet sonst den Zahlenraum als Fehler) und Folien außerhalb ihrer `arten` (sie brauchen eine Folie).
 * Fach und die übrigen `arten` bleiben weich (`passtZuBlatt`).
 */
export const gehtImBlatt = (
	e: Pick<KatalogEintrag, 'arten' | 'kategorie' | 'klassen'>,
	b: Pick<FuerBlatt, 'art' | 'klasse'>,
) => (!e.klassen || e.klassen.includes(b.klasse)) && (e.kategorie !== 'Folien' || !e.arten || e.arten.includes(b.art));

const FAECHER_DER_BIBLIOTHEK: readonly Kategorie[] = KATALOG_BEREICHE[1].bereiche;
const VORNE: readonly Kategorie[] = ['Aufgaben', 'Aufgabenformate'];
const HINTEN: readonly Kategorie[] = ['Blatt', 'Spiele und Rätsel', 'Folien'];

/**
 * Reihenfolge ohne Suchwort für Schnellauswahl, Slash und Palette (203-13): Aufgaben, Aufgabenformate, die Kategorien
 * des Fachs, die übrigen Fächer, dann Blatt, Spiele und Rätsel, Folien; eigene Bausteine zuletzt.
 */
export const kategorienFuer = (fach: Fach, eintraege: readonly KatalogEintrag[] = ANGEBOT): readonly Kategorie[] => {
	const desFachs = FAECHER_DER_BIBLIOTHEK.filter((k) =>
		eintraege.some((e) => e.kategorie === k && e.faecher?.includes(fach)),
	);
	return [...VORNE, ...desFachs, ...FAECHER_DER_BIBLIOTHEK.filter((k) => !desFachs.includes(k)), ...HINTEN];
};

/** Wer „loschen“ oder „grosse“ tippt, meint „Löschen“ und „Größe“. */
export const suchform = (t: string) =>
	t.toLocaleLowerCase('de').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

/** Sucht über Name und Suchbegriffe, Name zuerst. Mehrere Wörter müssen alle passen. */
export const sucheImKatalog = <T extends KatalogEintrag>(
	anfrage: string,
	eintraege: readonly T[] = ANGEBOT as readonly T[],
): T[] => {
	const woerter = suchform(anfrage).split(/\s+/).filter(Boolean);
	if (woerter.length === 0) {
		return [...eintraege];
	}
	const treffer = eintraege.filter((e) => {
		const text = suchform([e.name, ...e.suchbegriffe].join(' '));
		return woerter.every((w) => text.includes(w));
	});
	const imNamen = (e: KatalogEintrag) => woerter.every((w) => suchform(e.name).includes(w));
	return [...treffer.filter(imNamen), ...treffer.filter((e) => !imNamen(e))];
};

/**
 * Die Liste der Schnellauswahl, des Slash-Menüs und der Palette (203-13). Ohne Suchwort nur, was zum Blatt passt, in
 * der Reihenfolge von `kategorienFuer`; mit Suchwort alle Treffer im Angebot, die passenden zuerst. `ohne`: Kategorien,
 * die an diesem Ort nichts zu suchen haben (das Slash-Menü steht im Text einer Aufgabe).
 */
export const angebotFuerBlatt = <T extends KatalogEintrag>(
	angebot: readonly T[],
	b: FuerBlatt,
	anfrage = '',
	ohne: readonly Kategorie[] = [],
): T[] => {
	const hier = angebot.filter((e) => !(ohne as readonly string[]).includes(e.kategorie));
	if (anfrage.trim()) {
		const treffer = sucheImKatalog(anfrage, hier);
		return [...treffer.filter((e) => passtZuBlatt(e, b)), ...treffer.filter((e) => !passtZuBlatt(e, b))];
	}
	const ordnung = kategorienFuer(b.fach, hier) as readonly string[];
	const rang = (e: T) => (ordnung.includes(e.kategorie) ? ordnung.indexOf(e.kategorie) : ordnung.length);
	return hier.filter((e) => passtZuBlatt(e, b)).toSorted((x, y) => rang(x) - rang(y));
};
