import type { EbenenName } from '@schoolbox/kern/src/gestaltung-arten';
import { GESTALTUNG_ARTEN, LAGE } from '@schoolbox/kern/src/gestaltung-arten';
import type { Ablage } from '@schoolbox/kern/src/struktur';

/**
 * Was eine Schublade mit Gestaltung (Figuren, Bilder, Formen, Text) aufs Blatt gibt (098). Klick legt es in die Mitte
 * des sichtbaren Teils der Seite, Ziehen legt es frei ab, ⌘ beim Ziehen schaltet auf „in den Stapel“, sobald ein
 * Ticket das für seine Art freischaltet (`imStapel`: 103 Bilder ab E2, 115 Fläche ab E4).
 */
export interface GestaltungsGut {
	art: 'gestaltung';
	/** Steht am Zeiger und im Verlauf („… abgelegt“). */
	name: string;
	/** Ein Element; `data-lage="frei"` und die Lage setzt das Ablegen. */
	html: string;
	/** In px. Ohne `h` kommt die Höhe aus dem Inhalt (gemessen, damit der Zeiger in der Mitte liegt). */
	groesse: { b: number; h?: number };
	ebene: EbenenName;
	/** ⌘ beim Ziehen: so rastet es im Stapel ein, mit Lücke (094). Ohne Angabe tut ⌘ nichts („Geht noch nicht“). */
	imStapel?: { html: string; legeAb: (ablage: Ablage) => void };
	/** 105: Die Breite kommt aus dem Inhalt (Schmuckschrift ohne `--b`); `groesse.b` gilt nur zum Mitten und Zeigen. */
	breiteAusInhalt?: boolean;
	/** 105: Kurz vor dem Ablegen (Klick, Ziehen, ⌘K), z. B. um danach die Textsitzung zu öffnen. */
	vorDemAblegen?: () => void;
}

/** Die Standard-Ebene der Art wie im Kern (`legeGestaltungAb`): Streuung hinten, alles andere vorne. */
const ebeneDerArt = (html: string): EbenenName => {
	const vorlage = document.createElement('template');
	vorlage.innerHTML = html.trim();
	const element = vorlage.content.firstElementChild;
	if (!element) {
		return 'vorne';
	}
	element.setAttribute(LAGE, 'frei');
	return GESTALTUNG_ARTEN.find((a) => a.ebene && element.matches(a.selektor))?.ebene ?? 'vorne';
};

/** So bauen Schubladen ihr Gut; ohne `ebene` gilt der Standard der Art aus `gestaltung-arten.ts`. */
export const gestaltungsgut = (g: Omit<GestaltungsGut, 'art' | 'ebene'> & { ebene?: EbenenName }): GestaltungsGut => ({
	...g,
	art: 'gestaltung',
	ebene: g.ebene ?? ebeneDerArt(g.html),
});
