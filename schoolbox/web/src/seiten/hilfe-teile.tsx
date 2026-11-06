import type { ReactNode } from 'react';

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
