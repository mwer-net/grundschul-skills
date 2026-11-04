import { suchform } from '@schoolbox/kern/src/katalog';

import type { SymbolName } from '../bausteine/Symbol';

export interface PalettenEintrag {
	id: string;
	titel: string;
	/** Überschrift der Gruppe in der Liste. */
	gruppe: string;
	symbol?: SymbolName;
	notiz?: string;
	kuerzel?: string;
	suchwoerter?: readonly string[];
	/** Steht schon bei leerer Eingabe in der Liste. */
	start?: boolean;
	aus: () => unknown;
}

const ZULETZT = 'schoolbox-palette-zuletzt';
const ZULETZT_ANZAHL = 20;

export const zuletztBenutzt = (): string[] => {
	try {
		const wert: unknown = JSON.parse(localStorage.getItem(ZULETZT) ?? '[]');
		return Array.isArray(wert) ? wert.filter((id): id is string => typeof id === 'string') : [];
	} catch {
		return [];
	}
};

export const merkeBenutzt = (id: string) => {
	try {
		const neu = [id, ...zuletztBenutzt().filter((x) => x !== id)].slice(0, ZULETZT_ANZAHL);
		localStorage.setItem(ZULETZT, JSON.stringify(neu));
	} catch {
		// Ohne Speicher fehlt nur die Reihenfolge nach Gebrauch.
	}
};

const ANFANG = 4;
const WORTANFANG = 3;
const TEILWORT = 2;
const FOLGE = 1;

const WORTGRENZE = /[\s\-/(·:]+/;

const istFolge = (wort: string, text: string) => {
	let stelle = 0;
	for (const zeichen of wort) {
		stelle = text.indexOf(zeichen, stelle) + 1;
		if (stelle === 0) {
			return false;
		}
	}
	return true;
};

const stufe = (wort: string, text: string) => {
	if (text.startsWith(wort)) {
		return ANFANG;
	}
	const stelle = text.indexOf(wort);
	if (stelle > 0) {
		return text.split(WORTGRENZE).some((w) => w.startsWith(wort)) ? WORTANFANG : TEILWORT;
	}
	// Ein einzelner Buchstabe steckt in fast allem.
	return wort.length > 1 && istFolge(wort, text) ? FOLGE : 0;
};

/** Je Stufe zwei Werte: `titel` vor `suchwoerter`. */
const wertVon = (wort: string, titel: string, woerter: readonly string[]) => {
	const imTitel = stufe(wort, titel);
	const inWoertern = Math.max(0, ...woerter.map((w) => stufe(wort, w)));
	return Math.max(imTitel * 2 + 1, inWoertern * 2);
};

/** 0 heißt: passt nicht. Mehrere Wörter müssen alle passen. */
export const bewerte = (anfrage: string, e: Pick<PalettenEintrag, 'titel' | 'suchwoerter'>, zuletzt: readonly string[] = [], id = '') => {
	const ganz = suchform(anfrage).trim();
	const woerter = ganz.split(/\s+/).filter(Boolean);
	if (woerter.length === 0) {
		return 0;
	}
	const titel = suchform(e.titel);
	const andere = (e.suchwoerter ?? []).map(suchform);
	let summe = 0;
	for (const wort of woerter) {
		const wert = wertVon(wort, titel, andere);
		if (wert <= 1) {
			return 0;
		}
		summe += wert;
	}
	const stelle = zuletzt.indexOf(id);
	// Bricht nur Gleichstände derselben Stufe: Ein Tippfehler-Treffer überholt keinen echten Anfang.
	const bonus = stelle < 0 ? 0 : 0.5 - stelle / 100;
	return summe / woerter.length + bonus;
};

/** Die Treffer, die besten zuerst, in der Reihenfolge der Eingabe bei Gleichstand. */
export const suchePalette = <T extends PalettenEintrag>(anfrage: string, eintraege: readonly T[], zuletzt: readonly string[] = []) =>
	eintraege
		.map((eintrag, stelle) => ({ eintrag, stelle, wert: bewerte(anfrage, eintrag, zuletzt, eintrag.id) }))
		.filter((t) => t.wert > 0)
		.sort((a, b) => b.wert - a.wert || a.stelle - b.stelle)
		.map((t) => t.eintrag);

export const ZULETZT_TITEL = 'Zuletzt benutzt';

/** Leere Eingabe: zuletzt Benutztes, dann was für den Moment vorgesehen ist. */
export const startliste = <T extends PalettenEintrag>(eintraege: readonly T[], zuletzt: readonly string[], anzahl = 5) => {
	const vorne = zuletzt.flatMap((id) => eintraege.find((e) => e.id === id) ?? []).slice(0, anzahl);
	const schon = new Set(vorne.map((e) => e.id));
	return [
		...vorne.map((e) => ({ ...e, gruppe: ZULETZT_TITEL })),
		...eintraege.filter((e) => e.start && !schon.has(e.id)),
	];
};

export interface PalettenGruppe<T> {
	titel: string;
	eintraege: T[];
}

/** Gruppen in der Reihenfolge ihres besten Treffers; ↑ und ↓ laufen in derselben Folge. */
export const gruppiere = <T extends PalettenEintrag>(liste: readonly T[]) => {
	const gruppen = new Map<string, T[]>();
	for (const e of liste) {
		const g = gruppen.get(e.gruppe);
		if (g) {
			g.push(e);
		} else {
			gruppen.set(e.gruppe, [e]);
		}
	}
	return [...gruppen].map(([titel, eintraege]): PalettenGruppe<T> => ({ titel, eintraege }));
};
