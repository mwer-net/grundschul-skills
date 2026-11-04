export type ChatRolle = 'lehrkraft' | 'claude';

export interface ChatNachricht {
	rolle: ChatRolle;
	text: string;
	/** Worauf sich die Nachricht bezog, wie im Chip. */
	kontext: string | null;
	zeit: string;
	auftragId: string | null;
}

export type ChatSpeicher = Pick<Storage, 'getItem' | 'key' | 'length' | 'removeItem' | 'setItem'>;

const PRAEFIX = 'schoolbox-chat-verlauf:';
export const MAX_NACHRICHTEN = 50;
/** Dieselben Grenzen wie `KI_GRENZEN` am Server; der Server prüft sie noch einmal. */
export const SERVER_NACHRICHTEN = 6;
export const SERVER_ZEICHEN = 2000;

export const verlaufSchluessel = (mappe?: string, dok?: string) => {
	if (mappe && dok) {
		return `${PRAEFIX}${mappe}/${dok}`;
	}
	return mappe ? `${PRAEFIX}${mappe}` : `${PRAEFIX}global`;
};

const istNachricht = (n: unknown): n is ChatNachricht => {
	const { auftragId, kontext, rolle, text, zeit } = (n ?? {}) as Record<string, unknown>;
	return (
		(rolle === 'lehrkraft' || rolle === 'claude') &&
		typeof text === 'string' &&
		typeof zeit === 'string' &&
		(kontext === null || typeof kontext === 'string') &&
		(auftragId === null || typeof auftragId === 'string')
	);
};

/** Kaputtes im Speicher ist ein leerer Verlauf, nie ein Fehler. */
export const liesVerlauf = (speicher: ChatSpeicher, schluessel: string): ChatNachricht[] => {
	try {
		const daten: unknown = JSON.parse(speicher.getItem(schluessel) ?? '[]');
		return Array.isArray(daten) && daten.every(istNachricht) ? daten.slice(-MAX_NACHRICHTEN) : [];
	} catch {
		return [];
	}
};

export const schreibeVerlauf = (speicher: ChatSpeicher, schluessel: string, verlauf: readonly ChatNachricht[]) => {
	try {
		if (verlauf.length === 0) {
			speicher.removeItem(schluessel);
		} else {
			speicher.setItem(schluessel, JSON.stringify(verlauf.slice(-MAX_NACHRICHTEN)));
		}
	} catch {
		// Voller Speicher: Der Verlauf ist Bequemlichkeit, die Arbeit geht vor.
	}
};

/** Beim Abmelden: Auf diesem Gerät bleibt nichts vom Gespräch. */
export const loescheAlleVerlaeufe = (speicher: ChatSpeicher) => {
	const schluessel = Array.from({ length: speicher.length }, (_, i) => speicher.key(i));
	for (const s of schluessel) {
		if (s?.startsWith(PRAEFIX)) {
			speicher.removeItem(s);
		}
	}
};

/** Was vom Verlauf an den Server geht: die jüngsten Nachrichten; was nicht mehr passt, fällt vorn weg. */
export const verlaufFuerServer = (verlauf: readonly ChatNachricht[]) => {
	const kurz: { rolle: ChatRolle; text: string }[] = [];
	let frei = SERVER_ZEICHEN;
	for (const { rolle, text } of verlauf.slice(-SERVER_NACHRICHTEN).reverse()) {
		if (frei <= 0) {
			break;
		}
		kurz.unshift({ rolle, text: text.slice(-frei) });
		frei -= Math.min(frei, text.length);
	}
	return kurz;
};
