import type { ReactNode } from 'react';

import { Kuerzel } from '../bausteine/Kuerzel';
import { BEFEHLE, kuerzelVon } from '../editor/befehle';

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

/**
 * Der Name eines Befehls in Anführungszeichen, aus dem Register wie in Menü und Palette (30). So läuft die Hilfe nicht
 * auseinander, wenn ein Befehl umbenannt wird.
 */
export const befehlName = (id: string) => {
	const befehl = BEFEHLE.find((b) => b.id === id);
	const titel = typeof befehl?.titel === 'string' ? befehl.titel : befehl?.hilfeTitel;
	if (!titel) {
		throw new Error(`Befehl ohne festen Namen: ${id}`);
	}
	return `„${titel}“`;
};

/** Das Kürzel eines Befehls aus dem Register, im Fließtext so groß wie der Text. */
export const BefehlTaste = ({ id }: { id: string }) => {
	const text = kuerzelVon(id);
	return text ? <Kuerzel text={text} className="text-[length:inherit]" /> : null;
};
