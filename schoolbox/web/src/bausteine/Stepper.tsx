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
	/** Namen der Knöpfe, sonst „<Name> kleiner“ und „<Name> größer“. */
	minusName?: string;
	plusName?: string;
	/** Breite des Werts, wenn lange Zahlen vorkommen. */
	className?: string;
}

const STUFE =
	'flex size-knopf-feld flex-none items-center justify-center text-leise hover:bg-flaeche-2 hover:text-tinte disabled:opacity-40';

/** − Wert +, für alle Zahlen. Der Wert lässt sich direkt eintippen; übernommen wird beim Verlassen oder mit ⏎. */
export const Stepper = ({
	aus,
	className,
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
		<div
			role="group"
			aria-label={name}
			className={klassen(
				'inline-flex h-feld flex-none items-stretch overflow-hidden rounded-md border border-rand-feld bg-flaeche',
				aus && 'opacity-50',
			)}
		>
			<button
				type="button"
				className={STUFE}
				aria-label={minusName ?? `${name} kleiner`}
				disabled={aus || (min !== undefined && wert <= min)}
				onClick={() => setze(grenze(rund(wert - schritt)))}
			>
				<Symbol name="minus" className="size-3 flex-none" />
			</button>
			<input
				type="text"
				inputMode="decimal"
				aria-label={name}
				disabled={aus}
				className={klassen(
					'w-9 min-w-0 border-x border-rand bg-transparent text-center text-sm tabular-nums outline-none',
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
			<button
				type="button"
				className={STUFE}
				aria-label={plusName ?? `${name} größer`}
				disabled={aus || (max !== undefined && wert >= max)}
				onClick={() => setze(grenze(rund(wert + schritt)))}
			>
				<Symbol name="plus" className="size-3 flex-none" />
			</button>
		</div>
	);
};
