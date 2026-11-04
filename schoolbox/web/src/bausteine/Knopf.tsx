import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import type { LinkProps } from 'react-router-dom';
import { Link } from 'react-router-dom';

import type { KnopfArt, KnopfGroesse } from './klassen';
import { knopfKlassen } from './klassen';

interface Aussehen {
	art?: KnopfArt;
	groesse?: KnopfGroesse;
}

export const Knopf = ({
	art,
	className,
	groesse,
	type = 'button',
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & Aussehen) => (
	<button type={type} className={knopfKlassen(art, className, groesse)} {...rest} />
);

/** Sieht aus wie ein Knopf, führt aber auf eine Seite der Schoolbox. */
export const KnopfLink = ({ art, className, groesse, ...rest }: LinkProps & Aussehen) => (
	<Link className={knopfKlassen(art, className, groesse)} {...rest} />
);

/** Wie `KnopfLink`, für Adressen außerhalb der Oberfläche (z. B. die Darstellung unter `/ansicht`). */
export const KnopfAdresse = ({
	art,
	className,
	groesse,
	...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & Aussehen) => (
	<a className={knopfKlassen(art, className, groesse)} {...rest} />
);
