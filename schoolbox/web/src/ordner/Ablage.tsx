import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';

import { sende } from '../api';
import { istMac } from '../bausteine/kuerzel';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { useZeigeMenue } from '../bausteine/menue-kontext';
import { Segment } from '../bausteine/Segment';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { Zustand } from '../bausteine/Zustand';
import { useTitel } from '../lib/titel';
import type { AuswahlStand } from './auswahl';
import { bereinige, KEINE, klicke } from './auswahl';
import type { ZeileAnsicht } from './darstellung';
import { Kachel, LISTEN_RASTER, objekteText, Zeile } from './darstellung';
import { useAblage } from './kontext';
import { findeOrdner, kinder, ordnerObjekt, ortName, pfadVon, suche, WURZEL_NAME, zuletzt } from './objekte';
import { Ordnerleiste } from './Ordnerleiste';
import { PapierkorbSeite } from './PapierkorbSeite';
import { Pfad } from './Pfad';
import {
	leseDarstellung,
	leseMenge,
	leseSortierung,
	naechsteSortierung,
	schreibeDarstellung,
	schreibeMenge,
	schreibeSortierung,
	SORTIER_NAME,
} from './sortierung';
import { Suchleiste } from './Suchleiste';
import type { AblageOrdner, DefektEintrag, Darstellung, Objekt, Seite, Sortierung } from './typen';
import { seiteVon, useBefehle } from './useBefehle';
import { useZiehen } from './ziehen';

const STELLE = 'schoolbox.ordner-stelle:';
const LEISTE = 'schoolbox.ordner-seitenleiste';
const UMBENENNEN_MS = 500;
const NAME_LEISTE = 'Weitere Aktionen';

const einObjekt = (n: number) => objekteText(n).replace('Ein Objekt', '1 Objekt');

const SPALTEN: { feld: 'name' | 'geaendert' | 'art' | null; titel: string; klasse?: string }[] = [
	{ feld: 'name', titel: 'Name' },
	{ feld: 'geaendert', titel: 'Geändert' },
	{ feld: 'art', titel: 'Art' },
	{ feld: null, titel: 'Fach', klasse: '@max-3xl:hidden' },
	{ feld: null, titel: 'Klasse', klasse: '@max-4xl:hidden' },
	{ feld: null, titel: 'Format', klasse: '@max-4xl:hidden' },
	{ feld: null, titel: 'Seiten', klasse: '@max-4xl:hidden' },
];

const useSeite = (): Seite => {
	const ordner = useMatch('/o/:ordner');
	const letztes = useMatch('/zuletzt');
	const gesucht = useMatch('/suche');
	const korb = useMatch('/papierkorb');
	if (ordner) {
		return { art: 'ordner', ordner: ordner.params.ordner ?? null };
	}
	if (letztes) {
		return { art: 'zuletzt' };
	}
	if (gesucht) {
		return { art: 'suche' };
	}
	return korb ? { art: 'papierkorb' } : { art: 'ordner', ordner: null };
};

const Defekte = ({ defekt }: { defekt: DefektEintrag[] }) => (
	<aside className="mt-6 rounded-2xl border border-entwurf bg-flaeche p-5" data-defekt>
		<h2 className="text-lg">
			{defekt.length === 1 ? 'Ein Ordner lässt sich gerade nicht öffnen' : 'Einige Ordner lassen sich gerade nicht öffnen'}
		</h2>
		<p className="mt-1 text-leise">Dein anderes Material ist davon nicht betroffen. Sag Claude Bescheid, dann wird das repariert:</p>
		<ul className="mt-2 list-disc pl-6">
			{defekt.map(({ fehler, id }) => (
				<li key={id}>
					<strong>{id}</strong>
					<span className="text-leise">{` (${fehler})`}</span>
				</li>
			))}
		</ul>
	</aside>
);

/** Die Ablage: Baum, Pfad, Kacheln oder Liste. Bleibt beim Navigieren stehen, nur der Inhalt wechselt. */
export const Ablage = () => {
	const { benennen, fehler, merkzettel, neuLaden, setBenennen, stand } = useAblage();
	const seite = useSeite();
	const navigate = useNavigate();
	const { key, pathname, search, state } = useLocation();
	const [parameter] = useSearchParams();
	const zeigeMenue = useZeigeMenue();
	const [darstellung, setDarstellungRoh] = useState<Darstellung>(() => leseDarstellung());
	const [offenBaum, setOffenBaum] = useState(() => leseMenge('ordner-baum-offen'));
	const [offenListe, setOffenListe] = useState(() => leseMenge('ordner-liste-offen'));
	const [sortierStand, setSortierStand] = useState(0);
	const [auswahl, setAuswahl] = useState<AuswahlStand>(KEINE);
	const [haken, setHaken] = useState(false);
	const [leisteAn, setLeisteAn] = useState(() => localStorage.getItem(LEISTE) !== 'aus');
	const inhalt = useRef<HTMLDivElement>(null);

	const hier: AblageOrdner | null = stand && seite.art === 'ordner' ? findeOrdner(stand, seite.ordner) : null;
	const ordnerFehlt = stand !== null && seite.art === 'ordner' && seite.ordner !== null && hier === null;
	// sortierStand: Die Sortierung liegt im localStorage, ein Wechsel soll neu rechnen.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const sortierung = useMemo<Sortierung>(() => leseSortierung(hier), [hier, sortierStand]);
	useTitel(
		seite.art === 'ordner'
			? (hier?.name ?? undefined)
			: { zuletzt: 'Zuletzt geändert', suche: 'Suche', papierkorb: 'Papierkorb' }[seite.art],
	);

	const klappeBaum = useCallback((id: string, an?: boolean) => {
		setOffenBaum((alt) => {
			const neu = new Set(alt);
			if (an ?? !alt.has(id)) {
				neu.add(id);
			} else {
				neu.delete(id);
			}
			schreibeMenge('ordner-baum-offen', neu);
			return neu;
		});
	}, []);
	const klappeListe = useCallback((id: string, an?: boolean) => {
		setOffenListe((alt) => {
			const neu = new Set(alt);
			if (an ?? !alt.has(id)) {
				neu.add(id);
			} else {
				neu.delete(id);
			}
			schreibeMenge('ordner-liste-offen', neu);
			return neu;
		});
	}, []);
	/** ⌥-Klick auf das Dreieck klappt alles darunter. */
	const klappeAlle = useCallback(
		(klappe: (id: string, an?: boolean) => void, offen: ReadonlySet<string>, id: string) => {
			const an = !offen.has(id);
			const lauf = (x: string) => {
				klappe(x, an);
				for (const k of stand?.ordner ?? []) {
					if (k.eltern === x) {
						lauf(k.id);
					}
				}
			};
			lauf(id);
		},
		[stand],
	);

	// Beim Navigieren klappen die Vorfahren auf.
	const pfad = useMemo(() => (stand && hier ? pfadVon(stand, hier.id) : []), [hier, stand]);
	const pfadSchluessel = pfad.map((o) => o.id).join('/');
	useEffect(() => {
		for (const o of pfad.slice(0, -1)) {
			klappeBaum(o.id, true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel des Ordners
	}, [pfadSchluessel]);

	const zeilen = useMemo<{ objekt: Objekt; tiefe: number }[]>(() => {
		if (!stand) {
			return [];
		}
		if (seite.art === 'zuletzt') {
			return zuletzt(stand).map((objekt) => ({ objekt, tiefe: 0 }));
		}
		if (seite.art === 'suche') {
			return suche(stand, {
				q: parameter.get('q') ?? '',
				fach: parameter.get('fach'),
				klasse: parameter.get('klasse'),
				art: parameter.get('art'),
				in: parameter.get('in'),
			}).map((objekt) => ({ objekt, tiefe: 0 }));
		}
		if (seite.art !== 'ordner') {
			return [];
		}
		const flach: { objekt: Objekt; tiefe: number }[] = [];
		const lauf = (id: string | null, s: Sortierung, tiefe: number) => {
			for (const objekt of kinder(stand, id, s)) {
				flach.push({ objekt, tiefe });
				if (darstellung === 'liste' && objekt.istOrdner && offenListe.has(objekt.ordner.id)) {
					lauf(objekt.ordner.id, leseSortierung(objekt.ordner), tiefe + 1);
				}
			}
		};
		lauf(seite.ordner, sortierung, 0);
		// Ein frischer Ordner sortiert sich erst ein, wenn er seinen Namen hat.
		const frisch = benennen?.neu ? flach.findIndex((z) => z.objekt.schluessel === benennen.schluessel) : -1;
		const eintrag = flach[frisch];
		if (eintrag && eintrag.tiefe === 0) {
			flach.splice(frisch, 1);
			const letzterOrdner = flach.findLastIndex((z) => z.tiefe === 0 && z.objekt.istOrdner);
			flach.splice(letzterOrdner + 1, 0, eintrag);
		}
		return flach;
	}, [benennen, darstellung, offenListe, parameter, seite, sortierung, stand]);

	const objekte = useMemo(() => zeilen.map((z) => z.objekt), [zeilen]);
	const reihenfolge = useMemo(() => objekte.map((o) => o.schluessel), [objekte]);
	useEffect(() => setAuswahl((a) => bereinige(a, reihenfolge)), [reihenfolge]);
	// Ziehen und Lasso starten auf der Fläche: Dabei darf nirgends Text markiert werden.
	useEffect(() => {
		const beimMarkieren = (e: Event) => {
			const ziel = e.target instanceof Element ? e.target : (e.target as Node).parentElement;
			if (ziel?.closest('[data-flaeche]') && !ziel.closest('input, textarea')) {
				e.preventDefault();
			}
		};
		document.addEventListener('selectstart', beimMarkieren);
		return () => document.removeEventListener('selectstart', beimMarkieren);
	}, []);

	// Auswahl und Scrollstand je Verlaufseintrag: Zurück führt an dieselbe Stelle.
	const kommend = useRef<string[] | null>(null);
	useEffect(() => {
		const gemerkt = sessionStorage.getItem(`${STELLE}${pathname}${search}`);
		const { gewaehlt = [], scroll = 0 } = (gemerkt ? JSON.parse(gemerkt) : {}) as { gewaehlt?: string[]; scroll?: number };
		setAuswahl({ gewaehlt, anker: gewaehlt[0] ?? null });
		setHaken(false);
		window.scrollTo(0, scroll);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel des Verlaufseintrags
	}, [key]);
	// Was gerade entstand oder woher man kam, wird gewählt und sichtbar, sobald es da ist.
	useEffect(() => {
		const liste = kommend.current;
		if (liste?.some((s) => reihenfolge.includes(s))) {
			kommend.current = null;
			const da = liste.filter((s) => reihenfolge.includes(s));
			setAuswahl({ gewaehlt: da, anker: da[0] ?? null });
			requestAnimationFrame(() =>
				document.querySelector(`[data-objekt="${da[0] ?? ''}"]`)?.scrollIntoView({ block: 'nearest' }),
			);
		}
	}, [key, reihenfolge]);
	const stelle = useRef({ auswahl, pathname, search });
	stelle.current = { auswahl, pathname, search };
	const merkeStelle = useCallback(() => {
		const { auswahl: a, pathname: p, search: s } = stelle.current;
		sessionStorage.setItem(`${STELLE}${p}${s}`, JSON.stringify({ gewaehlt: a.gewaehlt, scroll: window.scrollY }));
	}, []);
	useEffect(() => {
		window.addEventListener('scroll', merkeStelle, { passive: true });
		return () => window.removeEventListener('scroll', merkeStelle);
	}, [merkeStelle]);
	useEffect(merkeStelle, [auswahl, merkeStelle]);

	// Vorschauen: nur für das, was hier liegt, je Dokument einmal.
	const angefragt = useRef(new Set<string>());
	useEffect(() => {
		const fehlen = objekte
			.flatMap((o) => (o.istOrdner || o.dok.vorschau ? [] : [o.knoten]))
			.filter((k) => !angefragt.current.has(`${k.mappe}/${k.dok}`))
			.slice(0, 200);
		if (fehlen.length === 0) {
			return;
		}
		for (const k of fehlen) {
			angefragt.current.add(`${k.mappe}/${k.dok}`);
		}
		void sende('/api/ordner/vorschauen', { dokumente: fehlen }).catch(() => undefined);
	}, [objekte]);

	const setDarstellung = (wert: Darstellung) => {
		schreibeDarstellung(wert);
		setDarstellungRoh(wert);
	};
	const sortiere = (s: Sortierung) => {
		schreibeSortierung(hier?.id ?? null, s);
		setSortierStand((n) => n + 1);
	};
	const spalten = () => {
		const kacheln = [...(inhalt.current?.querySelectorAll<HTMLElement>('[data-objekt]') ?? [])];
		const oben = kacheln[0]?.offsetTop;
		return Math.max(1, kacheln.filter((k) => k.offsetTop === oben).length);
	};

	const befehle = useBefehle({
		stand,
		seite,
		hier,
		objekte,
		auswahl,
		setAuswahl,
		waehleKommend: (s) => {
			kommend.current = s;
		},
		darstellung,
		setDarstellung,
		sortierung,
		sortiere,
		offenListe,
		klappeListe,
		oeffneBaum: (id) => klappeBaum(id, true),
		seitenleiste: () =>
			setLeisteAn((an) => {
				localStorage.setItem(LEISTE, an ? 'aus' : 'an');
				return !an;
			}),
		spalten,
		sucheFokus: () => document.querySelector<HTMLInputElement>('[data-suchfeld]')?.focus(),
	});
	const { fuehreAus, gewaehlteObjekte, lageFuer, menueFuer, zeiger } = befehle;

	// Aus der Palette: „Neuer Ordner“.
	useEffect(() => {
		if ((state as { neuerOrdner?: boolean } | null)?.neuerOrdner && stand) {
			void navigate(`${pathname}${search}`, { replace: true, state: null });
			fuehreAus('neuerOrdner', lageFuer([]));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- nur für diesen einen Auftrag
	}, [state, stand]);

	// Maus, Finger und Klick. Maßgeblich ist der Zeigertyp dieses Ereignisses, nicht das Gerät (Ticket, iPad).
	const zeigertyp = useRef('mouse');
	const umbenennenUhr = useRef<number | null>(null);
	const stoppeUhr = () => {
		if (umbenennenUhr.current !== null) {
			window.clearTimeout(umbenennenUhr.current);
			umbenennenUhr.current = null;
		}
	};
	const objektAn = (ziel: EventTarget | null) => (ziel as HTMLElement | null)?.closest<HTMLElement>('[data-objekt]')?.dataset.objekt;
	const objektZu = (s: string | undefined) => objekte.find((o) => o.schluessel === s);
	const zeigeFuer = (s: string | undefined, punkt: { x: number; y: number }) => {
		const o = objektZu(s);
		if (!o) {
			setAuswahl(KEINE);
			zeigeMenue(punkt, menueFuer([]));
			return;
		}
		if (auswahl.gewaehlt.includes(o.schluessel)) {
			zeigeMenue(punkt, menueFuer(gewaehlteObjekte));
			return;
		}
		setAuswahl({ gewaehlt: [o.schluessel], anker: o.schluessel });
		zeigeMenue(punkt, menueFuer([o]));
	};
	const klick = (e: ReactMouseEvent) => {
		if ((e.target as HTMLElement).closest('[data-namensfeld]')) {
			return;
		}
		// ⌃-Klick ist am Mac ein Rechtsklick, das Kontextmenü kommt von selbst.
		if (e.ctrlKey && istMac()) {
			return;
		}
		stoppeUhr();
		const s = objektAn(e.target);
		if (!s) {
			if (!haken) {
				setAuswahl(KEINE);
			}
			return;
		}
		zeiger.current = s;
		if (haken) {
			setAuswahl((a) => klicke(a, s, { befehl: true, umschalt: false }, reihenfolge));
			return;
		}
		if (zeigertyp.current === 'touch') {
			const o = objektZu(s);
			if (o) {
				void navigate(seiteVon(o));
			}
			return;
		}
		const befehl = e.metaKey || (e.ctrlKey && !istMac());
		const schonEinzeln = auswahl.gewaehlt.length === 1 && auswahl.gewaehlt[0] === s;
		if (schonEinzeln && !befehl && !e.shiftKey && (e.target as HTMLElement).closest('[data-objekt-name]')) {
			umbenennenUhr.current = window.setTimeout(() => setBenennen({ schluessel: s, neu: false, wo: 'feld' }), UMBENENNEN_MS);
			return;
		}
		setAuswahl((a) => klicke(a, s, { befehl, umschalt: e.shiftKey }, reihenfolge));
	};
	const doppelklick = (e: ReactMouseEvent) => {
		stoppeUhr();
		const o = objektZu(objektAn(e.target));
		if (!o || haken) {
			return;
		}
		if (e.metaKey) {
			window.open(seiteVon(o), '_blank', 'noopener');
		} else {
			void navigate(seiteVon(o));
		}
	};
	const mittelklick = (e: ReactMouseEvent) => {
		const o = objektZu(objektAn(e.target));
		if (e.button === 1 && o) {
			e.preventDefault();
			window.open(seiteVon(o), '_blank', 'noopener');
		}
	};
	const ziehen = useZiehen({
		objekteZuZiehen: (s) => {
			const o = objektZu(s);
			if (!o) {
				return [];
			}
			return auswahl.gewaehlt.includes(s) ? gewaehlteObjekte : [o];
		},
		klappeListe,
		klappeBaum,
		reihenfolge,
		auswahl,
		setAuswahl,
		inhalt,
		aktiv: !haken,
	});
	const zeigerUnten = (e: ReactPointerEvent) => {
		zeigertyp.current = e.pointerType;
		ziehen.unten(e);
	};

	if (!stand) {
		return fehler ? (
			<Zustand symbol="achtung" titel="Das hat gerade nicht geklappt">
				<p className="text-leise">{fehler}</p>
				<Knopf onClick={neuLaden}>Noch einmal versuchen</Knopf>
			</Zustand>
		) : null;
	}

	const fremd = seite.art !== 'ordner';
	const blass = new Set(
		(merkzettel?.modus === 'ausschneiden' ? merkzettel.knoten : []).map((k) => ('ordner' in k ? k.ordner : `${k.mappe}/${k.dok}`)),
	);
	const ortVon = (o: Objekt) => (fremd ? ortName(stand, o.istOrdner ? o.ordner.eltern : o.dok.ordner) : undefined);
	const ansicht = ({ objekt, tiefe }: { objekt: Objekt; tiefe: number }) => {
		const ort = ortVon(objekt);
		return {
			objekt,
			gewaehlt: auswahl.gewaehlt.includes(objekt.schluessel),
			blass: blass.has(objekt.schluessel) || ziehen.gezogen.has(objekt.schluessel),
			benennt: benennen?.schluessel === objekt.schluessel && benennen.wo === 'feld',
			menue: (e: ReactMouseEvent) => {
				const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
				zeigeFuer(objekt.schluessel, { x: r.left, y: r.bottom });
			},
			haken,
			tiefe,
			...(ort === undefined ? {} : { ort }),
		};
	};
	const lageJetzt = lageFuer(gewaehlteObjekte);
	const [einziges] = gewaehlteObjekte;
	const dieseLeiste = (id: string) => () => fuehreAus(id, lageJetzt);
	const leeresFach = seite.art === 'ordner' && objekte.length === 0;
	const ziehtHier = seite.art === 'ordner';
	const koepfe = SPALTEN.map((s) => (s.titel === 'Art' && fremd ? { ...s, titel: 'Ort', feld: null } : s));

	return (
		<div
			className="-mx-4 -mt-3 flex min-h-[calc(100dvh-var(--kopf,0px))]"
			style={{ marginBottom: 'calc(-1 * max(4rem, var(--chat-platz, 0px)))' }}
			data-ablage
		>
			{leisteAn && (
				<Ordnerleiste
					stand={stand}
					seite={seite}
					offen={offenBaum}
					klappe={(id, alles) => (alles ? klappeAlle(klappeBaum, offenBaum, id) : klappeBaum(id))}
					gehe={(p) => void navigate(p)}
					kontext={(e, ordner) => {
						e.preventDefault();
						const punkt = { x: e.clientX, y: e.clientY };
						if (ordner) {
							zeigeMenue(punkt, menueFuer([ordnerObjekt(stand, ordner)], 'baum'));
						} else {
							zeigeMenue(punkt, menueFuer([], 'baum', null));
						}
					}}
				/>
			)}
			<div className="@container flex min-w-0 flex-1 flex-col" data-ablage-inhalt>
				<div className="sticky top-[var(--kopf,0px)] z-leiste flex h-[var(--hoehe-werkzeug)] flex-none items-center gap-1.5 border-b border-rand bg-flaeche px-2" data-werkzeugleiste>
					<SymbolKnopf
						symbol={leisteAn ? 'leisteLinks' : 'leisteRechts'}
						beschriftung={leisteAn ? 'Seitenleiste ausblenden' : 'Seitenleiste einblenden'}
						kuerzel="⌥S"
						onClick={() => fuehreAus('seitenleiste', lageJetzt)}
					/>
					<SymbolKnopf symbol="links" beschriftung="Zurück" onClick={() => void navigate(-1)} />
					<SymbolKnopf symbol="rechts" beschriftung="Vor" onClick={() => void navigate(1)} />
					{seite.art === 'ordner' ? (
						<Pfad pfad={pfad} gehe={(p) => void navigate(p)} />
					) : (
						<h1 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
							{{ zuletzt: 'Zuletzt geändert', suche: 'Suche', papierkorb: 'Papierkorb' }[seite.art]}
						</h1>
					)}
					{seite.art !== 'papierkorb' && (
						<>
							{/* Häufige Aktionen der Auswahl: gleichwertig zum Kachelknopf von früher. */}
							{einziges && !einziges.istOrdner && gewaehlteObjekte.length === 1 && lageJetzt.art === 'material' && (
								<>
									{einziges.dok.meta.format === 'folie' ? (
										<Knopf art="zweit" aria-label="Präsentieren" onClick={dieseLeiste('praesentieren')}>
											<Symbol name="praesentieren" />
											<span className="@max-5xl:hidden">Präsentieren</span>
										</Knopf>
									) : (
										<Knopf art="zweit" aria-label="Bearbeiten" onClick={dieseLeiste('bearbeiten')}>
											<Symbol name="stift" />
											<span className="@max-5xl:hidden">Bearbeiten</span>
										</Knopf>
									)}
								</>
							)}
							{gewaehlteObjekte.length > 0 && befehle.pdfMenue(lageJetzt).length > 0 && (
								<Menue
									name="PDF"
									beschriftung={
										<>
											<Symbol name="herunterladen" />
											<span className="@max-5xl:hidden">
												{gewaehlteObjekte.length > 1 ? 'Als PDF' : einziges?.istOrdner ? 'Alles als PDF' : 'PDF'}
											</span>
										</>
									}
									art="zweit"
									eintraege={befehle.pdfMenue(lageJetzt)}
								/>
							)}
							{gewaehlteObjekte.length === 1 && (
								<Knopf art="zweit" aria-label="Teilen" onClick={dieseLeiste('teilen')}>
									<Symbol name="teilen" />
									<span className="@max-5xl:hidden">Teilen</span>
								</Knopf>
							)}
							{gewaehlteObjekte.length > 1 && (
								<Knopf art="zweit" aria-label="Bewegen nach …" onClick={dieseLeiste('bewegenNach')}>
									<Symbol name="bewegen" />
									<span className="@max-5xl:hidden">Bewegen nach …</span>
								</Knopf>
							)}
							<Segment
								beschriftung="Darstellung"
								wert={darstellung}
								waehle={setDarstellung}
								werte={[
									{ wert: 'kacheln', titel: 'Kacheln' },
									{ wert: 'liste', titel: 'Liste' },
								]}
							/>
							{seite.art === 'ordner' && (
								<Menue
									name="Sortieren"
									beschriftung={
										<>
											<Symbol name="sortieren" />
											<span className="@max-5xl:hidden">Sortieren</span>
										</>
									}
									art="leise"
									eintraege={(['name', 'geaendert', 'erstellt', 'art'] as const).map((feld) => ({
										titel: SORTIER_NAME[feld],
										aktiv: sortierung.feld === feld,
										waehle: () => sortiere(naechsteSortierung(sortierung, feld)),
									}))}
								/>
							)}
							{seite.art === 'ordner' && (
								<Knopf
									art="leise"
									aria-label="Filter"
									onClick={() => void navigate(`/suche?${hier ? `in=${hier.id}&von=${hier.id}` : ''}`)}
								>
									<Symbol name="filter" />
									<span className="@max-5xl:hidden">Filter</span>
								</Knopf>
							)}
							<span className="nur-finger">
								<Knopf
									art={haken ? 'haupt' : 'leise'}
									aria-label={haken ? 'Fertig' : 'Auswählen'}
									data-auswaehlen
									onClick={() => {
										setHaken(!haken);
										if (haken) {
											setAuswahl(KEINE);
										}
									}}
								>
									<Symbol name={haken ? 'haken' : 'auswaehlen'} />
									<span className="@max-5xl:hidden">{haken ? 'Fertig' : 'Auswählen'}</span>
								</Knopf>
							</span>
							<Menue
								name={NAME_LEISTE}
								rechtsbuendig
								eintraege={menueFuer(gewaehlteObjekte)}
								ausloeser={
									<Knopf art="leise" className="size-knopf px-0">
										<Symbol name="mehr" />
									</Knopf>
								}
							/>
						</>
					)}
					{seite.art === 'ordner' && (
						<>
							<Knopf art="zweit" aria-label="Neuer Ordner" data-neuer-ordner onClick={dieseLeiste('neuerOrdner')}>
								<Symbol name="ordnerNeu" />
								<span className="@max-5xl:hidden">Neuer Ordner</span>
							</Knopf>
							<Knopf aria-label="Material anlegen" data-material-anlegen onClick={dieseLeiste('materialAnlegen')}>
								<Symbol name="plus" />
								<span className={gewaehlteObjekte.length > 0 ? '@max-6xl:hidden' : undefined}>Material anlegen</span>
							</Knopf>
						</>
					)}
				</div>
				{seite.art === 'suche' && <Suchleiste stand={stand} anzahl={objekte.length} />}
				<div
					ref={inhalt}
					className="relative flex-1 p-3"
					{...(seite.art === 'papierkorb' ? {} : { role: 'listbox', 'aria-multiselectable': true, 'aria-label': hier?.name ?? WURZEL_NAME })}
					{...(ziehtHier ? { 'data-ablage-ziel': hier?.id ?? 'wurzel', 'data-flaeche': true } : {})}
					onPointerDown={seite.art === 'papierkorb' ? undefined : zeigerUnten}
					onClick={seite.art === 'papierkorb' ? undefined : klick}
					onDoubleClick={seite.art === 'papierkorb' ? undefined : doppelklick}
					onAuxClick={seite.art === 'papierkorb' ? undefined : mittelklick}
					onContextMenu={
						seite.art === 'papierkorb'
							? undefined
							: (e) => {
									if ((e.target as HTMLElement).closest('[data-namensfeld]')) {
										return;
									}
									e.preventDefault();
									stoppeUhr();
									zeigeFuer(objektAn(e.target), { x: e.clientX, y: e.clientY });
								}
					}
				>
					{seite.art === 'papierkorb' ? (
						<PapierkorbSeite />
					) : ordnerFehlt ? (
						<Zustand symbol="suche" titel="Diesen Ordner gibt es nicht mehr">
							<div className="flex gap-2">
								<Knopf onClick={() => void navigate('/')}>Zu meinem Material</Knopf>
								<Knopf art="zweit" onClick={() => void navigate('/papierkorb')}>
									Im Papierkorb nachsehen
								</Knopf>
							</div>
						</Zustand>
					) : leeresFach ? (
						<Zustand symbol={hier ? 'ordner' : 'blatt'} titel={hier ? 'Dieser Ordner ist leer' : 'Noch kein Material'}>
							{!hier && (
								<>
									<p className="text-lg">Schreib Claude, was du brauchst, zum Beispiel:</p>
									<p className="rounded-2xl bg-flaeche px-6 py-4 text-lg shadow-2">„Ich brauche ein Arbeitsblatt zur Uhrzeit für Klasse 2.“</p>
									<p className="text-leise">Sobald Claude etwas angelegt hat, erscheint es hier von selbst.</p>
								</>
							)}
							<div className="flex gap-2">
								<Knopf art="zweit" onClick={dieseLeiste('neuerOrdner')}>
									<Symbol name="ordnerNeu" />
									Neuer Ordner
								</Knopf>
								<Knopf onClick={dieseLeiste('materialAnlegen')}>
									<Symbol name="plus" />
									Material anlegen
								</Knopf>
							</div>
						</Zustand>
					) : objekte.length === 0 ? (
						seite.art === 'suche' ? (
							<Zustand symbol="suche" titel="Dazu habe ich nichts gefunden">
								<div className="flex gap-2">
									{parameter.has('in') && (
										<Knopf
											onClick={() => {
												const neu = new URLSearchParams(parameter);
												neu.delete('in');
												void navigate(`/suche?${neu.toString()}`, { replace: true });
											}}
										>
											Überall suchen
										</Knopf>
									)}
									{['fach', 'klasse', 'art'].some((n) => parameter.has(n)) && (
										<Knopf
											art="zweit"
											onClick={() => {
												const neu = new URLSearchParams(parameter);
												['fach', 'klasse', 'art'].forEach((n) => neu.delete(n));
												void navigate(`/suche?${neu.toString()}`, { replace: true });
											}}
										>
											Filter zurücksetzen
										</Knopf>
									)}
								</div>
							</Zustand>
						) : (
							<Zustand symbol="uhr" titel="Noch nichts geändert" />
						)
					) : darstellung === 'kacheln' ? (
						<ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
							{zeilen.map((z) => (
								<Kachel key={z.objekt.schluessel} {...ansicht(z)} />
							))}
						</ul>
					) : (
						<div>
							<div className={`${LISTEN_RASTER} sticky top-[calc(var(--kopf,0px)+var(--hoehe-werkzeug))] z-ueberlagerung h-6 items-center border-b border-rand bg-flaeche px-1 text-xs font-medium text-leise`}>
								{koepfe.map(({ feld, klasse, titel }) =>
									feld && seite.art === 'ordner' ? (
										<button
											key={titel}
											type="button"
											data-spalte={feld}
											className={`flex items-center gap-1 text-left hover:text-tinte ${klasse ?? ''}`}
											onPointerDown={(e) => e.stopPropagation()}
											onClick={(e) => {
												e.stopPropagation();
												sortiere(naechsteSortierung(sortierung, feld));
											}}
										>
											{titel}
											{sortierung.feld === feld && <Symbol name={sortierung.auf ? 'hoch' : 'runter'} className="size-3" />}
										</button>
									) : (
										<span key={titel} className={klasse}>
											{titel}
										</span>
									),
								)}
							</div>
							{zeilen.map((z) => {
								const { objekt } = z;
								const a: ZeileAnsicht = {
									...ansicht(z),
									offen: objekt.istOrdner && offenListe.has(objekt.ordner.id),
									klappe:
										objekt.istOrdner && seite.art === 'ordner'
											? (alle) => (alle ? klappeAlle(klappeListe, offenListe, objekt.ordner.id) : klappeListe(objekt.ordner.id))
											: null,
								};
								return <Zeile key={objekt.schluessel} {...a} />;
							})}
						</div>
					)}
					{ziehen.lasso}
					{seite.art === 'ordner' && seite.ordner === null && stand.defekt.length > 0 && <Defekte defekt={stand.defekt} />}
				</div>
				{seite.art !== 'papierkorb' && (
					<div
						className="sticky flex h-6 flex-none items-center border-t border-rand bg-flaeche px-3 text-xs text-leise"
						style={{ bottom: 'var(--chat-platz, 0px)' }}
						aria-live="polite"
						data-statuszeile
					>
						{ziehen.status ??
							(auswahl.gewaehlt.length > 0
								? `${auswahl.gewaehlt.length} von ${einObjekt(objekte.length)} ausgewählt`
								: einObjekt(objekte.length))}
					</div>
				)}
			</div>
			{befehle.dialoge}
		</div>
	);
};
