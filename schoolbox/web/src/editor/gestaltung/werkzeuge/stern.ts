import { formWerkzeug } from './aufziehen';
import type { Werkzeug } from './typ';

/** Stern aufziehen (107, 5.10), keine Taste, nur der Knopf; ⇧ gleiche Seiten, ⌥ aus der Mitte, Klick legt die Standardgröße ab. */
export const werkzeug: Werkzeug | null = formWerkzeug({
	id: 'stern',
	titel: 'Stern',
	art: 'stern',
	symbol: 'stern',
});
