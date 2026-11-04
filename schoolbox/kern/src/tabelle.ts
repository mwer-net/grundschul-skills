/**
 * Die Kit-Tabelle (047) und einfache fremde Tabellen (054). Alle Befehle lesen die Tabelle in ein kleines
 * Modell und schreiben sie als einen Patch zurück: ein Schritt im Verlauf, und der Rest der Quelle bleibt unberührt.
 */

import type { Knoten, Zerlegung } from './quelltext';
import { innenVon, klassenVon, wendeAn, zerlege } from './quelltext';
import type { Nummerierung, StrukturErgebnis } from './struktur';
import { nummeriere } from './struktur';

interface Zelle {
	tag: 'th' | 'td';
	attribute: string;
	innen: string;
}
interface Zeile {
	attribute: string;
	zellen: Zelle[];
}
export interface Modell {
	attribute: string;
	kopf: boolean;
	zeilen: Zeile[];
}

const oeffnerAttribute = (z: Zerlegung, k: Knoten) =>
	z.quelle.slice(k.start + k.tag.length + 1, k.oeffnerEnde - 1).trimEnd();

const zeilenKnoten = (t: Knoten): Knoten[] => t.kinder.flatMap((k) => (k.tag === 'tr' ? [k] : zeilenKnoten(k)));

export const tabelleVon = (z: Zerlegung, nr: number) => {
	for (let e = z.knoten[nr] ?? null; e; e = e.eltern) {
		if (e.tag === 'table') {
			return e;
		}
	}
	throw new Error('Das liegt in keiner Tabelle.');
};

export const leseModell = (z: Zerlegung, t: Knoten): Modell => ({
	attribute: oeffnerAttribute(z, t),
	kopf: t.kinder.some((k) => k.tag === 'thead'),
	zeilen: zeilenKnoten(t).map((tr) => ({
		attribute: oeffnerAttribute(z, tr),
		zellen: tr.kinder
			.filter((c) => c.tag === 'th' || c.tag === 'td')
			.map((c) => ({ tag: c.tag as 'th' | 'td', attribute: oeffnerAttribute(z, c), innen: innenVon(z, c) })),
	})),
});

const zeileHtml = (r: Zeile) =>
	`<tr${r.attribute}>${r.zellen.map((c) => `<${c.tag}${c.attribute}>${c.innen}</${c.tag}>`).join('')}</tr>`;

export const modellHtml = ({ attribute, kopf, zeilen }: Modell) => {
	const [erste, ...rest] = zeilen;
	const kopfteil = kopf && erste ? `<thead>${zeileHtml(erste)}</thead>` : '';
	const koerper = (kopf ? rest : zeilen).map(zeileHtml).join('');
	return `<table${attribute}>${kopfteil}<tbody>${koerper}</tbody></table>`;
};

const leer = (tag: 'th' | 'td' = 'td'): Zelle => ({ tag, attribute: '', innen: '' });

/** Die Kopfzeile besteht aus `th`, alles andere aus `td`. */
const ordne = (m: Modell): Modell => ({
	...m,
	zeilen: m.zeilen.map((r, i) => ({
		...r,
		zellen: r.zellen.map((c) => ({ ...c, tag: m.kopf && i === 0 ? ('th' as const) : ('td' as const) })),
	})),
});

interface Stelle {
	zeile: number;
	spalte: number;
}

const stelleVon = (z: Zerlegung, t: Knoten, nr: number): Stelle => {
	const zeilen = zeilenKnoten(t);
	let e: Knoten | null = z.knoten[nr] ?? null;
	while (e && e.tag !== 'tr' && e.tag !== 'td' && e.tag !== 'th' && e !== t) {
		e = e.eltern;
	}
	const tr = e?.tag === 'tr' ? e : e?.eltern;
	const zeile = Math.max(0, tr ? zeilen.indexOf(tr) : 0);
	const spalte = e && e.tag !== 'tr' && tr ? Math.max(0, tr.kinder.indexOf(e)) : 0;
	return { zeile, spalte };
};

/** Nummer der Zelle an `stelle` der Tabelle, die in `quelle` an Position `start` beginnt. */
const zelleNr = (quelle: string, start: number, { spalte, zeile }: Stelle) => {
	const z = zerlege(quelle);
	const t = z.knoten.find((k) => k.start === start);
	const r = t ? zeilenKnoten(t)[zeile] : undefined;
	return r?.kinder[spalte]?.nr ?? t?.nr ?? null;
};

const aendere = (
	quelle: string,
	nr: number,
	n: Nummerierung,
	rechne: (m: Modell, s: Stelle) => { modell: Modell; stelle: Stelle },
): StrukturErgebnis => {
	const z = zerlege(quelle);
	const t = tabelleVon(z, nr);
	const { modell, stelle } = rechne(leseModell(z, t), stelleVon(z, t, nr));
	const neu = wendeAn(quelle, [{ von: t.start, bis: t.ende, text: modellHtml(ordne(modell)) }]);
	return { quelle: nummeriere(neu, n), nr: zelleNr(neu, t.start, stelle) };
};

const spalten = (m: Modell) => Math.max(1, ...m.zeilen.map((r) => r.zellen.length));

export type Wo = 'vor' | 'nach';

export const fuegeZeileEin = (quelle: string, nr: number, wo: Wo, n: Nummerierung) =>
	aendere(quelle, nr, n, (m, s) => {
		const ziel = Math.max(m.kopf ? 1 : 0, wo === 'vor' ? s.zeile : s.zeile + 1);
		const zeile: Zeile = { attribute: '', zellen: Array.from({ length: spalten(m) }, () => leer()) };
		return {
			modell: { ...m, zeilen: [...m.zeilen.slice(0, ziel), zeile, ...m.zeilen.slice(ziel)] },
			stelle: { zeile: ziel, spalte: s.spalte },
		};
	});

export const loescheZeile = (quelle: string, nr: number, n: Nummerierung) =>
	aendere(quelle, nr, n, (m, s) => {
		if (m.zeilen.length <= 1) {
			throw new Error('Die letzte Zeile bleibt. Lösche sonst die ganze Tabelle.');
		}
		const zeilen = m.zeilen.filter((_, i) => i !== s.zeile);
		return {
			modell: { ...m, kopf: m.kopf && s.zeile !== 0, zeilen },
			stelle: { zeile: Math.min(s.zeile, zeilen.length - 1), spalte: s.spalte },
		};
	});

export const fuegeSpalteEin = (quelle: string, nr: number, wo: Wo, n: Nummerierung) =>
	aendere(quelle, nr, n, (m, s) => {
		const ziel = wo === 'vor' ? s.spalte : s.spalte + 1;
		return {
			modell: {
				...m,
				zeilen: m.zeilen.map((r) => ({
					...r,
					zellen: [...r.zellen.slice(0, ziel), leer(), ...r.zellen.slice(ziel)],
				})),
			},
			stelle: { zeile: s.zeile, spalte: ziel },
		};
	});

export const loescheSpalte = (quelle: string, nr: number, n: Nummerierung) =>
	aendere(quelle, nr, n, (m, s) => {
		if (spalten(m) <= 1) {
			throw new Error('Die letzte Spalte bleibt. Lösche sonst die ganze Tabelle.');
		}
		return {
			modell: {
				...m,
				zeilen: m.zeilen.map((r) => ({ ...r, zellen: r.zellen.filter((_, i) => i !== s.spalte) })),
			},
			stelle: { zeile: s.zeile, spalte: Math.max(0, s.spalte - 1) },
		};
	});

export const setzeGroesse = (quelle: string, nr: number, was: { zeilen?: number; spalten?: number }, n: Nummerierung) =>
	aendere(quelle, nr, n, (m, s) => {
		const zielSpalten = was.spalten ?? spalten(m);
		const zielZeilen = was.zeilen ?? m.zeilen.length;
		const breit = (r: Zeile) => ({
			...r,
			zellen: [
				...r.zellen,
				...Array.from({ length: Math.max(0, zielSpalten - r.zellen.length) }, () => leer()),
			].slice(0, zielSpalten),
		});
		const dazu = Array.from({ length: Math.max(0, zielZeilen - m.zeilen.length) }, (): Zeile => ({
			attribute: '',
			zellen: [],
		}));
		return { modell: { ...m, zeilen: [...m.zeilen, ...dazu].slice(0, zielZeilen).map(breit) }, stelle: s };
	});

export const setzeKopfzeile = (quelle: string, nr: number, an: boolean, n: Nummerierung) =>
	aendere(quelle, nr, n, (m, s) => ({ modell: { ...m, kopf: an }, stelle: s }));

/** Die Maße der Tabelle für das Panel. */
export const groesseVon = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const m = leseModell(z, tabelleVon(z, nr));
	return { zeilen: m.zeilen.length, spalten: spalten(m), kopf: m.kopf };
};

/** Nächste Zelle für Tab; am Ende `null`: Dann kommt eine neue Zeile. */
export const naechsteZelle = (s: Stelle, zeilen: number, spaltenZahl: number): Stelle | null => {
	if (s.spalte + 1 < spaltenZahl) {
		return { zeile: s.zeile, spalte: s.spalte + 1 };
	}
	return s.zeile + 1 < zeilen ? { zeile: s.zeile + 1, spalte: 0 } : null;
};

/**
 * Überlauf (047): Die Zeilen ab `abZeile` kommen in eine gleiche Tabelle auf einer neuen Seite direkt hinter der Seite
 * dieser Tabelle; die Kopfzeile steht auf beiden. Beides ist ein Patch.
 */
export const teileTabelle = (quelle: string, nr: number, abZeile: number, n: Nummerierung): StrukturErgebnis => {
	const z = zerlege(quelle);
	const t = tabelleVon(z, nr);
	const m = leseModell(z, t);
	const erste = m.kopf ? 1 : 0;
	if (abZeile <= erste || abZeile >= m.zeilen.length) {
		throw new Error('Diese Tabelle lässt sich hier nicht teilen.');
	}
	let seite: Knoten | null = t;
	while (seite && !klassenVon(seite).includes('seite')) {
		seite = seite.eltern;
	}
	if (!seite) {
		throw new Error('Die Tabelle liegt auf keiner Seite.');
	}
	const kopf = m.kopf ? m.zeilen.slice(0, 1) : [];
	const vorne = modellHtml(ordne({ ...m, zeilen: m.zeilen.slice(0, abZeile) }));
	const hinten = modellHtml(ordne({ ...m, zeilen: [...kopf, ...m.zeilen.slice(abZeile)] }));
	const neu = wendeAn(quelle, [
		{ von: t.start, bis: t.ende, text: vorne },
		{ von: seite.ende, bis: seite.ende, text: `\n<${seite.tag} class="seite">${hinten}</${seite.tag}>` },
	]);
	return { quelle: nummeriere(neu, n), nr: null };
};
