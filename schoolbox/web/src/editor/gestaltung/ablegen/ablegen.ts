import { FLAECHE_RAND, flaecheHtml, hoeheUm, legeFlaeche } from '@schoolbox/kern/src/flaeche';
import type { LageTeil } from '@schoolbox/kern/src/gestaltung';
import { htmlMitLage, legeGestaltungAb } from '@schoolbox/kern/src/gestaltung';

import { nrVon } from '../../darstellung';
import type { PalettenEintrag } from '../../palette-suche';
import type { SchubladenZiele } from '../../schubladen';
import { sichtfeldVon } from '../../sichtfeld';
import type { Struktur } from '../../struktur';
import type { Ziehgut } from '../../zug-von-aussen';
import { zeigeAblageLinien } from '../ablage-linien';
import type { Kandidat } from '../einrasten';
import { kandidatenAufSeite, rasteEin } from '../einrasten';
import { eckeVon, entferneVorschau, markiereZiel, missHoehe, seitenIn, seiteUnter, zeigeVorschau } from './vorschau';
import type { GestaltungsGut } from './ziehgut';
import type { AblageTreffer } from './ziele';
import { zielFuer } from './ziele';

/** Was das Ablegen vom Editor braucht; `SchubladenTeile` passt dazu. */
export interface AblegenTeile {
	doc: Document | null;
	struktur: Pick<Struktur, 'fuehreAus'>;
	folien: boolean;
}

/** Linke obere Ecke in Koordinaten der Seite (wie `--x`, `--y`); `seite` ist die Nummer der `.seite`. */
export interface Ort {
	seite: number;
	x: number;
	y: number;
}

/** Steht am Zeiger, wenn ⌘ beim Ziehen für dieses Gut noch nichts bewirkt. */
export const GEHT_NOCH_NICHT = 'Geht noch nicht';

const lageVon = (gut: GestaltungsGut, x: number, y: number): LageTeil => ({
	x,
	y,
	...(gut.breiteAusInhalt ? {} : { b: gut.groesse.b }), // 105
	...(gut.groesse.h === undefined ? {} : { h: gut.groesse.h }),
});

/** Legt das Gut ab: ein Schritt, danach ist das neue Element gewählt. Die Lage darf über die Seite hinausragen. */
export const legeAb = (struktur: AblegenTeile['struktur'], gut: GestaltungsGut, ort: Ort) => {
	gut.vorDemAblegen?.(); // 105
	return (
		struktur.fuehreAus(`${gut.name} abgelegt`, (q) =>
			legeGestaltungAb(q, {
				seite: ort.seite,
				ebene: gut.ebene,
				html: gut.anpassen?.(gut.html, ort) ?? gut.html, // 109
				lage: lageVon(gut, ort.x, ort.y),
			}),
		) !== null
	);
};

const hoeheVon = (doc: Document, seite: Element, gut: GestaltungsGut) =>
	gut.groesse.h ?? missHoehe(doc, seite, gut.html, gut.groesse.b);

/** Der Ort, an dem der Punkt (Koordinaten des Materials) in der Mitte des Elements liegt. */
const ortUm = (doc: Document, seite: Element, gut: GestaltungsGut, x: number, y: number, hoehe: number): Ort | null => {
	const nr = nrVon(seite);
	if (nr === null) {
		return null;
	}
	const ecke = eckeVon(seite);
	// Eingerastet wird nur beim Ziehen (`ortAn` in `ziehgutGestaltung`), nicht beim Klick in die Mitte.
	return { seite: nr, x: x - ecke.x - gut.groesse.b / 2, y: y - ecke.y - hoehe / 2 };
};

/** Maßstab der Leinwand: Bildschirm-px je px des Materials. */
const skalaVon = (rahmen: HTMLElement) => rahmen.getBoundingClientRect().width / Math.max(1, rahmen.offsetWidth);

/** Der sichtbare Teil des Materials in seinen Koordinaten; ohne Ansicht das ganze Material. */
const sichtbarImMaterial = (doc: Document) => {
	const rahmen = doc.defaultView?.frameElement as HTMLElement | null | undefined;
	const sicht = sichtfeldVon(doc);
	if (!rahmen || !sicht) {
		return { oben: -Infinity, unten: Infinity, links: -Infinity, rechts: Infinity };
	}
	const skala = skalaVon(rahmen);
	return {
		oben: (sicht.oben - rahmen.offsetTop) / skala,
		unten: (sicht.unten - rahmen.offsetTop) / skala,
		links: (sicht.links - rahmen.offsetLeft) / skala,
		rechts: (sicht.rechts - rahmen.offsetLeft) / skala,
	};
};

/** Die Seite, von der am meisten zu sehen ist, mit dem sichtbaren Ausschnitt; 117 nimmt sie für „Figur von Claude“. */
export const sichtbarsteSeite = (doc: Document) => {
	const sicht = sichtbarImMaterial(doc);
	const seiten = seitenIn(doc).map((seite) => {
		const r = seite.getBoundingClientRect();
		const oben = Math.max(r.top, sicht.oben);
		const unten = Math.min(r.bottom, sicht.unten);
		const links = Math.max(r.left, sicht.links);
		const rechts = Math.min(r.right, sicht.rechts);
		return { seite, oben, unten, links, rechts, zuSehen: unten - oben };
	});
	return seiten.reduce<(typeof seiten)[number] | null>((a, s) => (!a || s.zuSehen > a.zuSehen ? s : a), null);
};

/**
 * Klick in der Schublade (und Enter in ⌘K): in die Mitte des sichtbaren Teils der Seite, die am meisten zu sehen ist.
 * `true`, wenn etwas abgelegt wurde.
 */
export const legeInMitte = (teile: AblegenTeile, gut: GestaltungsGut) => {
	const { doc } = teile;
	const beste = doc ? sichtbarsteSeite(doc) : null;
	if (!doc || !beste) {
		return false;
	}
	const r = beste.seite.getBoundingClientRect();
	// Ist die Seite gar nicht zu sehen, gilt ihre eigene Mitte.
	const y = beste.zuSehen > 0 ? (beste.oben + beste.unten) / 2 : (r.top + r.bottom) / 2;
	const x = beste.rechts > beste.links ? (beste.links + beste.rechts) / 2 : (r.left + r.right) / 2;
	const ort = ortUm(doc, beste.seite, gut, x, y, hoeheVon(doc, beste.seite, gut));
	return ort ? legeAb(teile.struktur, gut, ort) : false;
};

/**
 * 115: ⌘ beim Ziehen aus der Schublade, wenn das Gut kein eigenes `imStapel` hat: eine neue Fläche mit dem Element darin,
 * so hoch wie das Element plus Rand, das Element in der Mitte der Inhaltsbreite. `undefined`, wenn es keine Seite gibt.
 */
const flaechenGut = (teile: AblegenTeile, gut: GestaltungsGut): GestaltungsGut['imStapel'] => {
	const { doc } = teile;
	const seite = doc ? seitenIn(doc)[0] : undefined;
	if (!doc || !seite) {
		return undefined;
	}
	const hoehe = hoeheUm(hoeheVon(doc, seite, gut));
	const stil = doc.defaultView?.getComputedStyle(seite);
	const inhalt =
		seite.clientWidth - (parseFloat(stil?.paddingLeft ?? '') || 0) - (parseFloat(stil?.paddingRight ?? '') || 0);
	const lage = lageVon(gut, Math.max(0, Math.round((inhalt - gut.groesse.b) / 2)), FLAECHE_RAND);
	return {
		html: flaecheHtml(hoehe, htmlMitLage(gut.html.trim(), lage)),
		legeAb: (ablage) => {
			gut.vorDemAblegen?.();
			teile.struktur.fuehreAus(`${gut.name} in den Stapel gelegt`, (q) =>
				legeFlaeche(q, ablage, hoehe, { jeSeite: teile.folien }, { html: gut.html, lage }),
			);
		},
	};
};

/**
 * Das `Ziehgut` (094) für Gestaltung: frei mit halb durchsichtiger Vorschau im `iframe`, ein passendes Ziel zeigt
 * Rahmen und Text und gewinnt beim Loslassen, ⌘ schaltet auf `imStapel` oder zeigt „Geht noch nicht“.
 */
export const ziehgutGestaltung = (teile: AblegenTeile, gut: GestaltungsGut): Ziehgut | null => {
	const { doc } = teile;
	if (!doc) {
		return null;
	}
	const stapel = gut.imStapel ?? flaechenGut(teile, gut); // 115
	let treffer: AblageTreffer | null = null;
	let hoehe: number | null = null;
	// Einrasten (100): Kandidaten einmal je Seite, nicht bei jeder Bewegung.
	let raster: { seite: Element; kandidaten: Kandidat[] } | null = null;

	const ortAn = (x: number, y: number) => {
		const seite = seiteUnter(doc, x, y);
		if (!seite) {
			zeigeAblageLinien(null);
			return null;
		}
		hoehe ??= hoeheVon(doc, seite, gut);
		const ort = ortUm(doc, seite, gut, x, y, hoehe);
		if (!ort) {
			return null;
		}
		const ecke = eckeVon(seite);
		if (raster?.seite !== seite) {
			raster = { seite, kandidaten: kandidatenAufSeite(seite, ecke) };
		}
		const rahmen = doc.defaultView?.frameElement as HTMLElement | null | undefined;
		const { lage, linien } = rasteEin(
			{ x: ort.x, y: ort.y, b: gut.groesse.b, h: hoehe, drehen: 0 },
			raster.kandidaten,
			rahmen ? skalaVon(rahmen) : 1,
		);
		zeigeAblageLinien({ doc, ursprung: ecke, linien });
		return { seite, ort: { ...ort, x: lage.x, y: lage.y } };
	};

	const raeume = () => {
		zeigeAblageLinien(null);
		treffer = null;
		entferneVorschau(doc);
		markiereZiel(doc, null);
	};

	return {
		art: gut.art,
		name: gut.name,
		html: stapel?.html ?? gut.html,
		modus: (cmd) => {
			if (!cmd) {
				return 'frei';
			}
			return stapel ? 'stapel' : 'nichts';
		},
		folge: (punkt, modus) => {
			if (!punkt || modus !== 'frei') {
				raeume();
				return modus === 'nichts' ? GEHT_NOCH_NICHT : undefined;
			}
			// Die Vorschau nimmt keine Zeiger an: Darunter liegt, was der Zeiger trifft.
			treffer = zielFuer(doc.elementFromPoint(punkt.x, punkt.y), gut);
			markiereZiel(doc, treffer?.rahmen ?? null);
			if (treffer) {
				entferneVorschau(doc);
				zeigeAblageLinien(null);
				return treffer.text;
			}
			const da = ortAn(punkt.x, punkt.y);
			if (da) {
				zeigeVorschau(
					doc,
					da.seite,
					gut.anpassen?.(gut.html, da.ort) ?? gut.html,
					lageVon(gut, da.ort.x, da.ort.y),
					gut.ebene,
				); // 109
			} else {
				entferneVorschau(doc);
			}
			return undefined;
		},
		legeAb: (ziel) => {
			zeigeAblageLinien(null);
			if (ziel.modus === 'stapel') {
				stapel?.legeAb(ziel.ablage);
				return;
			}
			if (treffer) {
				teile.struktur.fuehreAus(treffer.text, treffer.lege);
				return;
			}
			const da = ortAn(ziel.x, ziel.y);
			zeigeAblageLinien(null);
			if (da) {
				legeAb(teile.struktur, gut, da.ort);
			}
		},
	};
};

/** Ein Eintrag für ⌘K (`suche` einer Schublade): Enter legt das Gut in die Mitte. */
export const ablegenEintrag = (gut: GestaltungsGut, z: SchubladenZiele, gruppe: string): PalettenEintrag => ({
	id: `ablegen:${gut.name}`,
	titel: gut.name,
	gruppe,
	symbol: 'plus',
	aus: () => legeInMitte(z.teile, gut),
});
