import type { ComponentProps } from 'react';

import { Knopf } from '../../../bausteine/Knopf';
import { Popover } from '../../../bausteine/Popover';
import { Symbol } from '../../../bausteine/Symbol';
import type { Befehle } from '../../useBefehle';
import { RahmenstilWahl } from '../inspektor/rahmenstil-teile'; // 111
import type { LeistenKnoepfe } from './typen';

/** Auslöser des Popovers: Die Eigenschaften des Triggers (Klick, Ref, ARIA) müssen am Knopf ankommen. */
const RahmenstilKnopf = ({ aktiv, ...trigger }: { aktiv: boolean } & ComponentProps<typeof Knopf>) => (
	<Knopf {...trigger} art="leise" groesse="klein" data-leiste-rahmenstil disabled={!aktiv}>
		Rahmen-Stil
	</Knopf>
);

// >> 172
/** Öffnet die Schublade „Bilder“; ist sie schon offen, bleibt sie offen. „Austauschen“ und „Bild einsetzen“ (172). */
export const oeffneBilder = (befehle: Befehle) => {
	const jetzt = befehle.jetzt.current;
	if (jetzt.linksOffen !== 'bilder') {
		jetzt.tu.links('bilder');
	}
};
// << 172

/**
 * Leiste am freien Bild (103): „Austauschen“ öffnet die Schublade „Bilder“ (⌥5); ein Klick dort oder ein Bild aufs
 * gewählte gezogen tauscht es aus. Ist sie schon offen, bleibt sie offen. 111: „Rahmen-Stil“ davor, als Popover.
 */
export const BILD_LEISTE: LeistenKnoepfe = ({ aktiv, befehle, k, quelle }) => (
	<>
		<Popover name="Rahmen-Stil" className="w-auto max-w-80" ausloeser={<RahmenstilKnopf aktiv={aktiv} />}>
			<RahmenstilWahl k={k} quelle={quelle} aktiv={aktiv} />
		</Popover>
		<Knopf
			art="leise"
			groesse="klein"
			disabled={!aktiv}
			data-bild-austauschen
			// >> 172
			onClick={() => oeffneBilder(befehle)}
			// << 172
		>
			<Symbol name="bild" />
			Austauschen
		</Knopf>
	</>
);
