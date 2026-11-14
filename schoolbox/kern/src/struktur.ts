/**
 * Struktur-Befehle des Editors: Bausteine verschieben, kopieren, löschen, Seiten anlegen, Spalten und Abstand. Jeder
 * Befehl rechnet aus der Quelle die nächste Fassung, nur über Text-Patches (`quelltext.ts`), und zählt danach die
 * Aufgaben neu durch. So bleibt er ein einziger Schritt im Verlauf.
 */

import { aeussereSeiten, blattZu, istAutomatisch, istSeite, WEITER } from './fluss-blatt';
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

const SCHRITT = 'data-schritt';

/**
 * Zählt die Schritte (`data-schritt`) der Folie neu, in der `nr` steht (192-16): Die verschiedenen Zahlen werden in
 * der Reihenfolge ihres ersten Vorkommens zu 1 … n. Was vorher dieselbe Zahl hatte, behält eine gemeinsame; `kopie`:
 * `nr` ist eine Kopie, ihre Schritte bekommen eigene Zahlen und erscheinen nicht mehr mit dem Vorbild. Andere Folien
 * bleiben, wie sie sind. Ändert nur Attributwerte, die Nummern der Elemente bleiben.
 */
export const ordneSchritte = (quelle: string, nr: number | null, kopie = false) => {
	const z = zerlege(quelle);
	const k = nr === null ? undefined : z.knoten[nr];
	const seite = k && (hat(k, 'seite') ? k : seiteVon(k));
	if (!k || !seite) {
		return quelle;
	}
	const zahl = (x: Knoten) => {
		const wert = attribut(x, SCHRITT)?.wert?.trim() ?? '';
		return /^\d+$/.test(wert) ? wert : null;
	};
	const schritte = z.knoten.filter((x) => x !== seite && enthaelt(seite, x) && zahl(x) !== null);
	const neu = new Map<string, number>();
	const aenderungen: Aenderung[] = [];
	for (const x of schritte) {
		const schluessel = `${kopie && enthaelt(k, x) ? 'kopie' : 'alt'}:${zahl(x) ?? ''}`;
		if (!neu.has(schluessel)) {
			neu.set(schluessel, neu.size + 1);
		}
		const wert = String(neu.get(schluessel));
		if (wert !== zahl(x)) {
			aenderungen.push(...setzeAttribut(z, x, SCHRITT, wert));
		}
	}
	return aenderungen.length > 0 ? wendeAn(quelle, aenderungen) : quelle;
};

const ergebnis = (
	quelle: string,
	aenderungen: Aenderung[],
	eingefuegt: Aenderung | undefined,
	n: Nummerierung,
	kopie = false,
	herkunft?: number,
): StrukturErgebnis => {
	let neu = wendeAn(quelle, aenderungen);
	let nr: number | null = null;
	if (eingefuegt) {
		const start = positionNach(aenderungen, eingefuegt, eingefuegt.text.indexOf('<'));
		nr = zerlege(neu).knoten.find((k) => k.start === start)?.nr ?? null;
	}
	if (n.jeSeite) {
		neu = ordneSchritte(neu, nr, kopie);
		// Auf eine andere Folie verschoben: Auch die Folie, von der es kam, zählt ohne Lücke.
		const alt = herkunft === undefined ? undefined : seitenVon(zerlege(neu))[herkunft];
		if (alt) {
			neu = ordneSchritte(neu, alt.nr);
		}
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

/** 206 (Regel 19): Die Seiten des Blatts, zu dem die Seite `k` gehört; sonst nur `k`. */
const blattVon = (z: Zerlegung, k: Knoten) =>
	istAussen(z, k) ? (blattZu(z, k.nr)?.seiten.map((s) => knotenAn(z, s.nr)) ?? [k]) : [k];

/** Eine Seite des Dokuments, keine verkleinerte Folie in „Folien mit Notizen“. */
const istAussen = (z: Zerlegung, k: Knoten) => istSeite(k) && aeussereSeiten(z).includes(k);

/** Die Seiten eines Blatts als ein Stück Quelle, eingerückt wie `ziel`. */
const blattText = (z: Zerlegung, seiten: Knoten[], ziel: Knoten) => {
	const erste = seiten[0];
	const letzte = seiten.at(-1);
	if (!erste || !letzte) {
		throw new Error('Das Blatt hat keine Seite.');
	}
	return rueckeUm(z.quelle.slice(erste.start, letzte.ende), einrueckung(z, erste), einrueckung(z, ziel));
};

/**
 * Eine Seite zieht ihr Blatt mit (Regel 19): Ziel ist der Anfang bzw. das Ende eines anderen Blatts, nie eine Stelle
 * zwischen einer Seite und ihren automatischen Seiten.
 */
const verschiebeBlatt = (z: Zerlegung, seiten: Knoten[], ziel: Knoten, wo: 'vor' | 'nach') => {
	const zielBlatt = blattVon(z, ziel);
	if (zielBlatt.some((s) => seiten.includes(s))) {
		throw new Error('Dorthin lässt sich das Element nicht verschieben.');
	}
	const vorn = wo === 'vor' && !istAutomatisch(ziel);
	const stelle = (vorn ? zielBlatt[0] : zielBlatt.at(-1)) ?? ziel;
	const raus = seiten.flatMap((s) => entferne(z, s));
	const [rein] = fuegeEin(z, stelle, vorn ? 'vor' : 'nach', blattText(z, seiten, stelle));
	if (!rein) {
		return [];
	}
	// Grenzt die Einfügestelle an den entfernten Bereich, landet sie an dessen Rand.
	const getroffen = raus.find((r) => rein.von > r.von && rein.von < r.bis);
	const pos = getroffen ? getroffen.bis : rein.von;
	return [...raus, { ...rein, von: pos, bis: pos }];
};

export const verschiebeBaustein = (quelle: string, nr: number, ablage: Ablage, n: Nummerierung) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	const blatt = blattVon(z, k);
	if ('nr' in ablage && istAussen(z, k) && istAussen(z, knotenAn(z, ablage.nr))) {
		const aenderungen = verschiebeBlatt(z, blatt, knotenAn(z, ablage.nr), ablage.wo);
		return ergebnis(quelle, aenderungen, aenderungen.at(-1), n);
	}
	// Über Folien hinweg (192-16): Das Verschobene bekommt auf der neuen Folie eigene Schritte.
	const seiten = seitenVon(z);
	const von = hat(k, 'seite') ? undefined : seiteVon(k);
	const ueberFolien = (ziel: Knoten) => {
		const nach = hat(ziel, 'seite') ? ziel : seiteVon(ziel);
		return von && nach && nach !== von ? { kopie: true, herkunft: seiten.indexOf(von) } : { kopie: false };
	};
	if ('nr' in ablage) {
		const stelle = ablageImStapel(z, knotenAn(z, ablage.nr), ablage.wo);
		const aenderungen = verschiebe(z, k, stelle.ziel, stelle.wo);
		const { herkunft, kopie } = ueberFolien(stelle.ziel);
		return ergebnis(quelle, aenderungen, aenderungen[1], n, kopie, herkunft);
	}
	const eltern = knotenAn(z, ablage.in);
	if (enthaelt(k, eltern) || enthaelt(eltern, k)) {
		throw new Error('Dorthin lässt sich das Element nicht verschieben.');
	}
	const stelle = stelleAmEnde(z, eltern);
	const raus = entferne(z, k);
	const rein = stelle.fuegeEin(rueckeUm(quelleVon(z, k), einrueckung(z, k), stelle.einzug));
	const { herkunft, kopie } = ueberFolien(eltern);
	return ergebnis(quelle, [...raus, ...rein], rein[0], n, kopie, herkunft);
};

/** Gestaltung liegt frei und hat eigene Regeln (`gestaltung.ts`); in einer Seite oder Aufgabe bekommt sie neue Ids. */
export const dupliziereBaustein = (quelle: string, nr: number, n: Nummerierung) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	if (istGestaltung(k)) {
		return dupliziereGestaltung(quelle, nr);
	}
	// Eine Seite dupliziert ihr ganzes Blatt (Regel 19); die Kopie steht hinter dessen letzter Seite.
	const blatt = blattVon(z, k);
	const letzte = blatt.at(-1) ?? k;
	const kopie = blatt.length > 1 ? blattText(z, blatt, letzte) : quelleVon(z, k);
	const neu = neueIdsInGestaltung(kopie, quelle);
	const aenderungen = neu === kopie && blatt.length === 1 ? dupliziere(z, k) : fuegeEin(z, letzte, 'nach', neu);
	// Eine ganze Folie zu kopieren, behält deren Schritte; nur eine Kopie in derselben Folie zählt eigen (192-16).
	return ergebnis(quelle, aenderungen, aenderungen[0], n, !hat(k, 'seite'));
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
	// Regel 20: Folgt auf eine feste Seite eine automatische, wird diese fest; ihr Inhalt bleibt in keinem fremden Blatt.
	const naechste = geschwister[stelle + 1];
	const fest =
		istSeite(k) && !istAutomatisch(k) && istAutomatisch(naechste) && naechste
			? festeSeite(naechste)
			: [];
	const neu = ergebnis(quelle, [...entferne(z, k), ...fest], undefined, n);
	if (!folge) {
		return neu;
	}
	// Dahinter rückt alles um das Gelöschte samt Inhalt auf.
	const weg = z.knoten.length - zerlege(neu.quelle).knoten.length;
	const danach = folge.nr > k.nr ? folge.nr - weg : folge.nr;
	// Eine Lücke in den Schritten der Folie schließt sich (192-16).
	return { quelle: n.jeSeite && !hat(k, 'seite') ? ordneSchritte(neu.quelle, danach) : neu.quelle, nr: danach };
};

/** `data-weiter="auto"` wird `data-weiter`: Die Seite gilt als fest (Regel 20). */
const festeSeite = (seite: Knoten): Aenderung[] => {
	const weiter = attribut(seite, WEITER);
	return weiter ? [{ von: weiter.start, bis: weiter.ende, text: WEITER }] : [];
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
	const gewaehlt = seiten.find((s) => s.nr === nach) ?? seiten.at(-1);
	// Regel 18: hinter das ganze Blatt, nicht zwischen eine Seite und ihre automatischen Seiten.
	const ziel = gewaehlt ? blattVon(z, gewaehlt).at(-1) : undefined;
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
