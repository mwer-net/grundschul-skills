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
			'inline-flex h-knopf-klein items-center gap-1.5 rounded-md border px-2 text-sm font-medium whitespace-nowrap transition-colors duration-[120ms]',
			aktiv ? 'border-rand-feld bg-flaeche-2 text-tinte' : 'border-rand bg-flaeche text-leise hover:bg-flaeche-2',
		)}
		onClick={waehle}
	>
		{farbe && <span className="size-2 flex-none rounded-full" style={{ background: farbe }} />}
		{titel}
	</button>
);
