import type { ReactNode } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import type { PfadTeil } from './darstellung';

interface Eigenschaften {
	pfad: PfadTeil[];
	waehle: (nr: number | null) => void;
	/** Was die folgenden Issues hier einhängen: Text, Bilder, Abbildungen … */
	children?: ReactNode;
}

/** Rechts neben dem Blatt (iPad hoch: darunter): was gewählt ist und was sich damit tun lässt. */
export const AuswahlPanel = ({ children, pfad, waehle }: Eigenschaften) => {
	const gewaehlt = pfad.at(-1);
	if (!gewaehlt) {
		return (
			<div>
				<h2 className="text-xl">Auswahl</h2>
				<p className="mt-2 text-leise">
					Tippe auf einen Teil des Blatts, zum Beispiel eine Aufgabe oder eine Überschrift, um ihn
					auszuwählen.
				</p>
			</div>
		);
	}
	return (
		<div data-auswahl={gewaehlt.baustein.art}>
			<nav aria-label="Wo im Blatt" className="-ml-2 flex flex-wrap items-center" data-breadcrumb>
				{pfad.map((teil, i) => (
					<span key={teil.nr} className="flex items-center">
						{i > 0 && <span className="px-0.5 text-leise">›</span>}
						<button
							type="button"
							className="min-h-11 rounded-lg px-2 font-bold text-brand-600 hover:bg-brand-50 aria-[current=true]:text-tinte"
							aria-current={teil === gewaehlt}
							onClick={() => waehle(teil.nr)}
						>
							{teil.name}
						</button>
					</span>
				))}
			</nav>
			<h2 className="mt-2 text-xl">{gewaehlt.name}</h2>
			{children}
			<Knopf art="leise" className="mt-4 -ml-5" onClick={() => waehle(null)}>
				<Symbol name="schliessen" />
				Auswahl aufheben
			</Knopf>
		</div>
	);
};
