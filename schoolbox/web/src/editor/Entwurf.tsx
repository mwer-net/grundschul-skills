import type { FormEvent, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { lade } from '../api';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { ortDesDokuments } from '../ordner/kontext';
import type { AblageStand } from '../ordner/typen';
import type { EntwurfPhase } from './entwurf';
import { annahmenAus, laufzeit, useJetzt } from './entwurf';
import type { KiAuftrag, useKiZustand, Vorschlag } from './ki';
import { limitHinweis } from './ki';
import { LimitZeile } from './LimitZeile';
import { istTextfeld, TASTEN_SPERRE } from './tasten';
import type { Entwurf } from './useEntwurf';

const FELD_ZEICHEN = 1000;

const Schritte = ({ auftrag }: { auftrag: KiAuftrag }) => (
	<ul className="mt-2 flex flex-col gap-1">
		{auftrag.schritte.length === 0 && (
			<li className="flex items-center gap-2 text-leise">
				<Symbol name="laden" className="size-3.5 flex-none animate-spin" />
				{auftrag.status === 'wartet' ? 'Wartet auf den vorigen Auftrag' : 'Liest den Auftrag'}
			</li>
		)}
		{auftrag.schritte.map((s, i) => {
			const letzter = i === auftrag.schritte.length - 1;
			return (
				<li key={s} className={klassen('flex items-center gap-2', letzter ? 'font-medium' : 'text-leise')}>
					<Symbol
						name={letzter ? 'laden' : 'haken'}
						className={klassen('size-3.5 flex-none', letzter ? 'animate-spin text-brand-600' : 'text-gut')}
					/>
					{s}
				</li>
			);
		})}
	</ul>
);

/** Der Aufgabenplan zur Freigabe: derselbe Schritt wie in der Claude-App, bevor Claude baut. */
const PlanKarte = ({
	entwurf,
	karte,
	ki,
	phase,
	titel,
}: {
	entwurf: Entwurf;
	ki: ReturnType<typeof useKiZustand>;
	phase: Extract<EntwurfPhase, { art: 'plan' }>;
	titel: string;
	karte: RefObject<HTMLDivElement | null>;
}) => {
	const [feldOffen, setFeldOffen] = useState(false);
	const schliesseFeld = useCallback(() => setFeldOffen(false), []);
	const hinweis = limitHinweis(ki.zustand.limit, ki.zustand.warnAb);
	const gesperrt = hinweis?.art === 'gesperrt';
	return (
		<div className="pointer-events-none sticky top-0 z-10 h-0">
			<div
				ref={karte}
				tabIndex={-1}
				className="pointer-events-auto mx-auto mt-[6vh] flex max-h-[84vh] w-[46rem] max-w-[calc(100%-2rem)] flex-col rounded-xl border border-rand bg-flaeche p-4 text-sm shadow-lg outline-none"
				role="dialog"
				aria-label="Aufgabenplan"
				data-entwurf-karte="plan"
			>
				<p className="flex items-center gap-2 font-semibold">
					<Symbol name="funken" className="size-4 flex-none text-brand-600" />
					<span className="min-w-0 flex-1 truncate">{`Aufgabenplan für „${titel}“`}</span>
				</p>
				<p className="mt-1 text-xs text-leise">
					So würde Claude das Blatt bauen. Passt das? Danach entsteht genau dieses Blatt, mit Prüfung und
					Lösung.
				</p>
				<div
					className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-md border border-rand bg-papier px-3 py-2 whitespace-pre-wrap"
					data-entwurf-plan
				>
					{phase.text.trim()}
				</div>
				{phase.fehler && (
					<p role="alert" className="mt-2 text-fehler" data-entwurf-fehler>
						{phase.fehler}
					</p>
				)}
				{hinweis && <LimitZeile className="mt-2" hinweis={hinweis} pruefeLimit={ki.pruefeLimit} />}
				{feldOffen ? (
					<PlanFeld sende={entwurf.planAendern} schliessen={schliesseFeld} />
				) : (
					<div className="mt-3 flex flex-wrap gap-2">
						<Knopf disabled={gesperrt} onClick={entwurf.planFreigeben} data-entwurf-plan-freigeben>
							So bauen
						</Knopf>
						<Knopf art="zweit" disabled={gesperrt} onClick={() => setFeldOffen(true)}>
							<Symbol name="funken" />
							Ändern …
						</Knopf>
						<Knopf art="leise" onClick={entwurf.schliesse}>
							Verwerfen
						</Knopf>
					</div>
				)}
			</div>
		</div>
	);
};

/** Die Karte auf dem Blatt: Fortschritt, oder der Grund, warum kein Entwurf kam. */
export const EntwurfKarte = ({
	entwurf,
	karte,
	ki,
	titel,
}: {
	entwurf: Entwurf;
	ki: ReturnType<typeof useKiZustand>;
	titel: string;
	karte: RefObject<HTMLDivElement | null>;
}) => {
	const { phase } = entwurf;
	const laeuft = phase?.art === 'laeuft';
	const jetzt = useJetzt(laeuft);
	if (phase?.art === 'plan') {
		return <PlanKarte entwurf={entwurf} karte={karte} ki={ki} phase={phase} titel={titel} />;
	}
	if (phase?.art !== 'laeuft' && phase?.art !== 'fehler') {
		return null;
	}
	const hinweis = limitHinweis(ki.zustand.limit, ki.zustand.warnAb);
	const plant = phase.art === 'laeuft' && phase.auftrag.phase === 'plan';
	const laufTitel = plant ? `Claude plant „${titel}“` : `Claude baut „${titel}“`;
	return (
		<div className="pointer-events-none sticky top-0 z-10 h-0">
			<div
				ref={karte}
				tabIndex={-1}
				className="pointer-events-auto mx-auto mt-[18vh] w-[26rem] max-w-[calc(100%-2rem)] rounded-xl border border-rand bg-flaeche p-4 text-sm shadow-lg outline-none"
				role={laeuft ? 'status' : 'alert'}
				data-entwurf-karte={phase.art}
			>
				{phase.art === 'laeuft' ? (
					<>
						<p className="flex items-center gap-2 font-semibold">
							<Symbol name="funken" className="size-4 flex-none text-brand-600" />
							<span className="min-w-0 flex-1 truncate">
								{phase.nachbessern ? 'Claude bessert den Entwurf nach' : laufTitel}
							</span>
							<span className="flex-none font-normal text-leise tabular-nums">
								{laufzeit(phase.auftrag.seit, jetzt)}
							</span>
						</p>
						<div className="mt-2 h-1 overflow-hidden rounded-full bg-brand-100">
							<div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
						</div>
						<Schritte auftrag={phase.auftrag} />
						<p className="mt-3 text-xs text-leise">
							{plant
								? 'Zuerst kommt der Aufgabenplan, meist nach ein bis zwei Minuten. Gebaut wird, wenn du ihn freigibst.'
								: 'Claude baut, prüft und sieht sich jede Seite an. Das dauert meist 5 bis 15 Minuten. Du kannst den Editor verlassen, die Arbeit läuft weiter.'}
						</p>
						<Knopf art="zweit" className="mt-3" onClick={entwurf.abbrechen}>
							Abbrechen
						</Knopf>
					</>
				) : (
					<>
						<p className="flex items-center gap-2 font-semibold">
							<Symbol name="achtung" className="size-4 flex-none" />
							Claude hat kein Blatt gebaut
						</p>
						<p className="mt-1 whitespace-pre-line" data-entwurf-grund>
							{phase.text}
						</p>
						{hinweis && <LimitZeile className="mt-2" hinweis={hinweis} pruefeLimit={ki.pruefeLimit} />}
						<p className="mt-2 text-xs text-leise">Das leere Blatt bleibt im Ordner.</p>
						<div className="mt-3 flex gap-2">
							<Knopf disabled={hinweis?.art === 'gesperrt'} onClick={entwurf.nochmal}>
								Nochmal
							</Knopf>
							<Knopf art="zweit" onClick={entwurf.schliesse}>
								Selbst füllen
							</Knopf>
						</div>
					</>
				)}
			</div>
		</div>
	);
};

/** Im Kopf, solange Claude baut. Ein Klick führt zur Karte. */
export const EntwurfPille = ({ entwurf, zurKarte }: { entwurf: Entwurf; zurKarte: () => void }) => {
	const { phase } = entwurf;
	const jetzt = useJetzt(phase?.art === 'laeuft');
	if (phase?.art !== 'laeuft') {
		return null;
	}
	const zeit = laufzeit(phase.auftrag.seit, jetzt);
	return (
		<button
			type="button"
			className="inline-flex h-7 flex-none items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 text-xs font-medium text-brand-700 tabular-nums [@media(any-pointer:coarse)]:h-11"
			data-entwurf-pille
			onClick={zurKarte}
		>
			<Symbol name="laden" className="size-3 flex-none animate-spin" />
			{zeit ? `Claude arbeitet · ${zeit}` : 'Claude wartet'}
		</button>
	);
};

const zusammenfassung = (v: Vorschlag) => {
	const aufgaben = v.quelle
		? new DOMParser().parseFromString(v.quelle, 'text/html').querySelectorAll('.aufgabe:not(.aufgabe .aufgabe)')
				.length
		: 0;
	const hinweise = v.meldungen.length === 0 ? 'Prüfung ohne Befund' : `${v.meldungen.length} Hinweise der Prüfung`;
	const pruefung = v.fehler > 0 ? `${v.fehler} Fehler in der Prüfung: bitte nachbessern lassen` : hinweise;
	return [aufgaben > 0 ? `${aufgaben} ${aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}` : null, pruefung]
		.filter(Boolean)
		.join(' · ');
};

const NachbessernFeld = ({ schliessen, sende }: { sende: (text: string) => Promise<void>; schliessen: () => void }) => {
	const [text, setText] = useState('');
	const abschicken = (e: FormEvent) => {
		e.preventDefault();
		if (text.trim()) {
			void sende(text.trim());
			schliessen();
		}
	};
	return (
		<form className="mt-2 flex items-center gap-2 border-t border-rand pt-2" onSubmit={abschicken}>
			<input
				autoFocus
				aria-label="Was soll Claude am Entwurf ändern?"
				placeholder="Was soll Claude am Entwurf ändern?"
				className="h-8 min-w-0 flex-1 rounded-md border border-rand-feld bg-flaeche px-2 [@media(any-pointer:coarse)]:h-11"
				maxLength={FELD_ZEICHEN}
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						schliessen();
					}
				}}
			/>
			<Knopf type="submit" disabled={!text.trim()}>
				Senden
			</Knopf>
			<Knopf art="leise" onClick={schliessen}>
				Abbrechen
			</Knopf>
		</form>
	);
};

const PlanFeld = ({ schliessen, sende }: { sende: (text: string) => Promise<void>; schliessen: () => void }) => {
	const [text, setText] = useState('');
	const abschicken = (e: FormEvent) => {
		e.preventDefault();
		if (text.trim()) {
			void sende(text.trim());
			schliessen();
		}
	};
	return (
		<form className="mt-3 flex flex-col gap-2" onSubmit={abschicken}>
			<textarea
				autoFocus
				aria-label="Was soll am Plan anders sein?"
				placeholder="Was soll am Plan anders sein? Zum Beispiel: mehr Sachaufgaben, Aufgabe 3 weglassen, nur 15 Minuten."
				className="min-h-20 rounded-md border border-rand-feld bg-flaeche px-2 py-1.5"
				maxLength={FELD_ZEICHEN}
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						schliessen();
					}
					if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
						abschicken(e);
					}
				}}
			/>
			<div className="flex gap-2">
				<Knopf type="submit" disabled={!text.trim()}>
					Plan ändern
				</Knopf>
				<Knopf art="leise" onClick={schliessen}>
					Abbrechen
				</Knopf>
			</div>
		</form>
	);
};

/** Der Editor liegt außerhalb der Ablage (`Rahmen`) und hat ihren Stand nicht: einmal holen, wenn die Zeile kommt. */
const useOrdnerVon = (mappe: string, dok: string) => {
	const [ordner, setOrdner] = useState<ReturnType<typeof ortDesDokuments>>(null);
	useEffect(() => {
		let weg = false;
		lade<AblageStand>('/api/ordner')
			.then((stand) => {
				if (!weg) {
					setOrdner(ortDesDokuments(stand, mappe, dok));
				}
			})
			.catch(() => undefined);
		return () => {
			weg = true;
		};
	}, [mappe, dok]);
	return ordner;
};

const EndeZeile = ({ entwurf, phase }: { entwurf: Entwurf; phase: Extract<EntwurfPhase, { art: 'ende' }> }) => {
	const navigate = useNavigate();
	const ordner = useOrdnerVon(entwurf.mappe, entwurf.dok);
	return (
		<div
			role="status"
			className="sticky top-0 z-10 mx-3 mt-2 flex items-center gap-2 rounded-lg border border-rand bg-flaeche px-3 py-1.5 text-sm shadow-sm"
			data-entwurfsleiste="ende"
		>
			<p className="min-w-0 flex-1">
				{`${phase.wie === 'verworfen' ? 'Verworfen' : 'Abgebrochen'}. Das leere Blatt bleibt im Ordner${
					ordner ? ` „${ordner.name}“` : ''
				}.`}
			</p>
			{ordner && (
				<Knopf art="zweit" groesse="klein" onClick={() => void navigate(ordner.adresse)}>
					Ordner öffnen
				</Knopf>
			)}
			<Knopf art="leise" groesse="klein" aria-label="Schließen" onClick={entwurf.schliesse}>
				<Symbol name="schliessen" />
			</Knopf>
		</div>
	);
};

/** ⏎ übernimmt, solange nichts anderes die Tastatur braucht. */
const useUebernehmenTaste = (aktiv: boolean, uebernehmen: () => void) => {
	const jetzt = useRef(uebernehmen);
	useEffect(() => {
		jetzt.current = uebernehmen;
	}, [uebernehmen]);
	useEffect(() => {
		if (!aktiv) {
			return undefined;
		}
		const taste = (e: KeyboardEvent) => {
			const frei =
				e.key === 'Enter' &&
				!e.shiftKey &&
				!e.metaKey &&
				!e.ctrlKey &&
				!e.altKey &&
				!e.isComposing &&
				!istTextfeld(e.target) &&
				!(e.target instanceof HTMLButtonElement) &&
				!document.querySelector(TASTEN_SPERRE);
			if (frei) {
				e.preventDefault();
				jetzt.current();
			}
		};
		document.addEventListener('keydown', taste);
		return () => document.removeEventListener('keydown', taste);
	}, [aktiv]);
};

/** Über dem Blatt, solange der Entwurf offen ist (A1 S. 11): Übernehmen, Nachbessern, Verwerfen. */
export const Entwurfsleiste = ({ entwurf }: { entwurf: Entwurf }) => {
	const { phase } = entwurf;
	const [annahmenOffen, setAnnahmenOffen] = useState(false);
	const [feldOffen, setFeldOffen] = useState(false);
	const [fehlerZu, setFehlerZu] = useState<string | null>(null);
	const vorschlag = phase?.art === 'vorschlag' ? phase.vorschlag : null;
	const offen = Boolean(vorschlag && !vorschlag.konflikt);
	const { uebernehmen } = entwurf;
	useUebernehmenTaste(offen && !feldOffen, uebernehmen);
	const schliesseFeld = useCallback(() => setFeldOffen(false), []);
	// Hat niemand sonst die Tastatur, liegt sie auf „Übernehmen“: ⏎ genügt, auch nach dem Nachbessern.
	useEffect(() => {
		const aktiv = document.activeElement;
		const frei = !aktiv || aktiv === document.body || aktiv.tagName === 'IFRAME';
		if (offen && frei && !document.querySelector(TASTEN_SPERRE)) {
			document.querySelector<HTMLButtonElement>('[data-entwurf-uebernehmen]')?.focus();
		}
	}, [offen]);

	if (phase?.art === 'ende') {
		return <EndeZeile entwurf={entwurf} phase={phase} />;
	}
	if (!vorschlag) {
		return null;
	}
	const annahmen = annahmenAus(vorschlag.antwort);
	const fehler = phase?.art === 'vorschlag' && phase.fehler !== fehlerZu ? phase.fehler : null;
	return (
		<div
			className="sticky top-0 z-10 mx-3 mt-2 rounded-lg border border-rand bg-flaeche px-3 py-2 text-sm shadow-sm"
			data-entwurfsleiste={vorschlag.konflikt ? 'konflikt' : 'offen'}
		>
			<div className="flex flex-wrap items-center gap-2">
				<Symbol name="funken" className="size-4 flex-none text-brand-600" />
				<div className="min-w-0 flex-1">
					<p className="font-semibold">Entwurf von Claude</p>
					<p
						className={klassen(
							'truncate text-xs',
							vorschlag.fehler > 0 && !vorschlag.konflikt ? 'text-fehler' : 'text-leise',
						)}
					>
						{vorschlag.konflikt
							? 'Das Blatt wurde seit dem Auftrag geändert. Dieser Entwurf lässt sich nicht mehr übernehmen.'
							: zusammenfassung(vorschlag)}
					</p>
				</div>
				{vorschlag.antwort.trim() && (
					<Knopf
						art="leise"
						aria-expanded={annahmenOffen}
						data-entwurf-annahmen-knopf
						onClick={() => setAnnahmenOffen((o) => !o)}
					>
						<Symbol name="info" />
						{annahmen.length > 0 ? `Annahmen (${annahmen.length})` : 'Claudes Notiz'}
					</Knopf>
				)}
				<Knopf art="zweit" onClick={() => void entwurf.verwerfen()}>
					Verwerfen
				</Knopf>
				{offen && (
					<>
						<Knopf art="zweit" aria-expanded={feldOffen} onClick={() => setFeldOffen((o) => !o)}>
							<Symbol name="funken" />
							Nachbessern …
						</Knopf>
						<Knopf onClick={uebernehmen} data-entwurf-uebernehmen>
							Übernehmen
						</Knopf>
					</>
				)}
			</div>
			{annahmenOffen && (
				<ul className="mt-2 list-disc border-t border-rand pt-2 pl-5 text-xs" data-entwurf-annahmen>
					{(annahmen.length > 0 ? annahmen : [vorschlag.antwort.trim()]).map((a) => (
						<li key={a} className="whitespace-pre-line">
							{a}
						</li>
					))}
				</ul>
			)}
			{fehler && (
				<p role="alert" className="mt-2 flex items-center gap-2 border-t border-rand pt-2" data-entwurf-fehler>
					<span className="min-w-0 flex-1">{fehler}</span>
					<Knopf
						art="leise"
						groesse="klein"
						aria-label="Meldung schließen"
						onClick={() => setFehlerZu(fehler)}
					>
						<Symbol name="schliessen" />
					</Knopf>
				</p>
			)}
			{feldOffen && <NachbessernFeld sende={entwurf.nachbessern} schliessen={schliesseFeld} />}
		</div>
	);
};

/** Warum Bausteine und Inspektor gerade nichts ändern. */
export const SperrHinweis = ({ grund, sichtbar }: { grund: string | null; sichtbar: boolean }) =>
	grund && sichtbar ? (
		<p className="m-3 text-sm text-leise" data-sperre-grund>
			{grund}
		</p>
	) : null;
