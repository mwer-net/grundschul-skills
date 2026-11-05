import type { ComponentProps } from 'react';
import { createPortal } from 'react-dom';

import { klassen } from './klassen';

const RAND = 40;
const ROLLEN = 12;

interface Wege {
	bewegen: (m: PointerEvent) => void;
	los: (m: PointerEvent) => void;
	abbruch: () => void;
	taste: (k: KeyboardEvent) => void;
	tasteLos?: (k: KeyboardEvent) => void;
	/** Einmal je Bild, auch wenn der Zeiger still steht: Am Rand rollt die Liste unter ihm weiter. */
	bild: () => void;
	/** Solange gezogen wird, rollt der Finger nichts. */
	sperrtRollen: () => boolean;
}

/**
 * Lauscht an `window`, bis die zurückgegebene Funktion läuft: Das Element, an dem der Zug begann, kann unterwegs
 * verschwinden. Ablage und Gliederung teilen das; wann ein Zug beginnt und was er bewirkt, wissen sie selbst.
 */
export const folgeZeiger = (w: Wege) => {
	const lauscher = new AbortController();
	const { signal } = lauscher;
	const sperre = (t: TouchEvent) => {
		if (w.sperrtRollen()) {
			t.preventDefault();
		}
	};
	window.addEventListener('pointermove', w.bewegen, { signal });
	window.addEventListener('pointerup', w.los, { signal });
	window.addEventListener('pointercancel', w.abbruch, { signal });
	window.addEventListener('keydown', w.taste, { capture: true, signal });
	if (w.tasteLos) {
		window.addEventListener('keyup', w.tasteLos, { capture: true, signal });
	}
	document.addEventListener('touchmove', sperre, { passive: false, signal });
	let bild = 0;
	const schleife = () => {
		bild = requestAnimationFrame(schleife);
		w.bild();
	};
	bild = requestAnimationFrame(schleife);
	return () => {
		lauscher.abort();
		cancelAnimationFrame(bild);
	};
};

/** Der Klick nach dem Loslassen gehörte zum Zug, er wählt und öffnet nichts. */
export const schluckeKlick = () => {
	const schlucke = (k: MouseEvent) => {
		k.stopPropagation();
		k.preventDefault();
	};
	window.addEventListener('click', schlucke, { capture: true, once: true });
	window.setTimeout(() => window.removeEventListener('click', schlucke, true), 300);
};

/** Steht der Zeiger am oberen oder unteren Rand von `liste`, rollt sie ein Stück. */
export const rolleAmRand = (liste: Element, y: number) => {
	const r = liste.getBoundingClientRect();
	if (y < r.top + RAND) {
		liste.scrollBy(0, -ROLLEN);
	} else if (y > r.bottom - RAND) {
		liste.scrollBy(0, ROLLEN);
	}
};

/** Was am Zeiger hängt, solange gezogen wird; über allem, auch über Menüs. */
export const AmZeiger = ({ className, x, y, ...rest }: ComponentProps<'div'> & { x: number; y: number }) =>
	createPortal(
		<div
			className={klassen('pointer-events-none fixed top-0 left-0 z-meldung', className)}
			style={{ transform: `translate(${x + 8}px, ${y + 8}px)` }}
			{...rest}
		/>,
		document.body,
	);
