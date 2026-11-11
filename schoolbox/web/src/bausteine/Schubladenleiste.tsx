import { Fragment } from 'react';

import { klassen } from './klassen';
import { Kuerzel } from './Kuerzel';
import type { SymbolName } from './Symbol';
import { Symbol } from './Symbol';

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
	/** Die sichtbaren Schubladen; ihre Knöpfe sind gedrückt. */
	offen: readonly T[];
	waehle: (id: T) => void;
	/** Attribute für jeden Knopf, etwa um den Fokus beim Klick zu lassen, wo er ist. */
	knopf?: Record<string, unknown>;
}

/**
 * Schmale Spalte ganz links: je Schublade Symbol, Name und Taste (5.2). Klick öffnet, ein Klick auf eine sichtbare
 * schließt sie. Am iPad nur Symbole, mit 44 px Trefferfläche, damit das Blatt Platz behält.
 */
export const Schubladenleiste = <T extends string>({ eintraege, knopf, offen, waehle }: Eigenschaften<T>) => (
	<nav
		aria-label="Schubladen"
		className="flex w-[72px] flex-none flex-col items-stretch gap-0.5 overflow-y-auto border-r border-rand bg-flaeche px-1 py-1.5 [@media(any-pointer:coarse)]:w-14"
		data-schubladenleiste
	>
		{eintraege.map((e) => (
			<Fragment key={e.id}>
				<button
					type="button"
					aria-label={e.titel}
					aria-pressed={offen.includes(e.id)}
					title={`${e.titel} (${e.kuerzel})`}
					className={klassen(
						'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-0 py-1 text-leise hover:bg-flaeche-2 hover:text-tinte',
						offen.includes(e.id) && 'bg-brand-50 text-brand-700 hover:bg-brand-50 hover:text-brand-700',
					)}
					data-schublade-knopf={e.id}
					onClick={() => waehle(e.id)}
					{...knopf}
				>
					<Symbol name={e.symbol} className="size-5 flex-none" />
					<span className="max-w-full truncate text-[11px] leading-tight font-medium [@media(any-pointer:coarse)]:sr-only">
						{e.titel}
					</span>
					<Kuerzel
						text={e.kuerzel}
						className={klassen(
							'text-[10px] leading-none [@media(any-pointer:coarse)]:hidden',
							offen.includes(e.id) && 'text-brand-700/70',
						)}
					/>
				</button>
				{e.trenner && <hr className="mx-2 my-1 border-rand" />}
			</Fragment>
		))}
	</nav>
);
