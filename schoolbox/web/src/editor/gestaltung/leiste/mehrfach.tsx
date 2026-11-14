import { Knopf } from '../../../bausteine/Knopf';
import { Popover } from '../../../bausteine/Popover';
import type { SymbolName } from '../../../bausteine/Symbol';
import { Symbol } from '../../../bausteine/Symbol';
import { Tooltip } from '../../../bausteine/Tooltip';
import { kuerzelVon } from '../../befehle';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/** Die Tasten stehen im Register (`gestaltung/befehle/ausrichten.ts`), der Tooltip liest sie dort. */
const AUSRICHTEN: { id: string; titel: string; symbol: SymbolName }[] = [
	{ id: 'auswahl.ausrichten-links', titel: 'Links', symbol: 'ausrichten-links' },
	{ id: 'auswahl.ausrichten-mitte', titel: 'Mitte', symbol: 'ausrichten-mitte' },
	{ id: 'auswahl.ausrichten-rechts', titel: 'Rechts', symbol: 'ausrichten-rechts' },
	{ id: 'auswahl.ausrichten-oben', titel: 'Oben', symbol: 'ausrichten-oben' },
	{ id: 'auswahl.ausrichten-mittig', titel: 'Mittig', symbol: 'ausrichten-mittig' },
	{ id: 'auswahl.ausrichten-unten', titel: 'Unten', symbol: 'ausrichten-unten' },
];

const VERTEILEN: { id: string; titel: string; symbol: SymbolName }[] = [
	{ id: 'auswahl.verteilen-waagerecht', titel: 'Waagerecht', symbol: 'verteilen-waagerecht' },
	{ id: 'auswahl.verteilen-senkrecht', titel: 'Senkrecht', symbol: 'verteilen-senkrecht' },
];

/** Ein Knopf je Befehl, mit Symbol. */
const Raster = ({
	befehle,
	eintraege,
	name,
}: Pick<LeistenTeile, 'befehle'> & {
	name: string;
	eintraege: { id: string; titel: string; symbol: SymbolName }[];
}) => (
	<div className="grid grid-cols-3 gap-1 p-1" data-leiste-raster={name}>
		{eintraege.map(({ id, symbol, titel }) => (
			<Tooltip key={id} text={titel} kuerzel={kuerzelVon(id)}>
				<Knopf art="leise" groesse="klein" data-befehl={id} onClick={() => befehle.fuehreAus(id)}>
					<Symbol name={symbol} />
					{titel}
				</Knopf>
			</Tooltip>
		))}
	</div>
);

/** 120, 204-12: „Gruppieren“ nur, wenn es geht (Elemente derselben Ebene); sonst fehlt der Knopf. */
const GruppierenKnopf = ({ aktiv, befehle }: Pick<LeistenTeile, 'aktiv' | 'befehle'>) => {
	const k = befehle.jetzt.current;
	const befehl = befehle.fuer('gestaltung').find((b) => b.id === 'auswahl.gruppieren');
	if (!befehl || befehl.gesperrt?.(k)) {
		return null;
	}
	return (
		<Tooltip text="Gruppieren" kuerzel={kuerzelVon(befehl.id)}>
			<Knopf
				art="leise"
				groesse="klein"
				data-befehl={befehl.id}
				disabled={!aktiv}
				onClick={() => befehle.fuehreAus(befehl.id)}
			>
				<Symbol name="gruppe" />
				Gruppieren
			</Knopf>
		</Tooltip>
	);
};

/**
 * Leiste bei Mehrfachauswahl (113, 204-12): Gruppieren (120) und ein Popover „Ausrichten“ mit sechs Knöpfen, ab drei
 * Elementen dazu „Verteilen“ im selben Popover. Keine Anzahl: Die nennt der Inspektor.
 */
const MehrfachKnoepfe = ({ aktiv, befehle, k }: LeistenTeile) => {
	const ausrichtenKnopf = (
		<Knopf art="leise" groesse="klein" data-leiste-ausrichten disabled={!aktiv}>
			<Symbol name="ausrichten-links" />
			Ausrichten
		</Knopf>
	);
	return (
		<>
			<GruppierenKnopf aktiv={aktiv} befehle={befehle} />
			<Popover name="Ausrichten" className="w-auto" ausloeser={ausrichtenKnopf}>
				<Raster befehle={befehle} name="ausrichten" eintraege={AUSRICHTEN} />
				{k.nrn.length >= 3 && (
					<div className="border-t border-rand">
						<Raster befehle={befehle} name="verteilen" eintraege={VERTEILEN} />
					</div>
				)}
			</Popover>
		</>
	);
};

export const MEHRFACH_LEISTE: LeistenKnoepfe | null = MehrfachKnoepfe;
