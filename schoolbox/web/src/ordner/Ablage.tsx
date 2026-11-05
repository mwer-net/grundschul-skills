import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';

import { sende } from '../api';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
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
import { findeOrdner, kinder, ortName, pfadVon, suche, WURZEL_NAME, zuletzt } from './objekte';
import { Ordnerleiste } from './Ordnerleiste';
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
import type { AblageOrdner, Darstellung, Objekt, Seite, Sortierung } from './typen';

const STELLE = 'schoolbox.ordner-stelle:';

const SPALTEN: { feld: 'name' | 'geaendert' | 'art' | null; titel: string; klasse?: string }[] = [
	{ feld: 'name', titel: 'Name' },
	{ feld: 'geaendert', titel: 'Geändert' },
	{ feld: 'art', titel: 'Art' },
	{ feld: null, titel: 'Fach', klasse: 'max-@3xl:hidden' },
	{ feld: null, titel: 'Klasse', klasse: 'max-@4xl:hidden' },
	{ feld: null, titel: 'Format', klasse: 'max-@4xl:hidden' },
	{ feld: null, titel: 'Seiten', klasse: 'max-@4xl:hidden' },
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

/** Die Ablage: Baum, Pfad, Kacheln oder Liste. Bleibt beim Navigieren stehen, nur der Inhalt wechselt. */
export const Ablage = () => {
	const { benennen, fehler, merkzettel, neuLaden, stand } = useAblage();
	const seite = useSeite();
	const navigate = useNavigate();
	const { key, pathname, search } = useLocation();
	const [parameter] = useSearchParams();
	const [darstellung, setDarstellungRoh] = useState<Darstellung>(() => leseDarstellung());
	const [offenBaum, setOffenBaum] = useState(() => leseMenge('ordner-baum-offen'));
	const [offenListe, setOffenListe] = useState(() => leseMenge('ordner-liste-offen'));
	const [sortierStand, setSortierStand] = useState(0);
	const [auswahl, setAuswahl] = useState<AuswahlStand>(KEINE);
	const inhalt = useRef<HTMLDivElement>(null);

	const hier: AblageOrdner | null = stand && seite.art === 'ordner' ? findeOrdner(stand, seite.ordner) : null;
	const ordnerFehlt = stand !== null && seite.art === 'ordner' && seite.ordner !== null && hier === null;
	const sortierung = useMemo<Sortierung>(() => leseSortierung(hier), [hier, sortierStand]);
	useTitel(seite.art === 'ordner' ? (hier?.name ?? undefined) : seite.art === 'zuletzt' ? 'Zuletzt geändert' : 'Suche');

	const klappeBaum = useCallback((id: string) => {
		setOffenBaum((alt) => {
			const neu = new Set(alt);
			if (!neu.delete(id)) {
				neu.add(id);
			}
			schreibeMenge('ordner-baum-offen', neu);
			return neu;
		});
	}, []);
	const klappeListe = useCallback((id: string) => {
		setOffenListe((alt) => {
			const neu = new Set(alt);
			if (!neu.delete(id)) {
				neu.add(id);
			}
			schreibeMenge('ordner-liste-offen', neu);
			return neu;
		});
	}, []);

	// Beim Navigieren klappen die Vorfahren auf.
	const pfad = useMemo(() => (stand && hier ? pfadVon(stand, hier.id) : []), [hier, stand]);
	const pfadSchluessel = pfad.map((o) => o.id).join('/');
	useEffect(() => {
		if (pfad.length < 2) {
			return;
		}
		setOffenBaum((alt) => {
			const fehlen = pfad.slice(0, -1).filter((o) => !alt.has(o.id));
			if (fehlen.length === 0) {
				return alt;
			}
			const neu = new Set(alt);
			for (const o of fehlen) {
				neu.add(o.id);
			}
			schreibeMenge('ordner-baum-offen', neu);
			return neu;
		});
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
		lauf(seite.art === 'ordner' ? seite.ordner : null, sortierung, 0);
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

	const reihenfolge = useMemo(() => zeilen.map((z) => z.objekt.schluessel), [zeilen]);
	useEffect(() => setAuswahl((a) => bereinige(a, reihenfolge)), [reihenfolge]);

	// Auswahl und Scrollstand je Verlaufseintrag: Zurück führt an dieselbe Stelle.
	useEffect(() => {
		const gemerkt = sessionStorage.getItem(`${STELLE}${pathname}${search}`);
		const { gewaehlt = [], scroll = 0 } = (gemerkt ? JSON.parse(gemerkt) : {}) as { gewaehlt?: string[]; scroll?: number };
		setAuswahl({ gewaehlt, anker: gewaehlt[0] ?? null });
		window.scrollTo(0, scroll);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel des Verlaufseintrags
	}, [key]);
	const stelle = useRef({ auswahl, pathname, search });
	stelle.current = { auswahl, pathname, search };
	useEffect(() => {
		const merke = () => {
			const { auswahl: a, pathname: p, search: s } = stelle.current;
			sessionStorage.setItem(`${STELLE}${p}${s}`, JSON.stringify({ gewaehlt: a.gewaehlt, scroll: window.scrollY }));
		};
		window.addEventListener('scroll', merke, { passive: true });
		return () => window.removeEventListener('scroll', merke);
	}, []);
	useEffect(() => {
		const { pathname: p, search: s } = stelle.current;
		sessionStorage.setItem(`${STELLE}${p}${s}`, JSON.stringify({ gewaehlt: auswahl.gewaehlt, scroll: window.scrollY }));
	}, [auswahl]);

	// Vorschauen: nur für das, was hier liegt, je Dokument einmal.
	const angefragt = useRef(new Set<string>());
	useEffect(() => {
		const fehlen = zeilen
			.flatMap(({ objekt }) => (objekt.istOrdner || objekt.dok.vorschau ? [] : [objekt.knoten]))
			.filter((k) => !angefragt.current.has(`${k.mappe}/${k.dok}`))
			.slice(0, 200);
		if (fehlen.length === 0) {
			return;
		}
		for (const k of fehlen) {
			angefragt.current.add(`${k.mappe}/${k.dok}`);
		}
		void sende('/api/ordner/vorschauen', { dokumente: fehlen }).catch(() => undefined);
	}, [zeilen]);

	const setDarstellung = (wert: Darstellung) => {
		schreibeDarstellung(wert);
		setDarstellungRoh(wert);
	};
	const sortiere = (s: Sortierung) => {
		schreibeSortierung(hier?.id ?? null, s);
		setSortierStand((n) => n + 1);
	};

	const gewaehlt = new Set(auswahl.gewaehlt);
	const blass = new Set((merkzettel?.modus === 'ausschneiden' ? merkzettel.knoten : []).map((k) => ('ordner' in k ? k.ordner : `${k.mappe}/${k.dok}`)));

	const objektAn = (ziel: EventTarget | null) => (ziel as HTMLElement | null)?.closest<HTMLElement>('[data-objekt]')?.dataset.objekt;
	const klick = (e: ReactMouseEvent) => {
		const s = objektAn(e.target);
		if (!s) {
			setAuswahl(KEINE);
			return;
		}
		setAuswahl((a) => klicke(a, s, { befehl: e.metaKey, umschalt: e.shiftKey }, reihenfolge));
	};
	const doppelklick = (e: ReactMouseEvent) => {
		const s = objektAn(e.target);
		const o = zeilen.find((z) => z.objekt.schluessel === s)?.objekt;
		if (o) {
			void navigate(o.istOrdner ? `/o/${o.ordner.id}` : `/m/${o.dok.mappe}/${o.dok.id}`);
		}
	};

	if (!stand) {
		return fehler ? (
			<Zustand symbol="achtung" titel="Das hat gerade nicht geklappt">
				<p className="text-leise">{fehler}</p>
				<Knopf onClick={neuLaden}>Noch einmal versuchen</Knopf>
			</Zustand>
		) : null;
	}

	const ortVon = (o: Objekt) =>
		seite.art === 'ordner' ? undefined : ortName(stand, o.istOrdner ? o.ordner.eltern : o.dok.ordner);
	const ansicht = ({ objekt, tiefe }: { objekt: Objekt; tiefe: number }) => ({
		objekt,
		gewaehlt: gewaehlt.has(objekt.schluessel),
		blass: blass.has(objekt.schluessel),
		benennt: benennen?.schluessel === objekt.schluessel && benennen.wo === 'feld',
		menue: () => undefined,
		haken: false,
		tiefe,
		...(ortVon(objekt) === undefined ? {} : { ort: ortVon(objekt) as string }),
	});

	return (
		<div
			className="-mx-4 -mt-3 flex min-h-[calc(100dvh-var(--kopf,0px))]"
			style={{ marginBottom: 'calc(-1 * max(4rem, var(--chat-platz, 0px)))' }}
		>
			<Ordnerleiste
				stand={stand}
				seite={seite}
				offen={offenBaum}
				klappe={klappeBaum}
				gehe={(p) => void navigate(p)}
				kontext={(e) => e.preventDefault()}
			/>
			<div className="@container flex min-w-0 flex-1 flex-col">
				<div className="sticky top-[var(--kopf,0px)] z-leiste flex h-[var(--hoehe-werkzeug)] flex-none items-center gap-1.5 border-b border-rand bg-flaeche px-2">
					<SymbolKnopf symbol="links" beschriftung="Zurück" onClick={() => void navigate(-1)} />
					<SymbolKnopf symbol="rechts" beschriftung="Vor" onClick={() => void navigate(1)} />
					{seite.art === 'ordner' ? (
						<Pfad pfad={pfad} gehe={(p) => void navigate(p)} />
					) : (
						<h1 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
							{seite.art === 'zuletzt' ? 'Zuletzt geändert' : seite.art === 'suche' ? 'Suche' : 'Papierkorb'}
						</h1>
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
							beschriftung="Sortieren"
							art="leise"
							eintraege={(['name', 'geaendert', 'erstellt', 'art'] as const).map((feld) => ({
								titel: SORTIER_NAME[feld],
								aktiv: sortierung.feld === feld,
								waehle: () => sortiere(naechsteSortierung(sortierung, feld)),
							}))}
						/>
					)}
					<Knopf art="zweit" data-neuer-ordner>
						<Symbol name="ordnerNeu" />
						Neuer Ordner
					</Knopf>
					<Knopf data-material-anlegen>
						<Symbol name="plus" />
						Material anlegen
					</Knopf>
				</div>
				<div ref={inhalt} className="flex-1 p-3" role="listbox" aria-multiselectable aria-label={hier?.name ?? WURZEL_NAME} onClick={klick} onDoubleClick={doppelklick}>
					{ordnerFehlt ? (
						<Zustand symbol="suche" titel="Diesen Ordner gibt es nicht mehr">
							<p className="text-leise">Vielleicht liegt er im Papierkorb. Dort bleibt er 30 Tage.</p>
						</Zustand>
					) : zeilen.length === 0 ? (
						<Zustand symbol="ordner" titel={seite.art === 'ordner' && seite.ordner !== null ? 'Dieser Ordner ist leer' : 'Noch kein Material'} />
					) : darstellung === 'kacheln' ? (
						<ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
							{zeilen.map((z) => (
								<Kachel key={z.objekt.schluessel} {...ansicht(z)} />
							))}
						</ul>
					) : (
						<div>
							<div className={`${LISTEN_RASTER} sticky top-[calc(var(--kopf,0px)+var(--hoehe-werkzeug))] z-ueberlagerung h-6 items-center border-b border-rand bg-flaeche px-1 text-xs font-medium text-leise`}>
								{SPALTEN.map(({ feld, klasse, titel }) =>
									feld ? (
										<button
											key={titel}
											type="button"
											className={`flex items-center gap-1 text-left hover:text-tinte ${klasse ?? ''}`}
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
								const a: ZeileAnsicht = {
									...ansicht(z),
									offen: z.objekt.istOrdner && offenListe.has(z.objekt.ordner.id),
									klappe: z.objekt.istOrdner ? () => klappeListe((z.objekt.knoten as { ordner: string }).ordner) : null,
								};
								return <Zeile key={z.objekt.schluessel} {...a} />;
							})}
						</div>
					)}
				</div>
				<div
					className="sticky flex h-6 flex-none items-center border-t border-rand bg-flaeche px-3 text-xs text-leise"
					style={{ bottom: 'var(--chat-platz, 0px)' }}
					aria-live="polite"
					data-statuszeile
				>
					{auswahl.gewaehlt.length > 0
						? `${auswahl.gewaehlt.length} von ${objekteText(zeilen.length).replace('Ein Objekt', '1 Objekt')} ausgewählt`
						: objekteText(zeilen.length).replace('Ein Objekt', '1 Objekt')}
				</div>
			</div>
		</div>
	);
};
