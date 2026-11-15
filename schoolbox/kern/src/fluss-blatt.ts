/**
 * Blätter (206): eine feste Seite mit den automatischen Seiten direkt dahinter. Eine automatische Seite trägt
 * `data-weiter="auto"` und entsteht nur durch den Fluss des Editors; jede andere Seite ist fest, auch `data-weiter` ohne
 * Wert aus den Skills. Hier steht nur, was sich an der Quelle ohne Messen erkennen lässt. Kein CSS und kein Skript der
 * Skills liest den Wert `auto`, Druck und PDF bleiben also gleich.
 */

import { formatAusHtml } from './html';
import type { Knoten, Zerlegung } from './quelltext';
import { attribut, einrueckung, klassenVon, quelleVon, rueckeUm } from './quelltext';
import type { Format } from './werte';

export const WEITER = 'data-weiter';
export const AUTOMATISCH = 'auto';

/** Nur diese Formate fließen; Folie, Mini-Book und A3 bleiben feste Seiten (Regel 4). */
export const FLIESSENDE_FORMATE: readonly Format[] = ['a4-hoch', 'a4-quer', 'a5-hoch'];

/** Kinder der Seite, die nicht im Stapel stehen oder auf der festen Seite bleiben (Regel 10). */
const NICHT_IM_FLUSS = ['namenszeile', 'kopf', 'loesung-marke', 'fuss-zeile', 'ebene'];
const KEIN_BLOCK = new Set(['style', 'script', 'template', 'link', 'meta', 'br', 'noscript']);
/** Was eine automatische Seite aus `.ebene.hinten` der Seite davor übernimmt (Regel 12). */
export const UEBERNOMMEN_HINTEN = ['seitenflaeche', 'seitenrahmen'];
/**
 * N09: Ohne Kopf darüber zöge `.nr` (negativer Rand in `blatt.css`, bei kleiner Schrift bis etwa 4 px) die erste
 * Aufgabe einer Folgeseite in den Seitenrand. Die Seite, die der Fluss anlegt, bringt dafür eine Regel mit (kein
 * Flussblock, `KEIN_BLOCK`); `blatt.css` bleibt, wie es ist (26).
 */
export const FOLGESEITE_STIL =
	'.seite[data-weiter]>.aufgabe:not(.aufgabe~.aufgabe)>.nr{margin-top:max(0px,(var(--fs)*1.4 - 34px)/2)}';
/** Seitengestaltung; alles andere in einer Ebene ist freie Gestaltung der Lehrkraft (Regel 15). */
const SEITENTEILE = ['seitenflaeche', 'seitenrahmen', 'kopfband'];
const UEBERSCHRIFTEN = new Set(['h1', 'h2', 'h3']);

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

export const istSeite = (k: Knoten | null | undefined) => hat(k, 'seite');

export const istAutomatisch = (k: Knoten | null | undefined) =>
	Boolean(k && istSeite(k) && attribut(k, WEITER)?.wert === AUTOMATISCH);

export const istFuss = (k: Knoten | null | undefined) => hat(k, 'fuss');

export const istUeberschrift = (k: Knoten | null | undefined) => Boolean(k && UEBERSCHRIFTEN.has(k.tag));

/** Ein direktes Kind der Seite, das im Stapel steht und von Seite zu Seite wandern darf. */
export const istFlussblock = (k: Knoten) =>
	!KEIN_BLOCK.has(k.tag) &&
	!klassenVon(k).some((c) => NICHT_IM_FLUSS.includes(c)) &&
	attribut(k, 'data-lage') === undefined;

const liegtInSeite = (k: Knoten) => {
	for (let e = k.eltern; e; e = e.eltern) {
		if (istSeite(e)) {
			return true;
		}
	}
	return false;
};

/** Die Seiten des Dokuments ohne die verkleinerten Folien in „Folien mit Notizen“. */
export const aeussereSeiten = (z: Zerlegung) => z.knoten.filter((k) => istSeite(k) && !liegtInSeite(k));

export interface BlattSeite {
	nr: number;
	automatisch: boolean;
	/** Die Flussblöcke in der Reihenfolge der Quelle. */
	bloecke: number[];
}

export interface Blatt {
	seiten: BlattSeite[];
	/** Regel 4, soweit die Quelle es zeigt; ob `abbildungen.js` Seiten erzeugt, weiß erst das gerenderte Blatt. */
	fliesst: boolean;
	/** Alle Flussblöcke des Blatts in Flussreihenfolge: wie in der Quelle, der Fuß zuletzt (Regel 8). */
	folge: number[];
	fuss: number | null;
}

const enthaeltKlasse = (z: Zerlegung, seite: Knoten, klasse: string) =>
	z.knoten.some((k) => k.start > seite.start && k.ende <= seite.ende && hat(k, klasse));

/** Nur die Klasse `seite`, keine Karten (Regel 4). */
const seiteFliesst = (z: Zerlegung, seite: Knoten) =>
	klassenVon(seite).every((c) => c === 'seite') && !enthaeltKlasse(z, seite, 'karten');

const folgtDirekt = (davor: Knoten, seite: Knoten) => {
	const geschwister = davor.eltern?.kinder;
	return Boolean(
		geschwister && seite.eltern === davor.eltern && geschwister[geschwister.indexOf(davor) + 1] === seite,
	);
};

export const flussbloeckeVon = (seite: Knoten) => seite.kinder.filter(istFlussblock).map((k) => k.nr);

export const blaetterVon = (z: Zerlegung): Blatt[] => {
	const formatFliesst = FLIESSENDE_FORMATE.includes(formatAusHtml(z.quelle));
	const gruppen: Knoten[][] = [];
	for (const seite of aeussereSeiten(z)) {
		const gruppe = gruppen.at(-1);
		const letzte = gruppe?.at(-1);
		if (gruppe && letzte && istAutomatisch(seite) && folgtDirekt(letzte, seite)) {
			gruppe.push(seite);
		} else {
			gruppen.push([seite]);
		}
	}
	return gruppen.map((gruppe) => {
		const seiten = gruppe.map((s) => ({ nr: s.nr, automatisch: istAutomatisch(s), bloecke: flussbloeckeVon(s) }));
		const alle = seiten.flatMap((s) => s.bloecke);
		const fuss = alle.findLast((nr) => istFuss(z.knoten[nr])) ?? null;
		return {
			seiten,
			fliesst: formatFliesst && gruppe.every((s) => seiteFliesst(z, s)),
			folge: fuss === null ? alle : [...alle.filter((nr) => nr !== fuss), fuss],
			fuss,
		};
	});
};

/** Das Blatt, zu dem die Seite `nr` (oder ein Element darin) gehört. */
export const blattZu = (z: Zerlegung, nr: number) => {
	let k: Knoten | null | undefined = z.knoten[nr];
	while (k && !(istSeite(k) && !liegtInSeite(k))) {
		k = k.eltern;
	}
	return k ? (blaetterVon(z).find((b) => b.seiten.some((s) => s.nr === k?.nr)) ?? null) : null;
};

/** Liegt auf der Seite freie Gestaltung der Lehrkraft (mehr als Seitenfläche, Seitenrahmen, Kopfband)? */
export const hatFreieGestaltung = (seite: Knoten) =>
	seite.kinder.some(
		(k) =>
			attribut(k, 'data-lage') !== undefined ||
			(hat(k, 'ebene') && k.kinder.some((c) => !klassenVon(c).some((name) => SEITENTEILE.includes(name)))),
	);

const EINZUG = '  ';

/** Einrückung der Kinder einer Seite: wie das erste Kind, sonst zwei Leerzeichen mehr als die Seite. */
export const kinderEinzug = (z: Zerlegung, seite: Knoten) => {
	const erstes = seite.kinder.find((k) => einrueckung(z, k) !== null);
	return (erstes && einrueckung(z, erstes)) ?? `${einrueckung(z, seite) ?? ''}${EINZUG}`;
};

const kopie = (z: Zerlegung, k: Knoten, einzug: string) => rueckeUm(quelleVon(z, k), einrueckung(z, k), einzug);

/**
 * Eine Folgeseite nach Regel 12, wie die Folgeseiten der Skills: gleiches Element wie `vorlage`, keine Namenszeile,
 * kein Kopf. Als Kopie kommen die Lösung-Marke, aus `.ebene.hinten` Seitenfläche und Seitenrahmen (nicht das Kopfband,
 * keine freien Elemente) und die `.fuss-zeile`. `inhalt` sind die Blöcke, schon mit der Einrückung der Kinder.
 * Automatisch (`data-weiter="auto"`) oder fest (`data-weiter` ohne Wert, für den festen Umbruch). Die erste Zeile
 * steht ohne Einrückung, wie `fuegeEin` sie erwartet.
 */
export const automatischeSeite = (
	z: Zerlegung,
	vorlage: Knoten,
	{ fest = false, inhalt = [] }: { inhalt?: string[]; fest?: boolean } = {},
) => {
	const einzug = einrueckung(z, vorlage) ?? '';
	const innen = kinderEinzug(z, vorlage);
	const marke = vorlage.kinder.filter((k) => hat(k, 'loesung-marke'));
	const fusszeile = vorlage.kinder.filter((k) => hat(k, 'fuss-zeile'));
	const hinten = vorlage.kinder
		.filter((k) => hat(k, 'ebene') && hat(k, 'hinten'))
		.flatMap((ebene) => {
			const teile = ebene.kinder.filter((c) => klassenVon(c).some((name) => UEBERNOMMEN_HINTEN.includes(name)));
			if (teile.length === 0) {
				return [];
			}
			const tiefer = `${innen}${EINZUG}`;
			const oeffner = z.quelle.slice(ebene.start, ebene.oeffnerEnde);
			const kinder = teile.map((t) => `${tiefer}${kopie(z, t, tiefer)}`);
			return [`${oeffner}\n${kinder.join('\n')}\n${innen}</${ebene.tag}>`];
		});
	const zeilen = [
		`<style>${FOLGESEITE_STIL}</style>`,
		...marke.map((k) => kopie(z, k, innen)),
		...inhalt,
		...fusszeile.map((k) => kopie(z, k, innen)),
		...hinten,
	];
	const oeffner = `<${vorlage.tag} class="seite" ${fest ? WEITER : `${WEITER}="${AUTOMATISCH}"`}>`;
	const schliesser = `</${vorlage.tag}>`;
	return `${oeffner}\n${zeilen.map((zeile) => `${innen}${zeile}`).join('\n')}\n${einzug}${schliesser}`;
};
