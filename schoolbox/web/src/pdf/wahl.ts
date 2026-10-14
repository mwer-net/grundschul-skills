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

export const mappenWahl = (zugang: Zugang, dokumente: Pick<DokumentEintrag, 'meta'>[]): PdfWahl[] => {
	const ohne = { titel: 'Ohne Lösungen', vorbereiten: () => bereiteMappeVor(zugang, 'alles') };
	if (!dokumente.some((d) => d.meta.hatLoesung)) {
		return [ohne];
	}
	return [ohne, { titel: 'Mit Lösungen am Ende', vorbereiten: () => bereiteMappeVor(zugang, 'alles-mit-loesungen') }];
};
