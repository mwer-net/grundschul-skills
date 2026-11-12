import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { kann } from '@schoolbox/kern/src/bausteine';
import { istGestaltung } from '@schoolbox/kern/src/gestaltung';
import type { EbenenName } from '@schoolbox/kern/src/gestaltung-arten';
import type { Knoten, Zerlegung } from '@schoolbox/kern/src/quelltext';
import { attribut, klassenVon, MARKE, quelleVon } from '@schoolbox/kern/src/quelltext';
import type { SeitenTeil } from '@schoolbox/kern/src/seitengestaltung';
import { SEITEN_TEILE } from '@schoolbox/kern/src/seitengestaltung';
import type { Ablage } from '@schoolbox/kern/src/struktur';
import { seitenVon } from '@schoolbox/kern/src/struktur';

import { bausteinVon, liegtAlsBlock, nameVon, nrVon, trefferAn } from './darstellung';

/** Orientierung, aber kein Ziehen: Kopf und Fuß des Blatts und das Band des Themas. */
const FESTE_ARTEN = new Set(['namenszeile', 'kopf', 'fuss', 'themaband', 'themakopf']);
/**
 * Die Ebenen (`.ebene`) baut `gliederungVon` selbst als eigene Zeilen (101), Gestaltung am Anker als Kindzeilen ihres
 * Bausteins (106). Kinder einer Gruppe stehen aufklappbar unter ihr (120).
 */
const OHNE_ZEILE = '.loesung-marke, style, script, template, link, meta, br, .ebene, [data-lage]';

/**
 * Was eine Zeile ist (101, 1-ebenen.md „Aufbau des Baums“): ein Baustein wie bisher, ein Gestaltungselement in einer
 * Ebene, der gedachte Hauptstapel (ohne eigenes Element), das Kopfband unter ihm oder Seitenrahmen und Seitenfläche
 * zuunterst. `gruppe` ist ein
 * Kind einer Gruppe (120); seine Reihenfolge geht über die Befehle, nicht über den Zug in der Liste.
 */
type SeitenZeile = 'hauptstapel' | 'kopfband' | 'seitenrahmen' | 'seitenflaeche';
export type ZeilenArt = 'baustein' | EbenenName | SeitenZeile | 'anker' | 'flaeche' | 'gruppe';

/** Nach diesem Teil des Schlüssels erkennt `gliederung-stand`, dass der Hauptstapel ohne Zutun offen steht. */
export const HAUPTSTAPEL = 'hauptstapel';

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
	zeile: ZeilenArt;
	/** Die Art im Register (`aufgabe`, `figurfrei`), für das Symbol der Zeile; beim Hauptstapel `hauptstapel`. */
	kennung: string;
	/** `data-aus`: ausgeblendet, nicht im Blatt und nicht im Druck. */
	aus: boolean;
	/** `data-gesperrt`: im Blatt nicht wählbar, hier schon. */
	gesperrt: boolean;
	/** `data-name`, sonst `null`; damit beginnt das Umbenennen. */
	eigenerName: string | null;
	/** Nur Gestaltung in einer Ebene: Nummer der `.seite` und Platz von vorne (0 liegt ganz vorne). */
	lage: { seite: number; platz: number } | null;
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

const gross = (text: string) => (text ? `${text[0]?.toUpperCase() ?? ''}${text.slice(1)}` : '');

const SCHMUCK_LAENGE = 40;

const kuerze = (text: string) => (text.length > SCHMUCK_LAENGE ? `${text.slice(0, SCHMUCK_LAENGE - 1)}…` : text);

export interface GestaltungAngaben {
	/** Art im Register, z. B. `bildfrei`. */
	art: string;
	/** Der Name wie im Pfad (`nameVon`): `data-name`, Figur oder Name der Art. */
	name: string;
	wert: (attribut: string) => string | null;
	/** Der sichtbare Text, Leerraum zusammengezogen. */
	text: string;
	/** Teile einer Streuung oder Gruppe. */
	teile: number;
}

/** Die Beschriftung einer Gestaltungszeile (1-ebenen.md, „Beschriftung“). `data-name` geht allem vor. */
export const titelDerGestaltung = ({ art, name, teile, text, wert }: GestaltungAngaben) => {
	if (wert('data-name')?.trim()) {
		return name;
	}
	const form = gross((wert('data-form') ?? '').trim().replace(/[-_]+/g, ' '));
	switch (art) {
		case 'bildfrei': {
			const datei =
				(wert('src') ?? '')
					.split(/[?#]/)[0]
					?.split('/')
					.at(-1)
					?.replace(/\.[^.]+$/, '') ?? '';
			return wert('alt')?.trim() || datei || name;
		}
		case 'form':
			return form || name;
		case 'formtext':
			return text ? `${form || name} „${kuerze(text)}“` : form || name;
		case 'schmuck':
		case 'schmuckbogen':
			return kuerze(text) || name;
		case 'streuung':
			return `${gross((wert('data-streuung') ?? '').trim()) || name} (${teile})`;
		case 'gruppe':
			return `${name} (${teile})`;
		default:
			return name;
	}
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

/** 106: Was am Baustein hängt, das vorderste (in der Quelle letzte) zuerst. */
export const ankerIn = (z: Zerlegung, nr: number) =>
	(z.knoten[nr]?.kinder ?? [])
		.filter((k) => istGestaltung(k) && attribut(k, 'data-anker') !== undefined)
		.map((k) => k.nr)
		.reverse();

const alleRoh = (roh: Roh[]): Roh[] => roh.flatMap((r) => [r, ...alleRoh(r.kinder)]);

const istFest = (baustein: Baustein) => !kann(baustein, 'ordnen') || FESTE_ARTEN.has(baustein.art);

/** Was in den Ebenen einer Seite liegt, je Ebene das Vorderste zuerst (also umgekehrt zur Quelle). */
export interface EbenenTeile {
	vorne: number[];
	hinten: number[];
	kopfband: number | null;
	seitenrahmen: number | null;
	seitenflaeche: number | null;
}

/**
 * Liest die Ebenen aus der Zerlegung: Gestaltungselemente in `.ebene.vorne` und `.ebene.hinten`, dazu Seitenfläche,
 * Seitenrahmen und Kopfband, die zuunterst in `.ebene.hinten` liegen. Was in einem Element liegt (Teile einer Streuung,
 * Kinder einer Gruppe), hat keine eigene Zeile.
 */
export const ebenenTeile = (seite: Knoten): EbenenTeile => {
	const teile: EbenenTeile = { vorne: [], hinten: [], kopfband: null, seitenrahmen: null, seitenflaeche: null };
	for (const ebene of seite.kinder) {
		const klassen = klassenVon(ebene);
		const name = klassen.includes('ebene') ? (['vorne', 'hinten'] as const).find((n) => klassen.includes(n)) : null;
		if (!name) {
			continue;
		}
		for (const k of ebene.kinder) {
			if (istGestaltung(k)) {
				teile[name].unshift(k.nr);
			} else if (name === 'hinten') {
				const teil = SEITEN_TEILE.find((t) => klassenVon(k).includes(t));
				if (teil) {
					teile[teil] ??= k.nr;
				}
			}
		}
	}
	return teile;
};

export interface SeitenZeilen<T> {
	vorne: readonly T[];
	stapel: readonly T[];
	hinten: readonly T[];
	kopfband: T | null;
	seitenrahmen: T | null;
	seitenflaeche: T | null;
}

/**
 * Die Zeilen einer Seite von oben nach unten: vorne, Hauptstapel, Kopfband, hinten, Seitenrahmen, Seitenfläche. Das
 * Kopfband steht im HTML vor allem, was hinten liegt, wird aber darüber gezeichnet (181); die Zeilen zeigen, was man
 * sieht. Ohne Gestaltung gibt es keinen Hauptstapel, die Bausteine hängen wie vor 101 direkt an der Seite.
 */
export const ordneSeite = <T>(z: SeitenZeilen<T>, hauptstapel: (stapel: readonly T[]) => T): T[] => {
	const oben = [z.kopfband].filter((t): t is T => t !== null);
	const unten = [z.seitenrahmen, z.seitenflaeche].filter((t): t is T => t !== null);
	if (z.vorne.length === 0 && z.hinten.length === 0 && oben.length === 0 && unten.length === 0) {
		return [...z.stapel];
	}
	return [...z.vorne, hauptstapel(z.stapel), ...oben, ...z.hinten, ...unten];
};

/** Die Bausteine einer Seite, ob sie direkt an ihr hängen oder unter dem Hauptstapel. */
export const stapelVon = (s: Pick<GliederungSeite, 'kinder'>): GliederungKnoten[] =>
	s.kinder.flatMap((k) => {
		if (k.zeile === 'hauptstapel') {
			return k.kinder;
		}
		return k.zeile === 'baustein' ? [k] : [];
	});

/** Die Teile einer Streuung (Formen, ohne `defs`) bzw. die Elemente einer Gruppe. */
const teileVon = (element: Element, art: string) => {
	if (art === 'gruppe') {
		return element.querySelectorAll(':scope > [data-lage]').length;
	}
	return [...element.querySelectorAll('*')].filter((e) => e.children.length === 0 && !e.closest('defs')).length;
};

const OHNE_STAPEL = { zeile: 'baustein', aus: false, gesperrt: false, eigenerName: null, lage: null } as const;

/**
 * Die Struktur steht in der Zerlegung, Namen und Titel im Dokument: Erzeugte Seiten der Darstellung tauchen so nicht auf.
 * Jeder Baustein, der sich im Blatt wählen lässt, hat eine Zeile, in der Tiefe, in der er im Blatt liegt. Gestaltung
 * steht nach den Ebenen geordnet darüber und darunter (101), Ausgeblendetes mit.
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
	/** Eine Zeile der Ebenen; `null`, wenn das Element nicht in der Darstellung steht. */
	const gestaltung = (
		nr: number,
		zeile: Exclude<ZeilenArt, 'baustein' | 'hauptstapel'>,
		schluessel: string,
		lage: GliederungKnoten['lage'],
	): GliederungKnoten | null => {
		const element = elemente.get(nr);
		const baustein = element ? bausteinVon(element) : undefined;
		if (!element || !baustein) {
			return null;
		}
		// Keine Prüfung auf Fläche wie bei Bausteinen: Ausgeblendetes (`data-aus`) und in s/w Weggelassenes (`data-sw`)
		// hat keine, gehört aber gerade hierher, sonst käme man nie wieder heran.
		const name = nameVon({ nr, baustein, element }, null);
		const wert = (a: string) => element.getAttribute(a);
		const unten = zeile === 'kopfband' || zeile === 'seitenrahmen' || zeile === 'seitenflaeche';
		return {
			nr,
			titel: unten
				? name
				: titelDerGestaltung({
						art: baustein.art,
						name,
						wert,
						text: textVon(element),
						teile: teileVon(element, baustein.art),
					}),
			nummer: null,
			name,
			art: baustein.name,
			aufgabe: false,
			fest: unten,
			// 115: Kinder einer Fläche bleiben in ihrer Fläche; ihre Reihenfolge ändern Befehle, nicht der Zug in der Liste.
			ziehbar: !unten && zeile !== 'flaeche' && zeile !== 'gruppe',
			schluessel,
			// 120: Die Kinder einer Gruppe, das vorderste zuerst (wie in einer Ebene).
			kinder:
				baustein.art === 'gruppe'
					? (z.knoten[nr]?.kinder ?? [])
							.filter((k) => istGestaltung(k))
							.map((k) => k.nr)
							.reverse()
							.map((n, i) => gestaltung(n, 'gruppe', `${schluessel}/gruppe/${i}`, null))
							.filter((k): k is GliederungKnoten => k !== null)
					: [],
			zeile,
			kennung: baustein.art,
			aus: element.hasAttribute('data-aus'),
			gesperrt: element.hasAttribute('data-gesperrt'),
			eigenerName: wert('data-name')?.trim() || null,
			lage,
		};
	};
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
			// 106: Elemente am Anker oben im Zweig ihres Bausteins (1-ebenen.md, „Hauptstapel“).
			kinder: [
				...ankerIn(z, r.nr)
					.map((nr, i) => gestaltung(nr, 'anker', `${schluessel}/anker/${i}`, null))
					.filter((k): k is GliederungKnoten => k !== null),
				// 115: Die Elemente in einer Fläche, das vorderste zuerst (wie am Anker).
				...(r.baustein.art === 'flaeche'
					? (z.knoten[r.nr]?.kinder ?? [])
							.filter((k) => istGestaltung(k))
							.map((k) => k.nr)
							.reverse()
							.map((nr, i) => gestaltung(nr, 'flaeche', `${schluessel}/flaeche/${i}`, null))
							.filter((k): k is GliederungKnoten => k !== null)
					: []),
				...r.kinder.map((k, i) => baue(k, `${schluessel}/${i}:${k.baustein.art}`)),
			],
			...OHNE_STAPEL,
			kennung: r.baustein.art,
		};
	};
	return seiten.map((seite, i) => {
		const id = ids[i] ?? -i - 1;
		const schluessel = String(id);
		const stapel = (roh[i] ?? []).map((r, j) => baue(r, `${schluessel}/${j}:${r.baustein.art}`));
		const teile = ebenenTeile(seite);
		const ebene = (name: EbenenName) =>
			teile[name]
				.map((nr, platz) => gestaltung(nr, name, `${schluessel}/${name}/${platz}`, { seite: seite.nr, platz }))
				.filter((k): k is GliederungKnoten => k !== null);
		const unten = (name: SeitenTeil) => {
			const nr = teile[name];
			return nr === null ? null : gestaltung(nr, name, `${schluessel}/${name}`, null);
		};
		return {
			id,
			nr: seite.nr,
			schluessel,
			kinder: ordneSeite(
				{
					vorne: ebene('vorne'),
					stapel,
					hinten: ebene('hinten'),
					kopfband: unten('kopfband'),
					seitenrahmen: unten('seitenrahmen'),
					seitenflaeche: unten('seitenflaeche'),
				},
				(kinder): GliederungKnoten => ({
					// Keine Zahl der Quelle: negativ, damit sie keine Auswahl trifft.
					nr: -seite.nr - 1,
					titel: 'Hauptstapel',
					nummer: null,
					name: 'Hauptstapel',
					art: 'Hauptstapel',
					aufgabe: false,
					fest: false,
					ziehbar: false,
					schluessel: `${schluessel}/${HAUPTSTAPEL}`,
					kinder: [...kinder],
					...OHNE_STAPEL,
					zeile: 'hauptstapel',
					kennung: HAUPTSTAPEL,
				}),
			),
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
