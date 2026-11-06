import { Schubladenkopf } from '../../bausteine/Schubladenkopf';
import { Bibliothek } from '../Bibliothek';
import type { Schublade, SchubladenTeile } from '.';
import { kopf } from './reihe';

const Inhalt = (t: SchubladenTeile) => (
	<>
		<Schubladenkopf titel="Bausteine" />
		<div className="min-h-0 flex-1 overflow-y-auto p-2">
			<Bibliothek einfuegen={t.einfuegen} mappe={t.mappe} art={t.art} doc={t.doc} setAuswahl={t.setAuswahl} />
		</div>
	</>
);

/** ⌥2: der Katalog wie bisher. Nur wo frei bearbeitet werden darf. */
export const schublade: Schublade = { ...kopf('bausteine'), bereit: (k) => k.frei, Inhalt };
