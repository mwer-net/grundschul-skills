import { quelleVon, zerlege } from '@schoolbox/kern/src/quelltext';
import { useEffect, useState } from 'react';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import type { PfadTeil } from './darstellung';
import type { Struktur } from './struktur';
import type { Abgelegt } from './zwischenablage';
import { leseAblage, schreibeAblage } from './zwischenablage';

interface Optionen {
	dokument: { mappe: string; dok: string };
	pfad: PfadTeil[];
	quelle: string | null;
	fuegeAblageEin: (nr?: number | null) => Promise<void>;
	sammlungGeaendert: () => void;
	struktur: Pick<Struktur, 'loesche'>;
}

/** Kopieren, Ausschneiden, Einfügen und „In Sammlung legen“ (051): von Panel, Tastatur und Menü aus dieselben. */
export const useAblage = ({ dokument, fuegeAblageEin, pfad, quelle, sammlungGeaendert, struktur }: Optionen) => {
	const [abgelegt, setAbgelegt] = useState<Abgelegt | null>(leseAblage);
	const [sammlungName, setSammlungName] = useState<string | null>(null);
	const zeige = useHinweis();
	const gewaehlt = pfad.at(-1);
	const nr = gewaehlt?.nr ?? null;

	useEffect(() => {
		const anders = () => setAbgelegt(leseAblage());
		window.addEventListener('storage', anders);
		return () => window.removeEventListener('storage', anders);
	}, []);

	useEffect(() => setSammlungName(null), [nr]);

	const nimm = () => {
		if (!gewaehlt || quelle === null) {
			return null;
		}
		const z = zerlege(quelle);
		const k = z.knoten[gewaehlt.nr];
		return {
			html: k ? quelleVon(z, k) : '',
			ort: gewaehlt.baustein.art === 'aufgabe' ? ('seite' as const) : ('aufgabe' as const),
		};
	};

	const lege = () => {
		const teil = nimm();
		if (!teil || !gewaehlt) {
			return false;
		}
		const eintrag = { ...teil, name: gewaehlt.name, ...dokument };
		schreibeAblage(eintrag);
		setAbgelegt(eintrag);
		return true;
	};

	const kopiere = () => {
		if (lege()) {
			zeige({ text: `„${gewaehlt?.name}“ kopiert. Du kannst es in jedem Dokument einfügen.` });
		}
	};

	const schneideAus = () => {
		if (gewaehlt && lege()) {
			struktur.loesche(gewaehlt.nr, gewaehlt.name, 'Ausgeschnitten');
		}
	};

	const fuegeEin = (ziel: number | null) => {
		fuegeAblageEin(ziel).catch((grund: unknown) => zeige({ text: meldung(grund), art: 'fehler' }));
	};

	const sammle = async () => {
		const teil = nimm();
		if (!teil) {
			return;
		}
		try {
			await sende('/api/eigene/sammlung', { ...dokument, html: teil.html, name: sammlungName, ort: teil.ort });
			setSammlungName(null);
			sammlungGeaendert();
			zeige({ text: 'In „Meine Bausteine“ gelegt.' });
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		}
	};

	return { abgelegt, kopiere, schneideAus, fuegeEin, sammlungName, setSammlungName, sammle };
};

export type Ablage = ReturnType<typeof useAblage>;
