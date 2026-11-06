/**
 * Bausteine an einer Ablage einfügen (094): Ziehen aus der Schublade findet eine Stelle (`Ablage`, wie beim Verschieben
 * im Blatt), und dort landet der Baustein. Dieselben Regeln wie `fuegeBausteinEin` (Klasse, Teile, feste Stellen für
 * Kopf, Namenszeile und Fuß), ein Text-Patch, danach neu nummeriert, also ein Schritt im Verlauf.
 */

import type { Einfuegbar } from './einfuegen';
import { ergebnis, festeStelle, fuegeBausteinEin, neueAufgabe } from './einfuegen';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import { fuegeEin, klassenVon, zerlege } from './quelltext';
import type { Ablage, Nummerierung, StrukturErgebnis } from './struktur';

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

export interface Huelle {
	html: string;
	/** Das HTML, das danach gewählt sein soll, wenn es in einer neuen Aufgabe liegt. */
	baustein?: string;
}

/**
 * Was im Stapel einer Seite landet: Rezepte und Kleines (`ort: 'aufgabe' | 'zeile'`) in einer neuen Aufgabe, alles mit
 * `ort: 'seite'` so, wie es ist. Die Lücke beim Ziehen zeigt genau dieses HTML.
 */
export const huelleImStapel = (b: Einfuegbar): Huelle => {
	if (b.teile) {
		return { html: neueAufgabe(b.teile.join(''), b.anweisung) };
	}
	const html = b.html ?? '';
	if (b.ort === 'seite') {
		return { html };
	}
	return { html: neueAufgabe(b.ort === 'zeile' ? `<div class="zeile">${html}</div>` : html), baustein: html };
};

/** Als letztes Kind von `eltern`, vor einen Fuß und vor die Ebenen der Gestaltung. */
const amEnde = (z: Zerlegung, eltern: Knoten, html: string): Aenderung[] => {
	const ende = eltern.kinder.filter((k) => !hat(k, 'fuss') && !hat(k, 'ebene')).at(-1);
	const fuss = eltern.kinder.find((k) => hat(k, 'fuss') || hat(k, 'ebene'));
	if (ende) {
		return fuegeEin(z, ende, 'nach', html);
	}
	if (fuss) {
		return fuegeEin(z, fuss, 'vor', html);
	}
	return [{ von: eltern.oeffnerEnde, bis: eltern.schliesserStart, text: html }];
};

/** Fügt `b` an der Ablage ein: vor oder hinter ein Element, oder ans Ende eines Elements (leere Seite). */
export const fuegeBausteinAn = (quelle: string, b: Einfuegbar, ablage: Ablage, n: Nummerierung): StrukturErgebnis => {
	const z = zerlege(quelle);
	const nr = 'in' in ablage ? ablage.in : ablage.nr;
	const ziel = z.knoten[nr];
	if (!ziel) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	if (b.klasse) {
		return fuegeBausteinEin(quelle, b, nr, n);
	}
	const imStapel = 'in' in ablage ? hat(ziel, 'seite') : hat(ziel.eltern, 'seite');
	const { baustein, html } = imStapel || b.teile ? huelleImStapel(b) : { html: b.html ?? '', baustein: undefined };
	const fest = festeStelle(z, ziel, b, html);
	if (fest) {
		return ergebnis(quelle, fest, n);
	}
	const aenderungen = 'in' in ablage ? amEnde(z, ziel, html) : fuegeEin(z, ziel, ablage.wo, html);
	return ergebnis(quelle, aenderungen, n, baustein);
};
