import type { Baustein } from '@schoolbox/kern/src/bausteine';
import type { Ablage } from '@schoolbox/kern/src/struktur';

import { bausteinVon, elementZu, nrVon, pfadZu, trefferAn } from './darstellung';
import type { Ordnung, Platz } from './ziele';
import { ordnungVon, platzAn, ziehbarImBlatt } from './ziele';

/** Was die Leinwand während des Ziehens über dem Material zeigt, in Koordinaten des Materials. */
export interface ZugAnzeige {
	name: string;
	x: number;
	y: number;
	platz: Platz | null;
}

interface Optionen {
	doc: Document;
	/** Gehört das Dokument zur aktuellen Quelle, und ist gerade nichts anderes im Gange? */
	erlaubt: () => boolean;
	auswahl: () => number | null;
	beginnt: (nr: number) => void;
	zeige: (anzeige: ZugAnzeige | null) => void;
	ablegen: (nr: number, ablage: Ablage) => void;
	/** Rollt die Ansicht, wenn der Zeiger am Rand steht; liefert, um wie viel sich das Material darunter verschob. */
	rolle: (x: number, y: number) => number;
}

/** Auf dem iPad startet Ziehen erst nach kurzem Halten, damit Wischen weiter rollt. */
export const HALTEN_MS = 300;
/** Wer vorher so weit wischt, rollt. */
const FINGER_WEG = 10;
/** Mit der Maus beginnt Ziehen ab dieser Bewegung. */
const MAUS_WEG = 6;

interface Kandidat {
	nr: number;
	element: Element;
	baustein: Baustein;
}

interface Druck {
	id: number;
	x: number;
	y: number;
	maus: boolean;
	kandidat: Kandidat;
	timer: number;
}

interface Zug {
	id: number;
	nr: number;
	ordnung: Ordnung;
	name: string;
	element: HTMLElement;
	deckkraft: string;
	x: number;
	y: number;
	platz: Platz | null;
}

export interface ZiehenSteuerung {
	/** Ist in der laufenden Berührung gezogen worden? Dann ist sie kein Antippen. */
	gezogen: () => boolean;
	/** Loslassen außerhalb des Materials. */
	loslassen: () => void;
}

const imText = (ziel: Element | null) => Boolean(ziel?.closest('[contenteditable="true"]'));

/**
 * Bausteine im Material ziehen, mit Maus und Finger, ohne das Material selbst zu ändern: Am Ende steht **ein**
 * `ablegen` mit dem Platz, die Quelle ändert der Editor. Gezogen wird der gewählte Baustein, wenn der Zeiger in ihm
 * liegt, sonst der innerste ziehbare an dieser Stelle.
 */
export const ruesteZiehen = (o: Optionen): ZiehenSteuerung => {
	const { doc } = o;
	const fenster = doc.defaultView;
	let druck: Druck | null = null;
	let zug: Zug | null = null;
	let gezogen = false;

	const kandidatAn = (ziel: Element | null): Kandidat | null => {
		const nr = o.auswahl();
		const gewaehlt = nr === null ? null : elementZu(doc, nr);
		const baustein = gewaehlt ? bausteinVon(gewaehlt) : undefined;
		if (gewaehlt && nr !== null && baustein && ziel && gewaehlt.contains(ziel) && ziehbarImBlatt(baustein)) {
			return { nr, element: gewaehlt, baustein };
		}
		for (let t = trefferAn(ziel); t; t = trefferAn(t.element.parentElement)) {
			if (ziehbarImBlatt(t.baustein)) {
				return t;
			}
		}
		return null;
	};

	const loese = () => {
		if (druck) {
			fenster?.clearTimeout(druck.timer);
		}
		druck = null;
	};

	const aktualisiere = () => {
		if (zug) {
			zug.platz = platzAn(zug.ordnung, zug.x, zug.y);
			o.zeige({ name: zug.name, x: zug.x, y: zug.y, platz: zug.platz });
		}
	};

	const rolle = () => {
		if (!zug) {
			return;
		}
		const verschoben = o.rolle(zug.x, zug.y);
		if (verschoben) {
			zug.y += verschoben;
			aktualisiere();
		}
		fenster?.requestAnimationFrame(rolle);
	};

	const beginne = (x: number, y: number) => {
		const d = druck;
		loese();
		if (!d || !o.erlaubt()) {
			return;
		}
		const { baustein, element, nr } = d.kandidat;
		const html = element as HTMLElement;
		zug = {
			id: d.id,
			nr,
			ordnung: ordnungVon(element, baustein),
			name: pfadZu(doc, nr).at(-1)?.name ?? baustein.name,
			element: html,
			deckkraft: html.style.opacity,
			x,
			y,
			platz: null,
		};
		gezogen = true;
		html.style.opacity = '0.35';
		doc.documentElement.style.cursor = 'grabbing';
		try {
			doc.documentElement.setPointerCapture(d.id);
		} catch {
			// Ohne Fangen bleibt Ziehen auf das Material beschränkt.
		}
		o.beginnt(nr);
		aktualisiere();
		fenster?.requestAnimationFrame(rolle);
	};

	const beende = (ablegen: boolean) => {
		const z = zug;
		zug = null;
		if (!z) {
			return;
		}
		z.element.style.opacity = z.deckkraft;
		doc.documentElement.style.cursor = '';
		o.zeige(null);
		if (ablegen && z.platz && o.erlaubt()) {
			o.ablegen(z.nr, z.platz.ablage);
		}
	};

	doc.addEventListener('pointerdown', (e) => {
		if (!e.isPrimary || zug) {
			return;
		}
		gezogen = false;
		loese();
		const ziel = (e.target as Node | null)?.nodeType === 1 ? (e.target as Element) : null;
		const maus = e.pointerType === 'mouse';
		const kandidat = o.erlaubt() && !imText(ziel) && (!maus || e.button === 0) ? kandidatAn(ziel) : null;
		if (!kandidat || nrVon(kandidat.element) === null) {
			return;
		}
		const neu: Druck = { id: e.pointerId, x: e.clientX, y: e.clientY, maus, kandidat, timer: 0 };
		if (!maus) {
			neu.timer = fenster?.setTimeout(() => beginne(neu.x, neu.y), HALTEN_MS) ?? 0;
		}
		druck = neu;
	});
	doc.addEventListener('pointermove', (e) => {
		if (zug && e.pointerId === zug.id) {
			zug.x = e.clientX;
			zug.y = e.clientY;
			aktualisiere();
			e.preventDefault();
			return;
		}
		if (!druck || e.pointerId !== druck.id) {
			return;
		}
		const weg = Math.hypot(e.clientX - druck.x, e.clientY - druck.y);
		if (druck.maus && weg > MAUS_WEG) {
			beginne(e.clientX, e.clientY);
		} else if (!druck.maus && weg > FINGER_WEG) {
			loese();
		}
	});
	doc.addEventListener('pointerup', () => {
		loese();
		beende(true);
	});
	doc.addEventListener('pointercancel', () => {
		loese();
		beende(false);
	});
	// Während gezogen wird, darf der Finger die Seite nicht rollen; vorher schon (`passive: false` nur dafür).
	doc.addEventListener(
		'touchmove',
		(e) => {
			if (zug) {
				e.preventDefault();
			}
		},
		{ passive: false },
	);
	doc.addEventListener('contextmenu', (e) => {
		if (zug || druck) {
			e.preventDefault();
		}
	});
	doc.addEventListener('keydown', (e) => {
		if (zug && e.key === 'Escape') {
			e.stopImmediatePropagation();
			beende(false);
		}
	});

	return { gezogen: () => gezogen, loslassen: () => beende(true) };
};
