/**
 * Bausteine aus dem Katalog in die Quelle einfügen (044): ein einziger Text-Patch, danach neu nummeriert, also ein Schritt
 * im Verlauf. `ort` entscheidet, wohin etwas darf; passt es nicht an die gewählte Stelle, kommt es in eine neue Aufgabe,
 * statt dass das Einfügen scheitert.
 */

import type { KatalogEintrag } from './katalog';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	einrueckung,
	entferne,
	fuegeEin,
	klassenVon,
	quelleVon,
	rueckeUm,
	setzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';
import type { Nummerierung, StrukturErgebnis } from './struktur';
import { nummeriere, seitenVon } from './struktur';

export interface Einfuegbar {
	id: string;
	ort: 'blatt' | 'seite' | 'aufgabe' | 'zeile' | 'folie';
	/** Fertiges HTML des Starters; bei Aufgabenpaketen die Teile im `.koerper`. */
	html?: string;
	/** Nur Aufgabenpakete: der Inhalt der neuen Aufgabe, Aufgabentext `anweisung`. */
	teile?: readonly string[];
	/** Aufgabentext der neuen Aufgabe: für Pakete immer, für Elemente, wenn sie eine Aufgabe brauchen (203-06). */
	anweisung?: string;
	/** Setzt nur eine Klasse: am `<body>` (`ort: 'blatt'`) oder am umgebenden Item. */
	klasse?: string;
	/** Text vor und nach dem Element, wenn es eine eigene Zeile braucht (203-06). */
	umZeile?: readonly [string, string];
	/** Feste Stelle statt der Auswahl (203-07). */
	stelle?: 'nach-letzter-aufgabe' | 'neue-seite';
}

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

const aufwaerts = (k: Knoten | null | undefined, klasse: string): Knoten | null => {
	for (let e = k ?? null; e; e = e.eltern) {
		if (hat(e, klasse)) {
			return e;
		}
	}
	return null;
};

/** Nummer `0`, der Editor nummeriert danach neu; nur die Vorschau im Katalog gibt `1` mit (147). */
export const neueAufgabe = (innen: string, anweisung = 'Anweisung', nr = 0) =>
	`<div class="aufgabe"><span class="nr">${nr}</span><div class="anw"><span class="text">${anweisung}</span></div><div class="koerper">${innen}</div></div>`;

/**
 * `baustein`: das HTML, das gewählt sein soll. Liegt es in einer neuen Hülle (Aufgabe, Zeile, Eintrag), meldet das
 * Ergebnis trotzdem den Baustein selbst, denn dessen Einstellungen will man als Nächstes sehen. Ohne Angabe das Äußere.
 */
export const ergebnis = (quelle: string, a: Aenderung[], n: Nummerierung, baustein?: string): StrukturErgebnis => {
	const neu = wendeAn(quelle, a);
	const erste = a[0];
	if (!erste) {
		return { quelle, nr: null };
	}
	const innen = baustein ? erste.text.indexOf(baustein) : -1;
	const start = erste.von + (innen < 0 ? erste.text.indexOf('<') : innen);
	const nr = zerlege(neu).knoten.find((k) => k.start === start)?.nr ?? null;
	return { quelle: nummeriere(neu, n), nr };
};

/** Oberstes Kind der Seite, in dem `k` liegt. */
const seitenkind = (k: Knoten) => {
	let e: Knoten = k;
	while (e.eltern && !hat(e.eltern, 'seite')) {
		e = e.eltern;
	}
	return e.eltern ? e : null;
};

const stelleAufSeite = (z: Zerlegung, seite: Knoten, html: string): Aenderung[] => {
	// Der Stapel endet vor den Ebenen der Gestaltung (Phase 12).
	const ende = seite.kinder.filter((k) => !hat(k, 'fuss') && !hat(k, 'ebene')).at(-1);
	const fuss = seite.kinder.find((k) => hat(k, 'fuss') || hat(k, 'ebene'));
	if (ende) {
		return fuegeEin(z, ende, 'nach', html);
	}
	if (fuss) {
		return fuegeEin(z, fuss, 'vor', html);
	}
	return [{ von: seite.oeffnerEnde, bis: seite.schliesserStart, text: html }];
};

/** Neue Aufgabe hinter der gewählten, nie hinter die Sternchenaufgabe; ohne Auswahl ans Ende der letzten Seite. */
const aufSeite = (z: Zerlegung, ziel: Knoten | null, html: string): Aenderung[] => {
	const seiten = seitenVon(z);
	const kind = ziel ? seitenkind(ziel) : null;
	const seite = (ziel && aufwaerts(ziel, 'seite')) ?? seiten.at(-1);
	if (!seite) {
		throw new Error('Das Material hat keine Seite.');
	}
	if (kind && !['fuss', 'namenszeile', 'loesung-marke', 'ebene'].some((c) => hat(kind, c))) {
		const stern = hat(kind, 'aufgabe') && kind.kinder.some((k) => hat(k, 'stern'));
		return fuegeEin(z, kind, stern ? 'vor' : 'nach', html);
	}
	const stern = seite.kinder.find((k) => hat(k, 'aufgabe') && k.kinder.some((i) => hat(i, 'stern')));
	return stern ? fuegeEin(z, stern, 'vor', html) : stelleAufSeite(z, seite, html);
};

const inKoerper = (z: Zerlegung, koerper: Knoten, html: string): Aenderung[] => {
	const letztes = koerper.kinder.at(-1);
	return letztes
		? fuegeEin(z, letztes, 'nach', html)
		: [{ von: koerper.oeffnerEnde, bis: koerper.schliesserStart, text: html }];
};

/**
 * In der gewählten Aufgabe bzw. im Item, sonst in einer neuen Aufgabe. In einer gewählten Karte ans Ende ihres Inhalts
 * (203-03): Ein Eintrag daneben läge lose im Kartenbogen.
 */
const inAufgabe = (z: Zerlegung, ziel: Knoten | null, html: string, anweisung?: string): Aenderung[] => {
	const karte = aufwaerts(ziel, 'karte');
	if (karte && hat(karte.eltern, 'karten')) {
		return inKoerper(z, karte, html);
	}
	const zelle = aufwaerts(ziel, 'zelle') ?? karte;
	if (zelle) {
		return fuegeEin(
			z,
			zelle,
			'nach',
			html.startsWith('<div class="zelle') ? html : `<div class="zelle">${html}</div>`,
		);
	}
	const aufgabe = aufwaerts(ziel, 'aufgabe');
	const koerper = aufgabe?.kinder.find((k) => hat(k, 'koerper'));
	return koerper ? inKoerper(z, koerper, html) : aufSeite(z, ziel, neueAufgabe(html, anweisung));
};

/** Die eigene Zeile eines Elements mit Ort `zeile`, mit dem Satz darum, wenn es einen hat (203-06). */
export const zeileUm = (html: string, um?: readonly [string, string]) =>
	`<div class="zeile">${um?.[0] ?? ''}${html}${um?.[1] ?? ''}</div>`;

/** In einer Zeile bzw. einem Item; im Körper einer Aufgabe in einer neuen Zeile, sonst in einer neuen Aufgabe. */
const inZeile = (z: Zerlegung, ziel: Knoten | null, b: Einfuegbar, html: string): Aenderung[] => {
	const zeile = aufwaerts(ziel, 'zeile') ?? aufwaerts(ziel, 'zelle') ?? aufwaerts(ziel, 'karte');
	if (zeile) {
		const letztes = zeile.kinder.at(-1);
		if (letztes) {
			return fuegeEin(z, letztes, 'nach', html);
		}
		return [{ von: zeile.schliesserStart, bis: zeile.schliesserStart, text: html }];
	}
	return inAufgabe(z, ziel, zeileUm(html, b.umZeile), b.anweisung);
};

const setzeKlasse = (z: Zerlegung, k: Knoten, klasse: string) =>
	klassenVon(k).includes(klasse) ? [] : setzeAttribut(z, k, 'class', [...klassenVon(k), klasse].join(' '));

/** Eine Klasse setzt: am `<body>` oder, wie `beispiel`, am Item. Beides ändert keine Elementzahl. */
const mitKlasse = (quelle: string, z: Zerlegung, b: Einfuegbar, ziel: Knoten | null): StrukturErgebnis => {
	if (b.ort === 'blatt') {
		const body = z.knoten.find((n) => n.tag === 'body');
		if (!body || !b.klasse) {
			throw new Error('Das Material hat keinen Inhalt.');
		}
		return { quelle: wendeAn(quelle, setzeKlasse(z, body, b.klasse)), nr: ziel?.nr ?? null };
	}
	const k = aufwaerts(ziel, 'zelle');
	if (!k || !b.klasse) {
		throw new Error('Wähle zuerst einen Eintrag in einer Reihe, dann wird er zum Beispiel.');
	}
	if (klassenVon(k).includes(b.klasse)) {
		throw new Error('Dieser Eintrag ist schon das Beispiel.');
	}
	return { quelle: wendeAn(quelle, setzeKlasse(z, k, b.klasse)), nr: k.nr };
};

/**
 * Was der Katalog über einen Eintrag weiß, plus sein Starter-HTML (`html` am Eintrag vor dem Muster). Ein Aufgabenpaket
 * bekommt eine Hülle (Nummer, Aufgabentext); `aufgabe` in `teile` ist diese Hülle, kein Teil.
 */
export const einfuegbarAus = (e: KatalogEintrag, starter: ReadonlyMap<string, string>): Einfuegbar => {
	const html = e.html ?? (e.starter ? (starter.get(e.starter) ?? '') : undefined);
	const angaben = {
		id: e.id,
		ort: e.ort,
		...(e.umZeile ? { umZeile: e.umZeile } : {}),
		...(e.stelle ? { stelle: e.stelle } : {}),
	};
	if (e.herkunft === 'paket') {
		const teile = e.teile?.filter((t) => t !== 'aufgabe').map((t) => starter.get(t) ?? '') ?? [];
		return { ...angaben, teile: html === undefined ? teile : [html], anweisung: e.anweisung ?? '' };
	}
	return {
		...angaben,
		...(e.klasse ? { klasse: e.klasse } : {}),
		...(html === undefined ? {} : { html }),
		...(e.anweisung ? { anweisung: e.anweisung } : {}),
	};
};

/** Was eine Seite nur einmal hat (203-14): Einfügen wählt das vorhandene, statt ein zweites zu setzen. */
const EINMAL: Readonly<Record<string, { klasse: string; meldung: string }>> = {
	kopf: { klasse: 'kopf', meldung: 'Diese Seite hat schon einen Kopf. Er ist jetzt ausgewählt.' },
	namenszeile: {
		klasse: 'namenszeile',
		meldung: 'Diese Seite hat schon eine Namenszeile. Sie ist jetzt ausgewählt.',
	},
	fuss: { klasse: 'fuss', meldung: 'Diese Seite hat schon eine Selbsteinschätzung. Sie ist jetzt ausgewählt.' },
};

const enthaelt = (k: Knoten, tag: string): boolean => k.kinder.some((c) => c.tag === tag || enthaelt(c, tag));

/** Die Seite für die Lehrkraft (203-07) erkennt man an ihrem Notenschlüssel oder Erwartungshorizont. */
const istSeiteDerLehrkraft = (s: Knoten) => enthaelt(s, 'x-notenschluessel') || enthaelt(s, 'x-erwartungshorizont');

export interface SchonDa {
	nr: number;
	meldung: string;
}

/**
 * Gibt es, was `b` einfügen würde, an seiner Stelle schon (203-07, 203-14)? Dann das vorhandene Element samt Meldung;
 * der Aufrufer wählt es und fügt nichts ein.
 */
export const schonDa = (quelle: string, b: Einfuegbar, nr: number | null): SchonDa | null => {
	const z = zerlege(quelle);
	if (b.stelle === 'neue-seite') {
		const seite = seitenVon(z).find(istSeiteDerLehrkraft);
		return seite ? { nr: seite.nr, meldung: 'Die Seite für die Lehrkraft gibt es schon. Sie ist jetzt ausgewählt.' } : null;
	}
	const einmal = EINMAL[b.id];
	if (!einmal) {
		return null;
	}
	const ziel = nr === null ? null : (z.knoten[nr] ?? null);
	const seite = (ziel && aufwaerts(ziel, 'seite')) ?? seitenVon(z).at(-1);
	const da = seite?.kinder.find((k) => hat(k, einmal.klasse));
	return da ? { nr: da.nr, meldung: einmal.meldung } : null;
};

/** Hinter die letzte Aufgabe ihrer Seite bzw. auf eine neue letzte Seite (203-07). */
const anFesterStelle = (z: Zerlegung, b: Einfuegbar, html: string): Aenderung[] => {
	const seiten = seitenVon(z);
	const letzte = seiten.at(-1);
	if (!letzte) {
		throw new Error('Das Material hat keine Seite.');
	}
	if (b.stelle === 'neue-seite') {
		const klasse = attribut(letzte, 'class')?.wert ?? 'seite';
		return fuegeEin(z, letzte, 'nach', `<${letzte.tag} class="${klasse}">${html}</${letzte.tag}>`);
	}
	const mitAufgabe = seiten.findLast((s) => s.kinder.some((k) => hat(k, 'aufgabe'))) ?? letzte;
	const aufgabe = mitAufgabe.kinder.findLast((k) => hat(k, 'aufgabe'));
	return aufgabe ? fuegeEin(z, aufgabe, 'nach', html) : stelleAufSeite(z, mitAufgabe, html);
};

/** Was auf einer Folie kein Inhalt ist: Kopf, Notiz, Ebenen der Gestaltung (203-10). */
const ohneInhalt = (seite: Knoten) =>
	seite.kinder.every((k) => ['kopf', 'notiz', 'ebene', 'loesung-marke'].some((c) => hat(k, c)));

/**
 * Inhalt einer Folie (203-10): in die gewählte Folie, wenn sie nur Kopf und Notiz hat, hinter ihren Kopf; sonst auf eine
 * neue Folie dahinter mit dem Kopf „Titel der Folie“. Im Blatt wie ein Baustein der Seite.
 */
const aufFolie = (z: Zerlegung, ziel: Knoten | null, html: string, n: Nummerierung): Aenderung[] => {
	if (!n.jeSeite) {
		return aufSeite(z, ziel, html);
	}
	const seite = (ziel && aufwaerts(ziel, 'seite')) ?? seitenVon(z).at(-1);
	if (!seite) {
		throw new Error('Das Material hat keine Seite.');
	}
	if (ohneInhalt(seite)) {
		const kopf = seite.kinder.find((k) => hat(k, 'kopf'));
		return kopf ? fuegeEin(z, kopf, 'nach', html) : stelleAufSeite(z, seite, html);
	}
	const klasse = attribut(seite, 'class')?.wert ?? 'seite';
	const titel = '<div class="kopf"><div class="titel"><h1>Titel der Folie</h1></div></div>';
	return fuegeEin(z, seite, 'nach', `<${seite.tag} class="${klasse}">${titel}${html}</${seite.tag}>`);
};

/** Kopf und Namenszeile gehören an den Anfang der Seite, der Fuß ans Ende; alles andere richtet sich nach der Auswahl. */
export const festeStelle = (z: Zerlegung, ziel: Knoten | null, b: Einfuegbar, html: string): Aenderung[] | null => {
	if (b.id !== 'kopf' && b.id !== 'namenszeile' && b.id !== 'fuss') {
		return null;
	}
	const seite = (ziel && aufwaerts(ziel, 'seite')) ?? seitenVon(z).at(-1);
	if (!seite) {
		throw new Error('Das Material hat keine Seite.');
	}
	if (b.id === 'fuss') {
		return stelleAufSeite(z, seite, html);
	}
	const erstes = seite.kinder.find((k) => !(b.id === 'kopf' && hat(k, 'namenszeile')));
	return erstes ? fuegeEin(z, erstes, 'vor', html) : stelleAufSeite(z, seite, html);
};

/** Fügt `b` an der Stelle `nr` ein (ohne Auswahl: am Ende der letzten Seite). Ein einziger Schritt im Verlauf. */
/**
 * Eine Lineatur ohne `art` bekommt beim Einfügen die der Klasse des Blatts (203-12). Das Element selbst nimmt ohne
 * `art` die Lineatur 1; das zu ändern wäre ein Eingriff ins Skill-Asset. Ohne Klasse am `<body>` bleibt alles, wie es
 * ist.
 */
/** Die Klasse am `<body>` (`kl1` … `kl4`). Danach zeichnen die Elemente, nicht nach der Klasse der Mappe. */
export const klasseDesBlatts = (quelle: string) => {
	const k = /<body\b[^>]*\bclass="[^"]*\bkl([1-4])\b/.exec(quelle)?.[1];
	return k === undefined ? undefined : (Number(k) as 1 | 2 | 3 | 4);
};

export const mitLineaturDerKlasse = (quelle: string, b: Einfuegbar): Einfuegbar => {
	const klasse = klasseDesBlatts(quelle);
	if (!klasse) {
		return b;
	}
	const setze = (html: string) =>
		html.replace(/<x-lineatur\b(?![^>]*\sart=)/g, `<x-lineatur art="${klasse}"`);
	return {
		...b,
		...(b.html === undefined ? {} : { html: setze(b.html) }),
		...(b.teile ? { teile: b.teile.map(setze) } : {}),
	};
};

export const fuegeBausteinEin = (
	quelle: string,
	baustein: Einfuegbar,
	nr: number | null,
	n: Nummerierung,
): StrukturErgebnis => {
	const b = mitLineaturDerKlasse(quelle, baustein);
	const z = zerlege(quelle);
	const ziel = nr === null ? null : (z.knoten[nr] ?? null);
	if (b.klasse) {
		return mitKlasse(quelle, z, b, ziel);
	}
	if (b.teile) {
		return ergebnis(quelle, aufSeite(z, ziel, neueAufgabe(b.teile.join(''), b.anweisung)), n);
	}
	const html = b.html ?? '';
	if (b.stelle) {
		return ergebnis(quelle, anFesterStelle(z, b, html), n);
	}
	const fest = festeStelle(z, ziel, b, html);
	if (fest) {
		return ergebnis(quelle, fest, n);
	}
	if (b.ort === 'seite') {
		return ergebnis(quelle, aufSeite(z, ziel, html), n);
	}
	if (b.ort === 'folie') {
		return ergebnis(quelle, aufFolie(z, ziel, html, n), n);
	}
	const aenderungen = b.ort === 'zeile' ? inZeile(z, ziel, b, html) : inAufgabe(z, ziel, html, b.anweisung);
	return ergebnis(quelle, aenderungen, n, html);
};

export interface Zusatz {
	selbsteinschaetzung?: boolean;
	niveaus?: boolean;
	sternchen?: boolean;
}

const STERNCHEN =
	'<div class="aufgabe"><span class="nr stern">★</span><div class="anw"><span class="text">Für Schnelle</span></div><div class="koerper"></div></div>';

/** Die Zusatzbausteine aus dem Assistenten (045). Ohne Wahl bleibt die Quelle unverändert. */
export const fuegeZusatzEin = (
	quelle: string,
	zusatz: Zusatz,
	starter: ReadonlyMap<string, string>,
	n: Nummerierung,
) => {
	const schritte: Einfuegbar[] = [
		...(zusatz.niveaus ? [{ id: 'wahlhilfe', ort: 'seite' as const, html: starter.get('wahlhilfe') ?? '' }] : []),
		...(zusatz.sternchen ? [{ id: 'sternchen', ort: 'seite' as const, html: STERNCHEN }] : []),
		...(zusatz.selbsteinschaetzung ? [{ id: 'fuss', ort: 'seite' as const, html: starter.get('fuss') ?? '' }] : []),
	];
	return schritte.reduce((q, b) => fuegeBausteinEin(q, b, null, n).quelle, quelle);
};

/**
 * Überlauf (044): Die genannten Kinder einer Seite kommen auf eine neue Seite direkt dahinter; was die Seite sonst
 * auszeichnet (Fuß), bleibt, wo es ist. Ein Schritt im Verlauf.
 */
export const verschiebeAufNeueSeite = (quelle: string, nrs: readonly number[], n: Nummerierung): StrukturErgebnis => {
	const z = zerlege(quelle);
	const knoten = nrs.flatMap((nr) => z.knoten[nr] ?? []);
	const seite = knoten[0]?.eltern;
	if (!seite || !hat(seite, 'seite') || knoten.some((k) => k.eltern !== seite)) {
		throw new Error('Diese Bausteine lassen sich nicht zusammen verschieben.');
	}
	const einzug = einrueckung(z, seite) ?? '';
	const teile = knoten.map((k) => `${einzug}  ${rueckeUm(quelleVon(z, k), einrueckung(z, k), `${einzug}  `)}`);
	const tag = seite.tag;
	const klasse = attribut(seite, 'class')?.wert ?? 'seite';
	const html = `<${tag} class="${klasse}">\n${teile.join('\n')}\n${einzug}</${tag}>`;
	const raus = knoten.flatMap((k) => entferne(z, k));
	const rein = fuegeEin(z, seite, 'nach', html);
	const alle = [...raus, ...rein];
	return { quelle: nummeriere(wendeAn(quelle, alle), n), nr: null };
};
