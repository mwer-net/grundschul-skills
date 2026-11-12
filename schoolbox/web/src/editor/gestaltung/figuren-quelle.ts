import { vorschaubildAdresse } from '@schoolbox/kern/src/bildbefehle';
import type { BibliotheksFigur, Pose } from '@schoolbox/kern/src/figuren';
import { EINGEBAUTE } from '@schoolbox/kern/src/figuren';
import { useSyncExternalStore } from 'react';

import { lade, sende } from '../../api';

/**
 * Die Figuren (177): Willi, Wilma und die Figurenbibliothek (`GET /api/figuren`), einmal je Sitzung geladen. Ins
 * Dokument kommt eine Pose erst beim Ablegen, wie jedes Bild aus der Sammlung über `uebernimmBild`
 * (`POST <adresse>/bilder/uebernehmen`), mit ihrer Strichfassung.
 */

let figuren: readonly BibliotheksFigur[] = EINGEBAUTE;
let laden: Promise<void> | null = null;
const HOERER = new Set<() => void>();

/** Lädt die Liste einmal je Sitzung; scheitert das, versucht es der nächste Aufruf neu. */
export const ladeFiguren = () => {
	laden ??= lade<{ figuren: BibliotheksFigur[] }>('/api/figuren').then(
		(antwort) => {
			figuren = antwort.figuren;
			for (const hoerer of HOERER) {
				hoerer();
			}
		},
		() => {
			laden = null;
		},
	);
	return laden;
};

// >> 176
/** Lädt die Bibliothek neu, etwa nach einer neuen Pose aus Canva oder nach „Entfernen“ (176). */
export const ladeFigurenNeu = () => {
	laden = null;
	return ladeFiguren();
};
// << 176

/** Bis `/api/figuren` geantwortet hat, nur Willi und Wilma (⌘K fragt synchron). */
export const figurenJetzt = () => figuren;

const abonniere = (hoerer: () => void) => {
	HOERER.add(hoerer);
	void ladeFiguren();
	return () => {
		HOERER.delete(hoerer);
	};
};

/** Die Figuren in fester Reihenfolge: Willi, Wilma, dann nach Namen; je Figur die Grundpose zuerst. */
export const useFiguren = () => useSyncExternalStore(abonniere, figurenJetzt);

/** Was Kachel, Inspektor und das Gut beim Ziehen zeigen: das Vorschaubild der Pose (178). */
export const vorschauVon = (pose: Pick<Pose, 'schluessel'>) => vorschaubildAdresse(`/ansicht/${pose.schluessel}`);

/** `/api/dokumente/<mappe>/<dok>` aus der `<base>` des Blatts (`/ansicht/<mappe>/dokumente/<dok>/`). */
export const adresseVon = (doc: Document | null) => {
	if (!doc) {
		return null;
	}
	const pfad = new URL(doc.baseURI).pathname;
	const treffer = /^\/ansicht\/([^/]+)\/dokumente\/([^/]+)\//.exec(pfad);
	return treffer ? `/api/dokumente/${treffer[1]}/${treffer[2]}` : null;
};

const BEKANNT = new Map<string, string>();

/** Übernimmt die Pose ins Dokument (falls nötig) und merkt sich ihr `src` je Dokument. */
export const holeSrc = async (adresse: string, pose: Pick<Pose, 'schluessel'>) => {
	const merkmal = `${adresse}|${pose.schluessel}`;
	const da = BEKANNT.get(merkmal);
	if (da) {
		return da;
	}
	const { src } = await sende<{ src: string }>(`${adresse}/bilder/uebernehmen`, { schluessel: pose.schluessel });
	BEKANNT.set(merkmal, src);
	return src;
};

/**
 * Lädt Bilder im `iframe` vor: Dann kennt das Ablegen ihre Höhe schon beim ersten Klick (gemessen wird die Vorschau,
 * solange `--h` fehlt).
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
