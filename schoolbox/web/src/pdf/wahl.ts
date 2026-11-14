import type { MappenVariante } from '@schoolbox/kern/src/namen';
import type { Druckprofil } from '@schoolbox/kern/src/werte';

import { sende } from '../api';
import { ART_NAME } from '../lib/text';
import type { Zugang } from '../lib/zugang';
import { bereiteDokumentVor, bereiteMappeVor } from '../lib/zugang';
import type { DokumentEintrag, PdfAntwort } from '../typen';
import type { PdfWahl } from './PdfKnopf';

/** Wie das Material heißt: „Arbeitsblatt“, „Lesetext“ …, bei „sonstiges“ schlicht „Material“. */
export const materialName = ({ meta }: Pick<DokumentEintrag, 'meta'>) =>
	meta.art === 'sonstiges' ? 'Material' : ART_NAME[meta.art];

const PROFILE_NAME: Record<Druckprofil, string> = { farbe: 'in Farbe', sw: 'in s/w' };

/** iPadOS meldet sich in Safari als Mac; verraten wird es durch den Touchscreen. */
const istIpad = () =>
	/iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * Folien haben keinen Umschalter „Farbe | s/w“: s/w steht deshalb im Menü. Oben, was auf Papier geht, darunter, was
 * ohne Internet zeigt (191-40, 192-17). Die Datei für Safari läuft am iPad nicht und fehlt dort.
 */
const folienWahl = (zugang: Zugang, dokument: Pick<DokumentEintrag, 'id'>): PdfWahl[] => [
	{
		titel: 'Folien zum Drucken',
		gruppe: 'drucken',
		vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'arbeitsblatt', 'farbe'),
	},
	{
		titel: 'Folien zum Drucken (in s/w)',
		gruppe: 'drucken',
		vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'arbeitsblatt', 'sw'),
	},
	{
		titel: 'Folien mit Notizen',
		hinweis: 'Zum Ausdrucken: jede Folie klein, daneben deine Notizen und die Schritte.',
		gruppe: 'drucken',
		vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'notizen'),
	},
	{
		titel: 'Ohne Internet: fürs iPad',
		hinweis: 'In der Dateien-App öffnen und blättern. Jeder Schritt ist eine eigene Seite.',
		gruppe: 'zeigen',
		vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'schritte'),
	},
	...(istIpad()
		? []
		: [
				{
					titel: 'Ohne Internet: für den Mac',
					hinweis: 'Die Datei aus den Downloads in Safari öffnen, dann geht alles wie hier.',
					gruppe: 'zeigen',
					vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'praesentation'),
				},
			]),
];

/**
 * Das eine PDF-Menü für ein Material (191-40), überall gleich: Ansicht, Editor, Kachel, Ablage, geteilte Ansicht.
 * Die Farbfassung wählt der Umschalter „Farbe | s/w“ bzw. das für das Material gemerkte Druckprofil (`profil`); das
 * Menü fragt nicht noch einmal. Ohne Lösung gibt es eine Datei, dann lädt der Knopf sofort (191-41).
 */
export const dokumentWahl = (
	zugang: Zugang,
	dokument: Pick<DokumentEintrag, 'id' | 'meta'>,
	profil?: Druckprofil,
): PdfWahl[] => {
	if (dokument.meta.format === 'folie') {
		return folienWahl(zugang, dokument);
	}
	const name = materialName(dokument);
	const eintrag = (titel: string, variante: 'arbeitsblatt' | 'loesung' | 'beides'): PdfWahl => ({
		titel,
		vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, variante, profil),
	});
	return [
		eintrag(name, 'arbeitsblatt'),
		...(dokument.meta.hatLoesung
			? [eintrag('Lösung', 'loesung'), eintrag(`${name} mit Lösung`, 'beides')]
			: []),
	];
};

/** Ohne Lösungen im Ordner nur „In Farbe“ und „In s/w“; sonst je Farbfassung mit und ohne Lösungen, getrennt durch eine Linie. */
const stapelTitel = (mitLoesungen: boolean, variante: MappenVariante, profil: Druckprofil) => {
	if (!mitLoesungen) {
		return profil === 'farbe' ? 'In Farbe' : 'In s/w';
	}
	return `${variante === 'alles' ? 'Ohne Lösungen' : 'Mit Lösungen am Ende'}, ${PROFILE_NAME[profil]}`;
};

const stapelWahl = (
	mitLoesungen: boolean,
	vorbereiten: (variante: MappenVariante, profil: Druckprofil) => Promise<PdfAntwort>,
): PdfWahl[] =>
	(['farbe', 'sw'] as const).flatMap((profil) =>
		(mitLoesungen ? (['alles', 'alles-mit-loesungen'] as const) : (['alles'] as const)).map((variante) => ({
			titel: stapelTitel(mitLoesungen, variante, profil),
			gruppe: profil,
			vorbereiten: () => vorbereiten(variante, profil),
		})),
	);

/**
 * „PDF“ eines geteilten Ordners: Die Wahl gilt für alle Dokumente darin (042). `ordner`: der gezeigte Unterordner
 * samt seinen Unterordnern; ohne ihn der ganze Link (191-01).
 */
export const mappenWahl = (
	zugang: Zugang,
	dokumente: Pick<DokumentEintrag, 'meta'>[],
	ordner?: string,
): PdfWahl[] =>
	stapelWahl(
		dokumente.some((d) => d.meta.hatLoesung),
		(variante, profil) => bereiteMappeVor(zugang, variante, profil, ordner),
	);

/** Ordner und mehrere Objekte: dieselbe Wahl wie bei einer Mappe, in der sichtbaren Reihenfolge. */
export const sammlungWahl = (
	dokumente: readonly (Pick<DokumentEintrag, 'id' | 'meta'> & { mappe: string })[],
	name: string,
): PdfWahl[] => {
	const teile = dokumente.map((d) => ({ mappe: d.mappe, dok: d.id }));
	return stapelWahl(
		dokumente.some((d) => d.meta.hatLoesung),
		(variante, profil) => sende<PdfAntwort>('/api/ordner/pdf', { teile, name, variante, profil }),
	);
};
