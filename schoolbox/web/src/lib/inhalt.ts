import { useMemo } from 'react';

import type { DokumentEintrag, Mappe, MappenEintrag } from '../typen';
import { useLaden } from './laden';
import type { Zugang } from './zugang';
import { inhaltAdresse } from './zugang';

type GeteiltesDok = DokumentEintrag & {
	mappe?: string;
	fach?: Mappe['fach'];
	klasse?: Mappe['klasse'];
	ordner?: string | null;
};

interface Roh extends Omit<MappenEintrag, 'mappe' | 'dokumente'> {
	mappe?: Mappe;
	titel?: string;
	dokumente: GeteiltesDok[];
	/** Nur Ordner-Links: die Wurzel und die Ordner darunter. */
	wurzel?: string | null;
	ordner?: { id: string; name: string }[];
}

/** Wohin „Zurück“ aus einem Material eines geteilten Ordners führt: in seinen Ordner, nicht in die Wurzel (191-15). */
export interface GeteilterOrt {
	adresse: string;
	name: string;
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
	const ortVon = (dok: string): GeteilterOrt | null => {
		if (!daten || zugang.token === null) {
			return null;
		}
		const ordner = daten.dokumente.find((d) => d.id === dok && (d.mappe ?? zugang.mappe) === zugang.mappe)?.ordner;
		const gefunden = ordner && ordner !== daten.wurzel ? daten.ordner?.find((o) => o.id === ordner) : undefined;
		return gefunden
			? { adresse: `/f/${zugang.token}/o/${gefunden.id}`, name: gefunden.name }
			: { adresse: `/f/${zugang.token}`, name: daten.titel ?? '' };
	};
	return { daten: eintrag, fehler, neuLaden, ortVon };
};
