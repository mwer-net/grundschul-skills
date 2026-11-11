import { useState } from 'react';

import { Schubladenkopf, Schubladensuche } from '../../bausteine/Schubladenkopf';
import type { SchubladenTeile } from '.';
import { ABSCHNITTE } from './formen-daten';
import { kopf } from './reihe';

export const Inhalt = (teile: SchubladenTeile) => {
	const [suche, setSuche] = useState('');
	const sichtbar = ABSCHNITTE.filter((a) => a.zeigt({ teile, suche }));
	// Die Nummer zählt nur Abschnitte mit Titel: Die Werkzeugreihe oben hat keinen.
	const nummern = new Map(sichtbar.filter((a) => a.titel).map((a, i) => [a.id, i + 1] as const));
	return (
		<div className="flex min-h-0 flex-1 flex-col" data-schublade-werkzeuge>
			<Schubladenkopf titel={kopf('werkzeuge').titel} />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="flex flex-col gap-3 p-2">
					<Schubladensuche
						beschriftung="In Werkzeugen suchen"
						platzhalter="Suchen …"
						wert={suche}
						setWert={setSuche}
					/>
					{sichtbar.map(({ Inhalt: Teil, hinweis, id, titel }) => (
						<section key={id} className="flex flex-col gap-1.5" data-formen-abschnitt={id}>
							{titel && (
								<h3 className="flex items-center gap-2 text-sm font-semibold">
									<span
										aria-hidden
										className="flex size-5 flex-none items-center justify-center rounded-full bg-brand-600 text-[11px] text-white"
									>
										{nummern.get(id)}
									</span>
									<span className="min-w-0 flex-1 truncate">{titel}</span>
									{hinweis && (
										<span className="flex-none text-xs font-normal text-leise">{hinweis}</span>
									)}
								</h3>
							)}
							<Teil teile={teile} suche={suche} />
						</section>
					))}
					{sichtbar.length === 0 && (
						<p className="px-1 text-sm text-leise" data-formen-leer>
							{`Nichts passt zu „${suche}“.`}
						</p>
					)}
				</div>
			</div>
		</div>
	);
};
