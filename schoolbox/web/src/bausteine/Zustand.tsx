import type { ReactNode } from 'react';

import type { SymbolName } from './Symbol';
import { Symbol } from './Symbol';

interface Eigenschaften {
	symbol: SymbolName;
	titel: string;
	children?: ReactNode;
}

/** Freundliche Fläche, wenn es (noch) nichts zu zeigen gibt oder etwas nicht geklappt hat. */
export const Zustand = ({ children, symbol, titel }: Eigenschaften) => (
	<div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-16 text-center">
		<Symbol name={symbol} className="size-14 text-brand-200" />
		<h2 className="text-2xl">{titel}</h2>
		{children}
	</div>
);
