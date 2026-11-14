import { abschnitt as bildrahmen } from './formen/Bildrahmen';
import { abschnitt as blasen } from './formen/Blasen';
import { abschnitt as grundformen } from './formen/Grundformen';
import { abschnitt as text } from './formen/Text';
import type { FormenAbschnitt } from './formen/typ';
import { abschnitt as werkzeuge } from './formen/Werkzeuge';

/**
 * Abschnitte in der Reihenfolge der Schublade „Werkzeuge“ (3-formen.md, Inhalt; 198-18: Text, Formen, Sprechblasen;
 * „Zeichnen“ mit Stift, Form aus Punkten und Konfetti danach, 198-10). Jedes Ticket füllt nur seine Datei unter
 * `formen/`; ein Abschnitt, der `null` ist, fehlt ganz.
 */
export const ABSCHNITTE: readonly FormenAbschnitt[] = [
	text, // 175 (Schmuckschrift aus der früheren Schublade „Text“, 105)
	grundformen, // 104, 198-18: mit Linie und Pfeil
	blasen, // 107
	werkzeuge, // 098, 198-10: nur noch die drei Zeichenwerkzeuge
	bildrahmen, // 111
].filter((a): a is FormenAbschnitt => a !== null);
