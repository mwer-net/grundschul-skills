import type { SymbolName } from '../../bausteine/Symbol';

/**
 * Die sechs Schubladen in der Reihenfolge der Leiste, ⌥1 bis ⌥6 (Entscheidung 42). Ohne React: Das Befehlsregister
 * baut daraus seine Befehle, die Schubladen selbst (`index.ts`) hängen an Komponenten.
 */
export const REIHE = [
	{ id: 'ebenen', titel: 'Ebenen', symbol: 'ebenen', taste: 'Digit1' },
	{ id: 'bausteine', titel: 'Bausteine', symbol: 'bausteine', taste: 'Digit2' },
	{ id: 'formen', titel: 'Formen', symbol: 'formen', taste: 'Digit3' },
	{ id: 'figuren', titel: 'Figuren', symbol: 'figuren', taste: 'Digit4' },
	{ id: 'text', titel: 'Text', symbol: 'schrift', taste: 'Digit5' },
	{ id: 'bilder', titel: 'Bilder', symbol: 'bild', taste: 'Digit6' },
] as const satisfies readonly { id: string; titel: string; symbol: SymbolName; taste: `Digit${number}` }[];

export type SchubladenId = (typeof REIHE)[number]['id'];

type Kopf = (typeof REIHE)[number];

/** Id, Titel, Symbol und Taste einer Schublade; ihre Datei übernimmt das mit `...kopf('formen')`. */
export const kopf = <I extends SchubladenId>(id: I) => REIHE.find((s) => s.id === id) as Extract<Kopf, { id: I }>;

export const SCHUBLADEN_IDS: readonly SchubladenId[] = REIHE.map((s) => s.id);

/** Ein gespeicherter Wert von früher: `gliederung` (bis 093) und `seiten` (bis 080) führen beide zu den Ebenen. */
export const alsSchublade = (wert: string | null): SchubladenId | null => {
	if (wert === 'gliederung' || wert === 'seiten') {
		return 'ebenen';
	}
	return SCHUBLADEN_IDS.find((id) => id === wert) ?? null;
};

/** Der Befehl, der eine Schublade öffnet, wechselt und schließt. */
export const befehlZuSchublade = (id: SchubladenId) => `ansicht.links-${id}`;
