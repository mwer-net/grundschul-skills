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
	istFuss,
	istUeberschrift,
	legeUm,
} from '@schoolbox/kern/src/fluss';
import { hatLoesung } from '@schoolbox/kern/src/loesungen';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { zerlege } from '@schoolbox/kern/src/quelltext';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import type { Bereich } from './bearbeitung';
import { elementZu, nrVon } from './darstellung';

/** Unterkante der Seite wie in `pruefung.js`: nach vorn erst bei mehr als 1 px Überstand, zurück nur ganz (Regel 14). */
const TOLERANZ = 1;
/** Regel 3: So viel muss sich die Unterkante bewegen, damit ein Schritt das Blatt betrifft. */
const BEWEGT = 0.5;
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

const flussKinder = (seite: Element) => [...seite.children].filter((k) => !k.matches(NICHT_IM_FLUSS));

/** Regel 3: je Seite die Zahl der Flussblöcke, die Unterkante des letzten vor dem Fuß und die Höhe des Fußes. */
const merkmalVon = (seiten: Element[]) =>
	seiten.map((s) => {
		const oben = s.getBoundingClientRect().top;
		const kinder = flussKinder(s);
		const fuss = kinder.find((k) => k.classList.contains('fuss'));
		const letzter = kinder.filter((k) => k !== fuss).at(-1);
		return [
			istAuto(s) ? 1 : 0,
			kinder.length,
			letzter ? unterkante(letzter) - oben : 0,
			fuss ? fuss.getBoundingClientRect().height : 0,
		];
	});

const gleicheMerkmale = (a: number[][], b: number[][]) =>
	a.length === b.length &&
	a.every((zeile, i) => zeile.every((wert, j) => Math.abs(wert - (b[i]?.[j] ?? Infinity)) <= BEWEGT));

/**
 * Welche Blätter der Schritt bewegt hat (Regel 3): gleiche Blätter vorn und hinten bleiben, was dazwischen anders ist,
 * zählt. So berührt ein Tippfehler auf Seite 1 kein altes Blatt auf Seite 5, auch wenn eine Seite dazukam.
 */
const betroffen = (neu: HTMLElement[][], alt: HTMLElement[][]) => {
	const a = alt.map(merkmalVon);
	const n = neu.map(merkmalVon);
	let vorn = 0;
	while (vorn < n.length && vorn < a.length && gleicheMerkmale(n[vorn] ?? [], a[vorn] ?? [])) {
		vorn += 1;
	}
	let hinten = 0;
	while (
		hinten < n.length - vorn &&
		hinten < a.length - vorn &&
		gleicheMerkmale(n[n.length - 1 - hinten] ?? [], a[a.length - 1 - hinten] ?? [])
	) {
		hinten += 1;
	}
	return new Set(neu.slice(vorn, neu.length - hinten).map((g) => g[0]));
};

/** Liegt die Änderung im Blatt oder grenzt an? Ein Tippen auf Seite 1 betrifft Blatt 1, auch wenn das Bild schon so war. */
const beruehrt = (z: Zerlegung, blatt: Blatt, { bis, von }: Bereich) => {
	const erste = z.knoten[blatt.seiten[0]?.nr ?? -1];
	const letzte = z.knoten[blatt.seiten.at(-1)?.nr ?? -1];
	return Boolean(erste && letzte && von <= letzte.ende && bis >= erste.start);
};

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

/** Hinter Kopf und Namenszeile, vor Fußzeile und Ebenen: dort stehen die Flussblöcke einer Seite. */
const ankerIn = (seite: Element) => {
	const kinder = [...seite.children];
	const vorn = kinder.findLastIndex((k) => k.matches(VORN));
	return kinder.slice(vorn + 1).find((k) => k.matches(HINTEN)) ?? null;
};

/** Eine Folgeseite nur zum Messen, wie sie der Kern anlegen würde (Regel 12). */
const probeSeite = (vorlage: HTMLElement, nach: Element) => {
	const seite = vorlage.cloneNode(false) as HTMLElement;
	seite.removeAttribute('data-sb');
	seite.setAttribute('data-weiter', 'auto');
	for (const kind of vorlage.children) {
		if (kind.matches('.loesung-marke, .fuss-zeile')) {
			const kopie = kind.cloneNode(true) as Element;
			kopie.removeAttribute('data-sb');
			kopie.querySelectorAll('[data-sb]').forEach((k) => k.removeAttribute('data-sb'));
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
const fuelle = (p: Probe, neu: HTMLElement[], bis: number[] | null) => {
	const { folge, herkunft } = p;
	const seiten: Element[][] = [];
	let s = 0;
	for (let j = 0; s < folge.length; j += 1) {
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
		m = Math.max(1, m);
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

type Fenster = Window & { zeichneAbbildungen?: () => void };

interface Optionen {
	/** Das sichtbare Bild vor dem Schritt (Regel 3); `null` mit `erzwungen`: nur die genannten Blätter. */
	alt: Document | null;
	/** Was der Schritt in der Quelle geändert hat: Das Blatt darum ist betroffen, auch wenn das Bild schon so aussah. */
	bereich?: Bereich;
	/** Diese Blätter (Nummer der ersten Seite) auf jeden Fall, z. B. „Auf nächste Seite umbrechen“ (206-05). */
	erzwungen?: readonly number[];
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
	const zuPruefen = o.erzwungen ? null : betroffen(imBild, o.alt ? blaetterImBild(o.alt) : []);
	const proben: Probe[] = [];
	for (const blatt of quellBlaetter) {
		const erste = blatt.seiten[0]?.nr;
		const seiten = imBild.find((g) => g[0] && nrVon(g[0]) === erste);
		const gewollt = o.erzwungen
			? o.erzwungen.includes(erste ?? -1)
			: (seiten && zuPruefen?.has(seiten[0])) || (o.bereich && beruehrt(z, blatt, o.bereich));
		if (!blatt.fliesst || !seiten || !gewollt || !fliesstImBild(seiten)) {
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
	const fenster = doc.defaultView as Fenster | null;
	try {
		// Zuerst das Arbeitsblatt, dann die Lösung, die nur weiterschieben darf; am Ende die Ansicht wie vorher.
		const zeigtLoesung = doc.body.classList.contains('loesung');
		const ansicht = (loesung: boolean) => {
			if (doc.body.classList.contains('loesung') !== loesung) {
				doc.body.classList.toggle('loesung', loesung);
				fenster?.zeichneAbbildungen?.();
			}
		};
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
	flussFaellig: (quelle: string) => Bereich | null;
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
	/** Das Bild, das gerade zu sehen ist (Regel 3). */
	sichtbar: RefObject<Document | null>;
}

/**
 * Für `Leinwand.vorDemZeigen`: Nach einem Schritt misst der Editor die neue Fassung im unsichtbaren Rahmen. Muss etwas
 * wandern, wird die umgelegte Fassung Teil desselben Schritts und dieses Bild nie gezeigt. Sonst gilt es wie immer.
 */
export const useFluss = (o: FlussOptionen) => {
	const aktuell = useRef(o);
	useEffect(() => {
		aktuell.current = o;
	});
	return useCallback(async (doc: Document, html: string) => {
		const { flussFaellig, zerlegungZu } = aktuell.current;
		const z = zerlegungZu(html);
		const bereich = z && flussFaellig(z.quelle);
		if (!z || !bereich) {
			return false;
		}
		const plan = await probelauf(doc, z, {
			alt: aktuell.current.sichtbar.current,
			bereich,
			mitLoesung: hatLoesung(z.quelle),
		});
		const { auswahl, fliesse, flussErledigt, nachFluss } = aktuell.current;
		// Inzwischen kam ein neuer Schritt: Dessen Bild entscheidet, dieses ist nur noch Zwischenstand.
		if (!aktuell.current.flussFaellig(z.quelle)) {
			return false;
		}
		const u = plan ? legeUm(z.quelle, plan, { jeSeite: false }) : null;
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
