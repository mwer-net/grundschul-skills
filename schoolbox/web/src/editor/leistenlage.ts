/** Ein Rechteck in Koordinaten der Leinwand. */
export interface Kante {
	links: number;
	rechts: number;
	oben: number;
	unten: number;
}

/** Abstand der Leiste zum Element und zum Rand des Sichtfelds. */
export const LEISTEN_ABSTAND = 6;

/** Freier Streifen über und unter dem Element bis zum nächsten Inhalt, in Pixeln der Leinwand (204-N04). */
export interface Raum {
	oben: number;
	unten: number;
}

/**
 * Wo die Leiste am Element steht (204-15, 204-16), für Bausteine und Gestaltungselemente dieselbe Regel: über dem
 * Element, sonst darunter, sonst oben im Sichtfeld. Waagerecht rechtsbündig; ist das Element schmaler als die Leiste,
 * beginnt sie an seiner linken Kante. Sie bleibt ganz im Sichtfeld. `frei`: Platz über dem Element, den der Drehgriff
 * eines Gestaltungselements braucht.
 *
 * 204-N04: Mit `raum` steht die Leiste unter dem Element, wenn sie darüber Inhalt verdecken würde, darunter aber
 * nicht. `unter` hält eine schon getroffene Wahl fest (Textsitzung).
 */
export const lageDerLeiste = (
	box: Kante,
	mass: { breite: number; hoehe: number },
	sicht: Kante,
	frei = 0,
	raum: Raum | null = null,
	unter: boolean | null = null,
) => {
	const oben = box.oben - frei - mass.hoehe - LEISTEN_ABSTAND;
	const unten = box.unten + LEISTEN_ABSTAND;
	const passtOben = oben >= sicht.oben + LEISTEN_ABSTAND;
	const passtUnten = unten + mass.hoehe <= sicht.unten - LEISTEN_ABSTAND;
	const verdecktOben = raum !== null && raum.oben < frei + mass.hoehe + LEISTEN_ABSTAND;
	const freiUnten = raum !== null && raum.unten >= mass.hoehe + LEISTEN_ABSTAND;
	const wunschUnter = unter ?? (verdecktOben && freiUnten);
	let top = sicht.oben + LEISTEN_ABSTAND;
	if (wunschUnter && passtUnten) {
		top = unten;
	} else if (passtOben) {
		top = oben;
	} else if (passtUnten) {
		top = unten;
	}
	const schmal = box.rechts - box.links < mass.breite;
	const wunsch = schmal ? box.links : box.rechts - mass.breite;
	const links = Math.max(sicht.links + LEISTEN_ABSTAND, Math.min(wunsch, sicht.rechts - mass.breite - LEISTEN_ABSTAND));
	return { links, top, unter: top === unten };
};

/**
 * 204-N04: Wie viel Platz ohne Text und Bild über und unter `box` (Koordinaten des Blatts) bleibt, im waagerechten
 * Streifen `von`–`bis`, den die Leiste belegt, gesucht in `wurzel` (der Seite). Inhalt in `eigen` zählt nicht; der Text der umgebenden Aufgabe zählt.
 * Ergebnis in Pixeln des Blatts; ohne Inhalt in der Richtung `Infinity`.
 */
export const freierRaum = (
	wurzel: Element,
	box: { top: number; bottom: number },
	von: number,
	bis: number,
	eigen: readonly Element[],
): Raum => {
	let oben = Number.POSITIVE_INFINITY;
	let unten = Number.POSITIVE_INFINITY;
	const miss = (r: DOMRect) => {
		if (r.width < 1 || r.height < 1 || Math.min(r.right, bis) - Math.max(r.left, von) <= 1) {
			return;
		}
		if (r.top < box.top - 0.5) {
			oben = Math.min(oben, Math.max(0, box.top - Math.min(r.bottom, box.top)));
		}
		if (r.bottom > box.bottom + 0.5) {
			unten = Math.min(unten, Math.max(0, Math.max(r.top, box.bottom) - box.bottom));
		}
	};
	const fremd = (k: Node) => !eigen.some((el) => el.contains(k));
	const doc = wurzel.ownerDocument;
	const lauf = doc.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
	const bereich = doc.createRange();
	for (let k = lauf.nextNode(); k; k = lauf.nextNode()) {
		const stil = k.parentElement ? doc.defaultView?.getComputedStyle(k.parentElement) : null;
		if (!k.nodeValue?.trim() || !fremd(k) || stil?.visibility === 'hidden') {
			continue;
		}
		bereich.selectNodeContents(k);
		for (const r of bereich.getClientRects()) {
			miss(r);
		}
	}
	for (const b of wurzel.querySelectorAll('img, svg, x-uhr, canvas')) {
		if (fremd(b) && !b.parentElement?.closest('svg')) {
			miss(b.getBoundingClientRect());
		}
	}
	return { oben, unten };
};

/**
 * 204-13: Ein Mausklick auf einen Knopf der Leiste lässt den Fokus im Blatt, Esc geht dann sofort eine Ebene höher.
 * Knöpfe, die ein Menü oder Popover öffnen, behalten ihn, ebenso „Claude“ (der Fokus geht ins Gespräch); mit der
 * Tastatur (`detail` 0) bleibt alles, wie es war.
 */
export const fokusZurueckInsBlatt = (ereignis: { detail: number; target: EventTarget | null }, doc: Document) => {
	const knopf = (ereignis.target as Element | null)?.closest?.('button');
	if (ereignis.detail > 0 && knopf && !knopf.matches('[aria-haspopup], [aria-expanded], [data-claude-knopf]')) {
		doc.defaultView?.focus();
	}
};

/** Ob sich zwei Rechtecke schneiden; bloßes Berühren zählt nicht. */
export const schneiden = (
	a: { left: number; right: number; top: number; bottom: number },
	b: { left: number; right: number; top: number; bottom: number },
) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Die Leiste der Auswahl im Elternfenster, ob Baustein oder Gestaltung. */
export const leisteDerAuswahl = (doc: Document) =>
	doc.querySelector<HTMLElement>('[data-bausteinleiste], [data-gestaltungsleiste]');

const gemerkt = new WeakMap<Element, { schluessel: string; raum: Raum }>();

/**
 * `freierRaum` in Pixeln der Leinwand, für die Leiste an `eigen` mit der Box `box` (Blatt) und dem waagerechten Platz
 * `links`–`links + breite` (Leinwand). Gemerkt je Seite, solange Box und Platz gleich bleiben.
 */
export const raumFuerLeiste = (
	e: { links: number; skala: number },
	box: { top: number; bottom: number },
	links: number,
	breite: number,
	eigen: readonly Element[],
): Raum | null => {
	const wurzel = eigen[0]?.closest('.seite') ?? eigen[0]?.ownerDocument.body;
	if (!wurzel) {
		return null;
	}
	const von = (links - e.links) / e.skala;
	const bis = (links + breite - e.links) / e.skala;
	const schluessel = [box.top, box.bottom, von, bis, ...eigen.map((el) => el.getAttribute('data-sb'))].join('|');
	const alt = gemerkt.get(wurzel);
	const roh = alt?.schluessel === schluessel ? alt.raum : freierRaum(wurzel, box, von, bis, eigen);
	gemerkt.set(wurzel, { schluessel, raum: roh });
	return { oben: roh.oben * e.skala, unten: roh.unten * e.skala };
};
