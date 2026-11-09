import type { MenueEintrag } from '../../../bausteine/Menue';
import type { Befehl } from '../../befehle';
import { menueAusBefehlen } from '../../befehle';
import type { Befehle } from '../../useBefehle';

/**
 * ⋯ der Leiste am Element (Briefing 5.7): alle Befehle mit Ort `'gestaltung'`, in dieser Reihenfolge, je Zeile ein
 * Block im Menü. Die Ids späterer Tickets stehen schon hier; es erscheint nur, was registriert und verfügbar ist. Wer
 * einen Befehl mit Ort `'gestaltung'` einträgt, der hier fehlt, landet im Block vor „Claude fragen“.
 */
export const MEHR_REIHENFOLGE: readonly (readonly string[])[] = [
	['auswahl.duplizieren', 'auswahl.kopieren', 'auswahl.loeschen'],
	// 100
	['auswahl.nach-vorne', 'auswahl.ganz-vorne', 'auswahl.nach-hinten', 'auswahl.ganz-hinten'],
	// 113
	[
		'auswahl.ausrichten-links',
		'auswahl.ausrichten-mitte',
		'auswahl.ausrichten-rechts',
		'auswahl.ausrichten-oben',
		'auswahl.ausrichten-mittig',
		'auswahl.ausrichten-unten',
		'auswahl.verteilen-waagerecht',
		'auswahl.verteilen-senkrecht',
	],
	// 101
	['auswahl.sperren', 'auswahl.ausblenden'],
	// 106
	['auswahl.anhaengen', 'auswahl.loesen'],
	// 115
	['auswahl.in-stapel'],
	[],
	['auswahl.claude'],
];

/** Der Block für Unbekanntes: der leere vor „Claude fragen“. */
const WEITERE = MEHR_REIHENFOLGE.findIndex((block) => block.length === 0);

const platz = (id: string) => {
	for (const [block, ids] of MEHR_REIHENFOLGE.entries()) {
		const i = ids.indexOf(id);
		if (i !== -1) {
			return { block, i };
		}
	}
	return { block: WEITERE, i: 0 };
};

/** Sortiert nach `MEHR_REIHENFOLGE`; Unbekanntes behält seine Reihenfolge aus dem Register. */
export const ordneMehr = (liste: readonly Befehl[]) =>
	liste
		.map((befehl, n) => ({ befehl, n, ...platz(befehl.id) }))
		.sort((a, b) => a.block - b.block || a.i - b.i || a.n - b.n);

/** Die Einträge des ⋯; Trennlinien zwischen den Blöcken. */
export const mehrEintraege = (befehle: Befehle): MenueEintrag[] => {
	const k = befehle.jetzt.current;
	return ordneMehr(befehle.fuer('gestaltung')).flatMap(({ befehl, block }) =>
		menueAusBefehlen([befehl], k, befehle.fuehreAus).map((e) => ({ ...e, gruppe: `gestaltung-${block}` })),
	);
};
