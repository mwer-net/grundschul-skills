import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { lade, meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { useEreignisse } from '../ereignisse';
import type { AblageWerte, AktionsWahl, Benennen, Merkzettel } from './kontext';
import { AblageKontext } from './kontext';
import { erwarteterStand } from './objekte';
import type { AblageStand, Aktion, AktionsAntwort } from './typen';
import { leseMerkzettel, schreibeMerkzettel } from './zwischenablage';

const NACH_EREIGNIS_MS = 120;
const STAPEL = 100;

interface Schritt {
	hin: Aktion[];
	her: Aktion[];
}

/** Daten der Ablage für alle Seiten nach der Anmeldung. Eine Quelle, sofort sichtbar, und ⌘Z über alles. */
export const AblageAnbieter = ({ children }: { children: ReactNode }) => {
	const [stand, setStand] = useState<AblageStand | null>(null);
	const [fehler, setFehler] = useState<string | null>(null);
	const [merkzettel, setMerkzettel] = useState<Merkzettel | null>(() => leseMerkzettel());
	const [benennen, setBenennen] = useState<Benennen | null>(null);
	const [stapel, setStapel] = useState<{ zurueck: Schritt[]; vor: Schritt[] }>({ zurueck: [], vor: [] });
	const zeige = useHinweis();
	const standRef = useRef(stand);
	standRef.current = stand;
	const stapelRef = useRef(stapel);
	stapelRef.current = stapel;
	/** Läuft eine Aktion, sind Antworten auf ältere Abfragen falsch: Sie überschrieben das sofort Gezeigte. */
	const laufend = useRef(0);
	const abfrage = useRef(0);
	const zeitgeber = useRef<number | null>(null);
	const gemeldeterHinweis = useRef<string | undefined>(undefined);

	const holen = useCallback(async () => {
		abfrage.current += 1;
		const diese = abfrage.current;
		try {
			const neu = await lade<AblageStand>('/api/ordner');
			if (diese !== abfrage.current || laufend.current > 0) {
				return;
			}
			if ((standRef.current?.rev ?? -1) <= neu.rev) {
				standRef.current = neu;
				setStand(neu);
			}
			setFehler(null);
			if (neu.hinweis && neu.hinweis !== gemeldeterHinweis.current) {
				gemeldeterHinweis.current = neu.hinweis;
				zeige({ text: neu.hinweis });
			}
		} catch (grund) {
			if (diese === abfrage.current) {
				setFehler(meldung(grund));
			}
		}
	}, [zeige]);

	const neuLaden = useCallback(() => {
		if (zeitgeber.current !== null) {
			window.clearTimeout(zeitgeber.current);
		}
		zeitgeber.current = window.setTimeout(() => {
			zeitgeber.current = null;
			void holen();
		}, NACH_EREIGNIS_MS);
	}, [holen]);

	useEffect(() => {
		void holen();
	}, [holen]);

	useEreignisse(({ rev, typ }) => {
		if (typ === 'pdf-fertig' || typ === 'ki-stand') {
			return;
		}
		// Die eigene Antwort kennt diesen Stand schon: Ohne Vergleich spränge er zurück.
		if (typ === 'ordner-geaendert' && rev !== undefined && rev <= (standRef.current?.rev ?? -1)) {
			return;
		}
		neuLaden();
	});

	const schicke = useCallback(
		async (aktion: Aktion) => {
			const vorher = standRef.current;
			if (vorher) {
				const erwartet = erwarteterStand(vorher, aktion);
				standRef.current = erwartet;
				setStand(erwartet);
			}
			laufend.current += 1;
			try {
				const antwort = await sende<AktionsAntwort>('/api/ordner/aktion', aktion);
				if (standRef.current) {
					standRef.current = { ...standRef.current, rev: antwort.rev };
				}
				return antwort;
			} catch (grund) {
				if (vorher && laufend.current === 1) {
					standRef.current = vorher;
					setStand(vorher);
				}
				throw grund;
			} finally {
				laufend.current -= 1;
				if (laufend.current === 0) {
					void holen();
				}
			}
		},
		[holen],
	);

	const rueckgaengig = useCallback(async () => {
		const letzter = stapelRef.current.zurueck.at(-1);
		if (!letzter) {
			return;
		}
		setStapel((s) => ({ ...s, zurueck: s.zurueck.slice(0, -1) }));
		try {
			const her: Aktion[] = [];
			for (const schritt of letzter.her) {
				her.unshift(...(await schicke(schritt)).umkehr);
			}
			setStapel((s) => ({ ...s, vor: [...s.vor, { hin: letzter.her, her }] }));
			zeige({ text: 'Rückgängig gemacht.' });
		} catch (grund) {
			zeige({ text: `Das lässt sich nicht mehr zurücknehmen: ${meldung(grund)}`, art: 'fehler' });
		}
	}, [schicke, zeige]);

	const wiederholen = useCallback(async () => {
		const letzter = stapelRef.current.vor.at(-1);
		if (!letzter) {
			return;
		}
		setStapel((s) => ({ ...s, vor: s.vor.slice(0, -1) }));
		try {
			const her: Aktion[] = [];
			for (const schritt of letzter.her) {
				her.unshift(...(await schicke(schritt)).umkehr);
			}
			setStapel((s) => ({ ...s, zurueck: [...s.zurueck, { hin: letzter.her, her }] }));
			zeige({ text: 'Wiederholt.' });
		} catch (grund) {
			zeige({ text: `Das lässt sich nicht wiederholen: ${meldung(grund)}`, art: 'fehler' });
		}
	}, [schicke, zeige]);

	const tu = useCallback(
		async (aktion: Aktion, { ohneUmkehr, stillerFehler, text }: AktionsWahl = {}) => {
			try {
				const antwort = await schicke(aktion);
				if (!ohneUmkehr) {
					setStapel((s) => ({
						zurueck: [...s.zurueck.slice(-STAPEL), { hin: [aktion], her: antwort.umkehr }],
						vor: [],
					}));
				}
				if (text) {
					zeige({
						text: text(antwort),
						aktion: { titel: 'Rückgängig', ausfuehren: () => void rueckgaengig() },
					});
				}
				return antwort;
			} catch (grund) {
				if (stillerFehler) {
					throw grund;
				}
				zeige({ text: meldung(grund), art: 'fehler' });
				return null;
			}
		},
		[rueckgaengig, schicke, zeige],
	);

	const merke = useCallback((zettel: Merkzettel | null) => {
		schreibeMerkzettel(zettel);
		setMerkzettel(zettel);
	}, []);

	const werte = useMemo<AblageWerte>(
		() => ({
			stand,
			fehler,
			neuLaden,
			tu,
			rueckgaengig,
			wiederholen,
			kannRueckgaengig: stapel.zurueck.length > 0,
			kannWiederholen: stapel.vor.length > 0,
			merkzettel,
			merke,
			benennen,
			setBenennen,
		}),
		[benennen, fehler, merke, merkzettel, neuLaden, rueckgaengig, stand, stapel, tu, wiederholen],
	);

	return <AblageKontext value={werte}>{children}</AblageKontext>;
};
