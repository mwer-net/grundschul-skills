export type ChatRolle = 'lehrkraft' | 'claude';

export interface ChatNachricht {
	rolle: ChatRolle;
	text: string;
	/** Worauf sich die Nachricht bezog, wie im Chip. */
	kontext: string | null;
	zeit: string;
	auftragId: string | null;
}

export type ChatSpeicher = Pick<Storage, 'key' | 'length' | 'removeItem'>;

/** Früher lagen hier Verlauf und Fenster; der Verlauf enthielt Materialtext. */
const ALTER_PRAEFIX = 'schoolbox-chat-';
export const MAX_NACHRICHTEN = 50;
/** Dieselben Grenzen wie `KI_GRENZEN` am Server; der Server prüft sie noch einmal. */
export const SERVER_NACHRICHTEN = 20;
export const SERVER_ZEICHEN = 8000;
export const SERVER_LETZTE_ZEICHEN = 32_000;

/** Das Gespräch lebt nur im Speicher der Seite (Entscheidung 37). Was ältere Fassungen abgelegt haben, kommt weg. */
export const loescheAlteVerlaeufe = (speicher: ChatSpeicher) => {
	const schluessel = Array.from({ length: speicher.length }, (_, i) => speicher.key(i));
	for (const s of schluessel) {
		if (s?.startsWith(ALTER_PRAEFIX)) {
			speicher.removeItem(s);
		}
	}
};

/**
 * Was vom Verlauf an den Server geht, für den Rückfall: die jüngsten Nachrichten; was nicht mehr passt, fällt vorn weg.
 * Die Nachricht vor der neuen bleibt ganz, denn auf sie antwortet die neue.
 */
export const verlaufFuerServer = (verlauf: readonly ChatNachricht[]) => {
	const [letzte, ...aeltere] = verlauf.slice(-SERVER_NACHRICHTEN).reverse();
	if (!letzte) {
		return [];
	}
	const kurz = [{ rolle: letzte.rolle, text: letzte.text.slice(-SERVER_LETZTE_ZEICHEN) }];
	let frei = SERVER_ZEICHEN;
	for (const { rolle, text } of aeltere) {
		if (frei <= 0) {
			break;
		}
		kurz.unshift({ rolle, text: text.slice(-frei) });
		frei -= Math.min(frei, text.length);
	}
	return kurz;
};

/** Keine Kennzeichnung und kein Parser: Der Text reicht. */
export const istRueckfrage = (text: string | undefined) => /\?\s*$/.test(text ?? '');
