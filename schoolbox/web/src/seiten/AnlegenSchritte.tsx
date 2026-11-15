import type { Antworten, AssistentSchrittId, FormatWahl, FreitextFeld, Weg } from '@schoolbox/kern/src/assistent';
import {
	ART_WAHL,
	bausteinSchalter,
	formatOptionen,
	FREITEXT,
	funktionEmpfehlung,
	FUNKTIONEN,
	LERNGRUPPE,
	schritteFuer,
	UMFAENGE,
	umfangEmpfehlung,
	WEG_WAHL,
	ZIEL_ANFAENGE,
} from '@schoolbox/kern/src/assistent';
import { ART_KURZ, FACH_NAME } from '@schoolbox/kern/src/namen';
import type { Art, Format } from '@schoolbox/kern/src/werte';
import { FAECHER, KLASSEN } from '@schoolbox/kern/src/werte';
import type { ReactNode } from 'react';
import { useId, useRef } from 'react';

import { Chip } from '../bausteine/Chip';
import { Gekuerzt } from '../bausteine/Gekuerzt';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Schalter } from '../bausteine/Schalter';
import { Segment } from '../bausteine/Segment';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import type { limitHinweis } from '../editor/ki';
import { LimitZeile } from '../editor/LimitZeile';
import type { Ordnerangabe } from './anlegen-hilfe';

/** Die Schritte des Assistenten „Material anlegen“ (132, Entwurf A1 S. 2–9). Fragen und Antworten aus `assistent.ts`. */

const FELD = `${FELD_KLASSEN} w-full`;
const TITEL_ZEICHEN = FREITEXT.titel.zeichen;

const ART_SYMBOL: Record<Art, SymbolName> = {
	arbeitsblatt: 'blatt',
	lesetext: 'buch',
	praesentation: 'praesentieren',
	lernspiel: 'puzzle',
	karten: 'seiten',
	lernplakat: 'bild',
	stationen: 'route',
	lernzielkontrolle: 'ziel',
	klassenarbeit: 'bewerten',
	unterrichtsplanung: 'kalender',
	sonstiges: 'mehr',
};

/** Umriss der Seite auf der Format-Karte, ungefähr maßstäblich (A1 S. 4). */
const SEITE: Record<Format, [number, number]> = {
	'a4-hoch': [46, 64],
	'a4-quer': [64, 46],
	'a5-hoch': [34, 48],
	'a3-hoch': [54, 76],
	'folie': [72, 40],
	'minibuch': [64, 46],
};

export const Fehler = ({ text }: { text: string | null }) =>
	text ? (
		<p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-fehler" data-anlegen-fehler>
			{text}
		</p>
	) : null;

export const Empfohlen = () => (
	<span className="inline-flex rounded-full bg-brand-50 px-1.5 text-xs font-medium text-brand-700">Empfohlen</span>
);

export const Etikett = ({ children, zusatz }: { children: ReactNode; zusatz?: ReactNode }) => (
	<span className="mb-1 block font-medium">
		{children}
		{zusatz && <small className="ml-1.5 text-xs font-normal text-leise">{zusatz}</small>}
	</span>
);

/**
 * Eine Antwort als Fläche; `nr` ist die Ziffer, mit der sie sich wählen lässt (A1 S. 2–4), sie steht nur in der Hilfe
 * (53). Ein Klick oder Tipp wählt und geht weiter, Ziffer und Leertaste wählen nur (`detail` ist dann 0).
 */
export const Wahl = ({
	aktiv,
	children,
	className,
	gesperrt,
	id,
	nr,
	waehle,
	weiter,
}: {
	id: string;
	aktiv: boolean;
	waehle: () => void;
	children: ReactNode;
	nr?: number;
	gesperrt?: boolean;
	className?: string;
	weiter?: (() => void) | undefined;
}) => (
	<button
		type="button"
		aria-pressed={aktiv}
		disabled={gesperrt}
		data-wahl={id}
		data-wahl-nr={nr}
		className={klassen(
			'relative flex w-full gap-2.5 rounded-lg border p-2.5 transition-colors duration-[120ms] disabled:opacity-50',
			// Eine mittige Karte bleibt mittig (190-15).
			!className?.includes('text-center') && 'text-left',
			aktiv
				? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
				: 'border-rand bg-flaeche hover:bg-flaeche-2 disabled:hover:bg-flaeche',
			className,
		)}
		onClick={(e) => {
			waehle();
			if (e.detail > 0) {
				weiter?.();
			}
		}}
	>
		{children}
	</button>
);

/** Ab 90 % der Höchstlänge „190 / 200“ unter dem Feld, an der Grenze in Warnfarbe (190-20). */
export const Zaehler = ({ max, wert }: { wert: string; max: number }) =>
	wert.length >= max * 0.9 ? (
		<small
			className={klassen('mt-0.5 block text-right text-xs', wert.length >= max ? 'text-warnung' : 'text-leise')}
			data-zaehler
		>
			{`${wert.length} / ${max}`}
		</small>
	) : null;

/** Einzeiliges Feld für eine Freitext-Stelle; öffnet sich mit Fokus (Festlegung F7). */
const FreiFeld = ({
	autoFokus,
	feld,
	setze,
	wert,
}: {
	feld: FreitextFeld;
	wert: string;
	setze: (text: string) => void;
	autoFokus: boolean;
}) => (
	<>
		<input
			className={klassen(FELD, 'mt-2')}
			aria-label={FREITEXT[feld].name}
			placeholder={FREITEXT[feld].platz}
			maxLength={FREITEXT[feld].zeichen}
			value={wert}
			autoFocus={autoFokus}
			data-freitext={feld}
			data-anders-feld
			onChange={(e) => setze(e.target.value)}
		/>
		<Zaehler wert={wert} max={FREITEXT[feld].zeichen} />
	</>
);

/** Klein neben „Klasse“ und „Fach“: woher der Wert kam, oder dass die Wahl noch fehlt (S-14). */
const zusatzVon = (ordner: Ordnerangabe, feld: 'klasse' | 'fach') => {
	if (ordner.vorbelegt.quelle === 'behaelter') {
		return feld === 'klasse' ? `legt der Ordner „${ordner.name}“ fest` : undefined;
	}
	if (ordner.offen?.[feld]) {
		return (
			<span className={ordner.mahnen ? 'text-fehler' : undefined} data-klasse-fach-fehlt={feld}>
				bitte wählen
			</span>
		);
	}
	return ordner.gewaehlt?.[feld] ? undefined : ordner.vorbelegt.herkunft[feld];
};

const KlasseUndFach = ({
	a,
	ordner,
	setze,
}: {
	a: Antworten;
	ordner: Ordnerangabe;
	setze: (teil: Partial<Antworten>) => void;
}) => {
	const fest = ordner.vorbelegt.quelle === 'behaelter';
	return (
		<>
			<div className="mb-4">
				<Etikett zusatz={zusatzVon(ordner, 'klasse')}>Klasse</Etikett>
				<Segment
					beschriftung="Klasse"
					aus={fest}
					werte={KLASSEN.map((k) => ({
						wert: String(k),
						titel: k === 'gemischt' ? 'jahrgangsgemischt' : String(k),
					}))}
					wert={ordner.offen?.klasse ? '' : String(a.klasse)}
					waehle={(k) => setze({ klasse: KLASSEN.find((x) => String(x) === k) ?? a.klasse })}
				/>
			</div>
			<div role="group" aria-label="Fach">
				<Etikett zusatz={zusatzVon(ordner, 'fach')}>Fach</Etikett>
				<div className="flex flex-wrap gap-1.5">
					{FAECHER.map((f) => (
						<Chip
							key={f}
							titel={FACH_NAME[f]}
							aktiv={!ordner.offen?.fach && f === a.fach}
							waehle={() => {
								if (!fest) {
									setze({ fach: f });
								}
							}}
						/>
					))}
				</div>
			</div>
		</>
	);
};

export const SchrittStart = ({
	a,
	grund,
	setzeWeg,
	verfuegbar,
	weiter,
}: {
	a: Antworten;
	verfuegbar: boolean;
	grund: string;
	setzeWeg: (weg: Weg) => void;
	weiter: () => void;
}) => (
	<div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
		{WEG_WAHL.map((w, i) => (
			<Wahl
				key={w.wert}
				id={w.wert}
				nr={i + 1}
				aktiv={a.weg === w.wert}
				gesperrt={w.wert === 'claude' && !verfuegbar}
				className="min-h-48 flex-col p-4"
				waehle={() => setzeWeg(w.wert)}
				weiter={weiter}
			>
				<Symbol name={w.wert === 'claude' ? 'funken' : 'blatt'} className="size-8 text-brand-500" />
				<span className="block text-base font-semibold">{w.name}</span>
				<span className="block text-sm text-leise">
					{w.wert === 'claude' && !verfuegbar ? grund : w.hinweis}
				</span>
				{w.wert === 'claude' && verfuegbar && (
					<span className="mt-auto">
						<Empfohlen />
					</span>
				)}
			</Wahl>
		))}
	</div>
);

export const SchrittArt = ({
	a,
	offen,
	setze,
	waehleArt,
	laeuftSchon,
	waehleEinheit,
	weiter,
}: {
	a: Antworten;
	offen: boolean;
	setze: (teil: Partial<Antworten>) => void;
	waehleArt: (art: Art) => void;
	waehleEinheit: () => void;
	weiter: () => void;
	/** Titel der Einheit, die Claude gerade baut: Dann geht keine zweite (190-07). */
	laeuftSchon: string | null;
}) => {
	// „Etwas anderes …“ fragt nur mit Claude nach dem Text; beim leeren Blatt zählt er nicht.
	const mitText = (art: Art) => art === 'sonstiges' && a.weg === 'claude';
	const gross = ART_WAHL.filter((w) => !w.klein);
	const klein = ART_WAHL.filter((w) => w.klein);
	return (
		<>
			<div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
				{gross.map((w, i) => (
					<Wahl
						key={w.art}
						id={w.art}
						nr={i + 1}
						aktiv={!a.einheit && a.art === w.art}
						waehle={() => waehleArt(w.art)}
						weiter={weiter}
					>
						<Symbol name={ART_SYMBOL[w.art]} className="mt-0.5 size-4 flex-none text-leise" />
						<span className="min-w-0">
							<span className="block font-medium">{w.name}</span>
							<span className="block text-sm text-leise">{ART_KURZ[w.art]}</span>
						</span>
					</Wahl>
				))}
			</div>
			<Wahl
				id="einheit"
				aktiv={a.einheit}
				gesperrt={a.weg !== 'claude' || laeuftSchon !== null}
				className="mt-2"
				waehle={waehleEinheit}
				weiter={weiter}
			>
				<Symbol name="ordner" className="mt-0.5 size-4 flex-none text-leise" />
				<span className="min-w-0">
					<span className="block font-medium">Unterrichtseinheit</span>
					<span className="block text-sm text-leise" data-einheit-grund>
						{a.weg !== 'claude' && 'Nur mit Claude.'}
						{a.weg === 'claude' &&
							(laeuftSchon === null
								? 'Ein Ordner mit mehreren Materialien zu einem Thema, gebaut in einem Lauf.'
								: `Claude baut gerade „${laeuftSchon}“.`)}
					</span>
				</span>
			</Wahl>
			<div className="mt-3 flex flex-wrap items-center gap-1.5 text-leise">
				Oder:
				{klein.map((w) => (
					<button
						key={w.art}
						type="button"
						data-wahl={w.art}
						aria-pressed={!a.einheit && a.art === w.art}
						className={klassen(
							'inline-flex h-knopf-klein items-center gap-1.5 rounded-md border px-2 text-sm font-medium',
							!a.einheit && a.art === w.art
								? 'border-brand-500 bg-brand-50 text-tinte'
								: 'border-rand bg-flaeche hover:bg-flaeche-2',
						)}
						onClick={(e) => {
							waehleArt(w.art);
							if (e.detail > 0 && !mitText(w.art)) {
								weiter();
							}
						}}
					>
						<Symbol name={ART_SYMBOL[w.art]} />
						{mitText(w.art) ? `${w.name} …` : w.name}
					</button>
				))}
			</div>
			{mitText(a.art) && (
				<FreiFeld feld="artText" wert={a.artText} autoFokus={offen} setze={(t) => setze({ artText: t })} />
			)}
		</>
	);
};

const Seitenform = ({ format }: { format: Format }) => {
	const [breite, hoehe] = SEITE[format];
	return (
		<span className="grid h-20 place-items-center">
			<span
				className="flex flex-col gap-1 rounded-xs border-[1.5px] border-rand-feld bg-flaeche p-1.5"
				style={{ width: breite, height: hoehe }}
			>
				<i className="h-1 w-3/5 bg-brand-100" />
				<i className="h-0.5 bg-rand" />
				<i className="h-0.5 w-4/5 bg-rand" />
			</span>
		</span>
	);
};

export const SchrittFormat = ({
	a,
	offen,
	setze,
	setzeOffen,
	wahl,
	weiter,
}: {
	a: Antworten;
	wahl: FormatWahl;
	offen: boolean;
	setze: (teil: Partial<Antworten>) => void;
	setzeOffen: (offen: boolean) => void;
	weiter: () => void;
}) => {
	const optionen = formatOptionen(a);
	const frei = a.weg === 'claude';
	// „Anderes Format …“ ist keine Karte: so viele Spalten wie Optionen, keine allein in der zweiten Zeile (190-15).
	const spalten = Math.min(optionen.length, 4);
	return (
		<>
			<div className="grid gap-3 max-md:grid-cols-2!" style={{ gridTemplateColumns: `repeat(${spalten}, 1fr)` }}>
				{optionen.map((o, i) => (
					<Wahl
						key={o.wert}
						id={o.wert}
						nr={i + 1}
						aktiv={!offen && o.wert === wahl.wert}
						className="flex-col items-center text-center"
						waehle={() => {
							setzeOffen(false);
							setze({ format: o.empfohlen ? '' : o.wert, formatText: '' });
						}}
						weiter={weiter}
					>
						<Seitenform format={o.format} />
						<span className="block font-medium">{`${o.name.charAt(0).toUpperCase()}${o.name.slice(1)}`}</span>
						{o.hinweis && <span className="block text-sm text-leise">{o.hinweis}</span>}
						{o.empfohlen && <Empfohlen />}
					</Wahl>
				))}
			</div>
			{frei && (
				<div className="mt-3 flex flex-wrap items-center gap-1.5 text-leise">
					Oder:
					<Knopf
						art="leise"
						groesse="klein"
						aria-pressed={offen}
						data-wahl="anders"
						data-wahl-nr={optionen.length + 1}
						className={klassen(offen && 'border-brand-500 bg-brand-50 text-tinte')}
						onClick={() => setzeOffen(true)}
					>
						<Symbol name="stift" />
						{FREITEXT.formatText.name}
					</Knopf>
					<span className="text-sm">Claude darf das Format ändern</span>
				</div>
			)}
			{frei && offen && (
				<FreiFeld feld="formatText" wert={a.formatText} autoFokus setze={(t) => setze({ formatText: t })} />
			)}
			{frei && offen && (
				<p className="mt-2 text-sm text-leise">
					{`Angelegt wird ${wahl.name}. Claude stellt das Blatt um, wenn es geht.`}
				</p>
			)}
		</>
	);
};

export const SchrittFuerWen = ({
	a,
	ordner,
	setze,
}: {
	a: Antworten;
	ordner: Ordnerangabe;
	setze: (teil: Partial<Antworten>) => void;
}) => <KlasseUndFach a={a} ordner={ordner} setze={setze} />;

/** Segment mit einem Eintrag „Anders …“, der ein Freitextfeld öffnet. */
const SegmentMitAnders = <T extends string>({
	beschriftung,
	feld,
	offen,
	setzeOffen,
	setzeText,
	text,
	waehle,
	wert,
	werte,
}: {
	beschriftung: string;
	feld: FreitextFeld;
	werte: { wert: T; titel: string }[];
	wert: T;
	waehle: (wert: T) => void;
	offen: boolean;
	setzeOffen: (offen: boolean) => void;
	text: string;
	setzeText: (text: string) => void;
}) => (
	<>
		<Segment<T | 'anders'>
			beschriftung={beschriftung}
			werte={[...werte, { wert: 'anders', titel: FREITEXT[feld].name }]}
			wert={offen ? 'anders' : wert}
			waehle={(w) => {
				if (w === 'anders') {
					setzeOffen(true);
				} else {
					setzeOffen(false);
					waehle(w);
				}
			}}
		/>
		{offen && <FreiFeld feld={feld} wert={text} autoFokus setze={setzeText} />}
	</>
);

export const SchrittThema = ({
	a,
	offen,
	setze,
	setzeOffen,
	setzeTitel,
	titelPruefung,
	titelVorschlagen,
}: {
	a: Antworten;
	offen: Partial<Record<FreitextFeld, boolean>>;
	setze: (teil: Partial<Antworten>) => void;
	setzeOffen: (feld: FreitextFeld, offen: boolean) => void;
	setzeTitel: (titel: string) => void;
	titelPruefung: TitelPruefung;
	titelVorschlagen: boolean;
}) => {
	const ziel = useRef<HTMLInputElement>(null);
	const umfang = umfangEmpfehlung(a.art);
	return (
		<>
			<label className="mb-4 block">
				<Etikett>{FREITEXT.thema.name}</Etikett>
				<input
					className={FELD}
					placeholder={FREITEXT.thema.platz}
					maxLength={FREITEXT.thema.zeichen}
					value={a.thema}
					data-fokus
					onChange={(e) => setze({ thema: e.target.value })}
				/>
				<Zaehler wert={a.thema} max={FREITEXT.thema.zeichen} />
			</label>
			{/* Der Titel steht beim Thema und folgt ihm, bis man ihn selbst ändert (190-37). */}
			<div className="mb-4">
				<TitelFeld
					titel={a.titel}
					setzeTitel={setzeTitel}
					vorschlag={titelVorschlagen}
					fokus={false}
					pruefung={titelPruefung}
				/>
			</div>
			<div className="mb-4">
				<label className="block">
					<Etikett zusatz="optional">{FREITEXT.ziel.name}</Etikett>
					<input
						ref={ziel}
						className={FELD}
						placeholder={FREITEXT.ziel.platz}
						maxLength={FREITEXT.ziel.zeichen}
						value={a.ziel}
						onChange={(e) => setze({ ziel: e.target.value })}
					/>
					<Zaehler wert={a.ziel} max={FREITEXT.ziel.zeichen} />
				</label>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{ZIEL_ANFAENGE.map((anfang) => (
						<Knopf
							key={anfang}
							art="leise"
							groesse="klein"
							onClick={() => {
								setze({ ziel: anfang });
								ziel.current?.focus();
							}}
						>
							<Symbol name="plus" />
							{`${anfang.trim()} …`}
						</Knopf>
					))}
				</div>
			</div>
			<div className={klassen(umfang !== null && 'mb-4')}>
				<Etikett>Wofür in der Reihe?</Etikett>
				<SegmentMitAnders
					beschriftung="Funktion in der Reihe"
					feld="funktionText"
					werte={FUNKTIONEN.map((f) => ({ wert: f.wert, titel: f.name }))}
					wert={a.funktion ?? funktionEmpfehlung(a.art)}
					waehle={(f) => setze({ funktion: f })}
					offen={offen.funktionText === true}
					setzeOffen={(o) => setzeOffen('funktionText', o)}
					text={a.funktionText}
					setzeText={(t) => setze({ funktionText: t })}
				/>
			</div>
			{/* Die Arbeitszeit legt die Menge fest und gehört zum Thema, nicht zu den Bausteinen (190-38). */}
			{umfang !== null && (
				<div>
					<Etikett>Arbeitszeit je Kind</Etikett>
					<SegmentMitAnders
						beschriftung="Arbeitszeit je Kind"
						feld="umfangText"
						werte={UMFAENGE.map((u) => ({ wert: u.wert, titel: u.name }))}
						wert={a.umfang ?? umfang}
						waehle={(u) => setze({ umfang: u })}
						offen={offen.umfangText === true}
						setzeOffen={(o) => setzeOffen('umfangText', o)}
						text={a.umfangText}
						setzeText={(t) => setze({ umfangText: t })}
					/>
				</div>
			)}
		</>
	);
};

export const SchrittBausteine = ({ a, setze }: { a: Antworten; setze: (teil: Partial<Antworten>) => void }) => {
	const schalter = bausteinSchalter(a.einheit ? { ...a, art: 'arbeitsblatt' } : a);
	const symbol = { selbsteinschaetzung: 'natur', niveaus: 'stapel', sternchen: 'stern' } as const;
	return (
		<>
			{schalter.length > 0 && (
				<div className="rounded-lg border border-rand px-3">
					{schalter.map((s) => (
						<div
							key={s.wert}
							className="flex items-center gap-3 border-b border-rand py-2 last:border-b-0"
							data-baustein={s.wert}
						>
							<Symbol name={symbol[s.wert]} className="size-5 flex-none text-leise" />
							<span className="min-w-0 flex-1">
								<span className="block font-medium">{s.name}</span>
								<span className="block text-sm text-leise">
									{s.hinweis}
									{s.bedingung && ` · ${s.bedingung}`}
								</span>
							</span>
							{/* Die Marke hat immer ihren Platz: Die Schalter stehen untereinander (190-18). */}
							<span className={klassen('flex-none', !s.empfohlen && 'invisible')} aria-hidden={!s.empfohlen}>
								<Empfohlen />
							</span>
							<Schalter
								name={s.name}
								an={s.an}
								setze={(an) => setze({ bausteine: { ...a.bausteine, [s.wert]: an } })}
							/>
						</div>
					))}
				</div>
			)}
			{a.einheit && <p className="mt-2 text-sm text-leise">Gilt für alle Blätter der Einheit.</p>}
		</>
	);
};

export const SchrittKlasse = ({
	a,
	schluss,
	setze,
}: {
	a: Antworten;
	setze: (teil: Partial<Antworten>) => void;
	/** Der letzte Schritt trägt Dauer, Verbrauch und Limit (190-37). */
	schluss: ReactNode;
}) => (
	<>
		<div role="group" aria-label="Lerngruppe" className="mb-4 flex flex-wrap gap-1.5">
			{LERNGRUPPE.map((l) => {
				const an = a.lerngruppe.includes(l.wert);
				const neu = an ? a.lerngruppe.filter((x) => x !== l.wert) : [...a.lerngruppe, l.wert];
				return <Chip key={l.wert} titel={l.name} aktiv={an} waehle={() => setze({ lerngruppe: neu })} />;
			})}
		</div>
		<label className="block">
			<Etikett>{FREITEXT.sonst.name}</Etikett>
			<textarea
				className={klassen(FELD_KLASSEN, 'h-auto w-full py-1.5')}
				rows={4}
				placeholder={FREITEXT.sonst.platz}
				maxLength={FREITEXT.sonst.zeichen}
				value={a.sonst}
				onChange={(e) => setze({ sonst: e.target.value })}
			/>
			<Zaehler wert={a.sonst} max={FREITEXT.sonst.zeichen} />
		</label>
		<p className="mt-2 flex items-center gap-2 rounded-md bg-warnung-hell px-3 py-1.5 text-sm text-warnung">
			<Symbol name="info" />
			Keine Namen von Kindern eintragen.
		</p>
		{schluss}
	</>
);

/** Unter dem letzten Fragenschritt des Blatts: was nach dem Klick kommt, wie lange es dauert, das Limit (190-36). */
export const StartHinweis = ({
	einheit,
	gesperrt,
	hinweis,
	pruefeLimit,
}: {
	einheit: ReactNode;
	hinweis: ReturnType<typeof limitHinweis>;
	gesperrt: boolean;
	pruefeLimit: () => Promise<void>;
}) => (
	<>
		{einheit ?? (
			<p className="mt-3 flex items-center gap-2 text-sm text-leise" data-start-hinweis>
				<Symbol name="uhr" className="flex-none" />
				Zuerst kommt der Aufgabenplan, meist nach ein bis zwei Minuten. Der Bau danach dauert meist 5 bis 15
				Minuten und verbraucht deutlich mehr als eine Änderung.
			</p>
		)}
		{hinweis && (
			<LimitZeile
				key={hinweis.art}
				className={klassen('mt-2 rounded-md px-3 py-1.5', gesperrt ? 'bg-red-50' : 'bg-warnung-hell')}
				hinweis={hinweis}
				pruefeLimit={pruefeLimit}
			/>
		)}
	</>
);

export const OrdnerFeld = ({ name }: { name: string }) => (
	<div className="w-48 flex-none">
		<Etikett>Ordner</Etikett>
		<div className={klassen(FELD_KLASSEN, 'flex items-center gap-1.5 bg-flaeche-2')} data-anlegen-ordner>
			<Symbol name="ordner" />
			<span className="truncate">{name}</span>
		</div>
	</div>
);

/** Der Titel prüft sich beim Verlassen; den Fehler zeigt er am Feld, nicht erst im letzten Schritt (190-N01). */
export interface TitelPruefung {
	fehler: string | null;
	pruefen: () => void;
}

export const TitelFeld = ({
	fokus = true,
	pruefung,
	setzeTitel,
	titel,
	vorschlag,
}: {
	titel: string;
	setzeTitel: (titel: string) => void;
	vorschlag: boolean;
	/** Das erste Feld des Schritts bekommt den Fokus; unter dem Thema ist es das Thema. */
	fokus?: boolean;
	pruefung?: TitelPruefung;
}) => {
	const fehlerId = useId();
	const fehler = pruefung?.fehler ?? null;
	return (
		<label className="block min-w-0 flex-1">
			<Etikett zusatz={vorschlag ? 'Vorschlag, änderbar' : undefined}>Titel</Etikett>
			<input
				className={klassen(FELD, fehler && 'border-fehler')}
				maxLength={TITEL_ZEICHEN}
				value={titel}
				data-fokus={fokus ? '' : undefined}
				data-titel
				aria-invalid={fehler ? true : undefined}
				aria-describedby={fehler ? fehlerId : undefined}
				onFocus={(e) => e.target.select()}
				onBlur={pruefung?.pruefen}
				onChange={(e) => setzeTitel(e.target.value)}
			/>
			{fehler && (
				<span id={fehlerId} role="alert" className="mt-1 block text-sm text-fehler" data-titel-fehler>
					{fehler}
				</span>
			)}
			<Zaehler wert={titel} max={TITEL_ZEICHEN} />
		</label>
	);
};

export const SchrittTitel = ({
	a,
	ordner,
	setze,
	setzeTitel,
	titelPruefung,
}: {
	a: Antworten;
	ordner: Ordnerangabe;
	setze: (teil: Partial<Antworten>) => void;
	setzeTitel: (titel: string) => void;
	titelPruefung: TitelPruefung;
}) => (
	<>
		<div className="mb-4 flex items-start gap-3">
			<TitelFeld titel={a.titel} setzeTitel={setzeTitel} vorschlag={false} pruefung={titelPruefung} />
			<OrdnerFeld name={ordner.name} />
		</div>
		{ordner.vorbelegt.quelle !== 'behaelter' && <KlasseUndFach a={a} ordner={ordner} setze={setze} />}
	</>
);

/** Unter einem Schritt, den man noch nicht beantwortet hat. */
const leereAntwort = (s: { optional?: boolean }) => (s.optional ? 'optional' : '');

const punktFarbe = (fertig: boolean, aktiv: boolean) => {
	if (fertig) {
		return 'bg-gut text-white';
	}
	return aktiv ? 'bg-brand-500 text-white' : 'bg-flaeche-2 text-leise';
};

export const Schrittleiste = ({
	a,
	aktuell,
	besucht,
	gehe,
	klasseFachOffen = false,
}: {
	a: Antworten;
	aktuell: AssistentSchrittId;
	besucht: ReadonlySet<AssistentSchrittId>;
	gehe: (id: AssistentSchrittId) => void;
	/** Klasse oder Fach fehlt: „Für wen“ zeigt keinen Platzhalter als Antwort (S-14). */
	klasseFachOffen?: boolean;
}) => (
	<nav aria-label="Schritte" className="flex flex-col gap-0.5 border-r border-rand pr-3 max-md:hidden">
		{schritteFuer(a).map((s, i) => {
			const fertig = besucht.has(s.id) && s.id !== aktuell && !(s.id === 'fuerWen' && klasseFachOffen);
			const antwort = fertig ? s.antwort(a) : leereAntwort(s);
			return (
				<button
					key={s.id}
					type="button"
					disabled={!besucht.has(s.id)}
					aria-current={s.id === aktuell ? 'step' : undefined}
					data-schritt={s.id}
					className={klassen(
						'flex items-start gap-2 rounded-md px-2 py-1.5 text-left disabled:cursor-default',
						s.id === aktuell
							? 'bg-brand-50 font-semibold'
							: 'hover:bg-flaeche-2 disabled:hover:bg-transparent',
					)}
					onClick={() => gehe(s.id)}
				>
					<span
						className={klassen(
							'grid size-5 flex-none place-items-center rounded-full text-xs',
							punktFarbe(fertig, s.id === aktuell),
						)}
					>
						{fertig ? <Symbol name="haken" className="size-3" /> : i + 1}
					</span>
					{/* Zwei Zeilen immer, damit nichts rückt; gekürzt zeigt der Tooltip alles (190-17). */}
					<span className="min-w-0 flex-1">
						<span className="block">{s.name}</span>
						<small className="flex min-h-4 font-normal text-leise">
							<Gekuerzt text={antwort} className="block" />
						</small>
					</span>
				</button>
			);
		})}
	</nav>
);
