import { abschnitt as bildrahmen } from './formen/Bildrahmen';
import { abschnitt as blasen } from './formen/Blasen';
import { abschnitt as grundformen } from './formen/Grundformen';
import { abschnitt as text } from './formen/Text';
import type { FormenAbschnitt } from './formen/typ';
import { abschnitt as werkzeuge } from './formen/Werkzeuge';

/**
 * Abschnitte in der Reihenfolge der Schublade „Werkzeuge“ (3-formen.md, Inhalt; 175: Text gleich nach der
 * Werkzeugreihe). Jedes Ticket füllt nur seine Datei unter `formen/`; ein Abschnitt, der `null` ist, fehlt ganz.
 */
export const ABSCHNITTE: readonly FormenAbschnitt[] = [
	werkzeuge, // 104 (Knöpfe aus 098; R O Y L ★ bringt 107)
	text, // 175 (Schmuckschrift aus der früheren Schublade „Text“, 105)
	grundformen, // 104
	blasen, // 107
	bildrahmen, // 111
].filter((a): a is FormenAbschnitt => a !== null);
