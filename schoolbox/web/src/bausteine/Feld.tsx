import type { ReactNode } from 'react';

import { klassen } from './klassen';

interface Eigenschaften {
	titel: ReactNode;
	/** Rechts neben dem Titel, z. B. ein `Hilfetipp`. */
	zusatz?: ReactNode;
	fehler?: string | null;
	/** `daneben`: Inspektor-Zeile, Label links, Wert rechts. */
	lage?: 'darueber' | 'daneben';
	children: ReactNode;
	className?: string;
}

/** Einheitlich für Eingabe und Select: Label, Wert, darunter die Fehlerzeile. */
export const Feld = ({ children, className, fehler, lage = 'darueber', titel, zusatz }: Eigenschaften) => (
	<label
		className={klassen(lage === 'daneben' ? 'flex h-zeile items-center justify-between gap-2' : 'block', className)}
	>
		<span
			className={klassen(
				'flex items-center gap-1 text-leise',
				lage === 'darueber' ? 'mb-0.5' : 'min-w-0 flex-none',
			)}
		>
			{titel}
			{zusatz}
		</span>
		{lage === 'daneben' ? <span className="flex min-w-0 flex-1 justify-end">{children}</span> : children}
		{fehler && (
			<span className="mt-0.5 block text-xs text-fehler" role="alert">
				{fehler}
			</span>
		)}
	</label>
);
