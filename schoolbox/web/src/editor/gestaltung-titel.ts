import { formTitel } from '@schoolbox/kern/src/gestaltung-arten';

/**
 * Der Name eines Gestaltungselements, eine Quelle für Ebenen, Hover-Schild, Inspektor, Pfad und Leiste (196-15,
 * 205-03). `nameVon` ruft `titelDerGestaltung`; die Ebenen nehmen den Namen aus `nameVon`.
 */

const TEXT_TITEL_LAENGE = 80;

/** Der sichtbare Text, Leerraum zusammengezogen. */
export const gestaltungsText = (element: Element) =>
	(element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, TEXT_TITEL_LAENGE);

/** Teile einer Streuung oder Gruppe. */
export const teileVon = (element: Element, art: string) => {
	if (art === 'gruppe') {
		return element.querySelectorAll(':scope > [data-lage]').length;
	}
	return [...element.querySelectorAll('*')].filter((e) => e.children.length === 0 && !e.closest('defs')).length;
};

const SCHMUCK_LAENGE = 40;

const kuerze = (text: string) => (text.length > SCHMUCK_LAENGE ? `${text.slice(0, SCHMUCK_LAENGE - 1)}…` : text);

export interface GestaltungAngaben {
	/** Art im Register, z. B. `bildfrei`. */
	art: string;
	/** Der Name wie im Pfad (`nameVon`): `data-name`, Figur oder Name der Art. */
	name: string;
	wert: (attribut: string) => string | null;
	/** Der sichtbare Text, Leerraum zusammengezogen. */
	text: string;
	/** Teile einer Streuung oder Gruppe. */
	teile: number;
}

/** Die Beschriftung einer Gestaltungszeile (1-ebenen.md, „Beschriftung“). `data-name` geht allem vor. */
export const titelDerGestaltung = ({ art, name, teile, text, wert }: GestaltungAngaben) => {
	if (wert('data-name')?.trim()) {
		return name;
	}
	// 205-03: dasselbe Wort wie Schild und Inspektor (`nameDerGestaltung`).
	const form = formTitel(wert('data-form'), wert) ?? '';
	switch (art) {
		case 'bildfrei': {
			const datei =
				(wert('src') ?? '')
					.split(/[?#]/)[0]
					?.split('/')
					.at(-1)
					?.replace(/\.[^.]+$/, '') ?? '';
			return wert('alt')?.trim() || datei || name;
		}
		case 'form':
			return form || name;
		case 'formtext':
			return text ? `${form || name} „${kuerze(text)}“` : form || name;
		// 198-06: die Art vorn wie bei der Sprechblase, der Wortlaut dahinter.
		case 'schmuck':
		case 'schmuckbogen':
			return text ? `${name} „${kuerze(text)}“` : name;
		case 'streuung':
			return `${name} (${teile})`;
		case 'gruppe':
			return `${name} (${teile})`;
		default:
			return name;
	}
};

