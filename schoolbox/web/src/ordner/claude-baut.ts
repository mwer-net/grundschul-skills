import { useCallback, useEffect, useState } from 'react';

import { lade } from '../api';
import { useEreignisse } from '../ereignisse';

/** Welche Dokumente Claude gerade als neues Blatt baut (133), mit dem Beginn des Laufs. Schlüssel `mappe/dok`. */
export const useClaudeBaut = () => {
	const [laufend, setLaufend] = useState<ReadonlyMap<string, string | null>>(new Map());
	const neu = useCallback(() => {
		lade<{ entwuerfe: { mappe: string; dok: string; seit?: string }[] }>('/api/ki/entwuerfe').then(
			({ entwuerfe }) => setLaufend(new Map(entwuerfe.map((a) => [`${a.mappe}/${a.dok}`, a.seit ?? null]))),
			() => undefined,
		);
	}, []);
	useEffect(neu, [neu]);
	useEreignisse((e) => {
		if (e.typ === 'ki-stand' || e.typ === 'verbunden') {
			neu();
		}
	});
	return laufend;
};
