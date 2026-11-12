import { Symbol } from '../../bausteine/Symbol';

/** Der Kreis in Senden von „Figur beschreiben …“ und „Bild beschreiben …“; der Knopf außen trägt `group/senden`. */
export const SendenKreis = () => (
	<span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-white group-hover/senden:bg-brand-600 group-disabled/senden:bg-rand group-disabled/senden:text-leise [@media(any-pointer:coarse)]:size-8">
		<Symbol name="senden" className="size-3 [@media(any-pointer:coarse)]:size-4" />
	</span>
);

/** Der Kreis im ⋯ an einer Posenkachel. */
export const MehrKreis = () => (
	<span className="flex size-5 items-center justify-center rounded-full bg-flaeche text-tinte shadow-1 [@media(any-pointer:coarse)]:size-7">
		<Symbol name="mehr" className="size-3.5" />
	</span>
);
