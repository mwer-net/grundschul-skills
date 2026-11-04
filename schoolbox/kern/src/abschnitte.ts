/** Feste Reihenfolge im Inspektor: Was nicht zutrifft, entfällt; alles andere steht immer an derselben Stelle. */
export const ABSCHNITTE = ['inhalt', 'darstellung', 'loesung', 'bewertung', 'weitere'] as const;
export type AbschnittName = (typeof ABSCHNITTE)[number];

export const ABSCHNITT_TITEL: Record<AbschnittName, string> = {
	inhalt: 'Inhalt',
	darstellung: 'Darstellung',
	loesung: 'Lösung',
	bewertung: 'Bewertung',
	weitere: 'Weitere',
};
