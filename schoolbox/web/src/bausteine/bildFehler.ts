import { useState } from 'react';

/** Ein Bild, das nicht lädt, zeigt den Platzhalter statt des Bruchbilds (188-12). Gilt je Adresse. */
export const useBildFehler = (src: string | null) => {
	const [kaputt, setKaputt] = useState<string | null>(null);
	return { fehlt: src === null || kaputt === src, onError: () => setKaputt(src) };
};
