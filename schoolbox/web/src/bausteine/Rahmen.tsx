import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useKiZustand } from '../editor/ki';
import { TASTEN_SPERRE } from '../editor/tasten';
import { EinheitPille } from '../ordner/EinheitBand';
import { useEinheiten, useEinheitFertigMeldung } from '../ordner/einheiten';
import { AblageAnbieter } from '../ordner/useOrdner';
import { MaterialDialog } from '../seiten/Anlegen';
import { Seitenpalette } from '../seiten/Seitenpalette';
import { useHinweis } from './hinweis';
import { klassen } from './klassen';
import { Knopf, KnopfLink } from './Knopf';
import { useKopfHoehe } from './kopf';
import { Kuerzel } from './Kuerzel';
import { Menue } from './Menue';
import { Symbol } from './Symbol';

/** Kopfzeile aller Seiten nach der Anmeldung: Name, Suche, Hilfe, Papierkorb, Abmelden. */
const KONTO_KNOPF = (
	<Knopf art="leise" className="size-knopf px-0">
		<Symbol name="mehr" />
	</Knopf>
);

const RahmenInnen = () => {
	const [parameter] = useSearchParams();
	const { pathname } = useLocation();
	const suche = pathname === '/suche' ? (parameter.get('q') ?? '') : '';
	const navigate = useNavigate();
	const zeige = useHinweis();
	const kopf = useKopfHoehe<HTMLElement>();
	const [palette, setPalette] = useState(false);
	// 136: Freitext aus der Palette öffnet den Assistenten mit dem Text als Thema.
	const [thema, setThema] = useState<string | null>(null);
	const ki = useKiZustand();
	const { einheiten } = useEinheiten();
	useEinheitFertigMeldung(einheiten);
	// Die Dokumentansicht hat ihren eigenen einzeiligen Kopf: Das Blatt soll oben im Fenster beginnen.
	const ohneKopf = useMatch('/m/:mappe/:dok') !== null;
	const inOrdner = useMatch('/o/:ordner');
	const ordnerId = inOrdner?.params.ordner;

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
		const neu = new URLSearchParams(pathname === '/suche' ? parameter : undefined);
		if (ordnerId) {
			neu.set('von', ordnerId);
		}
		if (wert) {
			neu.set('q', wert);
		} else {
			neu.delete('q');
		}
		void navigate(`/suche?${neu.toString()}`, { replace: pathname === '/suche' });
	};

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
				/>
			)}
			{thema !== null && (
				<MaterialDialog ordner={ordnerId ?? null} thema={thema} schliessen={() => setThema(null)} />
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
								type="search"
								name="suche"
								className="h-knopf w-full rounded-md bg-flaeche-2 pr-12 pl-7 text-sm placeholder:text-leise focus:bg-flaeche focus:outline-1 focus:outline-brand-500"
								placeholder="Material und Ordner suchen"
								enterKeyHint="search"
								autoComplete="off"
								autoCorrect="off"
								spellCheck={false}
								value={suche}
								onChange={(e) => sucheNach(e.target.value)}
							/>
						</label>
						<button
							type="button"
							className="absolute top-1/2 right-0.5 flex h-knopf-klein -translate-y-1/2 items-center rounded-sm px-1.5 hover:bg-rand"
							aria-label="Befehle"
							data-palette-knopf
							onClick={() => setPalette(true)}
						>
							<Kuerzel text="⌘K" />
						</button>
					</div>
					<div className="ml-auto flex flex-none items-center gap-1" data-kopf-rechts>
						<EinheitPille einheiten={einheiten} />
						<KnopfLink to="/hilfe" art="leise" aria-label="Hilfe">
							<Symbol name="hilfe" className="md:hidden" />
							<span className="max-md:hidden">Hilfe</span>
						</KnopfLink>
						<Menue
							name="Konto"
							rechtsbuendig
							ausloeser={KONTO_KNOPF}
							eintraege={[{ titel: 'Abmelden', symbol: 'abmelden', waehle: () => void abmelden() }]}
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
