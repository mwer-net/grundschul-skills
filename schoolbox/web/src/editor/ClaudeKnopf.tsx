import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { BEFEHLE, kuerzelVon } from './befehle';
import type { Befehle } from './useBefehle';

const BEFEHL = BEFEHLE.find((b) => b.id === 'auswahl.claude');

/**
 * „Claude“ in den Leisten am Element (134). Gesperrt bleibt er sichtbar, der Grund steht im Tooltip (135). Ein
 * gesperrter Knopf bekäme keinen Zeiger und damit keinen Tooltip, deshalb nur `aria-disabled`. Als `platzhalter`
 * unsichtbar an seinem Platz, damit die Textsitzung die Schriftknöpfe nicht verschiebt (071).
 */
export const ClaudeKnopf = ({ befehle, platzhalter = false }: { befehle: Befehle; platzhalter?: boolean }) => {
	const k = befehle.jetzt.current;
	if (!BEFEHL || (!platzhalter && !BEFEHL.verfuegbar(k))) {
		return null;
	}
	const grund = BEFEHL.warumNicht?.(k) ?? null;
	return (
		<Tooltip
			text={grund ?? 'Mit Claude ändern'}
			kuerzel={grund === null ? kuerzelVon('ansicht.claude') : undefined}
		>
			<Knopf
				art="leise"
				groesse="klein"
				aria-disabled={grund !== null}
				className={klassen('aria-disabled:cursor-default aria-disabled:opacity-50', platzhalter && 'invisible')}
				data-claude-knopf
				onClick={() => {
					if (grund === null) {
						befehle.fuehreAus('auswahl.claude');
					}
				}}
			>
				<Symbol name="funken" />
				Claude
			</Knopf>
		</Tooltip>
	);
};
