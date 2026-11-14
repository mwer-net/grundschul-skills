import { cmZuPx, grenzenInCm, liesZahl, pxZuCm, rasteEin, zahlMitKomma } from '@schoolbox/kern/src/masse';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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
	/** 197-U3: `wert`, Grenzen und Schritt in px, gezeigt und getippt in cm. */
	cm?: boolean;
}

/** Rahmen, Stufen und Wertfeld; `Abbildungspanel.tsx` nutzt sie für seine Zahlen, damit beide gleich aussehen. */
export const STEPPER_RAHMEN =
	'inline-flex h-feld flex-none items-stretch overflow-hidden rounded-md border border-rand-feld bg-flaeche has-[input:focus]:border-brand-500';

/** Füllt die Höhe des Rahmens (22 px wie jedes Feld, 187-15); nur die Breite hat ein Mindestmaß. */
export const STEPPER_STUFE =
	'flex min-w-[var(--hoehe-feld)] flex-none items-center justify-center text-leise hover:bg-flaeche-2 hover:text-tinte disabled:opacity-40';

export const STEPPER_WERT =
	'flex min-w-9 flex-none items-center justify-center gap-0.5 border-x border-rand px-1 text-sm tabular-nums';

export const STEPPER_EINHEIT = 'flex-none text-xs text-dezent';

/**
 * 196-30: Nach ⌘Z zeichnet der Inspektor neu und das Feld verlöre den Fokus. Ging er eben ins Leere, holt ein Stepper
 * gleichen Namens ihn zurück.
 */
let zuletzt: { name: string; zeit: number } | null = null;

/**
 * − Wert +, für alle Zahlen. Der Wert lässt sich direkt eintippen, mit Komma oder Punkt; übernommen wird beim
 * Verlassen oder mit ⏎, auf den Schritt gerundet und auf die Grenzen gesetzt (196-10, 196-29). Im Feld zählen ↑ und ↓
 * um einen Schritt, Esc verwirft das Getippte (187-16). Mit `cm` steht der Wert in px, gezeigt in cm (196-28).
 */
export const Stepper = ({
	aus,
	className,
	cm = false,
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
	const grenzen = cm
		? grenzenInCm({ min: min ?? 0, max: max ?? 10_000, schritt })
		: { min: min ?? -Infinity, max: max ?? Infinity, schritt };
	const zeigen = (n: number) => (cm ? pxZuCm(n) : n);
	const jetzt = zeigen(wert);
	const [text, setText] = useState(zahlMitKomma(jetzt));
	useEffect(() => setText(zahlMitKomma(jetzt)), [jetzt]);
	const feld = useRef<HTMLInputElement>(null);
	// Auch ohne Neuaufbau: ⌘Z löst das Feld (`loeseFeld`), der Fokus geht ins Leere, dann kommt der alte Wert. Bis die
	// neue Fassung gezeichnet ist, ist das Feld gesperrt und nimmt keinen Fokus; darum auch nach `aus`.
	useEffect(() => {
		const leer = !document.activeElement || document.activeElement === document.body;
		if (zuletzt?.name === name && Date.now() - zuletzt.zeit < 1500 && feld.current && leer && !aus) {
			feld.current.focus();
			if (document.activeElement === feld.current) {
				zuletzt = null;
			}
		}
	}, [name, jetzt, aus]);
	// Wird das Feld mit dem Fokus ausgehängt (⌘Z baut den Inspektor neu), feuert kein `blur`: Hier merken, solange es
	// noch im Dokument steht.
	useLayoutEffect(() => {
		const e = feld.current;
		return () => {
			if (e && e.ownerDocument.activeElement === e) {
				zuletzt = { name, zeit: Date.now() };
			}
		};
	}, [name]);
	const raste = (n: number) =>
		Number.isFinite(grenzen.min) && Number.isFinite(grenzen.max)
			? rasteEin(n, grenzen)
			: Math.min(grenzen.max, Math.max(grenzen.min, Number(n.toFixed(4))));
	const gib = (n: number) => {
		const neu = raste(n);
		setText(zahlMitKomma(neu));
		// 197-N01: In der gezeigten Einheit vergleichen; 2,3 cm aus 88 px schreiben nicht 87 px zurück.
		if (neu !== jetzt) {
			setze(cm ? cmZuPx(neu) : neu);
		}
	};
	const uebernimm = () => {
		if (text === zahlMitKomma(jetzt)) {
			return;
		}
		const n = liesZahl(text);
		if (!Number.isFinite(n)) {
			setText(zahlMitKomma(jetzt));
			return;
		}
		gib(n);
	};
	return (
		<div className={klassen(STEPPER_RAHMEN, aus && 'opacity-50')}>
			<button
				type="button"
				className={STEPPER_STUFE}
				aria-label={minusName ?? `${name} kleiner`}
				disabled={aus || jetzt <= grenzen.min}
				onClick={() => gib(jetzt - grenzen.schritt)}
			>
				<Symbol name="minus" className="size-3 flex-none" />
			</button>
			<label className={STEPPER_WERT}>
				<input
					ref={feld}
					id={id}
					type="text"
					inputMode="decimal"
					aria-label={name}
					disabled={aus}
					data-stepper={name}
					className={klassen(
						'w-7 min-w-0 bg-transparent outline-none',
						cm && 'w-9',
						einheit || cm ? 'text-right' : 'text-center',
						className,
					)}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onBlur={(e) => {
						uebernimm();
						zuletzt = e.relatedTarget ? null : { name, zeit: Date.now() };
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							uebernimm();
						} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
							e.preventDefault();
							const n = liesZahl(text);
							gib((Number.isFinite(n) ? n : jetzt) + (e.key === 'ArrowUp' ? grenzen.schritt : -grenzen.schritt));
						} else if (e.key === 'Escape' && text !== zahlMitKomma(jetzt)) {
							// Nur das Getippte verwerfen; ein zweites Esc gehört wieder der Umgebung.
							e.preventDefault();
							e.stopPropagation();
							setText(zahlMitKomma(jetzt));
							const ziel = e.currentTarget;
							requestAnimationFrame(() => ziel.select());
						}
					}}
				/>
				{(cm || einheit) && <span className={STEPPER_EINHEIT}>{cm ? 'cm' : einheit}</span>}
			</label>
			<button
				type="button"
				className={STEPPER_STUFE}
				aria-label={plusName ?? `${name} größer`}
				disabled={aus || jetzt >= grenzen.max}
				onClick={() => gib(jetzt + grenzen.schritt)}
			>
				<Symbol name="plus" className="size-3 flex-none" />
			</button>
		</div>
	);
};
