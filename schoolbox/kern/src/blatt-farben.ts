/**
 * Die Farben des Blatts für `references/gestaltung.md` (112). Quelle ist die Liste `BLATT_FARBEN`, die der Farbwähler
 * benutzt (`web/src/bausteine/Farbwahl.tsx`). Gelesen wird der Text der Datei, nicht das Modul: `quellen.ts` läuft nur
 * mit Node, ohne React und ohne die Pakete der Oberfläche.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

export const FARBWAHL = 'schoolbox/web/src/bausteine/Farbwahl.tsx';

export interface BlattFarbe {
	wert: string;
	name: string;
}

/** Die Einträge aus `BLATT_FARBEN` und `WEISS`, in der Reihenfolge des Farbwählers. */
export const leseBlattFarben = (text: string): { farben: BlattFarbe[]; weiss: string } => {
	const liste = /export const BLATT_FARBEN = \[([\s\S]*?)\] as const/.exec(text)?.[1];
	const weiss = /export const WEISS = '([^']+)'/.exec(text)?.[1];
	if (!liste || !weiss) {
		throw new Error(`${FARBWAHL}: BLATT_FARBEN oder WEISS nicht gefunden.`);
	}
	const farben = [...liste.matchAll(/wert: '([^']+)', name: '([^']+)'/g)].map((t) => ({
		wert: t[1] ?? '',
		name: t[2] ?? '',
	}));
	if (farben.length === 0) {
		throw new Error(`${FARBWAHL}: BLATT_FARBEN ist leer.`);
	}
	return { farben, weiss };
};

/** Die Tabelle der Farben (Marke `blatt-farben`). */
export const blattFarbenListe = (wurzel: string) => {
	const { farben, weiss } = leseBlattFarben(readFileSync(path.join(wurzel, FARBWAHL), 'utf8'));
	return [
		'| Wert | Name im Farbwähler |',
		'|---|---|',
		...farben.map((f) => `| \`${f.wert}\` | ${f.name} |`),
		`| \`${weiss}\` | Weiß |`,
		'| `#rrggbb` | eigene Farbe |',
	].join('\n');
};
