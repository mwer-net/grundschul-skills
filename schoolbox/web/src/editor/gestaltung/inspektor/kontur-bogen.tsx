import type { BogenTeil } from '@schoolbox/kern/src/bogen';
import {
	ausBogen,
	bogenPfad,
	hatFarbigeWoerter,
	inBogen,
	kannInBogen,
	KRUEMMUNG_MAX,
	KRUEMMUNG_MIN,
	leseBogen,
	setzeBogen,
} from '@schoolbox/kern/src/bogen';
import type { Schrift, SchriftKontur } from '@schoolbox/kern/src/schmuck';
import {
	GROESSE_MAX,
	GROESSE_MIN,
	groesseIm,
	leseSchriftKontur,
	SCHRIFT_KONTUR_MAX,
	SCHRIFT_KONTUR_STANDARD,
	SCHRIFTEN,
	setzeSchriftKontur,
} from '@schoolbox/kern/src/schmuck';
import { useEffect, useRef, useState } from 'react';

import { Farbwahl } from '../../../bausteine/Farbwahl';
import { Knopf } from '../../../bausteine/Knopf';
import { Segment } from '../../../bausteine/Segment';
import { Tooltip } from '../../../bausteine/Tooltip';
import { Zeile } from '../../../bausteine/Zeile';
import { FarbZeile } from '../blatt/flaeche';
import { Regler } from '../blatt/regler';
import type { GestaltungKontext } from '../kontext';
import type { InspektorTeil, InspektorTeile } from './abschnitte';
import { Zahl } from './zahl';

/** Was Kontur und Bogen bekommen, in Inspektor und Leiste gleich. */
export type KonturBogenTeile = InspektorTeile;

const SCHRIFT_WERTE = SCHRIFTEN.map((s) => ({ wert: s, titel: s }));

/** Nur Schmuckschrift hat Kontur; Form mit Text (107) und die Formen haben ihre eigene. */
export const hatKontur = (art: string) => art === 'schmuck' || art === 'schmuckbogen';

/** Ansehen ohne Schritt: ein Wert am Element im `iframe` (`null` nimmt die Anzeige zurück). */
const zeigeVariable = (k: GestaltungKontext, name: string, wert: string | null) => {
	const stil = (k.element as HTMLElement).style;
	if (wert === null) {
		stil.removeProperty(name);
	} else {
		stil.setProperty(name, wert);
	}
};

const setzeKontur = (k: GestaltungKontext, kontur: SchriftKontur | null) =>
	k.fuehreAus(kontur ? 'Kontur geändert' : 'Kontur entfernt', (q) => ({
		quelle: setzeSchriftKontur(q, k.nr, kontur),
		nr: k.nr,
	}));

/** Kontur an/aus, Stärke 0–16 px und Farbe (5-text.md). Beim Einschalten 6 px, Weiß. */
export const KonturWahl = ({ aktiv, k, quelle }: KonturBogenTeile) => {
	const kontur = leseSchriftKontur(quelle, k.nr);
	const an = kontur !== null;
	const aktuell = kontur ?? SCHRIFT_KONTUR_STANDARD;
	const imBogen = k.element.tagName.toLowerCase() === 'svg';
	return (
		<div className="flex flex-col gap-1" data-kontur-wahl>
			<Knopf
				art="zweit"
				groesse="klein"
				className="self-start"
				aria-pressed={an}
				disabled={!aktiv}
				data-kontur-schalter
				onClick={() => setzeKontur(k, an ? null : SCHRIFT_KONTUR_STANDARD)}
			>
				{an ? 'Kontur aus' : 'Kontur an'}
			</Knopf>
			{an && (
				<>
					<Zeile titel="Stärke" name={`Konturstärke, 0 bis ${SCHRIFT_KONTUR_MAX} px`}>
						<span className="flex w-28" data-kontur-staerke>
							<Zahl
								titel="Stärke"
								name="Konturstärke"
								einheit="px"
								wert={aktuell.staerke}
								aus={!aktiv}
								zeige={(n) => {
									if (!imBogen) {
										zeigeVariable(k, '--kontur', n === null ? null : `${Math.round(n)}px`);
									}
								}}
								setze={(n) =>
									setzeKontur(k, n > 0 ? { staerke: Math.min(SCHRIFT_KONTUR_MAX, n), farbe: aktuell.farbe } : null)
								}
							/>
						</span>
					</Zeile>
					<FarbZeile titel="Konturfarbe">
						<Farbwahl
							name="kontur-farbe"
							beschriftung="Konturfarbe"
							doc={k.doc}
							aus={!aktiv}
							wert={aktuell.farbe}
							setze={(farbe) => setzeKontur(k, { staerke: aktuell.staerke, farbe })}
							zeige={(farbe) => {
								if (!imBogen) {
									zeigeVariable(k, '--kontur-farbe', farbe);
								}
							}}
						/>
					</FarbZeile>
				</>
			)}
		</div>
	);
};

const setzeTeil = (k: GestaltungKontext, beschreibung: string, teil: BogenTeil) =>
	k.fuehreAus(beschreibung, (q) => ({ quelle: setzeBogen(q, k.nr, teil), nr: k.nr }));

/** Krümmung −100 bis 100: Anzeige beim Ziehen, ein Schritt beim Loslassen. */
export const BogenRegler = ({ aktiv, k, quelle }: KonturBogenTeile) => {
	const stand = leseBogen(quelle, k.nr);
	if (!stand) {
		return null;
	}
	return (
		<Regler
			titel="Krümmung"
			name="Krümmung"
			einheit=""
			min={KRUEMMUNG_MIN}
			max={KRUEMMUNG_MAX}
			wert={stand.kruemmung}
			aus={!aktiv}
			zeige={(n) => k.element.querySelector('path')?.setAttribute('d', bogenPfad(n, stand.b, stand.h, stand.gr))}
			setze={(n) => setzeTeil(k, 'Krümmung geändert', { kruemmung: n })}
		/>
	);
};

/** Titel ⇄ Bogen in einem Schritt. Der Tooltip warnt vorher, wenn farbige Wörter verloren gehen. */
export const BogenSchalter = ({ aktiv, k, quelle }: KonturBogenTeile) => {
	const imBogen = leseBogen(quelle, k.nr) !== null;
	if (!imBogen && !kannInBogen(quelle, k.nr)) {
		return null;
	}
	const warnung = !imBogen && hatFarbigeWoerter(quelle, k.nr);
	return (
		<Tooltip
			text={
				imBogen
					? 'Wieder ein gerader Titel'
					: warnung
						? 'Titel in den Bogen setzen. Farben einzelner Wörter gehen dabei verloren.'
						: 'Titel in den Bogen setzen'
			}
		>
			<Knopf
				art="zweit"
				groesse="klein"
				className="self-start"
				aria-pressed={imBogen}
				disabled={!aktiv}
				data-bogen-schalter
				onClick={() =>
					k.fuehreAus(imBogen ? 'Bogen aufgelöst' : 'Titel in den Bogen gesetzt', (q) => ({
						quelle: imBogen ? ausBogen(q, k.nr) : inBogen(q, k.nr),
						nr: k.nr,
					}))
				}
			>
				{imBogen ? 'Bogen aus' : 'Bogen an'}
			</Knopf>
		</Tooltip>
	);
};

/**
 * Einzeiliges Feld für den Text im Bogen (an der Leiste und im Inspektor). Enter oder Verlassen übernimmt, Esc verwirft.
 * Ein Schritt je Bearbeitung. Der Doppelklick auf den Bogen setzt den Fokus hierher (`doppelklick.ts`).
 */
export const BogenTextFeld = ({ aktiv, k, leiste, quelle }: KonturBogenTeile & { leiste?: boolean }) => {
	const stand = leseBogen(quelle, k.nr);
	const text = stand?.text ?? '';
	const [wert, setWert] = useState(text);
	const verworfen = useRef(false);
	useEffect(() => setWert(text), [text]);
	if (!stand) {
		return null;
	}
	const uebernimm = () => {
		if (verworfen.current) {
			verworfen.current = false;
			setWert(text);
			return;
		}
		const neu = wert.trim();
		if (neu === '' || neu === text) {
			setWert(text);
			return;
		}
		setzeTeil(k, 'Text im Bogen geändert', { text: neu });
	};
	return (
		<input
			type="text"
			aria-label="Text im Bogen"
			className="h-feld w-44 min-w-0 rounded-md border border-rand-feld bg-flaeche px-1.5 text-sm outline-none"
			value={wert}
			disabled={!aktiv}
			{...(leiste ? { 'data-leiste-bogen-text': '' } : { 'data-bogen-text': '' })}
			onChange={(e) => setWert(e.target.value)}
			onBlur={uebernimm}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.key === 'Enter') {
					e.currentTarget.blur();
				} else if (e.key === 'Escape') {
					verworfen.current = true;
					e.currentTarget.blur();
				}
			}}
		/>
	);
};

/** Schrift, Größe und Farbe des Bogens: wie `text.tsx` (105), aber über `setzeBogen`. */
export const BogenSchriftWahl = ({ aktiv, k, quelle }: KonturBogenTeile) => {
	const stand = leseBogen(quelle, k.nr);
	return stand ? (
		<span data-bogen-schrift>
			<Segment
				beschriftung="Schrift"
				werte={SCHRIFT_WERTE}
				wert={stand.schrift}
				aus={!aktiv}
				waehle={(schrift: Schrift) => setzeTeil(k, 'Schrift geändert', { schrift })}
			/>
		</span>
	) : null;
};

export const BogenGroesseFeld = ({ aktiv, k, quelle }: KonturBogenTeile) => {
	const stand = leseBogen(quelle, k.nr);
	if (!stand) {
		return null;
	}
	return (
		<span className="flex w-28" data-bogen-groesse>
			<Zahl
				titel="Größe"
				name="Schriftgröße"
				einheit="px"
				wert={stand.gr}
				aus={!aktiv}
				zeige={(n) =>
					k.element
						.querySelector('path')
						?.setAttribute('d', bogenPfad(stand.kruemmung, stand.b, stand.h, n === null ? stand.gr : groesseIm(n)))
				}
				setze={(n) => setzeTeil(k, 'Schriftgröße geändert', { gr: n })}
			/>
		</span>
	);
};

export const BogenFarbeWahl = ({ aktiv, k, quelle }: KonturBogenTeile) => {
	const stand = leseBogen(quelle, k.nr);
	return stand ? (
		<Farbwahl
			name="bogen-farbe"
			beschriftung="Farbe der Schrift"
			doc={k.doc}
			aus={!aktiv}
			wert={stand.farbe}
			setze={(farbe) => setzeTeil(k, 'Schriftfarbe geändert', { farbe })}
			zeige={(farbe) => k.element.querySelector('text')?.style.setProperty('fill', farbe)}
		/>
	) : null;
};

/** Abschnitt 5, nach „Text“ (5.8): Kontur und Bogen; für den Bogen selbst auch Text, Schrift, Größe und Farbe. */
const KonturBogen = (teile: InspektorTeile) => {
	const bogen = leseBogen(teile.quelle, teile.k.nr) !== null;
	return (
		<div className="flex flex-col gap-1" data-gestaltung-kontur-bogen>
			{bogen && (
				<>
					<Zeile titel="Text">
						<BogenTextFeld {...teile} />
					</Zeile>
					<Zeile titel="Schrift">
						<BogenSchriftWahl {...teile} />
					</Zeile>
					<Zeile titel="Größe" name={`Schriftgröße, ${GROESSE_MIN} bis ${GROESSE_MAX} px`}>
						<BogenGroesseFeld {...teile} />
					</Zeile>
					<FarbZeile titel="Farbe">
						<BogenFarbeWahl {...teile} />
					</FarbZeile>
				</>
			)}
			<KonturWahl {...teile} />
			<BogenSchalter {...teile} />
			{bogen && <BogenRegler {...teile} />}
		</div>
	);
};

export const KONTUR_BOGEN_TEILE: InspektorTeil[] = [
	{ id: 'kontur-bogen', abschnitt: 5, reihenfolge: 2, fuer: (art) => hatKontur(art), Inhalt: KonturBogen },
];
