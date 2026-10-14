/** Eine Meldung aus dem Prüfbericht von blatt.py (`pruefung.js`). */
export interface Meldung {
	stufe: 'FEHLER' | 'WARNUNG' | 'HINWEIS';
	seite: number;
	text: string;
}

const LOESUNG = 'Lösungsblatt: ';
/** `kurz()` in pruefung.js schneidet nach 40 Zeichen ab. */
const KURZ_MAX = 40;

const zitat = (text: string) => `„${text.length >= KURZ_MAX ? `${text}…` : text}“`;

type Regel = [RegExp, (...teile: string[]) => string];

/** Von speziell nach allgemein; die erste passende Regel gewinnt. */
const REGELN: Regel[] = [
	[
		/^„(.*)“ ragt aus der Seite/,
		(a = '') => `${zitat(a)} ragt über das Blatt hinaus und wird beim Drucken abgeschnitten.`,
	],
	[
		/^„(.*)“ ragt in den Seitenrand/,
		(a = '') => `${zitat(a)} ragt in den Rand und wird beim Drucken vielleicht abgeschnitten.`,
	],
	[/^„(.*)“ ist abgeschnitten/, (a = '') => `Von ${zitat(a)} ist ein Teil nicht zu sehen.`],
	[/^„(.*)“ überlappt „(.*)“/, (a = '', b = '') => `${zitat(a)} und ${zitat(b)} liegen übereinander.`],
	[/^Bild fehlt/, () => 'Ein Bild fehlt.'],
	[/^Schrift (\S+) nicht geladen/, (s = '') => `Die Schrift ${s} fehlt, das Blatt sieht dadurch anders aus.`],
	[
		/^(Prüfskript|Prüfung lief nicht durch)/,
		() => 'Die automatische Prüfung ist nicht durchgelaufen. Bitte das PDF genau ansehen.',
	],
];

/**
 * Übersetzt eine Prüfmeldung in einen Satz für die Lehrkraft, z. B. „„Kreuze an …“ ragt in den Seitenrand (12 px)
 * → kürzen, …“ zu „Seite 1: „Kreuze an …“ ragt in den Rand und wird beim Drucken vielleicht abgeschnitten.“
 * Unbekannte Meldungen bleiben stehen, nur ohne den Tipp für Claude nach dem Pfeil.
 */
export const verstaendlich = ({ seite, text }: Meldung): string => {
	const imLoesungsblatt = text.startsWith(LOESUNG);
	const kern = imLoesungsblatt ? text.slice(LOESUNG.length) : text;
	let satz = kern.replace(/\s*→.*$/s, '').trim();
	for (const [muster, uebersetze] of REGELN) {
		const treffer = muster.exec(kern);
		if (treffer) {
			satz = uebersetze(...treffer.slice(1));
			break;
		}
	}
	const ort = [imLoesungsblatt ? 'Im Lösungsblatt' : '', seite > 0 ? `Seite ${seite}` : ''].filter(Boolean);
	return ort.length > 0 ? `${ort.join(', ')}: ${satz}` : satz;
};
