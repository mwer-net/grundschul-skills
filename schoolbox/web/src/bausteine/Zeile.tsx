import type { ReactNode } from 'react';

import { Hilfetipp } from './Hilfetipp';

interface Eigenschaften {
	titel: ReactNode;
	/** `id` des Bedienelements rechts, damit ein Klick aufs Label dort ankommt. */
	fuer?: string;
	/** Name für „Hilfe zu …“, wenn `titel` kein Text ist. */
	name?: string;
	hilfe?: ReactNode;
	children: ReactNode;
}

/** Inspektor-Zeile: Label links, Wert rechts. Bei knappem Platz bricht der Wert unter das Label. */
export const Zeile = ({ children, fuer, hilfe, name, titel }: Eigenschaften) => (
	<div className="flex h-zeile flex-wrap items-center justify-between gap-x-2" data-zeile>
		<span className="flex min-w-0 items-center gap-1 text-leise">
			<label htmlFor={fuer} className="min-w-0">
				{titel}
			</label>
			{hilfe && <Hilfetipp name={name ?? String(titel)}>{hilfe}</Hilfetipp>}
		</span>
		<span className="ml-auto flex flex-none items-center gap-1">{children}</span>
	</div>
);
