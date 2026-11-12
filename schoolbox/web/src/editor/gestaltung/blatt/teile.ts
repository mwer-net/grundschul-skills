import type { Seitengestaltung, SeitenTeil } from '@schoolbox/kern/src/seitengestaltung';

export type { SeitenTeil };

/** Was jeder Abschnitt der Seitengestaltung im Reiter „Blatt“ bekommt (095 Fläche und Rahmen, 181 Kopfband). */
export interface BlattTeile {
	doc: Document | null;
	quelle: string;
	/** Nummer der `.seite` in `quelle`, für die die Felder ihre Werte zeigen. */
	seite: number;
	/** Index dieser Seite unter den Seiten, ab 0. */
	index: number;
	/** Wie viele Seiten das Material hat. */
	seiten: number;
	/** Fläche, Rahmen und Kopfband von `seite`. */
	gestaltung: Seitengestaltung;
	minibuch: boolean;
	/** Ein Schritt im Verlauf; die Auswahl bleibt, wenn ihre Nummer gleich bleibt. */
	aendere: (beschreibung: string, rechne: (q: string) => string) => void;
	/** Nur ansehen, während ein Regler gezogen wird: setzt Eigenschaften am Teil im Blatt, die Quelle bleibt. */
	zeige: (teil: SeitenTeil, alle: boolean, werte: Readonly<Record<string, string>>) => void;
}

/** Die Seiten im Blatt, ohne die erzeugten Fortsetzungen der Darstellung. */
export const quellSeiten = (doc: Document) => [...doc.querySelectorAll<HTMLElement>('.seite:not([data-erzeugt])')];

/** Setzt `werte` am Teil der Seiten mit diesen Indizes (alle, wenn `null`). */
export const zeigeAmTeil = (
	doc: Document | null,
	indizes: readonly number[] | null,
	teil: SeitenTeil,
	werte: Readonly<Record<string, string>>,
) => {
	if (!doc) {
		return;
	}
	const seiten = quellSeiten(doc).filter((_, i) => indizes === null || indizes.includes(i));
	for (const s of seiten) {
		const element = s.querySelector<HTMLElement>(`:scope > .ebene.hinten > .${teil}`);
		for (const [name, wert] of Object.entries(werte)) {
			element?.style.setProperty(name, wert);
		}
	}
};
