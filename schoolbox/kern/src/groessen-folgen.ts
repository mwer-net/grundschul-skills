/**
 * Was neu entsteht, wenn sich die Größe eines Gestaltungselements ändert (104): `setzeLage` ruft `nachGroesse`, sobald
 * sich `--b` oder `--h` ändert. Jede Art, die ihren Inhalt aus der Größe erzeugt, hat hier eine Zeile. Eine Folge ändert
 * nur Elemente ihrer Art und gibt jede andere Quelle unverändert zurück.
 *
 * Die Module hier dürfen `gestaltung.ts` nicht laden (Ladekreis); sie arbeiten mit `quelltext.ts`.
 */

import { zeichneFormNeu } from './formen';
import { skaliereLinie } from './formen-linie';
import { skaliereZipfel } from './formen-text';

/** Die Quelle, nachdem das Element `nr` zu seiner neuen Größe passt. */
export type GroessenFolge = (quelle: string, nr: number) => string;

const FOLGEN: readonly GroessenFolge[] = [
	skaliereZipfel, // 107 Sprechblase: der Zipfel behält seine Länge (vor dem Neuzeichnen)
	skaliereLinie, // 107 Linie: Punkte wandern mit (vor dem Neuzeichnen, solange viewBox die alte Größe trägt)
	zeichneFormNeu, // 104 Formen: viewBox und d in Elementgröße; 107: auch `.form-text` (ihr svg) und die Spitzen
	// 109 Streuung, 110 Titel im Bogen, 111 Bildrahmen, 116 Pfad: je eine Zeile
];

export const nachGroesse = (quelle: string, nr: number) => FOLGEN.reduce((q, folge) => folge(q, nr), quelle);
