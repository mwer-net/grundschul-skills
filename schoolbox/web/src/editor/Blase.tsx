import type { ComponentProps, KeyboardEvent, ReactNode, RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import type { MenueEintrag } from '../bausteine/Menue';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import type { ChatNachricht } from './chat-verlauf';
import { istRueckfrage } from './chat-verlauf';
import type { Faden, FadenStand } from './claude-faeden';
import { laeuftNoch, standVon } from './claude-faeden';
import { elementZu, pfadZu } from './darstellung';
import type { KiAktion, KiAuftrag, VorschlagAmBlatt } from './ki';
import type { Einblendung } from './Leinwand';
import { LimitZeile } from './LimitZeile';
import type { Darstellung } from './Miniatur';
import { Miniatur } from './Miniatur';
import { useSichtfeld } from './sichtfeld';
import { EIGENE_GESCHICHTE } from './tasten';
import { TEXTWERKZEUG } from './text';
import type { Claude } from './useClaude';
import { Vergleich } from './Vergleich';

const BREITE = 540;
/** Abstand zum Auswahlrahmen, der selbst 4,5 px um das Element liegt (B2 S. 2). */
const ABSTAND = 4.5 + 14;
const RAND = 8;
/** Unter der Leiste der Seite (B2 S. 6). */
const UNTER_SEITENLEISTE = 48;
const FELD_MAX = 120;
/** Kleinere Elemente bekommen die Pille darunter, nicht darauf (135). */
const PILLE_DARUNTER = 40;

const CHIP =
	'inline-flex h-[22px] max-w-64 min-w-0 items-center gap-1 rounded-md bg-brand-50 px-1.5 text-xs font-medium text-brand-700 [@media(any-pointer:coarse)]:h-11';

type Kasten = { links: number; rechts: number; oben: number; unten: number };
type Sicht = NonNullable<ReturnType<typeof useSichtfeld>>;

const kastenVon = (e: Einblendung, nr: number | null): Kasten | null => {
	const r = nr === null ? null : elementZu(e.doc, nr)?.getBoundingClientRect();
	return r
		? {
				links: e.links + r.left * e.skala,
				rechts: e.links + r.right * e.skala,
				oben: r.top * e.skala,
				unten: r.bottom * e.skala,
			}
		: null;
};

/** Unter dem Element; ist es höher als die Sicht, am unteren Rand der Sicht. Die Seite: oben unter ihrer Leiste. */
const blasenLage = (k: Kasten, sicht: Sicht, hoehe: number, seite: boolean) => {
	const breite = Math.max(260, Math.min(BREITE, sicht.rechts - sicht.links - 2 * RAND));
	const mitte = (k.links + k.rechts) / 2;
	const ziel = k.rechts - k.links > breite ? k.links + 40 : mitte;
	const links = Math.max(sicht.links + RAND, Math.min(ziel - breite / 2, sicht.rechts - breite - RAND));
	let top = k.unten + ABSTAND;
	if (seite) {
		top = Math.max(k.oben + ABSTAND, sicht.oben + UNTER_SEITENLEISTE);
	} else if (k.unten > sicht.unten && k.oben < sicht.unten) {
		top = Math.max(k.oben + ABSTAND, sicht.unten - hoehe - RAND);
	}
	const spitze = Math.max(18, Math.min(ziel - links, breite - 18));
	return { links, top, breite, spitze };
};

const uhr = (sekunden: number) => `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`;

const useSekunden = (seit: string | undefined, an: boolean) => {
	const [jetzt, setJetzt] = useState(() => Date.now());
	const [start] = useState(() => Date.now());
	useEffect(() => {
		if (!an) {
			return undefined;
		}
		const takt = window.setInterval(() => setJetzt(Date.now()), 1000);
		return () => window.clearInterval(takt);
	}, [an]);
	const ab = seit ? Date.parse(seit) : start;
	return Math.max(0, Math.floor((jetzt - ab) / 1000));
};

/** Der Name im Kopf und in der Pille: aus den Ebenen (Entscheidung 43); „Ganzes Material“ ohne Referenz. */
const bezugVon = (doc: Document, f: Pick<Faden, 'ganz' | 'nr'>, seiten: number) => {
	if (f.nr === null || (f.ganz && seiten > 1)) {
		return 'Ganzes Material';
	}
	return pfadZu(doc, f.nr).at(-1)?.name ?? 'Ganzes Material';
};

const Sprechblase = ({ n }: { n: ChatNachricht }) =>
	n.rolle === 'lehrkraft' ? (
		<p
			className="ml-auto max-w-[85%] rounded-lg bg-tinte/6 px-2 py-1 whitespace-pre-line"
			data-chat-nachricht="lehrkraft"
		>
			{n.text}
		</p>
	) : (
		<p className="whitespace-pre-line" data-chat-nachricht="claude">
			{n.text}
		</p>
	);

const Lauf = ({ abbrechen, auftrag, bezug }: { auftrag: KiAuftrag; bezug: string; abbrechen: () => void }) => {
	const sekunden = useSekunden(auftrag.seit, auftrag.status === 'laeuft');
	return (
		<div className="flex items-center gap-2" data-ki-lauf role="status">
			<Symbol name="laden" className="size-3.5 flex-none animate-spin text-leise" />
			<p className="min-w-0 flex-1">
				{auftrag.status === 'wartet'
					? `Wartet auf Claude: ${bezug}`
					: `Claude ändert ${bezug} … ${uhr(sekunden)}`}
			</p>
			<Knopf art="zweit" groesse="klein" onClick={abbrechen}>
				Abbrechen
			</Knopf>
		</div>
	);
};

interface VorschlagAngaben {
	v: VorschlagAmBlatt;
	referenz: string | null;
	jetzt: string | null;
	darstellung: Darstellung;
	zeigeText: boolean;
	annehmen: () => void;
	verwerfen: () => void;
	vergleichen: () => void;
	neuStarten: () => void;
}

const VorschlagKarte = ({
	annehmen,
	darstellung,
	jetzt,
	neuStarten,
	referenz,
	v,
	vergleichen,
	verwerfen,
	zeigeText,
}: VorschlagAngaben) => (
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
		{!v.konflikt && v.quelle && jetzt && (
			<div className="mt-2 flex gap-2" data-claude-miniaturen>
				<Miniatur titel="Vorher" quelle={jetzt} referenz={referenz} darstellung={darstellung} />
				<Miniatur titel="Nachher" quelle={v.quelle} referenz={referenz} darstellung={darstellung} />
			</div>
		)}
		{v.konflikt && (
			<p role="alert" className="mt-1 font-medium">
				Das Blatt wurde seit dem Auftrag geändert. Starte den Auftrag bitte neu.
			</p>
		)}
		<div className="mt-2 flex flex-wrap gap-1.5">
			{v.konflikt ? (
				<Knopf onClick={neuStarten}>Neu starten</Knopf>
			) : (
				<Knopf onClick={annehmen} data-claude-uebernehmen>
					Übernehmen ⏎
				</Knopf>
			)}
			<Knopf art="zweit" onClick={verwerfen}>
				Verwerfen
			</Knopf>
			{!v.konflikt && (
				<Knopf art="zweit" onClick={vergleichen}>
					<Symbol name="seiten" />
					Groß vergleichen
				</Knopf>
			)}
		</div>
	</div>
);

const Schnellaktionen = ({
	aktionen,
	sende,
}: {
	aktionen: { id: string; name: string }[];
	sende: (inhalt: { text: string; aktion: string }) => void;
}) => (
	<div className="flex flex-wrap gap-1 px-2 pt-1.5" data-ki-aktionen>
		{aktionen.map((a) => (
			<button
				type="button"
				key={a.id}
				className="inline-flex h-5 items-center rounded-full border border-tinte/18 bg-white/40 px-2 text-xs hover:bg-white/70 [@media(any-pointer:coarse)]:h-11"
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

/** Auslöser des Stufenmenüs: `Menu.Trigger` reicht Ereignisse, ARIA und `ref` als Props herein. */
const BezugKnopf = ({ bezug, ...rest }: { bezug: string } & ComponentProps<'button'>) => (
	<button type="button" {...rest} className={CHIP} data-claude-bezug>
		<span className="truncate">{bezug}</span>
		<Symbol name="runter" className="size-3 flex-none" />
	</button>
);

const Kopf = ({
	bezug,
	einklappen,
	mehr,
	schliessen,
	stufen,
}: {
	bezug: string;
	stufen: MenueEintrag[] | null;
	mehr: MenueEintrag[];
	einklappen: () => void;
	schliessen: () => void;
}) => (
	<div className="flex flex-none items-center gap-1.5 border-b border-tinte/12 py-0.5 pr-1 pl-3" data-claude-kopf>
		<Symbol name="funken" className="size-3.5 flex-none text-brand-600" />
		<b className="flex-none font-semibold">Claude</b>
		<span aria-hidden className="text-leise">
			·
		</span>
		{stufen ? (
			<Menue
				name="Worauf bezieht sich der Auftrag?"
				eintraege={stufen}
				ausloeser={<BezugKnopf bezug={bezug} />}
			/>
		) : (
			<span className={CHIP} data-claude-bezug>
				<span className="truncate">{bezug}</span>
			</span>
		)}
		<span className="ml-auto flex flex-none items-center">
			<Menue name="Claude: weitere Aktionen" rechtsbuendig eintraege={mehr} ausloeser={MEHR_KNOPF} />
			<SymbolKnopf
				symbol="minus"
				beschriftung="Einklappen"
				groesse="klein"
				data-claude-einklappen
				onClick={einklappen}
			/>
			<SymbolKnopf
				symbol="schliessen"
				beschriftung="Gespräch beenden"
				groesse="klein"
				data-claude-schliessen
				onClick={schliessen}
			/>
		</span>
	</div>
);

interface FeldAngaben {
	entwurf: string;
	feld: RefObject<HTMLTextAreaElement | null>;
	platzhalter: string;
	laeuft: boolean;
	kannSenden: boolean;
	tasteText: string;
	zitat: string | null;
	setEntwurf: (text: string) => void;
	setZitat: (zitat: string | null) => void;
	sende: () => void;
	abbrechen: () => void;
	breite: number;
}

const Feld = ({
	abbrechen,
	breite,
	entwurf,
	feld,
	kannSenden,
	laeuft,
	platzhalter,
	sende,
	setEntwurf,
	setZitat,
	tasteText,
	zitat,
}: FeldAngaben) => {
	useLayoutEffect(() => {
		const el = feld.current;
		if (el) {
			el.style.height = 'auto';
			el.style.height = `${Math.min(FELD_MAX, el.scrollHeight)}px`;
		}
	}, [entwurf, feld, breite]);
	return (
		<>
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
			<div className="flex min-h-[34px] items-center gap-1.5 pt-1 pr-1 pb-0.5 pl-3">
				<label className="sr-only" htmlFor="ki-auftrag">
					Was soll Claude ändern?
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
						onClick={sende}
					>
						<Symbol name="senden" />
					</Knopf>
				)}
			</div>
			<div className="flex justify-between gap-2 px-3 pb-1 text-[11px] leading-[14px] text-leise">
				<span>Keine Namen von Kindern eintragen.</span>
				<span className="flex-none" data-chat-tasten>{`⏎ ${tasteText} · esc einklappen`}</span>
			</div>
		</>
	);
};

const OhneAnmeldung = ({ zurApp }: { zurApp: () => void }) => (
	<div className="flex flex-col items-start gap-2 p-3" data-chat-ohne-anmeldung>
		<p>
			Auf diesem Server ist Claude nicht angemeldet. Über die Claude-App kannst du trotzdem an diesem Blatt
			arbeiten.
		</p>
		<Knopf onClick={zurApp}>
			<Symbol name="kopieren" />
			In der Claude-App weiterarbeiten
		</Knopf>
	</div>
);

/** Welche Schnellaktionen passen; bei nur einer Seite auch die für das ganze Blatt (B2 S. 6). */
const umfaengeVon = (f: Faden, seite: boolean, seiten: number): KiAktion['auf'] => {
	if (f.ganz) {
		return ['blatt'];
	}
	if (seite) {
		return seiten === 1 ? ['seite', 'blatt'] : ['seite'];
	}
	return ['baustein'];
};

const stufenVon = (doc: Document, f: Faden, seiten: number, waehle: (nr: number, ganz: boolean) => void) => {
	if (f.nr === null) {
		return [];
	}
	const pfad = pfadZu(doc, f.nr);
	const eintraege: MenueEintrag[] = [...pfad].reverse().map((t) => ({
		titel: t.name,
		aktiv: !f.ganz && t.nr === f.nr,
		waehle: () => waehle(t.nr, false),
	}));
	const [seite] = pfad;
	if (seiten > 1 && seite) {
		eintraege.push({
			titel: 'Ganzes Material',
			beschreibung: 'Das ganze Material verbraucht deutlich mehr vom Limit.',
			aktiv: f.ganz,
			waehle: () => waehle(seite.nr, true),
		});
	}
	return eintraege;
};

/** Was die Blase neben dem Verlauf braucht: Lauf, Vorschlag, Fehler, Hinweise. */
interface Lagebild {
	f: Faden;
	auftrag: KiAuftrag | undefined;
	vorschlag: VorschlagAmBlatt | undefined;
	laeuft: boolean;
	offenerVorschlag: VorschlagAmBlatt | undefined;
}

const lagebildVon = (claude: Claude, f: Faden): Lagebild => {
	const auftrag = claude.auftragVon(f);
	const vorschlag = claude.vorschlagVon(f);
	return {
		f,
		auftrag,
		vorschlag,
		laeuft: laeuftNoch(auftrag),
		offenerVorschlag: vorschlag && !vorschlag.konflikt ? vorschlag : undefined,
	};
};

const tasteTextVon = ({ offenerVorschlag }: Lagebild, entwurf: string) => {
	if (!offenerVorschlag) {
		return 'senden';
	}
	return entwurf.trim() ? 'nachbessern' : 'übernehmen';
};

const platzhalterVon = ({ f, laeuft, offenerVorschlag }: Lagebild) => {
	const juengste = f.verlauf.at(-1);
	if (!laeuft && juengste?.rolle === 'claude' && istRueckfrage(juengste.text)) {
		return 'Antworten …';
	}
	return offenerVorschlag ? 'Nachbessern …' : 'Was soll sich ändern?';
};

/** „Claude ist noch bei Aufgabe 1. Dein Auftrag zu Aufgabe 3 startet direkt danach.“ (B2 S. 5) */
const warteHinweis = (claude: Claude, bild: Lagebild, bezug: (f: Faden) => string) => {
	if (bild.auftrag?.status !== 'wartet') {
		return null;
	}
	const vorne = claude.faeden.find((x) => x !== bild.f && claude.auftragVon(x)?.status === 'laeuft');
	return vorne
		? `Claude ist noch bei ${bezug(vorne)}. Dein Auftrag zu ${bezug(bild.f)} startet direkt danach.`
		: null;
};

interface BlasenAngaben {
	e: Einblendung;
	claude: Claude;
	f: Faden;
	nr: number;
	seiten: number;
	jetzt: string | null;
	darstellung: Darstellung;
	adresse: string;
}

const Inhalt = ({
	bild,
	claude,
	darstellung,
	jetzt,
	vergleichen,
}: {
	bild: Lagebild;
	claude: Claude;
	darstellung: Darstellung;
	jetzt: string | null;
	vergleichen: () => void;
}) => {
	const { auftrag, f, laeuft, vorschlag } = bild;
	const schonGesagt = f.verlauf.some((n) => n.rolle === 'claude' && n.text === vorschlag?.antwort);
	const hinweisText = claude.hinweis?.text ?? null;
	const hatLehrkraft = f.verlauf.some((n) => n.rolle === 'lehrkraft');
	return (
		<>
			{f.verlauf.map((n, i) => (
				<Sprechblase key={`${n.zeit}-${i}`} n={n} />
			))}
			{!laeuft && vorschlag && (
				<VorschlagKarte
					v={vorschlag}
					referenz={vorschlag.referenz ?? f.referenz}
					jetzt={jetzt}
					darstellung={darstellung}
					zeigeText={!schonGesagt}
					annehmen={() => void claude.annehmen(f.key)}
					verwerfen={() => void claude.verwerfen(f.key)}
					vergleichen={vergleichen}
					neuStarten={() => claude.neuStarten(f.key)}
				/>
			)}
			{f.fehler && f.fehler !== hinweisText && (
				<div className="rounded-lg border border-tinte/15 bg-white/50 p-2.5" data-ki-fehler>
					<p role="alert" className="font-medium">
						{f.fehler}
					</p>
					{hatLehrkraft && !laeuft && !claude.gesperrtLimit && (
						<Knopf art="zweit" className="mt-1.5" onClick={() => claude.neuStarten(f.key)}>
							Nochmal
						</Knopf>
					)}
				</div>
			)}
			{hatLehrkraft && !laeuft && auftrag?.kontextGross && (
				<div className="flex items-center justify-between gap-2 text-xs text-leise" data-chat-lang>
					<p>Das Gespräch ist lang, jede Nachricht verbraucht jetzt mehr vom Limit.</p>
					<Knopf art="zweit" groesse="klein" className="flex-none" onClick={() => claude.neuBeginnen(f.key)}>
						Neu beginnen
					</Knopf>
				</div>
			)}
		</>
	);
};

/** Die offene Blase am Element (134). */
const Blase = ({ adresse, claude, darstellung, e, f, jetzt, nr, seiten }: BlasenAngaben) => {
	const sicht = useSichtfeld(e.doc);
	const kasten = useRef<HTMLElement>(null);
	const feld = useRef<HTMLTextAreaElement>(null);
	const liste = useRef<HTMLDivElement>(null);
	const [hoehe, setHoehe] = useState(200);
	const [vergleich, setVergleich] = useState(false);
	// Der Dialog gibt beim Schließen den Fokus an seinen Auslöser zurück; danach erst ins Feld.
	const [insFeld, setInsFeld] = useState(false);
	useEffect(() => {
		if (!vergleich && insFeld) {
			setInsFeld(false);
			feld.current?.focus();
		}
	}, [vergleich, insFeld]);
	const bild = lagebildVon(claude, f);
	const { laeuft, offenerVorschlag, vorschlag } = bild;
	const seite = pfadZu(e.doc, nr).length === 1;
	const k = kastenVon(e, nr);

	useLayoutEffect(() => {
		const el = kasten.current;
		if (!el) {
			return undefined;
		}
		const beobachter = new ResizeObserver(() => setHoehe(el.offsetHeight));
		beobachter.observe(el);
		return () => beobachter.disconnect();
	}, []);

	// Passt sie unten nicht in die Sicht, rollt die Leinwand (134).
	const mitVorschlag = Boolean(vorschlag);
	useEffect(() => {
		kasten.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}, [f.key, mitVorschlag]);

	useEffect(() => {
		if (claude.fokus > 0) {
			feld.current?.focus({ preventScroll: true });
		}
	}, [claude.fokus]);

	const nachrichten = f.verlauf.length;
	useEffect(() => {
		const el = liste.current;
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, [nachrichten, laeuft, mitVorschlag]);

	if (!k || !sicht) {
		return null;
	}
	const lage = blasenLage(k, sicht, hoehe, seite);
	const bezug = (x: Faden) => bezugVon(e.doc, x, seiten);
	const gesperrt = laeuft || Boolean(offenerVorschlag);
	const stufen = gesperrt ? null : stufenVon(e.doc, f, seiten, (z, ganz) => claude.waehleStufe(f.key, z, ganz));
	const umfaenge = umfaengeVon(f, seite, seiten);
	const aktionen =
		gesperrt || f.verlauf.length > 0 || f.entwurf.trim()
			? []
			: claude.aktionen.filter((a) => a.auf.some((u) => umfaenge.includes(u)));
	const kannSenden = Boolean(f.entwurf.trim()) && claude.sperreVon(f) === null;
	const warten = warteHinweis(claude, bild, bezug);
	const mehr: MenueEintrag[] = [
		{
			titel: 'Neu beginnen',
			symbol: 'rueckgaengig',
			aus: f.verlauf.length === 0,
			waehle: () => claude.neuBeginnen(f.key),
		},
		{ titel: 'In der Claude-App weiterarbeiten', symbol: 'kopieren', waehle: () => claude.zurApp(f.key) },
	];
	const sende = () => claude.sende(f.key, { text: f.entwurf.trim() });

	const taste = (ereignis: KeyboardEvent<HTMLElement>) => {
		if (ereignis.nativeEvent.isComposing || document.querySelector('[role="menu"]')) {
			return;
		}
		if (ereignis.key === 'Escape') {
			ereignis.preventDefault();
			claude.einklappen();
		} else if (ereignis.key === 'Enter' && !ereignis.shiftKey && ereignis.target === feld.current) {
			ereignis.preventDefault();
			// Aus dem Feld, nicht aus dem Zustand: Kommt ⏎ vor dem Neuzeichnen, hielte es den Text sonst für leer und
			// übernähme den Vorschlag, statt nachzubessern.
			const text = (feld.current?.value ?? f.entwurf).trim();
			if (text) {
				claude.sende(f.key, { text });
			} else if (offenerVorschlag) {
				void claude.annehmen(f.key);
			}
		}
	};

	return (
		<>
			{vergleich && vorschlag && (
				<Vergleich
					adresse={adresse}
					schluessel={f.schluessel}
					konflikt={vorschlag.konflikt}
					schliessen={() => setVergleich(false)}
					annehmen={() => {
						setVergleich(false);
						void claude.annehmen(f.key);
					}}
					verwerfen={() => {
						setVergleich(false);
						void claude.verwerfen(f.key);
					}}
					nachbessern={() => {
						setVergleich(false);
						setInsFeld(true);
					}}
				/>
			)}
			<section
				ref={kasten}
				aria-label={`Claude: ${bezug(f)}`}
				className={klassen(
					'chat-glas absolute z-leiste flex max-h-[min(520px,70dvh)] flex-col text-sm text-tinte',
					e.zieht && 'pointer-events-none opacity-25',
				)}
				style={{ left: lage.links, top: lage.top, width: lage.breite }}
				data-claude-blase={f.key}
				{...EIGENE_GESCHICHTE}
				onKeyDown={taste}
				onPointerDownCapture={() => claude.sichereZitat(f.key)}
				{...{ [TEXTWERKZEUG]: '' }}
			>
				<span
					aria-hidden
					className="absolute -top-[7px] size-3.5 rotate-45 border-t border-l border-tinte/16 bg-white/90"
					style={{ left: lage.spitze - 7 }}
					data-claude-spitze
				/>
				<Kopf
					bezug={bezug(f)}
					stufen={stufen}
					mehr={mehr}
					einklappen={claude.einklappen}
					schliessen={() => claude.schliesse(f.key)}
				/>
				<div
					ref={liste}
					className="flex max-h-[360px] min-h-0 flex-col gap-2 overflow-y-auto px-3 py-2 empty:hidden"
				>
					<Inhalt
						bild={bild}
						claude={claude}
						darstellung={darstellung}
						jetzt={jetzt}
						vergleichen={() => setVergleich(true)}
					/>
				</div>
				{bild.auftrag && laeuft && (
					<div className="border-t border-tinte/12 px-3 py-1.5">
						<Lauf auftrag={bild.auftrag} bezug={bezug(f)} abbrechen={() => void claude.abbrechen(f.key)} />
					</div>
				)}
				{warten && (
					<p className="px-3 pb-1 text-xs text-leise" data-claude-warteschlange>
						{warten}
					</p>
				)}
				{claude.hinweis && (
					<LimitZeile
						key={claude.hinweis.art}
						className="border-t border-tinte/12 px-3 py-1"
						hinweis={claude.hinweis}
						pruefeLimit={claude.pruefeLimit}
					/>
				)}
				{claude.verfuegbar || !claude.geladen ? (
					<div className="flex-none border-t border-tinte/12">
						{aktionen.length > 0 && (
							<Schnellaktionen aktionen={aktionen} sende={(inhalt) => claude.sende(f.key, inhalt)} />
						)}
						<Feld
							abbrechen={() => void claude.abbrechen(f.key)}
							breite={lage.breite}
							entwurf={f.entwurf}
							feld={feld}
							kannSenden={kannSenden}
							laeuft={laeuft}
							platzhalter={platzhalterVon(bild)}
							sende={sende}
							setEntwurf={(text) => claude.setEntwurf(f.key, text)}
							setZitat={(zitat) => claude.setZitat(f.key, zitat)}
							tasteText={tasteTextVon(bild, f.entwurf)}
							zitat={f.zitat}
						/>
					</div>
				) : (
					<OhneAnmeldung zurApp={() => claude.zurApp(f.key)} />
				)}
			</section>
		</>
	);
};

const PILLEN_TEXT: Record<Exclude<FadenStand, 'laeuft'>, string | null> = {
	wartet: 'Wartet auf Claude',
	frage: 'Claude fragt',
	vorschlag: 'Vorschlag bereit',
	antwort: 'Claude hat geantwortet',
	ruhig: null,
};

const PillenText = ({
	auftrag,
	bezug,
	stand,
}: {
	stand: FadenStand;
	auftrag: KiAuftrag | undefined;
	bezug: string;
}) => {
	const sekunden = useSekunden(auftrag?.seit, stand === 'laeuft');
	if (stand === 'laeuft') {
		return (
			<>
				<Symbol name="laden" className="size-3.5 flex-none animate-spin" />
				{`Claude arbeitet an ${bezug} · ${uhr(sekunden)}`}
			</>
		);
	}
	const text = PILLEN_TEXT[stand];
	return (
		<>
			<Symbol name="funken" className="size-3.5 flex-none" />
			{text}
		</>
	);
};

/** Die eingeklappte Blase: mittig am unteren Rand des Elements, halb überlappend (135, B2 S. 5). */
const Pille = ({
	claude,
	e,
	f,
	nr,
	seiten,
}: {
	e: Einblendung;
	claude: Claude;
	f: Faden;
	nr: number;
	seiten: number;
}) => {
	const k = kastenVon(e, nr);
	if (!k) {
		return null;
	}
	const auftrag = claude.auftragVon(f);
	const stand = standVon(f, auftrag, claude.vorschlagVon(f));
	const seite = pfadZu(e.doc, nr).length === 1;
	const hervor = stand === 'frage' || stand === 'vorschlag';
	let top = k.unten - 13;
	if (seite) {
		top = k.oben + 8;
	} else if (k.unten - k.oben < PILLE_DARUNTER) {
		top = k.unten + 6;
	}
	const bezug = bezugVon(e.doc, f, seiten);
	return (
		<button
			type="button"
			className={klassen(
				'absolute z-ueberlagerung flex h-[26px] -translate-x-1/2 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap shadow-1 [@media(any-pointer:coarse)]:h-11',
				hervor ? 'border-brand-500 bg-brand-500 text-white' : 'border-rand bg-flaeche text-tinte',
				e.zieht && 'pointer-events-none opacity-25',
			)}
			style={{ left: (k.links + k.rechts) / 2, top }}
			aria-label={stand === 'ruhig' ? `Gespräch mit Claude: ${bezug}` : undefined}
			data-claude-pille={stand}
			onClick={() => claude.oeffne(nr)}
		>
			<PillenText stand={stand} auftrag={auftrag} bezug={bezug} />
		</button>
	);
};

/** Ein offener Vorschlag im Blatt: gestrichelt um sein Element, schreibgeschützt (134). */
const Vorschlagrahmen = ({ e, nr }: { e: Einblendung; nr: number }) => {
	const k = kastenVon(e, nr);
	return k ? (
		<div
			className="pointer-events-none absolute z-ueberlagerung rounded-[3px] border-2 border-dashed border-brand-500"
			data-claude-vorschlag-rahmen
			style={{
				left: k.links - 6,
				top: k.oben - 6,
				width: k.rechts - k.links + 12,
				height: k.unten - k.oben + 12,
			}}
		/>
	) : null;
};

/** Alles von Claude über dem Blatt: die offene Blase, Pillen der übrigen Gespräche, der gestrichelte Vorschlag. */
export const ClaudeSchicht = ({
	adresse,
	claude,
	darstellung,
	e,
	jetzt,
}: {
	e: Einblendung;
	claude: Claude;
	/** Die Quelle im Editor: „Vorher“ der Miniaturen. */
	jetzt: string | null;
	darstellung: Darstellung;
	adresse: string;
}): ReactNode => (
	<>
		{claude.zeigt !== null && claude.offen && claude.nrImBlatt(claude.offen) !== null && (
			<Vorschlagrahmen e={e} nr={claude.nrImBlatt(claude.offen) as number} />
		)}
		{claude.faeden.map((f) => {
			const nr = claude.nrImBlatt(f);
			if (nr === null) {
				return null;
			}
			return f.key === claude.offen?.key ? (
				<Blase
					key={f.key}
					e={e}
					claude={claude}
					f={f}
					nr={nr}
					seiten={claude.seiten}
					jetzt={jetzt}
					darstellung={darstellung}
					adresse={adresse}
				/>
			) : (
				<Pille key={f.key} e={e} claude={claude} f={f} nr={nr} seiten={claude.seiten} />
			);
		})}
	</>
);
