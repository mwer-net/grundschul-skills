import { useState } from 'react';

import { meldung } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import type { MenueEintrag } from '../bausteine/Menue';
import type { SymbolName } from '../bausteine/Symbol';
import type { PdfAntwort } from '../typen';
import { PdfWarnung } from './PdfWarnung';

export interface PdfWahl {
	titel: string;
	/** Wofür die Datei gut ist; steht im Menü unter dem Titel. */
	hinweis?: string;
	vorbereiten: () => Promise<PdfAntwort>;
}

interface Optionen {
	mappe: { id: string; titel: string };
	/** Teilen-Links laden ohne Warnung herunter: Reparieren kann dort ohnehin niemand. */
	warnen: boolean;
	ganzeMappe?: boolean;
}

/**
 * Lädt ein PDF herunter. Der Server baut es bei Bedarf erst (das dauert einige Sekunden). Hat die Prüfung Fehler
 * gefunden, fragt `dialog` vorher nach; das steht dort, wo der Hook benutzt wird.
 */
export const usePdf = ({ ganzeMappe, mappe, warnen }: Optionen) => {
	const [laeuft, setLaeuft] = useState(false);
	const [warnung, setWarnung] = useState<PdfAntwort | null>(null);
	const zeige = useHinweis();

	const herunterladen = ({ adresse }: PdfAntwort) => {
		window.location.assign(adresse);
	};

	const hole = async ({ vorbereiten }: PdfWahl) => {
		setLaeuft(true);
		try {
			const antwort = await vorbereiten();
			if (warnen && antwort.meldungen.length > 0) {
				setWarnung(antwort);
			} else {
				herunterladen(antwort);
			}
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		} finally {
			setLaeuft(false);
		}
	};

	const dialog = warnung && (
		<PdfWarnung
			mappe={mappe}
			ganzeMappe={ganzeMappe}
			meldungen={warnung.meldungen}
			weiterTitel="Trotzdem herunterladen"
			weiter={() => herunterladen(warnung)}
			schliessen={() => setWarnung(null)}
		/>
	);

	return { laeuft, hole, dialog };
};

/** Die Wahl als Menüeintrag: bei mehreren ein Untermenü. Wer das Menü schließt, sieht den Knopf nicht drehen: `start` meldet es. */
export const pdfEintrag = (
	titel: string,
	symbol: SymbolName,
	wahl: PdfWahl[],
	hole: (w: PdfWahl) => unknown,
	start?: () => void,
): MenueEintrag => {
	const los = (w: PdfWahl) => {
		start?.();
		hole(w);
	};
	const [erste] = wahl;
	return wahl.length === 1 && erste
		? { titel, symbol, waehle: () => los(erste) }
		: {
				titel,
				symbol,
				untermenue: wahl.map((w) => ({ titel: w.titel, beschreibung: w.hinweis, waehle: () => los(w) })),
			};
};
