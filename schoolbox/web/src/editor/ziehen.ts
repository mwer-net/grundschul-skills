import type { Baustein } from '@schoolbox/kern/src/bausteine';
import type { Ablage } from '@schoolbox/kern/src/struktur';

import { bausteinVon, elementZu, nrVon, pfadZu, trefferAn } from './darstellung';
import { entferneLuecke, inLuecke, zeigeLuecke } from './luecke';
import type { Ordnung, Platz } from './ziele';
import { ordnungVon, platzAn, ziehbarImBlatt } from './ziele';

/** Was die Leinwand während des Ziehens über dem Material zeigt, in Koordinaten des Materials. */
export interface ZugAnzeige {
	name: string;
	x: number;
	y: number;
	platz: Platz | null;
	/** Die Lücke zeigt den Platz im Blatt (094); die Linie nur, wo keine Lücke steht (Raster). */
	luecke?: boolean;
}

/** So nah am oberen bzw. unteren Rand rollt die Ansicht beim Ziehen mit. */
const ROLL_RAND = 64;
const ROLL_MAX = 18;

/** Das Element, das die Ansicht um `element` rollt. */
export const rollbarUm = (element: HTMLElement | null) => {
	for (let e = element?.parentElement ?? null; e; e = e.parentElement) {
		if (/(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight) {
			return e;
		}
	}
	return null;
};

/**
 * Rollt die Ansicht um `element`, wenn `bildschirmY` (Koordinaten des Elternfensters) an ihrem oberen oder unteren Rand
 * steht; liefert, um wie viele Pixel des Bildschirms sie rollte. Ziehen im Blatt und aus der Schublade teilen das.
 */
export const rolleAnsicht = (element: HTMLElement | null, bildschirmY: number) => {
	const ansicht = rollbarUm(element);
	if (!ansicht) {
		return 0;
	}
	const { bottom, top } = ansicht.getBoundingClientRect();
	const schritt =
		bildschirmY < top + ROLL_RAND
			? -ROLL_MAX * Math.min(1, (top + ROLL_RAND - bildschirmY) / ROLL_RAND)
			: ROLL_MAX * Math.max(0, Math.min(1, (bildschirmY - bottom + ROLL_RAND) / ROLL_RAND));
	const vorher = ansicht.scrollTop;
	ansicht.scrollTop += Math.round(schritt);
	return ansicht.scrollTop - vorher;
};

interface Optionen {
	doc: Document;
	/** Gehört das Dokument zur aktuellen Quelle, und ist gerade nichts anderes im Gange? */
	erlaubt: () => boolean;
	auswahl: () => number | null;
	/** Nummern je Seite (Folien) oder durch das ganze Dokument, wie `nummeriere`. */
	jeSeite: () => boolean;
	beginnt: (nr: number) => void;
	zeige: (anzeige: ZugAnzeige | null) => void;
	ablegen: (nr: number, ablage: Ablage) => void;
	/** Rollt die Ansicht, wenn der Zeiger am Rand steht; liefert, um wie viel sich das Material darunter verschob. */
	rolle: (x: number, y: number) => number;
}

/** Auf dem iPad startet Ziehen erst nach kurzem Halten, damit Wischen weiter rollt. */
export const HALTEN_MS = 300;
/** Wer vorher so weit wischt, rollt. */
export const FINGER_WEG = 10;
/** Mit der Maus beginnt Ziehen ab dieser Bewegung. */
export const MAUS_WEG = 6;

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
	/** Vom Griff in der Leiste, also aus dem Elternfenster; Koordinaten des Materials. Losgelassen wird über `loslassen`. */
	griffStart: (nr: number, x: number, y: number, id: number) => void;
	griffBewege: (x: number, y: number) => void;
	griffEnde: (ablegen: boolean) => void;
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
		if (
			gewaehlt &&
			nr !== null &&
			baustein &&
			ziel &&
			gewaehlt.contains(ziel) &&
			ziehbarImBlatt(baustein, gewaehlt)
		) {
			return { nr, element: gewaehlt, baustein };
		}
		for (let t = trefferAn(ziel); t; t = trefferAn(t.element.parentElement)) {
			if (ziehbarImBlatt(t.baustein, t.element)) {
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
		if (!zug) {
			return;
		}
		// In der Lücke bleibt der Platz; sonst verschöbe sie das Blatt unter dem Zeiger hin und her.
		if (!zug.platz || !inLuecke(doc, zug.x, zug.y)) {
			zug.platz = platzAn(zug.ordnung, zug.x, zug.y);
		}
		const { platz } = zug;
		const luecke =
			platz !== null &&
			!platz.marke.senkrecht &&
			zeigeLuecke(doc, platz, zug.element, { jeSeite: o.jeSeite(), verbirg: zug.element });
		if (!luecke) {
			entferneLuecke(doc);
		}
		o.zeige({ name: zug.name, x: zug.x, y: zug.y, platz, luecke });
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
		entferneLuecke(doc);
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
		// Ctrl-Klick ist am Mac ein Rechtsklick: Er startet weder einen Zug noch ein Antippen.
		const kandidat =
			o.erlaubt() && !imText(ziel) && (!maus || (e.button === 0 && !e.ctrlKey)) ? kandidatAn(ziel) : null;
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

	return {
		gezogen: () => gezogen,
		loslassen: () => beende(true),
		griffStart: (nr, x, y, id) => {
			const gewaehlt = elementZu(doc, nr);
			const baustein = gewaehlt ? bausteinVon(gewaehlt) : undefined;
			if (gewaehlt && baustein && !zug && o.erlaubt() && ziehbarImBlatt(baustein, gewaehlt)) {
				druck = { id, x, y, maus: true, kandidat: { nr, element: gewaehlt, baustein }, timer: 0 };
				beginne(x, y);
			}
		},
		griffBewege: (x, y) => {
			if (zug) {
				zug.x = x;
				zug.y = y;
				aktualisiere();
			}
		},
		griffEnde: (ablegen) => beende(ablegen),
	};
};
