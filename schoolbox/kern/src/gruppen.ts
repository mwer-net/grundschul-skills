/**
 * Gruppen (120, Briefing 3.4 „Gruppe“, Entscheidung 47): `div.gruppe[data-lage="frei"]` mit Gestaltungselementen, deren
 * Lage in Koordinaten der Gruppe steht. Bewegen und Drehen ändern nur die Gruppe; Skalieren rechnet die Kinder um, weil
 * px nicht von selbst skalieren. Rein, ohne DOM: Was nur die Darstellung weiß (Größe ohne `--h`), misst der Editor.
 */

import type { Lage } from './gestaltung';
import { htmlMitLage, istGestaltung, leseLage, setzeLage, setzeStilWerte, stilMitLage } from './gestaltung';
import { GESTALTUNG_ARTEN } from './gestaltung-arten';
import type { Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	einrueckung,
	entferne,
	klassenVon,
	quelleVon,
	rueckeUm,
	setzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';
import { passt } from './referenz';
import type { StrukturErgebnis } from './struktur';

/** Ein Kasten vor dem Drehen, in Koordinaten des Elternteils (wie `--x --y --b --h`). */
export interface Mass {
	x: number;
	y: number;
	b: number;
	h: number;
}

const ANKER = 'data-anker';
/** Nur für die Dauer einer Rechnung: findet Gruppe bzw. Kinder nach dem Umbau wieder. */
const MARKE = 'data-gruppe-schritt';
const EINZUG = '  ';

export const istGruppe = (k: Knoten | null | undefined): boolean =>
	Boolean(k && klassenVon(k).includes('gruppe') && istGestaltung(k));

const artVon = (k: Knoten) => GESTALTUNG_ARTEN.find((a) => passt(k, a.selektor, false));

const knotenAn = (z: Zerlegung, nr: number) => {
	const k = z.knoten[nr];
	if (!k) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	return k;
};

const gruppeAn = (z: Zerlegung, nr: number) => {
	const k = knotenAn(z, nr);
	if (!istGruppe(k)) {
		throw new Error(`Das Element ${nr} ist keine Gruppe.`);
	}
	return k;
};

/** Zwischen −180 und 180, eine Nachkommastelle. */
const winkel = (grad: number) => {
	const w = Math.round((((((grad + 180) % 360) + 360) % 360) - 180) * 10) / 10;
	return Object.is(w, -0) ? 0 : w;
};

const bogen = (grad: number) => (grad * Math.PI) / 180;

/** Das achsenparallele Rechteck um einen gedrehten Kasten (Drehung um seine Mitte). */
export const umschliessend = (m: Mass, drehen = 0) => {
	const c = Math.abs(Math.cos(bogen(drehen)));
	const s = Math.abs(Math.sin(bogen(drehen)));
	const mx = m.x + m.b / 2;
	const my = m.y + m.h / 2;
	const ex = (m.b * c + m.h * s) / 2;
	const ey = (m.b * s + m.h * c) / 2;
	return { links: mx - ex, oben: my - ey, rechts: mx + ex, unten: my + ey };
};

/** Ein Attribut ohne Wert bzw. mit Wert in `html` (äußerstes Element), am Ende des Start-Tags. */
const mitAttribut = (html: string, name: string, wert: string | null | true) => {
	const z = zerlege(html);
	const k = z.wurzeln[0];
	if (!k) {
		return html;
	}
	if (wert === null) {
		return wendeAn(html, setzeAttribut(z, k, name, null));
	}
	if (attribut(k, name)) {
		return wert === true ? html : wendeAn(html, setzeAttribut(z, k, name, wert));
	}
	const tag = html.slice(k.start, k.oeffnerEnde);
	const pos = k.start + (/\s*\/?>$/.exec(tag)?.index ?? tag.length);
	const text = wert === true ? ` ${name}` : ` ${name}="${wert}"`;
	return html.slice(0, pos) + text + html.slice(pos);
};

/** Entfernt die Marken und liefert die Nummern der markierten Elemente, nach Markenwert geordnet. */
const loeseMarken = (quelle: string) => {
	const z = zerlege(quelle);
	const markiert = z.knoten
		.filter((k) => attribut(k, MARKE))
		.map((k) => ({ k, i: Number(attribut(k, MARKE)?.wert) }))
		.sort((a, b) => a.i - b.i);
	const neu = wendeAn(
		quelle,
		markiert.flatMap(({ k }) => setzeAttribut(z, k, MARKE, null)),
	);
	return { quelle: neu, nrn: markiert.map(({ k }) => k.nr) };
};

/** Die Kinder in einer eigenen Zeile je Kind, eingerückt wie die Umgebung; ohne Zeilen hintereinander. */
const verbinde = (teile: readonly string[], einzug: string | null) =>
	einzug === null ? teile.join('') : teile.join(`\n${einzug}`);

// ── Gruppieren ──────────────────────────────────────────────────────────────

/**
 * Fasst Gestaltungselemente desselben Elternteils (Ebene, Fläche oder Baustein am Anker) zu einer Gruppe zusammen. Die
 * Gruppe steht an der Stelle des vordersten Kinds, die Kinder behalten ihre Reihenfolge. Ihre Lage ist das Rechteck um
 * die Kinder nach deren Drehung; `masse` (in der Reihenfolge von `nrn`) sind die gemessenen Kästen vor dem Drehen, für
 * Kinder ohne `--b` oder `--h`. Hängen die Kinder am Anker, trägt ihn danach die Gruppe. `nr` ist die Gruppe.
 */
export const gruppiere = (quelle: string, nrn: readonly number[], masse: readonly (Mass | undefined)[] = []) => {
	const z = zerlege(quelle);
	const liste = [...new Set(nrn)];
	if (liste.length < 2) {
		throw new Error('Eine Gruppe braucht mindestens zwei Elemente.');
	}
	const kinder = liste.map((nr) => {
		const k = knotenAn(z, nr);
		if (!istGestaltung(k)) {
			throw new Error(`Das Element ${nr} ist keine Gestaltung.`);
		}
		const lage = leseLage(quelle, nr);
		const m = masse[nrn.indexOf(nr)];
		const kasten: Mass = {
			x: lage.x ?? m?.x ?? 0,
			y: lage.y ?? m?.y ?? 0,
			b: lage.b ?? m?.b ?? 0,
			h: lage.h ?? m?.h ?? 0,
		};
		return { k, kasten, drehen: lage.drehen ?? 0 };
	});
	const eltern = kinder[0]?.k.eltern ?? null;
	if (!kinder.every(({ k }) => k.eltern === eltern)) {
		throw new Error('Nur Elemente derselben Ebene lassen sich gruppieren.');
	}
	kinder.sort((a, b) => a.k.start - b.k.start);
	const raender = kinder.map(({ drehen, kasten }) => umschliessend(kasten, drehen));
	const x = Math.floor(Math.min(...raender.map((r) => r.links)));
	const y = Math.floor(Math.min(...raender.map((r) => r.oben)));
	const b = Math.ceil(Math.max(...raender.map((r) => r.rechts))) - x;
	const h = Math.ceil(Math.max(...raender.map((r) => r.unten))) - y;
	const anker = kinder.some(({ k }) => attribut(k, ANKER));

	const vorderstes = kinder.at(-1)?.k;
	if (!vorderstes) {
		throw new Error('Eine Gruppe braucht mindestens zwei Elemente.');
	}
	const einzug = einrueckung(z, vorderstes);
	const innen = einzug === null ? null : einzug + EINZUG;
	const teile = kinder.map(({ k, kasten }) => {
		const eigen = anker ? mitAttribut(quelleVon(z, k), ANKER, null) : quelleVon(z, k);
		const html = htmlMitLage(eigen, { x: kasten.x - x, y: kasten.y - y });
		return rueckeUm(html, einrueckung(z, k), innen);
	});
	const stil = stilMitLage(null, { x, y, b, h }) ?? '';
	const oeffner = `<div class="gruppe" data-lage="frei"${anker ? ` ${ANKER}` : ''} ${MARKE}="0" style="${stil}">`;
	const gruppe =
		einzug === null || innen === null
			? `${oeffner}${teile.join('')}</div>`
			: `${oeffner}\n${innen}${verbinde(teile, innen)}\n${einzug}</div>`;
	const aenderungen = [
		...kinder.slice(0, -1).flatMap(({ k }) => entferne(z, k)),
		{ von: vorderstes.start, bis: vorderstes.ende, text: gruppe },
	];
	const { nrn: gefunden, quelle: neu } = loeseMarken(wendeAn(quelle, aenderungen));
	return { quelle: neu, nr: gefunden[0] ?? null } satisfies StrukturErgebnis;
};

// ── Auflösen ────────────────────────────────────────────────────────────────

/**
 * Löst die Gruppe auf: Die Kinder stehen an ihrer Stelle, mit Lage in Koordinaten des Elternteils. Drehung und
 * Spiegelung der Gruppe gehen in die Kinder über, die Lage im Blatt bleibt. `groessen` sind gemessene Größen der
 * Kinder (in ihrer Reihenfolge) für Kinder ohne `--b` oder `--h`; ohne Drehung und Spiegelung braucht es sie nicht.
 * `nr` ist das erste Kind, `kinder` alle in Quellreihenfolge.
 */
export const loeseGruppe = (
	quelle: string,
	nr: number,
	groessen: readonly ({ b: number; h: number } | undefined)[] = [],
): StrukturErgebnis & { kinder: number[] } => {
	const z = zerlege(quelle);
	const g = gruppeAn(z, nr);
	const gl = leseLage(quelle, nr);
	const gx = gl.x ?? 0;
	const gy = gl.y ?? 0;
	const gb = gl.b ?? 0;
	const gh = gl.h ?? 0;
	const gd = gl.drehen ?? 0;
	const gs = (gl.spiegeln ?? 1) < 0 ? -1 : 1;
	const anker = Boolean(attribut(g, ANKER));
	const einzug = einrueckung(z, g);
	const cos = Math.cos(bogen(gd));
	const sin = Math.sin(bogen(gd));
	const kinder = g.kinder.filter(istGestaltung);
	const teile = kinder.map((k, i) => {
		const l: Lage = leseLage(quelle, k.nr);
		const b = l.b ?? groessen[i]?.b ?? 0;
		const h = l.h ?? groessen[i]?.h ?? 0;
		// Mitte des Kinds relativ zur Mitte der Gruppe, gespiegelt und gedreht wie die Gruppe (`rotate() scaleX()`).
		const px = ((l.x ?? 0) + b / 2 - gb / 2) * gs;
		const py = (l.y ?? 0) + h / 2 - gh / 2;
		const mx = gx + gb / 2 + px * cos - py * sin;
		const my = gy + gh / 2 + px * sin + py * cos;
		const cd = l.drehen ?? 0;
		const cs = (l.spiegeln ?? 1) < 0 ? -1 : 1;
		const drehen = winkel(gs < 0 ? gd - cd : gd + cd);
		const spiegeln = gs * cs;
		let html = htmlMitLage(quelleVon(z, k), {
			x: mx - b / 2,
			y: my - h / 2,
			drehen: drehen === 0 ? null : drehen,
			spiegeln: spiegeln < 0 ? -1 : null,
		});
		html = mitAttribut(html, MARKE, String(i));
		if (anker) {
			html = mitAttribut(html, ANKER, true);
		}
		return rueckeUm(html, einrueckung(z, k), einzug);
	});
	const neu = wendeAn(quelle, [{ von: g.start, bis: g.ende, text: verbinde(teile, einzug) }]);
	const r = loeseMarken(neu);
	return { quelle: r.quelle, nr: r.nrn[0] ?? null, kinder: r.nrn };
};

// ── Skalieren ───────────────────────────────────────────────────────────────

/**
 * Ein Kind, das kein ungleiches Skalieren verträgt: `proportional` oder `text` (Bild, Figur, Schmuckschrift …) oder
 * gedreht. Enthält eine Gruppe so eins, skalieren auch ihre Kanten gleichmäßig.
 */
export const nurGleichmaessig = (quelle: string, nr: number): boolean => {
	const z = zerlege(quelle);
	const pruefe = (k: Knoten): boolean =>
		k.kinder.filter(istGestaltung).some((kind) => {
			if (istGruppe(kind)) {
				return (leseLage(quelle, kind.nr).drehen ?? 0) !== 0 || pruefe(kind);
			}
			const groesse = artVon(kind)?.groesse;
			return groesse === 'proportional' || groesse === 'text' || (leseLage(quelle, kind.nr).drehen ?? 0) !== 0;
		});
	return pruefe(gruppeAn(z, nr));
};

const schriftGroesse = (k: Knoten) => {
	const stil = attribut(k, 'style')?.wert ?? '';
	const treffer = /(?:^|;)\s*--gr\s*:\s*([\d.]+)px/.exec(stil);
	return treffer?.[1] ? Number(treffer[1]) : null;
};

const skaliereKind = (quelle: string, nr: number, fx: number, fy: number): string => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	const l = leseLage(quelle, nr);
	const lage = {
		x: (l.x ?? 0) * fx,
		y: (l.y ?? 0) * fy,
		...(l.b === undefined ? {} : { b: l.b * fx }),
		...(l.h === undefined ? {} : { h: l.h * fy }),
	};
	if (istGruppe(k)) {
		return skaliereGruppe(quelle, nr, { ...lage, b: (l.b ?? 0) * fx, h: (l.h ?? 0) * fy });
	}
	// Wie der Eckgriff: `setzeLage` ruft die Folgen der Art (`nachGroesse`: Formen, Linie, Pfad, Streuung …).
	const q = setzeLage(quelle, nr, lage);
	const gr = artVon(k)?.groesse === 'text' ? schriftGroesse(k) : null;
	return gr === null ? q : setzeStilWerte(q, nr, { '--gr': `${Math.round(gr * fx)}px` });
};

/**
 * Neue Lage der Gruppe nach einem Griff: Lage und Größe jedes Kinds wachsen mit (`fx = b'/b`, `fy = h'/h`), danach
 * dieselben Folgen wie beim Eckgriff seiner Art. Strichstärken bleiben. Verschachtelte Gruppen skalieren sich selbst.
 */
export const skaliereGruppe = (quelle: string, nr: number, lage: Mass): string => {
	const alt = leseLage(quelle, nr);
	const fx = alt.b ? lage.b / alt.b : 1;
	const fy = alt.h ? lage.h / alt.h : 1;
	let q = setzeLage(quelle, nr, { x: lage.x, y: lage.y, b: lage.b, h: lage.h });
	const kinder = gruppeAn(zerlege(q), nr).kinder.filter(istGestaltung);
	// Von hinten nach vorne: Folgen können den Inhalt eines Kinds umbauen, die Nummern davor bleiben.
	for (const k of [...kinder].reverse()) {
		q = skaliereKind(q, k.nr, fx, fy);
	}
	return q;
};

/** Die Kinder einer Gruppe in Quellreihenfolge (für Ebenen und Inspektor). */
export const kinderDerGruppe = (quelle: string, nr: number) =>
	gruppeAn(zerlege(quelle), nr).kinder.filter(istGestaltung).map((k) => k.nr);
