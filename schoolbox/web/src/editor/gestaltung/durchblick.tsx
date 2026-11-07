import { useEffect, useSyncExternalStore } from 'react';

import type { Einblendung } from '../Leinwand';
import { seitenIn } from './ablegen/vorschau';
import { abonniereDurchblick, beendeDurchblick, durchblickAn, istG } from './befehle/durchblick';
import { Druckrand } from './druckrand';
import type { Flaeche } from './useGeste';

/**
 * Durchblick (100, Briefing 5.13): Solange G gehalten wird, zeigt die Überlagerung den Aufbau jeder Seite: gestrichelt
 * den Rand des Hauptstapels (Innenfläche) und weiterer Stapel, die Druckrand-Linie, Anker-Linien vom Element zu seinem
 * Baustein und Ausgeblendetes als Umriss. Alles liegt über dem `iframe`, nichts davon kommt in Vorschau oder Druck.
 */

const zahl = (wert: string) => {
	const n = parseFloat(wert);
	return Number.isFinite(n) ? n : 0;
};

const flaecheVon = (r: DOMRect): Flaeche => ({ links: r.left, oben: r.top, breite: r.width, hoehe: r.height });

interface Linie {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

interface Umriss extends Flaeche {
	drehen: number;
}

interface Aufbau {
	seiten: Flaeche[];
	stapel: Flaeche[];
	anker: Linie[];
	aus: Umriss[];
}

/** Die Innenfläche der Seite: ohne Rand und Polsterung (`--rand`). */
const innenflaeche = (seite: Element, fenster: Window): Flaeche => {
	const r = seite.getBoundingClientRect();
	const s = fenster.getComputedStyle(seite);
	const l = zahl(s.borderLeftWidth) + zahl(s.paddingLeft);
	const o = zahl(s.borderTopWidth) + zahl(s.paddingTop);
	const re = zahl(s.borderRightWidth) + zahl(s.paddingRight);
	const u = zahl(s.borderBottomWidth) + zahl(s.paddingBottom);
	return { links: r.left + l, oben: r.top + o, breite: r.width - l - re, hoehe: r.height - o - u };
};

/** Vom Mittelpunkt des Elements zum nächsten Punkt seines Bausteins. */
const ankerLinie = (element: Element): Linie | null => {
	const baustein = element.parentElement;
	const e = element.getBoundingClientRect();
	if (!baustein || (e.width === 0 && e.height === 0)) {
		return null;
	}
	const b = baustein.getBoundingClientRect();
	const x1 = e.left + e.width / 2;
	const y1 = e.top + e.height / 2;
	return {
		x1,
		y1,
		x2: Math.min(Math.max(x1, b.left), b.right),
		y2: Math.min(Math.max(y1, b.top), b.bottom),
	};
};

/**
 * Ausgeblendetes hat `display: none` und kein Rechteck im DOM: Es kommt aus den Lage-Werten im `style` und der Ecke des
 * Behälters. Ohne `--b`/`--h` (Breite aus dem Inhalt) steht ein kleiner Platzhalter-Umriss da.
 */
const ausUmriss = (element: Element): Umriss | null => {
	const behaelter = element.parentElement;
	if (!behaelter || behaelter.getClientRects().length === 0) {
		return null;
	}
	const r = behaelter.getBoundingClientRect();
	const stil = (element as HTMLElement).style;
	const wert = (name: string) => {
		const w = stil.getPropertyValue(name);
		return w ? zahl(w) : null;
	};
	const b = wert('--b') ?? 80;
	return {
		links: r.left + behaelter.clientLeft + (wert('--x') ?? 0),
		oben: r.top + behaelter.clientTop + (wert('--y') ?? 0),
		breite: b,
		hoehe: wert('--h') ?? Math.min(b, 40),
		drehen: wert('--drehen') ?? 0,
	};
};

const messeAufbau = (doc: Document): Aufbau => {
	const fenster = doc.defaultView;
	const aufbau: Aufbau = { seiten: [], stapel: [], anker: [], aus: [] };
	if (!fenster) {
		return aufbau;
	}
	for (const seite of seitenIn(doc)) {
		aufbau.seiten.push(flaecheVon(seite.getBoundingClientRect()));
		aufbau.stapel.push(innenflaeche(seite, fenster));
		for (const s of seite.querySelectorAll('.stapel')) {
			if (s.getClientRects().length > 0) {
				aufbau.stapel.push(flaecheVon(s.getBoundingClientRect()));
			}
		}
		for (const a of seite.querySelectorAll('[data-anker]')) {
			const linie = ankerLinie(a);
			if (linie) {
				aufbau.anker.push(linie);
			}
		}
		for (const a of seite.querySelectorAll('[data-aus]')) {
			// Nur das äußerste Ausgeblendete; was darin liegt, ist mit ihm weg.
			if (!a.parentElement?.closest('[data-aus]')) {
				const umriss = ausUmriss(a);
				if (umriss) {
					aufbau.aus.push(umriss);
				}
			}
		}
	}
	return aufbau;
};

export const Durchblick = ({ e }: { e: Einblendung }) => {
	const an = useSyncExternalStore(abonniereDurchblick, durchblickAn);
	const { doc, links, skala } = e;

	// Lädt das `iframe` neu, während G gehalten wird, kommt das Loslassen im neuen Fenster an.
	useEffect(() => {
		const fenster = doc.defaultView;
		if (!an || !fenster) {
			return undefined;
		}
		const hoch = (t: KeyboardEvent) => {
			if (istG(t)) {
				beendeDurchblick();
			}
		};
		fenster.addEventListener('keyup', hoch, true);
		return () => fenster.removeEventListener('keyup', hoch, true);
	}, [an, doc]);

	if (!an) {
		return null;
	}
	const aufbau = messeAufbau(doc);
	const kasten = (f: Flaeche) => ({
		left: links + f.links * skala,
		top: f.oben * skala,
		width: Math.max(0, f.breite) * skala,
		height: Math.max(0, f.hoehe) * skala,
	});
	return (
		<div className="pointer-events-none" data-durchblick>
			{aufbau.stapel.map((f, i) => (
				<div
					key={`stapel-${i}`}
					className="absolute border border-dashed border-leise/70"
					data-durchblick-stapel
					style={kasten(f)}
				/>
			))}
			{aufbau.seiten.map((f, i) => (
				<Druckrand key={`rand-${i}`} links={links} seite={f} skala={skala} />
			))}
			{aufbau.aus.map((f, i) => (
				<div
					key={`aus-${i}`}
					className="absolute border border-dashed border-dezent bg-flaeche-2/40"
					data-durchblick-aus
					style={{ ...kasten(f), transform: f.drehen ? `rotate(${f.drehen}deg)` : undefined }}
				/>
			))}
			{aufbau.anker.length > 0 && (
				<svg className="absolute overflow-visible" style={{ left: links, top: 0 }} width={1} height={1} aria-hidden>
					{aufbau.anker.map((l, i) => (
						<g key={`anker-${i}`} data-durchblick-anker className="stroke-brand-500">
							<line
								x1={l.x1 * skala}
								y1={l.y1 * skala}
								x2={l.x2 * skala}
								y2={l.y2 * skala}
								strokeWidth={1}
								strokeDasharray="3 3"
							/>
							<circle cx={l.x2 * skala} cy={l.y2 * skala} r={3} className="fill-brand-500" />
						</g>
					))}
				</svg>
			)}
		</div>
	);
};
