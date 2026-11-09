/**
 * Erzeugt die Tabellen in den Skill-Texten aus ihren Quellen (062). Eingecheckt bleiben sie, damit die Skills ohne
 * Schoolbox nutzbar sind (Entscheidung 9). Nur Node, keine Abhängigkeiten: `ausrollen.sh` prüft damit einen fremden Stand.
 *
 *   tsx kern/src/quellen.ts            schreibt die Abschnitte zwischen den Markierungen
 *   tsx kern/src/quellen.ts --pruefen  vergleicht nur; Exit 1, wenn etwas veraltet ist
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { aufmachungenTabelle } from './aufmachungen/index';
import { blattFarbenListe } from './blatt-farben';
import { figurenListe } from './figuren';
import { formenTabelle } from './formen';
import { GESTALTUNG_ARTEN } from './gestaltung-arten';
import type { ArtAngaben } from './werte';
import { ART_ANGABEN, ARTEN, VORLAGE_FORMAT } from './werte';

const WURZEL = path.resolve(__dirname, '..', '..', '..');
const RUECKFRAGEN = 'skills/grundschul-didaktik/references/rueckfragen.md';
const DRUCK = 'skills/grundschul-didaktik/references/druck-und-platz.md';
const BLATT_CSS = 'skills/html-materialerstellung/assets/blatt.css';
const PRUEFUNG_JS = 'skills/html-materialerstellung/assets/pruefung.js';
const LAYOUT = 'skills/html-materialerstellung/references/layout.md';
const GESTALTUNG = 'skills/html-materialerstellung/references/gestaltung.md';

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

const formatJeArt = () => {
	const arten = ARTEN.map((a) => ART_ANGABEN[a]).filter((a) => a.optionen.length > 0);
	const zeilen = gruppiere(arten, ({ nichtFragen, optionen, umsetzung }) => ({
		nichtFragen,
		optionen,
		umsetzung,
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
	const zeilen = [...css.matchAll(/^body\.kl([1-4])\{--fs:(\d+)px;--abstand:(\d+)px\}/gm)].map((t) => [
		`Kl. ${t[1]}`,
		`${t[2]} px`,
		`${t[3]} px`,
	]);
	if (zeilen.length !== 4) {
		throw new Error(`${BLATT_CSS}: Schrift und Abstand von Kl. 1 bis 4 nicht gefunden.`);
	}
	return tabelle(['Klasse', 'Schrift', 'Abstand zwischen Aufgaben'], zeilen);
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
	{ datei: LAYOUT, marke: 'thema-regeln', inhalt: themaRegeln },
	// Gestaltung (Phase 12): Arten, Figuren, Formen, Farben des Blatts, Rezepte
	{ datei: GESTALTUNG, marke: 'gestaltung-arten', inhalt: gestaltungArten },
	{ datei: GESTALTUNG, marke: 'figuren', inhalt: figurenListe },
	{ datei: GESTALTUNG, marke: 'formen', inhalt: formenTabelle },
	{ datei: GESTALTUNG, marke: 'blatt-farben', inhalt: blattFarbenListe },
	{ datei: GESTALTUNG, marke: 'aufmachungen', inhalt: aufmachungenTabelle },
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
