import { zerlege } from '@schoolbox/kern/src/quelltext';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { ApiFehler } from '../api';
import { lade, meldung } from '../api';
import { Chip } from '../bausteine/Chip';
import { useHinweis } from '../bausteine/hinweis';
import { klassen } from '../bausteine/klassen';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { Konfliktleiste, Speicheranzeige, Vorschauleiste } from '../editor/Anzeigen';
import { useBearbeitung } from '../editor/bearbeitung';
import { editorHtml, pfadZu } from '../editor/darstellung';
import { Leinwand } from '../editor/Leinwand';
import { AuswahlPanel } from '../editor/Panel';
import type { VersionEintrag } from '../editor/version';
import { Versionen } from '../editor/Versionen';
import { useEreignisse } from '../ereignisse';
import { useLaden } from '../lib/laden';
import { useTitel } from '../lib/titel';
import { dokumentSeite, inhaltAdresse, praesentationSeite } from '../lib/zugang';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { dokumentWahl, materialName } from '../pdf/wahl';
import type { DokumentEintrag, Mappe, MappenEintrag } from '../typen';

const ZOOM_STUFEN = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface Eigenschaften {
	mappe: string;
	dok: string;
}

/** Zugriff für die Browser-Tests, bis es Bedienelemente zum Ändern gibt (015 ff.). */
interface TestZugriff {
	quelle: () => string | null;
	aendere: (neu: string, beschreibung?: string) => void;
}

const SymbolKnopf = ({
	aktion,
	aus,
	name,
	symbol,
}: {
	name: string;
	symbol: SymbolName;
	aus: boolean;
	aktion: () => void;
}) => (
	<Knopf art="zweit" className="px-3" aria-label={name} title={name} disabled={aus} onClick={aktion}>
		<Symbol name={symbol} />
	</Knopf>
);

const Zoom = ({ setZoom, zoom }: { zoom: number; setZoom: (zoom: number) => void }) => {
	const stufe = ZOOM_STUFEN.indexOf(zoom);
	return (
		<div className="mb-2 flex items-center justify-end gap-1" role="group" aria-label="Größe">
			<SymbolKnopf
				name="Kleiner"
				symbol="minus"
				aus={stufe <= 0}
				aktion={() => setZoom(ZOOM_STUFEN[stufe - 1] ?? zoom)}
			/>
			<button
				type="button"
				className="min-h-12 min-w-16 rounded-xl px-2 font-bold text-leise hover:bg-brand-50"
				title="Auf die Breite einpassen"
				onClick={() => setZoom(1)}
			>
				{`${Math.round(zoom * 100)} %`}
			</button>
			<SymbolKnopf
				name="Größer"
				symbol="plus"
				aus={stufe >= ZOOM_STUFEN.length - 1}
				aktion={() => setZoom(ZOOM_STUFEN[stufe + 1] ?? zoom)}
			/>
		</div>
	);
};

interface KopfEigenschaften {
	titel: string;
	stand: ReactNode;
	verlassen: () => void;
	kannZurueck: boolean;
	kannVor: boolean;
	zurueck: () => void;
	vor: () => void;
	children: ReactNode;
}

const Kopfleiste = ({ children, kannVor, kannZurueck, stand, titel, verlassen, vor, zurueck }: KopfEigenschaften) => (
	<header className="z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rand bg-white px-6 py-3 max-lg:px-4">
		<Knopf art="leise" className="-ml-3 px-3" onClick={verlassen}>
			<Symbol name="zurueck" />
			Zurück
		</Knopf>
		<div className="min-w-0 flex-1">
			<h1 className="truncate text-xl">{titel}</h1>
			{stand}
		</div>
		<div className="flex gap-2">
			<SymbolKnopf name="Rückgängig (⌘Z)" symbol="rueckgaengig" aus={!kannZurueck} aktion={zurueck} />
			<SymbolKnopf name="Wiederholen (⇧⌘Z)" symbol="wiederholen" aus={!kannVor} aktion={vor} />
		</div>
		{children}
	</header>
);

const istEingabe = (ziel: EventTarget | null) =>
	ziel instanceof HTMLElement && (ziel.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ziel.tagName));

const Fehlt = ({ fehler }: { fehler: ApiFehler | null }) => (
	<Zustand symbol="suche" titel="Dieses Dokument gibt es nicht mehr">
		<p className="text-leise">
			{fehler && fehler.status !== 404 ? fehler.message : 'Vielleicht wurde es gelöscht.'}
		</p>
		<KnopfLink to="/">Zu meinen Mappen</KnopfLink>
	</Zustand>
);

const Bearbeitung = ({ dokument, mappe: mappenDaten }: { mappe: Mappe; dokument: DokumentEintrag }) => {
	const { id: dok, meta } = dokument;
	const mappe = mappenDaten.id;
	const zugang = useMemo(() => ({ mappe, token: null }), [mappe]);
	const navigate = useNavigate();
	const zeige = useHinweis();
	const [suche, setSuche] = useSearchParams();
	const b = useBearbeitung(mappe, dok);
	const { alles, stand } = b.speicher;
	const [auswahl, setAuswahl] = useState<number | null>(null);
	const [doc, setDoc] = useState<Document | null>(null);
	const [panel, setPanel] = useState<'auswahl' | 'versionen'>('auswahl');
	const [vorschau, setVorschau] = useState<{ version: VersionEintrag; quelle: string } | null>(null);
	const [zoom, setZoom] = useState(1);
	const versionen = useLaden<{ versionen: VersionEintrag[] }>(`${b.adresse}/versionen`);
	const { neuLaden: versionenNeu } = versionen;

	useTitel(`${meta.titel} bearbeiten`);
	const loesung = Boolean(meta.hatLoesung) && suche.get('fassung') === 'loesung';

	const anzeige = vorschau?.quelle ?? b.verlauf?.quelle ?? null;
	const html = useMemo(
		() =>
			anzeige === null
				? null
				: editorHtml(zerlege(anzeige), { basis: `/ansicht/${mappe}/dokumente/${dok}/`, loesung }),
		[anzeige, dok, loesung, mappe],
	);
	const pfad = useMemo(() => (doc && auswahl !== null ? pfadZu(doc, auswahl) : []), [doc, auswahl]);

	useEffect(() => {
		if (stand.art === 'gespeichert') {
			versionenNeu();
		}
	}, [stand, versionenNeu]);

	useEreignisse(({ dok: geaendert, mappe: m, typ, urheber, version, wieder }) => {
		if (typ === 'dokument-geaendert' && m === mappe && geaendert === dok) {
			versionenNeu();
			if (version !== b.speicher.basis.current?.version) {
				void b.pruefe(urheber ?? null);
			}
		} else if (typ === 'verbunden' && wieder) {
			void b.pruefe('claude');
		}
	});

	const { rueckgaengig, wiederholen } = b;
	const zurueck = useCallback(() => {
		setAuswahl(null);
		rueckgaengig();
	}, [rueckgaengig]);
	const vor = useCallback(() => {
		setAuswahl(null);
		wiederholen();
	}, [wiederholen]);

	const taste = useCallback(
		(e: KeyboardEvent) => {
			const befehl = e.metaKey || e.ctrlKey;
			const z = e.key.toLowerCase() === 'z';
			if (e.key === 'Escape') {
				setAuswahl(null);
			} else if (befehl && ((z && e.shiftKey) || e.key.toLowerCase() === 'y')) {
				e.preventDefault();
				vor();
			} else if (befehl && z) {
				e.preventDefault();
				zurueck();
			}
		},
		[vor, zurueck],
	);

	useEffect(() => {
		const amFenster = (e: KeyboardEvent) => {
			if (!istEingabe(e.target)) {
				taste(e);
			}
		};
		window.addEventListener('keydown', amFenster);
		return () => window.removeEventListener('keydown', amFenster);
	}, [taste]);

	// Verlassen ohne „Zurück“ (Zurück-Taste des Browsers): Offenes trotzdem speichern.
	useEffect(() => () => void alles(), [alles]);

	const { befehl } = b;
	useEffect(() => {
		const fenster = window as unknown as { schoolboxEditor?: TestZugriff };
		fenster.schoolboxEditor = {
			quelle: () => b.verlauf?.quelle ?? null,
			aendere: (neu, beschreibung = 'Test') => befehl(neu, beschreibung),
		};
		return () => {
			delete fenster.schoolboxEditor;
		};
	}, [b.verlauf, befehl]);

	const verlassen = async (ziel: string) => {
		const gespeichert = await alles();
		const trotzdem =
			gespeichert ||
			b.konflikt !== null ||
			window.confirm('Deine letzten Änderungen sind noch nicht gespeichert. Trotzdem gehen?');
		if (trotzdem) {
			void navigate(ziel);
		}
	};

	const zeigeVersion = async (version: VersionEintrag) => {
		try {
			const { quelle } = await lade<{ quelle: string }>(`${b.adresse}/versionen/${version.id}`);
			setAuswahl(null);
			setVorschau({ version, quelle });
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		}
	};

	const wiederherstellen = async (id: string) => {
		await b.wiederherstellen(id);
		setVorschau(null);
		versionenNeu();
	};

	if (b.ladeFehler) {
		return <Fehlt fehler={b.ladeFehler} />;
	}

	const wahl = dokumentWahl(zugang, dokument).map((w) => ({
		...w,
		vorbereiten: async () => {
			await alles();
			return w.vorbereiten();
		},
	}));
	const frei = vorschau === null && b.konflikt === null;
	const kannZurueck = frei && Boolean(b.verlauf?.zurueck.length);
	const kannVor = frei && Boolean(b.verlauf?.vor.length);

	return (
		<div className="flex h-dvh flex-col bg-papier" data-editor>
			<Kopfleiste
				titel={meta.titel}
				stand={<Speicheranzeige stand={stand} erneut={() => void b.speicher.speichere()} />}
				verlassen={() => void verlassen(dokumentSeite(zugang, dok))}
				kannZurueck={kannZurueck}
				kannVor={kannVor}
				zurueck={zurueck}
				vor={vor}
			>
				{meta.hatLoesung && (
					<div role="group" aria-label="Was zeigen?" className="flex gap-2">
						<Chip
							titel={materialName(dokument)}
							aktiv={!loesung}
							waehle={() => setSuche({}, { replace: true })}
						/>
						<Chip
							titel="Lösung"
							aktiv={loesung}
							waehle={() => setSuche({ fassung: 'loesung' }, { replace: true })}
						/>
					</div>
				)}
				<div className="flex flex-wrap gap-2">
					<Knopf
						art={panel === 'versionen' ? 'haupt' : 'zweit'}
						aria-pressed={panel === 'versionen'}
						onClick={() => {
							setPanel(panel === 'versionen' ? 'auswahl' : 'versionen');
							setVorschau(null);
						}}
					>
						<Symbol name="uhr" />
						Versionen
					</Knopf>
					<PdfKnopf beschriftung="PDF" wahl={wahl} mappe={mappenDaten} warnen rechtsbuendig />
					{meta.format === 'folie' && (
						<Knopf art="zweit" onClick={() => void verlassen(praesentationSeite(zugang, dok))}>
							<Symbol name="praesentieren" />
							Präsentieren
						</Knopf>
					)}
				</div>
			</Kopfleiste>

			<div className="flex min-h-0 flex-1 max-lg:flex-col">
				<main className="min-h-0 flex-1 overflow-y-auto px-6 py-4 max-lg:px-4">
					{b.konflikt && (
						<Konfliktleiste
							urheber={b.konflikt.urheber}
							laeuft={b.laeuft}
							neuLaden={() => {
								setAuswahl(null);
								void b.neuLaden();
							}}
						/>
					)}
					{vorschau && (
						<Vorschauleiste
							version={vorschau.version}
							laeuft={b.laeuft}
							wiederherstellen={() => void wiederherstellen(vorschau.version.id)}
							schliessen={() => setVorschau(null)}
						/>
					)}
					<Zoom zoom={zoom} setZoom={setZoom} />
					{html !== null && (
						<Leinwand
							html={html}
							titel={meta.titel}
							auswahl={auswahl}
							auswahlName={pfad.at(-1)?.name ?? null}
							waehle={setAuswahl}
							zoom={zoom}
							taste={taste}
							geladen={setDoc}
							nurAnsehen={vorschau !== null}
						/>
					)}
				</main>
				<aside
					className={klassen(
						'w-[22rem] flex-none overflow-y-auto border-l border-rand bg-white px-5 py-4',
						'max-lg:max-h-[38vh] max-lg:w-auto max-lg:border-t max-lg:border-l-0',
					)}
					data-panel={panel}
				>
					{panel === 'versionen' ? (
						<>
							<h2 className="mb-3 text-xl">Versionen</h2>
							<Versionen
								versionen={versionen.daten?.versionen ?? null}
								gewaehlt={vorschau?.version.id ?? null}
								waehle={(v) => void zeigeVersion(v)}
							/>
						</>
					) : (
						<AuswahlPanel pfad={pfad} waehle={setAuswahl} />
					)}
				</aside>
			</div>
		</div>
	);
};

/**
 * Der Editor für ein Dokument: das Material zum Antippen, rechts das Panel für die Auswahl bzw. die Versionen, oben
 * Rückgängig, Fassung, PDF. Gespeichert wird von selbst in dieselbe material.html, an der auch Claude arbeitet.
 */
export const Editor = ({ dok, mappe }: Eigenschaften) => {
	const { daten, fehler } = useLaden<MappenEintrag>(inhaltAdresse({ mappe, token: null }));
	const dokument = daten?.dokumente.find((d) => d.id === dok);
	if (fehler || (daten && !dokument)) {
		return <Fehlt fehler={fehler} />;
	}
	return daten && dokument ? <Bearbeitung key={`${mappe}/${dok}`} mappe={daten.mappe} dokument={dokument} /> : null;
};
