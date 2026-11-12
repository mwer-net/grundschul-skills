import { BLATT_FARBEN } from '@schoolbox/kern/src/blatt-farben';
import type { Ecke, StreuArt, StreuForm, StreuGroesse, StreuTeil } from '@schoolbox/kern/src/streuen';
import {
	FORM_NAMEN,
	leseStreuung,
	naechsteEcke,
	saatAus,
	setzeStreuung,
	STREU_ARTEN,
	STREU_FARBEN,
	STREU_FORMEN,
	STREU_NAMEN,
	wuerfle,
} from '@schoolbox/kern/src/streuen';

import { Farbpunkt } from '../../../bausteine/Farbfeld';
import type { KnopfArt } from '../../../bausteine/klassen';
import { KACHEL } from '../../../bausteine/klassen';
import { Knopf } from '../../../bausteine/Knopf';
import { Segment } from '../../../bausteine/Segment';
import { Symbol } from '../../../bausteine/Symbol';
import { sichtbar } from '../../../bausteine/verlauf';
import { Zeile } from '../../../bausteine/Zeile';
import { zeichneStreuungAnzeige } from '../anzeige-folgen';
import { Regler } from '../blatt/regler';
import type { GestaltungKontext } from '../kontext';
import type { InspektorTeile } from './abschnitte';

/** Ein Schritt im Verlauf: Parameter der Streuung ändern, die Teile entstehen neu. */
const setze = (k: GestaltungKontext, beschreibung: string, teil: StreuTeil) =>
	k.fuehreAus(beschreibung, (q) => ({ quelle: setzeStreuung(q, k.nr, teil), nr: k.nr }));

/**
 * Wo das Element im `iframe` liegt. In s/w ist eine Streuung weg (`display: none`) und hat kein Rechteck; dann zählt
 * ihre Lage in dem, worin `--x`/`--y` gelten (Ebene oder Anker). Der Zoom liegt außen am `iframe`, innen gelten px des
 * Materials.
 */
const rechteckVon = (element: Element) => {
	const r = element.getBoundingClientRect();
	if (r.width > 0 && r.height > 0) {
		return { x: r.left, y: r.top, b: r.width, h: r.height };
	}
	const eltern = element.parentElement;
	const e = eltern?.getBoundingClientRect();
	if (!eltern || !e || e.width <= 0) {
		return null;
	}
	const stil = (element as HTMLElement | SVGElement).style;
	const px = (name: string) => Number.parseFloat(stil.getPropertyValue(name)) || 0;
	return {
		x: e.left + eltern.clientLeft + px('--x'),
		y: e.top + eltern.clientTop + px('--y'),
		b: px('--b'),
		h: px('--h'),
	};
};

/**
 * Die Blattecke, die der Streuung am nächsten liegt (109). Aus dem DOM, nicht allein aus `--x`/`--y`: Hängt sie an
 * einem Baustein, zählen die vom Anker aus. Ohne Seite keine Ecke, dann gilt der Standard ↙.
 */
const eckeAmBlatt = (element: Element): Ecke | undefined => {
	const seite = element.closest('.seite');
	const s = seite?.getBoundingClientRect();
	const e = rechteckVon(element);
	if (!s || s.width <= 0 || s.height <= 0 || !e) {
		return undefined;
	}
	return naechsteEcke({ x: e.x - s.left, y: e.y - s.top, b: e.b, h: e.h }, { b: s.width, h: s.height });
};

/**
 * Wechsel der Art, ein Schritt. Werden es Punkte und hat das Element noch keine Ecke, nimmt es die nächste Blattecke
 * (109, seit 174 hier). Eine schon gesetzte Ecke bleibt, auch über Konfetti und Sterne hinweg (`setzeStreuung`).
 */
const setzeArt = (k: GestaltungKontext, alt: StreuArt, art: StreuArt) => {
	const neueEcke = art === 'punkte' && alt !== 'punkte' && !k.element.hasAttribute('data-ecke');
	const ecke = neueEcke ? eckeAmBlatt(k.element) : undefined;
	setze(k, `Streuung: ${STREU_NAMEN[art]}`, { art, ...(ecke ? { ecke } : {}) });
};

/** Würfeln (3-formen.md): eine neue Saat, ein Schritt. Inspektor und Leiste teilen den Knopf. */
const wuerfleStreuung = (k: GestaltungKontext) =>
	k.fuehreAus('Gewürfelt', (q) => ({ quelle: wuerfle(q, k.nr, saatAus(Date.now())), nr: k.nr }));

export const WuerfelKnopf = ({
	aktiv,
	art = 'leise',
	k,
}: {
	k: GestaltungKontext;
	aktiv: boolean;
	/** Im Inspektor `zweit`, linksbündig wie jede Handlung dort (182). */
	art?: KnopfArt;
}) => (
	<Knopf
		art={art}
		groesse="klein"
		className="self-start"
		data-streuung-wuerfeln
		disabled={!aktiv}
		onClick={() => wuerfleStreuung(k)}
	>
		<Symbol name="wuerfeln" className="size-4" />
		Würfeln
	</Knopf>
);

const ARTEN: { wert: StreuArt; titel: string }[] = STREU_ARTEN.map((wert) => ({ wert, titel: STREU_NAMEN[wert] }));

const GROESSEN: { wert: StreuGroesse; titel: string }[] = [
	{ wert: 'klein', titel: 'Klein' },
	{ wert: 'mittel', titel: 'Mittel' },
	{ wert: 'gross', titel: 'Groß' },
];

const ECKEN: { wert: Ecke; zeichen: string; titel: string }[] = [
	{ wert: 'ol', zeichen: '↖', titel: 'oben links' },
	{ wert: 'or', zeichen: '↗', titel: 'oben rechts' },
	{ wert: 'ul', zeichen: '↙', titel: 'unten links' },
	{ wert: 'ur', zeichen: '↘', titel: 'unten rechts' },
];

/** Aus einer Mehrfachwahl nehmen oder dazu geben; mindestens einer bleibt, sonst bliebe nichts zu streuen. */
const umgeschaltet = <T extends string>(liste: readonly T[], wert: T): T[] | null => {
	if (!liste.includes(wert)) {
		return [...liste, wert];
	}
	return liste.length > 1 ? liste.filter((w) => w !== wert) : null;
};

/** Nur ansehen: die Dichte am Element im `iframe`, die Teile neu gezeichnet. */
const zeigeDichte = (k: GestaltungKontext, b: number, h: number, prozent: number) => {
	k.element.setAttribute('data-dichte', String(prozent / 100));
	zeichneStreuungAnzeige(k.element, b, h, true);
};

/** Der Regler für die Dichte: Anzeige beim Ziehen, ein Schritt beim Loslassen. Inspektor und Leiste teilen ihn. */
export const DichteRegler = ({ aktiv, k, quelle }: InspektorTeile) => {
	const stand = leseStreuung(quelle, k.nr);
	if (!stand) {
		return null;
	}
	return (
		<Regler
			name="streuung-dichte"
			titel="Dichte"
			einheit=" %"
			min={5}
			max={100}
			schritt={5}
			wert={Math.round(stand.dichte * 100)}
			aus={!aktiv}
			zeige={(w) => zeigeDichte(k, stand.b, stand.h, w)}
			setze={(w) => setze(k, 'Dichte geändert', { dichte: w / 100 })}
		/>
	);
};

/** Abschnitt 5 „Streuung“ (5.8): Art, Formen, Farben, Größe, bei Punkten die dichte Ecke, Dichte, Würfeln. */
export const StreuungTeil = ({ aktiv, k, quelle }: InspektorTeile) => {
	const stand = leseStreuung(quelle, k.nr);
	if (!stand) {
		return null;
	}
	const farben: string[] = [
		...BLATT_FARBEN.map((f) => f.variable.slice(2)),
		...stand.farben.filter((f) => !BLATT_FARBEN.some((b) => b.variable === `--${f}`)),
	];
	return (
		<div className="flex flex-col gap-1" data-gestaltung-streuung={stand.art}>
			<Zeile titel="Art" name="Art der Streuung">
				<span data-streuung-art>
					<Segment
						beschriftung="Art der Streuung"
						werte={ARTEN}
						wert={stand.art}
						aus={!aktiv}
						waehle={(art) => setzeArt(k, stand.art, art)}
					/>
				</span>
			</Zeile>
			<div data-streuung-formen>
				<Zeile titel="Formen" darunter>
					<div role="group" aria-label="Formen" className="grid grid-cols-3 gap-1">
						{STREU_FORMEN.map((form: StreuForm) => (
							<button
								key={form}
								type="button"
								className={KACHEL}
								aria-pressed={stand.formen.includes(form)}
								disabled={!aktiv}
								data-streuung-form={form}
								onClick={() => {
									const neu = umgeschaltet(stand.formen, form);
									if (neu) {
										setze(k, 'Formen geändert', { formen: neu });
									}
								}}
							>
								{FORM_NAMEN[form]}
							</button>
						))}
					</div>
				</Zeile>
			</div>
			<div data-streuung-farben>
				<Zeile titel="Farben" darunter>
					<div role="group" aria-label="Farben" className="flex flex-wrap">
						{farben
							.filter((f) => (STREU_FARBEN as readonly string[]).includes(f))
							.map((name) => (
								<Farbpunkt
									key={name}
									name={BLATT_FARBEN.find((f) => f.variable === `--${name}`)?.name ?? name}
									farbe={sichtbar(k.doc, `--${name}`)}
									gewaehlt={stand.farben.includes(name)}
									aus={!aktiv}
									data-streuung-farbe={name}
									onClick={() => {
										const neu = umgeschaltet(stand.farben, name);
										if (neu) {
											setze(k, 'Farben geändert', { farben: neu });
										}
									}}
								/>
							))}
					</div>
				</Zeile>
			</div>
			<Zeile titel="Größe" name="Größe der Teile">
				<span data-streuung-groesse={stand.groesse}>
					<Segment
						beschriftung="Größe der Teile"
						werte={GROESSEN}
						wert={stand.groesse}
						aus={!aktiv}
						waehle={(groesse) => setze(k, 'Größe der Teile geändert', { groesse })}
					/>
				</span>
			</Zeile>
			{stand.art === 'punkte' && (
				<Zeile titel="Dichter bei" name="Dichte Ecke" darunter>
					<div
						role="group"
						aria-label="Dichte Ecke"
						className="grid grid-cols-4 gap-1"
						data-streuung-ecke={stand.ecke}
					>
						{ECKEN.map((e) => (
							<button
								key={e.wert}
								type="button"
								className={KACHEL}
								aria-pressed={stand.ecke === e.wert}
								aria-label={e.titel}
								title={e.titel}
								disabled={!aktiv}
								data-ecke={e.wert}
								onClick={() => setze(k, 'Dichte Ecke geändert', { ecke: e.wert })}
							>
								{e.zeichen}
							</button>
						))}
					</div>
				</Zeile>
			)}
			<DichteRegler k={k} quelle={quelle} aktiv={aktiv} />
			<WuerfelKnopf k={k} aktiv={aktiv} art="zweit" />
		</div>
	);
};
