/**
 * Lösungen im Material (019): `data-l` an Antwortlinien, `loesung=`/`buendel-loesung=` an Abbildungen,
 * `.nur-loesung`/`.nicht-loesung` und Items mit `class="beispiel"`, deren Lösung schon auf dem Arbeitsblatt steht.
 * Befehle rechnen wie in `struktur.ts` aus der Quelle die nächste Fassung, nur über Text-Patches.
 */

import type { Knoten, Zerlegung } from './quelltext';
import { attribut, klassenVon, setzeAttribut, wendeAn, zerlege } from './quelltext';

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

const knotenAn = (z: Zerlegung, nr: number, klasse: string, was: string) => {
	const k = z.knoten[nr];
	if (!hat(k, klasse) || !k) {
		throw new Error(`Das Element ${nr} ist ${was}.`);
	}
	return k;
};

/** Dieselbe Regel wie `blatt.py bauen`: Nur dann entsteht ein Lösungsblatt. */
export const hatLoesung = (quelle: string) => /data-l=|loesung=|nur-loesung/.test(quelle);

export const istAntwort = (k: Knoten) => hat(k, 'antwort');

/** Die Lösung einer Antwortlinie; leer heißt: fehlt noch. */
export const loesungVon = (k: Knoten) => attribut(k, 'data-l')?.wert?.trim() ?? '';

/** Antwortlinien ohne Lösung: Auf dem Lösungsblatt bliebe die Linie leer. */
export const fehlendeLoesungen = (z: Zerlegung) => z.knoten.filter((k) => istAntwort(k) && !loesungVon(k));

/** Gibt es etwas, das in der Lösung stehen kann? Dann lohnt die Lösungsansicht auch ohne eine einzige Lösung. */
export const kannLoesungHaben = (z: Zerlegung) => hatLoesung(z.quelle) || z.knoten.some(istAntwort);

/** Setzt die richtige Antwort einer Antwortlinie; ohne Text fällt `data-l` weg. */
export const setzeLoesung = (quelle: string, nr: number, wert: string) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr, 'antwort', 'keine Antwortlinie');
	const text = wert.trim();
	return wendeAn(quelle, setzeAttribut(z, k, 'data-l', text || null));
};

const darunter = (k: Knoten): Knoten[] => k.kinder.flatMap((kind) => [kind, ...darunter(kind)]);

/** Zeigt ein Beispiel hier etwas, das sonst erst auf dem Lösungsblatt steht? */
const zeigtLoesung = (k: Knoten) =>
	(istAntwort(k) && loesungVon(k) !== '') ||
	attribut(k, 'loesung') !== undefined ||
	attribut(k, 'buendel-loesung') !== undefined ||
	(k.tag === 'x-zahlenstrahl' && attribut(k, 'pfeile') !== undefined) ||
	(k.tag === 'td' && hat(k, 'l'));

/** Hat das Item eine Lösung, die als Beispiel auf dem Arbeitsblatt erscheinen kann? */
export const kannBeispielSein = (z: Zerlegung, nr: number) =>
	darunter(knotenAn(z, nr, 'zelle', 'kein Item')).some(zeigtLoesung);

export const istBeispiel = (k: Knoten) => hat(k, 'beispiel');

/** Die Aufgabe um das Item, ohne Aufgabe die Reihe: Darin gibt es höchstens ein Beispiel. */
const bereichVon = (k: Knoten) => {
	for (let e = k.eltern; e; e = e.eltern) {
		if (hat(e, 'aufgabe')) {
			return e;
		}
	}
	return k.eltern;
};

/** Die anderen Items derselben Aufgabe, die gerade Beispiel sind. */
export const andereBeispiele = (z: Zerlegung, nr: number) => {
	const k = knotenAn(z, nr, 'zelle', 'kein Item');
	const bereich = bereichVon(k);
	return bereich ? darunter(bereich).filter((e) => e !== k && hat(e, 'zelle') && istBeispiel(e)) : [];
};

const mitKlasse = (k: Knoten, klasse: string, an: boolean) => {
	const klassen = klassenVon(k).filter((c) => c !== klasse);
	if (an) {
		klassen.push(klasse);
	}
	return klassen.length > 0 ? klassen.join(' ') : null;
};

/**
 * Macht ein Item zum Beispiel oder wieder zu einem normalen Item. Ein neues Beispiel löst das bisherige derselben
 * Aufgabe ab, in einem Schritt; `abgeloest` sind dessen Nummern (sie ändern sich nicht, nur Klassen ändern sich).
 */
export const setzeBeispiel = (quelle: string, nr: number, an: boolean) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr, 'zelle', 'kein Item');
	const abgeloest = an ? andereBeispiele(z, nr) : [];
	const aenderungen = [k, ...abgeloest].flatMap((e) =>
		setzeAttribut(z, e, 'class', mitKlasse(e, 'beispiel', e === k && an)),
	);
	return { quelle: wendeAn(quelle, aenderungen), abgeloest: abgeloest.map((e) => e.nr) };
};
