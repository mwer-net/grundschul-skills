import type { PdfVariante } from '@schoolbox/kern/src/namen';
import type { Druckprofil } from '@schoolbox/kern/src/werte';

import { ART_NAME } from '../lib/text';
import type { Zugang } from '../lib/zugang';
import { bereiteDokumentVor, bereiteMappeVor } from '../lib/zugang';
import type { DokumentEintrag } from '../typen';
import type { PdfWahl } from './PdfKnopf';

/** Wie das Material heißt: „Arbeitsblatt“, „Lesetext“ …, bei „sonstiges“ schlicht „Material“. */
export const materialName = ({ meta }: Pick<DokumentEintrag, 'meta'>) =>
	meta.art === 'sonstiges' ? 'Material' : ART_NAME[meta.art];

/** Die aktuelle Ansicht steht vorn; die andere ist direkt wählbar (042). */
const PROFILE_NAME: Record<Druckprofil, string> = { farbe: 'in Farbe', sw: 'in s/w' };
const andere = (profil: Druckprofil): Druckprofil => (profil === 'sw' ? 'farbe' : 'sw');

/** Ohne Lösung gibt es nur das Material selbst, sonst auch die Lösung allein und beides in einer Datei. */
export const dokumentWahl = (
	zugang: Zugang,
	dokument: Pick<DokumentEintrag, 'id' | 'meta'>,
	aktuell: Druckprofil = 'farbe',
): PdfWahl[] => {
	const name = materialName(dokument);
	const eintraege = (profil: Druckprofil, zusatz: string): PdfWahl[] => {
		const eintrag = (titel: string, variante: PdfVariante): PdfWahl => ({
			titel: `${titel}${zusatz}`,
			vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, variante, profil),
		});
		return [
			eintrag(name, 'arbeitsblatt'),
			...(dokument.meta.hatLoesung
				? [eintrag('Lösung', 'loesung'), eintrag(`${name} und Lösung`, 'beides')]
				: []),
		];
	};
	return [...eintraege(aktuell, ''), ...eintraege(andere(aktuell), ` (${PROFILE_NAME[andere(aktuell)]})`)];
};

/** iPadOS meldet sich in Safari als Mac; verraten wird es durch den Touchscreen. */
const istIpad = () =>
	/iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** Für Folien: präsentieren ohne Internet (iPad: PDF, Mac: eigenständige Datei) und die Notizen zum Ausdrucken. */
export const folienWahl = (zugang: Zugang, dokument: Pick<DokumentEintrag, 'id'>): PdfWahl[] => [
	{
		titel: 'PDF zum Präsentieren',
		hinweis: 'Fürs iPad: in der Dateien-App öffnen und blättern. Jeder Schritt ist eine eigene Seite.',
		vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'schritte'),
	},
	{
		titel: 'Offline-Präsentation',
		hinweis: istIpad()
			? 'Nur für den Mac, auf dem iPad läuft die Datei nicht. Nimm hier das PDF zum Präsentieren.'
			: 'Für den Mac: Die Datei aus den Downloads in Safari öffnen, dann geht alles wie hier.',
		vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'praesentation'),
	},
	{
		titel: 'Folien mit Notizen',
		hinweis: 'Zum Ausdrucken: jede Folie klein, daneben deine Notizen und die Schritte.',
		vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'notizen'),
	},
];

/** „Alles als PDF“: Die Wahl gilt für alle Dokumente der Mappe (042). */
export const mappenWahl = (zugang: Zugang, dokumente: Pick<DokumentEintrag, 'meta'>[]): PdfWahl[] => {
	const mitLoesungen = dokumente.some((d) => d.meta.hatLoesung);
	return (['farbe', 'sw'] as const).flatMap((profil) => [
		{
			titel: mitLoesungen ? `Ohne Lösungen, ${PROFILE_NAME[profil]}` : `Alles ${PROFILE_NAME[profil]}`,
			vorbereiten: () => bereiteMappeVor(zugang, 'alles', profil),
		},
		...(mitLoesungen
			? [
					{
						titel: `Mit Lösungen am Ende, ${PROFILE_NAME[profil]}`,
						vorbereiten: () => bereiteMappeVor(zugang, 'alles-mit-loesungen', profil),
					},
				]
			: []),
	]);
};
