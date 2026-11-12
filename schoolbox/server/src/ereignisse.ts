import type { CanvaArt, CanvaEreignisStatus, Urheber } from '@schoolbox/kern';

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

/** Eine Unterrichtseinheit (139): Die Oberfläche holt den Stand selbst. */
type EinheitEreignis = { typ: 'einheit-stand'; daten: { id: string; ordner: string } };

/** Ein Canva-Lauf (176): Die Oberfläche holt den Stand selbst; `datei` nur bei `fertig`. */
type CanvaEreignis = {
	typ: 'canva-stand';
	daten: { id: string; art: CanvaArt; status: CanvaEreignisStatus; datei?: string };
};

/** Was im Hintergrund läuft und fertig wird. */
type ArbeitsEreignis = CanvaEreignis | KiEreignis | PdfEreignis | VorschauEreignis;

export type Ereignis = ArbeitsEreignis | DokumentEreignis | EinheitEreignis | MappeEreignis | OrdnerEreignis;

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
