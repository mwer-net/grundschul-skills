/**
 * Struktur-Befehle des Editors: Bausteine verschieben, kopieren, löschen, Seiten anlegen, Spalten und Abstand. Jeder
 * Befehl rechnet aus der Quelle die nächste Fassung, nur über Text-Patches (`quelltext.ts`), und zählt danach die
 * Aufgaben neu durch. So bleibt er ein einziger Schritt im Verlauf.
 */

import { dupliziereGestaltung, istEbene, istGestaltung, loescheGestaltung, neueIdsInGestaltung } from './gestaltung';
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
/** Was die Lehrkraft einstellen kann. Die Mindestwerte für Claude stehen in `grundschul-didaktik/references/druck-und-platz.md`. */
export const ABSTAND = { min: 16, max: 120, schritt: 4 } as const;

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

/**
 * Wohin ein neues letztes Kind von `eltern` kommt: hinter das letzte Kind, aber vor einen Fuß (Selbsteinschätzung) und
 * nie in oder hinter die Ebenen der Gestaltung.
 */
const stelleAmEnde = (z: Zerlegung, eltern: Knoten) => {
	const letztes = eltern.kinder.filter((k) => !hat(k, 'fuss') && !istEbene(k) && !istGestaltung(k)).at(-1); // 106: vor den Anker
	const fuss =
		eltern.kinder.find((k) => hat(k, 'fuss')) ?? eltern.kinder.find((k) => istEbene(k) || istGestaltung(k));
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

/** Eine Ablage an einer Ebene oder in ihr gilt vor der ersten Ebene der Seite: Der Stapel endet dort. */
const ablageImStapel = (z: Zerlegung, ziel: Knoten, wo: 'vor' | 'nach') => {
	let ebene: Knoten | null = ziel;
	while (ebene && !istEbene(ebene)) {
		ebene = ebene.eltern;
	}
	const erste = ebene?.eltern?.kinder.find(istEbene);
	return erste ? { ziel: erste, wo: 'vor' as const } : { ziel, wo };
};

export const verschiebeBaustein = (quelle: string, nr: number, ablage: Ablage, n: Nummerierung) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	if ('nr' in ablage) {
		const stelle = ablageImStapel(z, knotenAn(z, ablage.nr), ablage.wo);
		const aenderungen = verschiebe(z, k, stelle.ziel, stelle.wo);
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

/** Gestaltung liegt frei und hat eigene Regeln (`gestaltung.ts`); in einer Seite oder Aufgabe bekommt sie neue Ids. */
export const dupliziereBaustein = (quelle: string, nr: number, n: Nummerierung) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	if (istGestaltung(k)) {
		return dupliziereGestaltung(quelle, nr);
	}
	const kopie = quelleVon(z, k);
	const neu = neueIdsInGestaltung(kopie, quelle);
	const aenderungen = neu === kopie ? dupliziere(z, k) : fuegeEin(z, k, 'nach', neu);
	return ergebnis(quelle, aenderungen, aenderungen[0], n);
};

export const loescheBaustein = (quelle: string, nr: number, n: Nummerierung) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	if (istGestaltung(k)) {
		return loescheGestaltung(quelle, nr);
	}
	if (hat(k, 'seite') && seitenVon(z).length <= 1) {
		throw new Error('Die einzige Seite lässt sich nicht löschen.');
	}
	// Eine Ebene ist nicht wählbar: Gewählt wird danach ein Nachbar im Stapel.
	const geschwister = (k.eltern?.kinder ?? []).filter((g) => !istEbene(g));
	const stelle = geschwister.indexOf(k);
	const folge = geschwister[stelle + 1] ?? geschwister[stelle - 1] ?? k.eltern;
	const neu = ergebnis(quelle, entferne(z, k), undefined, n);
	if (!folge) {
		return neu;
	}
	// Dahinter rückt alles um das Gelöschte samt Inhalt auf.
	const weg = z.knoten.length - zerlege(neu.quelle).knoten.length;
	return { ...neu, nr: folge.nr > k.nr ? folge.nr - weg : folge.nr };
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

/** Entfernt eine Eigenschaft aus dem `style`-Wert; `null`, wenn nichts übrig bleibt. */
export const ohneStilWert = (stil: string | null, name: string) =>
	stilTeile(stil)
		.filter((t) => eigenschaft(t) !== name)
		.join(';') || null;

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

const bodyIn = (z: Zerlegung) => {
	const body = z.knoten.find((k) => k.tag === 'body');
	if (!body) {
		throw new Error('Das Material hat kein <body>.');
	}
	return body;
};

/** `--abstand` zwischen den Aufgaben, am `<body>`, in den Grenzen von `ABSTAND`. */
export const setzeAbstand = (quelle: string, px: number) => {
	const z = zerlege(quelle);
	return setzeStil(z, bodyIn(z), '--abstand', `${begrenze(px, ABSTAND)}px`);
};

/** Der am `<body>` gesetzte Abstand; `null`, wenn das Blatt der Vorgabe seiner Klasse folgt. */
export const gesetzterAbstand = (quelle: string) => {
	const z = zerlege(quelle);
	const px = parseFloat(stilWert(attribut(bodyIn(z), 'style')?.wert ?? null, '--abstand') ?? '');
	return Number.isFinite(px) ? px : null;
};

/** Nimmt `--abstand` vom `<body>`: Das Blatt folgt wieder der Vorgabe seiner Klasse. */
export const entferneAbstand = (quelle: string) => {
	const z = zerlege(quelle);
	const body = bodyIn(z);
	return wendeAn(
		quelle,
		setzeAttribut(z, body, 'style', ohneStilWert(attribut(body, 'style')?.wert ?? null, '--abstand')),
	);
};
