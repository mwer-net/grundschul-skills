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
