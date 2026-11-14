import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { klassen } from '../bausteine/klassen';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { useInhalt } from '../lib/inhalt';
import { anzahl } from '../lib/text';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import { dokumentSeite, istGeteilt, praesentationAnsicht } from '../lib/zugang';
import type { FolienStand } from '../praesentation/laufzeit';
import {
	beendeVollbild,
	istVollbild,
	laufzeitVon,
	starteVollbild,
	useWachHalten,
	VOLLBILD_EREIGNISSE,
	vollbildMoeglich,
	wachHaltenMoeglich,
} from '../praesentation/laufzeit';
import { MaterialFehlt, NICHT_GEFUNDEN } from './NichtGefunden';

/** So lange bleibt die Steuerleiste nach der letzten Bewegung stehen. */
const LEISTE_MS = 2000;
const NUMMER_SPEICHER = 'schoolbox-foliennummer';
/** Folie je Material in diesem Tab: Neu laden beginnt dort, „Beenden“ vergisst sie (192-10). */
const folienSpeicher = (zugang: Zugang, dok: string) => `schoolbox-folie:${zugang.token ?? ''}:${zugang.mappe}/${dok}`;

/** Auf Folie 1 ist noch nichts aufgedeckt: Dann gibt es kein „Zurück“ (192-07). */
const amAnfang = (iframe: HTMLIFrameElement | null, stand: FolienStand | null) => {
	if (!stand || stand.folie !== 1) {
		return false;
	}
	const folie = iframe?.contentDocument?.querySelector('.seite.aktiv');
	return !folie?.querySelector('[data-schritt]:not(.schritt-zu), .aufdecken:not(.zu)');
};

type Phase = { art: 'laedt'; fertig: number; gesamt: number } | { art: 'bereit' } | { art: 'ohne-folien' };

const Ladestand = ({ phase }: { phase: Phase }) => {
	if (phase.art === 'ohne-folien') {
		return <p className="font-medium text-fehler">Dieses Material hat keine Folien.</p>;
	}
	if (phase.art === 'bereit') {
		return (
			<p className="flex items-start gap-2 font-medium text-gut">
				<Symbol name="haken" className="mt-0.5 size-4 flex-none" />
				Alles geladen. Die Präsentation läuft weiter, auch wenn das WLAN kurz weg ist.
			</p>
		);
	}
	const prozent = phase.gesamt > 0 ? Math.round((phase.fertig / phase.gesamt) * 100) : 0;
	return (
		<p className="flex items-center gap-2 text-leise">
			<Symbol name="laden" className="size-4 flex-none animate-spin text-brand-500" />
			{`Bilder und Schriften werden geladen … ${prozent} %`}
		</p>
	);
};

interface StartEigenschaften {
	titel: string;
	folien: number | null;
	phase: Phase;
	zurueck: string;
	zurueckGehen: (e: MouseEvent) => void;
	starten: () => void;
}

const Startseite = ({ folien, phase, starten, titel, zurueck, zurueckGehen }: StartEigenschaften) => {
	const startKnopf = useRef<HTMLButtonElement>(null);
	// Enter startet: Der Knopf hat den Fokus von Anfang an und behält ihn, wenn das Laden endet (192-03).
	useEffect(() => startKnopf.current?.focus(), []);
	const bereit = phase.art === 'bereit';
	return (
	<div className="absolute inset-0 overflow-auto bg-papier">
		<main className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-8 py-10 max-md:px-4">
			<KnopfLink to={zurueck} onClick={zurueckGehen} art="leise" className="-ml-2.5 self-start">
				<Symbol name="zurueck" />
				Zurück
			</KnopfLink>
			<h1 className="mt-2 text-2xl">{titel}</h1>
			{folien !== null && (
				<p className="mt-1 text-leise">{`Präsentation · ${anzahl(folien, 'Folie', 'Folien')}`}</p>
			)}
			<Knopf
				ref={startKnopf}
				className="mt-4 h-11 self-start px-5 text-base aria-disabled:cursor-default aria-disabled:opacity-40"
				aria-disabled={!bereit}
				onClick={() => bereit && starten()}
			>
				<Symbol name="praesentieren" className="size-4 flex-none" />
				Präsentation starten
			</Knopf>
			<div className="mt-4 min-h-7" role="status">
				<Ladestand phase={phase} />
			</div>
			{!vollbildMoeglich() && (
				<p className="mt-4 text-leise">
					Für Vollbild auf dem iPad: in Safari auf „Teilen“ und „Zum Home-Bildschirm“ tippen und die Schoolbox
					von dort öffnen.
				</p>
			)}
			{!wachHaltenMoeglich() && (
				<p className="mt-4 text-leise">
					Dieses Gerät kann den Bildschirm nicht von selbst anlassen. Stell in den Einstellungen die
					automatische Sperre bzw. den Ruhezustand für die Stunde ab.
				</p>
			)}
		</main>
	</div>
	);
};

interface LeistenKnopfEigenschaften {
	symbol: SymbolName;
	titel: string;
	/** Nur das Symbol zeigen; der Titel steht dann im `aria-label`. */
	knapp?: boolean;
	gedrueckt?: boolean;
	/** Am Anfang bzw. Ende geht es nicht weiter (192-07). */
	disabled?: boolean;
	onClick: () => void;
}

const LeistenKnopf = ({ disabled, gedrueckt, knapp, onClick, symbol, titel }: LeistenKnopfEigenschaften) => (
	<button
		type="button"
		onClick={onClick}
		disabled={disabled}
		aria-label={knapp ? titel : undefined}
		aria-pressed={gedrueckt}
		className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium enabled:hover:bg-white/15 enabled:active:bg-white/25 disabled:opacity-40 aria-pressed:bg-white/25"
	>
		<Symbol name={symbol} />
		{!knapp && titel}
	</button>
);

interface Eigenschaften {
	zugang: Zugang;
	dok: string;
}

/**
 * Hülle für den Präsentationsmodus: Startseite, Vollbild, Bildschirm wach halten, Steuerleiste. Die Folien zeigt und
 * steuert `praesentation.js` im Iframe; die Hülle lädt nie neu, auch wenn Claude das Material gerade ändert.
 */
export const Praesentation = ({ dok, zugang }: Eigenschaften) => {
	const { daten, fehler } = useInhalt(zugang);
	const dokument = daten?.dokumente.find((d) => d.id === dok);
	const titel = dokument?.meta.titel ?? null;
	useTitel(titel ? `Präsentation: ${titel}` : daten ? NICHT_GEFUNDEN : 'Präsentation');
	const navigate = useNavigate();
	const ort = useLocation();
	// Aus Ablage, Ansicht oder Editor: sofort starten, Vollbild hat der Klick schon verlangt (192 Urteil 2).
	const [sofort] = useState(() => (ort.state as { sofort?: boolean } | null)?.sofort === true);
	// Kam man aus der Anwendung, führt „Beenden“ einen Schritt zurück; sonst zur Ansicht (192-02).
	const ausAnwendung = ort.key !== 'default';
	const buehne = useRef<HTMLDivElement>(null);
	const iframe = useRef<HTMLIFrameElement>(null);
	const [phase, setPhase] = useState<Phase>({ art: 'laedt', fertig: 0, gesamt: 0 });
	const [laeuft, setLaeuft] = useState(false);
	const [stand, setStand] = useState<FolienStand | null>(null);
	const [vollbild, setVollbild] = useState(false);
	const [leiste, setLeiste] = useState(true);
	const [nummer, setNummer] = useState(() => localStorage.getItem(NUMMER_SPEICHER) !== 'aus');
	const ueberLeiste = useRef(false);
	const verstecken = useRef<number | undefined>(undefined);
	const zurueck = dokumentSeite(zugang, dok);
	const speicher = folienSpeicher(zugang, dok);
	useWachHalten(laeuft);

	const zurueckGehen = useCallback(() => {
		beendeVollbild();
		if (ausAnwendung) {
			void navigate(-1);
		} else {
			void navigate(zurueck, { replace: true });
		}
	}, [ausAnwendung, navigate, zurueck]);

	const beenden = useCallback(() => {
		sessionStorage.removeItem(speicher);
		zurueckGehen();
	}, [speicher, zurueckGehen]);
	const beendenAktuell = useRef(beenden);
	useEffect(() => {
		beendenAktuell.current = beenden;
	}, [beenden]);

	const regung = useCallback(() => {
		setLeiste(true);
		window.clearTimeout(verstecken.current);
		verstecken.current = window.setTimeout(() => {
			if (!ueberLeiste.current) {
				setLeiste(false);
			}
		}, LEISTE_MS);
	}, []);

	// Ein Mausklick blättert und lässt die Leiste weg; nur Finger und Stift zeigen sie (192-06).
	const tippen = useCallback(
		(e: PointerEvent) => {
			if (e.pointerType !== 'mouse') {
				regung();
			}
		},
		[regung],
	);

	const fokus = () => iframe.current?.contentWindow?.focus();

	const geladen = () => {
		const fenster = iframe.current?.contentWindow;
		const laufzeit = laufzeitVon(iframe.current);
		if (!fenster || !laufzeit) {
			setPhase({ art: 'ohne-folien' });
			return;
		}
		fenster.addEventListener('praesentation:stand', (e) => {
			const neu = (e as CustomEvent<FolienStand | null>).detail;
			setStand(neu);
			if (neu) {
				sessionStorage.setItem(speicher, String(neu.folie));
			}
		});
		fenster.addEventListener('praesentation:ende', (e) => {
			e.preventDefault();
			beendenAktuell.current();
		});
		fenster.addEventListener('pointermove', regung);
		fenster.addEventListener('pointerdown', tippen);
		setStand(laufzeit.stand());
		laufzeit
			.vorladen((fertig, gesamt) => setPhase({ art: 'laedt', fertig, gesamt }))
			.then(
				() => setPhase({ art: 'bereit' }),
				() => setPhase({ art: 'bereit' }),
			);
	};

	const starten = () => {
		if (buehne.current && vollbildMoeglich() && !istVollbild()) {
			starteVollbild(buehne.current);
		}
		const gemerkt = Number(sessionStorage.getItem(speicher));
		if (gemerkt > 1) {
			laufzeitVon(iframe.current)?.gehe(gemerkt);
		}
		setLaeuft(true);
		regung();
		fokus();
	};

	const startenAktuell = useRef(starten);
	useEffect(() => {
		startenAktuell.current = starten;
	});
	useEffect(() => {
		if (!sofort || phase.art !== 'bereit' || laeuft) {
			return;
		}
		startenAktuell.current();
		// Nach einem Neuladen steht wieder die Startseite: Vollbild verlangt einen Klick.
		void navigate(`${ort.pathname}${ort.search}`, { replace: true, state: null });
		// eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim ersten „bereit“
	}, [sofort, phase.art]);

	useEffect(() => {
		setVollbild(istVollbild());
		const pruefe = () => setVollbild(istVollbild());
		VOLLBILD_EREIGNISSE.forEach((name) => document.addEventListener(name, pruefe));
		return () => {
			VOLLBILD_EREIGNISSE.forEach((name) => document.removeEventListener(name, pruefe));
			beendeVollbild();
			window.clearTimeout(verstecken.current);
		};
	}, []);

	useEffect(() => {
		if (!laeuft) {
			return undefined;
		}
		window.addEventListener('pointermove', regung);
		window.addEventListener('pointerdown', tippen);
		// Hat ein Knopf der Leiste den Fokus, gehen die Tasten an die Hülle; sie reicht sie an die Folien weiter.
		const taste = (e: KeyboardEvent) => {
			const knopf = e.target instanceof Element && e.target.closest('button, a');
			if (knopf && (e.key === 'Enter' || e.key === ' ')) {
				return;
			}
			if (laufzeitVon(iframe.current)?.taste(e)) {
				e.preventDefault();
			}
		};
		window.addEventListener('keydown', taste);
		return () => {
			window.removeEventListener('pointermove', regung);
			window.removeEventListener('pointerdown', tippen);
			window.removeEventListener('keydown', taste);
		};
	}, [laeuft, regung, tippen]);

	useEffect(() => {
		localStorage.setItem(NUMMER_SPEICHER, nummer ? 'an' : 'aus');
		if (phase.art === 'bereit') {
			laufzeitVon(iframe.current)?.nummer(nummer);
		}
	}, [nummer, phase.art]);

	const mausWeg = laeuft && !leiste;
	useEffect(() => {
		const wurzel = iframe.current?.contentDocument?.documentElement;
		if (wurzel) {
			wurzel.style.cursor = mausWeg ? 'none' : '';
		}
	}, [mausWeg]);

	const mit = (aktion: () => void) => () => {
		aktion();
		fokus();
	};
	const laufzeit = () => laufzeitVon(iframe.current);

	if ((daten && !dokument) || (!daten && fehler)) {
		beendeVollbild();
		return (
			// Oben wie an jeder Stelle, an der Material fehlt (187-N01); ebenso bei unbekannter Mappe (192-04).
			<main>
				<MaterialFehlt fehler={fehler} geteilt={istGeteilt(zugang)} />
			</main>
		);
	}

	return (
		<div ref={buehne} className={klassen('fixed inset-0 bg-black', mausWeg && 'cursor-none')}>
			<iframe
				ref={iframe}
				src={praesentationAnsicht(zugang, dok)}
				title={titel ?? 'Präsentation'}
				onLoad={geladen}
				// Vor dem Start sind die Folien verdeckt: Tab führt nicht hinein (192-03).
				inert={!laeuft}
				tabIndex={laeuft ? undefined : -1}
				className="absolute inset-0 size-full border-0"
			/>
			{laeuft ? (
				<div
					className={klassen(
						'absolute inset-x-0 bottom-0 flex justify-center p-4 transition-opacity duration-300',
						leiste ? 'opacity-100' : 'pointer-events-none opacity-0',
					)}
				>
					<div
						role="toolbar"
						aria-label="Präsentation steuern"
						className="flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-black/75 p-1.5 text-white shadow-lg backdrop-blur"
						onPointerEnter={(e) => {
							ueberLeiste.current = e.pointerType === 'mouse';
						}}
						onPointerLeave={() => {
							ueberLeiste.current = false;
							regung();
						}}
					>
						<LeistenKnopf
							symbol="zurueck"
							titel="Zurück"
							knapp
							disabled={amAnfang(iframe.current, stand)}
							onClick={mit(() => laufzeit()?.zurueck())}
						/>
						<span className="min-w-16 px-1 text-center font-medium tabular-nums" data-folie>
							{stand ? `${stand.folie} / ${stand.folien}` : ''}
						</span>
						<LeistenKnopf
							symbol="weiter"
							titel="Weiter"
							knapp
							disabled={stand?.ende ?? false}
							onClick={mit(() => laufzeit()?.weiter())}
						/>
						<span className="mx-1 h-8 w-px bg-flaeche/30" aria-hidden="true" />
						<LeistenKnopf
							symbol="bildschirm"
							titel="Schwarz"
							gedrueckt={stand?.schwarz ?? false}
							onClick={mit(() => laufzeit()?.schwarz())}
						/>
						<LeistenKnopf
							symbol="nummer"
							titel="Foliennummer"
							gedrueckt={nummer}
							onClick={mit(() => setNummer((an) => !an))}
						/>
						{vollbildMoeglich() && !vollbild && (
							<LeistenKnopf
								symbol="vollbild"
								titel="Vollbild"
								onClick={mit(() => buehne.current && starteVollbild(buehne.current))}
							/>
						)}
						<LeistenKnopf symbol="schliessen" titel="Beenden" onClick={beenden} />
					</div>
				</div>
			) : sofort ? (
				// Gleich geht es los: schwarz, nur der Ladestand.
				<div className="absolute inset-0 flex items-center justify-center bg-black" role="status">
					{phase.art === 'laedt' && <Symbol name="laden" className="size-6 animate-spin text-white/60" />}
					{phase.art === 'ohne-folien' && <Ladestand phase={phase} />}
				</div>
			) : (
				<Startseite
					titel={titel ?? ''}
					folien={stand?.folien ?? null}
					phase={phase}
					zurueck={zurueck}
					zurueckGehen={(e) => {
						e.preventDefault();
						zurueckGehen();
					}}
					starten={starten}
				/>
			)}
		</div>
	);
};
