import { useEffect } from 'react';

/** Titel des Fensters bzw. Tabs: „Kartoffeln – Schoolbox“. */
export const useTitel = (titel?: string | null) => {
	useEffect(() => {
		document.title = titel ? `${titel} – Schoolbox` : 'Schoolbox';
	}, [titel]);
};
