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
import { attribut, klassenVon, zerlege } from '@schoolbox/kern/src/quelltext';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import { useCallback, useEffect, useRef, useState } from 'react';

import { meldung, sende, sendeDatei } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import type { PfadTeil } from './darstellung';
import { elementZu } from './darstellung';
import type { Struktur } from './struktur';

/** Darunter meldet auch `pruefung.js`, dass ein Bild im Druck unscharf wird. */
const DPI_MIN = 150;
const FARBIG_AB = 30;
const HEIC_TYP = /^image\/hei[cf]/i;
const HEIC_NAME = /\.hei[cf]$/i;
/** Wie `bildStamm` im Kern: Kameranamen taugen nicht als Beschreibung. */
const GERAETENAME = /^(img|image|dscn?|pxl|photo)[\s_-]*\d*$/i;

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
	/** Nur im s/w-Profil: Das Bild ist farbig. */
	farbig: boolean;
	figur: boolean;
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

export type BildArbeit = 'hochladen' | 'sammlung' | 'grau' | null;

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

/** Wie `pruefung.js`: mittlere Buntheit der deckenden Pixel einer 64 × 64-Verkleinerung. */
const istFarbig = (bild: HTMLImageElement) => {
	const leinwand = bild.ownerDocument.createElement('canvas');
	leinwand.width = 64;
	leinwand.height = 64;
	const kontext = leinwand.getContext('2d', { willReadFrequently: true });
	if (!kontext || !bild.naturalWidth) {
		return false;
	}
	try {
		kontext.drawImage(bild, 0, 0, 64, 64);
		const d = kontext.getImageData(0, 0, 64, 64).data;
		let summe = 0;
		let n = 0;
		for (let i = 0; i < d.length; i += 4) {
			if ((d[i + 3] ?? 0) > 128) {
				const [r = 0, g = 0, b = 0] = [d[i], d[i + 1], d[i + 2]];
				summe += Math.max(r, g, b) - Math.min(r, g, b);
				n += 1;
			}
		}
		return n > 0 && summe / n > FARBIG_AB;
	} catch {
		return false;
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
	const sw = element.ownerDocument.body.classList.contains('sw');
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
			farbig: false,
			figur: false,
		};
	}
	const bild = element as HTMLImageElement;
	const geladen = bild.complete && bild.naturalWidth > 0;
	const dpi = geladen && rahmen.width > 0 ? Math.round((bild.naturalWidth / rahmen.width) * 96) : null;
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
		farbig: sw && geladen && istFarbig(bild),
		figur: bild.classList.contains('figur'),
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

/**
 * Das Bild-Panel (017): Werte des gewählten Bildes aus der Darstellung und die Befehle dazu. Hochladen, Übernehmen
 * und Graustufen legen zuerst eine Datei auf dem Server an; danach ändert ein Befehl nur `src` (bzw. setzt das Bild
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

	/** Das neue Bild an die Stelle des alten bzw. des Platzhalters; Größe und Rest bleiben. */
	const setzeEin = useCallback(
		async (src: string, alt: string, natur: { breite: number; hoehe: number } | null) => {
			const w = aktuell.current;
			if (!w) {
				return;
			}
			if (!w.platzhalter) {
				ausfuehren('Bild getauscht', (q) => tauscheBild(q, w.nr, src, alt));
				return;
			}
			let masse = natur;
			if (!masse) {
				const neu = await ladeBild(new URL(src, new URL(basis, window.location.href)).href);
				masse = { breite: neu.naturalWidth, hoehe: neu.naturalHeight };
			}
			const breite = Math.min(w.max, w.breite, (w.hoehe * masse.breite) / Math.max(1, masse.hoehe));
			ausfuehren('Bild eingesetzt', (q) => setzeBildEin(q, w.nr, { src, alt: alt || w.alt, breite }));
		},
		[basis, ausfuehren],
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

	const hochladen = (datei: File) =>
		arbeite('hochladen', async () => {
			const { daten, name } = await bereiteVor(datei);
			const bild = await sendeDatei<{ src: string; breite: number; hoehe: number }>(
				`${adresse}/bilder`,
				daten,
				name,
			);
			await setzeEin(bild.src, beschreibungAus(datei.name), bild);
		});

	const uebernimm = (schluessel: string, alt: string) =>
		arbeite('sammlung', async () => {
			const { src } = await sende<{ src: string }>(`${adresse}/bilder/uebernehmen`, { schluessel });
			await setzeEin(src, alt, null);
		});

	const graustufen = () =>
		arbeite('grau', async () => {
			const w = aktuell.current;
			if (!w) {
				return;
			}
			const { src } = await sende<{ src: string }>(`${adresse}/bilder/graustufen`, { src: w.src });
			ausfuehren('In Graustufen', (q) => tauscheBild(q, w.nr, src));
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

	const groesse: Groesse | null =
		werte && !werte.platzhalter && struktur.aktiv
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
		graustufen,
		zeigeBreite,
		setzeBreite,
		beschreibe,
		entferne,
	};
};

export type BildSteuerung = ReturnType<typeof useBild>;
