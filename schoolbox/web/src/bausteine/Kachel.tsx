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
	<div className={klassen(beschnitten && 'overflow-hidden', 'rounded-xl border border-rand bg-flaeche', className)}>
		{children}
	</div>
);

export const Marke = ({ children }: { children: ReactNode }) => (
	<span className="inline-flex items-center rounded-full bg-entwurf px-2 text-xs font-medium">{children}</span>
);
