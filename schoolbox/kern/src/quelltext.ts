/**
 * Zerlegt material.html mit Quellpositionen, damit der Editor verlustfrei zurückschreiben kann: Jede Bearbeitung
 * ersetzt nur die betroffenen Zeichenbereiche, Kommentare, Einrückung und alles Übrige bleiben Byte für Byte. Läuft
 * im Browser wie in Node, ohne Abhängigkeiten. Die Regeln für Elemente, die ohne End-Tag enden, folgen dem
 * HTML-Standard so weit, wie Material aus den Skills sie braucht; ein Browser-Test vergleicht mit dem echten Parser.
 */

export interface Attribut {
	name: string;
	wert: string | null;
	/** Bereich des ganzen Attributs, `name="wert"`. */
	start: number;
	ende: number;
}

export interface Knoten {
	/** Position in Dokumentreihenfolge; dieselbe Zahl steht in der Darstellung als `data-sb`. */
	nr: number;
	tag: string;
	attribute: Attribut[];
	/** `<` des Start-Tags. */
	start: number;
	/** Hinter dem `>` des Start-Tags. */
	oeffnerEnde: number;
	/** `<` des End-Tags; bei leeren Elementen und ohne End-Tag gleich `ende`. */
	schliesserStart: number;
	/** Hinter dem `>` des End-Tags bzw. dort, wo das Element endet. */
	ende: number;
	eltern: Knoten | null;
	kinder: Knoten[];
}

export interface Zerlegung {
	quelle: string;
	/** Alle Elemente in Dokumentreihenfolge; `knoten[k.nr] === k`. */
	knoten: Knoten[];
	wurzeln: Knoten[];
}

export const MARKE = 'data-sb';

const LEER = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
]);
const ROHTEXT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes']);
const FREMD = new Set(['svg', 'math']);
/** Start-Tags, die ein offenes `<p>` schließen. */
const SCHLIESST_P = new Set([
	'address',
	'article',
	'aside',
	'blockquote',
	'details',
	'dialog',
	'div',
	'dl',
	'fieldset',
	'figcaption',
	'figure',
	'footer',
	'form',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'header',
	'hgroup',
	'hr',
	'main',
	'menu',
	'nav',
	'ol',
	'p',
	'pre',
	'section',
	'summary',
	'table',
	'ul',
]);
const GRENZEN = new Set(['html', 'table', 'td', 'th', 'caption', 'template', 'object', 'marquee', 'applet']);
const P_GRENZEN = new Set([...GRENZEN, 'button']);

/** Welche offenen Elemente ein neues Start-Tag schließt, und bis zu welchen Grenzen es danach sucht. */
const GESCHWISTER: Record<string, { schliesst: Set<string>; grenzen: Set<string> }> = {
	li: { schliesst: new Set(['li']), grenzen: new Set([...GRENZEN, 'ul', 'ol']) },
	dt: { schliesst: new Set(['dt', 'dd']), grenzen: new Set([...GRENZEN, 'dl']) },
	dd: { schliesst: new Set(['dt', 'dd']), grenzen: new Set([...GRENZEN, 'dl']) },
	option: { schliesst: new Set(['option']), grenzen: new Set(['select', 'datalist', 'optgroup']) },
	tr: { schliesst: new Set(['tr', 'td', 'th']), grenzen: new Set(['table', 'thead', 'tbody', 'tfoot']) },
	td: { schliesst: new Set(['td', 'th']), grenzen: new Set(['tr', 'table']) },
	th: { schliesst: new Set(['td', 'th']), grenzen: new Set(['tr', 'table']) },
	thead: { schliesst: new Set(['tbody', 'thead', 'tr', 'td', 'th']), grenzen: new Set(['table']) },
	tbody: { schliesst: new Set(['tbody', 'thead', 'tr', 'td', 'th']), grenzen: new Set(['table']) },
	tfoot: { schliesst: new Set(['tbody', 'thead', 'tr', 'td', 'th']), grenzen: new Set(['table']) },
};

const NAME = /[a-zA-Z][^\s/>]*/y;
const ATTRIBUT = /\s*([^\s"'>/=][^\s"'>/=]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/y;

const ENTITAETEN: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\u0027', nbsp: ' ' };

export const entschluessele = (text: string) =>
	text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (ganz: string, name: string) => {
		if (name.startsWith('#')) {
			const hex = name[1]?.toLowerCase() === 'x';
			return String.fromCodePoint(parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10));
		}
		return ENTITAETEN[name.toLowerCase()] ?? ganz;
	});

const leseAttribute = (quelle: string, ab: number): { attribute: Attribut[]; ende: number; selbst: boolean } => {
	const attribute: Attribut[] = [];
	let pos = ab;
	for (;;) {
		ATTRIBUT.lastIndex = pos;
		const treffer = ATTRIBUT.exec(quelle);
		if (!treffer?.[1]) {
			break;
		}
		const start = treffer.index + treffer[0].indexOf(treffer[1]);
		const roh = treffer[2] ?? treffer[3] ?? treffer[4];
		attribute.push({
			name: treffer[1].toLowerCase(),
			wert: roh === undefined ? null : entschluessele(roh),
			start,
			ende: ATTRIBUT.lastIndex,
		});
		pos = ATTRIBUT.lastIndex;
	}
	const schluss = quelle.indexOf('>', pos);
	const ende = schluss === -1 ? quelle.length : schluss + 1;
	return { attribute, ende, selbst: quelle.slice(pos, ende).trim().startsWith('/') };
};

export const zerlege = (quelle: string): Zerlegung => {
	const knoten: Knoten[] = [];
	const wurzeln: Knoten[] = [];
	const stapel: Knoten[] = [];

	const schliesse = (bis: number, pos: number, endeTag = pos) => {
		while (stapel.length > bis) {
			const k = stapel.pop();
			if (k) {
				const eigenes = stapel.length === bis;
				k.schliesserStart = pos;
				k.ende = eigenes ? endeTag : pos;
			}
		}
	};
	/** Index des obersten offenen Elements mit einem dieser Namen, wenn keine Grenze dazwischen liegt. */
	const suche = (namen: Set<string>, grenzen: Set<string>) => {
		for (let i = stapel.length - 1; i >= 0; i -= 1) {
			const tag = stapel[i]?.tag ?? '';
			if (namen.has(tag)) {
				return i;
			}
			if (grenzen.has(tag) || FREMD.has(tag)) {
				return -1;
			}
		}
		return -1;
	};
	const imFremden = () => stapel.some((k) => FREMD.has(k.tag));

	/** Kommentar, Doctype oder Verarbeitungsanweisung: Position dahinter, sonst null. */
	const ueberspringe = (lt: number) => {
		if (quelle.startsWith('<!--', lt)) {
			const schluss = quelle.indexOf('-->', lt + 4);
			return schluss === -1 ? quelle.length : schluss + 3;
		}
		if (quelle[lt + 1] === '!' || quelle[lt + 1] === '?') {
			const schluss = quelle.indexOf('>', lt);
			return schluss === -1 ? quelle.length : schluss + 1;
		}
		return null;
	};
	/** Schließt bis zum passenden offenen Element; ein Schließer ohne Gegenstück ändert nichts. */
	const schliesser = (lt: number) => {
		NAME.lastIndex = lt + 2;
		const name = NAME.exec(quelle)?.[0]?.toLowerCase();
		const schluss = quelle.indexOf('>', lt);
		const ende = schluss === -1 ? quelle.length : schluss + 1;
		const i = name ? stapel.findLastIndex((k) => k.tag === name) : -1;
		if (i >= 0) {
			schliesse(i, lt, ende);
		}
		return ende;
	};
	/** Was ein neuer Öffner stillschweigend schließt: `p` vor Blockelementen, `li` vor `li` usw. */
	const schliesseImplizit = (tag: string, lt: number) => {
		if (imFremden()) {
			return;
		}
		const i = SCHLIESST_P.has(tag) ? suche(new Set(['p']), P_GRENZEN) : -1;
		if (i >= 0) {
			schliesse(i, lt);
		}
		const regel = GESCHWISTER[tag];
		const j = regel ? suche(regel.schliesst, regel.grenzen) : -1;
		if (j >= 0) {
			schliesse(j, lt);
		}
	};
	const schliesseRohtext = (neu: Knoten) => {
		const muster = new RegExp(`</${neu.tag}`, 'gi');
		muster.lastIndex = neu.oeffnerEnde;
		const schluss = muster.exec(quelle)?.index ?? -1;
		const gt = schluss === -1 ? -1 : quelle.indexOf('>', schluss);
		neu.schliesserStart = schluss === -1 ? quelle.length : schluss;
		neu.ende = gt === -1 ? quelle.length : gt + 1;
	};

	let pos = 0;
	while (pos < quelle.length) {
		const lt = quelle.indexOf('<', pos);
		if (lt === -1) {
			break;
		}
		const danach = ueberspringe(lt);
		if (danach !== null) {
			pos = danach;
			continue;
		}
		if (quelle[lt + 1] === '/') {
			pos = schliesser(lt);
			continue;
		}
		NAME.lastIndex = lt + 1;
		const roh = NAME.exec(quelle)?.[0];
		if (!roh) {
			pos = lt + 1;
			continue;
		}
		const tag = roh.toLowerCase();
		const { attribute, ende, selbst } = leseAttribute(quelle, lt + 1 + roh.length);
		schliesseImplizit(tag, lt);
		const eltern = stapel.at(-1) ?? null;
		const neu: Knoten = {
			nr: knoten.length,
			tag,
			attribute,
			start: lt,
			oeffnerEnde: ende,
			schliesserStart: ende,
			ende,
			eltern,
			kinder: [],
		};
		knoten.push(neu);
		(eltern?.kinder ?? wurzeln).push(neu);
		pos = ende;
		if (LEER.has(tag) || (selbst && (imFremden() || FREMD.has(tag)))) {
			continue;
		}
		if (ROHTEXT.has(tag) && !imFremden()) {
			schliesseRohtext(neu);
			pos = neu.ende;
			continue;
		}
		stapel.push(neu);
	}
	schliesse(0, quelle.length);
	return { quelle, knoten, wurzeln };
};

export const attribut = (k: Knoten, name: string) => k.attribute.find((a) => a.name === name);

export const klassenVon = (k: Knoten) => attribut(k, 'class')?.wert?.split(/\s+/).filter(Boolean) ?? [];

/** Der Quelltext des Elements, mit Start- und End-Tag. */
export const quelleVon = (z: Zerlegung, k: Knoten) => z.quelle.slice(k.start, k.ende);

export const innenVon = (z: Zerlegung, k: Knoten) => z.quelle.slice(k.oeffnerEnde, k.schliesserStart);

/**
 * Setzt in jedes Start-Tag `data-sb="<nr>"`, nur für die Darstellung im Editor. Die Zahl führt vom gerendert
 * angeklickten Element zurück zum Bereich in der Quelle; gespeichert wird immer die unmarkierte Quelle.
 */
export const markiere = (z: Zerlegung): string => {
	const teile: string[] = [];
	let pos = 0;
	for (const k of z.knoten) {
		const nach = k.start + 1 + k.tag.length;
		teile.push(z.quelle.slice(pos, nach), ` ${MARKE}="${k.nr}"`);
		pos = nach;
	}
	teile.push(z.quelle.slice(pos));
	return teile.join('');
};

// ── Änderungen ──────────────────────────────────────────────────────────────

/** Ersetzt den Bereich `[von, bis)` der Quelle durch `text`. */
export interface Aenderung {
	von: number;
	bis: number;
	text: string;
}

/** Wendet Änderungen an, die sich nicht überschneiden; die Positionen beziehen sich alle auf die alte Quelle. */
export const wendeAn = (quelle: string, aenderungen: Aenderung[]): string => {
	const sortiert = [...aenderungen].sort((a, b) => b.von - a.von || b.bis - a.bis);
	let ergebnis = quelle;
	let grenze = Infinity;
	for (const { bis, text, von } of sortiert) {
		if (von < 0 || bis < von || bis > quelle.length || bis > grenze) {
			throw new Error(`Änderung ${von}–${bis} überschneidet sich oder liegt außerhalb der Quelle.`);
		}
		ergebnis = ergebnis.slice(0, von) + text + ergebnis.slice(bis);
		grenze = von;
	}
	return ergebnis;
};

const zeilenAnfang = (quelle: string, pos: number) => quelle.lastIndexOf('\n', pos - 1) + 1;

/** Steht das Element allein auf seiner Zeile(n)? Dann liefert es die Einrückung, sonst `null`. */
const einrueckung = (z: Zerlegung, k: Knoten): string | null => {
	const anfang = zeilenAnfang(z.quelle, k.start);
	const davor = z.quelle.slice(anfang, k.start);
	const danach = z.quelle.slice(k.ende).match(/^[ \t]*(\r?\n|$)/);
	return /^[ \t]*$/.test(davor) && danach ? davor : null;
};

/** Bereich des Elements; steht es allein auf seiner Zeile, mit Einrückung und Zeilenende. */
const blockBereich = (z: Zerlegung, k: Knoten) => {
	if (einrueckung(z, k) === null) {
		return { von: k.start, bis: k.ende };
	}
	const rest = z.quelle.slice(k.ende).match(/^[ \t]*(\r?\n)?/)?.[0] ?? '';
	return { von: zeilenAnfang(z.quelle, k.start), bis: k.ende + rest.length };
};

export const ersetzeInnen = (z: Zerlegung, k: Knoten, html: string): Aenderung[] => [
	{ von: k.oeffnerEnde, bis: k.schliesserStart, text: html },
];

export const entferne = (z: Zerlegung, k: Knoten): Aenderung[] => [{ ...blockBereich(z, k), text: '' }];

/** Fügt `html` vor bzw. hinter `ziel` ein, auf eigener Zeile mit dessen Einrückung, wenn `ziel` so steht. */
export const fuegeEin = (z: Zerlegung, ziel: Knoten, wo: 'vor' | 'nach', html: string): Aenderung[] => {
	const einzug = einrueckung(z, ziel);
	if (einzug === null) {
		const pos = wo === 'vor' ? ziel.start : ziel.ende;
		return [{ von: pos, bis: pos, text: html }];
	}
	const { bis, von } = blockBereich(z, ziel);
	const zeile = `${einzug}${html}\n`;
	if (wo === 'vor') {
		return [{ von, bis: von, text: zeile }];
	}
	// Endet die Quelle ohne Zeilenumbruch hinter dem Ziel, gehört er vor die neue Zeile.
	return z.quelle.slice(0, bis).endsWith('\n')
		? [{ von: bis, bis, text: zeile }]
		: [{ von: bis, bis, text: `\n${einzug}${html}` }];
};

/** Fügt `html` als letztes bzw. erstes Kind in `eltern` ein. */
export const fuegeInnenEin = (z: Zerlegung, eltern: Knoten, wo: 'anfang' | 'ende', html: string): Aenderung[] => {
	const kind = wo === 'anfang' ? eltern.kinder[0] : eltern.kinder.at(-1);
	if (kind) {
		return fuegeEin(z, kind, wo === 'anfang' ? 'vor' : 'nach', html);
	}
	const pos = wo === 'anfang' ? eltern.oeffnerEnde : eltern.schliesserStart;
	return [{ von: pos, bis: pos, text: html }];
};

export const dupliziere = (z: Zerlegung, k: Knoten): Aenderung[] => fuegeEin(z, k, 'nach', quelleVon(z, k));

/** Verschiebt `k` vor bzw. hinter `ziel`. `ziel` darf weder `k` noch darin enthalten sein. */
export const verschiebe = (z: Zerlegung, k: Knoten, ziel: Knoten, wo: 'vor' | 'nach'): Aenderung[] => {
	if (ziel.start >= k.start && ziel.ende <= k.ende) {
		throw new Error('Ein Element lässt sich nicht in sich selbst verschieben.');
	}
	const raus = entferne(z, k)[0];
	const rein = fuegeEin(z, ziel, wo, quelleVon(z, k))[0];
	if (!raus || !rein) {
		return [];
	}
	// Grenzt die Einfügestelle an den entfernten Bereich, landet sie an dessen Rand.
	const pos = rein.von > raus.von && rein.von < raus.bis ? raus.bis : rein.von;
	return [raus, { ...rein, von: pos, bis: pos }];
};

const schuetzeAttribut = (wert: string) => wert.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const schuetzeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Setzt ein Attribut, ändert seinen Wert oder entfernt es (`null`). Andere Attribute bleiben, wie sie sind. */
export const setzeAttribut = (z: Zerlegung, k: Knoten, name: string, wert: string | null): Aenderung[] => {
	const alt = attribut(k, name);
	if (wert === null) {
		if (!alt) {
			return [];
		}
		const vorher = z.quelle.slice(0, alt.start).match(/\s+$/)?.[0].length ?? 0;
		return [{ von: alt.start - vorher, bis: alt.ende, text: '' }];
	}
	const neu = `${name}="${schuetzeAttribut(wert)}"`;
	if (alt) {
		return [{ von: alt.start, bis: alt.ende, text: neu }];
	}
	const pos = k.start + 1 + k.tag.length;
	return [{ von: pos, bis: pos, text: ` ${neu}` }];
};

// ── Verlauf ─────────────────────────────────────────────────────────────────

/**
 * Der Unterschied zweier Fassungen als ein ersetzter Bereich: gleicher Anfang und gleiches Ende bleiben außen vor.
 * So bleibt jeder Schritt im Verlauf klein und lässt sich exakt umkehren, egal welcher Befehl ihn erzeugt hat.
 */
export interface Schritt {
	beschreibung: string;
	von: number;
	alt: string;
	neu: string;
}

export const unterschied = (alt: string, neu: string, beschreibung: string): Schritt | null => {
	if (alt === neu) {
		return null;
	}
	const max = Math.min(alt.length, neu.length);
	let vorne = 0;
	while (vorne < max && alt.charCodeAt(vorne) === neu.charCodeAt(vorne)) {
		vorne += 1;
	}
	let hinten = 0;
	while (
		hinten < max - vorne &&
		alt.charCodeAt(alt.length - 1 - hinten) === neu.charCodeAt(neu.length - 1 - hinten)
	) {
		hinten += 1;
	}
	return {
		beschreibung,
		von: vorne,
		alt: alt.slice(vorne, alt.length - hinten),
		neu: neu.slice(vorne, neu.length - hinten),
	};
};

export const vorwaerts = (quelle: string, s: Schritt) =>
	quelle.slice(0, s.von) + s.neu + quelle.slice(s.von + s.alt.length);

export const rueckwaerts = (quelle: string, s: Schritt) =>
	quelle.slice(0, s.von) + s.alt + quelle.slice(s.von + s.neu.length);

export interface Verlauf {
	quelle: string;
	zurueck: Schritt[];
	vor: Schritt[];
}

export const MAX_SCHRITTE = 200;

export const neuerVerlauf = (quelle: string): Verlauf => ({ quelle, zurueck: [], vor: [] });

/** Ein Befehl: neue Fassung aufnehmen. Wiederholen ist danach nicht mehr möglich. */
export const nimmAuf = (v: Verlauf, neu: string, beschreibung: string): Verlauf => {
	const schritt = unterschied(v.quelle, neu, beschreibung);
	return schritt ? { quelle: neu, zurueck: [...v.zurueck, schritt].slice(-MAX_SCHRITTE), vor: [] } : v;
};

export const macheRueckgaengig = (v: Verlauf): Verlauf => {
	const schritt = v.zurueck.at(-1);
	return schritt
		? { quelle: rueckwaerts(v.quelle, schritt), zurueck: v.zurueck.slice(0, -1), vor: [...v.vor, schritt] }
		: v;
};

export const wiederhole = (v: Verlauf): Verlauf => {
	const schritt = v.vor.at(-1);
	return schritt
		? { quelle: vorwaerts(v.quelle, schritt), zurueck: [...v.zurueck, schritt], vor: v.vor.slice(0, -1) }
		: v;
};
