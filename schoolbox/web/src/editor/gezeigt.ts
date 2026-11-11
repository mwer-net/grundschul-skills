import type { Zerlegung } from '@schoolbox/kern/src/quelltext';

/** Das sichtbare Dokument im `iframe`, mit dem HTML und der Zerlegung, aus denen es entstand. */
export interface Geladen {
	doc: Document;
	html: string;
	zerlegung: Zerlegung;
}

/**
 * Was Seitenleisten und Leisten lesen (171): das Blatt, das gerade zu sehen ist, bis das nächste da ist. `gleich`: Die
 * neueste Quelle hat dieselben Nummern wie das Bild, und keine Auswahl wartet auf das Bild; dann gelten Quelle und
 * Zerlegung von jetzt, und nur dann wird geschrieben. Sonst die des Bilds, ein Bild hinterher, aber stimmig. `frisch`:
 * Das Bild zeigt schon die neueste Quelle.
 */
export interface Gezeigt {
	doc: Document;
	quelle: string | null;
	zerlegung: Zerlegung;
	gleich: boolean;
	frisch: boolean;
}

/**
 * Gleich viele Elemente, je Nummer derselbe Tag unter derselben Nummer der Eltern. Zwei gleich gebaute Elemente zu
 * tauschen ergibt dieselbe Gestalt; deshalb gehört zu `gleich` immer auch, dass keine Auswahl wartet.
 */
export const gleicheNummern = (a: Zerlegung, b: Zerlegung) =>
	a === b ||
	(a.knoten.length === b.knoten.length &&
		a.knoten.every((k, i) => {
			const n = b.knoten[i];
			return n !== undefined && n.tag === k.tag && (n.eltern?.nr ?? null) === (k.eltern?.nr ?? null);
		}));

interface Angaben {
	geladen: Geladen | null;
	/** Die neueste Zerlegung, aus der das HTML entsteht (auch eine Vorschau oder ein Vorschlag von Claude). */
	zerlegung: Zerlegung | null;
	/** Die Quelle des Verlaufs. */
	quelle: string | null;
	html: string | null;
	/** Eine Auswahl oder ein ⌘Z wartet auf das nächste Bild. */
	wartet: boolean;
}

/** `null` nur, solange noch kein Bild zu sehen ist. */
export const gezeigtVon = ({ geladen, html, quelle, wartet, zerlegung }: Angaben): Gezeigt | null => {
	if (!geladen) {
		return null;
	}
	const gleich = !wartet && zerlegung !== null && gleicheNummern(geladen.zerlegung, zerlegung);
	return {
		doc: geladen.doc,
		quelle: gleich ? quelle : geladen.zerlegung.quelle,
		zerlegung: gleich && zerlegung ? zerlegung : geladen.zerlegung,
		gleich,
		frisch: geladen.html === html,
	};
};

/** Was Seitenleisten und Leisten aus `gezeigt` lesen; leer, solange noch kein Bild zu sehen ist. */
export const zuSehen = (g: Gezeigt | null) => ({
	doc: g?.doc ?? null,
	quelle: g?.quelle ?? null,
	zerlegung: g?.zerlegung ?? null,
});
