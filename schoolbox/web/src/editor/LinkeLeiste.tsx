import type { ReactNode } from 'react';

import { Reiter } from '../bausteine/Reiter';

export type LinksName = 'gliederung' | 'bausteine';

interface Eigenschaften {
	panel: LinksName;
	setPanel: (panel: LinksName) => void;
	bausteineAus: boolean;
	children: ReactNode;
}

/** Gliederung oder Bausteine. Immer nur eines; zu geht die Leiste über die Statusleiste. */
export const LinkeLeiste = ({ bausteineAus, children, panel, setPanel }: Eigenschaften) => (
	<aside className="flex min-h-0 w-60 flex-none flex-col border-r border-rand bg-flaeche" data-panel-links={panel}>
		<Reiter
			beschriftung="Linke Leiste"
			className="flex-none gap-3 border-b border-rand px-2 pt-1"
			wert={panel}
			waehle={setPanel}
			werte={[
				{ wert: 'gliederung', titel: 'Gliederung' },
				{ wert: 'bausteine', titel: 'Bausteine', aus: bausteineAus },
			]}
		/>
		{children}
	</aside>
);
