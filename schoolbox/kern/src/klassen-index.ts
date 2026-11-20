/**
 * Der Index der Klassen von `blatt.css` (252) für `references/klassen.md`: Wer ein Material baut, liest ihn statt der
 * ganzen CSS. Je Kommentar am Zeilenanfang eine Zeile mit seinem ersten Satz und den Klassen, die in den Regeln danach
 * zum ersten Mal vorkommen. `<< …` schließt nur einen Block und zählt nicht. Kommentare mit `==` werden gewöhnliche
 * Zeilen: In blatt.css folgen auf sie Kommentare zu anderen Themen, eine Überschrift stünde über Fremdem.
 * Klassen, die nur innerhalb eines `x-…`-Elements stehen, setzt `abbildungen.js`: Sie fehlen im Index.
 */

const MAX_SATZ = 150;

/**
 * Wo der erste Satz eines Kommentars die Klassen danach nicht beschreibt (blatt.css kommentiert sie nicht eigens), steht
 * hier die Zeile des Index. Der Schlüssel ist der erste Satz; fehlt er in blatt.css, scheitert der Index.
 */
const STATT_SATZ: Record<string, string> = {
	'Blätter mit Zeitziel (data-zeit, Menge nach Arbeitszeit): Lesetext ab Kl. 2 am unteren Rand der Spanne aus grundschul-didaktik (16, 14, 12 pt), damit …':
		'Profile am `<body>`: `folie` (Format Folie 16:9), `farbe` (Farbprofil), `palette-…` (Farbwelt ohne thema.css)',
	'Schulziffern: 1 ohne Fuß, offene 4, 7 mit Querstrich, wie die Kinder sie schreiben':
		'Schulziffern; die Seite (`section.seite`)',
	'Weniger Rand oben und unten':
		'Lösungsblatt (`body.loesung`; `.nur-loesung` nur dort, `.nicht-loesung` nur auf dem Arbeitsblatt, `.beispiel` zeigt die Lösung schon auf dem Arbeitsblatt), Malfeld, Sicherheitshinweis, Schreiblinie, Kästchen, s/w',
	'Schlägt das font-family-Attribut am SVG-Text: Vorlage, Vorbild und Lösung in Schreibschrift':
		'Schreibschrift für Vorlage, Vorbild und Lösung; Kreislauf (`kl-…`) und Wetterbogen',
};

interface Gruppe {
	titel: string;
	klassen: string[];
}

/** Der erste Satz eines Kommentars, ohne Blockmarken (`>> 216`) und `==`. */
export const ersterSatz = (kommentar: string) => {
	const text = kommentar
		.slice(2, -2)
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^(?:>>|==)\s*/, '')
		.replace(/\s*==\s*/, ': ')
		.replace(/:\s*$/, '')
		.trim();
	const satz = /^(.+?[.!?])(?=\s+[A-ZÄÖÜ„(.`-]|$)/.exec(text)?.[1] ?? text;
	if (satz.length <= MAX_SATZ) {
		return satz.replace(/\.$/, '');
	}
	return `${satz.slice(0, satz.lastIndexOf(' ', MAX_SATZ))} …`;
};

const OHNE_WERTE = /"[^"]*"|'[^']*'|url\([^)]*\)|\[[^\]]*\]/g;
const KLASSE = /\.(-?[a-zA-Z_][\w-]*)/g;
const IN_ELEMENT = /(?:^|[\s>+~(])x-[a-z]/;

/** Teilt eine Selektorliste an den Kommas außerhalb von Klammern (`:is(.a,.b)` bleibt ganz). */
const stuecke = (sel: string) => {
	const aus = [''];
	let klammer = 0;
	for (const z of sel) {
		if (z === '(') {
			klammer += 1;
		} else if (z === ')') {
			klammer -= 1;
		}
		if (z === ',' && klammer === 0) {
			aus.push('');
		} else {
			aus[aus.length - 1] += z;
		}
	}
	return aus;
};

/** Die Gruppen aus dem Text von `blatt.css`. */
export const klassenGruppen = (css: string): Gruppe[] => {
	const gruppen: Gruppe[] = [{ titel: '', klassen: [] }];
	const gesehen = new Set<string>();
	let tiefe = 0;
	let selektor = '';
	for (const t of css.matchAll(/\/\*[\s\S]*?\*\/|[{};]|[^{};/]+|\//g)) {
		const teil = t[0];
		if (teil.startsWith('/*')) {
			const zeile = css.slice(css.lastIndexOf('\n', (t.index ?? 0) - 1) + 1, t.index);
			const inhalt = teil.slice(2).trim();
			if (tiefe === 0 && !zeile.trim() && !inhalt.startsWith('<<')) {
				gruppen.push({ titel: ersterSatz(teil), klassen: [] });
			}
			continue;
		}
		if (teil === '{') {
			const sel = selektor.trim();
			if (!sel.startsWith('@') && !/^(?:from|to|[\d.]+%)/.test(sel)) {
				for (const stueck of stuecke(sel.replace(OHNE_WERTE, ''))) {
					if (IN_ELEMENT.test(stueck)) {
						continue;
					}
					for (const [, name] of stueck.matchAll(KLASSE)) {
						if (name && !gesehen.has(name)) {
							gesehen.add(name);
							gruppen.at(-1)?.klassen.push(name);
						}
					}
				}
			}
			tiefe += 1;
			selektor = '';
		} else if (teil === '}') {
			tiefe = Math.max(0, tiefe - 1);
			selektor = '';
		} else if (teil === ';') {
			selektor = '';
		} else {
			selektor += teil;
		}
	}
	return gruppen;
};

/** Der erzeugte Abschnitt: je Gruppe mit neuen Klassen eine Zeile. */
export const klassenIndex = (css: string) => {
	const gruppen = klassenGruppen(css);
	const fehlt = Object.keys(STATT_SATZ).filter((satz) => !gruppen.some((g) => g.titel === satz));
	if (fehlt.length) {
		throw new Error(`Index der Klassen: blatt.css hat den Kommentar nicht mehr: ${fehlt.join(' · ')}`);
	}
	const zeilen: string[] = [];
	for (const g of gruppen.map((x) => ({ ...x, titel: STATT_SATZ[x.titel] ?? x.titel }))) {
		if (g.klassen.length) {
			const liste = g.klassen.map((k) => `\`.${k}\``).join(' ');
			zeilen.push(g.titel ? `- ${g.titel}: ${liste}` : `- ${liste}`);
		}
	}
	return zeilen
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
};
