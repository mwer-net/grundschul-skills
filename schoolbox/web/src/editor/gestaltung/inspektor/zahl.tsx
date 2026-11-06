import { useEffect, useState } from 'react';

import { klassen } from '../../../bausteine/klassen';

interface Eigenschaften {
	/** Kurzer Titel vor dem Wert, z. B. „X“. */
	titel: string;
	/** Name für Hilfsmittel und Tests, z. B. „X-Position“. */
	name: string;
	wert: number;
	einheit: string;
	/** Übernimmt den Wert: ⏎, Tab, Verlassen oder ↑/↓. Ein Schritt im Verlauf. */
	setze: (wert: number) => void;
	/** Nur Anzeige, ohne Schritt, solange getippt wird; `null`: wieder der alte Wert. */
	zeige?: (wert: number | null) => void;
	/** Grau und nicht änderbar, z. B. die gemessene Höhe der Schmuckschrift. */
	fest?: boolean;
	aus?: boolean;
}

/** Ein Zahlenfeld des Gestaltungs-Inspektors: Tippen ändert nur die Anzeige, Bestätigen schreibt (099). */
export const Zahl = ({ aus, einheit, fest, name, setze, titel, wert, zeige }: Eigenschaften) => {
	const [text, setText] = useState(String(wert));
	useEffect(() => setText(String(wert)), [wert]);
	const zahl = (t: string) => {
		const n = Number(t.replace(',', '.').replace('−', '-'));
		return t.trim() === '' || !Number.isFinite(n) ? null : n;
	};
	const uebernimm = () => {
		const n = zahl(text);
		if (n === null || n === wert) {
			setText(String(wert));
			if (n === null) {
				zeige?.(null);
			}
			return;
		}
		setze(n);
	};
	return (
		<label
			className={klassen(
				'flex h-feld min-w-0 flex-1 items-center gap-1 rounded-md border border-rand-feld bg-flaeche px-1.5 text-sm',
				(aus || fest) && 'opacity-60',
			)}
			data-zahl={name}
		>
			<span className="flex-none text-xs text-leise">{titel}</span>
			<input
				type="text"
				inputMode="decimal"
				aria-label={name}
				disabled={aus || fest}
				readOnly={fest}
				className="w-full min-w-0 bg-transparent text-right tabular-nums outline-none"
				value={text}
				onChange={(e) => {
					setText(e.target.value);
					const n = zahl(e.target.value);
					if (n !== null) {
						zeige?.(n);
					}
				}}
				onBlur={uebernimm}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						uebernimm();
					} else if (e.key === 'Escape') {
						e.preventDefault();
						setText(String(wert));
						zeige?.(null);
					} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
						e.preventDefault();
						const schritt = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
						setze((zahl(text) ?? wert) + schritt);
					}
				}}
			/>
			<span className="flex-none text-xs text-dezent">{einheit}</span>
		</label>
	);
};
