import type { Urheber } from '@schoolbox/kern';

export interface DokumentGeaendert {
	mappe: string;
	dok: string;
	version: string;
	urheber: Urheber | null;
}

type DokumentEreignis = { typ: 'dokument-geaendert'; daten: DokumentGeaendert };
type MappeEreignis = { typ: 'mappe-neu'; daten: { mappe: string } };
type PdfEreignis = { typ: 'pdf-fertig'; daten: { mappe: string; dok: string } };

export type Ereignis = DokumentEreignis | MappeEreignis | PdfEreignis;

export type Hoerer = (ereignis: Ereignis) => void;

export interface Ereignisse {
	sende: (ereignis: Ereignis) => void;
	abonniere: (hoerer: Hoerer) => () => void;
}

export const erstelleEreignisse = (): Ereignisse => {
	const hoererListe = new Set<Hoerer>();
	return {
		sende: (ereignis) => {
			for (const hoerer of hoererListe) {
				hoerer(ereignis);
			}
		},
		abonniere: (hoerer) => {
			hoererListe.add(hoerer);
			return () => {
				hoererListe.delete(hoerer);
			};
		},
	};
};
