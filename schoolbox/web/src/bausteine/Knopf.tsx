import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import type { LinkProps } from 'react-router-dom';
import { Link } from 'react-router-dom';

import type { KnopfArt } from './klassen';
import { knopfKlassen } from './klassen';

interface Aussehen {
	art?: KnopfArt;
}

export const Knopf = ({
	art,
	className,
	type = 'button',
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & Aussehen) => (
	<button type={type} className={knopfKlassen(art, className)} {...rest} />
);

/** Sieht aus wie ein Knopf, führt aber auf eine Seite der Schoolbox. */
export const KnopfLink = ({ art, className, ...rest }: LinkProps & Aussehen) => (
	<Link className={knopfKlassen(art, className)} {...rest} />
);

/** Wie `KnopfLink`, für Adressen außerhalb der Oberfläche (z. B. die Darstellung unter `/ansicht`). */
export const KnopfAdresse = ({ art, className, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & Aussehen) => (
	<a className={knopfKlassen(art, className)} {...rest} />
);
