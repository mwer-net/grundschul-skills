/**
 * Rezept „Zirkus“ (114, Tabelle in schubladen/7-rezepte.md): Rot, Orange, Gelb, Navy; Creme, auf dem Deckblatt mit
 * Streifen; Welle mit Verlauf Rot → Orange; gepunkteter Rahmen in Rot mit runden Ecken; Punkte unten links, Sterne und
 * Dreiecke am Rand des Deckblatts; Titel weiß auf dem Band.
 */

import type { Zone } from '../streuen';
import type { Aufmachung, AufmachungsFormat, FormatDaten, StreuZone } from './typ';
import { SEITEN_MASSE } from './typ';

/** Streifen der Breite `breite` an allen vier Seiten. */
const raender = (format: AufmachungsFormat, breite: number): Zone[] => {
	const { b, h } = SEITEN_MASSE[format];
	return [
		{ x: 0, y: 0, b, h: breite },
		{ x: 0, y: h - breite, b, h: breite },
		{ x: 0, y: breite, b: breite, h: h - 2 * breite },
		{ x: b - breite, y: breite, b: breite, h: h - 2 * breite },
	];
};

/**
 * Die Ecke unten links als L im Seitenrand: ein Streifen links (`rand` breit, `h` hoch) und einer unten (`b` breit,
 * `rand` hoch). So liegen die Punkte nie hinter Inhalt.
 */
const untenLinks = (format: AufmachungsFormat, b: number, h: number, rand: number): Zone[] => {
	const hoehe = SEITEN_MASSE[format].h;
	return [
		{ x: 0, y: hoehe - h, b: rand, h: h - rand },
		{ x: 0, y: hoehe - rand, b, h: rand },
	];
};

interface Mass {
	/** Rand des Deckblatts mit Sternen. */
	rand: number;
	/** Ecke mit Punkten. */
	ecke: { b: number; h: number };
	/** Breite des Seitenrands, in dem die Punkte liegen (etwas weniger als `--rand`). */
	seitenrand: number;
	groesse: 'klein' | 'mittel' | 'gross';
	streifen: number;
	rahmen: FormatDaten['rahmen'];
}

const MASSE: Readonly<Record<AufmachungsFormat, Mass>> = {
	'a4-hoch': {
		rand: 60,
		ecke: { b: 260, h: 300 },
		seitenrand: 54,
		groesse: 'mittel',
		streifen: 48,
		rahmen: { farbe: 'var(--a1)', staerke: 4, abstand: 24, ecke: 24 },
	},
	'a4-quer': {
		rand: 60,
		ecke: { b: 300, h: 260 },
		seitenrand: 54,
		groesse: 'mittel',
		streifen: 48,
		rahmen: { farbe: 'var(--a1)', staerke: 4, abstand: 24, ecke: 24 },
	},
	'a5-hoch': {
		rand: 40,
		ecke: { b: 160, h: 180 },
		seitenrand: 36,
		groesse: 'klein',
		streifen: 32,
		rahmen: { farbe: 'var(--a1)', staerke: 3, abstand: 22, ecke: 16 },
	},
	'a3-hoch': {
		rand: 80,
		ecke: { b: 380, h: 420 },
		seitenrand: 54,
		groesse: 'gross',
		streifen: 64,
		rahmen: { farbe: 'var(--a1)', staerke: 5, abstand: 32, ecke: 32 },
	},
	folie: {
		rand: 40,
		ecke: { b: 200, h: 170 },
		seitenrand: 44,
		groesse: 'klein',
		streifen: 40,
		rahmen: { farbe: 'var(--a1)', staerke: 3, abstand: 20, ecke: 20 },
	},
};

const FARBEN = ['a1', 'a2', 'a3', 'a4'] as const;

const daten = (format: AufmachungsFormat): FormatDaten => {
	const m = MASSE[format];
	const punkte: StreuZone = {
		rechtecke: untenLinks(format, m.ecke.b, m.ecke.h, m.seitenrand),
		art: 'punkte',
		formen: ['punkt'],
		dichte: 0.8,
		farben: FARBEN,
		groesse: m.groesse,
		ecke: 'ul',
	};
	const sterne: StreuZone = {
		rechtecke: raender(format, m.rand),
		art: 'konfetti',
		formen: ['stern', 'dreieck', 'punkt'],
		dichte: 0.45,
		farben: FARBEN,
		groesse: m.groesse === 'klein' ? 'mittel' : 'gross',
	};
	return {
		flaeche: (deckblatt) =>
			deckblatt
				? { art: 'muster', muster: 'streifen', f1: 'var(--a-flaeche)', f2: 'var(--a-muster)', musterGroesse: m.streifen }
				: { art: 'farbe', f1: 'var(--a-flaeche)' },
		rahmen: m.rahmen,
		zonen: (deckblatt) => (deckblatt ? [sterne] : [punkte]),
	};
};

export const aufmachung: Aufmachung | null = {
	id: 'zirkus',
	name: 'Zirkus',
	beschreibung: 'Bunt und festlich: Welle oben, gepunkteter Rahmen, Punkte in der Ecke, Sterne auf dem Deckblatt.',
	farbwelten: [
		{
			name: 'Manege',
			a1: '#e63946',
			a2: '#f77f00',
			a3: '#fcbf49',
			a4: '#1d3557',
			aFlaeche: '#fff8ec',
			aTitel: '#ffffff',
			aTitelOhneBand: '#1d3557',
			aMuster: '#fdebd0',
		},
		{
			name: 'Zuckerwatte',
			a1: '#d6336c',
			a2: '#f06595',
			a3: '#ffd43b',
			a4: '#3b2f7a',
			aFlaeche: '#fff5f9',
			aTitel: '#ffffff',
			aTitelOhneBand: '#3b2f7a',
			aMuster: '#fde2ec',
		},
		{
			name: 'Abendvorstellung',
			a1: '#1971c2',
			a2: '#7048e8',
			a3: '#fcc419',
			a4: '#e03131',
			aFlaeche: '#f1f6ff',
			aTitel: '#ffffff',
			aTitelOhneBand: '#1971c2',
			aMuster: '#dfe9fb',
		},
	],
	standard: {
		farben: 1,
		kopfband: 'welle',
		rahmen: 'gepunktet',
		konfetti: { menge: 0.6, formen: ['punkt', 'dreieck', 'stern'] },
	},
	formate: {
		'a4-hoch': daten('a4-hoch'),
		'a4-quer': daten('a4-quer'),
		'a5-hoch': daten('a5-hoch'),
		'a3-hoch': daten('a3-hoch'),
		folie: daten('folie'),
	},
};
