import type { Art, Fach, Format, Klasse } from '@schoolbox/kern/src/werte';

import { meldung, sende } from '../api';
import { melde } from '../ereignisse';

export const legeMappeAn = async (daten: { titel: string; fach: Fach; klasse: Klasse }) => {
	const { mappe } = await sende<{ mappe: { id: string } }>('/api/mappen', daten);
	melde({ typ: 'mappe-neu', mappe: mappe.id });
	return mappe.id;
};

interface NeuesMaterial {
	mappe: string;
	titel: string;
	art: Art;
	format: Format;
	vorlage?: string | null;
	zusatz?: Record<string, boolean | undefined>;
	/** Mit Text startet Claude gleich den Entwurf. */
	wunsch?: string | null;
}

/** Legt das Dokument an und startet, falls gewünscht, Claude. Das Ergebnis sagt, wohin es danach geht. */
export const legeMaterialAn = async ({ art, format, mappe, titel, vorlage, wunsch, zusatz }: NeuesMaterial) => {
	const { id } = await sende<{ id: string }>(`/api/mappen/${mappe}/dokumente`, {
		titel,
		art,
		format,
		...(vorlage ? { vorlage } : {}),
		zusatz: zusatz ?? {},
	});
	melde({ typ: 'mappe-neu', mappe });
	if (!wunsch) {
		return { id, ziel: `/m/${mappe}/${id}/bearbeiten?neu=1`, state: null };
	}
	// Das Blatt steht schon: Startet Claude nicht, geht es leer weiter, mit der Meldung im Editor.
	const state = await sende<{ auftrag: { id: string } }>(`/api/dokumente/${mappe}/${id}/ki`, {
		aktion: 'neu-entwurf',
		auftrag: wunsch,
	}).then(
		({ auftrag }) => ({ kiAuftrag: auftrag.id }),
		(grund: unknown) => ({ kiFehler: meldung(grund) }),
	);
	return { id, ziel: `/m/${mappe}/${id}/bearbeiten?claude=1`, state };
};
