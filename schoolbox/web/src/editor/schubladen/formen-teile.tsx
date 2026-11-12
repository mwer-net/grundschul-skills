import { useState } from 'react';

import { Schublade, Schubladenabschnitt, Schubladenleer, Schubladensuche } from '../../bausteine/Schublade';
import { nichtsPasst } from '../../bausteine/schubladenhilfe';
import type { SchubladenTeile } from '.';
import { ABSCHNITTE } from './formen-daten';
import { kopf } from './reihe';

export const Inhalt = (teile: SchubladenTeile) => {
	const [suche, setSuche] = useState('');
	const sichtbar = ABSCHNITTE.filter((a) => a.zeigt({ teile, suche }));
	return (
		<Schublade
			titel={kopf('werkzeuge').titel}
			daten={{ 'data-schublade-werkzeuge': '' }}
			steuerung={<Schubladensuche beschriftung="In Werkzeugen suchen" wert={suche} setWert={setSuche} />}
		>
			{sichtbar.map(({ Inhalt: Teil, id, titel }) => (
				<Schubladenabschnitt key={id} titel={titel} daten={{ 'data-formen-abschnitt': id }}>
					<Teil teile={teile} suche={suche} />
				</Schubladenabschnitt>
			))}
			{sichtbar.length === 0 && <Schubladenleer>{nichtsPasst(suche)}</Schubladenleer>}
		</Schublade>
	);
};
