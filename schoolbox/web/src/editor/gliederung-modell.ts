import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { kann } from '@schoolbox/kern/src/bausteine';
import type { Knoten, Zerlegung } from '@schoolbox/kern/src/quelltext';
import { klassenVon, MARKE, quelleVon } from '@schoolbox/kern/src/quelltext';
import type { Ablage } from '@schoolbox/kern/src/struktur';
import { seitenVon } from '@schoolbox/kern/src/struktur';

import { bausteinVon, liegtAlsBlock, nameVon, nrVon, trefferAn } from './darstellung';

/** Orientierung, aber kein Ziehen: Kopf und Fuß des Blatts und das Band des Themas. */
const FESTE_ARTEN = new Set(['namenszeile', 'kopf', 'fuss', 'themaband', 'themakopf']);
const OHNE_ZEILE = '.loesung-marke, style, script, template, link, meta, br';

/** Ein Baustein in der Gliederung, mit allem, was im Blatt darin wählbar ist. */
export interface GliederungKnoten {
	nr: number;
	/** Eine Aufgabe trägt ihren Text, ein Text seinen Anfang, alles andere den Namen aus dem Register. */
	titel: string;
	nummer: string | null;
	/** Wie im Pfad des Inspektors, etwa „Aufgabe 2“ oder „Uhr“; auch für das Etikett am Zeiger. */
	name: string;
	/** Name im Register, für den Griff und den Schritt im Verlauf. */
	art: string;
	aufgabe: boolean;
	fest: boolean;
	/** Gibt es überhaupt einen anderen Platz? Sonst hat die Zeile keinen Griff. */
	ziehbar: boolean;
	/** Für das Einklappen: Seite und Platz im Baum, gleich über Änderungen hinweg, solange sich die Lage nicht ändert. */
	schluessel: string;
	kinder: GliederungKnoten[];
}

export interface GliederungSeite {
	/** Bleibt, wenn sich die Nummern ändern oder die Seite wandert. */
	id: number;
	nr: number;
	schluessel: string;
	kinder: GliederungKnoten[];
}

export interface SeitenSpur {
	id: number;
	text: string;
}

const TEXT_TITEL_LAENGE = 80;

const textVon = (element: Element | null | undefined) =>
	(element?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, TEXT_TITEL_LAENGE);

const titelVon = (element: Element, baustein: Baustein, name: string) => {
	if (baustein.art === 'aufgabe') {
		return textVon(element.querySelector('.anw')) || name;
	}
	if (baustein.art !== 'anweisung' && kann(baustein, 'text')) {
		return textVon(element) || name;
	}
	return name;
};

/** Wo der Baustein hin darf, grob: Gleiche Gruppe heißt, er könnte dort neben einem anderen liegen (vgl. `ordnungVon`). */
const gruppeVon = (element: Element, baustein: Baustein) => {
	if (baustein.ordnenIn) {
		return `in:${baustein.art}`;
	}
	const eltern = element.parentElement;
	if (!baustein.ordnenInLeiste && liegtAlsBlock(element)) {
		return eltern?.matches('.seite') ? 'seite' : `block:${eltern ? nrVon(eltern) : ''}`;
	}
	return `${baustein.art}:${eltern ? nrVon(eltern) : ''}`;
};

interface Roh {
	nr: number;
	element: Element;
	baustein: Baustein;
	kinder: Roh[];
}

const rohIn = (elemente: ReadonlyMap<number, Element>, eltern: Knoten): Roh[] =>
	eltern.kinder.flatMap((k): Roh[] => {
		const element = elemente.get(k.nr);
		if (!element || element.matches(OHNE_ZEILE)) {
			return [];
		}
		const baustein = bausteinVon(element);
		if (!baustein) {
			return rohIn(elemente, k);
		}
		// Was gerade nicht zu sehen ist, etwa ein Lösungstext auf dem Arbeitsblatt, gehört nicht in die Liste.
		if (element.getClientRects().length === 0) {
			return [];
		}
		return [{ nr: k.nr, element, baustein, kinder: rohIn(elemente, k) }];
	});

const alleRoh = (roh: Roh[]): Roh[] => roh.flatMap((r) => [r, ...alleRoh(r.kinder)]);

const istFest = (baustein: Baustein) => !kann(baustein, 'ordnen') || FESTE_ARTEN.has(baustein.art);

/**
 * Die Struktur steht in der Zerlegung, Namen und Titel im Dokument: Erzeugte Seiten der Darstellung tauchen so nicht auf.
 * Jeder Baustein, der sich im Blatt wählen lässt, hat eine Zeile, in der Tiefe, in der er im Blatt liegt.
 */
export const gliederungVon = (doc: Document, z: Zerlegung, ids: readonly number[]): GliederungSeite[] => {
	const elemente = new Map<number, Element>();
	for (const e of doc.querySelectorAll(`[${MARKE}]`)) {
		const nr = nrVon(e);
		// Die Quelle-Seite steht vor ihren erzeugten Fortsetzungen, die dieselbe Nummer tragen.
		if (nr !== null && !elemente.has(nr)) {
			elemente.set(nr, e);
		}
	}
	const seiten = seitenVon(z);
	const roh = seiten.map((s) => rohIn(elemente, s));
	const gruppen = new Map<string, number>();
	for (const r of roh.flatMap(alleRoh)) {
		if (!istFest(r.baustein)) {
			const g = gruppeVon(r.element, r.baustein);
			gruppen.set(g, (gruppen.get(g) ?? 0) + 1);
		}
	}
	const mehrereSeiten = seiten.length > 1;
	// Auf der Seite liegt alles als Block zwischen allem anderen, Aufgaben wie freie Blöcke (vgl. `zieleFuer`).
	const aufSeite = roh.flatMap((r) => r.filter((x) => !istFest(x.baustein))).length;
	const baue = (r: Roh, schluessel: string): GliederungKnoten => {
		const umgebung = trefferAn(r.element.parentElement)?.element ?? null;
		const name = nameVon({ nr: r.nr, baustein: r.baustein, element: r.element }, umgebung);
		const aufgabe = r.baustein.art === 'aufgabe';
		const fest = istFest(r.baustein);
		const gruppe = gruppeVon(r.element, r.baustein);
		const ueberSeiten = gruppe === 'seite' || gruppe === `in:${r.baustein.art}`;
		const neben = r.element.parentElement?.matches('.seite')
			? Math.max(aufSeite, gruppen.get(gruppe) ?? 0)
			: (gruppen.get(gruppe) ?? 0);
		return {
			nr: r.nr,
			titel: titelVon(r.element, r.baustein, name),
			nummer: aufgabe ? (r.element.querySelector(':scope > .nr')?.textContent?.trim() ?? null) : null,
			name,
			art: r.baustein.name,
			aufgabe,
			fest,
			ziehbar: !fest && (neben > 1 || (ueberSeiten && mehrereSeiten)),
			schluessel,
			kinder: r.kinder.map((k, i) => baue(k, `${schluessel}/${i}:${k.baustein.art}`)),
		};
	};
	return seiten.map((seite, i) => {
		const id = ids[i] ?? -i - 1;
		const schluessel = String(id);
		return {
			id,
			nr: seite.nr,
			schluessel,
			kinder: (roh[i] ?? []).map((r, j) => baue(r, `${schluessel}/${j}:${r.baustein.art}`)),
		};
	});
};

/** Die Kette der Zeilen bis zu `nr`, von der Seite an; leer, wenn es die Zeile nicht gibt. */
export const ketteZu = (modell: readonly GliederungSeite[], nr: number): string[] => {
	const suche = (knoten: readonly GliederungKnoten[], weg: string[]): string[] | null => {
		for (const k of knoten) {
			if (k.nr === nr) {
				return [...weg, k.schluessel];
			}
			const tiefer = suche(k.kinder, [...weg, k.schluessel]);
			if (tiefer) {
				return tiefer;
			}
		}
		return null;
	};
	for (const s of modell) {
		if (s.nr === nr) {
			return [s.schluessel];
		}
		const weg = suche(s.kinder, [s.schluessel]);
		if (weg) {
			return weg;
		}
	}
	return [];
};

export const alleSchluessel = (modell: readonly GliederungSeite[]) => {
	const sammle = (k: GliederungKnoten): string[] =>
		k.kinder.length ? [k.schluessel, ...k.kinder.flatMap(sammle)] : [];
	return modell.flatMap((s) => [s.schluessel, ...s.kinder.flatMap(sammle)]);
};

/** Hätte die Ablage keine Wirkung? Der Nachbar in der Quelle, und ans Ende, wer dort schon als letztes steht. */
export const ohneWirkung = (z: Zerlegung, nr: number, ablage: Ablage) => {
	const k = z.knoten[nr];
	if (!k) {
		return true;
	}
	if ('in' in ablage) {
		const ziel = z.knoten[ablage.in];
		return ziel?.kinder.filter((kind) => !klassenVon(kind).includes('fuss')).at(-1) === k;
	}
	const geschwister = k.eltern?.kinder ?? [];
	const i = geschwister.indexOf(k);
	const ziel = z.knoten[ablage.nr];
	return (
		(ablage.wo === 'vor' && geschwister[i + 1] === ziel) || (ablage.wo === 'nach' && geschwister[i - 1] === ziel)
	);
};

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

/** Die Zeile, in der die Auswahl liegt: der gewählte Baustein selbst oder, falls er keine Zeile hat, der nächste darum. */
export const zeileZurAuswahl = (z: Zerlegung | null, nr: number | null, zeilen: ReadonlySet<number>) => {
	for (let k = nr === null ? null : (z?.knoten[nr] ?? null); k; k = k.eltern) {
		if (zeilen.has(k.nr)) {
			return k.nr;
		}
	}
	return null;
};
