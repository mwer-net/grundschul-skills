import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import type { Hinweis } from './hinweis';
import { HinweisKontext } from './hinweis';
import { klassen } from './klassen';
import { Symbol } from './Symbol';

const DAUER_MS = 6000;
const DAUER_MIT_AKTION_MS = 10_000;

export const HinweisAnbieter = ({ children }: { children: ReactNode }) => {
	const [hinweis, setHinweis] = useState<(Hinweis & { nr: number }) | null>(null);
	const zeige = useCallback((neu: Hinweis) => setHinweis({ ...neu, nr: Date.now() }), []);

	useEffect(() => {
		if (!hinweis) {
			return undefined;
		}
		const dauer = hinweis.aktion ? DAUER_MIT_AKTION_MS : DAUER_MS;
		const timer = setTimeout(() => setHinweis(null), dauer);
		return () => clearTimeout(timer);
	}, [hinweis]);

	const aktion = hinweis?.aktion;
	return (
		<HinweisKontext value={zeige}>
			{children}
			<div
				className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-6 max-md:p-3"
				role="status"
				aria-live="polite"
			>
				{hinweis && (
					<div
						key={hinweis.nr}
						className={klassen(
							'pointer-events-auto flex max-w-2xl items-center gap-2 rounded-2xl py-2 pr-2 pl-5 text-white shadow-karte',
							hinweis.art === 'fehler' ? 'bg-fehler' : 'bg-tinte',
						)}
					>
						<span className="py-2">{hinweis.text}</span>
						{aktion && (
							<button
								type="button"
								className="min-h-12 flex-none rounded-xl px-4 font-bold text-entwurf hover:bg-white/10"
								onClick={() => {
									setHinweis(null);
									aktion.ausfuehren();
								}}
							>
								{aktion.titel}
							</button>
						)}
						<button
							type="button"
							className="flex size-12 flex-none items-center justify-center rounded-full hover:bg-white/10"
							aria-label="Meldung schließen"
							onClick={() => setHinweis(null)}
						>
							<Symbol name="schliessen" />
						</button>
					</div>
				)}
			</div>
		</HinweisKontext>
	);
};
