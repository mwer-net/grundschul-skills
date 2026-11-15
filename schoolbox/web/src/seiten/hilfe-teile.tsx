import type { ReactNode } from 'react';

import { Kuerzel } from '../bausteine/Kuerzel';
import { kuerzelVon } from '../editor/befehle';

/** Teile der Hilfeseite, die auch die Abschnitte in eigenen Dateien brauchen (`hilfe-gestalten.tsx`). */

export interface Bild {
	datei: string;
	alt: string;
	geraet: 'Mac' | 'iPad';
}

export interface Abschnitt {
	id: string;
	titel: string;
	inhalt: ReactNode;
	bilder: Bild[];
}

export const Punkt = ({ children, titel }: { titel: string; children: ReactNode }) => (
	<li>
		<strong>{`${titel}: `}</strong>
		{children}
	</li>
);

/** Das Kürzel eines Befehls aus dem Register, im Fließtext so groß wie der Text. */
export const BefehlTaste = ({ id }: { id: string }) => {
	const text = kuerzelVon(id);
	return text ? <Kuerzel text={text} className="text-[length:inherit]" /> : null;
};
