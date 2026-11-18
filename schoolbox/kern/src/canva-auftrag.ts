/**
 * Besitzer: 176. Der eigene Lauf der Schubladen (`server/src/canva-lauf.ts`, seit 237 über die Bild-API): Wunsch,
 * Stand und der Auftrag für eine Figur. 179 nutzt Wunsch und Stand für `art: 'bild'`. Ohne Abhängigkeiten außer
 * `figuren.ts`, damit der Browser die Typen liest.
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

/** Eine bekannte Figur, wie der Auftrag sie braucht (237: Dateien im Arbeitsordner statt Media-IDs von Canva). */
export interface CanvaFigur {
	id: string;
	name: string;
	steckbrief: string | null;
	/** Ihre Grundpose als Referenz für die Bild-API, `referenzen/<id>.<png|jpg>`; `null`, wenn sie kein PNG/JPEG ist. */
	referenz: string | null;
	/** Ihre Grundpose zum Ansehen im Arbeitsordner; bei einer Referenz dieselbe Datei. */
	bild: string;
}

/** Höchstlänge der Beschreibung im Feld „Figur beschreiben“. */
export const CANVA_TEXT_ZEICHEN = 300;

/** So heißt das Bild einer Figur in `bilder/` des Arbeitsordners. */
export const FIGUR_BILD = 'bild.png';

/** Willi ist die Stil-Referenz für neue Figuren und für Figuren ohne eigene Referenz; der Server legt ihn dorthin. */
export const STIL_FIGUR = FIGUREN.find((f) => f.id === 'willi')?.id ?? 'willi';
export const STIL_REFERENZ = `referenzen/${STIL_FIGUR}.png`;

export const einzeilig = (text: string) =>
	// eslint-disable-next-line no-control-regex
	text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim();

/** Braucht der Auftrag Willi als Stil-Referenz? Bei einer neuen Figur und einer Figur ohne eigene Referenz. */
export const brauchtStil = (figur: CanvaFigur | null) => !figur?.referenz;

/** Die Zeilen nach `vorlagen/ki/canva-figur.md`: Wunsch, Datei und die Figur (`null`: neue Figur). */
export const canvaAuftragText = (wunsch: string, figur: CanvaFigur | null) => {
	const stil = `Stil-Referenz ${STIL_REFERENZ} (nur der Zeichenstil)`;
	const zeilen = [`Wunsch: „${einzeilig(wunsch)}“`, `Datei: ${FIGUR_BILD}`];
	if (!figur) {
		zeilen.push(`Neue Figur. ${stil}.`);
	} else {
		const aussehen = figur.steckbrief
			? `Aussehen „${einzeilig(figur.steckbrief)}“`
			: `kein Steckbrief, Bild ${figur.bild}`;
		zeilen.push(
			`Figur ${einzeilig(figur.name)}: ${aussehen}; ${figur.referenz ? `Referenz ${figur.referenz}` : stil}`,
		);
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
