import type { MenueEintrag } from '../bausteine/Menue';
import type { SymbolName } from '../bausteine/Symbol';
import type { TastenAbschnitt } from '../bausteine/Tastenliste';
import type { Kuerzel } from '../editor/befehle';
import type { PalettenEintrag } from '../editor/palette-suche';
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
	/** Wie viele Objekte die Fläche gerade zeigt: „Alles auswählen“ braucht mindestens eins (188-37). */
	anzahl: number;
	/** Der offene Ordner fehlt: Dann gilt kein Befehl der Ablage (189-02). */
	gesperrt?: boolean;
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
	/** Andere Wörter dafür in ⌘K (S-02). */
	suchwoerter?: string[];
}

const belegt = (l: Lage) => l.objekte.length > 0;
/** „Mein Material“ im Baum: Was die Fläche rechts umstellt, gehört nicht in sein Menü (188-36, 189-01). */
const fuerDieFlaeche = (l: Lage) => !(l.quelle === 'baum' && l.art === 'leer');

export const BEFEHLE: Befehl[] = [
	{
		id: 'oeffnen',
		titel: (l) => (l.art === 'material' ? 'Ansehen' : 'Öffnen'),
		symbol: 'auge',
		kuerzel: [
			{ code: 'ArrowDown', wahl: true },
			{ code: 'ArrowDown', befehl: true },
		],
		wenn: (l) => l.objekte.length === 1,
		abschnitt: 'Gehe zu',
	},
	{
		id: 'bearbeiten',
		titel: 'Bearbeiten',
		symbol: 'stift',
		wenn: (l) => Boolean(fertigesDok(l)),
		abschnitt: 'Ablage',
	},
	{
		id: 'praesentieren',
		titel: 'Präsentieren',
		symbol: 'praesentieren',
		wenn: (l) => fertigesDok(l)?.meta.format === 'folie',
		abschnitt: 'Ablage',
	},
	{
		id: 'neuerTab',
		titel: 'In neuem Tab öffnen',
		symbol: 'neuerTab',
		wenn: (l) => l.objekte.length === 1,
		abschnitt: 'Gehe zu',
	},
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
		kuerzel: [
			{ code: 'ArrowUp', wahl: true },
			{ code: 'ArrowUp', befehl: true },
		],
		abschnitt: 'Gehe zu',
	},
	{
		id: 'neuerOrdner',
		titel: 'Neuer Ordner',
		symbol: 'ordnerNeu',
		kuerzel: [
			{ code: 'KeyN', wahl: true },
			{ code: 'KeyN', befehl: true, umschalt: true },
		],
		wenn: (l) => !l.fremd,
		abschnitt: 'Ablage',
	},
	{ id: 'neuerUnterordner', titel: 'Neuer Unterordner', symbol: 'ordnerNeu', abschnitt: 'Ablage' },
	{ id: 'mitAuswahl', titel: 'Neuer Ordner mit Auswahl', symbol: 'ordnerNeu', abschnitt: 'Ablage' },
	{ id: 'materialAnlegen', titel: 'Material anlegen', symbol: 'plus', wenn: (l) => !l.fremd, abschnitt: 'Ablage' },
	{ id: 'materialHier', titel: 'Material hier anlegen', symbol: 'plus', abschnitt: 'Ablage' },
	{
		id: 'pdf',
		// Überall „PDF“: Was hineinkommt, sagt die Auswahl (191-43).
		titel: 'PDF',
		symbol: 'herunterladen',
		wenn: (l) => l.art !== 'material' || Boolean(fertigesDok(l)),
		suchwoerter: ['drucken', 'herunterladen'],
		abschnitt: 'Ablage',
	},
	{
		id: 'teilen',
		titel: 'Teilen',
		symbol: 'teilen',
		wenn: (l) => l.objekte.length === 1 || (l.art === 'leer' && l.ort !== null && !l.fremd),
		suchwoerter: ['link', 'kollegin'],
		abschnitt: 'Ablage',
	},
	{
		id: 'variante',
		titel: 'Variante mit neuen Zahlen',
		symbol: 'variante',
		// Nur, wo etwas neu gewürfelt werden kann (188-33); die Ablage fragt das je Material beim Server.
		wenn: (l) => fertigesDok(l)?.wuerfelbar === true,
		abschnitt: 'Ablage',
	},
	{
		id: 'entwuerfe',
		titel: 'Entwürfe vergleichen',
		symbol: 'ebenen',
		wenn: (l) => (einDok(l)?.meta.entwuerfe.length ?? 0) > 0,
		abschnitt: 'Ablage',
	},
	{
		id: 'umbenennen',
		titel: 'Umbenennen',
		symbol: 'schreiben',
		kuerzel: [{ key: 'Enter' }],
		wenn: (l) => l.objekte.length === 1,
		suchwoerter: ['name', 'titel'],
		abschnitt: 'Ablage',
	},
	{
		id: 'duplizieren',
		titel: 'Duplizieren',
		symbol: 'duplizieren',
		kuerzel: [
			{ code: 'KeyD', wahl: true },
			{ code: 'KeyD', befehl: true },
		],
		wenn: belegt,
		suchwoerter: ['kopie', 'verdoppeln'],
		abschnitt: 'Ablage',
	},
	{
		id: 'ausschneiden',
		titel: 'Ausschneiden',
		symbol: 'ausschneiden',
		kuerzel: [{ code: 'KeyX', befehl: true }],
		wenn: belegt,
		abschnitt: 'Ablage',
	},
	{
		id: 'kopieren',
		titel: 'Kopieren',
		symbol: 'kopieren',
		kuerzel: [{ code: 'KeyC', befehl: true }],
		wenn: belegt,
		abschnitt: 'Ablage',
	},
	{
		id: 'bewegenNach',
		titel: 'Bewegen nach …',
		symbol: 'bewegenNach',
		wenn: belegt,
		abschnitt: 'Ablage',
		suchwoerter: ['verschieben', 'ordner'],
	},
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
	{
		id: 'uebersicht',
		titel: 'Übersicht',
		symbol: 'vollbild',
		kuerzel: [{ key: ' ' }],
		// Nur für Material: An einem Ordner zeigte sie weniger als seine Kachel (188-34).
		wenn: (l) => l.art === 'material',
		abschnitt: 'Ansicht',
	},
	{
		id: 'informationen',
		titel: 'Informationen',
		symbol: 'info',
		kuerzel: [
			{ code: 'KeyI', wahl: true },
			{ code: 'KeyI', befehl: true },
		],
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
		suchwoerter: ['löschen', 'entfernen', 'wegwerfen'],
		abschnitt: 'Ablage',
	},
	{ id: 'darstellung', titel: 'Darstellung', symbol: 'seiten', wenn: fuerDieFlaeche, abschnitt: 'Ansicht' },
	{
		id: 'sortieren',
		titel: 'Sortieren',
		symbol: 'sortieren',
		wenn: (l) => !l.fremd && fuerDieFlaeche(l),
		abschnitt: 'Ansicht',
	},
	{
		id: 'allesWaehlen',
		titel: 'Alles auswählen',
		symbol: 'auswaehlen',
		kuerzel: [{ code: 'KeyA', befehl: true }],
		wenn: (l) => l.anzahl > 0 && fuerDieFlaeche(l),
		abschnitt: 'Auswahl',
	},
	{
		id: 'kacheln',
		titel: 'Als Kacheln',
		kuerzel: [
			{ code: 'Digit1', wahl: true },
			{ code: 'Digit1', befehl: true },
		],
		abschnitt: 'Ansicht',
	},
	{
		id: 'liste',
		titel: 'Als Liste',
		kuerzel: [
			{ code: 'Digit2', wahl: true },
			{ code: 'Digit2', befehl: true },
		],
		abschnitt: 'Ansicht',
	},
	{
		id: 'seitenleiste',
		titel: 'Seitenleiste ein oder aus',
		kuerzel: [
			{ code: 'KeyS', wahl: true },
			{ code: 'KeyS', befehl: true, wahl: true },
		],
		abschnitt: 'Ansicht',
	},
	{ id: 'rueckgaengig', titel: 'Rückgängig', kuerzel: [{ code: 'KeyZ', befehl: true }], abschnitt: 'Ablage' },
	{
		id: 'wiederholen',
		titel: 'Wiederholen',
		kuerzel: [{ code: 'KeyZ', befehl: true, umschalt: true }],
		abschnitt: 'Ablage',
	},
	{ id: 'suchen', titel: 'Suchen', kuerzel: [{ code: 'KeyF', befehl: true }], abschnitt: 'Gehe zu' },
	{ id: 'tasten', titel: 'Tasten zeigen', kuerzel: [{ key: '?' }], abschnitt: 'Ansicht' },
];

/**
 * Die Einträge je Art, Gruppen in Reihenfolge. Rechtsklick und ⋯ lesen dasselbe (Ticket, Kontextmenüs); das ⋯ der
 * Leiste lässt weg, was daneben als Knopf steht (188-31). „Ausschneiden“ bleibt Taste ohne Eintrag (188-32): Sichtbar
 * bewegt „Bewegen nach …“.
 */
export const MENUE: Record<MenueArt, string[][]> = {
	material: [
		['oeffnen', 'bearbeiten', 'praesentieren', 'neuerTab', 'imOrdnerZeigen'],
		['pdf', 'teilen'],
		['variante', 'entwuerfe'],
		['umbenennen', 'duplizieren', 'kopieren', 'bewegenNach'],
		['uebersicht', 'informationen'],
		['papierkorb'],
	],
	ordner: [
		['oeffnen', 'neuerTab', 'imOrdnerZeigen'],
		['neuerUnterordner', 'materialHier', 'einfuegen'],
		['pdf', 'teilen'],
		['umbenennen', 'duplizieren', 'kopieren', 'bewegenNach'],
		['informationen'],
		['papierkorb'],
	],
	mehrere: [['mitAuswahl'], ['pdf'], ['duplizieren', 'kopieren', 'bewegenNach'], ['papierkorb']],
	leer: [
		['neuerOrdner', 'materialAnlegen', 'einfuegen'],
		['darstellung', 'sortieren', 'allesWaehlen'],
		['pdf', 'teilen', 'informationen'],
	],
};

/** Im Ordner-Menü zählt „Einfügen“ auch auf der Lage „Ordner“; „leer“ kennt in Suche und Zuletzt kein PDF. */
const verfuegbar = (b: Befehl, l: Lage) => {
	if (l.gesperrt) {
		return false;
	}
	if (l.fremd && l.art === 'leer' && b.id === 'pdf') {
		return false;
	}
	if (b.id === 'einfuegen' && l.art === 'ordner') {
		return l.merkzettel !== null;
	}
	return !b.wenn || b.wenn(l);
};

const titelVon = (b: Befehl, l: Lage) => (typeof b.titel === 'string' ? b.titel : b.titel(l));

/** Ob ein Befehl hier gilt: dieselbe Frage für Menü, Taste und die Knöpfe der Leiste (188-02). */
export const gilt = (id: string, l: Lage) => {
	const b = BEFEHLE.find((x) => x.id === id);
	return b !== undefined && verfuegbar(b, l);
};

const KNOEPFE: Record<MenueArt, string[]> = {
	leer: ['neuerOrdner', 'materialAnlegen', 'darstellung', 'sortieren'],
	material: ['entwuerfe', 'praesentieren', 'bearbeiten', 'pdf', 'teilen'],
	ordner: ['pdf', 'teilen'],
	mehrere: ['pdf', 'bewegenNach'],
};

/**
 * Was die Leiste bei dieser Auswahl als Knopf zeigt, aus dem Register: Bei offenen Entwürfen „Entwürfe vergleichen“
 * statt „Bearbeiten“ und „PDF“ (188-02), an der Folie „Präsentieren“ statt „Bearbeiten“. Das ⋯ daneben lässt genau
 * diese weg (188-31), so hat jede Funktion in der Leiste einen sichtbaren Weg.
 */
export const leistenKnoepfe = (l: Lage): string[] => {
	const da = KNOEPFE[l.art].filter((id) => gilt(id, l));
	const haupt = da.includes('praesentieren') ? 'praesentieren' : 'bearbeiten';
	return da.filter((id) => (id === 'bearbeiten' ? haupt === id : id !== 'entwuerfe' || !da.includes(haupt)));
};

export interface MenueQuellen {
	fuehreAus: (id: string, l: Lage) => void;
	untermenue: (id: string, l: Lage) => MenueEintrag[] | null;
}

interface Zeile {
	b: Befehl;
	id: string;
	nr: number;
	unter: MenueEintrag[] | null;
}

/** Was Menü und ⌘K an dieser Lage zeigen, in der Reihenfolge des Menüs: eine Quelle für beide (S-02). */
const zeilenVon = (l: Lage, untermenue: MenueQuellen['untermenue'], ohne: readonly string[] = []): Zeile[] =>
	MENUE[l.art].flatMap((gruppe, nr) =>
		gruppe.flatMap((id): Zeile[] => {
			const b = BEFEHLE.find((x) => x.id === id);
			if (!b || ohne.includes(id) || !verfuegbar(b, l)) {
				return [];
			}
			const unter = untermenue(id, l);
			return unter?.length === 0 ? [] : [{ b, id, nr, unter }];
		}),
	);

/** Baut das Menü: Unverfügbares bleibt weg (070). `ohne`: was die Leiste schon als Knopf zeigt (188-31). */
export const menueVon = (
	l: Lage,
	{ fuehreAus, untermenue }: MenueQuellen,
	kopf?: string,
	ohne: readonly string[] = [],
): MenueEintrag[] => {
	const liste: MenueEintrag[] = kopf ? [{ titel: kopf, aus: true, gruppe: 'kopf' }] : [];
	for (const { b, id, nr, unter } of zeilenVon(l, untermenue, ohne)) {
		const [erstes] = b.kuerzel ?? [];
		// Nur eine Datei: Der Eintrag lädt sie selbst, ohne Untermenü mit einem Eintrag (191-41).
		const einzig = unter?.length === 1 && unter[0]?.waehle ? unter[0].waehle : undefined;
		liste.push({
			titel: titelVon(b, l),
			gruppe: String(nr),
			...(b.symbol ? { symbol: b.symbol } : {}),
			...(b.gefahr ? { gefahr: true } : {}),
			...(erstes ? { kuerzel: kuerzelText(erstes) } : {}),
			...(einzig ? { waehle: einzig } : unter ? { untermenue: unter } : { waehle: () => fuehreAus(id, l) }),
		});
	}
	return liste;
};

/** Für die Tastenliste. Sie liest das Register, damit dort nichts Falsches steht. */
const tastenTitel = (b: Befehl) => {
	if (typeof b.titel === 'string') {
		return b.titel;
	}
	return b.id === 'oeffnen' ? 'Öffnen' : b.id;
};

/** Ohne Auswahl stehen die Befehle an einer Auswahl gesperrt mit diesem Grund in ⌘K, statt zu fehlen (S-02). */
export const ERST_WAEHLEN = 'Erst Material oder Ordner wählen.';

/**
 * ⌘K in der Ablage: dieselben Befehle wie Rechtsklick und ⋯ an der Auswahl, als Gruppe „Auswahl: …“ (S-02).
 * Untermenüs werden zu eigenen Zeilen („PDF: Arbeitsblatt“). Ohne Auswahl stehen die Befehle an einer Auswahl
 * gesperrt da, so landet „löschen“ nie bei „Material anlegen“.
 */
export const paletteVon = (l: Lage, { fuehreAus, untermenue }: MenueQuellen, name: string): PalettenEintrag[] => {
	const gruppe = `Auswahl: ${name}`;
	if (l.art === 'leer') {
		const an = new Set([...MENUE.material, ...MENUE.ordner, ...MENUE.mehrere].flat());
		// Was ohne Auswahl ohnehin gilt oder etwas anlegt, gehört nicht dazu.
		for (const id of [...MENUE.leer.flat(), 'neuerUnterordner', 'materialHier', 'mitAuswahl', 'imOrdnerZeigen']) {
			an.delete(id);
		}
		return BEFEHLE.filter((b) => an.has(b.id)).map((b) => ({
			id: `ablage:${b.id}`,
			titel: tastenTitel(b),
			gruppe: 'Auswahl',
			...(b.symbol ? { symbol: b.symbol } : {}),
			...(b.suchwoerter ? { suchwoerter: b.suchwoerter } : {}),
			notiz: ERST_WAEHLEN,
			gesperrt: true,
			aus: () => undefined,
		}));
	}
	return zeilenVon(l, untermenue).flatMap(({ b, id, unter }): PalettenEintrag[] => {
		const titel = titelVon(b, l);
		const [erstes] = b.kuerzel ?? [];
		const gemeinsam = {
			gruppe,
			start: true,
			...(b.symbol ? { symbol: b.symbol } : {}),
			suchwoerter: b.suchwoerter ?? [],
		};
		if (unter && unter.length > 1) {
			return unter.flatMap((u, i) =>
				u.waehle && !u.aus ? [{ ...gemeinsam, id: `ablage:${id}:${i}`, titel: `${titel}: ${u.titel}`, aus: u.waehle }] : [],
			);
		}
		const einzig = unter?.[0]?.waehle;
		return [
			{
				...gemeinsam,
				id: `ablage:${id}`,
				titel,
				...(erstes ? { kuerzel: kuerzelText(erstes) } : {}),
				aus: einzig ?? (() => fuehreAus(id, l)),
			},
		];
	});
};

export const befehlZuTaste = (e: KeyboardEvent, l: Lage) =>
	BEFEHLE.find((b) => b.kuerzel?.some((k) => passtTaste(k, e)) && verfuegbar(b, l));

export const tastenAbschnitte = (mac?: boolean): TastenAbschnitt[] =>
	(['Ablage', 'Auswahl', 'Ansicht', 'Gehe zu'] as const).map((titel) => ({
		titel,
		zeilen: BEFEHLE.flatMap((b) => {
			const [erstes] = b.kuerzel ?? [];
			return b.abschnitt === titel && erstes
				? [{ id: b.id, titel: tastenTitel(b), tasten: [kuerzelText(erstes, mac)] }]
				: [];
		}),
	}));

/** Das angezeigte Kürzel eines Befehls der Ablage für Tooltips (53); `undefined`, wenn er keins hat. */
export const kuerzelVon = (id: string, mac?: boolean): string | undefined => {
	const befehl = BEFEHLE.find((b) => b.id === id);
	if (!befehl) {
		throw new Error(`Unbekannter Befehl ${id}`);
	}
	const [erstes] = befehl.kuerzel ?? [];
	return erstes ? kuerzelText(erstes, mac) : undefined;
};
