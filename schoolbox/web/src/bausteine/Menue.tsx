import { Menu } from '@base-ui/react/menu';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { useCallback, useState } from 'react';

import type { KnopfArt, KnopfGroesse } from './klassen';
import { klassen } from './klassen';
import { Knopf } from './Knopf';
import { Kuerzel } from './Kuerzel';
import { Symbol, type SymbolName } from './Symbol';
import { useDaneben } from './ueberlagerung';

export interface MenueEintrag {
	titel: string;
	/** Ein Satz unter dem Titel: wofür der Eintrag gut ist. */
	beschreibung?: string;
	symbol?: SymbolName;
	kuerzel?: string;
	gefahr?: boolean;
	/** Bleibt an seinem Platz, ist aber gesperrt. */
	aus?: boolean;
	/** Haken davor: der gerade gültige Wert. */
	aktiv?: boolean;
	/** Einträge gleicher Gruppe stehen zusammen, zwischen Gruppen liegt eine Linie. */
	gruppe?: string;
	waehle?: () => void;
	/** Höchstens eine Ebene. */
	untermenue?: MenueEintrag[];
}

export const POPUP_KLASSEN =
	'z-menue max-h-[var(--available-height)] min-w-40 overflow-y-auto rounded-xl border border-rand bg-flaeche p-1 text-sm text-tinte shadow-2 outline-none';

const EINTRAG_KLASSEN =
	'flex h-menue w-full items-center gap-2 rounded-md px-2 text-left outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-flaeche-2 data-[popup-open]:bg-flaeche-2';

const Inhalt = ({ eintrag }: { eintrag: MenueEintrag }) => (
	<>
		{eintrag.symbol ? (
			<Symbol name={eintrag.symbol} />
		) : (
			eintrag.aktiv !== undefined && (
				<span className="flex size-3.5 flex-none items-center justify-center">
					{eintrag.aktiv && <Symbol name="haken" />}
				</span>
			)
		)}
		<span className="min-w-0 flex-1 py-1">
			<span className="block">{eintrag.titel}</span>
			{eintrag.beschreibung && <span className="mt-0.5 block text-xs text-leise">{eintrag.beschreibung}</span>}
		</span>
		{eintrag.kuerzel && <Kuerzel text={eintrag.kuerzel} className="ml-4" />}
	</>
);

/** Einträge samt Linien zwischen den Gruppen und Untermenüs: dieselbe Liste für Knopf, Rechtsklick und ⋯. */
export const MenueEintraege = ({ eintraege }: { eintraege: MenueEintrag[] }) =>
	eintraege.map((eintrag, i) => {
		const vorher = eintraege[i - 1];
		const linie = vorher && vorher.gruppe !== eintrag.gruppe;
		const schluessel = `${eintrag.gruppe ?? ''}/${eintrag.titel}`;
		return (
			<div key={schluessel} className="contents">
				{linie && <Menu.Separator className="mx-1 my-1 h-px bg-rand" />}
				{eintrag.untermenue ? (
					<Menu.SubmenuRoot>
						<Menu.SubmenuTrigger disabled={eintrag.aus} className={EINTRAG_KLASSEN}>
							<Inhalt eintrag={eintrag} />
							<Symbol name="rechts" className="size-3 flex-none text-dezent" />
						</Menu.SubmenuTrigger>
						<Menu.Portal>
							<Menu.Positioner className="z-menue outline-none" sideOffset={2} collisionPadding={8}>
								<Menu.Popup className={POPUP_KLASSEN}>
									<MenueEintraege eintraege={eintrag.untermenue} />
								</Menu.Popup>
							</Menu.Positioner>
						</Menu.Portal>
					</Menu.SubmenuRoot>
				) : (
					<Menu.Item
						disabled={eintrag.aus}
						className={klassen(EINTRAG_KLASSEN, eintrag.gefahr && 'text-fehler')}
						onClick={() => {
							// Erst schließen, dann ausführen: Der Befehl darf den Fokus neu setzen.
							window.setTimeout(() => eintrag.waehle?.(), 0);
						}}
					>
						<Inhalt eintrag={eintrag} />
					</Menu.Item>
				)}
			</div>
		);
	});

interface Eigenschaften {
	/** Inhalt des Knopfs. Ohne `ausloeser` entsteht daraus ein Knopf mit Pfeil. */
	beschriftung?: ReactNode;
	/** Name für Hilfsmittel und Tests, wenn der Knopf nur ein Symbol zeigt. */
	name?: string;
	eintraege: MenueEintrag[];
	art?: KnopfArt;
	groesse?: KnopfGroesse;
	disabled?: boolean;
	/** Klappt nach links auf, wenn der Knopf am rechten Rand steht. */
	rechtsbuendig?: boolean;
	/** Eigener Auslöser statt des Standardknopfs. */
	ausloeser?: ReactElement<Record<string, unknown>>;
	/** Wohin der Fokus nach dem Schließen geht; sonst zurück zum Auslöser. */
	fokusDanach?: RefObject<HTMLElement | null>;
}

/**
 * Knopf mit Auswahl: ↑↓ Home End, Tippen zum Finden, → ← für Untermenüs, Esc, ⏎. Öffnet per Klick oder Tippen, nie
 * per Hover. Klick daneben schließt, auch im `iframe` des Editors (`meldeDaneben`).
 */
export const Menue = ({
	art = 'zweit',
	ausloeser,
	beschriftung,
	disabled,
	eintraege,
	fokusDanach,
	groesse,
	name,
	rechtsbuendig,
}: Eigenschaften) => {
	const [offen, setOffen] = useState(false);
	const schliessen = useCallback(() => setOffen(false), []);
	useDaneben(offen, schliessen);
	return (
		<Menu.Root open={offen} modal={false} onOpenChange={setOffen}>
			<Menu.Trigger
				disabled={disabled}
				aria-label={name}
				render={
					ausloeser ?? (
						<Knopf art={art} groesse={groesse}>
							{beschriftung}
							<Symbol name="runter" className="size-3 flex-none" />
						</Knopf>
					)
				}
			/>
			<Menu.Portal>
				<Menu.Positioner
					className="z-menue outline-none"
					sideOffset={4}
					align={rechtsbuendig ? 'end' : 'start'}
					collisionPadding={8}
				>
					<Menu.Popup
						finalFocus={fokusDanach}
						className={klassen(POPUP_KLASSEN, eintraege.some((e) => e.beschreibung) && 'w-80 max-w-[90vw]')}
					>
						<MenueEintraege eintraege={eintraege} />
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
};
