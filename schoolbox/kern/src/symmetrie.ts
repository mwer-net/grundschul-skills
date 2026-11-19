/**
 * Achsen der Großbuchstaben und Ziffern in Grundschul-Druckschrift (245), die eine Quelle für `x-symmetrie-sortieren`.
 * `abbildungen.js` trägt dieselbe Tabelle, ein Test hält beide gleich; der Katalog bekommt sie als erzeugten Abschnitt.
 *
 * Fachquelle: die übliche Einteilung der Druck-Großbuchstaben nach Spiegelachsen in der Geometrie der Grundschule
 * (Achsensymmetrie, Klasse 2 bis 4), vom Admin in Ticket 245 vorgegeben. Gemeint ist die Form der Druckbuchstaben,
 * nicht eine bestimmte Schrift: B, C, D, E und K gelten als waagerecht symmetrisch, auch wenn die Bögen in einer
 * Schrift leicht verschieden groß sind. 0 und 8 sind als Oval gesetzt, 3 hat die waagerechte Achse. Alle anderen
 * Großbuchstaben und Ziffern haben keine Achse.
 */

export const SYMMETRIE_GRUPPEN = ['senkrecht', 'waagerecht', 'beide', 'keine'] as const;
export type SymmetrieGruppe = (typeof SYMMETRIE_GRUPPEN)[number];

/** Ohne Eintrag: keine Achse. */
export const SYMMETRIE_ZEICHEN: Record<Exclude<SymmetrieGruppe, 'keine'>, string> = {
	senkrecht: 'AMTUVWY',
	waagerecht: 'BCDEK3',
	beide: 'HIOX08',
};

export const SYMMETRIE_SPALTEN: Record<SymmetrieGruppe, string> = {
	senkrecht: 'nur senkrecht',
	waagerecht: 'nur waagerecht',
	beide: 'beide Achsen',
	keine: 'keine Achse',
};

const ZEICHEN = /^[A-Z0-9]$/;

/** Gruppe eines Zeichens; `null`, wenn es nicht in der Tabelle steht (Kleinbuchstaben, Umlaute, Satzzeichen). */
export const zeichenGruppe = (z: string): SymmetrieGruppe | null => {
	if (!ZEICHEN.test(z)) {
		return null;
	}
	const treffer = (Object.keys(SYMMETRIE_ZEICHEN) as (keyof typeof SYMMETRIE_ZEICHEN)[]).find((g) =>
		SYMMETRIE_ZEICHEN[g].includes(z),
	);
	return treffer ?? 'keine';
};

const ALLE = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...'0123456789'];

/** Für den Katalog: je Gruppe die Zeichen, Buchstaben und Ziffern getrennt. */
export const symmetrieTabelle = () => {
	const zeilen = SYMMETRIE_GRUPPEN.map((g) => {
		const zeichen = ALLE.filter((z) => zeichenGruppe(z) === g);
		const buchstaben = zeichen.filter((z) => /[A-Z]/.test(z)).join(' ');
		const ziffern = zeichen.filter((z) => /\d/.test(z)).join(' ');
		return `| ${SYMMETRIE_SPALTEN[g]} (\`${g}\`) | ${buchstaben || '–'} | ${ziffern || '–'} |`;
	});
	return ['| Spalte | Buchstaben | Ziffern |', '|---|---|---|', ...zeilen].join('\n');
};
