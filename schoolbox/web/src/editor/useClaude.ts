import { erzeugeReferenz } from '@schoolbox/kern/src/referenz';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiFehler, lade, meldung, sende } from '../api';
import { useEreignisse } from '../ereignisse';
import { istRueckfrage, loescheAlteVerlaeufe, MAX_NACHRICHTEN, verlaufFuerServer } from './chat-verlauf';
import type { ClaudeLage, Faden, FadenStand } from './claude-faeden';
import {
	antwortVon,
	ergaenzeFaeden,
	ersteSeite,
	laeuftNoch,
	lebt,
	loeseAnker,
	MAX_GESPRAECHE,
	meintGanzesBlatt,
	nachricht,
	neuerFaden,
	ohneGespraech,
	seitenVon,
	standVon,
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

const MERKEN = new Set(['laeuft', 'wartet', 'vorschlag']);
const VOLL = `Höchstens ${MAX_GESPRAECHE} Gespräche mit Claude gleichzeitig. Beende erst eines mit ×.`;

/** Die Statusleiste: was eingeklappte Gespräche tun; bei mehreren nur die Zahl (135). */
const laufVon = (liste: { f: Faden; stand: FadenStand; auftrag: KiAuftrag | undefined }[]): ClaudeLauf | null => {
	const [eins] = liste;
	if (!eins) {
		return null;
	}
	if (liste.length > 1) {
		return { art: 'mehrere', seit: 0, anzahl: liste.length };
	}
	const seit = eins.auftrag?.seit ? Date.parse(eins.auftrag.seit) || 0 : 0;
	const art = { laeuft: 'arbeitet', wartet: 'arbeitet', vorschlag: 'bereit' } as const;
	return { art: art[eins.stand as keyof typeof art] ?? 'antwort', seit, anzahl: 1 };
};

interface Angaben {
	mappe: string;
	dok: string;
	auswahl: number | null;
	waehle: (nr: number | null) => void;
	/** Die Seite im Sichtfeld: ⌘J ohne Auswahl und die Figuren (117) nehmen sie. */
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
				if (f.gespraech) {
					beendeGespraechAufServer(f.gespraech);
				}
				const vorschlag = vorschlagDes(f, v, a);
				// Ein Auftrag oder Vorschlag bleibt, ohne Gespräch an der ersten Seite.
				const bleibt = laeuftNoch(f.auftragId ? a[f.auftragId] : undefined) || Boolean(vorschlag);
				teile.set(
					f.key,
					bleibt
						? { ...ohneGespraech(f, vorschlag), referenz: null, nr: ersteSeite(lage.z, lage.loesung) }
						: null,
				);
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
	}, [auftragVon, lage, unverankert, waehle]);

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
				verlauf: [...alt.verlauf, nachricht('lehrkraft', inhalt.text)].slice(-MAX_NACHRICHTEN),
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

	/** Warum gerade nichts abgeschickt werden kann; `null`: es geht. */
	const sperreVon = (f: Faden) => {
		if (laeuftNoch(auftragVon(f))) {
			return 'Claude arbeitet gerade.';
		}
		if (gesperrtLimit) {
			return 'Das Nutzungslimit ist erreicht.';
		}
		return frei ? null : 'Das Blatt ist gerade gesperrt.';
	};

	const sendeAn = (key: string, inhalt: { text: string; aktion?: string }) => {
		const f = finde(key);
		if (f && inhalt.text.trim() && sperreVon(f) === null) {
			void sendeFaden(f, inhalt);
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
		if (!da && alle.length >= MAX_GESPRAECHE) {
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

	const einklappen = () => {
		setOffen(null);
		handlungen.current.zumBlatt();
	};

	/** × und „Neu beginnen“ (Entscheidung 37): Die Sitzung ist weg, ein offener Vorschlag und ein Lauf bleiben. */
	const beende = (key: string, weiter: boolean) => {
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
		if (weiter) {
			setFokus((n) => n + 1);
		} else {
			einklappen();
		}
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

	const merker = useMemo(
		() =>
			new Set(
				faeden.flatMap((f) =>
					f.nr !== null && MERKEN.has(standVon(f, auftragVon(f), vorschlagVon(f))) ? [f.nr] : [],
				),
			),
		[auftragVon, faeden, vorschlagVon],
	);

	// 117: an die Seite im Sichtfeld, ans ganze Blatt; Claude legt die Figur neben das, was dort ist.
	const schicke = (text: string): string | null => {
		const { faeden: alle, lage: l } = jetzt.current;
		const nr = seite();
		if (!l || nr === null || !zustand.verfuegbar) {
			return 'Claude ist hier nicht verfügbar.';
		}
		const da = alle.find((f) => f.nr === nr);
		const v = da ? vorschlagVon(da) : undefined;
		if (v && !v.konflikt) {
			return 'Erst den offenen Vorschlag annehmen oder verwerfen.';
		}
		if (!da && alle.length >= MAX_GESPRAECHE) {
			return VOLL;
		}
		const f = { ...(da ?? fadenAn(nr, l, null)), ganz: true };
		const grund = sperreVon(f);
		if (grund) {
			return grund;
		}
		setFaeden((alt) => (da ? alt.map((x) => (x.key === da.key ? f : x)) : [...alt, f]));
		setOffen(f.key);
		waehle(nr);
		void sendeFaden(f, { text });
		return null;
	};

	const eingeklappt = faeden
		.filter((f) => f.key !== offen && f.nr !== null)
		.map((f) => ({ f, auftrag: auftragVon(f), stand: standVon(f, auftragVon(f), vorschlagVon(f)) }))
		.filter((x) => x.stand !== 'ruhig');

	const steuerung: ClaudeSteuerung = { oeffne, schicke, merker };
	const belegt = faeden.length >= MAX_GESPRAECHE && !faeden.some((f) => f.nr === auswahl);
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
		lauf: laufVon(eingeklappt),
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
		schliesse: (key: string) => beende(key, false),
		neuBeginnen: (key: string) => beende(key, true),
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
		/** Die Palette schreibt ins Feld; abgeschickt wird von Hand. */
		fuelle: (text: string) => {
			const key = oeffne();
			if (key) {
				aendere(key, { entwurf: text });
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
			await handlungen.current.annimm(() =>
				sende(`${basis}/vorschlag/annehmen`, { gespraech }).catch((grund: unknown) =>
					aendere(key, { fehler: meldung(grund) }),
				),
			);
			await ladeVorschlaege().catch(() => undefined);
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
