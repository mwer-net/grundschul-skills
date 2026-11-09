import { legeGestaltungAb } from '@schoolbox/kern/src/gestaltung';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef } from 'react';

import { schluckeKlick } from '../../../bausteine/zeigerzug';
import { nrVon } from '../../darstellung';
import type { Struktur } from '../../struktur';
import { istFeld, TASTEN_SPERRE } from '../../tasten';
import { eckeVon, entferneVorschau, seiteUnter, zeigeVorschau } from '../ablegen/vorschau';
import type { Entwurf, Punkt, Tasten, Werkzeug } from '.';
import type { Fortgang } from './typ';
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
	/** 116: ein Druck eines mehrteiligen Werkzeugs (Pfad). */
	teilig?: boolean;
	/** 116: Der Zeiger war einmal weiter weg als ein Klick (ein geschlossener Stift-Zug endet am Anfang). */
	weit?: boolean;
}

/** 116: Ein mehrteiliges Werkzeug läuft über mehrere Drücke auf dieser Seite. */
interface Mehrlauf {
	w: Werkzeug;
	seite: Element;
	nr: number;
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
	const mehr = useRef<Mehrlauf | null>(null);
	/** Der letzte Zeiger auf der Seite des mehrteiligen Werkzeugs (Vorschau nach Backspace). */
	const zuletzt = useRef<Punkt | null>(null);

	const brichAb = () => {
		strich.current = null;
		entferneVorschau(doc);
	};

	/** 116: Legt ab, was ein mehrteiliges Werkzeug meldet, oder bricht es ab. */
	const fahreFort = (m: Mehrlauf, fortgang: Exclude<Fortgang, 'weiter'>) => {
		mehr.current = null;
		entferneVorschau(doc);
		if (fortgang === 'abbruch') {
			m.w.mehrteilig?.abbruch();
			return;
		}
		const fertig = fortgang.fertig;
		if (fertig) {
			struktur.fuehreAus(m.w.titel, (q) =>
				legeGestaltungAb(q, {
					seite: m.nr,
					html: fertig.html,
					lage: fertig.lage,
					...(fertig.ebene ? { ebene: fertig.ebene } : {}),
				}),
			);
		}
		if (!werkzeugStand().halten) {
			zurAuswahl();
		}
	};

	const zeigeEntwurf = (seite: Element, entwurf: Entwurf | null) => {
		if (entwurf) {
			zeigeVorschau(doc, seite, entwurf.html, entwurf.lage, 'vorne');
		} else {
			entferneVorschau(doc);
		}
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
			// 116: Läuft ein mehrteiliges Werkzeug, gehören ihm Enter, Backspace und Esc.
			const m = mehr.current;
			if (m && m.w.mehrteilig?.laeuft() && !istFeld(k.target)) {
				const fortgang = m.w.mehrteilig.taste(k.key);
				if (fortgang !== null) {
					k.preventDefault();
					k.stopImmediatePropagation();
					if (fortgang === 'weiter') {
						zeigeEntwurf(m.seite, zuletzt.current ? m.w.mehrteilig.schwebe(zuletzt.current) : null);
					} else {
						fahreFort(m, fortgang);
						if (k.key === 'Escape') {
							zurAuswahl();
						}
					}
					return;
				}
			}
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
			// 116: Werkzeug gewechselt: Ein halber Pfad verschwindet ohne Element.
			if (mehr.current) {
				mehr.current.w.mehrteilig?.abbruch();
				mehr.current = null;
				entferneVorschau(doc);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `fahreFort` und `zeigeEntwurf` lesen nur Refs und `doc`
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
			// 116: Ein laufendes mehrteiliges Werkzeug bleibt auf seiner Seite.
			const laufend = mehr.current?.w === werkzeug ? mehr.current : null;
			const seite = laufend ? laufend.seite : seiteUnter(doc, p.x, p.y);
			const nr = laufend ? laufend.nr : seite ? nrVon(seite) : null;
			ev.preventDefault();
			if (!seite || nr === null) {
				return;
			}
			try {
				ev.currentTarget.setPointerCapture(ev.pointerId);
			} catch {
				// Ohne Fang endet der Strich, wenn der Zeiger die Überlagerung verlässt.
			}
			if (werkzeug.mehrteilig) {
				mehr.current = { w: werkzeug, seite, nr };
				strich.current = { id: ev.pointerId, w: werkzeug, seite, nr, x: ev.clientX, y: ev.clientY, teilig: true };
				werkzeug.mehrteilig.runter(aufSeite(ev, seite), skala);
				zeigeEntwurf(seite, werkzeug.mehrteilig.ziehe(aufSeite(ev, seite)));
				return;
			}
			strich.current = { id: ev.pointerId, w: werkzeug, seite, nr, x: ev.clientX, y: ev.clientY };
			werkzeug.beginne(aufSeite(ev, seite), seite, skala);
		},
		onPointerMove: (ev: ReactPointerEvent<HTMLElement>) => {
			const s = strich.current;
			// 116: Ohne Druck zeigt ein laufendes mehrteiliges Werkzeug das nächste Stück bis zum Zeiger.
			const m = mehr.current;
			if (m && (!s || s.id !== ev.pointerId)) {
				if (!s && m.w.mehrteilig?.laeuft()) {
					zuletzt.current = aufSeite(ev, m.seite);
					zeigeEntwurf(m.seite, m.w.mehrteilig.schwebe(zuletzt.current));
				}
				return;
			}
			if (!s || s.id !== ev.pointerId) {
				return;
			}
			if (s.teilig && s.w.mehrteilig) {
				zuletzt.current = aufSeite(ev, s.seite);
				zeigeEntwurf(s.seite, s.w.mehrteilig.ziehe(zuletzt.current));
				return;
			}
			if (Math.hypot(ev.clientX - s.x, ev.clientY - s.y) >= KLICK_WEG) {
				s.weit = true;
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
			if (s.teilig && s.w.mehrteilig) {
				strich.current = null;
				schluckeKlick();
				const m = mehr.current;
				const fortgang = s.w.mehrteilig.hoch(aufSeite(ev, s.seite));
				if (m && fortgang !== 'weiter') {
					fahreFort(m, fortgang);
				}
				return;
			}
			brichAb();
			// Der Klick danach gehörte zum Strich: Er hebt die neue Auswahl nicht auf.
			schluckeKlick();
			const p = aufSeite(ev, s.seite);
			const klick = !s.weit && Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < KLICK_WEG;
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
