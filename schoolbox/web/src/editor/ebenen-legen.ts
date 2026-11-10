import {
	istGestaltung,
	kopiereGestaltungNach,
	leseLage,
	ordneInEbene,
	verschiebeAufSeite,
	wechsleEbene,
} from '@schoolbox/kern/src/gestaltung';
import type { EbenenName } from '@schoolbox/kern/src/gestaltung-arten';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { klassenVon, zerlege } from '@schoolbox/kern/src/quelltext';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';

/**
 * Ziehen in den Ebenen als ein Schritt (101): erst auf die Seite (`verschiebeAufSeite`, die Lage bleibt), dann in die
 * Ebene (`wechsleEbene`, dort ganz vorne), dann Platz für Platz nach hinten (`ordneInEbene`). Mit `kopie` bleibt das
 * Original, und die Kopie liegt an derselben Stelle im Blatt.
 */
export const legeInEbenen = (quelle: string, nr: number, ziel: EbenenZiel, kopie: boolean): StrukturErgebnis => {
	const z = zerlege(quelle);
	const seite = seiteUm(z, nr);
	let r: StrukturErgebnis = { quelle, nr };
	if (kopie) {
		const { x, y } = leseLage(quelle, nr);
		r = kopiereGestaltungNach(
			quelle,
			nr,
			{ x: x ?? null, y: y ?? null },
			ziel.seite === seite ? undefined : ziel.seite,
		);
	} else if (ziel.seite !== seite) {
		r = verschiebeAufSeite(quelle, nr, ziel.seite, {});
	}
	if (r.nr === null) {
		return r;
	}
	if (stelleVon(r.quelle, r.nr).ebene !== ziel.ebene) {
		r = wechsleEbene(r.quelle, r.nr, ziel.ebene);
	}
	for (let i = 0; r.nr !== null && i < 500; i += 1) {
		const { platz } = stelleVon(r.quelle, r.nr);
		if (platz === ziel.platz) {
			break;
		}
		const weiter = ordneInEbene(r.quelle, r.nr, platz < ziel.platz ? 'zurueck' : 'vor');
		// Eine Kopie gleicht dem Original Zeichen für Zeichen: Tauschen die beiden, bleibt die Quelle, nur die Nummer wandert.
		if (weiter.quelle === r.quelle && weiter.nr === r.nr) {
			break;
		}
		r = weiter;
	}
	return r;
};

/** Wohin Gestaltung in den Ebenen kommt: Seite (Nummer der `.seite`), Ebene und wie viele andere davor liegen. */
export interface EbenenZiel {
	seite: number;
	ebene: EbenenName;
	platz: number;
}

export const seiteUm = (z: Zerlegung, nr: number) => {
	for (let k = z.knoten[nr]?.eltern ?? null; k; k = k.eltern) {
		if (klassenVon(k).includes('seite')) {
			return k.nr;
		}
	}
	return null;
};

/** Ebene und Platz von vorne des Gestaltungselements `nr`. */
export const stelleVon = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	const eltern = k?.eltern;
	const geschwister = (eltern?.kinder ?? []).filter(istGestaltung);
	const klassen = eltern ? klassenVon(eltern) : [];
	const vorneOderHinten: EbenenName = klassen.includes('vorne') ? 'vorne' : 'hinten';
	const ebene: EbenenName | null = klassen.includes('ebene') ? vorneOderHinten : null;
	return { ebene, platz: k ? geschwister.length - 1 - geschwister.indexOf(k) : 0 };
};
