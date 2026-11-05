import type { Einordnung } from '@schoolbox/kern/src/einordnung';
import { FACH_NAME } from '@schoolbox/kern/src/namen';
import { erzeugeReferenz } from '@schoolbox/kern/src/referenz';
import type { Art } from '@schoolbox/kern/src/werte';
import { FORMAT_NAME } from '@schoolbox/kern/src/werte';
import type { KeyboardEvent, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { meldung } from '../api';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import type { MenueEintrag } from '../bausteine/Menue';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { klasseName } from '../lib/text';
import { useAblage } from '../ordner/kontext';
import type { ChatFensterZustand, ChatKontext, ChatLauf } from './chat-kontext';
import type { ChatNachricht } from './chat-verlauf';
import { liesVerlauf, schreibeVerlauf, verlaufFuerServer, verlaufSchluessel } from './chat-verlauf';
import type { PfadTeil } from './darstellung';
import type { KiAuftrag, useKiZustand, Vorschlag } from './ki';
import { limitHinweis, useKiAuftrag } from './ki';
import { TEXTWERKZEUG } from './text';
import type { NeuMaterial, NeuStand } from './useNeuMaterial';
import { Vergleich } from './Vergleich';

const NEU_ENTWURF = 'neu-entwurf';
const ABSTAND_UNTEN = 6;
const SCHMAL_AB = 1100;
const FELD_MAX = 120;

const CHIP =
	'inline-flex h-[22px] max-w-56 flex-none items-center gap-1 rounded-md bg-brand-50 px-1.5 text-xs font-medium text-brand-700 [@media(any-pointer:coarse)]:h-11';

/** Ankert das Fenster über dem Blatt und über der Bildschirmtastatur des iPads. */
const useLage = (anker: RefObject<HTMLElement | null> | null) => {
	const [lage, setLage] = useState({ left: 0, width: 600, bottom: 10 });
	useLayoutEffect(() => {
		const element = anker?.current ?? null;
		const sicht = window.visualViewport;
		const miss = () => {
			const tastatur = sicht ? Math.max(0, window.innerHeight - sicht.height - sicht.offsetTop) : 0;
			const r = element?.getBoundingClientRect() ?? {
				left: 0,
				width: window.innerWidth,
				bottom: window.innerHeight,
			};
			const width = window.innerWidth < SCHMAL_AB ? r.width - 16 : Math.min(600, r.width - 32);
			setLage({
				left: r.left + (r.width - width) / 2,
				width,
				bottom: Math.max(tastatur, window.innerHeight - r.bottom) + ABSTAND_UNTEN,
			});
		};
		miss();
		const beobachter = new ResizeObserver(miss);
		if (element) {
			beobachter.observe(element);
		}
		window.addEventListener('resize', miss);
		sicht?.addEventListener('resize', miss);
		sicht?.addEventListener('scroll', miss);
		return () => {
			beobachter.disconnect();
			window.removeEventListener('resize', miss);
			sicht?.removeEventListener('resize', miss);
			sicht?.removeEventListener('scroll', miss);
		};
	}, [anker]);
	return lage;
};

const umfangVon = (ziel: number | null, pfad: PfadTeil[]) => {
	if (ziel === null) {
		return 'blatt' as const;
	}
	return ziel === pfad[0]?.nr ? ('seite' as const) : ('baustein' as const);
};

/** „Uhr · Aufgabe 1“: der Baustein und die Aufgabe drum herum, sonst die Seite. */
const chipText = (ziel: number | null, pfad: PfadTeil[]) => {
	const stelle = pfad.findIndex((t) => t.nr === ziel);
	const teil = pfad[stelle];
	if (!teil) {
		return 'Ganzes Blatt';
	}
	const davor = pfad.slice(0, stelle);
	const drumherum = davor.findLast((t) => t.name.startsWith('Aufgabe')) ?? davor[0];
	return drumherum ? `${teil.name} · ${drumherum.name}` : teil.name;
};

const Sprechblase = ({ n }: { n: ChatNachricht }) =>
	n.rolle === 'lehrkraft' ? (
		<div className="ml-auto max-w-[85%] rounded-lg bg-tinte/6 px-2 py-1" data-chat-nachricht="lehrkraft">
			{n.kontext && <p className="text-xs text-leise">{n.kontext}</p>}
			<p className="whitespace-pre-line">{n.text}</p>
		</div>
	) : (
		<p className="whitespace-pre-line" data-chat-nachricht="claude">
			{n.text}
		</p>
	);

const VorschlagKarte = ({
	imEditor,
	neuStarten,
	v,
	vergleichen,
	verwerfen,
	zeigeText,
}: {
	v: Vorschlag;
	zeigeText: boolean;
	/** Außerhalb des Editors: dort geht es weiter. */
	imEditor: (() => void) | null;
	vergleichen: () => void;
	verwerfen: () => void;
	neuStarten: () => void;
}) => (
	<div className="rounded-lg border border-tinte/15 bg-white/50 p-2.5" data-ki-vorschlag>
		<p className="font-semibold">Vorschlag</p>
		<p className="text-xs text-leise">
			{`${v.umfang} · ${v.meldungen.length === 0 ? 'Prüfung ohne Befund' : `${v.meldungen.length} Hinweise der Prüfung`}`}
		</p>
		{zeigeText && v.antwort && <p className="mt-1 whitespace-pre-line">{v.antwort}</p>}
		{v.meldungen.length > 0 && (
			<ul className="mt-1 list-disc pl-5" data-ki-meldungen>
				{v.meldungen.map((m) => (
					<li key={`${m.seite}-${m.text}`}>{`Seite ${m.seite}: ${m.text}`}</li>
				))}
			</ul>
		)}
		{v.konflikt && (
			<p role="alert" className="mt-1 font-medium">
				Das Blatt wurde seit dem Auftrag geändert. Starte den Auftrag bitte neu.
			</p>
		)}
		<div className="mt-2 flex flex-wrap gap-1.5">
			{v.konflikt && <Knopf onClick={neuStarten}>Neu starten</Knopf>}
			{!v.konflikt && imEditor && <Knopf onClick={imEditor}>Im Editor ansehen</Knopf>}
			{!v.konflikt && !imEditor && (
				<Knopf onClick={vergleichen}>
					<Symbol name="seiten" />
					Vergleichen
				</Knopf>
			)}
			<Knopf art="zweit" onClick={verwerfen}>
				Verwerfen
			</Knopf>
		</div>
	</div>
);

const NEU_NAME: Record<Art, string> = {
	arbeitsblatt: 'Neues Arbeitsblatt',
	klassenarbeit: 'Neue Klassenarbeit',
	lernzielkontrolle: 'Neue Lernzielkontrolle',
	lesetext: 'Neuer Lesetext',
	lernspiel: 'Neues Lernspiel',
	karten: 'Neue Karten',
	lernplakat: 'Neues Lernplakat',
	praesentation: 'Neue Präsentation',
	stationen: 'Neue Stationen',
	unterrichtsplanung: 'Neue Unterrichtsplanung',
	sonstiges: 'Neues Material',
};

const ortText = (ordner: Einordnung['ordner']) =>
	ordner ? `Ablage: ${ordner.pfad}${ordner.vorhanden ? ' (gibt es schon)' : ''}` : 'Ablage: Mein Material';

/** Erst die Karte, dann der teure Lauf (077). Ein Tippfehler kostet so keine Minuten. */
const NeuKarte = ({
	neu,
	stand,
	warnung,
}: {
	neu: NeuMaterial;
	stand: Exclude<NeuStand, { phase: 'ordnet' }>;
	warnung: string | null;
}) => {
	const { art, fach, format, klasse, ordner, rueckfall, titel } = stand.einordnung;
	const belegt = stand.phase === 'legtAn';
	return (
		<div className="rounded-lg border border-tinte/15 bg-white/50 p-2.5" data-chat-neu>
			<p className="flex items-center gap-1.5 font-semibold">
				<Symbol name="blatt" />
				{NEU_NAME[art]}
			</p>
			<p className="text-xs text-leise">
				{`${titel} · ${FORMAT_NAME[format]} · ${FACH_NAME[fach]} · ${klasseName(klasse)}`}
			</p>
			<p className="text-xs text-leise" data-chat-neu-ort>
				{ortText(ordner)}
			</p>
			{rueckfall && <p className="mt-1 font-medium">Bitte kurz prüfen.</p>}
			<p className="mt-1 text-xs text-leise">
				Verbraucht deutlich mehr als eine Änderung und dauert einige Minuten.
			</p>
			{warnung && <p className="mt-1 text-xs font-medium">{warnung}</p>}
			{stand.fehler && (
				<p role="alert" className="mt-1 font-medium">
					{stand.fehler}
				</p>
			)}
			<div className="mt-2 flex flex-wrap gap-1.5">
				<Knopf disabled={belegt} onClick={() => void neu.anlegen()}>
					{belegt ? 'Wird angelegt …' : 'Anlegen ⏎'}
				</Knopf>
				<Knopf art="zweit" disabled={belegt} onClick={neu.aendern}>
					Ändern
				</Knopf>
				<Knopf art="leise" disabled={belegt} onClick={neu.abbrechen}>
					Abbrechen
				</Knopf>
			</div>
		</div>
	);
};

const Lauf = ({
	abbrechen,
	auftrag,
	nachbessern,
}: {
	auftrag: KiAuftrag;
	nachbessern: boolean;
	abbrechen: () => void;
}) => {
	const titel = nachbessern ? 'Claude bessert den Vorschlag nach' : 'Claude arbeitet';
	return (
		<div className="rounded-lg border border-tinte/15 bg-white/50 p-2.5" data-ki-lauf role="status">
			<p className="font-semibold">{auftrag.status === 'wartet' ? 'Wartet auf den vorigen Auftrag' : titel}</p>
			<ul className="text-xs text-leise">
				{auftrag.schritte.map((s) => (
					<li key={s}>{s}</li>
				))}
			</ul>
			<p className="mt-1 text-xs text-leise">
				Wenn du das Blatt jetzt änderst, lässt sich der Vorschlag danach nicht mehr annehmen.
			</p>
			<Knopf art="zweit" className="mt-1.5" onClick={abbrechen}>
				Abbrechen
			</Knopf>
		</div>
	);
};

interface Eigenschaften {
	kontext: ChatKontext;
	neu: NeuMaterial;
	ki: ReturnType<typeof useKiZustand>;
	fenster: ChatFensterZustand;
	setFenster: (f: ChatFensterZustand) => void;
	fokus: number;
	entwurf: string;
	setEntwurf: (t: string) => void;
	zitat: string | null;
	setZitat: (z: string | null) => void;
	sichereZitat: () => void;
	meldeLauf: (l: ChatLauf | null) => void;
	meldeVerlaufHoehe: (h: number) => void;
}

/**
 * Das schwebende Fenster über dem Blatt (074): Nachricht, Antwort, Vorschlag. Geändert wird nur über „Annehmen“ im
 * Vergleich (Entscheidungen 24, 25).
 */
/** Was der Kontext vorgibt. Außerhalb des Editors gibt es keine Auswahl und nichts, was Claude sperrt. */
const ausKontext = (kontext: ChatKontext) => {
	const dokument = kontext.art === 'dokument' ? kontext : null;
	return {
		dokument,
		dok: kontext.art === 'neu' ? null : kontext.dok,
		frei: dokument ? dokument.frei : true,
		nr: dokument ? dokument.nr : null,
		pfad: dokument?.pfad,
		anker: dokument?.anker ?? null,
	};
};

const useVerlauf = (schluessel: string) => {
	const [verlauf, setWert] = useState(() => liesVerlauf(localStorage, schluessel));
	const setVerlauf = useCallback(
		(aendere: (alt: ChatNachricht[]) => ChatNachricht[]) =>
			setWert((alt) => {
				const stand = aendere(alt);
				schreibeVerlauf(localStorage, schluessel, stand);
				return stand;
			}),
		[schluessel],
	);
	return [verlauf, setVerlauf] as const;
};

/** Das Blatt rollt am Fenster vorbei, bis zum letzten Baustein. Die Höhe gilt für Rand, Leiste und Einpassen. */
const useChatPlatz = (
	flaeche: RefObject<HTMLElement | null>,
	offen: boolean,
	fenster: ChatFensterZustand,
	nr: number | null,
	meldeVerlaufHoehe: (hoehe: number) => void,
) => {
	const [hoehe, setHoehe] = useState(0);
	useEffect(() => {
		const el = flaeche.current;
		const wurzel = document.documentElement.style;
		if (!el) {
			wurzel.removeProperty('--chat-platz');
			setHoehe(0);
			return undefined;
		}
		const beobachter = new ResizeObserver(() => {
			wurzel.setProperty('--chat-platz', `${el.offsetHeight + 16}px`);
			setHoehe(el.offsetHeight);
		});
		beobachter.observe(el);
		return () => {
			beobachter.disconnect();
			wurzel.removeProperty('--chat-platz');
		};
	}, [flaeche, offen]);

	useEffect(() => {
		meldeVerlaufHoehe(fenster === 'verlauf' ? hoehe : 0);
		return () => meldeVerlaufHoehe(0);
	}, [fenster, hoehe, meldeVerlaufHoehe]);

	useEffect(() => {
		const rahmen = document.querySelector('[data-auswahlrahmen]');
		const el = flaeche.current;
		if (!rahmen || !el) {
			return;
		}
		const a = rahmen.getBoundingClientRect();
		const c = el.getBoundingClientRect();
		if (a.bottom > c.top && a.top < c.bottom) {
			rahmen.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}, [flaeche, nr, hoehe]);
};

/** Was unten im Editor steht, wenn der Chat zu ist. */
const useLaufMeldung = (
	laeuft: boolean,
	bereit: boolean,
	ungelesen: boolean,
	meldeLauf: (lauf: ChatLauf | null) => void,
) => {
	const [seit, setSeit] = useState(0);
	useEffect(() => {
		if (laeuft) {
			setSeit((s) => s || Date.now());
		} else {
			setSeit(0);
		}
	}, [laeuft]);

	useEffect(() => {
		if (laeuft) {
			meldeLauf({ art: 'arbeitet', seit });
		} else if (bereit) {
			meldeLauf({ art: 'bereit', seit: 0 });
		} else {
			meldeLauf(ungelesen ? { art: 'antwort', seit: 0 } : null);
		}
	}, [bereit, laeuft, meldeLauf, seit, ungelesen]);
	useEffect(() => () => meldeLauf(null), [meldeLauf]);
};

type KiAuftragStand = ReturnType<typeof useKiAuftrag>;

const antwortVon = (auftrag: KiAuftrag, vorschlag: Vorschlag | null) => {
	if (auftrag.status === 'abgebrochen') {
		return 'Abgebrochen.';
	}
	return auftrag.ergebnis === 'antwort' ? auftrag.antwort : vorschlag?.antwort;
};

interface AuftragsEnde {
	auftrag: KiAuftrag | null;
	laeuft: boolean;
	vorschlag: Vorschlag | null;
	fenster: ChatFensterZustand;
	setFenster: (fenster: ChatFensterZustand) => void;
	setUngelesen: (ungelesen: boolean) => void;
	setVerlauf: ReturnType<typeof useVerlauf>[1];
}

/** Das Ende eines Laufs einmal in den Verlauf schreiben, ganz gleich, wie es hier ankam. */
const useAuftragsEnde = ({
	auftrag,
	fenster,
	laeuft,
	setFenster,
	setUngelesen,
	setVerlauf,
	vorschlag,
}: AuftragsEnde) => {
	const erledigt = useRef(new Set<string>());
	useEffect(() => {
		if (!auftrag || laeuft || erledigt.current.has(auftrag.id)) {
			return;
		}
		erledigt.current.add(auftrag.id);
		const text = antwortVon(auftrag, vorschlag);
		if (text) {
			setVerlauf((alt) => [
				...alt,
				{ rolle: 'claude', text, kontext: null, zeit: new Date().toISOString(), auftragId: auftrag.id },
			]);
		}
		if (auftrag.status === 'fertig' || auftrag.status === 'fehler') {
			if (fenster === 'zu') {
				setUngelesen(auftrag.ergebnis === 'antwort');
			} else {
				setFenster('verlauf');
			}
		}
	}, [auftrag, fenster, laeuft, setFenster, setUngelesen, setVerlauf, vorschlag]);
};

interface VerlaufBereichEigenschaften {
	auftragKi: KiAuftragStand;
	hinweisText: string | null;
	imEditor: (() => void) | null;
	leerGeblieben: boolean;
	liste: RefObject<HTMLDivElement | null>;
	neu: NeuMaterial;
	limitGesperrt: boolean;
	neuStarten: () => void;
	schliessen: () => void;
	einklappen: () => void;
	vergleichen: () => void;
	verlauf: ChatNachricht[];
	verwerfen: () => void;
}

const VerlaufBereich = ({
	auftragKi,
	einklappen,
	hinweisText,
	imEditor,
	leerGeblieben,
	liste,
	neu,
	neuStarten,
	limitGesperrt,
	schliessen,
	vergleichen,
	verlauf,
	verwerfen,
}: VerlaufBereichEigenschaften) => {
	const { auftrag, fehler, laeuft, vorschlag } = auftragKi;
	const schonGesagt = verlauf.some((n) => n.rolle === 'claude' && n.text === vorschlag?.antwort);
	const neuKarte = neu.stand && neu.stand.phase !== 'ordnet' ? neu.stand : null;
	const hatLehrkraft = verlauf.some((n) => n.rolle === 'lehrkraft');
	return (
		<>
			<div className="flex flex-none items-center justify-between border-b border-tinte/12 py-0.5 pr-1 pl-3">
				<b className="font-semibold">Claude</b>
				<span className="flex items-center">
					<SymbolKnopf
						symbol="runter"
						beschriftung="Verlauf einklappen"
						groesse="klein"
						onClick={einklappen}
					/>
					<SymbolKnopf
						symbol="schliessen"
						beschriftung="Chat schließen"
						groesse="klein"
						onClick={schliessen}
					/>
				</span>
			</div>
			<div ref={liste} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2" data-chat-verlauf>
				{verlauf.map((n, i) => (
					<Sprechblase key={`${n.zeit}-${i}`} n={n} />
				))}
				{laeuft && auftrag && (
					<Lauf
						auftrag={auftrag}
						nachbessern={Boolean(vorschlag && !vorschlag.konflikt)}
						abbrechen={() => void auftragKi.abbrechen()}
					/>
				)}
				{!laeuft && vorschlag && (
					<VorschlagKarte
						v={vorschlag}
						zeigeText={!schonGesagt}
						vergleichen={vergleichen}
						imEditor={imEditor}
						verwerfen={verwerfen}
						neuStarten={neuStarten}
					/>
				)}
				{leerGeblieben && !vorschlag && (
					<p className="text-leise" data-chat-leer>
						Das Blatt bleibt leer im Ordner. Du kannst es selbst füllen oder hier neu beauftragen.
					</p>
				)}
				{fehler && fehler !== hinweisText && (
					<div className="rounded-lg border border-tinte/15 bg-white/50 p-2.5" data-ki-fehler>
						<p role="alert" className="font-medium">
							{fehler}
						</p>
						{hatLehrkraft && !laeuft && !limitGesperrt && (
							<Knopf art="zweit" className="mt-1.5" onClick={neuStarten}>
								Nochmal
							</Knopf>
						)}
					</div>
				)}
				{neu.stand?.phase === 'ordnet' && (
					<p className="text-leise" role="status" data-chat-ordnet>
						Claude ordnet ein …
					</p>
				)}
				{neuKarte && <NeuKarte neu={neu} stand={neuKarte} warnung={hinweisText} />}
			</div>
		</>
	);
};

const Schnellaktionen = ({
	aktionen,
	frei,
	sende,
}: {
	aktionen: { id: string; name: string }[];
	frei: boolean;
	sende: (inhalt: { text: string; aktion: string }) => void;
}) => (
	<div className="flex flex-wrap gap-1 px-2 pt-1.5" data-ki-aktionen>
		{aktionen.map((a) => (
			<button
				type="button"
				key={a.id}
				disabled={!frei}
				className="inline-flex h-5 items-center rounded-full border border-tinte/18 bg-white/40 px-2 text-xs hover:bg-white/70 disabled:opacity-40 [@media(any-pointer:coarse)]:h-11"
				onClick={() => sende({ text: a.name, aktion: a.id })}
			>
				{a.name}
			</button>
		))}
	</div>
);

const MEHR_KNOPF = (
	<Knopf art="leise" groesse="klein" className="size-knopf-klein px-0">
		<Symbol name="mehr" />
	</Knopf>
);

interface EingabeEigenschaften {
	abbrechen: () => void;
	aktionen: { id: string; name: string }[];
	chip: { text: string; stufen: MenueEintrag[] | null };
	entwurf: string;
	feld: RefObject<HTMLTextAreaElement | null>;
	fenster: ChatFensterZustand;
	frei: boolean;
	kannSenden: boolean;
	laeuft: boolean;
	mehr: MenueEintrag[];
	platzhalter: string;
	sende: (inhalt: { text: string; aktion?: string }) => void;
	setEntwurf: (text: string) => void;
	setZitat: (zitat: string | null) => void;
	taste: string;
	titel: string;
	verlaufZeigen: (() => void) | null;
	zitat: string | null;
}

const Eingabe = ({
	abbrechen,
	aktionen,
	chip,
	entwurf,
	feld,
	fenster,
	frei,
	kannSenden,
	laeuft,
	mehr,
	platzhalter,
	sende,
	setEntwurf,
	setZitat,
	taste,
	titel,
	verlaufZeigen,
	zitat,
}: EingabeEigenschaften) => {
	const chipKnopf = (
		<button type="button" className={CHIP} data-chat-chip>
			<span className="truncate">{chip.text}</span>
			<Symbol name="runter" className="size-3 flex-none" />
		</button>
	);
	return (
		<div className={klassen('flex-none', fenster === 'verlauf' && 'border-t border-tinte/12')}>
			{!entwurf && aktionen.length > 0 && <Schnellaktionen aktionen={aktionen} frei={frei} sende={sende} />}
			{zitat && (
				<div className="flex items-center gap-1 px-2 pt-1.5 text-xs text-leise" data-chat-zitat>
					<span className="min-w-0 truncate">{`„${zitat}“`}</span>
					<SymbolKnopf
						symbol="schliessen"
						beschriftung="Markierte Stelle entfernen"
						groesse="klein"
						onClick={() => setZitat(null)}
					/>
				</div>
			)}
			<div className="flex min-h-[34px] items-center gap-1.5 pt-1 pr-1 pb-0.5 pl-2">
				{chip.stufen ? (
					<Menue name="Worauf bezieht sich der Auftrag?" eintraege={chip.stufen} ausloeser={chipKnopf} />
				) : (
					<span className={CHIP} data-chat-chip>
						<span className="truncate">{chip.text}</span>
					</span>
				)}
				<label className="sr-only" htmlFor="ki-auftrag">
					{titel}
				</label>
				<textarea
					id="ki-auftrag"
					ref={feld}
					rows={1}
					maxLength={4000}
					value={entwurf}
					placeholder={platzhalter}
					className="min-w-0 flex-1 resize-none bg-transparent leading-5 outline-none placeholder:text-leise"
					onChange={(e) => setEntwurf(e.target.value)}
				/>
				{verlaufZeigen && (
					<SymbolKnopf symbol="hoch" beschriftung="Verlauf zeigen" groesse="klein" onClick={verlaufZeigen} />
				)}
				<Menue name="Chat: weitere Aktionen" rechtsbuendig eintraege={mehr} ausloeser={MEHR_KNOPF} />
				{laeuft ? (
					<Knopf
						art="zweit"
						groesse="klein"
						aria-label="Abbrechen"
						className="size-knopf-klein rounded-full px-0"
						onClick={abbrechen}
					>
						<Symbol name="schliessen" />
					</Knopf>
				) : (
					<Knopf
						groesse="klein"
						aria-label="Senden"
						className="size-knopf-klein rounded-full px-0"
						disabled={!kannSenden}
						onClick={() => sende({ text: entwurf.trim() })}
					>
						<Symbol name="senden" />
					</Knopf>
				)}
			</div>
			<div className="flex justify-between gap-2 px-2.5 pb-1 text-[11px] leading-[14px] text-leise">
				<span>Keine Namen von Kindern eintragen.</span>
				<span className="flex-none">{`⏎ ${taste} · esc ${fenster === 'verlauf' ? 'einklappen' : 'schließen'}`}</span>
			</div>
		</div>
	);
};

/** Der Stand des Limits am Chat. Auch gesperrt kein toter Zustand: Der Knopf fragt das Konto neu. */
const LimitZeile = ({
	hinweis,
	pruefeLimit,
}: {
	hinweis: NonNullable<ReturnType<typeof limitHinweis>>;
	pruefeLimit: () => Promise<void>;
}) => {
	const [frage, setFrage] = useState<'ruhe' | 'fragt' | 'gefragt'>('ruhe');
	const [fehler, setFehler] = useState<string | null>(null);
	const versuche = async () => {
		setFrage('fragt');
		setFehler(null);
		try {
			await pruefeLimit();
		} catch (grund) {
			setFehler(meldung(grund));
		}
		setFrage('gefragt');
	};
	return (
		<div
			role="status"
			className="flex flex-none items-center justify-between gap-2 border-b border-tinte/12 px-3 py-1 text-xs"
			data-ki-limit={hinweis.art}
		>
			<p>
				{hinweis.text}
				{frage === 'gefragt' && ` ${fehler ?? 'Gerade neu gefragt: Es bleibt noch gesperrt.'}`}
			</p>
			{hinweis.art === 'gesperrt' && (
				<Knopf
					art="zweit"
					groesse="klein"
					className="flex-none"
					disabled={frage === 'fragt'}
					onClick={() => void versuche()}
				>
					Noch einmal versuchen
				</Knopf>
			)}
		</div>
	);
};

const OhneAnmeldung = ({ zurApp }: { zurApp: (() => void) | null }) => (
	<div className="flex flex-col items-start gap-2 p-3" data-chat-ohne-anmeldung>
		<p>
			Auf diesem Server ist Claude nicht angemeldet. Über die Claude-App kannst du trotzdem an diesem Blatt
			arbeiten.
		</p>
		{zurApp && (
			<Knopf onClick={zurApp}>
				<Symbol name="kopieren" />
				In der Claude-App weiterarbeiten
			</Knopf>
		)}
	</div>
);

interface ChipAngaben {
	art: ChatKontext['art'];
	ordner: string | null;
	neuModus: boolean;
	ziel: number | null;
	pfad: PfadTeil[];
}

const chipFuer = ({ art, neuModus, ordner, pfad, ziel }: ChipAngaben) => {
	if (art === 'ansicht') {
		return 'Dieses Dokument';
	}
	if (neuModus) {
		return art === 'neu' && ordner ? 'Neues Material in diesem Ordner' : 'Neues Material';
	}
	return chipText(ziel, pfad);
};

const titelFuer = (neuModus: boolean, aufVorschlag: boolean) => {
	if (neuModus) {
		return 'Was soll entstehen?';
	}
	return aufVorschlag ? 'Was soll Claude am Vorschlag ändern?' : 'Was soll Claude ändern?';
};

const tasteFuer = (karte: boolean, aufVorschlag: boolean) => {
	if (karte) {
		return 'anlegen';
	}
	return aufVorschlag ? 'nachbessern' : 'senden';
};

const stufenFuer = (
	pfad: PfadTeil[],
	gewaehlt: number | null | 'neu',
	waehle: (ziel: number | null | 'neu') => void,
): MenueEintrag[] => [
	...[...pfad].reverse().map((t) => ({ titel: t.name, aktiv: gewaehlt === t.nr, waehle: () => waehle(t.nr) })),
	{
		titel: 'Ganzes Blatt',
		beschreibung: 'Das ganze Blatt verbraucht deutlich mehr vom Limit.',
		aktiv: gewaehlt === null,
		waehle: () => waehle(null),
	},
	{
		titel: 'Neues Material',
		beschreibung: 'Ein neues Dokument in diesem Ordner',
		symbol: 'plus',
		aktiv: gewaehlt === 'neu',
		waehle: () => waehle('neu'),
	},
];

const ankunftVon = (state: unknown) => {
	const { kiAuftrag, kiFehler } = (state ?? {}) as { kiAuftrag?: string; kiFehler?: string };
	return { kiAuftrag, kiFehler, ausNeuEntwurf: Boolean(kiAuftrag || kiFehler) };
};

const laufStand = (ki: KiAuftragStand, neu: NeuMaterial, hinweis: ReturnType<typeof limitHinweis>) => {
	const offenerVorschlag = ki.vorschlag && !ki.vorschlag.konflikt ? ki.vorschlag : null;
	return {
		offenerVorschlag,
		gesperrt: ki.laeuft || Boolean(offenerVorschlag),
		gesperrtLimit: hinweis?.art === 'gesperrt',
		neuBelegt: neu.stand?.phase === 'ordnet' || neu.stand?.phase === 'legtAn',
	};
};

interface EingabeAngaben {
	chipName: string;
	entwurf: string;
	fenster: ChatFensterZustand;
	frei: boolean;
	ki: KiAuftragStand;
	letzte: ChatNachricht | undefined;
	neu: NeuMaterial;
	neuModus: boolean;
	stand: ReturnType<typeof laufStand>;
	verlaufLaenge: number;
}

/** Was die Eingabezeile zeigt, aus dem Stand von Lauf, Vorschlag und Karte. */
const eingabeWerte = ({
	chipName,
	entwurf,
	fenster,
	frei,
	ki,
	letzte,
	neu,
	neuModus,
	stand,
	verlaufLaenge,
}: EingabeAngaben) => {
	const { gesperrt, gesperrtLimit, neuBelegt, offenerVorschlag } = stand;
	const aufVorschlag = Boolean(offenerVorschlag);
	const titel = titelFuer(neuModus, aufVorschlag);
	const hatVerlauf = verlaufLaenge > 0 || ki.laeuft || Boolean(ki.vorschlag ?? ki.fehler ?? neu.stand);
	return {
		titel,
		platzhalter: aufVorschlag || neuModus ? titel : 'Was soll sich ändern?',
		kannSenden: Boolean(entwurf.trim()) && frei && !gesperrtLimit && !neuBelegt,
		taste: tasteFuer(neu.stand?.phase === 'karte' && !entwurf.trim(), aufVorschlag),
		chipFest: gesperrt ? (letzte?.kontext ?? offenerVorschlag?.umfang ?? 'Ganzes Blatt') : chipName,
		zeigeVerlauf: fenster === 'zeile' && hatVerlauf,
	};
};

const useChatOrt = (kontext: ChatKontext, mappe: string | null | undefined, dok: string | null | undefined) => {
	const { stand: ablage } = useAblage();
	const ordner =
		kontext.art === 'neu'
			? (kontext.ordner ?? null)
			: (ablage?.dokumente.find((d) => d.mappe === mappe && d.id === dok)?.ordner ?? null);
	const schluessel = verlaufSchluessel(
		kontext.art === 'neu' ? (ordner ?? undefined) : (mappe ?? undefined),
		dok ?? undefined,
	);
	return { ordner, schluessel };
};

export const ChatInhalt = ({
	entwurf,
	fenster,
	fokus,
	ki: kiStatus,
	kontext,
	meldeLauf,
	meldeVerlaufHoehe,
	neu,
	setEntwurf,
	setFenster,
	setZitat,
	sichereZitat,
	zitat,
}: Eigenschaften) => {
	const { anker, dok, dokument, frei, nr, pfad: kontextPfad } = ausKontext(kontext);
	const { mappe } = kontext;
	const pfad = useMemo(() => kontextPfad ?? [], [kontextPfad]);
	const navigate = useNavigate();
	const location = useLocation();
	const { ausNeuEntwurf, kiAuftrag, kiFehler } = ankunftVon(location.state);
	const auftragKi = useKiAuftrag(mappe, dok, kiStatus.neu, kiAuftrag);
	const { zustand } = kiStatus;
	const lage = useLage(anker);
	const { ordner, schluessel } = useChatOrt(kontext, mappe, dok);
	const [verlauf, setVerlauf] = useVerlauf(schluessel);
	const [vergleich, setVergleich] = useState(false);
	const [ungelesen, setUngelesen] = useState(false);
	const flaeche = useRef<HTMLElement>(null);
	const feld = useRef<HTMLTextAreaElement>(null);
	const liste = useRef<HTMLDivElement>(null);

	// Der Chip folgt der Auswahl; wer darin etwas anderes wählt, gilt nur bis zur nächsten Auswahl.
	const [wahl, setWahl] = useState<{ fuer: number | null; ziel: number | null | 'neu' } | null>(null);
	const gewaehlt = wahl?.fuer === nr ? wahl.ziel : nr;
	const ziel = gewaehlt === 'neu' ? null : gewaehlt;
	const neuModus = kontext.art === 'neu' || gewaehlt === 'neu';
	const [leerGeblieben, setLeerGeblieben] = useState(false);
	useEffect(() => setZitat(null), [nr, setZitat]);

	const { laeuft, setFehler, vorschlag } = auftragKi;
	const hinweis = limitHinweis(zustand.limit, zustand.warnAb);
	const stand = laufStand(auftragKi, neu, hinweis);
	const { gesperrt, gesperrtLimit, neuBelegt, offenerVorschlag } = stand;
	const chipName = chipFuer({ art: kontext.art, neuModus, ordner, pfad, ziel });
	const offen = fenster !== 'zu';
	const letzte = verlauf.findLast((n) => n.rolle === 'lehrkraft');
	const gesendet = useRef<string | null>(null);
	const ablehnungen = useRef(0);

	// Abgelehnt: Der getippte Auftrag kommt zurück ins Feld, sofern dort nicht schon Neues steht.
	useEffect(() => {
		if (auftragKi.abgelehnt === ablehnungen.current) {
			return;
		}
		ablehnungen.current = auftragKi.abgelehnt;
		if (gesendet.current && !entwurf.trim()) {
			setEntwurf(gesendet.current);
		}
		gesendet.current = null;
	}, [auftragKi.abgelehnt, entwurf, setEntwurf]);

	// Ist die Sperre weg, stimmt auch die alte Meldung nicht mehr.
	const warGesperrt = useRef(false);
	useEffect(() => {
		if (warGesperrt.current && !gesperrtLimit) {
			setFehler(null);
		}
		warGesperrt.current = gesperrtLimit;
	}, [gesperrtLimit, setFehler]);

	useEffect(() => {
		if (kiFehler) {
			setFehler(kiFehler);
		}
	}, [kiFehler, setFehler]);

	useAuftragsEnde({ auftrag: auftragKi.auftrag, laeuft, vorschlag, fenster, setFenster, setUngelesen, setVerlauf });

	useEffect(() => {
		if (offen) {
			setUngelesen(false);
		}
	}, [offen]);

	useLaufMeldung(laeuft, Boolean(vorschlag), ungelesen, meldeLauf);

	useEffect(() => {
		if (fokus > 0) {
			feld.current?.focus();
		}
	}, [fokus]);

	useLayoutEffect(() => {
		const el = feld.current;
		if (el) {
			el.style.height = 'auto';
			el.style.height = `${Math.min(FELD_MAX, el.scrollHeight)}px`;
		}
	}, [entwurf, fenster, lage.width]);

	useChatPlatz(flaeche, offen, fenster, nr, meldeVerlaufHoehe);

	useEffect(() => {
		const el = liste.current;
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, [verlauf.length, laeuft, fenster, vorschlag]);

	const merke = (text: string, kontextText: string | null) => {
		setVerlauf((alt) => [
			...alt,
			{ rolle: 'lehrkraft', text, kontext: kontextText, zeit: new Date().toISOString(), auftragId: null },
		]);
		setEntwurf('');
		setFenster('verlauf');
	};

	const sendeAuftrag = async (inhalt: { text: string; aktion?: string }) => {
		const aufVorschlag = Boolean(offenerVorschlag);
		const kontextText = aufVorschlag ? (letzte?.kontext ?? offenerVorschlag?.umfang ?? null) : chipName;
		const vorher = verlaufFuerServer(verlauf);
		const stelle = zitat;
		gesendet.current = inhalt.aktion ? null : inhalt.text;
		merke(inhalt.text, kontextText);
		setZitat(null);
		setUngelesen(false);
		await dokument?.handlungen.current.vorbereiten();
		setLeerGeblieben(false);
		const referenz =
			!aufVorschlag && dokument?.zerlegung && ziel !== null
				? erzeugeReferenz(dokument.zerlegung, ziel, dokument.ort, dokument.loesung)
				: undefined;
		await auftragKi.starte({
			...(inhalt.aktion ? { aktion: inhalt.aktion } : {}),
			...(!inhalt.aktion || inhalt.aktion === NEU_ENTWURF ? { auftrag: inhalt.text } : {}),
			referenz,
			aufVorschlag,
			...(vorher.length > 0 ? { verlauf: vorher } : {}),
			...(stelle ? { zitat: stelle } : {}),
		});
	};

	const sende = (inhalt: { text: string; aktion?: string }) => {
		if (laeuft || !frei || gesperrtLimit || neuBelegt) {
			return;
		}
		if (neuModus) {
			merke(inhalt.text, chipName);
			// Ist das Limit nah, kostet schon das Einordnen zu viel: Die Karte kommt trotzdem.
			void neu.starte(
				{ wunsch: inhalt.text, ordner, schluessel, imDokument: Boolean(dokument) },
				hinweis?.art === 'warnung',
			);
			return;
		}
		void sendeAuftrag(inhalt);
	};

	const neuStarten = () => {
		const text = letzte?.text ?? vorschlag?.auftrag;
		if (text) {
			const aktion = ausNeuEntwurf ? NEU_ENTWURF : zustand.aktionen.find((a) => a.name === text)?.id;
			sende({ text, ...(aktion ? { aktion } : {}) });
		}
	};

	const zurApp = dokument ? () => dokument.handlungen.current.zurApp(ziel) : null;
	const schliessen = () => {
		setFenster('zu');
		dokument?.handlungen.current.zumBlatt();
	};

	const taste = (e: KeyboardEvent<HTMLElement>) => {
		if (e.nativeEvent.isComposing || document.querySelector('[role="menu"]')) {
			return;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			if (fenster === 'verlauf') {
				setFenster('zeile');
			} else {
				schliessen();
			}
		} else if (e.key === 'Enter' && !e.shiftKey && e.target === feld.current) {
			e.preventDefault();
			if (entwurf.trim()) {
				sende({ text: entwurf.trim() });
			} else if (neu.stand?.phase === 'karte') {
				void neu.anlegen();
			}
		}
	};

	const stufen = useMemo(
		() =>
			stufenFuer(pfad, gewaehlt, (w) => {
				setWahl({ fuer: nr, ziel: w });
				feld.current?.focus();
			}),
		[gewaehlt, nr, pfad],
	);

	const mehr: MenueEintrag[] = [
		{
			titel: 'Neu beginnen',
			symbol: 'rueckgaengig',
			aus: verlauf.length === 0,
			waehle: () => setVerlauf(() => []),
		},
		...(zurApp ? [{ titel: 'In der Claude-App weiterarbeiten', symbol: 'kopieren' as const, waehle: zurApp }] : []),
	];

	const aktionen = neuModus || gesperrt ? [] : zustand.aktionen.filter((a) => a.auf.includes(umfangVon(ziel, pfad)));
	const verwirf = () => {
		setLeerGeblieben(ausNeuEntwurf);
		void auftragKi.verwerfen();
	};
	const eingabe = eingabeWerte({
		chipName,
		entwurf,
		fenster,
		frei,
		ki: auftragKi,
		letzte,
		neu,
		neuModus,
		stand,
		verlaufLaenge: verlauf.length,
	});

	return (
		<>
			{vergleich && vorschlag && dokument && (
				<Vergleich
					adresse={dokument.adresse}
					konflikt={vorschlag.konflikt}
					schliessen={() => setVergleich(false)}
					annehmen={() => {
						setVergleich(false);
						void dokument.handlungen.current.annimm(auftragKi.annehmen);
					}}
					verwerfen={() => {
						setVergleich(false);
						verwirf();
					}}
					nachbessern={() => {
						setVergleich(false);
						feld.current?.focus();
					}}
				/>
			)}
			{offen && (
				<section
					ref={flaeche}
					aria-label="Claude"
					className="chat-glas fixed z-chat flex max-h-[50dvh] flex-col overflow-hidden text-sm text-tinte"
					data-chat
					data-chat-fenster={fenster}
					style={lage}
					onKeyDown={taste}
					onPointerDownCapture={sichereZitat}
					{...{ [TEXTWERKZEUG]: '' }}
				>
					{fenster === 'verlauf' && (
						<VerlaufBereich
							auftragKi={auftragKi}
							einklappen={() => setFenster('zeile')}
							hinweisText={hinweis?.text ?? null}
							limitGesperrt={gesperrtLimit}
							imEditor={
								dokument
									? null
									: () => void navigate(`/m/${mappe ?? ''}/${dok ?? ''}/bearbeiten?claude=1`)
							}
							leerGeblieben={leerGeblieben}
							liste={liste}
							neu={neu}
							neuStarten={neuStarten}
							schliessen={schliessen}
							vergleichen={() => setVergleich(true)}
							verlauf={verlauf}
							verwerfen={verwirf}
						/>
					)}
					{hinweis && <LimitZeile key={hinweis.art} hinweis={hinweis} pruefeLimit={kiStatus.pruefeLimit} />}
					{zustand.verfuegbar ? (
						<Eingabe
							abbrechen={() => void auftragKi.abbrechen()}
							aktionen={aktionen}
							chip={{ text: eingabe.chipFest, stufen: gesperrt || !dokument ? null : stufen }}
							entwurf={entwurf}
							feld={feld}
							fenster={fenster}
							frei={frei}
							kannSenden={eingabe.kannSenden}
							laeuft={laeuft}
							mehr={mehr}
							platzhalter={eingabe.platzhalter}
							sende={sende}
							setEntwurf={setEntwurf}
							setZitat={setZitat}
							taste={eingabe.taste}
							titel={eingabe.titel}
							verlaufZeigen={eingabe.zeigeVerlauf ? () => setFenster('verlauf') : null}
							zitat={zitat}
						/>
					) : (
						<OhneAnmeldung zurApp={zurApp} />
					)}
				</section>
			)}
		</>
	);
};
