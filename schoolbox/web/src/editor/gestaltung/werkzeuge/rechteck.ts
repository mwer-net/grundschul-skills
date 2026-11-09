import { formWerkzeug } from './aufziehen';
import type { Werkzeug } from './typ';

/** Rechteck aufziehen (107, 5.10), Taste R; ⇧ gleiche Seiten, ⌥ aus der Mitte, Klick legt die Standardgröße ab. */
export const werkzeug: Werkzeug | null = formWerkzeug({
	id: 'rechteck',
	titel: 'Rechteck',
	art: 'rechteck',
	symbol: 'rechteck',
	taste: { code: 'KeyR' },
});
