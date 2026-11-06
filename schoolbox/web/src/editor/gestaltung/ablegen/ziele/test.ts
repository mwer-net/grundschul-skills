import { setzeName } from '@schoolbox/kern/src/gestaltung';

import { nrVon } from '../../../darstellung';
import { imTest } from '../../testzugang';
import type { AblageZiel } from './typ';

/** Nur im Test (`gestaltung-ablegen.spec.ts`): Ein Element `.testziel` nimmt das Gut an und bekommt dessen Namen. */
export const ziel: AblageZiel = (unter) => {
	const element = imTest() ? unter.closest('.testziel') : null;
	const nr = element ? nrVon(element) : null;
	return element && nr !== null
		? { rahmen: element, text: 'Testziel füllen', lege: (q) => ({ quelle: setzeName(q, nr, 'getroffen'), nr }) }
		: null;
};
