/**
 * Erzeugt die Tabellen in den Skill-Texten aus ihren Quellen (062). Eingecheckt bleiben sie, damit die Skills ohne
 * Schoolbox nutzbar sind (Entscheidung 9). Nur Node, keine Abhängigkeiten: `ausrollen.sh` prüft damit einen fremden Stand.
 *
 *   tsx kern/src/quellen.ts            schreibt die Abschnitte zwischen den Markierungen
 *   tsx kern/src/quellen.ts --pruefen  vergleicht nur; Exit 1, wenn etwas veraltet ist
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { blattFarbenListe } from './blatt-farben';
import { formateFuerAuftrag, formateTabelle } from './einheit-aufgaben';
import { pflichtTabelle } from './einheit-bau';
import { figurenListe } from './figuren';
import { formenTabelle } from './formen';
import { GESTALTUNG_ARTEN } from './gestaltung-arten';
import type { Art, ArtAngaben } from './werte';
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
const HTML_SKILL = 'skills/html-materialerstellung/SKILL.md';

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

const klassenWerte = (wurzel: string) => {
	const css = readFileSync(path.join(wurzel, BLATT_CSS), 'utf8');
	const mitZeitziel = new Map(
		[...css.matchAll(/^body\.kl([1-4])\[data-zeit\]\{--fs:(\d+)px(?:;--abstand:(\d+)px)?/gm)].map((t) => [
			t[1],
			`; mit \`data-zeit\` ${t[2]} px${t[3] ? `, Abstand ${t[3]} px` : ''}`,
		]),
	);
	const aelter = new Map(
		[...css.matchAll(/^body\.kl([1-4])\{--fs:(\d+)px;--abstand:(\d+)px\}/gm)].map((t) => [
			t[1],
			`${t[2]} px, Abstand ${t[3]} px${mitZeitziel.get(t[1] ?? '') ?? ''}`,
		]),
	);
	const zeilen = [
		...css.matchAll(/^body\.kl([1-4])\[data-satz="2"\][^{]*\{--fs:(\d+)px;--abstand:(\d+)px;--zh:([\d.]+)/gm),
	].map((t) => [
		`Kl. ${t[1]}`,
		`${t[2]} px (${String(Math.round(Number(t[2]) * 0.75)).replace('.', ',')} pt)`,
		`${t[3]} px`,
		(t[4] ?? '').replace('.', ','),
		aelter.get(t[1] ?? '') ?? '',
	]);
	if (zeilen.length !== 4 || aelter.size !== 4) {
		throw new Error(`${BLATT_CSS}: Schrift und Abstand von Kl. 1 bis 4 nicht gefunden.`);
	}
	return tabelle(
		['Klasse', 'Schrift', 'Abstand zwischen Aufgaben', 'Zeilenhöhe', 'Ältere Blätter (ohne `data-satz`)'],
		zeilen,
	);
};

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

const LAUF_MELDUNGEN = 'schoolbox/kern/src/einheit.ts';
const KI_WERKZEUG = 'schoolbox/server/src/ki-werkzeug.ts';
const STUFEN = ['FEHLER', 'WARNUNG', 'HINWEIS'];

/** Liest eine Zahl oder Liste aus dem Quelltext; fehlt sie, ist der Erzeuger veraltet, nicht die Tabelle. */
const leser = (datei: string, text: string) => ({
	zahl: (name: string) => {
		const wert = new RegExp(`\\b${name} = ([\\d.]+)`).exec(text)?.[1];
		if (wert === undefined) {
			throw new Error(`${datei}: ${name} nicht gefunden.`);
		}
		return Number(wert);
	},
	treffer: (muster: RegExp) => {
		const t = muster.exec(text);
		if (!t) {
			throw new Error(`${datei}: ${muster.source} nicht gefunden.`);
		}
		return t.slice(1).map((w) => w ?? '');
	},
});

const prozent = (anteil: number) => `${Math.round(anteil * 100)} %`;
const zahlen = (objekt: string) => [...objekt.matchAll(/\d: (\d+)/g)].map((t) => t[1]).join('/');
const codeListe = (text: string) => [...text.matchAll(/['"]([a-z-]+)['"]/g)].map((t) => t[1] ?? '');

/**
 * Wann jede Meldung kommt, mit den Schwellen aus `pruefung.js` und den Meldungen, die nur der Lauf der Schoolbox
 * kennt (224). Stufen und Codes liest sie aus den Aufrufen; ein neuer Code ohne Zeile hier bricht ab.
 */
const pruefSchwellen = (wurzel: string) => {
	const js = readFileSync(path.join(wurzel, PRUEFUNG_JS), 'utf8');
	const lauf = readFileSync(path.join(wurzel, LAUF_MELDUNGEN), 'utf8');
	const werkzeug = readFileSync(path.join(wurzel, KI_WERKZEUG), 'utf8');
	const { treffer, zahl } = leser(PRUEFUNG_JS, js);
	const [satz2, mitZeit, aelter] = treffer(
		/const RICHTWERT = satz2 \? (\{[^}]+\})\[kl\] \|\| \d+ : zeitziel \? (\{[^}]+\})\[kl\] \|\| \d+ : (\{[^}]+\})/,
	);
	const [abstandSatz2, abstandAelter] = treffer(/ABSTAND_MIN = satz2 \? (\d+) : (\d+)/);
	const [karte, stein, kind] = treffer(/KANTE_MIN = \{ karte: (\d+), stein: (\d+), kind: (\d+) \}/);
	const [zeitArten] = leser(LAUF_MELDUNGEN, lauf).treffer(/const MIT_ZEITZIEL[^=]*= \[([^\]]*)\]/);
	const [ohne] = leser(KI_WERKZEUG, werkzeug).treffer(/const HINWEIS_OHNE[^=]*= \[([^\]]*)\]/);
	const druckrand = zahl('DRUCKRAND');
	const satz = '`data-satz="2"`';
	const WANN: Record<string, string> = {
		'schrift-fehlt': 'Andika, Fredoka oder die Schreibschrift ist nicht geladen',
		'minibuch-seiten': 'Mini-Book ohne genau acht Seiten',
		abbildung: 'eine Abbildung lässt sich nicht zeichnen; der Grund steht im Text',
		'ueberlauf, rand': 'Inhalt ragt aus der Seite (`ueberlauf`) oder in den Seitenrand (`rand`)',
		abgeschnitten: 'Text ist abgeschnitten oder ragt über den Rand seiner Fläche',
		ueberlappung: 'zwei Inhalte überlappen sich',
		aussen: 'ein Gestaltungselement liegt zu mehr als der Hälfte außerhalb der Seite',
		'bild-fehlt': 'ein Bild ist nicht geladen',
		pruefskript: 'die Prüfung selbst ist abgebrochen',
		'zeit-fehlt': 'mit Zeitziel: eine Aufgabe ohne `data-min`',
		'zeit-knapp': `mit Zeitziel: das kürzeste Niveau unter ${prozent(zahl('ZEIT_KNAPP'))} des Ziels`,
		'zeit-viel': `nur beim Bauen, mit Zeitziel: das längste Niveau über ${prozent(zahl('ZEIT_VIEL'))} des Ziels`,
		zahlenraum: 'eine Abbildung geht über den Zahlenraum der Klasse (erlaubt, nur prüfen)',
		druckrand: `Gestaltung mit Text oder Bild näher als ${druckrand} px (${Math.round((druckrand * 25.4) / 96)} mm) am Blattrand`,
		'schrift-klein': `Schrift unter ${prozent(zahl('SCHRIFT_MIN'))} der Schrift der Klasse, auf Folien der Folienschrift`,
		flaeche: `Fläche hinter Inhalt dunkler als ${zahl('FLAECHE_HELL')} von 255 und größer als ${zahl('FLAECHE_MIN')} px²`,
		'aufgaben-viele': `mehr Aufgaben (ohne ★) auf einer Seite als in Kl. 1/2/3/4: ${zahlen(satz2 ?? '')} mit ${satz}, ${zahlen(mitZeit ?? '')} mit Zeitziel im älteren Satz, sonst ${zahlen(aelter ?? '')}`,
		'rahmen-gross': `mit Zeitziel: Kopf höher als ${zahl('KOPF_MAX')} px oder Fuß höher als ${zahl('FUSS_MAX')} px`,
		'abstand-knapp': `weniger als ${abstandSatz2} px zwischen zwei Aufgaben mit ${satz}, sonst ${abstandAelter} px`,
		'platz-frei': `mehr als ${zahl('FREI_MAX')} px frei unten mit Zeitziel oder auf einer Arbeitsseite mit ${satz} (WARNUNG), sonst ab ${zahl('FREI_HINWEIS')} px (HINWEIS); nicht auf Folien, Karten und Mini-Books`,
		'inhalt-wenig': `Arbeitsseite mit ${satz}: weniger als ${zahl('AUFGABEN_MIN')} Aufgaben oder ${zahl('TEILE_MIN')} Teilaufgaben, oder mehr als ${zahl('LEER_MAX')} % der Fläche leer; \`data-dicht-ok\` nimmt die Seite aus`,
		'teile-viele': `${satz}: mehr als ${zahl('TEILE_MAX')} Teile zum Ausschneiden auf einer A4-Seite`,
		'teil-klein': `${satz}: kurze Kante einer Karte unter ${karte} mm, Dominostein kleiner als ${zahl('STEIN_LANG_MIN')} × ${stein} mm, Teil zum Selbstschneiden unter ${kind} mm`,
		'motiv-klein': `${satz}: das Motiv füllt weniger als ${prozent(zahl('MOTIV_MIN'))} der Karte innerhalb ihres Rands`,
		'schnitt-knapp': `${satz}: Text oder Bild näher als ${zahl('SCHNITT_MIN')} mm an der Schnittkante`,
		'thema-klasse': 'nur beim Bauen: `thema.css` nennt eine Klasse, die `blatt.css` nicht kennt',
		'thema-layout': 'nur beim Bauen: `thema.css` setzt Layout statt Aussehen',
		'kit-anteil': `nur beim Bauen: weniger als ${zahl('KIT_MINDEST')} % der Elemente mit Klasse nutzen nur Kit-Klassen`,
		masstab: 'Abbildungen mit echten Maßen: in Originalgröße drucken',
		verdeckt: `Gestaltung vorne oder am Anker verdeckt Inhalt um mehr als ${zahl('VERDECKT_MIN')} px²`,
		'kontrast-sw': `in s/w: Text mit Kontrast unter ${zahl('KONTRAST_MIN')}:1 zu seiner Fläche`,
		'farbwort-sw': 'in s/w: der Text nennt Farben',
		'bild-kontrast-sw': `in s/w: ein Bild, dessen Grauwerte weniger als ${zahl('BILD_SPANNE_MIN')} von 255 auseinanderliegen`,
		'bild-unscharf': `ein Bild hat im Druck unter ${zahl('DPI_MIN')} dpi`,
		'notiz-fehlt': 'eine Folie ohne Notiz, wenn eine andere Folie eine hat',
		platzhalter: 'Platzhalter auf der Seite (Entwurf)',
		ausgeblendet: 'einmal je Material: Elemente mit `data-aus` werden nicht gedruckt',
		'zeitziel-fehlt': `nur im Lauf der Schoolbox: ${codeListe(zeitArten ?? '')
			.map((a) => (a in ART_ANGABEN ? ART_ANGABEN[a as Art].name : a))
			.join(', ')} mit ${satz} und Aufgaben, aber ohne \`data-zeit\` am \`<body>\``,
		'loesung-fehlt': 'nur im Lauf der Schoolbox: je Aufgabe, deren Antwortlinien keine Lösung haben',
	};
	const stufen = new Map<string, Set<string>>();
	const neben = (code: string, stufe: string) => stufen.set(code, (stufen.get(code) ?? new Set()).add(stufe));
	for (const t of js.matchAll(/melde\("([A-Z]+)", [^,]+, ([^,]+),/g)) {
		const codes = codeListe(t[2] ?? '');
		neben(codes.join(', '), t[1] ?? '');
	}
	for (const t of js.matchAll(/stufe: "([A-Z]+)", seite: \d+, code: "([a-z-]+)"/g)) {
		neben(t[2] ?? '', t[1] ?? '');
	}
	for (const t of lauf.matchAll(/stufe: '([A-Z]+)',\s*seite: [^,]+,\s*code: '([a-z-]+)'/g)) {
		neben(t[2] ?? '', t[1] ?? '');
	}
	const ohneLauf = codeListe(ohne ?? '');
	const fehlt = [...stufen.keys()].filter((c) => !WANN[c]);
	if (fehlt.length > 0) {
		throw new Error(`${PRUEFUNG_JS}: Meldung ohne Zeile in pruef-schwellen (quellen.ts): ${fehlt.join(', ')}.`);
	}
	const erste = (s: Set<string>) => Math.min(...[...s].map((x) => STUFEN.indexOf(x)));
	const zeilen = [...stufen]
		.sort(([, a], [, b]) => erste(a) - erste(b))
		.map(([code, s]) => [
			code
				.split(', ')
				.map((c) => `\`${c}\``)
				.join(', '),
			STUFEN.filter((x) => s.has(x)).join(', '),
			`${WANN[code]}${ohneLauf.includes(code) ? '; im Lauf der Schoolbox nicht im Bericht' : ''}`,
		]);
	return tabelle(['Code', 'Stufe', 'Wann'], zeilen);
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
	{ datei: HTML_SKILL, marke: 'pflichtlektuere', inhalt: pflichtTabelle },
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
