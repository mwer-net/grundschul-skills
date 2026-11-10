/**
 * Rezept „Dschungel“ (118, Tabelle in schubladen/7-rezepte.md): Grün, Dunkelgrün, Gelb, Türkis; hellgrüne Fläche;
 * Welle mit Verlauf Grün → Dunkelgrün; Rahmen als Linie in Grün; Punkte in den beiden unteren Ecken; Titel weiß auf
 * dem Band. Für Natur und Sachunterricht.
 *
 * Das Band ist `--a1` → `--a2`: Beide Farben jeder Farbwelt sind so dunkel, dass der weiße Titel mindestens 4,5 : 1
 * hat (Test in `aufmachungen.test.ts`). Oben liegen keine Punkte, dort ist das Band.
 */

import { ECKE, eckeImRand, GROESSE } from './ecken';
import type { Aufmachung, AufmachungsFormat, FormatDaten, StreuZone } from './typ';
import { AUFMACHUNG_FORMATE } from './typ';

const RAHMEN: Readonly<Record<AufmachungsFormat, FormatDaten['rahmen']>> = {
	'a4-hoch': { farbe: 'var(--a1)', staerke: 3, abstand: 24, ecke: 16 },
	'a4-quer': { farbe: 'var(--a1)', staerke: 3, abstand: 24, ecke: 16 },
	'a5-hoch': { farbe: 'var(--a1)', staerke: 2, abstand: 22, ecke: 12 },
	'a3-hoch': { farbe: 'var(--a1)', staerke: 4, abstand: 32, ecke: 20 },
	'folie': { farbe: 'var(--a1)', staerke: 2, abstand: 20, ecke: 12 },
};

const daten = (format: AufmachungsFormat): FormatDaten => {
	const e = ECKE[format];
	const punkte = (ecke: 'ul' | 'ur'): StreuZone => ({
		rechtecke: eckeImRand(format, ecke, e.b, e.h),
		art: 'punkte',
		formen: ['punkt'],
		dichte: 0.8,
		farben: ['a1', 'a3', 'a4'],
		groesse: GROESSE[format],
		ecke,
	});
	return {
		flaeche: () => ({ art: 'farbe', f1: 'var(--a-flaeche)' }),
		rahmen: RAHMEN[format],
		zonen: () => [punkte('ul'), punkte('ur')],
	};
};

export const aufmachung: Aufmachung | null = {
	id: 'dschungel',
	name: 'Dschungel',
	beschreibung: 'Grün und lebendig: Welle oben, hellgrüne Fläche, Punkte in den unteren Ecken.',
	farbwelten: [
		{
			name: 'Urwald',
			a1: '#2d6a4f',
			a2: '#1b4332',
			a3: '#f9c74f',
			a4: '#2a9d8f',
			aFlaeche: '#eef7e9',
			aTitel: '#ffffff',
			aTitelOhneBand: '#1b4332',
			aMuster: '#dcefd3',
		},
		{
			name: 'Lagune',
			a1: '#1d7874',
			a2: '#0b3c49',
			a3: '#f6bd60',
			a4: '#84a59d',
			aFlaeche: '#eaf6f4',
			aTitel: '#ffffff',
			aTitelOhneBand: '#0b3c49',
			aMuster: '#d3ece8',
		},
		{
			name: 'Mangrove',
			a1: '#3a5a40',
			a2: '#283618',
			a3: '#dda15e',
			a4: '#588157',
			aFlaeche: '#f1f5ea',
			aTitel: '#ffffff',
			aTitelOhneBand: '#283618',
			aMuster: '#e1ead5',
		},
	],
	standard: {
		farben: 1,
		kopfband: 'welle',
		rahmen: 'linie',
		konfetti: { menge: 0.6, formen: ['punkt'] },
	},
	formate: Object.fromEntries(AUFMACHUNG_FORMATE.map((f) => [f, daten(f)])) as Record<AufmachungsFormat, FormatDaten>,
};
