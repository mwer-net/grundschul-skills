import type { MouseEvent } from 'react';

import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import { Baum } from './Baum';
import type { AblageOrdner, AblageStand, Seite } from './typen';

interface Eigenschaften {
	stand: AblageStand;
	seite: Seite;
	offen: ReadonlySet<string>;
	klappe: (id: string, alles?: boolean) => void;
	gehe: (pfad: string) => void;
	kontext: (e: MouseEvent, ordner: AblageOrdner | null) => void;
}

const FESTE_ZEILE =
	'flex h-[var(--hoehe-baumzeile)] w-full flex-none items-center gap-2 rounded-md px-1.5 text-left text-sm select-none';

/** Oben „Zuletzt geändert“, dann der Baum, unten der Papierkorb. Jede Ordnerzeile ist Ablageziel. */
export const Ordnerleiste = ({ gehe, klappe, kontext, offen, seite, stand }: Eigenschaften) => (
	<nav
		aria-label="Ablage"
		data-ordnerleiste
		data-seitenleiste
		className="sticky top-[var(--kopf,0px)] flex h-[calc(100dvh-var(--kopf,0px)-var(--chat-platz,0px))] w-[220px] flex-none flex-col gap-1 border-r border-rand bg-flaeche p-1.5"
	>
		<button
			type="button"
			className={klassen(
				FESTE_ZEILE,
				seite.art === 'zuletzt' ? 'bg-brand-100 font-medium' : 'hover:bg-flaeche-2',
			)}
			onClick={() => gehe('/zuletzt')}
		>
			<Symbol name="uhr" className="size-3.5 flex-none text-leise" />
			Zuletzt geändert
		</button>
		<div className="min-h-0 flex-1 overflow-y-auto" data-baum-roll>
			<Baum
				stand={stand}
				aktuell={seite.art === 'ordner' ? seite.ordner : undefined}
				offen={offen}
				klappe={klappe}
				waehle={(id) => gehe(id === null ? '/' : `/o/${id}`)}
				kontext={kontext}
			/>
		</div>
		<button
			type="button"
			data-ablage-ziel="papierkorb"
			className={klassen(
				FESTE_ZEILE,
				seite.art === 'papierkorb' ? 'bg-brand-100 font-medium' : 'hover:bg-flaeche-2',
			)}
			onClick={() => gehe('/papierkorb')}
		>
			<Symbol name="papierkorb" className="size-3.5 flex-none text-leise" />
			Papierkorb
		</button>
	</nav>
);
