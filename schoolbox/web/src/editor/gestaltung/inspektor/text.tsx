import type { Ausrichtung, Schrift, SchmuckTeil } from '@schoolbox/kern/src/schmuck';
import {
	GROESSE_MAX,
	GROESSE_MIN,
	groesseIm,
	leseSchmuck,
	SCHMUCK_ARTEN,
	SCHRIFTEN,
	setzeSchmuck,
} from '@schoolbox/kern/src/schmuck';

import { Farbwahl } from '../../../bausteine/Farbwahl';
import { Segment } from '../../../bausteine/Segment';
import { Zeile } from '../../../bausteine/Zeile';
import { FarbZeile } from '../blatt/flaeche';
import type { GestaltungKontext } from '../kontext';
import type { InspektorTeil, InspektorTeile } from './abschnitte';
import { Zahl } from './zahl';

/** Schmuckschrift und Form mit Text (107) lesen dieselben Variablen; Hintergrund hat nur das Etikett. */
export const istTextArt = (art: string) => art === 'schmuck' || art === 'formtext';

const SCHRIFT_WERTE = SCHRIFTEN.map((s) => ({ wert: s, titel: s }));
const AUSRICHTUNG_WERTE: { wert: Ausrichtung; titel: string }[] = [
	{ wert: 'links', titel: 'Links' },
	{ wert: 'mitte', titel: 'Mitte' },
	{ wert: 'rechts', titel: 'Rechts' },
];

/** Ein Schritt, die Auswahl bleibt; der Name steht im Verlauf. */
const setze = (k: GestaltungKontext, beschreibung: string, teil: SchmuckTeil) =>
	k.fuehreAus(beschreibung, (q) => ({ quelle: setzeSchmuck(q, k.nr, teil), nr: k.nr }));

/** Nur ansehen, ohne Schritt: eine Variable am Element im `iframe` (`null` nimmt die Anzeige zurück). */
const zeigeVariable = (k: GestaltungKontext, name: string, wert: string | null) => {
	const stil = (k.element as HTMLElement).style;
	if (wert === null) {
		stil.removeProperty(name);
	} else {
		stil.setProperty(name, wert);
	}
};

/** Die Größe, wie sie gerade gilt: aus `--gr`, sonst gemessen (Claude schreibt manchmal keine). */
const groesseVon = (k: GestaltungKontext, gr: number | null) =>
	gr ?? Math.round(parseFloat(k.element.ownerDocument.defaultView?.getComputedStyle(k.element).fontSize ?? '') || 40);

export interface TextTeile {
	k: GestaltungKontext;
	quelle: string;
	aktiv: boolean;
}

/** Nur Fredoka und Andika: die Schnitte, die `blatt.css` einbettet (Entscheidung 29). */
export const SchriftWahl = ({ aktiv, k, quelle }: TextTeile) => {
	const stand = leseSchmuck(quelle, k.nr);
	return stand ? (
		<span data-schmuck-schrift>
			<Segment
				beschriftung="Schrift"
				werte={SCHRIFT_WERTE}
				wert={stand.schrift}
				aus={!aktiv}
				waehle={(schrift: Schrift) => setze(k, 'Schrift geändert', { schrift })}
			/>
		</span>
	) : null;
};

/** Größe `--gr` in px (12–160); Tippen zeigt, Bestätigen schreibt. */
export const GroesseFeld = ({ aktiv, k, quelle }: TextTeile) => {
	const stand = leseSchmuck(quelle, k.nr);
	if (!stand) {
		return null;
	}
	const wert = groesseVon(k, stand.gr);
	return (
		<span className="flex w-28" data-schmuck-groesse>
			<Zahl
				titel="Größe"
				name="Schriftgröße"
				einheit="px"
				wert={wert}
				aus={!aktiv}
				zeige={(n) => zeigeVariable(k, '--gr', n === null ? null : `${groesseIm(n)}px`)}
				setze={(n) => setze(k, 'Schriftgröße geändert', { gr: n })}
			/>
		</span>
	);
};

/** Farbe der Schrift (`--farbe`): Farben des Blatts, Weiß, eigene. */
export const FarbeWahl = ({ aktiv, k, quelle }: TextTeile) => {
	const stand = leseSchmuck(quelle, k.nr);
	return stand ? (
		<Farbwahl
			name="schmuck-farbe"
			beschriftung="Farbe der Schrift"
			doc={k.doc}
			aus={!aktiv}
			wert={stand.farbe}
			setze={(farbe) => setze(k, 'Schriftfarbe geändert', { farbe })}
			zeige={(farbe) => zeigeVariable(k, '--farbe', farbe)}
		/>
	) : null;
};

/** Abschnitt 5 „Text“ (5.8): Art, Schrift, Größe, Farbe, Ausrichtung, beim Etikett der Hintergrund. */
const Text = ({ aktiv, k, quelle }: InspektorTeile) => {
	const stand = leseSchmuck(quelle, k.nr);
	if (!stand) {
		return null;
	}
	return (
		<div className="flex flex-col gap-1" data-gestaltung-text>
			{stand.art && (
				<Zeile titel="Art">
					<span data-schmuck-art={stand.art}>{`Schmuckschrift · ${SCHMUCK_ARTEN[stand.art].name}`}</span>
				</Zeile>
			)}
			<Zeile titel="Schrift">
				<SchriftWahl k={k} quelle={quelle} aktiv={aktiv} />
			</Zeile>
			<Zeile titel="Größe" name={`Schriftgröße, ${GROESSE_MIN} bis ${GROESSE_MAX} px`}>
				<GroesseFeld k={k} quelle={quelle} aktiv={aktiv} />
			</Zeile>
			<FarbZeile titel="Farbe">
				<FarbeWahl k={k} quelle={quelle} aktiv={aktiv} />
			</FarbZeile>
			<Zeile titel="Ausrichtung">
				<span data-schmuck-ausrichtung>
					<Segment
						beschriftung="Ausrichtung"
						werte={AUSRICHTUNG_WERTE}
						wert={stand.ausrichtung}
						aus={!aktiv}
						waehle={(ausrichtung) => setze(k, 'Ausrichtung geändert', { ausrichtung })}
					/>
				</span>
			</Zeile>
			{stand.art === 'etikett' && (
				<FarbZeile titel="Hintergrund">
					<Farbwahl
						name="schmuck-hintergrund"
						beschriftung="Hintergrund"
						doc={k.doc}
						aus={!aktiv}
						wert={stand.hg}
						setze={(hg) => setze(k, 'Hintergrund geändert', { hg })}
						zeige={(hg) => zeigeVariable(k, '--hg', hg)}
					/>
				</FarbZeile>
			)}
		</div>
	);
};

export const TEXT_TEILE: InspektorTeil[] = [
	{ id: 'text', abschnitt: 5, reihenfolge: 1, fuer: (art, b) => istTextArt(art) && b.faehigkeiten.includes('text'), Inhalt: Text },
];
