import type { Meldung } from '@schoolbox/kern/src/meldungen';
import type { DokumentMeta, Mappe } from '@schoolbox/kern/src/schema';

export type { DokumentMeta, Mappe, Meldung };

export interface DokumentEintrag {
	id: string;
	meta: DokumentMeta;
	/** Kennung der Vorschau für die Adresse des Bildes, `null` solange es keine gibt. */
	vorschau: string | null;
}

export interface MappenEintrag {
	mappe: Mappe;
	dokumente: DokumentEintrag[];
}

export interface DefekteMappe {
	id: string;
	fehler: string;
}

export interface MappenListe {
	mappen: MappenEintrag[];
	defekt: DefekteMappe[];
}

export interface PapierkorbEintrag {
	eintrag: string;
	id: string;
	geloescht: string;
	bis: string;
	mappe: Mappe | null;
}

export interface Freigabe {
	token: string;
	ziel: { mappe: string; dok: string | null };
	erstellt: string;
	widerrufen: string | null;
	pfad: string;
	url: string | null;
}

export interface PdfMeldung extends Meldung {
	dok: string;
	titel: string;
}

/** Antwort, wenn ein PDF fertig ist: wohin der Browser für die Datei geht, wie sie heißt, was die Prüfung fand. */
export interface PdfAntwort {
	adresse: string;
	dateiname: string;
	meldungen: PdfMeldung[];
}
