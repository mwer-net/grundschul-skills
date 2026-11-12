import { klassen } from './klassen';

interface Wert<T extends string> {
	wert: T;
	titel: string;
}

interface Eigenschaften<T extends string> {
	werte: Wert<T>[];
	wert: T;
	waehle: (wert: T) => void;
	beschriftung: string;
	aus?: boolean;
	className?: string;
	/** Über die volle Breite, Teile gleich breit (vier Teile in `Zeile darunter`). */
	voll?: boolean;
}

/** Zwei bis vier Werte. Ein Zustand, keine Aktion: darum grauer Grund und nie blau (Befund B2). */
export const Segment = <T extends string>({
	aus,
	beschriftung,
	className,
	voll,
	waehle,
	wert,
	werte,
}: Eigenschaften<T>) => (
	<div
		role="group"
		aria-label={beschriftung}
		className={klassen('rounded-md bg-flaeche-2 p-0.5', voll ? 'flex w-full' : 'inline-flex flex-none', className)}
	>
		{werte.map((w) => (
			<button
				key={w.wert}
				type="button"
				aria-pressed={w.wert === wert}
				disabled={aus}
				className={klassen(
					'min-h-[max(22px,var(--hoehe-knopf-status))] min-w-[var(--hoehe-knopf-status)] rounded-sm px-2 text-sm font-medium whitespace-nowrap transition-colors duration-[120ms] disabled:opacity-50',
					w.wert === wert ? 'bg-flaeche text-tinte shadow-1' : 'text-leise hover:text-tinte',
					voll && 'min-w-0 flex-1 px-1',
				)}
				onClick={() => waehle(w.wert)}
			>
				{w.titel}
			</button>
		))}
	</div>
);
