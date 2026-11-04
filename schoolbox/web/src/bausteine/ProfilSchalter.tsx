import type { Druckprofil } from '@schoolbox/kern/src/werte';

import { Segment } from './Segment';

/** „Farbe | s/w“: nur eine Ansicht, das Material bleibt, wie es ist (042). */
interface Eigenschaften {
	/** Ohne Profil (Folien) gibt es nichts umzuschalten. */
	profil: Druckprofil | undefined;
	waehle: (profil: Druckprofil) => void;
}

const WERTE: { wert: Druckprofil; titel: string }[] = [
	{ wert: 'farbe', titel: 'Farbe' },
	{ wert: 'sw', titel: 's/w' },
];

export const ProfilSchalter = ({ profil, waehle }: Eigenschaften) =>
	profil ? (
		<div title="Nur die Ansicht: Das Material bleibt, wie es ist." className="flex" data-profilschalter>
			<Segment beschriftung="Farbe oder Schwarz-Weiß" werte={WERTE} wert={profil} waehle={waehle} />
		</div>
	) : null;
