import { BEFEHLE } from '../editor/befehle';

/**
 * Der Name eines Befehls in Anführungszeichen, aus dem Register wie in Menü und Palette (30). So läuft die Hilfe nicht
 * auseinander, wenn ein Befehl umbenannt wird.
 */
export const befehlName = (id: string) => {
	const befehl = BEFEHLE.find((b) => b.id === id);
	const titel = typeof befehl?.titel === 'string' ? befehl.titel : befehl?.hilfeTitel;
	if (!titel) {
		throw new Error(`Befehl ohne festen Namen: ${id}`);
	}
	return `„${titel}“`;
};
