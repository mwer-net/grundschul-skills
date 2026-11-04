import { formatAusHtml } from '@schoolbox/kern/src/html';
import { hatLoesung, kannLoesungHaben } from '@schoolbox/kern/src/loesungen';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { zerlege } from '@schoolbox/kern/src/quelltext';
import { hatNamenszeile } from '@schoolbox/kern/src/struktur';
import type { Druckprofil, Format } from '@schoolbox/kern/src/werte';
import { FORMAT_NAME } from '@schoolbox/kern/src/werte';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { ApiFehler } from '../api';
import { lade, meldung } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { klassen } from '../bausteine/klassen';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { useZeigeMenue } from '../bausteine/MenueAmPunkt';
import { ProfilSchalter } from '../bausteine/ProfilSchalter';
import { Segment } from '../bausteine/Segment';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { Zustand } from '../bausteine/Zustand';
import { useAbbildung } from '../editor/abbildung';
import { useAblage } from '../editor/ablage';
import type { MenueArt } from '../editor/befehle';
import { AlsVorlage } from '../editor/AlsVorlage';
import { Konfliktleiste, Speicheranzeige, Vorschauleiste } from '../editor/Anzeigen';
import { useBearbeitung } from '../editor/bearbeitung';
import { Bausteinleiste } from '../editor/Bausteinleiste';
import { Bibliothek, Einfuegemarken, Gliederung } from '../editor/Bibliothek';
import { useBild } from '../editor/bild';
import type { ChatHandlungen } from '../editor/chat-kontext';
import { useChat, useChatKontext, useChatStand } from '../editor/chat-kontext';
import { useClaudeApp } from '../editor/ClaudeApp';
import { bausteinVon, editorHtml, elementZu, nrVon, pfadZu } from '../editor/darstellung';
import { useEinfuegen, useSlash, useTabelleTab } from '../editor/einfuegen';
import { halteFokus } from '../editor/halteFokus';
import { Leinwand } from '../editor/Leinwand';
import { leistenHtml } from '../editor/leiste';
import type { LinksName } from '../editor/LinkeLeiste';
import { LinkeLeiste } from '../editor/LinkeLeiste';
import { useLoesung } from '../editor/loesung';
import { Loesungsuebersicht } from '../editor/Loesungspanel';
import { erstesKindVon, ersterAufSeite, nachbarVon, seiteAn } from '../editor/navigation';
import { Einstellungen, Inspektor, Umriss } from '../editor/Inspektor';
import { Blattwerkzeug } from '../editor/Panel';
import type { Pruefpunkt } from '../editor/pruefung';
import { usePruefung } from '../editor/pruefung';
import { Seitenleiste } from '../editor/Seitenleiste';
import type { ZoomWert } from '../editor/Statusleiste';
import { gemerkterZoom, merkeZoom, naechsteStufe, Statusleiste, useSichtbareSeite } from '../editor/Statusleiste';
import type { Struktur } from '../editor/struktur';
import { useStruktur } from '../editor/struktur';
import { eintraegeImEditor } from '../editor/palette-eintraege';
import { Palette } from '../editor/Palette';
import { gehoertDemElement, istFeld, TASTEN_SPERRE } from '../editor/tasten';
import { TastenUebersicht } from '../editor/TastenUebersicht';
import { useText } from '../editor/text';
import { useBefehle } from '../editor/useBefehle';
import type { VersionEintrag } from '../editor/version';
import { Versionen } from '../editor/Versionen';
import { useEreignisse } from '../ereignisse';
import { useLaden } from '../lib/laden';
import { useAnsichtsProfil } from '../lib/profil';
import { useTitel } from '../lib/titel';
import { ansichtAdresse, dokumentSeite, druckSeite, inhaltAdresse, praesentationSeite } from '../lib/zugang';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { dokumentWahl, materialName } from '../pdf/wahl';
import type { DokumentEintrag, Mappe, MappenEintrag } from '../typen';

interface Eigenschaften {
	mappe: string;
	dok: string;
}

/** Zugriff für die Browser-Tests: Quelle lesen und ändern wie ein Befehl. */
interface TestZugriff {
	quelle: () => string | null;
	aendere: (neu: string, beschreibung?: string) => void;
	art: (element: Element) => string | null;
}

const BEDIENBAR = 'input, select, textarea, button';

const Trenner = () => <span aria-hidden className="mx-1 h-4 w-px flex-none bg-rand" />;

interface KopfEigenschaften {
	mappe: string;
	titel: string;
	stand: ReactNode;
	verlassen: () => void;
	mitte: ReactNode;
	children: ReactNode;
}

/** Drei Zonen: links wo man ist, in der Mitte die Ansicht, rechts die Aktionen mit genau einer Hauptaktion. */
const Kopfleiste = ({ children, mappe, mitte, stand, titel, verlassen }: KopfEigenschaften) => (
	<header
		className="@container z-kopf flex min-h-10 flex-none items-center gap-2 border-b border-rand bg-flaeche px-2 max-lg:flex-wrap max-lg:py-1"
		data-kopf
	>
		<div className="flex min-w-0 flex-1 items-center gap-1.5">
			<SymbolKnopf symbol="zurueck" beschriftung="Zurück" onClick={verlassen} />
			<span className="truncate text-leise @max-[1150px]:hidden">{mappe}</span>
			<span aria-hidden className="text-dezent @max-[1150px]:hidden">
				/
			</span>
			<h1 className="min-w-0 truncate text-sm font-medium">{titel}</h1>
			<div className="flex-none">{stand}</div>
		</div>
		<div className="flex flex-none items-center gap-1.5">{mitte}</div>
		<div className="flex min-w-max flex-1 items-center justify-end gap-1">{children}</div>
	</header>
);

/** Knopf mit Symbol und Text im Kopf. Wird es eng, bleibt das Symbol; der Name bleibt für Hilfsmittel und Tooltip. */
const KopfKnopf = ({
	aktion,
	aktiv,
	halten,
	name,
	symbol,
	titel,
}: {
	name: string;
	titel: string;
	symbol: 'sprechblase' | 'uhr';
	aktiv: boolean;
	aktion: () => void;
	/** Die Textsitzung läuft weiter, bis die Aktion ihre Markierung geholt hat. */
	halten?: boolean;
}) => (
	<Knopf
		art="leise"
		aria-label={name}
		aria-pressed={aktiv}
		className="aria-pressed:bg-flaeche-2"
		onClick={aktion}
		{...(halten ? halteFokus : {})}
	>
		<Symbol name={symbol} />
		<span className="@max-[1000px]:hidden">{titel}</span>
	</Knopf>
);

/**
 * Die Quelle zerlegt und als HTML für das `iframe`, beides nur neu, wenn sich Quelle oder Fassung ändern. Die
 * Lösungsansicht gibt es, sobald das Material eine Lösung hat oder Antwortlinien, die noch eine brauchen.
 */
const useDarstellung = (
	quelle: string | null,
	basis: string,
	loesungGewuenscht: boolean,
	sonst: boolean,
	profil: Druckprofil | undefined,
) => {
	const zerlegung = useMemo(() => (quelle === null ? null : zerlege(quelle)), [quelle]);
	const mitLoesung = zerlegung ? kannLoesungHaben(zerlegung) : sonst;
	const loesung = mitLoesung && loesungGewuenscht;
	const html = useMemo(
		() => (zerlegung === null ? null : editorHtml(zerlegung, { basis, loesung, profil })),
		[zerlegung, basis, loesung, profil],
	);
	return { zerlegung, html, mitLoesung, loesung };
};

/**
 * Nach dem Wechsel der Fassung ist manches nicht mehr wählbar (Antwortlinie, Lösungstext auf dem Arbeitsblatt): Dann
 * gilt das Umgebende, sobald die neue Fassung zu sehen ist.
 */
const useAuswahlFolgt = (
	geladen: { html: string } | null,
	html: string | null,
	auswahl: number | null,
	pfad: { nr: number }[],
	setAuswahl: (nr: number | null) => void,
) => {
	const innerstes = pfad.at(-1)?.nr ?? null;
	const sichtbar = geladen?.html === html;
	useEffect(() => {
		if (sichtbar && auswahl !== null && innerstes !== auswahl) {
			setAuswahl(innerstes);
		}
	}, [sichtbar, auswahl, innerstes, setAuswahl]);
};

/**
 * Antippen einer Meldung: zum Baustein rollen und ihn wählen. Eine Antwortlinie lässt sich nur in der Lösungsansicht
 * wählen; dann erst umschalten und wählen, wenn die Lösung zu sehen ist.
 */
const useZeigePunkt = ({
	geladen,
	html,
	loesung,
	setSuche,
	zeigeAn,
}: {
	loesung: boolean;
	geladen: { html: string } | null;
	html: string | null;
	zeigeAn: (nr: number) => void;
	setSuche: SetURLSearchParams;
}) => {
	const loesungSichtbar = loesung && geladen?.html === html;
	const [nachWechsel, setNachWechsel] = useState<number | null>(null);
	useEffect(() => {
		if (nachWechsel !== null && loesungSichtbar) {
			setNachWechsel(null);
			zeigeAn(nachWechsel);
		}
	}, [nachWechsel, loesungSichtbar, zeigeAn]);
	return (p: Pruefpunkt) => {
		const nr = p.bausteine[0];
		if (nr === undefined) {
			return;
		}
		if (p.code === 'loesung-fehlt' && !loesung) {
			setSuche({ fassung: 'loesung' }, { replace: true });
			setNachWechsel(nr);
		} else {
			zeigeAn(nr);
		}
	};
};

/** Ein Lösungsblatt gibt es nach dem Stand im Editor, nicht nach dem beim Öffnen (PDF-Auswahl). */
const mitStand = (dokument: DokumentEintrag, verlauf: { quelle: string } | null): DokumentEintrag =>
	verlauf ? { ...dokument, meta: { ...dokument.meta, hatLoesung: hatLoesung(verlauf.quelle) } } : dokument;

/** Die Seitenleiste zum Material, ohne Leiste, solange es nicht geladen ist. */
const Seiten = ({
	festeSeiten,
	html,
	kontextmenue,
	struktur,
	zerlegung,
}: {
	kontextmenue: (nr: number, punkt: { x: number; y: number }) => void;
	festeSeiten: boolean;
	html: string | null;
	zerlegung: Zerlegung | null;
	struktur: Struktur;
}) => {
	const leiste = useMemo(() => (html === null ? null : leistenHtml(html)), [html]);
	const namenszeile = useMemo(() => (zerlegung ? hatNamenszeile(zerlegung) : false), [zerlegung]);
	if (leiste === null) {
		return null;
	}
	return (
		<Seitenleiste
			html={leiste}
			gewaehlt={struktur.werte?.seite ?? null}
			aktiv={struktur.aktiv}
			waehle={struktur.zeigeAn}
			verschiebe={(nr, ablage) => struktur.verschiebe(nr, ablage, true)}
			hinzufuegen={(mitNamenszeile) => void struktur.neueSeite(mitNamenszeile)}
			kontextmenue={kontextmenue}
			namenszeile={namenszeile}
			festeSeiten={festeSeiten}
		/>
	);
};

const Fehlt = ({ fehler }: { fehler: ApiFehler | null }) => (
	<Zustand symbol="suche" titel="Dieses Dokument gibt es nicht mehr">
		<p className="text-leise">
			{fehler && fehler.status !== 404 ? fehler.message : 'Vielleicht wurde es gelöscht.'}
		</p>
		<KnopfLink to="/">Zu meinen Mappen</KnopfLink>
	</Zustand>
);

type RechtsName = 'inspektor' | 'versionen';

const ZITAT_ZEICHEN = 500;
const SPEICHER_LINKS = 'schoolbox-panel-links';
const SPEICHER_RECHTS = 'schoolbox-panel-rechts';
const LINKS: LinksName[] = ['seiten', 'gliederung', 'bausteine'];

/** Im Editor lässt sich das Format ändern (046): Es gilt, was in der Quelle steht. */
const formatVon = (verlauf: { quelle: string } | null, sonst: Format) =>
	verlauf ? formatAusHtml(verlauf.quelle) : sonst;

const schritte = (verlauf: { zurueck: unknown[]; vor: unknown[] } | null, frei: boolean) => ({
	kannVor: frei && Boolean(verlauf?.vor.length),
	kannZurueck: frei && Boolean(verlauf?.zurueck.length),
});

/**
 * Zwei Plätze für Panels, je Gerät gemerkt. „Versionen“ ist eine Aufgabe des Augenblicks: Das Panel geht nach dem
 * Öffnen eines Dokuments nicht von selbst wieder auf.
 */
const usePanels = (neu: boolean) => {
	const [links, setLinksName] = useState<LinksName>(() => {
		if (neu) {
			return 'bausteine';
		}
		return LINKS.find((l) => l === localStorage.getItem(SPEICHER_LINKS)) ?? 'seiten';
	});
	const [linksOffen, setLinksZustand] = useState(() => neu || localStorage.getItem(SPEICHER_LINKS) !== 'zu');
	const [rechts, setRechts] = useState<RechtsName>('inspektor');
	const [rechtsOffen, setRechtsZustand] = useState(() => localStorage.getItem(SPEICHER_RECHTS) !== 'zu');
	return {
		links,
		linksOffen,
		rechts,
		rechtsOffen,
		setRechts,
		setLinks: (name: LinksName) => {
			setLinksName(name);
			setLinksZustand(true);
			localStorage.setItem(SPEICHER_LINKS, name);
		},
		setLinksOffen: (offen: boolean) => {
			setLinksZustand(offen);
			localStorage.setItem(SPEICHER_LINKS, offen ? links : 'zu');
		},
		setRechtsOffen: (offen: boolean) => {
			setRechtsZustand(offen);
			localStorage.setItem(SPEICHER_RECHTS, offen ? 'offen' : 'zu');
		},
		/** „Versionen“ im Kopf: noch einmal drücken führt zurück zum Inspektor. */
		wechsleRechts: (name: RechtsName) => {
			const zurueck = rechts === name && rechtsOffen;
			setRechts(zurueck ? 'inspektor' : name);
			setRechtsZustand(true);
		},
	};
};

/** Bibliothek, Slash-Menü, Tab in Tabellen und „auf neue Seite“: alles, was auf dem gerade gezeigten Dokument arbeitet. */
const useEinfuegeWerkzeuge = ({
	auswahl,
	dokument,
	folien,
	geladen,
	html,
	nachher,
	setAuswahl,
	struktur,
	text,
}: {
	auswahl: number | null;
	dokument: { mappe: string; dok: string };
	folien: boolean;
	geladen: { doc: Document; html: string } | null;
	html: string | null;
	nachher: () => void;
	setAuswahl: (nr: number | null) => void;
	struktur: Struktur;
	text: ReturnType<typeof useText>;
}) => {
	const docJetzt = geladen?.html === html ? (geladen?.doc ?? null) : null;
	const einfuegen = useEinfuegen({ dokument, struktur, auswahl, folien, nachher });
	const slash = useSlash({
		// Das Dokument im Rahmen: Beim Tippen weicht die Quelle davon ab, das Menü muss trotzdem aufgehen.
		doc: geladen?.doc ?? null,
		bearbeitet: text.bearbeitet,
		beende: text.beende,
		eintraege: einfuegen.eintraege,
		waehle: einfuegen.fuegeEin,
	});
	useTabelleTab({
		angezeigt: geladen?.doc ?? null,
		doc: docJetzt,
		bearbeitet: text.bearbeitet,
		beende: text.beende,
		fokussiere: text.fokussiere,
		setAuswahl,
		struktur,
		folien,
	});
	const verschiebeUeberlauf =
		struktur.aktiv && docJetzt ? (p: Pruefpunkt) => einfuegen.verschiebe(docJetzt, p.seite) : undefined;
	return { docJetzt, einfuegen, slash, verschiebeUeberlauf };
};

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
	const [geladen, setGeladen] = useState<{ doc: Document; html: string } | null>(null);
	const panels = usePanels(suche.get('neu') === '1');
	const [alsVorlage, setAlsVorlage] = useState(false);
	const [tastenOffen, setTastenOffen] = useState(false);
	const [paletteOffen, setPaletteOffen] = useState(false);
	const [zumBlatt, setZumBlatt] = useState(0);
	const [umriss, setUmriss] = useState<number | null>(null);
	const claudeApp = useClaudeApp();
	const chat = useChat();
	const chatStand = useChatStand();
	const [schnellWunsch, setSchnellWunsch] = useState<{ n: number; nr: number | null }>({ n: 0, nr: null });
	const ansicht = useRef<HTMLElement>(null);
	const ki = chatStand.ki;
	const [vorschau, setVorschau] = useState<{ version: VersionEintrag; quelle: string } | null>(null);
	const [zoom, setZoomWert] = useState<ZoomWert>(gemerkterZoom);
	const [massstab, setMassstab] = useState({ skala: 1, stufe: 1 });
	const setZoom = (wert: ZoomWert) => {
		setZoomWert(wert);
		merkeZoom(wert);
	};
	const versionen = useLaden<{ versionen: VersionEintrag[] }>(`${b.adresse}/versionen`);
	const { neuLaden: versionenNeu } = versionen;

	const format = formatVon(b.verlauf, meta.format);
	const quelle = b.verlauf?.quelle ?? null;
	useTitel(`${meta.titel} bearbeiten`);
	const anzeige = vorschau?.quelle ?? quelle;
	const basis = `/ansicht/${mappe}/dokumente/${dok}/`;
	const { profil, waehle: waehleProfil } = useAnsichtsProfil({ mappe, token: null }, dok, meta);
	const { html, loesung, mitLoesung, zerlegung } = useDarstellung(
		anzeige,
		basis,
		suche.get('fassung') === 'loesung',
		Boolean(meta.hatLoesung),
		profil,
	);
	const pfad = useMemo(() => (geladen && auswahl !== null ? pfadZu(geladen.doc, auswahl) : []), [geladen, auswahl]);
	const merken = useCallback((d: Document, h: string) => setGeladen({ doc: d, html: h }), []);

	const frei = vorschau === null && b.konflikt === null;
	const pruefung = usePruefung({ geladen, html, zerlegung, ausgang: b.ausgang, aus: vorschau !== null });
	const text = useText({
		geladen,
		html,
		zerlegung,
		auswahl,
		setAuswahl,
		bearbeitbar: frei,
		befehl: b.befehl,
		pruefe: b.pruefe,
		getippt: pruefung.getippt,
	});

	useEffect(() => {
		if (stand.art === 'gespeichert') {
			versionenNeu();
		}
	}, [stand, versionenNeu]);

	useEreignisse(({ dok: geaendert, mappe: m, typ, urheber, version, wieder }) => {
		if (typ === 'dokument-geaendert' && m === mappe && geaendert === dok) {
			versionenNeu();
			if (version !== b.speicher.basis.current?.version) {
				text.pruefeSpaeter(urheber ?? null);
			}
		} else if (typ === 'verbunden' && wieder) {
			text.pruefeSpaeter('claude');
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

	const struktur = useStruktur({
		geladen,
		html,
		verlauf: b.verlauf,
		pfad,
		setAuswahl,
		befehl: b.befehl,
		rueckgaengig: zurueck,
		folien: format === 'folie',
		frei,
		bearbeitet: text.bearbeitet,
	});

	const bild = useBild({
		geladen,
		html,
		pfad,
		struktur,
		adresse: b.adresse,
		basis,
		rueckgaengig: zurueck,
	});

	const abbildung = useAbbildung({ geladen, html, zerlegung, pfad, struktur, adresse: b.adresse, basis });

	const loes = useLoesung({ geladen, html, zerlegung, pfad, struktur, loesung, rueckgaengig: zurueck });

	useAuswahlFolgt(geladen, html, auswahl, pfad, setAuswahl);
	const { docJetzt, einfuegen, slash, verschiebeUeberlauf } = useEinfuegeWerkzeuge({
		auswahl,
		dokument: { mappe, dok },
		folien: format === 'folie',
		geladen,
		html,
		nachher: () => panels.setRechtsOffen(true),
		setAuswahl,
		struktur,
		text,
	});
	const zeigePunkt = useZeigePunkt({ loesung, geladen, html, zeigeAn: struktur.zeigeAn, setSuche });
	const seite = useSichtbareSeite(geladen?.doc ?? null, ansicht, `${massstab.skala}/${geladen?.html.length ?? 0}`);

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

	const ablage = useAblage({
		dokument: { mappe, dok },
		pfad,
		quelle,
		fuegeAblageEin: einfuegen.fuegeAblageEin,
		sammlungGeaendert: einfuegen.neuLaden,
		struktur,
	});

	const befehle = useBefehle(
		{
			pfad,
			format,
			aktiv: struktur.aktiv,
			frei,
			textsitzung: text.bearbeitet,
			quelle,
			werte: struktur.werte,
			mitLoesung,
			loesung,
			profil,
			hatAblage: ablage.abgelegt !== null,
			hatNeueZahlen: abbildung.hatNeueZahlen,
			kiVerfuegbar: ki.zustand.verfuegbar,
			namenszeile: zerlegung ? hatNamenszeile(zerlegung) : false,
			festeSeiten: format === 'minibuch',
			hatBild: bild.werte !== null,
			davor: (() => {
				const element = docJetzt && auswahl !== null ? elementZu(docJetzt, auswahl) : null;
				const vorher = element?.previousElementSibling;
				return vorher && bausteinVon(vorher) ? nrVon(vorher) : null;
			})(),
			textMarkiert: () =>
				[document, geladen?.doc].some((d) => {
					const markiert = d?.getSelection();
					return Boolean(markiert && !markiert.isCollapsed);
				}),
			tu: {
				struktur,
				fokussiereText: text.fokussiere,
				waehle: setAuswahl,
				eineEbeneHoch: () => setAuswahl(pfad.at(-2)?.nr ?? null),
				nachbar: (richtung) => {
					const ziel = docJetzt && auswahl !== null ? nachbarVon(docJetzt, auswahl, richtung) : null;
					if (ziel !== null) {
						struktur.zeigeAn(ziel);
					}
				},
				erstesKind: () => {
					const ziel = docJetzt && auswahl !== null ? erstesKindVon(docJetzt, auswahl) : null;
					if (ziel !== null) {
						struktur.zeigeAn(ziel);
					}
				},
				ersterBaustein: () => {
					const ziel = docJetzt ? ersterAufSeite(docJetzt, seite.nr) : null;
					if (ziel !== null) {
						struktur.zeigeAn(ziel);
					}
				},
				kopiere: ablage.kopiere,
				schneideAus: ablage.schneideAus,
				fuegeAblageEin: (nr) => ablage.fuegeEin(nr ?? (docJetzt ? seiteAn(docJetzt, seite.nr) : null)),
				inSammlung: () => {
					panels.setRechts('inspektor');
					panels.setRechtsOffen(true);
					ablage.setSammlungName(pfad.at(-1)?.name ?? '');
				},
				neueZahlen: () => {
					const geklappt = abbildung.neueZahlen();
					if (!geklappt) {
						zeige({ text: 'Hier gibt es gerade keine neuen Zahlen. Bei Sprüngen und Fehleraufgaben hängen die Zahlen zusammen.' });
					}
					return geklappt;
				},
				claudeApp: () => claudeApp.frage({ ...frage, nr: auswahl }),
				oeffneSchnellauswahl: (nr = auswahl) => setSchnellWunsch((w) => ({ n: w.n + 1, nr })),
				bildErsetzen: () => {
					panels.setRechts('inspektor');
					panels.setRechtsOffen(true);
					// Dort steht auch der Hinweis zu Fotos von Kindern: Es gibt nur diesen einen Weg zum Hochladen.
					window.setTimeout(() => {
						const ort = document.querySelector('[data-bildwerkzeug]');
						ort?.scrollIntoView({ block: 'start' });
						ort?.querySelector<HTMLElement>('label, button')?.focus();
					});
				},
				zurLeiste: () =>
					document
						.querySelector<HTMLElement>(
							'[data-panel] input, [data-panel] select, [data-panel] textarea, [data-panel] button',
						)
						?.focus(),
				fassung: (w) => setSuche(w === 'loesung' ? { fassung: 'loesung' } : {}, { replace: true }),
				profil: waehleProfil,
				zoomSchritt: (richtung) => {
					const ziel = naechsteStufe(massstab.stufe, richtung);
					if (ziel !== undefined) {
						setZoom(ziel);
					}
				},
				zoom100: () => setZoom(1),
				einpassen: () => setZoom('einpassen'),
				links: panels.setLinks,
				inspektor: () => {
					if (panels.rechts === 'inspektor') {
						panels.setRechtsOffen(!panels.rechtsOffen);
					} else {
						panels.setRechts('inspektor');
						panels.setRechtsOffen(true);
					}
				},
				versionen: () => {
					panels.wechsleRechts('versionen');
					setVorschau(null);
				},
				claude: () => chat.taste(),
				claudeZurAuswahl: () => chat.oeffne(),
				palette: () => {
					text.halte(true);
					setPaletteOffen(true);
				},
				tasten: () => setTastenOffen(true),
				rueckgaengig: zurueck,
				wiederholen: vor,
				speichern: () => zeige({ text: 'Wird automatisch gespeichert.' }),
				pdf: () => document.querySelector<HTMLElement>('[data-pdf-knopf] button')?.click(),
				drucken: () =>
					void verlassen(druckSeite(zugang, dok, loesung ? 'loesung' : 'arbeitsblatt', profil)),
				alsVorlage: () => setAlsVorlage(true),
				praesentieren: () => void verlassen(praesentationSeite(zugang, dok)),
				zurueck: () => void verlassen(dokumentSeite(zugang, dok)),
				hilfe: () => void verlassen('/hilfe'),
			},
		},
		useCallback((text: string) => zeige({ text }), [zeige]),
	);

	const zeigeEinstellung = (ort: string) => {
		panels.setRechts('inspektor');
		panels.setRechtsOffen(true);
		setZumBlatt((n) => n + 1);
		window.setTimeout(() => {
			const ziel = document.querySelector(`[data-einstellung="${ort}"]`);
			const feld = ziel?.matches(BEDIENBAR) ? ziel : ziel?.querySelector(BEDIENBAR);
			if (feld instanceof HTMLElement) {
				feld.scrollIntoView({ block: 'nearest' });
				feld.focus();
			}
		});
	};

	const zeigeMenue = useZeigeMenue();
	const [menueWunsch, setMenueWunsch] = useState<{ art: MenueArt; punkt: { x: number; y: number } } | null>(null);
	const blattFokus = geladen?.doc.defaultView;
	const { menue: menueFuer } = befehle;
	// Erst nach der Auswahl: Das Menü richtet sich nach dem Baustein, den der Rechtsklick gerade gewählt hat.
	useEffect(() => {
		if (menueWunsch) {
			setMenueWunsch(null);
			zeigeMenue(menueWunsch.punkt, menueFuer(menueWunsch.art), () => blattFokus?.focus());
		}
	}, [menueWunsch, zeigeMenue, menueFuer, blattFokus]);
	const menueAn = (nr: number | null, art: MenueArt, punkt: { x: number; y: number }) => {
		setAuswahl(nr);
		setMenueWunsch({ art, punkt });
	};

	const { jetzt: befehlsKontext, zuTaste } = befehle;
	const taste = useCallback(
		(e: KeyboardEvent) => {
			// Schon vergeben: Die Textsitzung hört vorher hin und beendet sich bei Esc selbst.
			if (e.defaultPrevented || document.querySelector(TASTEN_SPERRE) || gehoertDemElement(e)) {
				return;
			}
			const { pfad: kette, textsitzung } = befehlsKontext.current;
			let modus: 'text' | 'auswahl' | 'ohne' = kette.length > 0 ? 'auswahl' : 'ohne';
			if (textsitzung || istFeld(e.target)) {
				modus = 'text';
			}
			if (!zuTaste(e, modus) && modus !== 'text' && (e.metaKey || e.ctrlKey) && e.code === 'KeyA') {
				// Sonst markiert der Browser die ganze Bedienoberfläche blau.
				e.preventDefault();
			}
		},
		[befehlsKontext, zuTaste],
	);

	useEffect(() => {
		// Beim Schließen eines Menüs ist es unten am Fenster schon weg: Esc ginge sonst zusätzlich eine Ebene hoch.
		let offenBeimDruck = false;
		const vorher = () => {
			offenBeimDruck = Boolean(document.querySelector(TASTEN_SPERRE));
		};
		const amFenster = (e: KeyboardEvent) => {
			if (!offenBeimDruck) {
				taste(e);
			}
		};
		window.addEventListener('keydown', vorher, true);
		window.addEventListener('keydown', amFenster);
		return () => {
			window.removeEventListener('keydown', vorher, true);
			window.removeEventListener('keydown', amFenster);
		};
	}, [taste]);

	// Verlassen ohne „Zurück“ (Zurück-Taste des Browsers): Offenes trotzdem speichern.
	useEffect(() => () => void alles(), [alles]);

	const { befehl } = b;
	useEffect(() => {
		const fenster = window as unknown as { schoolboxEditor?: TestZugriff };
		fenster.schoolboxEditor = {
			quelle: () => b.verlauf?.quelle ?? null,
			aendere: (neu, beschreibung = 'Test') => befehl(neu, beschreibung),
			art: (element) => bausteinVon(element)?.art ?? null,
		};
		return () => {
			delete fenster.schoolboxEditor;
		};
	}, [b.verlauf, befehl]);

	const zeigeVersion = async (version: VersionEintrag) => {
		try {
			const fassung = await lade<{ quelle: string }>(`${b.adresse}/versionen/${version.id}`);
			setAuswahl(null);
			setVorschau({ version, quelle: fassung.quelle });
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

	const wahl = dokumentWahl(zugang, mitStand(dokument, b.verlauf), profil).map((w) => ({
		...w,
		vorbereiten: async () => {
			await alles();
			return w.vorbereiten();
		},
	}));
	// Aus der Quelle im Editor, nicht aus der Darstellung: Nach dem Tippen gilt schon der neue Text.
	const ort = useMemo(
		() => ({ mappe: mappenDaten, dokument: { id: dok, titel: meta.titel } }),
		[mappenDaten, dok, meta.titel],
	);
	const frage = { zerlegung, ort, loesung, nachher: () => void alles() };
	const handlungen = useRef<ChatHandlungen>({
		vorbereiten: () => Promise.resolve(),
		holeZitat: () => '',
		zumBlatt: () => undefined,
		zurApp: () => undefined,
	});
	useEffect(() => {
		handlungen.current = {
			vorbereiten: alles,
			holeZitat: () => {
				if (!befehle.jetzt.current.textsitzung) {
					return '';
				}
				const stelle = docJetzt?.getSelection()?.toString().trim() ?? '';
				text.beende();
				return stelle.slice(0, ZITAT_ZEICHEN);
			},
			zumBlatt: () => {
				document.querySelector<HTMLIFrameElement>('[data-editor-rahmen="sichtbar"]')?.contentWindow?.focus();
			},
			zurApp: (nr) => claudeApp.frage({ zerlegung, ort, loesung, nachher: () => void alles(), nr }),
		};
	});
	const adresse = ansichtAdresse(zugang, dok, loesung, profil);
	useChatKontext(
		useMemo(
			() => ({
				art: 'dokument' as const,
				mappe,
				dok,
				titel: meta.titel,
				adresse,
				zerlegung,
				ort,
				loesung,
				nr: auswahl,
				pfad,
				frei,
				anker: ansicht,
				handlungen,
			}),
			[adresse, auswahl, dok, frei, loesung, mappe, meta.titel, ort, pfad, zerlegung],
		),
	);
	const ohneAuswahl = (
		<Blattwerkzeug
			aktiv={frei}
			doc={docJetzt}
			quelle={quelle}
			struktur={struktur}
			loesung={loesung ? <Loesungsuebersicht l={loes} /> : null}
		/>
	);
	const panelInhalt = {
		versionen: (
			<>
				<h2 className="mb-2 text-base font-semibold">Versionen</h2>
				<Versionen
					versionen={versionen.daten?.versionen ?? null}
					gewaehlt={vorschau?.version.id ?? null}
					waehle={(v) => void zeigeVersion(v)}
				/>
			</>
		),
		inspektor: (
			<Inspektor pfad={pfad} waehle={setAuswahl} umriss={setUmriss} blatt={ohneAuswahl} zumBlatt={zumBlatt}>
				<Einstellungen
					pfad={pfad}
					quelle={quelle}
					format={format}
					frei={frei}
					doc={docJetzt}
					geladen={geladen}
					struktur={struktur}
					ablage={ablage}
					abb={abbildung}
					bild={bild}
					loes={loes}
					text={text}
					pruefung={pruefung.stand}
				/>
			</Inspektor>
		),
	};
	const { kannVor, kannZurueck } = schritte(b.verlauf, frei);

	const links = panels.links === 'bausteine' && !frei ? 'seiten' : panels.links;
	const linksInhalt = {
		seiten: (
			<Seiten
				html={html}
				zerlegung={zerlegung}
				struktur={struktur}
				festeSeiten={format === 'minibuch'}
				kontextmenue={(nr, punkt) => menueAn(nr, 'miniatur', punkt)}
			/>
		),
		gliederung: (
			<div className="min-h-0 flex-1 overflow-y-auto p-2">
				<Gliederung doc={docJetzt} auswahl={auswahl} kontextmenue={menueAn} struktur={struktur} />
			</div>
		),
		bausteine: (
			<div className="min-h-0 flex-1 overflow-y-auto p-2">
				<Bibliothek
					einfuegen={einfuegen}
					mappe={mappenDaten}
					art={meta.art}
					doc={docJetzt}
					setAuswahl={setAuswahl}
				/>
			</div>
		),
	};

	return (
		<div className="flex h-dvh flex-col bg-papier" data-editor>
			<Kopfleiste
				mappe={mappenDaten.titel}
				titel={meta.titel}
				stand={<Speicheranzeige stand={stand} erneut={() => void b.speicher.speichere()} />}
				verlassen={() => befehle.fuehreAus('dokument.zurueck')}
				mitte={
					<>
						{mitLoesung && (
							<Segment
								beschriftung="Was zeigen?"
								werte={[
									{ wert: 'material', titel: materialName(dokument) },
									{ wert: 'loesung', titel: 'Lösung' },
								]}
								wert={loesung ? 'loesung' : 'material'}
								waehle={(w) => befehle.fuehreAus(w === 'loesung' ? 'ansicht.loesung' : 'ansicht.arbeitsblatt')}
							/>
						)}
						<ProfilSchalter
							profil={profil}
							waehle={(p) => befehle.fuehreAus(p === 'sw' ? 'ansicht.sw' : 'ansicht.farbe')}
						/>
					</>
				}
			>
				<SymbolKnopf
					symbol="rueckgaengig"
					beschriftung="Rückgängig"
					kuerzel="⌘Z"
					disabled={!kannZurueck}
					onClick={() => befehle.fuehreAus('dokument.rueckgaengig')}
				/>
				<SymbolKnopf
					symbol="wiederholen"
					beschriftung="Wiederholen"
					kuerzel="⇧⌘Z"
					disabled={!kannVor}
					onClick={() => befehle.fuehreAus('dokument.wiederholen')}
				/>
				<Trenner />
					<KopfKnopf
						name="Claude"
						titel="Claude"
						symbol="sprechblase"
						aktiv={chatStand.fenster !== 'zu'}
						aktion={() => chat.wechsle()}
						halten
					/>
				<KopfKnopf
					name="Versionen"
					titel="Versionen"
					symbol="uhr"
					aktiv={panels.rechts === 'versionen' && panels.rechtsOffen}
					aktion={() => befehle.fuehreAus('ansicht.versionen')}
				/>
				<Menue
					name="Weitere Aktionen"
					rechtsbuendig
					ausloeser={
						<Knopf art="leise" className="size-knopf px-0">
							<Symbol name="mehr" />
						</Knopf>
					}
					eintraege={[
						{ titel: 'Als Vorlage speichern', symbol: 'blatt', waehle: () => befehle.fuehreAus('dokument.als-vorlage') },
					]}
				/>
				<Trenner />
				{format === 'folie' && (
					<Knopf art="zweit" onClick={() => befehle.fuehreAus('dokument.praesentieren')}>
						<Symbol name="praesentieren" />
						Präsentieren
					</Knopf>
				)}
				<span className="contents" data-pdf-knopf>
					<PdfKnopf art="haupt" beschriftung="PDF" wahl={wahl} mappe={mappenDaten} warnen rechtsbuendig />
				</span>
			</Kopfleiste>
			{claudeApp.dialog}
			{paletteOffen && (
				<Palette
					platzhalter="Befehl oder Baustein suchen"
					anClaude={ki.zustand.verfuegbar ? chat.fuelle : undefined}
					eintraege={eintraegeImEditor(befehle.jetzt.current, {
						posten: einfuegen.eintraege,
						fuegeEin: (p) => einfuegen.fuegeEin(p, auswahl ?? (docJetzt ? seiteAn(docJetzt, seite.nr) : null)),
						zeigeSeite: (nr) => {
							const ziel = docJetzt ? seiteAn(docJetzt, nr) : null;
							if (ziel !== null) {
								struktur.zeigeAn(ziel);
							}
						},
						zeigeEinstellung,
						fuehreAus: befehle.fuehreAus,
					})}
					schliessen={(ausgefuehrt) => {
						text.halte(false);
						if (ausgefuehrt) {
							// Die Aktion arbeitet mit dem fertigen Text, wie bei jedem Knopf außerhalb des Blatts.
							text.beende();
						}
						setPaletteOffen(false);
					}}
				/>
			)}
			{tastenOffen && (
				<TastenUebersicht kontext={befehle.jetzt.current} schliessen={() => setTastenOffen(false)} />
			)}
			{alsVorlage && (
				<AlsVorlage mappe={mappe} dok={dok} titel={meta.titel} schliessen={() => setAlsVorlage(false)} />
			)}

			<div className="flex min-h-0 flex-1 max-lg:flex-col">
				<div className="flex min-h-0 min-w-0 flex-1">
					{panels.linksOffen && (
						<LinkeLeiste panel={links} setPanel={panels.setLinks} bausteineAus={!frei}>
							{linksInhalt[links]}
						</LinkeLeiste>
					)}
					<main
						ref={ansicht}
						className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-leinwand"
						style={{ paddingBottom: 'var(--chat-platz, 0px)', scrollPaddingBottom: 'var(--chat-platz, 0px)' }}
					>
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
						{html !== null && (
							<Leinwand
								html={html}
								titel={meta.titel}
								auswahl={auswahl}
								waehle={setAuswahl}
								zoom={zoom}
								meldeMassstab={setMassstab}
								taste={taste}
								textsitzung={text.bearbeitet}
								kontextmenue={(treffer, punkt) =>
									menueAn(
										treffer?.nr ?? null,
										!treffer || treffer.art === 'seite' ? 'leer' : 'baustein',
										punkt,
									)
								}
								geladen={merken}
								nurAnsehen={vorschau !== null}
								ziehbar={struktur.aktiv}
								ablegen={struktur.verschiebe}
								einblendung={
									frei
										? (e) => (
												<>
													<Einfuegemarken
														e={e}
														aktiv={struktur.aktiv}
														setAuswahl={setAuswahl}
														einfuegen={einfuegen}
														slash={slash.menue}
														schnellWunsch={schnellWunsch}
													/>
													<Umriss e={e} nr={umriss} />
													<Bausteinleiste
														e={e}
														pfad={pfad}
														quelle={quelle}
														format={format}
														struktur={struktur}
														befehle={befehle}
														text={text}
														abb={abbildung}
														bild={bild}
														loes={loes}
														waehle={setAuswahl}
													/>
												</>
											)
										: undefined
								}
								springe={struktur.springe}
								verdeckt={chatStand.verlaufHoehe}
								groesse={bild.groesse}
								pruefung={pruefung.stand}
							/>
						)}
					</main>
				</div>
				{panels.rechtsOffen && (
					<aside
						className="flex w-[248px] flex-none flex-col border-l border-rand bg-flaeche max-lg:h-[38vh] max-lg:w-auto max-lg:border-t max-lg:border-l-0"
						data-panel={panels.rechts}
					>
						<div className={klassen('min-h-0 flex-1 overflow-y-auto', panels.rechts !== 'inspektor' && 'p-3')}>
							{panelInhalt[panels.rechts]}
						</div>
					</aside>
				)}
			</div>

			<Statusleiste
				seite={seite}
				format={FORMAT_NAME[format]}
				pruefung={pruefung.stand}
				zeigePunkt={zeigePunkt}
				verschiebe={verschiebeUeberlauf}
				zoom={zoom}
				stufe={massstab.stufe}
				skala={massstab.skala}
				fuehreAus={befehle.fuehreAus}
				linksOffen={panels.linksOffen}
				rechtsOffen={panels.rechtsOffen}
				setLinksOffen={panels.setLinksOffen}
				setRechtsOffen={panels.setRechtsOffen}
				claude={chatStand.fenster === 'zu' ? chatStand.lauf : null}
				zeigeClaude={() => chat.oeffne('verlauf')}
			/>
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
