/**
 * Besitzer: 271. Die Bildliste einer Einheit für Quellen und Angebot: jedes Bild, das die Materialien verwenden (aus
 * ihrem HTML), mit Art und Quelle, und der Abgleich, ob Quellen und Angebot nur Dateien und Arten aus ihr nennen.
 * Die Herkunft kommt aus `bilder-herkunft.tsv` und `canva-ids.tsv` (237, 138) und für Posen der Bibliothek aus
 * `figuren.json` (`posenQuellen`). Die Läufe schreiben daraus, nichts aus eigener Erinnerung.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { leseHerkunft } from './einheit-bibliothek';
import { FIGUREN } from './figuren';

export const HERKUNFT_TSV = 'bilder-herkunft.tsv';
export const CANVA_TSV = 'canva-ids.tsv';
/** Marker im Arbeitsordner: Für diese Slugs hat der Bau die Bildliste bekommen, nur sie gleicht der Server ab. */
export const BILDLISTE_DATEI = 'bildliste.json';

/** `ki` mit Quelle, `bibliothek` eine Pose der Figurenbibliothek, `berechnet` SVG und `x-…`, `gemeinfrei` amtlich. */
export type BildArt = 'ki' | 'bibliothek' | 'berechnet' | 'gemeinfrei' | 'unbekannt';

/** Die Quelle wie in `bilder-herkunft.tsv`: `openai` mit Modell, `canva`. */
export interface BildQuelle {
	quelle: string;
	modell?: string;
}

export interface BildVerwendung {
	slug: string;
	/** Seiten im HTML, ab 1; leer, wenn das Material keine Seiten auszeichnet. */
	seiten: number[];
}

export interface BildlistenEintrag {
	/** Dateiname unter `bilder/`, für berechnete Abbildungen der Name des Elements (`x-uhr`, `svg`). */
	datei: string;
	art: BildArt;
	quelle?: BildQuelle;
	/** `bibliothek`: Kennung der Pose; Kopie eines Requisits: Titel der Mappe, aus der es kam. */
	figur?: string;
	aus?: string;
	/** Strichfassung für s/w daneben, falls es sie gibt. */
	strich?: string;
	verwendet: BildVerwendung[];
}

export interface BildlistenHerkunft {
	/** Herkunft je Datei in `bilder/` (`leseBildQuellen`). */
	herkunft: ReadonlyMap<string, BildQuelle>;
	/** Quelle je Pose der Bibliothek (`posenQuellen`), `null` unbekannt. */
	posen: ReadonlyMap<string, BildQuelle | null>;
	/** Requisiten früherer Einheiten je Kopie `req-…`. */
	requisiten?: ReadonlyMap<string, { mappe: string; quelle: BildQuelle | null }>;
	/** Die Dateien in `bilder/` des Arbeitsordners. */
	dateien: ReadonlySet<string>;
}

const leseText = (datei: string) => readFile(datei, 'utf8').catch(() => '');

/** Die Herkunft der Bilder eines Ordners `bilder/`: `bilder-herkunft.tsv` vor `canva-ids.tsv`, je Datei die letzte Zeile. */
export const leseBildQuellen = async (bilderDir: string): Promise<Map<string, BildQuelle>> => {
	const je = new Map<string, BildQuelle>();
	for (const zeile of (await leseText(path.join(bilderDir, CANVA_TSV))).split('\n').slice(1)) {
		const datei = zeile.split('\t')[0]?.trim();
		if (datei) {
			je.set(datei, { quelle: 'canva' });
		}
	}
	for (const z of leseHerkunft(await leseText(path.join(bilderDir, HERKUNFT_TSV))).values()) {
		if (z.quelle.trim()) {
			je.set(z.datei, { quelle: z.quelle.trim(), ...(z.modell ? { modell: z.modell } : {}) });
		}
	}
	return je;
};

/** Bilder, die mit den Skills kommen (`bilder/<datei>` neben dem Material): Willi, Wilma und die Wachstumsgrafik. */
const KIT_BILDER = new Map<string, Pick<BildlistenEintrag, 'art' | 'figur' | 'quelle'>>([
	...FIGUREN.map((f) => [f.datei, { art: 'bibliothek', figur: f.id, quelle: { quelle: 'canva' } }] as const),
	['wachstum.png', { art: 'ki', quelle: { quelle: 'canva' } }],
]);

const RASTER = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const BILD = /(?:^|["'(\s,=])((?:\.\.\/\.\.\/)?bilder\/([a-z0-9][a-z0-9._/-]*\.(?:png|jpe?g|webp|gif|svg)))/gi;
const BERECHNET = /<(x-[a-z0-9-]+|svg)\b/gi;
const SEITE = /<(?:section|div)\b[^>]*\bclass\s*=\s*["']([^"']*)["'][^>]*>/gi;

/** Die Anfänge der Seiten im HTML; eine Stelle liegt auf der Seite, deren Anfang zuletzt vor ihr steht. */
const seitenAnfaenge = (html: string) =>
	[...html.matchAll(SEITE)].filter((t) => /(?:^|\s)seite(?:\s|$)/.test(t[1] ?? '')).map((t) => t.index ?? 0);

const seiteAn = (anfaenge: readonly number[], stelle: number) => anfaenge.filter((a) => a <= stelle).length;

const ohneSkripte = (html: string) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (t) => ' '.repeat(t.length));

const stammVon = (datei: string) => datei.replace(/\.[^.]+$/, '');

/** Art und Quelle einer Datei aus `bilder/` der Einheit. */
const einordnen = (datei: string, h: BildlistenHerkunft): Omit<BildlistenEintrag, 'verwendet' | 'datei'> => {
	const strichName = RASTER.map((e) => `${stammVon(datei)}-strich${e}`).find((d) => h.dateien.has(d));
	const strich = strichName ? { strich: strichName } : {};
	if (datei.startsWith('bib-')) {
		const pose = stammVon(datei.slice(4));
		const quelle = h.posen.get(pose);
		return { art: 'bibliothek', figur: pose, ...(quelle ? { quelle } : {}), ...strich };
	}
	if (datei.startsWith('req-')) {
		const r = h.requisiten?.get(datei);
		return r?.quelle
			? { art: 'ki', quelle: r.quelle, aus: r.mappe, ...strich }
			: { art: 'unbekannt', ...(r ? { aus: r.mappe } : {}), ...strich };
	}
	const quelle = h.herkunft.get(datei);
	return quelle ? { art: 'ki', quelle, ...strich } : { art: 'unbekannt', ...strich };
};

const KIT_SCHLUESSEL = 'kit:';

/**
 * Die Bildliste aus dem HTML der Materialien: Bilder aus `../../bilder/` (ohne Seitenbilder `v-…`), Bilder der Skills
 * aus `bilder/` neben dem Material, SVG und `x-…`-Elemente als berechnet. Je Eintrag die Materialien und Seiten; die
 * Reihenfolge: Dateien nach Namen, dann die berechneten.
 */
export const erstelleBildliste = (
	dokumente: readonly { slug: string; html: string }[],
	h: BildlistenHerkunft,
): BildlistenEintrag[] => {
	const je = new Map<string, BildlistenEintrag>();
	const notiere = (schluessel: string, neu: () => Omit<BildlistenEintrag, 'verwendet'>, slug: string, seite: number) => {
		const e = je.get(schluessel) ?? { ...neu(), verwendet: [] };
		je.set(schluessel, e);
		let v = e.verwendet.find((x) => x.slug === slug);
		if (!v) {
			v = { slug, seiten: [] };
			e.verwendet.push(v);
		}
		if (seite > 0 && !v.seiten.includes(seite)) {
			v.seiten.push(seite);
		}
	};
	for (const d of dokumente) {
		const html = ohneSkripte(d.html);
		const anfaenge = seitenAnfaenge(html);
		for (const t of html.matchAll(BILD)) {
			const ganz = t[1] ?? '';
			const datei = t[2] ?? '';
			const seite = seiteAn(anfaenge, t.index ?? 0);
			if (ganz.startsWith('../../')) {
				if (!datei.includes('/') && !datei.startsWith('v-')) {
					notiere(datei, () => ({ datei, ...einordnen(datei, h) }), d.slug, seite);
				}
				continue;
			}
			const name = path.posix.basename(datei);
			const kit = KIT_BILDER.get(datei);
			notiere(
				`${KIT_SCHLUESSEL}${datei}`,
				() =>
					kit
						? { datei: name, ...kit }
						: datei.startsWith('verkehrszeichen/')
							? { datei: name, art: 'gemeinfrei' }
							: { datei: name, art: 'unbekannt' },
				d.slug,
				seite,
			);
		}
		for (const t of html.matchAll(BERECHNET)) {
			const name = (t[1] ?? '').toLowerCase();
			notiere(`<${name}>`, () => ({ datei: name, art: 'berechnet' }), d.slug, seiteAn(anfaenge, t.index ?? 0));
		}
	}
	const liste = [...je.entries()].map(([schluessel, e]) => ({ schluessel, e }));
	const berechnet = (x: { schluessel: string }) => (x.schluessel.startsWith('<') ? 1 : 0);
	return liste
		.sort((a, b) => berechnet(a) - berechnet(b) || a.e.datei.localeCompare(b.e.datei))
		.map(({ e }) => ({ ...e, verwendet: e.verwendet.map((v) => ({ ...v, seiten: v.seiten.sort((a, b) => a - b) })) }));
};

const quelleText = (q: BildQuelle | undefined) => (q ? `Quelle ${q.quelle}${q.modell ? ` (${q.modell})` : ''}` : '');

const ART_TEXT: Record<BildArt, string> = {
	ki: 'KI-Bild',
	bibliothek: 'Figur der Figurenbibliothek',
	berechnet: 'berechnet (Programmcode, keine Datei)',
	gemeinfrei: 'Verkehrszeichen, gemeinfrei (Link aus assets/bilder/verkehrszeichen/QUELLEN.md)',
	unbekannt: 'Herkunft unbekannt',
};

const eintragText = (e: BildlistenEintrag) => {
	const art = [
		ART_TEXT[e.art],
		e.figur ? `Pose ${e.figur}` : '',
		e.aus ? `aus „${e.aus}“` : '',
		quelleText(e.quelle),
		e.art === 'bibliothek' && !e.quelle ? 'Herkunft unbekannt' : '',
		e.strich ? `Strichfassung ${e.strich}` : '',
	]
		.filter(Boolean)
		.join(', ');
	const wo = e.verwendet
		.map((v) => (v.seiten.length ? `${v.slug} S. ${v.seiten.join(', ')}` : v.slug))
		.join('; ');
	return `- ${e.datei}: ${art}; in ${wo}`;
};

/** Der Absatz im Auftrag von Quellen, Angebot und Schlusslauf. */
export const bildlisteText = (liste: readonly BildlistenEintrag[]) =>
	[
		'Bildliste der Schoolbox (aus dem HTML aller Materialien, nicht geplant): Quellen und Angebot nennen die Herkunft der Bilder nur nach dieser Liste (html-materialerstellung, references/verkauf.md, Abschnitt 3). Eine Datei, die hier fehlt, nennen sie nicht; der Server gleicht Dateinamen und Art ab.',
		...(liste.length ? liste.map(eintragText) : ['- Die Materialien verwenden keine Bilder.']),
	].join('\n');

type GenannteArt = Exclude<BildArt, 'unbekannt'>;

/** Was ein Block des Quellenblatts über die Herkunft sagt. */
interface Angabe {
	arten: Set<GenannteArt>;
	quellen: Set<string>;
}

const angabeIn = (text: string): Angabe => {
	const t = text.replace(/kein(?:e|en)?\s+KI-Bildgenerator/gi, ' ');
	const arten = new Set<GenannteArt>();
	const quellen = new Set<string>();
	if (/OpenAI|GPT[\s-]?Image/i.test(t)) {
		quellen.add('openai');
	}
	if (/Canva/i.test(t)) {
		quellen.add('canva');
	}
	if (/Quelle bitte ergänzen|Herkunft unbekannt/i.test(t)) {
		quellen.add('unbekannt');
	}
	if (quellen.has('openai') || quellen.has('canva') || /KI-Bild|Bildgenerator|KI-generiert/i.test(t)) {
		arten.add('ki');
	}
	if (/Figurenbibliothek/i.test(t)) {
		arten.add('bibliothek');
	}
	if (/Programmcode|per Code|berechnet/i.test(t)) {
		arten.add('berechnet');
	}
	if (/gemeinfrei/i.test(t)) {
		arten.add('gemeinfrei');
	}
	return { arten, quellen };
};

const sichtbar = (html: string) =>
	html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;|&#160;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/\s+/g, ' ');

/** Zeilen einer Tabelle als ein Block (Was und Quelle gehören zusammen), sonst Absätze, Punkte und Überschriften. */
const bloecke = (html: string) => {
	const zeilen: string[] = [];
	const rest = ohneSkripte(html).replace(/<tr\b[\s\S]*?<\/tr>/gi, (t) => {
		zeilen.push(t);
		return '\n<p>';
	});
	return [...zeilen, ...rest.split(/<(?:p|li|h[1-6]|dt|dd|br)\b[^>]*>/i)].map(sichtbar).filter((b) => b.trim());
};

const DATEI_IM_TEXT = /(?<![\w/.-])([a-z0-9][a-z0-9-]*\.(?:png|jpe?g|webp|gif|svg))(?![\w/-])/gi;

/** Darf ein Block, der `a` sagt, das Bild `e` meinen? Ohne Angabe zur Art oder Quelle gilt er nicht. */
const passt = (e: BildlistenEintrag, a: Angabe): string | null => {
	const quelle = e.quelle?.quelle ?? 'unbekannt';
	const bekannt = ['openai', 'canva', 'unbekannt'];
	const genannt = [...a.quellen];
	if (genannt.length && bekannt.includes(quelle) && !genannt.includes(quelle)) {
		return quelle === 'unbekannt' ? 'Herkunft unbekannt' : quelleText(e.quelle);
	}
	const erlaubt = new Set<string>(
		e.art === 'bibliothek' ? ['bibliothek', ...(e.quelle ? ['ki'] : [])] : e.art === 'unbekannt' ? [] : [e.art],
	);
	if (a.arten.size && ![...a.arten].some((x) => erlaubt.has(x)) && !(e.art === 'unbekannt' && a.quellen.has('unbekannt'))) {
		return ART_TEXT[e.art];
	}
	return null;
};

/**
 * Der Abgleich von Quellen und Angebot mit der Bildliste (maschinell, ohne KI): Jede genannte Bilddatei steht in der
 * Liste (oder ist eine Strichfassung aus ihr), und was der Block um sie über Art und Quelle sagt, passt zur Liste.
 * `quellen`: das Quellenverzeichnis, dort steht zudem jedes Bild unbekannter Herkunft mit Dateinamen.
 */
export const bildlisteBefunde = (
	liste: readonly BildlistenEintrag[],
	html: string,
	o: { titel: string; quellen: boolean },
): string[] => {
	const je = new Map<string, BildlistenEintrag>();
	for (const e of liste.filter((x) => x.art !== 'berechnet')) {
		je.set(e.datei.toLowerCase(), e);
		if (e.strich) {
			je.set(e.strich.toLowerCase(), e);
		}
	}
	const befunde: string[] = [];
	const genannt = new Set<string>();
	for (const block of bloecke(html)) {
		const angabe = angabeIn(block.replace(DATEI_IM_TEXT, ' '));
		for (const t of block.matchAll(DATEI_IM_TEXT)) {
			const datei = (t[1] ?? '').toLowerCase();
			const e = je.get(datei);
			if (!e) {
				if (!genannt.has(datei)) {
					befunde.push(
						`„${o.titel}“ nennt ${datei}; diese Datei verwendet kein Material der Einheit (Bildliste der Schoolbox). Nimm sie heraus.`,
					);
				}
				genannt.add(datei);
				continue;
			}
			genannt.add(e.datei.toLowerCase());
			const richtig = passt(e, angabe);
			if (richtig) {
				befunde.push(
					`„${o.titel}“ nennt für ${datei} eine andere Herkunft als die Bildliste der Schoolbox: Dort steht ${richtig}. Schreibe die Herkunft aus der Liste ab.`,
				);
			}
		}
	}
	if (o.quellen) {
		const fehlen = liste.filter(
			(e) => (e.art === 'unbekannt' || (e.art === 'bibliothek' && !e.quelle)) && !genannt.has(e.datei.toLowerCase()),
		);
		if (fehlen.length) {
			befunde.push(
				`„${o.titel}“ nennt Bilder unbekannter Herkunft nicht: ${fehlen.map((e) => e.datei).join(', ')}. Jedes bekommt die Zeile „Quelle bitte ergänzen: <Datei>“.`,
			);
		}
	}
	return befunde;
};
