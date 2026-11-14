import { erzeugeReferenz, pfadVon } from '@schoolbox/kern/src/referenz';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ApiFehler, lade, meldung, sende } from '../api';
import { useEreignisse } from '../ereignisse';
import { istRueckfrage, loescheAlteVerlaeufe, MAX_NACHRICHTEN, verlaufFuerServer } from './chat-verlauf';
import type { ClaudeLage, Faden, FadenStand } from './claude-faeden';
import {
	antwortVon,
	ergaenzeFaeden,
	laeuftNoch,
	lebt,
	loeseAnker,
	MAX_GESPRAECHE,
	meintGanzesBlatt,
	nachAbbruch,
	nachricht,
	neuerFaden,
	ohneGespraech,
	seitenVon,
	standVon,
	stehtAus,
	verankert,
	vorschlagDes,
} from './claude-faeden';
import type { ClaudeHandlungen, ClaudeSteuerung } from './claude-kontext';
import type { KiAuftrag, useKiZustand, VorschlagAmBlatt } from './ki';
import { beendeGespraechAufServer, limitHinweis, neueGespraechId, useGespraecheEnden } from './ki';
import type { ClaudeLauf } from './Statusleiste';

/** Nur wenn gerade nichts anderes die Tastatur hat: Wer im Blatt schreibt, soll nicht plötzlich in der Blase tippen. */
const fokusFrei = () => {
	const aktiv = document.activeElement;
	return !aktiv || aktiv === document.body || Boolean(aktiv.closest('[data-claude-blase]'));
};

const VOLL = `Höchstens ${MAX_GESPRAECHE} Aufträge an Claude gleichzeitig. Entscheide erst einen Vorschlag oder warte, bis einer fertig ist.`;

/** Der Name des Elements wie in den Ebenen; „Ganzes Material“ ohne Referenz (wie `bezugVon` in der Blase). */
const bezugIm = (l: ClaudeLage | null, f: Faden) => {
	if (!l || f.nr === null || (f.ganz && seitenVon(l.z, l.loesung).length > 1)) {
		return 'Ganzes Material';
	}
	return pfadVon(l.z, f.nr, l.loesung).at(-1)?.name ?? 'Ganzes Material';
};

/** Die Statusleiste: was eingeklappte Gespräche tun; bei mehreren nur die Zahl (135). */
const laufVon = (
	liste: { f: Faden; stand: FadenStand; auftrag: KiAuftrag | undefined }[],
	l: ClaudeLage | null,
): ClaudeLauf | null => {
	const [eins] = liste;
	if (!eins || eins.stand === 'ruhig') {
		return null;
	}
	if (liste.length > 1) {
		return { art: 'mehrere', bezug: '', seit: 0, anzahl: liste.length };
	}
	const seit = eins.auftrag?.seit ? Date.parse(eins.auftrag.seit) || 0 : 0;
	return { art: eins.stand, bezug: bezugIm(l, eins.f), seit, anzahl: 1 };
};

/**
 * 191-U2: Aus der PDF-Warnung kommt eine vorbereitete Bitte mit. `seite`: die eine betroffene Seite (ab 1); ohne
 * gilt das ganze Material.
 */
export interface ClaudeBitte {
	text: string;
	seite: number | null;
}

interface Angaben {
	mappe: string;
	dok: string;
	auswahl: number | null;
	waehle: (nr: number | null) => void;
	/** Die Seite im Sichtfeld: ⌘J ohne Auswahl nimmt sie. */
	seite: () => number | null;
	/** Das Blatt darf geändert werden: keine Versionsvorschau, kein Konflikt, kein neues Blatt in Arbeit. */
	frei: boolean;
	handlungen: RefObject<ClaudeHandlungen>;
	ki: ReturnType<typeof useKiZustand>;
}

/** Aufträge und Vorschläge des Blatts vom Server, ohne das neue Blatt (133): Das zeigt der Editor selbst. */
const useServerStand = (mappe: string, dok: string, kiNeu: () => void) => {
	const basis = `/api/dokumente/${mappe}/${dok}`;
	const [auftraege, setAuftraege] = useState<Record<string, KiAuftrag>>({});
	const [vorschlaege, setVorschlaege] = useState<VorschlagAmBlatt[]>([]);
	const fragen = useRef(new Map<string, number>());
	const offeneAuftraege = useRef(auftraege);
	offeneAuftraege.current = auftraege;

	const ladeVorschlaege = useCallback(async () => {
		const { vorschlaege: alle } = await lade<{ vorschlaege: VorschlagAmBlatt[] }>(`${basis}/vorschlaege?quelle=1`);
		setVorschlaege(alle.filter((v) => !v.neuesBlatt));
	}, [basis]);

	const pruefe = useCallback(
		async (id: string) => {
			const frage = (fragen.current.get(id) ?? 0) + 1;
			fragen.current.set(id, frage);
			try {
				const { auftrag } = await lade<{ auftrag: KiAuftrag }>(`/api/ki/${id}`);
				// Eine spätere Frage kennt den neueren Stand.
				if (fragen.current.get(id) !== frage || auftrag.neuesBlatt) {
					return;
				}
				if (!laeuftNoch(auftrag)) {
					// Erst der Vorschlag, dann das Ende: Wer das Ende sieht, soll auch den Vorschlag sehen.
					await ladeVorschlaege().catch(() => undefined);
					kiNeu();
				}
				setAuftraege((alt) => ({ ...alt, [id]: auftrag }));
			} catch (grund) {
				const fehler = meldung(grund);
				setAuftraege((alt) => {
					const war = alt[id];
					return war ? { ...alt, [id]: { ...war, status: 'fehler', fehler } } : alt;
				});
			}
		},
		[kiNeu, ladeVorschlaege],
	);

	useEffect(() => {
		void ladeVorschlaege().catch(() => undefined);
		lade<{ auftraege: KiAuftrag[] }>(`${basis}/ki`).then(
			({ auftraege: laufend }) => {
				const eigene = laufend.filter((a) => !a.neuesBlatt);
				setAuftraege((alt) => ({ ...Object.fromEntries(eigene.map((a) => [a.id, a])), ...alt }));
				eigene.forEach((a) => void pruefe(a.id));
			},
			() => undefined,
		);
	}, [basis, ladeVorschlaege, pruefe]);

	useEreignisse((e) => {
		if (e.typ === 'ki-stand' && e.id && e.mappe === mappe && e.dok === dok) {
			void pruefe(e.id);
		}
		// Ein Ende vor dem Verbinden hat niemand gehört, nach einem Neustart des Servers kommt gar keins mehr.
		if (e.typ === 'verbunden') {
			Object.values(offeneAuftraege.current)
				.filter(laeuftNoch)
				.forEach((a) => void pruefe(a.id));
		}
		if (e.typ === 'dokument-geaendert' && e.mappe === mappe && e.dok === dok) {
			void ladeVorschlaege().catch(() => undefined);
		}
	});

	const merkeAuftrag = useCallback((a: KiAuftrag) => setAuftraege((alt) => ({ ...alt, [a.id]: a })), []);
	return { basis, auftraege, vorschlaege, ladeVorschlaege, pruefe, merkeAuftrag };
};

/**
 * Claude am Element (134, 135): Gespräche je Element, ihre Aufträge und Vorschläge. Der Server hält Aufträge und
 * Vorschläge, die Gespräche leben nur hier. Die Logik kommt aus dem früheren Chat (074, 086, 087).
 */
export const useClaude = ({ auswahl, dok, frei, handlungen, ki, mappe, seite, waehle }: Angaben) => {
	const { neu: kiNeu, zustand } = ki;
	const server = useServerStand(mappe, dok, kiNeu);
	const { auftraege, basis, ladeVorschlaege, merkeAuftrag, pruefe, vorschlaege } = server;
	const [faeden, setFaeden] = useState<Faden[]>([]);
	const [offen, setOffen] = useState<string | null>(null);
	const [lage, setLage] = useState<ClaudeLage | null>(null);
	const [fokus, setFokus] = useState(0);
	const erledigt = useRef(new Set<string>());
	/** 200-01: abgeschickt, aber noch ohne Auftrag am Server. Die Ref sperrt sofort, der Zustand zeichnet neu. */
	const unterwegsRef = useRef(new Set<string>());
	const [unterwegs, setUnterwegs] = useState<ReadonlySet<string>>(new Set());
	const markiere = (key: string, an: boolean) => {
		if (an) {
			unterwegsRef.current.add(key);
		} else {
			unterwegsRef.current.delete(key);
		}
		setUnterwegs(new Set(unterwegsRef.current));
	};
	const jetzt = useRef({ faeden, offen, auswahl, auftraege, vorschlaege, lage });
	jetzt.current = { faeden, offen, auswahl, auftraege, vorschlaege, lage };
	const hinweis = limitHinweis(zustand.limit, zustand.warnAb);
	const gesperrtLimit = hinweis?.art === 'gesperrt';

	useGespraecheEnden(() => jetzt.current.faeden.flatMap((f) => (f.gespraech ? [f.gespraech] : [])));
	useEffect(() => loescheAlteVerlaeufe(localStorage), []);

	const aendere = useCallback((key: string, teil: Partial<Faden> | ((f: Faden) => Partial<Faden>)) => {
		setFaeden((alt) =>
			alt.map((f) => (f.key === key ? { ...f, ...(typeof teil === 'function' ? teil(f) : teil) } : f)),
		);
	}, []);

	const auftragVon = useCallback((f: Faden) => (f.auftragId ? auftraege[f.auftragId] : undefined), [auftraege]);
	const vorschlagVon = useCallback((f: Faden) => vorschlagDes(f, vorschlaege, auftraege), [auftraege, vorschlaege]);
	const standDes = useCallback(
		(f: Faden) => standVon(f, auftragVon(f), vorschlagVon(f), unterwegs.has(f.key)),
		[auftragVon, unterwegs, vorschlagVon],
	);

	useEffect(() => {
		setFaeden((alt) => {
			const neu = ergaenzeFaeden(alt, auftraege, vorschlaege).filter((f) =>
				lebt(f, jetzt.current.offen, auftraege, vorschlaege),
			);
			return neu.length === alt.length && neu.every((f, i) => f === alt[i]) ? alt : neu;
		});
	}, [auftraege, vorschlaege, offen]);

	// Jede neue Zerlegung: Die Fäden suchen ihr Element. Ist es weg, endet das Gespräch (135).
	const unverankert = faeden.filter((f) => f.nr === null).length;
	const vorige = useRef<ClaudeLage | null>(null);
	useEffect(() => {
		if (!lage) {
			return;
		}
		const vorher = vorige.current?.z ?? null;
		if (lage.echt) {
			vorige.current = lage;
		}
		const { auftraege: a, auswahl: gewaehlt, faeden: alle, offen: offenerKey, vorschlaege: v } = jetzt.current;
		const teile = new Map<string, Partial<Faden> | null>();
		for (const f of alle) {
			const hier = verankert(f, lage, vorher);
			if (!hier) {
				// 200-11: Mit dem Element enden Gespräch, Lauf und Vorschlag; „Rückgängig“ bringt nur das Element zurück.
				if (f.gespraech) {
					beendeGespraechAufServer(f.gespraech);
				}
				const auftrag = f.auftragId ? a[f.auftragId] : undefined;
				if (auftrag && laeuftNoch(auftrag)) {
					erledigt.current.add(auftrag.id);
					void sende(`/api/ki/${auftrag.id}/abbrechen`)
						.catch(() => undefined)
						.then(() => pruefe(auftrag.id));
				}
				const vorschlag = vorschlagDes(f, v, a);
				if (vorschlag) {
					void sende(`${basis}/vorschlag/verwerfen`, { gespraech: vorschlag.schluessel })
						.catch(() => undefined)
						.then(() => ladeVorschlaege())
						.catch(() => undefined);
				}
				teile.set(f.key, null);
			} else if (hier.nr !== f.nr || hier.referenz !== f.referenz) {
				teile.set(f.key, hier);
				// Die offene Blase zog mit ihrem Element um, etwa nach dem Annehmen: Die Auswahl geht mit.
				if (f.key === offenerKey && gewaehlt === f.nr) {
					waehle(hier.nr);
				}
			}
		}
		if (teile.size > 0) {
			setFaeden((alt) =>
				alt.flatMap((f) => {
					const teil = teile.get(f.key);
					if (teil === undefined) {
						return [f];
					}
					return teil ? [{ ...f, ...teil }] : [];
				}),
			);
		}
	}, [auftragVon, basis, ladeVorschlaege, lage, pruefe, unverankert, waehle]);

	// Eine andere Auswahl klappt die offene Blase ein (135); sie gehört zu ihrem Element.
	useEffect(() => {
		const { faeden: alle, offen: offenerKey } = jetzt.current;
		const f = alle.find((x) => x.key === offenerKey);
		if (f && f.nr !== auswahl) {
			setOffen(null);
		}
	}, [auswahl]);

	// Ist die Sperre weg, stimmt auch die alte Meldung nicht mehr.
	const warGesperrt = useRef(gesperrtLimit);
	useEffect(() => {
		if (warGesperrt.current && !gesperrtLimit) {
			setFaeden((alt) => alt.map((f) => (f.fehler ? { ...f, fehler: null } : f)));
		}
		warGesperrt.current = gesperrtLimit;
	}, [gesperrtLimit]);

	// Das Ende eines Laufs einmal in den Verlauf schreiben, ganz gleich, wie es hier ankam.
	useEffect(() => {
		for (const f of faeden) {
			const a = auftragVon(f);
			if (!a || laeuftNoch(a) || erledigt.current.has(a.id)) {
				continue;
			}
			erledigt.current.add(a.id);
			const vorschlag = vorschlagVon(f);
			const text = antwortVon(a, vorschlag);
			const sichtbar = f.key === offen;
			if (a.status === 'abgebrochen') {
				aendere(f.key, (alt) => ({ ...nachAbbruch(alt), fehler: null, gesendet: null }));
				if (sichtbar) {
					setFokus((n) => n + 1);
				}
				continue;
			}
			aendere(f.key, (alt) => ({
				schluessel: vorschlag?.schluessel ?? alt.schluessel,
				verlauf: text ? [...alt.verlauf, nachricht('claude', text, a.id)].slice(-MAX_NACHRICHTEN) : alt.verlauf,
				fehler: a.fehler,
				ungelesen: !sichtbar && a.ergebnis === 'antwort',
				entwurf: a.limitErreicht && alt.gesendet && !alt.entwurf.trim() ? alt.gesendet : alt.entwurf,
				gesendet: null,
			}));
			if (sichtbar && a.ergebnis === 'antwort' && istRueckfrage(text ?? undefined) && fokusFrei()) {
				setFokus((n) => n + 1);
			}
		}
	}, [aendere, auftragVon, faeden, offen, vorschlagVon]);

	const sendeFaden = useCallback(
		async (f: Faden, inhalt: { text: string; aktion?: string }) => {
			const v = vorschlagDes(f, jetzt.current.vorschlaege, jetzt.current.auftraege);
			const aufVorschlag = Boolean(v && !v.konflikt);
			const gespraech = f.gespraech ?? neueGespraechId();
			const vorher = verlaufFuerServer(f.verlauf);
			const zitat = f.zitat;
			aendere(f.key, (alt) => ({
				gespraech,
				verlauf: [...alt.verlauf, nachricht('lehrkraft', inhalt.text, null, zitat)].slice(-MAX_NACHRICHTEN),
				entwurf: '',
				zitat: null,
				fehler: null,
				ungelesen: false,
				gesendet: inhalt.aktion ? null : inhalt.text,
				zuletzt: Date.now(),
			}));
			await handlungen.current.vorbereiten();
			const l = jetzt.current.lage;
			const referenz =
				!aufVorschlag && f.nr !== null && l && !meintGanzesBlatt(f, l)
					? erzeugeReferenz(l.z, f.nr, l.ort, l.loesung)
					: undefined;
			try {
				const { auftrag } = await sende<{ auftrag: KiAuftrag }>(`${basis}/ki`, {
					...(inhalt.aktion ? { aktion: inhalt.aktion } : { auftrag: inhalt.text }),
					referenz,
					aufVorschlag,
					gespraechId: gespraech,
					...(v && aufVorschlag && v.schluessel !== gespraech ? { vorschlag: v.schluessel } : {}),
					...(vorher.length > 0 ? { verlauf: vorher } : {}),
					...(zitat ? { zitat } : {}),
				});
				merkeAuftrag(auftrag);
				aendere(f.key, { auftragId: auftrag.id });
				void pruefe(auftrag.id);
			} catch (grund) {
				const abgelehnt = grund instanceof ApiFehler && grund.status === 429;
				aendere(f.key, (alt) => ({
					fehler: meldung(grund),
					entwurf: abgelehnt && alt.gesendet && !alt.entwurf.trim() ? alt.gesendet : alt.entwurf,
					gesendet: null,
				}));
				kiNeu();
			}
			// Unterwegs beendet: Das Ende kam vor dem Auftrag am Server an und hat nichts gefunden.
			if (!jetzt.current.faeden.some((x) => x.gespraech === gespraech)) {
				beendeGespraechAufServer(gespraech);
			}
		},
		[aendere, basis, handlungen, kiNeu, merkeAuftrag, pruefe],
	);

	const finde = (key: string) => jetzt.current.faeden.find((f) => f.key === key);
	/** Der Stand nach dem, was gerade bekannt ist, auch zwischen zwei Bildern. */
	const standJetzt = (f: Faden) => {
		const { auftraege: a, vorschlaege: v } = jetzt.current;
		const auftrag = f.auftragId ? a[f.auftragId] : undefined;
		return standVon(f, auftrag, vorschlagDes(f, v, a), unterwegsRef.current.has(f.key));
	};
	/** Die Grenze zählt nur Fäden, an denen etwas aussteht (200-04). */
	const ausstehend = (alle: readonly Faden[]) => alle.filter((f) => stehtAus(standJetzt(f))).length;

	/** Warum gerade nichts abgeschickt werden kann; `null`: es geht. */
	const sperreVon = (f: Faden) => {
		if (unterwegsRef.current.has(f.key) || laeuftNoch(auftragVon(f))) {
			return 'Claude arbeitet gerade.';
		}
		// Derselbe Satz wie in der Zeile über dem Feld (190-24).
		if (gesperrtLimit) {
			return hinweis?.text ?? null;
		}
		return frei ? null : 'Das Blatt ist gerade gesperrt.';
	};

	const sendeAn = (key: string, inhalt: { text: string; aktion?: string }) => {
		const f = finde(key);
		if (f && inhalt.text.trim() && sperreVon(f) === null) {
			markiere(key, true);
			void sendeFaden(f, inhalt).finally(() => markiere(key, false));
		}
	};

	const fadenAn = (nr: number, l: ClaudeLage, zitat: string | null) => {
		const key = neueGespraechId();
		return neuerFaden({ key, schluessel: key, referenz: erzeugeReferenz(l.z, nr, l.ort, l.loesung), nr, zitat });
	};

	const oeffne = (ziel?: number | null) => {
		const { auswahl: gewaehlt, faeden: alle, lage: l } = jetzt.current;
		const nr = ziel ?? gewaehlt ?? seite();
		if (nr === null || !l) {
			return null;
		}
		const zitat = handlungen.current.holeZitat() || null;
		const da = alle.find((f) => f.nr === nr);
		if (!da && ausstehend(alle) >= MAX_GESPRAECHE) {
			return null;
		}
		let key: string;
		if (da) {
			key = da.key;
			aendere(key, (alt) => ({ zitat: zitat ?? alt.zitat, ungelesen: false, zuletzt: Date.now() }));
		} else {
			const neu = fadenAn(nr, l, zitat);
			key = neu.key;
			setFaeden((alt) => [...alt, neu]);
		}
		setOffen(key);
		if (nr !== gewaehlt) {
			waehle(nr);
		}
		setFokus((n) => n + 1);
		return key;
	};

	/** ×, Esc, ⌘J, Klick daneben (200-05). Das Gespräch endet dabei, wenn nichts aussteht (`beendeWennRuhig`). */
	const einklappen = () => {
		setOffen(null);
		handlungen.current.zumBlatt();
	};

	/**
	 * 200-04: Eine geschlossene Blase ohne Ausstehendes beendet ihr Gespräch. Ein getippter Text bleibt am Element und
	 * steht beim nächsten Öffnen im Feld; ohne ihn ist der Faden weg.
	 */
	const beendeWennRuhig = (key: string) => {
		const f = finde(key);
		if (!f || stehtAus(standJetzt(f))) {
			return;
		}
		if (f.gespraech) {
			beendeGespraechAufServer(f.gespraech);
		}
		if (f.entwurf.trim()) {
			aendere(key, { ...ohneGespraech(f, undefined), entwurf: f.entwurf });
		} else {
			setFaeden((alt) => alt.filter((x) => x.key !== key));
		}
	};
	const vorigOffen = useRef<string | null>(null);
	useEffect(() => {
		const vor = vorigOffen.current;
		vorigOffen.current = offen;
		if (vor && vor !== offen) {
			beendeWennRuhig(vor);
		}
	});

	/** „Neu beginnen“ (Entscheidung 37): Die Sitzung ist weg, ein offener Vorschlag und ein Lauf bleiben. */
	const neuBeginnen = (key: string) => {
		const f = finde(key);
		if (!f) {
			return;
		}
		if (f.gespraech) {
			beendeGespraechAufServer(f.gespraech);
		}
		// Ein laufender Auftrag läuft zu Ende, seine Antwort gehört zu nichts mehr.
		if (f.auftragId) {
			erledigt.current.add(f.auftragId);
		}
		aendere(key, ohneGespraech(f, vorschlagVon(f)));
		setFokus((n) => n + 1);
	};

	/** Wo das Element des Fadens im gezeigten Blatt liegt; auf einem gezeigten Vorschlag über die Referenz. */
	const nrImBlatt = (f: Faden) =>
		lage && !lage.echt && f.referenz ? (loeseAnker(lage.z, f.referenz) ?? f.nr) : f.nr;

	const offenerFaden = faeden.find((f) => f.key === offen) ?? null;
	const offenerVorschlag = offenerFaden ? vorschlagVon(offenerFaden) : undefined;
	const seiten = lage ? Math.max(1, seitenVon(lage.z, lage.loesung).length) : 1;
	// Baustein und Seite zeigen den offenen Vorschlag im Blatt; „Ganzes Material“ lässt das Blatt, wie es ist (134).
	const imBlatt = offenerVorschlag?.referenz ? !offenerFaden?.ganz : seiten === 1;
	const zeigt = offenerVorschlag && !offenerVorschlag.konflikt && imBlatt ? (offenerVorschlag.quelle ?? null) : null;

	const eingeklappt = faeden
		.filter((f) => f.key !== offen && f.nr !== null)
		.map((f) => ({ f, auftrag: auftragVon(f), stand: standDes(f) }))
		.filter((x) => stehtAus(x.stand));

	const steuerung: ClaudeSteuerung = { oeffne };

	// 191-U2: Die Bitte aus der PDF-Warnung steht im Feld, nicht abgeschickt; die Lehrkraft schickt sie selbst ab.
	const ort = useLocation();
	const navigate = useNavigate();
	const bitte = (ort.state as { claudeBitte?: ClaudeBitte } | null)?.claudeBitte;
	const mitLage = lage !== null;
	useEffect(() => {
		const l = jetzt.current.lage;
		if (!bitte || !l) {
			return;
		}
		// Einmal: Neuladen oder Zurück bringen die Bitte nicht wieder.
		void navigate(`${ort.pathname}${ort.search}`, {
			replace: true,
			state: { ...(ort.state as object), claudeBitte: undefined },
		});
		const alle = seitenVon(l.z, l.loesung);
		const eine = bitte.seite === null ? undefined : alle[bitte.seite - 1];
		const key = oeffne(eine?.nr ?? alle[0]?.nr ?? null);
		if (key) {
			aendere(key, { entwurf: bitte.text, ...(!eine && alle.length > 1 ? { ganz: true } : {}) });
			requestAnimationFrame(() => setFokus((n) => n + 1));
		}
		// `oeffne` und der Ort lesen den Stand im Augenblick; neu läuft der Effekt nur mit einer neuen Bitte.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bitte, mitLage]);
	const belegt =
		ausstehend(faeden) >= MAX_GESPRAECHE && !faeden.some((f) => f.nr === auswahl && stehtAus(standDes(f)));
	const schluesselVon = (f: Faden) => vorschlagVon(f)?.schluessel ?? f.schluessel;

	return {
		faeden,
		offen: offenerFaden,
		zeigt,
		fokus,
		hinweis,
		gesperrtLimit,
		verfuegbar: zustand.verfuegbar,
		geladen: ki.geladen,
		aktionen: zustand.aktionen,
		pruefeLimit: ki.pruefeLimit,
		seiten,
		auftragVon,
		vorschlagVon,
		sperreVon,
		nrImBlatt,
		/** Der Knopf „Claude“: gesperrt, wenn schon so viele Gespräche laufen, wie die Warteschlange fasst (135). */
		knopfGrund: belegt ? VOLL : null,
		setzeLage: setLage,
		lauf: laufVon(eingeklappt, lage),
		standDes,
		/** Abgeschickt oder am Server in Arbeit (200-01): Laufzeile statt Feld zum Abschicken. */
		laeuft: (f: Faden) => unterwegs.has(f.key) || laeuftNoch(auftragVon(f)),
		/** Klick in der Statusleiste: rollt zum zuletzt aktiven Gespräch und klappt es auf. */
		zeigeLauf: (zeigeAn: (nr: number) => void) => {
			const [juengstes] = eingeklappt.map((x) => x.f).sort((a, b) => b.zuletzt - a.zuletzt);
			if (juengstes && juengstes.nr !== null) {
				zeigeAn(juengstes.nr);
				oeffne(juengstes.nr);
			}
		},
		steuerung,
		oeffne,
		einklappen,
		neuBeginnen,
		/** ⌘J: öffnet die Blase an der Auswahl; steht der Fokus schon in ihrem Feld, klappt sie ein (135). */
		taste: (): string | null => {
			const imFeld = Boolean(document.activeElement?.closest('[data-claude-blase]'));
			if (jetzt.current.offen && imFeld) {
				einklappen();
				return null;
			}
			if (oeffne() !== null || !jetzt.current.lage || !belegt) {
				return null;
			}
			return VOLL;
		},
		/**
		 * Die Palette schreibt ins Feld; abgeschickt wird von Hand. Der Fokus kommt ein Bild später ins Feld: Die
		 * Palette gibt ihn beim Schließen dem Blatt zurück, und das kommt im `iframe` erst danach an (200-19).
		 */
		fuelle: (text: string) => {
			const key = oeffne();
			if (key) {
				aendere(key, { entwurf: text });
				requestAnimationFrame(() => setFokus((n) => n + 1));
			}
		},
		setEntwurf: (key: string, text: string) => aendere(key, { entwurf: text }),
		setZitat: (key: string, zitat: string | null) => aendere(key, { zitat }),
		/** Beim Wechsel in die Blase: Danach ist die Markierung im Blatt weg. */
		sichereZitat: (key: string) => {
			const stelle = handlungen.current.holeZitat();
			if (stelle) {
				aendere(key, { zitat: stelle });
			}
		},
		sende: sendeAn,
		/** Dieselbe Nachricht noch einmal, etwa nach einem Fehler oder einem Konflikt. */
		neuStarten: (key: string) => {
			const f = finde(key);
			const text = f?.verlauf.findLast((n) => n.rolle === 'lehrkraft')?.text ?? (f && vorschlagVon(f)?.auftrag);
			if (f && text) {
				const aktion = zustand.aktionen.find((a) => a.name === text)?.id;
				sendeAn(key, { text, ...(aktion ? { aktion } : {}) });
			}
		},
		/** Eine andere Stufe im Kopf: Das Gespräch zieht ans Element dieser Stufe, die Auswahl geht mit. */
		waehleStufe: (key: string, nr: number, ganz: boolean) => {
			const { faeden: alle, lage: l } = jetzt.current;
			const anderer = alle.find((f) => f.nr === nr && f.key !== key);
			if (!l || anderer) {
				oeffne(nr);
				return;
			}
			aendere(key, { nr, ganz, referenz: erzeugeReferenz(l.z, nr, l.ort, l.loesung) });
			waehle(nr);
			setFokus((n) => n + 1);
		},
		annehmen: async (key: string) => {
			const f = finde(key);
			if (!f) {
				return;
			}
			const gespraech = schluesselVon(f);
			let angenommen = false;
			await handlungen.current.annimm(() =>
				sende(`${basis}/vorschlag/annehmen`, { gespraech }).then(
					() => {
						angenommen = true;
					},
					(grund: unknown) => aendere(key, { fehler: meldung(grund) }),
				),
			);
			await ladeVorschlaege().catch(() => undefined);
			// 200-10: Die Änderung steht im Blatt, das Gespräch ist erledigt; das Element bleibt gewählt.
			if (angenommen) {
				const nachher = finde(key);
				if (nachher?.gespraech) {
					beendeGespraechAufServer(nachher.gespraech);
				}
				setFaeden((alt) =>
					alt.flatMap((x) => {
						if (x.key !== key) {
							return [x];
						}
						return x.entwurf.trim() ? [{ ...x, ...ohneGespraech(x, undefined), entwurf: x.entwurf }] : [];
					}),
				);
				if (jetzt.current.offen === key) {
					einklappen();
				}
			}
		},
		verwerfen: async (key: string) => {
			const f = finde(key);
			if (!f) {
				return;
			}
			await sende(`${basis}/vorschlag/verwerfen`, { gespraech: schluesselVon(f) }).catch((grund: unknown) =>
				aendere(key, { fehler: meldung(grund) }),
			);
			await ladeVorschlaege().catch(() => undefined);
		},
		abbrechen: async (key: string) => {
			const f = finde(key);
			const a = f ? auftragVon(f) : undefined;
			if (a) {
				await sende(`/api/ki/${a.id}/abbrechen`).catch(() => undefined);
				await pruefe(a.id);
			}
		},
		/** Wie beim Senden: Meint die Seite das ganze Blatt, bekommt die Claude-App das ganze Dokument. */
		zurApp: (key: string) => {
			const f = finde(key);
			const l = jetzt.current.lage;
			handlungen.current.zurApp(f && l && !meintGanzesBlatt(f, l) ? f.nr : null);
		},
	};
};

export type Claude = ReturnType<typeof useClaude>;
