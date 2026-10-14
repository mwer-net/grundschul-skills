import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useHinweis } from './hinweis';
import { useKopfHoehe } from './kopf';
import type { SucheKontext } from './suche';
import { Symbol } from './Symbol';

const KOPF_KNOPF =
	'flex min-h-12 flex-none items-center gap-2 rounded-xl px-3 font-bold text-brand-600 no-underline hover:bg-brand-50';

/** Kopfzeile aller Seiten nach der Anmeldung: Name, Suche, Papierkorb, Abmelden. */
export const Rahmen = () => {
	const [suche, setSuche] = useState('');
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const zeige = useHinweis();
	const kopf = useKopfHoehe<HTMLElement>();

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
			<header ref={kopf} className="sticky top-0 z-30 border-b border-rand bg-white/95 backdrop-blur">
				<div className="mx-auto flex max-w-[90rem] items-center gap-4 px-8 py-3 max-lg:px-4 max-md:gap-2">
					<Link
						to="/"
						className="flex min-h-12 flex-none items-center rounded-xl font-display text-3xl text-brand-600 no-underline max-md:text-2xl"
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
							className="min-h-12 w-full rounded-full border-2 border-rand bg-papier pr-4 pl-12 placeholder:text-leise focus:border-brand-500 focus:bg-white focus:outline-none"
							placeholder="Suchen, z. B. Kartoffel oder Mathe"
							enterKeyHint="search"
							autoComplete="off"
							autoCorrect="off"
							spellCheck={false}
							value={suche}
							onChange={(e) => sucheNach(e.target.value)}
						/>
					</label>
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
