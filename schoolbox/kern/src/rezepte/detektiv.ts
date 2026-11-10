/**
 * Rezept „Detektiv“ (118, Tabelle in schubladen/7-rezepte.md): Navy, Orange, Türkis, Gelb; hellblaue Fläche; kein
 * Kopfband; gestrichelter Rahmen in Navy; Konfetti aus Dreiecken, Rauten und Punkten in zwei Ecken; Titel in Navy.
 * Für Rätsel und Knobelblätter.
 */

import { ECKE, eckeImRand, GROESSE } from './ecken';
import type { Aufmachung, AufmachungsFormat, FormatDaten, StreuZone } from './typ';
import { AUFMACHUNG_FORMATE } from './typ';

const RAHMEN: Readonly<Record<AufmachungsFormat, FormatDaten['rahmen']>> = {
	'a4-hoch': { farbe: 'var(--a1)', staerke: 3, abstand: 24, ecke: 12 },
	'a4-quer': { farbe: 'var(--a1)', staerke: 3, abstand: 24, ecke: 12 },
	'a5-hoch': { farbe: 'var(--a1)', staerke: 2, abstand: 22, ecke: 8 },
	'a3-hoch': { farbe: 'var(--a1)', staerke: 4, abstand: 32, ecke: 16 },
	'folie': { farbe: 'var(--a1)', staerke: 2, abstand: 20, ecke: 10 },
};

const daten = (format: AufmachungsFormat): FormatDaten => {
	const e = ECKE[format];
	const konfetti = (ecke: 'or' | 'ul', dichte: number): StreuZone => ({
		rechtecke: eckeImRand(format, ecke, e.b, e.h),
		art: 'konfetti',
		formen: ['dreieck', 'raute', 'punkt'],
		dichte,
		farben: ['a2', 'a3', 'a4'],
		groesse: GROESSE[format],
	});
	return {
		flaeche: () => ({ art: 'farbe', f1: 'var(--a-flaeche)' }),
		rahmen: RAHMEN[format],
		// Auf dem Deckblatt etwas dichter: Dort steht weniger Inhalt, der Rand trägt die Stimmung.
		zonen: (deckblatt) => [konfetti('or', deckblatt ? 0.7 : 0.55), konfetti('ul', deckblatt ? 0.7 : 0.55)],
	};
};

export const aufmachung: Aufmachung | null = {
	id: 'detektiv',
	name: 'Detektiv',
	beschreibung: 'Knifflig und spannend: hellblaue Fläche, gestrichelter Rahmen, Konfetti in zwei Ecken.',
	farbwelten: [
		{
			name: 'Spurensuche',
			a1: '#1d3557',
			a2: '#f77f00',
			a3: '#2a9d8f',
			a4: '#ffc43d',
			aFlaeche: '#eef5fc',
			aTitel: '#ffffff',
			aTitelOhneBand: '#1d3557',
			aMuster: '#dceaf8',
		},
		{
			name: 'Lupe',
			a1: '#3d348b',
			a2: '#e76f51',
			a3: '#2a9d8f',
			a4: '#f4a261',
			aFlaeche: '#f3f1fb',
			aTitel: '#ffffff',
			aTitelOhneBand: '#3d348b',
			aMuster: '#e4e0f5',
		},
		{
			name: 'Geheimakte',
			a1: '#22333b',
			a2: '#c1121f',
			a3: '#457b9d',
			a4: '#f2c14e',
			aFlaeche: '#eef3f6',
			aTitel: '#ffffff',
			aTitelOhneBand: '#22333b',
			aMuster: '#dbe5eb',
		},
	],
	standard: {
		farben: 1,
		kopfband: 'ohne',
		rahmen: 'gestrichelt',
		konfetti: { menge: 0.6, formen: ['dreieck', 'raute', 'punkt'] },
	},
	formate: Object.fromEntries(AUFMACHUNG_FORMATE.map((f) => [f, daten(f)])) as Record<AufmachungsFormat, FormatDaten>,
};
