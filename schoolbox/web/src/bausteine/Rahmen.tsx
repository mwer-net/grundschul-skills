import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { TASTEN_SPERRE } from '../editor/tasten';
import { MappeDialog } from '../seiten/Anlegen';
import { Seitenpalette } from '../seiten/Seitenpalette';
import { useHinweis } from './hinweis';
import { Kuerzel } from './Kuerzel';
import { useKopfHoehe } from './kopf';
import type { SucheKontext } from './suche';
import { Symbol } from './Symbol';

const KOPF_KNOPF =
	'flex h-knopf flex-none items-center gap-2 rounded-xl px-3 font-medium text-tinte no-underline hover:bg-flaeche-2';

/** Kopfzeile aller Seiten nach der Anmeldung: Name, Suche, Hilfe, Papierkorb, Abmelden. */
export const Rahmen = () => {
	const [suche, setSuche] = useState('');
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const zeige = useHinweis();
	const kopf = useKopfHoehe<HTMLElement>();
	const [palette, setPalette] = useState(false);
	const [neueMappe, setNeueMappe] = useState(false);

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

	const sucheNach = (wert: string) => {
		setSuche(wert);
		if (pathname !== '/') {
			void navigate('/');
		}
	};

	const abmelden = async () => {
		try {
			await sende('/api/abmelden');
			window.location.assign('/anmelden');
		} catch (fehler) {
			zeige({ text: meldung(fehler), art: 'fehler' });
		}
	};

	const kontext: SucheKontext = { suche, setSuche };
	return (
		<div className="flex min-h-dvh flex-col">
			{palette && (
				<Seitenpalette
					schliessen={() => setPalette(false)}
					neueMappe={() => setNeueMappe(true)}
					abmelden={() => void abmelden()}
				/>
			)}
			{neueMappe && <MappeDialog schliessen={() => setNeueMappe(false)} />}
			<header ref={kopf} className="sticky top-0 z-30 border-b border-rand bg-flaeche/95 backdrop-blur">
				<div className="mx-auto flex max-w-[90rem] items-center gap-4 px-8 py-3 max-lg:px-4 max-md:gap-2">
					<Link
						to="/"
						className="flex h-knopf flex-none items-center rounded-xl text-3xl text-tinte no-underline max-md:text-2xl"
						onClick={() => setSuche('')}
					>
						Schoolbox
					</Link>
					<label className="relative mx-auto block w-full max-w-xl">
						<span className="sr-only">Material suchen</span>
						<Symbol
							name="suche"
							className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-leise"
						/>
						<input
							type="search"
							name="suche"
							className="h-knopf w-full rounded-lg border border-rand bg-papier pr-14 pl-12 placeholder:text-leise focus:border-brand-500 focus:bg-flaeche focus:outline-none"
							placeholder="Suchen, z. B. Kartoffel oder Mathe"
							enterKeyHint="search"
							autoComplete="off"
							autoCorrect="off"
							spellCheck={false}
							value={suche}
							onChange={(e) => sucheNach(e.target.value)}
						/>
						<button
							type="button"
							className="absolute top-1/2 right-1 flex h-knopf-klein -translate-y-1/2 items-center rounded-md px-2 hover:bg-flaeche-2"
							aria-label="Befehle"
							data-palette-knopf
							onClick={(e) => {
								e.preventDefault();
								setPalette(true);
							}}
						>
							<Kuerzel text="⌘K" />
						</button>
					</label>
					<Link to="/hilfe" className={KOPF_KNOPF} aria-label="Hilfe">
						<Symbol name="hilfe" />
						<span className="max-lg:hidden">Hilfe</span>
					</Link>
					<Link to="/papierkorb" className={KOPF_KNOPF} aria-label="Papierkorb">
						<Symbol name="papierkorb" />
						<span className="max-lg:hidden">Papierkorb</span>
					</Link>
					<button type="button" className={KOPF_KNOPF} aria-label="Abmelden" onClick={() => void abmelden()}>
						<Symbol name="abmelden" />
						<span className="max-lg:hidden">Abmelden</span>
					</button>
				</div>
			</header>
			<main className="mx-auto w-full max-w-[90rem] flex-1 px-8 pt-8 pb-24 max-lg:px-4 max-md:pt-5">
				<Outlet context={kontext} />
			</main>
		</div>
	);
};
