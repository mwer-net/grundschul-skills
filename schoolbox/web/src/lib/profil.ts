import type { Druckprofil, Format } from '@schoolbox/kern/src/werte';
import { useCallback, useEffect, useState } from 'react';

import { sende } from '../api';
import type { Zugang } from './zugang';
import { istGeteilt } from './zugang';

interface AnsichtsAngaben {
	druckprofil: Druckprofil;
	format: Format;
}

const speicherName = ({ mappe }: Zugang, dok: string) => `schoolbox.ansicht.${mappe}.${dok}`;

const ausSpeicher = (zugang: Zugang, dok: string): Druckprofil | null => {
	try {
		const wert = localStorage.getItem(speicherName(zugang, dok));
		return wert === 'sw' || wert === 'farbe' ? wert : null;
	} catch {
		return null;
	}
};

/**
 * Die Ansicht Farbe oder s/w eines Dokuments (042). Die Lehrkraft merkt sie sich in `meta.druckprofil`, Teilen-Links
 * ändern dort nichts und merken sie sich nur im eigenen Browser. Der Wechsel gilt sofort; schlägt das Merken fehl, bleibt
 * es für diesen Besuch dabei.
 */
export const useAnsichtsProfil = (zugang: Zugang, dok: string, meta: AnsichtsAngaben | undefined) => {
	const geteilt = istGeteilt(zugang);
	const [gewaehlt, setGewaehlt] = useState<Druckprofil | null>(() => (geteilt ? ausSpeicher(zugang, dok) : null));
	const { mappe } = zugang;

	useEffect(() => setGewaehlt(geteilt ? ausSpeicher(zugang, dok) : null), [dok, geteilt, mappe]); // eslint-disable-line react-hooks/exhaustive-deps

	const waehle = useCallback(
		(profil: Druckprofil) => {
			setGewaehlt(profil);
			if (geteilt) {
				try {
					localStorage.setItem(speicherName({ mappe, token: null }, dok), profil);
				} catch {
					// Privater Modus: Die Wahl gilt dann nur bis zum Neuladen.
				}
				return;
			}
			void sende(`/api/dokumente/${mappe}/${dok}/ansicht`, { profil }, 'PUT').catch(() => undefined);
		},
		[dok, geteilt, mappe],
	);

	// Am Beamer braucht niemand s/w: Folien bleiben, wie die Quelle sie vorgibt.
	const profil = meta?.format === 'folie' ? undefined : (gewaehlt ?? meta?.druckprofil ?? 'farbe');
	return { profil, waehle };
};
