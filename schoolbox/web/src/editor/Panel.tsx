import type { AbschnittName } from '@schoolbox/kern/src/abschnitte';
import type { BlattWerte as BlattWerteTyp } from '@schoolbox/kern/src/kit-einstellungen';
import {
	BLATT_FORMATE,
	KIT_FELDER,
	leseBlatt,
	leseKit,
	leseSichtbarkeit,
	PALETTEN,
	PALETTEN_FARBNAME,
	setzeBlatt,
	setzeKit,
	setzeSichtbarkeit,
	SICHTBARKEITEN,
} from '@schoolbox/kern/src/kit-einstellungen';
import { ABSTAND, gesetzterAbstand, SPALTEN } from '@schoolbox/kern/src/struktur';
import { groesseVon, setzeGroesse, setzeKopfzeile } from '@schoolbox/kern/src/tabelle';
import type { Format as Format2 } from '@schoolbox/kern/src/werte';
import { FORMAT_NAME, KLASSEN } from '@schoolbox/kern/src/werte';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Abschnitt } from '../bausteine/Abschnitt';
import { Feld } from '../bausteine/Feld';
import { Hilfetipp } from '../bausteine/Hilfetipp';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Schalter } from '../bausteine/Schalter';
import { Stepper } from '../bausteine/Stepper';
import { Zeile } from '../bausteine/Zeile';
import { klasseName } from '../lib/text';
import type { Ablage } from './ablage';
import type { PfadTeil } from './darstellung';
import { palettenFarben } from './palettenfarben';
import type { Spalten, Struktur } from './struktur';

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

export const Spaltenwahl = ({ spalten, struktur }: { spalten: Spalten; struktur: Struktur }) => {
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
	nr,
	quelle,
	struktur,
}: {
	abschnitt: AbschnittName;
	art: string;
	folien: boolean;
	nr: number;
	quelle: string | null;
	struktur: Struktur;
}) => {
	const felder = (KIT_FELDER[art] ?? []).filter((f) => (f.abschnitt ?? 'darstellung') === abschnitt);
	if (felder.length === 0 || !quelle) {
		return null;
	}
	const werte = leseKit(quelle, nr, art);
	const setze = (name: string, titel: string, wert: string | number | boolean) =>
		struktur.aendereAttribute(`${titel} geändert`, (q) => setzeKit(q, nr, art, name, wert, { jeSeite: folien }));
	return (
		<div className="flex flex-col gap-1" data-kit={art}>
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
							setze={(n) => setze(f.name, titel, n)}
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
				return (
					<Feld key={f.name} titel={titel}>
						<input
							key={String(wert)}
							className={FELD_KLASSEN}
							defaultValue={String(wert)}
							onBlur={(e) => setze(f.name, titel, e.target.value)}
						/>
					</Feld>
				);
			})}
		</div>
	);
};

/** Größe und Kopfzeile der Kit-Tabelle (047). Einfügen und Löschen an einer Stelle stehen in der Leiste und im ⋯. */
export const TabellenWerkzeug = ({
	folien,
	nr,
	pfad,
	quelle,
	struktur,
}: {
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
	const groesse = (was: 'zeilen' | 'spalten', wert: number) =>
		struktur.fuehreAus('Tabellengröße geändert', (q) => setzeGroesse(q, nr, { [was]: wert }, n));
	return (
		<div className="flex flex-col gap-1" data-tabelle-werkzeug>
			<ZeileSchalter
				titel="Kopfzeile"
				an={g.kopf}
				setze={(an) => struktur.fuehreAus('Kopfzeile geändert', (q) => setzeKopfzeile(q, nr, an, n))}
			/>
			{(['zeilen', 'spalten'] as const).map((was) => (
				<ZeileStepper
					key={was}
					titel={was === 'zeilen' ? 'Zeilen' : 'Spalten'}
					wert={g[was]}
					min={1}
					max={30}
					setze={(wert) => groesse(was, wert)}
				/>
			))}
		</div>
	);
};

const aendereSichtbarkeit = (struktur: Struktur, nr: number, wert: string) =>
	struktur.aendereAttribute('Sichtbarkeit geändert', (q) => setzeSichtbarkeit(q, nr, wert));

export const Sichtbarkeit = ({ nr, quelle, struktur }: { nr: number; quelle: string; struktur: Struktur }) => (
	<select
		className={FELD_KLASSEN}
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
	struktur,
	ueberlauf,
}: {
	aktiv: boolean;
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
	const farbenJetzt = useMemo(() => palettenFarben(doc), [doc]);

	/**
	 * Nach jeder Änderung ist kurz nichts zu messen, bis die neue Fassung im `iframe` steht. Dasselbe Dokument bleibt
	 * offen, also gilt so lange der letzte Stand, und der Reiter wird nicht leer.
	 */
	const zuletzt = useRef<{ farben: typeof farbenJetzt; vorgabe: number | null; quelle: string } | null>(null);
	if (aktiv && wert !== null && quelle) {
		zuletzt.current = { farben: farbenJetzt, vorgabe: abstandVorgabe, quelle };
	}

	useEffect(() => {
		setzeAbstand.current = struktur.abstand;
	});

	useEffect(() => {
		if (wert !== null) {
			setJetzt(Math.max(ABSTAND.min, Math.min(ABSTAND.max, wert)));
		}
	}, [wert]);

	const stand = zuletzt.current;
	const zeigt = aktiv && stand !== null;

	useEffect(() => {
		const element = regler.current;
		if (!element) {
			return undefined;
		}
		const fertig = () => setzeAbstand.current(Number(element.value));
		element.addEventListener('change', fertig);
		return () => element.removeEventListener('change', fertig);
	}, [zeigt]);

	if (!zeigt) {
		return loesung ? <div data-blatt>{loesung}</div> : null;
	}
	const { farben, vorgabe } = stand;
	const aktuelleQuelle = quelle ?? stand.quelle;
	const gesetzt = gesetzterAbstand(aktuelleQuelle) !== null;
	const vorgabeImRegler = vorgabe !== null && vorgabe >= ABSTAND.min && vorgabe <= ABSTAND.max;
	const w = leseBlatt(aktuelleQuelle);
	const setze = (titel: string, neu: Partial<BlattWerteTyp>) =>
		struktur.aendereAttribute(`${titel} geändert`, (q) => setzeBlatt(q, neu));
	return (
		<div data-blatt>
			<div className="px-3 py-2">
				<p className="text-xs text-leise">Dokument</p>
				<h2 className="text-base font-semibold">Ganzes Blatt</h2>
			</div>
			<Abschnitt name="angaben" titel="Angaben">
				<Feld titel="Titel" lage="daneben">
					<input
						key={w.titel}
						className={FELD_KLASSEN}
						data-einstellung="titel"
						defaultValue={w.titel}
						onBlur={(e) => e.target.value.trim() && setze('Titel', { titel: e.target.value.trim() })}
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
					<div role="group" aria-label="Farbschema" className="flex gap-1" data-palette>
						{PALETTEN.map((p) => {
							const f = farben[p];
							return (
								<button
									key={p}
									type="button"
									aria-pressed={w.palette === p}
									aria-label={`${p[0]?.toUpperCase()}${p.slice(1)}: ${PALETTEN_FARBNAME[p]}`}
									title={PALETTEN_FARBNAME[p]}
									className="size-knopf-klein rounded-full border border-rand p-0.5 aria-pressed:border-tinte"
									onClick={() => setze('Farbschema', { palette: p })}
								>
									<span
										aria-hidden
										className="block size-full min-h-4 rounded-full"
										style={
											f
												? {
														background: `linear-gradient(135deg, ${f.haupt} 50%, ${f.akzent} 50%)`,
													}
												: undefined
										}
									/>
								</button>
							);
						})}
					</div>
				</Zeile>
				<ZeileWahl
					titel="Format"
					einstellung="format"
					hilfe="Passt danach etwas nicht mehr, meldet es die Prüfung."
					wert={w.format}
					optionen={(w.format === 'minibuch' ? ['minibuch' as const] : BLATT_FORMATE).map((f) => ({
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
								{vorgabeImRegler && ` Die Marke am Regler zeigt die Vorgabe für dieses Blatt: ${vorgabe} px.`}
							</Hilfetipp>
						</span>
						<span className="ml-auto flex flex-none items-center gap-2">
							{gesetzt && (
								<button
									type="button"
									data-abstand-vorgabe
									className="text-xs text-leise underline hover:text-tinte"
									title={
										vorgabe === null ? 'Eigenen Abstand entfernen' : `Zurück zur Vorgabe: ${vorgabe} px`
									}
									onClick={struktur.abstandZurVorgabe}
								>
									Vorgabe
								</button>
							)}
							<span className="text-leise tabular-nums" data-abstand-wert>{`${jetzt} px`}</span>
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
							<span
								aria-hidden
								data-abstand-marke={vorgabe}
								title={`Vorgabe: ${vorgabe} px`}
								className="absolute bottom-0 h-2 w-0.5 -translate-x-1/2 bg-leise"
								style={{ left: markeBei(vorgabe) }}
							/>
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
		</div>
	);
};
