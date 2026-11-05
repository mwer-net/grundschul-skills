import { useMemo } from 'react';

import type { DokumentEintrag, Mappe, MappenEintrag } from '../typen';
import { useLaden } from './laden';
import type { Zugang } from './zugang';
import { inhaltAdresse } from './zugang';

type GeteiltesDok = DokumentEintrag & { mappe?: string; fach?: Mappe['fach']; klasse?: Mappe['klasse'] };

interface Roh extends Omit<MappenEintrag, 'mappe' | 'dokumente'> {
	mappe?: Mappe;
	titel?: string;
	dokumente: GeteiltesDok[];
}

/**
 * Inhalt für eine Dokumentseite. Ein Ordner-Link hat keine Mappe und spannt mehrere Behälter: Dann zählen nur die
 * Dokumente dieses Behälters, und Fach und Klasse stehen am Dokument.
 */
export const useInhalt = (zugang: Zugang) => {
	const { daten, fehler, neuLaden } = useLaden<Roh>(inhaltAdresse(zugang));
	const eintrag = useMemo<MappenEintrag | null>(() => {
		if (!daten) {
			return null;
		}
		const dokumente = daten.dokumente.filter((d) => d.mappe === undefined || d.mappe === zugang.mappe);
		if (daten.mappe) {
			return { ...daten, mappe: daten.mappe, dokumente };
		}
		const [erstes] = dokumente;
		return {
			...daten,
			dokumente,
			mappe: {
				id: zugang.mappe,
				titel: daten.titel ?? '',
				fach: erstes?.fach ?? 'deutsch',
				klasse: erstes?.klasse ?? 1,
			} as Mappe,
		};
	}, [daten, zugang.mappe]);
	return { daten: eintrag, fehler, neuLaden };
};
