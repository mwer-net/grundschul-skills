import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import type { KnopfArt } from './klassen';
import { klassen } from './klassen';
import { Knopf } from './Knopf';
import { Symbol } from './Symbol';

export interface MenueEintrag {
	titel: string;
	/** Ein Satz unter dem Titel: wofür der Eintrag gut ist. */
	beschreibung?: string;
	waehle: () => void;
}

interface Eigenschaften {
	beschriftung: ReactNode;
	eintraege: MenueEintrag[];
	art?: KnopfArt;
	disabled?: boolean;
	/** Klappt nach links auf, wenn der Knopf am rechten Rand steht. */
	rechtsbuendig?: boolean;
}

/**
 * Knopf mit einer kleinen Auswahl darunter. Öffnet per Tippen oder Klick, nie per Hover; ein Tipp daneben oder Esc
 * schließt sie wieder.
 */
export const Menue = ({ art = 'zweit', beschriftung, disabled, eintraege, rechtsbuendig }: Eigenschaften) => {
	const [offen, setOffen] = useState(false);
	const wurzel = useRef<HTMLDivElement>(null);
	const id = useId();

	useEffect(() => {
		if (!offen) {
			return undefined;
		}
		const daneben = (ereignis: PointerEvent) => {
			if (!wurzel.current?.contains(ereignis.target as Node)) {
				setOffen(false);
			}
		};
		const taste = (ereignis: KeyboardEvent) => {
			if (ereignis.key === 'Escape') {
				setOffen(false);
			}
		};
		document.addEventListener('pointerdown', daneben);
		document.addEventListener('keydown', taste);
		return () => {
			document.removeEventListener('pointerdown', daneben);
			document.removeEventListener('keydown', taste);
		};
	}, [offen]);

	return (
		<div ref={wurzel} className="relative">
			<Knopf
				art={art}
				disabled={disabled}
				aria-haspopup="menu"
				aria-expanded={offen}
				aria-controls={offen ? id : undefined}
				onClick={() => setOffen((o) => !o)}
			>
				{beschriftung}
				<Symbol name="runter" className="size-5 flex-none" />
			</Knopf>
			{offen && (
				<ul
					id={id}
					role="menu"
					className={klassen(
						'absolute top-full z-20 mt-2 flex min-w-full flex-col gap-1 rounded-xl border border-rand bg-white p-2 shadow-karte',
						rechtsbuendig ? 'right-0' : 'left-0',
						eintraege.some((e) => e.beschreibung) && 'w-96 max-w-[calc(100vw-2rem)]',
					)}
				>
					{eintraege.map(({ beschreibung, titel, waehle }) => (
						<li key={titel} role="none">
							<button
								type="button"
								role="menuitem"
								className={klassen(
									'min-h-12 w-full rounded-lg px-4 text-left font-bold text-brand-600 hover:bg-brand-50 active:bg-brand-100',
									beschreibung ? 'py-2' : 'whitespace-nowrap',
								)}
								onClick={() => {
									setOffen(false);
									waehle();
								}}
							>
								{titel}
								{beschreibung && (
									<span className="mt-0.5 block text-base font-normal text-leise">
										{beschreibung}
									</span>
								)}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
