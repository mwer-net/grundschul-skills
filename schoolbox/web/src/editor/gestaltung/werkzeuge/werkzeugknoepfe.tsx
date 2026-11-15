import { klassen } from '../../../bausteine/klassen';
import { SCHUBLADENKACHEL } from '../../../bausteine/Schublade';
import { raster } from '../../../bausteine/schubladenhilfe';
import { Symbol } from '../../../bausteine/Symbol';
import { SymbolKnopf } from '../../../bausteine/SymbolKnopf';
import { Tooltip } from '../../../bausteine/Tooltip';
import { kuerzelText } from '../../befehle';
import type { SchubladenLage } from '../../schubladen';
import { WERKZEUGE } from '.';
import { useWerkzeugStand, waehleWerkzeug } from './stand';
import { zeichenwerkzeuge } from './werkzeugknoepfe-daten';

/**
 * Abschnitt „Zeichnen“ der Schublade (198-10): Stift, Form aus Punkten und Konfetti als Kacheln mit Symbol und Wort wie
 * Stempel und Etikett. Der Tooltip nennt die Taste; das aktive Werkzeug ist hervorgehoben, ⇧-Klick hält es bis Esc
 * (Hilfe). Die Formen zum Aufziehen haben keine Kachel hier, ihre Taste steht im Tooltip der Form (198 Urteil 1).
 */
export const Zeichenkacheln = ({ lage, suche }: { lage: SchubladenLage; suche: string }) => {
	const stand = useWerkzeugStand();
	return (
		<div className={raster(3)} data-zeichnen>
			{zeichenwerkzeuge(lage, suche).map((w) => {
				const aktiv = stand.id === w.id;
				return (
					<Tooltip key={w.id} text={w.titel} {...(w.taste ? { kuerzel: kuerzelText(w.taste) } : {})}>
						<button
							type="button"
							aria-label={w.titel}
							aria-pressed={aktiv}
							className={klassen(
								SCHUBLADENKACHEL,
								'flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 select-none',
								aktiv && 'bg-brand-50 text-brand-700',
							)}
							data-werkzeug={w.id}
							data-gehalten={aktiv && stand.halten ? '' : undefined}
							onClick={(ev) => waehleWerkzeug(w.id, ev.shiftKey)}
						>
							<Symbol name={w.symbol} className="size-5" />
							{/* 198-N03: zweizeilig statt „Form aus P…“; die Reihe wächst mit. */}
							<span
								className={klassen(
									'w-full text-center text-xs leading-tight text-balance text-leise',
									aktiv && 'text-brand-700',
								)}
							>
								{w.titel}
							</span>
						</button>
					</Tooltip>
				);
			})}
		</div>
	);
};

/**
 * Nur im Test (`Testfach.tsx`): eine Reihe Knöpfe für alle bereiten Werkzeuge mit V, Tooltip mit Name und Taste, das
 * aktive hervorgehoben. In der Schublade stehen seit 198 nur die Kacheln „Zeichnen“.
 */
export const Werkzeugknoepfe = ({ className, lage }: { lage: SchubladenLage; className?: string }) => {
	const stand = useWerkzeugStand();
	const bereit = WERKZEUGE.filter((w) => w.bereit(lage));
	if (bereit.length <= 1) {
		return null;
	}
	return (
		<div role="toolbar" aria-label="Werkzeuge" className={klassen('flex flex-wrap gap-0.5', className)}>
			{bereit.map((w) => {
				const aktiv = stand.id === w.id;
				return (
					<SymbolKnopf
						key={w.id}
						symbol={w.symbol}
						beschriftung={w.titel}
						{...(w.taste ? { kuerzel: kuerzelText(w.taste) } : {})}
						aria-pressed={aktiv}
						className={klassen(aktiv && 'bg-brand-50 text-brand-700 hover:bg-brand-50')}
						data-werkzeug={w.id}
						data-gehalten={aktiv && stand.halten ? '' : undefined}
						onClick={(ev) => waehleWerkzeug(w.id, ev.shiftKey)}
					/>
				);
			})}
		</div>
	);
};
