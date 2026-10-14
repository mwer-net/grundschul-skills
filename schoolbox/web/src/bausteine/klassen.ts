type Teil = string | false | null | undefined;

export const klassen = (...teile: Teil[]) => teile.filter(Boolean).join(' ');

export type KnopfArt = 'haupt' | 'zweit' | 'leise' | 'gefahr';

const KNOPF_ART: Record<KnopfArt, string> = {
	haupt: 'border-brand-500 bg-brand-500 text-white hover:border-brand-600 hover:bg-brand-600 active:bg-brand-700',
	zweit: 'border-rand bg-white text-brand-600 hover:border-brand-200 hover:bg-brand-50 active:bg-brand-100',
	leise: 'border-transparent text-brand-600 hover:bg-brand-50 active:bg-brand-100',
	gefahr: 'border-transparent text-fehler hover:bg-red-50 active:bg-red-100',
};

/** Alle Knöpfe sind mindestens 48 px hoch: gut zu treffen mit dem Finger auf dem iPad. */
export const knopfKlassen = (art: KnopfArt = 'haupt', zusatz?: string) =>
	klassen(
		'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-5 font-bold no-underline',
		'transition-colors select-none disabled:cursor-default disabled:opacity-50',
		KNOPF_ART[art],
		zusatz,
	);
