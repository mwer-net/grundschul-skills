import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import type { Ort } from '@schoolbox/kern/src/referenz';
import type { RefObject } from 'react';
import { createContext, useContext, useEffect, useLayoutEffect } from 'react';

import type { PfadTeil } from './darstellung';
import type { useKiZustand } from './ki';

export type ChatFensterZustand = 'zu' | 'zeile' | 'verlauf';

/** Was nur der Editor kann. Stabil als Objekt, die Funktionen dahinter dürfen wechseln. */
export interface ChatHandlungen {
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

export interface DokumentKontext {
	art: 'dokument';
	mappe: string;
	dok: string;
	titel: string;
	adresse: string;
	zerlegung: Zerlegung | null;
	ort: Ort;
	loesung: boolean;
	nr: number | null;
	pfad: PfadTeil[];
	frei: boolean;
	/** Der Bereich, über dessen Mitte das Fenster liegt. */
	anker: RefObject<HTMLElement | null>;
	handlungen: RefObject<ChatHandlungen>;
}

/** Dokumentansicht und Entwürfe: Auftrag aufs Dokument, das Ergebnis sieht man im Editor. */
export interface AnsichtKontext {
	art: 'ansicht';
	mappe: string;
	dok: string;
}

/** Ablage, Papierkorb, Hilfe: Eine Nachricht wird neues Material (077). */
export interface NeuKontext {
	art: 'neu';
	/** Immer `null`: Neues Material hängt am Ordner, nicht an einem Behälter. */
	mappe: null;
	/** Der offene Ordner; `null`: „Mein Material“ oder eine Seite ohne Ordner. */
	ordner?: string | null;
}

export type ChatKontext = DokumentKontext | AnsichtKontext | NeuKontext;

export interface ChatLauf {
	art: 'arbeitet' | 'bereit' | 'antwort';
	/** Beginn in ms; zählt die Zeit in der Statusleiste. */
	seit: number;
}

export interface ChatStand {
	fenster: ChatFensterZustand;
	lauf: ChatLauf | null;
	/** Höhe des offenen Verlaufs; so viel fehlt dem Blatt beim Einpassen. */
	verlaufHoehe: number;
	ki: ReturnType<typeof useKiZustand>;
}

export interface ChatSteuerung {
	melde: (kontext: ChatKontext | null) => void;
	/** ⌘J: öffnet, holt den Fokus ins Feld oder schließt, wenn er schon dort ist. */
	taste: () => void;
	/** Der Knopf im Kopf: offen oder zu, mehr nicht. */
	wechsle: () => void;
	/** Öffnet und setzt den Fokus ins Feld. */
	oeffne: (fenster?: 'zeile' | 'verlauf') => void;
	/** Schreibt ins Feld; abgeschickt wird nur von Hand. */
	fuelle: (text: string) => void;
}

const nichts = () => undefined;

export const ChatSteuerungKontext = createContext<ChatSteuerung>({
	melde: nichts,
	taste: nichts,
	wechsle: nichts,
	oeffne: nichts,
	fuelle: nichts,
});

export const ChatStandKontext = createContext<ChatStand | null>(null);

export const useChat = () => useContext(ChatSteuerungKontext);

export const useChatStand = () => {
	const stand = useContext(ChatStandKontext);
	if (!stand) {
		throw new Error('Außerhalb von ChatRahmen');
	}
	return stand;
};

/** Die Seite sagt, worum es gerade geht. `kontext` muss gemerkt sein: Jede Änderung folgt dem Chip. */
export const useChatKontext = (kontext: ChatKontext | null) => {
	const { melde } = useChat();
	useLayoutEffect(() => melde(kontext), [kontext, melde]);
	useEffect(() => () => melde(null), [melde]);
};
