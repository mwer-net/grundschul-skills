import type { Lage, LageTeil } from '@schoolbox/kern/src/gestaltung';
import { leseLage, setzeLage } from '@schoolbox/kern/src/gestaltung';
import { gestaltungArtNach } from '@schoolbox/kern/src/gestaltung-arten';
import { drehungImBereich } from '@schoolbox/kern/src/gestaltung-inspektor';
import { nurGleichmaessig, skaliereGruppe } from '@schoolbox/kern/src/gruppen';
import { useMemo, useState } from 'react';

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
	const groesseSetzen = (feld: 'b' | 'h') => (wert: number) =>
		schreibe(k, 'Größe geändert', groesseMitSchloss(lage, jetzt, feld, wert, mitSchloss && schloss));

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
					setze={(x) => schreibe(k, 'Verschoben', { x })}
				/>
				<Zahl
					titel="Y"
					name="Y-Position"
					einheit="px"
					wert={zeigt.y}
					aus={aus}
					zeige={zeige('y')}
					setze={(y) => schreibe(k, 'Verschoben', { y })}
				/>
			</div>
			<div className="flex items-center gap-1">
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
			{/* 107: Eine Linie hat zwei Endpunkte und keine Drehung. */}
			{!k.element.matches('svg.form[data-form="linie"]') && (
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
					<span className="flex-1" />
				</div>
			)}
		</div>
	);
};
