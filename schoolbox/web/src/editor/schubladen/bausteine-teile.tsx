import { Schubladenkopf } from '../../bausteine/Schubladenkopf';
import { Bibliothek } from '../Bibliothek';
import type { SchubladenTeile } from '.';

export const Inhalt = (t: SchubladenTeile) => (
	<>
		<Schubladenkopf titel="Bausteine" />
		<div className="min-h-0 flex-1 overflow-y-auto p-2">
			<Bibliothek einfuegen={t.einfuegen} mappe={t.mappe} art={t.art} doc={t.doc} />
		</div>
	</>
);
