import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { klassen } from '../../../bausteine/klassen';

interface Eigenschaften {
	titel: string;
	wert: number;
	min: number;
	max: number;
	schritt?: number;
	einheit: string;
	/** Während des Ziehens: nur ansehen. */
	zeige: (wert: number) => void;
	/** Beim Loslassen: ein Schritt im Verlauf (4.6). */
	setze: (wert: number) => void;
	aus?: boolean;
	name: string;
	/** Rechts neben dem Wert, z. B. „Vorgabe“. */
	extra?: ReactNode;
}

/** Regler wie der Abstand im Reiter „Blatt“: Anzeige beim Ziehen, Schreiben beim Loslassen. */
export const Regler = ({ aus, einheit, extra, max, min, name, schritt = 1, setze, titel, wert, zeige }: Eigenschaften) => {
	const id = useId();
	const [jetzt, setJetzt] = useState(wert);
	const element = useRef<HTMLInputElement>(null);
	const setzeJetzt = useRef(setze);
	useEffect(() => {
		setzeJetzt.current = setze;
	});
	useEffect(() => setJetzt(wert), [wert]);
	useEffect(() => {
		const e = element.current;
		if (!e) {
			return undefined;
		}
		const fertig = () => setzeJetzt.current(Number(e.value));
		e.addEventListener('change', fertig);
		return () => e.removeEventListener('change', fertig);
	}, []);
	return (
		<div data-regler={name}>
			<div className="flex h-zeile items-center justify-between gap-x-2">
				<label htmlFor={id} className="text-leise">
					{titel}
				</label>
				<span className="ml-auto flex flex-none items-center gap-2">
					{extra}
					<span className="text-leise tabular-nums" data-regler-wert>{`${jetzt}${einheit}`}</span>
				</span>
			</div>
			<input
				ref={element}
				id={id}
				type="range"
				aria-label={titel}
				className={klassen('h-zeile w-full accent-brand-500', aus && 'opacity-50')}
				disabled={aus}
				min={min}
				max={max}
				step={schritt}
				value={jetzt}
				onChange={(e) => {
					const n = Number(e.target.value);
					setJetzt(n);
					zeige(n);
				}}
			/>
		</div>
	);
};
