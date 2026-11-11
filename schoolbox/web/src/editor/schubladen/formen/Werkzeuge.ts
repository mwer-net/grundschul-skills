import type { FormenAbschnitt } from './typ';
import { passtZurSuche } from './typ';
import { bereite } from './Werkzeuge-daten';
import { Inhalt } from './Werkzeuge-teile';

export const abschnitt: FormenAbschnitt | null = {
	id: 'werkzeuge',
	zeigt: ({ suche }) => {
		const alle = bereite();
		return (
			alle.length > 1 &&
			passtZurSuche(['Werkzeuge', ...alle.flatMap((w) => [w.titel, ...(w.suchwoerter ?? [])])], suche)
		);
	},
	Inhalt,
};
