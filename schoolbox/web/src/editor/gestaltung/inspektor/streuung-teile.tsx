import type { Ecke, StreuArt, StreuForm, StreuGroesse, StreuTeil } from '@schoolbox/kern/src/streuen';
import {
	FORM_NAMEN,
	leseStreuung,
	saatAus,
	setzeStreuung,
	STREU_ARTEN,
	STREU_FARBEN,
	STREU_FORMEN,
	STREU_NAMEN,
	wuerfle,
} from '@schoolbox/kern/src/streuen';

import { BLATT_FARBEN } from '../../../bausteine/Farbwahl';
import { klassen } from '../../../bausteine/klassen';
import { Knopf } from '../../../bausteine/Knopf';
import { Segment } from '../../../bausteine/Segment';
import { Symbol } from '../../../bausteine/Symbol';
import { Zeile } from '../../../bausteine/Zeile';
import { zeichneStreuungAnzeige } from '../anzeige-folgen';
import { Regler } from '../blatt/regler';
import type { GestaltungKontext } from '../kontext';
import type { InspektorTeile } from './abschnitte';

/** Ein Schritt im Verlauf: Parameter der Streuung ändern, die Teile entstehen neu. */
const setze = (k: GestaltungKontext, beschreibung: string, teil: StreuTeil) =>
	k.fuehreAus(beschreibung, (q) => ({ quelle: setzeStreuung(q, k.nr, teil), nr: k.nr }));

/** Würfeln (3-formen.md): eine neue Saat, ein Schritt. Inspektor und Leiste teilen den Knopf. */
const wuerfleStreuung = (k: GestaltungKontext) =>
	k.fuehreAus('Gewürfelt', (q) => ({ quelle: wuerfle(q, k.nr, saatAus(Date.now())), nr: k.nr }));

export const WuerfelKnopf = ({ aktiv, k }: { k: GestaltungKontext; aktiv: boolean }) => (
	<Knopf art="leise" groesse="klein" data-streuung-wuerfeln disabled={!aktiv} onClick={() => wuerfleStreuung(k)}>
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

const KNOPF =
	'flex min-h-[max(22px,var(--hoehe-knopf-status))] min-w-[var(--hoehe-knopf-status)] items-center justify-center rounded-md border border-rand px-2 text-sm aria-pressed:border-tinte aria-pressed:bg-flaeche-2 aria-pressed:font-medium disabled:opacity-50';

const RUND =
	'flex size-knopf-klein flex-none items-center justify-center rounded-full border border-rand p-0.5 aria-pressed:border-tinte aria-pressed:ring-1 aria-pressed:ring-tinte disabled:opacity-50';

/** Aus einer Mehrfachwahl nehmen oder dazu geben; mindestens einer bleibt, sonst bliebe nichts zu streuen. */
const umgeschaltet = <T extends string>(liste: readonly T[], wert: T): T[] | null => {
	if (!liste.includes(wert)) {
		return [...liste, wert];
	}
	return liste.length > 1 ? liste.filter((w) => w !== wert) : null;
};

/** Wie die Variable im Material gerade aussieht; ohne Material ein neutrales Grau. */
const sichtbar = (doc: Document, variable: string) =>
	doc.defaultView?.getComputedStyle(doc.body).getPropertyValue(variable).trim() || '#9ca3af';

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

/** Abschnitt 7 „Streuung“ (5.8): Art, Formen, Farben, Größe, bei Punkten die dichte Ecke, Dichte, Würfeln. */
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
						waehle={(art) => setze(k, `Streuung: ${STREU_NAMEN[art]}`, { art })}
					/>
				</span>
			</Zeile>
			<div className="flex flex-col gap-1" data-streuung-formen>
				<span className="text-leise">Formen</span>
				<div role="group" aria-label="Formen" className="flex flex-wrap gap-1">
					{STREU_FORMEN.map((form: StreuForm) => (
						<button
							key={form}
							type="button"
							className={KNOPF}
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
			</div>
			<div className="flex flex-col gap-1" data-streuung-farben>
				<span className="text-leise">Farben</span>
				<div role="group" aria-label="Farben" className="flex flex-wrap gap-1">
					{farben
						.filter((f) => (STREU_FARBEN as readonly string[]).includes(f))
						.map((name) => {
							const bekannt = BLATT_FARBEN.find((f) => f.variable === `--${name}`);
							return (
								<button
									key={name}
									type="button"
									className={RUND}
									aria-pressed={stand.farben.includes(name)}
									aria-label={bekannt?.name ?? name}
									title={bekannt?.name ?? name}
									disabled={!aktiv}
									data-streuung-farbe={name}
									onClick={() => {
										const neu = umgeschaltet(stand.farben, name);
										if (neu) {
											setze(k, 'Farben geändert', { farben: neu });
										}
									}}
								>
									<span
										aria-hidden
										className="block size-full min-h-4 rounded-full border border-black/10"
										style={{ background: sichtbar(k.doc, `--${name}`) }}
									/>
								</button>
							);
						})}
				</div>
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
				<Zeile titel="Dichter bei" name="Dichte Ecke">
					<span
						role="group"
						aria-label="Dichte Ecke"
						className="grid grid-cols-2 gap-0.5"
						data-streuung-ecke={stand.ecke}
					>
						{ECKEN.map((e) => (
							<button
								key={e.wert}
								type="button"
								className={klassen(KNOPF, 'px-0')}
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
					</span>
				</Zeile>
			)}
			<DichteRegler k={k} quelle={quelle} aktiv={aktiv} />
			<div className="flex justify-end">
				<WuerfelKnopf k={k} aktiv={aktiv} />
			</div>
		</div>
	);
};
