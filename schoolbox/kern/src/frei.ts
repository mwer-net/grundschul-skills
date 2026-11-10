/**
 * Prüfung freier Elemente (Entscheidung 38): Claude darf im Dokument alles bauen, was statisches HTML und SVG hergibt,
 * und nichts anderes. Eine Allow-Liste, keine Verbote: Was hier nicht steht, ist ein Fund. Entfernt wird nie etwas, das
 * entscheidet der Aufrufer.
 *
 * Die Zerlegung aus `quelltext.ts` liefert nur die Grenzen der Elemente. Sie ist nachsichtig: `<svg/onload=…>` liest sie
 * ohne Attribut, und eine Entität wie `&colon;` kennt sie nicht. Darum liest diese Datei jedes Tag noch einmal nach einer
 * engen Grammatik. Was der Browser anders lesen könnte als diese Grammatik, ist selbst schon ein Fund.
 */

import { attributeVon, NUR_ZUR_LAUFZEIT, schemaVon } from './abbildungen';
import type { Knoten, Zerlegung } from './quelltext';
import { ROHTEXT, zerlege } from './quelltext';

export interface Fund {
	/** Für Claude und den Chat, ein Satz. */
	text: string;
	/** Der Vergleich mit dem Stand davor: Gleiche Stelle heißt schon da gewesen. */
	stelle: string;
}

const namen = (...teile: string[]) => new Set(teile.flatMap((t) => t.split(' ')));

const HTML_ELEMENTE = namen(
	'html head body title style',
	'div section article aside main header footer nav figure figcaption center hgroup',
	'h1 h2 h3 h4 h5 h6 p pre blockquote address hr br wbr',
	'a abbr b bdi bdo big cite code em font i kbd label mark q s small span strong strike sub sup time tt u var',
	'ruby rt rp ins del dfn samp',
	'ul ol li dl dt dd',
	'table caption colgroup col thead tbody tfoot tr th td',
	'img',
);

/** Keine Skripte und Ereignisse, kein `animate`/`set` (setzt Attribute zur Laufzeit), kein `image`/`feImage` (lädt), kein `foreignObject` (öffnet HTML). */
const SVG_ELEMENTE = namen(
	'svg g defs symbol use title desc',
	'path rect circle ellipse line polygon polyline text tspan',
	'lineargradient radialgradient stop pattern clippath mask marker',

	// Schmuckschrift im Bogen: `textpath`
	'textpath',
);

const ATTRIBUTE_ALLE = namen('class id style title lang dir role');

const HTML_ATTRIBUTE: Record<string, Set<string>> = {
	a: namen('href'),
	col: namen('span width'),
	colgroup: namen('span width'),
	font: namen('color face size'),
	img: namen('src alt width height'),
	li: namen('value'),
	ol: namen('start type reversed'),
	style: namen('media'),
	table: namen('border cellpadding cellspacing width align'),
	td: namen('colspan rowspan headers width height align valign'),
	th: namen('colspan rowspan headers scope width height align valign'),
	time: namen('datetime'),
	tr: namen('align valign'),
	ul: namen('type'),
};

const SVG_ATTRIBUTE = namen(
	'xmlns xmlns:xlink viewbox preserveaspectratio x y width height x1 y1 x2 y2 cx cy r rx ry fx fy d points',
	'transform transform-origin fill fill-opacity fill-rule stroke stroke-width stroke-dasharray stroke-dashoffset',
	'stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity opacity clip-rule clip-path mask paint-order',
	'font-family font-size font-style font-weight letter-spacing text-anchor dominant-baseline textlength lengthadjust dx dy rotate',
	'offset stop-color stop-opacity gradientunits gradienttransform spreadmethod',
	'patternunits patterncontentunits patterntransform clippathunits maskunits maskcontentunits',
	'markerwidth markerheight markerunits refx refy orient marker-start marker-mid marker-end',
	'vector-effect display visibility shape-rendering overflow',

	// Schmuckschrift im Bogen: `startoffset` u. a. (`text-anchor`, `paint-order` stehen oben schon)
	'startoffset',
);

const NUR_DURCH_USE = namen('href xlink:href');
/** Wo `href` stehen darf, immer nur als Sprung im Dokument. */
const MIT_SPRUNG = namen(
	'use',

	// Schmuckschrift im Bogen: `textpath`
	'textpath',
);
const URL_ATTRIBUTE = namen('fill stroke clip-path mask marker-start marker-mid marker-end');
const SVG_OHNE_STIL = namen('id class title lang dir role xmlns xmlns:xlink d points href xlink:href');
const SVG_NAMENSRAUM: Record<string, string> = {
	'xmlns': 'http://www.w3.org/2000/svg',
	'xmlns:xlink': 'http://www.w3.org/1999/xlink',
};

const FREI_ATTRIBUT = /^(?:aria|data)-[a-z0-9_.-]+$/;

/**
 * Eigene Eigenschaften wie `--x:96px` und `var(--haupt)` gehen durch, denn geprüft werden nur Funktionen und @-Regeln,
 * keine Liste der Eigenschaften. Die Lage der Gestaltung (Phase 12) braucht darum hier nichts Neues.
 */
const CSS_FUNKTIONEN = namen(
	'rgb rgba hsl hsla color-mix calc min max clamp var',
	'translate translatex translatey translate3d rotate rotatex rotatey scale scalex scaley skew skewx skewy matrix perspective',
	'repeat minmax fit-content linear-gradient repeating-linear-gradient radial-gradient repeating-radial-gradient conic-gradient',
	'counter counters drop-shadow blur grayscale',
	'not is where has nth-child nth-last-child nth-of-type nth-last-of-type lang',

	// Bildrahmen: Formen für `clip-path` (`path()` nicht, Briefing 4.4)
	'polygon circle ellipse inset',
);
const CSS_AT_REGELN = namen('media page');

const LEER = '[ \\t\\n\\f\\r]';
const ATTRIBUT_MUSTER = `${LEER}+[a-zA-Z_:][-\\w:.]*(?:${LEER}*=${LEER}*(?:"[^"]*"|'[^']*'|[^ \\t\\n\\f\\r"'=<>\`]+))?`;
const TAG = new RegExp(`^<[a-zA-Z][a-zA-Z0-9-]*((?:${ATTRIBUT_MUSTER})*)${LEER}*/?>$`);
const ATTRIBUT = new RegExp(
	`${LEER}+([a-zA-Z_:][-\\w:.]*)(?:${LEER}*=${LEER}*(?:"([^"]*)"|'([^']*)'|([^ \\t\\n\\f\\r"'=<>\`]+)))?`,
	'g',
);
const END_TAG = new RegExp(`^</[a-zA-Z][a-zA-Z0-9-]*${LEER}*>$`);
const DOCTYPE = new RegExp(`^<!doctype${LEER}+html${LEER}*>$`, 'i');

/** Die Sprungziele im selben Dokument, mehr kann ein `use` oder `a` nicht. */
const SPRUNG = /^#[A-Za-z][\w-]*$/;
const URL_SPRUNG = /^url\(#[A-Za-z][\w-]*\)$/;
/** Ein Pfad in der Mappe: kein Schema, kein `//`-Anfang, kein Rückstrich. */
const BILD_PFAD = /^[\p{L}\p{N}_.][\p{L}\p{N}_. %/-]*$/u;
const BILD_DATEN = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]*$/;
/** `abbildungen.js` setzt Werte in SVG-Text ein: Ein Wert darf dort nie ein Tag oder Attribut beginnen. */
const ABBILDUNG_WERT = /[<>"`]/;

const ENTITAETEN: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: String.fromCharCode(39),
	nbsp: String.fromCharCode(160),
	auml: 'ä',
	ouml: 'ö',
	uuml: 'ü',
	Auml: 'Ä',
	Ouml: 'Ö',
	Uuml: 'Ü',
	szlig: 'ß',
	ndash: '–',
	mdash: '—',
	hellip: '…',
	bdquo: '„',
	ldquo: '“',
	rdquo: '”',
	sbquo: '‚',
	lsquo: '‘',
	rsquo: '’',
	times: '×',
	divide: '÷',
	middot: '·',
	deg: '°',
	frac12: '½',
	copy: '©',
};

const zeichenAus = (roh: string) => {
	const hex = roh[1]?.toLowerCase() === 'x';
	const code = parseInt(roh.slice(hex ? 2 : 1), hex ? 16 : 10);
	// Nullzeichen, Steuerzeichen und was Unicode nicht kennt, wären schon wieder ein Sonderweg im Parser.
	return code > 0x10ffff || code < 9 || (code > 13 && code < 32) || (code >= 127 && code < 160)
		? null
		: String.fromCodePoint(code);
};

/**
 * Wie der Browser, nur enger: Bekannt sind wenige Namen und Zahlen mit Semikolon. `&colon;`, `&lpar;`, `&#106avascript`
 * wären für ihn gültig und hier unsichtbar, also ist alles andere `null` und damit ein Fund.
 */
const entschluesseleEng = (roh: string): string | null => {
	let kaputt = false;
	const wert = roh.replace(
		/&(?:(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);|[a-zA-Z0-9#])?/g,
		(ganz: string, name: string | undefined) => {
			if (ganz === '&') {
				return ganz;
			}
			const zeichen = name?.startsWith('#') ? zeichenAus(name) : ENTITAETEN[name ?? ''];
			if (zeichen === undefined || zeichen === null) {
				kaputt = true;
				return '';
			}
			return zeichen;
		},
	);
	return kaputt ? null : wert;
};

const kurz = (text: string) => (text.length > 80 ? `${text.slice(0, 80)} …` : text);

/** Probleme in CSS, je mit dem Stück, das sie auslöst. */
const stilProbleme = (css: string): { text: string; stueck: string }[] => {
	const probleme: { text: string; stueck: string }[] = [];
	if (/[\\\0<]/.test(css)) {
		probleme.push({ text: 'CSS mit Rückstrich oder „<“ lässt sich nicht prüfen', stueck: kurz(css) });
	}
	const zu = css.lastIndexOf('/*');
	if (zu !== -1 && css.indexOf('*/', zu) === -1) {
		probleme.push({ text: 'Ein CSS-Kommentar endet nicht', stueck: kurz(css) });
	}
	const klein = css.replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
	for (const [stueck, name = ''] of klein.matchAll(/@([-\w]*)/g)) {
		if (!CSS_AT_REGELN.has(name)) {
			probleme.push({ text: `Die CSS-Regel ${stueck} ist nicht erlaubt`, stueck });
		}
	}
	for (const [stueck, name = ''] of klein.matchAll(/([-\w]+)\s*\(([^)]*)\)?/g)) {
		if (!CSS_FUNKTIONEN.has(name)) {
			probleme.push({ text: `Die CSS-Funktion ${name}() ist nicht erlaubt`, stueck: kurz(stueck) });
		}
	}
	for (const [stueck] of klein.matchAll(/javascript\s*:|(?:^|[;{\s])(?:behavior|-moz-binding)\s*:/g)) {
		probleme.push({ text: `„${stueck.trim()}“ ist in CSS nicht erlaubt`, stueck: stueck.trim() });
	}
	return probleme;
};

interface Ort {
	/** Im Vergleich gilt ein Tag im SVG nicht als dasselbe wie im HTML: Dort liest der Browser es anders. */
	svg: boolean;
	tag: string;
	roh: string;
}

const attributFund = (ort: Ort, name: string, text: string): Fund => ({
	text,
	stelle: `${ort.svg ? 'svg' : 'html'}|${ort.roh}|${name}`,
});

/** Was der Wert eines erlaubten Attributs sein darf. Liefert den Grund, wenn er es nicht ist. */
const wertProblem = (ort: Ort, name: string, wert: string): string | null => {
	if (name === 'style') {
		return stilProbleme(wert)[0]?.text ?? null;
	}
	if (ort.tag === 'a' && name === 'href') {
		return SPRUNG.test(wert)
			? null
			: `Links dürfen nur innerhalb des Blatts zeigen (#…), nicht auf „${kurz(wert)}“`;
	}
	if (ort.tag === 'img' && name === 'src') {
		return BILD_PFAD.test(wert) || BILD_DATEN.test(wert)
			? null
			: `Die Bildadresse „${kurz(wert)}“ ist nicht erlaubt`;
	}
	if (NUR_DURCH_USE.has(name)) {
		return SPRUNG.test(wert)
			? null
			: `<${ort.tag}> darf nur auf #… im selben Blatt zeigen, nicht auf „${kurz(wert)}“`;
	}
	if (SVG_NAMENSRAUM[name]) {
		return wert === SVG_NAMENSRAUM[name] ? null : `${name} hat einen unbekannten Wert`;
	}
	if (ort.svg && !SVG_OHNE_STIL.has(name) && !FREI_ATTRIBUT.test(name)) {
		if (URL_ATTRIBUTE.has(name) && URL_SPRUNG.test(wert)) {
			return null;
		}
		return stilProbleme(wert)[0]?.text ?? null;
	}
	if (schemaVon(ort.tag) && ABBILDUNG_WERT.test(wert)) {
		return `Der Wert von ${name} an <${ort.tag}> darf kein <, >, " oder \` enthalten`;
	}
	return null;
};

const attributErlaubt = ({ svg, tag }: Ort, name: string) => {
	if (ATTRIBUTE_ALLE.has(name) || FREI_ATTRIBUT.test(name)) {
		return true;
	}
	if (svg) {
		return SVG_ATTRIBUTE.has(name) || (MIT_SPRUNG.has(tag) && NUR_DURCH_USE.has(name));
	}
	const schema = schemaVon(tag);
	if (schema) {
		return attributeVon(schema).includes(name) || NUR_ZUR_LAUFZEIT.includes(name);
	}
	return HTML_ATTRIBUTE[tag]?.has(name) ?? false;
};

const pruefeAttribute = (ort: Ort, teil: string): Fund[] => {
	const funde: Fund[] = [];
	for (const treffer of teil.matchAll(ATTRIBUT)) {
		const name = (treffer[1] ?? '').toLowerCase();
		if (!attributErlaubt(ort, name)) {
			funde.push(attributFund(ort, name, `Das Attribut ${name} an <${ort.tag}> ist nicht erlaubt`));
			continue;
		}
		const wert = entschluesseleEng(treffer[2] ?? treffer[3] ?? treffer[4] ?? '');
		const problem =
			wert === null
				? `Der Wert von ${name} an <${ort.tag}> enthält eine unbekannte Entität`
				: wertProblem(ort, name, wert);
		if (problem) {
			funde.push(attributFund(ort, name, problem));
		}
	}
	return funde;
};

const endetMit = (tag: string, roh: string) =>
	END_TAG.test(roh) && roh.slice(2).trim().slice(0, -1).trim().toLowerCase() === tag;

const IMMER_LEER = namen('br hr wbr img col');

const imFremden = (k: Knoten) => {
	for (let a = k.eltern; a; a = a.eltern) {
		if (a.tag === 'svg' || a.tag === 'math') {
			return true;
		}
	}
	return false;
};

const elementErlaubt = (tag: string, svg: boolean) =>
	svg ? SVG_ELEMENTE.has(tag) : HTML_ELEMENTE.has(tag) || tag === 'svg' || Boolean(schemaVon(tag));

const stilFunde = (z: Zerlegung, k: Knoten): Fund[] =>
	stilProbleme(z.quelle.slice(k.oeffnerEnde, k.schliesserStart)).map(({ stueck, text }) => ({
		text,
		stelle: `stil|${stueck}`,
	}));

const pruefeKnoten = (z: Zerlegung, k: Knoten): Fund[] => {
	const svg = imFremden(k);
	const rohtext = !svg && ROHTEXT.has(k.tag);
	const tagQuelle = z.quelle.slice(k.start, k.oeffnerEnde);
	const ort: Ort = { svg: svg || k.tag === 'svg', tag: k.tag, roh: tagQuelle };
	const stelle = `${svg ? 'svg' : 'html'}|${rohtext ? z.quelle.slice(k.start, k.ende) : tagQuelle}`;
	if (!elementErlaubt(k.tag, svg)) {
		const wo = svg ? ' im SVG' : '';
		return [{ text: `Das Element <${k.tag}>${wo} ist nicht erlaubt`, stelle }];
	}
	const tag = TAG.exec(tagQuelle);
	if (!tag) {
		return [{ text: `Das Tag ${kurz(tagQuelle)} ist nicht sauber geschrieben`, stelle }];
	}
	const funde = pruefeAttribute(ort, tag[1] ?? '');
	// Die Zerlegung schließt schon bei `</stylex>`, der Browser erst bei `</style>`: Dazwischen läge ungeprüftes CSS.
	if (rohtext && !endetMit(k.tag, z.quelle.slice(k.schliesserStart, k.ende))) {
		funde.push({ text: `<${k.tag}> endet nicht sauber`, stelle: `${stelle}|ende` });
	}
	if (k.tag === 'style' && !svg) {
		funde.push(...stilFunde(z, k));
	}
	if (svg && (k.tag === 'title' || k.tag === 'desc') && k.kinder.length > 0) {
		funde.push({ text: `<${k.tag}> im SVG darf nur Text enthalten`, stelle: `${stelle}|kinder` });
	}
	return funde;
};

/** Kommentare, Doctype und End-Tags: alles zwischen den Elementen, was die Zerlegung überspringt. */
const pruefeLuecke = (quelle: string, von: number, bis: number): Fund[] => {
	const funde: Fund[] = [];
	const fund = (roh: string, text: string) => funde.push({ text, stelle: `luecke|${roh}` });
	let pos = von;
	while (pos < bis) {
		const lt = quelle.indexOf('<', pos);
		if (lt === -1 || lt >= bis) {
			break;
		}
		const gt = quelle.indexOf('>', lt);
		const bisGt = gt === -1 ? quelle.length : gt + 1;
		if (quelle.startsWith('<!--', lt)) {
			const ende = quelle.indexOf('-->', lt + 4);
			const innen = quelle.slice(lt + 4, ende === -1 ? quelle.length : ende);
			// `<!-->` und `--!>` beenden den Kommentar für den Browser, nicht für die Zerlegung: Dahinter läge unsichtbar HTML.
			if (ende === -1 || innen.startsWith('>') || innen.startsWith('->') || innen.includes('--!>')) {
				fund(kurz(quelle.slice(lt, lt + 200)), 'Ein Kommentar ist nicht sauber geschrieben');
			}
			pos = ende === -1 ? quelle.length : ende + 3;
		} else if (quelle.startsWith('<!', lt) || quelle.startsWith('<?', lt)) {
			const roh = quelle.slice(lt, bisGt);
			if (!DOCTYPE.test(roh)) {
				fund(kurz(roh), `${kurz(roh)} ist nicht erlaubt`);
			}
			pos = bisGt;
		} else if (quelle.startsWith('</', lt)) {
			const roh = quelle.slice(lt, bisGt);
			if (!END_TAG.test(roh)) {
				fund(kurz(roh), `Das End-Tag ${kurz(roh)} ist nicht sauber geschrieben`);
			}
			pos = bisGt;
		} else {
			pos = lt + 1;
		}
	}
	return funde;
};

const zerlegeSicher = (html: string): Zerlegung | null => {
	try {
		return zerlege(html);
	} catch {
		// `&#x110000;` in einem Attribut: Die Zerlegung gibt auf. Der Editor täte es auch.
		return null;
	}
};

/** Alle Funde in `html`, Bestand eingeschlossen. Für Änderungen gilt `neueFunde`. */
export const pruefeFreiesHtml = (html: string): Fund[] => {
	const z = zerlegeSicher(html);
	if (!z) {
		return [{ text: 'Das HTML lässt sich nicht lesen', stelle: 'unlesbar' }];
	}
	const funde: Fund[] = [];
	let pos = 0;
	for (const k of z.knoten) {
		funde.push(...pruefeLuecke(html, pos, k.start), ...pruefeKnoten(z, k));
		pos = !imFremden(k) && ROHTEXT.has(k.tag) ? k.ende : k.oeffnerEnde;
	}
	funde.push(...pruefeLuecke(html, pos, html.length));
	return funde;
};

/**
 * Nur was gegenüber `alt` dazugekommen ist (Entscheidung 26): Wer an einem Blatt mit Skript einen Tippfehler behebt,
 * scheitert nicht am Skript. Gezählt wird je Stelle, also ist auch die Kopie eines alten Skripts neu.
 */
export const neueFunde = (alt: string, neu: string): Fund[] => {
	const bekannt = new Map<string, number>();
	for (const { stelle } of pruefeFreiesHtml(alt)) {
		bekannt.set(stelle, (bekannt.get(stelle) ?? 0) + 1);
	}
	return pruefeFreiesHtml(neu).filter(({ stelle }) => {
		const rest = bekannt.get(stelle) ?? 0;
		bekannt.set(stelle, rest - 1);
		return rest <= 0;
	});
};

/** Ein gewählter Teil des Blatts muss ein Element bleiben, sonst stimmt die Nummerierung der Bausteine nicht mehr. */
export const istEinElement = (html: string) => {
	const text = html.trim();
	const z = zerlegeSicher(text);
	const [k, zweite] = z?.wurzeln ?? [];
	if (!k || zweite || k.start !== 0 || k.ende !== text.length) {
		return false;
	}
	const selbst = k.oeffnerEnde === k.ende && (IMMER_LEER.has(k.tag) || text.endsWith('/>'));
	return selbst || endetMit(k.tag, text.slice(k.schliesserStart, k.ende));
};
