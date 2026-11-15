import { setzeLinie } from '@schoolbox/kern/src/formen-aendern';
import { punkteAus } from '@schoolbox/kern/src/formen-linie';
import type { Lage, LageTeil } from '@schoolbox/kern/src/gestaltung';
import { leseLage, setzeLage } from '@schoolbox/kern/src/gestaltung';
import { gestaltungArtNach } from '@schoolbox/kern/src/gestaltung-arten';
import { drehungImBereich } from '@schoolbox/kern/src/gestaltung-inspektor';
import { nurGleichmaessig, skaliereGruppe } from '@schoolbox/kern/src/gruppen';
import { useMemo, useState } from 'react';

import { Schalter } from '../../../bausteine/Schalter';
import { Symbol } from '../../../bausteine/Symbol';
import { Tooltip } from '../../../bausteine/Tooltip';
import type { Kasten } from '../geste';
import type { LiveLage } from '../live-lage';
import { useLiveLage } from '../live-lage';
import type { InspektorTeile } from './abschnitte';
import type { GestaltungKontext } from './kontext-ersatz';
import { Zahl } from './zahl';

/** Breite und Höhe, wie sie gerade gezeichnet sind: ungedreht, in Material-px. */
const gemessen = (element: Element) => {
	const stil = element.ownerDocument.defaultView?.getComputedStyle(element);
	const zahl = (wert: string | undefined) => {
		const n = parseFloat(wert ?? '');
		return Number.isFinite(n) ? Math.round(n) : 0;
	};
	return { b: zahl(stil?.width), h: zahl(stil?.height) };
};

const schreibe = (k: GestaltungKontext, beschreibung: string, teil: LageTeil) =>
	k.fuehreAus(beschreibung, (q) => {
		// 120: Die Größe einer Gruppe rechnet ihre Kinder um.
		if (k.art === 'gruppe' && ((teil.b ?? null) !== null || (teil.h ?? null) !== null)) {
			const l = leseLage(q, k.nr);
			const lage = { x: l.x ?? 0, y: l.y ?? 0, b: teil.b ?? l.b ?? 0, h: teil.h ?? l.h ?? 0 };
			return { quelle: skaliereGruppe(q, k.nr, lage), nr: k.nr };
		}
		return { quelle: setzeLage(q, k.nr, teil), nr: k.nr };
	});

/**
 * Mit Schloss bleibt das Seitenverhältnis. Ein Bild ohne `--h` folgt dem Seitenverhältnis von selbst: Dort setzt das
 * Schloss kein `--h`, sonst schnitte es zu (`object-fit: cover`).
 */
const groesseMitSchloss = (
	lage: Lage,
	jetzt: { b: number; h: number },
	feld: 'b' | 'h',
	wert: number,
	schloss: boolean,
): LageTeil => {
	const neu = Math.max(1, Math.round(wert));
	if (!schloss || jetzt.b <= 0 || jetzt.h <= 0) {
		return { [feld]: neu };
	}
	const verhaeltnis = jetzt.b / jetzt.h;
	if (feld === 'b') {
		return lage.h === undefined ? { b: neu } : { b: neu, h: Math.max(1, Math.round(neu / verhaeltnis)) };
	}
	const b = Math.max(1, Math.round(neu * verhaeltnis));
	return lage.h === undefined ? { b } : { b, h: neu };
};

/** 198-12: Kleinste Breite und Höhe aus dem Inspektor, in px. */
const MIN_GROESSE = 8;
/** 198-04: Kürzeste Linie aus dem Inspektor, in px. */
const MIN_LAENGE = 10;

/**
 * 198-12: Die Seite, auf deren Ebene das Element unmittelbar liegt, mit ihrem Maß; `null` in Gruppe, Stapel oder am
 * Anker, wo X und Y nicht ab der Seite gelten.
 */
const seiteVon = (element: Element) => {
	const ebene = element.parentElement;
	const seite = ebene?.matches('.ebene') ? ebene.parentElement : null;
	if (!seite?.matches('.seite') || element.hasAttribute('data-anker')) {
		return null;
	}
	const html = seite as HTMLElement;
	return { b: html.offsetWidth, h: html.offsetHeight };
};

const begrenze = (wert: number, min: number, max: number) => Math.min(Math.max(wert, min), Math.max(min, max));

/** 198-04: Anfang und Ende einer Linie in Koordinaten der Seite (wie `--x`), aus `data-punkte` und der Lage. */
const endenDerLinie = (element: Element, lage: Lage) => {
	const p = punkteAus(element.getAttribute('data-punkte'));
	if (!p) {
		return null;
	}
	const x = lage.x ?? 0;
	const y = lage.y ?? 0;
	return [
		{ x: x + p[0].x, y: y + p[0].y },
		{ x: x + p[1].x, y: y + p[1].y },
	] as const;
};

/**
 * 198-04: Länge und Winkel statt Breite, Höhe und Kette. Beide setzen das Ende ab dem Anfang; 0° zeigt nach rechts,
 * 90° nach unten wie die Drehung.
 */
const LinienMass = ({ aus, k, lage }: { k: GestaltungKontext; lage: Lage; aus: boolean }) => {
	const enden = endenDerLinie(k.element, lage);
	if (!enden) {
		return null;
	}
	const [a, b] = enden;
	const laenge = Math.round(Math.hypot(b.x - a.x, b.y - a.y));
	// 198-N02: höchstens die Diagonale der Seite, wie B und H höchstens das Seitenmaß (198-12).
	const seite = k.element.closest('.seite') as HTMLElement | null;
	const maxLaenge = seite ? Math.round(Math.hypot(seite.offsetWidth, seite.offsetHeight)) : Number.POSITIVE_INFINITY;
	const winkel = (Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) + 360) % 360;
	const setze = (l: number, w: number) => {
		const rad = (w * Math.PI) / 180;
		const ende = { x: Math.round(a.x + Math.cos(rad) * l), y: Math.round(a.y + Math.sin(rad) * l) };
		return k.fuehreAus('Linie geändert', (q) => ({ quelle: setzeLinie(q, k.nr, a, ende), nr: k.nr }));
	};
	return (
		<div className="flex gap-1.5" data-linien-mass>
			<Zahl
				titel="Länge"
				name="Länge"
				einheit="px"
				wert={laenge}
				aus={aus}
				setze={(l) => setze(begrenze(Math.round(l), MIN_LAENGE, maxLaenge), winkel)}
			/>
			<Zahl
				titel="Winkel"
				name="Winkel"
				einheit="°"
				wert={winkel}
				aus={aus}
				setze={(w) => setze(laenge, ((Math.round(w) % 360) + 360) % 360)}
			/>
		</div>
	);
};

/** 198-09: Nur Bild und Figur lassen sich spiegeln (wie `auswahl.spiegeln`). */
const SPIEGELBAR = new Set(['figurfrei', 'bildfrei']);

/** 171: Während einer Geste am Element dieselben Werte wie am Zeiger, gerundet wie nach dem Loslassen; sonst `ruhe`. */
const imLauf = (live: LiveLage | null, nr: number, ruhe: Kasten): Kasten => {
	if (!live || live.gruppe || live.nr !== nr) {
		return ruhe;
	}
	const { b, drehen, h, x, y } = live.kasten;
	return { x: Math.round(x), y: Math.round(y), b: Math.round(b), h: Math.round(h), drehen };
};

export const Position = ({ aktiv, k, quelle }: InspektorTeile) => {
	// 120: Eine Gruppe mit Bild, Schrift oder gedrehtem Teil skaliert nur gleichmäßig.
	const groesse =
		k.art === 'gruppe' && nurGleichmaessig(quelle, k.nr)
			? 'proportional'
			: (gestaltungArtNach(k.art)?.groesse ?? 'frei');
	const [schlossBei, setSchloss] = useState({ nr: k.nr, an: groesse === 'proportional' });
	const schloss = schlossBei.nr === k.nr ? schlossBei.an : groesse === 'proportional';
	// `leseLage` zerlegt die ganze Quelle; während einer Geste zeichnet das Feld bei jeder Bewegung neu.
	const lage = useMemo(() => leseLage(quelle, k.nr), [quelle, k.nr]);
	const mass = gemessen(k.element);
	const jetzt = { b: lage.b ?? mass.b, h: lage.h ?? mass.h };
	const zeigt = imLauf(useLiveLage(), k.nr, {
		x: Math.round(lage.x ?? 0),
		y: Math.round(lage.y ?? 0),
		b: jetzt.b,
		h: groesse === 'text' ? mass.h : jetzt.h,
		drehen: lage.drehen ?? 0,
	});
	const aus = !aktiv;
	const zeige = (teil: keyof Lage) => (wert: number | null) =>
		k.zeigeLage(k.nr, { [teil]: wert ?? lage[teil] ?? null });
	const mitSchloss = groesse === 'proportional' || groesse === 'frei';
	const seite = seiteVon(k.element);
	// 198-12: Größe zwischen 8 px und dem Seitenmaß; X und Y nur so weit, dass das Element halb auf der Seite bleibt.
	const groesseSetzen = (feld: 'b' | 'h') => (wert: number) =>
		schreibe(
			k,
			'Größe geändert',
			groesseMitSchloss(
				lage,
				jetzt,
				feld,
				begrenze(wert, MIN_GROESSE, seite ? seite[feld] : Number.POSITIVE_INFINITY),
				mitSchloss && schloss,
			),
		);
	const lageIn = (feld: 'x' | 'y', wert: number) => {
		if (!seite) {
			return Math.round(wert);
		}
		const ausdehnung = feld === 'x' ? jetzt.b : groesse === 'text' ? mass.h : jetzt.h;
		const voll = feld === 'x' ? seite.b : seite.h;
		return Math.round(begrenze(wert, -ausdehnung / 2, voll - ausdehnung / 2));
	};
	const linie = k.element.matches('svg.form[data-form="linie"]');
	const gespiegelt = (lage.spiegeln ?? 1) < 0;

	return (
		<div className="flex flex-col gap-1.5" data-gestaltung-position>
			<div className="flex gap-1.5">
				<Zahl
					titel="X"
					name="X-Position"
					einheit="px"
					wert={zeigt.x}
					aus={aus}
					zeige={zeige('x')}
					setze={(x) => schreibe(k, 'Verschoben', { x: lageIn('x', x) })}
				/>
				<Zahl
					titel="Y"
					name="Y-Position"
					einheit="px"
					wert={zeigt.y}
					aus={aus}
					zeige={zeige('y')}
					setze={(y) => schreibe(k, 'Verschoben', { y: lageIn('y', y) })}
				/>
			</div>
			{linie && <LinienMass k={k} lage={lage} aus={aus} />}
			<div className={linie ? 'hidden' : 'flex items-center gap-1'}>
				<Zahl
					titel="B"
					name="Breite"
					einheit="px"
					wert={zeigt.b}
					aus={aus}
					zeige={schloss && mitSchloss ? undefined : zeige('b')}
					setze={groesseSetzen('b')}
				/>
				{mitSchloss && (
					<Tooltip text={schloss ? 'Seitenverhältnis lösen' : 'Seitenverhältnis halten'}>
						<button
							type="button"
							aria-label="Seitenverhältnis halten"
							aria-pressed={schloss}
							data-verhaeltnis
							disabled={aus}
							className="flex size-knopf-feld flex-none items-center justify-center rounded-md text-leise hover:bg-flaeche-2 hover:text-tinte aria-pressed:text-brand-600 disabled:opacity-50"
							onClick={() => setSchloss({ nr: k.nr, an: !schloss })}
						>
							<Symbol name={schloss ? 'verhaeltnis' : 'verhaeltnislos'} />
						</button>
					</Tooltip>
				)}
				{groesse !== 'breite' && (
					<Zahl
						titel="H"
						name="Höhe"
						einheit="px"
						wert={zeigt.h}
						fest={groesse === 'text'}
						aus={aus}
						zeige={schloss && mitSchloss ? undefined : zeige('h')}
						setze={groesseSetzen('h')}
					/>
				)}
			</div>
			{/* 107: Eine Linie hat zwei Endpunkte und keine Drehung; ihr Winkel steht oben (198-04). */}
			{!linie && (
				<div className="flex gap-1.5">
					<Zahl
						titel="Drehung"
						name="Drehung"
						einheit="°"
						wert={zeigt.drehen}
						aus={aus}
						zeige={(wert) => k.zeigeLage(k.nr, { drehen: wert ?? lage.drehen ?? null })}
						setze={(wert) => {
							const drehen = drehungImBereich(wert);
							return schreibe(k, 'Gedreht', {
								drehen: drehen === 0 && lage.drehen === undefined ? null : drehen,
							});
						}}
					/>
					{SPIEGELBAR.has(k.art) ? (
						<label className="flex min-w-0 flex-1 items-center justify-between gap-1.5 pl-1.5 text-sm">
							<span className="truncate">Spiegeln</span>
							<Schalter
								name="Spiegeln"
								an={gespiegelt}
								aus={aus}
								data-spiegeln
								setze={(an) => schreibe(k, 'Gespiegelt', { spiegeln: an ? -1 : null })}
							/>
						</label>
					) : (
						<span className="flex-1" />
					)}
				</div>
			)}
		</div>
	);
};
