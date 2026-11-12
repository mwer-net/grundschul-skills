/**
 * Die eingebauten Figuren Willi und Wilma. Alle anderen stehen in der Figurenbibliothek (`figurenbibliothek.ts`, 177).
 * Eine Quelle (102, Entscheidung 27) für die Katalog-Einträge der Leitfigur in `bausteine.ts` und die Referenz für
 * Claude (`quellen.ts`). Ohne Abhängigkeiten außer der Quelltext-Zerlegung, damit `quellen.ts` und der Browser sie
 * lesen.
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
	/** Aussehen für Canva-Prompts. Quelle ist `kindgerecht-gestalten.md` (Abschnitt 3); ein Test hält beide gleich. */
	steckbrief?: string;
	/** Canva-Media-ID der Datei; Quelle ist `bilder.md` (Abschnitt 1), ein Test hält beide gleich. */
	canva?: string;
}

/** Eine Pose einer Figur. Ihre Kennung ist der Dateistamm und zugleich `data-figur` (`kuno`, `willi-lupe`). */
export interface Pose {
	id: string;
	/** `_figuren/<datei>` oder `_assets/bilder/<datei>`; die Darstellung liegt unter `/ansicht/<schluessel>`. */
	schluessel: string;
	/** Es gibt eine Strichfassung für s/w (`<id>-strich.*` daneben). */
	strich: boolean;
	canva?: string;
}

/** Eine Figur, wie Schublade, Inspektor und ⌘K sie kennen: eingebaut oder aus der Figurenbibliothek. */
export interface BibliotheksFigur {
	id: string;
	name: string;
	eingebaut: boolean;
	steckbrief?: string;
	canva?: string;
	suchwoerter: readonly string[];
	/** Mindestens eine; die erste ist die Grundpose. */
	posen: readonly Pose[];
}

export const FIGUREN: readonly Figur[] = [
	{
		id: 'willi',
		name: 'Willi',
		datei: 'willi.png',
		strich: 'willi-strich.png',
		blickt: 'rechts',
		suchwoerter: ['Leitfigur', 'Waschbär'],
		steckbrief:
			'grauer Waschbär-Junge, schwarze Augenmaske, dunkelbraune Augen ohne Wimpern, geringelter Schwanz, oranges T-Shirt (#F28C28)',
		canva: 'MAHXV49zJZE',
	},
	{
		id: 'wilma',
		name: 'Wilma',
		datei: 'wilma.png',
		blickt: 'rechts',
		suchwoerter: ['Leitfigur', 'Waschbär'],
		steckbrief:
			'graues Waschbär-Mädchen, schwarze Augenmaske, petrolfarbene Augen mit Wimpern, geringelter Schwanz, petrolfarbenes Kleid (#2A9D8F), petrolfarbene Schleife am Ohr',
		canva: 'MAHXV_-A1xo',
	},
];

/** Standardbreite einer frei abgelegten Figur in px. */
export const FIGUR_BREITE = 150;

export const figurNach = (id: string | null | undefined) => FIGUREN.find((f) => f.id === id);

/** Willi oder Wilma mit der Grundpose aus `assets/bilder/`; weitere Posen hängt die Figurenbibliothek an. */
export const eingebauteFigur = (f: Figur, weitere: readonly Pose[] = []): BibliotheksFigur => ({
	id: f.id,
	name: f.name,
	eingebaut: true,
	...(f.steckbrief ? { steckbrief: f.steckbrief } : {}),
	...(f.canva ? { canva: f.canva } : {}),
	suchwoerter: f.suchwoerter,
	posen: [{ id: f.id, schluessel: `_assets/bilder/${f.datei}`, strich: Boolean(f.strich) }, ...weitere],
});

/** Solange die Figurenbibliothek nicht gelesen ist, gibt es nur diese. */
export const EINGEBAUTE: readonly BibliotheksFigur[] = FIGUREN.map((f) => eingebauteFigur(f));

/** „Willi“ für die Grundpose, „Willi lupe“ für `willi-lupe`: der Name der Figur und der Rest der Kennung. */
export const poseName = (figur: Pick<BibliotheksFigur, 'id' | 'name'>, pose: Pick<Pose, 'id'>) => {
	const rest = pose.id.startsWith(`${figur.id}-`) ? pose.id.slice(figur.id.length + 1).replace(/[-_]+/g, ' ') : '';
	return rest ? `${figur.name} ${rest}` : figur.name;
};

/** Eine frei liegende Figur (Briefing 3.4): nur `figur-frei`, nie `figur` (das ist die Leitfigur im Tipp). */
export const figurHtml = (figur: Pick<BibliotheksFigur, 'name'>, pose: Pick<Pose, 'id'>, src: string) =>
	`<img class="figur-frei" data-figur="${schuetzeAttribut(pose.id)}" src="${schuetzeAttribut(src)}" alt="${schuetzeAttribut(figur.name)}">`;

/**
 * Figur und Pose an einem `img.figur-frei`: `data-figur` als Kennung einer Pose, sonst der Teil davor als Figur (dann
 * ohne Pose), sonst der Dateiname einer Grundpose.
 */
export const figurAn = (
	quelle: string,
	nr: number,
	figuren: readonly BibliotheksFigur[],
): { figur: BibliotheksFigur; pose?: Pose } | undefined => {
	const k = zerlege(quelle).knoten[nr];
	if (!k) {
		return undefined;
	}
	const id = attribut(k, 'data-figur')?.wert?.trim();
	if (id) {
		for (const figur of figuren) {
			const pose = figur.posen.find((p) => p.id === id);
			if (pose) {
				return { figur, pose };
			}
		}
		const figur = figuren.find((f) => f.id === id.split('-')[0]);
		if (figur) {
			return { figur };
		}
	}
	const datei = (attribut(k, 'src')?.wert ?? '').split('/').at(-1);
	for (const figur of figuren) {
		const grund = figur.posen[0];
		if (grund && grund.schluessel.split('/').at(-1) === datei) {
			return { figur, pose: grund };
		}
	}
	return undefined;
};

/** Tauscht Figur oder Pose aus: `data-figur`, `src`, `alt`; Lage, Größe, Spiegeln und alles andere bleiben. */
export const tauscheFigur = (
	quelle: string,
	nr: number,
	figur: Pick<BibliotheksFigur, 'name'>,
	pose: Pick<Pose, 'id'>,
	src: string,
): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (k?.tag !== 'img') {
		throw new Error(`Das Element ${nr} ist kein Bild.`);
	}
	return {
		quelle: wendeAn(quelle, [
			...setzeAttribut(z, k, 'data-figur', pose.id),
			...setzeAttribut(z, k, 'src', src),
			...setzeAttribut(z, k, 'alt', figur.name),
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
