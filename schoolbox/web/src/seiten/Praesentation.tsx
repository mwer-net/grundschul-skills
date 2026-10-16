import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { klassen } from '../bausteine/klassen';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { useLaden } from '../lib/laden';
import { anzahl } from '../lib/text';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import { dokumentSeite, inhaltAdresse, praesentationAnsicht } from '../lib/zugang';
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
import type { MappenEintrag } from '../typen';

/** So lange bleibt die Steuerleiste nach der letzten Bewegung stehen. */
const LEISTE_MS = 2000;
const NUMMER_SPEICHER = 'schoolbox-foliennummer';

type Phase = { art: 'laedt'; fertig: number; gesamt: number } | { art: 'bereit' } | { art: 'ohne-folien' };

const Ladestand = ({ phase }: { phase: Phase }) => {
	if (phase.art === 'ohne-folien') {
		return <p className="font-bold text-fehler">Dieses Dokument hat keine Folien zum Präsentieren.</p>;
	}
	if (phase.art === 'bereit') {
		return (
			<p className="flex items-start gap-2 font-bold text-[#2e7d32]">
				<Symbol name="haken" className="mt-0.5 size-6 flex-none" />
				Alles geladen. Die Präsentation läuft weiter, auch wenn das WLAN kurz weg ist.
			</p>
		);
	}
	const prozent = phase.gesamt > 0 ? Math.round((phase.fertig / phase.gesamt) * 100) : 0;
	return (
		<p className="flex items-center gap-2 text-leise">
			<Symbol name="laden" className="size-6 flex-none animate-spin text-brand-500" />
			{`Bilder und Schriften werden geladen … ${prozent} %`}
		</p>
	);
};

const Zeile = ({ children, was }: { was: string; children: ReactNode }) => (
	<div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 max-md:grid-cols-1 max-md:gap-0">
		<dt className="font-bold">{was}</dt>
		<dd>{children}</dd>
	</div>
);

interface StartEigenschaften {
	titel: string;
	folien: number | null;
	phase: Phase;
	zurueck: string;
	starten: () => void;
}

const Startseite = ({ folien, phase, starten, titel, zurueck }: StartEigenschaften) => (
	<div className="absolute inset-0 overflow-auto bg-papier">
		<main className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-8 py-10 max-md:px-4">
			<KnopfLink to={zurueck} art="leise" className="-ml-5 self-start">
				<Symbol name="zurueck" />
				Zurück zum Dokument
			</KnopfLink>
			<h1 className="mt-2 text-3xl max-md:text-2xl">{titel}</h1>
			{folien !== null && (
				<p className="mt-1 text-leise">{`Präsentation · ${anzahl(folien, 'Folie', 'Folien')}`}</p>
			)}
			<Knopf
				className="mt-8 min-h-20 self-start px-10 text-2xl"
				disabled={phase.art !== 'bereit'}
				onClick={starten}
			>
				<Symbol name="praesentieren" className="size-8 flex-none" />
				Präsentation starten
			</Knopf>
			<div className="mt-4 min-h-7" role="status">
				<Ladestand phase={phase} />
			</div>
			<section className="mt-8 rounded-2xl border border-rand bg-white px-5 py-4">
				<h2 className="text-xl">So steuerst du</h2>
				<dl className="mt-2">
					<Zeile was="Weiter">
						Pfeiltaste → oder Leertaste, Klicker · rechts antippen oder nach links wischen
					</Zeile>
					<Zeile was="Zurück">Pfeiltaste ← · links antippen oder nach rechts wischen</Zeile>
					<Zeile was="Aufdecken">„?“ und Timer antippen; Weiter deckt der Reihe nach auf</Zeile>
					<Zeile was="Schwarz">Taste B, noch einmal B macht die Folie wieder sichtbar</Zeile>
					<Zeile was="Beenden">
						Esc oder unten „Beenden“ (die Leiste erscheint, sobald du Maus oder Finger bewegst)
					</Zeile>
				</dl>
			</section>
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

interface LeistenKnopfEigenschaften {
	symbol: SymbolName;
	titel: string;
	/** Nur das Symbol zeigen; der Titel steht dann im `aria-label`. */
	knapp?: boolean;
	gedrueckt?: boolean;
	onClick: () => void;
}

const LeistenKnopf = ({ gedrueckt, knapp, onClick, symbol, titel }: LeistenKnopfEigenschaften) => (
	<button
		type="button"
		onClick={onClick}
		aria-label={knapp ? titel : undefined}
		aria-pressed={gedrueckt}
		className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-3 font-bold hover:bg-white/15 active:bg-white/25 aria-pressed:bg-white/25"
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
	const { daten } = useLaden<MappenEintrag>(inhaltAdresse(zugang));
	const dokument = daten?.dokumente.find((d) => d.id === dok);
	const titel = dokument?.meta.titel ?? null;
	useTitel(titel ? `Präsentation: ${titel}` : 'Präsentation');
	const navigate = useNavigate();
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
	useWachHalten(laeuft);

	const beenden = useCallback(() => {
		beendeVollbild();
		void navigate(zurueck);
	}, [navigate, zurueck]);
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

	const fokus = () => iframe.current?.contentWindow?.focus();

	const geladen = () => {
		const fenster = iframe.current?.contentWindow;
		const laufzeit = laufzeitVon(iframe.current);
		if (!fenster || !laufzeit) {
			setPhase({ art: 'ohne-folien' });
			return;
		}
		fenster.addEventListener('praesentation:stand', (e) => setStand((e as CustomEvent<FolienStand | null>).detail));
		fenster.addEventListener('praesentation:ende', (e) => {
			e.preventDefault();
			beendenAktuell.current();
		});
		fenster.addEventListener('pointermove', regung);
		fenster.addEventListener('pointerdown', regung);
		setStand(laufzeit.stand());
		laufzeit
			.vorladen((fertig, gesamt) => setPhase({ art: 'laedt', fertig, gesamt }))
			.then(
				() => setPhase({ art: 'bereit' }),
				() => setPhase({ art: 'bereit' }),
			);
	};

	const starten = () => {
		if (buehne.current && vollbildMoeglich()) {
			starteVollbild(buehne.current);
		}
		setLaeuft(true);
		regung();
		fokus();
	};

	useEffect(() => {
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
		window.addEventListener('pointerdown', regung);
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
			window.removeEventListener('pointerdown', regung);
			window.removeEventListener('keydown', taste);
		};
	}, [laeuft, regung]);

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

	if (daten && !dokument) {
		return (
			<main className="flex min-h-dvh items-center justify-center">
				<Zustand symbol="suche" titel="Dieses Dokument gibt es nicht mehr">
					<p className="text-leise">Vielleicht wurde es gelöscht.</p>
				</Zustand>
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
							onClick={mit(() => laufzeit()?.zurueck())}
						/>
						<span className="min-w-16 px-1 text-center font-bold tabular-nums" data-folie>
							{stand ? `${stand.folie} / ${stand.folien}` : ''}
						</span>
						<LeistenKnopf symbol="weiter" titel="Weiter" knapp onClick={mit(() => laufzeit()?.weiter())} />
						<span className="mx-1 h-8 w-px bg-white/30" aria-hidden="true" />
						<LeistenKnopf
							symbol="bildschirm"
							titel="Schwarz"
							gedrueckt={stand?.schwarz ?? false}
							onClick={mit(() => laufzeit()?.schwarz())}
						/>
						<LeistenKnopf
							symbol="nummer"
							titel="Nummer"
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
			) : (
				<Startseite
					titel={titel ?? ''}
					folien={stand?.folien ?? null}
					phase={phase}
					zurueck={zurueck}
					starten={starten}
				/>
			)}
		</div>
	);
};
