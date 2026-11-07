import type { Befehl, Kontext } from '../../befehle';

/**
 * Durchblick (100, Frage F12): Solange G gehalten wird, zeigt die Überlagerung den Aufbau des Blatts
 * (`gestaltung/durchblick.tsx`). Das Register kennt nur `keydown`; das Loslassen hört dieser Befehl selbst, am
 * Fenster und am Fenster des `iframe`, aus dem die Taste kam. Verliert das Fenster den Fokus, endet er auch. Aus der
 * Palette (iPad) schaltet er um und bleibt, bis er wieder umgeschaltet wird.
 */

let an = false;
let loslassen: AbortController | null = null;
const hoerer = new Set<() => void>();

const setze = (wert: boolean) => {
	if (!wert) {
		loslassen?.abort();
		loslassen = null;
	}
	if (an === wert) {
		return;
	}
	an = wert;
	for (const h of hoerer) {
		h();
	}
};

export const durchblickAn = () => an;

export const abonniereDurchblick = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};

/** Beendet den Durchblick; auch für das Fenster des `iframe`, das nach einem Neuladen ein anderes ist. */
export const beendeDurchblick = () => setze(false);

/** Gilt das Loslassen von G? */
export const istG = (e: KeyboardEvent) => e.code === 'KeyG';

/** Bei gehaltener Taste: an, bis G hochkommt oder ein Fenster den Fokus verliert. */
const halte = (taste: KeyboardEvent) => {
	if (an && loslassen) {
		return;
	}
	setze(true);
	const los = new AbortController();
	loslassen = los;
	const fenster: Window[] = [window];
	const ansicht = taste.view as Window | null;
	if (ansicht && ansicht !== window) {
		fenster.push(ansicht);
	}
	const hoch = (e: KeyboardEvent) => {
		if (istG(e)) {
			beendeDurchblick();
		}
	};
	for (const f of fenster) {
		f.addEventListener('keyup', hoch, { capture: true, signal: los.signal });
		f.addEventListener('blur', beendeDurchblick, { signal: los.signal });
	}
};

/** Nicht beim Tippen: keine Textsitzung, kein Feld mit eigenem Undo (wie die Werkzeug-Tasten, 098). */
const tippfrei = (k: Kontext) => !k.textsitzung && !k.feldBehaeltUndo();

export const DURCHBLICK_BEFEHLE: Befehl[] = [
	{
		id: 'ansicht.durchblick',
		titel: 'Durchblick ein/aus',
		gruppe: 'ansicht',
		symbol: 'ebenen',
		kuerzel: [{ code: 'KeyG' }],
		tasteWenn: tippfrei,
		suchwoerter: ['aufbau', 'stapel', 'druckrand', 'anker', 'ausgeblendet', 'röntgen'],
		orte: ['taste', 'palette'],
		sichtbarUnter: 'blatt',
		verfuegbar: () => true,
		aktiv: () => an,
		aus: (_k, taste) => {
			if (taste) {
				halte(taste);
			} else {
				setze(!an);
			}
		},
	},
];
