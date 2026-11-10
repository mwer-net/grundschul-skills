/**
 * Rezept „Ruhig“ (118, Tabelle in schubladen/7-rezepte.md): Dunkelgrau, Navy, Hellgrau; keine Fläche, kein Kopfband,
 * keine Streuung; ein feiner Rahmen in Hellgrau; Titel in Dunkelgrau. Für Lernkontrollen und Kopierblätter: In s/w
 * sieht es fast aus wie ohne Rezept, das ist gewollt. Darf nicht wegfallen (F4).
 */

import type { Aufmachung, AufmachungsFormat, FormatDaten } from './typ';
import { AUFMACHUNG_FORMATE } from './typ';

const RAHMEN: Readonly<Record<AufmachungsFormat, FormatDaten['rahmen']>> = {
	'a4-hoch': { farbe: 'var(--a3)', staerke: 2, abstand: 24, ecke: 0 },
	'a4-quer': { farbe: 'var(--a3)', staerke: 2, abstand: 24, ecke: 0 },
	'a5-hoch': { farbe: 'var(--a3)', staerke: 2, abstand: 22, ecke: 0 },
	'a3-hoch': { farbe: 'var(--a3)', staerke: 3, abstand: 32, ecke: 0 },
	'folie': { farbe: 'var(--a3)', staerke: 2, abstand: 20, ecke: 0 },
};

const daten = (format: AufmachungsFormat): FormatDaten => ({
	flaeche: () => null,
	rahmen: RAHMEN[format],
	zonen: () => [],
});

export const aufmachung: Aufmachung | null = {
	id: 'ruhig',
	name: 'Ruhig',
	beschreibung: 'Schlicht für Lernkontrollen und Kopien: feiner Rahmen, dunkler Titel, sonst nichts.',
	// Das Band (nur, wenn jemand es am Regler einschaltet) ist `--a1` → `--a2`, beide dunkel genug für Weiß.
	farbwelten: [
		{
			name: 'Grau',
			a1: '#343a40',
			a2: '#1d3557',
			a3: '#c4cad0',
			a4: '#6c757d',
			aFlaeche: '#f8f9fa',
			aTitel: '#ffffff',
			aTitelOhneBand: '#343a40',
			aMuster: '#e9ecef',
		},
		{
			name: 'Tinte',
			a1: '#1d3557',
			a2: '#343a40',
			a3: '#c3cedd',
			a4: '#5c6f8a',
			aFlaeche: '#f5f8fb',
			aTitel: '#ffffff',
			aTitelOhneBand: '#1d3557',
			aMuster: '#e3e9f1',
		},
		{
			name: 'Schiefer',
			a1: '#2f3e46',
			a2: '#354f52',
			a3: '#c5cfc2',
			a4: '#52796f',
			aFlaeche: '#f4f6f3',
			aTitel: '#ffffff',
			aTitelOhneBand: '#2f3e46',
			aMuster: '#e3e8e0',
		},
	],
	standard: {
		farben: 1,
		kopfband: 'ohne',
		rahmen: 'linie',
		konfetti: { menge: 0, formen: ['punkt'] },
	},
	formate: Object.fromEntries(AUFMACHUNG_FORMATE.map((f) => [f, daten(f)])) as Record<AufmachungsFormat, FormatDaten>,
};
