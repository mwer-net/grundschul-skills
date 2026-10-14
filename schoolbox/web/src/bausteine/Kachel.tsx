import type { ReactNode } from 'react';

import { klassen } from './klassen';

/** Weiße Karte mit runden Ecken: der Rahmen für Mappen, Dokumente und Einträge im Papierkorb. */
export const Kachel = ({ children, className }: { children: ReactNode; className?: string }) => (
	<div className={klassen('overflow-hidden rounded-2xl bg-white shadow-karte', className)}>{children}</div>
);

export const Marke = ({ children }: { children: ReactNode }) => (
	<span className="inline-flex items-center rounded-full bg-entwurf px-3 py-0.5 text-sm font-bold">{children}</span>
);
