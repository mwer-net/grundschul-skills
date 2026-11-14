import { Navigate, useParams } from 'react-router-dom';

import { MaterialFehlt } from '../seiten/NichtGefunden';
import { useAblage } from './kontext';

/**
 * `/m/<mappe>` (auch aus `schoolbox link`) führt zum Ordner, der aus der Mappe entstand. Gibt es ihn nicht, sagt die
 * Seite das, statt wortlos zur Ablage zu springen (187-04).
 */
export const MappeWeiter = () => {
	const { mappe } = useParams();
	const { fehler, stand } = useAblage();
	if (!stand) {
		return fehler ? <Navigate to="/" replace /> : null;
	}
	const ordner = stand.ordner.find((o) => o.behaelter === mappe);
	return ordner ? <Navigate to={`/o/${ordner.id}`} replace /> : <MaterialFehlt />;
};
