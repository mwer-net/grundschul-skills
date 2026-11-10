import { FREIES_ELEMENT } from '@schoolbox/kern/src/bausteine';
import type { LageImStapel } from '@schoolbox/kern/src/bilder-frei';
import { legeBildFrei, legeFreiesElementFrei } from '@schoolbox/kern/src/bilder-frei';

import type { Befehl, Kontext } from '../../befehle';
import { elementZu } from '../../darstellung';
import { eckeVon } from '../ablegen/vorschau';

/** Ein gewählter Bild-Baustein im Stapel (keine Leitfigur, kein freies Bild, kein Platzhalter). */
const bildBaustein = (k: Kontext) => {
	const g = k.pfad.at(-1);
	return k.aktiv && g?.baustein.art === 'bild' ? g : null;
};

// Freie Elemente von Claude (088) im Stapel
const freiesElement = (k: Kontext) => {
	const g = k.pfad.at(-1);
	return k.aktiv && g && FREIES_ELEMENT.has(g.baustein.art) ? g : null;
};

/** Das Blatt im Editor; wie `Editor.tsx` findet es der Befehl über seinen Rahmen. */
const blatt = () =>
	document.querySelector<HTMLIFrameElement>('[data-editor-rahmen="sichtbar"]')?.contentDocument ?? null;

/** Wo das Bild in der Darstellung steht, in Koordinaten seiner Seite (wie `--x`, `--y`). */
const lageVon = (nr: number): LageImStapel | null => {
	const doc = blatt();
	const element = doc ? elementZu(doc, nr) : null;
	const seite = element?.closest('.seite');
	if (!element || !seite) {
		return null;
	}
	const r = element.getBoundingClientRect();
	const ecke = eckeVon(seite);
	return { x: r.left - ecke.x, y: r.top - ecke.y, b: r.width, h: r.height };
};

/**
 * `auswahl.frei-legen` (103, Briefing 5.12): Ein Bild-Baustein wird zum freien Bild an derselben Stelle, vorne; eine
 * Bildunterschrift wird Schmuckschrift darunter. 117: ebenso ein freies Element von Claude (088). Im ⋯ der Bausteinleiste, im Rechtsklick und in ⌘K. Aufgaben lassen
 * sich nicht frei legen (Frage F1).
 */
export const BILD_BEFEHLE: Befehl[] = [
	{
		id: 'auswahl.frei-legen',
		titel: 'Frei legen',
		gruppe: 'ordnen',
		symbol: 'bild',
		orte: ['menue', 'palette'],
		sichtbarUnter: 'mehr',
		suchwoerter: ['frei', 'frei legen', 'lösen', 'aus dem Stapel', 'schräg', 'drehen', 'bild'],
		verfuegbar: (k) => bildBaustein(k) !== null || freiesElement(k) !== null, // 117
		aus: (k) => {
			const g = bildBaustein(k);
			// 117: Ein freies Element von Claude bleibt dasselbe Element, mit Lage vorne.
			const f = g ? null : freiesElement(k);
			const ziel = g ?? f;
			const lage = ziel ? lageVon(ziel.nr) : null;
			if (!ziel || !lage) {
				return null;
			}
			const lege = g ? legeBildFrei : legeFreiesElementFrei;
			return k.tu.struktur.fuehreAus('Frei gelegt', (q) => lege(q, ziel.nr, lage));
		},
	},
];
