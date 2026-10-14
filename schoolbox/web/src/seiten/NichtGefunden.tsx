import { KnopfLink } from '../bausteine/Knopf';
import { Zustand } from '../bausteine/Zustand';
import { useTitel } from '../lib/titel';

export const NichtGefunden = () => {
	useTitel('Nicht gefunden');
	return (
		<Zustand symbol="suche" titel="Diese Seite gibt es nicht">
			<p className="text-leise">Vielleicht ist der Link alt oder es hat sich ein Tippfehler eingeschlichen.</p>
			<KnopfLink to="/">Zu meinen Mappen</KnopfLink>
		</Zustand>
	);
};
