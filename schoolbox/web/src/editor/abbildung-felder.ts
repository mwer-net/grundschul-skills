import type { UhrzeitFeld } from '@schoolbox/kern/src/abbildungen';
import { abschnittVon } from '@schoolbox/kern/src/abbildungen';

import type { AbbildungSteuerung } from './abbildung';

export const leistenFelder = (abb: AbbildungSteuerung) =>
	(abb.schema?.felder ?? []).filter((f): f is UhrzeitFeld => f.art === 'uhrzeit' && f.leiste === true);

export const hatLeistenfeld = (abb: AbbildungSteuerung) => leistenFelder(abb).length > 0;

export const hatWeitere = (abb: AbbildungSteuerung) =>
	abb.aktiv &&
	(abb.schema?.felder ?? []).some(
		(f) => abschnittVon(f) === 'weitere' && !f.ohneFeld && (!f.nurWenn || !abb.werte || f.nurWenn(abb.werte)),
	);
