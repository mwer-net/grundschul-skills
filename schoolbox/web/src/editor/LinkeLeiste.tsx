import type { ReactNode } from 'react';

import { klassen } from '../bausteine/klassen';
import { Reiter } from '../bausteine/Reiter';

export type LinksName = 'seiten' | 'gliederung' | 'bausteine';

interface Eigenschaften {
	panel: LinksName;
	setPanel: (panel: LinksName) => void;
	bausteineAus: boolean;
	children: ReactNode;
}

/** Seiten, Gliederung oder Bausteine. Immer nur eines; zu geht die Leiste über die Statusleiste. */
export const LinkeLeiste = ({ bausteineAus, children, panel, setPanel }: Eigenschaften) => (
	<aside
		className={klassen(
			'flex min-h-0 flex-none flex-col border-r border-rand bg-flaeche',
			panel === 'bausteine' ? 'w-60' : 'w-[200px] max-lg:w-36',
		)}
		data-panel-links={panel}
	>
		<Reiter
			beschriftung="Linke Leiste"
			className="flex-none justify-between border-b border-rand px-2 pt-1"
			wert={panel}
			waehle={setPanel}
			werte={[
				{ wert: 'seiten', titel: 'Seiten' },
				{ wert: 'gliederung', titel: 'Gliederung' },
				{ wert: 'bausteine', titel: 'Bausteine', aus: bausteineAus },
			]}
		/>
		{children}
	</aside>
);
