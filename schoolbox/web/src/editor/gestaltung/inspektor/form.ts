import type { InspektorTeil } from './abschnitte';
import { FormTeil } from './form-teile';

/** Formen der Liste in `kern/src/formen.ts`; eine `svg.form` mit unbekanntem `data-form` zeigt den Abschnitt nicht. */
export const FORM_TEILE: InspektorTeil[] = [
	// 107: auch Form mit Text (Sprechblase ↔ Band)
	{ id: 'form', abschnitt: 3, reihenfolge: 1, fuer: (art) => art === 'form' || art === 'formtext', Inhalt: FormTeil },
];
