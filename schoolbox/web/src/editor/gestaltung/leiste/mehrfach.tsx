import { Knopf } from '../../../bausteine/Knopf';
import { Popover } from '../../../bausteine/Popover';
import type { SymbolName } from '../../../bausteine/Symbol';
import { Symbol } from '../../../bausteine/Symbol';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

const AUSRICHTEN: { id: string; titel: string; symbol: SymbolName; taste: string }[] = [
	{ id: 'auswahl.ausrichten-links', titel: 'Links', symbol: 'ausrichten-links', taste: '⌥A' },
	{ id: 'auswahl.ausrichten-mitte', titel: 'Mitte', symbol: 'ausrichten-mitte', taste: '⌥H' },
	{ id: 'auswahl.ausrichten-rechts', titel: 'Rechts', symbol: 'ausrichten-rechts', taste: '⌥D' },
	{ id: 'auswahl.ausrichten-oben', titel: 'Oben', symbol: 'ausrichten-oben', taste: '⌥W' },
	{ id: 'auswahl.ausrichten-mittig', titel: 'Mittig', symbol: 'ausrichten-mittig', taste: '⌥V' },
	{ id: 'auswahl.ausrichten-unten', titel: 'Unten', symbol: 'ausrichten-unten', taste: '⌥S' },
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
}: Pick<LeistenTeile, 'befehle'> & { name: string; eintraege: { id: string; titel: string; symbol: SymbolName; taste?: string }[] }) => {
	return (
		<div className="grid grid-cols-3 gap-1 p-1" data-leiste-raster={name}>
			{eintraege.map(({ id, symbol, taste, titel }) => (
					<Knopf
						key={id}
						art="leise"
						groesse="klein"
						title={taste ? `${titel} (${taste})` : titel}
						data-befehl={id}
						onClick={() => befehle.fuehreAus(id)}
					>
						<Symbol name={symbol} />
						{titel}
					</Knopf>
				))}
		</div>
	);
};

/** 120: „Gruppieren“; gesperrt mit Grund im Titel, wenn die Elemente nicht in derselben Ebene liegen. */
const GruppierenKnopf = ({ aktiv, befehle }: Pick<LeistenTeile, 'aktiv' | 'befehle'>) => {
	const k = befehle.jetzt.current;
	const befehl = befehle.fuer('gestaltung').find((b) => b.id === 'auswahl.gruppieren');
	if (!befehl) {
		return null;
	}
	const titel = typeof befehl.titel === 'function' ? befehl.titel(k) : befehl.titel;
	return (
		<Knopf
			art="leise"
			groesse="klein"
			data-befehl={befehl.id}
			disabled={!aktiv || Boolean(befehl.gesperrt?.(k))}
			title={`${titel} (⌘G)`}
			onClick={() => befehle.fuehreAus(befehl.id)}
		>
			<Symbol name="gruppe" />
			Gruppieren
		</Knopf>
	);
};

/**
 * Leiste bei Mehrfachauswahl (113, Briefing 5.7): Gruppieren (120), Ausrichten ▾ (sechs Knöpfe), Verteilen ▾, dann ⋯
 * aus dem Rahmen.
 */
const MehrfachKnoepfe = ({ aktiv, befehle, k }: LeistenTeile) => (
	<>
		<span className="px-1 text-sm text-leise tabular-nums" data-leiste-anzahl>
			{k.nrn.length} gewählt
		</span>
		<GruppierenKnopf aktiv={aktiv} befehle={befehle} /> {/* 120 */}
		<Popover
			name="Ausrichten"
			className="w-auto"
			ausloeser={
				<Knopf art="leise" groesse="klein" data-leiste-ausrichten disabled={!aktiv}>
					<Symbol name="ausrichten-links" />
					Ausrichten
				</Knopf>
			}
		>
			<Raster befehle={befehle} name="ausrichten" eintraege={AUSRICHTEN} />
		</Popover>
		{k.nrn.length >= 3 && (
			<Popover
				name="Verteilen"
				className="w-auto"
				ausloeser={
					<Knopf art="leise" groesse="klein" data-leiste-verteilen disabled={!aktiv}>
						<Symbol name="verteilen-waagerecht" />
						Verteilen
					</Knopf>
				}
			>
				<Raster befehle={befehle} name="verteilen" eintraege={VERTEILEN} />
			</Popover>
		)}
	</>
);

export const MEHRFACH_LEISTE: LeistenKnoepfe | null = MehrfachKnoepfe;
