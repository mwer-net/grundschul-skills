import { setzeAus } from '@schoolbox/kern/src/gestaltung';
import { useEffect, useState } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { elementZu, nrVon } from './darstellung';
import type { Struktur } from './struktur';

/**
 * Die Auswahl ist ausgeblendet (`data-aus`, F10), etwa nach einem Klick auf die Meldung `ausgeblendet` (096). Ohne
 * Hinweis sähe es aus, als wäre nichts gewählt. Eingeblendet wird das ausgeblendete Element, auch wenn die Auswahl
 * darin liegt. Einen eigenen Abschnitt im Inspektor baut 099.
 */
export const AusgeblendetHinweis = ({
	doc,
	nr,
	quelle,
	struktur,
}: {
	doc: Document | null;
	nr: number;
	quelle: string | null;
	struktur: Struktur;
}) => {
	const [aus, setAus] = useState<number | null>(null);
	useEffect(() => {
		const element = doc ? elementZu(doc, nr)?.closest('[data-aus]') : null;
		setAus(element ? nrVon(element) : null);
	}, [doc, nr, quelle]);
	if (aus === null) {
		return null;
	}
	return (
		<div className="flex flex-col items-start gap-1.5" data-hinweis="ausgeblendet">
			<p className="text-sm text-leise">Ausgeblendet. Es wird nicht gedruckt.</p>
			<Knopf
				art="zweit"
				groesse="klein"
				disabled={!struktur.aktiv}
				onClick={() => struktur.aendereAttribute('Eingeblendet', (q) => setzeAus(q, aus, false))}
			>
				Einblenden
			</Knopf>
		</div>
	);
};
