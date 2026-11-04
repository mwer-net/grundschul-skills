import type { ReactNode } from 'react';

import { klassen } from './klassen';

/** Weiße Fläche mit 1 px Rand. */
export const Karte = ({ children, className }: { children: ReactNode; className?: string }) => (
	<div className={klassen('rounded-2xl border border-rand bg-flaeche', className)}>{children}</div>
);
