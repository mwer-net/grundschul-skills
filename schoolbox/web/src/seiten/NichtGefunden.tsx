import type { ApiFehler } from '../api';
import { KnopfLink } from '../bausteine/Knopf';
import { Zustand } from '../bausteine/Zustand';
import { useTitel } from '../lib/titel';

export const NichtGefunden = () => {
	useTitel('Nicht gefunden');
	return (
		<Zustand symbol="suche" titel="Diese Seite gibt es nicht">
			<p className="text-leise">Vielleicht ist der Link alt oder es hat sich ein Tippfehler eingeschlichen.</p>
			<KnopfLink to="/">Zu meinem Material</KnopfLink>
		</Zustand>
	);
};

export const NICHT_GEFUNDEN = 'Nicht gefunden';

/**
 * Ein Material, das es nicht (mehr) gibt: überall dasselbe Bild, ob Ansicht, Editor, Präsentation oder Druck (187-04).
 * Wer selbst `useTitel` ruft, gibt dort `NICHT_GEFUNDEN` mit; sein Effekt liefe sonst nach diesem. Hinter einem
 * Teilen-Link gibt es kein „mein Material“ (`geteilt`).
 */
export const MaterialFehlt = ({ fehler, geteilt }: { fehler?: ApiFehler | null; geteilt?: boolean }) => {
	useTitel(NICHT_GEFUNDEN);
	return (
		<Zustand symbol="suche" titel="Dieses Material gibt es nicht mehr">
			<p className="text-leise">
				{fehler && fehler.status !== 404 ? fehler.message : 'Vielleicht wurde es gelöscht.'}
			</p>
			{!geteilt && <KnopfLink to="/">Zu meinem Material</KnopfLink>}
		</Zustand>
	);
};
