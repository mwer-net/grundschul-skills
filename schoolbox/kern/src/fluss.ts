/**
 * Seiten laufen weiter (206): Der Editor misst, welcher Flussblock auf welche Seite eines Blatts passt (`plan`), der
 * Kern legt die Quelle danach um. Nur ganze Blöcke wandern, in der Reihenfolge der Quelle; feste Seiten bleiben, wie
 * sie sind, und automatische Seiten entstehen und verschwinden. Alles läuft über Text-Patches (`quelltext.ts`): Was
 * außerhalb der betroffenen Blätter steht, bleibt Zeichen für Zeichen, und hin und zurück ergibt dieselbe Quelle.
 */

import type { Blatt } from './fluss-blatt';
import { automatischeSeite, blaetterVon, hatFreieGestaltung, kinderEinzug } from './fluss-blatt';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import { einrueckung, entferne, fuegeEin, klassenVon, quelleVon, rueckeUm, wendeAn, zerlege } from './quelltext';

export * from './fluss-blatt';

/** Für ein Blatt (Nummer seiner ersten Seite): je Seite die Nummern ihrer Flussblöcke, in Flussreihenfolge. */
export interface BlattPlan {
	blatt: number;
	seiten: number[][];
}

export type FlussPlan = BlattPlan[];

export interface Umgelegt {
	quelle: string;
	/** Nummer eines Elements der alten Quelle in der neuen; `null`, wenn es nicht mehr da ist (Kopien leerer Seiten). */
	nummer: (alt: number) => number | null;
}

/** Was eine Seite außer ihren Flussblöcken trägt und das hinten steht: neue Blöcke kommen davor. */
const HINTEN = ['fuss-zeile', 'ebene'];
const steht = (k: Knoten) => klassenVon(k).some((c) => HINTEN.includes(c)) || k.attribute.some((a) => a.name === 'data-lage');

interface Einsatz {
	aenderung: Aenderung;
	/** Die eingesetzten Blöcke mit dem Text, unter dem sie in `aenderung.text` stehen. */
	bloecke: { nr: number; text: string }[];
}

const gleich = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Liegen die Blöcke schon so, wie der Plan sagt? Dann bleibt das Blatt unberührt. */
const schonSo = (z: Zerlegung, blatt: Blatt, seiten: number[][]) =>
	blatt.seiten.every((s, j) => gleich(s.bloecke, seiten[j] ?? [])) &&
	seiten.slice(blatt.seiten.length).every((s) => s.length === 0) &&
	blatt.seiten.every((s, j) => j === 0 || (seiten[j]?.length ?? 0) > 0 || hatFreieGestaltung(knoten(z, s.nr)));

const knoten = (z: Zerlegung, nr: number) => {
	const k = z.knoten[nr];
	if (!k) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	return k;
};

/** Der Plan muss genau die Flussblöcke des Blatts in ihrer Reihenfolge nennen, und keine Seite davor bleibt leer. */
const planGilt = (blatt: Blatt, seiten: number[][]) => {
	const letzte = seiten.findLastIndex((s) => s.length > 0);
	return gleich(seiten.flat(), blatt.folge) && seiten.slice(0, letzte + 1).every((s, j) => j === 0 || s.length > 0);
};

/** Eine Zeile, in der nur ein Kommentar steht. */
const KOMMENTARZEILE = /^[ \t]*<!--(?:(?!-->).)*-->[ \t]*$/;

/**
 * Was über einem Block auf eigener Zeile zu ihm gehört: Kommentarzeilen direkt darüber und eine Leerzeile, die ihn
 * (samt Kommentar) vom Block davor trennt. Beides wandert mit, wenn der Block die Seite verlässt, und kommt mit
 * zurück. So ergibt Hin und Zurück dieselbe Quelle (Regel 14).
 */
const vorspannVon = (z: Zerlegung, k: Knoten) => {
	if (einrueckung(z, k) === null) {
		return { kommentare: [] as string[], laenge: 0, leer: '' };
	}
	const kommentare: string[] = [];
	let anfang = z.quelle.lastIndexOf('\n', k.start - 1) + 1;
	let laenge = 0;
	while (anfang > 0) {
		const davor = z.quelle.lastIndexOf('\n', anfang - 2) + 1;
		const zeile = z.quelle.slice(davor, anfang - 1);
		if (!KOMMENTARZEILE.test(zeile)) {
			break;
		}
		kommentare.unshift(zeile.trim());
		laenge += anfang - davor;
		anfang = davor;
	}
	const leer = /\n([ \t]*\n)$/.exec(z.quelle.slice(0, anfang))?.[1] ?? '';
	return { kommentare, laenge, leer };
};

/** Wie `entferne`, aber mit dem, was über dem Block zu ihm gehört (`vorspannVon`). */
const entferneBlock = (z: Zerlegung, k: Knoten): Aenderung[] => {
	const { laenge, leer } = vorspannVon(z, k);
	return entferne(z, k).map((a) => ({ ...a, von: a.von - laenge - leer.length }));
};

/** Der Block mit seinen Kommentarzeilen, eingerückt mit `einzug`. */
const mitKommentaren = (kommentare: string[], text: string, einzug: string) =>
	[...kommentare, text].join(`\n${einzug}`);

/**
 * Setzt `texte` (Blöcke, schon eingerückt) auf der Seite ein: hinter den Block davor bzw. vor den danach, sonst
 * hinter das letzte bleibende Kind im Stapel (Kopf, Lösung-Marke …), vor das erste, oder ins leere Innere.
 */
const setzeEin = (
	z: Zerlegung,
	seite: Knoten,
	ort: { nach: Knoten | null; vor: Knoten | null; bleibt: (k: Knoten) => boolean },
	bloecke: Knoten[],
): Einsatz => {
	const innen = kinderEinzug(z, seite);
	const texte = bloecke.map((k) => ({ nr: k.nr, text: rueckeUm(quelleVon(z, k), einrueckung(z, k), innen) }));
	const vorspann = bloecke.map((k) => vorspannVon(z, k));
	/** Jeder Block mit seinen Kommentaren und seiner Leerzeile davor, wie er stand, als ganze Zeilen. */
	const zeilen = (einzug: string) =>
		texte.map((t, i) => {
			const v = vorspann[i];
			return `${v?.leer ?? ''}${einzug}${mitKommentaren(v?.kommentare ?? [], t.text, einzug)}\n`;
		});
	const neben = (ziel: Knoten, wo: 'vor' | 'nach'): Einsatz => {
		const einzug = einrueckung(z, ziel);
		const rest = /^[ \t]*\n/.exec(z.quelle.slice(ziel.ende))?.[0];
		if (einzug === null || (wo === 'nach' && rest === undefined)) {
			const html = texte.map((t) => t.text).join(einzug === null ? '' : `\n${einzug}`);
			const [aenderung] = fuegeEin(z, ziel, wo, html);
			if (!aenderung) {
				throw new Error('Der Block lässt sich hier nicht einsetzen.');
			}
			return { aenderung, bloecke: texte };
		}
		// Vor `ziel` heißt: vor das, was über ihm zu ihm gehört.
		const v = vorspannVon(z, ziel);
		const pos =
			wo === 'vor'
				? z.quelle.lastIndexOf('\n', ziel.start - 1) + 1 - v.laenge - v.leer.length
				: ziel.ende + (rest?.length ?? 0);
		return { aenderung: { von: pos, bis: pos, text: zeilen(einzug).join('') }, bloecke: texte };
	};
	if (ort.nach) {
		return neben(ort.nach, 'nach');
	}
	if (ort.vor) {
		return neben(ort.vor, 'vor');
	}
	const bleibend = seite.kinder.filter(ort.bleibt);
	const davor = bleibend.filter((k) => !steht(k)).at(-1);
	if (davor) {
		return neben(davor, 'nach');
	}
	const erstes = bleibend[0];
	if (erstes) {
		return neben(erstes, 'vor');
	}
	// Alle Kinder wandern weg: an der Stelle des ersten, sonst ins leere Innere.
	const weg = seite.kinder[0];
	if (weg) {
		const [bereich] = entferneBlock(z, weg);
		const eigeneZeile = einrueckung(z, weg) !== null;
		const text = eigeneZeile ? zeilen(innen).join('') : texte.map((t) => t.text).join('');
		const pos = bereich?.von ?? weg.start;
		return { aenderung: { von: pos, bis: pos, text }, bloecke: texte };
	}
	const aussen = einrueckung(z, seite) ?? '';
	return {
		aenderung: {
			von: seite.oeffnerEnde,
			bis: seite.schliesserStart,
			text: `\n${zeilen(innen).join('')}${aussen}`,
		},
		bloecke: texte,
	};
};

/** Die Änderungen für ein Blatt; zurück kommen die Blöcke, die an anderer Stelle neu entstehen. */
const legeBlattUm = (z: Zerlegung, blatt: Blatt, seiten: number[][], einsaetze: Einsatz[], weg: Aenderung[]) => {
	const vorhanden = blatt.seiten.map((s) => knoten(z, s.nr));
	const entfaellt = new Set(
		vorhanden.filter(
			(s, j) => j > 0 && blatt.seiten[j]?.automatisch && (seiten[j]?.length ?? 0) === 0 && !hatFreieGestaltung(s),
		),
	);
	const bewegt = new Set<number>();
	vorhanden.forEach((seite, j) => {
		if (entfaellt.has(seite)) {
			weg.push(...entferne(z, seite));
			return;
		}
		const jetzt = blatt.seiten[j]?.bloecke ?? [];
		const soll = seiten[j] ?? [];
		// Was in der richtigen Reihenfolge schon auf der Seite steht, bleibt liegen.
		const bleibt = new Set<number>();
		let zuletzt = -1;
		for (const nr of soll) {
			const k = knoten(z, nr);
			if (jetzt.includes(nr) && k.start > zuletzt) {
				bleibt.add(nr);
				zuletzt = k.start;
			}
		}
		for (const nr of jetzt.filter((n) => !bleibt.has(n))) {
			weg.push(...entferneBlock(z, knoten(z, nr)));
		}
		const bleibtKind = (k: Knoten) => !jetzt.includes(k.nr) || bleibt.has(k.nr);
		// Folgen neuer Blöcke zwischen den bleibenden, je an den Block davor gehängt.
		let lauf: Knoten[] = [];
		let davor: Knoten | null = null;
		const schliesse = (danach: Knoten | null) => {
			if (lauf.length > 0) {
				einsaetze.push(setzeEin(z, seite, { nach: davor, vor: danach, bleibt: bleibtKind }, lauf));
				lauf.forEach((k) => bewegt.add(k.nr));
			}
			lauf = [];
		};
		for (const nr of soll) {
			const k = knoten(z, nr);
			if (bleibt.has(nr)) {
				schliesse(k);
				davor = k;
			} else {
				lauf.push(k);
			}
		}
		schliesse(null);
	});
	const neue = seiten.slice(vorhanden.length).filter((s) => s.length > 0);
	const letzte = vorhanden.findLast((s) => !entfaellt.has(s));
	const vorlage = vorhanden[0];
	if (neue.length > 0 && letzte && vorlage) {
		const innen = kinderEinzug(z, vorlage);
		const bloecke = neue.map((s) =>
			s.map((nr) => {
				const k = knoten(z, nr);
				bewegt.add(nr);
				return { nr, text: rueckeUm(quelleVon(z, k), einrueckung(z, k), innen) };
			}),
		);
		/** Die Folgeseite; jeder Block bringt seine Kommentare und seine Leerzeile davor mit. */
		const seite = (b: { nr: number; text: string }[]) => {
			const vor = b.map((t) => vorspannVon(z, knoten(z, t.nr)));
			const inhalt = b.map((t, i) => mitKommentaren(vor[i]?.kommentare ?? [], t.text, innen));
			let html = automatischeSeite(z, vorlage, { inhalt });
			inhalt.forEach((zeile, i) => {
				const leer = vor[i]?.leer ?? '';
				const stelle = html.indexOf(`\n${innen}${zeile}`);
				if (leer !== '' && stelle >= 0) {
					html = `${html.slice(0, stelle + 1)}${leer}${html.slice(stelle + 1)}`;
				}
			});
			return html;
		};
		const html = bloecke
			.map(seite)
			.join(`\n${einrueckung(z, letzte) ?? ''}`);
		const [aenderung] = fuegeEin(z, letzte, 'nach', html);
		if (aenderung) {
			einsaetze.push({ aenderung, bloecke: bloecke.flat() });
		}
	}
	return bewegt;
};

const versatz = (a: Aenderung) => a.text.length - (a.bis - a.von);

/**
 * Legt die Flussblöcke nach `plan` um: verschiebt sie mit Patches, legt automatische Seiten an, entfernt leere
 * (Regel 15) und lässt den Fuß ans Ende (Regel 8; er steht im Plan zuletzt). Blätter, die der Plan nicht nennt oder
 * die schon so liegen, bleiben Zeichen für Zeichen. Die Nummern bleiben, wie sie stehen: Der Fluss ändert die
 * Reihenfolge nie, und ein Material zählt je Seite, je Blatt oder durch (206, Nachbesserung 2).
 */
export const legeUm = (quelle: string, plan: FlussPlan): Umgelegt => {
	const z = zerlege(quelle);
	const blaetter = blaetterVon(z);
	const einsaetze: Einsatz[] = [];
	const weg: Aenderung[] = [];
	const bewegt = new Set<number>();
	for (const { blatt: erste, seiten } of plan) {
		const blatt = blaetter.find((b) => b.seiten[0]?.nr === erste);
		if (!blatt || !planGilt(blatt, seiten) || schonSo(z, blatt, seiten)) {
			continue;
		}
		legeBlattUm(z, blatt, seiten, einsaetze, weg).forEach((nr) => bewegt.add(nr));
	}
	if (einsaetze.length === 0 && weg.length === 0) {
		return { quelle, nummer: (nr) => (z.knoten[nr] ? nr : null) };
	}
	const alle = [...weg, ...einsaetze.map((e) => e.aenderung)];
	const neu = wendeAn(quelle, alle);
	const nz = zerlege(neu);
	const anStelle = new Map(nz.knoten.map((k) => [k.start, k.nr]));
	/** Wohin eine Stelle der alten Quelle rückt, die keine Änderung überdeckt. */
	const verschoben = (pos: number) => alle.reduce((p, a) => (a.bis <= pos ? p + versatz(a) : p), pos);
	const neuerStart = new Map<number, number>();
	for (const e of einsaetze) {
		const vorn = alle.reduce((p, a) => (a !== e.aenderung && a.bis <= e.aenderung.von ? p + versatz(a) : p), 0);
		let cursor = 0;
		for (const b of e.bloecke) {
			const offset = e.aenderung.text.indexOf(b.text, cursor);
			cursor = offset + b.text.length;
			neuerStart.set(b.nr, e.aenderung.von + vorn + offset);
		}
	}
	const imWeg = (pos: number) => weg.some((a) => a.von <= pos && pos < a.bis);
	const nummern = z.knoten.map((k): number | null => {
		for (let e: Knoten | null = k; e; e = e.eltern) {
			const start = bewegt.has(e.nr) ? neuerStart.get(e.nr) : undefined;
			if (start !== undefined) {
				const wurzel = anStelle.get(start);
				return wurzel === undefined ? null : wurzel + (k.nr - e.nr);
			}
		}
		return imWeg(k.start) ? null : (anStelle.get(verschoben(k.start)) ?? null);
	});
	return { quelle: neu, nummer: (nr) => nummern[nr] ?? null };
};

/** Höchstens so viele Blätter misst ein Schritt, der das ganze Material betrifft (z. B. Abstand, Klasse, Format). */
export const MAX_BLAETTER = 40;

/** Was in `.nr` steht, zählen Schritte wie Einfügen neu; es ändert kein Blatt (Regel 3). */
const NR_INHALT = /(<span\b[^>]*\bclass="(?:[^"]*\s)?nr(?:\s[^"]*)?"[^>]*>)[^<]*(<\/span>)/g;
const ohneNummern = (text: string) => text.replace(NR_INHALT, '$1$2');

const blattTexte = (z: Zerlegung) => {
	const blaetter = blaetterVon(z);
	const grenzen = blaetter.map((b) => ({
		von: z.knoten[b.seiten[0]?.nr ?? -1]?.start ?? 0,
		bis: z.knoten[b.seiten.at(-1)?.nr ?? -1]?.ende ?? 0,
	}));
	const vorn = z.quelle.slice(0, grenzen[0]?.von ?? z.quelle.length);
	const hinten = z.quelle.slice(grenzen.at(-1)?.bis ?? z.quelle.length);
	return {
		blaetter,
		texte: grenzen.map((g) => ohneNummern(z.quelle.slice(g.von, g.bis))),
		rest: ohneNummern(vorn) + '\u0000' + hinten,
	};
};

/** Ein Blatt mit allem, was seine Seiten im Bild bestimmt: Text ohne `.nr` und alles außerhalb der Blätter. */
const schluesselVon = (rest: string, text: string) => `${rest}\u0001${text}`;

/** Für jedes fließende Blatt (Nummer der ersten Seite) sein Schlüssel; gleiche Schlüssel liegen im Bild gleich. */
export const blattSchluessel = (z: Zerlegung) => {
	const t = blattTexte(z);
	return new Map(
		t.blaetter.flatMap((b, i) => (b.fliesst ? [[b.seiten[0]?.nr ?? -1, schluesselVon(t.rest, t.texte[i] ?? '')]] : [])),
	);
};

/** Ein geändertes Blatt in `nachher` und der Schlüssel des Blatts, das in `vorher` an seiner Stelle stand. */
export interface BlattPaar {
	nr: number;
	vorher: string | null;
}

/**
 * Regel 3: Welche Blätter (Nummer der ersten Seite in `nachher`) ein Schritt geändert hat, Blatt für Blatt verglichen,
 * ohne die Nummern in `.nr`. Ändert sich etwas außerhalb aller Blätter (Abstand und Klasse am `<body>`, Stil im Kopf),
 * sind es alle fließenden Blätter, höchstens `MAX_BLAETTER`. Gleiche Blätter vorn und hinten bleiben, auch wenn eine
 * Seite dazukam oder wegfiel. Zu jedem das Blatt davor, wenn die Zahl der Blätter dazwischen gleich blieb.
 */
export const geaenderteBlattPaare = (vorher: string, nachher: Zerlegung): BlattPaar[] => {
	const n = blattTexte(nachher);
	const a = blattTexte(zerlege(vorher));
	const paare = (von: number, bisN: number, bisA: number) => {
		const gleichViele = bisN - von === bisA - von;
		return n.blaetter.slice(von, bisN).flatMap((b, i) =>
			b.fliesst
				? [
						{
							nr: b.seiten[0]?.nr ?? -1,
							vorher: gleichViele ? schluesselVon(a.rest, a.texte[von + i] ?? '') : null,
						},
					]
				: [],
		);
	};
	if (n.rest !== a.rest) {
		return paare(0, n.blaetter.length, a.blaetter.length).slice(0, MAX_BLAETTER);
	}
	let vorn = 0;
	while (vorn < n.texte.length && vorn < a.texte.length && n.texte[vorn] === a.texte[vorn]) {
		vorn += 1;
	}
	let hinten = 0;
	while (
		hinten < n.texte.length - vorn &&
		hinten < a.texte.length - vorn &&
		n.texte[n.texte.length - 1 - hinten] === a.texte[a.texte.length - 1 - hinten]
	) {
		hinten += 1;
	}
	return paare(vorn, n.blaetter.length - hinten, a.blaetter.length - hinten);
};

export const geaenderteBlaetter = (vorher: string, nachher: Zerlegung): number[] =>
	geaenderteBlattPaare(vorher, nachher).map((p) => p.nr);
