import type { Antworten, AssistentSchrittId, EinheitWahl, FreitextFeld, Weg } from '@schoolbox/kern/src/assistent';
import { einheitAngabenAus, formatWahl, FREITEXT, leereAntworten, schritteFuer } from '@schoolbox/kern/src/assistent';
import type { Art } from '@schoolbox/kern/src/werte';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { Dialog } from '../bausteine/Dialog';
import { useHinweis } from '../bausteine/hinweis';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { limitHinweis, neueGespraechId, useKiZustand } from '../editor/ki';
import { useEinheiten } from '../ordner/einheiten';
import { useAblage } from '../ordner/kontext';
import { ersterSchritt, LETZTE, mitWeg, ortDesAssistenten, wirksameAntworten } from './anlegen-hilfe';
import {
	Fehler,
	SchrittArt,
	SchrittBausteine,
	SchrittFormat,
	SchrittFuerWen,
	SchrittKlasse,
	Schrittleiste,
	SchrittStart,
	SchrittThema,
	SchrittTitel,
	StartHinweis,
} from './AnlegenSchritte';
import type { GemerkterAssistent } from './assistent-gemerkt';
import { ASSISTENT_FORTSETZEN, merkeAssistent } from './assistent-gemerkt';
import {
	EinheitVerbrauch,
	fensterWarnung,
	SchrittEBestandteile,
	SchrittERahmen,
	SchrittEThema,
	SchrittEUmfang,
} from './EinheitSchritte';
import { legeMaterialAn } from './material-anlegen';

interface MaterialDialogEigenschaften {
	/** Der Ordner des Assistenten; ohne: „Mein Material“. */
	ordner?: string | null;
	/** Aus der Seitenpalette (136): das Thema, mit Claude vorgewählt. */
	thema?: string;
	schliessen: () => void;
	vorDemSprung?: (mappe: string, dok: string) => void;
	/** „Weiter ausfüllen“ nach dem Schließen: dieselben Antworten im selben Schritt (190-02). */
	fortsetzen?: GemerkterAssistent | null;
}

const mitThema = (basis: Antworten, thema: string): Antworten =>
	mitWeg({ ...basis, thema: thema.slice(0, FREITEXT.thema.zeichen) }, 'claude');

const istTextfeld = (ziel: EventTarget | null) =>
	ziel instanceof HTMLInputElement || ziel instanceof HTMLTextAreaElement || ziel instanceof HTMLSelectElement;

/** Die Freitextfelder hinter „Anders …“ je Schritt: Offen und leer geht es nicht weiter (190-19). */
const ANDERS_FELDER: Partial<Record<AssistentSchrittId, readonly FreitextFeld[]>> = {
	format: ['formatText'],
	thema: ['funktionText', 'umfangText'],
};

const ANDERS_LEER = 'Bitte schreib, was du meinst, oder wähle eine Angabe.';

/** Der letzte Fragenschritt mit Claude holt den Plan; im leeren Weg legt der Titel an (190-37). */
const hauptText = (letzter: boolean, einheit: boolean, schritt: AssistentSchrittId) => {
	if (letzter) {
		return einheit ? 'Plan holen' : 'Aufgabenplan holen';
	}
	return schritt === 'titel' ? 'Leeres Blatt anlegen' : 'Weiter';
};

/** Links der Ausweg: unterwegs mit Claude der Wechsel zum leeren Blatt, sonst Abbrechen; rechts Zurück und ⏎. */
const Fuss = ({
	doch,
	gesperrt,
	hauptaktion,
	index,
	laeuft,
	letzter,
	schliessen,
	weiter,
	zumLeerenBlatt,
	zurueck,
}: {
	index: number;
	/** „Doch lieber leeres Blatt“ statt „Abbrechen“. */
	doch: boolean;
	letzter: boolean;
	hauptaktion: string;
	laeuft: boolean;
	/** Die Hauptaktion geht gerade nicht: am Limit, oder es ist noch offen, ob es Claude gibt. */
	gesperrt: boolean;
	zumLeerenBlatt: () => void;
	schliessen: () => void;
	zurueck: () => void;
	weiter: () => void;
}) => (
	<div className="flex items-center gap-2 border-t border-rand pt-3">
		{doch ? (
			<Knopf art="leise" disabled={laeuft} onClick={zumLeerenBlatt}>
				<Symbol name="blatt" />
				Doch lieber leeres Blatt
			</Knopf>
		) : (
			<Knopf art="leise" onClick={schliessen}>
				Abbrechen
			</Knopf>
		)}
		<span className="flex-1" />
		{index > 0 && (
			<Knopf art="zweit" disabled={laeuft} onClick={zurueck}>
				Zurück
			</Knopf>
		)}
		<Knopf data-hauptaktion disabled={laeuft || gesperrt} onClick={weiter}>
			{letzter && <Symbol name="funken" />}
			{hauptaktion}
		</Knopf>
	</div>
);

/**
 * Assistent „Material anlegen“ (132, Entwurf A1): eine Frage je Schritt, links die Schrittleiste. Fragen, Antworten
 * und Auftrag kommen aus dem Kern (`assistent.ts`). Abbrechen legt nichts an; erst der letzte Schritt schreibt.
 */
export const MaterialDialog = ({
	fortsetzen,
	ordner: festerOrdner,
	schliessen: schliesseDialog,
	thema,
	vorDemSprung,
}: MaterialDialogEigenschaften) => {
	const { stand } = useAblage();
	const { angabe: ordnerAngabe, ordner, vorbelegt } = ortDesAssistenten(stand, festerOrdner);
	const ki = useKiZustand();
	const { einheiten } = useEinheiten();
	const zeige = useHinweis();
	const laeuftSchon = einheiten.find((e) => e.status === 'laeuft')?.titel ?? null;
	const hinweis = limitHinweis(ki.zustand.limit, ki.zustand.warnAb);
	const einheitWarnung = fensterWarnung(ki.zustand.limit, ki.zustand.einheitWarnAb);
	const gesperrt = hinweis?.art === 'gesperrt';
	const navigate = useNavigate();

	const [antworten, setAntworten] = useState<Antworten>(() => {
		if (fortsetzen) {
			return fortsetzen.antworten;
		}
		const basis = leereAntworten(vorbelegt);
		return thema ? mitThema(basis, thema) : basis;
	});
	const [titelEigen, setTitelEigen] = useState(fortsetzen?.titelEigen ?? false);
	const [schritt, setSchritt] = useState<AssistentSchrittId>(() => fortsetzen?.schritt ?? ersterSchritt(thema));
	const [besucht, setBesucht] = useState<ReadonlySet<AssistentSchrittId>>(
		() => new Set(fortsetzen?.besucht ?? ['start', schritt]),
	);
	const [offen, setOffen] = useState<Partial<Record<FreitextFeld, boolean>>>(fortsetzen?.offen ?? {});
	const [fehler, setFehler] = useState<string | null>(null);
	const [laeuft, setLaeuft] = useState(false);
	const wurzel = useRef<HTMLDivElement>(null);
	// Text hinter einem zugeklappten „Anders …“: Kommt man zurück, steht er wieder da (190-19).
	const zugeklappt = useRef<Partial<Record<FreitextFeld, string>>>({});

	const wirksam = wirksameAntworten(antworten, vorbelegt, titelEigen);
	// Für ⏎ direkt nach einem Klick: Der Stand ist dann schon gesetzt, aber noch nicht gezeichnet.
	const jetzt = useRef(wirksam);
	jetzt.current = wirksam;

	// Ohne angemeldetes Claude bleibt nur das leere Blatt.
	useEffect(() => {
		if (ki.geladen && !ki.zustand.verfuegbar) {
			setAntworten((a) => mitWeg(a, 'leer'));
		}
	}, [ki.geladen, ki.zustand.verfuegbar]);

	// Jede Eingabe nimmt die Fehlermeldung weg; sie gehörte zur alten Antwort (190-03).
	const setze = (teil: Partial<Antworten>) => {
		setAntworten((a) => ({ ...a, ...teil }));
		jetzt.current = { ...jetzt.current, ...teil };
		setFehler(null);
	};
	const setzeOffen = (feld: FreitextFeld, an: boolean) => {
		setOffen((o) => ({ ...o, [feld]: an }));
		if (an) {
			setze({ [feld]: zugeklappt.current[feld] ?? jetzt.current[feld] });
		} else {
			zugeklappt.current[feld] = jetzt.current[feld];
			setze({ [feld]: '' });
		}
	};
	const setzeEh = (teil: Partial<EinheitWahl>) => {
		setAntworten((a) => ({ ...a, eh: { ...a.eh, ...teil } }));
		jetzt.current = { ...jetzt.current, eh: { ...jetzt.current.eh, ...teil } };
		setFehler(null);
	};
	const setzeTitel = (titel: string) => {
		setTitelEigen(true);
		setze({ titel });
	};

	// Schließen fragt nicht (132); mit Antworten über „Start“ hinaus bleibt der Stand für „Weiter ausfüllen“ (190-02).
	const angelegt = useRef(false);
	const zustand = useRef({ titelEigen, schritt, besucht, offen });
	zustand.current = { titelEigen, schritt, besucht, offen };
	const schliessen = () => {
		const z = zustand.current;
		if (!angelegt.current && z.besucht.size >= 3) {
			merkeAssistent({
				ordner,
				antworten: jetzt.current,
				titelEigen: z.titelEigen,
				schritt: z.schritt,
				besucht: [...z.besucht],
				offen: z.offen,
			});
			zeige({
				text: 'Assistent geschlossen.',
				aktion: {
					titel: 'Weiter ausfüllen',
					ausfuehren: () => window.dispatchEvent(new Event(ASSISTENT_FORTSETZEN)),
				},
			});
		}
		schliesseDialog();
	};
	const fertig = () => {
		angelegt.current = true;
		merkeAssistent(null);
	};

	const schritte = schritteFuer(wirksam);
	const index = Math.max(
		schritte.findIndex((s) => s.id === schritt),
		0,
	);
	const aktuell = schritte[index] ?? schritte[0];
	const mitClaude = wirksam.weg === 'claude';
	const letzter = mitClaude && index === schritte.length - 1;

	const gehe = (id: AssistentSchrittId) => {
		setFehler(null);
		setSchritt(id);
		setBesucht((b) => new Set([...b, id]));
	};

	// Neuer Schritt: Fokus aufs erste Feld, sonst auf die gewählte Antwort, damit ⏎ und Ziffern gleich greifen. Beim
	// Öffnen sind beide Wege gesperrt, bis feststeht, ob es Claude gibt; danach noch einmal.
	useEffect(() => {
		const w = wurzel.current;
		// Gesperrtes zählt nicht: Sonst bliebe der Fokus nach dem Laden auf nichts (190-06).
		const ziel =
			w?.querySelector<HTMLElement>('[data-fokus]:not(:disabled)') ??
			w?.querySelector<HTMLElement>('[data-wahl][aria-pressed="true"]:not(:disabled)') ??
			w?.querySelector<HTMLElement>('[data-hauptaktion]:not(:disabled)');
		ziel?.focus();
	}, [schritt, ki.geladen, wirksam.weg]);

	/** Die Einheit: Der Server legt Ordner und Behälter an und startet den Lauf; danach öffnet der Ordner (140). */
	const starteEinheit = async () => {
		const a = jetzt.current;
		const offenerSchritt = schritteFuer(a).find((s) => s.fehlt?.(a));
		if (offenerSchritt) {
			gehe(offenerSchritt.id);
			setFehler(offenerSchritt.fehlt?.(a) ?? null);
			return;
		}
		setLaeuft(true);
		setFehler(null);
		try {
			localStorage.setItem(LETZTE, JSON.stringify({ fach: a.fach, klasse: a.klasse }));
			const neu = await sende<{ id: string; ordner: string }>('/api/einheiten', {
				angaben: einheitAngabenAus(a),
				ordner,
			});
			fertig();
			schliesseDialog();
			void navigate(`/o/${neu.ordner}`);
		} catch (grund) {
			setFehler(meldung(grund));
			setLaeuft(false);
		}
	};

	const anlegen = async (mitClaude: boolean) => {
		const a = jetzt.current;
		const pruefen = mitClaude ? schritteFuer(a) : schritteFuer({ ...a, weg: 'leer' });
		const offenerSchritt = pruefen.find((s) => s.fehlt?.(a));
		if (offenerSchritt) {
			gehe(offenerSchritt.id);
			setFehler(offenerSchritt.fehlt?.(a) ?? null);
			return;
		}
		const wahl = formatWahl(a);
		// Der Entwurf beginnt ein eigenes Gespräch, damit Nachbessern daran anknüpft (133); der Editor übernimmt es.
		const gespraech = mitClaude ? neueGespraechId() : undefined;
		setLaeuft(true);
		setFehler(null);
		try {
			localStorage.setItem(LETZTE, JSON.stringify({ fach: a.fach, klasse: a.klasse }));
			const {
				id,
				mappe,
				state,
				ziel: adresse,
			} = await legeMaterialAn({
				ordner,
				titel: a.titel.trim(),
				art: a.art,
				format: wahl.format,
				vorlage: wahl.vorlage ?? null,
				fach: a.fach,
				klasse: a.klasse,
				assistent: mitClaude ? { antworten: { ...a, weg: 'claude' } } : null,
				gespraechId: gespraech,
				vorschlag: !zustand.current.titelEigen,
			});
			fertig();
			vorDemSprung?.(mappe, id);
			void navigate(adresse, { state });
		} catch (grund) {
			setFehler(meldung(grund));
			setLaeuft(false);
		}
	};

	const weiter = () => {
		const a = jetzt.current;
		const liste = schritteFuer(a);
		const i = Math.max(
			liste.findIndex((s) => s.id === schritt),
			0,
		);
		const s = liste[i];
		// Vor der Antwort vom Server ist offen, ob es Claude gibt.
		if (!s || laeuft || (s.id === 'start' && !ki.geladen)) {
			return;
		}
		const fehlt = s.fehlt?.(a);
		if (fehlt) {
			setFehler(fehlt);
			return;
		}
		const andersLeer = (ANDERS_FELDER[s.id] ?? []).find((f) => offen[f] === true && a[f].trim() === '');
		if (andersLeer) {
			setFehler(ANDERS_LEER);
			wurzel.current?.querySelector<HTMLElement>(`[data-freitext="${andersLeer}"]`)?.focus();
			return;
		}
		if (s.id === 'eUmfang' && offen.umfangText === true && a.eh.dauerText.trim() === '') {
			setFehler(ANDERS_LEER);
			wurzel.current?.querySelector<HTMLElement>('[data-anders-feld]')?.focus();
			return;
		}
		if (a.weg === 'claude' && i === liste.length - 1) {
			if (a.einheit) {
				if (!gesperrt && laeuftSchon === null) {
					void starteEinheit();
				}
			} else if (!gesperrt) {
				void anlegen(true);
			}
			return;
		}
		if (s.id === 'titel') {
			void anlegen(false);
			return;
		}
		const naechster = liste[i + 1];
		if (naechster) {
			gehe(naechster.id);
		}
	};
	const zurueck = () => {
		const vorher = schritte[index - 1];
		if (vorher) {
			gehe(vorher.id);
		}
	};
	const zumLeerenBlatt = () => {
		const a = jetzt.current;
		setTitelEigen(true);
		setze({ ...mitWeg(a, 'leer'), titel: a.titel });
		setBesucht(new Set(['start', 'art', 'format', 'titel']));
		setSchritt('titel');
		setFehler(null);
	};

	const setzeWeg = (weg: Weg) => {
		setAntworten((a) => mitWeg(a, weg));
		jetzt.current = mitWeg(jetzt.current, weg);
	};
	const waehleEinheit = () => {
		setze({ einheit: true, art: 'arbeitsblatt', format: '', umfang: null, umfangText: '', artText: '' });
		setOffen((o) => ({ ...o, artText: false }));
	};
	const waehleArt = (art: Art) => {
		const a = jetzt.current;
		setze({
			einheit: false,
			art,
			format: '',
			bausteine: {},
			umfang: null,
			umfangText: '',
			artText: art === 'sonstiges' ? a.artText : '',
		});
		setOffen((o) => ({ ...o, artText: art === 'sonstiges', umfangText: false }));
	};

	// ⏎ weiter, ⇧⏎ zurück, Ziffern wählen; im mehrzeiligen Feld ist ⌘⏎ „weiter“ (A1, Fallen in 132).
	const tasten = useRef<(e: KeyboardEvent) => void>(() => undefined);
	tasten.current = (e: KeyboardEvent) => {
		if (laeuft || e.defaultPrevented) {
			return;
		}
		const ziel = e.target;
		if (e.key === 'Enter' && !e.isComposing) {
			const mehrzeilig = ziel instanceof HTMLTextAreaElement;
			if (mehrzeilig && !(e.metaKey || e.ctrlKey)) {
				return;
			}
			if (e.shiftKey) {
				e.preventDefault();
				zurueck();
				return;
			}
			if (ziel instanceof HTMLButtonElement) {
				// Im Fuß tut ein Knopf, was er sagt. Im Schritt wählt ⏎ eine Karte und geht weiter; einen Schalter oder
				// Chip schaltet es nicht um, das tut die Leertaste (190-01).
				if (!ziel.closest('[data-schritt-inhalt]')) {
					return;
				}
				e.preventDefault();
				if (ziel.dataset.wahl && !ziel.disabled) {
					ziel.click();
				}
			} else {
				e.preventDefault();
			}
			weiter();
			return;
		}
		// Esc in einem Feld mit Text verlässt nur das Feld; ein Versehen kostet nicht alle Antworten (190-02).
		if (
			e.key === 'Escape' &&
			(ziel instanceof HTMLInputElement || ziel instanceof HTMLTextAreaElement) &&
			ziel.value !== ''
		) {
			e.preventDefault();
			wurzel.current?.querySelector<HTMLElement>('[data-hauptaktion]:not(:disabled)')?.focus();
			return;
		}
		if (/^[1-9]$/.test(e.key) && !istTextfeld(ziel) && !e.metaKey && !e.ctrlKey && !e.altKey) {
			const wahl = wurzel.current?.querySelector<HTMLButtonElement>(`[data-wahl-nr="${e.key}"]`);
			if (wahl && !wahl.disabled) {
				e.preventDefault();
				wahl.click();
				wahl.focus();
			}
		}
	};
	useEffect(() => {
		const hoere = (e: KeyboardEvent) => tasten.current(e);
		document.addEventListener('keydown', hoere);
		return () => document.removeEventListener('keydown', hoere);
	}, []);

	if (!aktuell) {
		return null;
	}
	const titel =
		ordner === null ? 'Neues Material in „Mein Material“' : `Neues Material im Ordner „${ordnerAngabe.name}“`;
	const kiGrund = ki.geladen
		? 'Auf diesem Server ist Claude nicht angemeldet. Über die Claude-App geht es trotzdem.'
		: 'Claude wird gefragt …';
	const inhalt: Record<AssistentSchrittId, () => ReactNode> = {
		start: () => (
			<SchrittStart
				a={wirksam}
				verfuegbar={ki.zustand.verfuegbar}
				grund={kiGrund}
				setzeWeg={setzeWeg}
				weiter={weiter}
			/>
		),
		art: () => (
			<SchrittArt
				a={wirksam}
				offen={offen.artText === true}
				setze={setze}
				waehleArt={waehleArt}
				waehleEinheit={waehleEinheit}
				weiter={weiter}
				laeuftSchon={laeuftSchon}
			/>
		),
		format: () => (
			<SchrittFormat
				a={wirksam}
				wahl={formatWahl(wirksam)}
				offen={offen.formatText === true && wirksam.weg === 'claude'}
				setze={setze}
				setzeOffen={(o) => setzeOffen('formatText', o)}
				weiter={weiter}
			/>
		),
		fuerWen: () => <SchrittFuerWen a={wirksam} ordner={ordnerAngabe} setze={setze} />,
		thema: () => (
			<SchrittThema
				a={wirksam}
				offen={offen}
				setze={setze}
				setzeOffen={setzeOffen}
				setzeTitel={setzeTitel}
				titelVorschlagen={!titelEigen}
			/>
		),
		eThema: () => (
			<SchrittEThema
				a={wirksam}
				setze={setze}
				setzeEh={setzeEh}
				setzeTitel={setzeTitel}
				titelVorschlagen={!titelEigen}
			/>
		),
		eUmfang: () => (
			<SchrittEUmfang
				a={wirksam}
				offen={offen.umfangText === true || wirksam.eh.dauerText !== ''}
				setzeEh={setzeEh}
				setzeOffen={(o) => {
					setOffen((x) => ({ ...x, umfangText: o }));
					if (!o) {
						setzeEh({ dauerText: '' });
					}
				}}
			/>
		),
		eBestandteile: () => <SchrittEBestandteile a={wirksam} setzeEh={setzeEh} />,
		eRahmen: () => <SchrittERahmen a={wirksam} setzeEh={setzeEh} />,
		bausteine: () => <SchrittBausteine a={wirksam} setze={setze} />,
		klasse: () => (
			<SchrittKlasse
				a={wirksam}
				setze={setze}
				schluss={
					<StartHinweis
						einheit={
							wirksam.einheit ? (
								<EinheitVerbrauch laeuftSchon={laeuftSchon} warnung={einheitWarnung} />
							) : null
						}
						hinweis={hinweis}
						gesperrt={gesperrt}
						pruefeLimit={ki.pruefeLimit}
					/>
				}
			/>
		),
		titel: () => <SchrittTitel a={wirksam} ordner={ordnerAngabe} setze={setze} setzeTitel={setzeTitel} />,
	};

	return (
		<Dialog titel={titel} breit schliessen={schliessen}>
			<div ref={wurzel} data-assistent={aktuell.id} className="flex flex-col gap-3">
				{/* Feste Höhe: Kein Schritt lässt den Fuß springen; was nicht passt, rollt (190-17). */}
				<div className="grid h-[32rem] grid-cols-[12rem_1fr] gap-4 max-md:h-auto max-md:grid-cols-1">
					<Schrittleiste a={wirksam} aktuell={aktuell.id} besucht={besucht} gehe={gehe} />
					<div className="min-w-0 overflow-y-auto px-0.5 pb-1" data-schritt-inhalt>
						<p className="text-xs font-medium text-leise">{`Schritt ${index + 1} von ${schritte.length}`}</p>
						<h3 className="text-lg font-semibold">{aktuell.frage(wirksam)}</h3>
						<p className="mb-3 text-leise">{aktuell.hilfe(wirksam)}</p>
						<Fehler text={fehler} />
						{inhalt[aktuell.id]()}
					</div>
				</div>
				<Fuss
					index={index}
					doch={mitClaude && index > 0 && !wirksam.einheit}
					letzter={letzter}
					hauptaktion={hauptText(letzter, wirksam.einheit, aktuell.id)}
					laeuft={laeuft}
					gesperrt={
						(letzter && (gesperrt || (wirksam.einheit && laeuftSchon !== null))) ||
						(aktuell.id === 'start' && !ki.geladen)
					}
					zumLeerenBlatt={zumLeerenBlatt}
					schliessen={schliessen}
					zurueck={zurueck}
					weiter={weiter}
				/>
			</div>
		</Dialog>
	);
};
