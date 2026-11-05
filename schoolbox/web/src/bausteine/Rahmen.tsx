import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';

import { meldung, sende } from '../api';
import type { ChatKontext } from '../editor/chat-kontext';
import { useChat, useChatKontext, useChatStand } from '../editor/chat-kontext';
import { loescheAlleVerlaeufe } from '../editor/chat-verlauf';
import { TASTEN_SPERRE } from '../editor/tasten';
import { AblageAnbieter } from '../ordner/useOrdner';
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

export const Rahmen = () => {
	const [parameter] = useSearchParams();
	const { pathname } = useLocation();
	const suche = pathname === '/suche' ? (parameter.get('q') ?? '') : '';
	const navigate = useNavigate();
	const zeige = useHinweis();
	const kopf = useKopfHoehe<HTMLElement>();
	const [palette, setPalette] = useState(false);
	// Die Dokumentansicht hat ihren eigenen einzeiligen Kopf: Das Blatt soll oben im Fenster beginnen.
	const ohneKopf = useMatch('/m/:mappe/:dok') !== null;

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
			loescheAlleVerlaeufe(localStorage);
			window.location.assign('/anmelden');
		} catch (fehler) {
			zeige({ text: meldung(fehler), art: 'fehler' });
		}
	};

	const chat = useChat();
	const chatStand = useChatStand();
	const imDokument = useMatch('/m/:mappe/:dok/*');
	const inOrdner = useMatch('/o/:ordner');
	const dokMappe = imDokument?.params.mappe;
	const dokName = imDokument?.params.dok;
	const ordnerId = inOrdner?.params.ordner;
	useChatKontext(
		useMemo<ChatKontext>(
			() =>
				dokMappe && dokName
					? { art: 'ansicht', mappe: dokMappe, dok: dokName }
					: { art: 'neu', mappe: null, ordner: ordnerId ?? null },
			[dokMappe, dokName, ordnerId],
		),
	);
	return (
		<AblageAnbieter>
		<div className="flex min-h-dvh flex-col">
			{palette && (
				<Seitenpalette
					schliessen={() => setPalette(false)}
					neuerOrdner={() => window.dispatchEvent(new Event('schoolbox-neuer-ordner'))}
					abmelden={() => void abmelden()}
					anClaude={chatStand.ki.zustand.verfuegbar ? chat.fuelle : undefined}
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
						{chatStand.ki.zustand.verfuegbar && (
							<Knopf
								art="leise"
								aria-label="Claude"
								aria-pressed={chatStand.fenster !== 'zu'}
								className="aria-pressed:bg-flaeche-2"
								onClick={() => chat.wechsle()}
							>
								<Symbol name="sprechblase" />
								<span className="max-md:hidden">Claude</span>
							</Knopf>
						)}
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
			<main
				className={klassen('w-full flex-1 px-4', ohneKopf ? 'pt-0' : 'pt-3')}
				style={{ paddingBottom: 'max(4rem, var(--chat-platz, 0px))' }}
			>
				<Outlet />
			</main>
		</div>
		</AblageAnbieter>
	);
};
