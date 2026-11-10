/**
 * Fläche im Stapel (115, Briefing 3.7): ein Baustein im Fluss mit fester Höhe (`--h`), in dem Gestaltung frei liegt.
 * Sie rutscht mit den Aufgaben, weil sie selbst im Stapel steht; ihre Kinder sind Gestaltungselemente (`data-lage`)
 * in Koordinaten der Fläche. Hier stehen Anlegen, Hinein, Heraus und die Höhe als Umformungen der Quelle. Der Kern kann
 * nicht messen: Der Editor misst die Lage (wie in 106 `offsetLeft`/`offsetTop`) und übergibt Material-px.
 *
 * Nicht verwechseln: Fläche ist der Baustein `.flaeche`, nicht die Seitenfläche (`.seitenflaeche`, 095) und nicht die
 * Prüfung `flaeche`. Darum heißen die Funktionen hier `…Flaeche…`, nie nur `flaeche`.
 */

import { ANKER } from './anker';
import { fuegeBausteinAn } from './einfuegen-ablage';
import type { LageTeil } from './gestaltung';
import {
	entferneMitEbene,
	htmlMitLage,
	istGestaltung,
	legeGestaltungAb,
	neueSvgIds,
	setzeLage,
	setzeStilWerte,
} from './gestaltung';
import type { Aenderung, Knoten } from './quelltext';
import {
	einrueckung,
	fuegeInnenEin,
	klassenVon,
	quelleVon,
	rueckeUm,
	setzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';
import type { Ablage, Nummerierung, StrukturErgebnis } from './struktur';

/** Höhe einer neuen leeren Fläche in px. */
export const FLAECHE_HOEHE = 200;
/** Niedriger wird eine Fläche nicht. */
export const FLAECHE_MIN = 40;
/** Abstand zum Rand, wenn eine Fläche um ein Element entsteht (oben, unten). */
export const FLAECHE_RAND = 16;

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

const ganzeZahl = (h: number) => Math.round(Number.isFinite(h) ? h : FLAECHE_HOEHE);

/** Die Höhe, die eine Fläche mindestens braucht, damit ein Element der Höhe `h` mit Rand hineinpasst. */
export const hoeheUm = (h: number) => Math.max(FLAECHE_MIN, ganzeZahl(h) + 2 * FLAECHE_RAND);

/** HTML einer Fläche; `innen` sind ihre Kinder (Gestaltungselemente). */
export const flaecheHtml = (hoehe: number, innen = '') =>
	`<div class="flaeche" style="--h:${Math.max(FLAECHE_MIN, ganzeZahl(hoehe))}px">${innen}</div>`;

const knotenAn = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	return { z, k };
};

const gestaltungAn = (quelle: string, nr: number) => {
	const r = knotenAn(quelle, nr);
	if (!istGestaltung(r.k)) {
		throw new Error(`Das Element ${nr} ist keine Gestaltung.`);
	}
	return r;
};

const flaecheAn = (quelle: string, nr: number) => {
	const r = knotenAn(quelle, nr);
	if (!hat(r.k, 'flaeche')) {
		throw new Error(`Das Element ${nr} ist keine Fläche.`);
	}
	return r;
};

/** Ist das Element eine Fläche im Stapel? */
export const istFlaeche = (quelle: string, nr: number) => hat(zerlege(quelle).knoten[nr], 'flaeche');

/** Die Fläche, in der das Element liegt; `null` in einer Ebene oder am Anker. */
export const flaecheVon = (quelle: string, nr: number): number | null => {
	const eltern = zerlege(quelle).knoten[nr]?.eltern;
	return eltern && hat(eltern, 'flaeche') ? eltern.nr : null;
};

/**
 * Rechnet Stellen der alten Quelle in die neue um, nachdem `aenderungen` angewendet sind. Nur für Stellen, die nicht in
 * einem entfernten Bereich liegen.
 */
const verschoben = (aenderungen: Aenderung[]) => (pos: number) =>
	aenderungen.reduce((p, a) => (a.bis <= pos ? p + a.text.length - (a.bis - a.von) : p), pos);

/** Hängt `ohneAnker` den Anker ab und legt die Lage fest; die Nummern der Elemente bleiben dabei, wie sie sind. */
const vorbereitet = (quelle: string, nr: number, lage: LageTeil) => {
	const { k, z } = gestaltungAn(quelle, nr);
	const ohneAnker = wendeAn(quelle, setzeAttribut(z, k, ANKER, null));
	return setzeLage(ohneAnker, nr, lage);
};

/**
 * Das Element mit seiner Lage als HTML (ohne Anker) und die Quelle ohne das Element, samt Umrechnung der Stellen. Eine
 * dabei leer gewordene Ebene verschwindet mit.
 */
const nimmHeraus = (quelle: string, nr: number, lage: LageTeil) => {
	const q0 = vorbereitet(quelle, nr, lage);
	const { k, z } = gestaltungAn(q0, nr);
	const raus = entferneMitEbene(z, k);
	const aenderungen = [...raus];
	return {
		q0,
		z,
		html: quelleVon(z, k),
		einzug: einrueckung(z, k),
		raus: aenderungen,
		ohne: wendeAn(q0, aenderungen),
		pos: verschoben(aenderungen),
	};
};

/** Die Nummer des Knotens, der in `neu` an `start` beginnt. */
const nrAn = (neu: string, start: number) => {
	const nr = zerlege(neu).knoten.find((k) => k.start === start)?.nr;
	if (nr === undefined) {
		throw new Error('Das Element ließ sich nach dem Umbau nicht wiederfinden.');
	}
	return nr;
};

/**
 * Legt eine neue Fläche der Höhe `hoehe` an der Ablage an (`fuegeBausteinAn`, 094). Mit `element` liegt es darin: `html`
 * ohne `data-lage` und `lage` in Koordinaten der Fläche (`y` ab oben). Ergebnis ist dann das Element, sonst die Fläche.
 * Die Nummern der Aufgaben bleiben, denn eine Fläche trägt keine.
 */
export const legeFlaeche = (
	quelle: string,
	ablage: Ablage,
	hoehe: number,
	n: Nummerierung,
	element?: { html: string; lage: LageTeil },
): StrukturErgebnis => {
	const innen = element ? htmlMitLage(neueSvgIds(element.html.trim(), quelle), element.lage) : '';
	const r = fuegeBausteinAn(quelle, { id: 'flaeche', ort: 'seite', html: flaecheHtml(hoehe, innen) }, ablage, n);
	if (r.nr === null || !element) {
		return r;
	}
	return { quelle: r.quelle, nr: zerlege(r.quelle).knoten[r.nr]?.kinder[0]?.nr ?? r.nr };
};

/** Fügt `html` als letztes Kind von `flaeche` ein (ganz vorne). */
const alsLetztesKind = (
	z: ReturnType<typeof zerlege>,
	flaeche: Knoten,
	html: string,
	alt: string | null,
): Aenderung[] => {
	const letztes = flaeche.kinder.at(-1);
	const innen = letztes ? einrueckung(z, letztes) : null;
	return fuegeInnenEin(z, flaeche, 'ende', rueckeUm(html, alt, innen));
};

/**
 * Nimmt das Gestaltungselement aus seiner Ebene, vom Anker oder aus einer anderen Fläche und legt es als vorderstes Kind
 * in die Fläche `flaecheNr`. `lage` ist die linke obere Ecke in Koordinaten der Fläche; der Editor misst sie so, dass
 * das Element im Blatt stehen bleibt. Liegt es schon darin, ändert sich nur die Lage. Ein Schritt.
 */
export const inFlaeche = (
	quelle: string,
	nr: number,
	flaecheNr: number,
	lage: { x: number; y: number },
): StrukturErgebnis => {
	const { k } = gestaltungAn(quelle, nr);
	const { k: f } = flaecheAn(quelle, flaecheNr);
	if (f.start >= k.start && f.ende <= k.ende) {
		throw new Error('Ein Element lässt sich nicht in sich selbst legen.');
	}
	if (k.eltern === f) {
		return { quelle: setzeLage(quelle, nr, lage), nr };
	}
	const { einzug, html, pos, q0, raus, z } = nimmHeraus(quelle, nr, lage);
	// Dieselben Nummern wie in `quelle`: Anker und Lage ändern nur Attribute.
	const ziel = z.knoten[flaecheNr];
	if (!ziel) {
		throw new Error(`Das Element ${flaecheNr} gibt es nicht.`);
	}
	const rein = alsLetztesKind(z, ziel, html, einzug);
	const neu = wendeAn(q0, [...raus, ...rein]);
	const erste = rein[0];
	const start = erste ? pos(erste.von) + Math.max(0, erste.text.indexOf('<')) : 0;
	return { quelle: neu, nr: nrAn(neu, start) };
};

/**
 * Nimmt das Gestaltungselement aus seiner Fläche und legt es vorne auf die Seite (`.ebene.vorne`). `lage` ist die
 * linke obere Ecke in Koordinaten der Seite; `seite` (Nummer der `.seite`) ist die Zielseite, ohne Angabe die der
 * Fläche. Ein Schritt. Ein Element außerhalb einer Fläche bleibt, wie es ist.
 */
export const ausFlaeche = (
	quelle: string,
	nr: number,
	lage: { x: number; y: number },
	seite?: number,
): StrukturErgebnis => {
	const { k } = gestaltungAn(quelle, nr);
	if (!hat(k.eltern, 'flaeche')) {
		return { quelle, nr };
	}
	let s: Knoten | null = k.eltern;
	while (s && !hat(s, 'seite')) {
		s = s.eltern;
	}
	const ziel = seite === undefined ? s : zerlege(quelle).knoten[seite];
	if (!ziel || !hat(ziel, 'seite')) {
		throw new Error('Die Zielseite gibt es nicht.');
	}
	const { html, ohne, pos, z } = nimmHeraus(quelle, nr, lage);
	const start = z.knoten[ziel.nr]?.start ?? ziel.start; // gleiche Nummern wie in `quelle`
	return legeGestaltungAb(ohne, { seite: nrAn(ohne, pos(start)), ebene: 'vorne', html });
};

/**
 * Neue Fläche an der Ablage und das Element zieht um, ein Ergebnis (Briefing 5.3). Die Fläche ist `hoehe` hoch (der
 * Editor nimmt `hoeheUm`), das Element liegt bei `x` (Koordinaten der Fläche) und `FLAECHE_RAND` von oben. Gewählt
 * bleibt das Element.
 */
export const inNeueFlaeche = (
	quelle: string,
	nr: number,
	ablage: Ablage,
	n: Nummerierung,
	{ hoehe, x }: { hoehe: number; x: number },
): StrukturErgebnis => {
	const { k } = gestaltungAn(quelle, nr);
	const ablageNr = 'in' in ablage ? ablage.in : ablage.nr;
	const ziel = zerlege(quelle).knoten[ablageNr];
	if (!ziel) {
		throw new Error(`Das Element ${ablageNr} gibt es nicht.`);
	}
	if (ziel.start >= k.start && ziel.ende <= k.ende) {
		throw new Error('Dorthin lässt sich das Element nicht legen.');
	}
	const { html, ohne, pos, z } = nimmHeraus(quelle, nr, { x: Math.round(x), y: FLAECHE_RAND });
	const neuerZiel = nrAn(ohne, pos(z.knoten[ablageNr]?.start ?? ziel.start)); // gleiche Nummern wie in `quelle`
	const neueAblage: Ablage = 'in' in ablage ? { in: neuerZiel } : { nr: neuerZiel, wo: ablage.wo };
	const r = fuegeBausteinAn(ohne, { id: 'flaeche', ort: 'seite', html: flaecheHtml(hoehe, html) }, neueAblage, n);
	if (r.nr === null) {
		return r;
	}
	return { quelle: r.quelle, nr: zerlege(r.quelle).knoten[r.nr]?.kinder[0]?.nr ?? r.nr };
};

/** Setzt die Höhe der Fläche (`--h`), mindestens `FLAECHE_MIN`, ganze px. */
export const setzeFlaechenHoehe = (quelle: string, nr: number, h: number) => {
	flaecheAn(quelle, nr);
	return setzeStilWerte(quelle, nr, { '--h': `${Math.max(FLAECHE_MIN, ganzeZahl(h))}px` });
};

/** Die Höhe einer Fläche in px aus `--h`, ohne Angabe `FLAECHE_HOEHE`. */
export const leseFlaechenHoehe = (quelle: string, nr: number): number => {
	const { k } = flaecheAn(quelle, nr);
	const stil = k.attribute.find((a) => a.name === 'style')?.wert ?? '';
	const treffer = /(?:^|;)\s*--h\s*:\s*(-?[\d.]+)px/.exec(stil);
	return treffer ? Number(treffer[1]) : FLAECHE_HOEHE;
};
