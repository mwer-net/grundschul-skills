import type { Art, Fach, Format, Klasse } from './werte';
import { ART_ANGABEN, ART_FORMATE, ARTEN, FAECHER, FORMATE, KLASSEN } from './werte';

/** Ein Ordner, in den neues Material kommen kann. Mit `fach` und `klasse`: Er hat einen Behälter, das Fach steht fest. */
export interface EinordnungOrdner {
	id: string;
	pfad: string;
	fach?: Fach | undefined;
	klasse?: Klasse | undefined;
}

/** Was aus einer Nachricht werden soll (077, 079). Der Vorschlag für eine Karte, angelegt ist damit noch nichts. */
export interface Einordnung {
	titel: string;
	fach: Fach;
	klasse: Klasse;
	art: Art;
	format: Format;
	/** `null`: „Mein Material“. Aus einer Nachricht entsteht kein neuer Ordner. */
	ordner: { id: string; pfad: string; vorhanden?: boolean } | null;
	/** Fach und Klasse kommen aus dem Behälter des Ordners, die Karte fragt nicht danach. */
	fest: boolean;
	/** Claude hat nicht eingeordnet: Vorbelegung, bitte prüfen. */
	rueckfall: boolean;
}

const TITEL_MAX = 80;
const TITEL_WOERTER = 6;
const UNBEKANNT = 'unbekannt';

/** Die erlaubten Werte stehen nur hier, aus den Listen von `kern`. So kann das Schema sie nicht verfehlen. */
export const einordnungSchema = (ordner: readonly string[]) => ({
	type: 'object',
	additionalProperties: false,
	required: ['titel', 'fach', 'klasse', 'art', 'format', 'ordnerId'],
	properties: {
		titel: { type: 'string' },
		fach: { enum: [...FAECHER] },
		klasse: { enum: [...KLASSEN] },
		art: { enum: [...ARTEN, UNBEKANNT] },
		format: { enum: [...FORMATE] },
		ordnerId: { enum: [...ordner, null] },
	},
});

const aus = <T>(liste: readonly T[], wert: unknown): T | undefined => liste.find((w) => w === wert);

const mitOrdner = (o: EinordnungOrdner, vorhanden: boolean, fach: Fach, klasse: Klasse) => ({
	fach: o.fach ?? fach,
	klasse: o.klasse ?? klasse,
	ordner: { id: o.id, pfad: o.pfad, ...(vorhanden ? { vorhanden: true } : {}) },
	fest: o.fach !== undefined,
});

/**
 * Prüft die Antwort von Claude gegen dieselben Listen wie das Schema. Ungültiges gibt `null`: Dann gilt der Rückfall.
 * In einem Ordner steht das Ziel fest. In „Mein Material“ darf Claude einen vorhandenen Ordner vorschlagen.
 */
export const pruefeEinordnung = (
	roh: unknown,
	ordner: readonly EinordnungOrdner[],
	aktuelle?: EinordnungOrdner,
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
		return { ...grund, ...mitOrdner(aktuelle, false, fach, klasse) };
	}
	if (typeof w.ordnerId === 'string') {
		const vorschlag = ordner.find((o) => o.id === w.ordnerId);
		return vorschlag ? { ...grund, ...mitOrdner(vorschlag, true, fach, klasse) } : null;
	}
	return { ...grund, fach, klasse, ordner: null, fest: false };
};

/** Ohne Einordnung geht es trotzdem weiter: Titel aus den ersten Wörtern, Standard für Art und Format. */
export const rueckfallEinordnung = (text: string, aktuelle?: EinordnungOrdner | null): Einordnung => {
	const titel = text.trim().split(/\s+/).slice(0, TITEL_WOERTER).join(' ').slice(0, TITEL_MAX) || 'Neues Material';
	const grund = { titel, art: 'arbeitsblatt' as const, format: ART_ANGABEN.arbeitsblatt.format, rueckfall: true };
	return aktuelle
		? { ...grund, ...mitOrdner(aktuelle, false, 'deutsch', 1) }
		: { ...grund, fach: 'deutsch', klasse: 1, ordner: null, fest: false };
};
