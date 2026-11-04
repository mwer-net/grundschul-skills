import { sende } from '../api';

const SCHLUESSEL = 'schoolbox.zwischenablage';

export interface Abgelegt {
	html: string;
	ort: 'seite' | 'aufgabe' | 'zeile';
	name: string;
	mappe: string;
	dok: string;
}

/** Nur was dieser Editor selbst abgelegt hat: `localStorage` gehört der Schoolbox, nichts kommt von außen. */
export const leseAblage = (): Abgelegt | null => {
	try {
		const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null') as Partial<Abgelegt> | null;
		return roh && typeof roh.html === 'string' && typeof roh.mappe === 'string' && typeof roh.dok === 'string'
			? (roh as Abgelegt)
			: null;
	} catch {
		return null;
	}
};

export const schreibeAblage = (eintrag: Abgelegt) => localStorage.setItem(SCHLUESSEL, JSON.stringify(eintrag));

/** Holt die Bilder ins Ziel; der Verweis im Baustein folgt, falls ein Name dort schon vergeben ist. */
export const mitBildern = async (
	ziel: { mappe: string; dok: string },
	von: { sammlung: string } | { mappe: string; dok: string },
	html: string,
) => {
	const { umbenannt } = await sende<{ umbenannt: Record<string, string> }>(
		`/api/eigene/bilder/${ziel.mappe}/${ziel.dok}`,
		{ html, von },
	);
	return Object.entries(umbenannt).reduce((text, [alt, neu]) => text.split(alt).join(neu), html);
};
