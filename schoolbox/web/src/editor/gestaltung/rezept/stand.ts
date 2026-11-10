import { useEffect, useState } from 'react';

/** `/ansicht/<mappe>/dokumente/<dok>/` aus der `<base>` des Blatts. */
export const ansichtVon = (doc: Document | null) => {
	if (!doc) {
		return null;
	}
	const pfad = new URL(doc.baseURI).pathname;
	return /^\/ansicht\/[^/]+\/dokumente\/[^/]+\/$/.test(pfad) ? pfad : null;
};

/**
 * Zählt hoch, wenn sich die Quelle geändert hat und das Speichern durch ist: Die Vorschau liest die gespeicherte Datei
 * (Falle „Vorschaubilder und ungespeicherter Stand“).
 */
export const useGespeicherterStand = (quelle: string, verzoegerung: number) => {
	const [stand, setStand] = useState(0);
	useEffect(() => {
		const t = setTimeout(() => setStand((n) => n + 1), verzoegerung);
		return () => clearTimeout(t);
	}, [quelle, verzoegerung]);
	return stand;
};
