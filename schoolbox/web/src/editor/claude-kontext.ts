import { createContext, useContext } from 'react';

/** Was nur der Editor kann. Stabil als Objekt, die Funktionen dahinter dürfen wechseln. */
export interface ClaudeHandlungen {
	/** Speichert den Stand des Editors, bevor Claude ihn liest. */
	vorbereiten: () => Promise<unknown>;
	/** Die markierte Stelle der Textsitzung; beendet die Sitzung. Leer, wenn keine läuft. */
	holeZitat: () => string;
	/** Gibt der Tastatur das Blatt zurück. */
	zumBlatt: () => void;
	/** Nimmt einen Vorschlag an, sodass Rückgängig ihn wieder zurücknimmt. */
	annimm: (arbeit: () => Promise<unknown>) => Promise<void>;
	/** Kopiert die Referenz für die Claude-App. */
	zurApp: (nr: number | null) => void;
}

/** Was Teile des Editors außerhalb der Blase brauchen: Inspektor und Ebenen (134, 135). */
export interface ClaudeSteuerung {
	/** Öffnet die Blase am Element; ohne Angabe an der Auswahl, ohne Auswahl an der Seite. */
	oeffne: (nr?: number | null) => void;
	/** Elemente mit einem Gespräch, das läuft, wartet oder einen Vorschlag hat: ✦ in den Ebenen (135). */
	merker: ReadonlySet<number>;
}

export const ClaudeKontext = createContext<ClaudeSteuerung>({
	oeffne: () => undefined,
	merker: new Set(),
});

export const useClaudeSteuerung = () => useContext(ClaudeKontext);
