import type { Seiten, Seitengestaltung } from '@schoolbox/kern/src/seitengestaltung';

export type SeitenTeil = 'seitenflaeche' | 'seitenrahmen';

/** Was jeder Unterabschnitt von Blatt › Gestaltung bekommt (095 Fläche und Rahmen, 119 Rezept). */
export interface BlattTeile {
	doc: Document | null;
	quelle: string;
	/** Nummer der `.seite` in `quelle`, für die die Felder ihre Werte zeigen. */
	seite: number;
	/** „Gilt für“: diese Seite oder alle. */
	ziel: Seiten;
	/** Fläche und Rahmen von `seite`. */
	gestaltung: Seitengestaltung;
	minibuch: boolean;
	/** Ein Schritt im Verlauf; die Auswahl bleibt, wenn ihre Nummer gleich bleibt. */
	aendere: (beschreibung: string, rechne: (q: string) => string) => void;
	/** Nur ansehen, während ein Regler gezogen wird: setzt Eigenschaften am Teil im Blatt, die Quelle bleibt. */
	zeige: (teil: SeitenTeil, werte: Readonly<Record<string, string>>) => void;
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
