import { tauscheBild } from '@schoolbox/kern/src/bildbefehle';
import { bildFreiHtml, breiteBeimAblegen } from '@schoolbox/kern/src/bilder-frei';
import { fuegeBausteinAn, huelleImStapel } from '@schoolbox/kern/src/einfuegen-ablage';
import { schuetzeAttribut, zerlege } from '@schoolbox/kern/src/quelltext';
import type { Ablage, StrukturErgebnis } from '@schoolbox/kern/src/struktur';

import { bildInNeuemPlatz, breiteImNeuenPlatz } from '../../bild';
import type { Posten } from '../../einfuegen';
import type { Struktur } from '../../struktur';
import type { AblegenTeile } from './ablegen';
import type { GestaltungsGut } from './ziehgut';
import { gestaltungsgut } from './ziehgut';

/**
 * Bilder ablegen (103): ein Bild aus der Schublade „Bilder“ oder aus dem Finder als `GestaltungsGut`. Frei liegt es als
 * `img.bild-frei`, höchstens 320 px breit; ⌘ macht es zum Bild-Baustein im Stapel (Platzhalter einfügen und füllen wie
 * der Klick ohne Auswahl aus 093). Die Ziele `bild-auf-bild.ts` und `platzhalter.ts` erkennen das Gut an `bildVonGut`.
 */

export interface BildDaten {
	/** Beim Ziehen aus der Schublade die Adresse der Vorschau; den echten `src` holt erst das Ablegen (`mitGeholtemBild`). */
	src: string;
	alt: string;
	/** Pixel der Datei, wenn bekannt. */
	natur: { breite: number; hoehe: number } | null;
}

const BILDER = new WeakMap<GestaltungsGut, BildDaten>();

/** Breite als Bild-Baustein; ohne bekannte Maße quadratisch so hoch wie ein neuer Platzhalter (80 px). */
const breiteImStapel = (bild: BildDaten) =>
	Math.round(bild.natur ? breiteImNeuenPlatz(bild.natur) : breiteImNeuenPlatz({ breite: 80, hoehe: 80 }));

/** Das Bild hinter einem Gut, sonst `null` (Formen, Figuren …). */
export const bildVonGut = (gut: GestaltungsGut): BildDaten | null => BILDER.get(gut) ?? null;

/** Was ⌘ braucht: der Bildplatzhalter aus dem Katalog und die Nummerierung. */
export interface ImStapel {
	platz: Posten | undefined;
	jeSeite: boolean;
	struktur: AblegenTeile['struktur'];
}

/** Rechnet einen neuen Bild-Baustein an der Ablage: Platzhalter einfügen und füllen, ein Schritt. */
export const bildBausteinAn = (platz: Posten, bild: BildDaten, ablage: Ablage, jeSeite: boolean) =>
	bildInNeuemPlatz((q) => fuegeBausteinAn(q, platz.einfuegbar, ablage, { jeSeite }), {
		src: bild.src,
		alt: bild.alt,
		breite: breiteImStapel(bild),
	});

/** Das Gut eines Bildes; `stapel` schaltet ⌘ frei (ohne Bildplatzhalter im Katalog legt ⌘ das Bild in eine neue Fläche, 115). */
export const bildGut = (bild: BildDaten, stapel?: ImStapel): GestaltungsGut => {
	const platz = stapel?.platz;
	const imStapel =
		stapel && platz
			? {
					html: huelleImStapel({
						...platz.einfuegbar,
						html: `<img src="${schuetzeAttribut(bild.src)}" alt="" style="width:${breiteImStapel(bild)}px">`,
					}).html,
					legeAb: (ablage: Ablage) => {
						stapel.struktur.fuehreAus('Bild eingefügt', bildBausteinAn(platz, bild, ablage, stapel.jeSeite));
					},
				}
			: undefined;
	const gut = gestaltungsgut({
		name: bild.alt || 'Bild',
		html: bildFreiHtml(bild.src, bild.alt),
		groesse: { b: breiteBeimAblegen(bild.natur) },
		...(imStapel ? { imStapel } : {}),
	});
	BILDER.set(gut, bild);
	return gut;
};

/** Im Ergebnis bekommt das Bild statt der Vorschau-Adresse seinen echten `src`. */
const mitSrc = (r: StrukturErgebnis, vorschau: string, src: string): StrukturErgebnis => {
	const k = r.nr === null ? undefined : zerlege(r.quelle).knoten[r.nr];
	if (k?.tag === 'img' && k.attribute.some((a) => a.name === 'src' && a.wert === vorschau)) {
		return tauscheBild(r.quelle, k.nr, src);
	}
	const alt = `src="${schuetzeAttribut(vorschau)}"`;
	return { ...r, quelle: r.quelle.split(alt).join(`src="${schuetzeAttribut(src)}"`) };
};

/**
 * Ablegen mit Übernahme: Erst holt `hole` das Bild in diesen Ordner (Server), dann rechnet der Schritt mit dem echten
 * `src`. So entsteht ein Schritt ohne Zwischenzustand in der Quelle. `zeige` meldet, solange geholt wird.
 */
export const mitGeholtemBild = (
	struktur: Pick<Struktur, 'fuehreAus'>,
	vorschau: string,
	hole: () => Promise<string | null>,
	zeige: (laeuft: boolean) => void,
): AblegenTeile['struktur'] => ({
	fuehreAus: (beschreibung, rechne, springen, halten) => {
		zeige(true);
		void hole().then((src) => {
			zeige(false);
			if (src) {
				struktur.fuehreAus(beschreibung, (q) => mitSrc(rechne(q), vorschau, src), springen, halten);
			}
		});
		return null;
	},
});
