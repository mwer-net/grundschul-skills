/**
 * Erzeugt die Tabellen in den Skill-Texten aus ihren Quellen (062). Eingecheckt bleiben sie, damit die Skills ohne
 * Schoolbox nutzbar sind (Entscheidung 9). Nur Node, keine Abhängigkeiten: `ausrollen.sh` prüft damit einen fremden Stand.
 *
 *   tsx kern/src/quellen.ts            schreibt die Abschnitte zwischen den Markierungen
 *   tsx kern/src/quellen.ts --pruefen  vergleicht nur; Exit 1, wenn etwas veraltet ist
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { AbbildungSchema } from './abbildungen';
import { ABBILDUNG_SCHEMA } from './abbildungen';
import { leseAbbildungsKatalog } from './abbildungen-katalog';
import { blattFarbenListe } from './blatt-farben';
import { LAUF_MELDUNGEN, MIT_ZEITZIEL } from './einheit';
import { formateFuerAuftrag, formateTabelle } from './einheit-aufgaben';
import type { ElementBeschreibung } from './einheit-bau';
import { pflichtTabelle } from './einheit-bau';
import { figurenListe } from './figuren';
import { formenTabelle } from './formen';
import { GESTALTUNG_ARTEN } from './gestaltung-arten';
import { klassenIndex } from './klassen-index';
import { HINWEIS_OHNE } from './meldungen';
import { symmetrieTabelle } from './symmetrie';
import type { ArtAngaben } from './werte';
import { ART_ANGABEN, ARTEN, VORLAGE_FORMAT } from './werte';

const WURZEL = path.resolve(__dirname, '..', '..', '..');
const RUECKFRAGEN = 'skills/grundschul-didaktik/references/rueckfragen.md';
const DRUCK = 'skills/grundschul-didaktik/references/druck-und-platz.md';
const BLATT_CSS = 'skills/html-materialerstellung/assets/blatt.css';
const PRUEFUNG_JS = 'skills/html-materialerstellung/assets/pruefung.js';
const LAYOUT = 'skills/html-materialerstellung/references/layout.md';
const GESTALTUNG = 'skills/html-materialerstellung/references/gestaltung.md';
const ARBEITSBLATT = 'skills/arbeitsblatt/SKILL.md';
const EINHEIT_AUFTRAG = 'schoolbox/vorlagen/ki/einheit.md';
const PFLICHTLEKTUERE_MD = 'skills/html-materialerstellung/references/pflichtlektuere.md';
const AELTERER_SATZ = 'skills/html-materialerstellung/references/aelterer-satz.md';
const ABBILDUNGEN = 'skills/html-materialerstellung/references/abbildungen.md';
const GEOMETRIE = 'skills/html-materialerstellung/references/abbildungen/mathe-geometrie.md';
const KLASSEN_MD = 'skills/html-materialerstellung/references/klassen.md';

const tabelle = (kopf: string[], zeilen: string[][]) =>
	[
		`| ${kopf.join(' | ')} |`,
		`|${kopf.map(() => '---').join('|')}|`,
		...zeilen.map((z) => `| ${z.join(' | ')} |`),
	].join('\n');

/** Arten mit gleichen Angaben teilen sich eine Zeile. */
const gruppiere = <T>(eintraege: ArtAngaben[], teil: (a: ArtAngaben) => T | undefined) => {
	const gruppen = new Map<string, { namen: string[]; wert: T }>();
	for (const eintrag of eintraege) {
		const wert = teil(eintrag);
		if (wert !== undefined) {
			const schluessel = JSON.stringify(wert);
			const gruppe = gruppen.get(schluessel) ?? { namen: [], wert };
			gruppe.namen.push(eintrag.name);
			gruppen.set(schluessel, gruppe);
		}
	}
	return [...gruppen.values()];
};

/** Optionen mit Gerüst (Mini-Book) stehen in der eigenen Zeile der Vorlage, nicht zweimal. */
const optionsNamen = (a: ArtAngaben) => a.optionen.filter((o) => !o.vorlage).map((o) => o.name);

const formatJeArt = () => {
	const arten = ARTEN.map((a) => ART_ANGABEN[a]).filter((a) => optionsNamen(a).length > 0);
	const zeilen = gruppiere(arten, (a) => ({
		nichtFragen: a.nichtFragen,
		optionen: optionsNamen(a),
		umsetzung: a.umsetzung,
	})).map(({ namen, wert: { nichtFragen, optionen, umsetzung } }) => {
		const [erste, ...rest] = optionen;
		const angebot = [nichtFragen ? `${erste} (nicht fragen)` : `**${erste}**`, ...rest].join(', ');
		return [namen.join(', '), angebot, umsetzung ?? ''];
	});
	for (const { format, name, optionen } of Object.values(VORLAGE_FORMAT)) {
		zeilen.push([name, `${optionen.join(', ')} (nicht fragen)`, `\`${format}\``]);
	}
	return tabelle(['Materialart', 'Optionen (Empfehlung fett)', 'Format (`<body>`-Klasse)'], zeilen);
};

const bausteineJeArt = () => {
	const arten = ARTEN.map((a) => ART_ANGABEN[a]);
	const zeilen = gruppiere(arten, (a) => a.bausteine).map(({ namen, wert }) => [
		namen.join(', '),
		wert.selbsteinschaetzung,
		wert.niveaus,
		wert.sternchen,
	]);
	return tabelle(['Materialart', '3. Selbsteinschätzung', '4. Churer Modell', '5. Sternchenaufgabe'], zeilen);
};

const schriftJeKlasse = (wurzel: string) => {
	const css = readFileSync(path.join(wurzel, BLATT_CSS), 'utf8');
	const mitZeitziel = new Map(
		[...css.matchAll(/^body\.kl([1-4])\[data-zeit\]\{--fs:(\d+)px(?:;--abstand:(\d+)px)?/gm)].map((t) => [
			t[1],
			`; mit \`data-zeit\` ${t[2]} px${t[3] ? `, Abstand ${t[3]} px` : ''}`,
		]),
	);
	const aelter = new Map(
		[...css.matchAll(/^body\.kl([1-4])\{--fs:(\d+)px;--abstand:(\d+)px\}/gm)].map((t) => [
			t[1] ?? '',
			`${t[2]} px, Abstand ${t[3]} px${mitZeitziel.get(t[1] ?? '') ?? ''}`,
		]),
	);
	const satz2 = [
		...css.matchAll(/^body\.kl([1-4])\[data-satz="2"\][^{]*\{--fs:(\d+)px;--abstand:(\d+)px;--zh:([\d.]+)/gm),
	].map((t) => [
		`Kl. ${t[1]}`,
		`${t[2]} px (${String(Math.round(Number(t[2]) * 0.75)).replace('.', ',')} pt)`,
		`${t[3]} px`,
		(t[4] ?? '').replace('.', ','),
	]);
	if (satz2.length !== 4 || aelter.size !== 4) {
		throw new Error(`${BLATT_CSS}: Schrift und Abstand von Kl. 1 bis 4 nicht gefunden.`);
	}
	return { aelter, satz2 };
};

const klassenWerte = (wurzel: string) =>
	tabelle(['Klasse', 'Schrift', 'Abstand zwischen Aufgaben', 'Zeilenhöhe'], schriftJeKlasse(wurzel).satz2);

/** Die Spalte der Blätter ohne `data-satz="2"` steht nur in `aelterer-satz.md` (228). */
const aeltereKlassenWerte = (wurzel: string) =>
	tabelle(
		['Klasse', 'Ältere Blätter (ohne `data-satz`)'],
		[...schriftJeKlasse(wurzel).aelter]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([kl, wert]) => [`Kl. ${kl}`, wert]),
	);

const lueckenBreite = (wurzel: string) => {
	const css = readFileSync(path.join(wurzel, BLATT_CSS), 'utf8');
	const zeilen = [...css.matchAll(/^body\.kl([1-4])\{--luecke-min:(\d+)mm\}/gm)].map((t) => [
		`Kl. ${t[1]}`,
		`${t[2]} mm`,
	]);
	if (zeilen.length !== 4) {
		throw new Error(`${BLATT_CSS}: Lückenbreite von Kl. 1 bis 4 nicht gefunden.`);
	}
	return tabelle(['Klasse', 'Lücke mindestens'], zeilen);
};

const themaRegeln = (wurzel: string) => {
	const js = readFileSync(path.join(wurzel, PRUEFUNG_JS), 'utf8');
	const liste = (name: string) => {
		const text = new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(js)?.[1];
		if (!text) {
			throw new Error(`${PRUEFUNG_JS}: ${name} nicht gefunden.`);
		}
		return [...text.matchAll(/"([^"]+)"/g)].map((t) => `\`${t[1]}\``);
	};
	const mindest = /const KIT_MINDEST = (\d+)/.exec(js)?.[1];
	return [
		`Erlaubte Variablen: ${liste('THEMA_VARIABLEN').join(', ')}.`,
		'',
		`Erlaubte Eigenschaften (auch ihre Unterformen wie \`border-radius\`): ${liste('THEMA_SCHMUCK').join(', ')}.`,
		'',
		`Der Kit-Anteil eines Blatts soll mindestens ${mindest} % sein.`,
	].join('\n');
};

const STUFEN = ['FEHLER', 'WARNUNG', 'HINWEIS'];

/**
 * Meldungen ohne Schwelle und ohne Bedingung: Der Text im Bericht sagt schon alles, eine Zeile in `pruef-schwellen`
 * kostete nur Lektüre. Ein Code, der weder hier noch in der Tabelle steht, bricht den Erzeuger ab.
 */
const OHNE_SCHWELLE = new Set([
	'schrift-fehlt',
	'minibuch-seiten',
	'abbildung',
	'ueberlauf, rand',
	// 266: Inhalt aus einer Karte oder mit seiner Karte aus der Seite
	'ueberlauf',
	'abgeschnitten',
	'ueberlappung',
	'bild-fehlt',
	'pruefskript',
	'zahlenraum',
	'masstab',
	'farbwort-sw',
	'notiz-fehlt',
	'platzhalter',
	'thema-klasse',
	'thema-layout',
]);

/** Liest eine Zahl oder einen Ausdruck aus `pruefung.js`; fehlt er, ist der Erzeuger veraltet, nicht die Tabelle. */
const leser = (text: string) => ({
	zahl: (name: string) => {
		const wert = new RegExp(`\\b${name} = ([\\d.]+)`).exec(text)?.[1];
		if (wert === undefined) {
			throw new Error(`${PRUEFUNG_JS}: ${name} nicht gefunden.`);
		}
		return Number(wert);
	},
	treffer: (muster: RegExp) => {
		const t = muster.exec(text);
		if (!t) {
			throw new Error(`${PRUEFUNG_JS}: ${muster.source} nicht gefunden.`);
		}
		return t.slice(1).map((w) => w ?? '');
	},
});

const prozent = (anteil: number) => `${Math.round(anteil * 100)} %`;
const zahlen = (objekt: string) => [...objekt.matchAll(/\d: (\d+)/g)].map((t) => t[1]).join('/');
const codeListe = (text: string) => [...text.matchAll(/['"]([a-z-]+)['"]/g)].map((t) => t[1] ?? '');

/** Die Schwellen, die mit und ohne `data-satz="2"` verschieden sind. */
const satzSchwellen = (js: string) => {
	const { treffer } = leser(js);
	const [satz2, mitZeit, aelter] = treffer(
		/const RICHTWERT = satz2 \? (\{[^}]+\})\[kl\] \|\| \d+ : zeitziel \? (\{[^}]+\})\[kl\] \|\| \d+ : (\{[^}]+\})/,
	);
	const [abstandSatz2, abstandAelter] = treffer(/ABSTAND_MIN = satz2 \? (\d+) : (\d+)/);
	return {
		abstandAelter,
		abstandSatz2,
		aelter: zahlen(aelter ?? ''),
		mitZeit: zahlen(mitZeit ?? ''),
		satz2: zahlen(satz2 ?? ''),
	};
};

/** Je Code die Stufen, mit denen `pruefung.js` und der Lauf der Schoolbox ihn melden. */
const meldungStufen = (js: string) => {
	const stufen = new Map<string, Set<string>>();
	const neben = (code: string, stufe: string) => stufen.set(code, (stufen.get(code) ?? new Set()).add(stufe));
	for (const t of js.matchAll(/melde\("([A-Z]+)", [^,]+, ([^,]+),/g)) {
		const codes = codeListe(t[2] ?? '');
		neben(codes.join(', '), t[1] ?? '');
	}
	for (const t of js.matchAll(/stufe: "([A-Z]+)", seite: \d+, code: "([a-z-]+)"/g)) {
		neben(t[2] ?? '', t[1] ?? '');
	}
	for (const [code, stufe] of Object.entries(LAUF_MELDUNGEN)) {
		neben(code, stufe);
	}
	return stufen;
};

const stufenText = (s: Set<string> | undefined) => STUFEN.filter((x) => s?.has(x)).join(', ');

/**
 * Die Schwellen der Prüfung aus `pruefung.js` und die Meldungen, die nur der Lauf der Schoolbox kennt (224). Stufen
 * und Codes von `pruefung.js` liest sie aus den Aufrufen, die des Laufs aus `LAUF_MELDUNGEN`.
 */
const pruefSchwellen = (wurzel: string) => {
	const js = readFileSync(path.join(wurzel, PRUEFUNG_JS), 'utf8');
	const { treffer, zahl } = leser(js);
	const { abstandSatz2, satz2 } = satzSchwellen(js);
	const [karte, stein, kind] = treffer(/KANTE_MIN = \{ karte: (\d+), stein: (\d+), kind: (\d+) \}/);
	const druckrand = zahl('DRUCKRAND');
	const satz = '`data-satz="2"`';
	const laufNeu = 'nur im Lauf der Schoolbox beim Bau neuen Materials, nicht beim Ändern';
	const WANN: Record<string, string> = {
		'aussen': 'ein Gestaltungselement liegt zu mehr als der Hälfte außerhalb der Seite',
		'zeit-fehlt': 'mit Zeitziel: eine Aufgabe ohne `data-min`',
		'zeit-knapp': `mit Zeitziel: das kürzeste Niveau unter ${prozent(zahl('ZEIT_KNAPP'))} des Ziels`,
		'zeit-viel': `nur beim Bauen, mit Zeitziel: das längste Niveau über ${prozent(zahl('ZEIT_VIEL'))} des Ziels`,
		'druckrand': `Gestaltung mit Text oder Bild näher als ${druckrand} px (${Math.round((druckrand * 25.4) / 96)} mm) am Blattrand`,
		'schrift-klein': `Schrift unter ${prozent(zahl('SCHRIFT_MIN'))} der Schrift der Klasse, auf Folien der Folienschrift`,
		'flaeche': `Fläche hinter Inhalt dunkler als ${zahl('FLAECHE_HELL')} von 255 und größer als ${zahl('FLAECHE_MIN')} px²`,
		'aufgaben-viele': `mehr Aufgaben (ohne ★) auf einer Seite als in Kl. 1/2/3/4: ${satz2} mit ${satz}`,
		'rahmen-gross': `mit Zeitziel: Kopf höher als ${zahl('KOPF_MAX')} px oder Fuß höher als ${zahl('FUSS_MAX')} px`,
		'abstand-knapp': `weniger als ${abstandSatz2} px zwischen zwei Aufgaben mit ${satz}`,
		'platz-frei': `mehr als ${zahl('FREI_MAX')} px frei unten mit Zeitziel oder auf einer Arbeitsseite mit ${satz} (WARNUNG), sonst ab ${zahl('FREI_HINWEIS')} px (HINWEIS); nicht auf Folien, Karten und Mini-Books`,
		'inhalt-wenig': `Arbeitsseite mit ${satz}: weniger als ${zahl('AUFGABEN_MIN')} Aufgaben oder ${zahl('TEILE_MIN')} Teilaufgaben, oder mehr als ${zahl('LEER_MAX')} % der Fläche leer; \`data-dicht-ok\` nimmt die Seite aus`,
		'teile-viele': `${satz}: mehr als ${zahl('TEILE_MAX')} Teile zum Ausschneiden auf einer A4-Seite`,
		'teil-klein': `${satz}: kurze Kante einer Karte unter ${karte} mm, Dominostein kleiner als ${zahl('STEIN_LANG_MIN')} × ${stein} mm, Teil zum Selbstschneiden unter ${kind} mm (Schneidebogen, \`.ausschneiden\`, \`data-schnitt\`)`,
		'motiv-klein': `${satz}: das Motiv füllt weniger als ${prozent(zahl('MOTIV_MIN'))} der Karte innerhalb ihres Rands`,
		'schnitt-knapp': `${satz}: Text oder Bild näher als ${zahl('SCHNITT_MIN')} mm an der Schnittkante`,
		'karten-einzeln': `${satz}: jede Seite mit Karten trägt nur eine (Rückseiten und Deckkarte zählen nicht); \`data-tafel-gross\` nimmt eine Karte aus`,
		'kit-anteil': `nur beim Bauen: weniger als ${zahl('KIT_MINDEST')} % der Elemente mit Klasse nutzen nur Kit-Klassen`,
		'verdeckt': `Gestaltung vorne oder am Anker verdeckt Inhalt um mehr als ${zahl('VERDECKT_MIN')} px²`,
		'kontrast-sw': `in s/w: Text mit Kontrast unter ${zahl('KONTRAST_MIN')}:1 zu seiner Fläche`,
		'bild-kontrast-sw': `in s/w: ein Bild, dessen Grauwerte weniger als ${zahl('BILD_SPANNE_MIN')} von 255 auseinanderliegen`,
		'bild-unscharf': `ein Bild hat im Druck unter ${zahl('DPI_MIN')} dpi`,
		'ausgeblendet': 'einmal je Material: Elemente mit `data-aus` werden nicht gedruckt',
		'zeitziel-fehlt': `${laufNeu}: ${MIT_ZEITZIEL.map((a) => ART_ANGABEN[a].name).join(', ')} mit ${satz} und Aufgaben, aber ohne \`data-zeit\` am \`<body>\``,
		'loesung-fehlt': `${laufNeu}: je Aufgabe, deren Antwortlinien keine Lösung haben; bei offener Aufgabe reicht ein Satz als \`.nur-loesung\``,
		'symmetrie-achse':
			'`x-gitter aufgabe="pruefen"` mit `nur`, und die Anweisung spricht von Symmetrie, nennt die Achse aber nicht',
		'kontrast-sw-schau': `gedruckt wird s/w (Quelle in s/w oder \`blatt.py --sw-druck\`): Text auf einer Schauseite (Fall-Karte, Deckblatt, A3) mit Kontrast unter ${zahl('KONTRAST_MIN')}:1`,
		'feld-klein': `\`.feld-kleben\` oder \`.feld-zeichnen\` kleiner als \`data-fuer\` und ${zahl('FELD_RAND')} mm je Seite, auch gedreht (FEHLER); Zeichenfeld ohne \`data-fuer\` unter dem Maß der Klasse, \`.malfeld\` schmaler als dieses Maß (WARNUNG); Maße in „Platz zum Kleben, Zeichnen und Schreiben“`,
		'aufloesung-sichtbar':
			'`.aufloesung` (Seite oder Teil einer Seite) steht im PDF der Kinder, also ohne `.nur-loesung` und ohne `data-aus`; in der Lösung nie',
		'feld-fuer': '`data-fuer` ist kein Maß (FEHLER) oder fehlt am Klebefeld (WARNUNG)',
		'linien-wenig':
			'`data-antwort="satz"` oder `"begruendung"` mit weniger Schreiblinien als in „Platz zum Kleben, Zeichnen und Schreiben“',
		'antwort-menge':
			'eine Aufgabe mit Schreibplatz sagt „weil“, „begründe“ oder „erkläre“ und hat kein `data-antwort` (HINWEIS, einmal je Seite); `data-antwort` mit einem Wert, den es nicht gibt (FEHLER)',
	};
	const stufen = meldungStufen(js);
	for (const code of OHNE_SCHWELLE) {
		stufen.delete(code);
	}
	const fehlt = [...stufen.keys()].filter((c) => !WANN[c]);
	if (fehlt.length > 0) {
		throw new Error(
			`${PRUEFUNG_JS}: Meldung weder in WANN noch in OHNE_SCHWELLE (quellen.ts): ${fehlt.join(', ')}.`,
		);
	}
	const erste = (s: Set<string>) => Math.min(...[...s].map((x) => STUFEN.indexOf(x)));
	const zeilen = [...stufen]
		.sort(([, a], [, b]) => erste(a) - erste(b))
		.map(([code, s]) => [
			code
				.split(', ')
				.map((c) => `\`${c}\``)
				.join(', '),
			stufenText(s),
			`${WANN[code]}${(HINWEIS_OHNE as readonly string[]).includes(code) ? '; im Lauf der Schoolbox nicht im Bericht' : ''}`,
		]);
	return tabelle(['Code', 'Stufe', 'Wann'], zeilen);
};

/** Mindestmaße für Felder, Schreiblinien und Teile zum Selbstschneiden je Klasse, aus `pruefung.js` (249). */
const platzJeKlasse = (wurzel: string) => {
	const js = readFileSync(path.join(wurzel, PRUEFUNG_JS), 'utf8');
	const { treffer, zahl } = leser(js);
	const jeKlasse = (objekt: string) =>
		new Map([...objekt.matchAll(/(\d): (\d+)/g)].map((t) => [t[1] ?? '', t[2] ?? '']));
	const [zeichnen = ''] = treffer(/const ZEICHENFELD_MIN = (\{[^}]+\})/);
	const [satz = '', begruendung = ''] = treffer(
		/const LINIEN_MIN = \{ satz: (\{[^}]+\}), begruendung: (\{[^}]+\}) \}/,
	);
	const [kind = ''] = treffer(/KANTE_MIN = \{ karte: \d+, stein: \d+, kind: (\d+) \}/);
	const KLASSEN = ['1', '2', '3', '4'];
	const zeile = (was: string, werte: Map<string, string>, wert: (w: string) => string) => [
		was,
		...KLASSEN.map((k) => wert(werte.get(k) ?? '–')),
	];
	const rand = zahl('FELD_RAND');
	return [
		tabelle(
			['Was', ...KLASSEN.map((k) => `Kl. ${k}`)],
			[
				zeile('Zeichenfeld ohne `data-fuer` (`.feld-zeichnen`)', jeKlasse(zeichnen), (w) => `${w} × ${w} mm`),
				zeile('Schreiblinien für einen Satz (`data-antwort="satz"`)', jeKlasse(satz), (w) => w),
				zeile(
					'Schreiblinien für eine Begründung (`data-antwort="begruendung"`)',
					jeKlasse(begruendung),
					(w) => w,
				),
				zeile(
					'Teil zum Selbstschneiden, kurze Kante',
					new Map(KLASSEN.map((k) => [k, kind])),
					(w) => `${w} mm`,
				),
			],
		),
		'',
		`Feld mit \`data-fuer\`: das Maß aus \`data-fuer\` und ${rand} mm Rand je Seite, in jeder Klasse; gedreht einlegen gilt. Leere Felder misst der Bau ab ${zahl('LEERFELD_MIN')} mm für den Prüflauf.`,
	].join('\n');
};

/** Was die Prüfung ohne `data-satz="2"` anders meldet, für `aelterer-satz.md` (228). */
const aeltereSchwellen = (wurzel: string) => {
	const js = readFileSync(path.join(wurzel, PRUEFUNG_JS), 'utf8');
	const { abstandAelter, aelter, mitZeit } = satzSchwellen(js);
	const stufen = meldungStufen(js);
	const WANN: Record<string, string> = {
		'aufgaben-viele': `mehr Aufgaben (ohne ★) auf einer Seite als in Kl. 1/2/3/4: ${mitZeit} mit Zeitziel im älteren Satz, sonst ${aelter}`,
		'abstand-knapp': `weniger als ${abstandAelter} px zwischen zwei Aufgaben`,
	};
	return tabelle(
		['Code', 'Stufe', 'Wann'],
		Object.entries(WANN).map(([code, wann]) => [`\`${code}\``, stufenText(stufen.get(code)), wann]),
	);
};

const GROESSE: Record<string, string> = {
	proportional: 'Ecken halten das Verhältnis',
	frei: 'frei',
	text: 'Ecke: Schrift, Kante: Breite',
	breite: 'nur Breite, Höhe aus dem Inhalt',
};

/** Die Arten der Gestaltung aus `gestaltung-arten.ts` (Phase 12). */
const gestaltungArten = () =>
	tabelle(
		['Art', 'Name', 'Element', 'Größe', 'Standard-Ebene', 'Fähigkeiten', 'Ab'],
		GESTALTUNG_ARTEN.map((a) => [
			`\`${a.art}\``,
			a.name,
			`\`${a.selektor}\``,
			a.groesse ? (GROESSE[a.groesse] ?? a.groesse) : '–',
			a.ebene ?? '–',
			a.faehigkeiten.length ? a.faehigkeiten.map((f) => `\`${f}\``).join(', ') : '–',
			a.ab,
		]),
	);

/** Nur für die Tests der Feldtypen im Panel (023), nie im Material: braucht keine Beschreibung im Katalog. */
const OHNE_BESCHREIBUNG = new Set(['x-probe']);

/** Was am Katalog der Abbildungen nicht stimmt: Jedes Element des Schemas hat genau eine Überschrift, keine ist fremd. */
export const katalogFehler = (beschreibungen: readonly ElementBeschreibung[], schema: readonly string[]) => {
	const dateien = new Map<string, string[]>();
	for (const b of beschreibungen) {
		dateien.set(b.element, [...(dateien.get(b.element) ?? []), b.datei]);
	}
	return [
		...schema
			.filter((e) => !OHNE_BESCHREIBUNG.has(e) && !dateien.has(e))
			.map((e) => `${e} ist in keiner Datei des Katalogs beschrieben.`),
		...[...dateien]
			.filter(([, d]) => d.length > 1)
			.map(([e, d]) => `${e} ist mehrfach beschrieben: ${d.join(', ')}.`),
		...[...dateien.keys()].filter((e) => !schema.includes(e)).map((e) => `${e} steht nicht im Schema.`),
	];
};

/** Der Index im Einstieg `abbildungen.md` (226): je Element, wofür es da ist und welche Datei es beschreibt. */
export const abbildungenIndex = (wurzel: string) => {
	const beschreibungen = leseAbbildungsKatalog(path.join(wurzel, 'skills'));
	const schema = ABBILDUNG_SCHEMA as Record<string, AbbildungSchema>;
	const fehler = katalogFehler(beschreibungen, Object.keys(schema));
	if (fehler.length > 0) {
		throw new Error(`Katalog der Abbildungen: ${fehler.join(' ')}`);
	}
	return tabelle(
		['Element', 'Wofür', 'Datei'],
		beschreibungen.map((b) => [
			`\`${b.element}\``,
			b.wofuer || (schema[b.element]?.name ?? ''),
			`\`${b.datei.replace(/^html-materialerstellung\//, '')}\``,
		]),
	);
};

interface Abschnitt {
	datei: string;
	marke: string;
	inhalt: (wurzel: string) => string;
}

export const ABSCHNITTE: Abschnitt[] = [
	{ datei: RUECKFRAGEN, marke: 'format-je-art', inhalt: formatJeArt },
	{ datei: RUECKFRAGEN, marke: 'bausteine-je-art', inhalt: bausteineJeArt },
	{ datei: DRUCK, marke: 'schrift-und-abstand', inhalt: klassenWerte },
	{ datei: DRUCK, marke: 'luecken-breite', inhalt: lueckenBreite },
	{ datei: DRUCK, marke: 'pruef-schwellen', inhalt: pruefSchwellen },
	{ datei: DRUCK, marke: 'platz-je-klasse', inhalt: platzJeKlasse },
	{ datei: LAYOUT, marke: 'thema-regeln', inhalt: themaRegeln },
	// Gestaltung (Phase 12): Arten, Figuren, Formen, Farben des Blatts
	{ datei: GESTALTUNG, marke: 'gestaltung-arten', inhalt: gestaltungArten },
	{ datei: GESTALTUNG, marke: 'figuren', inhalt: figurenListe },
	{ datei: GESTALTUNG, marke: 'formen', inhalt: formenTabelle },
	{ datei: GESTALTUNG, marke: 'blatt-farben', inhalt: blattFarbenListe },
	// Aufgabenformate (221): eine Liste für Skill und Plan der Einheit
	{ datei: ARBEITSBLATT, marke: 'aufgabenformate', inhalt: formateTabelle },
	{ datei: EINHEIT_AUFTRAG, marke: 'aufgabenformate', inhalt: formateFuerAuftrag },
	// Pflichtlektüre (220): dieselbe Liste für Harness und Schoolbox
	{ datei: PFLICHTLEKTUERE_MD, marke: 'pflichtlektuere', inhalt: pflichtTabelle },
	// Älterer Satz (228): nur für vorhandene Blätter ohne `data-satz="2"`
	{ datei: AELTERER_SATZ, marke: 'aelterer-satz-schrift', inhalt: aeltereKlassenWerte },
	{ datei: AELTERER_SATZ, marke: 'aelterer-satz-schwellen', inhalt: aeltereSchwellen },
	// Katalog der Abbildungen (226): Index aus den Überschriften der Teil-Dateien
	{ datei: ABBILDUNGEN, marke: 'abbildungen-index', inhalt: abbildungenIndex },
	// Symmetrie (245): Achsen der Buchstaben und Ziffern für x-symmetrie-sortieren
	{ datei: GEOMETRIE, marke: 'symmetrie-zeichen', inhalt: symmetrieTabelle },
	// Klassen (252): der Index von blatt.css, damit der Bau die CSS nicht liest
	{
		datei: KLASSEN_MD,
		marke: 'klassen-index',
		inhalt: (wurzel) => klassenIndex(readFileSync(path.join(wurzel, BLATT_CSS), 'utf8')),
	},
];

/** Setzt den Inhalt zwischen `<!-- erzeugt: marke -->` und `<!-- /erzeugt: marke -->`. */
export const setzeAbschnitt = (text: string, marke: string, inhalt: string) => {
	const anfang = `<!-- erzeugt: ${marke} -->`;
	const ende = `<!-- /erzeugt: ${marke} -->`;
	const von = text.indexOf(anfang);
	const bis = text.indexOf(ende);
	if (von < 0 || bis < von) {
		throw new Error(`Markierung „${marke}“ fehlt.`);
	}
	return `${text.slice(0, von + anfang.length)}\n${inhalt}\n${text.slice(bis)}`;
};

/** Wendet alle Abschnitte an. Gibt die veralteten Stellen zurück; schreibt nur mit `schreiben`. */
export const abgleichen = (wurzel: string, schreiben: boolean) => {
	const veraltet: string[] = [];
	for (const datei of new Set(ABSCHNITTE.map((a) => a.datei))) {
		const pfad = path.join(wurzel, datei);
		const alt = readFileSync(pfad, 'utf8');
		let neu = alt;
		for (const { inhalt, marke } of ABSCHNITTE.filter((a) => a.datei === datei)) {
			const danach = setzeAbschnitt(neu, marke, inhalt(wurzel));
			if (danach !== neu) {
				veraltet.push(`${datei}: ${marke}`);
			}
			neu = danach;
		}
		if (schreiben && neu !== alt) {
			writeFileSync(pfad, neu);
		}
	}
	return veraltet;
};

if (require.main === module) {
	const pruefen = process.argv.includes('--pruefen');
	try {
		const veraltet = abgleichen(WURZEL, !pruefen);
		if (pruefen && veraltet.length > 0) {
			console.error(`Veraltet (behebt „pnpm run quellen“):\n  ${veraltet.join('\n  ')}`);
			process.exitCode = 1;
		} else if (!pruefen) {
			console.log(veraltet.length > 0 ? `Neu geschrieben:\n  ${veraltet.join('\n  ')}` : 'Alles aktuell.');
		}
	} catch (fehler) {
		console.error(fehler instanceof Error ? fehler.message : fehler);
		process.exitCode = 1;
	}
}
