/**
 * Register der Rezepte (Aufmachungen, 114). Je Rezept eine Datei, die `aufmachung: Aufmachung | null` exportiert; 118
 * füllt die Platzhalter. Hier nur Daten, ohne den Rest des Kerns, damit `quellen.ts` die Tabelle erzeugen kann.
 */

import { aufmachung as detektiv } from './detektiv';
import { aufmachung as dschungel } from './dschungel';
import { aufmachung as ruhig } from './ruhig';
import type { Aufmachung } from './typ';
import { aufmachung as zirkus } from './zirkus';

export * from './typ';

export const AUFMACHUNGEN: readonly Aufmachung[] = [detektiv, zirkus, dschungel, ruhig].filter(
	(a): a is Aufmachung => a !== null,
);

export const aufmachungVon = (id: string | null | undefined) => AUFMACHUNGEN.find((a) => a.id === id) ?? null;

const KOPFBAND_NAMEN = { ohne: 'ohne', gerade: 'gerade', welle: 'Welle', bogen: 'Bogen', zacken: 'Zacken' } as const;

/** Tabelle der Rezepte für `gestaltung.md` (`pnpm run quellen`). */
export const aufmachungenTabelle = () =>
	[
		'| Rezept | `data-aufmachung` | Farbwelten (`data-aufmachung-farben` 1–3) | Kopfband | Rahmen | Konfetti |',
		'|---|---|---|---|---|---|',
		...AUFMACHUNGEN.map((a) => {
			const welten = a.farbwelten
				.map((w, i) => `${i + 1} ${w.name} (${[w.a1, w.a2, w.a3, w.a4].join(' ')})`)
				.join(', ');
			const k = a.standard.konfetti;
			return `| ${a.name} | \`${a.id}\` | ${welten} | ${KOPFBAND_NAMEN[a.standard.kopfband]} | ${a.standard.rahmen} | \`${k.menge} ${k.formen.join(' ')}\` |`;
		}),
	].join('\n');
