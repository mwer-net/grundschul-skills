import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';

import type { ChatFensterZustand, ChatKontext, ChatLauf, ChatSteuerung } from './chat-kontext';
import { ChatStandKontext, ChatSteuerungKontext } from './chat-kontext';
import { ChatInhalt } from './ChatFenster';
import { useKiZustand } from './ki';
import { TASTEN_SPERRE } from './tasten';
import { useNeuMaterial } from './useNeuMaterial';

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
	const neu = useNeuMaterial();
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
		const { kontext: k } = jetzt.current;
		const stelle = k?.art === 'dokument' ? k.handlungen.current.holeZitat() : '';
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
			const { kontext: k } = jetzt.current;
			if (k?.art === 'dokument') {
				k.handlungen.current.zumBlatt();
			}
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

	// Außerhalb des Editors gibt es kein Befehlsregister; ⌘J gilt trotzdem.
	const artJetzt = kontext?.art;
	const verfuegbar = ki.zustand.verfuegbar;
	useEffect(() => {
		if (!artJetzt || artJetzt === 'dokument' || !verfuegbar) {
			return undefined;
		}
		const druck = (e: KeyboardEvent) => {
			const befehl = (e.metaKey || e.ctrlKey) && e.code === 'KeyJ';
			const wahl = e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyC';
			if ((befehl || wahl) && !document.querySelector(TASTEN_SPERRE)) {
				e.preventDefault();
				steuerung.taste();
			}
		};
		window.addEventListener('keydown', druck);
		return () => window.removeEventListener('keydown', druck);
	}, [artJetzt, steuerung, verfuegbar]);

	return (
		<ChatSteuerungKontext.Provider value={steuerung}>
			<ChatStandKontext.Provider value={stand}>
				<Outlet />
				{kontext && (
					<ChatInhalt
						key={`${kontext.art}/${kontext.mappe ?? ''}/${kontext.art === 'neu' ? '' : kontext.dok}`}
						entwurf={entwurf}
						fenster={fenster}
						fokus={fokus}
						kontext={kontext}
						ki={ki}
						neu={neu}
						meldeLauf={setLauf}
						meldeVerlaufHoehe={setVerlaufHoehe}
						setEntwurf={setEntwurf}
						setFenster={setFenster}
						setZitat={setZitat}
						sichereZitat={sichereZitat}
						zitat={zitat}
					/>
				)}
				{neu.dialog}
			</ChatStandKontext.Provider>
		</ChatSteuerungKontext.Provider>
	);
};
