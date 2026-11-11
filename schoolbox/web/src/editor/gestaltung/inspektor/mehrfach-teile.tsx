import { formVon } from '@schoolbox/kern/src/formen';
import { leseForm, setzeFuellung } from '@schoolbox/kern/src/formen-aendern';
import { fuerAlle } from '@schoolbox/kern/src/gestaltung';

import { pfadDerForm } from '../anzeige-folgen';
import { FarbZeile } from '../blatt/flaeche';
import { skaliereMit } from '../geste';
import { useLiveLage } from '../live-lage';
import { elementeZu, rechteckVon, umschliessend } from '../mehrfach';
import { gruppeVon, imBehaelter, imMaterial, rechneGruppe } from '../mehrfach-geste';
import { messe } from '../useGeste';
import type { InspektorTeile } from './abschnitte';
import { Farben } from './form-farben';
import { Zahl } from './zahl';

/**
 * Inspektor bei Mehrfachauswahl (113, Briefing 5.9): Abschnitt 2 mit X, Y, B, H der ganzen Auswahl (ändern verschiebt
 * bzw. skaliert alle, ein Schritt), dazu die Abschnitte, die alle Gewählten haben und die mehrere können
 * (`mehrfach: true`). Unterschiedliche Werte zeigen „gemischt“.
 */

const Gemischt = () => (
	<span className="text-sm text-leise italic" data-gemischt>
		gemischt
	</span>
);

export const MehrfachPosition = ({ aktiv, k }: InspektorTeile) => {
	// Während einer Geste trägt das Blatt schon die Vorschau; neu messen, damit die Werte mitlaufen.
	useLiveLage();
	const elemente = elementeZu(k.doc, k.nrn).map(({ element }) => element);
	const rahmen = umschliessend(elemente.map(rechteckVon));
	if (!rahmen) {
		return null;
	}
	const seite = k.element.closest('.seite')?.getBoundingClientRect();
	const x = Math.round(rahmen.links - (seite?.left ?? 0));
	const y = Math.round(rahmen.oben - (seite?.top ?? 0));
	const b = Math.round(rahmen.rechts - rahmen.links);
	const h = Math.round(rahmen.unten - rahmen.oben);
	// `false`, wenn nichts geschrieben wurde; dann zeigt das Feld wieder den Wert.
	const verschiebe = (dx: number, dy: number) => {
		const g = gruppeVon(elemente, messe);
		if (!g || (dx === 0 && dy === 0)) {
			return false;
		}
		g.lagen = g.mitglieder.map((m) => ({ ...m.start, x: m.start.x + dx, y: m.start.y + dy }));
		return k.fuehreAus('Verschoben', rechneGruppe(g, 'bewegen'));
	};
	/** Proportional um die linke obere Ecke der Auswahl. */
	const skaliere = (feld: 'b' | 'h', wert: number) => {
		const g = gruppeVon(elemente, messe);
		const alt = feld === 'b' ? g?.start.b : g?.start.h;
		if (!g || !alt || wert <= 0 || Math.round(wert) === Math.round(alt)) {
			return false;
		}
		const f = wert / alt;
		const nach = { ...g.start, b: g.start.b * f, h: g.start.h * f };
		g.lagen = g.mitglieder.map((m) => imBehaelter(m, skaliereMit(imMaterial(m, m.start), g.start, nach)));
		return k.fuehreAus('Größe geändert', rechneGruppe(g, 'skalieren'));
	};
	const aus = !aktiv;
	return (
		<div className="flex flex-col gap-1.5" data-gestaltung-position="mehrfach">
			<div className="flex gap-1.5">
				<Zahl titel="X" name="X-Position" einheit="px" wert={x} aus={aus} setze={(n) => verschiebe(n - x, 0)} />
				<Zahl titel="Y" name="Y-Position" einheit="px" wert={y} aus={aus} setze={(n) => verschiebe(0, n - y)} />
			</div>
			<div className="flex gap-1.5">
				<Zahl titel="B" name="Breite" einheit="px" wert={b} aus={aus} setze={(n) => skaliere('b', n)} />
				<Zahl titel="H" name="Höhe" einheit="px" wert={h} aus={aus} setze={(n) => skaliere('h', n)} />
			</div>
		</div>
	);
};

/** Alle Gewählten sind Formen mit Füllung (keine Linie)? */
const alleMitFuellung = (t: InspektorTeile) =>
	t.k.nrn.every((n) => {
		const stand = leseForm(t.quelle, n);
		return stand !== null && formVon(stand.art)?.klasse !== 'linie';
	});

export const MehrfachFuellung = (t: InspektorTeile) => {
	const { aktiv, k, quelle } = t;
	if (!alleMitFuellung(t)) {
		return null;
	}
	const werte = k.nrn.map((n) => leseForm(quelle, n)?.fuellung ?? null);
	const gleich = werte.every((w) => w === werte[0]);
	return (
		<div className="flex flex-col gap-1" data-gestaltung-fuellung="mehrfach">
			<FarbZeile titel="Füllung">
				{!gleich && <Gemischt />}
				<Farben
					name="form-fuellung"
					beschriftung="Füllung"
					doc={k.doc}
					aus={!aktiv}
					wert={gleich ? (werte[0] ?? null) : null}
					setze={(farbe) => {
						k.fuehreAus(farbe === null ? 'Füllung entfernt' : 'Füllung geändert', (q) => ({
							quelle: fuerAlle(q, k.nrn, (q2, n) => setzeFuellung(q2, n, farbe)).quelle,
							nr: k.nr,
						}));
					}}
					zeige={(farbe) => {
						for (const { element } of elementeZu(k.doc, k.nrn)) {
							(pfadDerForm(element) as SVGElement | null)?.style.setProperty('fill', farbe);
						}
					}}
				/>
			</FarbZeile>
		</div>
	);
};
