import { fuerAlle, leseLage, setzeLage } from '@schoolbox/kern/src/gestaltung';

import type { Befehl, Kontext, Kuerzel } from '../../befehle';
import { elementZu } from '../../darstellung';
import type { GestaltungKontext } from '../kontext';

/**
 * Pfeiltasten schieben ein gewähltes Gestaltungselement um 1 px, mit ⇧ um 10 px (100, Briefing 5.5). Den Vorrang vor
 * `auswahl.vorheriger`/`auswahl.naechster` gibt `wenn` am Kürzel (`befehlZuTaste`). Ein Druck ist ein Schritt; eine
 * gehaltene Taste (`repeat`) zeigt nur an und schreibt beim Loslassen einen Schritt (4.6).
 */

const RICHTUNGEN = [
	{ name: 'links', key: 'ArrowLeft', titel: 'Nach links schieben', dx: -1, dy: 0 },
	{ name: 'rechts', key: 'ArrowRight', titel: 'Nach rechts schieben', dx: 1, dy: 0 },
	{ name: 'hoch', key: 'ArrowUp', titel: 'Nach oben schieben', dx: 0, dy: -1 },
	{ name: 'runter', key: 'ArrowDown', titel: 'Nach unten schieben', dx: 0, dy: 1 },
] as const;

export const GROSSER_SCHRITT = 10;

const mitGestaltung = (k: Kontext) => k.gestaltung !== null;

/** 113: Alle Gewählten, außer gesperrten; bei einem Element nur dieses. */
const zuSchieben = (g: GestaltungKontext) =>
	g.nrn.filter((n) => n === g.nr || !elementZu(g.doc, n)?.hasAttribute('data-gesperrt'));

/** Ein Schritt im Verlauf: die Lage aus der Quelle plus der Weg, für alle Gewählten (113). */
const schiebe = (g: GestaltungKontext, nrn: readonly number[], dx: number, dy: number) =>
	g.fuehreAus('Verschoben', (q) => ({
		quelle: fuerAlle(q, nrn, (q2, nr) => {
			const lage = leseLage(q2, nr);
			return setzeLage(q2, nr, { x: (lage.x ?? 0) + dx, y: (lage.y ?? 0) + dy });
		}).quelle,
		nr: g.nr,
	}));

interface Gehalten {
	g: GestaltungKontext;
	nr: number;
	/** 113: Startlage je gewähltem Element. */
	start: Map<number, { x: number; y: number }>;
	dx: number;
	dy: number;
	los: AbortController;
}

let gehalten: Gehalten | null = null;

/** Schreibt, was eine gehaltene Taste angesammelt hat, als einen Schritt. */
const lasseLos = () => {
	const h = gehalten;
	gehalten = null;
	if (!h) {
		return;
	}
	h.los.abort();
	if (h.dx !== 0 || h.dy !== 0) {
		schiebe(h.g, [...h.start.keys()], h.dx, h.dy);
	}
};

/** Fenster, an denen das Loslassen ankommen kann: das eigene und das des `iframe`, aus dem die Taste kam. */
const fensterVon = (taste: KeyboardEvent) => {
	const liste: Window[] = [window];
	const ansicht = taste.view as Window | null;
	if (ansicht && ansicht !== window) {
		liste.push(ansicht);
	}
	return liste;
};

const halte = (k: Kontext, g: GestaltungKontext, taste: KeyboardEvent, dx: number, dy: number) => {
	if (gehalten && gehalten.nr !== g.nr) {
		lasseLos();
	}
	if (!gehalten) {
		const start = new Map(
			zuSchieben(g).map((n) => {
				const lage = k.quelle ? leseLage(k.quelle, n) : {};
				return [n, { x: lage.x ?? 0, y: lage.y ?? 0 }] as const;
			}),
		);
		const los = new AbortController();
		gehalten = { g, nr: g.nr, start, dx: 0, dy: 0, los };
		const hoch = (e: KeyboardEvent) => {
			if (e.key.startsWith('Arrow')) {
				lasseLos();
			}
		};
		for (const f of fensterVon(taste)) {
			f.addEventListener('keyup', hoch, { capture: true, signal: los.signal });
			f.addEventListener('blur', lasseLos, { signal: los.signal });
		}
	}
	gehalten.g = g;
	gehalten.dx += dx;
	gehalten.dy += dy;
	for (const [n, s] of gehalten.start) {
		g.zeigeLage(n, { x: s.x + gehalten.dx, y: s.y + gehalten.dy });
	}
};

export const PFEIL_BEFEHLE: Befehl[] = RICHTUNGEN.map(
	({ dx, dy, key, name, titel }): Befehl => ({
		id: `auswahl.schiebe-${name}`,
		titel,
		gruppe: 'ordnen',
		kuerzel: [
			{ key, wenn: mitGestaltung },
			{ key, umschalt: true, wenn: mitGestaltung },
		] satisfies Kuerzel[],
		modus: ['auswahl'],
		suchwoerter: ['pfeiltaste', 'verschieben', 'bewegen'],
		orte: ['taste'],
		sichtbarUnter: 'inspektor',
		verfuegbar: (k) => k.aktiv && k.gestaltung !== null && !k.gestaltung.element.hasAttribute('data-gesperrt'),
		aus: (k, taste) => {
			const g = k.gestaltung;
			if (!g) {
				return;
			}
			const weite = taste?.shiftKey ? GROSSER_SCHRITT : 1;
			if (taste?.repeat) {
				halte(k, g, taste, dx * weite, dy * weite);
				return;
			}
			lasseLos();
			schiebe(g, zuSchieben(g), dx * weite, dy * weite);
		},
	}),
);
