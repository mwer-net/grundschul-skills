import type { KeyboardEvent } from 'react';

import { klassen } from './klassen';

interface Eintrag<T extends string> {
	wert: T;
	titel: string;
	aus?: boolean;
}

interface Eigenschaften<T extends string> {
	werte: Eintrag<T>[];
	wert: T | null;
	waehle: (wert: T) => void;
	beschriftung: string;
	className?: string;
}

/** Text-Reiter, aktiv mit 2 px unten. ←→ wechseln. */
export const Reiter = <T extends string>({ beschriftung, className, waehle, wert, werte }: Eigenschaften<T>) => {
	const taste = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
			return;
		}
		e.preventDefault();
		const frei = werte.filter((w) => !w.aus);
		const hier = frei.findIndex((w) => w.wert === werte[i]?.wert);
		const naechster = frei[(hier + (e.key === 'ArrowRight' ? 1 : -1) + frei.length) % frei.length];
		if (naechster) {
			waehle(naechster.wert);
			const liste = e.currentTarget.parentElement;
			requestAnimationFrame(() =>
				liste?.querySelector<HTMLElement>(`[data-reiter="${naechster.wert}"]`)?.focus(),
			);
		}
	};
	return (
		<div role="tablist" aria-label={beschriftung} className={klassen('flex items-end gap-3', className)}>
			{werte.map((w, i) => (
				<button
					key={w.wert}
					type="button"
					role="tab"
					aria-selected={w.wert === wert}
					tabIndex={w.wert === wert ? 0 : -1}
					disabled={w.aus}
					data-reiter={w.wert}
					className={klassen(
						'h-menue border-b-2 text-sm font-medium whitespace-nowrap disabled:opacity-40',
						w.wert === wert ? 'border-tinte text-tinte' : 'border-transparent text-leise hover:text-tinte',
					)}
					onClick={() => waehle(w.wert)}
					onKeyDown={(e) => taste(e, i)}
				>
					{w.titel}
				</button>
			))}
		</div>
	);
};
