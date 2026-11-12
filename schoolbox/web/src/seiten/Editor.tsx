import { formatAusHtml } from '@schoolbox/kern/src/html';
import { hatLoesung, kannLoesungHaben } from '@schoolbox/kern/src/loesungen';
import type { Verlauf, Zerlegung } from '@schoolbox/kern/src/quelltext';
import { zerlege } from '@schoolbox/kern/src/quelltext';
import { hatNamenszeile } from '@schoolbox/kern/src/struktur';
import type { Druckprofil, Format } from '@schoolbox/kern/src/werte';
import { FORMAT_NAME } from '@schoolbox/kern/src/werte';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { SetURLSearchParams } from 'react-router-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { ApiFehler } from '../api';
import { lade, meldung } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { klassen } from '../bausteine/klassen';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import { useZeigeMenue } from '../bausteine/menue-kontext';
import { ProfilSchalter } from '../bausteine/ProfilSchalter';
import { Segment } from '../bausteine/Segment';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { Zustand } from '../bausteine/Zustand';
import { useAbbildung } from '../editor/abbildung';
import { useAblage } from '../editor/ablage';
import { Konfliktleiste, Speicheranzeige, Vorschauleiste } from '../editor/Anzeigen';
import { Bausteinleiste } from '../editor/Bausteinleiste';
import { useBearbeitung } from '../editor/bearbeitung';
import type { MenueArt } from '../editor/befehle';
import { istZoomTaste, kuerzelVon } from '../editor/befehle';
import { Einfuegemarken } from '../editor/Bibliothek';
import { useBild } from '../editor/bild';
import { useBildAusFinder } from '../editor/bild-finder';
import { ClaudeSchicht } from '../editor/Blase';
import type { ClaudeHandlungen } from '../editor/claude-kontext';
import { ClaudeKontext } from '../editor/claude-kontext';
import { useClaudeApp } from '../editor/ClaudeApp';
import { bausteinVon, editorHtml, elementZu, nrVon, pfadZu } from '../editor/darstellung';
import { useEinfuegen, useSlash, useTabelleTab } from '../editor/einfuegen';
import { EntwurfKarte, EntwurfPille, Entwurfsleiste, SperrHinweis } from '../editor/Entwurf';
import { zeigeBlattGestaltung } from '../editor/gestaltung/blatt/zeige';
import { gestaltungKontext } from '../editor/gestaltung/kontext';
import { Leiste as GestaltungLeiste } from '../editor/gestaltung/leiste/Leiste';
import { folgeAuswahl, nrnFuer, useMehrfach } from '../editor/gestaltung/mehrfach';
import { GestaltungUeberlagerung } from '../editor/gestaltung/ueberlagerung';
import { Werkzeugflaeche } from '../editor/gestaltung/werkzeuge/Werkzeugflaeche';
import type { Geladen } from '../editor/gezeigt';
import { zuSehen } from '../editor/gezeigt';
import { useGliederungStand } from '../editor/gliederung-stand';
import { halteFokus } from '../editor/halteFokus';
import { Einstellungen, Inspektor, Umriss } from '../editor/Inspektor';
import { useKiZustand } from '../editor/ki';
import { Leinwand } from '../editor/Leinwand';
import { useLoesung } from '../editor/loesung';
import { Loesungsuebersicht } from '../editor/Loesungspanel';
import { ersterAufSeite, erstesKindVon, nachbarVon, seiteAn } from '../editor/navigation';
import { Palette } from '../editor/Palette';
import { eintraegeImEditor } from '../editor/palette-eintraege';
import { Blattwerkzeug } from '../editor/Panel';
import { usePanels } from '../editor/panels';
import type { Pruefpunkt } from '../editor/pruefung';
import { holeInSeiteAus, ueberlaufendeSeiten, usePruefung } from '../editor/pruefung';
import type { SchubladenId, SchubladenTeile } from '../editor/schubladen';
import { schubladeVon } from '../editor/schubladen';
import { Schubladen } from '../editor/schubladen/Schubladen';
import { angezeigt, istEng, sichtbar } from '../editor/schubladen/spalten';
import { Statusleiste } from '../editor/Statusleiste';
import type { Struktur } from '../editor/struktur';
import { useStruktur } from '../editor/struktur';
import { behaeltUndo, beobachteFelder, gehoertDemElement, istFeld, loeseFeld, TASTEN_SPERRE } from '../editor/tasten';
import { TastenUebersicht } from '../editor/TastenUebersicht';
import { TEXT_GEAENDERT, useText } from '../editor/text';
import { useBefehle } from '../editor/useBefehle';
import { useClaude } from '../editor/useClaude';
import { useEntwurf } from '../editor/useEntwurf';
import type { VersionEintrag } from '../editor/version';
import { Versionen } from '../editor/Versionen';
import type { ZoomWert } from '../editor/zoom';
import { gemerkterZoom, merkeZoom, naechsteStufe, useSichtbareSeite } from '../editor/zoom';
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
	// Das Bild, das `Leinwand.tsx` fertig meldet, kann eine Fassung älter sein: Zu den letzten drei HTML die Zerlegung.
	const paare = useRef(new Map<string, Zerlegung>());
	useEffect(() => {
		if (html === null || zerlegung === null) {
			return;
		}
		const p = paare.current;
		p.delete(html);
		p.set(html, zerlegung);
		for (const alt of p.keys()) {
			if (p.size <= 3) {
				break;
			}
			p.delete(alt);
		}
	}, [html, zerlegung]);
	const zerlegungZu = useCallback((h: string) => paare.current.get(h) ?? null, []);
	return { zerlegung, html, mitLoesung, loesung, zerlegungZu };
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

const Fehlt = ({ fehler }: { fehler: ApiFehler | null }) => (
	<Zustand symbol="suche" titel="Dieses Dokument gibt es nicht mehr">
		<p className="text-leise">
			{fehler && fehler.status !== 404 ? fehler.message : 'Vielleicht wurde es gelöscht.'}
		</p>
		<KnopfLink to="/">Zu meinem Material</KnopfLink>
	</Zustand>
);

const ZITAT_ZEICHEN = 500;
/** Im Editor lässt sich das Format ändern (046): Es gilt, was in der Quelle steht. */
const formatVon = (verlauf: { quelle: string } | null, sonst: Format) =>
	verlauf ? formatAusHtml(verlauf.quelle) : sonst;

/**
 * Was die Pfeile gerade tun. Ein geänderter offener Text wird beim Beenden ein Schritt: Dann geht es zurück, und
 * Wiederholen ist schon jetzt vorbei, wie nach jedem neuen Befehl.
 */
const schritte = (verlauf: Verlauf | null, frei: boolean, textGeaendert: boolean) => {
	const zurueckName = textGeaendert ? TEXT_GEAENDERT : verlauf?.zurueck.at(-1)?.beschreibung;
	const vorName = textGeaendert ? undefined : verlauf?.vor.at(-1)?.beschreibung;
	return {
		kannZurueck: frei && Boolean(zurueckName),
		kannVor: frei && Boolean(vorName),
		zurueckName: frei ? zurueckName : undefined,
		vorName: frei ? vorName : undefined,
	};
};

const mitSchritt = (titel: string, name: string | undefined) => (name ? `${titel}: ${name}` : titel);

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
		struktur.aktiv && docJetzt
			? (p: Pruefpunkt) =>
					p.code === 'aussen'
						? holeInSeiteAus(docJetzt, struktur.aendereAttribute, p)
						: einfuegen.verschiebe(docJetzt, p.seite)
			: undefined;
	return { docJetzt, einfuegen, slash, verschiebeUeberlauf };
};

const versionenWerte = (
	daten: { versionen: VersionEintrag[] } | null | undefined,
	vorschau: { version: { id: string } } | null,
) => ({ versionen: daten?.versionen ?? null, gewaehlt: vorschau?.version.id ?? null });

/** „An Claude schicken: …“ in der Palette füllt das Feld der Blase an der Auswahl (134). */
const anClaudeWenn = (verfuegbar: boolean, fuelle: (text: string) => void) =>
	verfuegbar ? { titel: (text: string) => `An Claude schicken: ${text}`, aus: fuelle } : undefined;

const KopfMitte = ({
	dokument,
	fuehreAus,
	loesung,
	mitLoesung,
	profil,
}: {
	dokument: DokumentEintrag;
	fuehreAus: (id: string) => unknown;
	loesung: boolean;
	mitLoesung: boolean;
	profil: Druckprofil | undefined;
}) => (
	<>
		{mitLoesung && (
			<Segment
				beschriftung="Was zeigen?"
				werte={[
					{ wert: 'material', titel: materialName(dokument) },
					{ wert: 'loesung', titel: 'Lösung' },
				]}
				wert={loesung ? 'loesung' : 'material'}
				waehle={(w) => fuehreAus(w === 'loesung' ? 'ansicht.loesung' : 'ansicht.arbeitsblatt')}
			/>
		)}
		<ProfilSchalter profil={profil} waehle={(p) => fuehreAus(p === 'sw' ? 'ansicht.sw' : 'ansicht.farbe')} />
	</>
);

/** Was das Blatt sperrt: die Vorschau einer Version, ein Konflikt beim Speichern, ein neues Blatt von Claude (133). */
const sperreDesBlatts = (vorschau: boolean, konflikt: boolean, entwurf: boolean) => ({
	frei: !vorschau && !konflikt && !entwurf,
	nurAnsehen: vorschau || entwurf,
});

const Bearbeitung = ({ dokument, mappe: mappenDaten }: { mappe: Mappe; dokument: DokumentEintrag }) => {
	const { id: dok, meta } = dokument;
	const mappe = mappenDaten.id;
	const zugang = useMemo(() => ({ mappe, token: null }), [mappe]);
	const navigate = useNavigate();
	const zeige = useHinweis();
	const [suche, setSuche] = useSearchParams();
	const [auswahl, setAuswahl] = useState<number | null>(null);
	const auswahlJetzt = useRef(auswahl);
	useEffect(() => {
		auswahlJetzt.current = auswahl;
		folgeAuswahl(auswahl); // 113: eine andere Hauptauswahl (Klick ohne ⇧, Esc, Rückgängig …) leert die Mehrfachauswahl
	}, [auswahl]);
	const mehrfach = useMehrfach(); // 113: Die weiteren Elemente der Mehrfachauswahl liegen außerhalb von React; neu zeichnen, wenn sie sich ändern
	const b = useBearbeitung(mappe, dok, auswahlJetzt);
	const { alles, stand } = b.speicher;
	const [geladen, setGeladen] = useState<Geladen | null>(null);
	const panels = usePanels(suche.get('neu') === '1');
	// Leiste, Spalten und Blatt, ohne Inspektor; gemessen vor dem ersten Bild, damit das iPad beim Laden nicht springt.
	const bereichRef = useRef<HTMLDivElement>(null);
	const [bereich, setBereich] = useState(Infinity);
	useLayoutEffect(() => {
		const element = bereichRef.current;
		if (!element) {
			return undefined;
		}
		const miss = () => setBereich(element.clientWidth);
		miss();
		const beobachter = new ResizeObserver(miss);
		beobachter.observe(element);
		return () => beobachter.disconnect();
	}, [b.ladeFehler]);
	const [tastenOffen, setTastenOffen] = useState(false);
	const [paletteOffen, setPaletteOffen] = useState(false);
	const [zumBlatt, setZumBlatt] = useState(0);
	const [umriss, setUmriss] = useState<number | null>(null);
	const claudeApp = useClaudeApp();
	const handlungen = useRef<ClaudeHandlungen>({
		vorbereiten: () => Promise.resolve(),
		holeZitat: () => '',
		zumBlatt: () => undefined,
		annimm: () => Promise.resolve(),
		zurApp: () => undefined,
	});
	const [schnellWunsch, setSchnellWunsch] = useState<{ n: number; nr: number | null }>({ n: 0, nr: null });
	const ansicht = useRef<HTMLElement>(null);
	const ki = useKiZustand();
	const entwurf = useEntwurf({ mappe, dok, nachLauf: ki.neu, annimm: b.annimm });
	const entwurfKarte = useRef<HTMLDivElement>(null);
	const [vorschau, setVorschau] = useState<{ version: VersionEintrag; quelle: string } | null>(null);
	const [zoom, setZoomWert] = useState<ZoomWert>(gemerkterZoom);
	const [skala, setSkala] = useState(1);
	const setZoom = (wert: number | 'einpassen') => {
		setZoomWert(wert);
		merkeZoom(wert);
	};
	const versionen = useLaden<{ versionen: VersionEintrag[] }>(`${b.adresse}/versionen`);
	const { neuLaden: versionenNeu } = versionen;

	const format = formatVon(b.verlauf, meta.format);
	const quelle = b.verlauf?.quelle ?? null;
	useTitel(`${meta.titel} bearbeiten`);
	const sperre = sperreDesBlatts(vorschau !== null, b.konflikt !== null, entwurf.sperrt);
	const sichtbareSeite = useRef<() => number | null>(() => null);
	const claude = useClaude({
		mappe,
		dok,
		auswahl,
		waehle: setAuswahl,
		seite: () => sichtbareSeite.current(),
		frei: sperre.frei,
		handlungen,
		ki,
	});
	// Ein offener Vorschlag am Element steht gestrichelt im Blatt, schreibgeschützt (134).
	const anzeige = vorschau?.quelle ?? entwurf.zeigt(claude.zeigt ?? quelle);
	const basis = `/ansicht/${mappe}/dokumente/${dok}/`;
	const { profil, waehle: waehleProfil } = useAnsichtsProfil({ mappe, token: null }, dok, meta);
	const { html, loesung, mitLoesung, zerlegung, zerlegungZu } = useDarstellung(
		anzeige,
		basis,
		suche.get('fassung') === 'loesung',
		Boolean(meta.hatLoesung),
		profil,
	);
	const pfad = useMemo(() => (geladen && auswahl !== null ? pfadZu(geladen.doc, auswahl) : []), [geladen, auswahl]);
	// Bei Mehrfachauswahl heißt der Titel im Inspektor „N Elemente“, nicht wie das zuletzt gewählte Element.
	const inspektorPfad = useMemo(() => {
		const letzter = pfad.at(-1);
		const n = geladen && letzter && mehrfach.haupt === letzter.nr ? nrnFuer(geladen.doc, letzter.nr).length : 1;
		return letzter && n > 1 ? [...pfad.slice(0, -1), { ...letzter, name: `${n} Elemente` }] : pfad;
	}, [geladen, mehrfach, pfad]);
	// Das neue Bild und die Auswahl, die darauf gewartet hat, wechseln im selben Render (`struktur.nachBild`).
	const nachBild = useRef<(doc: Document, z: Zerlegung, frisch: boolean) => void>(() => undefined);
	const htmlJetzt = useRef(html);
	useEffect(() => {
		htmlJetzt.current = html;
	}, [html]);
	const merken = useCallback(
		(d: Document, h: string) => {
			const z = zerlegungZu(h);
			if (z) {
				setGeladen({ doc: d, html: h, zerlegung: z });
				nachBild.current(d, z, h === htmlJetzt.current);
			}
		},
		[zerlegungZu],
	);

	const frei = sperre.frei && claude.zeigt === null;
	const eng = istEng(bereich, panels.stand.schublade);
	const zeigt = angezeigt(panels.stand, eng, (id) => schubladeVon(id)?.bereit({ frei }) ?? false);
	const { nurAnsehen } = sperre;
	const pruefung = usePruefung({ geladen, html, zerlegung, ausgang: b.ausgang, aus: vorschau !== null });
	const schrittWeg = useRef<(richtung: 'zurueck' | 'vor') => void>(() => undefined);
	const geschichte = useCallback((richtung: 'zurueck' | 'vor') => schrittWeg.current(richtung), []);
	const text = useText({
		geschichte,
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

	const { quelleJetzt, rueckgaengig, wiederholen } = b;
	const { beende: beendeText } = text;
	/**
	 * Erst wird Offenes zu einem Schritt, und die neue Quelle muss gerendert sein. Sonst entstünde sofort wieder das HTML
	 * von vorher, der Rahmen würde nicht neu geladen und zeigte weiter den getippten Text. Darum gilt auch das gezeigte
	 * Dokument nicht mehr, bis die Fassung nach dem Schritt da ist.
	 */
	const schliesseOffenes = useCallback(() => {
		const vorher = quelleJetzt();
		flushSync(() => {
			beendeText();
			loeseFeld(document.activeElement);
		});
		if (quelleJetzt() !== vorher) {
			setGeladen(null);
		}
	}, [beendeText, quelleJetzt]);
	const zurueck = useCallback(() => {
		schliesseOffenes();
		rueckgaengig();
	}, [rueckgaengig, schliesseOffenes]);
	const vor = useCallback(() => {
		schliesseOffenes();
		wiederholen();
	}, [schliesseOffenes, wiederholen]);

	const struktur = useStruktur({
		geladen,
		html,
		zerlegung,
		verlauf: b.verlauf,
		pfad,
		setAuswahl,
		befehl: b.befehl,
		rueckgaengig: zurueck,
		folien: format === 'folie',
		frei,
		bearbeitet: text.bearbeitet,
	});
	const sicht = zuSehen(struktur.gezeigt);
	useEffect(() => {
		nachBild.current = struktur.nachBild;
	}, [struktur.nachBild]);

	const gliederungStand = useGliederungStand(sicht.zerlegung, auswahl);

	const bild = useBild({ pfad, struktur, adresse: b.adresse, basis, rueckgaengig: zurueck });

	const abbildung = useAbbildung({ pfad, struktur, adresse: b.adresse, basis });

	const loes = useLoesung({ pfad, struktur, loesung, rueckgaengig: zurueck });

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
	useBildAusFinder({ doc: docJetzt, struktur, bild, einfuegen, folien: format === 'folie' });
	useEffect(() => beobachteFelder(window), []);

	const zeigePunkt = useZeigePunkt({ loesung, geladen, html, zeigeAn: struktur.zeigeAn, setSuche });
	const seite = useSichtbareSeite(geladen, ansicht, skala);
	sichtbareSeite.current = () => (docJetzt ? seiteAn(docJetzt, seite.nr) : null);

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
			claudeGrund: claude.knopfGrund,
			namenszeile: zerlegung ? hatNamenszeile(zerlegung) : false,
			festeSeiten: format === 'minibuch',
			hatBild: bild.nimmtBild,
			linksOffen: sichtbar(zeigt),
			gestaltung: gestaltungKontext({ doc: docJetzt, pfad, struktur }),
			davor: (() => {
				const element = docJetzt && auswahl !== null ? elementZu(docJetzt, auswahl) : null;
				const vorher = element?.previousElementSibling;
				return vorher && bausteinVon(vorher) ? nrVon(vorher) : null;
			})(),
			feldBehaeltUndo: () => behaeltUndo(document.activeElement),
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
						zeige({
							text: 'Hier gibt es gerade keine neuen Zahlen. Bei Sprüngen und Fehleraufgaben hängen die Zahlen zusammen.',
						});
					}
					return geklappt;
				},
				claudeApp: () => handlungen.current.zurApp(auswahl),
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
					const ziel = naechsteStufe(skala, richtung);
					if (ziel !== undefined) {
						setZoom(ziel);
					}
				},
				zoom100: () => setZoom(1),
				einpassen: () => setZoom('einpassen'),
				links: (id) => panels.schalteLinks(id, zeigt, eng),
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
				claude: () => {
					const grund = claude.taste();
					if (grund) {
						zeige({ text: grund });
					}
				},
				claudeZurAuswahl: () => claude.oeffne(),
				palette: () => {
					text.halte(true);
					setPaletteOffen(true);
				},
				tasten: () => setTastenOffen(true),
				rueckgaengig: zurueck,
				wiederholen: vor,
				speichern: () => zeige({ text: 'Wird automatisch gespeichert.' }),
				pdf: () => document.querySelector<HTMLElement>('[data-pdf-knopf] button')?.click(),
				drucken: () => void verlassen(druckSeite(zugang, dok, loesung ? 'loesung' : 'arbeitsblatt', profil)),
				praesentieren: () => void verlassen(praesentationSeite(zugang, dok)),
				zurueck: () => void verlassen(dokumentSeite(zugang, dok)),
				hilfe: () => void verlassen('/hilfe'),
			},
		},
		useCallback((inhalt: string) => zeige({ text: inhalt }), [zeige]),
	);

	const { fuehreAus: befehlAusfuehren } = befehle;
	useEffect(() => {
		schrittWeg.current = (richtung) =>
			befehlAusfuehren(richtung === 'zurueck' ? 'dokument.rueckgaengig' : 'dokument.wiederholen');
	}, [befehlAusfuehren]);

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
				// Zoom-Tasten nie an den Browser: Sonst zoomt bei offenem Menü die ganze Oberfläche (56).
				if (istZoomTaste(e)) {
					e.preventDefault();
				}
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
			} else if (istZoomTaste(e)) {
				e.preventDefault();
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
			annimm: b.annimm,
			zurApp: (nr) => claudeApp.frage({ zerlegung, ort, loesung, nachher: () => void alles(), nr }),
		};
	});
	const adresse = ansichtAdresse(zugang, dok, loesung, profil);
	// Die Blase findet ihre Elemente nur in der Quelle selbst wieder, nicht in einem gezeigten Vorschlag.
	const claudeLage = useMemo(
		() => (zerlegung ? { z: zerlegung, ort, loesung, echt: anzeige === quelle } : null),
		[anzeige, loesung, ort, quelle, zerlegung],
	);
	const { setzeLage } = claude;
	useEffect(() => setzeLage(claudeLage), [claudeLage, setzeLage]);
	const darstellung = useMemo(() => ({ basis, loesung, profil }), [basis, loesung, profil]);

	if (b.ladeFehler) {
		return <Fehlt fehler={b.ladeFehler} />;
	}

	const ohneAuswahl = (
		<Blattwerkzeug
			aktiv={frei}
			doc={sicht.doc}
			quelle={sicht.quelle}
			seite={{ auswahl, sichtbar: seite.nr }}
			struktur={struktur}
			ueberlauf={ueberlaufendeSeiten(pruefung.stand)}
			loesung={loesung ? <Loesungsuebersicht l={loes} /> : null}
		/>
	);
	const panelInhalt = {
		versionen: (
			<>
				<h2 className="mb-2 text-base font-semibold">Versionen</h2>
				<Versionen {...versionenWerte(versionen.daten, vorschau)} waehle={(v) => void zeigeVersion(v)} />
			</>
		),
		inspektor: (
			<Inspektor
				pfad={inspektorPfad}
				waehle={setAuswahl}
				umriss={setUmriss}
				blatt={ohneAuswahl}
				zumBlatt={zumBlatt}
			>
				<Einstellungen
					pfad={pfad}
					quelle={sicht.quelle}
					format={format}
					frei={frei}
					doc={sicht.doc}
					geladen={geladen}
					struktur={struktur}
					ablage={ablage}
					abb={abbildung}
					bild={bild}
					loes={loes}
					loesung={loesung}
					schalteAnsicht={() => befehle.fuehreAus(loesung ? 'ansicht.arbeitsblatt' : 'ansicht.loesung')}
					text={text}
					pruefung={pruefung.stand}
				/>
			</Inspektor>
		),
	};
	const { kannVor, kannZurueck, vorName, zurueckName } = schritte(b.verlauf, frei, text.zustand.geaendert);

	const schubladenTeile: SchubladenTeile = {
		doc: sicht.doc,
		zerlegung: sicht.zerlegung,
		auswahl,
		struktur,
		einfuegen,
		bild,
		mappe: mappenDaten,
		art: meta.art,
		folien: format === 'folie',
		gliederungStand,
		festeSeiten: format === 'minibuch',
		zeigeAn: (nr) => {
			struktur.zeigeAn(nr);
			panels.setRechts('inspektor');
			panels.setRechtsOffen(true);
		},
		kontextmenue: menueAn,
		zeigeSeitengestaltung: (nr, teil) => zeigeBlattGestaltung(nr, teil, struktur.zeigeAn, zeigeEinstellung),
	};

	const leinwandMenue = (treffer: { nr: number; art: string } | null, punkt: { x: number; y: number }) =>
		menueAn(treffer?.nr ?? null, !treffer || treffer.art === 'seite' ? 'leer' : 'baustein', punkt);
	const kopfMitte = (
		<KopfMitte
			dokument={dokument}
			fuehreAus={befehle.fuehreAus}
			loesung={loesung}
			mitLoesung={mitLoesung}
			profil={profil}
		/>
	);
	return (
		<ClaudeKontext.Provider value={claude.steuerung}>
			<div className="flex h-dvh flex-col bg-papier" data-editor>
				<Kopfleiste
					mappe={mappenDaten.titel}
					titel={meta.titel}
					stand={<Speicheranzeige stand={stand} erneut={() => void b.speicher.speichere()} />}
					verlassen={() => befehle.fuehreAus('dokument.zurueck')}
					mitte={kopfMitte}
				>
					<EntwurfPille
						entwurf={entwurf}
						zurKarte={() => {
							ansicht.current?.scrollTo({ top: 0, behavior: 'smooth' });
							entwurfKarte.current?.focus({ preventScroll: true });
						}}
					/>
					<SymbolKnopf
						symbol="rueckgaengig"
						beschriftung="Rückgängig"
						tooltip={mitSchritt('Rückgängig', zurueckName)}
						kuerzel={kuerzelVon('dokument.rueckgaengig')}
						disabled={!kannZurueck}
						data-schritt={zurueckName}
						onClick={() => befehle.fuehreAus('dokument.rueckgaengig')}
						{...halteFokus}
					/>
					<SymbolKnopf
						symbol="wiederholen"
						beschriftung="Wiederholen"
						tooltip={mitSchritt('Wiederholen', vorName)}
						kuerzel={kuerzelVon('dokument.wiederholen')}
						disabled={!kannVor}
						data-schritt={vorName}
						onClick={() => befehle.fuehreAus('dokument.wiederholen')}
						{...halteFokus}
					/>
					<Trenner />
					<KopfKnopf
						name="Versionen"
						titel="Versionen"
						symbol="uhr"
						aktiv={panels.rechts === 'versionen' && panels.rechtsOffen}
						aktion={() => befehle.fuehreAus('ansicht.versionen')}
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
						freitext={anClaudeWenn(ki.zustand.verfuegbar, claude.fuelle)}
						eintraege={eintraegeImEditor(befehle.jetzt.current, {
							posten: einfuegen.eintraege,
							fuegeEin: (p) =>
								einfuegen.fuegeEin(p, auswahl ?? (docJetzt ? seiteAn(docJetzt, seite.nr) : null)),
							zeigeSeite: (nr) => {
								const ziel = docJetzt ? seiteAn(docJetzt, nr) : null;
								if (ziel !== null) {
									struktur.zeigeAn(ziel);
								}
							},
							zeigeEinstellung,
							fuehreAus: befehle.fuehreAus,
							schubladen: { teile: schubladenTeile, fuehreAus: befehle.fuehreAus },
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

				<div className="flex min-h-0 flex-1 max-lg:flex-col">
					<div ref={bereichRef} className="flex min-h-0 min-w-0 flex-1">
						<Schubladen
							zeigt={zeigt}
							lage={{ frei }}
							grund={entwurf.grund}
							teile={schubladenTeile}
							waehle={(id: SchubladenId) => befehle.fuehreAus(`ansicht.links-${id}`)}
						/>
						<main
							ref={ansicht}
							className="min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y overflow-y-auto bg-leinwand"
						>
							<Entwurfsleiste entwurf={entwurf} />
							<EntwurfKarte entwurf={entwurf} ki={ki} titel={meta.titel} karte={entwurfKarte} />
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
									meldeSkala={setSkala}
									setzeZoom={setZoom}
									taste={taste}
									textsitzung={text.bearbeitet}
									kontextmenue={leinwandMenue}
									geladen={merken}
									nurAnsehen={nurAnsehen}
									ziehbar={struktur.aktiv}
									ablegen={struktur.verschiebe}
									jeSeite={format === 'folie'}
									einblendung={(e) => (
										<>
											{frei && (
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
														quelle={sicht.quelle}
														format={format}
														struktur={struktur}
														befehle={befehle}
														text={text}
														abb={abbildung}
														bild={bild}
														loes={loes}
														waehle={setAuswahl}
													/>
													<GestaltungUeberlagerung
														e={e}
														pfad={pfad}
														struktur={struktur}
														waehle={setAuswahl}
														textsitzung={text.bearbeitet}
													/>
													<GestaltungLeiste
														e={e}
														pfad={pfad}
														quelle={sicht.quelle}
														struktur={struktur}
														befehle={befehle}
														sitzung={text.bearbeitet}
													/>
													<Werkzeugflaeche
														e={e}
														struktur={struktur}
														folien={format === 'folie'}
													/>
												</>
											)}
											<ClaudeSchicht
												e={e}
												claude={claude}
												jetzt={quelle}
												darstellung={darstellung}
												adresse={adresse}
											/>
										</>
									)}
									springe={struktur.springe}
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
							<div
								className={klassen(
									'min-h-0 flex-1 overflow-y-auto',
									panels.rechts !== 'inspektor' && 'p-3',
								)}
							>
								<SperrHinweis grund={entwurf.grund} sichtbar={panels.rechts === 'inspektor'} />
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
					skala={skala}
					fuehreAus={befehle.fuehreAus}
					linksOffen={sichtbar(zeigt).length > 0}
					schalteLinks={() => panels.schalteLeiste(zeigt)}
					rechtsOffen={panels.rechtsOffen}
					setRechtsOffen={panels.setRechtsOffen}
					claude={claude.lauf}
					zeigeClaude={() => claude.zeigeLauf(struktur.zeigeAn)}
				/>
			</div>
		</ClaudeKontext.Provider>
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
