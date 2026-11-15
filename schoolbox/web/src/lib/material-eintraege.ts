import type { PalettenEintrag } from '../editor/palette-suche';
import { ortName, pfadVon } from '../ordner/objekte';
import type { AblageStand } from '../ordner/typen';
import { ART_NAME, FACH_NAME, klasseName } from './text';

/**
 * Jedes Material der Ablage als Zeile in ⌘K: in der Ablage und im Editor dieselben Treffer (S-17). `ohne` lässt das
 * gerade offene Material weg.
 */
export const materialEintraege = (
	stand: AblageStand | null,
	oeffne: (pfad: string) => void,
	gruppe: string,
	ohne?: { mappe: string; dok: string },
): PalettenEintrag[] =>
	(stand?.dokumente ?? []).flatMap((d): PalettenEintrag[] => {
		if (ohne && d.mappe === ohne.mappe && d.id === ohne.dok) {
			return [];
		}
		// Gesucht wird in den Ordnernamen ohne „Mein Material“, sonst passte „Material“ auf alles (188-38).
		const ordnerNamen = stand ? pfadVon(stand, d.ordner).map((o) => o.name) : [];
		return [
			{
				id: `dokument:${d.mappe}/${d.id}`,
				titel: d.meta.titel,
				gruppe,
				symbol: 'blatt',
				notiz: stand ? ortName(stand, d.ordner) : '',
				suchwoerter: [
					FACH_NAME[d.fach],
					klasseName(d.klasse),
					...ordnerNamen,
					ART_NAME[d.meta.art] ?? d.meta.art,
				],
				aus: () => oeffne(`/m/${d.mappe}/${d.id}`),
			},
		];
	});
