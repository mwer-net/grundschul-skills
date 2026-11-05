import type { ButtonHTMLAttributes } from 'react';

import type { KnopfArt, KnopfGroesse } from './klassen';
import { klassen } from './klassen';
import { Knopf } from './Knopf';
import { kuerzelAnzeige } from './kuerzel';
import type { SymbolName } from './Symbol';
import { Symbol } from './Symbol';
import { Tooltip } from './Tooltip';

interface Eigenschaften extends ButtonHTMLAttributes<HTMLButtonElement> {
	symbol: SymbolName;
	/** Name für Hilfsmittel und Tooltip. Pflicht, denn der Knopf zeigt nur ein Symbol. */
	beschriftung: string;
	kuerzel?: string;
	/** Tooltip, wenn er mehr sagen soll als der Name, etwa „Rückgängig: Silben“. */
	tooltip?: string;
	art?: KnopfArt;
	groesse?: KnopfGroesse;
}

/** Nur für die Symbole, die ohne Text verstanden werden (Regel aus 063). */
export const SymbolKnopf = ({
	art = 'leise',
	beschriftung,
	className,
	groesse = 'standard',
	kuerzel,
	symbol,
	tooltip,
	...rest
}: Eigenschaften) => (
	<Tooltip text={tooltip ?? beschriftung} kuerzel={kuerzel}>
		<Knopf
			art={art}
			groesse={groesse}
			className={klassen(groesse === 'klein' ? 'size-knopf-klein' : 'size-knopf', 'px-0', className)}
			aria-label={kuerzel ? `${beschriftung} (${kuerzelAnzeige(kuerzel)})` : beschriftung}
			{...rest}
		>
			<Symbol name={symbol} />
		</Knopf>
	</Tooltip>
);
