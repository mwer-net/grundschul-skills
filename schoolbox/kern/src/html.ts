import { SchoolboxFehler } from './fehler';
import type { Druckprofil, Format, Klasse } from './werte';
import { FORMATE, STANDARD_FORMAT } from './werte';

const BODY_KLASSEN = /<body([^>]*?)\sclass="([^"]*)"/;
const KLASSENSTUFEN = ['kl1', 'kl2', 'kl3', 'kl4'];
const STANDARD_PALETTE = 'palette-himmel';

const ENTITAETEN: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\u0027' };

export const htmlEscape = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const htmlUnescape = (text: string) =>
	text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (ganz: string, name: string) => {
		if (name.startsWith('#')) {
			const zahl = name[1]?.toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
			return String.fromCodePoint(zahl);
		}
		return ENTITAETEN[name.toLowerCase()] ?? ganz;
	});

export const titelAusHtml = (html: string): string | null => {
	const treffer = /<title>([\s\S]*?)<\/title>/.exec(html);
	return treffer?.[1] === undefined ? null : htmlUnescape(treffer[1].trim());
};

export const setzeTitel = (html: string, titel: string): string => {
	const neu = `<title>${htmlEscape(titel)}</title>`;
	if (/<title>[\s\S]*?<\/title>/.test(html)) {
		return html.replace(/<title>[\s\S]*?<\/title>/, () => neu);
	}
	if (!/<head[^>]*>/.test(html)) {
		throw new SchoolboxFehler('Die Vorlage hat kein <head>.');
	}
	return html.replace(/<head[^>]*>/, (kopf) => `${kopf}\n${neu}`);
};

export const bodyKlassen = (html: string): string[] => BODY_KLASSEN.exec(html)?.[2]?.split(/\s+/).filter(Boolean) ?? [];

export const formatAusHtml = (html: string): Format =>
	FORMATE.find((f) => f !== STANDARD_FORMAT && bodyKlassen(html).includes(f)) ?? STANDARD_FORMAT;

export const druckprofilAusHtml = (html: string): Druckprofil | null => {
	const klassen = bodyKlassen(html);
	if (klassen.includes('farbe')) {
		return 'farbe';
	}
	return klassen.includes('sw') ? 'sw' : null;
};

export interface BodyEinstellungen {
	klasse: Klasse;
	format: Format;
	druckprofil: Druckprofil;
}

export const setzeBodyKlassen = (html: string, { druckprofil, format, klasse }: BodyEinstellungen): string => {
	if (!/<body[\s>]/.test(html)) {
		throw new SchoolboxFehler('Die Vorlage hat kein <body>.');
	}
	const alt = bodyKlassen(html);
	const palette = alt.find((k) => k.startsWith('palette-')) ?? STANDARD_PALETTE;
	const entfernen = new Set<string>([...KLASSENSTUFEN, ...FORMATE, 'sw', 'farbe']);
	const rest = alt.filter((k) => !entfernen.has(k) && !k.startsWith('palette-'));
	const klassen = [
		klasse === 'gemischt' ? null : `kl${klasse}`,
		druckprofil,
		druckprofil === 'farbe' ? palette : null,
		format === STANDARD_FORMAT ? null : format,
		...rest,
	].filter((k): k is string => k !== null);
	const attribut = `class="${klassen.join(' ')}"`;
	if (BODY_KLASSEN.test(html)) {
		return html.replace(BODY_KLASSEN, (_ganz, vorher: string) => `<body${vorher} ${attribut}`);
	}
	return html.replace(/<body/, `<body ${attribut}`);
};

/** „B · Willis Tag – Geschichte als Rahmen, Uhrzeiten zuordnen“ → Titel „Willis Tag“, Idee „Geschichte als …“. */
export const entwurfAusTitel = (titel: string): { titel: string; idee: string } => {
	const ohneBuchstabe = titel.replace(/^[A-Z]\s*[·:.)–-]\s+/, '').trim();
	const teile = ohneBuchstabe.split(/\s+[–-]\s+/);
	const [kopf = '', ...idee] = teile;
	return { titel: kopf.trim(), idee: idee.join(' – ').trim() };
};

/** Seitengrößen, die blatt.py für Formate außer A4 hoch als `@page` einsetzt (A4 hoch steht in blatt.css). */
export const SEITENGROESSE: Record<string, string | undefined> = {
	'a4-quer': 'A4 landscape',
	'a3-hoch': 'A3',
	'a5-hoch': 'A5',
	'folie': '338.67mm 190.5mm',
};

const BODY_WIE_BLATT_PY = /<body([^>]*)class="([^"]*)"/;

/**
 * Bereitet material.html für den Browser so vor, wie `einbetten()` in blatt.py es für den Druck tut: `@page` nach
 * der Formatklasse und mit `loesung` die Klasse `loesung` am `<body>`. Ressourcen bleiben verlinkt.
 */
export const darstellungsHtml = (html: string, { loesung }: { loesung: boolean }): string => {
	const klassen = BODY_WIE_BLATT_PY.exec(html)?.[2]?.split(/\s+/) ?? [];
	const groesse = klassen.map((k) => SEITENGROESSE[k]).find(Boolean);
	let ergebnis = groesse ? html.replace('</head>', `<style>@page{size:${groesse};margin:0}</style>\n</head>`) : html;
	if (loesung) {
		ergebnis = ergebnis.replace(
			BODY_WIE_BLATT_PY,
			(_ganz, vorher: string, k: string) => `<body${vorher}class="${k} loesung"`,
		);
	}
	return ergebnis;
};
