/**
 * Was der Inspektor bei einem Gestaltungselement liest und schreibt, soweit `gestaltung.ts` (092) es nicht schon kann
 * (099): Druck in s/w mit dem Standard der Art, „Darf Inhalt überdecken“ und die Drehung im Bereich −180 bis 180.
 */

import type { SwVerhalten } from './gestaltung';
import type { Aenderung } from './quelltext';
import { attribut, setzeAttribut, wendeAn, zerlege } from './quelltext';

/** Ohne `data-sw` sind Seitenfläche, Kopfband und Streuung in s/w weg, alles andere grau (Briefing 4.2, blatt.css). */
const SW_WEG = new Set(['seitenflaeche', 'kopfband', 'streuung']);

export const swStandard = (art: string): SwVerhalten => (SW_WEG.has(art) ? 'weg' : 'grau');

const knotenAn = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	return { z, k };
};

/** Was in s/w gilt: `data-sw`, sonst der Standard der Art. */
export const leseSw = (quelle: string, nr: number, art: string): SwVerhalten => {
	const wert = attribut(knotenAn(quelle, nr).k, 'data-sw')?.wert;
	return wert === 'weg' || wert === 'grau' ? wert : swStandard(art);
};

/** Für `setzeSw`: Der Standard der Art wird nicht geschrieben, `data-sw` verschwindet dann. */
export const swZumSchreiben = (art: string, sw: SwVerhalten): SwVerhalten | null =>
	sw === swStandard(art) ? null : sw;

export const UEBERLAGERT_OK = 'data-ueberlagert-ok';

export const leseUeberlagertOk = (quelle: string, nr: number) =>
	Boolean(attribut(knotenAn(quelle, nr).k, UEBERLAGERT_OK));

/** `data-ueberlagert-ok` ohne Wert, am Ende des Start-Tags; aus entfernt es. */
export const setzeUeberlagertOk = (quelle: string, nr: number, an: boolean) => {
	const { k, z } = knotenAn(quelle, nr);
	if (!an) {
		return wendeAn(quelle, setzeAttribut(z, k, UEBERLAGERT_OK, null));
	}
	if (attribut(k, UEBERLAGERT_OK)) {
		return quelle;
	}
	const tag = quelle.slice(k.start, k.oeffnerEnde);
	const pos = k.start + (/\s*\/?>$/.exec(tag)?.index ?? tag.length);
	const a: Aenderung = { von: pos, bis: pos, text: ` ${UEBERLAGERT_OK}` };
	return wendeAn(quelle, [a]);
};

/** −12 und 348 meinen dasselbe: gespeichert wird im Bereich −180 bis 180, eine Nachkommastelle. */
export const drehungImBereich = (grad: number) => {
	const rest = (((grad + 180) % 360) + 360) % 360;
	const wert = Math.round((rest - 180) * 10) / 10;
	return Object.is(wert, -0) ? 0 : wert;
};
