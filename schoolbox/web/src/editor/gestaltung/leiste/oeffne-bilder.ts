import type { Befehle } from '../../useBefehle';

/** Öffnet die Schublade „Bilder“; ist sie schon offen, bleibt sie offen. „Austauschen“ und „Bild einsetzen“ (172). */
export const oeffneBilder = (befehle: Befehle) => {
	const jetzt = befehle.jetzt.current;
	if (!jetzt.linksOffen.includes('bilder')) {
		jetzt.tu.links('bilder');
	}
};
