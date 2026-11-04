import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Popover } from '../bausteine/Popover';
import { Symbol } from '../bausteine/Symbol';
import type { Pruefpunkt, Pruefstand } from './pruefung';

/** Diese zeigt das Bild-Panel selbst, live beim Ziehen an den Ecken (017). */
const IM_BILDPANEL = new Set(['bild-unscharf']);

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

const Eintrag = ({
	mitSeite,
	p,
	verschiebe,
	zeige,
}: {
	p: Pruefpunkt;
	mitSeite: boolean;
	zeige: (p: Pruefpunkt) => void;
	verschiebe?: ((p: Pruefpunkt) => void) | undefined;
}) => (
	<li>
		<button
			type="button"
			className={klassen(
				'w-full rounded-md border-l-2 py-1 pr-2 pl-2 text-left hover:bg-flaeche-2 disabled:hover:bg-transparent',
				FARBE[p.stufe],
			)}
			data-pruefpunkt={p.code ?? ''}
			data-stufe={p.stufe}
			disabled={p.bausteine.length === 0}
			onClick={() => zeige(p)}
		>
			<Satz p={p} mitSeite={mitSeite} />
		</button>
		{verschiebe && p.code === 'ueberlauf' && (
			<Knopf art="zweit" className="mt-1 w-full" data-ueberlauf-verschieben onClick={() => verschiebe(p)}>
				Auf neue Seite verschieben
			</Knopf>
		)}
	</li>
);

interface Eigenschaften {
	stand: Pruefstand | null;
	/** Zum Element rollen und es auswählen. */
	zeige: (p: Pruefpunkt) => void;
	/** Legt, was über die Seite ragt, auf eine neue Seite (044). */
	verschiebe?: ((p: Pruefpunkt) => void) | undefined;
}

const FARBE_STATUS = { ok: 'text-gut', warnung: 'text-warnung', fehler: 'text-fehler' } as const;

/**
 * In der Statusleiste: „Alles passt“ oder „2 Dinge prüfen“, die Liste geht als Popover auf. Hinweise stehen grau und
 * eingeklappt darunter.
 */
export const Pruefstatus = ({ stand, verschiebe, zeige }: Eigenschaften) => {
	if (!stand) {
		return null;
	}
	const { mehrereSeiten, punkte } = stand;
	const wichtig = punkte.filter((p) => p.stufe !== 'HINWEIS');
	const hinweise = punkte.filter((p) => p.stufe === 'HINWEIS');
	const zustand = zustandVon(wichtig);
	const titel = wichtig.length === 1 ? '1 Ding prüfen' : `${wichtig.length} Dinge prüfen`;
	return (
		<section className="flex min-w-0 items-center" aria-label="Prüfung" data-pruefung={zustand}>
			<Popover
				seite="top"
				className="w-80"
				ausloeser={
					<button
						type="button"
						className="inline-flex h-knopf-status min-w-0 items-center gap-1 rounded-sm px-1 text-xs hover:bg-flaeche-2 disabled:hover:bg-transparent"
						disabled={punkte.length === 0}
					>
						<Symbol
							name={zustand === 'ok' ? 'haken' : 'achtung'}
							className={klassen('size-3 flex-none', FARBE_STATUS[zustand])}
						/>
						<span className={klassen('truncate font-medium', FARBE_STATUS[zustand])}>
							{wichtig.length === 0 ? 'Alles passt' : titel}
							{hinweise.length > 0 && (
								<span className="font-normal text-leise">
									{` · ${hinweise.length} ${hinweise.length === 1 ? 'Hinweis' : 'Hinweise'}`}
								</span>
							)}
						</span>
					</button>
				}
			>
				{(schliessen) => {
					const waehle = (p: Pruefpunkt) => {
						schliessen();
						zeige(p);
					};
					return (
						<div data-pruefliste>
							{wichtig.length > 0 && (
								<ul className="flex flex-col gap-1">
									{wichtig.map((p, i) => (
										<Eintrag
											key={`${p.code}-${i}`}
											p={p}
											mitSeite={mehrereSeiten}
											zeige={waehle}
											verschiebe={verschiebe}
										/>
									))}
								</ul>
							)}
							{hinweise.length > 0 && (
								<details className="mt-1 text-leise" data-hinweise>
									<summary className="flex h-menue cursor-pointer items-center font-medium">
										{hinweise.length === 1 ? '1 Hinweis' : `${hinweise.length} Hinweise`}
									</summary>
									<ul className="flex flex-col gap-1">
										{hinweise.map((p, i) => (
											<Eintrag
												key={`${p.code}-${i}`}
												p={p}
												mitSeite={mehrereSeiten}
												zeige={waehle}
												verschiebe={verschiebe}
											/>
										))}
									</ul>
								</details>
							)}
						</div>
					);
				}}
			</Popover>
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
		<ul className="mt-2 flex flex-col gap-1" data-pruefhinweise>
			{eigene.map((p, i) => (
				<li
					key={`${p.code}-${i}`}
					className={klassen('rounded-md border-l-2 bg-papier py-1 pr-2 pl-2', FARBE[p.stufe])}
				>
					<Satz p={p} mitSeite={false} />
				</li>
			))}
		</ul>
	);
};
