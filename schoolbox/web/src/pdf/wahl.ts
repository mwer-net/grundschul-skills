import { ART_NAME } from '../lib/text';
import type { Zugang } from '../lib/zugang';
import { bereiteDokumentVor, bereiteMappeVor } from '../lib/zugang';
import type { DokumentEintrag } from '../typen';
import type { PdfWahl } from './PdfKnopf';

/** Wie das Material heißt: „Arbeitsblatt“, „Lesetext“ …, bei „sonstiges“ schlicht „Material“. */
export const materialName = ({ meta }: Pick<DokumentEintrag, 'meta'>) =>
	meta.art === 'sonstiges' ? 'Material' : ART_NAME[meta.art];

/** Ohne Lösung gibt es nur das Material selbst, sonst auch die Lösung allein und beides in einer Datei. */
export const dokumentWahl = (zugang: Zugang, dokument: Pick<DokumentEintrag, 'id' | 'meta'>): PdfWahl[] => {
	const name = materialName(dokument);
	const material = { titel: name, vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'arbeitsblatt') };
	if (!dokument.meta.hatLoesung) {
		return [material];
	}
	return [
		material,
		{ titel: 'Lösung', vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'loesung') },
		{ titel: `${name} und Lösung`, vorbereiten: () => bereiteDokumentVor(zugang, dokument.id, 'beides') },
	];
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

export const mappenWahl = (zugang: Zugang, dokumente: Pick<DokumentEintrag, 'meta'>[]): PdfWahl[] => {
	const ohne = { titel: 'Ohne Lösungen', vorbereiten: () => bereiteMappeVor(zugang, 'alles') };
	if (!dokumente.some((d) => d.meta.hatLoesung)) {
		return [ohne];
	}
	return [ohne, { titel: 'Mit Lösungen am Ende', vorbereiten: () => bereiteMappeVor(zugang, 'alles-mit-loesungen') }];
};
