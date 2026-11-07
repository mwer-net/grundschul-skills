import type { Figur } from '@schoolbox/kern/src/figuren';
import { FIGUREN, figurSchluessel, figurSrc } from '@schoolbox/kern/src/figuren';
import { useEffect, useState } from 'react';

import { sende } from '../../api';

/**
 * Woher eine Figur im Dokument ihr `src` bekommt (102): wie jedes Bild aus der Sammlung über `uebernimmBild`
 * (`POST <adresse>/bilder/uebernehmen`). Das geschieht vorher, beim Öffnen der Schublade, damit Klick und Ziehen
 * gleich das richtige `src` haben; bis dahin gilt der Normalfall `bilder/<datei>` aus den Assets.
 */

const BEKANNT = new Map<string, string>();
const schluessel = (adresse: string, f: Figur) => `${adresse}|${f.id}`;

/** `/api/dokumente/<mappe>/<dok>` aus der `<base>` des Blatts (`/ansicht/<mappe>/dokumente/<dok>/`). */
export const adresseVon = (doc: Document | null) => {
	if (!doc) {
		return null;
	}
	const pfad = new URL(doc.baseURI).pathname;
	const treffer = /^\/ansicht\/([^/]+)\/dokumente\/([^/]+)\//.exec(pfad);
	return treffer ? `/api/dokumente/${treffer[1]}/${treffer[2]}` : null;
};

/** Das `src`, soweit schon bekannt. */
export const bekannteSrc = (adresse: string | null, f: Figur) =>
	(adresse ? BEKANNT.get(schluessel(adresse, f)) : undefined) ?? figurSrc(f);

/** Übernimmt die Datei ins Dokument (falls nötig) und merkt sich das `src`. */
export const holeSrc = async (adresse: string, f: Figur) => {
	const da = BEKANNT.get(schluessel(adresse, f));
	if (da) {
		return da;
	}
	const { src } = await sende<{ src: string }>(`${adresse}/bilder/uebernehmen`, { schluessel: figurSchluessel(f) });
	BEKANNT.set(schluessel(adresse, f), src);
	return src;
};

/** Holt die `src` aller Figuren einmal je Dokument; die Rückgabe liest sie. */
export const useFigurSrc = (adresse: string | null) => {
	const [, setStand] = useState(0);
	useEffect(() => {
		if (!adresse) {
			return;
		}
		let aktiv = true;
		for (const f of FIGUREN) {
			if (!BEKANNT.has(schluessel(adresse, f))) {
				holeSrc(adresse, f).then(
					() => {
						if (aktiv) {
							setStand((n) => n + 1);
						}
					},
					() => undefined,
				);
			}
		}
		return () => {
			aktiv = false;
		};
	}, [adresse]);
	return (f: Figur) => bekannteSrc(adresse, f);
};

/**
 * Lädt die Figuren im `iframe` vor: Dann kennt das Ablegen ihre Höhe schon beim ersten Klick (gemessen wird die
 * Vorschau, solange `--h` fehlt).
 */
export const ladeVor = (doc: Document | null, srcs: readonly string[]) => {
	const Bild = doc?.defaultView?.Image;
	if (!doc || !Bild) {
		return;
	}
	for (const src of srcs) {
		const bild = new Bild();
		bild.src = new URL(src, doc.baseURI).href;
	}
};
