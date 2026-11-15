import { formVon, KONTUR, KONTUR_MAX, STRICH } from '@schoolbox/kern/src/formen';
import { leseForm, setzeFuellung, setzeKontur } from '@schoolbox/kern/src/formen-aendern';
import { fuerAlle } from '@schoolbox/kern/src/gestaltung';

import { Stepper } from '../../../bausteine/Stepper';
import { Zeile } from '../../../bausteine/Zeile';
import { pfadDerForm } from '../anzeige-folgen';
import { skaliereMit } from '../geste';
import { useLiveLage } from '../live-lage';
import { elementeZu, rechteckVon, umschliessend } from '../mehrfach';
import { gruppeVon, imBehaelter, imMaterial, rechneGruppe } from '../mehrfach-geste';
import { messe } from '../useGeste';
import type { InspektorTeile } from './abschnitte';
import { Farben } from './form-farben';
import { Zahl } from './zahl';

/**
 * Inspektor bei Mehrfachauswahl (113, Briefing 5.9): unter „Anordnen“ X, Y, B, H der ganzen Auswahl (ändern verschiebt
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
	const titel = (
		<span className="flex items-center gap-1.5">
			Füllung
			{!gleich && <Gemischt />}
		</span>
	);

	return (
		<div className="flex flex-col gap-1" data-gestaltung-fuellung="mehrfach">
			<Zeile titel={titel} name="Füllung" darunter>
				<Farben
					name="form-fuellung"
					beschriftung="Füllung"
					doc={k.doc}
					aus={!aktiv}
					wert={gleich ? (werte[0] ?? null) : null}
					gemischt={!gleich}
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
			</Zeile>
		</div>
	);
};

/**
 * 198-19: Kontur und Stärke für alle gewählten Formen, auch Linien. Ein Wert gilt für alle; bei verschiedenen Werten ist
 * keiner markiert („gemischt“). „Keine“ nimmt jede Kontur heraus, dann fehlt die Stärke.
 */
export const MehrfachKontur = ({ aktiv, k, quelle }: InspektorTeile) => {
	const konturen = k.nrn.map((n) => leseForm(quelle, n)?.kontur ?? null);
	if (k.nrn.some((n) => leseForm(quelle, n) === null)) {
		return null;
	}
	const farben = konturen.map((x) => x?.farbe ?? null);
	const gleicheFarbe = farben.every((f) => f === farben[0]);
	const staerken = konturen.flatMap((x) => (x ? [x.staerke] : []));
	const gleicheStaerke = staerken.every((n) => n === staerken[0]);
	const setzeAlle = (beschreibung: string, neu: (alt: (typeof konturen)[number]) => (typeof konturen)[number]) =>
		k.fuehreAus(beschreibung, (q) => ({
			quelle: fuerAlle(q, k.nrn, (q2, n) => setzeKontur(q2, n, neu(leseForm(q2, n)?.kontur ?? null))).quelle,
			nr: k.nr,
		}));
	const titel = (wort: string, gemischt: boolean) => (
		<span className="flex items-center gap-1.5">
			{wort}
			{gemischt && <Gemischt />}
		</span>
	);
	return (
		<div className="flex flex-col gap-1" data-gestaltung-kontur="mehrfach">
			<Zeile titel={titel('Kontur', !gleicheFarbe)} name="Kontur" darunter>
				<Farben
					name="form-kontur"
					beschriftung="Kontur"
					doc={k.doc}
					aus={!aktiv}
					wert={gleicheFarbe ? (farben[0] ?? null) : null}
					gemischt={!gleicheFarbe}
					setze={(farbe) =>
						setzeAlle(farbe === null ? 'Kontur entfernt' : 'Kontur geändert', (alt) =>
							farbe === null ? null : { farbe, staerke: alt?.staerke || STRICH },
						)}
					zeige={(farbe) => {
						for (const { element } of elementeZu(k.doc, k.nrn)) {
							(pfadDerForm(element) as SVGElement | null)?.style.setProperty('stroke', farbe);
						}
					}}
				/>
			</Zeile>
			{staerken.length > 0 && (
				<Zeile titel={titel('Stärke', !gleicheStaerke)} name="Stärke der Kontur">
					<span data-form-staerke>
						<Stepper
							name="Stärke der Kontur"
							wert={Math.max(1, staerken[0] ?? STRICH)}
							min={1}
							max={KONTUR_MAX}
							aus={!aktiv}
							setze={(staerke) =>
								setzeAlle('Stärke der Kontur', (alt) => ({ farbe: alt?.farbe || KONTUR, staerke }))}
						/>
					</span>
				</Zeile>
			)}
		</div>
	);
};
