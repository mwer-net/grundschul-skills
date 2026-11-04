import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

const ZOOM_STUFEN = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEICHER_ZOOM = 'schoolbox-zoom';

export type ZoomWert = number | 'einpassen';

export const gemerkterZoom = (): ZoomWert => {
	const wert = localStorage.getItem(SPEICHER_ZOOM);
	if (wert === 'einpassen') {
		return wert;
	}
	return ZOOM_STUFEN.find((s) => String(s) === wert) ?? 1;
};

export const merkeZoom = (wert: ZoomWert) => localStorage.setItem(SPEICHER_ZOOM, String(wert));

/** Eingepasste Werte liegen zwischen den Stufen; darum zählt der Wert selbst, nicht sein Platz in der Liste. */
export const naechsteStufe = (wert: number, richtung: 1 | -1) =>
	richtung > 0 ? ZOOM_STUFEN.find((s) => s > wert + 0.001) : ZOOM_STUFEN.findLast((s) => s < wert - 0.001);

/** Die Seite, deren Fläche der Mitte des Sichtfelds am nächsten liegt. Folgt dem Rollen. */
export const useSichtbareSeite = (
	geladen: { doc: Document; html: string } | null,
	ansicht: RefObject<HTMLElement | null>,
	skala: number,
) => {
	const [seite, setSeite] = useState({ nr: 1, von: 1 });
	const doc = geladen?.doc ?? null;
	const laenge = geladen?.html.length ?? 0;
	useEffect(() => {
		const element = ansicht.current;
		const rahmen = doc?.defaultView?.frameElement;
		if (!doc || !element || !(rahmen instanceof HTMLElement)) {
			return undefined;
		}
		const pruefe = () => {
			const r = rahmen.getBoundingClientRect();
			const massstab = r.width / (rahmen.offsetWidth || 1);
			const sicht = element.getBoundingClientRect();
			const mitte = (sicht.top + sicht.bottom) / 2;
			const seiten = [...doc.querySelectorAll('.seite')];
			const abstaende = seiten.map((s) => {
				const b = s.getBoundingClientRect();
				return Math.max(0, r.top + b.top * massstab - mitte, mitte - (r.top + b.bottom * massstab));
			});
			const nr = abstaende.indexOf(Math.min(...abstaende)) + 1;
			const von = Math.max(1, seiten.length);
			setSeite((alt) => (alt.nr === nr && alt.von === von ? alt : { nr: Math.max(1, nr), von }));
		};
		pruefe();
		element.addEventListener('scroll', pruefe, { passive: true });
		return () => element.removeEventListener('scroll', pruefe);
	}, [doc, ansicht, skala, laenge]);
	return seite;
};
