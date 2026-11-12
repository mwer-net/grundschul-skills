import type { ReactNode } from 'react';

import { Hilfetipp } from './Hilfetipp';
import { klassen } from './klassen';

interface Eigenschaften {
	titel: ReactNode;
	/** `id` des Bedienelements rechts, damit ein Klick aufs Label dort ankommt. */
	fuer?: string;
	/** Name für „Hilfe zu …“, wenn `titel` kein Text ist. */
	name?: string;
	hilfe?: ReactNode;
	/** Sprungziel aus der Palette. */
	einstellung?: string;
	/** Beschriftung in einer eigenen Zeile, der Wert darunter über die volle Breite (Farbreihe, Kacheln, Textfeld). */
	darunter?: boolean;
	children: ReactNode;
}

/** Inspektor-Zeile: Label links, Wert rechts; mit `darunter` der Wert unter dem Label. */
export const Zeile = ({ children, darunter, einstellung, fuer, hilfe, name, titel }: Eigenschaften) => {
	const label = (
		<span className={klassen('flex min-w-0 items-center gap-1 text-leise', darunter && 'min-h-5')}>
			<label htmlFor={fuer} className="min-w-0">
				{titel}
			</label>
			{hilfe && <Hilfetipp name={name ?? (typeof titel === 'string' ? titel : '')}>{hilfe}</Hilfetipp>}
		</span>
	);
	return darunter ? (
		<div className="flex flex-col gap-0.5 py-0.5" data-zeile data-einstellung={einstellung}>
			{label}
			<div className="min-w-0">{children}</div>
		</div>
	) : (
		<div
			className="flex min-h-zeile flex-wrap items-center justify-between gap-x-2"
			data-zeile
			data-einstellung={einstellung}
		>
			{label}
			<span className="ml-auto flex flex-none items-center gap-1">{children}</span>
		</div>
	);
};
