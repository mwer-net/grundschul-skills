import { erzeugeReferenz } from '@schoolbox/kern/src/referenz';
import type { KeyboardEvent, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Knopf } from '../bausteine/Knopf';
import { klassen } from '../bausteine/klassen';
import { Menue } from '../bausteine/Menue';
import type { MenueEintrag } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import type { ChatFensterZustand, ChatLauf, DokumentKontext } from './chat-kontext';
import type { ChatNachricht } from './chat-verlauf';
import { liesVerlauf, schreibeVerlauf, verlaufFuerServer, verlaufSchluessel } from './chat-verlauf';
import type { PfadTeil } from './darstellung';
import type { KiAuftrag, useKiZustand, Vorschlag } from './ki';
import { limitHinweis, useKiAuftrag } from './ki';
import { TEXTWERKZEUG } from './text';
import { Vergleich } from './Vergleich';

const ABSTAND_UNTEN = 6;
const SCHMAL_AB = 1100;
const FELD_MAX = 120;

const CHIP =
	'inline-flex h-[22px] max-w-56 flex-none items-center gap-1 rounded-md bg-brand-50 px-1.5 text-xs font-medium text-brand-700 [@media(any-pointer:coarse)]:h-11';

/** Ankert das Fenster über dem Blatt und über der Bildschirmtastatur des iPads. */
const useLage = (anker: RefObject<HTMLElement | null>) => {
	const [lage, setLage] = useState({ left: 0, width: 600, bottom: 10 });
	useLayoutEffect(() => {
		const element = anker.current;
		const sicht = window.visualViewport;
		const miss = () => {
			const tastatur = sicht ? Math.max(0, window.innerHeight - sicht.height - sicht.offsetTop) : 0;
			const r = element?.getBoundingClientRect() ?? { left: 0, width: window.innerWidth, bottom: window.innerHeight };
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
	neuStarten,
	v,
	vergleichen,
	verwerfen,
	zeigeText,
}: {
	v: Vorschlag;
	zeigeText: boolean;
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
			{v.konflikt ? (
				<Knopf onClick={neuStarten}>Neu starten</Knopf>
			) : (
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
	kontext: DokumentKontext;
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
export const ChatInhalt = ({
	entwurf,
	fenster,
	fokus,
	ki: kiStatus,
	kontext,
	meldeLauf,
	meldeVerlaufHoehe,
	setEntwurf,
	setFenster,
	setZitat,
	sichereZitat,
	zitat,
}: Eigenschaften) => {
	const { dok, frei, handlungen, loesung, mappe, nr, ort, pfad, zerlegung } = kontext;
	const { state } = useLocation();
	const ankunft = state as { kiAuftrag?: string; kiFehler?: string } | null;
	const auftragKi = useKiAuftrag(mappe, dok, kiStatus.neu, ankunft?.kiAuftrag);
	const { zustand } = kiStatus;
	const lage = useLage(kontext.anker);
	const schluessel = verlaufSchluessel(mappe, dok);
	const [verlauf, setVerlaufWert] = useState(() => liesVerlauf(localStorage, schluessel));
	const setVerlauf = useCallback(
		(neu: (alt: ChatNachricht[]) => ChatNachricht[]) =>
			setVerlaufWert((alt) => {
				const stand = neu(alt);
				schreibeVerlauf(localStorage, schluessel, stand);
				return stand;
			}),
		[schluessel],
	);
	const [vergleich, setVergleich] = useState(false);
	const [ungelesen, setUngelesen] = useState(false);
	const [seit, setSeit] = useState(0);
	const flaeche = useRef<HTMLElement>(null);
	const feld = useRef<HTMLTextAreaElement>(null);
	const liste = useRef<HTMLDivElement>(null);
	const erledigt = useRef(new Set<string>());

	// Der Chip folgt der Auswahl; wer darin etwas anderes wählt, gilt nur bis zur nächsten Auswahl.
	const [wahl, setWahl] = useState<{ fuer: number | null; ziel: number | null } | null>(null);
	const ziel = wahl?.fuer === nr ? wahl.ziel : nr;
	useEffect(() => setZitat(null), [nr, setZitat]);

	const { auftrag, laeuft, setFehler, vorschlag } = auftragKi;
	const offenerVorschlag = vorschlag && !vorschlag.konflikt ? vorschlag : null;
	const hinweis = limitHinweis(zustand.limit, zustand.warnAb);
	const umfang = umfangVon(ziel, pfad);
	const offen = fenster !== 'zu';
	const letzte = verlauf.findLast((n) => n.rolle === 'lehrkraft');

	const kiFehler = ankunft?.kiFehler;
	useEffect(() => {
		if (kiFehler) {
			setFehler(kiFehler);
		}
	}, [kiFehler, setFehler]);

	// Das Ende eines Laufs einmal in den Verlauf schreiben, ganz gleich, wie es hier ankam.
	useEffect(() => {
		if (!auftrag || laeuft || erledigt.current.has(auftrag.id)) {
			return;
		}
		erledigt.current.add(auftrag.id);
		const sag = (text: string) =>
			setVerlauf((alt) => [
				...alt,
				{ rolle: 'claude', text, kontext: null, zeit: new Date().toISOString(), auftragId: auftrag.id },
			]);
		if (auftrag.status === 'abgebrochen') {
			sag('Abgebrochen.');
		} else if (auftrag.ergebnis === 'antwort' && auftrag.antwort) {
			sag(auftrag.antwort);
		} else if (auftrag.ergebnis === 'vorschlag' && vorschlag?.antwort) {
			sag(vorschlag.antwort);
		}
		if (auftrag.status === 'fertig' || auftrag.status === 'fehler') {
			if (fenster === 'zu') {
				setUngelesen(auftrag.ergebnis === 'antwort');
			} else {
				setFenster('verlauf');
			}
		}
	}, [auftrag, fenster, laeuft, setFenster, setVerlauf, vorschlag]);

	useEffect(() => {
		if (offen) {
			setUngelesen(false);
		}
	}, [offen]);

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
		} else if (vorschlag) {
			meldeLauf({ art: 'bereit', seit: 0 });
		} else {
			meldeLauf(ungelesen ? { art: 'antwort', seit: 0 } : null);
		}
	}, [laeuft, meldeLauf, seit, ungelesen, vorschlag]);
	useEffect(() => () => meldeLauf(null), [meldeLauf]);

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

	// Das Blatt rollt am Fenster vorbei, bis zum letzten Baustein. Die Höhe gilt für Rand, Leiste und Einpassen.
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
	}, [offen]);

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
	}, [nr, hoehe]);

	useEffect(() => {
		const el = liste.current;
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, [verlauf.length, laeuft, fenster, vorschlag]);

	const referenz = () => (zerlegung && ziel !== null ? erzeugeReferenz(zerlegung, ziel, ort, loesung) : undefined);

	const sende = async (inhalt: { text: string; aktion?: string }) => {
		if (laeuft || !frei || hinweis?.art === 'gesperrt') {
			return;
		}
		const aufVorschlag = Boolean(offenerVorschlag);
		const kontextText = aufVorschlag ? (letzte?.kontext ?? offenerVorschlag?.umfang ?? null) : chipText(ziel, pfad);
		const vorher = verlaufFuerServer(verlauf);
		const stelle = zitat;
		setVerlauf((alt) => [
			...alt,
			{ rolle: 'lehrkraft', text: inhalt.text, kontext: kontextText, zeit: new Date().toISOString(), auftragId: null },
		]);
		setEntwurf('');
		setZitat(null);
		setFenster('verlauf');
		setUngelesen(false);
		await handlungen.current.vorbereiten();
		await auftragKi.starte({
			...(inhalt.aktion ? { aktion: inhalt.aktion } : { auftrag: inhalt.text }),
			referenz: aufVorschlag ? undefined : referenz(),
			aufVorschlag,
			...(vorher.length > 0 ? { verlauf: vorher } : {}),
			...(stelle ? { zitat: stelle } : {}),
		});
	};

	const neuStarten = () => {
		const text = letzte?.text ?? vorschlag?.auftrag;
		if (text) {
			const aktion = zustand.aktionen.find((a) => a.name === text);
			void sende({ text, ...(aktion ? { aktion: aktion.id } : {}) });
		}
	};

	const einklappenOderZu = () => {
		if (fenster === 'verlauf') {
			setFenster('zeile');
		} else {
			setFenster('zu');
			handlungen.current.zumBlatt();
		}
	};

	const taste = (e: KeyboardEvent<HTMLElement>) => {
		if (e.nativeEvent.isComposing || document.querySelector('[role="menu"]')) {
			return;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			einklappenOderZu();
		} else if (e.key === 'Enter' && !e.shiftKey && e.target === feld.current) {
			e.preventDefault();
			if (entwurf.trim()) {
				void sende({ text: entwurf.trim() });
			}
		}
	};

	const stufen = useMemo<MenueEintrag[]>(
		() => [
			...[...pfad].reverse().map((t) => ({
				titel: t.name,
				aktiv: ziel === t.nr,
				waehle: () => {
					setWahl({ fuer: nr, ziel: t.nr });
					feld.current?.focus();
				},
			})),
			{
				titel: 'Ganzes Blatt',
				beschreibung: 'Das ganze Blatt verbraucht deutlich mehr vom Limit.',
				aktiv: ziel === null,
				waehle: () => {
					setWahl({ fuer: nr, ziel: null });
					feld.current?.focus();
				},
			},
		],
		[nr, pfad, ziel],
	);

	const mehr: MenueEintrag[] = [
		{
			titel: 'Neu beginnen',
			symbol: 'rueckgaengig',
			aus: verlauf.length === 0,
			waehle: () => setVerlauf(() => []),
		},
		{
			titel: 'In der Claude-App weiterarbeiten',
			symbol: 'kopieren',
			waehle: () => handlungen.current.zurApp(ziel),
		},
	];

	const aktionen = zustand.aktionen.filter((a) => a.auf.includes(umfang));
	const gesperrt = laeuft || Boolean(offenerVorschlag);
	const text = offenerVorschlag ? 'Was soll Claude am Vorschlag ändern?' : 'Was soll Claude ändern?';
	const schonGesagt = verlauf.some((n) => n.rolle === 'claude' && n.text === vorschlag?.antwort);
	const hatVerlauf = verlauf.length > 0 || laeuft || Boolean(vorschlag) || Boolean(auftragKi.fehler);

	return (
		<>
			{vergleich && vorschlag && (
				<Vergleich
					adresse={kontext.adresse}
					konflikt={vorschlag.konflikt}
					schliessen={() => setVergleich(false)}
					annehmen={() => {
						setVergleich(false);
						void auftragKi.annehmen();
					}}
					verwerfen={() => {
						setVergleich(false);
						void auftragKi.verwerfen();
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
						<>
							<div className="flex flex-none items-center justify-between border-b border-tinte/12 py-0.5 pr-1 pl-3">
								<b className="font-semibold">Claude</b>
								<span className="flex items-center">
									<SymbolKnopf
										symbol="runter"
										beschriftung="Verlauf einklappen"
										groesse="klein"
										onClick={() => setFenster('zeile')}
									/>
									<SymbolKnopf
										symbol="schliessen"
										beschriftung="Chat schließen"
										groesse="klein"
										onClick={() => {
											setFenster('zu');
											handlungen.current.zumBlatt();
										}}
									/>
								</span>
							</div>
							<div
								ref={liste}
								className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2"
								data-chat-verlauf
							>
								{verlauf.map((n, i) => (
									<Sprechblase key={`${n.zeit}-${i}`} n={n} />
								))}
								{laeuft && auftrag && (
									<Lauf
										auftrag={auftrag}
										nachbessern={Boolean(offenerVorschlag)}
										abbrechen={() => void auftragKi.abbrechen()}
									/>
								)}
								{!laeuft && vorschlag && (
									<VorschlagKarte
										v={vorschlag}
										zeigeText={!schonGesagt}
										vergleichen={() => setVergleich(true)}
										verwerfen={() => void auftragKi.verwerfen()}
										neuStarten={neuStarten}
									/>
								)}
								{auftragKi.fehler && (
									<p role="alert" className="font-medium" data-ki-fehler>
										{auftragKi.fehler}
									</p>
								)}
							</div>
						</>
					)}
					{hinweis && (
						<p role="status" className="flex-none border-b border-tinte/12 px-3 py-1 text-xs" data-ki-limit={hinweis.art}>
							{hinweis.text}
						</p>
					)}
					{zustand.verfuegbar ? (
						<div className={klassen('flex-none', fenster === 'verlauf' && 'border-t border-tinte/12')}>
							{!entwurf && !gesperrt && aktionen.length > 0 && (
								<div className="flex flex-wrap gap-1 px-2 pt-1.5" data-ki-aktionen>
									{aktionen.map((a) => (
										<button
											type="button"
											key={a.id}
											disabled={!frei}
											className="inline-flex h-5 items-center rounded-full border border-tinte/18 bg-white/40 px-2 text-xs hover:bg-white/70 disabled:opacity-40 [@media(any-pointer:coarse)]:h-11"
											onClick={() => void sende({ text: a.name, aktion: a.id })}
										>
											{a.name}
										</button>
									))}
								</div>
							)}
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
								{gesperrt ? (
									<span className={CHIP} data-chat-chip>
										<span className="truncate">
											{letzte?.kontext ?? offenerVorschlag?.umfang ?? 'Ganzes Blatt'}
										</span>
									</span>
								) : (
									<Menue
										name="Worauf bezieht sich der Auftrag?"
										eintraege={stufen}
										ausloeser={
											<button type="button" className={CHIP} data-chat-chip>
												<span className="truncate">{chipText(ziel, pfad)}</span>
												<Symbol name="runter" className="size-3 flex-none" />
											</button>
										}
									/>
								)}
								<label className="sr-only" htmlFor="ki-auftrag">
									{text}
								</label>
								<textarea
									id="ki-auftrag"
									ref={feld}
									rows={1}
									maxLength={4000}
									value={entwurf}
									placeholder={offenerVorschlag ? text : 'Was soll sich ändern?'}
									className="min-w-0 flex-1 resize-none bg-transparent leading-5 outline-none placeholder:text-leise"
									onChange={(e) => setEntwurf(e.target.value)}
								/>
								{fenster === 'zeile' && hatVerlauf && (
									<SymbolKnopf
										symbol="hoch"
										beschriftung="Verlauf zeigen"
										groesse="klein"
										onClick={() => setFenster('verlauf')}
									/>
								)}
								<Menue
									name="Chat: weitere Aktionen"
									rechtsbuendig
									eintraege={mehr}
									ausloeser={
										<Knopf art="leise" groesse="klein" className="size-knopf-klein px-0">
											<Symbol name="mehr" />
										</Knopf>
									}
								/>
								{laeuft ? (
									<Knopf
										art="zweit"
										groesse="klein"
										aria-label="Abbrechen"
										className="size-knopf-klein rounded-full px-0"
										onClick={() => void auftragKi.abbrechen()}
									>
										<Symbol name="schliessen" />
									</Knopf>
								) : (
									<Knopf
										groesse="klein"
										aria-label="Senden"
										className="size-knopf-klein rounded-full px-0"
										disabled={!entwurf.trim() || !frei || hinweis?.art === 'gesperrt'}
										onClick={() => void sende({ text: entwurf.trim() })}
									>
										<Symbol name="senden" />
									</Knopf>
								)}
							</div>
							<div className="flex justify-between gap-2 px-2.5 pb-1 text-[11px] leading-[14px] text-leise">
								<span>Keine Namen von Kindern eintragen.</span>
								<span className="flex-none">
									{`⏎ ${offenerVorschlag ? 'nachbessern' : 'senden'} · esc ${fenster === 'verlauf' ? 'einklappen' : 'schließen'}`}
								</span>
							</div>
						</div>
					) : (
						<div className="flex flex-col items-start gap-2 p-3" data-chat-ohne-anmeldung>
							<p>
								Auf diesem Server ist Claude nicht angemeldet. Über die Claude-App kannst du trotzdem an
								diesem Blatt arbeiten.
							</p>
							<Knopf onClick={() => handlungen.current.zurApp(ziel)}>
								<Symbol name="kopieren" />
								In der Claude-App weiterarbeiten
							</Knopf>
						</div>
					)}
				</section>
			)}
		</>
	);
};
