/** Ein Rechteck in Koordinaten der Leinwand. */
export interface Kante {
	links: number;
	rechts: number;
	oben: number;
	unten: number;
}

/** Abstand der Leiste zum Element und zum Rand des Sichtfelds. */
export const LEISTEN_ABSTAND = 6;

/**
 * Wo die Leiste am Element steht (204-15, 204-16), für Bausteine und Gestaltungselemente dieselbe Regel: über dem
 * Element, sonst darunter, sonst oben im Sichtfeld. Waagerecht rechtsbündig; ist das Element schmaler als die Leiste,
 * beginnt sie an seiner linken Kante. Sie bleibt ganz im Sichtfeld. `frei`: Platz über dem Element, den der Drehgriff
 * eines Gestaltungselements braucht.
 */
export const lageDerLeiste = (
	box: Kante,
	mass: { breite: number; hoehe: number },
	sicht: Kante,
	frei = 0,
) => {
	const oben = box.oben - frei - mass.hoehe - LEISTEN_ABSTAND;
	const unten = box.unten + LEISTEN_ABSTAND;
	let top = sicht.oben + LEISTEN_ABSTAND;
	if (oben >= sicht.oben + LEISTEN_ABSTAND) {
		top = oben;
	} else if (unten + mass.hoehe <= sicht.unten - LEISTEN_ABSTAND) {
		top = unten;
	}
	const schmal = box.rechts - box.links < mass.breite;
	const wunsch = schmal ? box.links : box.rechts - mass.breite;
	const links = Math.max(sicht.links + LEISTEN_ABSTAND, Math.min(wunsch, sicht.rechts - mass.breite - LEISTEN_ABSTAND));
	return { links, top };
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
