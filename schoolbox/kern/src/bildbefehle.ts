/**
 * Bild-Befehle des Editors (017): tauschen, Größe, Beschreibung, entfernen, Platzhalter durch ein Bild ersetzen. Wie
 * die Struktur-Befehle rechnen sie nur über Text-Patches auf der Quelle; jeder ist ein Schritt im Verlauf.
 */

import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import { attribut, entferne, klassenVon, schuetzeAttribut, setzeAttribut, wendeAn, zerlege } from './quelltext';
import type { StrukturErgebnis } from './struktur';
import { ohneStilWert, setzeStilWert, stilWert } from './struktur';

/** Kleiner wird ein Bild nicht; nach oben begrenzt die Spalte, die nur die Darstellung kennt. */
export const BILD_MIN = 24;
/** Wie `LimitRequestBody` im Apache vor der Schoolbox. */
export const MAX_BILD_BYTES = 25 * 1024 * 1024;
/** Längste Kante nach dem Aufnehmen; `bild.py` rechnet größere Bilder herunter. */
export const BILD_KANTE = 2400;

export interface SammlungsBild {
	/** Pfad unter der Ablage (`<mappe>/…`) bzw. unter assets/ (`_assets/bilder/…`); die Darstellung liegt unter `/ansicht/<schluessel>`. */
	schluessel: string;
	name: string;
	/** Beschreibungen (`alt`), unter denen das Bild in Materialien vorkommt; für die Suche. */
	alt: string[];
	/** Nur bei „Meine Bilder“: Titel der Mappe. */
	mappe?: string;
}

export interface Sammlung {
	/** assets/bilder: Willi, Wilma, Grafiken. */
	sammlung: SammlungsBild[];
	/** Bilder dieser Mappe, aus allen ihren Dokumenten. */
	mappe: SammlungsBild[];
	/** Bilder aus allen anderen Mappen, neueste zuerst. */
	meine: SammlungsBild[];
}

const bildAn = (z: Zerlegung, nr: number) => {
	const k = z.knoten[nr];
	if (k?.tag !== 'img') {
		throw new Error(`Das Element ${nr} ist kein Bild.`);
	}
	return k;
};

const istFigur = (k: Knoten) => klassenVon(k).includes('figur');

/** Die Breite, die die Quelle festlegt (`--figur` bzw. `width`), in px; `null`, wenn keine. */
export const bildBreite = (z: Zerlegung, nr: number) => {
	const k = bildAn(z, nr);
	const wert = stilWert(attribut(k, 'style')?.wert ?? null, istFigur(k) ? '--figur' : 'width');
	const px = wert === null ? NaN : parseFloat(wert);
	return /px$/.test(wert ?? '') && Number.isFinite(px) ? px : null;
};

/** Tauscht nur `src`, mit `alt` auch die Beschreibung; Größe und alles andere bleiben. */
export const tauscheBild = (quelle: string, nr: number, src: string, alt: string | null = null): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = bildAn(z, nr);
	const aenderungen = [...setzeAttribut(z, k, 'src', src), ...(alt === null ? [] : setzeAttribut(z, k, 'alt', alt))];
	return { quelle: wendeAn(quelle, aenderungen), nr };
};

export const setzeBeschreibung = (quelle: string, nr: number, alt: string): StrukturErgebnis => {
	const z = zerlege(quelle);
	return { quelle: wendeAn(quelle, setzeAttribut(z, bildAn(z, nr), 'alt', alt.trim())), nr };
};

/**
 * Breite in px bei festem Seitenverhältnis: `--figur` bei der Leitfigur (blatt.css), sonst `width`. Eine feste Höhe
 * würde das Bild verzerren und fällt deshalb weg.
 */
export const setzeBildBreite = (quelle: string, nr: number, px: number, max = Infinity): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = bildAn(z, nr);
	const breite = Math.round(Math.max(BILD_MIN, Math.min(max, px)));
	const stil = ohneStilWert(attribut(k, 'style')?.wert ?? null, 'height');
	const neu = setzeStilWert(stil, istFigur(k) ? '--figur' : 'width', `${breite}px`);
	const aenderungen: Aenderung[] = [...setzeAttribut(z, k, 'style', neu), ...setzeAttribut(z, k, 'height', null)];
	return { quelle: wendeAn(quelle, aenderungen), nr };
};

export const entferneBild = (quelle: string, nr: number): StrukturErgebnis => {
	const z = zerlege(quelle);
	return { quelle: wendeAn(quelle, entferne(z, bildAn(z, nr))), nr: null };
};

/** Ersetzt einen Bildplatzhalter aus einem Entwurf durch ein Bild; dessen Text wird die Beschreibung. */
export const setzeBildEin = (
	quelle: string,
	nr: number,
	{ alt, breite, src }: { src: string; alt: string; breite: number },
): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k || !klassenVon(k).includes('platzhalter')) {
		throw new Error(`Das Element ${nr} ist kein Bildplatzhalter.`);
	}
	const px = Math.max(BILD_MIN, Math.round(breite));
	const html = `<img src="${schuetzeAttribut(src)}" alt="${schuetzeAttribut(alt.trim())}" style="width:${px}px">`;
	const neu = wendeAn(quelle, [{ von: k.start, bis: k.ende, text: html }]);
	return { quelle: neu, nr: zerlege(neu).knoten.find((n) => n.start === k.start)?.nr ?? null };
};
