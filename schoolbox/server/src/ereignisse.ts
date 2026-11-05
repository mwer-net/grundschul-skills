import type { Urheber } from '@schoolbox/kern';

export interface DokumentGeaendert {
	mappe: string;
	dok: string;
	version: string;
	urheber: Urheber | null;
}

type DokumentEreignis = { typ: 'dokument-geaendert'; daten: DokumentGeaendert };
type MappeEreignis = { typ: 'mappe-neu' | 'mappe-entfernt'; daten: { mappe: string } };
type PdfEreignis = { typ: 'pdf-fertig'; daten: { mappe: string; dok: string } };
type VorschauEreignis = { typ: 'vorschau-fertig'; daten: { mappe: string; dok: string } };

/** Ein Auftrag an Claude (057): kein Text aus dem Material, nur Schritte und Status. */
type KiEreignis = { typ: 'ki-stand'; daten: { mappe: string; dok: string; id: string } };

/** Der Ordnerbaum hat sich geändert (079). Der eigene Tab vergleicht `rev`, sonst spränge ein Stand zurück. */
type OrdnerEreignis = { typ: 'ordner-geaendert'; daten: { rev: number } };

export type Ereignis = DokumentEreignis | KiEreignis | MappeEreignis | OrdnerEreignis | PdfEreignis | VorschauEreignis;

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
