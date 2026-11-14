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

import { kannUmbrechenVor, schliesseAn, seiteZumAnschliessen, umbruchVor } from '@schoolbox/kern/src/einfuegen';
import { istMac, kuerzelAnzeige } from '../bausteine/kuerzel';
import { starteMeldung } from '../bausteine/melden';
import type { MenueEintrag } from '../bausteine/Menue';
import type { SymbolName } from '../bausteine/Symbol';
import type { TastenAbschnitt } from '../bausteine/Tastenliste';
import { seitenWort } from '../lib/text';
import type { PfadTeil } from './darstellung';
import { GESTALTUNG_BEFEHLE } from './gestaltung/befehle';
import { dupliziereAlle, loescheAlle, mehrereGewaehlt } from './gestaltung/befehle/bewegen'; // 113
import type { GestaltungKontext } from './gestaltung/kontext';
import { WERKZEUG_BEFEHLE } from './gestaltung/werkzeuge/befehle';
import { JEDE_LAGE, schubladeVon } from './schubladen';
import type { SchubladenId } from './schubladen/reihe';
import { befehlZuSchublade, REIHE } from './schubladen/reihe';
import type { Struktur, StrukturWerte } from './struktur';

/** `gestaltung`: ⋯ und Rechtsklick am Gestaltungselement (204-10), Reihenfolge aus `GESTALTUNG_MENUE`. */
export type Ort = 'taste' | 'menue' | 'palette' | 'gestaltung';
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
	/** Die sichtbaren Spalten links, die Ebenen zuerst. */
	linksOffen: readonly SchubladenId[];
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
	/** Einträge mit gleichem Wert stehen im Menü in einem Untermenü. */
	untermenue?: string;
	aktiv?: (k: Kontext) => boolean;
	/** Leise neben dem Titel in der Palette, z. B. `4 → 5`. */
	notiz?: (k: Kontext) => string;
	/** Ohne Angabe immer. Sonst nur dann in Tastenübersicht und Hilfe: Platzhalter-Schubladen erscheinen nirgends. */
	inUebersicht?: () => boolean;
	/** Name in Hilfe und Tastenliste, wenn `titel` vom Kontext abhängt. */
	hilfeTitel?: string;
}

const gewaehlt = (k: Kontext) => k.pfad.at(-1);
const istSeite = (k: Kontext) => gewaehlt(k)?.baustein.art === 'seite';
/** 47: Bei Mehrfachauswahl gibt es Claude nicht. */
const mehrfach = (k: Kontext) => (k.gestaltung?.nrn.length ?? 0) > 1;
const einzigeSeite = (k: Kontext) => istSeite(k) && (k.werte?.seiten ?? 0) <= 1;
/** „Folie“ in Präsentationen, sonst „Seite“ (192-12). */
const wort = (k: Kontext) => seitenWort(k.format === 'folie');
const inZelle = (k: Kontext) => k.aktiv && ['tabellenzelle', 'tabellenzeile'].includes(gewaehlt(k)?.baustein.art ?? '');
const istTabelle = (k: Kontext) => k.aktiv && gewaehlt(k)?.baustein.art === 'tabelle';
const kannText = (k: Kontext) => {
	const g = gewaehlt(k);
	return k.frei && Boolean(g && kann(g.baustein, 'text'));
};
/** 194-32: Namenszeile, Kopf und Fuß gibt es je Seite einmal; Ausschneiden und Kopieren bleiben. */
const EINMAL_JE_SEITE = ['namenszeile', 'kopf', 'fuss'];
const kannDas = (k: Kontext, was: 'loeschen' | 'duplizieren') => {
	const g = gewaehlt(k);
	// Auch ein Teil der Namenszeile („Name:“) verdoppelt sonst die Zeile in sich.
	const einmal =
		was === 'duplizieren' &&
		(EINMAL_JE_SEITE.includes(g?.baustein.art ?? '') || k.pfad.some((t) => t.baustein.art === 'namenszeile'));
	return k.aktiv && !einmal && Boolean(g && kannImFormat(g.baustein, was, k.format));
};
/** 194-31: Geht weder hinauf noch hinunter, stehen die Pfeile nicht im Menü und nicht in der Leiste (204-07). */
export const kannVerschieben = (k: Kontext) => Boolean(k.werte?.nach?.zurueck || k.werte?.nach?.vor);

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
	// 194-29: nur Palette und Inspektor, nicht im Menü.
	orte: ['palette'],
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
	werkzeuge: ['formen', 'text', 'schrift', 'zeichnen'],
	bilder: ['foto', 'hochladen', 'sammlung'],
};

/**
 * Je Schublade ein Befehl, ⌥1 bis ⌥5 über `code`. Die Taste ist reserviert, auch solange die Schublade noch nicht
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
	aktiv: (k) => k.linksOffen.includes(id),
	inUebersicht: () => schubladeVon(id)?.bereit(JEDE_LAGE) ?? false,
}));

export const BEFEHLE: Befehl[] = [
	// Auswahl
	{
		id: 'auswahl.bearbeiten',
		titel: (k) => (kannText(k) ? 'Text bearbeiten' : 'Eine Ebene tiefer'),
		hilfeTitel: 'Eine Ebene tiefer',
		gruppe: 'bearbeiten',
		symbol: 'stift',
		kuerzel: [{ key: 'Enter' }],
		modus: ['auswahl'],
		orte: ['taste', 'menue', 'palette', 'gestaltung'],
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
		// 204-08: im ⋯, auf ⌥N und als Knopf im Inspektor (197-06).
		orte: ['taste', 'menue', 'palette'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => k.aktiv && k.hatNeueZahlen,
		aus: (k) => k.tu.neueZahlen(),
	},
	spaltenBefehl('auswahl.spalten-mehr', 'Spalten erhöhen', 1, ['mehr', 'breiter', 'nebeneinander']),
	spaltenBefehl('auswahl.spalten-weniger', 'Spalten verringern', -1, ['weniger', 'schmaler']),
	tabelle('tabelle.zeile-danach', 'Zeile danach', 'Zeile eingefügt', (q, nr, n) => fuegeZeileEin(q, nr, 'nach', n))(
		['menue', 'palette'],
		false,
		{
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
	)(['menue', 'palette'], false, {
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
		// 204-14, 199-15: ein Wort für das Austauschen, wie „Austauschen“ im Inspektor; am leeren Platz „einsetzen“.
		titel: (k) =>
			['platzhalter', 'bildrahmen'].includes(gewaehlt(k)?.baustein.art ?? '') ? 'Bild einsetzen' : 'Bild austauschen',
		gruppe: 'bearbeiten',
		symbol: 'bild',
		suchwoerter: ['ersetzen', 'tauschen', 'einsetzen'],
		orte: ['menue', 'palette', 'gestaltung'],
		sichtbarUnter: 'inspektor',
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
		orte: ['taste', 'menue', 'palette', 'gestaltung'],
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
		orte: ['taste', 'menue', 'palette', 'gestaltung'],
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
		orte: ['taste', 'menue', 'palette', 'gestaltung'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => k.aktiv && Boolean(gewaehlt(k)) && !istSeite(k),
		aus: (k) => k.tu.kopiere(),
	},
	{
		id: 'auswahl.einfuegen',
		// 194-30: „Einfügen“ ist die Ablage; einen neuen Baustein holt „Neuer Baustein“.
		titel: 'Einfügen',
		gruppe: 'ablage',
		symbol: 'hochladen',
		kuerzel: [{ code: 'KeyV', befehl: true }],
		suchwoerter: ['ablage', 'zwischenablage', 'hinzufügen', 'neu'],
		// 198-08: auch im Menü am Gestaltungselement, neben Kopieren.
		orte: ['taste', 'menue', 'palette', 'gestaltung'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => k.aktiv && k.hatAblage,
		warumNicht: (k) => (k.aktiv ? 'In der Ablage liegt nichts.' : null),
		aus: (k) => k.tu.fuegeAblageEin(gewaehlt(k)?.nr ?? null),
	},
	{
		id: 'auswahl.einfuegen-davor',
		titel: 'Neuer Baustein davor',
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
		hilfeTitel: 'Nach oben',
		gruppe: 'ordnen',
		symbol: (k) => (k.werte?.nach?.quer ? 'links' : 'hoch'),
		kuerzel: [
			{ key: 'ArrowUp', wahl: true },
			{ key: 'ArrowLeft', wahl: true, wenn: (k) => Boolean(k.werte?.nach?.quer) },
		],
		modus: ['auswahl'],
		suchwoerter: ['verschieben', 'links', 'oben'],
		orte: ['taste', 'menue', 'palette'],
		sichtbarUnter: 'leiste',
		verfuegbar: (k) => k.aktiv && Boolean(k.werte?.nach),
		imMenue: kannVerschieben,
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
		hilfeTitel: 'Nach unten',
		gruppe: 'ordnen',
		symbol: (k) => (k.werte?.nach?.quer ? 'rechts' : 'runter'),
		kuerzel: [
			{ key: 'ArrowDown', wahl: true },
			{ key: 'ArrowRight', wahl: true, wenn: (k) => Boolean(k.werte?.nach?.quer) },
		],
		modus: ['auswahl'],
		suchwoerter: ['verschieben', 'rechts', 'unten'],
		orte: ['taste', 'menue', 'palette'],
		sichtbarUnter: 'leiste',
		verfuegbar: (k) => k.aktiv && Boolean(k.werte?.nach),
		imMenue: kannVerschieben,
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
		orte: ['menue', 'palette', 'gestaltung'],
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
		orte: ['menue', 'palette', 'gestaltung'],
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
		sichtbarUnter: 'inspektor',
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
		// 194-30: am Blattrand und im ⋯ des Bausteins (204-09), mit `/`.
		titel: 'Neuer Baustein',
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
		orte: ['taste', 'menue', 'palette', 'gestaltung'],
		sichtbarUnter: 'leiste',
		gefahr: true,
		verfuegbar: (k) => kannDas(k, 'loeschen') && !einzigeSeite(k),
		warumNicht: (k) => {
			const g = gewaehlt(k);
			if (!g || !k.frei) {
				return null;
			}
			return einzigeSeite(k) ? `Die einzige ${wort(k)} bleibt.` : `${g.name} lässt sich nicht löschen.`;
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
		['menue', 'palette'],
		true,
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
		kuerzel: [{ key: '+', befehl: true }, { key: '+' }],
		modus: ['auswahl', 'ohne', 'text'],
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
		kuerzel: [{ key: '-', befehl: true }, { key: '-' }],
		modus: ['auswahl', 'ohne', 'text'],
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
		kuerzel: [{ code: 'Digit0', befehl: true }, { key: '1' }],
		modus: ['auswahl', 'ohne', 'text'],
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
		// 194-29: nicht im Menü am Blattrand; der Knopf steht in der Statusleiste.
		orte: ['taste', 'palette'],
		sichtbarUnter: 'statusleiste',
		verfuegbar: () => true,
		aus: (k) => k.tu.einpassen(),
	},
	...SCHUBLADEN_BEFEHLE,
	...WERKZEUG_BEFEHLE,
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
		titel: (k) => (istSeite(k) ? `Neue ${wort(k)} danach` : `Neue ${wort(k)}`),
		gruppe: 'dokument',
		symbol: 'plus',
		orte: ['menue', 'palette'],
		sichtbarUnter: 'links',
		verfuegbar: (k) => k.aktiv && !k.festeSeiten,
		aus: (k) => k.tu.struktur.neueSeite(false),
	},
	{
		id: 'dokument.seite-mit-namenszeile',
		titel: (k) => (istSeite(k) ? 'Mit Namenszeile danach' : `Neue ${wort(k)} mit Namenszeile`),
		gruppe: 'dokument',
		symbol: 'plus',
		orte: ['menue', 'palette'],
		sichtbarUnter: 'links',
		verfuegbar: (k) => k.aktiv && !k.festeSeiten && k.namenszeile,
		aus: (k) => k.tu.struktur.neueSeite(true),
	},
	{
		id: 'seite.ab-hier',
		titel: 'Ab hier neue Seite',
		gruppe: 'ordnen',
		symbol: 'plus',
		suchwoerter: ['seitenumbruch', 'umbruch', 'umbrechen'],
		orte: ['menue', 'palette'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => {
			const g = gewaehlt(k);
			return Boolean(k.aktiv && g && k.quelle && kannUmbrechenVor(k.quelle, g.nr));
		},
		aus: (k) => {
			const g = gewaehlt(k);
			if (g) {
				k.tu.struktur.fuehreAus(
					'Ab hier neue Seite',
					(q) => umbruchVor(q, g.nr, { jeSeite: k.format === 'folie' }),
					true,
				);
			}
		},
	},
	{
		id: 'seite.anschliessen',
		titel: 'An vorige Seite anschließen',
		gruppe: 'ordnen',
		symbol: 'hoch',
		suchwoerter: ['seitenumbruch', 'umbruch', 'zusammenführen', 'weiterlaufen'],
		orte: ['menue', 'palette'],
		sichtbarUnter: 'links',
		// Auch am ersten Block der Seite (N06), dort wo vorher „Ab hier neue Seite“ stand.
		verfuegbar: (k) => {
			const g = gewaehlt(k);
			return Boolean(k.aktiv && !k.festeSeiten && g && k.quelle && seiteZumAnschliessen(k.quelle, g.nr) !== null);
		},
		aus: (k) => {
			const g = gewaehlt(k);
			const seite = g && k.quelle ? seiteZumAnschliessen(k.quelle, g.nr) : null;
			if (g && seite !== null) {
				k.tu.struktur.fuehreAus(
					'An vorige Seite angeschlossen',
					(q) => ({ ...schliesseAn(q, seite, { jeSeite: k.format === 'folie' }), nr: g.nr }),
					true,
				);
			}
		},
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
	{
		id: 'dokument.melden',
		titel: 'Problem melden',
		gruppe: 'dokument',
		symbol: 'kaefer',
		kuerzel: [{ code: 'KeyK', wahl: true, umschalt: true }],
		// Wie ⌘K auch beim Schreiben im Blatt (193-31).
		modus: ['auswahl', 'ohne', 'text'],
		suchwoerter: ['fehler', 'wunsch', 'käfer', 'problem'],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'links',
		verfuegbar: () => true,
		aus: () => starteMeldung(),
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
	'ArrowUp': '↑',
	'ArrowDown': '↓',
	'ArrowLeft': '←',
	'ArrowRight': '→',
	'Backspace': '⌫',
	'Delete': 'Entf',
	'Enter': '⏎',
	'Escape': 'Esc',
	'Tab': 'Tab',
	' ': 'Leertaste',
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

/**
 * 194-14: Das Kürzel, das zur Lage passt: eines, dessen `wenn` gerade gilt (⌥← in einer Reihe), sonst das erste.
 * Beide Tasten wirken weiter; nur die Anzeige wechselt.
 */
export const kuerzelIm = (b: Befehl, k: Kontext) => b.kuerzel?.find((t) => t.wenn?.(k)) ?? b.kuerzel?.[0];

/** Das angezeigte Kürzel eines Befehls für Tooltips (53); `undefined`, wenn er keins hat. */
export const kuerzelVon = (id: string, mac?: boolean): string | undefined => {
	const befehl = BEFEHLE.find((b) => b.id === id);
	if (!befehl) {
		throw new Error(`Unbekannter Befehl ${id}`);
	}
	const [erstes] = befehl.kuerzel ?? [];
	return erstes ? kuerzelText(erstes, mac) : undefined;
};

const TASTEN_ABSCHNITTE: { titel: string; gruppen: Gruppe[] }[] = [
	{ titel: 'Gewählter Baustein', gruppen: ['bearbeiten', 'ablage', 'ordnen', 'gefahr'] },
	{ titel: 'Im Blatt bewegen', gruppen: ['baustein', 'blatt'] },
	{ titel: 'Ansicht', gruppen: ['ansicht'] },
	{ titel: 'Material', gruppen: ['dokument'] },
];

/** Tastenübersicht und Hilfe aus dem Register. Ohne Kontext (Hilfe) gilt `hilfeTitel`. */
export const tastenAbschnitte = (k?: Kontext, mac?: boolean): TastenAbschnitt[] =>
	TASTEN_ABSCHNITTE.map(({ gruppen, titel }) => ({
		titel,
		zeilen: BEFEHLE.filter(
			(b) => gruppen.includes(b.gruppe) && b.kuerzel?.length && (b.inUebersicht?.() ?? true),
		).map((b) => ({
			id: b.id,
			titel: k ? titelVon(b, k) : (b.hilfeTitel ?? (typeof b.titel === 'string' ? b.titel : b.id)),
			tasten: (b.kuerzel ?? []).filter((t, i) => i === 0 || !t.wenn).map((t) => kuerzelText(t, mac)),
		})),
	}));

/** Was beim Tippen im Blatt oder in einem Feld weiter wirkt: das erste Kürzel jedes Befehls mit `modus` `text`. */
export const tastenBeimTippen = (mac?: boolean) =>
	BEFEHLE.flatMap((b) => {
		const [erstes] = b.kuerzel ?? [];
		return erstes && b.modus?.includes('text') ? [kuerzelText(erstes, mac)] : [];
	});

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
		// Beim Tippen zählen nur Kürzel mit ⌘ und ohne ⌥: ⌥C ist dort „ç“, `+` ist ein Zeichen.
		const passend =
			b.kuerzel?.filter((t) => passtTaste(t, e) && !(modus === 'text' && (t.wahl || !t.befehl))) ?? [];
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

const ZOOM_BEFEHLE = ['ansicht.zoom-rein', 'ansicht.zoom-raus', 'ansicht.zoom-100'];

/** ⌘+, ⌘- und ⌘0 zoomen im Editor das Blatt; der Browser bekommt sie nie, auch nicht bei offenem Menü (56). */
export const istZoomTaste = (e: TastenEreignis) =>
	BEFEHLE.some((b) => ZOOM_BEFEHLE.includes(b.id) && b.kuerzel?.some((t) => t.befehl && passtTaste(t, e)));

const alsEintrag = (b: Befehl, k: Kontext, fuehreAus: (id: string) => unknown): MenueEintrag => {
	const erstes = kuerzelIm(b, k);
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

/** `gestaltung`: am Gestaltungselement (204-10), `seite`: am Rand der Seite (204-11), `leer`: ohne Auswahl. */
export type MenueArt = 'baustein' | 'leer' | 'miniatur' | 'gestaltung' | 'seite';

/** Für eine leere Stelle im Blatt die eigene kurze Liste, nicht mit Baustein-Befehlen gemischt (194-29). */
const MENUE_LEER = ['auswahl.einfuegen', 'auswahl.einfuegen-danach', 'dokument.neue-seite'];
const MENUE_MINIATUR = [
	'dokument.neue-seite',
	'dokument.seite-mit-namenszeile',
	'seite.anschliessen',
	'auswahl.duplizieren',
	'auswahl.hoch',
	'auswahl.runter',
	'auswahl.loeschen',
];
/** 204-11: ⋯ und Rechtsklick an der Seite, eine Liste. */
const MENUE_SEITE = [
	'auswahl.einfuegen',
	'auswahl.einfuegen-danach',
	'dokument.neue-seite',
	'seite.anschliessen',
	'auswahl.duplizieren',
	'auswahl.hoch',
	'auswahl.runter',
	'auswahl.claude',
	'auswahl.loeschen',
];
const MENUE_BAUSTEIN: Gruppe[] = ['bearbeiten', 'ablage', 'ordnen', 'gefahr'];
/** 204-09: „Neuer Baustein“ steht im ⋯ jedes Bausteins, an dem es früher „+ Baustein“ gab. */
const OHNE_NEUEN_BAUSTEIN = ['seite', 'tabellenzelle', 'tabellenzeile', 'item', 'karte'];

/**
 * 204-10: ⋯ und Rechtsklick am Gestaltungselement, je Zeile ein Block im Menü. Wer einen Befehl mit Ort
 * `'gestaltung'` einträgt, der hier fehlt, landet im leeren Block vor „In Sammlung legen“.
 */
export const GESTALTUNG_MENUE: readonly (readonly string[])[] = [
	['auswahl.bearbeiten', 'auswahl.bild-ersetzen'],
	['auswahl.duplizieren', 'auswahl.ausschneiden', 'auswahl.kopieren', 'auswahl.einfuegen'],
	// 100: „Ganz nach vorne/hinten“ stehen im Inspektor „Anordnen“ und auf der Taste.
	['auswahl.nach-vorne', 'auswahl.nach-hinten'],
	// 113: ein Untermenü „Ausrichten“, Verteilen darin.
	[
		'auswahl.ausrichten-links',
		'auswahl.ausrichten-mitte',
		'auswahl.ausrichten-rechts',
		'auswahl.ausrichten-oben',
		'auswahl.ausrichten-mittig',
		'auswahl.ausrichten-unten',
		'auswahl.verteilen-waagerecht',
		'auswahl.verteilen-senkrecht',
	],
	// 198-08: Gruppieren an der Mehrfachauswahl, Auflösen an der Gruppe. Kombinieren steht nur im Inspektor (198-16).
	['auswahl.gruppieren', 'auswahl.gruppe-aufloesen'],
	// 101
	['auswahl.sperren', 'auswahl.ausblenden'],
	// 106, 115
	['auswahl.anhaengen', 'auswahl.loesen', 'auswahl.in-stapel', 'auswahl.spiegeln'],
	[],
	['auswahl.in-sammlung', 'auswahl.claude'],
	['auswahl.loeschen'],
];
const AUSRICHTEN_BLOCK = 3;
const NACH_VORNE_BLOCK = 2;

/** Der Block für Unbekanntes: der leere vor „In Sammlung legen“. */
const WEITERE = GESTALTUNG_MENUE.findIndex((block) => block.length === 0);

const platzIm = (id: string) => {
	for (const [block, ids] of GESTALTUNG_MENUE.entries()) {
		const i = ids.indexOf(id);
		if (i !== -1) {
			return { block, i };
		}
	}
	return { block: WEITERE, i: 0 };
};

/** Sortiert nach `GESTALTUNG_MENUE`; Unbekanntes behält seine Reihenfolge aus dem Register. */
export const ordneGestaltung = (liste: readonly Befehl[]) =>
	liste
		.map((befehl, n) => ({ befehl, n, ...platzIm(befehl.id) }))
		.sort((a, b) => a.block - b.block || a.i - b.i || a.n - b.n);

/**
 * 204-N02: An der Tabellenzeile löscht „Löschen“ die Zeile; Spalten-Befehle haben dort keinen Gegenstand. An der
 * Zelle sagen „Zeile löschen“ und „Spalte löschen“, was weggeht; ein „Löschen“ ohne Gegenstand fehlt dort.
 */
const OHNE_AN: Record<string, readonly string[]> = {
	tabellenzeile: ['tabelle.zeile-weg', 'tabelle.spalte-weg', 'tabelle.spalte-davor', 'tabelle.spalte-danach'],
	tabellenzelle: ['auswahl.loeschen'],
};

/** 204-N03: Zusammengehörige Paare stehen nebeneinander, an der Stelle des ersten. */
const PAARE = ['tabelle.zeile-davor', 'tabelle.zeile-danach', 'tabelle.spalte-davor', 'tabelle.spalte-danach'];
const paareZusammen = (liste: Befehl[]) => {
	const paar = PAARE.flatMap((id) => liste.find((b) => b.id === id) ?? []);
	const erste = liste.findIndex((b) => PAARE.includes(b.id));
	if (erste === -1) {
		return liste;
	}
	const rest = liste.filter((b) => !PAARE.includes(b.id));
	const vor = liste.slice(0, erste).filter((b) => !PAARE.includes(b.id)).length;
	return [...rest.slice(0, vor), ...paar, ...rest.slice(vor)];
};

/** Dieselbe Liste für Rechtsklick und ⋯. */
export const befehleFuerMenue = (art: MenueArt, k: Kontext) => {
	if (art === 'baustein') {
		const ohne = OHNE_AN[gewaehlt(k)?.baustein.art ?? ''] ?? [];
		const liste = paareZusammen(
			befehleFuer('menue', k).filter((b) => MENUE_BAUSTEIN.includes(b.gruppe) && !ohne.includes(b.id)),
		);
		const neu = BEFEHLE.find((b) => b.id === 'auswahl.einfuegen-danach' && b.verfuegbar(k));
		if (!neu || OHNE_NEUEN_BAUSTEIN.includes(gewaehlt(k)?.baustein.art ?? '')) {
			return liste;
		}
		// Als erster Eintrag der Gruppe mit „Duplizieren“, „Neuer Baustein davor“ direkt darunter (204-N03).
		const davor = liste.find((b) => b.id === 'auswahl.einfuegen-davor');
		const rest = liste.filter((b) => b !== davor);
		const stelle = rest.findIndex((b) => b.gruppe === 'ablage');
		const paar = davor ? [neu, { ...davor, gruppe: neu.gruppe }] : [neu];
		return stelle === -1 ? [...rest, ...paar] : [...rest.slice(0, stelle), ...paar, ...rest.slice(stelle)];
	}
	if (art === 'gestaltung') {
		return ordneGestaltung(befehleFuer('gestaltung', k))
			.filter(({ befehl, block }) => block !== NACH_VORNE_BLOCK || !befehl.gesperrt?.(k))
			.map(({ befehl, block }) => (block === AUSRICHTEN_BLOCK ? { ...befehl, untermenue: 'Ausrichten' } : befehl));
	}
	const ids = { leer: MENUE_LEER, seite: MENUE_SEITE, miniatur: MENUE_MINIATUR }[art];
	return ids.flatMap((id) => BEFEHLE.find((b) => b.id === id && b.verfuegbar(k)) ?? []);
};

/** Die Einträge eines Menüs. Am Gestaltungselement trennt eine Linie die Blöcke von `GESTALTUNG_MENUE`. */
export const menueFuer = (art: MenueArt, k: Kontext, fuehreAus: (id: string) => unknown): MenueEintrag[] => {
	const liste = befehleFuerMenue(art, k);
	const eintraege = menueAusBefehlen(liste, k, fuehreAus);
	if (art !== 'gestaltung') {
		return eintraege;
	}
	const bloecke = new Map(liste.map((b) => [b.untermenue ?? titelVon(b, k), platzIm(b.id).block]));
	return eintraege.map((e) => ({ ...e, gruppe: `gestaltung-${bloecke.get(e.titel) ?? WEITERE}` }));
};
