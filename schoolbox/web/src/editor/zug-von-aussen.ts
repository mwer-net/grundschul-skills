import { huelleImStapel } from '@schoolbox/kern/src/einfuegen-ablage';
import type { Ablage } from '@schoolbox/kern/src/struktur';

import { folgeZeiger, schluckeKlick } from '../bausteine/zeigerzug';
import { elementZu, nrVon } from './darstellung';
import type { Posten } from './einfuegen';
import { aufSeite, entferneLuecke, inLuecke, ordnungFuer, zeigeLuecke } from './luecke';
import type { Platz } from './ziele';
import { platzAn } from './ziele';
import { rolleAnsicht } from './ziehen';

/**
 * Ziehen von außen ins Blatt (094): Der Zug beginnt im Elternfenster (Kachel einer Schublade), läuft über dem `iframe`
 * und endet mit Loslassen oder Esc. Im Stapel zeigt die Lücke (`luecke.ts`) den Platz schon vor dem Loslassen;
 * außerhalb jeder Seite zeigt der Zug nichts, und Loslassen bricht ab. Bis zum Loslassen ändert sich die Quelle nicht.
 *
 * Erweitern (098 Gestaltung, 115 Fläche, 125 Stapel): Ein neues `Ziehgut` bauen, mit eigener `art`, ohne diese Datei
 * umzuschreiben. `modus(cmd)` sagt je Stand der ⌘-Taste, ob es im Stapel einrastet (`stapel`), frei liegt (`frei`)
 * oder nichts tut (`nichts`). Für `frei` zeigt der Zug hier nur den Namen am Zeiger und meldet beim Loslassen den Punkt
 * in Koordinaten des Materials an `legeAb`; was dabei im Blatt zu sehen ist, hängt der neue Ziehgut-Bauer über `folge`
 * ein.
 */

/** Meldet dem `iframe`-Dokument, dass ein Zug von außen läuft (`detail: true`) oder endet; die Leinwand blendet aus. */
export const ZUG_VON_AUSSEN = 'schoolbox-zug-von-aussen';

export type Modus = 'stapel' | 'frei' | 'nichts';

export type Ziel = { modus: 'stapel'; ablage: Ablage } | { modus: 'frei'; x: number; y: number };

export interface Ziehgut {
	/** `baustein` (094), `gestaltung` (098, `gestaltung/ablegen/ziehgut.ts`). */
	art: string;
	/** Steht am Zeiger. */
	name: string;
	/** Was die Lücke zeigt: der Starter, so wie er eingefügt wird. */
	html: string;
	modus: (cmd: boolean) => Modus;
	/** Für Bausteine mit fester Stelle (Kopf, Namenszeile, Fuß): der Platz auf derselben Seite, wo er hingehört. */
	richte?: (doc: Document, platz: Platz) => Platz | null;
	legeAb: (ziel: Ziel) => void;
	/**
	 * Für Gestaltung (098): bei jeder Bewegung der Zeiger im Material, solange er auf einer Seite steht, sonst `null`;
	 * beim Ende `null`, nach `legeAb`. Hier zeigt das Gut seine Vorschau und sein Ziel. Ein Text ersetzt den Namen am
	 * Zeiger.
	 */
	folge?: (punkt: { x: number; y: number } | null, modus: Modus) => string | undefined;
}

/** Was am Zeiger steht, in Koordinaten des Elternfensters. */
export interface ZugAmZeiger {
	name: string;
	x: number;
	y: number;
}

interface Start {
	doc: Document;
	gut: Ziehgut;
	jeSeite: boolean;
	/** Zeiger beim Start, Koordinaten des Elternfensters. */
	x: number;
	y: number;
	id: number;
	cmd: boolean;
	zeige: (anzeige: ZugAmZeiger | null) => void;
}

/** Beginnt den Zug; die Rückgabe bricht ihn ab (etwa wenn die Kachel verschwindet). */
export const zieheVonAussen = (s: Start) => {
	const { doc, gut } = s;
	const rahmen = (doc.defaultView?.frameElement ?? null) as HTMLElement | null;
	const ordnung = ordnungFuer(doc, gut.html);
	let { cmd, x, y } = s;
	let platz: Platz | null = null;
	let vorbei = false;

	/** Zeiger in Koordinaten des Materials; `null` außerhalb des `iframe`. */
	const imMaterial = () => {
		if (!rahmen) {
			return null;
		}
		const r = rahmen.getBoundingClientRect();
		if (x < r.left || x > r.right || y < r.top || y > r.bottom) {
			return null;
		}
		const skala = r.width / Math.max(1, rahmen.offsetWidth);
		return { x: (x - r.left) / skala, y: (y - r.top) / skala };
	};

	const aktualisiere = () => {
		const p = imMaterial();
		const text = gut.folge?.(p && aufSeite(doc, p.x, p.y) ? p : null, gut.modus(cmd));
		s.zeige({ name: text ?? gut.name, x, y });
		if (gut.modus(cmd) !== 'stapel' || !ordnung || !p) {
			platz = null;
		} else if (platz && inLuecke(doc, p.x, p.y)) {
			// In der Lücke bleibt der Platz; sonst verschöbe sie das Blatt unter dem Zeiger hin und her.
		} else if (aufSeite(doc, p.x, p.y)) {
			const roh = platzAn(ordnung, p.x, p.y);
			platz = roh && gut.richte ? gut.richte(doc, roh) : roh;
		} else {
			platz = null;
		}
		if (!platz || !zeigeLuecke(doc, platz, gut.html, { jeSeite: s.jeSeite })) {
			platz = null;
			entferneLuecke(doc);
		}
	};

	const melde = (laeuft: boolean) => doc.dispatchEvent(new CustomEvent(ZUG_VON_AUSSEN, { detail: laeuft }));

	const escImBlatt = (k: KeyboardEvent) => {
		if (k.key === 'Escape') {
			k.preventDefault();
			k.stopImmediatePropagation();
			ende(false);
		}
	};

	const hoereAuf = folgeZeiger({
		bewegen: (m) => {
			if (m.pointerId === s.id) {
				x = m.clientX;
				y = m.clientY;
				cmd = m.metaKey;
				aktualisiere();
			}
		},
		los: (m) => {
			if (m.pointerId === s.id) {
				schluckeKlick();
				ende(true);
			}
		},
		abbruch: () => ende(false),
		taste: (k) => {
			if (k.key === 'Escape') {
				escImBlatt(k);
			} else if (k.key === 'Meta' && !cmd) {
				cmd = true;
				aktualisiere();
			}
		},
		tasteLos: (k) => {
			if (k.key === 'Meta' && cmd) {
				cmd = false;
				aktualisiere();
			}
		},
		bild: () => {
			const r = rahmen?.getBoundingClientRect();
			// Nur über dem Blatt: Am Rand der Schublade rollt deren Liste, nicht die Ansicht.
			if (r && x >= r.left && x <= r.right && rolleAnsicht(rahmen, y)) {
				aktualisiere();
			}
		},
		sperrtRollen: () => true,
	});

	function ende(ablegen: boolean) {
		if (vorbei) {
			return;
		}
		vorbei = true;
		hoereAuf();
		doc.removeEventListener('keydown', escImBlatt, true);
		const p = imMaterial();
		const modus = gut.modus(cmd);
		const ziel = platz;
		entferneLuecke(doc);
		s.zeige(null);
		melde(false);
		if (ablegen && modus === 'stapel' && ziel) {
			gut.legeAb({ modus: 'stapel', ablage: ziel.ablage });
		} else if (ablegen && modus === 'frei' && p && aufSeite(doc, p.x, p.y)) {
			gut.legeAb({ modus: 'frei', ...p });
		}
		gut.folge?.(null, modus);
	}

	// Liegt der Fokus im Blatt, kommt Esc dort an, nicht im Elternfenster.
	doc.addEventListener('keydown', escImBlatt, true);
	melde(true);
	aktualisiere();
	return () => ende(false);
};

const FESTE_STELLE = new Set(['kopf', 'namenszeile', 'fuss']);

/** Wie `festeStelle` im Kern: Kopf und Namenszeile an den Anfang der Seite, der Fuß ans Ende. */
const festerPlatz = (doc: Document, id: string, platz: Platz): Platz | null => {
	const { ablage } = platz;
	const seite = elementZu(doc, 'in' in ablage ? ablage.in : ablage.nr)?.closest('.seite');
	const nrSeite = seite ? nrVon(seite) : null;
	if (!seite || nrSeite === null) {
		return null;
	}
	const kinder = [...seite.children].filter((k) => nrVon(k) !== null);
	const nach = (k: Element | undefined, wo: 'vor' | 'nach'): Platz => {
		const nr = k ? nrVon(k) : null;
		return { ...platz, ablage: nr === null ? { in: nrSeite } : { nr, wo } };
	};
	if (id === 'fuss') {
		return nach(kinder.filter((k) => !k.matches('.fuss, .ebene')).at(-1), 'nach');
	}
	return nach(
		kinder.find((k) => !(id === 'kopf' && k.matches('.namenszeile'))),
		'vor',
	);
};

/** Ein Baustein aus dem Katalog: rastet im Stapel ein; ⌘ wirkt erst mit E5 (125). Nur-Klasse-Einträge ziehen nicht. */
export const ziehgutBaustein = (eintrag: Posten, legeAb: (ablage: Ablage) => void): Ziehgut | null => {
	if (eintrag.einfuegbar.klasse) {
		return null;
	}
	const { html } = huelleImStapel(eintrag.einfuegbar);
	if (!html.trim()) {
		return null;
	}
	return {
		art: 'baustein',
		name: eintrag.name,
		html,
		modus: () => 'stapel',
		...(FESTE_STELLE.has(eintrag.id) ? { richte: (doc: Document, p: Platz) => festerPlatz(doc, eintrag.id, p) } : {}),
		legeAb: (ziel) => {
			if (ziel.modus === 'stapel') {
				legeAb(ziel.ablage);
			}
		},
	};
};
