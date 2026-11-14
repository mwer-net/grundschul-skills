/**
 * Gleiche Sätze werden eine Zeile, die Zahl steht dahinter: „… abgeschnitten. (5 Stellen)“; bei einer Stelle steht
 * nichts dahinter (191-11). Die Reihenfolge des ersten Vorkommens bleibt.
 */
export const fasseZusammen = (saetze: readonly string[]): string[] => {
	const zahl = new Map<string, number>();
	for (const satz of saetze) {
		zahl.set(satz, (zahl.get(satz) ?? 0) + 1);
	}
	return [...zahl].map(([satz, n]) => (n > 1 ? `${satz} (${n} Stellen)` : satz));
};
