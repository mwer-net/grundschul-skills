import { useState } from 'react';

import { useEreignisse } from '../ereignisse';
import { useLaden } from '../lib/laden';
import type { Zugang } from '../lib/zugang';
import { inhaltAdresse } from '../lib/zugang';
import type { MappenEintrag } from '../typen';

/**
 * Mappe und Dokument für die Entwurfsseiten, live: Registriert Claude eine neue Runde oder wählt einen Entwurf, lädt
 * die Seite neu; `stand` zählt dann hoch, damit eine `Blattansicht` den Entwurf neu darstellt.
 */
export const useEntwuerfe = (zugang: Zugang, dok: string) => {
	const { daten, fehler, neuLaden } = useLaden<MappenEintrag>(inhaltAdresse(zugang));
	const [stand, setStand] = useState(0);
	useEreignisse(({ dok: geaendert, mappe, typ, wieder }) => {
		const diesesDokument = typ === 'dokument-geaendert' && mappe === zugang.mappe && geaendert === dok;
		if (diesesDokument || (typ === 'verbunden' && wieder) || (typ === 'mappe-entfernt' && mappe === zugang.mappe)) {
			setStand((n) => n + 1);
			neuLaden();
		}
	});
	const dokument = daten?.dokumente.find((d) => d.id === dok);
	return { daten, fehler, dokument, stand };
};
