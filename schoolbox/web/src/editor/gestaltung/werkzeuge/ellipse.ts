import { formWerkzeug } from './aufziehen';
import type { Werkzeug } from './typ';

/** Ellipse aufziehen (107, 5.10), Taste O; ⇧ gleiche Seiten, ⌥ aus der Mitte, Klick legt die Standardgröße ab. */
export const werkzeug: Werkzeug | null = formWerkzeug({
	id: 'ellipse',
	titel: 'Ellipse',
	art: 'ellipse',
	symbol: 'ellipse',
	taste: { code: 'KeyO' },
});
