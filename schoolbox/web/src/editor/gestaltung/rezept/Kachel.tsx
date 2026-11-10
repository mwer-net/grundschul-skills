import type { Aufmachung, AufmachungsFormat } from '@schoolbox/kern/src/aufmachungen';
import { SEITEN_MASSE } from '@schoolbox/kern/src/aufmachungen';

import { klassen } from '../../../bausteine/klassen';

/** Breite des Vorschaubilds in px. */
const BREITE = 124;

interface Eigenschaften {
	a: Aufmachung;
	ansicht: string;
	format: AufmachungsFormat;
	stand: number;
	aktiv: boolean;
	aus: boolean;
	waehle: () => void;
}

/** Ein Rezept als Kachel: die erste Seite des offenen Materials mit diesem Rezept, verkleinert, darunter der Name. */
export const RezeptKachel = ({ a, aktiv, ansicht, aus, format, stand, waehle }: Eigenschaften) => {
	const masse = SEITEN_MASSE[format];
	const skala = BREITE / masse.b;
	return (
		<button
			type="button"
			aria-pressed={aktiv}
			disabled={aus}
			title={a.beschreibung}
			data-rezept-kachel={a.id}
			className={klassen(
				'flex flex-col items-center gap-1 rounded-lg border-2 bg-flaeche p-1.5 text-sm disabled:opacity-50',
				aktiv ? 'border-brand-500' : 'border-rand hover:border-leise',
			)}
			onClick={waehle}
		>
			<span
				className="pointer-events-none relative block overflow-hidden rounded-sm bg-white"
				style={{ width: BREITE, height: Math.round(masse.h * skala) }}
			>
				<iframe
					key={stand}
					title={`Vorschau ${a.name}`}
					src={`${ansicht}?aufmachung=${a.id}&seite=1&v=${stand}`}
					loading="lazy"
					tabIndex={-1}
					aria-hidden
					className="absolute top-0 left-0 origin-top-left border-0"
					style={{ width: masse.b, height: masse.h, transform: `scale(${skala})` }}
				/>
			</span>
			<span>{a.name}</span>
		</button>
	);
};
