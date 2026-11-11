import { Knopf } from '../bausteine/Knopf';
import { Kuerzel } from '../bausteine/Kuerzel';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { BEFEHLE } from './befehle';
import type { Befehle } from './useBefehle';

const BEFEHL = BEFEHLE.find((b) => b.id === 'auswahl.claude');

/**
 * „Claude ⌘J“ in den Leisten am Element (134). Gesperrt bleibt er sichtbar, der Grund steht im Tooltip (135). Ein
 * gesperrter Knopf bekäme keinen Zeiger und damit keinen Tooltip, deshalb nur `aria-disabled`.
 */
export const ClaudeKnopf = ({ befehle }: { befehle: Befehle }) => {
	const k = befehle.jetzt.current;
	if (!BEFEHL?.verfuegbar(k)) {
		return null;
	}
	const grund = BEFEHL.warumNicht?.(k) ?? null;
	return (
		<Tooltip text={grund ?? 'Mit Claude ändern'}>
			<Knopf
				art="leise"
				groesse="klein"
				aria-disabled={grund !== null}
				className="aria-disabled:cursor-default aria-disabled:opacity-50"
				data-claude-knopf
				onClick={() => {
					if (grund === null) {
						befehle.fuehreAus('auswahl.claude');
					}
				}}
			>
				<Symbol name="funken" />
				Claude
				<Kuerzel text="⌘J" />
			</Knopf>
		</Tooltip>
	);
};
