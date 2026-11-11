import type { Antworten, AssistentSchrittId, FreitextFeld, Weg } from '@schoolbox/kern/src/assistent';
import { formatWahl, FREITEXT, leereAntworten, schritteFuer } from '@schoolbox/kern/src/assistent';
import type { Art } from '@schoolbox/kern/src/werte';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { meldung } from '../api';
import { Dialog } from '../bausteine/Dialog';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { limitHinweis, neueGespraechId, useKiZustand } from '../editor/ki';
import { useAblage } from '../ordner/kontext';
import { ersterSchritt, LETZTE, mitWeg, ortDesAssistenten, wirksameAntworten } from './anlegen-hilfe';
import type { AuftragText } from './AnlegenSchritte';
import {
	Fehler,
	SchrittArt,
	SchrittBausteine,
	SchrittFormat,
	SchrittFuerWen,
	SchrittKlasse,
	Schrittleiste,
	SchrittPruefen,
	SchrittStart,
	SchrittThema,
	SchrittTitel,
} from './AnlegenSchritte';
import { legeMaterialAn } from './material-anlegen';

interface MaterialDialogEigenschaften {
	/** Der Ordner des Assistenten; ohne: „Mein Material“. */
	ordner?: string | null;
	/** Aus der Seitenpalette (136): das Thema, mit Claude vorgewählt. */
	thema?: string;
	schliessen: () => void;
	vorDemSprung?: (mappe: string, dok: string) => void;
}

const mitThema = (basis: Antworten, thema: string): Antworten =>
	mitWeg({ ...basis, thema: thema.slice(0, FREITEXT.thema.zeichen) }, 'claude');

const istTextfeld = (ziel: EventTarget | null) =>
	ziel instanceof HTMLInputElement || ziel instanceof HTMLTextAreaElement || ziel instanceof HTMLSelectElement;

const hauptText = (schritt: AssistentSchrittId) => {
	if (schritt === 'pruefen') {
		return 'Mit Claude erstellen';
	}
	return schritt === 'titel' ? 'Leeres Blatt anlegen' : 'Weiter';
};

/** Beim Auftrag das leere Blatt statt Claude, unterwegs der Wechsel dorthin, sonst Abbrechen. */
const Ausweg = ({
	anlegenLeer,
	doch,
	laeuft,
	schliessen,
	schritt,
	zumLeerenBlatt,
}: {
	schritt: AssistentSchrittId;
	doch: boolean;
	laeuft: boolean;
	anlegenLeer: () => void;
	zumLeerenBlatt: () => void;
	schliessen: () => void;
}) => {
	if (schritt === 'pruefen') {
		return (
			<Knopf art="leise" disabled={laeuft} onClick={anlegenLeer}>
				<Symbol name="blatt" />
				Nur leeres Blatt anlegen
			</Knopf>
		);
	}
	if (doch) {
		return (
			<Knopf art="leise" onClick={zumLeerenBlatt}>
				<Symbol name="blatt" />
				Doch lieber leeres Blatt
			</Knopf>
		);
	}
	return (
		<Knopf art="leise" onClick={schliessen}>
			Abbrechen
		</Knopf>
	);
};

/** Links der Ausweg, rechts Zurück, Überspringen und die Hauptaktion mit ⏎. */
const Fuss = ({
	anlegenLeer,
	claude,
	gesperrt,
	index,
	laeuft,
	schliessen,
	schritt,
	weiter,
	zumLeerenBlatt,
	zurueck,
}: {
	schritt: { id: AssistentSchrittId; optional?: boolean };
	index: number;
	claude: boolean;
	laeuft: boolean;
	/** Die Hauptaktion geht gerade nicht: am Limit, oder es ist noch offen, ob es Claude gibt. */
	gesperrt: boolean;
	anlegenLeer: () => void;
	zumLeerenBlatt: () => void;
	schliessen: () => void;
	zurueck: () => void;
	weiter: () => void;
}) => (
	<div className="flex items-center gap-2 border-t border-rand pt-3">
		<Ausweg
			schritt={schritt.id}
			doch={claude && index > 0}
			laeuft={laeuft}
			anlegenLeer={anlegenLeer}
			zumLeerenBlatt={zumLeerenBlatt}
			schliessen={schliessen}
		/>
		<span className="flex-1" />
		{index > 0 && (
			<Knopf art="zweit" onClick={zurueck}>
				Zurück
			</Knopf>
		)}
		{schritt.optional && (
			<Knopf art="zweit" onClick={weiter}>
				Überspringen
			</Knopf>
		)}
		<Knopf data-hauptaktion disabled={laeuft || gesperrt} onClick={weiter}>
			{schritt.id === 'pruefen' && <Symbol name="funken" />}
			{hauptText(schritt.id)}
			<kbd aria-hidden="true" className="ml-1 text-xs opacity-75">
				⏎
			</kbd>
		</Knopf>
	</div>
);

/**
 * Assistent „Material anlegen“ (132, Entwurf A1): eine Frage je Schritt, links die Schrittleiste. Fragen, Antworten
 * und Auftrag kommen aus dem Kern (`assistent.ts`). Abbrechen legt nichts an; erst der letzte Schritt schreibt.
 */
export const MaterialDialog = ({
	ordner: festerOrdner,
	schliessen,
	thema,
	vorDemSprung,
}: MaterialDialogEigenschaften) => {
	const { stand } = useAblage();
	const { angabe: ordnerAngabe, ordner, vorbelegt } = ortDesAssistenten(stand, festerOrdner);
	const ki = useKiZustand();
	const hinweis = limitHinweis(ki.zustand.limit, ki.zustand.warnAb);
	const gesperrt = hinweis?.art === 'gesperrt';
	const navigate = useNavigate();

	const [antworten, setAntworten] = useState<Antworten>(() => {
		const basis = leereAntworten(vorbelegt);
		return thema ? mitThema(basis, thema) : basis;
	});
	const [titelEigen, setTitelEigen] = useState(false);
	const [schritt, setSchritt] = useState<AssistentSchrittId>(() => ersterSchritt(thema));
	const [besucht, setBesucht] = useState<ReadonlySet<AssistentSchrittId>>(() => new Set(['start', schritt]));
	const [offen, setOffen] = useState<Partial<Record<FreitextFeld, boolean>>>({});
	const [text, setText] = useState<AuftragText | null>(null);
	const [fehler, setFehler] = useState<string | null>(null);
	const [laeuft, setLaeuft] = useState(false);
	const wurzel = useRef<HTMLDivElement>(null);

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

	const setze = (teil: Partial<Antworten>) => {
		setAntworten((a) => ({ ...a, ...teil }));
		jetzt.current = { ...jetzt.current, ...teil };
	};
	const setzeOffen = (feld: FreitextFeld, an: boolean) => {
		setOffen((o) => ({ ...o, [feld]: an }));
		if (!an) {
			setze({ [feld]: '' });
		}
	};
	const setzeTitel = (titel: string) => {
		setTitelEigen(true);
		setze({ titel });
	};

	const schritte = schritteFuer(wirksam);
	const index = Math.max(
		schritte.findIndex((s) => s.id === schritt),
		0,
	);
	const aktuell = schritte[index] ?? schritte[0];

	const gehe = (id: AssistentSchrittId) => {
		setFehler(null);
		setSchritt(id);
		setBesucht((b) => new Set([...b, id]));
	};

	// Neuer Schritt: Fokus aufs erste Feld, sonst auf die gewählte Antwort, damit ⏎ und Ziffern gleich greifen. Beim
	// Öffnen sind beide Wege gesperrt, bis feststeht, ob es Claude gibt; danach noch einmal.
	useEffect(() => {
		const w = wurzel.current;
		const ziel =
			w?.querySelector<HTMLElement>('[data-fokus]') ??
			w?.querySelector<HTMLElement>('[data-wahl][aria-pressed="true"]') ??
			w?.querySelector<HTMLElement>('[data-hauptaktion]');
		ziel?.focus();
	}, [schritt, ki.geladen]);

	const anlegen = async (mitClaude: boolean) => {
		const a = jetzt.current;
		const pruefen = mitClaude ? schritteFuer(a) : schritteFuer({ ...a, weg: 'leer' });
		const offenerSchritt = pruefen.find((s) => s.fehlt?.(a));
		if (offenerSchritt) {
			gehe(offenerSchritt.id);
			setFehler(offenerSchritt.fehlt?.(a) ?? null);
			return;
		}
		if (mitClaude && text !== null && text.wert.trim() === '') {
			setFehler('Der Auftrag ist leer.');
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
				assistent: mitClaude ? { antworten: { ...a, weg: 'claude' }, auftragText: text?.wert ?? null } : null,
				gespraechId: gespraech,
			});
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
		if (s.id === 'pruefen') {
			if (!gesperrt) {
				void anlegen(true);
			}
			return;
		}
		if (s.id === 'titel') {
			void anlegen(false);
			return;
		}
		const fehlt = s.fehlt?.(a);
		if (fehlt) {
			setFehler(fehlt);
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
	const waehleArt = (art: Art) => {
		const a = jetzt.current;
		setze({
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
				if (!ziel.dataset.wahl) {
					return;
				}
				e.preventDefault();
				ziel.click();
			} else {
				e.preventDefault();
			}
			weiter();
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
				weiter={weiter}
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
				offen={offen.funktionText === true}
				setze={setze}
				setzeOffen={(o) => setzeOffen('funktionText', o)}
			/>
		),
		bausteine: () => <SchrittBausteine a={wirksam} offen={offen} setze={setze} setzeOffen={setzeOffen} />,
		klasse: () => <SchrittKlasse a={wirksam} setze={setze} />,
		titel: () => <SchrittTitel a={wirksam} ordner={ordnerAngabe} setze={setze} setzeTitel={setzeTitel} />,
		pruefen: () => (
			<SchrittPruefen
				a={wirksam}
				ordner={ordnerAngabe}
				text={text}
				setzeText={setText}
				setzeTitel={setzeTitel}
				titelVorschlagen={!titelEigen}
				hinweis={hinweis}
				gesperrt={gesperrt}
				pruefeLimit={ki.pruefeLimit}
			/>
		),
	};

	return (
		<Dialog titel={titel} breit schliessen={schliessen}>
			<div ref={wurzel} data-assistent={aktuell.id} className="flex flex-col gap-3">
				<div className="grid min-h-[28rem] grid-cols-[12rem_1fr] gap-4 max-md:grid-cols-1">
					<Schrittleiste a={wirksam} aktuell={aktuell.id} besucht={besucht} gehe={gehe} />
					<div className="min-w-0">
						<p className="text-xs font-medium text-leise">{`Schritt ${index + 1} von ${schritte.length}`}</p>
						<h3 className="text-lg font-semibold">{aktuell.frage(wirksam)}</h3>
						<p className="mb-3 text-leise">{aktuell.hilfe(wirksam)}</p>
						<Fehler text={fehler} />
						{inhalt[aktuell.id]()}
					</div>
				</div>
				<Fuss
					schritt={aktuell}
					index={index}
					claude={wirksam.weg === 'claude'}
					laeuft={laeuft}
					gesperrt={(aktuell.id === 'pruefen' && gesperrt) || (aktuell.id === 'start' && !ki.geladen)}
					anlegenLeer={() => void anlegen(false)}
					zumLeerenBlatt={zumLeerenBlatt}
					schliessen={schliessen}
					zurueck={zurueck}
					weiter={weiter}
				/>
			</div>
		</Dialog>
	);
};
