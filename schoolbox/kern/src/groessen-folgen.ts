/**
 * Was neu entsteht, wenn sich die Größe eines Gestaltungselements ändert (104): `setzeLage` ruft `nachGroesse`, sobald
 * sich `--b` oder `--h` ändert. Jede Art, die ihren Inhalt aus der Größe erzeugt, hat hier eine Zeile. Eine Folge ändert
 * nur Elemente ihrer Art und gibt jede andere Quelle unverändert zurück.
 *
 * Die Module hier dürfen `gestaltung.ts` nicht laden (Ladekreis); sie arbeiten mit `quelltext.ts`.
 */

import { zeichneFormNeu } from './formen';
import { zeichneStreuungNeu } from './streuen'; // 109

/** Die Quelle, nachdem das Element `nr` zu seiner neuen Größe passt. */
export type GroessenFolge = (quelle: string, nr: number) => string;

const FOLGEN: readonly GroessenFolge[] = [
	zeichneFormNeu, // 104 Formen: viewBox und d in Elementgröße
	zeichneStreuungNeu, // 109 Streuung: Teile in Elementgröße, dieselbe Saat
	// 110 Titel im Bogen, 111 Bildrahmen, 116 Pfad: je eine Zeile
];

export const nachGroesse = (quelle: string, nr: number) => FOLGEN.reduce((q, folge) => folge(q, nr), quelle);
