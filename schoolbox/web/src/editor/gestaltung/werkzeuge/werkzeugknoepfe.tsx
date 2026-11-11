import { klassen } from '../../../bausteine/klassen';
import { SymbolKnopf } from '../../../bausteine/SymbolKnopf';
import { kuerzelText } from '../../befehle';
import type { SchubladenLage } from '../../schubladen';
import { WERKZEUGE } from '.';
import { useWerkzeugStand, waehleWerkzeug } from './stand';

/**
 * Eine Reihe Knöpfe für alle bereiten Werkzeuge (5.10, 5.12): Tooltip mit Name und Taste, das aktive hervorgehoben;
 * ⇧-Klick hält das Werkzeug bis Esc (Hilfe). 104 setzt sie oben in die Schublade „Werkzeuge“.
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
