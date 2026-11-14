/** Ereignis am `window`: startet die Auswahl des Meldeknopfs (Befehl `dokument.melden` im Editor, 193-31). */
export const MELDUNG_STARTEN = 'schoolbox:melden';

export const starteMeldung = () => window.dispatchEvent(new Event(MELDUNG_STARTEN));

const letzteFehler: string[] = [];

/** Die letzten 20 Fehler der Seite; der Meldeknopf schickt sie mit, die Fehlergrenze trägt ein, was sie fängt. */
export const merkeFehler = (text: string) => {
	letzteFehler.push(`${new Date().toISOString()} ${text}`.slice(0, 500));
	letzteFehler.splice(0, Math.max(0, letzteFehler.length - 20));
};

export const gemerkteFehler = () => [...letzteFehler];

if (typeof window !== 'undefined') {
	window.addEventListener('error', (e) => merkeFehler(`${e.message} (${e.filename}:${e.lineno})`));
	window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) =>
		merkeFehler(`unhandledrejection: ${String(e.reason instanceof Error ? e.reason.message : e.reason)}`),
	);
}
