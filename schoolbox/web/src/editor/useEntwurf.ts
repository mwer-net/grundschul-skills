import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { entwurfPhase, quelleDes, sperrGrund, sperrtBlatt } from './entwurf';
import { useKiAuftrag } from './ki';

/**
 * Das neue Blatt aus dem Assistenten (133, Entwurf A1 S. 10–11): Der Stand kommt vom Server, nicht aus der Adresse.
 * So stimmt er auch nach dem Neuladen, nach dem Wiederkommen und in einem zweiten Tab.
 */
export const useEntwurf = ({
	annimm,
	dok,
	gespraechId,
	mappe,
	nachLauf,
}: {
	mappe: string;
	dok: string;
	nachLauf: () => void;
	/** Nimmt an, sodass Rückgängig es wieder zurücknimmt. */
	annimm: (arbeit: () => Promise<unknown>) => Promise<void>;
	/** Das Gespräch des Entwurfs: Nachbessern geht darin weiter (087). */
	gespraechId: () => string;
}) => {
	const location = useLocation();
	const navigate = useNavigate();
	// Was der Assistent beim Sprung mitgibt, gilt einmal. Die History behält es über das Neuladen hinaus, dann käme
	// ein längst geschlossener Lauf wieder; danach weiß es der Server (`GET …/ki`, `entwurf`).
	const [ankunft] = useState(() => (location.state ?? {}) as { kiAuftrag?: string; kiFehler?: string });
	const mitgebracht = useRef(Boolean(ankunft.kiAuftrag || ankunft.kiFehler));
	useEffect(() => {
		if (mitgebracht.current) {
			mitgebracht.current = false;
			void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
		}
	}, [location.pathname, location.search, navigate]);
	const ki = useKiAuftrag(mappe, dok, nachLauf, { entwurf: true, gestartet: ankunft.kiAuftrag });
	const [startFehler, setStartFehler] = useState(ankunft.kiFehler ?? null);
	const [zu, setZu] = useState<string | null>(null);
	const [verworfen, setVerworfen] = useState(false);
	const { auftrag, setFehler, vergiss } = ki;
	const phase = entwurfPhase({ ...ki, startFehler, zu, verworfen });

	// Ein Abbruch ist gesehen, sobald er hier steht: Nach dem Neuladen muss er nicht wieder kommen.
	const abgebrochen = auftrag?.status === 'abgebrochen' ? auftrag.id : null;
	useEffect(() => {
		if (abgebrochen) {
			void vergiss().catch(() => undefined);
		}
	}, [abgebrochen, vergiss]);

	const schliesse = () => {
		setStartFehler(null);
		setFehler(null);
		setZu(auftrag?.id ?? null);
		setVerworfen(false);
		void vergiss().catch(() => undefined);
	};

	return {
		mappe,
		dok,
		phase,
		sperrt: sperrtBlatt(phase),
		grund: sperrGrund(phase),
		/** Was das Blatt zeigt: den offenen Entwurf, sonst `quelle`. */
		zeigt: (quelle: string | null) => quelleDes(phase) ?? quelle,
		abbrechen: () => void ki.abbrechen(),
		nochmal: () => {
			setStartFehler(null);
			setZu(null);
			void ki.nochmal();
		},
		uebernehmen: () => void annimm(ki.annehmen),
		verwerfen: async () => {
			await ki.verwerfen();
			setVerworfen(true);
		},
		nachbessern: (text: string) =>
			ki.starte({ auftrag: text, aufVorschlag: true, gespraechId: gespraechId() }).then(() => undefined),
		schliesse,
	};
};

export type Entwurf = ReturnType<typeof useEntwurf>;
