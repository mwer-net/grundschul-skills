import { Fragment } from 'react';

import { klassen } from './klassen';
import type { SymbolName } from './Symbol';
import { Symbol } from './Symbol';
// >> 166
import { Tooltip } from './Tooltip';
// << 166

export interface LeistenEintrag<T extends string> {
	id: T;
	titel: string;
	symbol: SymbolName;
	/** Anzeige der Taste, etwa `⌥1`. */
	kuerzel: string;
	/** Danach eine Trennlinie (nach den Ebenen, die nur ordnen). */
	trenner?: boolean;
}

interface Eigenschaften<T extends string> {
	eintraege: LeistenEintrag<T>[];
	offen: T | null;
	waehle: (id: T) => void;
	/** Attribute für jeden Knopf, etwa um den Fokus beim Klick zu lassen, wo er ist. */
	knopf?: Record<string, unknown>;
}

// >> 166
/**
 * Schmale Spalte ganz links: je Schublade Symbol und Name; die Taste steht im Tooltip (53). Klick öffnet, ein Klick
 * auf die offene schließt. Am iPad nur Symbole, mit 44 px Trefferfläche, damit das Blatt Platz behält.
 */
// << 166
export const Schubladenleiste = <T extends string>({ eintraege, knopf, offen, waehle }: Eigenschaften<T>) => (
	<nav
		aria-label="Schubladen"
		className="flex w-[72px] flex-none flex-col items-stretch gap-0.5 overflow-y-auto border-r border-rand bg-flaeche px-1 py-1.5 [@media(any-pointer:coarse)]:w-14"
		data-schubladenleiste
	>
		{eintraege.map((e) => (
			<Fragment key={e.id}>
				{/* >> 166 */}
				<Tooltip text={e.titel} kuerzel={e.kuerzel} seite="right">
					<button
						type="button"
						aria-label={e.titel}
						aria-pressed={offen === e.id}
						className={klassen(
							'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-0 py-1 text-leise hover:bg-flaeche-2 hover:text-tinte',
							offen === e.id && 'bg-brand-50 text-brand-700 hover:bg-brand-50 hover:text-brand-700',
						)}
						data-schublade-knopf={e.id}
						onClick={() => waehle(e.id)}
						{...knopf}
					>
						<Symbol name={e.symbol} className="size-5 flex-none" />
						<span className="max-w-full truncate text-[11px] leading-tight font-medium [@media(any-pointer:coarse)]:sr-only">
							{e.titel}
						</span>
					</button>
				</Tooltip>
				{/* << 166 */}
				{e.trenner && <hr className="mx-2 my-1 border-rand" />}
			</Fragment>
		))}
	</nav>
);
