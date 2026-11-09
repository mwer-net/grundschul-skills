import { legeGestaltungAb } from '@schoolbox/kern/src/gestaltung';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef } from 'react';

import { schluckeKlick } from '../../../bausteine/zeigerzug';
import { nrVon } from '../../darstellung';
import type { Struktur } from '../../struktur';
import { istFeld, TASTEN_SPERRE } from '../../tasten';
import { eckeVon, entferneVorschau, seiteUnter, zeigeVorschau } from '../ablegen/vorschau';
import type { Punkt, Tasten, Werkzeug } from '.';
import { AUSWAHL, werkzeugVon } from '.';
import { useWerkzeugStand, werkzeugStand, zurAuswahl } from './stand';

/** Weniger Weg (px am Bildschirm) ist ein Klick, kein Strich. */
const KLICK_WEG = 4;

interface Strichlauf {
	id: number;
	w: Werkzeug;
	seite: Element;
	nr: number;
	/** Start am Bildschirm, für den Klick. */
	x: number;
	y: number;
}

const tastenVon = (ev: { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean }): Tasten => ({
	umschalt: ev.shiftKey,
	wahl: ev.altKey,
	befehl: ev.metaKey || ev.ctrlKey,
});

/**
 * Das aktive Werkzeug auf dem Blatt (098): Ein Strich über der Überlagerung zeigt die Vorschau im `iframe` ohne
 * Schritt, am Ende legt `legeGestaltungAb` das Element ab (ein Schritt, danach gewählt). Danach gilt wieder V, außer
 * das Werkzeug wurde mit ⇧ gewählt. Esc kehrt immer zu V zurück. Die Überlagerung fängt alle Zeiger: Ein Strich auf
 * einer Figur wählt die Figur nicht.
 */
export const useWerkzeug = ({
	aktiv,
	doc,
	skala,
	struktur,
}: {
	doc: Document;
	skala: number;
	struktur: Pick<Struktur, 'fuehreAus'>;
	/** Das Blatt nimmt Änderungen an (keine Textsitzung, keine Vorschau einer Version). */
	aktiv: boolean;
}) => {
	const stand = useWerkzeugStand();
	const werkzeug = stand.id === AUSWAHL ? null : (werkzeugVon(stand.id) ?? null);
	const strich = useRef<Strichlauf | null>(null);

	const brichAb = () => {
		strich.current = null;
		entferneVorschau(doc);
	};

	useEffect(() => {
		if (!aktiv && werkzeug) {
			zurAuswahl();
		}
	}, [aktiv, werkzeug]);

	useEffect(() => {
		if (!werkzeug) {
			return undefined;
		}
		const esc = (k: KeyboardEvent) => {
			if (k.key !== 'Escape' || istFeld(k.target) || document.querySelector(TASTEN_SPERRE)) {
				return;
			}
			k.preventDefault();
			k.stopImmediatePropagation();
			strich.current = null;
			entferneVorschau(doc);
			zurAuswahl();
		};
		window.addEventListener('keydown', esc, true);
		doc.addEventListener('keydown', esc, true);
		return () => {
			window.removeEventListener('keydown', esc, true);
			doc.removeEventListener('keydown', esc, true);
		};
	}, [werkzeug, doc]);

	/** Zeiger in Koordinaten des Materials: Die Überlagerung liegt genau über dem `iframe`. */
	const imMaterial = (ev: ReactPointerEvent<HTMLElement>) => {
		const r = ev.currentTarget.getBoundingClientRect();
		return { x: (ev.clientX - r.left) / skala, y: (ev.clientY - r.top) / skala };
	};
	const aufSeite = (ev: ReactPointerEvent<HTMLElement>, seite: Element): Punkt => {
		const p = imMaterial(ev);
		const ecke = eckeVon(seite);
		return { x: p.x - ecke.x, y: p.y - ecke.y };
	};

	const griffe = {
		onPointerDown: (ev: ReactPointerEvent<HTMLElement>) => {
			if (!werkzeug || !ev.isPrimary || (ev.pointerType === 'mouse' && ev.button !== 0)) {
				return;
			}
			const p = imMaterial(ev);
			const seite = seiteUnter(doc, p.x, p.y);
			const nr = seite ? nrVon(seite) : null;
			ev.preventDefault();
			if (!seite || nr === null) {
				return;
			}
			try {
				ev.currentTarget.setPointerCapture(ev.pointerId);
			} catch {
				// Ohne Fang endet der Strich, wenn der Zeiger die Überlagerung verlässt.
			}
			strich.current = { id: ev.pointerId, w: werkzeug, seite, nr, x: ev.clientX, y: ev.clientY };
			werkzeug.beginne(aufSeite(ev, seite), seite);
		},
		onPointerMove: (ev: ReactPointerEvent<HTMLElement>) => {
			const s = strich.current;
			if (!s || s.id !== ev.pointerId) {
				return;
			}
			const entwurf = s.w.bewege(aufSeite(ev, s.seite), tastenVon(ev));
			if (entwurf) {
				zeigeVorschau(doc, s.seite, entwurf.html, entwurf.lage, 'vorne');
			} else {
				entferneVorschau(doc);
			}
		},
		onPointerUp: (ev: ReactPointerEvent<HTMLElement>) => {
			const s = strich.current;
			if (!s || s.id !== ev.pointerId) {
				return;
			}
			brichAb();
			// Der Klick danach gehörte zum Strich: Er hebt die neue Auswahl nicht auf.
			schluckeKlick();
			const p = aufSeite(ev, s.seite);
			const klick = Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < KLICK_WEG;
			const fertig = klick ? (s.w.klick?.(p) ?? null) : s.w.ende(p, tastenVon(ev));
			if (fertig) {
				struktur.fuehreAus(s.w.titel, (q) =>
					legeGestaltungAb(q, {
						seite: s.nr,
						html: fertig.html,
						lage: fertig.lage,
						...(fertig.ebene ? { ebene: fertig.ebene } : {}),
					}),
				);
			}
			if (!werkzeugStand().halten) {
				zurAuswahl();
			}
		},
		onPointerCancel: brichAb,
	};

	return { werkzeug, griffe };
};
