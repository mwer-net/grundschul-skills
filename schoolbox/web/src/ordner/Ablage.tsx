import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';

import { sende } from '../api';
import { Knopf } from '../bausteine/Knopf';
import { istMac } from '../bausteine/kuerzel';
import { useZeigeMenue } from '../bausteine/menue-kontext';
import { Zustand } from '../bausteine/Zustand';
import { useTitel } from '../lib/titel';
import { AblageInhalt } from './AblageInhalt';
import type { AuswahlStand } from './auswahl';
import { bereinige, KEINE, klicke } from './auswahl';
import { useAblage } from './kontext';
import {
	findeOrdner,
	kinder,
	objekteZahl,
	ordnerObjekt,
	ortName,
	pfadVon,
	suche,
	vorneVon,
	WURZEL_NAME,
	zuletzt,
} from './objekte';
import { Ordnerleiste } from './Ordnerleiste';
import {
	leseDarstellung,
	leseMenge,
	leseSortierung,
	schreibeDarstellung,
	schreibeMenge,
	schreibeSortierung,
} from './sortierung';
import { Suchleiste } from './Suchleiste';
import type { AblageOrdner, Darstellung, DefektEintrag, Objekt, Seite, Sortierung } from './typen';
import { seiteVon, useBefehle } from './useBefehle';
import { Werkzeugleiste } from './Werkzeugleiste';
import { useZiehen } from './ziehen';

const STELLE = 'schoolbox.ordner-stelle:';
const LEISTE = 'schoolbox.ordner-seitenleiste';
const UMBENENNEN_MS = 500;

const SEITEN_TITEL = { zuletzt: 'Zuletzt geändert', suche: 'Suche', papierkorb: 'Papierkorb' };

const Statuszeile = ({ gesamt, gewaehlt, status }: { gesamt: number; gewaehlt: number; status: ReactNode }) => {
	const anzahlText = gewaehlt > 0 ? `${gewaehlt} von ${objekteZahl(gesamt)} ausgewählt` : objekteZahl(gesamt);
	return (
		<div
			className="sticky bottom-0 flex h-6 flex-none items-center border-t border-rand bg-flaeche px-3 text-xs text-leise"
			aria-live="polite"
			data-statuszeile
		>
			{status ?? anzahlText}
		</div>
	);
};

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
			{defekt.length === 1
				? 'Ein Ordner lässt sich gerade nicht öffnen'
				: 'Einige Ordner lassen sich gerade nicht öffnen'}
		</h2>
		<p className="mt-1 text-leise">
			Dein anderes Material ist davon nicht betroffen. Sag Claude Bescheid, dann wird das repariert:
		</p>
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
	const adresse = useLocation();
	const { key, pathname, search } = adresse;
	const auftrag = adresse.state as { neuerOrdner?: boolean } | null;
	const [parameter] = useSearchParams();
	const zeigeMenue = useZeigeMenue();
	const [darstellung, setDarstellungRoh] = useState<Darstellung>(() => leseDarstellung());
	const [offenBaum, setOffenBaum] = useState(() => leseMenge('ordner-baum-offen'));
	const [offenListe, setOffenListe] = useState(() => leseMenge('ordner-liste-offen'));
	const [gesetzt, setGesetzt] = useState<{ ordner: string | null; sortierung: Sortierung } | null>(null);
	const [auswahl, setAuswahl] = useState<AuswahlStand>(KEINE);
	const [haken, setHaken] = useState(false);
	const [leisteAn, setLeisteAn] = useState(() => localStorage.getItem(LEISTE) !== 'aus');
	const inhalt = useRef<HTMLDivElement>(null);

	const hier: AblageOrdner | null = stand && seite.art === 'ordner' ? findeOrdner(stand, seite.ordner) : null;
	const ordnerFehlt = stand !== null && seite.art === 'ordner' && seite.ordner !== null && hier === null;
	// Die Sortierung liegt im localStorage; was gerade gesetzt wurde, gilt ab sofort.
	const sortierung = useMemo<Sortierung>(
		() => (gesetzt && gesetzt.ordner === (hier?.id ?? null) ? gesetzt.sortierung : leseSortierung(hier)),
		[gesetzt, hier],
	);
	useTitel(seite.art === 'ordner' ? (hier?.name ?? undefined) : SEITEN_TITEL[seite.art]);

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
		for (const id of pfadSchluessel.split('/').slice(0, -1)) {
			klappeBaum(id, true);
		}
	}, [klappeBaum, pfadSchluessel]);

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
	// Was aus den Ordnerkacheln herausschaut, je Ordner in seiner eigenen Sortierung. Die Liste zeigt keins.
	const vorneJe = useMemo(() => {
		const je = new Map<string, readonly Objekt[]>();
		if (stand && darstellung === 'kacheln') {
			for (const o of objekte) {
				if (o.istOrdner) {
					je.set(o.ordner.id, vorneVon(stand, o.ordner.id, leseSortierung(o.ordner)));
				}
			}
		}
		return je;
	}, [darstellung, objekte, stand]);
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
		const { gewaehlt = [], scroll = 0 } = (gemerkt ? JSON.parse(gemerkt) : {}) as {
			gewaehlt?: string[];
			scroll?: number;
		};
		setAuswahl({ gewaehlt, anker: gewaehlt[0] ?? null });
		setHaken(false);
		window.scrollTo(0, scroll);
	}, [key, pathname, search]);
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

	// Vorschauen: für das, was hier liegt oder aus einem Ordner hier herausschaut, je Dokument einmal.
	const angefragt = useRef(new Set<string>());
	useEffect(() => {
		const fehlen = [...objekte, ...[...vorneJe.values()].flat()]
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
	}, [objekte, vorneJe]);

	const setDarstellung = (wert: Darstellung) => {
		schreibeDarstellung(wert);
		setDarstellungRoh(wert);
	};
	const sortiere = (s: Sortierung) => {
		schreibeSortierung(hier?.id ?? null, s);
		setGesetzt({ ordner: hier?.id ?? null, sortierung: s });
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
	const neuAusPalette = useRef(() => undefined as void);
	neuAusPalette.current = () => {
		void navigate(`${pathname}${search}`, { replace: true, state: null });
		fuehreAus('neuerOrdner', lageFuer([]));
	};
	const standDa = stand !== null;
	useEffect(() => {
		if (auftrag?.neuerOrdner && standDa) {
			neuAusPalette.current();
		}
	}, [auftrag, standDa]);

	// Maus, Finger und Klick. Maßgeblich ist der Zeigertyp dieses Ereignisses, nicht das Gerät (Ticket, iPad).
	const zeigertyp = useRef('mouse');
	const umbenennenUhr = useRef<number | null>(null);
	const stoppeUhr = () => {
		if (umbenennenUhr.current !== null) {
			window.clearTimeout(umbenennenUhr.current);
			umbenennenUhr.current = null;
		}
	};
	const objektAn = (ziel: EventTarget | null) =>
		(ziel as HTMLElement | null)?.closest<HTMLElement>('[data-objekt]')?.dataset.objekt;
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
			umbenennenUhr.current = window.setTimeout(
				() => setBenennen({ schluessel: s, neu: false, wo: 'feld' }),
				UMBENENNEN_MS,
			);
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
		inDenPapierkorb: (x) => fuehreAus('papierkorb', lageFuer(x)),
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
	const kontextMenue = (e: ReactMouseEvent) => {
		if ((e.target as HTMLElement).closest('[data-namensfeld]')) {
			return;
		}
		e.preventDefault();
		stoppeUhr();
		zeigeFuer(objektAn(e.target), { x: e.clientX, y: e.clientY });
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
		(merkzettel?.modus === 'ausschneiden' ? merkzettel.knoten : []).map((k) =>
			'ordner' in k ? k.ordner : `${k.mappe}/${k.dok}`,
		),
	);
	const ortVon = (o: Objekt) => (fremd ? ortName(stand, o.istOrdner ? o.ordner.eltern : o.dok.ordner) : undefined);
	const ansicht = ({ objekt, tiefe }: { objekt: Objekt; tiefe: number }) => {
		const ort = ortVon(objekt);
		const vorne = objekt.istOrdner ? vorneJe.get(objekt.ordner.id) : undefined;
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
			...(vorne === undefined ? {} : { vorne }),
		};
	};
	const dieseLeiste = (id: string) => () => fuehreAus(id, lageFuer(gewaehlteObjekte));
	const ziehtHier = seite.art === 'ordner';
	const flaeche = {
		'role': 'listbox',
		'data-ablage-liste': true,
		'aria-multiselectable': true,
		'aria-label': hier?.name ?? WURZEL_NAME,
		'onPointerDown': zeigerUnten,
		'onClick': klick,
		'onDoubleClick': doppelklick,
		'onAuxClick': mittelklick,
		'onContextMenu': kontextMenue,
	};

	return (
		<div className="-mx-4 -mt-3 -mb-16 flex min-h-[calc(100dvh-var(--kopf,0px))]" data-ablage>
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
					ziehen={ziehen.untenImBaum}
					blass={ziehen.gezogen}
				/>
			)}
			<div className="@container flex min-w-0 flex-1 flex-col" data-ablage-inhalt>
				<Werkzeugleiste
					befehle={befehle}
					darstellung={darstellung}
					setDarstellung={setDarstellung}
					haken={haken}
					setHaken={setHaken}
					setKeineAuswahl={() => setAuswahl(KEINE)}
					hier={hier}
					leisteAn={leisteAn}
					pfad={pfad}
					seite={seite}
					sortierung={sortierung}
					sortiere={sortiere}
				/>
				{seite.art === 'suche' && <Suchleiste stand={stand} anzahl={objekte.length} />}
				<div
					ref={inhalt}
					className="relative flex-1 p-3"
					{...(ziehtHier ? { 'data-ablage-ziel': hier?.id ?? 'wurzel', 'data-flaeche': true } : {})}
					{...(seite.art === 'papierkorb' ? {} : flaeche)}
				>
					<AblageInhalt
						ansicht={ansicht}
						darstellung={darstellung}
						dieseLeiste={dieseLeiste}
						hier={hier}
						klappeAlle={klappeAlle}
						klappeListe={klappeListe}
						objektZahl={objekte.length}
						offenListe={offenListe}
						ordnerFehlt={ordnerFehlt}
						seite={seite}
						sortierung={sortierung}
						sortiere={sortiere}
						zeilen={zeilen}
					/>
					{ziehen.lasso}
					{seite.art === 'ordner' && seite.ordner === null && stand.defekt.length > 0 && (
						<Defekte defekt={stand.defekt} />
					)}
				</div>
				{seite.art !== 'papierkorb' && (
					<Statuszeile status={ziehen.status} gewaehlt={auswahl.gewaehlt.length} gesamt={objekte.length} />
				)}
			</div>
			{befehle.dialoge}
		</div>
	);
};
