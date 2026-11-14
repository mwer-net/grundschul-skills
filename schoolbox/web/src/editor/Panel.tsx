import type { AbschnittName } from '@schoolbox/kern/src/abschnitte';
import { ABSCHNITT_TITEL } from '@schoolbox/kern/src/abschnitte';
import type { BlattWerte as BlattWerteTyp } from '@schoolbox/kern/src/kit-einstellungen';
import {
	BLATT_FORMATE,
	hatErwartungshorizont,
	KIT_FELDER,
	leseBlatt,
	leseKit,
	leseSichtbarkeit,
	PALETTEN,
	PALETTEN_FARBNAME,
	setzeBlatt,
	setzeKit,
	setzeKitMitAuswahl,
	setzeSichtbarkeit,
	SICHTBARKEITEN,
} from '@schoolbox/kern/src/kit-einstellungen';
import { inCm, pxZuCm, zahlMitKomma } from '@schoolbox/kern/src/masse';
import { ABSTAND, gesetzterAbstand, SPALTEN } from '@schoolbox/kern/src/struktur';
import { groesseVon, setzeGroesse, setzeKopfzeile, TABELLE_GRENZEN } from '@schoolbox/kern/src/tabelle';
import type { Format as Format2 } from '@schoolbox/kern/src/werte';
import { FORMAT_NAME, KLASSEN } from '@schoolbox/kern/src/werte';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Abschnitt } from '../bausteine/Abschnitt';
import { Farbpunkt } from '../bausteine/Farbfeld';
import { Feld } from '../bausteine/Feld';
import { Hilfetipp } from '../bausteine/Hilfetipp';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Schalter } from '../bausteine/Schalter';
import { Stepper } from '../bausteine/Stepper';
import { Tooltip } from '../bausteine/Tooltip';
import { Zeile } from '../bausteine/Zeile';
import { klasseName } from '../lib/text';
import type { Ablage } from './ablage';
import type { PfadTeil } from './darstellung';
import type { BlattSeite } from './gestaltung/blatt';
import { BlattGestaltung } from './gestaltung/blatt';
import { useReglerSchreiben } from './gestaltung/blatt/regler';
import { palettenFarben } from './palettenfarben';
import type { Spalten, Struktur } from './struktur';
import { EIGENE_GESCHICHTE } from './tasten';

const ZeileSchalter = ({
	an,
	einstellung,
	hilfe,
	setze,
	titel,
}: {
	titel: string;
	an: boolean;
	setze: (an: boolean) => void;
	hilfe?: string;
	einstellung?: string;
}) => {
	const id = useId();
	return (
		<Zeile titel={titel} fuer={id} hilfe={hilfe} einstellung={einstellung}>
			<Schalter id={id} name={titel} an={an} setze={setze} />
		</Zeile>
	);
};

const ZeileStepper = ({
	hilfe,
	titel,
	...stepper
}: {
	titel: string;
	hilfe?: string;
	wert: number;
	setze: (wert: number) => void;
	min?: number;
	max?: number;
	schritt?: number;
	/** 196-28: Einheit im Wertfeld; Maße in px erscheinen in cm (197-U3). */
	einheit?: string;
	cm?: boolean;
	aus?: boolean;
}) => {
	const id = useId();
	return (
		<Zeile titel={titel} fuer={id} hilfe={hilfe}>
			<Stepper id={id} name={titel} {...stepper} />
		</Zeile>
	);
};

const ZeileWahl = ({
	einstellung,
	hilfe,
	optionen,
	setze,
	titel,
	wert,
}: {
	titel: string;
	hilfe?: string;
	einstellung?: string;
	wert: string;
	optionen: readonly { wert: string; titel: string }[];
	setze: (wert: string) => void;
}) => {
	const id = useId();
	return (
		<Zeile titel={titel} fuer={id} hilfe={hilfe} einstellung={einstellung}>
			<select
				id={id}
				className={klassen(FELD_KLASSEN, 'w-fit! max-w-36 pr-5!')}
				value={wert}
				onChange={(e) => setze(e.target.value)}
			>
				{optionen.map((o) => (
					<option key={o.wert} value={o.wert}>
						{o.titel}
					</option>
				))}
			</select>
		</Zeile>
	);
};

/**
 * 196-09: Einzeiliges Textfeld wie überall im Inspektor: ⏎ übernimmt und der Fokus bleibt im Feld, Verlassen übernimmt,
 * Esc stellt den alten Wert wieder her. `leerErlaubt: false` zeigt nach dem Leeren wieder den alten Wert (196-35).
 */
export const Texteingabe = ({
	aus,
	leerErlaubt = true,
	name,
	setze,
	wert,
	...rest
}: {
	wert: string;
	setze: (wert: string) => void;
	name?: string;
	leerErlaubt?: boolean;
	aus?: boolean;
	'data-einstellung'?: string;
}) => {
	const [text, setText] = useState(wert);
	useEffect(() => setText(wert), [wert]);
	const uebernimm = () => {
		const neu = text.trim();
		if (!leerErlaubt && neu === '') {
			setText(wert);
			return;
		}
		if (neu !== wert.trim()) {
			setze(neu);
		}
	};
	return (
		<input
			{...rest}
			className={FELD_KLASSEN}
			aria-label={name}
			disabled={aus}
			value={text}
			onChange={(e) => setText(e.target.value)}
			onBlur={uebernimm}
			onKeyDown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					uebernimm();
				} else if (e.key === 'Escape' && text !== wert) {
					e.preventDefault();
					e.stopPropagation();
					setText(wert);
				}
			}}
		/>
	);
};

/** Name fürs Hineinlegen in die Sammlung; die Aktion selbst steht im ⋯ (051). */
export const SammlungName = ({ ablage }: { ablage: Ablage }) => {
	const { sammle, sammlungName: name, setSammlungName: setName } = ablage;
	if (name === null) {
		return null;
	}
	return (
		<div className="flex items-end gap-2" data-wiederverwenden>
			<Feld titel="Name in der Sammlung" className="min-w-0 flex-1">
				<input
					{...EIGENE_GESCHICHTE}
					className={FELD_KLASSEN}
					value={name}
					data-sammlung-name
					onChange={(e) => setName(e.target.value)}
				/>
			</Feld>
			<Knopf disabled={name.trim() === ''} data-sammlung-speichern onClick={() => void sammle()}>
				Hineinlegen
			</Knopf>
		</div>
	);
};

export const Spaltenwahl = ({
	aus = false,
	spalten,
	struktur,
}: {
	spalten: Spalten;
	struktur: Struktur;
	aus?: boolean;
}) => {
	const id = useId();
	return (
		<Zeile titel="Spalten" fuer={id}>
			<div role="group" aria-label="Spalten" data-spalten={spalten.wert}>
				<Stepper
					id={id}
					name="Anzahl der Spalten"
					wert={spalten.wert}
					min={SPALTEN.min}
					max={SPALTEN.max}
					minusName="Eine Spalte weniger"
					plusName="Eine Spalte mehr"
					aus={aus}
					setze={(n) => struktur.spalten(spalten.nr, n)}
				/>
			</div>
		</Zeile>
	);
};

/** Zeichnet die Felder aus `KIT_FELDER`; Grenzen, Wirkung und Abschnitt stehen dort, nicht hier. */
export const KitWerkzeug = ({
	abschnitt,
	art,
	folien,
	aus = false,
	nr,
	nur,
	quelle,
	struktur,
}: {
	/** Nur diese Felder, z. B. „Punkte“ der Aufgabe am Baustein „Punkte“ (196-20). */
	nur?: readonly string[];
	abschnitt: AbschnittName;
	art: string;
	folien: boolean;
	nr: number;
	quelle: string | null;
	struktur: Struktur;
	/** 196-13: gesperrt (Konflikt, Vorschlag offen): Felder bleiben stehen, lassen sich aber nicht bedienen. */
	aus?: boolean;
}) => {
	// 196-19: „Anforderung“ wirkt nur im Erwartungshorizont
	const felder = (KIT_FELDER[art] ?? []).filter(
		(f) =>
			(f.abschnitt ?? 'darstellung') === abschnitt &&
			(!nur || nur.includes(f.name)) &&
			(f.name !== 'afb' || (quelle && hatErwartungshorizont(quelle))),
	);
	if (felder.length === 0 || !quelle) {
		return null;
	}
	const werte = leseKit(quelle, nr, art);
	const n = { jeSeite: folien };
	const setze = (name: string, titel: string, wert: string | number | boolean) => {
		// 196-02: Entfernt oder einwickelt die Einstellung etwas, wandert die Auswahl mit dem Element.
		const versuch = (() => {
			try {
				return setzeKitMitAuswahl(quelle, nr, art, name, wert, n);
			} catch {
				return null;
			}
		})();
		if (versuch && versuch.nr !== nr) {
			struktur.fuehreAus(`${titel} geändert`, (q) => setzeKitMitAuswahl(q, nr, art, name, wert, n));
			return;
		}
		struktur.aendereAttribute(`${titel} geändert`, (q) => setzeKit(q, nr, art, name, wert, n));
	};
	return (
		<fieldset className="flex flex-col gap-1" disabled={aus} data-kit={art}>
			{felder.map((f) => {
				const wert = werte[f.name];
				const { hilfe, titel } = f;
				const dazu = hilfe ? { hilfe } : {};
				if (f.typ === 'schalter') {
					return (
						<ZeileSchalter
							key={f.name}
							titel={titel}
							{...dazu}
							an={wert === true}
							setze={(an) => setze(f.name, titel, an)}
						/>
					);
				}
				if (f.typ === 'zahl') {
					return (
						<ZeileStepper
							key={f.name}
							titel={titel}
							{...dazu}
							wert={Number(wert)}
							min={f.min}
							max={f.max}
							schritt={f.schritt}
							cm={inCm({ einheit: f.einheit, attribut: f.name })}
							{...(f.einheit && f.einheit !== 'px' ? { einheit: f.einheit } : {})}
							aus={aus}
							setze={(zahl) => setze(f.name, titel, zahl)}
						/>
					);
				}
				if (f.typ === 'wahl') {
					return (
						<ZeileWahl
							key={f.name}
							titel={titel}
							{...dazu}
							wert={String(wert)}
							optionen={f.optionen}
							setze={(w) => setze(f.name, titel, w)}
						/>
					);
				}
				const feld = <Texteingabe wert={String(wert)} name={titel} aus={aus} setze={(t) => setze(f.name, titel, t)} />;
				// 196-33: Heißt das Feld wie sein Abschnitt („Lösung“), steht der Name nur einmal.
				return titel === ABSCHNITT_TITEL[abschnitt] ? (
					<div key={f.name}>{feld}</div>
				) : (
					<Feld key={f.name} titel={titel}>
						{feld}
					</Feld>
				);
			})}
		</fieldset>
	);
};

/** Größe und Kopfzeile der Kit-Tabelle (047). Einfügen und Löschen an einer Stelle stehen in der Leiste und im ⋯. */
export const TabellenWerkzeug = ({
	aus = false,
	folien,
	nr,
	pfad,
	quelle,
	struktur,
}: {
	aus?: boolean;
	folien: boolean;
	nr: number;
	pfad: PfadTeil[];
	quelle: string | null;
	struktur: Struktur;
}) => {
	if (!quelle || !pfad.some((t) => t.baustein.art === 'tabelle')) {
		return null;
	}
	const n = { jeSeite: folien };
	const g = groesseVon(quelle, nr);
	// 196-04: Ist die Tabelle selbst gewählt, bleibt sie es; ihre Nummer ändert sich nicht, nur die ihrer Zellen.
	const tabelleGewaehlt = pfad.at(-1)?.baustein.art === 'tabelle';
	const bleibe = (e: { quelle: string; nr: number | null }) => (tabelleGewaehlt ? { quelle: e.quelle, nr } : e);
	const groesse = (was: 'zeilen' | 'spalten', wert: number) =>
		struktur.fuehreAus('Tabellengröße geändert', (q) => bleibe(setzeGroesse(q, nr, { [was]: wert }, n)));
	return (
		<fieldset className="flex flex-col gap-1" disabled={aus} data-tabelle-werkzeug>
			<ZeileSchalter
				titel="Kopfzeile"
				an={g.kopf}
				setze={(an) => struktur.fuehreAus('Kopfzeile geändert', (q) => bleibe(setzeKopfzeile(q, nr, an, n)))}
			/>
			{(['zeilen', 'spalten'] as const).map((was) => (
				<ZeileStepper
					key={was}
					titel={was === 'zeilen' ? 'Zeilen' : 'Spalten'}
					wert={g[was]}
					min={1}
					max={TABELLE_GRENZEN[was]}
					aus={aus}
					setze={(wert) => groesse(was, wert)}
				/>
			))}
		</fieldset>
	);
};

const aendereSichtbarkeit = (struktur: Struktur, nr: number, wert: string) =>
	struktur.aendereAttribute('Sichtbarkeit geändert', (q) => setzeSichtbarkeit(q, nr, wert));

export const Sichtbarkeit = ({
	aus = false,
	nr,
	quelle,
	struktur,
}: {
	nr: number;
	quelle: string;
	struktur: Struktur;
	aus?: boolean;
}) => (
	<select
		className={FELD_KLASSEN}
		disabled={aus}
		aria-label="Sichtbarkeit"
		data-sichtbarkeit
		value={leseSichtbarkeit(quelle, nr)}
		onChange={({ target: { value } }) => aendereSichtbarkeit(struktur, nr, value)}
	>
		{SICHTBARKEITEN.map((s) => (
			<option key={s.wert} value={s.wert}>
				{s.titel}
			</option>
		))}
	</select>
);

/** Mitte des Griffs bei diesem Wert: Der Griff (16 px) bleibt in der Breite des Reglers. */
const markeBei = (px: number) => {
	const anteil = (px - ABSTAND.min) / (ABSTAND.max - ABSTAND.min);
	return `calc(8px + (100% - 16px) * ${anteil})`;
};

/** „Seite 1 läuft über.“ */
const ueberlaufSatz = (seiten: number[]) => {
	if (seiten.length < 2) {
		return `Seite ${seiten[0] ?? ''} läuft über.`;
	}
	return `Seiten ${seiten.slice(0, -1).join(', ')} und ${seiten.at(-1) ?? ''} laufen über.`;
};

/** Titel, Klasse, Farbschema, Format, Abstand, Punkte: Jede Änderung ist ein Schritt im Verlauf (046). */
export const Blattwerkzeug = ({
	aktiv,
	doc,
	loesung,
	quelle,
	seite,
	struktur,
	ueberlauf,
}: {
	aktiv: boolean;
	/** Für Blatt › Gestaltung: Auswahl und sichtbare Seite. */
	seite: BlattSeite;
	doc: Document | null;
	/** Die Übersicht der Lösungen, wenn gerade die Lösung zu sehen ist. */
	loesung: ReactNode;
	quelle: string | null;
	struktur: Struktur;
	/** Seiten, die laut Prüfung überlaufen. */
	ueberlauf: number[];
}) => {
	const wert = struktur.werte?.abstand ?? null;
	const abstandVorgabe = struktur.werte?.abstandVorgabe ?? null;
	const [jetzt, setJetzt] = useState(wert ?? ABSTAND.min);
	const regler = useRef<HTMLInputElement>(null);
	const reglerId = useId();
	const setzeAbstand = useRef(struktur.abstand);
	const farben = useMemo(() => palettenFarben(doc), [doc]);

	useEffect(() => {
		setzeAbstand.current = struktur.abstand;
	});

	useEffect(() => {
		if (wert !== null) {
			setJetzt(Math.max(ABSTAND.min, Math.min(ABSTAND.max, wert)));
		}
	}, [wert]);

	// 196-13: Gesperrt (Konflikt, Vorschlag offen) bleibt alles stehen, nur bedienen lässt es sich nicht.
	const zeigt = quelle !== null && (wert !== null || !aktiv);
	const gesperrt = !aktiv;

	useReglerSchreiben(regler, (px) => setzeAbstand.current(px), zeigt);

	if (!zeigt) {
		return loesung ? <div data-blatt>{loesung}</div> : null;
	}
	const vorgabe = abstandVorgabe;
	const gesetzt = gesetzterAbstand(quelle) !== null;
	const vorgabeImRegler = vorgabe !== null && vorgabe >= ABSTAND.min && vorgabe <= ABSTAND.max;
	const w = leseBlatt(quelle);
	const setze = (titel: string, neu: Partial<BlattWerteTyp>) =>
		struktur.aendereAttribute(`${titel} geändert`, (q) => setzeBlatt(q, neu));
	const cm = (px: number) => `${zahlMitKomma(pxZuCm(px))} cm`;
	return (
		<fieldset data-blatt disabled={gesperrt} className="min-w-0">
			<div className="px-3 py-2">
				<p className="text-xs text-leise">Material</p>
				<h2 className="text-base font-semibold">Ganzes Blatt</h2>
			</div>
			<Abschnitt name="angaben" titel="Angaben">
				<Feld titel="Titel" lage="daneben">
					<Texteingabe
						data-einstellung="titel"
						wert={w.titel}
						leerErlaubt={false}
						setze={(titel) => setze('Titel', { titel })}
					/>
				</Feld>
				<ZeileWahl
					titel="Klasse"
					einstellung="klasse"
					wert={String(w.klasse)}
					optionen={KLASSEN.map((k) => ({ wert: String(k), titel: klasseName(k) }))}
					setze={(neu) => setze('Klasse', { klasse: KLASSEN.find((k) => String(k) === neu) ?? 'gemischt' })}
				/>
			</Abschnitt>
			<Abschnitt name="aussehen" titel="Aussehen">
				<Zeile
					titel="Farbschema"
					einstellung="farbschema"
					hilfe="Farben von Titel, Nummern und Markierungen im Blatt"
				>
					<div role="group" aria-label="Farbschema" className="flex" data-palette>
						{PALETTEN.map((p) => {
							const f = farben[p];
							return (
								<Farbpunkt
									key={p}
									name={PALETTEN_FARBNAME[p]}
									aria-label={`${p[0]?.toUpperCase()}${p.slice(1)}: ${PALETTEN_FARBNAME[p]}`}
									farbe={f ? `linear-gradient(135deg, ${f.haupt} 50%, ${f.akzent} 50%)` : ''}
									gewaehlt={w.palette === p}
									onClick={() => setze('Farbschema', { palette: p })}
								/>
							);
						})}
					</div>
				</Zeile>
				<ZeileWahl
					titel="Format"
					einstellung="format"
					hilfe="Passt danach etwas nicht mehr, meldet es die Prüfung."
					wert={w.format}
					// Folien nur für Präsentationen: Ein Blatt in 16:9 ergibt lauter Prüfmeldungen (Urteil 196).
					optionen={(w.format === 'minibuch'
						? ['minibuch' as const]
						: BLATT_FORMATE.filter((f) => f !== 'folie' || w.format === 'folie')
					).map((f) => ({
						wert: f,
						titel: FORMAT_NAME[f],
					}))}
					setze={(neu) => setze('Format', { format: neu as Format2 })}
				/>
				<div>
					<div className="flex h-zeile items-center justify-between gap-x-2">
						<span className="flex min-w-0 items-center gap-1 text-leise">
							<label htmlFor={reglerId}>Abstand</label>
							<Hilfetipp name="Abstand">
								Platz zwischen den Aufgaben, auf allen Seiten.
								{vorgabeImRegler &&
									` Die Marke am Regler zeigt die Vorgabe für dieses Blatt: ${cm(vorgabe)}.`}
							</Hilfetipp>
						</span>
						<span className="ml-auto flex flex-none items-center gap-2">
							{gesetzt && (
								<Tooltip text={
										vorgabe === null
											? 'Eigenen Abstand entfernen'
											: `Zurück zur Vorgabe: ${cm(vorgabe)}`
									}>
									<button
										type="button"
										data-abstand-vorgabe
										className="text-xs text-leise underline hover:text-tinte"
										onClick={struktur.abstandZurVorgabe}
									>
										Vorgabe
									</button>
								</Tooltip>
							)}
							<span className="text-leise tabular-nums" data-abstand-wert>
								{cm(jetzt)}
							</span>
						</span>
					</div>
					<div className="relative">
						<input
							ref={regler}
							id={reglerId}
							type="range"
							aria-label="Abstand zwischen Aufgaben"
							data-einstellung="abstand"
							className="h-zeile w-full accent-brand-500"
							min={ABSTAND.min}
							max={ABSTAND.max}
							step={ABSTAND.schritt}
							value={jetzt}
							onChange={(e) => {
								const px = Number(e.target.value);
								setJetzt(px);
								struktur.zeigeAbstand(px);
							}}
						/>
						{vorgabeImRegler && (
							<Tooltip text={`Vorgabe: ${cm(vorgabe)}`}>
								<span
									aria-hidden
									data-abstand-marke={vorgabe}
									className="absolute bottom-0 h-2 w-0.5 -translate-x-1/2 bg-leise"
									style={{ left: markeBei(vorgabe) }}
								/>
							</Tooltip>
						)}
					</div>
					{ueberlauf.length > 0 && (
						<p className="pb-1 text-xs font-medium text-warnung" data-abstand-ueberlauf>
							{ueberlaufSatz(ueberlauf)}
						</p>
					)}
				</div>
			</Abschnitt>
			{(w.hatPunkte || loesung) && (
				<Abschnitt name="loesung-und-punkte" titel="Lösung und Punkte">
					{w.hatPunkte && (
						<ZeileSchalter
							titel="Punkte zeigen"
							einstellung="punkte"
							hilfe="Bewertungspunkte an den Aufgaben und die Gesamtpunkte. Aus: im Blatt und im Druck ausgeblendet."
							an={w.punkte}
							setze={(an) => setze('Punkte zeigen', { punkte: an })}
						/>
					)}
					{loesung}
				</Abschnitt>
			)}
			<BlattGestaltung doc={doc} quelle={quelle} struktur={struktur} seite={seite} />
		</fieldset>
	);
};
