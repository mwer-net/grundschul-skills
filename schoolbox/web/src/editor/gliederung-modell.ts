import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { kann } from '@schoolbox/kern/src/bausteine';
import type { Knoten, Zerlegung } from '@schoolbox/kern/src/quelltext';
import { klassenVon, quelleVon } from '@schoolbox/kern/src/quelltext';
import { seitenVon } from '@schoolbox/kern/src/struktur';

import { bausteinVon, elementZu, pfadZu } from './darstellung';

/** Orientierung, aber kein Ziehen: Kopf und Fuß des Blatts und das Band des Themas. */
const FESTE_ARTEN = new Set(['namenszeile', 'kopf', 'fuss', 'themaband', 'themakopf']);
const OHNE_ZEILE = '.loesung-marke, style, script, template, link, meta, br';

export interface GliederungZeile {
	nr: number;
	/** Eine Aufgabe trägt ihren Text und ihre Nummer, alles andere den Namen aus dem Register. */
	titel: string;
	nummer: string | null;
	/** Etwa „Aufgabe 2“, für das Etikett am Zeiger. */
	name: string;
	/** Name im Register, für den Griff und den Schritt im Verlauf. */
	art: string;
	aufgabe: boolean;
	fest: boolean;
}

export interface GliederungSeite {
	/** Bleibt, wenn sich die Nummern ändern oder die Seite wandert. */
	id: number;
	nr: number;
	zeilen: GliederungZeile[];
}

export interface SeitenSpur {
	id: number;
	text: string;
}

const hatKlasse = (k: Knoten, klasse: string) => klassenVon(k).includes(klasse);

const istZiehbar = (baustein: Baustein) => kann(baustein, 'ordnen') && !FESTE_ARTEN.has(baustein.art);

const zeileVon = (doc: Document, element: Element, nr: number, baustein: Baustein): GliederungZeile => {
	const name = pfadZu(doc, nr).at(-1)?.name ?? baustein.name;
	const aufgabe = baustein.art === 'aufgabe';
	const text = aufgabe ? element.querySelector('.anw')?.textContent?.replace(/\s+/g, ' ').trim() : '';
	return {
		nr,
		titel: text || name,
		nummer: aufgabe ? (element.querySelector(':scope > .nr')?.textContent?.trim() ?? null) : null,
		name,
		art: baustein.name,
		aufgabe,
		fest: !istZiehbar(baustein),
	};
};

/** Ein Rahmen um Aufgaben (frei gestaltetes Blatt) zählt nicht, seine Aufgaben schon. */
const zeilenIn = (doc: Document, eltern: Knoten): GliederungZeile[] =>
	eltern.kinder.flatMap((k) => {
		const element = elementZu(doc, k.nr);
		const baustein = element ? bausteinVon(element) : undefined;
		// Was gerade nicht zu sehen ist, etwa ein Lösungstext auf dem Arbeitsblatt, gehört nicht in die Liste.
		if (!element || !baustein || element.matches(OHNE_ZEILE) || element.getClientRects().length === 0) {
			return [];
		}
		if (baustein.art === 'block' && k.kinder.some((kind) => hatKlasse(kind, 'aufgabe'))) {
			return zeilenIn(doc, k);
		}
		return [zeileVon(doc, element, k.nr, baustein)];
	});

/** Die Struktur steht in der Zerlegung, die Titel im Dokument: Erzeugte Seiten der Darstellung tauchen so nicht auf. */
export const gliederungVon = (doc: Document, z: Zerlegung, ids: readonly number[]): GliederungSeite[] =>
	seitenVon(z).map((seite, i) => ({ id: ids[i] ?? -i - 1, nr: seite.nr, zeilen: zeilenIn(doc, seite) }));

/** Die neuen Nummern der Aufgaben dürfen eine gewanderte Seite nicht unkenntlich machen. */
const spurText = (text: string) =>
	text.replace(/(<[^>]*class="[^"]*\bnr\b[^"]*"[^>]*>)[^<]*/g, '$1').replace(/\s+/g, ' ');

export const seitenTexte = (z: Zerlegung) => seitenVon(z).map((k) => spurText(quelleVon(z, k)));

/**
 * Welche Seite welche war. Die Nummern taugen nicht: Sie ändern sich mit jedem Befehl, und eine Seite wandert auch über
 * Rückgängig. Darum erst gleicher Inhalt, wer sich geändert hat, behält seinen Platz, der Rest ist neu.
 */
export const seitenAbgleich = (alt: readonly SeitenSpur[], texte: readonly string[], neueId: () => number) => {
	const frei = new Set(alt);
	const neu = texte.map((text) => {
		const gleich = [...frei].find((s) => s.text === text);
		if (gleich) {
			frei.delete(gleich);
		}
		return gleich ?? null;
	});
	return texte.map((text, i): SeitenSpur => {
		const treffer = neu[i];
		if (treffer) {
			return treffer;
		}
		const amPlatz = alt[i];
		if (amPlatz && frei.has(amPlatz)) {
			frei.delete(amPlatz);
			return { id: amPlatz.id, text };
		}
		return { id: neueId(), text };
	});
};

/** Die Zeile, in der die Auswahl liegt: eine Aufgabe auch dann, wenn etwas in ihr gewählt ist. */
export const zeileZurAuswahl = (z: Zerlegung | null, nr: number | null, zeilen: ReadonlySet<number>) => {
	for (let k = nr === null ? null : (z?.knoten[nr] ?? null); k; k = k.eltern) {
		if (zeilen.has(k.nr)) {
			return k.nr;
		}
	}
	return null;
};

/** Die Seite (Stelle in der Quelle), in der ein Element liegt. */
export const seitenStelle = (z: Zerlegung | null, nr: number | null) => {
	const seiten = z ? seitenVon(z) : [];
	for (let k = nr === null ? null : (z?.knoten[nr] ?? null); k; k = k.eltern) {
		const i = seiten.indexOf(k);
		if (i !== -1) {
			return i;
		}
	}
	return null;
};
