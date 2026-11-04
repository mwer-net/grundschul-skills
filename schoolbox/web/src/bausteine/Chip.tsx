import { klassen } from './klassen';

interface Eigenschaften {
	titel: string;
	aktiv: boolean;
	waehle: () => void;
	/** Farbpunkt vor dem Titel, z. B. die Heftfarbe eines Fachs. */
	farbe?: string;
}

export const Chip = ({ aktiv, farbe, titel, waehle }: Eigenschaften) => (
	<button
		type="button"
		aria-pressed={aktiv}
		className={klassen(
			'inline-flex h-knopf items-center gap-2 rounded-lg border px-4 whitespace-nowrap transition-colors',
			aktiv
				? 'border-brand-500 bg-brand-500 font-medium text-white'
				: 'border-rand bg-flaeche hover:border-brand-200 hover:bg-flaeche-2',
		)}
		onClick={waehle}
	>
		{farbe && (
			<span
				className={klassen('size-3 flex-none rounded-full', aktiv && 'ring-2 ring-white')}
				style={{ background: farbe }}
			/>
		)}
		{titel}
	</button>
);
