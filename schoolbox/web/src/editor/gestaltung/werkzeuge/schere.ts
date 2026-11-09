import type { Werkzeug } from './typ';

/** Die Id der Formen-Schere; `Werkzeugflaeche.tsx` zeigt für sie die Bereiche (`schere-anzeige.tsx`). */
export const SCHERE = 'schere';

/**
 * Formen-Schere ⇧M (121, Briefing 3-formen): wirkt auf die gewählten Formen, nicht auf eine neue. Den Zug über die
 * Bereiche nimmt `schere-anzeige.tsx` entgegen; der Strich des Werkzeugs selbst legt nichts ab.
 */
export const werkzeug: Werkzeug | null = {
	id: SCHERE,
	titel: 'Formen-Schere',
	symbol: 'formenschere',
	taste: { code: 'KeyM', umschalt: true },
	zeiger: 'crosshair',
	bereit: (k) => k.frei,
	beginne: () => undefined,
	bewege: () => null,
	ende: () => null,
};
