import { setzeAusschnitt } from '@schoolbox/kern/src/bildrahmen';

import type { DoppelklickZiel } from './doppelklick';
import type { GestaltungKontext } from './kontext';

/**
 * Modus „Ausschnitt verschieben“ (111): Doppelklick auf ein freies Bild mit Zuschnitt (`--h`) oder Maske. Ziehen im
 * Bild ändert `--bx`/`--by` (0–100 %), die Anzeige folgt live am Element im `iframe`. Esc oder ein Klick daneben
 * beendet den Modus; erst dann entsteht **ein** Schritt. Am Zeiger steht „Ausschnitt“.
 *
 * Solange der Modus läuft, lässt `useGeste` den Druck aufs Bild liegen (`ausschnittLaeuft`), damit Ziehen das Bild
 * nicht bewegt.
 */

interface Lauf {
	ende: () => void;
}

let lauf: Lauf | null = null;

export const ausschnittLaeuft = () => lauf !== null;

export const beendeAusschnitt = () => lauf?.ende();

/** Hat das Bild etwas zum Verschieben: eine feste Höhe (`--h`) oder eine Maske? */
export const hatZuschnitt = (element: Element) =>
	element.hasAttribute('data-maske') || /(^|;)\s*--h\s*:/.test(element.getAttribute('style') ?? '');

const prozent = (wert: string) => {
	const n = parseFloat(wert);
	return Number.isFinite(n) ? n : 50;
};

const begrenze = (n: number) => Math.min(100, Math.max(0, n));

/** Wie weit das Bild über seine Inhaltsbox hinausragt (`object-fit: cover`), in px je Achse. */
const ueberstand = (bild: HTMLImageElement) => {
	const stil = bild.ownerDocument.defaultView?.getComputedStyle(bild);
	const rand = (seite: string) => parseFloat(stil?.getPropertyValue(`padding-${seite}`) ?? '') || 0;
	const b = bild.clientWidth - rand('left') - rand('right');
	const h = bild.clientHeight - rand('top') - rand('bottom');
	const nb = bild.naturalWidth || b;
	const nh = bild.naturalHeight || h;
	const s = Math.max(b / Math.max(1, nb), h / Math.max(1, nh));
	return { x: Math.max(0, nb * s - b), y: Math.max(0, nh * s - h) };
};

/** Die Drehung aus `--drehen` in Grad (der Zug läuft im gedrehten Bild). */
const drehung = (bild: HTMLElement) => parseFloat(bild.style.getPropertyValue('--drehen')) || 0;

/** „Ausschnitt“ am Zeiger, im Editor außerhalb des `iframe` (wie der Wert am Zeiger bei Gesten). */
const zeigerSchild = (fenster: Window) => {
	const rahmen = fenster.frameElement as HTMLElement | null;
	const oben = rahmen?.ownerDocument ?? null;
	if (!rahmen || !oben) {
		return { zeige: () => undefined, weg: () => undefined };
	}
	const schild = oben.createElement('span');
	schild.className =
		'pointer-events-none fixed z-ueberlagerung rounded-lg bg-tinte px-3 py-1 font-medium whitespace-nowrap text-white shadow-2';
	schild.setAttribute('data-ausschnitt-zeiger', '');
	schild.textContent = 'Ausschnitt';
	schild.hidden = true;
	oben.body.append(schild);
	return {
		zeige: (x: number, y: number) => {
			const r = rahmen.getBoundingClientRect();
			const skala = rahmen.clientWidth > 0 ? r.width / rahmen.clientWidth : 1;
			schild.hidden = false;
			schild.style.left = `${r.left + x * skala + 18}px`;
			schild.style.top = `${r.top + y * skala + 18}px`;
		},
		weg: () => schild.remove(),
	};
};

/** Startet den Modus am gewählten freien Bild. */
export const starteAusschnitt = (g: GestaltungKontext, punkt?: { x: number; y: number }) => {
	beendeAusschnitt();
	const bild = g.element as HTMLImageElement;
	const fenster = g.doc.defaultView;
	if (!fenster || bild.tagName !== 'IMG') {
		return;
	}
	const stil = fenster.getComputedStyle(bild);
	const start = { bx: prozent(stil.getPropertyValue('--bx')), by: prozent(stil.getPropertyValue('--by')) };
	const jetzt = { ...start };
	let zug: { id: number; x: number; y: number; bx: number; by: number } | null = null;
	const schild = zeigerSchild(fenster);
	if (punkt) {
		schild.zeige(punkt.x, punkt.y);
	}
	bild.setAttribute('data-ausschnitt', '');
	bild.style.cursor = 'move';

	const imBild = (e: PointerEvent) => {
		const r = bild.getBoundingClientRect();
		return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
	};
	const halte = (e: Event) => {
		e.preventDefault();
		e.stopImmediatePropagation();
	};

	const runter = (e: PointerEvent) => {
		if (!e.isPrimary) {
			return;
		}
		if (!imBild(e)) {
			ende();
			return;
		}
		halte(e);
		zug = { id: e.pointerId, x: e.clientX, y: e.clientY, bx: jetzt.bx, by: jetzt.by };
	};
	const bewegt = (e: PointerEvent) => {
		schild.zeige(e.clientX, e.clientY);
		if (!zug || e.pointerId !== zug.id) {
			return;
		}
		halte(e);
		// Den Weg ins Bild drehen: Ein gedrehtes Bild verschiebt sich entlang seiner eigenen Achsen.
		const w = (-drehung(bild) * Math.PI) / 180;
		const roh = { x: e.clientX - zug.x, y: e.clientY - zug.y };
		const dx = roh.x * Math.cos(w) - roh.y * Math.sin(w);
		const dy = roh.x * Math.sin(w) + roh.y * Math.cos(w);
		const u = ueberstand(bild);
		// Das Bild folgt dem Zeiger: nach rechts ziehen zeigt mehr vom linken Teil, also kleineres `--bx`.
		jetzt.bx = begrenze(u.x > 0 ? zug.bx - (dx / u.x) * 100 : zug.bx);
		jetzt.by = begrenze(u.y > 0 ? zug.by - (dy / u.y) * 100 : zug.by);
		bild.style.setProperty('--bx', `${Math.round(jetzt.bx)}%`);
		bild.style.setProperty('--by', `${Math.round(jetzt.by)}%`);
	};
	const hoch = (e: PointerEvent) => {
		if (zug && e.pointerId === zug.id) {
			halte(e);
			zug = null;
		}
	};
	const taste = (e: KeyboardEvent) => {
		if (e.key === 'Escape' || e.key === 'Enter') {
			halte(e);
			ende();
		}
	};

	const lauscher = new AbortController();
	const { signal } = lauscher;
	fenster.addEventListener('pointerdown', runter, { capture: true, signal });
	fenster.addEventListener('pointermove', bewegt, { capture: true, signal });
	fenster.addEventListener('pointerup', hoch, { capture: true, signal });
	fenster.addEventListener('keydown', taste, { capture: true, signal });
	// Esc, während der Fokus in der Bedienung liegt.
	window.addEventListener('keydown', taste, { capture: true, signal });
	// Ein Druck außerhalb des Blatts (Schubladen, Inspektor) beendet den Modus ebenso.
	window.addEventListener('pointerdown', () => ende(), { capture: true, signal });

	const ende = () => {
		if (lauf !== dieser) {
			return;
		}
		lauf = null;
		lauscher.abort();
		schild.weg();
		bild.removeAttribute('data-ausschnitt');
		bild.style.removeProperty('cursor');
		const bx = Math.round(jetzt.bx);
		const by = Math.round(jetzt.by);
		if (bx !== Math.round(start.bx) || by !== Math.round(start.by)) {
			g.fuehreAus('Ausschnitt verschoben', (q) => ({ quelle: setzeAusschnitt(q, g.nr, bx, by), nr: g.nr }));
		}
	};
	const dieser: Lauf = { ende };
	lauf = dieser;
};

/** Zeile für den Doppelklick-Verteiler (`doppelklick.ts`). */
export const AUSSCHNITT: DoppelklickZiel = {
	id: 'ausschnitt',
	passt: (element, art) => art === 'bildfrei' && hatZuschnitt(element),
	tu: (g, punkt) => starteAusschnitt(g, punkt),
};
