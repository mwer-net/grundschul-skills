/**
 * Die Liste der Figuren (102, Entscheidung 27): eine Quelle für die Schublade „Figuren“, die Katalog-Einträge der
 * Leitfigur in `bausteine.ts` und die Referenz für Claude (`quellen.ts`). Eine neue Figur kommt nur hierher und als
 * Datei nach `assets/bilder/`. Ohne Abhängigkeiten außer der Quelltext-Zerlegung, damit `quellen.ts` sie lesen kann.
 */

import { attribut, schuetzeAttribut, setzeAttribut, wendeAn, zerlege } from './quelltext';
import type { StrukturErgebnis } from './struktur';

export type Blick = 'links' | 'rechts';

export interface Figur {
	/** Wert von `data-figur` und Kennung des Katalog-Eintrags der Leitfigur. */
	id: string;
	name: string;
	/** In `assets/bilder/`. */
	datei: string;
	/** Strichfassung für s/w (`blatt.py fassung` findet sie über den Namen `<stamm>-strich.*`); ohne: Graustufen. */
	strich?: string;
	/** Wohin die Figur in der Datei schaut bzw. zeigt. */
	blickt: Blick;
	/** Für die Suche im Katalog der Bausteine und in ⌘K. */
	suchwoerter: readonly string[];
}

export const FIGUREN: readonly Figur[] = [
	{
		id: 'willi',
		name: 'Willi',
		datei: 'willi.png',
		strich: 'willi-strich.png',
		blickt: 'rechts',
		suchwoerter: ['Leitfigur', 'Waschbär'],
	},
	{ id: 'wilma', name: 'Wilma', datei: 'wilma.png', blickt: 'rechts', suchwoerter: ['Leitfigur', 'Waschbär'] },
];

/** Standardbreite einer frei abgelegten Figur in px. */
export const FIGUR_BREITE = 150;

export const figurNach = (id: string | null | undefined) => FIGUREN.find((f) => f.id === id);

/** Schlüssel für `uebernimmBild` (`POST …/bilder/uebernehmen`): die Datei aus `assets/bilder/`. */
export const figurSchluessel = (f: Figur) => `_assets/bilder/${f.datei}`;

/** `src`, wenn das Dokument die Datei aus den Assets direkt erreicht (das ist der Normalfall von `uebernimmBild`). */
export const figurSrc = (f: Figur) => `bilder/${f.datei}`;

/** Gespiegelt, wenn die gewünschte Blickrichtung nicht die der Datei ist. */
export const spiegelnFuer = (f: Figur, blick: Blick) => blick !== f.blickt;

/** Eine frei liegende Figur (Briefing 3.4): nur `figur-frei`, nie `figur` (das ist die Leitfigur im Tipp). */
export const figurHtml = (f: Figur, src: string, blick: Blick = f.blickt) =>
	`<img class="figur-frei" data-figur="${schuetzeAttribut(f.id)}" src="${schuetzeAttribut(src)}" alt="${schuetzeAttribut(f.name)}"${
		spiegelnFuer(f, blick) ? ' style="--spiegeln:-1"' : ''
	}>`;

/** Die Figur, die an einem `img.figur-frei` hängt (`data-figur`, sonst nach dem Dateinamen). */
export const figurAn = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	if (!k) {
		return undefined;
	}
	const id = attribut(k, 'data-figur')?.wert;
	if (id) {
		return figurNach(id);
	}
	const src = attribut(k, 'src')?.wert ?? '';
	return FIGUREN.find((f) => src.split('/').at(-1) === f.datei);
};

/** Tauscht die Figur aus: `src`, `alt`, `data-figur`; Lage, Größe, Spiegeln und alles andere bleiben. */
export const tauscheFigur = (quelle: string, nr: number, f: Figur, src: string): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (k?.tag !== 'img') {
		throw new Error(`Das Element ${nr} ist kein Bild.`);
	}
	return {
		quelle: wendeAn(quelle, [
			...setzeAttribut(z, k, 'data-figur', f.id),
			...setzeAttribut(z, k, 'src', src),
			...setzeAttribut(z, k, 'alt', f.name),
		]),
		nr,
	};
};

/** Die Liste der Figuren für die Referenz (`quellen.ts`, Marke `figuren` in `gestaltung.md`). */
export const figurenListe = () =>
	[
		'| `data-figur` | Name | Datei | In s/w | Schaut nach |',
		'|---|---|---|---|---|',
		...FIGUREN.map(
			(f) =>
				`| \`${f.id}\` | ${f.name} | \`bilder/${f.datei}\` | ${f.strich ? `Strichbild \`${f.strich}\`` : 'Graustufen'} | ${f.blickt} |`,
		),
	].join('\n');
