import type { ReactNode } from 'react';
import { useState } from 'react';

import { klassen } from './klassen';
import { Symbol } from './Symbol';

interface Eigenschaften {
	titel: string;
	/** `data-abschnitt`: fester Name, für Tests und die Reihenfolge. */
	name: string;
	/** Rechts leise, z. B. „gilt für alle 4 Einträge“. */
	notiz?: ReactNode;
	/** Zustand bleibt je Abschnitt erhalten (`localStorage`), sonst öffnete sich bei jeder Auswahl alles neu. */
	einklappbar?: boolean;
	/** Vorgabe, solange nichts gemerkt ist. */
	zu?: boolean;
	children: ReactNode;
	className?: string;
}

const schluessel = (name: string) => `schoolbox-abschnitt-${name}`;

const leseOffen = (name: string, vorgabe: boolean) => {
	try {
		const wert = localStorage.getItem(schluessel(name));
		return wert === null ? vorgabe : wert === '1';
	} catch {
		return vorgabe;
	}
};

/** Inspektor-Abschnitt: Titel klein, oben eine Linie. */
export const Abschnitt = ({ children, className, einklappbar, name, notiz, titel, zu }: Eigenschaften) => {
	const [offen, setOffen] = useState(() => (einklappbar ? leseOffen(name, !zu) : true));
	const umschalten = () => {
		setOffen(!offen);
		try {
			localStorage.setItem(schluessel(name), offen ? '0' : '1');
		} catch {
			// Ohne Speicher gilt der Zustand bis zum Neuladen.
		}
	};
	return (
		<section className={klassen('border-t border-rand px-3 py-2', className)} data-abschnitt={name}>
			{einklappbar ? (
				<button
					type="button"
					aria-expanded={offen}
					className="flex h-menue w-full items-center gap-1 text-left text-xs font-semibold text-leise"
					onClick={umschalten}
				>
					<Symbol name={offen ? 'runter' : 'rechts'} className="size-3 flex-none" />
					<span className="min-w-0 flex-1 truncate">{titel}</span>
					{notiz && <span className="font-normal text-dezent">{notiz}</span>}
				</button>
			) : (
				<h3 className="flex min-h-5 items-center justify-between gap-2 text-xs font-semibold text-leise">
					<span className="min-w-0 truncate">{titel}</span>
					{notiz && <span className="font-normal text-dezent">{notiz}</span>}
				</h3>
			)}
			{offen && <div className="mt-1 flex flex-col gap-1">{children}</div>}
		</section>
	);
};
