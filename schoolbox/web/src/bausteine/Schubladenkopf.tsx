import type { ReactNode } from 'react';

import { Knopf } from './Knopf';
import type { MenueEintrag } from './Menue';
import { Menue } from './Menue';
import { Symbol } from './Symbol';

const MEHR_KNOPF = (
	<Knopf art="leise" groesse="klein" className="size-knopf-klein px-0">
		<Symbol name="mehr" />
	</Knopf>
);

interface Eigenschaften {
	titel: string;
	/** Knöpfe rechts neben dem Namen, etwa „Alle einklappen“ der Ebenen. */
	children?: ReactNode;
	/** Einträge für ⋯; ohne Einträge kein ⋯. */
	mehr?: MenueEintrag[];
}

/** Kopf einer Schublade: Name und ⋯ (5.2: Eine Schublade hat immer denselben Aufbau). */
export const Schubladenkopf = ({ children, mehr = [], titel }: Eigenschaften) => (
	<div className="flex h-10 flex-none items-center gap-1 border-b border-rand pr-1 pl-3" data-schubladenkopf>
		<h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{titel}</h2>
		{children}
		{mehr.length > 0 && <Menue name={`Mehr zu ${titel}`} rechtsbuendig ausloeser={MEHR_KNOPF} eintraege={mehr} />}
	</div>
);

/** Suchfeld oben in einer Schublade. */
export const Schubladensuche = ({
	beschriftung,
	platzhalter,
	setWert,
	wert,
}: {
	beschriftung: string;
	platzhalter: string;
	wert: string;
	setWert: (wert: string) => void;
}) => (
	<label className="relative block">
		<span className="sr-only">{beschriftung}</span>
		<Symbol
			name="suche"
			className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-leise"
		/>
		<input
			// Wie `EIGENE_GESCHICHTE`: ⌘Z im Feld gehört dem Feld.
			data-eigene-geschichte=""
			type="search"
			className="h-knopf w-full rounded-lg border border-rand bg-papier pr-2 pl-8 text-sm placeholder:text-leise focus:border-brand-500 focus:bg-flaeche focus:outline-none"
			placeholder={platzhalter}
			autoComplete="off"
			spellCheck={false}
			value={wert}
			onChange={(e) => setWert(e.target.value)}
		/>
	</label>
);
