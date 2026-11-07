/**
 * Platzhalter für 111: eine Form ohne Text als Maske, als `polygon()` aus ihrem Pfad abgetastet (64 Punkte, beim Kreis
 * `circle()`). Die Pfade der Formen bestehen nur aus `M`, `L`, `C`, `Q`, `Z` (`zuegeAus` in `formen-geometrie.ts`).
 */

import type { FormWerte } from './formen';

/** `clip-path`-Wert für eine Form in der Größe `b` × `h`; füllt 111. */
export const maskeAusForm: ((art: string, param: FormWerte, b: number, h: number) => string | null) | null = null;
