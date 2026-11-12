import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

/**
 * Knöpfe und Tasten springen über diese Stufen, Aufziehen geht stufenlos dazwischen (163, Entscheidung 56). 25 % deckt
 * alles, was vorher erreichbar war (iPad 32 %), 200 % wie bisher.
 */
const ZOOM_STUFEN = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
/** So nah an einer Stufe rastet das Ende einer Geste ein: 99 % wird 100 %. */
const EINRASTEN = 0.02;

const SPEICHER = 'schoolbox-blatt-zoom';
/** Bis 184 eine Stufe relativ zur Breite des damaligen Fensters; nur „einpassen“ lässt sich übernehmen. */
const ALT = 'schoolbox-zoom';

/**
 * Eine Zahl ist der echte Maßstab, 1 die echte Größe. `breite`: so breit, wie Platz ist, höchstens 100 %, der Start
 * ohne gemerkten Wert. `einpassen`: die ganze Seite im Sichtfeld.
 */
export type ZoomWert = number | 'einpassen' | 'breite';

/** Unskaliert: das Blatt samt Rand und eine Seite samt Rand, das Maß fürs Einpassen. */
export interface BlattMasse {
	breite: number;
	seite: number;
}

interface Punkt {
	x: number;
	y: number;
}

interface Lage {
	skala: number;
	/** Abstand des Blatts vom linken Rand der Leinwand, solange es schmaler ist als sie. */
	links: number;
}

/** Maßstab und Lage des Blatts in einer Leinwand der Breite `breite`; schmaler als sie steht es mittig. */
export const massstabVon = ({
	breite,
	masse,
	sichtHoehe,
	zoom,
}: {
	breite: number;
	masse: BlattMasse | null;
	sichtHoehe: number;
	zoom: ZoomWert;
}) => {
	const passend = masse && breite > 0 ? Math.min(1, breite / masse.breite) : 1;
	const eingepasst =
		masse && breite > 0 && sichtHoehe > 0
			? Math.min(ZOOM_MAX, breite / masse.breite, Math.max(1, sichtHoehe) / masse.seite)
			: passend;
	const skala = typeof zoom === 'number' ? zoom : { einpassen: eingepasst, breite: passend }[zoom];
	const innenBreite = masse ? Math.max(breite, masse.breite * skala) : breite;
	const links = masse ? Math.max(0, (innenBreite - masse.breite * skala) / 2) : 0;
	return { innenBreite, links, skala };
};

/** Eingepasste Werte liegen zwischen den Stufen; darum zählt der Wert selbst, nicht sein Platz in der Liste. */
export const naechsteStufe = (skala: number, richtung: 1 | -1) =>
	richtung > 0 ? ZOOM_STUFEN.find((s) => s > skala + 0.001) : ZOOM_STUFEN.findLast((s) => s < skala - 0.001);

/** In den Grenzen; steht das Blatt schon außerhalb (`von`, etwa eingepasst im kleinen Fenster), springt es nicht. */
export const begrenzeZoom = (wert: number, von: number) =>
	Math.min(Math.max(ZOOM_MAX, von), Math.max(Math.min(ZOOM_MIN, von), wert));

/** Am Ende einer Geste: nahe einer Stufe auf die Stufe, sonst auf ganze Prozent. */
export const rasteZoom = (wert: number) =>
	ZOOM_STUFEN.find((s) => Math.abs(wert / s - 1) <= EINRASTEN + 1e-9) ?? Math.round(wert * 100) / 100;

/** Pixel je Einheit von `WheelEvent.deltaMode`: 0 Pixel, 1 Zeile, 2 Seite. */
const RAD_PX: Record<number, number> = { 1: 16, 2: 100 };

/** Faktor für ein Strg+Rad. Ein Ereignis zählt höchstens 25 px; die 100 ist der Regler fürs Tempo. */
export const radFaktor = (deltaY: number, deltaMode: number) =>
	Math.exp(-Math.max(-25, Math.min(25, deltaY * (RAD_PX[deltaMode] ?? 1))) / 100);

/**
 * Der Rollstand nach einem Zoom, so dass die Stelle des Blatts unter `punkt` dort bleibt. `rollen`: `x` von der
 * Leinwand, `y` von `main`; `punkt` ab dem linken Rand der Leinwand und dem oberen Rand von `main`; `oben`: wo das
 * Blatt im Rollinhalt von `main` beginnt.
 */
export const rollenNachZoom = ({
	nachher,
	oben,
	punkt,
	rollen,
	vorher,
}: {
	vorher: Lage;
	nachher: Lage;
	rollen: Punkt;
	punkt: Punkt;
	oben: number;
}): Punkt => {
	const bx = (rollen.x + punkt.x - vorher.links) / vorher.skala;
	const by = (rollen.y + punkt.y - oben) / vorher.skala;
	return { x: nachher.links + bx * nachher.skala - punkt.x, y: oben + by * nachher.skala - punkt.y };
};

/** Der Zoom dieses Geräts (066). Vom alten Schlüssel gilt nur „einpassen“: Seine Stufen hingen an der Fensterbreite. */
export const zoomAusSpeicher = (lies: (schluessel: string) => string | null): ZoomWert => {
	const wert = lies(SPEICHER);
	const zahl = Number(wert);
	if (wert === 'einpassen') {
		return wert;
	}
	if (wert && Number.isFinite(zahl) && zahl >= ZOOM_MIN && zahl <= ZOOM_MAX) {
		return zahl;
	}
	return lies(ALT) === 'einpassen' ? 'einpassen' : 'breite';
};

export const gemerkterZoom = () => zoomAusSpeicher((k) => localStorage.getItem(k));

export const merkeZoom = (wert: number | 'einpassen') => {
	localStorage.setItem(SPEICHER, String(wert));
	localStorage.removeItem(ALT);
};

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
