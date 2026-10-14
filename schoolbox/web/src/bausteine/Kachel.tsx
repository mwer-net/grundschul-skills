import type { ReactNode } from 'react';

import { klassen } from './klassen';

interface Eigenschaften {
	children: ReactNode;
	className?: string;
	/** Schneidet den Inhalt an den runden Ecken ab; ohne, wenn ein Menü über den Rand hinausragen muss. */
	beschnitten?: boolean;
}

/** Weiße Karte mit runden Ecken: der Rahmen für Mappen, Dokumente und Einträge im Papierkorb. */
export const Kachel = ({ beschnitten = true, children, className }: Eigenschaften) => (
	<div className={klassen(beschnitten && 'overflow-hidden', 'rounded-2xl bg-white shadow-karte', className)}>
		{children}
	</div>
);

export const Marke = ({ children }: { children: ReactNode }) => (
	<span className="inline-flex items-center rounded-full bg-entwurf px-3 py-0.5 text-sm font-bold">{children}</span>
);
