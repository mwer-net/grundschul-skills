import { kann } from './bausteine';
import type { Knoten, Zerlegung } from './quelltext';
import { attribut, innenVon, zerlege } from './quelltext';
import { bausteinVonKnoten } from './referenz';
import type { Bereich, Stueck } from './textstuecke';
import { reinerText, stueckeVon, textVon } from './textstuecke';

/**
 * Was an einem Text gerade gilt (083). Die einzige Quelle für die Regler im Inspektor. Getrennt von `sprache.ts`, weil
 * der Editor dies bei jeder Auswahl braucht, die Silbentrennung aber erst beim Klick lädt.
 */
export type SilbenDarstellung = 'boegen' | 'farbe' | 'beides';
export type SilbenStand = 'aus' | SilbenDarstellung | 'teilweise';

export interface Sprachstand {
	/** Das Element, auf das die Werkzeuge wirken: bei `x-silben` der Text darum, wenn es einen gibt. */
	ziel: number;
	silben: SilbenStand;
	vokale: boolean;
	buchstaben: string | null;
	zeilennummern: 1 | 5 | null;
	umwandelbar: boolean;
	/** Überschrift und Lernziel: nur Silben. */
	nurSilben: boolean;
	/** Nur bei Absätzen. */
	mitZeilennummern: boolean;
	/** Silben, Hervorhebung oder Fett fielen bei einer Umwandlung weg, das sagt der Abschnitt vorher. */
	ausgezeichnet: boolean;
}

export const VOKAL = 'aeiouäöüyAEIOUÄÖÜY';
const NUR_SILBEN = new Set(['ueberschrift', 'ziel', 'wahlhilfe']);
/** Der Inhalt einer anderen Abbildung ist kein Text, den die Werkzeuge ändern können. */
const FREMDE_ABBILDUNG = /<x-(?!silben[\s>])/;
const artVon = (k: Knoten) => bausteinVonKnoten(k, false)?.art;

const istTextTraeger = (k: Knoten) => {
	const b = bausteinVonKnoten(k, false);
	return b !== undefined && kann(b, 'text');
};

/** Der Text, auf den die Werkzeuge wirken; ein `x-silben` allein auf der Seite ist selbst dieser Text. */
export const textZielVon = (k: Knoten) => (k.tag === 'x-silben' && k.eltern && istTextTraeger(k.eltern) ? k.eltern : k);

/** Eine Regel an einer Stelle: Hier wird aus Text ein neuer Baustein. Absatz, Zelle, Listenpunkt. */
export const istUmwandelbar = (k: Knoten) => {
	const art = artVon(k);
	return (
		(art === 'absatz' && (k.tag === 'p' || k.tag === 'li')) ||
		art === 'tabellenzelle' ||
		(art === 'freitext' && k.tag === 'div')
	);
};

export const hatFremdeAbbildung = (innen: string) => FREMDE_ABBILDUNG.test(innen);

export interface Stelle {
	k: Knoten;
	von: number;
	bis: number;
}

/** Die `x-silben` im Text mit ihrer Lage im sichtbaren Text. Das Ziel selbst, wenn es eines ist. */
export const stellenIn = (z: Zerlegung, ziel: Knoten): Stelle[] => {
	if (ziel.tag === 'x-silben') {
		return [{ k: ziel, von: 0, bis: reinerText(innenVon(z, ziel), true).length }];
	}
	const laenge = (bis: number) => textVon(stueckeVon(z.quelle.slice(ziel.oeffnerEnde, bis))).length;
	return z.knoten
		.filter((k) => k.tag === 'x-silben' && k.start >= ziel.oeffnerEnde && k.ende <= ziel.schliesserStart)
		.map((k) => ({ k, von: laenge(k.start), bis: laenge(k.schliesserStart) }));
};

export const beruehrt = (s: Stelle, b: Bereich) => s.von < b.bis && s.bis > b.von;

const BUCHSTABE_ODER_ZAHL = /[\p{L}\p{N}]/u;

/** Liegt jeder Buchstabe des Texts in einer dieser Stellen? */
export const decktAlles = (z: Zerlegung, ziel: Knoten, stellen: Stelle[]) => {
	if (ziel.tag === 'x-silben') {
		return true;
	}
	const text = textVon(stueckeVon(innenVon(z, ziel)));
	for (let i = 0; i < text.length; i += 1) {
		if (BUCHSTABE_ODER_ZAHL.test(text.charAt(i)) && !stellen.some((s) => s.von <= i && i < s.bis)) {
			return false;
		}
	}
	return true;
};

export const darstellungVon = (k: Knoten): SilbenDarstellung => {
	const wert = attribut(k, 'darstellung')?.wert;
	return wert === 'farbe' || wert === 'beides' ? wert : 'boegen';
};

const silbenStand = (z: Zerlegung, ziel: Knoten, stellen: Stelle[]): SilbenStand => {
	const erste = stellen[0];
	if (!erste) {
		return 'aus';
	}
	const gleich = stellen.every((s) => darstellungVon(s.k) === darstellungVon(erste.k));
	return gleich && decktAlles(z, ziel, stellen) ? darstellungVon(erste.k) : 'teilweise';
};

const IST_MARK_AUF = /^<mark\s*>$/i;
const IST_MARK_ZU = /^<\/mark\s*>$/i;

/** Die Stücke ohne `<mark>` und welche davon markiert sind. Andere Tags und `<mark class=…>` bleiben Tags. */
export const ohneMarken = (html: string, inSilben = false) => {
	const stuecke: Stueck[] = [];
	const markiert = new Set<number>();
	let auf = false;
	for (const s of stueckeVon(html, inSilben)) {
		if (s.tag && IST_MARK_AUF.test(s.roh)) {
			auf = true;
		} else if (s.tag && IST_MARK_ZU.test(s.roh)) {
			auf = false;
		} else {
			if (auf && !s.tag) {
				markiert.add(stuecke.length);
			}
			stuecke.push(s);
		}
	}
	return { stuecke, markiert };
};

const istVokal = (z: string) => VOKAL.includes(z);

const markenStand = (innen: string, inSilben: boolean) => {
	const { markiert, stuecke } = ohneMarken(innen, inSilben);
	const sichtbar = stuecke.map((s, i) => ({ s, i })).filter(({ s }) => s.zeichen !== '');
	const vokale = sichtbar.filter(({ s }) => istVokal(s.zeichen));
	const alleVokale = vokale.length > 0 && vokale.every(({ i }) => markiert.has(i));
	const laeufe: string[] = [];
	let lauf = '';
	const schliesse = () => {
		if (lauf !== '' && !/\s/.test(lauf) && (!alleVokale || [...lauf].some((c) => !istVokal(c)))) {
			laeufe.push(lauf.toLowerCase());
		}
		lauf = '';
	};
	for (const { i, s } of sichtbar) {
		if (markiert.has(i)) {
			lauf += s.zeichen;
		} else {
			schliesse();
		}
	}
	schliesse();
	return { vokale: alleVokale, buchstaben: laeufe.length > 0 ? [...new Set(laeufe)].join(', ') : null };
};

/** `null`, wenn hier nichts zu machen ist: kein Text, eine andere Abbildung im Text oder gar kein Text-Baustein. */
export const leseSprachstand = (quelle: string, nr: number): Sprachstand | null => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k || (k.tag !== 'x-silben' && !istTextTraeger(k))) {
		return null;
	}
	const ziel = textZielVon(k);
	const innen = innenVon(z, ziel);
	if (hatFremdeAbbildung(innen) || reinerText(innen).trim() === '') {
		return null;
	}
	const eigene = k !== ziel;
	const stellen = stellenIn(z, ziel);
	const wert = attribut(ziel, 'data-zeilennummern')?.wert;
	return {
		ziel: ziel.nr,
		silben: eigene ? darstellungVon(k) : silbenStand(z, ziel, stellen),
		...markenStand(innen, ziel.tag === 'x-silben'),
		zeilennummern: ({ 1: 1, 5: 5 } as const)[wert ?? ''] ?? null,
		umwandelbar: istUmwandelbar(ziel),
		nurSilben: NUR_SILBEN.has(artVon(ziel) ?? ''),
		mitZeilennummern: ziel.tag === 'p' && artVon(ziel) === 'absatz',
		ausgezeichnet: /<[a-z]/i.test(innen),
	};
};
