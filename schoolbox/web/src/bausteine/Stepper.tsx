import { useEffect, useState } from 'react';

import { klassen } from './klassen';
import { Symbol } from './Symbol';

interface Eigenschaften {
	name: string;
	wert: number;
	setze: (wert: number) => void;
	min?: number;
	max?: number;
	schritt?: number;
	aus?: boolean;
	id?: string;
	/** Namen der Knöpfe, sonst „<Name> kleiner“ und „<Name> größer“. */
	minusName?: string;
	plusName?: string;
	/** Breite des Werts, wenn lange Zahlen vorkommen. */
	className?: string;
	/** Steht im Wertfeld rechts der Zahl, nie daneben (182). */
	einheit?: string;
}

/** Rahmen, Stufen und Wertfeld; `Abbildungspanel.tsx` nutzt sie für seine Zahlen, damit beide gleich aussehen. */
export const STEPPER_RAHMEN =
	'inline-flex h-feld flex-none items-stretch overflow-hidden rounded-md border border-rand-feld bg-flaeche has-[input:focus]:border-brand-500';

export const STEPPER_STUFE =
	'flex size-knopf-feld flex-none items-center justify-center text-leise hover:bg-flaeche-2 hover:text-tinte disabled:opacity-40';

export const STEPPER_WERT =
	'flex min-w-9 flex-none items-center justify-center gap-0.5 border-x border-rand px-1 text-sm tabular-nums';

export const STEPPER_EINHEIT = 'flex-none text-xs text-dezent';

/** − Wert +, für alle Zahlen. Der Wert lässt sich direkt eintippen; übernommen wird beim Verlassen oder mit ⏎. */
export const Stepper = ({
	aus,
	className,
	einheit,
	id,
	max,
	min,
	minusName,
	name,
	plusName,
	schritt = 1,
	setze,
	wert,
}: Eigenschaften) => {
	const [text, setText] = useState(String(wert));
	useEffect(() => setText(String(wert)), [wert]);
	const grenze = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
	const uebernimm = () => {
		const n = Number(text.replace(',', '.'));
		if (text.trim() === '' || !Number.isFinite(n)) {
			setText(String(wert));
			return;
		}
		const neu = grenze(n);
		setText(String(neu));
		if (neu !== wert) {
			setze(neu);
		}
	};
	const rund = (n: number) => Number(n.toFixed(4));
	return (
		<div className={klassen(STEPPER_RAHMEN, aus && 'opacity-50')}>
			<button
				type="button"
				className={STEPPER_STUFE}
				aria-label={minusName ?? `${name} kleiner`}
				disabled={aus || (min !== undefined && wert <= min)}
				onClick={() => setze(grenze(rund(wert - schritt)))}
			>
				<Symbol name="minus" className="size-3 flex-none" />
			</button>
			<label className={STEPPER_WERT}>
				<input
					id={id}
					type="text"
					inputMode="decimal"
					aria-label={name}
					disabled={aus}
					className={klassen(
						'w-7 min-w-0 bg-transparent outline-none',
						einheit ? 'text-right' : 'text-center',
						className,
					)}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onBlur={uebernimm}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							uebernimm();
						}
					}}
				/>
				{einheit && <span className={STEPPER_EINHEIT}>{einheit}</span>}
			</label>
			<button
				type="button"
				className={STEPPER_STUFE}
				aria-label={plusName ?? `${name} größer`}
				disabled={aus || (max !== undefined && wert >= max)}
				onClick={() => setze(grenze(rund(wert + schritt)))}
			>
				<Symbol name="plus" className="size-3 flex-none" />
			</button>
		</div>
	);
};
