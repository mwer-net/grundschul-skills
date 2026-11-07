import { kopiereGestaltungNach, setzeLage, setzeStilWerte, verschiebeAufSeite } from '@schoolbox/kern/src/gestaltung';
import type { LageTeil } from '@schoolbox/kern/src/gestaltung';
import { GESTALTUNG_SELEKTOR, gestaltungArtNach } from '@schoolbox/kern/src/gestaltung-arten';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { meldeDaneben } from '../../bausteine/ueberlagerung';
import { folgeZeiger, schluckeKlick } from '../../bausteine/zeigerzug';
import type { PfadTeil } from '../darstellung';
import { bausteinVon, nrVon, VERALTET } from '../darstellung';
import type { Struktur } from '../struktur';
import { FINGER_WEG, HALTEN_MS, MAUS_WEG } from '../ziehen';
import { zeigeNachGroesse } from './anzeige-folgen';
import { doppelklickZiel } from './doppelklick';
import type { Hilfslinie, Kandidat } from './einrasten';
import { rasteEin, sammleKandidaten } from './einrasten';
import type { GriffName, GroessenArt, Kasten } from './geste';
import { bewege, drehe, haeltVerhaeltnis, inKasten, skaliere, wertText, winkelZu } from './geste';
import type { ZusatzGriff } from './griffe';
import type { GestaltungKontext } from './kontext';
import { gestaltungKontext, zeigeLageAm } from './kontext';

/** Ein Rechteck in Koordinaten des Materials. */
export interface Flaeche {
	links: number;
	oben: number;
	breite: number;
	hoehe: number;
}

export type GestenArt = 'bewegen' | 'skalieren' | 'drehen' | 'griff';

/** Was die Überlagerung während einer Geste zeigt. Alles in Koordinaten des Materials. */
export interface GestenStand {
	art: GestenArt;
	nr: number;
	kasten: Kasten;
	/** Linke obere Ecke des Behälters (Innenkante) im Material. */
	ursprung: { x: number; y: number };
	zeiger: { x: number; y: number };
	text: string;
	/** Die Seite, auf der das Element landet; für die Druckrand-Linie. `null`: außerhalb jeder Seite. */
	seite: Flaeche | null;
	linien: Hilfslinie[];
}

/** Gemessene Lage eines Elements im `iframe`. */
export interface Messung {
	kasten: Kasten;
	ursprung: { x: number; y: number };
	behaelter: Element;
}

const istElement = (n: EventTarget | Node | null): n is Element => (n as Node | null)?.nodeType === 1;

/** Der Behälter, auf den sich `--x`/`--y` beziehen: das nächste positionierte Element darüber (Ebene, Baustein beim Anker). */
const behaelterVon = (element: Element): Element => {
	const html = element as HTMLElement;
	if ('offsetParent' in html && html.offsetParent) {
		return html.offsetParent;
	}
	const fenster = element.ownerDocument.defaultView;
	for (let e = element.parentElement; e; e = e.parentElement) {
		if (fenster?.getComputedStyle(e).position !== 'static') {
			return e;
		}
	}
	return element.ownerDocument.body;
};

/** Lage vor dem Drehen aus dem berechneten Stil; einmal je Geste bzw. je Zeichnen, nie für alle Elemente. */
export const messe = (element: Element): Messung | null => {
	const fenster = element.ownerDocument.defaultView;
	if (!fenster || element.getClientRects().length === 0) {
		return null;
	}
	const stil = fenster.getComputedStyle(element);
	const behaelter = behaelterVon(element);
	const r = behaelter.getBoundingClientRect();
	const zahl = (wert: string) => {
		const n = parseFloat(wert);
		return Number.isFinite(n) ? n : 0;
	};
	return {
		kasten: {
			x: zahl(stil.left),
			y: zahl(stil.top),
			b: zahl(stil.width),
			h: zahl(stil.height),
			drehen: zahl(stil.getPropertyValue('--drehen')),
		},
		ursprung: { x: r.left + behaelter.clientLeft, y: r.top + behaelter.clientTop },
		behaelter,
	};
};

/** Das äußerste Gestaltungselement mit Nummer um `start` (eine Gruppe vor ihren Kindern). */
export const gestaltungUnter = (start: Element | null) => {
	let gefunden: Element | null = null;
	for (let e = start; e && !e.matches('.seite'); e = e.parentElement) {
		if (e.matches(GESTALTUNG_SELEKTOR) && nrVon(e) !== null) {
			gefunden = e;
		}
	}
	return gefunden;
};

/** ⌥-Klick: das hinterste Gestaltungselement unter dem Zeiger. Gesperrtes trifft die Prüfung nicht (`pointer-events`). */
export const hintersteAn = (doc: Document, x: number, y: number) =>
	doc
		.elementsFromPoint(x, y)
		.filter((e) => e.matches(GESTALTUNG_SELEKTOR) && nrVon(e) !== null)
		.at(-1) ?? null;

const rechteckVon = (e: Element): Flaeche => {
	const r = e.getBoundingClientRect();
	return { links: r.left, oben: r.top, breite: r.width, hoehe: r.height };
};

const enthaelt = (f: Flaeche, x: number, y: number) =>
	x >= f.links && x <= f.links + f.breite && y >= f.oben && y <= f.oben + f.hoehe;

interface Seite {
	nr: number;
	flaeche: Flaeche;
}

interface Lauf {
	art: GestenArt;
	nr: number;
	element: Element;
	groesse: GroessenArt;
	start: Kasten;
	jetzt: Kasten;
	ursprung: { x: number; y: number };
	/** Attribute beim Start: Esc stellt sie wieder her. */
	attribute: [string, string][];
	/** Was die Quelle beim Start im `style` hatte. */
	hatte: { b: boolean; h: boolean };
	/** Schriftgröße beim Start, nur bei `text`. */
	gr: number | null;
	/** Nur beim Bewegen eines Elements in einer Ebene: alle Seiten, einmal gemessen. */
	seiten: Seite[];
	eigeneSeite: Seite | null;
	zielSeite: Seite | null;
	kandidaten: Kandidat[];
	griff: GriffName | null;
	zusatz: ZusatzGriff | null;
	kontext: GestaltungKontext | null;
	wahl: boolean;
	umschalt: boolean;
	/** Weg des Zeigers seit dem Start, in Koordinaten des Behälters. */
	dx: number;
	dy: number;
	ende: () => void;
}

interface Druck {
	id: number;
	x: number;
	y: number;
	maus: boolean;
	nr: number;
	element: Element;
	timer: number;
}

interface Optionen {
	doc: Document;
	skala: number;
	pfad: PfadTeil[];
	struktur: Pick<Struktur, 'aktiv' | 'fuehreAus'>;
	waehle: (nr: number | null) => void;
	/** Eine Textsitzung ist offen: keine Geste. */
	textsitzung: boolean;
}

const lageAus = (k: Kasten) => ({ x: Math.round(k.x), y: Math.round(k.y) });

const stilHat = (element: Element, name: string) =>
	(element.getAttribute('style') ?? '').split(';').some((t) => t.slice(0, t.indexOf(':')).trim() === name);

/**
 * Gesten an Gestaltungselementen (097): wählen, ziehen, Größe an Ecken und Kanten, Drehen. Während der Geste ändert
 * sich nur die Darstellung im `iframe` (Variablen am Element), die Quelle erst beim Loslassen mit **einem**
 * `fuehreAus`. Esc stellt die Attribute vom Start wieder her und schreibt nichts.
 */
export const useGeste = (o: Optionen) => {
	const { doc } = o;
	const [stand, setStand] = useState<GestenStand | null>(null);
	const aktuell = useRef(o);
	aktuell.current = o;
	const lauf = useRef<Lauf | null>(null);

	const erlaubt = useCallback(
		() =>
			aktuell.current.struktur.aktiv &&
			!aktuell.current.textsitzung &&
			!doc.documentElement.hasAttribute(VERALTET),
		[doc],
	);

	const zeige = useCallback((l: Lauf, zeiger: { x: number; y: number }, linien: Hilfslinie[] = []) => {
		let text = wertText(l.art === 'griff' ? 'bewegen' : l.art, l.jetzt);
		if (l.art === 'bewegen' && l.zielSeite && l.eigeneSeite && l.zielSeite !== l.eigeneSeite) {
			const x = l.jetzt.x + l.eigeneSeite.flaeche.links - l.zielSeite.flaeche.links;
			const y = l.jetzt.y + l.eigeneSeite.flaeche.oben - l.zielSeite.flaeche.oben;
			const nummer = l.seiten.indexOf(l.zielSeite) + 1;
			text = `Seite ${nummer} · X ${Math.round(x)} · Y ${Math.round(y)}`;
		}
		setStand({
			art: l.art,
			nr: l.nr,
			kasten: l.jetzt,
			ursprung: l.ursprung,
			zeiger,
			text,
			seite: (l.art === 'bewegen' ? l.zielSeite : l.eigeneSeite)?.flaeche ?? null,
			linien,
		});
	}, []);

	/** Stellt die Attribute vom Start wieder her. */
	const stelleHer = (l: Lauf) => {
		for (const { name } of [...l.element.attributes]) {
			if (!l.attribute.some(([n]) => n === name)) {
				l.element.removeAttribute(name);
			}
		}
		for (const [name, wert] of l.attribute) {
			if (l.element.getAttribute(name) !== wert) {
				l.element.setAttribute(name, wert);
			}
		}
		if (l.art === 'skalieren') {
			zeigeNachGroesse(l.element, l.start.b, l.start.h); // 104: Inhalt wieder in der Größe vom Start
		}
	};

	const beende = useCallback(() => {
		const l = lauf.current;
		lauf.current = null;
		l?.ende();
		setStand(null);
		doc.documentElement.style.cursor = '';
	}, [doc]);

	const brichAb = useCallback(() => {
		const l = lauf.current;
		if (!l) {
			return;
		}
		stelleHer(l);
		if (l.zusatz && l.kontext) {
			l.zusatz.zuruecksetzen?.(l.kontext);
		}
		beende();
	}, [beende]);

	/** Bereitet eine Geste am Element vor; `null`, wenn es nicht geht. */
	const beginne = useCallback(
		(art: GestenArt, element: Element, ende: () => void): Lauf | null => {
			const nr = nrVon(element);
			const m = messe(element);
			if (nr === null || !m || !erlaubt() || lauf.current) {
				return null;
			}
			const baustein = bausteinVon(element);
			const groesse = (gestaltungArtNach(baustein?.art ?? '')?.groesse ?? 'frei') as GroessenArt;
			const fenster = doc.defaultView;
			const inEbene = Boolean(element.parentElement?.matches('.ebene'));
			const seiten: Seite[] = [...doc.querySelectorAll('.seite')].flatMap((s) => {
				const n = nrVon(s);
				return n === null || s.hasAttribute('data-erzeugt') ? [] : [{ nr: n, flaeche: rechteckVon(s) }];
			});
			const eigen = element.closest('.seite');
			const eigeneSeite = seiten.find((s) => s.nr === (eigen ? nrVon(eigen) : null)) ?? null;
			const gr =
				groesse === 'text'
					? parseFloat(fenster?.getComputedStyle(element).getPropertyValue('--gr') ?? '') ||
						parseFloat(fenster?.getComputedStyle(element).fontSize ?? '') ||
						null
					: null;
			const l: Lauf = {
				art,
				nr,
				element,
				groesse,
				start: m.kasten,
				jetzt: m.kasten,
				ursprung: m.ursprung,
				attribute: [...element.attributes].map((a) => [a.name, a.value]),
				hatte: { b: stilHat(element, '--b'), h: stilHat(element, '--h') },
				gr,
				seiten: inEbene ? seiten : [],
				eigeneSeite,
				zielSeite: eigeneSeite,
				// Einmal je Geste: Einrasten rechnet nie alle Elemente je Bewegung neu (4.12).
				kandidaten: art === 'bewegen' ? sammleKandidaten(element, m.behaelter) : [],
				griff: null,
				zusatz: null,
				kontext: null,
				wahl: false,
				umschalt: false,
				dx: 0,
				dy: 0,
				ende,
			};
			lauf.current = l;
			return l;
		},
		[doc, erlaubt],
	);

	/** Was beim Skalieren in die Quelle kommt: nur Variablen, die die Art nutzt bzw. die schon da waren. */
	const groessenTeil = (l: Lauf) => {
		const k = l.jetzt;
		const teil: LageTeil = lageAus(k);
		const ecke = l.griff !== null && l.griff.includes('-');
		const werte: Record<string, string> = {};
		if (l.groesse === 'text' && ecke) {
			if (l.hatte.b) {
				teil.b = k.b;
			}
			if (l.gr) {
				werte['--gr'] = `${Math.round((l.gr * k.b) / Math.max(1, l.start.b))}px`;
			}
		} else {
			if (k.b !== l.start.b) {
				teil.b = k.b;
			}
			if (k.h !== l.start.h && (l.hatte.h || l.groesse === 'frei')) {
				teil.h = k.h;
			}
		}
		return { teil, werte };
	};

	const zeigeGroesse = (l: Lauf) => {
		const { teil, werte } = groessenTeil(l);
		zeigeLageAm(l.element, teil);
		zeigeNachGroesse(l.element, l.jetzt.b, l.jetzt.h); // 104: Formen u. a. zeichnen sich in der neuen Größe
		const stil = (l.element as HTMLElement).style;
		for (const [name, wert] of Object.entries(werte)) {
			stil.setProperty(name, wert);
		}
	};

	/** Ein Schritt. Klappt er nicht, steht das Element wieder wie vorher. */
	const schreibe = (l: Lauf, beschreibung: string, rechne: (q: string) => StrukturErgebnis) => {
		const geklappt = aktuell.current.struktur.fuehreAus(beschreibung, rechne, false, true) !== null;
		if (!geklappt) {
			stelleHer(l);
		}
	};

	// ── Bewegen im Blatt ──────────────────────────────────────────────────────

	const bewegeZu = useCallback(
		(x: number, y: number, umschalt: boolean, start: { x: number; y: number }) => {
			const l = lauf.current;
			if (!l || l.art !== 'bewegen') {
				return;
			}
			l.dx = x - start.x;
			l.dy = y - start.y;
			l.umschalt = umschalt;
			const roh = bewege(l.start, l.dx, l.dy, { achse: umschalt });
			const { lage, linien } = rasteEin(roh, l.kandidaten, aktuell.current.skala);
			l.jetzt = lage;
			if (l.seiten.length > 0) {
				l.zielSeite = l.seiten.find((s) => enthaelt(s.flaeche, x, y)) ?? null;
			}
			zeigeLageAm(l.element, lageAus(lage));
			zeige(l, { x, y }, linien);
		},
		[zeige],
	);

	const legeAb = useCallback(
		(wahl: boolean) => {
			const l = lauf.current;
			if (!l || l.art !== 'bewegen') {
				return;
			}
			const { eigeneSeite, nr, zielSeite } = l;
			const lage = lageAus(l.jetzt);
			const bewegt = lage.x !== Math.round(l.start.x) || lage.y !== Math.round(l.start.y);
			// Außerhalb jeder Seite: zurück, nichts ändert sich (5.3).
			if (l.seiten.length > 0 && !zielSeite) {
				brichAb();
				return;
			}
			const andere = zielSeite && eigeneSeite && zielSeite !== eigeneSeite ? zielSeite : null;
			beende();
			if (!bewegt && !andere) {
				return;
			}
			if (andere && eigeneSeite) {
				lage.x += Math.round(eigeneSeite.flaeche.links - andere.flaeche.links);
				lage.y += Math.round(eigeneSeite.flaeche.oben - andere.flaeche.oben);
			}
			if (wahl) {
				// Die Kopie liegt an der neuen Lage, das Original springt zurück.
				stelleHer(l);
				schreibe(l, 'Kopiert', (q) => kopiereGestaltungNach(q, nr, lage, andere?.nr));
			} else if (andere) {
				// Bis die neue Fassung steht, bleibt es an seinem Platz; im Ebenen-Ausschnitt der alten Seite wäre es weg.
				stelleHer(l);
				schreibe(l, 'Auf andere Seite verschoben', (q) => verschiebeAufSeite(q, nr, andere.nr, lage));
			} else {
				schreibe(l, 'Verschoben', (q) => ({ quelle: setzeLage(q, nr, lage), nr }));
			}
		},
		[beende, brichAb],
	);

	// Zeiger im Material: wählen, ziehen, ⌥-Klick, Doppelklick. Am Fenster des `iframe` und vor allen anderen
	// (`capture`), damit weder das Ziehen im Stapel (`ziehen.ts`) noch das Antippen der Leinwand dazwischenkommt.
	useEffect(() => {
		const fenster = doc.defaultView;
		if (!fenster) {
			return undefined;
		}
		let druck: Druck | null = null;
		let zugStart = { x: 0, y: 0 };
		const loese = () => {
			if (druck) {
				fenster.clearTimeout(druck.timer);
			}
			druck = null;
		};
		const starteZug = (d: Druck, x: number, y: number) => {
			loese();
			const l = beginne('bewegen', d.element, () => {
				try {
					doc.documentElement.releasePointerCapture(d.id);
				} catch {
					// schon frei
				}
			});
			if (!l) {
				return;
			}
			zugStart = { x: d.x, y: d.y };
			aktuell.current.waehle(d.nr);
			doc.documentElement.style.cursor = 'move';
			try {
				doc.documentElement.setPointerCapture(d.id);
			} catch {
				// Ohne Fangen bleibt der Zug auf das Material beschränkt.
			}
			bewegeZu(x, y, false, zugStart);
		};

		const runter = (e: PointerEvent) => {
			if (!e.isPrimary || lauf.current || aktuell.current.textsitzung) {
				return;
			}
			const ziel = istElement(e.target) ? e.target : null;
			const maus = e.pointerType === 'mouse';
			if (!ziel || ziel.closest('[contenteditable="true"]:focus') || (maus && (e.button !== 0 || e.ctrlKey))) {
				return;
			}
			const gewaehlt = aktuell.current.pfad.at(-1)?.nr ?? null;
			let element = gestaltungUnter(ziel);
			if (maus && e.altKey) {
				const unter = doc.elementsFromPoint(e.clientX, e.clientY);
				const auswahl = unter.find((u) => u.matches(GESTALTUNG_SELEKTOR) && nrVon(u) === gewaehlt);
				element = auswahl ?? hintersteAn(doc, e.clientX, e.clientY) ?? element;
			}
			const nr = element ? nrVon(element) : null;
			if (!element || nr === null || !erlaubt()) {
				return;
			}
			e.stopPropagation();
			meldeDaneben();
			loese();
			const d: Druck = { id: e.pointerId, x: e.clientX, y: e.clientY, maus, nr, element, timer: 0 };
			if (maus) {
				// Kein Fokus in den Text: Der erste Klick wählt, der Doppelklick öffnet die Textsitzung (5.4).
				e.preventDefault();
				aktuell.current.waehle(nr);
				fenster.focus();
			} else {
				d.timer = fenster.setTimeout(() => starteZug(d, d.x, d.y), HALTEN_MS);
			}
			druck = d;
		};

		const bewegt = (e: PointerEvent) => {
			const l = lauf.current;
			if (l?.art === 'bewegen') {
				e.preventDefault();
				bewegeZu(e.clientX, e.clientY, e.shiftKey, zugStart);
				return;
			}
			if (!druck || e.pointerId !== druck.id) {
				return;
			}
			const weg = Math.hypot(e.clientX - druck.x, e.clientY - druck.y);
			if (druck.maus && weg > MAUS_WEG) {
				starteZug(druck, e.clientX, e.clientY);
			} else if (!druck.maus && weg > FINGER_WEG) {
				// Gewischt: Die Ansicht rollt weiter.
				loese();
			}
		};

		const hoch = (e: PointerEvent) => {
			if (lauf.current?.art === 'bewegen') {
				e.stopPropagation();
				legeAb(e.altKey);
				return;
			}
			const d = druck;
			loese();
			if (d && !d.maus && e.pointerId === d.id) {
				// Angetippt: wählen.
				e.stopPropagation();
				aktuell.current.waehle(d.nr);
				fenster.focus();
			}
		};

		const abbruch = () => {
			loese();
			if (lauf.current?.art === 'bewegen') {
				brichAb();
			}
		};

		const taste = (e: KeyboardEvent) => {
			if (lauf.current && e.key === 'Escape') {
				e.preventDefault();
				e.stopImmediatePropagation();
				brichAb();
			}
		};

		const doppelt = (e: MouseEvent) => {
			const ziel = istElement(e.target) ? e.target : null;
			const element = gestaltungUnter(ziel);
			const { pfad, struktur, textsitzung } = aktuell.current;
			if (!element || textsitzung || nrVon(element) !== pfad.at(-1)?.nr) {
				return;
			}
			const g = gestaltungKontext({ doc, pfad, struktur });
			const was = g ? doppelklickZiel(element, g.art) : undefined;
			if (g && was) {
				e.preventDefault();
				e.stopPropagation();
				was.tu(g, { x: e.clientX, y: e.clientY });
			}
		};

		const rollen = (e: TouchEvent) => {
			if (lauf.current) {
				e.preventDefault();
			}
		};
		const menue = (e: Event) => {
			if (lauf.current || druck) {
				e.preventDefault();
			}
		};

		const lauscher = new AbortController();
		const { signal } = lauscher;
		fenster.addEventListener('pointerdown', runter, { capture: true, signal });
		fenster.addEventListener('pointermove', bewegt, { capture: true, signal });
		fenster.addEventListener('pointerup', hoch, { capture: true, signal });
		fenster.addEventListener('pointercancel', abbruch, { capture: true, signal });
		fenster.addEventListener('keydown', taste, { capture: true, signal });
		fenster.addEventListener('dblclick', doppelt, { capture: true, signal });
		fenster.addEventListener('contextmenu', menue, { capture: true, signal });
		doc.addEventListener('touchmove', rollen, { passive: false, signal });
		// Esc, während der Fokus in der Bedienung liegt (Griff am Rand).
		window.addEventListener('keydown', taste, { capture: true, signal });
		return () => {
			lauscher.abort();
			loese();
			if (lauf.current) {
				brichAb();
			}
		};
	}, [doc, beginne, bewegeZu, legeAb, brichAb, erlaubt]);

	// ── Griffe am Rahmen (im Elternfenster) ───────────────────────────────────

	/** Zeiger im Elternfenster → Koordinaten des Materials. */
	const imMaterial = useCallback(
		(x: number, y: number) => {
			const r = doc.defaultView?.frameElement?.getBoundingClientRect();
			const { skala } = aktuell.current;
			return r ? { x: (x - r.left) / skala, y: (y - r.top) / skala } : { x: 0, y: 0 };
		},
		[doc],
	);

	const folge = (
		e: ReactPointerEvent<HTMLElement>,
		l: Lauf,
		bewegen: (m: PointerEvent) => void,
		fertig: (m: PointerEvent) => void,
	) => {
		const griff = e.currentTarget;
		try {
			griff.setPointerCapture(e.pointerId);
		} catch {
			// Ohne Fang kommen die Bewegungen über `window` trotzdem.
		}
		const stop = folgeZeiger({
			bewegen: (m) => {
				if (m.pointerId === e.pointerId) {
					bewegen(m);
				}
			},
			los: (m) => {
				if (m.pointerId !== e.pointerId || lauf.current !== l) {
					return;
				}
				schluckeKlick();
				fertig(m);
			},
			abbruch: brichAb,
			taste: () => undefined,
			bild: () => undefined,
			sperrtRollen: () => true,
		});
		l.ende = stop;
	};

	/** Ecke, Kante oder Drehgriff. `rahmen`: der gedrehte Rahmen der Überlagerung, seine Mitte ist die des Elements. */
	const starteGriff = useCallback(
		(e: ReactPointerEvent<HTMLElement>, element: Element, griff: GriffName | 'drehen') => {
			if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			const l = beginne(griff === 'drehen' ? 'drehen' : 'skalieren', element, () => undefined);
			if (!l) {
				return;
			}
			const start = { x: e.clientX, y: e.clientY };
			const { skala } = aktuell.current;
			const mitte = (() => {
				const r = e.currentTarget.parentElement?.getBoundingClientRect();
				return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : start;
			})();
			const winkel0 = winkelZu(mitte, start);
			l.griff = griff === 'drehen' ? null : griff;
			const bewegen = (m: PointerEvent) => {
				l.umschalt = m.shiftKey;
				l.wahl = m.altKey;
				if (griff === 'drehen') {
					l.jetzt = drehe(l.start, l.start.drehen + winkelZu(mitte, { x: m.clientX, y: m.clientY }) - winkel0, {
						raster15: m.shiftKey,
					});
					zeigeLageAm(l.element, { drehen: l.jetzt.drehen });
				} else {
					l.jetzt = skaliere(l.start, griff, (m.clientX - start.x) / skala, (m.clientY - start.y) / skala, {
						verhaeltnis: haeltVerhaeltnis(l.groesse, griff, m.shiftKey),
						mitte: m.altKey,
					});
					zeigeGroesse(l);
				}
				zeige(l, imMaterial(m.clientX, m.clientY));
			};
			const fertig = () => {
				const { nr } = l;
				const gleich =
					l.jetzt.x === l.start.x &&
					l.jetzt.y === l.start.y &&
					l.jetzt.b === l.start.b &&
					l.jetzt.h === l.start.h &&
					l.jetzt.drehen === l.start.drehen;
				beende();
				if (gleich) {
					return;
				}
				if (griff === 'drehen') {
					const drehen = l.jetzt.drehen;
					schreibe(l, 'Gedreht', (q) => ({ quelle: setzeLage(q, nr, { drehen: drehen || null }), nr }));
					return;
				}
				const { teil, werte } = groessenTeil(l);
				schreibe(l, 'Größe geändert', (q) => ({
					quelle: setzeStilWerte(setzeLage(q, nr, teil), nr, werte),
					nr,
				}));
			};
			folge(e, l, bewegen, fertig);
			zeige(l, imMaterial(start.x, start.y));
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `groessenTeil`, `zeigeGroesse`, `schreibe` lesen nur Refs
		[beginne, beende, brichAb, imMaterial, zeige],
	);

	/** Ein Zusatzgriff (Zipfel, Anker, Höhe, Pfadpunkte): Anzeige und Schritt übernimmt der Griff selbst. */
	const starteZusatz = useCallback(
		(e: ReactPointerEvent<HTMLElement>, element: Element, zusatz: ZusatzGriff, wo: { x: number; y: number }) => {
			if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) {
				return;
			}
			const { pfad, struktur } = aktuell.current;
			const kontext = gestaltungKontext({ doc, pfad, struktur });
			if (!kontext || kontext.element !== element) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			const l = beginne('griff', element, () => undefined);
			if (!l) {
				return;
			}
			l.zusatz = zusatz;
			l.kontext = kontext;
			const start = { x: e.clientX, y: e.clientY };
			const { skala } = aktuell.current;
			const zug = (m: PointerEvent) => {
				const d = inKasten(l.start, (m.clientX - start.x) / skala, (m.clientY - start.y) / skala);
				return { kasten: l.start, start: wo, dx: d.x, dy: d.y, umschalt: m.shiftKey, wahl: m.altKey };
			};
			folge(
				e,
				l,
				(m) => {
					zusatz.zeige(kontext, zug(m));
					zeige(l, imMaterial(m.clientX, m.clientY));
				},
				(m) => {
					beende();
					zusatz.schreibe(kontext, zug(m));
				},
			);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `folge` liest nur Refs
		[doc, beginne, beende, imMaterial, zeige],
	);

	return { stand, starteGriff, starteZusatz };
};
