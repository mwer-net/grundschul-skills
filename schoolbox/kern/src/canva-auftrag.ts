/**
 * Besitzer: 176. Der eigene Canva-Lauf (`server/src/canva-lauf.ts`): Wunsch, Stand und der Auftrag für eine Figur.
 * 179 nutzt Wunsch und Stand für `art: 'bild'`. Ohne Abhängigkeiten außer `figuren.ts`, damit der Browser die Typen
 * liest.
 */

import { FIGUREN } from './figuren';

export type CanvaArt = 'figur' | 'bild';

/** Wohin das Bild gehört: `figur` (null: neue Figur) und `name` bei 176, `mappe` und `dok` bei 179. */
export interface CanvaZiel {
	figur?: string | null;
	name?: string | null;
	mappe?: string;
	dok?: string;
}

export interface CanvaWunsch {
	art: CanvaArt;
	/** Der Text der Lehrkraft, für Kachel und Tooltip. */
	text: string;
	/** Der fertige Auftrag an Claude (stdin). */
	auftrag: string;
	ziel: CanvaZiel;
}

/** Fertige und abgebrochene Aufträge stehen nicht mehr in der Liste, Fehler bis zum Verwerfen. */
export type CanvaStatus = 'wartet' | 'laeuft' | 'fehler';

/** Status im Ereignis `canva-stand`. */
export type CanvaEreignisStatus = CanvaStatus | 'fertig' | 'abgebrochen';

export interface CanvaStand {
	id: string;
	art: CanvaArt;
	text: string;
	status: CanvaStatus;
	ziel: CanvaZiel;
	fehler: string | null;
	start: string;
}

/** Eine bekannte Figur, wie der Auftrag sie braucht. `farbbild` ist der Pfad ihrer Grundpose. */
export interface CanvaFigur {
	id: string;
	name: string;
	steckbrief: string | null;
	referenz: string | null;
	farbbild: string;
}

/** Höchstlänge der Beschreibung im Feld „Figur beschreiben“. */
export const CANVA_TEXT_ZEICHEN = 300;

/** So heißt das Bild einer Figur in `bilder/` des Arbeitsordners. */
export const FIGUR_BILD = 'bild.png';

/** Willi ist die Stil-Referenz für neue Figuren und für Figuren ohne eigene Referenz. */
const STIL = FIGUREN.find((f) => f.id === 'willi')?.canva ?? '';

const einzeilig = (text: string) =>
	// eslint-disable-next-line no-control-regex
	text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim();

/** `referenz/<id>.<endung der Grundpose>` im Arbeitsordner; nur für eine Figur ohne Steckbrief. */
export const referenzDatei = (figur: Pick<CanvaFigur, 'id' | 'farbbild'>) =>
	`referenz/${figur.id}${/\.[a-z]+$/i.exec(figur.farbbild)?.[0].toLowerCase() ?? '.png'}`;

/** Die Zeilen nach `vorlagen/ki/canva-figur.md`: Wunsch, Datei und die Figur (`null`: neue Figur). */
export const canvaAuftragText = (wunsch: string, figur: CanvaFigur | null) => {
	const stil = `Stil-Referenz ${STIL} (nur der Zeichenstil)`;
	const zeilen = [`Wunsch: „${einzeilig(wunsch)}“`, `Datei: ${FIGUR_BILD}`];
	if (!figur) {
		zeilen.push(`Neue Figur. ${stil}.`);
	} else {
		const aussehen = figur.steckbrief
			? `Aussehen „${einzeilig(figur.steckbrief)}“`
			: `kein Steckbrief, Bild ${referenzDatei(figur)}`;
		zeilen.push(`Figur ${einzeilig(figur.name)}: ${aussehen}; ${figur.referenz ? `Referenz ${figur.referenz}` : stil}`);
	}
	return `${zeilen.join('\n')}\n`;
};

const ERSATZ: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/**
 * Die Id einer neuen Figur aus ihrem Namen: klein, ä → ae, ö → oe, ü → ue, ß → ss, nur a–z und 0–9, leer `figur`.
 * Ist sie vergeben (auch Willi und Wilma), kommt eine Ziffer dazu: `igel2`.
 */
export const neueFigurId = (name: string, vergeben: Iterable<string>) => {
	const belegt = new Set([...vergeben, ...FIGUREN.map((f) => f.id)]);
	const basis =
		name
			.normalize('NFC')
			.toLocaleLowerCase('de')
			.replace(/[äöüß]/g, (z) => ERSATZ[z] ?? z)
			.replace(/[^a-z0-9]/g, '') || 'figur';
	let id = basis;
	for (let n = 2; belegt.has(id); n += 1) {
		id = `${basis}${n}`;
	}
	return id;
};
