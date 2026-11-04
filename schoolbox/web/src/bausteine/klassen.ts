type Teil = string | false | null | undefined;

export const klassen = (...teile: Teil[]) => teile.filter(Boolean).join(' ');

export type KnopfArt = 'haupt' | 'zweit' | 'leise' | 'gefahr';
export type KnopfGroesse = 'standard' | 'klein';

const KNOPF_ART: Record<KnopfArt, string> = {
	haupt: 'border-transparent bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700',
	zweit: 'border-rand-feld bg-flaeche text-tinte hover:bg-flaeche-2 active:bg-rand',
	leise: 'border-transparent text-tinte hover:bg-flaeche-2 active:bg-rand',
	gefahr: 'border-transparent text-fehler hover:bg-red-50 active:bg-red-100',
};

const KNOPF_GROESSE: Record<KnopfGroesse, string> = {
	standard: 'h-knopf px-2.5 text-sm',
	klein: 'h-knopf-klein px-2 text-sm',
};

/** Am Mac 26 px (Leisten 24 px), mit Finger 44 px: Die Höhen stehen als Variablen in `stil.css`. */
export const knopfKlassen = (art: KnopfArt = 'haupt', zusatz?: string, groesse: KnopfGroesse = 'standard') =>
	klassen(
		'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium no-underline',
		'transition-colors duration-[120ms] select-none disabled:cursor-default disabled:opacity-50',
		KNOPF_GROESSE[groesse],
		KNOPF_ART[art],
		zusatz,
	);

/** Eingabefelder und Selects: gleiche Höhe, 1 px Rand. */
export const FELD_KLASSEN =
	'h-feld w-full rounded-md border border-rand-feld bg-flaeche px-1.5 text-sm font-normal text-tinte placeholder:text-dezent focus:border-brand-500 focus:outline-none disabled:opacity-50';
