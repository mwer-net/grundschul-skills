import type { MenueEintrag } from '../bausteine/Menue';
import type { SymbolName } from '../bausteine/Symbol';
import type { Kuerzel } from '../editor/befehle';
import { kuerzelText, passtTaste } from '../editor/befehle';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import type { Merkzettel } from './kontext';
import type { Objekt } from './typen';

export type MenueArt = 'material' | 'ordner' | 'mehrere' | 'leer';

/** Worauf sich ein Befehl gerade bezieht. Menü und Tasten rechnen mit derselben Lage. */
export interface Lage {
	art: MenueArt;
	objekte: Objekt[];
	/** Der Ordner, um den es bei „Einfügen“, „Neuer Ordner“ geht. */
	ort: string | null;
	/** Suche oder Zuletzt: Der Ort steht nicht fest, es gibt „Im Ordner zeigen“. */
	fremd: boolean;
	merkzettel: Merkzettel | null;
	/** Woher das Menü kam. Im Baum steht das Namensfeld im Baum. */
	quelle: 'inhalt' | 'baum';
}

export const lageArt = (objekte: readonly Objekt[]): MenueArt => {
	const [erstes] = objekte;
	if (!erstes) {
		return 'leer';
	}
	if (objekte.length > 1) {
		return 'mehrere';
	}
	return erstes.istOrdner ? 'ordner' : 'material';
};

const einDok = ({ objekte }: Lage) => {
	const [o] = objekte;
	return o && !o.istOrdner && objekte.length === 1 ? o.dok : null;
};
const fertigesDok = (l: Lage) => {
	const d = einDok(l);
	return d && !hatOffeneEntwuerfe(d.meta) ? d : null;
};

export interface Befehl {
	id: string;
	titel: string | ((l: Lage) => string);
	symbol?: SymbolName;
	gefahr?: boolean;
	/** Das erste Kürzel steht in Menü und Tastenliste, das zweite ist die Finder-Taste, falls Safari sie durchlässt. */
	kuerzel?: Kuerzel[];
	/** Taste hat kein Ziel: Der Befehl gilt, wenn das hier stimmt. */
	wenn?: (l: Lage) => boolean;
	/** Gruppe in der Liste der Tasten. */
	abschnitt: 'Ablage' | 'Auswahl' | 'Ansicht' | 'Gehe zu';
}

const belegt = (l: Lage) => l.objekte.length > 0;

export const BEFEHLE: Befehl[] = [
	{
		id: 'oeffnen',
		titel: (l) => (l.art === 'material' ? 'Ansehen' : 'Öffnen'),
		symbol: 'auge',
		kuerzel: [{ code: 'ArrowDown', wahl: true }, { code: 'ArrowDown', befehl: true }],
		wenn: (l) => l.objekte.length === 1,
		abschnitt: 'Gehe zu',
	},
	{ id: 'bearbeiten', titel: 'Bearbeiten', symbol: 'stift', wenn: (l) => Boolean(fertigesDok(l)), abschnitt: 'Ablage' },
	{
		id: 'praesentieren',
		titel: 'Präsentieren',
		symbol: 'praesentieren',
		wenn: (l) => fertigesDok(l)?.meta.format === 'folie',
		abschnitt: 'Ablage',
	},
	{ id: 'neuerTab', titel: 'In neuem Tab öffnen', symbol: 'neuerTab', wenn: (l) => l.objekte.length === 1, abschnitt: 'Gehe zu' },
	{
		id: 'imOrdnerZeigen',
		titel: 'Im Ordner zeigen',
		symbol: 'ordner',
		wenn: (l) => l.fremd && l.objekte.length === 1,
		abschnitt: 'Gehe zu',
	},
	{
		id: 'hoch',
		titel: 'Übergeordneter Ordner',
		kuerzel: [{ code: 'ArrowUp', wahl: true }, { code: 'ArrowUp', befehl: true }],
		abschnitt: 'Gehe zu',
	},
	{
		id: 'neuerOrdner',
		titel: 'Neuer Ordner',
		symbol: 'ordnerNeu',
		kuerzel: [{ code: 'KeyN', wahl: true }, { code: 'KeyN', befehl: true, umschalt: true }],
		wenn: (l) => !l.fremd,
		abschnitt: 'Ablage',
	},
	{ id: 'neuerUnterordner', titel: 'Neuer Unterordner', symbol: 'ordnerNeu', abschnitt: 'Ablage' },
	{ id: 'mitAuswahl', titel: 'Neuer Ordner mit Auswahl', symbol: 'ordnerNeu', abschnitt: 'Ablage' },
	{ id: 'materialAnlegen', titel: 'Material anlegen', symbol: 'plus', wenn: (l) => !l.fremd, abschnitt: 'Ablage' },
	{ id: 'materialHier', titel: 'Material hier anlegen', symbol: 'plus', abschnitt: 'Ablage' },
	{
		id: 'pdf',
		titel: (l) => (l.art === 'material' ? 'PDF' : l.art === 'mehrere' ? 'Als PDF' : 'Alles als PDF'),
		symbol: 'herunterladen',
		wenn: (l) => l.art !== 'material' || Boolean(fertigesDok(l)),
		abschnitt: 'Ablage',
	},
	{
		id: 'teilen',
		titel: 'Teilen',
		symbol: 'teilen',
		wenn: (l) => l.objekte.length === 1 || (l.art === 'leer' && l.ort !== null && !l.fremd),
		abschnitt: 'Ablage',
	},
	{ id: 'alsVorlage', titel: 'Als Vorlage speichern', symbol: 'blatt', wenn: (l) => Boolean(fertigesDok(l)), abschnitt: 'Ablage' },
	{ id: 'variante', titel: 'Variante anlegen', symbol: 'variante', wenn: (l) => Boolean(fertigesDok(l)), abschnitt: 'Ablage' },
	{
		id: 'entwuerfe',
		titel: 'Entwürfe vergleichen',
		symbol: 'kopieren',
		wenn: (l) => (einDok(l)?.meta.entwuerfe.length ?? 0) > 0,
		abschnitt: 'Ablage',
	},
	{ id: 'umbenennen', titel: 'Umbenennen', symbol: 'stift', kuerzel: [{ key: 'Enter' }], wenn: (l) => l.objekte.length === 1, abschnitt: 'Ablage' },
	{
		id: 'duplizieren',
		titel: 'Duplizieren',
		symbol: 'kopieren',
		kuerzel: [{ code: 'KeyD', wahl: true }, { code: 'KeyD', befehl: true }],
		wenn: belegt,
		abschnitt: 'Ablage',
	},
	{ id: 'ausschneiden', titel: 'Ausschneiden', symbol: 'ausschneiden', kuerzel: [{ code: 'KeyX', befehl: true }], wenn: belegt, abschnitt: 'Ablage' },
	{ id: 'kopieren', titel: 'Kopieren', symbol: 'kopieren', kuerzel: [{ code: 'KeyC', befehl: true }], wenn: belegt, abschnitt: 'Ablage' },
	{ id: 'bewegenNach', titel: 'Bewegen nach …', symbol: 'bewegen', wenn: belegt, abschnitt: 'Ablage' },
	{
		id: 'einfuegen',
		titel: 'Einfügen',
		symbol: 'einfuegen',
		kuerzel: [{ code: 'KeyV', befehl: true }],
		wenn: (l) => l.merkzettel !== null && !l.fremd,
		abschnitt: 'Ablage',
	},
	{
		id: 'einfuegenBewegen',
		titel: 'Hierher bewegen',
		kuerzel: [{ code: 'KeyV', befehl: true, wahl: true }],
		wenn: (l) => l.merkzettel !== null && !l.fremd,
		abschnitt: 'Ablage',
	},
	{ id: 'uebersicht', titel: 'Übersicht', symbol: 'auge', kuerzel: [{ key: ' ' }], wenn: belegt, abschnitt: 'Ansicht' },
	{
		id: 'informationen',
		titel: 'Informationen',
		symbol: 'info',
		kuerzel: [{ code: 'KeyI', wahl: true }, { code: 'KeyI', befehl: true }],
		wenn: (l) => l.objekte.length <= 1 && !(l.fremd && l.objekte.length === 0),
		abschnitt: 'Ansicht',
	},
	{
		id: 'papierkorb',
		titel: 'In den Papierkorb',
		symbol: 'papierkorb',
		gefahr: true,
		kuerzel: [{ key: 'Backspace', befehl: true }, { key: 'Backspace' }, { key: 'Delete' }],
		wenn: belegt,
		abschnitt: 'Ablage',
	},
	{ id: 'darstellung', titel: 'Darstellung', abschnitt: 'Ansicht' },
	{ id: 'sortieren', titel: 'Sortieren', symbol: 'sortieren', wenn: (l) => !l.fremd, abschnitt: 'Ansicht' },
	{ id: 'allesWaehlen', titel: 'Alles auswählen', symbol: 'auswaehlen', kuerzel: [{ code: 'KeyA', befehl: true }], abschnitt: 'Auswahl' },
	{ id: 'kacheln', titel: 'Als Kacheln', kuerzel: [{ code: 'Digit1', wahl: true }, { code: 'Digit1', befehl: true }], abschnitt: 'Ansicht' },
	{ id: 'liste', titel: 'Als Liste', kuerzel: [{ code: 'Digit2', wahl: true }, { code: 'Digit2', befehl: true }], abschnitt: 'Ansicht' },
	{ id: 'seitenleiste', titel: 'Seitenleiste ein oder aus', kuerzel: [{ code: 'KeyS', wahl: true }, { code: 'KeyS', befehl: true, wahl: true }], abschnitt: 'Ansicht' },
	{ id: 'rueckgaengig', titel: 'Rückgängig', kuerzel: [{ code: 'KeyZ', befehl: true }], abschnitt: 'Ablage' },
	{ id: 'wiederholen', titel: 'Wiederholen', kuerzel: [{ code: 'KeyZ', befehl: true, umschalt: true }], abschnitt: 'Ablage' },
	{ id: 'suchen', titel: 'Suchen', kuerzel: [{ code: 'KeyF', befehl: true }], abschnitt: 'Gehe zu' },
	{ id: 'tasten', titel: 'Tasten zeigen', kuerzel: [{ key: '?' }], abschnitt: 'Ansicht' },
];

/** Die Einträge je Art, Gruppen in Reihenfolge. Rechtsklick und ⋯ lesen dasselbe (Ticket, Kontextmenüs). */
export const MENUE: Record<MenueArt, string[][]> = {
	material: [
		['oeffnen', 'bearbeiten', 'praesentieren', 'neuerTab', 'imOrdnerZeigen'],
		['pdf', 'teilen'],
		['alsVorlage', 'variante', 'entwuerfe'],
		['umbenennen', 'duplizieren', 'ausschneiden', 'kopieren', 'bewegenNach'],
		['uebersicht', 'informationen'],
		['papierkorb'],
	],
	ordner: [
		['oeffnen', 'neuerTab', 'imOrdnerZeigen'],
		['neuerUnterordner', 'materialHier', 'einfuegen'],
		['pdf', 'teilen'],
		['umbenennen', 'duplizieren', 'ausschneiden', 'kopieren', 'bewegenNach'],
		['informationen'],
		['papierkorb'],
	],
	mehrere: [
		['mitAuswahl'],
		['pdf'],
		['duplizieren', 'ausschneiden', 'kopieren', 'bewegenNach'],
		['papierkorb'],
	],
	leer: [
		['neuerOrdner', 'materialAnlegen', 'einfuegen'],
		['darstellung', 'sortieren', 'allesWaehlen'],
		['pdf', 'teilen', 'informationen'],
	],
};

/** Im Ordner-Menü zählt „Einfügen“ auch auf der Lage „Ordner“; „leer“ kennt in Suche und Zuletzt kein PDF. */
const verfuegbar = (b: Befehl, l: Lage) => {
	if (l.fremd && l.art === 'leer' && b.id === 'pdf') {
		return false;
	}
	if (b.id === 'einfuegen' && l.art === 'ordner') {
		return l.merkzettel !== null;
	}
	return !b.wenn || b.wenn(l);
};

const titelVon = (b: Befehl, l: Lage) => (typeof b.titel === 'string' ? b.titel : b.titel(l));

export interface MenueQuellen {
	fuehreAus: (id: string, l: Lage) => void;
	untermenue: (id: string, l: Lage) => MenueEintrag[] | null;
}

/** Baut das Menü: Unverfügbares bleibt weg (070). */
export const menueVon = (l: Lage, { fuehreAus, untermenue }: MenueQuellen, kopf?: string): MenueEintrag[] => {
	const liste: MenueEintrag[] = kopf ? [{ titel: kopf, aus: true, gruppe: 'kopf' }] : [];
	MENUE[l.art].forEach((gruppe, nr) => {
		for (const id of gruppe) {
			const b = BEFEHLE.find((x) => x.id === id);
			if (!b || !verfuegbar(b, l)) {
				continue;
			}
			const unter = untermenue(id, l);
			if (unter?.length === 0) {
				continue;
			}
			const [erstes] = b.kuerzel ?? [];
			liste.push({
				titel: titelVon(b, l),
				gruppe: String(nr),
				...(b.symbol ? { symbol: b.symbol } : {}),
				...(b.gefahr ? { gefahr: true } : {}),
				...(erstes ? { kuerzel: kuerzelText(erstes) } : {}),
				...(unter ? { untermenue: unter } : { waehle: () => fuehreAus(id, l) }),
			});
		}
	});
	return liste;
};

export const befehlZuTaste = (e: KeyboardEvent, l: Lage) =>
	BEFEHLE.find((b) => b.kuerzel?.some((k) => passtTaste(k, e)) && verfuegbar(b, l));

/** Für die Tastenliste. Sie liest das Register, damit dort nichts Falsches steht. */
export const tastenAbschnitte = () =>
	(['Ablage', 'Auswahl', 'Ansicht', 'Gehe zu'] as const).map((titel) => ({
		titel,
		befehle: BEFEHLE.filter((b) => b.abschnitt === titel && (b.kuerzel?.length ?? 0) > 0).map((b) => ({
			id: b.id,
			titel: typeof b.titel === 'string' ? b.titel : b.id === 'oeffnen' ? 'Öffnen' : b.id,
			taste: kuerzelText((b.kuerzel as [Kuerzel])[0]),
		})),
	}));
