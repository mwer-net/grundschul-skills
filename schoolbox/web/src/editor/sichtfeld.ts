import { useEffect, useState } from 'react';

/** Der sichtbare Teil der Leinwand, gemessen ab der Ecke von `data-innen`: Dort liegen alle Einblendungen. */
export const sichtfeldVon = (doc: Document) => {
	const rahmen = doc.defaultView?.frameElement;
	const innen = rahmen?.closest('[data-innen]');
	const sicht = rahmen?.closest('main');
	if (!innen || !sicht) {
		return null;
	}
	const a = innen.getBoundingClientRect();
	const b = sicht.getBoundingClientRect();
	return {
		oben: b.top - a.top,
		unten: b.bottom - a.top,
		links: Math.max(0, b.left - a.left),
		rechts: Math.min(a.width, b.right - a.left),
	};
};

/** Rollen und Größenänderung kommen nicht aus dem `iframe`: Hier läuft das Nachführen. */
export const useSichtfeld = (doc: Document) => {
	const [, setStand] = useState(0);
	useEffect(() => {
		const sicht = doc.defaultView?.frameElement?.closest('main');
		const neu = () => setStand((n) => n + 1);
		sicht?.addEventListener('scroll', neu, { passive: true });
		window.addEventListener('resize', neu);
		return () => {
			sicht?.removeEventListener('scroll', neu);
			window.removeEventListener('resize', neu);
		};
	}, [doc]);
	return sichtfeldVon(doc);
};
