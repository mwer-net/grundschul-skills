/**
 * Baustein-Katalog (043): was sich einfügen lässt. Setzt die Liste aus `ABBILDUNG_SCHEMA` und `KIT_KATALOG` zusammen und
 * enthält selbst nur die Rezepte (Entscheidung 27): Ein neues Element bleibt ein Eintrag an einem Ort. Ohne Node-Abhängigkeit,
 * die Oberfläche liest ihn auch. Das Starter-HTML liest `katalog-starter.ts` aus den Mustern.
 */

import type { AbbildungSchema, KatalogAngaben } from './abbildungen';
import { ABBILDUNG_SCHEMA } from './abbildungen';
import { BAUSTEINE, KIT_KATALOG } from './bausteine';

export interface KatalogEintrag extends KatalogAngaben {
	id: string;
	name: string;
	herkunft: 'abbildung' | 'kit' | 'rezept';
	/** Kennung `data-katalog` im Muster; fehlt, wenn der Eintrag nur eine Klasse setzt. */
	starter?: string;
	klasse?: string;
	/** Nur Rezepte: Starter, die zusammen eine Aufgabe ergeben, und die Anweisung. */
	teile?: readonly string[];
	anweisung?: string;
}

const REZEPTE: readonly Omit<KatalogEintrag, 'herkunft'>[] = [
	{
		id: 'rezept-zahlenstrahl',
		name: 'Rechenaufgabe mit Zahlenstrahl',
		kategorie: 'Rechnen',
		suchbegriffe: ['Zahlengerade', 'Plusaufgabe', 'Sprünge'],
		ort: 'seite',
		faecher: ['mathematik'],
		teile: ['aufgabe', 'x-zahlenstrahl', 'antwort'],
		anweisung: 'Rechne. Zeichne die Sprünge ein.',
	},
	{
		id: 'rezept-uhr',
		name: 'Uhrzeit ablesen',
		kategorie: 'Größen',
		suchbegriffe: ['Uhr', 'Zeit', 'lesen'],
		ort: 'seite',
		faecher: ['mathematik'],
		teile: ['aufgabe', 'x-uhr', 'antwort'],
		anweisung: 'Lies ab. Schreibe die Uhrzeit auf.',
	},
	{
		id: 'rezept-zahlenmauer',
		name: 'Zahlenmauer rechnen',
		kategorie: 'Rechnen',
		suchbegriffe: ['Rechenmauer', 'Pyramide'],
		ort: 'seite',
		faecher: ['mathematik'],
		teile: ['aufgabe', 'x-zahlenmauer'],
		anweisung: 'Fülle die Zahlenmauer aus.',
	},
	{
		id: 'rezept-diagramm',
		name: 'Diagramm auswerten',
		kategorie: 'Daten und Zufall',
		suchbegriffe: ['Säulendiagramm', 'Schaubild', 'Statistik'],
		ort: 'seite',
		faecher: ['mathematik'],
		teile: ['aufgabe', 'x-diagramm', 'schreiblinie'],
		anweisung: 'Lies im Diagramm ab und antworte.',
	},
	{
		id: 'rezept-silben',
		name: 'Wörter in Silben lesen',
		kategorie: 'Sprache',
		suchbegriffe: ['Silbenbögen', 'Lesen lernen'],
		ort: 'seite',
		faecher: ['deutsch'],
		teile: ['aufgabe', 'x-silben'],
		anweisung: 'Lies das Wort. Klatsche die Silben.',
	},
	{
		id: 'rezept-schreiben',
		name: 'Frage mit Schreiblinie',
		kategorie: 'Aufgabe und Text',
		suchbegriffe: ['Freitext', 'Antwort schreiben'],
		ort: 'seite',
		teile: ['aufgabe', 'schreiblinie'],
		anweisung: 'Schreibe deine Antwort auf.',
	},
];

const nameImRegister = (art: string) => BAUSTEINE.find((b) => b.art === art)?.name;

/** Die ganze Liste. Jedes Element aus dem Schema steht mit Name und Angaben aus seinem Schema-Eintrag darin. */
export const KATALOG: readonly KatalogEintrag[] = [
	...KIT_KATALOG.map(({ art, id, klasse, name, ...angaben }): KatalogEintrag => {
		const anzeige = name ?? (art === undefined ? undefined : nameImRegister(art));
		if (anzeige === undefined) {
			throw new Error(`Kit-Baustein ${id} hat keinen Namen.`);
		}
		return { ...angaben, id, name: anzeige, herkunft: 'kit', ...(klasse ? { klasse } : { starter: id }) };
	}),
	...(Object.entries(ABBILDUNG_SCHEMA) as [string, AbbildungSchema][]).flatMap(([tag, { katalog, name }]) =>
		katalog ? [{ ...katalog, id: tag, name, herkunft: 'abbildung' as const, starter: tag }] : [],
	),
	...REZEPTE.map((r): KatalogEintrag => ({ ...r, herkunft: 'rezept' })),
];

const klein = (t: string) => t.toLocaleLowerCase('de');

/** Sucht über Name und Suchbegriffe, Name zuerst. Mehrere Wörter müssen alle passen. */
export const sucheImKatalog = (anfrage: string, eintraege: readonly KatalogEintrag[] = KATALOG) => {
	const woerter = klein(anfrage).split(/\s+/).filter(Boolean);
	if (woerter.length === 0) {
		return [...eintraege];
	}
	const treffer = eintraege.filter((e) => {
		const text = klein([e.name, ...e.suchbegriffe].join(' '));
		return woerter.every((w) => text.includes(w));
	});
	const imNamen = (e: KatalogEintrag) => woerter.every((w) => klein(e.name).includes(w));
	return [...treffer.filter(imNamen), ...treffer.filter((e) => !imNamen(e))];
};
