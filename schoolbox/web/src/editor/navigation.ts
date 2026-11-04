import { bausteinVon, elementZu, nrVon, pfadZu } from './darstellung';

/** Alles Wählbare unter `wurzel` in Lesereihenfolge, ohne Erzeugtes und Ausgeblendetes. */
const waehlbareUnter = (wurzel: ParentNode) =>
	[...wurzel.querySelectorAll('*')].flatMap((e) => {
		const nr = nrVon(e);
		const sichtbar = nr !== null && bausteinVon(e) && !e.closest('[data-erzeugt]') && e.getClientRects().length > 0;
		return sichtbar ? [nr] : [];
	});

/** Derselbe Abstand zur Seite, auch über die Grenze der Eltern hinweg: Am Rand geht es in der Lesereihenfolge weiter. */
export const nachbarVon = (doc: Document, nr: number, richtung: 1 | -1) => {
	const tiefe = pfadZu(doc, nr).length;
	const gleich = waehlbareUnter(doc.body).filter((n) => pfadZu(doc, n).length === tiefe);
	return gleich[gleich.indexOf(nr) + richtung] ?? null;
};

export const erstesKindVon = (doc: Document, nr: number) => {
	const tiefe = pfadZu(doc, nr).length;
	const element = elementZu(doc, nr);
	return (element && waehlbareUnter(element).find((n) => pfadZu(doc, n).length === tiefe + 1)) ?? null;
};

export const seiteAn = (doc: Document, seitenNr: number) => {
	const seite = [...doc.querySelectorAll('.seite:not([data-erzeugt])')][seitenNr - 1];
	return seite ? nrVon(seite) : null;
};

export const ersterAufSeite = (doc: Document, seitenNr: number) => {
	const seite = [...doc.querySelectorAll('.seite:not([data-erzeugt])')][seitenNr - 1];
	return seite ? (waehlbareUnter(seite)[0] ?? null) : null;
};

export interface Luecke {
	nr: number;
	x: number;
	y: number;
	laenge: number;
}

/** Zeigt die Maus auf den freien Raum zwischen zwei Teilen einer Seite? Der Baustein davor ist die Einfügestelle. */
export const lueckeAn = (doc: Document, x: number, y: number): Luecke | null => {
	const unter = doc.elementFromPoint(x, y);
	if (!unter?.matches('.seite:not([data-erzeugt])')) {
		return null;
	}
	const kinder = [...unter.children].filter(
		(k) => nrVon(k) !== null && bausteinVon(k) && !k.matches('.fuss') && k.getClientRects().length > 0,
	);
	for (const [i, k] of kinder.entries()) {
		const unten = k.getBoundingClientRect();
		const naechstes = kinder[i + 1]?.getBoundingClientRect();
		const ende = naechstes?.top ?? unten.bottom + 28;
		if (y >= unten.bottom - 2 && y <= ende + 2) {
			const nr = nrVon(k);
			return nr === null ? null : { nr, x: unten.left, y: (unten.bottom + ende) / 2, laenge: unten.width };
		}
	}
	return null;
};
