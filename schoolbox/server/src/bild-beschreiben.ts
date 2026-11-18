/**
 * Besitzer: 179. Ein neues Bild aus der Schublade „Bilder“ über den Lauf aus 176 (seit 237 über die Bild-API): die
 * Zeilen des Auftrags nach `vorlagen/ki/bild.md` und die Ablage in `bilder/` der Mappe. Die Route steht in `bilder.ts`.
 */
import { constants, existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { BibliotheksFigur, Palette } from '@schoolbox/kern';
import { einzeilig, freierStamm, mappenDir, SchoolboxFehler, slug } from '@schoolbox/kern';

import { uebertrageHerkunft } from './bild-herkunft';
import type { BildlaufErgebnis } from './bild-lauf';

/** Eine Figur im Auftrag: `referenz` ist ihre Grundpose unter `referenzen/` im Arbeitsordner (237). */
export type BildFigur = Pick<BibliotheksFigur, 'name' | 'steckbrief'> & { referenz: string | null };

export interface BildAuftrag {
	text: string;
	figuren: readonly BildFigur[];
	palette: Palette | null;
}

/** Der Name der Palette wie in `kindgerecht-gestalten.md`; ohne Palette „Sonnig“. */
const paletteName = (palette: Palette | null) => {
	const p = palette ?? 'sonnig';
	return `${p.charAt(0).toUpperCase()}${p.slice(1)}`;
};

/**
 * Die Zeilen nach `bild.md`: Wunsch, Palette und je Figur Aussehen und Referenz. Eine Stil-Referenz gibt es hier nie,
 * denn ein überzähliges Referenzbild holt seine Figur ins Bild.
 */
export const bildAuftragText = ({ figuren, palette, text }: BildAuftrag) => {
	const zeilen = [`Wunsch: „${einzeilig(text)}“`, `Palette: ${paletteName(palette)}`];
	for (const f of figuren) {
		const aussehen = f.steckbrief ? `Aussehen „${einzeilig(f.steckbrief)}“` : 'kein Steckbrief';
		const referenz = f.referenz ? `Referenz ${einzeilig(f.referenz)}` : 'keine Referenz';
		zeilen.push(`Figur ${einzeilig(f.name)}: ${aussehen}; ${referenz}`);
	}
	if (figuren.length === 0) {
		zeilen.push('Keine Figur aus der Bibliothek.');
	}
	return zeilen.join('\n');
};

/**
 * Das `uebernimm` von 179: das Bild unter einem freien Namen aus dem Motiv nach `bilder/` der Mappe, nie über ein
 * vorhandenes, mit seiner Herkunft aus `bilder-herkunft.tsv` des Laufs. Ist die Mappe weg (gelöscht oder im Papierkorb), entsteht kein
 * Ordner ohne `mappe.json`: Er stünde dem Wiederherstellen im Weg.
 */
export const legeBildAb = async (materialDir: string, mappe: string, e: BildlaufErgebnis): Promise<string> => {
	const dir = mappenDir(materialDir, mappe);
	if (!existsSync(path.join(dir, 'mappe.json'))) {
		throw new SchoolboxFehler('Diesen Ordner gibt es nicht mehr.');
	}
	const ziel = path.join(dir, 'bilder');
	await mkdir(ziel, { recursive: true });
	const name = `${await freierStamm(ziel, slug(e.motiv) || 'bild')}${path.extname(e.datei).toLowerCase()}`;
	await copyFile(e.pfad, path.join(ziel, name), constants.COPYFILE_EXCL);
	await uebertrageHerkunft(path.dirname(e.pfad), ziel, { [e.datei]: name });
	return name;
};
