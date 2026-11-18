import { meldung } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { klassen } from '../bausteine/klassen';
import { Popover } from '../bausteine/Popover';
import { Segment } from '../bausteine/Segment';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import type { KiEinstellung } from './ki-einstellung';
import { EFFORT_NAMEN, modellName, useKiEinstellung } from './ki-einstellung';

const AUTO_TEXT = 'Mittel für Änderungen, hoch für neue Blätter, Einheiten und Recherche.';

/** Am iPad bleibt die Trefferfläche 44 px, in der Zeile zählt sie wie am Mac (wie Senden in „Bild beschreiben“). */
const CHIP =
	'inline-flex h-knopf-status flex-none items-center gap-1 rounded-sm px-1 text-xs whitespace-nowrap text-leise hover:bg-flaeche-2 hover:text-tinte data-[popup-open]:bg-flaeche-2 data-[popup-open]:text-tinte [@media(any-pointer:coarse)]:-my-3';

const Wahl = ({
	einstellung,
	setze,
}: {
	einstellung: KiEinstellung;
	setze: (teil: Partial<Pick<KiEinstellung, 'modell' | 'effort'>>) => void;
}) => (
	<div className="flex flex-col gap-2" data-claude-wahl-fenster>
		<div className="flex flex-col gap-1">
			<p className="px-0.5 text-xs font-medium text-leise">Modell</p>
			<Segment
				voll
				beschriftung="Modell"
				werte={einstellung.modelle.map((m) => ({ wert: m.id, titel: m.name }))}
				wert={einstellung.modell ?? einstellung.standardModell}
				// Der Standard bleibt `null`: So folgt die Wahl einer geänderten Konfiguration.
				waehle={(id) => setze({ modell: id === einstellung.standardModell ? null : id })}
			/>
		</div>
		<div className="flex flex-col gap-1">
			<p className="px-0.5 text-xs font-medium text-leise">Gründlichkeit</p>
			<div role="group" aria-label="Gründlichkeit" className="flex flex-col">
				{EFFORT_NAMEN.map(({ titel, wert }) => {
					const gewaehlt = einstellung.effort === wert;
					const knopf = (
						<button
							key={wert}
							type="button"
							aria-pressed={gewaehlt}
							className="flex h-menue items-center gap-2 rounded-sm px-1.5 text-left hover:bg-flaeche-2"
							onClick={() => setze({ effort: wert })}
						>
							<Symbol name="haken" className={klassen('size-3 flex-none', !gewaehlt && 'invisible')} />
							{titel}
						</button>
					);
					return wert === 'auto' ? (
						<Tooltip key={wert} text={AUTO_TEXT}>
							{knopf}
						</Tooltip>
					) : (
						knopf
					);
				})}
			</div>
		</div>
	</div>
);

/**
 * Modell und Gründlichkeit am Fuß jeder Eingabe an Claude (232), wie in der Claude-App. Der Chip zeigt den Zustand; eine
 * Wahl gilt sofort überall, auch für den nächsten Auftrag auf einem anderen Gerät.
 */
export const ClaudeWahl = ({ className }: { className?: string }) => {
	const { einstellung, setze } = useKiEinstellung();
	const zeige = useHinweis();
	if (!einstellung) {
		return null;
	}
	const effort = EFFORT_NAMEN.find((e) => e.wert === einstellung.effort)?.titel ?? einstellung.effort;
	const waehle = (teil: Partial<Pick<KiEinstellung, 'modell' | 'effort'>>) => {
		setze(teil).catch((grund: unknown) => zeige({ text: meldung(grund), art: 'fehler' }));
	};
	const ausloeser = (
		<button type="button" className={klassen(CHIP, className)} data-claude-wahl>
			{`${modellName(einstellung)} · ${effort}`}
		</button>
	);
	return (
		<Popover name="Modell und Gründlichkeit" seite="top" ausrichtung="end" className="w-70" ausloeser={ausloeser}>
			<Wahl einstellung={einstellung} setze={waehle} />
		</Popover>
	);
};
