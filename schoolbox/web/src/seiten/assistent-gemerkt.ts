import type { Antworten, AssistentSchrittId, FreitextFeld } from '@schoolbox/kern/src/assistent';

/** Ein geschlossener Assistent mit Antworten: „Weiter ausfüllen“ öffnet ihn so wieder (190-02). */
export interface GemerkterAssistent {
	ordner: string | null;
	antworten: Antworten;
	titelEigen: boolean;
	schritt: AssistentSchrittId;
	besucht: readonly AssistentSchrittId[];
	offen: Partial<Record<FreitextFeld, boolean>>;
	/** Klasse und Fach selbst gewählt (S-14). */
	gewaehlt?: { fach: boolean; klasse: boolean };
}

/** Das Ereignis, auf das der Rahmen den gemerkten Assistenten öffnet. */
export const ASSISTENT_FORTSETZEN = 'schoolbox:assistent-fortsetzen';

// Nur im Speicher: Der Stand bleibt, bis die Seite neu lädt oder ein Material angelegt ist.
let gemerkt: GemerkterAssistent | null = null;

export const merkeAssistent = (stand: GemerkterAssistent | null) => {
	gemerkt = stand;
};

export const gemerkterAssistent = () => gemerkt;
