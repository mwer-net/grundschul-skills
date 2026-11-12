import type { SchubladenId } from './reihe';
import { alsSchublade } from './reihe';

/**
 * Feste Breiten links (162). 280 ist die größte runde Breite, bei der „Einpassen“ am Mac 1512×982 mit Ebenen und
 * Schublade gleich bleibt (das Blatt behält mindestens 660 px). 560 ist knapp mehr, als das Blatt heute am iPad quer
 * hat (536 px): Darunter steht die Schublade allein an der Stelle der Ebenen.
 */
export const BREITE = { ebenen: 240, schublade: 280 } as const;
export const LEISTE = 72;
export const BLATT_MIN = 560;

/** Breite der Spalte einer Schublade; die eine Stelle, an der eine Schublade mit Grund anders breit wird. */
export const breiteVon = (id: SchubladenId) => (id === 'ebenen' ? BREITE.ebenen : BREITE.schublade);

export type AndereId = Exclude<SchubladenId, 'ebenen'>;

/** Ebenen an oder aus; dazu die zuletzt gewählte andere Schublade und ob sie offen ist. */
export interface LinksStand {
	ebenen: boolean;
	schublade: AndereId;
	offen: boolean;
}

/** Was links gerade zu sehen ist. */
export interface LinksZeigt {
	ebenen: boolean;
	schublade: AndereId | null;
}

/** `bereich`: die Breite links vom Inspektor, also Leiste, Spalten und Blatt. */
export const istEng = (bereich: number, schublade: AndereId) =>
	bereich < LEISTE + BREITE.ebenen + breiteVon(schublade) + BLATT_MIN;

/**
 * Eng steht die offene Schublade an der Stelle der Ebenen. Ist die gewählte nicht bereit (Vorschau, Konflikt), stehen
 * an ihrer Stelle die Ebenen (093).
 */
export const angezeigt = (s: LinksStand, eng: boolean, bereit: (id: AndereId) => boolean): LinksZeigt => {
	const schublade = s.offen && bereit(s.schublade) ? s.schublade : null;
	return { schublade, ebenen: (s.ebenen || (s.offen && schublade === null)) && !(eng && schublade !== null) };
};

/** Klick in der Leiste, ⌥1 … ⌥5 und ⌘K: Die Ebenen schalten für sich, von den anderen ist eine offen oder keine. */
export const schalte = (s: LinksStand, id: SchubladenId, zeigt: LinksZeigt, eng: boolean): LinksStand => {
	if (id === 'ebenen' && zeigt.ebenen) {
		return { ...s, ebenen: false, offen: zeigt.schublade !== null };
	}
	if (id === 'ebenen') {
		// Eng schließt das die Schublade, die an ihrer Stelle stand.
		return { ...s, ebenen: true, offen: eng ? false : zeigt.schublade !== null };
	}
	return zeigt.schublade === id ? { ...s, offen: false } : { ...s, schublade: id, offen: true };
};

/** „Linke Leiste“ schließt alles Sichtbare und holt es wieder; ohne `vorher` (nach dem Neuladen) die Ebenen. */
export const schalteLeiste = (
	s: LinksStand,
	zeigt: LinksZeigt,
	vorher: LinksStand | null,
): { stand: LinksStand; vorher: LinksStand | null } =>
	zeigt.ebenen || zeigt.schublade !== null
		? { stand: { ...s, ebenen: false, offen: false }, vorher: s }
		: { stand: vorher ?? { ...s, ebenen: true, offen: false }, vorher: null };

/** Die sichtbaren Spalten von links nach rechts. */
export const sichtbar = (zeigt: LinksZeigt): SchubladenId[] => [
	...(zeigt.ebenen ? (['ebenen'] as const) : []),
	...(zeigt.schublade === null ? [] : [zeigt.schublade]),
];

/** `links` hält die offene Schublade oder `zu`, `ebenen` hält `1` oder `0`. */
export const SPEICHER = { links: 'schoolbox-panel-links', ebenen: 'schoolbox-ebenen-offen' } as const;

/** Bis 183: Ebenen angeheftet und ihr Anteil an der geteilten Spalte. */
export const ALT = ['schoolbox-ebenen-angeheftet', 'schoolbox-ebenen-teilung'] as const;

/**
 * Der Stand beim Laden. Fehlt `SPEICHER.ebenen`, wird einmal übernommen: Die Ebenen sind offen, wenn sie angeheftet
 * waren oder in `SPEICHER.links` keine andere Schublade stand (`ebenen`, `gliederung`, `seiten`, `rezepte`,
 * Unbekanntes, nichts). Ein neues Material öffnet „Bausteine“.
 */
export const linksAusSpeicher = (
	lies: (schluessel: string) => string | null,
	neu: boolean,
): { stand: LinksStand; uebernehmen: boolean } => {
	const wert = lies(SPEICHER.links);
	const gefunden = alsSchublade(wert);
	const andere = gefunden === 'ebenen' ? null : gefunden;
	const gespeichert = lies(SPEICHER.ebenen);
	const ebenen =
		gespeichert === null ? lies(ALT[0]) === '1' || (wert !== 'zu' && andere === null) : gespeichert === '1';
	return {
		stand: { ebenen, schublade: neu ? 'bausteine' : (andere ?? 'bausteine'), offen: neu || andere !== null },
		uebernehmen: gespeichert === null,
	};
};
