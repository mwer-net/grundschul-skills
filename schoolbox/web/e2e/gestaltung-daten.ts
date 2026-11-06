/**
 * Testdaten der Phase 12 „Kreativ gestalten“: je Art ein Beispiel im Format aus dem Briefing (03-modell, 3.4 bis 3.6) und
 * ein A4-Blatt mit Aufgaben, in das man sie einsetzt. Kern-Tests und Browser-Specs lesen diese Datei und ändern sie
 * nicht; eigene Beispiele gehören in die eigene Spec. Ohne Abhängigkeiten, damit auch `kern/` sie lesen kann.
 */

/** Wo ein Beispiel liegt: in einer Ebene der Seite oder am Anker in der ersten Aufgabe. */
export type Ort = 'hinten' | 'vorne' | 'anker';

export interface Beispiel {
	/** Die Art aus `kern/src/gestaltung-arten.ts`, die das Register erkennen soll. */
	art: string;
	ort: Ort;
	html: string;
}

export const BILD_FREI =
	'<img class="bild-frei" data-lage="frei" src="bilder/marktplatz.jpg" alt="Marktplatz" style="--x:96px;--y:300px;--b:420px;--drehen:-3deg">';

export const FIGUR_FREI =
	'<img class="figur-frei" data-lage="frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:610px;--y:520px;--b:150px;--spiegeln:-1">';

/** Ein fünfzackiger Stern, Pfad wie ihn `formen.ts` (104) erzeugen wird. */
export const FORM =
	'<svg class="form" data-lage="frei" data-form="stern" data-zacken="5" data-innen="0.45" viewBox="0 0 120 120" style="--x:610px;--y:84px;--b:120px;--h:120px;--drehen:12deg">' +
	'<path d="M60 3 L73.4 41.6 L114.2 42.4 L81.7 67.1 L93.5 106.1 L60 82.8 L26.5 106.1 L38.3 67.1 L5.8 42.4 L46.6 41.6 Z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px"/>' +
	'</svg>';

export const FORM_TEXT =
	'<div class="form-text" data-lage="frei" data-form="sprechblase" data-zipfel="-26,70" style="--x:470px;--y:690px;--b:180px;--h:84px">' +
	'<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M20 2 H160 Q178 2 178 20 V64 Q178 82 160 82 H40 L-26 70 L24 82 H20 Q2 82 2 64 V20 Q2 2 20 2 Z" style="fill:#fff;stroke:var(--dunkel);stroke-width:3px"/></svg>' +
	'<div class="form-inhalt">Zähl genau!</div>' +
	'</div>';

export const SCHMUCK =
	'<div class="schmuck" data-lage="frei" data-schmuck="titel" data-kontur style="--x:64px;--y:150px;--b:666px;--gr:56px;--farbe:var(--dunkel);--kontur:6px;--kontur-farbe:#fff">' +
	'Die <span style="color:var(--akzent)">Formen</span>-Detektive</div>';

export const SCHMUCK_STEMPEL =
	'<div class="schmuck" data-lage="frei" data-schmuck="stempel" style="--x:560px;--y:960px;--gr:28px;--drehen:-8deg">Prima!</div>';

export const SCHMUCK_ETIKETT =
	'<div class="schmuck" data-lage="frei" data-schmuck="etikett" style="--x:120px;--y:840px;--gr:16px;--hg:var(--haupt)">13 Fälle</div>';

/** Braucht `textPath` in der Allow-Liste; das bringt erst 110. */
export const SCHMUCK_BOGEN =
	'<svg class="schmuck" data-lage="frei" data-schmuck="bogen" data-bogen="35" viewBox="0 0 600 160" style="--x:97px;--y:120px;--b:600px;--h:160px">' +
	'<defs><path id="bogen-k3f9" d="M20 140 Q300 20 580 140"/></defs>' +
	'<text text-anchor="middle" style="font:600 56px Fredoka,sans-serif;fill:var(--haupt);stroke:#fff;stroke-width:8px;paint-order:stroke">' +
	'<textPath href="#bogen-k3f9" startOffset="50%">Zahlenzirkus</textPath></text>' +
	'</svg>';

export const STREUUNG =
	'<svg class="streuung" data-lage="frei" data-streuung="punkte" data-saat="4711" data-dichte="0.5" data-formen="punkt" data-farben="haupt akzent dunkel" viewBox="0 0 220 260" style="--x:0px;--y:863px;--b:220px;--h:260px">' +
	'<circle cx="18" cy="242" r="7" style="fill:var(--haupt)"/>' +
	'<circle cx="48" cy="242" r="5" style="fill:var(--akzent)"/>' +
	'<circle cx="80" cy="210" r="6" style="fill:var(--dunkel)"/>' +
	'</svg>';

/** Mit einem Verlauf: Id und Verweis, für das Duplizieren (3.11). Der Verweis steht als Attribut, `url()` im `style` lässt die Allow-Liste nicht zu. */
export const FORM_VERLAUF =
	'<svg class="form" data-lage="frei" data-form="kreis" viewBox="0 0 100 100" style="--x:300px;--y:400px;--b:100px;--h:100px">' +
	'<defs><linearGradient id="verlauf-a1b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#ef476f"/></linearGradient></defs>' +
	'<circle cx="50" cy="50" r="48" fill="url(#verlauf-a1b2)"/>' +
	'</svg>';

export const BILDRAHMEN =
	'<img class="bild-frei" data-lage="frei" data-maske="kreis" src="bilder/marktplatz.jpg" alt="Marktplatz" style="--x:420px;--y:300px;--b:200px;--h:200px">';

export const GRUPPE =
	'<div class="gruppe" data-lage="frei" style="--x:420px;--y:600px;--b:300px;--h:220px;--drehen:-4deg">' +
	'<img class="figur-frei" data-lage="frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:170px;--y:40px;--b:130px">' +
	'<div class="form-text" data-lage="frei" data-form="sprechblase" data-zipfel="200,60" style="--x:0px;--y:0px;--b:180px;--h:84px">' +
	'<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="2" y="2" width="176" height="80" rx="18" style="fill:#fff;stroke:var(--dunkel);stroke-width:3px"/></svg>' +
	'<div class="form-inhalt">Hallo!</div></div>' +
	'</div>';

export const PFAD =
	'<svg class="form" data-lage="frei" data-form="pfad" viewBox="0 0 200 100" style="--x:80px;--y:500px;--b:200px;--h:100px">' +
	'<path d="M10 90 C60 10 140 10 190 90" style="fill:none;stroke:var(--dunkel);stroke-width:4px"/>' +
	'</svg>';

/** Was Claude nach 088 gebaut hat und jemand frei gezogen hat (117): Gestaltung, kein freies Element. */
export const CLAUDE_ELEMENT =
	'<div data-frei data-frei-titel="Zirkuszelt" data-lage="frei" style="--x:500px;--y:120px;--b:200px;--h:160px">' +
	'<svg viewBox="0 0 200 160"><polygon points="100,10 190,150 10,150" style="fill:var(--akzent)"/></svg>' +
	'</div>';

export const STAPEL =
	'<div class="stapel" data-lage="frei" data-name="Notizzettel" data-nummern="weiter" style="--x:470px;--y:690px;--b:300px;--drehen:-4deg;--stapel-hg:#fff3b0;--stapel-schatten:1">' +
	'<div class="aufgabe"><span class="nr">4</span><div class="anw"><span class="text">Zähle die Sterne.</span></div><div class="koerper"></div></div>' +
	'</div>';

/** Am Anker: letztes Kind der ersten Aufgabe, Koordinaten relativ zur Aufgabe (3.5). */
export const FIGUR_ANKER =
	'<img class="figur-frei" data-lage="frei" data-anker data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:560px;--y:-40px;--b:110px">';

export const SEITENFLAECHE =
	'<div class="seitenflaeche" data-flaeche="verlauf" style="--f1:#fff7e6;--f2:#ffe0b8;--winkel:180deg"></div>';

export const SEITENRAHMEN =
	'<div class="seitenrahmen" data-rahmen="gestrichelt" style="--rahmen-farbe:var(--dunkel);--rahmen-staerke:3px;--rahmen-abstand:24px;--rahmen-ecke:16px"></div>';

/** Fläche im Stapel (E4): ein Baustein im Fluss, keine Ebene. */
export const FLAECHE =
	'<div class="flaeche" style="--h:280px">' +
	'<svg class="form" data-lage="frei" data-form="rechteck" viewBox="0 0 200 120" style="--x:20px;--y:20px;--b:200px;--h:120px"><rect x="2" y="2" width="196" height="116" rx="12" style="fill:var(--fuell);stroke:var(--linie);stroke-width:3px"/></svg>' +
	'</div>';

/** Je Art ein Beispiel. `FLAECHE` steht nicht darin: Sie liegt im Stapel, siehe `blattMit`. */
export const BEISPIELE: readonly Beispiel[] = [
	{ art: 'bildfrei', ort: 'vorne', html: BILD_FREI },
	{ art: 'figurfrei', ort: 'vorne', html: FIGUR_FREI },
	{ art: 'form', ort: 'vorne', html: FORM },
	{ art: 'form', ort: 'vorne', html: FORM_VERLAUF },
	{ art: 'form', ort: 'vorne', html: PFAD },
	{ art: 'formtext', ort: 'vorne', html: FORM_TEXT },
	{ art: 'schmuck', ort: 'vorne', html: SCHMUCK },
	{ art: 'schmuck', ort: 'vorne', html: SCHMUCK_STEMPEL },
	{ art: 'schmuck', ort: 'vorne', html: SCHMUCK_ETIKETT },
	{ art: 'schmuckbogen', ort: 'vorne', html: SCHMUCK_BOGEN },
	{ art: 'streuung', ort: 'hinten', html: STREUUNG },
	{ art: 'bildfrei', ort: 'vorne', html: BILDRAHMEN },
	{ art: 'gruppe', ort: 'vorne', html: GRUPPE },
	{ art: 'stapel', ort: 'vorne', html: STAPEL },
	{ art: 'gestaltung', ort: 'vorne', html: CLAUDE_ELEMENT },
	{ art: 'figurfrei', ort: 'anker', html: FIGUR_ANKER },
	{ art: 'seitenflaeche', ort: 'hinten', html: SEITENFLAECHE },
	{ art: 'seitenrahmen', ort: 'hinten', html: SEITENRAHMEN },
];

const AUFGABEN = [
	[
		'  <div class="aufgabe">',
		'    <span class="nr">1</span>',
		'    <div class="anw"><span class="text">Rechne.</span></div>',
		'    <div class="koerper"><div class="zeile">3 + 4 = <span class="antwort" data-l="7"></span></div></div>',
		'  </div>',
	],
	[
		'  <div class="aufgabe">',
		'    <span class="nr">2</span>',
		'    <div class="anw"><span class="text">Zeichne ein Haus aus Formen.</span></div>',
		'    <div class="koerper"><div class="malfeld"></div></div>',
		'  </div>',
	],
	[
		'  <div class="aufgabe">',
		'    <span class="nr">3</span>',
		'    <div class="anw"><span class="text">Male die Dreiecke an.</span></div>',
		'    <div class="koerper"><div class="schreiblinie"></div></div>',
		'  </div>',
	],
];

export interface Einsatz {
	hinten?: readonly string[];
	vorne?: readonly string[];
	/** Kommt als letztes Kind in die erste Aufgabe. */
	anker?: readonly string[];
	/** Kommt als Baustein zwischen Aufgabe 2 und 3 (Fläche im Stapel, E4). */
	stapel?: readonly string[];
}

const ebene = (name: 'hinten' | 'vorne', elemente: readonly string[] | undefined) =>
	elemente?.length
		? [`  <div class="ebene ${name}">`, ...elemente.map((e) => `    ${e}`), '  </div>']
		: [];

/**
 * Ein A4-Blatt (794 × 1123 px) mit Namenszeile, Kopf und drei Aufgaben, die Ebenen am Ende der Seite. Ohne Einsatz ist
 * es ein Blatt ohne Gestaltung, wie es heute aussieht.
 */
export const blattMit = (einsatz: Einsatz = {}) => {
	const [erste = [], zweite = [], dritte = []] = AUFGABEN;
	const anker = (einsatz.anker ?? []).map((e) => `    ${e}`);
	return [
		'<!doctype html>',
		'<html lang="de">',
		'<head>',
		'<meta charset="utf-8">',
		'<title>Formen-Detektive</title>',
		'<link rel="stylesheet" href="blatt.css">',
		'<script src="abbildungen.js"></script>',
		'</head>',
		'<body class="kl2 farbe palette-himmel">',
		'<section class="seite">',
		'  <div class="namenszeile"><span class="name">Name:</span><span class="datum">Datum:</span></div>',
		'  <div class="kopf"><div class="titel"><h1>Die Formen-Detektive</h1></div></div>',
		...erste.slice(0, -1),
		...anker,
		...erste.slice(-1),
		...zweite,
		...(einsatz.stapel ?? []).map((e) => `  ${e}`),
		...dritte,
		...ebene('hinten', einsatz.hinten),
		...ebene('vorne', einsatz.vorne),
		'</section>',
		'</body>',
		'</html>',
		'',
	].join('\n');
};

/** Das Blatt mit einem Beispiel an seinem Ort. */
export const blattMitBeispiel = ({ html, ort }: Beispiel) =>
	blattMit(ort === 'anker' ? { anker: [html] } : { [ort]: [html] });
