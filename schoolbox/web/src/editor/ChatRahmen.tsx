import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';

import type { ChatFensterZustand, ChatKontext, ChatLauf, ChatSteuerung } from './chat-kontext';
import { ChatStandKontext, ChatSteuerungKontext } from './chat-kontext';
import { ChatInhalt } from './ChatFenster';
import { useKiZustand } from './ki';

const SPEICHER = 'schoolbox-chat-fenster';

const gemerkt = (): ChatFensterZustand => {
	const wert = localStorage.getItem(SPEICHER);
	return wert === 'zeile' || wert === 'verlauf' ? wert : 'zu';
};

/**
 * Hält den Chat über Seitenwechsel hinweg. Die Seite meldet ihren Kontext (`useChatKontext`); ohne Kontext gibt es kein
 * Fenster. Der Inhalt bleibt auch bei geschlossenem Fenster da: Lauf und Vorschlag brauchen die Statusleiste.
 */
export const ChatRahmen = () => {
	const ki = useKiZustand();
	const [kontext, melde] = useState<ChatKontext | null>(null);
	const [fenster, setFensterWert] = useState(gemerkt);
	const [lauf, setLauf] = useState<ChatLauf | null>(null);
	const [verlaufHoehe, setVerlaufHoehe] = useState(0);
	const [entwurf, setEntwurf] = useState('');
	const [zitat, setZitat] = useState<string | null>(null);
	const [fokus, setFokus] = useState(0);
	const jetzt = useRef({ fenster, kontext });
	useEffect(() => {
		jetzt.current = { fenster, kontext };
	}, [fenster, kontext]);

	const setFenster = useCallback((wert: ChatFensterZustand) => {
		setFensterWert(wert);
		localStorage.setItem(SPEICHER, wert);
	}, []);

	/** Beim Wechsel ins Fenster, nicht beim Absenden: Danach ist die Markierung im Blatt weg. */
	const sichereZitat = useCallback(() => {
		const stelle = jetzt.current.kontext?.handlungen.current.holeZitat();
		if (stelle) {
			setZitat(stelle);
		}
	}, []);

	const steuerung = useMemo<ChatSteuerung>(() => {
		const oeffne: ChatSteuerung['oeffne'] = (ziel) => {
			sichereZitat();
			const offen = jetzt.current.fenster;
			if (ziel || offen === 'zu') {
				setFenster(ziel ?? 'zeile');
			}
			setFokus((n) => n + 1);
		};
		const schliesse = () => {
			setFenster('zu');
			jetzt.current.kontext?.handlungen.current.zumBlatt();
		};
		return {
			melde,
			oeffne,
			wechsle: () => (jetzt.current.fenster === 'zu' ? oeffne() : schliesse()),
			taste: () => {
				const imFeld = document.activeElement?.closest('[data-chat]');
				return jetzt.current.fenster !== 'zu' && imFeld ? schliesse() : oeffne();
			},
			fuelle: (text) => {
				setEntwurf(text);
				oeffne();
			},
		};
	}, [setFenster, sichereZitat]);

	const stand = useMemo(() => ({ fenster, lauf, verlaufHoehe, ki }), [fenster, lauf, verlaufHoehe, ki]);

	// Aus dem Assistenten (060): Das Fenster geht auf, ohne der Seite die Tastatur zu nehmen.
	const [suche] = useSearchParams();
	const location = useLocation();
	const ausAssistent = suche.get('claude') === '1';
	useEffect(() => {
		if (ausAssistent) {
			setFenster('verlauf');
		}
	}, [ausAssistent, location.key, setFenster]);

	return (
		<ChatSteuerungKontext.Provider value={steuerung}>
			<ChatStandKontext.Provider value={stand}>
				<Outlet />
				{kontext && (
					<ChatInhalt
						key={`${kontext.mappe}/${kontext.dok}`}
						entwurf={entwurf}
						fenster={fenster}
						fokus={fokus}
						kontext={kontext}
						ki={ki}
						meldeLauf={setLauf}
						meldeVerlaufHoehe={setVerlaufHoehe}
						setEntwurf={setEntwurf}
						setFenster={setFenster}
						setZitat={setZitat}
						sichereZitat={sichereZitat}
						zitat={zitat}
					/>
				)}
			</ChatStandKontext.Provider>
		</ChatSteuerungKontext.Provider>
	);
};
