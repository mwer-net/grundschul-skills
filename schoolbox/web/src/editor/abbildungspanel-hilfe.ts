import type { Feld } from '@schoolbox/kern/src/abbildungen';
import { feldWert } from '@schoolbox/kern/src/abbildungen';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState } from 'react';

import { folgeZeiger, rolleAmRand, schluckeKlick } from '../bausteine/zeigerzug';
import type { AbbildungSteuerung } from './abbildung';

export const wertVon = (feld: Feld, abb: AbbildungSteuerung) => (abb.werte ? feldWert(feld, abb.werte) : null);

/** 196-09: Enter übernimmt (wie Verlassen) und lässt den Fokus im Feld. */
export const fertigMitEnter = (e: KeyboardEvent<HTMLInputElement>) => {
	if (e.key === 'Enter') {
		const feld = e.currentTarget;
		feld.blur();
		feld.focus();
	}
};

/** Griff zum Umsortieren: Der Zug sagt nur, wohin; geschrieben wird erst beim Loslassen, ein Schritt im Verlauf. */
export const useZeilenZug = (verschiebe: (von: number, nach: number) => void) => {
	const behaelter = useRef<HTMLDivElement>(null);
	const [zug, setZug] = useState<{ von: number; nach: number } | null>(null);
	const zielBei = (y: number) => {
		const zeilen = [...(behaelter.current?.querySelectorAll(':scope > [data-zeile]') ?? [])];
		const i = zeilen.findIndex((z) => {
			const r = z.getBoundingClientRect();
			return y < r.top + r.height / 2;
		});
		return i < 0 ? zeilen.length : i;
	};
	const greife = (von: number, e: ReactPointerEvent<HTMLButtonElement>) => {
		if (e.button !== 0) {
			return;
		}
		e.preventDefault();
		const griff = e.currentTarget;
		const start = e.clientY;
		let y = start;
		let laeuft = false;
		const rolle = behaelter.current?.closest('.overflow-y-auto') ?? null;
		const hoereAuf = folgeZeiger({
			bewegen: (m) => {
				y = m.clientY;
				if (!laeuft && Math.abs(y - start) >= 4) {
					laeuft = true;
					// Stünde der Fokus im Blatt, käme Esc dort an und wählte das Elternteil, statt den Zug abzubrechen.
					// `blur()` am Rahmen gibt ihn in Safari nicht frei, der Griff nimmt ihn.
					griff.focus({ preventScroll: true });
					setZug({ von, nach: zielBei(y) });
				}
			},
			los: (m) => {
				hoereAuf();
				setZug(null);
				if (laeuft) {
					schluckeKlick();
					verschiebe(von, zielBei(m.clientY));
				}
			},
			abbruch: () => {
				hoereAuf();
				setZug(null);
			},
			taste: (k) => {
				if (k.key === 'Escape') {
					k.preventDefault();
					k.stopPropagation();
					hoereAuf();
					setZug(null);
				}
			},
			bild: () => {
				if (laeuft) {
					if (rolle) {
						rolleAmRand(rolle, y);
					}
					setZug({ von, nach: zielBei(y) });
				}
			},
			sperrtRollen: () => laeuft,
		});
	};
	return { behaelter, zug, greife };
};
