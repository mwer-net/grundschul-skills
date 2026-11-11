import { abschnitt as bildrahmen } from './formen/Bildrahmen';
import { abschnitt as blasen } from './formen/Blasen';
import { abschnitt as grundformen } from './formen/Grundformen';
import type { FormenAbschnitt } from './formen/typ';
import { abschnitt as werkzeuge } from './formen/Werkzeuge';

/**
 * Abschnitte in der Reihenfolge der Schublade (3-formen.md, Inhalt). Jedes Ticket füllt nur seine Datei unter
 * `formen/`; ein Abschnitt, der `null` ist, fehlt ganz. Kombinieren (121) kommt als eigener Abschnitt dazu.
 */
export const ABSCHNITTE: readonly FormenAbschnitt[] = [
	werkzeuge, // 104 (Knöpfe aus 098; R O Y L ★ bringt 107)
	grundformen, // 104
	blasen, // 107
	bildrahmen, // 111
].filter((a): a is FormenAbschnitt => a !== null);
