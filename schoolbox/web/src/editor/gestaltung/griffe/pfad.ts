import { nrVon } from '../../darstellung';
import { istPfad, pfadModus } from '../pfad-modus';
import type { ZusatzGriff } from './typ';

/**
 * 116: Im Modus „Punkte bearbeiten“ ersetzt der Pfad seinen Rahmen (wie die Linie, 107): keine Ecken, Kanten, kein
 * Drehgriff. Die Punkte selbst zeichnet `pfad-punkte.tsx`, weil ihre Zahl wechselt; dieser Griff zeigt sich nie.
 */
export const PFAD_GRIFFE: ZusatzGriff[] = [
	{
		id: 'pfad-punkte',
		name: 'Punkte des Pfads',
		ersetztRahmen: true,
		fuer: (art, element) => art === 'form' && istPfad(element) && pfadModus().nr === nrVon(element),
		wo: () => null,
		zeige: () => undefined,
		schreibe: () => undefined,
	},
];
