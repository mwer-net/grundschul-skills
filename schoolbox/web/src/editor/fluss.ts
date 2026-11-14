/**
 * Seiten laufen weiter (206), die Messung im Editor. Der Probelauf verschiebt im unsichtbaren Rahmen der neuen
 * Fassung Flussblöcke von Seite zu Seite, bis jede Seite nach Regel 6 gefüllt ist, misst bei Bedarf auch die Lösung
 * (Regel 21) und stellt das DOM danach wieder her. Heraus kommt der Plan „welcher Block auf welcher Seite“; den Umbau
 * der Quelle macht der Kern (`kern/src/fluss.ts`). Nichts davon ist je zu sehen.
 */

import type { Blatt, FlussPlan } from '@schoolbox/kern/src/fluss';
import {
	aeussereSeiten as aeussereSeitenVon,
	blaetterVon,
	blattSchluessel,
	blattZu,
	FOLGESEITE_STIL,
	geaenderteBlattPaare,
	istFuss,
	istUeberschrift,
	legeUm,
	MAX_BLAETTER,
	UEBERNOMMEN_HINTEN,
} from '@schoolbox/kern/src/fluss';
import { hatLoesung } from '@schoolbox/kern/src/loesungen';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { zerlege } from '@schoolbox/kern/src/quelltext';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { elementZu, MITLAUFEN, nrVon } from './darstellung';

/** Unterkante der Seite wie in `pruefung.js`: nach vorn erst bei mehr als 1 px Überstand, zurück nur ganz (Regel 14). */
const TOLERANZ = 1;
/** Länger wartet der Probelauf nicht auf Bilder, die noch laden. */
const BILDER_MS = 2000;
/** Höchstens so viele Umbauten folgen auf einen Schritt (Regel 29): danach wird gezeigt, was da ist. */
export const FLUSS_RUNDEN = 2;

const NICHT_IM_FLUSS = '.namenszeile, .kopf, .loesung-marke, .fuss-zeile, .ebene, [data-lage], style, script, template, link, meta, br, noscript';
const HINTEN = '.fuss-zeile, .ebene, [data-lage]';
const VORN = '.namenszeile, .kopf';
/** Was `pruefung.js` beim Überlauf nicht misst. */
const NICHT_GEMESSEN = '.karten, .loesung-marke, .fuss-zeile, [data-rand-ok], .ebene, [data-lage]';
/** Im Probelauf schrumpft nichts in der Spalte der Seite: gemessen wird die echte Höhe jedes Blocks. */
const PROBE_STIL = '.seite>*{flex-shrink:0!important}';
/** So lange Ruhe beim Tippen, dann läuft das Bild mit (206-07). */
const MITLAUFEN_MS = 150;

const aeussereSeiten = (doc: Document) =>
	[...doc.querySelectorAll<HTMLElement>('.seite:not([data-erzeugt])')].filter(
		(s) => !s.parentElement?.closest('.seite'),
	);

const istAuto = (s: Element) => s.getAttribute('data-weiter') === 'auto';

/** Regel 4 im gerenderten Blatt: Hinter keiner Seite erzeugt `abbildungen.js` Seiten. */
const fliesstImBild = (seiten: Element[]) =>
	seiten.every((s) => !s.nextElementSibling?.matches('.seite[data-erzeugt]'));

/** Die Blätter, wie sie im DOM stehen: feste Seite und die automatischen direkt dahinter. */
const blaetterImBild = (doc: Document) => {
	const gruppen: HTMLElement[][] = [];
	for (const s of aeussereSeiten(doc)) {
		const gruppe = gruppen.at(-1);
		const letzte = gruppe?.at(-1);
		if (gruppe && letzte && istAuto(s) && letzte.nextElementSibling === s) {
			gruppe.push(s);
		} else {
			gruppen.push([s]);
		}
	}
	return gruppen;
};

const grenzeVon = (seite: Element) => {
	const stil = seite.ownerDocument.defaultView?.getComputedStyle(seite);
	return seite.getBoundingClientRect().bottom - parseFloat(stil?.paddingBottom ?? '0');
};

/** Die Unterkante eines Blocks wie die Prüfung: der Block und alles Sichtbare darin. */
export const unterkante = (block: Element) => {
	let unten = -Infinity;
	const miss = (e: Element) => {
		const r = e.getBoundingClientRect();
		if (r.width > 0 && r.height > 0) {
			unten = Math.max(unten, r.bottom);
		}
	};
	miss(block);
	for (const e of block.querySelectorAll('*')) {
		if ((e.closest('svg') && e.localName !== 'svg') || e.closest(NICHT_GEMESSEN)) {
			continue;
		}
		miss(e);
	}
	return unten;
};

/** Ein Kind der Seite, das im Stapel steht und wandern darf (wie `istFlussblock` im Kern). */
export const istFlussblock = (k: Element) => !k.matches(NICHT_IM_FLUSS);

const flussKinder = (seite: Element) => [...seite.children].filter(istFlussblock);

const bilderGeladen = async (doc: Document) => {
	const offen = [...doc.images].filter((b) => !b.complete);
	if (offen.length === 0) {
		return;
	}
	const geladen = Promise.all(
		offen.map(
			(b) =>
				new Promise<void>((fertig) => {
					b.addEventListener('load', () => fertig(), { once: true });
					b.addEventListener('error', () => fertig(), { once: true });
				}),
		),
	);
	await Promise.race([geladen, new Promise((fertig) => window.setTimeout(fertig, BILDER_MS))]);
};

/** Hinter Kopf und Namenszeile, vor Fußzeile und Ebenen: dort stehen die Flussblöcke einer Seite. */
const ankerIn = (seite: Element) => {
	const kinder = [...seite.children];
	const vorn = kinder.findLastIndex((k) => k.matches(VORN));
	return kinder.slice(vorn + 1).find((k) => k.matches(HINTEN)) ?? null;
};

type Fenster = Window & { zeichneAbbildungen?: () => void };

/** Arbeitsblatt oder Lösung zeigen, wie `abbildungen.js` sie zeichnet. */
const zeigeAnsicht = (doc: Document, loesung: boolean) => {
	if (doc.body.classList.contains('loesung') !== loesung) {
		doc.body.classList.toggle('loesung', loesung);
		(doc.defaultView as Fenster | null)?.zeichneAbbildungen?.();
	}
};

/**
 * Wie die Seiten eines Blatts im Bild passen: je Seite die Blöcke, wie viele davon von vorn passen und ob der erste
 * Block der nächsten Seite noch Platz hätte. Nur im unsichtbaren Rahmen, bevor er zu sehen ist. Gleich vor und nach einem Schritt heißt: Der
 * Schritt hat an der Passung nichts geändert, auch wenn eine Seite schon vorher überstand (Nachbesserung 2).
 */
const passungVon = (seiten: Element[]) =>
	seiten
		.map((seite, j) => {
			const bloecke = flussKinder(seite);
			const grenze = grenzeVon(seite);
			let passt = 0;
			while (passt < bloecke.length && unterkante(bloecke[passt] as Element) <= grenze + TOLERANZ) {
				passt += 1;
			}
			// Ob der erste Block der nächsten Seite hier noch Platz hätte, misst der Block selbst an dieser Stelle,
			// genau wie `fuelle` (zurück nur ganz); danach steht er wieder, wo er stand.
			const naechste = seiten[j + 1];
			const naechster = naechste ? flussKinder(naechste)[0] : undefined;
			let platz = 0;
			if (naechster && passt === bloecke.length) {
				const { parentNode, nextSibling } = naechster;
				seite.insertBefore(naechster, ankerIn(seite));
				platz = unterkante(naechster) <= grenzeVon(seite) ? 1 : 0;
				parentNode?.insertBefore(naechster, nextSibling);
			}
			return `${bloecke.length}/${passt}/${platz}`;
		})
		.join(' ');

/** Die Passung jedes fließenden Blatts (Nummer der ersten Seite), im Arbeitsblatt und, wenn es eine gibt, der Lösung. */
const passungen = (doc: Document, z: Zerlegung, mitLoesung: boolean) => {
	const imBild = blaetterImBild(doc);
	const blaetter = [...blattSchluessel(z).keys()]
		.slice(0, MAX_BLAETTER)
		.flatMap((nr) => {
			const seiten = imBild.find((g) => g[0] && nrVon(g[0]) === nr);
			return seiten && fliesstImBild(seiten) ? [[nr, seiten] as const] : [];
		});
	const ergebnis = new Map<number, string>();
	if (blaetter.length === 0) {
		return ergebnis;
	}
	const stil = doc.createElement('style');
	stil.textContent = PROBE_STIL;
	doc.head.append(stil);
	const zeigtLoesung = doc.body.classList.contains('loesung');
	try {
		for (const loesung of mitLoesung ? [false, true] : [false]) {
			zeigeAnsicht(doc, loesung);
			for (const [nr, seiten] of blaetter) {
				const davor = ergebnis.get(nr);
				const jetzt = passungVon(seiten);
				ergebnis.set(nr, davor === undefined ? jetzt : `${davor} | ${jetzt}`);
			}
		}
	} finally {
		zeigeAnsicht(doc, zeigtLoesung);
		stil.remove();
	}
	return ergebnis;
};

/** Ein Blatt im Probelauf: seine Blöcke im DOM, die Seiten und woher jeder Block kommt. */
interface Probe {
	blatt: Blatt;
	folge: Element[];
	seiten: HTMLElement[];
	/** Auf welcher Seite des Blatts der Block in der Fassung stand. */
	herkunft: Map<Element, number>;
	ueberschrift: Set<Element>;
	fuss: Element | null;
}


const ohneMarke = (k: Element) => {
	const kopie = k.cloneNode(true) as Element;
	kopie.removeAttribute('data-sb');
	kopie.querySelectorAll('[data-sb]').forEach((c) => c.removeAttribute('data-sb'));
	return kopie;
};

/**
 * Eine Folgeseite zum Messen und für das Mitlaufen beim Tippen, wie sie der Kern anlegt (`automatischeSeite`,
 * Regel 12): Lösung-Marke, Fußzeile und aus der hinteren Ebene Seitenfläche und Seitenrahmen, kein Kopfband.
 */
const probeSeite = (vorlage: HTMLElement, nach: Element) => {
	const seite = vorlage.ownerDocument.createElement(vorlage.localName);
	seite.className = 'seite';
	seite.setAttribute('data-weiter', 'auto');
	const regel = vorlage.ownerDocument.createElement('style');
	regel.textContent = FOLGESEITE_STIL;
	seite.append(regel);
	const kinder = [...vorlage.children];
	seite.append(...kinder.filter((k) => k.matches('.loesung-marke, .fuss-zeile')).map(ohneMarke));
	for (const ebene of kinder.filter((k) => k.matches('.ebene.hinten'))) {
		const teile = [...ebene.children].filter((c) => UEBERNOMMEN_HINTEN.some((name) => c.classList.contains(name)));
		if (teile.length > 0) {
			const kopie = ebene.cloneNode(false) as Element;
			kopie.removeAttribute('data-sb');
			kopie.append(...teile.map(ohneMarke));
			seite.append(kopie);
		}
	}
	nach.after(seite);
	return seite;
};

/**
 * Regel 6 bis 9 für ein Blatt: Jede Seite nimmt von vorn so viele Blöcke auf, wie passen, mindestens einen. Eine
 * Überschrift steht nie als Letztes, der Fuß nie allein. `bis` (Lösung, Regel 21): Seite `j` endet höchstens dort,
 * wo sie im Arbeitsblatt endete; so wird nur weitergeschoben, nie zurückgeholt.
 */
const fuelle = (p: Probe, neu: HTMLElement[], bis: number[] | null, ab = { block: 0, seite: 0, besetzt: false }) => {
	const { folge, herkunft } = p;
	const seiten: Element[][] = [];
	let s = ab.block;
	for (let j = ab.seite; s < folge.length; j += 1) {
		let seite = p.seiten[j] ?? neu[j - p.seiten.length];
		if (!seite) {
			const vorher = p.seiten[j - 1] ?? neu.at(-1) ?? p.seiten[0];
			seite = probeSeite(p.seiten[0] as HTMLElement, vorher as Element);
			neu.push(seite);
		}
		const anker = ankerIn(seite);
		for (const block of folge.slice(s)) {
			seite.insertBefore(block, anker);
		}
		const grenze = grenzeVon(seite);
		let m = 0;
		while (s + m < folge.length) {
			const block = folge[s + m] as Element;
			const zugabe = (herkunft.get(block) ?? 0) <= j ? TOLERANZ : 0;
			if (unterkante(block) > grenze + zugabe) {
				break;
			}
			m += 1;
		}
		const deckel = bis?.[j];
		if (deckel !== undefined) {
			m = Math.min(m, deckel - s);
		}
		// Auf der Seite, auf der getippt wird (206-07), stehen schon Blöcke: Dort darf keiner mehr dazukommen.
		m = Math.max(j === ab.seite && ab.besetzt ? 0 : 1, m);
		if (s + m < folge.length) {
			// Regel 8: Der Fuß steht nie allein, er nimmt den Block davor mit.
			if (s + m === folge.length - 1 && folge.at(-1) === p.fuss && m > 1) {
				m -= 1;
			}
			// Regel 7: Eine Überschrift geht mit dem Block danach.
			while (m > 1 && p.ueberschrift.has(folge[s + m - 1] as Element)) {
				m -= 1;
			}
		}
		seiten.push(folge.slice(s, s + m));
		s += m;
	}
	return seiten;
};

const endenVon = (seiten: Element[][]) => {
	let summe = 0;
	return seiten.map((s) => (summe += s.length));
};

const probeFuer = (doc: Document, z: Zerlegung, blatt: Blatt, seiten: HTMLElement[]): Probe | null => {
	const folge = blatt.folge.map((nr) => elementZu(doc, nr));
	if (folge.some((e) => e === null) || seiten.length !== blatt.seiten.length) {
		return null;
	}
	const bloecke = folge as Element[];
	const herkunft = new Map(bloecke.map((b) => [b, seiten.findIndex((s) => s === b.parentElement)]));
	return {
		blatt,
		folge: bloecke,
		seiten,
		herkunft,
		ueberschrift: new Set(bloecke.filter((_, i) => istUeberschrift(z.knoten[blatt.folge[i] ?? -1]))),
		fuss: blatt.fuss !== null && istFuss(z.knoten[blatt.fuss]) ? elementZu(doc, blatt.fuss) : null,
	};
};

interface Optionen {
	/** Diese Blätter (Nummer der ersten Seite), z. B. aus `geaenderteBlaetter` oder „Auf nächste Seite umbrechen“. */
	blaetter: readonly number[];
	/** Das Dokument hat Lösungen: Die andere Fassung wird mitgemessen (Regel 21). */
	mitLoesung: boolean;
}

/**
 * Der Probelauf (Regel 28): verschiebt im DOM von `doc`, misst und stellt alles wieder her. `null`, wenn nichts
 * zu messen ist. Zwischen dem Warten auf Bilder und dem Ende läuft alles in einem Zug, ein Bild dazwischen gibt es nie.
 */
export const probelauf = async (doc: Document, z: Zerlegung, o: Optionen): Promise<FlussPlan | null> => {
	const imBild = blaetterImBild(doc);
	const quellBlaetter = blaetterVon(z);
	const proben: Probe[] = [];
	for (const blatt of quellBlaetter) {
		const erste = blatt.seiten[0]?.nr;
		const seiten = imBild.find((g) => g[0] && nrVon(g[0]) === erste);
		if (!blatt.fliesst || !seiten || !o.blaetter.includes(erste ?? -1) || !fliesstImBild(seiten)) {
			continue;
		}
		const probe = probeFuer(doc, z, blatt, seiten);
		if (probe) {
			proben.push(probe);
		}
	}
	if (proben.length === 0) {
		return null;
	}
	await bilderGeladen(doc);
	// Ab hier ohne Pause bis zum Wiederherstellen.
	const stil = doc.createElement('style');
	stil.textContent = PROBE_STIL;
	doc.head.append(stil);
	const vorher = new Map(proben.flatMap((p) => p.seiten.map((s) => [s, [...s.childNodes]] as const)));
	const neu = new Map(proben.map((p) => [p, [] as HTMLElement[]]));
	try {
		// Zuerst das Arbeitsblatt, dann die Lösung, die nur weiterschieben darf; am Ende die Ansicht wie vorher.
		const zeigtLoesung = doc.body.classList.contains('loesung');
		const ansicht = (loesung: boolean) => zeigeAnsicht(doc, loesung);
		let ergebnis: Element[][][];
		try {
			ansicht(false);
			ergebnis = proben.map((p) => fuelle(p, neu.get(p) ?? [], null));
			if (o.mitLoesung) {
				ansicht(true);
				const arbeitsblatt = ergebnis;
				ergebnis = proben.map((p, i) => fuelle(p, neu.get(p) ?? [], endenVon(arbeitsblatt[i] ?? [])));
			}
		} finally {
			ansicht(zeigtLoesung);
		}
		const plan: FlussPlan = proben.map((p, i) => ({
			blatt: p.blatt.seiten[0]?.nr ?? -1,
			seiten: (ergebnis[i] ?? []).map((s) => s.map((e) => nrVon(e) ?? -1)),
		}));
		// Ob sich die Quelle ändert, entscheidet der Kern (`legeUm` lässt Blätter, die schon so liegen).
		return plan;
	} finally {
		for (const [seite, kinder] of vorher) {
			seite.replaceChildren(...kinder);
		}
		for (const seiten of neu.values()) {
			seiten.forEach((s) => s.remove());
		}
		stil.remove();
	}
};

/** Der Flussblock, in dem `el` steht: das Kind einer äußeren Seite. */
const flussblockVon = (el: Element) => {
	const body = el.ownerDocument.body;
	let block: Element = el;
	const istSeite = (e: Element) => e.matches('.seite') && e.parentElement === body;
	while (block.parentElement && !istSeite(block.parentElement)) {
		block = block.parentElement;
	}
	return block.parentElement ? block : null;
};

/**
 * 206-07: Regel 6 im sichtbaren Bild, während getippt wird. Die Quelle bleibt; es wandern die Blöcke hinter dem
 * getippten Block. Passt er selbst nicht mehr und steht er nicht oben auf seiner Seite, wandert er mit (N04); die
 * Schreibmarke stellt `useMitlaufen` wieder her. Gemessen wird nur die gezeigte Fassung. Zurück kommt, was alles wieder
 * hinstellt; `null`, wenn nichts zu tun ist.
 */
export const laufeMit = (doc: Document, z: Zerlegung, getippt: Element): (() => void) | null => {
	const block = flussblockVon(getippt);
	const nr = block && nrVon(block);
	const blatt = nr === null || nr === undefined ? null : blattZu(z, nr);
	const seiten = blatt && blaetterImBild(doc).find((g) => g[0] && nrVon(g[0]) === blatt.seiten[0]?.nr);
	const p = blatt?.fliesst && seiten && fliesstImBild(seiten) ? probeFuer(doc, z, blatt, seiten) : null;
	const t = p && block ? p.folge.indexOf(block) : -1;
	if (!p || !block || t < 0) {
		return null;
	}
	const stil = doc.createElement('style');
	stil.textContent = PROBE_STIL;
	doc.head.append(stil);
	const seite = p.herkunft.get(block) ?? 0;
	const obenAuf = flussKinder(block.parentElement as Element)[0] === block;
	const passt = obenAuf || unterkante(block) <= grenzeVon(block.parentElement as Element) + TOLERANZ;
	const ab = passt ? { block: t + 1, seite, besetzt: true } : { block: t, seite: seite + 1, besetzt: false };
	const stellen = p.folge.slice(ab.block).map((b) => [b, b.parentNode, b.nextSibling] as const);
	const neu: HTMLElement[] = [];
	try {
		if (ab.block < p.folge.length) {
			fuelle(p, neu, null, ab);
		}
	} finally {
		stil.remove();
	}
	return () => {
		for (const [b, eltern, danach] of [...stellen].reverse()) {
			eltern?.insertBefore(b, danach);
		}
		neu.forEach((s) => s.remove());
	};
};

interface Marke {
	aktiv: Element | null;
	stellen: [Node, number, Node, number] | null;
}

/** Fokus und Schreibmarke merken: Wandert der getippte Block, nimmt ihm der Browser beides. */
const merke = (doc: Document): Marke => {
	const auswahl = doc.getSelection();
	const r = auswahl && auswahl.rangeCount > 0 ? auswahl.getRangeAt(0) : null;
	return {
		aktiv: doc.activeElement,
		stellen: r ? [r.startContainer, r.startOffset, r.endContainer, r.endOffset] : null,
	};
};

const stelleHer = (doc: Document, { aktiv, stellen }: Marke) => {
	if (aktiv instanceof HTMLElement && doc.activeElement !== aktiv) {
		aktiv.focus({ preventScroll: true });
	}
	const auswahl = doc.getSelection();
	if (!auswahl || !stellen) {
		return;
	}
	const [start, von, ende, bis] = stellen;
	const r = doc.createRange();
	r.setStart(start, von);
	r.setEnd(ende, bis);
	const alt = auswahl.rangeCount > 0 ? auswahl.getRangeAt(0) : null;
	const gleich =
		alt &&
		alt.compareBoundaryPoints(Range.START_TO_START, r) === 0 &&
		alt.compareBoundaryPoints(Range.END_TO_END, r) === 0;
	if (!gleich) {
		auswahl.removeAllRanges();
		auswahl.addRange(r);
	}
	// Die Schreibmarke bleibt im Blick, auch wenn ihr Block auf die nächste Seite ging.
	const bei = start instanceof Element ? start : start.parentElement;
	bei?.scrollIntoView({ block: 'nearest' });
};

/**
 * 206-07: Nach jeder Tipp-Pause läuft das Bild mit (`laufeMit`). Endet das Tippen ohne Änderung (Esc), steht alles
 * wieder wie vorher; mit Änderung bleibt das Bild, bis der echte Fluss (206-02) die neue Fassung zeigt.
 */
export const useMitlaufen = ({
	doc,
	zerlegung,
	auswahl,
	nachher,
	halte,
}: {
	doc: Document | null;
	zerlegung: Zerlegung | null;
	auswahl: number | null;
	/** Wenn sich die Seiten im Bild geändert haben, z. B. für die Live-Prüfung und die Seitenzahl. */
	nachher: () => void;
	/** Hält die Textsitzung, solange der getippte Block wandert (sonst endete sie mit dem Fokus). */
	halte: (an: boolean) => void;
}) => {
	const stand = useRef({ doc, zerlegung, auswahl, nachher, halte });
	useEffect(() => {
		stand.current = { doc, zerlegung, auswahl, nachher, halte };
	});
	const uhr = useRef<number | undefined>(undefined);
	const zurueck = useRef<(() => void) | null>(null);
	/** Der Inhalt des getippten Blocks beim letzten Mitlaufen: Nur die Schreibmarke bewegt, dann bleibt das Bild. */
	const zuletzt = useRef<string | null>(null);
	const raeume = useCallback(() => {
		zurueck.current?.();
		zurueck.current = null;
		zuletzt.current = null;
	}, []);
	useEffect(() => () => window.clearTimeout(uhr.current), []);
	// Ein neues Bild hat die Vorschau nicht mehr.
	useEffect(() => {
		zurueck.current = null;
		zuletzt.current = null;
	}, [doc]);
	const getippt = useCallback(() => {
		if (!MITLAUFEN) {
			return;
		}
		window.clearTimeout(uhr.current);
		uhr.current = window.setTimeout(() => {
			const { doc: d, zerlegung: z, auswahl: nr } = stand.current;
			const el = d && z && nr !== null ? elementZu(d, nr) : null;
			const block = el && flussblockVon(el);
			if (!d || !z || !el || !block || block.innerHTML === zuletzt.current) {
				return;
			}
			const seitenVorher = d.querySelectorAll('body > .seite').length;
			const marke = merke(d);
			// Zurück und neu in einem Zug: Dazwischen gibt es kein Bild.
			stand.current.halte(true);
			try {
				raeume();
				zurueck.current = laufeMit(d, z, el);
				zuletzt.current = block.innerHTML;
				stelleHer(d, marke);
			} finally {
				stand.current.halte(false);
			}
			if (d.querySelectorAll('body > .seite').length !== seitenVorher) {
				stand.current.nachher();
			}
		}, MITLAUFEN_MS);
	}, [raeume]);
	const beendet = useCallback(
		(geaendert: boolean) => {
			window.clearTimeout(uhr.current);
			if (geaendert) {
				zurueck.current = null;
				zuletzt.current = null;
			} else if (zurueck.current) {
				raeume();
				stand.current.nachher();
			}
		},
		[raeume],
	);
	return { getippt, beendet };
};

/** Fließt die Seite (1-basiert wie in der Prüfung)? Dann regelt der Fluss den Überstand, nicht der Satz im Reiter. */
export const seiteFliesst = (doc: Document, z: Zerlegung, seitenNr: number) => {
	const seite = [...doc.querySelectorAll('.seite')].filter((s) => !s.parentElement?.closest('.seite'))[
		seitenNr - 1
	];
	const nr = seite ? nrVon(seite) : null;
	if (nr === null || !seite) {
		return false;
	}
	const blatt = blaetterVon(z).find((b) => b.seiten.some((s) => s.nr === nr));
	const gruppe = blaetterImBild(doc).find((g) => g.includes(seite as HTMLElement));
	return Boolean(blatt?.fliesst && gruppe && fliesstImBild(gruppe));
};

/** Folgt auf die Seite eine automatische Seite? Dann ist der freie Platz unten gewollt (206-05, „Platz frei“). */
export const folgtAutomatische = (doc: Document, seitenNr: number) => {
	const seite = [...doc.querySelectorAll('.seite')].filter((s) => !s.parentElement?.closest('.seite'))[
		seitenNr - 1
	];
	const naechste = seite?.nextElementSibling;
	return Boolean(naechste && naechste.matches('.seite') && istAuto(naechste));
};

/** Die Nummer der ersten Seite des Blatts, zu dem die Seite (1-basiert) gehört. */
export const blattDerSeite = (doc: Document, seitenNr: number) => {
	const seite = [...doc.querySelectorAll('.seite')].filter((s) => !s.parentElement?.closest('.seite'))[
		seitenNr - 1
	];
	const gruppe = blaetterImBild(doc).find((g) => g.includes(seite as HTMLElement));
	const erste = gruppe?.[0];
	return erste ? nrVon(erste) : null;
};

/** Die wievielte Seite des Dokuments das Element trägt; `-1` außerhalb jeder Seite. */
const seiteIn = (z: Zerlegung, nr: number | null) => {
	if (nr === null) {
		return -1;
	}
	const seiten = aeussereSeitenVon(z);
	for (let k = z.knoten[nr] ?? null; k; k = k.eltern) {
		const i = seiten.indexOf(k);
		if (i >= 0) {
			return i;
		}
	}
	return -1;
};

interface FlussOptionen {
	flussFaellig: (quelle: string) => { vorher: string | null } | null;
	flussErledigt: () => void;
	fliesse: (neu: string) => void;
	zerlegungZu: (html: string) => Zerlegung | null;
	nachFluss: (
		alt: string,
		neu: string,
		nummer: (nr: number) => number | null,
		gewaehlt: number | null,
		springen: boolean,
	) => void;
	auswahl: RefObject<number | null>;
}

/** So viele Fassungen merkt sich der Editor die Passung ihrer Blätter. */
const GEMERKT = 400;
/** Zwei gleiche Blätter, die verschieden passen: Davon weiß der Editor nichts. */
const UNKLAR = '?';

/**
 * Regel 3 und Nachbesserung 2: die Blätter, die der Schritt geändert hat und deren Passung (`passungVon`) er dabei
 * geändert hat. Ohne Fassung davor alle fließenden (höchstens `MAX_BLAETTER`); ist die Passung davor unbekannt,
 * zählt das Blatt wie geändert.
 */
const welcheBlaetter = (z: Zerlegung, vorher: string | null, jetzt: Map<number, string>, gemerkt: Map<string, string>) =>
	vorher === null
		? blaetterVon(z)
				.filter((b) => b.fliesst)
				.slice(0, MAX_BLAETTER)
				.map((b) => b.seiten[0]?.nr ?? -1)
		: geaenderteBlattPaare(vorher, z)
				.filter((p) => {
					const davor = p.vorher === null ? undefined : gemerkt.get(p.vorher);
					return davor === undefined || davor === UNKLAR || davor !== jetzt.get(p.nr);
				})
				.map((p) => p.nr);

/** Merkt sich die Passung der Blätter dieser Fassung, unter dem Schlüssel des Blatts (`blattSchluessel`). */
const merkePassung = (gemerkt: Map<string, string>, z: Zerlegung, jetzt: Map<number, string>) => {
	const hier = new Map<string, string>();
	for (const [nr, schluessel] of blattSchluessel(z)) {
		const passung = jetzt.get(nr);
		if (passung !== undefined) {
			const schon = hier.get(schluessel);
			hier.set(schluessel, schon === undefined || schon === passung ? passung : UNKLAR);
		}
	}
	for (const [schluessel, passung] of hier) {
		gemerkt.delete(schluessel);
		gemerkt.set(schluessel, passung);
	}
	for (const alt of gemerkt.keys()) {
		if (gemerkt.size <= GEMERKT) {
			break;
		}
		gemerkt.delete(alt);
	}
};

/**
 * Für `Leinwand.vorDemZeigen`: Nach einem Schritt misst der Editor die neue Fassung im unsichtbaren Rahmen. Muss etwas
 * wandern, wird die umgelegte Fassung Teil desselben Schritts und dieses Bild nie gezeigt. Sonst gilt es wie immer.
 */
export const useFluss = (o: FlussOptionen) => {
	const aktuell = useRef(o);
	useEffect(() => {
		aktuell.current = o;
	});
	const gemerkt = useRef(new Map<string, string>());
	return useCallback(async (doc: Document, html: string) => {
		const { flussFaellig, zerlegungZu } = aktuell.current;
		const z = zerlegungZu(html);
		if (!z) {
			return false;
		}
		// Jede Fassung, die der Editor zeigt, misst er einmal, auch beim Öffnen: Daran sieht der nächste Schritt, was
		// er an der Passung geändert hat. Was dabei kurz wandert, steht danach wieder, wo es stand.
		const mitLoesung = hatLoesung(z.quelle);
		const jetzt = passungen(doc, z, mitLoesung);
		const faellig = flussFaellig(z.quelle);
		const blaetter = faellig ? welcheBlaetter(z, faellig.vorher, jetzt, gemerkt.current) : [];
		merkePassung(gemerkt.current, z, jetzt);
		if (!faellig) {
			return false;
		}
		const plan = blaetter.length === 0 ? null : await probelauf(doc, z, { blaetter, mitLoesung });
		const { auswahl, fliesse, flussErledigt, nachFluss } = aktuell.current;
		// Inzwischen kam ein neuer Schritt: Dessen Bild entscheidet, dieses ist nur noch Zwischenstand.
		if (!aktuell.current.flussFaellig(z.quelle)) {
			return false;
		}
		const u = plan ? legeUm(z.quelle, plan) : null;
		if (!u || u.quelle === z.quelle) {
			flussErledigt();
			return false;
		}
		const gewaehlt = auswahl.current;
		const neu = zerlege(u.quelle);
		const nachher = gewaehlt === null ? null : u.nummer(gewaehlt);
		nachFluss(z.quelle, u.quelle, u.nummer, gewaehlt, seiteIn(z, gewaehlt) !== seiteIn(neu, nachher));
		fliesse(u.quelle);
		return true;
	}, []);
};
