/**
 * Besitzer: 253. Figuren aus Läufen in die Figurenbibliothek: welches Bild welche Figur in welcher Pose zeigt, unter
 * welchem Namen eine neue Figur in die Bibliothek kommt, wie Läufe die Posen einer Figur der Bibliothek einbinden und
 * welche Requisiten früherer Einheiten zu einem Auftrag passen. Ohne Node-Abhängigkeiten.
 */
import type { BibliotheksFigur, Pose } from './figuren';
import { figurHtml, figurNameVergeben, poseName } from './figuren';
import { slug } from './slug';

/** Die Pose einer Grundpose in `bilder.json` (`"pose": "grund"`). */
export const GRUNDPOSE = 'grund';
/** Der Vermerk an einer Figur, deren Grundpose einen Gegenstand der Handlung trägt (248). */
export const VERMERK_GEGENSTAND = 'Grundpose trägt einen Gegenstand der Handlung, prüfen.';
const MAX_WORT = 30;
const MAX_NAME = 40;

/** Was aus einem Eintrag in `bilder.json` oder einer Zeile in `bilder-herkunft.tsv` für die Figur zählt. */
export interface BildAngabe {
	datei: string;
	motiv: string;
	/** 253: Name der Figur aus dem Plan. */
	figur?: unknown;
	/** 253: `grund` oder ein Wort (`zeigt`, `faltet`). */
	pose?: unknown;
}

export interface BildFigur {
	/** Name der Figur; leer, wenn ihn weder Feld noch Motiv noch Datei nennt. */
	figur: string;
	/** `grund` oder das Wort der Pose. */
	pose: string;
}

const stammVon = (datei: string) => datei.replace(/\.[a-z]+$/i, '');
const text = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
const MOTIV = /^(grundpose|pose)\s+([\p{L}][\p{L}\p{N}-]*)/iu;

/** Der Name einer Figur aus `namen`, deren Dateiname der Anfang des Stamms ist (`luna-zeigt` → Luna). */
const nameAusDatei = (stamm: string, namen: readonly string[]) =>
	namen.find((n) => slug(n, 60) === stamm || stamm.startsWith(`${slug(n, 60)}-`)) ?? '';

/** Das Wort einer Pose aus dem Dateinamen: `luna-faltet-3` → `faltet` (Ziffern am Ende sind Varianten). */
const wortAusDatei = (stamm: string, figur: string) => {
	const vorn = slug(figur, 60);
	const rest = stamm.startsWith(`${vorn}-`) ? stamm.slice(vorn.length + 1) : '';
	return slug(rest.replace(/(-\d+)+$/, ''), MAX_WORT);
};

/**
 * Figur und Pose eines Bildes (253), `null` bei Szenen und Requisiten. Zuerst die Felder `figur` und `pose` aus
 * `bilder.json`; Einträge ohne sie (vor 253) nach dem Motiv („Grundpose Luna: …“, „Pose Luna zeigt …“) oder dem
 * Dateinamen einer Figur aus `namen` (`ella.png`). Die einzige Stelle, die entscheidet, was eine Grundpose ist.
 */
export const bildFigur = (e: BildAngabe, namen: readonly string[] = []): BildFigur | null => {
	const stamm = stammVon(e.datei);
	const motiv = MOTIV.exec(e.motiv.trim());
	const roh = text(e.pose).toLowerCase();
	if (roh) {
		const figur = text(e.figur) || motiv?.[2] || nameAusDatei(stamm, namen);
		const pose = roh === GRUNDPOSE ? GRUNDPOSE : slug(roh, MAX_WORT);
		return pose ? { figur, pose } : null;
	}
	if (/^grundpose\b/i.test(e.motiv.trim())) {
		return { figur: text(e.figur) || motiv?.[2] || nameAusDatei(stamm, namen), pose: GRUNDPOSE };
	}
	if (motiv) {
		const figur = motiv[2] ?? '';
		if (stamm === slug(figur, 60)) {
			return { figur, pose: GRUNDPOSE };
		}
		const wort = wortAusDatei(stamm, figur);
		return wort ? { figur, pose: wort } : null;
	}
	const figur = namen.find((n) => slug(n, 60) === stamm);
	return figur ? { figur, pose: GRUNDPOSE } : null;
};

export const istGrundpose = (e: BildAngabe, namen: readonly string[] = []) => bildFigur(e, namen)?.pose === GRUNDPOSE;

const gleicherName = (a: string, b: string) => a.toLocaleLowerCase('de').trim() === b.toLocaleLowerCase('de').trim();

/** Nomen eines Textes (großgeschrieben, ab vier Buchstaben), ohne Klammern. */
const nomen = (t: string) =>
	new Set(t.replace(/\([^)]*\)/g, ' ').match(/(?<!\p{L})[A-ZÄÖÜ]\p{Ll}{3,}(?!\p{L})/gu) ?? []);

/**
 * Trägt die Grundpose einer Figur einen Gegenstand der Handlung? Ein Nomen aus ihrem Motiv steht in einer Szene im
 * selben Satzteil wie eine andere Figur, ohne sie: Hanne hält in Kapitel 5 das Glöckchen, das Ellas Grundpose an der
 * Schwanzspitze trägt. Gibt die Gegenstände zurück, leer ohne Fund. Für Einträge ohne Kanon; mit Kanon lehnt
 * `pruefeBildVertrag` solche Grundposen schon ab (248).
 */
export const gegenstaendeInGrundpose = (
	grundMotiv: string,
	figur: string,
	szenen: readonly string[],
	namen: readonly string[],
) => {
	const andere = namen.filter((n) => n && !gleicherName(n, figur));
	const eigen = nomen(grundMotiv.replace(MOTIV, ''));
	for (const n of [...namen, 'Grundpose', 'Referenz', 'Szene', 'Szenen', 'Pose', 'Posen', 'Kapitel']) {
		eigen.delete(n);
	}
	const enthaelt = (t: string, wort: string) => new RegExp(`(^|[^\\p{L}])${wort}($|[^\\p{L}])`, 'u').test(t);
	return [...eigen].filter((wort) =>
		szenen.some((s) =>
			s
				.split(/[,;:.()]/)
				.some((teil) => enthaelt(teil, wort) && !enthaelt(teil, figur) && andere.some((g) => enthaelt(teil, g))),
		),
	);
};

const ADJEKTIV = /(e|er|es|en|em)$/;
/** Artikel und Pronomen: Am Satzanfang großgeschrieben, aber nie die Art. */
const BEGLEITER = new Set(
	'der die das den dem des ein eine einer eines einem einen kein keine keiner keinen mein meine sein seine ihr ihre unser unsere dieser diese dieses jeder jede jedes er sie es'.split(
		' ',
	),
);

/**
 * Die Art einer Figur aus ihrem Aussehen, für „Fridolin (Fuchs)“: das erste Nomen, das nicht der Name ist. Artikel und
 * Pronomen zählen nie, ein großgeschriebenes Adjektiv am Satzanfang („Braune Eule“, „Kleine, runde Eule“) nicht, wenn
 * nach weiteren Adjektiven ein Nomen kommt. Leer ohne Nomen.
 */
export const artAus = (aussehen: string, name: string) => {
	const woerter = (aussehen.replace(/\([^)]*\)/g, ' ').match(/[\p{L}-]+/gu) ?? []).filter(
		(w) => !BEGLEITER.has(w.toLocaleLowerCase('de')),
	);
	const gross = (w: string) => /^[A-ZÄÖÜ]/.test(w);
	for (const [i, w] of woerter.entries()) {
		if (!gross(w) || gleicherName(w, name) || w.length < 3) {
			continue;
		}
		if (i === 0 && ADJEKTIV.test(w)) {
			const rest = woerter.slice(1);
			const bis = rest.findIndex(gross);
			if (bis >= 0 && rest.slice(0, bis).every((x) => ADJEKTIV.test(x))) {
				continue;
			}
		}
		return w;
	}
	return '';
};

/**
 * Der Name einer neuen Figur in der Bibliothek: ihr Name, und trägt eine andere Figur ihn schon (auch Willi oder
 * Wilma), mit der Art dahinter, „Fridolin (Fuchs)“, ohne Art mit `ersatz` (Titel der Einheit). Ist auch das vergeben,
 * kommt eine Zahl dazu. Höchstens 40 Zeichen wie beim Umbenennen.
 */
export const bibliotheksName = (
	name: string,
	art: string,
	ersatz: string,
	vergeben: readonly Pick<BibliotheksFigur, 'id' | 'name'>[],
) => {
	const frei = (n: string) => !figurNameVergeben(n, vergeben, '');
	const kurz = (n: string) => (n.length > MAX_NAME ? `${n.slice(0, MAX_NAME - 1).trimEnd()}…` : n);
	if (frei(name)) {
		return kurz(name);
	}
	const zusatz = art || ersatz;
	const basis = kurz(zusatz ? `${name} (${zusatz})` : name);
	if (frei(basis)) {
		return basis;
	}
	for (let n = 2; ; n += 1) {
		const mit = `${basis.slice(0, MAX_NAME - String(n).length - 1)} ${n}`;
		if (frei(mit)) {
			return mit;
		}
	}
};

/** Das Aussehen aus dem Motiv einer Grundpose: „Grundpose Ella: Eichhörnchen mit … (Referenz …)“ → „Eichhörnchen mit …“. */
export const aussehenAus = (motiv: string) =>
	motiv
		.replace(/^grundpose\s+[^:]*:?\s*/i, '')
		.replace(/\([^)]*\)/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/[\s,;.]+$/, '')
		.trim()
		.slice(0, 300);

/** Der Steckbrief ohne die Teile, die einen Gegenstand der Handlung nennen: Er geht in jeden späteren Bild-Prompt. */
export const ohneGegenstaende = (aussehen: string, gegenstaende: readonly string[]) =>
	aussehen
		.split(/,\s*|\s+und\s+/)
		.filter((teil) => !gegenstaende.some((g) => teil.includes(g)))
		.join(', ');

/** Steckbrief einer neuen Figur: aus dem Kanon (`fest`, `nie`, 246), sonst ihr Aussehen aus dem Plan. */
export const steckbriefAus = (kanon: { fest: readonly string[]; nie: readonly string[] } | undefined, aussehen: string) => {
	if (kanon?.fest.length) {
		return [kanon.fest.join(', '), kanon.nie.length ? `nie: ${kanon.nie.join(', ')}` : ''].filter(Boolean).join('; ');
	}
	return aussehen.trim();
};

/** Das Bild einer Pose im Arbeitsordner eines Laufs: ihre Kennung mit der Endung der Datei der Bibliothek. */
export const posenDatei = (pose: Pick<Pose, 'id' | 'schluessel'>) =>
	`${pose.id}${/\.[a-z]+$/i.exec(pose.schluessel)?.[0]?.toLowerCase() ?? '.png'}`;

/** Posen aus der Ablage (`_figuren/…`); die eingebauten Dateien von Willi und Wilma liegen schon bei den Skills. */
export const posenFuerLauf = (figur: Pick<BibliotheksFigur, 'posen'>) =>
	figur.posen.filter((p) => !p.schluessel.startsWith('_assets/'));

/**
 * Die Posen der Figuren aus der Bibliothek für Bau- und Bilderläufe: je Pose die Zeile, mit der die Figuren-Schublade
 * sie einbindet (`figurHtml`), mit `ordner` vor der Datei (`../../bilder/` in der Einheit und im neuen Blatt). Leer,
 * wenn keine Figur Posen in der Ablage hat.
 */
export const posenText = (figuren: readonly Pick<BibliotheksFigur, 'id' | 'name' | 'posen'>[], ordner: string) => {
	const zeilen = figuren.flatMap((f) =>
		posenFuerLauf(f).map((p) => `- ${poseName(f, p)}: ${figurHtml(f, p, `${ordner}${posenDatei(p)}`)}`),
	);
	return zeilen.length
		? [
				'Posen der Figuren aus der Bibliothek (liegen schon in bilder/; binde sie genau so ein, statt sie neu zu erzeugen):',
				...zeilen,
			].join('\n')
		: '';
};

/** Ein freigestelltes Bild einer früheren Einheit, das keine Figur zeigt. */
export interface Requisit {
	/** Dateiname in `bilder/` seiner Mappe. */
	datei: string;
	motiv: string;
	/** Titel der Mappe. */
	mappe: string;
}

/** Ein Requisit: `.png` (freigestellt, Bildvertrag mit `transparent`), keine Figur, keine Vorschau der Seiten. */
export const istRequisit = (e: BildAngabe) =>
	e.datei.endsWith('.png') && !e.datei.startsWith('v-') && Boolean(e.motiv.trim()) && bildFigur(e) === null;

const woerter = (t: string) =>
	new Set(
		t
			.toLocaleLowerCase('de')
			.split(/[^\p{L}]+/u)
			.filter((w) => w.length >= 5)
			.map((w) => w.slice(0, 6)),
	);

export const MAX_REQUISITEN = 8;

/**
 * Die Requisiten, deren Motiv ein Wort des Auftrags teilt (Wortanfänge ab fünf Buchstaben), die mit den meisten
 * gemeinsamen Wörtern zuerst; je Dateiname eines.
 */
export const requisitenFuer = <R extends Requisit>(alle: readonly R[], auftrag: string, max = MAX_REQUISITEN): R[] => {
	const gesucht = woerter(auftrag);
	const gesehen = new Set<string>();
	return alle
		.map((r) => ({ r, treffer: [...woerter(r.motiv)].filter((w) => gesucht.has(w)).length }))
		.filter((x) => x.treffer > 0)
		.sort((a, b) => b.treffer - a.treffer)
		.filter(({ r }) => !gesehen.has(r.datei) && Boolean(gesehen.add(r.datei)))
		.slice(0, max)
		.map(({ r }) => r);
};

/** Der Absatz im Auftrag; die Dateien hat der Server vorher nach `bilder/` gelegt. */
export const requisitenText = (liste: readonly Requisit[], ordner: string) =>
	liste.length
		? [
				'Requisiten aus früheren Einheiten (liegen schon in bilder/; passt eins, nimm es, statt ein neues zu erzeugen):',
				...liste.map((r) => `- ${ordner}${r.datei}: ${r.motiv.slice(0, 160)} (aus „${r.mappe}“)`),
			].join('\n')
		: '';

/** Eine Zeile aus `bilder-herkunft.tsv`, über die Spaltennummern gelesen: fünf Spalten vor 248, acht danach. */
export interface HerkunftZeile {
	datei: string;
	quelle: string;
	motiv: string;
	/** `erzeugt`, `bearbeitet`, `offen`; leer vor 248. */
	art: string;
}

/** Die letzte Zeile je Datei. Die Kopfzeile zählt nicht, gleich ob sie fünf oder acht Spalten nennt. */
export const leseHerkunft = (inhalt: string): Map<string, HerkunftZeile> => {
	const je = new Map<string, HerkunftZeile>();
	for (const zeile of inhalt.split('\n').slice(1)) {
		const [datei = '', quelle = '', , , motiv = '', art = ''] = zeile.replace(/\r$/, '').split('\t');
		if (datei.trim()) {
			je.set(datei.trim(), { datei: datei.trim(), quelle, motiv, art: art.trim() });
		}
	}
	return je;
};

/** Eine Figur, die eine Einheit neu in die Bibliothek gebracht hat oder der sie Posen gab. */
export interface BibliothekNeu {
	id: string;
	/** Name in der Bibliothek, „Fridolin (Fuchs)“. */
	name: string;
	/** Name im Plan der Einheit, „Fridolin“. */
	plan: string;
	/** Die Figur selbst ist neu (Grundpose aus dem Bilderlauf). */
	figur: boolean;
	/** Wörter der neuen Posen. */
	posen: string[];
}

/** Der Satz im Band der Einheit: „Neu in der Figurenbibliothek: Luna (zeigt, faltet), Posen für Willi: winkt.“ */
export const bibliothekNeuSatz = (liste: readonly BibliothekNeu[]) => {
	const neu = liste.filter((n) => n.figur);
	const mehr = liste.filter((n) => !n.figur && n.posen.length);
	const mit = (n: BibliothekNeu) => (n.posen.length ? `${n.name} (${n.posen.join(', ')})` : n.name);
	return [
		neu.length ? `Neu in der Figurenbibliothek: ${neu.map(mit).join(', ')}.` : '',
		...mehr.map((n) => `Neue Posen für ${n.name}: ${n.posen.join(', ')}.`),
	]
		.filter(Boolean)
		.join(' ');
};

/** Eine Figur der Bibliothek mit den Namen, unter denen ein Plan oder Bildvertrag sie nennt. */
export interface GenannteFigur {
	figur: Pick<BibliotheksFigur, 'id' | 'name' | 'posen'>;
	namen: readonly string[];
}

/**
 * Für eine Figur der Bibliothek entsteht keine neue Grundpose und keine Pose, die sie schon hat. Der Grund nennt,
 * was der Lauf stattdessen nimmt; `null`, wenn das Bild keine solche Figur zeigt. `weitere`: Namen anderer Figuren
 * (des Plans), damit ein Dateiname wie `ella.png` erkannt wird.
 */
export const bibliotheksGrund = (
	figuren: readonly GenannteFigur[],
	v: BildAngabe,
	referenzen: string,
	weitere: readonly string[] = [],
) => {
	const namen = [...weitere, ...figuren.flatMap((g) => g.namen)].filter(Boolean);
	const bf = bildFigur(v, namen);
	const g = bf?.figur ? figuren.find((x) => x.namen.some((n) => gleicherName(n, bf.figur))) : undefined;
	if (!bf || !g) {
		return null;
	}
	const { figur } = g;
	if (bf.pose === GRUNDPOSE) {
		return `${figur.name} ist eine Figur der Figurenbibliothek: Ihre Grundpose liegt schon in ${referenzen}/. Erzeuge keine neue Grundpose; nimm sie als Referenz für Posen und Szenen.`;
	}
	const da = posenFuerLauf(figur).find((p) => p.id === `${figur.id}-${bf.pose}`);
	return da
		? `Die Pose „${bf.pose}“ von ${figur.name} gibt es schon in der Bibliothek: ../../bilder/${posenDatei(da)}. Binde sie ein, statt sie neu zu erzeugen.`
		: null;
};
