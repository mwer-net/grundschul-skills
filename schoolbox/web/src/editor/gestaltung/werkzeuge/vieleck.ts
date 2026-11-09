import { formWerkzeug } from './aufziehen';
import type { Werkzeug } from './typ';

/** Vieleck aufziehen (107, 5.10), Taste Y; ⇧ gleiche Seiten, ⌥ aus der Mitte, Klick legt die Standardgröße ab. */
export const werkzeug: Werkzeug | null = formWerkzeug({
	id: 'vieleck',
	titel: 'Vieleck',
	art: 'vieleck',
	symbol: 'vieleck',
	taste: { code: 'KeyY' },
});
