import type { Segment, Zug } from '@schoolbox/kern/src/formen-geometrie';
import { neuerPfad } from '@schoolbox/kern/src/pfad-aendern';

import type { Entwurf, Fortgang, Punkt, Werkzeug } from './typ';

/** Ein Klick näher als das am ersten Punkt (Bildschirm-px) schließt den Pfad. */
const SCHLIESSEN = 12;
/** Weniger Weg beim Setzen (Bildschirm-px) bleibt ein Eckpunkt. */
const ECKE = 3;

interface Gesetzt {
	p: Punkt;
	/** Griff nach dem Punkt; der Griff davor liegt gespiegelt (symmetrisch). Ohne: Eckpunkt. */
	aus: Punkt | null;
}

let punkte: Gesetzt[] = [];
let skala = 1;
let schliesst = false;

const ein = (g: Gesetzt): Punkt => (g.aus ? { x: 2 * g.p.x - g.aus.x, y: 2 * g.p.y - g.aus.y } : g.p);

const segment = (a: Gesetzt, b: Gesetzt): Segment =>
	a.aus || b.aus ? { art: 'C', c1: a.aus ?? a.p, c2: ein(b), p: b.p } : { art: 'L', p: b.p };

/** Die Züge aus den gesetzten Punkten, mit dem Stück bis `zeiger` (Vorschau) oder geschlossen. */
const zuegeVon = (liste: readonly Gesetzt[], geschlossen: boolean, zeiger?: Punkt): Zug[] => {
	const [erster] = liste;
	if (!erster) {
		return [];
	}
	const segmente: Segment[] = [];
	for (let i = 1; i < liste.length; i += 1) {
		const a = liste[i - 1];
		const b = liste[i];
		if (a && b) {
			segmente.push(segment(a, b));
		}
	}
	const letzter = liste.at(-1) ?? erster;
	if (geschlossen) {
		segmente.push(segment(letzter, erster));
	} else if (zeiger) {
		segmente.push(segment(letzter, { p: zeiger, aus: null }));
	}
	return [{ start: erster.p, segmente, zu: geschlossen }];
};

const amAnfang = (p: Punkt) => {
	const a = punkte[0];
	return punkte.length >= 3 && a !== undefined && Math.hypot(a.p.x - p.x, a.p.y - p.y) * skala < SCHLIESSEN;
};

const vorschau = (zeiger?: Punkt): Entwurf | null => {
	const zuege = zuegeVon(punkte, schliesst, zeiger);
	return zuege[0] && zuege[0].segmente.length > 0 ? neuerPfad(zuege, schliesst) : null;
};

const fertig = (geschlossen: boolean): Fortgang => {
	const zuege = zuegeVon(punkte, geschlossen);
	punkte = [];
	schliesst = false;
	return { fertig: zuege[0] && zuege[0].segmente.length > 0 ? { ...neuerPfad(zuege, geschlossen), ebene: 'vorne' } : null };
};

/**
 * Pfad ⇧P (116): Klick setzt einen Eckpunkt, Ziehen beim Setzen einen Kurvenpunkt mit symmetrischen Griffen. Enter
 * beendet offen, ein Klick auf den ersten Punkt schließt, Backspace nimmt den letzten Punkt weg, Esc bricht ohne
 * Element ab. Die Vorschau zeigt das nächste Stück bis zum Zeiger. Mehrere Drücke: `mehrteilig` in `useWerkzeug.ts`.
 */
export const werkzeug: Werkzeug | null = {
	id: 'pfad',
	titel: 'Pfad',
	symbol: 'pfad',
	taste: { code: 'KeyP', umschalt: true },
	zeiger: 'crosshair',
	bereit: (k) => k.frei,
	// Der Pfad arbeitet nur über `mehrteilig`; die einfachen Strich-Haken bleiben leer.
	beginne: () => undefined,
	bewege: () => null,
	ende: () => null,
	mehrteilig: {
		laeuft: () => punkte.length > 0,
		runter: (p, s) => {
			skala = s > 0 ? s : 1;
			schliesst = amAnfang(p);
			if (!schliesst) {
				punkte.push({ p, aus: null });
			}
		},
		ziehe: (p) => {
			const letzter = punkte.at(-1);
			if (!schliesst && letzter) {
				const weit = Math.hypot(p.x - letzter.p.x, p.y - letzter.p.y) * skala >= ECKE;
				letzter.aus = weit ? p : null;
			}
			return vorschau();
		},
		hoch: () => (schliesst ? fertig(true) : 'weiter'),
		schwebe: (p) => vorschau(amAnfang(p) ? punkte[0]?.p : p),
		taste: (taste) => {
			if (taste === 'Enter') {
				return punkte.length >= 2 ? fertig(false) : 'abbruch';
			}
			if (taste === 'Backspace' || taste === 'Delete') {
				punkte.pop();
				return punkte.length === 0 ? 'abbruch' : 'weiter';
			}
			if (taste === 'Escape') {
				return 'abbruch';
			}
			return null;
		},
		abbruch: () => {
			punkte = [];
			schliesst = false;
		},
	},
};
