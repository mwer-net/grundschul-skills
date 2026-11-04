import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import type { Hinweis } from './hinweis';
import { HinweisKontext } from './hinweis';
import { klassen } from './klassen';
import { Knopf } from './Knopf';
import { SymbolKnopf } from './SymbolKnopf';

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
				className="pointer-events-none fixed inset-x-0 bottom-8 z-meldung flex justify-center px-3"
				role="status"
				aria-live="polite"
			>
				{hinweis && (
					<div
						key={hinweis.nr}
						className={klassen(
							'pointer-events-auto flex max-w-xl items-center gap-1 rounded-xl border border-rand bg-flaeche py-1 pr-1 pl-3 text-sm shadow-2',
							hinweis.art === 'fehler' ? 'text-fehler' : 'text-tinte',
						)}
					>
						<span className="py-1">{hinweis.text}</span>
						{aktion && (
							<Knopf
								art="leise"
								groesse="klein"
								className="flex-none font-semibold"
								onClick={() => {
									setHinweis(null);
									aktion.ausfuehren();
								}}
							>
								{aktion.titel}
							</Knopf>
						)}
						<SymbolKnopf
							symbol="schliessen"
							beschriftung="Meldung schließen"
							groesse="klein"
							onClick={() => setHinweis(null)}
						/>
					</div>
				)}
			</div>
		</HinweisKontext>
	);
};
