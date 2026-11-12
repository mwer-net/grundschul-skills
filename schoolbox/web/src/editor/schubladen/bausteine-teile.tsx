import { Bibliothek } from '../Bibliothek';
import type { SchubladenTeile } from '.';

export const Inhalt = (t: SchubladenTeile) => (
	<Bibliothek einfuegen={t.einfuegen} mappe={t.mappe} art={t.art} doc={t.doc} />
);
