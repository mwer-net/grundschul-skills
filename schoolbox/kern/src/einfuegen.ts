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
	ort: 'blatt' | 'seite' | 'aufgabe' | 'zeile';
	/** Fertiges HTML des Starters; bei Rezepten die Teile im `.koerper`. */
	html?: string;
	teile?: readonly string[];
	anweisung?: string;
	/** Setzt nur eine Klasse: am `<body>` (`ort: 'blatt'`) oder am umgebenden Item. */
	klasse?: string;
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

export const neueAufgabe = (innen: string, anweisung = 'Anweisung') =>
	`<div class="aufgabe"><span class="nr">0</span><div class="anw"><span class="text">${anweisung}</span></div><div class="koerper">${innen}</div></div>`;

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

/** In der gewählten Aufgabe bzw. im Item, sonst in einer neuen Aufgabe. */
const inAufgabe = (z: Zerlegung, ziel: Knoten | null, html: string): Aenderung[] => {
	const zelle = aufwaerts(ziel, 'zelle') ?? aufwaerts(ziel, 'karte');
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
	return koerper ? inKoerper(z, koerper, html) : aufSeite(z, ziel, neueAufgabe(html));
};

/** In einer Zeile bzw. einem Item; im Körper einer Aufgabe in einer neuen Zeile, sonst in einer neuen Aufgabe. */
const inZeile = (z: Zerlegung, ziel: Knoten | null, html: string): Aenderung[] => {
	const zeile = aufwaerts(ziel, 'zeile') ?? aufwaerts(ziel, 'zelle') ?? aufwaerts(ziel, 'karte');
	if (zeile) {
		const letztes = zeile.kinder.at(-1);
		if (letztes) {
			return fuegeEin(z, letztes, 'nach', html);
		}
		return [{ von: zeile.schliesserStart, bis: zeile.schliesserStart, text: html }];
	}
	return inAufgabe(z, ziel, `<div class="zeile">${html}</div>`);
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

/** Was der Katalog über einen Eintrag weiß, plus sein Starter-HTML. `aufgabe` in einem Rezept ist die Hülle, kein Teil. */
export const einfuegbarAus = (e: KatalogEintrag, starter: ReadonlyMap<string, string>): Einfuegbar => ({
	id: e.id,
	ort: e.ort,
	...(e.klasse ? { klasse: e.klasse } : {}),
	...(e.starter ? { html: starter.get(e.starter) ?? '' } : {}),
	...(e.teile
		? {
				teile: e.teile.filter((t) => t !== 'aufgabe').map((t) => starter.get(t) ?? ''),
				anweisung: e.anweisung ?? '',
			}
		: {}),
});

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
export const fuegeBausteinEin = (
	quelle: string,
	b: Einfuegbar,
	nr: number | null,
	n: Nummerierung,
): StrukturErgebnis => {
	const z = zerlege(quelle);
	const ziel = nr === null ? null : (z.knoten[nr] ?? null);
	if (b.klasse) {
		return mitKlasse(quelle, z, b, ziel);
	}
	if (b.teile) {
		return ergebnis(quelle, aufSeite(z, ziel, neueAufgabe(b.teile.join(''), b.anweisung)), n);
	}
	const html = b.html ?? '';
	const fest = festeStelle(z, ziel, b, html);
	if (fest) {
		return ergebnis(quelle, fest, n);
	}
	if (b.ort === 'seite') {
		return ergebnis(quelle, aufSeite(z, ziel, html), n);
	}
	return ergebnis(quelle, b.ort === 'zeile' ? inZeile(z, ziel, html) : inAufgabe(z, ziel, html), n, html);
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
