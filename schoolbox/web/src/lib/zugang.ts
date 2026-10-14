import type { MappenVariante, PdfVariante } from '@schoolbox/kern/src/namen';

import { lade, sende } from '../api';
import type { PdfAntwort } from '../typen';

/**
 * Woher eine Seite ihre Daten holt: die Lehrkraft über die API mit Anmeldung, ein Teilen-Link über `/f/<token>`, nur
 * lesend. Ansicht, Vorschau, PDF und Drucken sind für beide gleich gebaut, nur die Adressen unterscheiden sich.
 */
export interface Zugang {
	mappe: string;
	/** Token eines Teilen-Links, `null` für die angemeldete Lehrkraft. */
	token: string | null;
}

const basis = ({ token }: Zugang) => (token === null ? '' : `/f/${token}`);

export const istGeteilt = (zugang: Zugang) => zugang.token !== null;

export const inhaltAdresse = (zugang: Zugang) =>
	zugang.token === null ? `/api/mappen/${zugang.mappe}` : `/f/${zugang.token}/api/inhalt`;

export const ansichtAdresse = (zugang: Zugang, dok: string, loesung = false) =>
	`${basis(zugang)}/ansicht/${zugang.mappe}/dokumente/${dok}/${loesung ? '?loesung=1' : ''}`;

export const vorschauAdresse = (zugang: Zugang, dok: string, kennung: string) =>
	`${basis(zugang)}/ansicht/${zugang.mappe}/dokumente/${dok}/ausgabe/material-s1.png?v=${kennung}`;

/** Seite der Mappe; bei einem Link auf ein einzelnes Dokument gibt es sie nicht. */
export const mappenSeite = (zugang: Zugang) => (zugang.token === null ? `/m/${zugang.mappe}` : `/f/${zugang.token}`);

export const dokumentSeite = (zugang: Zugang, dok: string) =>
	zugang.token === null ? `/m/${zugang.mappe}/${dok}` : `/f/${zugang.token}/d/${dok}`;

export const druckSeite = (zugang: Zugang, dok: string, variante: PdfVariante) =>
	`${dokumentSeite(zugang, dok)}/drucken?fassung=${variante}`;

export const bereiteDokumentVor = (zugang: Zugang, dok: string, variante: PdfVariante) =>
	zugang.token === null
		? sende<PdfAntwort>(`/api/dokumente/${zugang.mappe}/${dok}/pdf`, { variante })
		: lade<PdfAntwort>(`/f/${zugang.token}/api/pdf/${dok}/${variante}`);

export const bereiteMappeVor = (zugang: Zugang, variante: MappenVariante) =>
	zugang.token === null
		? sende<PdfAntwort>(`/api/mappen/${zugang.mappe}/pdf`, { variante })
		: lade<PdfAntwort>(`/f/${zugang.token}/api/alles/${variante}`);
