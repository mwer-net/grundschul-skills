import { ergaenzeBoegen } from '@schoolbox/kern/src/bogen';
import { ergaenzeFormen } from '@schoolbox/kern/src/formen-aendern';
import { fasseMitAnlegenZusammen } from '@schoolbox/kern/src/schmuck';
import type { Verlauf } from '@schoolbox/kern/src/quelltext';
import { macheRueckgaengig, neuerVerlauf, nimmAuf, wiederhole } from '@schoolbox/kern/src/quelltext';
import { ergaenzeStreuungen } from '@schoolbox/kern/src/streuen';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiFehler } from '../api';
import { lade, meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import type { Basis } from './speichern';
import { useSpeichern } from './speichern';

export type Urheber = 'claude' | 'lehrkraft' | null;

export interface Konflikt {
	urheber: Urheber;
}

const GEAENDERT: Record<'claude' | 'lehrkraft', string> = {
	claude: 'Claude hat das Material geändert.',
	lehrkraft: 'Das Material wurde gerade an einem anderen Gerät geändert.',
};

/**
 * 104: Formen ohne Pfad (von Claude) bekommen ihn beim Laden. Die ergänzte Quelle gilt als gespeicherter Stand: Sie
 * wird nur angezeigt und mit dem nächsten Schritt geschrieben, nicht schon beim Öffnen. 109: Streuungen ohne Teile
 * ebenso, 110: Titel im Bogen ebenso.
 */
const mitFormen = (b: Basis): Basis => ({ ...b, quelle: ergaenzeBoegen(ergaenzeStreuungen(ergaenzeFormen(b.quelle))) });

/**
 * Was der Editor über das Dokument weiß: die Quelle mit Rückgängig/Wiederholen, das Speichern und wie er auf
 * Änderungen von außen reagiert. Ohne offene Änderungen lädt er neu. Mit offenen Änderungen ruht das Speichern, der
 * eigene Stand wird als Version gesichert, und die Lehrkraft entscheidet, wann sie neu lädt. So verliert keine der
 * beiden Fassungen.
 */
export const useBearbeitung = (mappe: string, dok: string, auswahl: RefObject<number | null>) => {
	const adresse = `/api/dokumente/${mappe}/${dok}`;
	const zeige = useHinweis();
	const [verlauf, setVerlauf] = useState<Verlauf | null>(null);
	/** Die Quelle beim Öffnen bzw. letzten Neuladen; daran misst die Prüfung, was sich durch Umsortieren verschob. */
	const [ausgang, setAusgang] = useState<string | null>(null);
	const [ladeFehler, setLadeFehler] = useState<ApiFehler | null>(null);
	const [konflikt, setKonflikt] = useState<Konflikt | null>(null);
	const [laeuft, setLaeuft] = useState(false);
	const quelle = useRef<string | null>(null);
	/** Solange ein Vorschlag angenommen wird, ist die Änderung vom Server ein Schritt in Rückgängig. */
	const alsSchritt = useRef<string | null>(null);

	useEffect(() => {
		quelle.current = verlauf?.quelle ?? null;
	}, [verlauf]);

	const sichere = useCallback(async () => {
		const offen = quelle.current;
		if (offen !== null) {
			await sende(`${adresse}/versionen`, { quelle: offen }).catch(() => undefined);
		}
	}, [adresse]);

	const speicher = useSpeichern({
		adresse,
		quelle: verlauf?.quelle ?? null,
		beiKonflikt: () => {
			setKonflikt({ urheber: null });
			void sichere();
		},
	});
	const { alles, basis, meldeKonflikt, offen, ruhig, setzeBasis } = speicher;

	const uebernimm = useCallback(
		(geladen: Basis) => {
			const neu = mitFormen(geladen);
			setzeBasis(neu);
			quelle.current = neu.quelle;
			setVerlauf(neuerVerlauf(neu.quelle));
			setAusgang(neu.quelle);
			setKonflikt(null);
		},
		[setzeBasis],
	);

	useEffect(() => {
		lade<Basis>(adresse).then(uebernimm, (fehler: ApiFehler) => setLadeFehler(fehler));
	}, [adresse, uebernimm]);

	/** Etwas hat sich geändert (Ereignis vom Server oder wieder verbunden): selbst nachsehen, was gilt. */
	const pruefe = useCallback(
		async (urheber: Urheber) => {
			await ruhig();
			const aktuell = await lade<Basis>(adresse).then(mitFormen).catch(() => null);
			if (!aktuell || aktuell.version === basis.current?.version) {
				return;
			}
			if (!offen()) {
				const schritt = alsSchritt.current;
				if (schritt) {
					setzeBasis(aktuell);
					quelle.current = aktuell.quelle;
					const gewaehlt = auswahl.current;
					setVerlauf((v) =>
						v ? nimmAuf(v, aktuell.quelle, schritt, gewaehlt) : neuerVerlauf(aktuell.quelle),
					);
					setAusgang(aktuell.quelle);
				} else {
					uebernimm(aktuell);
				}
				zeige({ text: GEAENDERT[urheber ?? 'claude'] });
				return;
			}
			meldeKonflikt();
			setKonflikt({ urheber });
			await sichere();
		},
		[adresse, auswahl, basis, meldeKonflikt, offen, ruhig, setzeBasis, sichere, uebernimm, zeige],
	);

	const annimm = useCallback(
		async (arbeit: () => Promise<unknown>) => {
			alsSchritt.current = 'Vorschlag von Claude';
			try {
				await arbeit();
				await pruefe('claude');
			} finally {
				alsSchritt.current = null;
			}
		},
		[pruefe],
	);

	const befehl = useCallback(
		(neu: string, beschreibung: string, mitAnlegen = false) => {
			if (!konflikt) {
				const gewaehlt = auswahl.current;
				// 105: Die erste Textsitzung neuer Schmuckschrift wird mit dem Anlegen ein Schritt.
				setVerlauf((v) => v && (mitAnlegen ? fasseMitAnlegenZusammen(v, neu, gewaehlt) : nimmAuf(v, neu, beschreibung, gewaehlt)));
			}
		},
		[auswahl, konflikt],
	);

	const rueckgaengig = useCallback(() => {
		const gewaehlt = auswahl.current;
		setVerlauf((v) => v && macheRueckgaengig(v, gewaehlt));
	}, [auswahl]);
	const wiederholen = useCallback(() => {
		const gewaehlt = auswahl.current;
		setVerlauf((v) => v && wiederhole(v, gewaehlt));
	}, [auswahl]);
	const quelleJetzt = useCallback(() => quelle.current, []);

	const arbeite = async (arbeit: () => Promise<void>) => {
		setLaeuft(true);
		try {
			await arbeit();
		} catch (fehler) {
			zeige({ text: meldung(fehler), art: 'fehler' });
		} finally {
			setLaeuft(false);
		}
	};

	const neuLaden = () =>
		arbeite(async () => {
			await sichere();
			uebernimm(await lade<Basis>(adresse));
			zeige({ text: 'Neu geladen. Deine Fassung von eben steht unter „Versionen“.' });
		});

	const wiederherstellen = (id: string) =>
		arbeite(async () => {
			if (!(await alles())) {
				await sichere();
			}
			await sende(`${adresse}/versionen/${id}/wiederherstellen`);
			uebernimm(await lade<Basis>(adresse));
			zeige({ text: 'Die Version ist wiederhergestellt.' });
		});

	return {
		adresse,
		verlauf,
		quelleJetzt,
		ausgang,
		ladeFehler,
		konflikt,
		laeuft,
		speicher,
		befehl,
		rueckgaengig,
		wiederholen,
		pruefe,
		annimm,
		neuLaden,
		wiederherstellen,
	};
};
