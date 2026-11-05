import { Navigate, useParams } from 'react-router-dom';

import { useAblage } from './kontext';

/** `/m/<mappe>` (auch aus `schoolbox link`) führt zum Ordner, der aus der Mappe entstand. */
export const MappeWeiter = () => {
	const { mappe } = useParams();
	const { fehler, stand } = useAblage();
	if (!stand) {
		return fehler ? <Navigate to="/" replace /> : null;
	}
	const ordner = stand.ordner.find((o) => o.behaelter === mappe);
	return <Navigate to={ordner ? `/o/${ordner.id}` : '/'} replace />;
};
