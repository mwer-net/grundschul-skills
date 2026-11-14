import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import type { Zugang } from '../lib/zugang';
import { dokumentSeite } from '../lib/zugang';

/**
 * „Diesen Entwurf nehmen“ (191 Urteil 7): Der Server übernimmt den Entwurf als Material wie `schoolbox waehle`,
 * danach steht das Blatt in der Ansicht. Ausarbeiten kann Claude es weiter, wenn man es ihm schreibt.
 */
export const useEntwurfNehmen = (zugang: Zugang, dok: string) => {
	const navigate = useNavigate();
	const zeige = useHinweis();
	const [laeuft, setLaeuft] = useState(false);
	const nimm = async (name: string) => {
		setLaeuft(true);
		try {
			await sende(`/api/dokumente/${zugang.mappe}/${dok}/entwurf`, { name });
			zeige({ text: `Entwurf ${name} ist gewählt.` });
			void navigate(dokumentSeite(zugang, dok), { replace: true });
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		} finally {
			setLaeuft(false);
		}
	};
	return { nimm: (name: string) => void nimm(name), laeuft };
};
