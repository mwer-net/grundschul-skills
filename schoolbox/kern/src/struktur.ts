/**
 * Struktur-Befehle des Editors: Bausteine verschieben, kopieren, löschen, Seiten anlegen, Spalten und Abstand. Jeder
 * Befehl rechnet aus der Quelle die nächste Fassung, nur über Text-Patches (`quelltext.ts`), und zählt danach die
 * Aufgaben neu durch. So bleibt er ein einziger Schritt im Verlauf.
 */

import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	dupliziere,
	einrueckung,
	entferne,
	ersetzeInnen,
	fuegeEin,
	innenVon,
	klassenVon,
	quelleVon,
	rueckeUm,
	setzeAttribut,
	verschiebe,
	wendeAn,
	zerlege,
} from './quelltext';

export const SPALTEN = { min: 1, max: 6 } as const;
/** `html-materialerstellung/references/layout.md`: Abstand zwischen Aufgaben nie unter 24 px. */
export const ABSTAND = { min: 24, max: 48, schritt: 2 } as const;

/** Wohin ein Baustein kommt: vor bzw. hinter ein anderes Element oder ans Ende eines Elements ohne Geschwister. */
export type Ablage = { nr: number; wo: 'vor' | 'nach' } | { in: number };

export interface Nummerierung {
	/** Folien zählen ihre Aufgaben je Folie, Blätter durch das ganze Dokument. */
	jeSeite: boolean;
}

export interface StrukturErgebnis {
	quelle: string;
	/** Das verschobene, kopierte oder neue Element in der neuen Quelle. */
	nr: number | null;
}

const EINZUG = '  ';
const BUCHSTABEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

const knotenAn = (z: Zerlegung, nr: number) => {
	const k = z.knoten[nr];
	if (!k) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	return k;
};

const enthaelt = (aussen: Knoten, innen: Knoten) => innen.start >= aussen.start && innen.ende <= aussen.ende;

const seiteVon = (k: Knoten) => {
	let e = k.eltern;
	while (e && !hat(e, 'seite')) {
		e = e.eltern;
	}
	return e;
};

export const seitenVon = (z: Zerlegung) => z.knoten.filter((k) => hat(k, 'seite'));

const istStern = (aufgabe: Knoten) => aufgabe.kinder.some((k) => hat(k, 'nr') && hat(k, 'stern'));

/**
 * Zählt die Nummern neu: Aufgaben 1, 2, 3 … (die Sternchenaufgabe bleibt ★), Vermutungen A, B, C … je Gruppe. Nummern,
 * die keine Zahl bzw. kein einzelner Buchstabe sind, bleiben, wie sie sind.
 */
export const nummeriere = (quelle: string, { jeSeite }: Nummerierung) => {
	const z = zerlege(quelle);
	const aenderungen: Aenderung[] = [];
	const aufgaben = new Map<Knoten | null, number>();
	const vermutungen = new Map<Knoten | null, number>();
	const zaehle = (zaehler: Map<Knoten | null, number>, gruppe: Knoten | null) => {
		const n = (zaehler.get(gruppe) ?? 0) + 1;
		zaehler.set(gruppe, n);
		return n;
	};
	const setze = (k: Knoten, text: string) => {
		if (innenVon(z, k).trim() !== text) {
			aenderungen.push(...ersetzeInnen(z, k, text));
		}
	};
	for (const k of z.knoten) {
		const text = innenVon(z, k).trim();
		if (!hat(k, 'nr') || hat(k, 'stern') || k.kinder.length > 0) {
			continue;
		}
		if (hat(k.eltern, 'aufgabe') && /^\d+$/.test(text)) {
			setze(k, String(zaehle(aufgaben, jeSeite ? seiteVon(k) : null)));
		} else if (hat(k.eltern, 'vermutung') && /^[A-Z]$/.test(text)) {
			setze(k, BUCHSTABEN[(zaehle(vermutungen, k.eltern?.eltern ?? null) - 1) % BUCHSTABEN.length] ?? text);
		}
	}
	return wendeAn(quelle, aenderungen);
};

/** Die Sternchenaufgabe gehört ans Ende (`grundschul-didaktik`); wahr, wenn eine andere Aufgabe hinter ihr steht. */
export const sternNichtAmEnde = (quelle: string) => {
	const aufgaben = zerlege(quelle).knoten.filter((k) => hat(k, 'aufgabe'));
	const letzte = aufgaben.at(-1);
	return Boolean(letzte && aufgaben.some(istStern) && !istStern(letzte));
};

/** Wo der erste Buchstabe von `a.text` steht, nachdem alle Änderungen angewendet sind. */
const positionNach = (aenderungen: Aenderung[], a: Aenderung, versatz: number) =>
	aenderungen.reduce(
		(pos, c) => (c !== a && c.bis <= a.von ? pos + c.text.length - (c.bis - c.von) : pos),
		a.von + versatz,
	);

const ergebnis = (
	quelle: string,
	aenderungen: Aenderung[],
	eingefuegt: Aenderung | undefined,
	n: Nummerierung,
): StrukturErgebnis => {
	const neu = wendeAn(quelle, aenderungen);
	let nr: number | null = null;
	if (eingefuegt) {
		const start = positionNach(aenderungen, eingefuegt, eingefuegt.text.indexOf('<'));
		nr = zerlege(neu).knoten.find((k) => k.start === start)?.nr ?? null;
	}
	// Neu zählen ändert nur Text in den Nummern, die Elemente und ihre Nummern im Editor bleiben dieselben.
	return { quelle: nummeriere(neu, n), nr };
};

/** Wohin ein neues letztes Kind von `eltern` kommt: hinter das letzte Kind, aber vor einen Fuß (Selbsteinschätzung). */
const stelleAmEnde = (z: Zerlegung, eltern: Knoten) => {
	const letztes = eltern.kinder.filter((k) => !hat(k, 'fuss')).at(-1);
	const fuss = eltern.kinder.find((k) => hat(k, 'fuss'));
	if (letztes) {
		return { einzug: einrueckung(z, letztes), fuegeEin: (html: string) => fuegeEin(z, letztes, 'nach', html) };
	}
	if (fuss) {
		return { einzug: einrueckung(z, fuss), fuegeEin: (html: string) => fuegeEin(z, fuss, 'vor', html) };
	}
	const aussen = einrueckung(z, eltern);
	if (aussen === null || innenVon(z, eltern).trim() !== '') {
		const pos = eltern.schliesserStart;
		return { einzug: null, fuegeEin: (html: string): Aenderung[] => [{ von: pos, bis: pos, text: html }] };
	}
	const innen = `${aussen}${EINZUG}`;
	return {
		einzug: innen,
		fuegeEin: (html: string): Aenderung[] => [
			{ von: eltern.oeffnerEnde, bis: eltern.schliesserStart, text: `\n${innen}${html}\n${aussen}` },
		],
	};
};

export const verschiebeBaustein = (quelle: string, nr: number, ablage: Ablage, n: Nummerierung) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	if ('nr' in ablage) {
		const aenderungen = verschiebe(z, k, knotenAn(z, ablage.nr), ablage.wo);
		return ergebnis(quelle, aenderungen, aenderungen[1], n);
	}
	const eltern = knotenAn(z, ablage.in);
	if (enthaelt(k, eltern) || enthaelt(eltern, k)) {
		throw new Error('Dorthin lässt sich das Element nicht verschieben.');
	}
	const stelle = stelleAmEnde(z, eltern);
	const raus = entferne(z, k);
	const rein = stelle.fuegeEin(rueckeUm(quelleVon(z, k), einrueckung(z, k), stelle.einzug));
	return ergebnis(quelle, [...raus, ...rein], rein[0], n);
};

export const dupliziereBaustein = (quelle: string, nr: number, n: Nummerierung) => {
	const z = zerlege(quelle);
	const aenderungen = dupliziere(z, knotenAn(z, nr));
	return ergebnis(quelle, aenderungen, aenderungen[0], n);
};

export const loescheBaustein = (quelle: string, nr: number, n: Nummerierung) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	if (hat(k, 'seite') && seitenVon(z).length <= 1) {
		throw new Error('Die einzige Seite lässt sich nicht löschen.');
	}
	return ergebnis(quelle, entferne(z, k), undefined, n);
};

/** Was eine neue Seite von der ersten übernimmt: Namenszeile und die Marke „Lösung“. */
const kopfteile = (z: Zerlegung, seite: Knoten | undefined) =>
	seite?.kinder.filter((k) => hat(k, 'namenszeile') || hat(k, 'loesung-marke')) ?? [];

export const hatNamenszeile = (z: Zerlegung) => kopfteile(z, seitenVon(z)[0]).some((k) => hat(k, 'namenszeile'));

/** Eine leere Seite gleichen Formats hinter `nach` (sonst ans Ende), auf Wunsch mit der Namenszeile der ersten Seite. */
export const fuegeSeiteEin = (
	quelle: string,
	{ mitNamenszeile, nach }: { nach: number | null; mitNamenszeile: boolean },
	n: Nummerierung,
) => {
	const z = zerlege(quelle);
	const seiten = seitenVon(z);
	const ziel = seiten.find((s) => s.nr === nach) ?? seiten.at(-1);
	if (!ziel) {
		throw new Error('Das Material hat keine Seite.');
	}
	const einzug = einrueckung(z, ziel) ?? '';
	const kopf = mitNamenszeile ? kopfteile(z, seiten[0]) : [];
	const zeilen = kopf.map(
		(k) => `${einzug}${EINZUG}${rueckeUm(quelleVon(z, k), einrueckung(z, k), einzug + EINZUG)}`,
	);
	const html = zeilen.length
		? `<${ziel.tag} class="seite">\n${zeilen.join('\n')}\n${einzug}</${ziel.tag}>`
		: `<${ziel.tag} class="seite"></${ziel.tag}>`;
	const aenderungen = fuegeEin(z, ziel, 'nach', html);
	return ergebnis(quelle, aenderungen, aenderungen[0], n);
};

const stilTeile = (stil: string | null) =>
	(stil ?? '')
		.split(';')
		.map((teil) => teil.trim())
		.filter(Boolean);

const eigenschaft = (teil: string) => teil.slice(0, teil.indexOf(':')).trim();

export const stilWert = (stil: string | null, name: string) => {
	const teil = stilTeile(stil).find((t) => eigenschaft(t) === name);
	return teil === undefined ? null : teil.slice(teil.indexOf(':') + 1).trim();
};

/** Setzt eine Eigenschaft im `style`-Wert; die übrigen bleiben in ihrer Reihenfolge. */
export const setzeStilWert = (stil: string | null, name: string, wert: string) => {
	const teile = stilTeile(stil);
	const i = teile.findIndex((t) => eigenschaft(t) === name);
	if (i === -1) {
		teile.unshift(`${name}:${wert}`);
	} else {
		teile[i] = `${name}:${wert}`;
	}
	return teile.join(';');
};

const begrenze = (wert: number, { max, min }: { min: number; max: number }) =>
	Math.min(max, Math.max(min, Math.round(wert)));

const setzeStil = (z: Zerlegung, k: Knoten, name: string, wert: string) => {
	const neu = setzeStilWert(attribut(k, 'style')?.wert ?? null, name, wert);
	return wendeAn(z.quelle, setzeAttribut(z, k, 'style', neu));
};

/** `--spalten` einer Reihe oder eines Kartenbogens, 1 bis 6. */
export const setzeSpalten = (quelle: string, nr: number, spalten: number) => {
	const z = zerlege(quelle);
	return setzeStil(z, knotenAn(z, nr), '--spalten', String(begrenze(spalten, SPALTEN)));
};

/** `--abstand` zwischen den Aufgaben, am `<body>`, 24 bis 48 px. */
export const setzeAbstand = (quelle: string, px: number) => {
	const z = zerlege(quelle);
	const body = z.knoten.find((k) => k.tag === 'body');
	if (!body) {
		throw new Error('Das Material hat kein <body>.');
	}
	return setzeStil(z, body, '--abstand', `${begrenze(px, ABSTAND)}px`);
};
