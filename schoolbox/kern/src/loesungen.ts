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

/** Elemente, die ohne `loesung=` nichts im Lösungsblatt ändern. Gleiche Liste wie `OHNE_LOESUNGSANGABE` in `blatt.py`. */
export const OHNE_LOESUNGSANGABE =
	'<x-(?!schreibrahmen|spielplan|uhr|menge|dienes|strichpunkt|stellentafel|zwanzigerfeld|zahlenstrahl|timer|probe|gluecksrad|wuerfel|urne|diagramm|gitter|figur|koerper|hunderterfeld|hundertertafel|rechenrahmen|punktfeld|geld|skala|kalender|lineatur|silben|wortarten|satzglieder|wortbausteine|zeitleiste|jahreskreis|windrose|plan|schaltplan|kreislauf|verkehrszeichen|wetter|rhythmus|noten)[a-z]';
export const MIT_LOESUNG =
	'<x-schreibrahmen[^>]* beispiel=|<x-spielplan[^>]* loesungen=|<x-diagramm[^>]* offen=|<x-gitter[^>]* (?:aufgabe|zaehlen)=|<x-wuerfelbau[^>]* fragen=|<x-wuerfelnetz[^>]* aufgabe=|<x-koerper[^>]* markiere=|<x-hundertertafel[^>]* (?:luecken|zufall)=|<x-geld[^>]* aufgabe=|<x-skala[^>]* aufgabe=|<x-kalender[^>]* luecken=|<x-silben[^>]* aufgabe=|<x-wortarten[^>]* aufgabe=|<x-satzglieder[^>]* aufgabe=|<x-wortbausteine[^>]* aufgabe=|<x-zeitleiste[^>]*: ?offen|<x-jahreskreis[^>]* beschriftung=.leer|<x-windrose[^>]* beschriftung=.(?:leer|norden)|<x-plan[^>]* aufgabe=|<x-schaltplan[^>]* aufgabe=.(?:leuchtet|vervollstaendigen|benennen)|<x-kreislauf[^>]* offen=|<x-verkehrszeichen[^>]* ausmalen=.ja|<x-rhythmus[^>]* aufgabe=.(?:silben|noten|ergaenzen)|<x-noten[^>]* aufgabe=.(?:benennen|zeichnen)';

/** Dieselbe Regel wie `blatt.py bauen`: Nur dann entsteht ein Lösungsblatt. */
export const hatLoesung = (quelle: string) =>
	[/data-l=|loesung=|nur-loesung/, new RegExp(MIT_LOESUNG), new RegExp(OHNE_LOESUNGSANGABE)].some((regel) =>
		regel.test(quelle),
	);

export const istAntwort = (k: Knoten) => hat(k, 'antwort');

/** Die Lösung einer Antwortlinie; leer heißt: fehlt noch. */
export const loesungVon = (k: Knoten) => attribut(k, 'data-l')?.wert?.trim() ?? '';

/** Antwortlinien ohne Lösung: Auf dem Lösungsblatt bliebe die Linie leer. */
export const fehlendeLoesungen = (z: Zerlegung) => z.knoten.filter((k) => istAntwort(k) && !loesungVon(k));

const vorfahren = (k: Knoten): Knoten[] => (k.eltern ? [k.eltern, ...vorfahren(k.eltern)] : []);

/** Wie `pruefung.js`: Seiten sind die äußeren `.seite`, Aufgaben zählen je Seite ab 1, in Dokumentreihenfolge. */
const aeussereSeiten = (z: Zerlegung) =>
	z.knoten.filter((k) => hat(k, 'seite') && !vorfahren(k).some((v) => hat(v, 'seite')));

export interface AufgabeOhneLoesung {
	/** 0: außerhalb einer Seite. */
	seite: number;
	/** Nummer der Aufgabe auf ihrer Seite; 0: Antwortlinien außerhalb einer Aufgabe. */
	aufgabe: number;
	fehlend: number;
	linien: number;
}

/**
 * Fehlende Lösungen je Aufgabe, für Claude im Lauf (225). Dieselben Antwortlinien wie `fehlendeLoesungen`; nicht
 * gezählt wird, was nicht gedruckt wird (`data-aus`), und eine Aufgabe, deren Lösung als `.nur-loesung` dasteht.
 */
export const aufgabenOhneLoesung = (z: Zerlegung): AufgabeOhneLoesung[] => {
	const seiten = aeussereSeiten(z);
	const gruppen = new Map<string, AufgabeOhneLoesung>();
	for (const k of z.knoten.filter(istAntwort)) {
		const oben = vorfahren(k);
		if (oben.some((v) => attribut(v, 'data-aus') !== undefined || hat(v, 'nur-loesung'))) {
			continue;
		}
		const aufgabe = oben.find((v) => hat(v, 'aufgabe'));
		if (aufgabe && darunter(aufgabe).some((d) => hat(d, 'nur-loesung'))) {
			continue;
		}
		const seite = seiten.find((s) => oben.includes(s));
		const nr =
			aufgabe && seite
				? darunter(seite)
						.filter((d) => hat(d, 'aufgabe'))
						.indexOf(aufgabe) + 1
				: 0;
		const schluessel = `${seite?.nr ?? -1}|${aufgabe?.nr ?? -1}`;
		const g = gruppen.get(schluessel) ?? {
			seite: seite ? seiten.indexOf(seite) + 1 : 0,
			aufgabe: nr,
			fehlend: 0,
			linien: 0,
		};
		g.linien += 1;
		g.fehlend += loesungVon(k) ? 0 : 1;
		gruppen.set(schluessel, g);
	}
	return [...gruppen.values()].filter((g) => g.fehlend > 0);
};

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
