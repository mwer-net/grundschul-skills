import { kann, kannImFormat } from '@schoolbox/kern/src/bausteine';
import {
	KIT_FELDER,
	leseKit,
	leseSichtbarkeit,
	setzeKit,
	setzeSichtbarkeit,
	SICHTBARKEITEN,
	sichtbarkeitFest,
} from '@schoolbox/kern/src/kit-einstellungen';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import { SPALTEN } from '@schoolbox/kern/src/struktur';
import {
	fuegeSpalteEin,
	fuegeZeileEin,
	groesseVon,
	loescheSpalte,
	loescheZeile,
	setzeGroesse,
} from '@schoolbox/kern/src/tabelle';
import type { Druckprofil } from '@schoolbox/kern/src/werte';

import { istMac, kuerzelAnzeige } from '../bausteine/kuerzel';
import type { MenueEintrag } from '../bausteine/Menue';
import type { SymbolName } from '../bausteine/Symbol';
import type { PfadTeil } from './darstellung';
import { GESTALTUNG_BEFEHLE } from './gestaltung/befehle';
import { dupliziereAlle, loescheAlle, mehrereGewaehlt } from './gestaltung/befehle/bewegen'; // 113
import type { GestaltungKontext } from './gestaltung/kontext';
import { WERKZEUG_BEFEHLE } from './gestaltung/werkzeuge/befehle';
import { JEDE_LAGE, schubladeVon } from './schubladen';
import type { SchubladenId } from './schubladen/reihe';
import { befehlZuSchublade, REIHE } from './schubladen/reihe';
import type { Struktur, StrukturWerte } from './struktur';

/** `gestaltung`: im ⋯ der Leiste am Element (099), Reihenfolge aus `gestaltung/leiste/mehr.ts`. */
export type Ort = 'taste' | 'menue' | 'leiste' | 'palette' | 'gestaltung';
export type Gruppe = 'bearbeiten' | 'ablage' | 'ordnen' | 'baustein' | 'gefahr' | 'ansicht' | 'blatt' | 'dokument';
/** In welchem Zustand des Editors ein Kürzel wirkt. `text` gilt auch für Felder der Bedienung. */
export type Modus = 'auswahl' | 'ohne' | 'text';

const GRUPPEN: Gruppe[] = ['bearbeiten', 'ablage', 'ordnen', 'baustein', 'ansicht', 'blatt', 'dokument', 'gefahr'];

export interface Kuerzel {
	/** `e.code` für Buchstaben und Ziffern mit ⌥ oder ⌘; `e.key` für Zeichen wie `/`, `?`, `+`. */
	code?: string;
	key?: string;
	/** ⌘ oder Strg. */
	befehl?: boolean;
	/** ⌥ */
	wahl?: boolean;
	/** ⇧ */
	umschalt?: boolean;
	/** Nur unter dieser Bedingung, z. B. ⌥← nur bei nebeneinander liegenden Gliedern. */
	wenn?: (k: Kontext) => boolean;
}

/** Was die Befehle tun können. Die Logik bleibt in den Hooks, das Register ruft sie nur. */
export interface Aktionen {
	struktur: Pick<
		Struktur,
		'verschiebe' | 'dupliziere' | 'loesche' | 'neueSeite' | 'fuehreAus' | 'aendereAttribute' | 'spalten'
	>;
	fokussiereText: () => void;
	waehle: (nr: number | null) => void;
	eineEbeneHoch: () => void;
	nachbar: (richtung: 1 | -1) => void;
	erstesKind: () => void;
	ersterBaustein: () => void;
	kopiere: () => void;
	schneideAus: () => void;
	fuegeAblageEin: (nr: number | null) => void;
	inSammlung: () => void;
	neueZahlen: () => boolean;
	oeffneSchnellauswahl: (nr?: number | null) => void;
	bildErsetzen: () => void;
	zurLeiste: () => void;
	fassung: (fassung: 'material' | 'loesung') => void;
	profil: (profil: Druckprofil) => void;
	zoomSchritt: (richtung: 1 | -1) => void;
	zoom100: () => void;
	einpassen: () => void;
	/** Öffnet die Schublade, wechselt zu ihr oder schließt sie, wenn sie schon offen ist. */
	links: (schublade: SchubladenId) => void;
	ebenenAnheften: () => void;
	inspektor: () => void;
	versionen: () => void;
	claude: () => void;
	/** Kopiert die Referenz fürs Einfügen im Chat, bis 074 den Chat ans Gewählte bindet. */
	claudeApp: () => void;
	claudeZurAuswahl: () => void;
	palette: () => void;
	tasten: () => void;
	rueckgaengig: () => void;
	wiederholen: () => void;
	speichern: () => void;
	pdf: () => void;
	drucken: () => void;
	praesentieren: () => void;
	zurueck: () => void;
	hilfe: () => void;
}

export interface Kontext {
	pfad: PfadTeil[];
	format: string;
	/** Struktur darf geändert werden: keine Vorschau, kein Konflikt, keine Textsitzung. */
	aktiv: boolean;
	frei: boolean;
	textsitzung: boolean;
	quelle: string | null;
	werte: StrukturWerte | null;
	mitLoesung: boolean;
	loesung: boolean;
	profil: Druckprofil | undefined;
	hatAblage: boolean;
	hatNeueZahlen: boolean;
	kiVerfuegbar: boolean;
	/** Warum „Claude“ am Element gerade nicht geht, etwa weil schon alle Gespräche belegt sind (135); sonst `null`. */
	claudeGrund: string | null;
	namenszeile: boolean;
	festeSeiten: boolean;
	hatBild: boolean;
	ebenenAngeheftet: boolean;
	/** Die offene Schublade, sonst `null`. */
	linksOffen: SchubladenId | null;
	/** Das Geschwister davor: „Baustein davor“ fügt dahinter ein. */
	davor: number | null;
	/** Text ist markiert: ⌘C und ⌘X bleiben dann dem Browser. */
	textMarkiert: () => boolean;
	/** Der Fokus steht in einem Feld, das ⌘Z selbst braucht: Chat, Suche oder ein geändertes Textfeld. */
	feldBehaeltUndo: () => boolean;
	/** Das gewählte Gestaltungselement, sonst `null` (097). */
	gestaltung: GestaltungKontext | null;
	tu: Aktionen;
}

export interface Befehl {
	id: string;
	titel: string | ((k: Kontext) => string);
	gruppe: Gruppe;
	symbol?: SymbolName | ((k: Kontext) => SymbolName);
	/** Der erste wird angezeigt, weitere sind Ausweichtasten. */
	kuerzel?: Kuerzel[];
	/** Ohne Angabe: mit und ohne Auswahl, nicht beim Tippen. */
	modus?: Modus[];
	/** Sonst bleibt die Taste beim Browser. Anders als `verfuegbar` gilt das nur für die Taste, nicht für den Pfeil. */
	tasteWenn?: (k: Kontext) => boolean;
	suchwoerter?: string[];
	orte: Ort[];
	/** Wo das ohne Taste und Rechtsklick erreichbar ist. Pflicht: Grundsatz der Phase 9. */
	sichtbarUnter: 'kopf' | 'statusleiste' | 'leiste' | 'mehr' | 'inspektor' | 'links' | 'blatt';
	gefahr?: boolean;
	verfuegbar: (k: Kontext) => boolean;
	/** `taste`: das Ereignis, wenn eine Taste den Befehl auslöste (Werkzeuge halten mit ⇧, 098). */
	aus: (k: Kontext, taste?: KeyboardEvent) => unknown;
	/** Im Menü nur dann, auch wenn der Befehl sonst verfügbar ist. */
	imMenue?: (k: Kontext) => boolean;
	/** Eintrag gesperrt statt ausgeblendet: ↑ und ↓ bleiben an ihrem Platz. */
	gesperrt?: (k: Kontext) => boolean;
	/** Sagt, warum ein Kürzel gerade nichts tut, statt still zu bleiben. */
	warumNicht?: (k: Kontext) => string | null;
	/** Spezifischer Eintrag der Leiste am Baustein, mit diesem kurzen Namen. */
	leisteTitel?: string;
	leisteWenn?: (k: Kontext) => boolean;
	/** Einträge mit gleichem Wert stehen im Menü in einem Untermenü. */
	untermenue?: string;
	aktiv?: (k: Kontext) => boolean;
	/** Leise neben dem Titel in der Palette, z. B. `4 → 5`. */
	notiz?: (k: Kontext) => string;
	/** Ohne Angabe immer. Sonst nur dann in Tastenübersicht und Hilfe: Platzhalter-Schubladen erscheinen nirgends. */
	inUebersicht?: () => boolean;
}

const gewaehlt = (k: Kontext) => k.pfad.at(-1);
const istSeite = (k: Kontext) => gewaehlt(k)?.baustein.art === 'seite';
/** 47: Bei Mehrfachauswahl gibt es Claude nicht. */
const mehrfach = (k: Kontext) => (k.gestaltung?.nrn.length ?? 0) > 1;
const einzigeSeite = (k: Kontext) => istSeite(k) && (k.werte?.seiten ?? 0) <= 1;
const inZelle = (k: Kontext) => k.aktiv && ['tabellenzelle', 'tabellenzeile'].includes(gewaehlt(k)?.baustein.art ?? '');
const istTabelle = (k: Kontext) => k.aktiv && gewaehlt(k)?.baustein.art === 'tabelle';
const kannText = (k: Kontext) => {
	const g = gewaehlt(k);
	return k.frei && Boolean(g && kann(g.baustein, 'text'));
};
const kannDas = (k: Kontext, was: 'loeschen' | 'duplizieren') => {
	const g = gewaehlt(k);
	return k.aktiv && Boolean(g && kannImFormat(g.baustein, was, k.format));
};

const tabelle =
	(
		id: string,
		titel: string,
		beschreibung: string,
		rechne: (q: string, nr: number, n: { jeSeite: boolean }) => StrukturErgebnis,
	) =>
	(orte: Ort[], gefahr = false, mehr: Partial<Befehl> = {}): Befehl => ({
		id,
		titel,
		gruppe: gefahr ? 'gefahr' : 'bearbeiten',
		symbol: gefahr ? 'minus' : 'plus',
		orte,
		sichtbarUnter: 'inspektor',
		gefahr,
		verfuegbar: inZelle,
		aus: (k) => {
			const g = gewaehlt(k);
			if (g) {
				k.tu.struktur.fuehreAus(beschreibung, (q) => rechne(q, g.nr, { jeSeite: k.format === 'folie' }));
			}
		},
		...mehr,
	});

/** Die ganze Tabelle ist gewählt: Es gibt keine Stelle, also kommt die neue Zeile bzw. Spalte ans Ende. */
const anTabelle =
	(was: 'zeilen' | 'spalten') =>
	(k: Kontext): void => {
		const g = gewaehlt(k);
		if (!g) {
			return;
		}
		const n = { jeSeite: k.format === 'folie' };
		k.tu.struktur.fuehreAus('Tabellengröße geändert', (q) =>
			setzeGroesse(q, g.nr, { [was]: groesseVon(q, g.nr)[was] + 1 }, n),
		);
	};

const SICHTBARKEIT: Befehl[] = SICHTBARKEITEN.map((s) => ({
	id: `auswahl.sichtbarkeit.${s.wert || 'beide'}`,
	titel: s.titel,
	gruppe: 'ordnen',
	orte: ['menue', 'palette'],
	sichtbarUnter: 'inspektor',
	untermenue: 'Sichtbarkeit',
	suchwoerter: ['sichtbarkeit', 'verstecken', 'ausblenden', 'zeigen'],
	notiz: () => 'Sichtbarkeit',
	aktiv: (k) => {
		const g = gewaehlt(k);
		return Boolean(g && k.quelle !== null && leseSichtbarkeit(k.quelle, g.nr) === s.wert);
	},
	verfuegbar: (k) => {
		const g = gewaehlt(k);
		return (
			k.aktiv &&
			Boolean(
				g &&
				kann(g.baustein, 'ordnen') &&
				g.baustein.art !== 'seite' &&
				k.quelle !== null &&
				!sichtbarkeitFest(k.quelle, g.nr),
			)
		);
	},
	aus: (k) => {
		const g = gewaehlt(k);
		if (g) {
			k.tu.struktur.aendereAttribute('Sichtbarkeit geändert', (q) => setzeSichtbarkeit(q, g.nr, s.wert));
		}
	},
}));

const spaltenBefehl = (id: string, titel: string, schritt: 1 | -1, suchwoerter: string[]): Befehl => {
	const ziel = (k: Kontext) => (k.werte?.spalten?.wert ?? 0) + schritt;
	return {
		id,
		titel,
		gruppe: 'bearbeiten',
		symbol: schritt > 0 ? 'plus' : 'minus',
		suchwoerter,
		orte: ['palette'],
		sichtbarUnter: 'inspektor',
		notiz: (k) => `${k.werte?.spalten?.wert ?? ''} → ${ziel(k)}`,
		verfuegbar: (k) => k.aktiv && Boolean(k.werte?.spalten) && ziel(k) >= SPALTEN.min && ziel(k) <= SPALTEN.max,
		aus: (k) => {
			const spalten = k.werte?.spalten;
			return spalten && k.tu.struktur.spalten(spalten.nr, ziel(k));
		},
	};
};

/** Suchwörter je Schublade; „gliederung“ bleibt, damit die alte Suche weiter trifft. */
const SCHUBLADEN_SUCHE: Partial<Record<SchubladenId, string[]>> = {
	ebenen: ['gliederung', 'seiten', 'aufgaben', 'baum', 'navigation'],
	bilder: ['foto', 'hochladen', 'sammlung'],
};

/**
 * Je Schublade ein Befehl, ⌥1 bis ⌥7 über `code`. Die Taste ist reserviert, auch solange die Schublade noch nicht
 * bereit ist; dann tut sie nichts. `bereit` wird erst beim Aufruf gelesen: Die Schubladen hängen an Komponenten, die
 * ihrerseits dieses Register brauchen können.
 */
const SCHUBLADEN_BEFEHLE: Befehl[] = REIHE.map(({ id, symbol, taste, titel }): Befehl => ({
	id: befehlZuSchublade(id),
	titel,
	gruppe: 'ansicht',
	symbol,
	...(SCHUBLADEN_SUCHE[id] ? { suchwoerter: SCHUBLADEN_SUCHE[id] } : {}),
	kuerzel: [{ code: taste, wahl: true }],
	orte: ['taste', 'palette'],
	sichtbarUnter: 'links',
	verfuegbar: (k) => schubladeVon(id)?.bereit(k) ?? false,
	aus: (k) => k.tu.links(id),
	aktiv: (k) => k.linksOffen === id,
	inUebersicht: () => schubladeVon(id)?.bereit(JEDE_LAGE) ?? false,
}));

export const BEFEHLE: Befehl[] = [
	// Auswahl
	{
		id: 'auswahl.bearbeiten',
		titel: (k) => (kannText(k) ? 'Text bearbeiten' : 'Erstes Teil wählen'),
		gruppe: 'bearbeiten',
		symbol: 'stift',
		kuerzel: [{ key: 'Enter' }],
		modus: ['auswahl'],
		orte: ['taste', 'menue', 'palette'],
		sichtbarUnter: 'inspektor',
		verfuegbar: (k) => Boolean(gewaehlt(k)),
		imMenue: kannText,
		aus: (k) => (kannText(k) ? k.tu.fokussiereText() : k.tu.erstesKind()),
	},
	{
		id: 'auswahl.neue-zahlen',
		titel: 'Neue Zahlen',
		gruppe: 'bearbeiten',
		symbol: 'neueZahlen',
		kuerzel: [{ code: 'KeyN', wahl: true }],
		modus: ['auswahl'],
		suchwoerter: ['würfeln', 'neu', 'zufall'],
		orte: ['taste', 'menue', 'leiste', 'palette'],
		sichtbarUnter: 'leiste',
		leisteTitel: 'Neue Zahlen',
		verfuegbar: (k) => k.aktiv && k.hatNeueZahlen,
		aus: (k) => k.tu.neueZahlen(),
	},
	spaltenBefehl('auswahl.spalten-mehr', 'Spalten erhöhen', 1, ['mehr', 'breiter', 'nebeneinander']),
	spaltenBefehl('auswahl.spalten-weniger', 'Spalten verringern', -1, ['weniger', 'schmaler']),
	tabelle('tabelle.zeile-danach', 'Zeile danach', 'Zeile eingefügt', (q, nr, n) => fuegeZeileEin(q, nr, 'nach', n))(
		['menue', 'leiste', 'palette'],
		false,
		{
			leisteTitel: 'Zeile',
			verfuegbar: (k) => inZelle(k) || istTabelle(k),
			aus: (k) =>
				istTabelle(k)
					? anTabelle('zeilen')(k)
					: k.tu.struktur.fuehreAus('Zeile eingefügt', (q) =>
							fuegeZeileEin(q, gewaehlt(k)?.nr ?? 0, 'nach', { jeSeite: k.format === 'folie' }),
						),
		},
	),
	tabelle('tabelle.spalte-danach', 'Spalte danach', 'Spalte eingefügt', (q, nr, n) =>
		fuegeSpalteEin(q, nr, 'nach', n),
	)(['menue', 'leiste', 'palette'], false, {
		leisteTitel: 'Spalte',
		leisteWenn: istTabelle,
		verfuegbar: (k) => inZelle(k) || istTabelle(k),
		aus: (k) =>
			istTabelle(k)
				? anTabelle('spalten')(k)
				: k.tu.struktur.fuehreAus('Spalte eingefügt', (q) =>
						fuegeSpalteEin(q, gewaehlt(k)?.nr ?? 0, 'nach', { jeSeite: k.format === 'folie' }),
					),
	}),
	{
		id: 'auswahl.bild-ersetzen',
		titel: 'Bild ersetzen',
		gruppe: 'bearbeiten',
		symbol: 'bild',
		orte: ['menue', 'leiste', 'palette'],
		sichtbarUnter: 'inspektor',
		leisteTitel: 'Ersetzen',
		verfuegbar: (k) => k.aktiv && k.hatBild,
		aus: (k) => k.tu.bildErsetzen(),
	},
	tabelle('tabelle.zeile-davor', 'Zeile davor', 'Zeile eingefügt', (q, nr, n) => fuegeZeileEin(q, nr, 'vor', n))([
		'menue',
		'palette',
	]),
	tabelle('tabelle.spalte-davor', 'Spalte davor', 'Spalte eingefügt', (q, nr, n) => fuegeSpalteEin(q, nr, 'vor', n))([
		'menue',
		'palette',
	]),
	{
		id: 'auswahl.duplizieren',
		titel: 'Duplizieren',
		gruppe: 'ablage',
		symbol: 'duplizieren',
		// Safari kann ⌘D für Lesezeichen behalten; die Tastenprobe am Mac steht aus (069).
		kuerzel: [
			{ code: 'KeyD', befehl: true, umschalt: true },
			{ code: 'KeyD', befehl: true },
		],
		modus: ['auswahl'],
		suchwoerter: ['kopie', 'verdoppeln'],
		orte: ['taste', 'menue', 'leiste', 'palette', 'gestaltung'],
		sichtbarUnter: 'leiste',
		verfuegbar: (k) => kannDas(k, 'duplizieren'),
		warumNicht: (k) => (gewaehlt(k) && k.frei ? `${gewaehlt(k)?.name} lässt sich nicht duplizieren.` : null),
		aus: (k) => {
			if (mehrereGewaehlt(k.gestaltung)) {
				return dupliziereAlle(k.gestaltung); // 113
			}
			const g = gewaehlt(k);
			return g && k.tu.struktur.dupliziere(g.nr);
		},
	},
	{
		id: 'auswahl.ausschneiden',
		titel: 'Ausschneiden',
		gruppe: 'ablage',
		symbol: 'ausschneiden',
		kuerzel: [{ code: 'KeyX', befehl: true, wenn: (k) => !k.textMarkiert() }],
		modus: ['auswahl'],
		orte: ['taste', 'menue', 'leiste', 'palette'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => kannDas(k, 'loeschen') && !istSeite(k),
		aus: (k) => k.tu.schneideAus(),
	},
	{
		id: 'auswahl.kopieren',
		titel: 'Kopieren',
		gruppe: 'ablage',
		symbol: 'kopieren',
		kuerzel: [{ code: 'KeyC', befehl: true, wenn: (k) => !k.textMarkiert() }],
		modus: ['auswahl'],
		orte: ['taste', 'menue', 'leiste', 'palette', 'gestaltung'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => k.aktiv && Boolean(gewaehlt(k)) && !istSeite(k),
		aus: (k) => k.tu.kopiere(),
	},
	{
		id: 'auswahl.einfuegen',
		titel: (k) => (gewaehlt(k) && !istSeite(k) ? 'Darunter einfügen' : 'Hier einfügen'),
		gruppe: 'ablage',
		symbol: 'hochladen',
		kuerzel: [{ code: 'KeyV', befehl: true }],
		suchwoerter: ['ablage', 'zwischenablage', 'hinzufügen', 'neu'],
		orte: ['taste', 'menue', 'leiste', 'palette'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => k.aktiv && k.hatAblage,
		warumNicht: (k) => (k.aktiv ? 'In der Ablage liegt nichts.' : null),
		aus: (k) => k.tu.fuegeAblageEin(gewaehlt(k)?.nr ?? null),
	},
	{
		id: 'auswahl.einfuegen-davor',
		titel: 'Baustein davor',
		gruppe: 'ablage',
		symbol: 'plus',
		orte: ['menue', 'palette'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => k.aktiv && k.davor !== null,
		aus: (k) => k.tu.oeffneSchnellauswahl(k.davor),
	},
	{
		id: 'auswahl.hoch',
		titel: (k) => (k.werte?.nach?.quer ? 'Nach links' : 'Nach oben'),
		gruppe: 'ordnen',
		symbol: (k) => (k.werte?.nach?.quer ? 'links' : 'hoch'),
		kuerzel: [
			{ key: 'ArrowUp', wahl: true },
			{ key: 'ArrowLeft', wahl: true, wenn: (k) => Boolean(k.werte?.nach?.quer) },
		],
		modus: ['auswahl'],
		suchwoerter: ['verschieben', 'links', 'oben'],
		orte: ['taste', 'menue', 'leiste', 'palette'],
		sichtbarUnter: 'leiste',
		verfuegbar: (k) => k.aktiv && Boolean(k.werte?.nach),
		gesperrt: (k) => !k.werte?.nach?.zurueck,
		aus: (k) => {
			const g = gewaehlt(k);
			const ziel = k.werte?.nach?.zurueck;
			if (g && ziel) {
				k.tu.struktur.verschiebe(g.nr, ziel, true);
			}
		},
	},
	{
		id: 'auswahl.runter',
		titel: (k) => (k.werte?.nach?.quer ? 'Nach rechts' : 'Nach unten'),
		gruppe: 'ordnen',
		symbol: (k) => (k.werte?.nach?.quer ? 'rechts' : 'runter'),
		kuerzel: [
			{ key: 'ArrowDown', wahl: true },
			{ key: 'ArrowRight', wahl: true, wenn: (k) => Boolean(k.werte?.nach?.quer) },
		],
		modus: ['auswahl'],
		suchwoerter: ['verschieben', 'rechts', 'unten'],
		orte: ['taste', 'menue', 'leiste', 'palette'],
		sichtbarUnter: 'leiste',
		verfuegbar: (k) => k.aktiv && Boolean(k.werte?.nach),
		gesperrt: (k) => !k.werte?.nach?.vor,
		aus: (k) => {
			const g = gewaehlt(k);
			const ziel = k.werte?.nach?.vor;
			if (g && ziel) {
				k.tu.struktur.verschiebe(g.nr, ziel, true);
			}
		},
	},
	...SICHTBARKEIT,
	{
		id: 'auswahl.in-sammlung',
		titel: 'In Sammlung legen',
		gruppe: 'ordnen',
		symbol: 'plus',
		suchwoerter: ['meine bausteine', 'merken', 'speichern'],
		orte: ['menue', 'leiste', 'palette'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => k.aktiv && Boolean(gewaehlt(k)) && !istSeite(k),
		aus: (k) => k.tu.inSammlung(),
	},
	{
		id: 'auswahl.claude',
		titel: 'Mit Claude ändern …',
		gruppe: 'ordnen',
		symbol: 'sprechblase',
		suchwoerter: ['ki', 'chat', 'frage'],
		orte: ['menue', 'leiste', 'palette', 'gestaltung'],
		sichtbarUnter: 'leiste',
		verfuegbar: (k) => k.kiVerfuegbar && k.frei && Boolean(gewaehlt(k)) && !mehrfach(k),
		gesperrt: (k) => k.claudeGrund !== null,
		warumNicht: (k) => k.claudeGrund,
		aus: (k) => k.tu.claudeZurAuswahl(),
	},
	{
		id: 'auswahl.stern',
		titel: 'Sternchenaufgabe',
		gruppe: 'bearbeiten',
		symbol: 'stern',
		orte: ['menue', 'palette'],
		sichtbarUnter: 'leiste',
		verfuegbar: (k) => {
			const g = gewaehlt(k);
			return k.aktiv && Boolean(g && KIT_FELDER[g.baustein.art]?.some((f) => f.name === 'stern'));
		},
		aktiv: (k) => {
			const g = gewaehlt(k);
			return Boolean(g && k.quelle && leseKit(k.quelle, g.nr, g.baustein.art).stern === true);
		},
		aus: (k) => {
			const g = gewaehlt(k);
			if (!g || !k.quelle) {
				return;
			}
			const an = leseKit(k.quelle, g.nr, g.baustein.art).stern === true;
			k.tu.struktur.aendereAttribute('Sternchenaufgabe geändert', (q) =>
				setzeKit(q, g.nr, g.baustein.art, 'stern', !an, { jeSeite: k.format === 'folie' }),
			);
		},
	},
	{
		id: 'auswahl.aufheben',
		titel: 'Auswahl aufheben',
		gruppe: 'baustein',
		symbol: 'schliessen',
		orte: ['palette'],
		sichtbarUnter: 'inspektor',
		verfuegbar: (k) => Boolean(gewaehlt(k)),
		aus: (k) => k.tu.waehle(null),
	},
	{
		id: 'auswahl.eltern',
		titel: 'Eine Ebene höher',
		gruppe: 'baustein',
		kuerzel: [{ key: 'Escape' }],
		modus: ['auswahl'],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'inspektor',
		verfuegbar: (k) => Boolean(gewaehlt(k)),
		aus: (k) => k.tu.eineEbeneHoch(),
	},
	{
		id: 'auswahl.vorheriger',
		titel: 'Vorheriger Baustein',
		gruppe: 'baustein',
		kuerzel: [{ key: 'ArrowUp' }, { key: 'ArrowLeft' }],
		modus: ['auswahl'],
		orte: ['taste'],
		sichtbarUnter: 'blatt',
		verfuegbar: (k) => Boolean(gewaehlt(k)),
		aus: (k) => k.tu.nachbar(-1),
	},
	{
		id: 'auswahl.naechster',
		titel: 'Nächster Baustein',
		gruppe: 'baustein',
		kuerzel: [{ key: 'ArrowDown' }, { key: 'ArrowRight' }],
		modus: ['auswahl'],
		orte: ['taste'],
		sichtbarUnter: 'blatt',
		verfuegbar: (k) => Boolean(gewaehlt(k)),
		aus: (k) => k.tu.nachbar(1),
	},
	{
		id: 'auswahl.zur-leiste',
		titel: 'Zur Leiste am Baustein',
		gruppe: 'baustein',
		kuerzel: [{ key: 'Tab' }],
		modus: ['auswahl'],
		orte: ['taste'],
		sichtbarUnter: 'leiste',
		verfuegbar: (k) => Boolean(gewaehlt(k)),
		aus: (k) => k.tu.zurLeiste(),
	},
	{
		id: 'blatt.erster',
		titel: 'Ersten Baustein wählen',
		gruppe: 'blatt',
		kuerzel: [{ key: 'ArrowDown' }, { key: 'Enter' }],
		modus: ['ohne'],
		orte: ['taste'],
		sichtbarUnter: 'blatt',
		verfuegbar: () => true,
		aus: (k) => k.tu.ersterBaustein(),
	},
	{
		id: 'auswahl.einfuegen-danach',
		titel: 'Baustein einfügen',
		gruppe: 'blatt',
		symbol: 'plus',
		kuerzel: [{ key: '/' }],
		suchwoerter: ['neu', 'hinzufügen', 'slash'],
		orte: ['taste', 'menue', 'palette'],
		sichtbarUnter: 'links',
		verfuegbar: (k) => k.aktiv,
		aus: (k) => k.tu.oeffneSchnellauswahl(),
	},
	{
		id: 'auswahl.loeschen',
		titel: 'Löschen',
		gruppe: 'gefahr',
		symbol: 'papierkorb',
		kuerzel: [{ key: 'Backspace' }, { key: 'Delete' }],
		modus: ['auswahl'],
		suchwoerter: ['entfernen', 'weg', 'wegmachen'],
		orte: ['taste', 'menue', 'leiste', 'palette', 'gestaltung'],
		sichtbarUnter: 'leiste',
		gefahr: true,
		verfuegbar: (k) => kannDas(k, 'loeschen') && !einzigeSeite(k),
		warumNicht: (k) => {
			const g = gewaehlt(k);
			if (!g || !k.frei) {
				return null;
			}
			return einzigeSeite(k) ? 'Die einzige Seite bleibt.' : `${g.name} lässt sich nicht löschen.`;
		},
		aus: (k) => {
			if (mehrereGewaehlt(k.gestaltung)) {
				return loescheAlle(k.gestaltung); // 113
			}
			const g = gewaehlt(k);
			return g && k.tu.struktur.loesche(g.nr, g.name);
		},
	},
	tabelle('tabelle.zeile-weg', 'Zeile löschen', 'Zeile gelöscht', (q, nr, n) => loescheZeile(q, nr, n))(
		['menue', 'leiste', 'palette'],
		true,
		{ leisteTitel: 'Zeile' },
	),
	tabelle('tabelle.spalte-weg', 'Spalte löschen', 'Spalte gelöscht', (q, nr, n) => loescheSpalte(q, nr, n))(
		['menue', 'palette'],
		true,
	),

	// Ansicht
	{
		id: 'ansicht.arbeitsblatt',
		titel: 'Arbeitsblatt zeigen',
		gruppe: 'ansicht',
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: (k) => k.mitLoesung && k.loesung,
		aus: (k) => k.tu.fassung('material'),
	},
	{
		id: 'ansicht.loesung',
		titel: 'Lösung zeigen',
		gruppe: 'ansicht',
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: (k) => k.mitLoesung && !k.loesung,
		aus: (k) => k.tu.fassung('loesung'),
	},
	{
		id: 'ansicht.farbe',
		titel: 'In Farbe zeigen',
		gruppe: 'ansicht',
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: (k) => k.profil === 'sw',
		aus: (k) => k.tu.profil('farbe'),
	},
	{
		id: 'ansicht.sw',
		titel: 'In Schwarz-Weiß zeigen',
		gruppe: 'ansicht',
		suchwoerter: ['grau', 's/w'],
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: (k) => k.profil === 'farbe',
		aus: (k) => k.tu.profil('sw'),
	},
	{
		id: 'ansicht.zoom-rein',
		titel: 'Größer',
		gruppe: 'ansicht',
		symbol: 'plus',
		kuerzel: [{ key: '+' }],
		suchwoerter: ['zoom'],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'statusleiste',
		verfuegbar: () => true,
		aus: (k) => k.tu.zoomSchritt(1),
	},
	{
		id: 'ansicht.zoom-raus',
		titel: 'Kleiner',
		gruppe: 'ansicht',
		symbol: 'minus',
		kuerzel: [{ key: '-' }],
		suchwoerter: ['zoom'],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'statusleiste',
		verfuegbar: () => true,
		aus: (k) => k.tu.zoomSchritt(-1),
	},
	{
		id: 'ansicht.zoom-100',
		titel: 'Auf 100 %',
		gruppe: 'ansicht',
		kuerzel: [{ key: '1' }],
		suchwoerter: ['zoom'],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'statusleiste',
		verfuegbar: () => true,
		aus: (k) => k.tu.zoom100(),
	},
	{
		id: 'ansicht.einpassen',
		titel: 'Einpassen',
		gruppe: 'ansicht',
		symbol: 'vollbild',
		kuerzel: [{ key: '0' }],
		suchwoerter: ['zoom', 'ganze seite'],
		orte: ['taste', 'menue', 'palette'],
		sichtbarUnter: 'statusleiste',
		verfuegbar: () => true,
		aus: (k) => k.tu.einpassen(),
	},
	...SCHUBLADEN_BEFEHLE,
	...WERKZEUG_BEFEHLE,
	{
		id: 'ansicht.ebenen-anheften',
		titel: (k) => (k.ebenenAngeheftet ? 'Ebenen lösen' : 'Ebenen anheften'),
		gruppe: 'ansicht',
		symbol: (k) => (k.ebenenAngeheftet ? 'abheften' : 'anheften'),
		suchwoerter: ['gliederung', 'stecknadel', 'festhalten', 'teilen'],
		orte: ['palette'],
		sichtbarUnter: 'links',
		verfuegbar: () => true,
		aus: (k) => k.tu.ebenenAnheften(),
	},
	{
		id: 'ansicht.inspektor',
		titel: 'Inspektor ein/aus',
		gruppe: 'ansicht',
		kuerzel: [{ code: 'KeyI', wahl: true }],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'statusleiste',
		verfuegbar: () => true,
		aus: (k) => k.tu.inspektor(),
	},
	{
		id: 'ansicht.versionen',
		titel: 'Versionen',
		gruppe: 'ansicht',
		symbol: 'uhr',
		suchwoerter: ['verlauf', 'früher', 'wiederherstellen'],
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: () => true,
		aus: (k) => k.tu.versionen(),
	},
	{
		id: 'dokument.claude-app',
		titel: 'In der Claude-App weiterarbeiten',
		gruppe: 'dokument',
		symbol: 'kopieren',
		suchwoerter: ['ki', 'chat', 'frage', 'referenz', 'kopieren'],
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: (k) => k.frei,
		aus: (k) => k.tu.claudeApp(),
	},
	{
		id: 'ansicht.claude',
		titel: 'Claude',
		gruppe: 'ansicht',
		symbol: 'sprechblase',
		kuerzel: [
			{ code: 'KeyJ', befehl: true },
			{ code: 'KeyJ', befehl: true, umschalt: true },
			{ code: 'KeyC', wahl: true },
		],
		modus: ['auswahl', 'ohne', 'text'],
		suchwoerter: ['ki', 'chat', 'frage', 'fragen', 'blase'],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'leiste',
		verfuegbar: (k) => !mehrfach(k),
		warumNicht: () => 'Claude ändert immer ein Element. Wähle eines davon.',
		aus: (k) => k.tu.claude(),
	},
	{
		id: 'ansicht.palette',
		titel: 'Befehle',
		gruppe: 'ansicht',
		symbol: 'suche',
		kuerzel: [
			{ code: 'KeyK', befehl: true },
			{ code: 'KeyK', befehl: true, umschalt: true },
		],
		modus: ['auswahl', 'ohne', 'text'],
		orte: ['taste'],
		sichtbarUnter: 'statusleiste',
		verfuegbar: () => true,
		aus: (k) => k.tu.palette(),
	},
	{
		id: 'ansicht.tasten',
		titel: 'Tasten-Übersicht',
		gruppe: 'ansicht',
		symbol: 'hilfe',
		kuerzel: [{ key: '?' }],
		suchwoerter: ['kürzel', 'tastatur', 'hilfe'],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'statusleiste',
		verfuegbar: () => true,
		aus: (k) => k.tu.tasten(),
	},

	// Dokument
	{
		id: 'dokument.rueckgaengig',
		titel: 'Rückgängig',
		gruppe: 'dokument',
		symbol: 'rueckgaengig',
		kuerzel: [{ code: 'KeyZ', befehl: true }],
		modus: ['auswahl', 'ohne', 'text'],
		tasteWenn: (k) => !k.feldBehaeltUndo(),
		orte: ['taste', 'palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: (k) => k.frei,
		aus: (k) => k.tu.rueckgaengig(),
	},
	{
		id: 'dokument.wiederholen',
		titel: 'Wiederholen',
		gruppe: 'dokument',
		symbol: 'wiederholen',
		kuerzel: [
			{ code: 'KeyZ', befehl: true, umschalt: true },
			...(istMac() ? [] : [{ code: 'KeyY', befehl: true }]),
		],
		modus: ['auswahl', 'ohne', 'text'],
		tasteWenn: (k) => !k.feldBehaeltUndo(),
		orte: ['taste', 'palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: (k) => k.frei,
		aus: (k) => k.tu.wiederholen(),
	},
	{
		id: 'dokument.speichern',
		titel: 'Speichern',
		gruppe: 'dokument',
		kuerzel: [{ code: 'KeyS', befehl: true }],
		orte: ['taste'],
		sichtbarUnter: 'kopf',
		verfuegbar: () => true,
		aus: (k) => k.tu.speichern(),
	},
	{
		id: 'dokument.pdf',
		titel: 'PDF',
		gruppe: 'dokument',
		symbol: 'herunterladen',
		kuerzel: [{ code: 'KeyP', befehl: true }],
		suchwoerter: ['herunterladen', 'drucken', 'download'],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: () => true,
		aus: (k) => k.tu.pdf(),
	},
	{
		id: 'dokument.drucken',
		titel: 'Drucken',
		gruppe: 'dokument',
		symbol: 'drucker',
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: () => true,
		aus: (k) => k.tu.drucken(),
	},
	{
		id: 'dokument.praesentieren',
		titel: 'Präsentieren',
		gruppe: 'dokument',
		symbol: 'praesentieren',
		suchwoerter: ['beamer', 'folien'],
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: (k) => k.format === 'folie',
		aus: (k) => k.tu.praesentieren(),
	},
	{
		id: 'dokument.neue-seite',
		titel: (k) => (istSeite(k) ? 'Neue Seite danach' : 'Neue Seite'),
		gruppe: 'dokument',
		symbol: 'plus',
		orte: ['menue', 'leiste', 'palette'],
		leisteTitel: 'Seite danach',
		leisteWenn: istSeite,
		sichtbarUnter: 'links',
		verfuegbar: (k) => k.aktiv && !k.festeSeiten,
		aus: (k) => k.tu.struktur.neueSeite(false),
	},
	{
		id: 'dokument.seite-mit-namenszeile',
		titel: (k) => (istSeite(k) ? 'Mit Namenszeile danach' : 'Neue Seite mit Namenszeile'),
		gruppe: 'dokument',
		symbol: 'plus',
		orte: ['menue', 'palette'],
		sichtbarUnter: 'links',
		verfuegbar: (k) => k.aktiv && !k.festeSeiten && k.namenszeile,
		aus: (k) => k.tu.struktur.neueSeite(true),
	},
	{
		id: 'dokument.zurueck',
		titel: 'Zurück zum Dokument',
		gruppe: 'dokument',
		symbol: 'zurueck',
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: () => true,
		aus: (k) => k.tu.zurueck(),
	},
	{
		id: 'dokument.hilfe',
		titel: 'Hilfe',
		gruppe: 'dokument',
		symbol: 'hilfe',
		suchwoerter: ['anleitung', 'so geht'],
		orte: ['palette'],
		sichtbarUnter: 'kopf',
		verfuegbar: () => true,
		aus: (k) => k.tu.hilfe(),
	},
	...GESTALTUNG_BEFEHLE,
];

export const titelVon = (b: Befehl, k: Kontext) => (typeof b.titel === 'function' ? b.titel(k) : b.titel);

export const symbolVon = (b: Befehl, k: Kontext) => (typeof b.symbol === 'function' ? b.symbol(k) : b.symbol);

/** Nur Verfügbares, in der Reihenfolge der Gruppen. */
export const befehleFuer = (ort: Ort, k: Kontext, alle: Befehl[] = BEFEHLE) =>
	alle
		.filter((b) => b.orte.includes(ort) && b.verfuegbar(k))
		.sort((a, b) => GRUPPEN.indexOf(a.gruppe) - GRUPPEN.indexOf(b.gruppe));

const TASTEN_NAME: Record<string, string> = {
	ArrowUp: '↑',
	ArrowDown: '↓',
	ArrowLeft: '←',
	ArrowRight: '→',
	Backspace: '⌫',
	Delete: 'Entf',
	Enter: '⏎',
	Escape: 'Esc',
	Tab: 'Tab',
};

const tasteName = ({ code, key }: Kuerzel) => {
	if (code) {
		return TASTEN_NAME[code] ?? code.replace(/^(Key|Digit)/, '');
	}
	return TASTEN_NAME[key ?? ''] ?? key ?? '';
};

/** `⇧⌘D` am Mac, `Strg+Umschalt+D` sonst. */
export const kuerzelText = (k: Kuerzel, mac?: boolean) =>
	kuerzelAnzeige(`${k.wahl ? '⌥' : ''}${k.umschalt ? '⇧' : ''}${k.befehl ? '⌘' : ''}${tasteName(k)}`, mac);

type TastenEreignis = Pick<KeyboardEvent, 'code' | 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

/** Zeichen wie `/` oder `?` entstehen auf der deutschen Tastatur erst mit ⇧: Dort zählt ⇧ nicht. */
const zeichenOhneUmschalt = (key: string) => key.length === 1 && !/[a-z]/i.test(key);

export const passtTaste = (k: Kuerzel, e: TastenEreignis) => {
	if (Boolean(k.befehl) !== (e.metaKey || e.ctrlKey) || Boolean(k.wahl) !== e.altKey) {
		return false;
	}
	if (k.code) {
		return e.code === k.code && Boolean(k.umschalt) === e.shiftKey;
	}
	if (e.key !== k.key) {
		return false;
	}
	return zeichenOhneUmschalt(e.key) || Boolean(k.umschalt) === e.shiftKey;
};

export const MODUS_VORGABE: Modus[] = ['auswahl', 'ohne'];

/**
 * Der Befehl zu einer Taste in diesem Zustand, verfügbar oder nicht: Wer nicht kann, sagt es (`warumNicht`). Ein
 * Kürzel mit erfülltem `wenn` geht einem ohne `wenn` vor, egal wo es im Register steht (100: Pfeiltasten bei
 * Gestaltung vor `auswahl.vorheriger`/`auswahl.naechster`).
 */
export const befehlZuTaste = (e: TastenEreignis, modus: Modus, k: Kontext, alle: Befehl[] = BEFEHLE) => {
	let ohneWenn: Befehl | undefined;
	for (const b of alle) {
		if (!(b.modus ?? MODUS_VORGABE).includes(modus)) {
			continue;
		}
		// ⌥ tippt in der Textsitzung Zeichen: ⌥C ist dort „ç“.
		const passend = b.kuerzel?.filter((t) => passtTaste(t, e) && !(modus === 'text' && t.wahl)) ?? [];
		if (passend.length === 0 || (b.tasteWenn && !b.tasteWenn(k))) {
			continue;
		}
		if (passend.some((t) => t.wenn?.(k))) {
			return b;
		}
		if (passend.some((t) => !t.wenn)) {
			ohneWenn ??= b;
		}
	}
	return ohneWenn;
};

const alsEintrag = (b: Befehl, k: Kontext, fuehreAus: (id: string) => unknown): MenueEintrag => {
	const [erstes] = b.kuerzel ?? [];
	const symbol = symbolVon(b, k);
	return {
		titel: titelVon(b, k),
		gruppe: b.gruppe,
		...(symbol ? { symbol } : {}),
		...(erstes ? { kuerzel: kuerzelText(erstes) } : {}),
		...(b.gefahr ? { gefahr: true } : {}),
		...(b.gesperrt?.(k) ? { aus: true } : {}),
		...(b.aktiv ? { aktiv: b.aktiv(k) } : {}),
		waehle: () => {
			fuehreAus(b.id);
		},
	};
};

/** Einträge für Rechtsklick und ⋯, dieselbe Liste an beiden Orten. Untermenüs entstehen aus `untermenue`. */
export const menueAusBefehlen = (liste: Befehl[], k: Kontext, fuehreAus: (id: string) => unknown): MenueEintrag[] => {
	const eintraege: MenueEintrag[] = [];
	const unter = new Map<string, MenueEintrag>();
	for (const b of liste) {
		if (b.imMenue && !b.imMenue(k)) {
			continue;
		}
		if (b.untermenue) {
			let oben = unter.get(b.untermenue);
			if (!oben) {
				oben = { titel: b.untermenue, gruppe: b.gruppe, untermenue: [] };
				unter.set(b.untermenue, oben);
				eintraege.push(oben);
			}
			oben.untermenue?.push(alsEintrag(b, k, fuehreAus));
		} else {
			eintraege.push(alsEintrag(b, k, fuehreAus));
		}
	}
	return eintraege;
};

export type MenueArt = 'baustein' | 'leer' | 'miniatur';

/** Für eine leere Stelle im Blatt die eigene kurze Liste, nicht mit Baustein-Befehlen gemischt. */
const MENUE_LEER = ['auswahl.einfuegen', 'auswahl.einfuegen-danach', 'dokument.neue-seite', 'ansicht.einpassen'];
const MENUE_MINIATUR = [
	'dokument.neue-seite',
	'dokument.seite-mit-namenszeile',
	'auswahl.duplizieren',
	'auswahl.hoch',
	'auswahl.runter',
	'auswahl.loeschen',
];
const MENUE_BAUSTEIN: Gruppe[] = ['bearbeiten', 'ablage', 'ordnen', 'gefahr'];
const MENUE_MAX = 12;

/** Dieselbe Liste für Rechtsklick und ⋯. */
export const befehleFuerMenue = (art: MenueArt, k: Kontext) => {
	if (art === 'baustein') {
		const liste = befehleFuer('menue', k).filter((b) => MENUE_BAUSTEIN.includes(b.gruppe));
		const eintraege = new Set(liste.map((b) => b.untermenue ?? b.id)).size;
		// „Davor einfügen“ steht auch unter „+ Baustein“. Die Sammlung weicht nur, wenn es sonst nicht passt, und bleibt in der Palette.
		const entbehrlich = ['auswahl.einfuegen-davor', 'auswahl.in-sammlung'].slice(0, eintraege - MENUE_MAX);
		return liste.filter((b) => !entbehrlich.includes(b.id));
	}
	const ids = art === 'leer' ? MENUE_LEER : MENUE_MINIATUR;
	return ids.flatMap((id) => BEFEHLE.find((b) => b.id === id && b.verfuegbar(k)) ?? []);
};
