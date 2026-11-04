import type { Art, Fach, Format, Klasse } from './werte';
import { ART_ANGABEN, ART_FORMATE, ARTEN, FAECHER, FORMATE, KLASSEN } from './werte';

export interface EinordnungMappe {
	id: string;
	titel: string;
	fach: Fach;
	klasse: Klasse;
}

/** Was aus einer Nachricht werden soll (077). Der Vorschlag für eine Karte, angelegt ist damit noch nichts. */
export interface Einordnung {
	titel: string;
	fach: Fach;
	klasse: Klasse;
	art: Art;
	format: Format;
	mappe: { id: string; titel: string; vorhanden?: boolean } | { neu: string };
	/** Claude hat nicht eingeordnet: Vorbelegung aus der Mappe, bitte prüfen. */
	rueckfall: boolean;
}

const TITEL_MAX = 80;
const TITEL_WOERTER = 6;
const UNBEKANNT = 'unbekannt';

/** Die erlaubten Werte stehen nur hier, aus den Listen von `kern`. So kann das Schema sie nicht verfehlen. */
export const einordnungSchema = (mappen: readonly string[]) => ({
	type: 'object',
	additionalProperties: false,
	required: ['titel', 'fach', 'klasse', 'art', 'format', 'mappeId', 'neueMappe'],
	properties: {
		titel: { type: 'string' },
		fach: { enum: [...FAECHER] },
		klasse: { enum: [...KLASSEN] },
		art: { enum: [...ARTEN, UNBEKANNT] },
		format: { enum: [...FORMATE] },
		mappeId: { enum: [...mappen, null] },
		neueMappe: { type: ['string', 'null'] },
	},
});

const aus = <T>(liste: readonly T[], wert: unknown): T | undefined => liste.find((w) => w === wert);

const gleichesWort = (a: string, b: string) => a.trim().toLocaleLowerCase('de') === b.trim().toLocaleLowerCase('de');

const leseMappe = (mappeId: unknown, neueMappe: unknown, mappen: readonly EinordnungMappe[]) => {
	if (typeof mappeId === 'string') {
		return mappen.find((m) => m.id === mappeId) ?? null;
	}
	return typeof neueMappe === 'string' ? (mappen.find((m) => gleichesWort(m.titel, neueMappe)) ?? neueMappe.trim()) : null;
};

/**
 * Prüft die Antwort von Claude gegen dieselben Listen wie das Schema. Ungültiges gibt `null`: Dann gilt der Rückfall.
 * In einer Mappe gehört das Dokument in diese Mappe, mit ihrem Fach und ihrer Klasse.
 */
export const pruefeEinordnung = (
	roh: unknown,
	mappen: readonly EinordnungMappe[],
	aktuelle?: EinordnungMappe,
): Einordnung | null => {
	const w = (roh ?? {}) as Record<string, unknown>;
	const titel = typeof w.titel === 'string' ? w.titel.trim() : '';
	const art = aus(ARTEN, w.art);
	const format = aus(FORMATE, w.format);
	const fach = aus(FAECHER, w.fach);
	const klasse = aus(KLASSEN, w.klasse);
	if (!titel || titel.length > TITEL_MAX || !art || !format || !fach || klasse === undefined) {
		return null;
	}
	if (!ART_FORMATE[art].includes(format)) {
		return null;
	}
	const grund = { titel, art, format, rueckfall: false };
	if (aktuelle) {
		const { fach: f, id, klasse: k, titel: t } = aktuelle;
		return { ...grund, fach: f, klasse: k, mappe: { id, titel: t } };
	}
	const mappe = leseMappe(w.mappeId, w.neueMappe, mappen);
	if (!mappe) {
		return null;
	}
	if (typeof mappe === 'string') {
		return mappe ? { ...grund, fach, klasse, mappe: { neu: mappe } } : null;
	}
	return {
		...grund,
		fach: mappe.fach,
		klasse: mappe.klasse,
		mappe: { id: mappe.id, titel: mappe.titel, vorhanden: true },
	};
};

/** Ohne Einordnung geht es trotzdem weiter: Titel aus den ersten Wörtern, Standard für Art und Format. */
export const rueckfallEinordnung = (text: string, aktuelle?: EinordnungMappe | null): Einordnung => {
	const titel = text.trim().split(/\s+/).slice(0, TITEL_WOERTER).join(' ').slice(0, TITEL_MAX) || 'Neues Material';
	const grund = { titel, art: 'arbeitsblatt' as const, format: ART_ANGABEN.arbeitsblatt.format, rueckfall: true };
	return aktuelle
		? {
				...grund,
				fach: aktuelle.fach,
				klasse: aktuelle.klasse,
				mappe: { id: aktuelle.id, titel: aktuelle.titel },
			}
		: { ...grund, fach: 'deutsch', klasse: 1, mappe: { neu: titel } };
};
