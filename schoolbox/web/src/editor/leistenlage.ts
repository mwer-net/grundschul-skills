/** Ein Rechteck in Koordinaten der Leinwand. */
export interface Kante {
	links: number;
	rechts: number;
	oben: number;
	unten: number;
}

/** Abstand der Leiste zum Element und zum Rand des Sichtfelds. */
export const LEISTEN_ABSTAND = 6;

/** Ein Rechteck wie `DOMRect`: Inhalt im Blatt oder auf der Leinwand. */
export interface Rechteck {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** Was um das Element liegt, in Pixeln der Leinwand: fremder Inhalt und die Seite (für den Platz am Seitenrand). */
export interface Umfeld {
	inhalt: readonly Rechteck[];
	seite: Kante | null;
}

/**
 * Die Stelle, die die Leiste gewählt hat, gemessen am Element: `oben:<dx>`, `unten:<dx>`, `obenEng:<dx>`,
 * `untenEng:<dx>` (linke Kante der Leiste minus rechte Kante des Elements), `neben-rechts`, `neben-links`, `sicht`. In der Textsitzung bleibt sie (204-15).
 */
export type Wahl = string;

/** Luft um fremden Inhalt, in Pixeln der Leinwand. */
const LUFT = 2;

/** Was ein Pixel Abstand zum Element kostet, in Pixeln verdeckter Fläche. */
const ENTFERNUNG = 2;

const flaeche = (a: Rechteck, b: Rechteck) =>
	Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
	Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** Eine schon getroffene Wahl, gemessen an der Box von jetzt; `null`, wenn es sie nicht (mehr) gibt. */
const gemerkteStelle = (
	wahl: Wahl | null,
	zeilen: { oben: number; unten: number; obenEng: number; untenEng: number },
	vonDx: (dx: number) => number,
	{
		neben,
		nebenTop,
		seite,
	}: { neben: { 'neben-rechts': number; 'neben-links': number }; nebenTop: number; seite: Kante | null },
) => {
	if (wahl === null) {
		return null;
	}
	const [seitenname, dx] = wahl.split(':');
	if (seitenname !== undefined && seitenname in zeilen) {
		return { links: vonDx(Number(dx)), top: zeilen[seitenname as keyof typeof zeilen], wahl };
	}
	if (seite && (wahl === 'neben-rechts' || wahl === 'neben-links')) {
		return { links: neben[wahl], top: nebenTop, wahl };
	}
	return null;
};

/** Weitere waagerechte Stellen in einer Zeile mit Umfeld: links- und mittig am Element, am Seitenrand, neben Inhalt. */
const xeMitUmfeld = (box: Kante, b: number, h: number, top: number, umfeld: Umfeld) => {
	const A = LEISTEN_ABSTAND;
	const xe = [box.links, (box.links + box.rechts - b) / 2];
	if (umfeld.seite) {
		xe.push(umfeld.seite.rechts - b, umfeld.seite.links);
	}
	// Gleich neben fremdem Inhalt in dieser Zeile.
	for (const c of umfeld.inhalt) {
		if (c.bottom > top && c.top < top + h) {
			xe.push(c.right + A, c.left - b - A);
		}
	}
	return xe;
};

/** Die Stelle, die am wenigsten fremden Inhalt verdeckt; Abstand zum Element kostet, bei Gleichstand die frühere. */
const besteStelle = (
	stellen: readonly { wahl: Wahl; links: number; top: number }[],
	box: Kante,
	mass: { breite: number; hoehe: number },
	frei: number,
	umfeld: Umfeld,
) => {
	const { breite: b, hoehe: h } = mass;
	const A = LEISTEN_ABSTAND;
	let beste = stellen[0];
	let wert = Number.POSITIVE_INFINITY;
	stellen.forEach((p, i) => {
		const r = { left: p.links, right: p.links + b, top: p.top, bottom: p.top + h };
		// Das eigene Element zu verdecken ist auch nicht gut, aber besser als fremden Inhalt.
		const eigen = flaeche(r, { left: box.links, right: box.rechts, top: box.oben, bottom: box.unten }) / 4;
		// Weit weg vom Element kostet auch: Eine Leiste, die man suchen muss, hilft nicht.
		const weg =
			Math.max(0, box.links - r.right, r.left - box.rechts) +
			Math.max(0, box.oben - frei - A - r.bottom, r.top - box.unten - A);
		const w = umfeld.inhalt.reduce((summe, c) => summe + flaeche(r, c), 0) + eigen + weg * ENTFERNUNG + i / 1000;
		if (w < wert) {
			wert = w;
			beste = p;
		}
	});
	return beste;
};

/**
 * Wo die Leiste am Element steht (204-15, 204-16, 204-N04), für Bausteine und Gestaltungselemente dieselbe Regel.
 * Ohne `umfeld`: über dem Element, sonst darunter, sonst oben im Sichtfeld; waagerecht rechtsbündig, bei einem Element
 * schmaler als die Leiste ab seiner linken Kante. Mit `umfeld` (Schlussdurchsicht): unter allen Stellen über und unter
 * dem Element (rechts-, linksbündig, mittig, am Seitenrand, neben fremdem Inhalt) und neben der Seite die, die am
 * wenigsten fremden Inhalt verdeckt; Abstand zum Element kostet etwas, bei Gleichstand gilt die frühere Stelle. Oben im
 * Sichtfeld nur, wenn sonst nichts passt. Die Leiste bleibt ganz im Sichtfeld. `frei`: Platz über dem Element, den der
 * Drehgriff eines Gestaltungselements braucht. `wahl` hält eine schon getroffene Wahl fest.
 */
export const lageDerLeiste = (
	box: Kante,
	mass: { breite: number; hoehe: number },
	sicht: Kante,
	frei = 0,
	umfeld: Umfeld | null = null,
	wahl: Wahl | null = null,
) => {
	const { breite: b, hoehe: h } = mass;
	const A = LEISTEN_ABSTAND;
	const imSicht = (x: number) => Math.max(sicht.links + A, Math.min(x, sicht.rechts - b - A));
	// `eng`: mit 2 px Abstand, wenn die 6 px gerade fremden Inhalt anschneiden würden.
	const zeilen = {
		oben: box.oben - frei - h - A,
		unten: box.unten + A,
		obenEng: box.oben - frei - h - 2,
		untenEng: box.unten + 2,
	};
	const passt = (top: number) => top >= sicht.oben + A && top + h <= sicht.unten - A;
	const schmal = box.rechts - box.links < b;
	const anker = schmal ? box.links : box.rechts - b;
	const seite = umfeld?.seite ?? null;
	const nebenTop = Math.max(sicht.oben + A, Math.min(box.oben, sicht.unten - h - A));
	const neben = { 'neben-rechts': (seite?.rechts ?? 0) + A, 'neben-links': (seite?.links ?? 0) - b - A };
	const ganzImSicht = (x: number) => x >= sicht.links + A && x + b <= sicht.rechts - A;
	const imBlatt = (x: number) => !seite || (x >= seite.links && x + b <= seite.rechts);
	const sichtStelle = { wahl: 'sicht', links: imSicht(anker), top: sicht.oben + A };

	// Eine schon getroffene Wahl gilt weiter, gemessen an der Box von jetzt.
	const gemerkt = gemerkteStelle(wahl, zeilen, (dx) => imSicht(box.rechts + dx), { neben, nebenTop, seite });
	if (gemerkt) {
		return gemerkt;
	}

	const stellen: { wahl: Wahl; links: number; top: number }[] = [];
	for (const zeile of umfeld ? (['oben', 'unten', 'obenEng', 'untenEng'] as const) : (['oben', 'unten'] as const)) {
		const top = zeilen[zeile];
		if (!passt(top)) {
			continue;
		}
		const xe = umfeld ? [anker, ...xeMitUmfeld(box, b, h, top, umfeld)] : [anker];
		for (const x of xe) {
			const links = imSicht(x);
			if (x === anker || imBlatt(links)) {
				stellen.push({ wahl: `${zeile}:${Math.round(links - box.rechts)}`, links, top });
			}
		}
	}
	if (seite && passt(nebenTop)) {
		stellen.push(
			...Object.entries(neben)
				.filter(([, x]) => ganzImSicht(x))
				.map(([name, x]) => ({ wahl: name, links: x, top: nebenTop })),
		);
	}
	if (stellen.length === 0) {
		return { ...sichtStelle };
	}
	const beste = (umfeld ? besteStelle(stellen, box, mass, frei, umfeld) : stellen[0]) ?? sichtStelle;
	return { links: beste.links, top: beste.top, wahl: beste.wahl };
};

/** Was man sieht, ohne dass es Text ist: Bilder, Formen, Uhren, Niveau-Punkte, Nummern, Linien, Kästchen. */
export const SICHTBARES_OHNE_TEXT =
	'img, svg, x-uhr, canvas, .niveau, .nr, .box, .schreiblinie, .antwort, .leerstelle, .punkte, hr';

/**
 * Fremder Inhalt (Text, Bilder, Formen, Uhren) um `eigen` in Koordinaten des Blatts: auf der eigenen Seite und den
 * Nachbarseiten. Was in `ohne` liegt (sonst `eigen`), zählt nicht; der Text der umgebenden Aufgabe zählt.
 */
export const fremderInhalt = (eigen: readonly Element[], ohne: readonly Element[] = eigen): Rechteck[] => {
	const erstes = eigen[0];
	const doc = erstes?.ownerDocument;
	if (!erstes || !doc) {
		return [];
	}
	const seite = erstes.closest('.seite');
	const wurzeln = seite
		? [seite.previousElementSibling, seite, seite.nextElementSibling].filter(
				(s): s is Element => s?.matches('.seite') ?? false,
			)
		: [doc.body];
	const aus: Rechteck[] = [];
	const fremd = (k: Node) => !ohne.some((el) => el.contains(k));
	const nimm = (r: DOMRect) => {
		if (r.width >= 1 && r.height >= 1) {
			aus.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
		}
	};
	const bereich = doc.createRange();
	for (const wurzel of wurzeln) {
		const lauf = doc.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
		for (let k = lauf.nextNode(); k; k = lauf.nextNode()) {
			const stil = k.parentElement ? doc.defaultView?.getComputedStyle(k.parentElement) : null;
			if (!k.nodeValue?.trim() || !fremd(k) || stil?.visibility === 'hidden') {
				continue;
			}
			bereich.selectNodeContents(k);
			for (const r of bereich.getClientRects()) {
				nimm(r);
			}
		}
		for (const m of wurzel.querySelectorAll(SICHTBARES_OHNE_TEXT)) {
			if (fremd(m) && !m.parentElement?.closest('svg')) {
				nimm(m.getBoundingClientRect());
			}
		}
	}
	return aus;
};

const gemerkt = {
	ohneEigenes: new WeakMap<Element, { schluessel: string; inhalt: Rechteck[] }>(),
	mitEigenem: new WeakMap<Element, { schluessel: string; inhalt: Rechteck[] }>(),
};

/**
 * Das Umfeld der Leiste an `eigen` in Pixeln der Leinwand. Gemerkt je Element, solange seine Box und die Höhe der
 * Seite gleich bleiben: Die Lage ändert sich nur bei Auswahlwechsel oder Größenänderung, nicht bei jedem Zeichnen.
 * `mitEigenem`: Auch der Inhalt von `eigen` zählt (Plakette „Nur Arbeitsblatt“, die nichts verdecken darf).
 */
export const umfeldDerLeiste = (
	e: { links: number; skala: number },
	box: { top: number; bottom: number; left: number; right: number },
	eigen: readonly Element[],
	mitEigenem = false,
): Umfeld | null => {
	const erstes = eigen[0];
	if (!erstes) {
		return null;
	}
	const seite = erstes.closest('.seite');
	const sr = seite?.getBoundingClientRect();
	const schluessel = [box.top, box.bottom, box.left, box.right, sr?.top, sr?.height, eigen.length].join('|');
	const speicher = mitEigenem ? gemerkt.mitEigenem : gemerkt.ohneEigenes;
	const alt = speicher.get(erstes);
	const inhalt = alt?.schluessel === schluessel ? alt.inhalt : fremderInhalt(eigen, mitEigenem ? [] : eigen);
	speicher.set(erstes, { schluessel, inhalt });
	const k = (x: number) => e.links + x * e.skala;
	return {
		// Ein wenig Luft um den Inhalt: Was ihn gerade berührt, wirkt auch verdeckt.
		inhalt: inhalt.map((r) => ({
			left: k(r.left) - LUFT,
			right: k(r.right) + LUFT,
			top: r.top * e.skala - LUFT,
			bottom: r.bottom * e.skala + LUFT,
		})),
		seite: sr
			? { links: k(sr.left), rechts: k(sr.right), oben: sr.top * e.skala, unten: sr.bottom * e.skala }
			: null,
	};
};

/**
 * 204-13: Ein Mausklick auf einen Knopf der Leiste lässt den Fokus im Blatt, Esc geht dann sofort eine Ebene höher.
 * Knöpfe, die ein Menü oder Popover öffnen, behalten ihn, ebenso „Claude“ (der Fokus geht ins Gespräch); mit der
 * Tastatur (`detail` 0) bleibt alles, wie es war.
 */
export const fokusZurueckInsBlatt = (ereignis: { detail: number; target: EventTarget | null }, doc: Document) => {
	const knopf = (ereignis.target as Element | null)?.closest?.('button');
	if (ereignis.detail > 0 && knopf && !knopf.matches('[aria-haspopup], [aria-expanded], [data-claude-knopf]')) {
		doc.defaultView?.focus();
	}
};

/** Ob sich zwei Rechtecke schneiden; bloßes Berühren zählt nicht. */
export const schneiden = (
	a: { left: number; right: number; top: number; bottom: number },
	b: { left: number; right: number; top: number; bottom: number },
) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Die Leiste der Auswahl im Elternfenster, ob Baustein oder Gestaltung. */
export const leisteDerAuswahl = (doc: Document) =>
	doc.querySelector<HTMLElement>('[data-bausteinleiste], [data-gestaltungsleiste]');
