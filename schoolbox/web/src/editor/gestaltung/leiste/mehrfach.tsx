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

/** Ein Knopf je Befehl, mit Symbol; gesperrt, wenn der Befehl gerade nicht geht. */
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

/**
 * 120: „Gruppieren“; gesperrt mit Grund im Tooltip, wenn die Elemente nicht in derselben Ebene liegen. Gesperrt heißt
 * hier `aria-disabled`, sonst bekäme der Knopf keinen Zeiger und der Grund stünde nirgends (wie `ClaudeKnopf`).
 */
const GruppierenKnopf = ({ aktiv, befehle }: Pick<LeistenTeile, 'aktiv' | 'befehle'>) => {
	const k = befehle.jetzt.current;
	const befehl = befehle.fuer('gestaltung').find((b) => b.id === 'auswahl.gruppieren');
	if (!befehl) {
		return null;
	}
	const titel = typeof befehl.titel === 'function' ? befehl.titel(k) : befehl.titel;
	const gesperrt = Boolean(befehl.gesperrt?.(k));
	return (
		<Tooltip text={titel} kuerzel={gesperrt ? undefined : kuerzelVon(befehl.id)}>
			<Knopf
				art="leise"
				groesse="klein"
				className="aria-disabled:cursor-default aria-disabled:opacity-50"
				data-befehl={befehl.id}
				disabled={!aktiv}
				aria-disabled={gesperrt}
				onClick={() => {
					if (!gesperrt) {
						befehle.fuehreAus(befehl.id);
					}
				}}
			>
				<Symbol name="gruppe" />
				Gruppieren
			</Knopf>
		</Tooltip>
	);
};

/**
 * Leiste bei Mehrfachauswahl (113, Briefing 5.7): Gruppieren (120), Ausrichten ▾ (sechs Knöpfe), Verteilen ▾, dann ⋯
 * aus dem Rahmen.
 */
const MehrfachKnoepfe = ({ aktiv, befehle, k }: LeistenTeile) => {
	const ausrichtenKnopf = (
		<Knopf art="leise" groesse="klein" data-leiste-ausrichten disabled={!aktiv}>
			<Symbol name="ausrichten-links" />
			Ausrichten
		</Knopf>
	);
	const verteilenKnopf = (
		<Knopf art="leise" groesse="klein" data-leiste-verteilen disabled={!aktiv}>
			<Symbol name="verteilen-waagerecht" />
			Verteilen
		</Knopf>
	);
	return (
		<>
			<span className="px-1 text-sm text-leise tabular-nums" data-leiste-anzahl>
				{`${k.nrn.length} gewählt`}
			</span>
			<GruppierenKnopf aktiv={aktiv} befehle={befehle} />
			<Popover name="Ausrichten" className="w-auto" ausloeser={ausrichtenKnopf}>
				<Raster befehle={befehle} name="ausrichten" eintraege={AUSRICHTEN} />
			</Popover>
			{k.nrn.length >= 3 && (
				<Popover name="Verteilen" className="w-auto" ausloeser={verteilenKnopf}>
					<Raster befehle={befehle} name="verteilen" eintraege={VERTEILEN} />
				</Popover>
			)}
		</>
	);
};

export const MEHRFACH_LEISTE: LeistenKnoepfe | null = MehrfachKnoepfe;
