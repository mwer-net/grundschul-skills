import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';

import type { ChatEmpfaenger, ChatFensterZustand, ChatKontext, ChatLauf, ChatSteuerung } from './chat-kontext';
import { ChatStandKontext, ChatSteuerungKontext } from './chat-kontext';
import { loescheAlteVerlaeufe } from './chat-verlauf';
import { ChatInhalt } from './ChatFenster';
import { useKiZustand } from './ki';
import { TASTEN_SPERRE } from './tasten';
import { useGespraech } from './useGespraech';
import { useNeuMaterial } from './useNeuMaterial';

/** Worauf sich ein Gespräch bezieht. Ansicht und Editor desselben Dokuments sind dasselbe; Seiten ohne Dokument auch. */
const bezugVon = (kontext: ChatKontext | null) => {
	if (!kontext) {
		return null;
	}
	return kontext.art === 'neu' ? 'neu' : `${kontext.mappe}/${kontext.dok}`;
};

/**
 * Hält den Chat über Seitenwechsel hinweg. Die Seite meldet ihren Kontext (`useChatKontext`); ohne Kontext gibt es kein
 * Fenster. Der Inhalt bleibt auch bei geschlossenem Fenster da: Lauf und Vorschlag brauchen die Statusleiste.
 */
export const ChatRahmen = () => {
	const ki = useKiZustand();
	const [kontext, melde] = useState<ChatKontext | null>(null);
	const [fenster, setFensterWert] = useState<ChatFensterZustand>('zu');
	const [lauf, setLauf] = useState<ChatLauf | null>(null);
	const [verlaufHoehe, setVerlaufHoehe] = useState(0);
	const [entwurf, setEntwurf] = useState('');
	const [zitat, setZitat] = useState<string | null>(null);
	const [fokus, setFokus] = useState(0);
	const gespraech = useGespraech();
	const neu = useNeuMaterial(gespraech);
	const jetzt = useRef({ fenster, kontext });
	const empfaenger = useRef<ChatEmpfaenger | null>(null); // 117
	useEffect(() => {
		jetzt.current = { fenster, kontext };
	}, [fenster, kontext]);

	useEffect(() => loescheAlteVerlaeufe(localStorage), []);

	// Das Fenster schließen heißt: Das Gespräch ist zu Ende (Entscheidung 37). Einklappen ist etwas anderes.
	const { beende: beendeGespraech, beginneFuer, folge: folgeBezug, sichereId } = gespraech;
	const setFenster = useCallback(
		(wert: ChatFensterZustand) => {
			setFensterWert(wert);
			if (wert === 'zu') {
				beendeGespraech();
			}
		},
		[beendeGespraech],
	);

	// Ohne Kontext (Präsentation, Druck, der Moment des Seitenwechsels) bleibt der Bezug, wie er war.
	const bezug = bezugVon(kontext);
	useLayoutEffect(() => {
		if (bezug) {
			folgeBezug(bezug);
		}
	}, [bezug, folgeBezug]);

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
			// 117: Nur mit einem offenen Dokument; die Sperren prüft der Chat selbst.
			schicke: (text) => (empfaenger.current ? empfaenger.current(text) : 'Claude ist hier nicht verfügbar.'),
			beendeGespraech,
			gespraechId: sichereId,
			beginneGespraech: beginneFuer,
		};
	}, [beendeGespraech, beginneFuer, setFenster, sichereId, sichereZitat]);

	const stand = useMemo(() => ({ fenster, lauf, verlaufHoehe, ki }), [fenster, lauf, verlaufHoehe, ki]);

	// „Im Editor ansehen“ aus der Ansicht: Das Fenster geht auf, ohne der Seite die Tastatur zu nehmen.
	const [suche] = useSearchParams();
	const location = useLocation();
	const ausAnsicht = suche.get('chat') === '1';
	useEffect(() => {
		if (ausAnsicht) {
			setFenster('verlauf');
		}
	}, [ausAnsicht, location.key, setFenster]);

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
						empfaenger={empfaenger}
						entwurf={entwurf}
						fenster={fenster}
						fokus={fokus}
						gespraech={gespraech}
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
