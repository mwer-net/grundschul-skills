import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { meldung } from '../api';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { useLaden } from '../lib/laden';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import { bereiteDokumentVor, inhaltAdresse, istGeteilt } from '../lib/zugang';
import { PdfWarnung } from '../pdf/PdfWarnung';
import type { MappenEintrag, PdfAntwort } from '../typen';

interface MitPdf {
	art: 'warnung' | 'abgebrochen';
	antwort: PdfAntwort;
}

type Stand = { art: 'laeuft' } | MitPdf | { art: 'fehler'; text: string };

/** Zeigt das PDF im Browser; Safari bringt dafür einen eigenen Betrachter mit Drucken bzw. Teilen-Menü mit. */
const oeffne = ({ adresse }: PdfAntwort) => window.location.replace(`${adresse}?anzeigen=1`);

/**
 * Eigener Tab zum Drucken: „Drucken“ öffnet ihn sofort (so blockiert Safari ihn nicht), hier wird das PDF bei Bedarf
 * gebaut und dann im selben Tab geöffnet.
 */
export const Drucken = ({ dok, zugang }: { zugang: Zugang; dok: string }) => {
	const [suche] = useSearchParams();
	const variante = suche.get('fassung') === 'loesung' ? 'loesung' : 'arbeitsblatt';
	const [stand, setStand] = useState<Stand>({ art: 'laeuft' });
	const { mappe, token } = zugang;
	const { daten } = useLaden<MappenEintrag>(inhaltAdresse(zugang));
	useTitel('Drucken');

	useEffect(() => {
		let aktiv = true;
		const geteilt = istGeteilt({ mappe, token });
		bereiteDokumentVor({ mappe, token }, dok, variante).then(
			(antwort) => {
				if (!aktiv) {
					return;
				}
				if (!geteilt && antwort.meldungen.length > 0) {
					setStand({ art: 'warnung', antwort });
				} else {
					oeffne(antwort);
				}
			},
			(grund: unknown) => {
				if (aktiv) {
					setStand({ art: 'fehler', text: meldung(grund) });
				}
			},
		);
		return () => {
			aktiv = false;
		};
	}, [dok, mappe, token, variante]);

	return (
		<main className="flex min-h-dvh items-center justify-center">
			{stand.art === 'laeuft' && (
				<Zustand symbol="drucker" titel="PDF wird erstellt …">
					<Symbol name="laden" className="size-10 animate-spin text-brand-500" />
					<p className="text-leise">
						Gleich öffnet sich das PDF hier. Drucken kannst du dann über das Drucker-Symbol oder ⌘P, auf dem
						iPad über „Teilen“ und „Drucken“.
					</p>
				</Zustand>
			)}
			{stand.art === 'fehler' && (
				<Zustand symbol="achtung" titel="Das hat gerade nicht geklappt">
					<p className="text-leise">{stand.text}</p>
					<Knopf onClick={() => window.location.reload()}>Noch einmal versuchen</Knopf>
				</Zustand>
			)}
			{stand.art === 'abgebrochen' && (
				<Zustand symbol="drucker" titel="Nicht gedruckt">
					<p className="text-leise">Du kannst diesen Tab schließen.</p>
					<Knopf onClick={() => oeffne(stand.antwort)}>Doch drucken</Knopf>
				</Zustand>
			)}
			{stand.art === 'warnung' && (
				<PdfWarnung
					mappe={{ id: mappe, titel: daten?.mappe.titel ?? mappe }}
					meldungen={stand.antwort.meldungen}
					weiterTitel="Trotzdem drucken"
					weiter={() => oeffne(stand.antwort)}
					schliessen={() => setStand({ art: 'abgebrochen', antwort: stand.antwort })}
				/>
			)}
		</main>
	);
};
