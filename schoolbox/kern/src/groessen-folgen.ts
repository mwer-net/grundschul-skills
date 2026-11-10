/**
 * Was neu entsteht, wenn sich die Größe eines Gestaltungselements ändert (104): `setzeLage` ruft `nachGroesse`, sobald
 * sich `--b` oder `--h` ändert. Jede Art, die ihren Inhalt aus der Größe erzeugt, hat hier eine Zeile. Eine Folge ändert
 * nur Elemente ihrer Art und gibt jede andere Quelle unverändert zurück.
 *
 * Die Module hier dürfen `gestaltung.ts` nicht laden (Ladekreis); sie arbeiten mit `quelltext.ts`.
 */

import { zeichneFormNeu } from './formen';
import { skaliereLinie } from './formen-linie';
import { skalierePfad } from './formen-pfad'; // 116
import { skaliereZipfel } from './formen-text';
import { zeichneStreuungNeu } from './streuen'; // 109

/** Die Quelle, nachdem das Element `nr` zu seiner neuen Größe passt. */
export type GroessenFolge = (quelle: string, nr: number) => string;

const FOLGEN: readonly GroessenFolge[] = [
	skaliereZipfel, // 107 Sprechblase: der Zipfel behält seine Länge (vor dem Neuzeichnen)
	skaliereLinie, // 107 Linie: Punkte wandern mit (vor dem Neuzeichnen, solange viewBox die alte Größe trägt)
	skalierePfad, // 116 Pfad: `d` ist die Quelle, die Punkte strecken sich (Strich bleibt); `zeichneFormNeu` lässt ihn aus
	zeichneFormNeu, // 104 Formen: viewBox und d in Elementgröße; 107: auch `.form-text` (ihr svg) und die Spitzen
	zeichneStreuungNeu, // 109 Streuung: Teile in Elementgröße, dieselbe Saat
	// 110 Titel im Bogen, 111 Bildrahmen: je eine Zeile
];

export const nachGroesse = (quelle: string, nr: number) => FOLGEN.reduce((q, folge) => folge(q, nr), quelle);
