import type { Art, Fach, Klasse } from './werte';

/** Namen für Menschen. Ohne Node-Abhängigkeiten, damit auch die Oberfläche sie nutzen kann. */
export const FACH_NAME: Record<Fach, string> = {
	deutsch: 'Deutsch',
	mathematik: 'Mathematik',
	sachunterricht: 'Sachunterricht',
	englisch: 'Englisch',
	kunst: 'Kunst',
	musik: 'Musik',
	faecheruebergreifend: 'Fächerübergreifend',
};

export const ART_NAME: Record<Art, string> = {
	arbeitsblatt: 'Arbeitsblatt',
	klassenarbeit: 'Klassenarbeit',
	lernzielkontrolle: 'Lernzielkontrolle',
	lesetext: 'Lesetext',
	lernspiel: 'Lernspiel',
	karten: 'Karten',
	lernplakat: 'Lernplakat',
	praesentation: 'Präsentation',
	stationen: 'Stationen',
	unterrichtsplanung: 'Unterrichtsplanung',
	sonstiges: 'Sonstiges',
};

/** Kurz, wie auf dem Heftumschlag; fächerübergreifend lässt den Dateinamen ohne Fach. */
const FACH_KURZ: Record<Fach, string> = { ...FACH_NAME, mathematik: 'Mathe', faecheruebergreifend: '' };

export const PDF_VARIANTEN = ['arbeitsblatt', 'loesung', 'beides'] as const;
export type PdfVariante = (typeof PDF_VARIANTEN)[number];

/** Nur für Folien: zum Präsentieren ohne Internet und zum Ausdrucken der Notizen. */
export const FOLIEN_VARIANTEN = ['schritte', 'notizen', 'praesentation'] as const;
export type FolienVariante = (typeof FOLIEN_VARIANTEN)[number];

export const AUSGABE_VARIANTEN = [...PDF_VARIANTEN, ...FOLIEN_VARIANTEN] as const;
export type AusgabeVariante = PdfVariante | FolienVariante;

export const istFolienVariante = (variante: AusgabeVariante): variante is FolienVariante =>
	FOLIEN_VARIANTEN.some((v) => v === variante);

export const MAPPEN_VARIANTEN = ['alles', 'alles-mit-loesungen'] as const;
export type MappenVariante = (typeof MAPPEN_VARIANTEN)[number];

const VERBOTEN = /[/\\:*?"<>|\p{Cc}]/gu;
const MAX_TITEL = 120;

const sauber = (text: string) => text.replace(VERBOTEN, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITEL).trim();

const dateiname = (fach: Fach, klasse: Klasse, titel: string, zusatz: string, endung = 'pdf') => {
	const kopf = [klasse === 'gemischt' ? '' : `Kl${klasse}`, FACH_KURZ[fach], sauber(titel)].filter(Boolean).join(' ');
	return `${[kopf || 'Material', zusatz].filter(Boolean).join(' – ')}.${endung}`;
};

const ZUSATZ_LOESUNG: Record<Exclude<PdfVariante, 'arbeitsblatt'>, string> = {
	loesung: 'Lösung',
	beides: 'mit Lösung',
};

/** „Kl2 Mathe Uhrzeit ablesen – Arbeitsblatt.pdf“, „… – Lösung.pdf“, „… – Arbeitsblatt mit Lösung.pdf“. */
export const pdfDateiname = (
	mappe: { fach: Fach; klasse: Klasse },
	dokument: { titel: string; art: Art },
	variante: PdfVariante,
) => {
	const art = dokument.art === 'sonstiges' ? '' : ART_NAME[dokument.art];
	const zusatz = variante === 'arbeitsblatt' ? art : [art, ZUSATZ_LOESUNG[variante]].filter(Boolean).join(' ');
	return dateiname(mappe.fach, mappe.klasse, dokument.titel, variante === 'loesung' ? 'Lösung' : zusatz);
};

const FOLIEN_DATEINAME: Record<FolienVariante, { zusatz: string; endung: string }> = {
	schritte: { zusatz: 'Präsentation mit Schritten', endung: 'pdf' },
	notizen: { zusatz: 'Folien mit Notizen', endung: 'pdf' },
	praesentation: { zusatz: 'Präsentation', endung: 'html' },
};

/** Wie `pdfDateiname`, dazu „… – Präsentation mit Schritten.pdf“, „… – Folien mit Notizen.pdf“, „… – Präsentation.html“. */
export const ausgabeDateiname = (
	mappe: { fach: Fach; klasse: Klasse },
	dokument: { titel: string; art: Art },
	variante: AusgabeVariante,
) => {
	if (!istFolienVariante(variante)) {
		return pdfDateiname(mappe, dokument, variante);
	}
	const { endung, zusatz } = FOLIEN_DATEINAME[variante];
	return dateiname(mappe.fach, mappe.klasse, dokument.titel, zusatz, endung);
};

/** „Kl3 Sachunterricht Die Kartoffel – Alles.pdf“ bzw. „… – Alles mit Lösungen.pdf“. */
export const mappenPdfDateiname = (mappe: { titel: string; fach: Fach; klasse: Klasse }, variante: MappenVariante) =>
	dateiname(mappe.fach, mappe.klasse, mappe.titel, variante === 'alles' ? 'Alles' : 'Alles mit Lösungen');

/** Vorschau der ersten Seite eines Entwurfs, neben ihm in `entwuerfe/`: `B-s1.png`. */
export const entwurfVorschauDatei = (name: string) => `${name}-s1.png`;
