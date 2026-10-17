import { useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import type { Pruefpunkt, Pruefstand } from './pruefung';

/** Diese zeigt das Bild-Panel selbst, live beim Ziehen an den Ecken (017). */
const IM_BILDPANEL = new Set(['bild-unscharf', 'bild-farbig']);

const FARBE: Record<Pruefpunkt['stufe'], string> = {
	FEHLER: 'border-fehler',
	WARNUNG: 'border-warnung',
	HINWEIS: 'border-rand',
};

const zustandVon = (wichtig: Pruefpunkt[]) => {
	if (wichtig.length === 0) {
		return 'ok';
	}
	return wichtig.some((p) => p.stufe === 'FEHLER') ? 'fehler' : 'warnung';
};

const Satz = ({ mitSeite, p }: { p: Pruefpunkt; mitSeite: boolean }) => (
	<>
		<span className="block">
			{mitSeite && p.seite > 0 && <span className="text-leise">{`Seite ${p.seite}: `}</span>}
			{p.satz}
		</span>
		{p.tipp && <span className="mt-1 block text-leise">{`Tipp: ${p.tipp}`}</span>}
	</>
);

const Eintrag = ({ mitSeite, p, zeige }: { p: Pruefpunkt; mitSeite: boolean; zeige: (p: Pruefpunkt) => void }) => (
	<li>
		<button
			type="button"
			className={klassen(
				'min-h-12 w-full rounded-lg border-l-4 py-2 pr-2 pl-3 text-left hover:bg-brand-50 disabled:hover:bg-transparent',
				FARBE[p.stufe],
			)}
			data-pruefpunkt={p.code ?? ''}
			data-stufe={p.stufe}
			disabled={p.bausteine.length === 0}
			onClick={() => zeige(p)}
		>
			<Satz p={p} mitSeite={mitSeite} />
		</button>
	</li>
);

interface Eigenschaften {
	stand: Pruefstand | null;
	/** Zum Element rollen und es auswählen. */
	zeige: (p: Pruefpunkt) => void;
}

/**
 * Oben im Panel: „Alles passt“ oder „2 Dinge prüfen“, aufgeklappt die Liste. Die Zeile bleibt gleich hoch, egal was
 * die Prüfung findet; so verschiebt sich am iPad hoch das Blatt nicht bei jeder Änderung. Hinweise stehen grau und
 * eingeklappt darunter.
 */
export const Pruefliste = ({ stand, zeige }: Eigenschaften) => {
	const [offen, setOffen] = useState(false);
	if (!stand) {
		return null;
	}
	const { mehrereSeiten, punkte } = stand;
	const wichtig = punkte.filter((p) => p.stufe !== 'HINWEIS');
	const hinweise = punkte.filter((p) => p.stufe === 'HINWEIS');
	const zustand = zustandVon(wichtig);
	const titel = wichtig.length === 1 ? '1 Ding prüfen' : `${wichtig.length} Dinge prüfen`;
	const waehle = (p: Pruefpunkt) => {
		setOffen(false);
		zeige(p);
	};
	return (
		<section className="flex-none border-b border-rand bg-white" aria-label="Prüfung" data-pruefung={zustand}>
			<button
				type="button"
				className="flex min-h-14 w-full items-center gap-3 px-5 text-left font-bold hover:bg-brand-50 max-lg:px-4"
				aria-expanded={offen}
				disabled={punkte.length === 0}
				onClick={() => setOffen(!offen)}
			>
				<span
					className={klassen(
						'flex size-7 flex-none items-center justify-center rounded-full text-white',
						zustand === 'fehler' && 'bg-fehler',
						zustand === 'warnung' && 'bg-warnung',
						zustand === 'ok' && 'bg-gut',
					)}
				>
					<Symbol name={zustand === 'ok' ? 'haken' : 'achtung'} className="size-4" />
				</span>
				<span className="flex-1">
					{wichtig.length === 0 ? 'Alles passt' : titel}
					{hinweise.length > 0 && (
						<span className="font-normal text-leise">
							{` · ${hinweise.length} ${hinweise.length === 1 ? 'Hinweis' : 'Hinweise'}`}
						</span>
					)}
				</span>
				{punkte.length > 0 && <Symbol name={offen ? 'hoch' : 'runter'} />}
			</button>
			{offen && (
				<div className="max-h-[45vh] overflow-y-auto px-5 pb-3 max-lg:max-h-[24vh] max-lg:px-4" data-pruefliste>
					{wichtig.length > 0 && (
						<ul className="flex flex-col gap-1">
							{wichtig.map((p, i) => (
								<Eintrag key={`${p.code}-${i}`} p={p} mitSeite={mehrereSeiten} zeige={waehle} />
							))}
						</ul>
					)}
					{hinweise.length > 0 && (
						<details className="mt-2 text-leise" data-hinweise>
							<summary className="flex min-h-11 cursor-pointer items-center font-bold">
								{hinweise.length === 1 ? '1 Hinweis' : `${hinweise.length} Hinweise`}
							</summary>
							<ul className="flex flex-col gap-1">
								{hinweise.map((p, i) => (
									<Eintrag key={`${p.code}-${i}`} p={p} mitSeite={mehrereSeiten} zeige={waehle} />
								))}
							</ul>
						</details>
					)}
				</div>
			)}
		</section>
	);
};

/** Im Panel des gewählten Bausteins: was die Prüfung genau zu ihm sagt. */
export const Pruefhinweise = ({ nr, stand }: { stand: Pruefstand | null; nr: number | null }) => {
	const eigene = (stand?.punkte ?? []).filter(
		(p) => nr !== null && p.bausteine.includes(nr) && !IM_BILDPANEL.has(p.code ?? ''),
	);
	if (eigene.length === 0) {
		return null;
	}
	return (
		<ul className="mt-3 flex flex-col gap-2" data-pruefhinweise>
			{eigene.map((p, i) => (
				<li
					key={`${p.code}-${i}`}
					className={klassen('rounded-lg border-l-4 bg-papier py-2 pr-2 pl-3', FARBE[p.stufe])}
				>
					<Satz p={p} mitSeite={false} />
				</li>
			))}
		</ul>
	);
};
