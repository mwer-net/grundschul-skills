import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatNachricht } from './chat-verlauf';
import { MAX_NACHRICHTEN } from './chat-verlauf';
import { beendeGespraechAufServer, neueGespraechId } from './ki';

/**
 * Das Gespräch mit Claude (Entscheidung 37): Id und Verlauf leben nur hier, im Speicher der Seite. Einklappen lässt es
 * weiterlaufen. Schließen, „Neu beginnen“, ein anderes Dokument und das Ende der Seite beenden es.
 */
export const useGespraech = () => {
	const [verlauf, setWert] = useState<ChatNachricht[]>([]);
	/** Zählt jedes Ende durch Schließen oder „Neu beginnen“. Das Fenster bleibt dabei, sein Stand muss mit weg. */
	const [nummer, setNummer] = useState(0);
	const id = useRef<string | null>(null);
	const bezug = useRef<string | null>(null);
	const enden = useRef(0);

	const setVerlauf = useCallback((aendere: (alt: ChatNachricht[]) => ChatNachricht[]) => {
		setWert((alt) => aendere(alt).slice(-MAX_NACHRICHTEN));
	}, []);

	const verwirf = useCallback(() => {
		if (id.current) {
			beendeGespraechAufServer(id.current);
		}
		id.current = null;
		setWert([]);
	}, []);

	const beende = useCallback(() => {
		verwirf();
		enden.current += 1;
		setNummer(enden.current);
	}, [verwirf]);

	/** Die Seite meldet, worum es geht. Seitenwechsel innerhalb desselben Bezugs zählen nicht als Ende. */
	const folge = useCallback(
		(neu: string) => {
			if (bezug.current !== null && bezug.current !== neu) {
				verwirf();
			}
			bezug.current = neu;
		},
		[verwirf],
	);

	const sichereId = useCallback(() => {
		id.current ??= neueGespraechId();
		return id.current;
	}, []);

	/** Aus der Nachricht ist ein Dokument entstanden: Das Gespräch gehört ab jetzt ihm. */
	const uebernimm = useCallback((ort: { mappe: string; dok: string }, neueId: string, nurLetzte: boolean) => {
		if (id.current && id.current !== neueId) {
			beendeGespraechAufServer(id.current);
		}
		id.current = neueId;
		bezug.current = `${ort.mappe}/${ort.dok}`;
		if (nurLetzte) {
			setWert((alt) => alt.slice(-1));
		}
	}, []);

	const endeZahl = useCallback(() => enden.current, []);

	useEffect(() => {
		const weg = () => {
			if (id.current) {
				beendeGespraechAufServer(id.current);
			}
		};
		window.addEventListener('pagehide', weg);
		return () => window.removeEventListener('pagehide', weg);
	}, []);

	return { verlauf, setVerlauf, nummer, beende, folge, sichereId, uebernimm, endeZahl };
};

export type Gespraech = ReturnType<typeof useGespraech>;
