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
import type { Nummerierung } from './struktur';
import { nummeriere } from './struktur';

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
	const html = (einzug: string | null) => texte.map((t) => t.text).join(einzug === null ? '' : `\n${einzug}`);
	const neben = (ziel: Knoten, wo: 'vor' | 'nach'): Einsatz => {
		const [aenderung] = fuegeEin(z, ziel, wo, html(einrueckung(z, ziel)));
		if (!aenderung) {
			throw new Error('Der Block lässt sich hier nicht einsetzen.');
		}
		return { aenderung, bloecke: texte };
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
		const [bereich] = entferne(z, weg);
		const eigeneZeile = einrueckung(z, weg) !== null;
		const text = eigeneZeile ? texte.map((t) => `${innen}${t.text}\n`).join('') : html(null);
		const pos = bereich?.von ?? weg.start;
		return { aenderung: { von: pos, bis: pos, text }, bloecke: texte };
	}
	const aussen = einrueckung(z, seite) ?? '';
	return {
		aenderung: {
			von: seite.oeffnerEnde,
			bis: seite.schliesserStart,
			text: `\n${texte.map((t) => `${innen}${t.text}`).join('\n')}\n${aussen}`,
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
			weg.push(...entferne(z, knoten(z, nr)));
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
		const html = bloecke
			.map((b) => automatischeSeite(z, vorlage, { inhalt: b.map((t) => t.text) }))
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
 * die schon so liegen, bleiben Zeichen für Zeichen. Nummern zählt `nummeriere` wie immer durchs Dokument.
 */
export const legeUm = (quelle: string, plan: FlussPlan, n: Nummerierung): Umgelegt => {
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
	return { quelle: nummeriere(neu, n), nummer: (nr) => nummern[nr] ?? null };
};
