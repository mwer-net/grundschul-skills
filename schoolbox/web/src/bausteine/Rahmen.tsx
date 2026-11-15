import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useMatch, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useKiZustand } from '../editor/ki';
import { TASTEN_SPERRE } from '../editor/tasten';
import { usePlanDaMeldung } from '../ordner/claude-baut';
import { EinheitPille } from '../ordner/EinheitBand';
import { useEinheiten, useEinheitFertigMeldung } from '../ordner/einheiten';
import { AblageAnbieter } from '../ordner/useOrdner';
import { MaterialDialog } from '../seiten/Anlegen';
import type { GemerkterAssistent } from '../seiten/assistent-gemerkt';
import { ASSISTENT_FORTSETZEN, gemerkterAssistent } from '../seiten/assistent-gemerkt';
import { Seitenpalette } from '../seiten/Seitenpalette';
import { useHinweis } from './hinweis';
import { klassen } from './klassen';
import { KnopfLink } from './Knopf';
import { ERSTES_WAEHLEN, useKopfHoehe } from './kopf';
import { Symbol } from './Symbol';
import { SymbolKnopf } from './SymbolKnopf';

/** Mit einem dieser Filter bleibt die Trefferliste stehen, auch wenn das Suchfeld leer wird (189-06). */
const FILTER = ['in', 'fach', 'klasse', 'art'];

/** Seiten der Ablage: Nur dort führt ↓ aus dem Suchfeld in die Treffer (189-07). */
const IN_DER_ABLAGE = /^\/($|o\/|suche$|zuletzt$|papierkorb$)/;

/**
 * Suchfeld im Kopf wie im Finder. Das Feld hält seinen Text selbst; die Adresse folgt ihm (187-01: sonst kamen beim
 * schnellen Tippen Buchstaben abhanden). Ein Suchgang ist ein Eintrag im Verlauf (189-04); leer oder Esc führt an den
 * Ort zurück, an dem er begann (189-05, 189-06).
 */
const useKopfsuche = (ordnerId: string | undefined) => {
	const [parameter] = useSearchParams();
	const { pathname, search } = useLocation();
	const navigationsArt = useNavigationType();
	const navigate = useNavigate();
	const adressText = pathname === '/suche' ? (parameter.get('q') ?? '') : '';
	const [text, setText] = useState(adressText);
	const feld = useRef<HTMLInputElement>(null);
	/** Adresse, an der der laufende Suchgang begann; `null`, solange keiner läuft. */
	const ausgang = useRef<string | null>(null);

	// Aus der Adresse nur, wenn sie sich ohne Tippen geändert hat: Zurück im Browser, Klick auf einen Ordner.
	useEffect(() => {
		if (navigationsArt === 'POP' || document.activeElement !== feld.current) {
			setText(adressText);
		}
		if (pathname !== '/suche') {
			ausgang.current = null;
		}
	}, [adressText, navigationsArt, pathname]);

	const verlasse = () => {
		const start = ausgang.current;
		ausgang.current = null;
		if (start !== null) {
			// Der Suchgang ist genau ein Eintrag über dem Ausgangsort.
			void navigate(-1);
		} else if (pathname === '/suche') {
			const von = parameter.get('von');
			void navigate(von ? `/o/${von}` : '/', { replace: true });
		}
	};

	const sucheNach = (wert: string) => {
		setText(wert);
		const filter = pathname === '/suche' && FILTER.some((f) => parameter.has(f));
		if (wert === '' && !filter) {
			verlasse();
			return;
		}
		const neu = new URLSearchParams(pathname === '/suche' ? parameter : undefined);
		if (ordnerId) {
			neu.set('von', ordnerId);
		}
		if (wert) {
			neu.set('q', wert);
		} else {
			neu.delete('q');
		}
		const ersteTaste = ausgang.current === null && pathname !== '/suche';
		if (ersteTaste) {
			ausgang.current = pathname + search;
		}
		void navigate(`/suche?${neu.toString()}`, { replace: !ersteTaste });
	};

	const taste = (e: ReactKeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			if (text !== '') {
				setText('');
				verlasse();
			}
			e.currentTarget.blur();
		} else if (
			e.key === 'ArrowDown' &&
			!e.altKey &&
			!e.metaKey &&
			IN_DER_ABLAGE.test(pathname) &&
			// Ohne Treffer bleiben Fokus und Marke im Feld (189-N01).
			document.querySelector('[data-ablage-inhalt] [data-objekt]')
		) {
			e.preventDefault();
			e.currentTarget.blur();
			window.dispatchEvent(new Event(ERSTES_WAEHLEN));
		}
	};

	return { feld, text, sucheNach, taste };
};

const RahmenInnen = () => {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const zeige = useHinweis();
	const kopf = useKopfHoehe<HTMLElement>();
	const [palette, setPalette] = useState(false);
	// 136: Freitext aus der Palette öffnet den Assistenten mit dem Text als Thema.
	const [thema, setThema] = useState<string | null>(null);
	// 190-02: „Weiter ausfüllen“ aus der Hinweisleiste öffnet den geschlossenen Assistenten wieder.
	const [fortsetzen, setFortsetzen] = useState<GemerkterAssistent | null>(null);
	useEffect(() => {
		const oeffne = () => setFortsetzen(gemerkterAssistent());
		window.addEventListener(ASSISTENT_FORTSETZEN, oeffne);
		return () => window.removeEventListener(ASSISTENT_FORTSETZEN, oeffne);
	}, []);
	const ki = useKiZustand();
	const { einheiten } = useEinheiten();
	useEinheitFertigMeldung(einheiten);
	usePlanDaMeldung();
	// Die Dokumentansicht hat ihren eigenen einzeiligen Kopf: Das Blatt soll oben im Fenster beginnen.
	const ohneKopf = useMatch('/m/:mappe/:dok') !== null;
	const inOrdner = useMatch('/o/:ordner');
	const ordnerId = inOrdner?.params.ordner;
	const suche = useKopfsuche(ordnerId);
	const inHilfe = pathname === '/hilfe';

	// ⌘K öffnet die Palette. Einen Knopf dafür hat nur der Editor; hier stünde er als zweite Suche neben dem Suchfeld
	// (189-31). Die Taste steht in der Tastenübersicht.
	useEffect(() => {
		const taste = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK' && !document.querySelector(TASTEN_SPERRE)) {
				e.preventDefault();
				setPalette(true);
			}
		};
		window.addEventListener('keydown', taste);
		return () => window.removeEventListener('keydown', taste);
	}, []);

	const abmelden = async () => {
		try {
			await sende('/api/abmelden');
			window.location.assign('/anmelden');
		} catch (fehler) {
			zeige({ text: meldung(fehler), art: 'fehler' });
		}
	};

	return (
		<div className="flex min-h-dvh flex-col">
			{palette && (
				<Seitenpalette
					schliessen={() => setPalette(false)}
					neuerOrdner={() => {
						const inOrdnerSeite = pathname === '/' || pathname.startsWith('/o/');
						void navigate(inOrdnerSeite ? pathname : '/', { state: { neuerOrdner: true } });
					}}
					abmelden={() => void abmelden()}
					anlegen={ki.zustand.verfuegbar ? setThema : undefined}
					materialAnlegen={() => setThema('')}
				/>
			)}
			{thema !== null && (
				<MaterialDialog ordner={ordnerId ?? null} thema={thema} schliessen={() => setThema(null)} />
			)}
			{fortsetzen !== null && (
				<MaterialDialog
					ordner={fortsetzen.ordner}
					fortsetzen={fortsetzen}
					schliessen={() => setFortsetzen(null)}
				/>
			)}
			<header
				ref={kopf}
				className={klassen('sticky top-0 z-kopf border-b border-rand bg-flaeche', ohneKopf && 'hidden')}
			>
				<div className="flex min-h-[39px] items-center gap-3 px-4">
					<Link
						to="/"
						className="flex h-knopf flex-none items-center text-base font-semibold text-tinte no-underline"
					>
						Schoolbox
					</Link>
					<div className="relative w-[300px] min-w-0 max-md:flex-1">
						<label>
							<span className="sr-only">Material suchen</span>
							<Symbol
								name="suche"
								className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-leise"
							/>
							<input
								ref={suche.feld}
								type="search"
								name="suche"
								className="h-knopf w-full rounded-md border border-transparent bg-flaeche-2 pr-2 pl-7 text-sm placeholder:text-leise focus:border-brand-500 focus:bg-flaeche focus:outline-none"
								placeholder="Material und Ordner suchen"
								enterKeyHint="search"
								autoComplete="off"
								autoCorrect="off"
								spellCheck={false}
								data-suchfeld
								value={suche.text}
								onChange={(e) => suche.sucheNach(e.target.value)}
								onKeyDown={suche.taste}
							/>
						</label>
					</div>
					<div className="ml-auto flex flex-none items-center gap-1" data-kopf-rechts>
						<EinheitPille einheiten={einheiten} />
						<KnopfLink
							to="/hilfe"
							art="leise"
							aria-label="Hilfe"
							aria-current={inHilfe ? 'page' : undefined}
							className={klassen(inHilfe && 'bg-flaeche-2')}
						>
							<Symbol name="hilfe" className="md:hidden" />
							<span className="max-md:hidden">Hilfe</span>
						</KnopfLink>
						<SymbolKnopf
							symbol="abmelden"
							beschriftung="Abmelden"
							data-abmelden
							onClick={() => void abmelden()}
						/>
					</div>
				</div>
			</header>
			<main className={klassen('w-full flex-1 px-4 pb-16', ohneKopf ? 'pt-0' : 'pt-3')}>
				<Outlet />
			</main>
		</div>
	);
};

export const Rahmen = () => (
	<AblageAnbieter>
		<RahmenInnen />
	</AblageAnbieter>
);
