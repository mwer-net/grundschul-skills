import { WERKZEUGE } from '../../gestaltung/werkzeuge';
import { Werkzeugknoepfe } from '../../gestaltung/werkzeuge/werkzeugknoepfe';
import type { FormenAbschnitt, FormenTeile } from './typ';
import { passtZurSuche } from './typ';

/** Die Schublade erscheint nur, wo frei gestaltet werden darf; dort gilt diese Lage. */
const LAGE = { frei: true };

const bereite = () => WERKZEUGE.filter((w) => w.bereit(LAGE));

/** Die Knöpfe aus 098; V allein zeigt `Werkzeugknoepfe` nicht, dann fehlt der Abschnitt (bis 107 R O Y L bringt). */
const Inhalt = (_t: FormenTeile) => <Werkzeugknoepfe lage={LAGE} />;

export const abschnitt: FormenAbschnitt | null = {
	id: 'werkzeuge',
	titel: 'Werkzeuge',
	zeigt: ({ suche }) => {
		const alle = bereite();
		return alle.length > 1 && passtZurSuche(['Werkzeuge', ...alle.map((w) => w.titel)], suche);
	},
	Inhalt,
};
