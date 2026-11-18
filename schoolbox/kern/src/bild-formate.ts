/**
 * Die Formatnamen der KI-Bilder (237) und ihre Pixel für die Bild-API. Die Namen sind die von Canva, damit `bilder.md`
 * und Claude sie weiterverwenden; die Pixel stehen nur hier. Rund 1,6 MP wie bei Canva, alle Kanten Vielfache von 16,
 * alle laut Doku gültig (Seitenverhältnis 1:3 bis 3:1, 655.360 bis 8.294.400 Pixel).
 */
export const BILD_FORMATE = {
	LANDSCAPE_2_1: { breite: 1792, hoehe: 896 },
	LANDSCAPE_16_9: { breite: 1664, hoehe: 928 },
	LANDSCAPE_3_2: { breite: 1536, hoehe: 1024 },
	LANDSCAPE_4_3: { breite: 1472, hoehe: 1104 },
	LANDSCAPE_5_4: { breite: 1440, hoehe: 1152 },
	SQUARE_1_1: { breite: 1264, hoehe: 1264 },
	PORTRAIT_4_5: { breite: 1152, hoehe: 1440 },
	PORTRAIT_3_4: { breite: 1104, hoehe: 1472 },
	PORTRAIT_2_3: { breite: 1024, hoehe: 1536 },
	PORTRAIT_9_16: { breite: 928, hoehe: 1664 },
	PORTRAIT_1_2: { breite: 896, hoehe: 1792 },
} as const;

export type BildFormat = keyof typeof BILD_FORMATE;
export const BILD_FORMAT_NAMEN = Object.keys(BILD_FORMATE) as BildFormat[];

export const istBildFormat = (wert: unknown): wert is BildFormat =>
	typeof wert === 'string' && Object.hasOwn(BILD_FORMATE, wert);

/** `size` der Bild-API, z. B. `1440x1152`. */
export const bildGroesse = (format: BildFormat) => `${BILD_FORMATE[format].breite}x${BILD_FORMATE[format].hoehe}`;

/** Das Format mit dem nächsten Seitenverhältnis: Beim Bearbeiten bleibt ein Bild in seinem Format. */
export const formatFuerMasse = (breite: number, hoehe: number): BildFormat => {
	const ziel = Math.log(breite / hoehe);
	let bestes: BildFormat = 'SQUARE_1_1';
	let abstand = Number.POSITIVE_INFINITY;
	for (const name of BILD_FORMAT_NAMEN) {
		const f = BILD_FORMATE[name];
		const d = Math.abs(Math.log(f.breite / f.hoehe) - ziel);
		if (d < abstand) {
			bestes = name;
			abstand = d;
		}
	}
	return bestes;
};
