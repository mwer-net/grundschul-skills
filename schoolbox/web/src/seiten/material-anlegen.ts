import type { Antworten } from '@schoolbox/kern/src/assistent';
import type { Art, Fach, Format, Klasse } from '@schoolbox/kern/src/werte';

import { meldung, sende } from '../api';
import { melde } from '../ereignisse';

interface NeuesMaterial {
	/** `null`: „Mein Material“. */
	ordner: string | null;
	titel: string;
	art: Art;
	format: Format;
	/** Nur nötig, wenn der Ordner keinen Behälter hat; sonst gilt dessen Fach und Klasse. */
	fach: Fach;
	klasse: Klasse;
	vorlage?: string | null;
	zusatz?: Record<string, boolean | undefined>;
	/** Aus dem Assistenten (132): Claude bekommt den Auftrag, den der Server aus den Antworten baut. */
	assistent?: { antworten: Antworten; auftragText: string | null } | null;
	/** Aus der Karte im Chat (077), bis 136: ein freier Wunsch. */
	wunsch?: string | null;
	/** Aus dem Chat: Der Entwurf ist die erste Nachricht dieses Gesprächs (087). */
	gespraechId?: string | undefined;
}

/** Legt das Dokument an und startet, falls gewünscht, Claude. Das Ergebnis sagt, wohin es danach geht. */
export const legeMaterialAn = async ({
	art,
	assistent,
	fach,
	format,
	gespraechId,
	klasse,
	ordner,
	titel,
	vorlage,
	wunsch,
	zusatz,
}: NeuesMaterial) => {
	const { id, mappe } = await sende<{ id: string; mappe: string }>('/api/ordner/material', {
		ordner,
		titel,
		art,
		format,
		fach,
		klasse,
		...(vorlage ? { vorlage } : {}),
		zusatz: zusatz ?? {},
	});
	melde({ typ: 'mappe-neu', mappe });
	if (!assistent && !wunsch) {
		return { mappe, id, ziel: `/m/${mappe}/${id}/bearbeiten?neu=1`, state: null };
	}
	const eingabe = assistent
		? {
				antworten: assistent.antworten,
				...(assistent.auftragText === null ? {} : { auftragText: assistent.auftragText }),
			}
		: { auftrag: wunsch };
	// Das Blatt steht schon: Startet Claude nicht, geht es leer weiter, mit der Meldung im Editor.
	const state = await sende<{ auftrag: { id: string } }>(`/api/dokumente/${mappe}/${id}/ki`, {
		aktion: 'neu-entwurf',
		...eingabe,
		...(gespraechId ? { gespraechId } : {}),
	}).then(
		({ auftrag }) => ({ kiAuftrag: auftrag.id }),
		(grund: unknown) => ({ kiFehler: meldung(grund) }),
	);
	return { mappe, id, ziel: `/m/${mappe}/${id}/bearbeiten?claude=1`, state };
};
