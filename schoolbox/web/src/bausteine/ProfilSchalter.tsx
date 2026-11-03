import type { Druckprofil } from '@schoolbox/kern/src/werte';

import { Chip } from './Chip';

/** „Farbe | s/w“: nur eine Ansicht, das Material bleibt, wie es ist (042). */
interface Eigenschaften {
	/** Ohne Profil (Folien) gibt es nichts umzuschalten. */
	profil: Druckprofil | undefined;
	waehle: (profil: Druckprofil) => void;
}

export const ProfilSchalter = ({ profil, waehle }: Eigenschaften) =>
	profil ? (
		<div
			role="group"
			aria-label="Farbe oder Schwarz-Weiß"
			title="Nur die Ansicht: Das Material bleibt, wie es ist."
			className="flex gap-2"
			data-profilschalter
		>
			<Chip titel="Farbe" aktiv={profil === 'farbe'} waehle={() => waehle('farbe')} />
			<Chip titel="s/w" aktiv={profil === 'sw'} waehle={() => waehle('sw')} />
		</div>
	) : null;
