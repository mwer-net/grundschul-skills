import { useState } from 'react';

import { meldung } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import type { KnopfArt } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import type { PdfAntwort } from '../typen';
import { PdfWarnung } from './PdfWarnung';

export interface PdfWahl {
	titel: string;
	vorbereiten: () => Promise<PdfAntwort>;
}

interface Eigenschaften {
	beschriftung: string;
	/** Eine Wahl: ein einfacher Knopf. Mehrere: ein Menü. */
	wahl: PdfWahl[];
	mappe: { id: string; titel: string };
	/** Teilen-Links laden ohne Warnung herunter: Reparieren kann dort ohnehin niemand. */
	warnen: boolean;
	ganzeMappe?: boolean;
	art?: KnopfArt;
	rechtsbuendig?: boolean;
}

export const PdfLaeuft = () => (
	<>
		<Symbol name="laden" className="size-6 flex-none animate-spin" />
		PDF wird erstellt …
	</>
);

/**
 * Lädt ein PDF herunter. Der Server baut es bei Bedarf erst (das dauert einige Sekunden); bis dahin dreht sich der
 * Knopf. Hat die Prüfung Fehler gefunden, fragt ein Dialog vorher nach.
 */
export const PdfKnopf = ({
	art = 'zweit',
	beschriftung,
	ganzeMappe,
	mappe,
	rechtsbuendig,
	wahl,
	warnen,
}: Eigenschaften) => {
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

	const [erste] = wahl;
	const inhalt = laeuft ? (
		<PdfLaeuft />
	) : (
		<>
			<Symbol name="herunterladen" />
			{beschriftung}
		</>
	);
	return (
		<>
			{wahl.length > 1 ? (
				<Menue
					art={art}
					beschriftung={inhalt}
					disabled={laeuft}
					rechtsbuendig={rechtsbuendig}
					eintraege={wahl.map((w) => ({ titel: w.titel, waehle: () => void hole(w) }))}
				/>
			) : (
				<Knopf art={art} disabled={laeuft || !erste} onClick={() => erste && void hole(erste)}>
					{inhalt}
				</Knopf>
			)}
			{warnung && (
				<PdfWarnung
					mappe={mappe}
					ganzeMappe={ganzeMappe}
					meldungen={warnung.meldungen}
					weiterTitel="Trotzdem herunterladen"
					weiter={() => herunterladen(warnung)}
					schliessen={() => setWarnung(null)}
				/>
			)}
		</>
	);
};
