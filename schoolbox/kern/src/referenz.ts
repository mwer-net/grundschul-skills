/**
 * Referenzen für „Claude fragen“ (021): Die Lehrkraft kopiert im Editor eine Zeile wie
 *
 *   Schoolbox · „Uhrzeit“ (Mathematik Kl. 2) · Wie spät ist es? · Seite 1 › Aufgabe 3 („Zeichne die Zeiger …“)
 *   [sb:2026-10-08-uhrzeit-ma-kl2/wie-spaet-ist-es#seite1/aufgabe3]
 *
 * in den Claude-Chat. Der lesbare Teil ist für sie, der Teil in eckigen Klammern für Claude: Mappe, Dokument und der
 * Weg durch die Bausteine wie in der Breadcrumb des Editors, je Schritt Art und Nummer innerhalb des umgebenden
 * Bausteins (`#loesung/…`, wenn sie in der Lösungsansicht war; ohne `#` das ganze Dokument). Die Textprobe am Ende
 * des lesbaren Teils findet das Element wieder, wenn sich die Nummern seither verschoben haben.
 *
 * Erkannt werden die Bausteine wie im Browser über die Selektoren aus `bausteine.ts`, hier ohne DOM auf der Zerlegung
 * der Quelle. Ein Browser-Test vergleicht beides (`e2e/claude.spec.ts`).
 */

import { schemaVon } from './abbildungen';
import type { Baustein } from './bausteine';
import { BAUSTEINE } from './bausteine';
import { FACH_NAME } from './namen';
import type { Knoten, Zerlegung } from './quelltext';
import { attribut, entschluessele, klassenVon } from './quelltext';
import type { Fach, Klasse } from './werte';

// ── Selektoren ohne Browser ─────────────────────────────────────────────────

interface Teil {
	tag: string | null;
	klassen: string[];
	/** `:has(> …)` */
	kind: Teil | null;
}

interface Kette {
	teile: Teil[];
	/** Zwischen `teile[i]` und `teile[i + 1]`: `>` oder Leerzeichen. */
	direkt: boolean[];
}

const TEIL = /^([a-z][a-z0-9-]*)?((?:\.[\w-]+)*)(?::has\(>\s*([^)]+)\))?$/i;

const liesTeil = (text: string): Teil => {
	const treffer = TEIL.exec(text.trim());
	if (!treffer) {
		throw new Error(`Selektor „${text}“ wird ohne Browser nicht verstanden.`);
	}
	const [, tag, klassen = '', kind] = treffer;
	return {
		tag: tag?.toLowerCase() ?? null,
		klassen: klassen.split('.').filter(Boolean),
		kind: kind ? liesTeil(kind) : null,
	};
};

/** Zerlegt an Leerzeichen und `>`, aber nicht innerhalb von `:has(…)`. */
const stueckeVon = (text: string) => {
	const stuecke: string[] = [];
	let tiefe = 0;
	let jetzt = '';
	const schliesse = () => {
		if (jetzt) {
			stuecke.push(jetzt);
		}
		jetzt = '';
	};
	for (const zeichen of text.trim()) {
		if (tiefe === 0 && (zeichen === ' ' || zeichen === '>')) {
			schliesse();
			if (zeichen === '>') {
				stuecke.push('>');
			}
		} else {
			tiefe += zeichen === '(' ? 1 : 0;
			tiefe -= zeichen === ')' ? 1 : 0;
			jetzt += zeichen;
		}
	}
	schliesse();
	return stuecke;
};

const liesKette = (text: string): Kette => {
	const stuecke = stueckeVon(text);
	const kette: Kette = { teile: [], direkt: [] };
	let direkt = false;
	for (const stueck of stuecke) {
		if (stueck === '>') {
			direkt = true;
		} else {
			if (kette.teile.length > 0) {
				kette.direkt.push(direkt);
			}
			kette.teile.push(liesTeil(stueck));
			direkt = false;
		}
	}
	return kette;
};

const zwischenspeicher = new Map<string, Kette[]>();

const ketten = (selektor: string) => {
	let liste = zwischenspeicher.get(selektor);
	if (!liste) {
		liste = selektor.split(',').map(liesKette);
		zwischenspeicher.set(selektor, liste);
	}
	return liste;
};

/** In der Lösungsansicht trägt der `<body>` die Klasse `loesung` (`darstellungsHtml`). */
const klassenMit = (k: Knoten, loesung: boolean) =>
	loesung && k.tag === 'body' ? [...klassenVon(k), 'loesung'] : klassenVon(k);

const teilPasst = (k: Knoten, teil: Teil, loesung: boolean): boolean => {
	if (teil.tag && k.tag !== teil.tag) {
		return false;
	}
	const klassen = klassenMit(k, loesung);
	if (!teil.klassen.every((c) => klassen.includes(c))) {
		return false;
	}
	const { kind } = teil;
	return !kind || k.kinder.some((c) => teilPasst(c, kind, loesung));
};

const kettePasst = (k: Knoten, kette: Kette, i: number, loesung: boolean): boolean => {
	const teil = kette.teile[i];
	if (!teil || !teilPasst(k, teil, loesung)) {
		return false;
	}
	if (i === 0) {
		return true;
	}
	if (kette.direkt[i - 1]) {
		return k.eltern !== null && kettePasst(k.eltern, kette, i - 1, loesung);
	}
	for (let e = k.eltern; e; e = e.eltern) {
		if (kettePasst(e, kette, i - 1, loesung)) {
			return true;
		}
	}
	return false;
};

/** Wie `Element.matches` für die Selektoren des Registers. */
export const passt = (k: Knoten, selektor: string, loesung: boolean) =>
	ketten(selektor).some((kette) => kettePasst(k, kette, kette.teile.length - 1, loesung));

export const bausteinVonKnoten = (k: Knoten, loesung: boolean): Baustein | undefined =>
	BAUSTEINE.find((b) => passt(k, b.selektor, loesung));

// ── Pfad und Textprobe ──────────────────────────────────────────────────────

export interface Schritt {
	/** Art aus dem Register, beim Sonderfall dessen Art (`sternchenaufgabe`). */
	art: string;
	/** Die wievielte dieser Art im umgebenden Baustein, ab 1. */
	index: number;
}

export interface PfadSchritt extends Schritt {
	nr: number;
	baustein: Baustein;
	/** Wie in der Breadcrumb: „Aufgabe 3“, „Überschrift“, „Uhr“. */
	name: string;
}

interface Treffer {
	k: Knoten;
	baustein: Baustein;
}

const trefferAb = (start: Knoten | null, loesung: boolean): Treffer | null => {
	for (let k = start; k; k = k.eltern) {
		const baustein = bausteinVonKnoten(k, loesung);
		if (baustein) {
			return { k, baustein };
		}
	}
	return null;
};

const innerhalb = (aussen: Knoten, innen: Knoten) =>
	innen !== aussen && innen.start >= aussen.start && innen.ende <= aussen.ende;

/** Wie der Editor die Art eines Elements zählt: der Sonderfall für sich, alle anderen ohne ihn. */
const artVon = (k: Knoten, baustein: Baustein, loesung: boolean) => {
	const { sonderfall } = baustein;
	return sonderfall && passt(k, sonderfall.selektor, loesung) ? sonderfall.art : baustein.art;
};

const gleicheArt = (z: Zerlegung, art: string, umgebung: Knoten | null, loesung: boolean) =>
	z.knoten.filter((k) => {
		if (umgebung && !innerhalb(umgebung, k)) {
			return false;
		}
		const baustein = bausteinVonKnoten(k, loesung);
		return baustein !== undefined && artVon(k, baustein, loesung) === art;
	});

const nameVon = ({ baustein, k }: Treffer, art: string, index: number) => {
	if (art !== baustein.art) {
		return baustein.sonderfall?.name ?? baustein.name;
	}
	if (baustein.art === 'abbildung') {
		return schemaVon(k.tag)?.name ?? baustein.name;
	}
	return baustein.zaehlen ? `${baustein.name} ${index}` : baustein.name;
};

/** Vom äußersten Baustein bis zum Element `nr`; dieselben Namen wie `pfadZu` im Editor. */
export const pfadVon = (z: Zerlegung, nr: number, loesung: boolean): PfadSchritt[] => {
	const kette: Treffer[] = [];
	for (let t = trefferAb(z.knoten[nr] ?? null, loesung); t; t = trefferAb(t.k.eltern, loesung)) {
		kette.unshift(t);
	}
	return kette.map((t, i) => {
		const art = artVon(t.k, t.baustein, loesung);
		const index = gleicheArt(z, art, kette[i - 1]?.k ?? null, loesung).indexOf(t.k) + 1;
		return { nr: t.k.nr, baustein: t.baustein, art, index, name: nameVon(t, art, index) };
	});
};

const reinerText = (html: string) =>
	entschluessele(html.replace(/<[^>]*>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();

/** Teile, die zur Probe nichts beitragen oder sich beim Umsortieren ändern. */
const OHNE = ['nr', 'niveau'];

const ausgelassen = (k: Knoten, loesung: boolean) => {
	const klassen = klassenVon(k);
	return (
		['script', 'style', 'svg', 'math'].includes(k.tag) ||
		OHNE.some((c) => klassen.includes(c)) ||
		(!loesung && klassen.includes('nur-loesung'))
	);
};

const textOhne = (z: Zerlegung, k: Knoten, loesung: boolean): string => {
	const teile: string[] = [];
	let pos = k.oeffnerEnde;
	const sammle = (eltern: Knoten) => {
		for (const kind of eltern.kinder) {
			if (ausgelassen(kind, loesung)) {
				teile.push(z.quelle.slice(pos, kind.start));
				pos = kind.ende;
			} else {
				sammle(kind);
			}
		}
	};
	sammle(k);
	teile.push(z.quelle.slice(pos, k.schliesserStart));
	return reinerText(teile.join(' '));
};

/** Der Text, an dem ein Element wiederzuerkennen ist; bei Bildern der Alternativtext, sonst der Dateiname. */
export const textVon = (z: Zerlegung, k: Knoten, loesung: boolean): string => {
	if (k.tag === 'img') {
		const alt = attribut(k, 'alt')?.wert?.trim();
		return alt || (attribut(k, 'src')?.wert ?? '').split('/').pop() || '';
	}
	return textOhne(z, k, loesung);
};

const PROBE_LAENGE = 36;
const AUSLASSUNG = ' …';

/** Anfang des Texts, an einem Wortende gekürzt. */
export const probeVon = (text: string) => {
	if (text.length <= PROBE_LAENGE + 4) {
		return text;
	}
	const ende = text.lastIndexOf(' ', PROBE_LAENGE);
	return `${text.slice(0, ende > 12 ? ende : PROBE_LAENGE).replace(/[\s,.;:–-]+$/, '')}${AUSLASSUNG}`;
};

// ── Erzeugen ────────────────────────────────────────────────────────────────

export interface Ort {
	mappe: { id: string; titel: string; fach: Fach; klasse: Klasse };
	dokument: { id: string; titel: string };
}

const klasseText = (klasse: Klasse) => (klasse === 'gemischt' ? 'jahrgangsgemischt' : `Kl. ${klasse}`);

export const maschinenteil = (mappe: string, dok: string, loesung: boolean, schritte: Schritt[] = []) => {
	const teile = [...(loesung ? ['loesung'] : []), ...schritte.map((s) => `${s.art}${s.index}`)];
	return `[sb:${mappe}/${dok}${teile.length > 0 ? `#${teile.join('/')}` : ''}]`;
};

/**
 * Die Referenz für ein Element (`nr`) oder, mit `null`, für das ganze Dokument: eine Zeile für die Lehrkraft, eine
 * für Claude.
 */
export const erzeugeReferenz = (z: Zerlegung, nr: number | null, ort: Ort, loesung: boolean) => {
	const { dokument, mappe } = ort;
	const pfad = nr === null ? [] : pfadVon(z, nr, loesung);
	const ziel = nr === null ? undefined : z.knoten[nr];
	const probe = ziel && pfad.length > 0 ? probeVon(textVon(z, ziel, loesung)) : '';
	const lesbar = [
		'Schoolbox',
		`„${mappe.titel}“ (${FACH_NAME[mappe.fach]} ${klasseText(mappe.klasse)})`,
		dokument.titel,
		...(loesung ? ['Lösung'] : []),
		...(pfad.length > 0 ? [`${pfad.map((s) => s.name).join(' › ')}${probe ? ` („${probe}“)` : ''}`] : []),
	].join(' · ');
	return `${lesbar}\n${maschinenteil(mappe.id, dokument.id, loesung, pfad)}`;
};

// ── Lesen ───────────────────────────────────────────────────────────────────

export interface Referenz {
	mappe: string;
	dok: string;
	loesung: boolean;
	schritte: Schritt[];
	/** Die Textprobe aus dem lesbaren Teil, ohne „ …“; `null`, wenn keine dabei war. */
	probe: string | null;
	/** So, wie sie im Text stand. */
	text: string;
}

const MASCHINE = /\[sb:([a-z0-9-]+)\/([a-z0-9-]+)(?:#([a-z0-9/]*))?\]/g;
const SCHRITT = /^([a-z]+)(\d+)$/;
/** Die letzte Textprobe `(„…“)` vor der Referenz, in derselben Zeile. */
const PROBE = /\(„(.*)“\)\s*$/;

const liesSchritte = (fragment: string) => {
	const teile = fragment.split('/').filter(Boolean);
	const loesung = teile[0] === 'loesung';
	const schritte = (loesung ? teile.slice(1) : teile).map((teil) => {
		const treffer = SCHRITT.exec(teil);
		return treffer?.[1] && treffer[2] ? { art: treffer[1], index: Number(treffer[2]) } : null;
	});
	return schritte.every((s) => s !== null) ? { loesung, schritte } : null;
};

const probeVor = (text: string, bis: number) => {
	const zeilen = text.slice(0, bis).split('\n');
	const zeile = zeilen.at(-1)?.trim() || zeilen.at(-2) || '';
	const probe = PROBE.exec(zeile)?.[1]?.trim();
	return probe ? probe.replace(/\s*…$/, '') : null;
};

/** Alle Referenzen in einem Text, z. B. einer Nachricht der Lehrkraft. Ungültige Pfade werden übergangen. */
export const liesReferenzen = (text: string): Referenz[] =>
	[...text.matchAll(MASCHINE)].flatMap((treffer) => {
		const [ganz, mappe = '', dok = '', fragment = ''] = treffer;
		const teile = liesSchritte(fragment);
		if (!teile) {
			return [];
		}
		const probe = teile.schritte.length > 0 ? probeVor(text, treffer.index) : null;
		return [{ mappe, dok, ...teile, probe, text: ganz }];
	});

// ── Auflösen ────────────────────────────────────────────────────────────────

/**
 * - `pfad`: Weg und Textprobe passen (oder es gab keine Probe).
 * - `verschoben`: Am alten Platz steht etwas anderes; genau ein Element derselben Art hat diesen Text.
 * - `aehnlich`: Kein Element hat den Text mehr, aber genau eins beginnt am längsten gleich (z. B. nachdem Claude
 *   die Items einer Aufgabe geändert hat und die Lehrkraft dieselbe Referenz noch einmal schickt).
 * - `nur-pfad`: Am Platz steht ein Element der Art, aber mit ganz anderem Text. Vermutlich das falsche: nachfragen.
 * - `mehrdeutig`: Mehrere Elemente kommen gleich gut in Frage, keins am alten Platz.
 * - `fehlt`: nichts gefunden.
 * - `dokument`: Die Referenz meint das ganze Dokument.
 */
export type Befund = 'pfad' | 'verschoben' | 'aehnlich' | 'nur-pfad' | 'mehrdeutig' | 'fehlt' | 'dokument';

export interface Kandidat {
	k: Knoten;
	pfad: PfadSchritt[];
	text: string;
}

export interface Aufloesung {
	befund: Befund;
	/** Das gemeinte Element; bei `mehrdeutig`, `fehlt` und `dokument` keins. */
	ziel: Kandidat | null;
	/** Bei `mehrdeutig` die Kandidaten, bei `pfad` andere Elemente mit demselben Text. */
	andere: Kandidat[];
}

const vergleichbar = (text: string) => text.toLocaleLowerCase('de').replace(/\s+/g, ' ').trim();

/** Ab so vielen gleichen Zeichen am Anfang gilt ein Text als ähnlich (höchstens die ganze Probe). */
const AEHNLICH_AB = 12;

const gleicherAnfang = (a: string, b: string) => {
	let i = 0;
	while (i < a.length && a[i] === b[i]) {
		i += 1;
	}
	return i;
};

const folge = (z: Zerlegung, ref: Referenz): Knoten | null => {
	let umgebung: Knoten | null = null;
	for (const schritt of ref.schritte) {
		const naechster: Knoten | undefined = gleicheArt(z, schritt.art, umgebung, ref.loesung)[schritt.index - 1];
		if (!naechster) {
			return null;
		}
		umgebung = naechster;
	}
	return umgebung;
};

/** Die Elemente, deren Text am längsten mit der Probe beginnt, wenn das lang genug ist. */
const aehnlichste = (texte: { k: Knoten; text: string }[], probe: string) => {
	const laengen = texte.map(({ k, text }) => ({ k, laenge: gleicherAnfang(probe, text) }));
	const beste = Math.max(0, ...laengen.map((l) => l.laenge));
	return beste >= Math.min(AEHNLICH_AB, probe.length)
		? laengen.filter((l) => l.laenge === beste).map((l) => l.k)
		: [];
};

const ohneProbe = (amPlatz: Knoten | null, kandidat: (k: Knoten) => Kandidat): Aufloesung =>
	amPlatz ? { befund: 'pfad', ziel: kandidat(amPlatz), andere: [] } : { befund: 'fehlt', ziel: null, andere: [] };

export const loeseReferenz = (z: Zerlegung, ref: Referenz): Aufloesung => {
	const { loesung } = ref;
	const kandidat = (k: Knoten): Kandidat => ({ k, pfad: pfadVon(z, k.nr, loesung), text: textVon(z, k, loesung) });
	const letzter = ref.schritte.at(-1);
	if (!letzter) {
		return { befund: 'dokument', ziel: null, andere: [] };
	}
	const amPlatz = folge(z, ref);
	const probe = ref.probe ? vergleichbar(ref.probe) : null;
	if (probe === null) {
		return ohneProbe(amPlatz, kandidat);
	}
	const texte = gleicheArt(z, letzter.art, null, loesung).map((k) => ({
		k,
		text: vergleichbar(textVon(z, k, loesung)),
	}));
	const mitText = texte.filter((t) => t.text.startsWith(probe)).map((t) => t.k);
	if (amPlatz && mitText.includes(amPlatz)) {
		return { befund: 'pfad', ziel: kandidat(amPlatz), andere: mitText.filter((k) => k !== amPlatz).map(kandidat) };
	}
	const [einziger] = mitText;
	if (einziger && mitText.length === 1) {
		return { befund: 'verschoben', ziel: kandidat(einziger), andere: [] };
	}
	const aehnlich = mitText.length > 0 ? mitText : aehnlichste(texte, probe);
	const [bester] = aehnlich;
	if (bester && aehnlich.length === 1) {
		return { befund: 'aehnlich', ziel: kandidat(bester), andere: [] };
	}
	if (aehnlich.length > 1) {
		return { befund: 'mehrdeutig', ziel: null, andere: aehnlich.map(kandidat) };
	}
	return amPlatz
		? { befund: 'nur-pfad', ziel: kandidat(amPlatz), andere: [] }
		: { befund: 'fehlt', ziel: null, andere: [] };
};

/** „Seite 1 › Aufgabe 3“ */
export const pfadText = (pfad: PfadSchritt[]) => pfad.map((s) => s.name).join(' › ');
