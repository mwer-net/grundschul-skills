import type { Antworten, AssistentSchrittId, FormatWahl, FreitextFeld, Teil, Weg } from '@schoolbox/kern/src/assistent';
import {
	ART_WAHL,
	AUFTRAG_ZEICHEN,
	auftragAus,
	auftragSaetze,
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
import { useRef } from 'react';

import { Chip } from '../bausteine/Chip';
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
			'relative flex w-full gap-2.5 rounded-lg border p-2.5 text-left transition-colors duration-[120ms] disabled:opacity-50',
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
	<input
		className={klassen(FELD, 'mt-2')}
		aria-label={FREITEXT[feld].name}
		placeholder={FREITEXT[feld].platz}
		maxLength={FREITEXT[feld].zeichen}
		value={wert}
		autoFocus={autoFokus}
		data-freitext={feld}
		onChange={(e) => setze(e.target.value)}
	/>
);

/** Woher Klasse und Fach vorbelegt sind, klein neben „Klasse“. */
const herkunftVon = (ordner: Ordnerangabe) => {
	switch (ordner.vorbelegt.quelle) {
		case 'behaelter':
			return `legt der Ordner „${ordner.name}“ fest`;
		case 'ordner':
			return `aus dem Ordner „${ordner.name}“ übernommen`;
		case 'zuletzt':
			return 'zuletzt benutzt';
		default:
			return undefined;
	}
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
	const herkunft = herkunftVon(ordner);
	return (
		<>
			<div className="mb-4">
				<Etikett zusatz={herkunft}>Klasse</Etikett>
				<Segment
					beschriftung="Klasse"
					aus={fest}
					werte={KLASSEN.map((k) => ({
						wert: String(k),
						titel: k === 'gemischt' ? 'jahrgangsgemischt' : String(k),
					}))}
					wert={String(a.klasse)}
					waehle={(k) => setze({ klasse: KLASSEN.find((x) => String(x) === k) ?? a.klasse })}
				/>
			</div>
			<div role="group" aria-label="Fach">
				<Etikett>Fach</Etikett>
				<div className="flex flex-wrap gap-1.5">
					{FAECHER.map((f) => (
						<Chip
							key={f}
							titel={FACH_NAME[f]}
							aktiv={f === a.fach}
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
	waehleEinheit,
	weiter,
}: {
	a: Antworten;
	offen: boolean;
	setze: (teil: Partial<Antworten>) => void;
	waehleArt: (art: Art) => void;
	waehleEinheit: () => void;
	weiter: () => void;
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
				gesperrt={a.weg !== 'claude'}
				className="mt-2"
				waehle={waehleEinheit}
				weiter={weiter}
			>
				<Symbol name="ordner" className="mt-0.5 size-4 flex-none text-leise" />
				<span className="min-w-0">
					<span className="block font-medium">Unterrichtseinheit</span>
					<span className="block text-sm text-leise">
						{a.weg === 'claude'
							? 'Ein Ordner mit mehreren Materialien zu einem Thema, gebaut in einem Lauf.'
							: 'Nur mit Claude.'}
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
	const spalten = Math.min(optionen.length + (frei ? 1 : 0), 4);
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
						<span className="block font-medium">{o.name}</span>
						{o.hinweis && <span className="block text-sm text-leise">{o.hinweis}</span>}
						{o.empfohlen && <Empfohlen />}
					</Wahl>
				))}
				{frei && (
					<Wahl
						id="anders"
						nr={optionen.length + 1}
						aktiv={offen}
						className="flex-col items-center justify-center text-center"
						waehle={() => setzeOffen(true)}
					>
						<span className="grid h-20 place-items-center">
							<Symbol name="stift" className="size-6 text-leise" />
						</span>
						<span className="block font-medium">{FREITEXT.formatText.name}</span>
						<span className="block text-sm text-leise">Claude darf das Format ändern</span>
					</Wahl>
				)}
			</div>
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
}: {
	a: Antworten;
	offen: boolean;
	setze: (teil: Partial<Antworten>) => void;
	setzeOffen: (offen: boolean) => void;
}) => {
	const ziel = useRef<HTMLInputElement>(null);
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
			</label>
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
				</label>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{ZIEL_ANFAENGE.map((anfang) => (
						<button
							key={anfang}
							type="button"
							className="inline-flex h-knopf-klein items-center rounded-md border border-dashed border-rand-feld px-2 text-sm text-leise hover:bg-flaeche-2"
							onClick={() => {
								setze({ ziel: anfang });
								ziel.current?.focus();
							}}
						>
							{`+ ${anfang.trim()} …`}
						</button>
					))}
				</div>
			</div>
			<div>
				<Etikett>Wofür in der Reihe?</Etikett>
				<SegmentMitAnders
					beschriftung="Funktion in der Reihe"
					feld="funktionText"
					werte={FUNKTIONEN.map((f) => ({ wert: f.wert, titel: f.name }))}
					wert={a.funktion ?? funktionEmpfehlung(a.art)}
					waehle={(f) => setze({ funktion: f, funktionText: '' })}
					offen={offen}
					setzeOffen={setzeOffen}
					text={a.funktionText}
					setzeText={(t) => setze({ funktionText: t })}
				/>
			</div>
		</>
	);
};

export const SchrittBausteine = ({
	a,
	offen,
	setze,
	setzeOffen,
}: {
	a: Antworten;
	offen: Partial<Record<FreitextFeld, boolean>>;
	setze: (teil: Partial<Antworten>) => void;
	setzeOffen: (feld: FreitextFeld, offen: boolean) => void;
}) => {
	const schalter = bausteinSchalter(a.einheit ? { ...a, art: 'arbeitsblatt' } : a);
	const umfang = a.einheit ? null : umfangEmpfehlung(a.art);
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
							{s.empfohlen && <Empfohlen />}
							<Schalter
								name={s.name}
								an={s.an}
								setze={(an) => setze({ bausteine: { ...a.bausteine, [s.wert]: an } })}
							/>
						</div>
					))}
				</div>
			)}
			{umfang !== null && (
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<span className="font-medium">Arbeitszeit je Kind</span>
					<div className="min-w-0 flex-1">
						<SegmentMitAnders
							beschriftung="Arbeitszeit je Kind"
							feld="umfangText"
							werte={UMFAENGE.map((u) => ({ wert: u.wert, titel: u.name }))}
							wert={a.umfang ?? umfang}
							waehle={(u) => setze({ umfang: u, umfangText: '' })}
							offen={offen.umfangText === true}
							setzeOffen={(o) => setzeOffen('umfangText', o)}
							text={a.umfangText}
							setzeText={(t) => setze({ umfangText: t })}
						/>
					</div>
				</div>
			)}
			{a.einheit && <p className="mt-2 text-sm text-leise">Gilt für alle Blätter der Einheit.</p>}
			<div className={klassen('mt-4', a.einheit && 'hidden')}>
				{offen.bausteineText ? (
					<FreiFeld
						feld="bausteineText"
						wert={a.bausteineText}
						autoFokus
						setze={(t) => setze({ bausteineText: t })}
					/>
				) : (
					<Knopf art="leise" data-anders="bausteineText" onClick={() => setzeOffen('bausteineText', true)}>
						<Symbol name="plus" />
						{FREITEXT.bausteineText.name}
					</Knopf>
				)}
			</div>
		</>
	);
};

export const SchrittKlasse = ({ a, setze }: { a: Antworten; setze: (teil: Partial<Antworten>) => void }) => (
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
		</label>
		<p className="mt-2 flex items-center gap-2 rounded-md bg-warnung-hell px-3 py-1.5 text-sm text-warnung">
			<Symbol name="info" />
			Keine Namen von Kindern eintragen.
		</p>
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

export const TitelFeld = ({
	setzeTitel,
	titel,
	vorschlag,
}: {
	titel: string;
	setzeTitel: (titel: string) => void;
	vorschlag: boolean;
}) => (
	<label className="block min-w-0 flex-1">
		<Etikett zusatz={vorschlag ? 'Vorschlag, änderbar' : undefined}>Titel</Etikett>
		<input
			className={FELD}
			maxLength={TITEL_ZEICHEN}
			value={titel}
			data-fokus
			onFocus={(e) => e.target.select()}
			onChange={(e) => setzeTitel(e.target.value)}
		/>
	</label>
);

const TeilText = ({ teil }: { teil: Teil }) => {
	if (teil.art === 'antwort') {
		return <b className="font-semibold">{teil.text}</b>;
	}
	if (teil.art === 'freitext') {
		return (
			<span className="rounded-sm bg-entwurf/40 px-0.5" data-freitext-teil>
				{`„${teil.text}“`}
			</span>
		);
	}
	return <>{teil.text}</>;
};

export interface AuftragText {
	wert: string;
	/** Der Text aus den Antworten, als die Lehrkraft zu schreiben begann. */
	basis: string;
}

export const SchrittPruefen = ({
	a,
	gesperrt,
	hinweis,
	ordner,
	pruefeLimit,
	setzeText,
	setzeTitel,
	text,
	titelVorschlagen,
}: {
	a: Antworten;
	ordner: Ordnerangabe;
	text: AuftragText | null;
	setzeText: (text: AuftragText | null) => void;
	setzeTitel: (titel: string) => void;
	titelVorschlagen: boolean;
	hinweis: ReturnType<typeof limitHinweis>;
	gesperrt: boolean;
	pruefeLimit: () => Promise<void>;
}) => {
	const ausAntworten = auftragAus(a);
	return (
		<>
			<div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3" data-auftrag>
				<div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-leise uppercase">
					<Symbol name="funken" className="size-3.5 text-brand-500" />
					Auftrag
					<span className="flex-1" />
					{text === null ? (
						<Knopf
							art="leise"
							groesse="klein"
							className="normal-case"
							onClick={() => setzeText({ wert: ausAntworten, basis: ausAntworten })}
						>
							<Symbol name="stift" />
							Als Text bearbeiten
						</Knopf>
					) : (
						<Knopf art="leise" groesse="klein" className="normal-case" onClick={() => setzeText(null)}>
							<Symbol name="zurueckholen" />
							Zurücksetzen
						</Knopf>
					)}
				</div>
				{text === null ? (
					<div className="flex flex-col gap-1.5">
						{auftragSaetze(a).map((satz, i) => (
							<p key={i}>
								{satz.map((t, j) => (
									<TeilText key={j} teil={t} />
								))}
							</p>
						))}
					</div>
				) : (
					<>
						<textarea
							className={klassen(FELD_KLASSEN, 'h-auto w-full py-1.5')}
							aria-label="Auftrag"
							rows={7}
							maxLength={AUFTRAG_ZEICHEN}
							value={text.wert}
							autoFocus
							onChange={(e) => setzeText({ ...text, wert: e.target.value })}
						/>
						{text.basis !== ausAntworten && (
							<p className="mt-1 text-sm text-warnung" data-auftrag-veraltet>
								Deine Antworten haben sich geändert. „Zurücksetzen“ baut den Text neu aus den Antworten.
							</p>
						)}
					</>
				)}
			</div>
			<div className="mt-3 flex items-end gap-3">
				<TitelFeld titel={a.titel} setzeTitel={setzeTitel} vorschlag={titelVorschlagen} />
				<OrdnerFeld name={ordner.name} />
			</div>
			<p className="mt-3 flex items-center gap-2 text-sm text-leise">
				<Symbol name="uhr" />
				Claude braucht einige Minuten und verbraucht deutlich mehr als eine Änderung.
			</p>
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
};

export const SchrittTitel = ({
	a,
	ordner,
	setze,
	setzeTitel,
}: {
	a: Antworten;
	ordner: Ordnerangabe;
	setze: (teil: Partial<Antworten>) => void;
	setzeTitel: (titel: string) => void;
}) => (
	<>
		<div className="mb-4 flex items-end gap-3">
			<TitelFeld titel={a.titel} setzeTitel={setzeTitel} vorschlag={false} />
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
}: {
	a: Antworten;
	aktuell: AssistentSchrittId;
	besucht: ReadonlySet<AssistentSchrittId>;
	gehe: (id: AssistentSchrittId) => void;
}) => (
	<nav aria-label="Schritte" className="flex flex-col gap-0.5 border-r border-rand pr-3 max-md:hidden">
		{schritteFuer(a).map((s, i) => {
			const fertig = besucht.has(s.id) && s.id !== aktuell;
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
					<span className="min-w-0">
						<span className="block">{s.name}</span>
						{antwort && <small className="block truncate font-normal text-leise">{antwort}</small>}
					</span>
				</button>
			);
		})}
	</nav>
);
