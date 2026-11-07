import { kann } from '@schoolbox/kern/src/bausteine';
import {
	BILD_KANTE,
	BILD_MIN,
	entferneBild,
	MAX_BILD_BYTES,
	setzeBeschreibung,
	setzeBildBreite,
	setzeBildEin,
	tauscheBild,
} from '@schoolbox/kern/src/bildbefehle';
import type { Knoten } from '@schoolbox/kern/src/quelltext';
import { attribut, klassenVon, zerlege } from '@schoolbox/kern/src/quelltext';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { meldung, sende, sendeDatei } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import type { PfadTeil } from './darstellung';
import { elementZu } from './darstellung';
import type { Struktur } from './struktur';

/** Darunter meldet auch `pruefung.js`, dass ein Bild im Druck unscharf wird. */
const DPI_MIN = 150;
const HEIC_TYP = /^image\/hei[cf]/i;
const HEIC_NAME = /\.hei[cf]$/i;
/** Wie `bildStamm` im Kern: Kameranamen taugen nicht als Beschreibung. */
const GERAETENAME = /^(img|image|dscn?|pxl|photo)[\s_-]*\d*$/i;
/** Höhe eines neuen Bildplatzhalters (`--h` in blatt.css): So groß wird ein Bild, das ihn füllt. */
const PLATZHALTER_HOEHE = 80;

/** Fügt einen leeren Bildplatzhalter ein (093: Klick in der Bilder-Schublade ohne gewähltes Bild). */
export type NeuerPlatz = (quelle: string) => StrukturErgebnis;

export interface BildWerte {
	nr: number;
	/** Ein Bildplatzhalter aus einem Entwurf wird durch das erste Bild ersetzt. */
	platzhalter: boolean;
	src: string;
	/** Aufgelöste Adresse für die Vorschau im Panel. */
	url: string;
	/** Bei Platzhaltern dessen Text. */
	alt: string;
	natur: { breite: number; hoehe: number } | null;
	/** So breit und hoch steht es im Blatt, in px. */
	breite: number;
	hoehe: number;
	/** Breiter als seine Spalte wird es nicht. */
	max: number;
	dpi: number | null;
	/** Wird im Druck unscharf. */
	unscharf: boolean;
	/** Das Blatt ist gerade in der s/w-Ansicht (042). */
	sw: boolean;
	figur: boolean;
	/** Liegt frei (`data-lage`, 103): Die Größe kommt aus `--b`, nicht aus `width`. */
	frei: boolean;
}

export interface Groesse {
	nr: number;
	min: number;
	max: number;
	/** Nur zum Ansehen, während gezogen wird. */
	zeige: (px: number) => void;
	/** Ein Schritt im Verlauf. */
	setze: (px: number) => void;
}

export type BildArbeit = 'hochladen' | 'sammlung' | null;

interface Optionen {
	/** Das sichtbare Dokument; gemessen wird nur, wenn es zur aktuellen Quelle (`html`) gehört. */
	geladen: { doc: Document; html: string } | null;
	html: string | null;
	pfad: PfadTeil[];
	struktur: Struktur;
	/** `/api/dokumente/<mappe>/<dok>` */
	adresse: string;
	/** Adresse der Darstellung, gegen die `src` aufgelöst wird (`/ansicht/<mappe>/dokumente/<dok>/`). */
	basis: string;
	rueckgaengig: () => void;
}

/** Eine Beschreibung aus dem Dateinamen: „kürbis-ernte.jpg“ → „Kürbis ernte“, „IMG_1234.JPG“ → keine. */
export const beschreibungAus = (dateiname: string) => {
	const stamm = dateiname
		.replace(/\.[^.]*$/, '')
		.replace(/[_-]+/g, ' ')
		.trim();
	return GERAETENAME.test(stamm) ? '' : `${stamm.charAt(0).toUpperCase()}${stamm.slice(1)}`;
};

const ladeBild = async (url: string) => {
	const bild = new Image();
	bild.src = url;
	await bild.decode();
	return bild;
};

/**
 * Vor dem Hochladen: HEIC-Fotos (Mac) und Bilder über 25 MB wandelt der Browser selbst in JPEG um, auf höchstens
 * 2400 px. Safari kann HEIC anzeigen, Pillow auf dem Server nicht. Vom iPad kommen Fotos ohnehin als JPEG.
 */
export const bereiteVor = async (datei: File): Promise<{ daten: Blob; name: string }> => {
	const heic = HEIC_TYP.test(datei.type) || HEIC_NAME.test(datei.name);
	if (!heic && datei.size <= MAX_BILD_BYTES) {
		return { daten: datei, name: datei.name };
	}
	const adresse = URL.createObjectURL(datei);
	try {
		const bild = await ladeBild(adresse).catch(() => {
			throw new Error(
				heic
					? 'Dieses Foto (HEIC) kann der Browser nicht öffnen. Bitte als JPEG speichern und noch einmal versuchen.'
					: 'Das Bild ist zu groß (höchstens 25 MB).',
			);
		});
		const faktor = Math.min(1, BILD_KANTE / Math.max(bild.naturalWidth, bild.naturalHeight));
		const leinwand = document.createElement('canvas');
		leinwand.width = Math.round(bild.naturalWidth * faktor);
		leinwand.height = Math.round(bild.naturalHeight * faktor);
		leinwand.getContext('2d')?.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
		const png = !heic && datei.type === 'image/png';
		const daten = await new Promise<Blob | null>((fertig) =>
			leinwand.toBlob(fertig, png ? 'image/png' : 'image/jpeg', 0.9),
		);
		if (!daten || daten.size > MAX_BILD_BYTES) {
			throw new Error('Das Bild ist zu groß (höchstens 25 MB).');
		}
		return { daten, name: `${datei.name.replace(/\.[^.]*$/, '')}.${png ? 'png' : 'jpg'}` };
	} finally {
		URL.revokeObjectURL(adresse);
	}
};

/** Platz in der Spalte: die Innenbreite des Elternelements. */
const spaltenBreite = (element: HTMLElement) => {
	const eltern = element.parentElement;
	const fenster = element.ownerDocument.defaultView;
	if (!eltern || !fenster) {
		return Infinity;
	}
	const stil = fenster.getComputedStyle(eltern);
	return eltern.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight);
};

const miss = (element: HTMLElement, nr: number): BildWerte => {
	const rahmen = element.getBoundingClientRect();
	const max = Math.max(BILD_MIN, Math.floor(spaltenBreite(element)));
	if (element.tagName !== 'IMG') {
		return {
			nr,
			platzhalter: true,
			src: '',
			url: '',
			alt: (element.textContent ?? '').trim().replace(/\s+/g, ' '),
			natur: null,
			breite: rahmen.width,
			hoehe: rahmen.height,
			max,
			dpi: null,
			unscharf: false,
			sw: false,
			figur: false,
			frei: false,
		};
	}
	const bild = element as HTMLImageElement;
	const frei = bild.hasAttribute('data-lage');
	const geladen = bild.complete && bild.naturalWidth > 0;
	// Ein gedrehtes freies Bild hat ein breiteres Rechteck als sich selbst; zählt nur seine eigene Breite.
	const breite = frei ? bild.offsetWidth || rahmen.width : rahmen.width;
	const dpi = geladen && breite > 0 ? Math.round((bild.naturalWidth / breite) * 96) : null;
	return {
		nr,
		platzhalter: false,
		src: bild.getAttribute('src') ?? '',
		url: bild.currentSrc || bild.src,
		alt: bild.getAttribute('alt') ?? '',
		natur: geladen ? { breite: bild.naturalWidth, hoehe: bild.naturalHeight } : null,
		breite: rahmen.width,
		hoehe: rahmen.height,
		max,
		dpi,
		unscharf: dpi !== null && dpi < DPI_MIN,
		sw: bild.ownerDocument.body.classList.contains('sw'),
		figur: bild.classList.contains('figur'),
		frei,
	};
};

/** Steht in der Quelle noch das Bild bzw. der Platzhalter, auf den sich die Aktion bezieht? */
const pruefeNoch = (quelle: string, w: BildWerte) => {
	const k = zerlege(quelle).knoten[w.nr];
	const passt = w.platzhalter
		? k !== undefined && klassenVon(k).includes('platzhalter')
		: k?.tag === 'img' && attribut(k, 'src')?.wert === w.src;
	if (!passt) {
		throw new Error('Das Bild wurde inzwischen geändert. Bitte wähle es noch einmal aus.');
	}
};

/** Der Platzhalter im eingefügten Baustein: er selbst oder sein erstes Kind dieser Art. */
export const platzhalterIn = (quelle: string, nr: number | null) => {
	const k = nr === null ? undefined : zerlege(quelle).knoten[nr];
	const suche = (n: Knoten): Knoten | undefined =>
		klassenVon(n).includes('platzhalter') ? n : n.kinder.map(suche).find(Boolean);
	const p = k ? suche(k) : undefined;
	if (!p) {
		throw new Error('Das Bild ließ sich hier nicht einfügen.');
	}
	return p.nr;
};

/** So breit wird ein neuer Bild-Baustein: so hoch wie ein neuer Platzhalter, höchstens so breit wie die Datei. */
export const breiteImNeuenPlatz = (masse: { breite: number; hoehe: number }) =>
	Math.min(masse.breite, (PLATZHALTER_HOEHE * masse.breite) / Math.max(1, masse.hoehe));

/** Ein neuer Bild-Baustein: Platzhalter einfügen (`neu`) und im selben Schritt füllen. */
export const bildInNeuemPlatz =
	(neu: NeuerPlatz, bild: { src: string; alt: string; breite: number }) =>
	(q: string): StrukturErgebnis => {
		const r = neu(q);
		return setzeBildEin(r.quelle, platzhalterIn(r.quelle, r.nr), bild);
	};

/**
 * Das Bild-Panel (017): Werte des gewählten Bildes aus der Darstellung und die Befehle dazu. Hochladen, Übernehmen
 * legen zuerst eine Datei auf dem Server an; danach ändert ein Befehl nur `src` (bzw. setzt das Bild
 * an die Stelle des Platzhalters). Jeder Befehl ist ein Schritt im Verlauf.
 */
export const useBild = ({ adresse, basis, geladen, html, pfad, rueckgaengig, struktur }: Optionen) => {
	const doc = geladen?.html === html ? geladen.doc : null;
	const zeige = useHinweis();
	const [werte, setWerte] = useState<BildWerte | null>(null);
	const [arbeit, setArbeit] = useState<BildArbeit>(null);
	const gewaehlt = pfad.at(-1);
	const nr = gewaehlt && kann(gewaehlt.baustein, 'bild') ? gewaehlt.nr : null;
	const { fuehreAus } = struktur;
	const aktuell = useRef(werte);

	useEffect(() => {
		aktuell.current = werte;
	});

	useEffect(() => {
		const element = doc && nr !== null ? (elementZu(doc, nr) as HTMLElement | null) : null;
		if (!element || nr === null) {
			setWerte(null);
			return undefined;
		}
		const messen = () => setWerte(miss(element, nr));
		messen();
		element.addEventListener('load', messen);
		return () => element.removeEventListener('load', messen);
	}, [doc, nr]);

	const ausfuehren = useCallback(
		(beschreibung: string, rechne: (q: string, w: BildWerte) => StrukturErgebnis) => {
			const w = aktuell.current;
			if (!w) {
				return null;
			}
			return fuehreAus(beschreibung, (q) => {
				pruefeNoch(q, w);
				return rechne(q, w);
			});
		},
		[fuehreAus],
	);

	const masseVon = useCallback(async (src: string) => {
		const neu = await ladeBild(new URL(src, new URL(basis, window.location.href)).href);
		return { breite: neu.naturalWidth, hoehe: neu.naturalHeight };
	}, [basis]);

	/**
	 * Das neue Bild an die Stelle des alten bzw. des Platzhalters; Größe und Rest bleiben. Ist nichts davon gewählt
	 * und `neu` gegeben, entsteht ein neuer Bild-Baustein: Platzhalter einfügen und füllen ist ein Schritt.
	 */
	const setzeEin = useCallback(
		async (src: string, alt: string, natur: { breite: number; hoehe: number } | null, neu?: NeuerPlatz) => {
			const w = aktuell.current;
			if (!w && neu) {
				const masse = natur ?? (await masseVon(src));
				fuehreAus('Bild eingefügt', bildInNeuemPlatz(neu, { src, alt, breite: breiteImNeuenPlatz(masse) }), true);
				return;
			}
			if (!w) {
				return;
			}
			if (!w.platzhalter) {
				ausfuehren('Bild getauscht', (q) => tauscheBild(q, w.nr, src, alt));
				return;
			}
			const masse = natur ?? (await masseVon(src));
			const breite = Math.min(w.max, w.breite, (w.hoehe * masse.breite) / Math.max(1, masse.hoehe));
			ausfuehren('Bild eingesetzt', (q) => setzeBildEin(q, w.nr, { src, alt: alt || w.alt, breite }));
		},
		[masseVon, ausfuehren, fuehreAus],
	);

	const arbeite = useCallback(
		async (art: BildArbeit, aufgabe: () => Promise<void>) => {
			setArbeit(art);
			try {
				await aufgabe();
			} catch (fehler) {
				zeige({ text: meldung(fehler), art: 'fehler' });
			} finally {
				setArbeit(null);
			}
		},
		[zeige],
	);

	/** `neu`: ohne gewähltes Bild als neuer Bild-Baustein (Bilder-Schublade). */
	const hochladen = (datei: File, neu?: NeuerPlatz) =>
		arbeite('hochladen', async () => {
			const { daten, name } = await bereiteVor(datei);
			const bild = await sendeDatei<{ src: string; breite: number; hoehe: number }>(
				`${adresse}/bilder`,
				daten,
				name,
			);
			await setzeEin(bild.src, beschreibungAus(datei.name), bild, neu);
		});

	const uebernimm = (schluessel: string, alt: string, neu?: NeuerPlatz) =>
		arbeite('sammlung', async () => {
			const { src } = await sende<{ src: string }>(`${adresse}/bilder/uebernehmen`, { schluessel });
			await setzeEin(src, alt, null, neu);
		});

	/**
	 * Holt ein Bild aus der Sammlung oder einem anderen Ordner in diesen Ordner (103: Ziehen aus der Schublade) und gibt
	 * seinen `src` zurück, ohne die Quelle zu ändern; `null` bei einem Fehler (der Hinweis steht dann schon).
	 */
	const hole = (schluessel: string) =>
		new Promise<string | null>((fertig) => {
			void arbeite('sammlung', async () => {
				const { src } = await sende<{ src: string }>(`${adresse}/bilder/uebernehmen`, { schluessel });
				fertig(src);
			}).then(() => fertig(null));
		});

	/** Lädt eine Datei hoch wie „Foto hochladen“ (103: aus dem Finder), ohne die Quelle zu ändern; `null` bei einem Fehler. */
	const ladeHoch = (datei: File) =>
		new Promise<{ src: string; alt: string; breite: number; hoehe: number } | null>((fertig) => {
			void arbeite('hochladen', async () => {
				const { daten, name } = await bereiteVor(datei);
				const bild = await sendeDatei<{ src: string; breite: number; hoehe: number }>(
					`${adresse}/bilder`,
					daten,
					name,
				);
				fertig({ ...bild, alt: beschreibungAus(datei.name) });
			}).then(() => fertig(null));
		});

	const zeigeBreite = (px: number) => {
		const element = doc && werte ? (elementZu(doc, werte.nr) as HTMLElement | null) : null;
		if (!element || !werte) {
			return;
		}
		if (werte.figur) {
			element.style.setProperty('--figur', `${px}px`);
		} else {
			element.style.width = `${px}px`;
			element.style.height = 'auto';
		}
	};

	const setzeBreite = (px: number) => ausfuehren('Größe', (q, w) => setzeBildBreite(q, w.nr, px, w.max));

	const beschreibe = (alt: string) => {
		if (werte && alt.trim() !== werte.alt.trim()) {
			ausfuehren('Beschreibung', (q, w) => setzeBeschreibung(q, w.nr, alt));
		}
	};

	const entferne = () => {
		if (ausfuehren('Bild entfernt', (q, w) => entferneBild(q, w.nr))) {
			zeige({ text: 'Bild entfernt.', aktion: { titel: 'Rückgängig', ausfuehren: rueckgaengig } });
		}
	};

	// Freie Bilder (103): Größe nur über `--b` (Griffe, „Position und Größe“), sonst zwei Größenlogiken.
	const groesse: Groesse | null =
		werte && !werte.platzhalter && !werte.frei && struktur.aktiv
			? { nr: werte.nr, min: BILD_MIN, max: werte.max, zeige: zeigeBreite, setze: setzeBreite }
			: null;

	return {
		aktiv: struktur.aktiv,
		werte,
		arbeit,
		groesse,
		adresse,
		hochladen,
		uebernimm,
		hole,
		ladeHoch,
		zeigeBreite,
		setzeBreite,
		beschreibe,
		entferne,
	};
};

export type BildSteuerung = ReturnType<typeof useBild>;

/** Für Teile ohne eigene Leitung zum Editor (103: Inspektor bei freien Bildern); `Inspektor.tsx` stellt es bereit. */
export const BildKontext = createContext<BildSteuerung | null>(null);

export const useBildKontext = () => useContext(BildKontext);
