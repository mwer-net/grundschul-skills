import type { ComponentProps } from 'react';

import { klassen } from './klassen';
import { Symbol } from './Symbol';

interface Eigenschaften extends ComponentProps<'button'> {
	// >> 168
	/** Sagt, was das Ziehen bewirkt, etwa „Zeile 2 verschieben“. Name für Hilfsmittel und Hinweis beim Überfahren. */
	// << 168
	beschriftung: string;
}

/**
 * Griff zum Ziehen, immer sichtbar. Ziehen und Klick bleiben damit getrennt: Der Griff zieht, die Zeile oder Karte daneben
 * klickt. Er sieht nur aus und nimmt den Finger (`touch-none` nur hier, Wischen daneben rollt weiter); die
 * Zeigerereignisse gibt der Aufrufer mit. Breite am Mac 20 px, bei Touch 44 px, die Höhe gibt die Umgebung.
 */
export const Griff = ({ beschriftung, className, ...rest }: Eigenschaften) => (
	<button
		type="button"
		aria-label={beschriftung}
		title={beschriftung}
		className={klassen(
			'flex w-5 flex-none cursor-grab touch-none items-center justify-center rounded-sm text-dezent select-none hover:bg-flaeche-2 hover:text-tinte active:cursor-grabbing [@media(any-pointer:coarse)]:w-11',
			className,
		)}
		{...rest}
	>
		<Symbol name="griff" />
	</button>
);
