/**
 * Der Auszug eines Materials (252): Text, Aufgaben, Anweisungen und Lösungen von `material.html` als kurzes Markdown,
 * ohne Markup, Stile und Zeichnungen. Spätere Läufe der Einheit (Hinweise, Schlusslauf) lesen ihn statt des HTML.
 * Dieselbe Zerlegung wie der Editor (`quelltext.ts`), damit Seiten und Aufgaben gleich zählen.
 */

import type { Knoten, Zerlegung } from './quelltext';
import { attribut, entschluessele, klassenVon, ROHTEXT, zerlege } from './quelltext';

export const AUSZUG_DATEI = 'auszug.md';

const BLOCK = new Set([
	'article',
	'aside',
	'blockquote',
	'div',
	'figcaption',
	'figure',
	'footer',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'header',
	'li',
	'main',
	'nav',
	'ol',
	'p',
	'section',
	'table',
	'tbody',
	'tfoot',
	'thead',
	'tr',
	'ul',
]);

/** Was nur gedruckt Sinn hat oder der Server setzt: Name, Datum, Fußzeile, Lösungsmarke. */
const WEG = new Set(['namenszeile', 'fuss-zeile', 'loesung-marke']);

/** Attribute eines `x-…`-Elements, die nur das Aussehen steuern. */
const OHNE_INHALT = new Set(['class', 'style', 'id', 'width', 'height']);

const hat = (k: Knoten, klasse: string) => klassenVon(k).includes(klasse);

const text = (roh: string) => entschluessele(roh.replace(/<!--[\s\S]*?-->/g, ' '));

/** Der Text zwischen den Kindern eines Elements und die Kinder selbst, in Reihenfolge. */
const teile = (z: Zerlegung, k: Knoten, kind: (c: Knoten) => string) => {
	if (ROHTEXT.has(k.tag)) {
		return '';
	}
	let pos = k.oeffnerEnde;
	let aus = '';
	for (const c of k.kinder) {
		aus += text(z.quelle.slice(pos, c.start)) + kind(c);
		pos = c.ende;
	}
	return aus + text(z.quelle.slice(pos, k.schliesserStart));
};

const zeile = (t: string) => t.replace(/[\s\u00a0]+/g, ' ').trim();

/** Die Schrift einer Zeichnung: `<text>` und `<tspan>`, getrennt nach Arbeitsblatt und Lösung. */
const svgSchrift = (z: Zerlegung, k: Knoten, loesung: boolean, aus: { blatt: string[]; loesung: string[] }) => {
	const nurLoesung = loesung || hat(k, 'nur-loesung');
	if (k.tag === 'text' || k.tag === 'tspan') {
		const t = zeile(teile(z, k, () => ' '));
		if (t) {
			(nurLoesung ? aus.loesung : aus.blatt).push(t);
		}
	}
	for (const c of k.kinder) {
		svgSchrift(z, c, nurLoesung, aus);
	}
};

const abbildung = (z: Zerlegung, k: Knoten) => {
	if (attribut(k, 'aria-hidden')?.wert === 'true') {
		return '';
	}
	const titelKind = k.kinder.find((c) => c.tag === 'title');
	const titelText = titelKind ? text(z.quelle.slice(titelKind.oeffnerEnde, titelKind.schliesserStart)) : '';
	const titel = zeile(attribut(k, 'data-frei-titel')?.wert ?? attribut(k, 'aria-label')?.wert ?? titelText);
	const schrift = { blatt: [] as string[], loesung: [] as string[] };
	svgSchrift(z, k, false, schrift);
	const teil = [
		titel || 'Zeichnung',
		schrift.blatt.length ? `Text: ${schrift.blatt.join(' ')}` : '',
		schrift.loesung.length ? `Lösung: ${schrift.loesung.join(' ')}` : '',
		!schrift.loesung.length && z.knoten.some((c) => c.start > k.start && c.ende <= k.ende && hat(c, 'nur-loesung'))
			? 'Lösung in der Zeichnung'
			: '',
	].filter(Boolean);
	return ` [Abbildung: ${teil.join('; ')}] `;
};

/** Eine Leerzeile im Auszug; `zeilen` entfernt sonst jede leere Zeile. */
const ABSATZ = '\u0001';

const fehltImAuszug = (k: Knoten, klassen: string[]) =>
	k.tag === 'head' ||
	ROHTEXT.has(k.tag) ||
	k.tag === 'template' ||
	attribut(k, 'data-aus') !== undefined ||
	klassen.some((c) => WEG.has(c));

/** Zeichnung, Bild, Umbruch und Eingabefeld stehen für sich; sonst `null`. */
const fuerSich = (z: Zerlegung, k: Knoten): string | null => {
	if (k.tag === 'svg') {
		return abbildung(z, k);
	}
	if (k.tag === 'img') {
		const alt = zeile(attribut(k, 'alt')?.wert ?? '');
		return ` [Bild ${attribut(k, 'src')?.wert ?? ''}${alt ? `: ${alt}` : ''}] `;
	}
	if (k.tag === 'br') {
		return '\n';
	}
	if (k.tag === 'input') {
		return attribut(k, 'type')?.wert === 'checkbox' ? ' [ ] ' : ' [___] ';
	}
	return null;
};

const xElement = (k: Knoten, innen: string) => {
	const angaben = k.attribute
		.filter((a) => !OHNE_INHALT.has(a.name))
		.map((a) => (a.wert === null ? a.name : `${a.name}="${zeile(a.wert)}"`));
	const rest = zeile(innen);
	return ` [${k.tag}${angaben.length ? ` ${angaben.join(' ')}` : ''}${rest ? `: ${rest}` : ''}] `;
};

/** `data-l` als Lösung, `.nur-loesung` und `.nicht-loesung` als Hinweis, auf welchem Blatt der Inhalt steht. */
const mitLoesung = (innen: string, l: string | null | undefined, klassen: string[]) => {
	const aus = l?.trim() ? `${innen} [Lösung: ${zeile(l)}]` : innen;
	if (klassen.includes('nur-loesung')) {
		return zeile(aus) ? ` [nur Lösung: ${zeile(aus)}] ` : '';
	}
	if (klassen.includes('nicht-loesung')) {
		return zeile(aus) ? ` [nur Arbeitsblatt: ${zeile(aus)}] ` : '';
	}
	return aus;
};

/** Titel, Ziel und Tipp bekommen ihr Wort davor; Zelle, Listenpunkt und Block ihre Trennung. */
const gerahmt = (k: Knoten, klassen: string[], inhalt: string) => {
	let aus = inhalt;
	if (k.tag === 'h1') {
		aus = `Titel: ${aus}`;
	} else if (klassen.includes('ziel')) {
		aus = `\nZiel: ${aus}\n`;
	} else if (klassen.includes('tipp')) {
		aus = `\nTipp: ${aus}\n`;
	}
	if (k.tag === 'td' || k.tag === 'th') {
		return `${aus} | `;
	}
	if (k.tag === 'li') {
		return `\n- ${aus}\n`;
	}
	return BLOCK.has(k.tag) ? `\n${aus}\n` : aus;
};

const element = (z: Zerlegung, k: Knoten): string => {
	const klassen = klassenVon(k);
	if (fehltImAuszug(k, klassen)) {
		return '';
	}
	const einzeln = fuerSich(z, k);
	if (einzeln !== null) {
		return einzeln;
	}
	if (klassen.includes('aufgabe')) {
		return `\n${ABSATZ}\n${aufgabe(z, k).join('\n')}\n${ABSATZ}\n`;
	}
	const innen = teile(z, k, (c) => element(z, c));
	if (k.tag.startsWith('x-')) {
		return xElement(k, innen);
	}
	const l = attribut(k, 'data-l')?.wert;
	if (klassen.includes('antwort')) {
		const rest = zeile(innen);
		return ` ${rest ? `${rest} ` : ''}[___${l?.trim() ? ` Lösung: ${zeile(l)}` : ''}] `;
	}
	return gerahmt(k, klassen, mitLoesung(innen, l, klassen));
};

const zeilen = (t: string) =>
	t
		.split('\n')
		.map((z) => zeile(z).replace(/\s*\|$/, ''))
		.filter(Boolean)
		.map((z) => (z === ABSATZ ? '' : z));

/** Eine Aufgabe: Kopf mit Nummer und Minuten, die Anweisung, dann ihr Inhalt. */
const aufgabe = (z: Zerlegung, k: Knoten): string[] => {
	const innen = z.knoten.filter((c) => c.start > k.start && c.ende <= k.ende);
	const nr = innen.find((c) => hat(c, 'nr'));
	const anw = innen.find((c) => hat(c, 'anw'));
	const min = attribut(k, 'data-min')?.wert;
	const art = klassenVon(k).filter((c) => c !== 'aufgabe');
	const kopf = [
		`### Aufgabe ${nr ? zeile(teile(z, nr, (c) => element(z, c))) : '?'}`,
		min ? ` (${min} Min.)` : '',
		art.length ? ` · ${art.join(' ')}` : '',
	].join('');
	const ohne = (e: Knoten): string => (e === nr || e === anw ? '' : element(z, e));
	return [
		kopf,
		...(anw ? [`Anweisung: ${zeilen(teile(z, anw, (c) => element(z, c))).join(' ')}`] : []),
		...zeilen(teile(z, k, ohne)).filter((t) => t !== ''),
	];
};

/** Der Kopf einer Seite: Art, Niveau (Zahl der `<i>` in `.niveau`). */
const seitenKopf = (z: Zerlegung, k: Knoten, n: number) => {
	const niveau = z.knoten.find((c) => c.start > k.start && c.ende <= k.ende && hat(c, 'niveau'));
	const punkte = niveau ? niveau.kinder.filter((c) => c.tag === 'i').length : 0;
	const art = klassenVon(k).filter((c) => c !== 'seite');
	return `## Seite ${n}${art.length ? ` (${art.join(' ')})` : ''}${punkte ? ` · Niveau ${punkte}` : ''}`;
};

const istSeite = (k: Knoten) => hat(k, 'seite');

const innerhalb = (k: Knoten, v: Knoten) => v !== k && v.start <= k.start && v.ende >= k.ende;

/** Der Auszug von `material.html` als Markdown; `titel` ist der Name des Materials im Plan. */
export const auszugAus = (html: string, titel: string): string => {
	const z = zerlege(html);
	const body = z.knoten.find((k) => k.tag === 'body');
	const zeit = body ? attribut(body, 'data-zeit')?.wert : undefined;
	const seiten = z.knoten.filter((k) => istSeite(k) && !z.knoten.some((v) => istSeite(v) && innerhalb(k, v)));
	const aus = [`# ${zeile(titel)}`, ...(zeit ? [`Zeitziel: ${zeit} Min.`] : [])];
	if (!seiten.length) {
		aus.push('', ...zeilen(body ? element(z, body) : z.wurzeln.map((k) => element(z, k)).join('\n')));
	}
	seiten.forEach((k, i) => {
		aus.push('', seitenKopf(z, k, i + 1), ...zeilen(teile(z, k, (c) => element(z, c))));
	});
	return `${aus
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()}\n`;
};
