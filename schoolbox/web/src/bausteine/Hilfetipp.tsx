import type { ReactNode } from 'react';

import { Popover } from './Popover';
import { Symbol } from './Symbol';

/** Kleines ⓘ neben einem Label. Erklärt, was sonst als dauerhafter Satz im Panel stünde. */
export const Hilfetipp = ({ children, name }: { name: string; children: ReactNode }) => (
	<Popover
		name={`Hilfe zu ${name}`}
		ausloeser={
			<button
				type="button"
				className="inline-flex size-4 flex-none items-center justify-center rounded-full text-dezent hover:text-tinte"
				data-hilfetipp
			>
				<Symbol name="info" className="size-3" />
			</button>
		}
	>
		<p className="leading-4">{children}</p>
	</Popover>
);
