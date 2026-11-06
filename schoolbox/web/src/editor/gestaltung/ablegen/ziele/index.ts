import { ziel as bildAufBild } from './bild-auf-bild';
import { ziel as inForm } from './in-form';
import { ziel as platzhalter } from './platzhalter';
import { ziel as test } from './test';
import type { AblageTreffer, AblageZiel } from './typ';

export type { AblageTreffer, AblageZiel } from './typ';

/**
 * Ziele beim Ablegen von Gestaltung (098, Andockstelle): Das erste passende gewinnt. Ein Ticket füllt nur seine Datei
 * (103 `bild-auf-bild.ts`, `platzhalter.ts`; 111 `in-form.ts`) und trägt hier nichts ein.
 */
export const ABLAGE_ZIELE: readonly AblageZiel[] = [bildAufBild, platzhalter, inForm, test].filter(
	(z): z is AblageZiel => z !== null,
);

/** Das erste Ziel, das `unter` und das Gut annimmt. */
export const zielFuer = (unter: Element | null, gut: Parameters<AblageZiel>[1]): AblageTreffer | null => {
	if (!unter) {
		return null;
	}
	for (const z of ABLAGE_ZIELE) {
		const treffer = z(unter, gut);
		if (treffer) {
			return treffer;
		}
	}
	return null;
};
