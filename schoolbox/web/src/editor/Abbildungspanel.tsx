import type {
	AuswahlFeld,
	BildFeld,
	Feld,
	ListeFeld,
	MarkierungFeld,
	MehrfachFeld,
	MischenFeld,
	MusterFeld,
	NotenFeld,
	Option,
	PlanFeld,
	PunkteFeld,
	RasterFeld,
	SchalterFeld,
	TextFeld,
	UhrzeitFeld,
	UnterFeld,
	ZahlenFeld,
	ZahlFeld,
	ZiffernFeld,
} from '@schoolbox/kern/src/abbildungen';
import {
	abschnittVon,
	alsZahl,
	feldWert,
	listeVon,
	markeSetzen,
	markeTrennen,
	markeVerbinden,
	markierungKlartext,
	markierungLesen,
	markierungNeuerText,
	markierungText,
	MINI_ARTEN,
	miniTeile,
	notenAnfuegen,
	notenMitTon,
	notenPunkt,
	notenTon,
	notenZuruecknehmen,
	planObjekteText,
	planObjekteVon,
	rasterText,
	rasterVon,
	stellenVon,
	zahlStandard,
	zeilenText,
	zeilenVon,
	ziffernText,
} from '@schoolbox/kern/src/abbildungen';
import type { AbschnittName } from '@schoolbox/kern/src/abschnitte';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { meldung, sende, sendeDatei } from '../api';
import { Hilfetipp } from '../bausteine/Hilfetipp';
import { Knopf } from '../bausteine/Knopf';
import { Schalter as Umschalter } from '../bausteine/Schalter';
import { Symbol } from '../bausteine/Symbol';
import { Zeile } from '../bausteine/Zeile';
import type { AbbildungSteuerung } from './abbildung';
import { leistenFelder } from './abbildung-felder';
import { bereiteVor } from './bild';
import { SammlungDialog } from './Bildpanel';
import { elementZu } from './darstellung';

const EINGABE =
	'h-feld rounded-md border border-rand-feld bg-flaeche px-1.5 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50 aria-invalid:border-fehler';

interface FeldEigenschaften<F extends Feld> {
	feld: F;
	abb: AbbildungSteuerung;
}

const wertVon = (feld: Feld, abb: AbbildungSteuerung) => (abb.werte ? feldWert(feld, abb.werte) : null);

const fertigMitEnter = (e: KeyboardEvent<HTMLInputElement>) => {
	if (e.key === 'Enter') {
		e.currentTarget.blur();
	}
};

/** Text einer Eingabe, der dem Wert folgt, außer während darin getippt wird (sonst sprängen Leerfelder zurück). */
const useEingabe = (wert: string) => {
	const [text, setText] = useState(wert);
	const feld = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (feld.current?.ownerDocument.activeElement !== feld.current) {
			setText(wert);
		}
	}, [wert]);

	return { text, setText, feld };
};

const Haken = ({
	aktiv,
	aus = false,
	name,
	setze,
}: {
	name: string;
	aktiv: boolean;
	aus?: boolean;
	setze: (an: boolean) => void;
}) => {
	const id = useId();
	return (
		<Zeile titel={name} fuer={id}>
			<Umschalter id={id} name={name} an={aktiv} aus={aus} setze={setze} />
		</Zeile>
	);
};

/** „Zeiger nur in der Lösung“ usw.: verschiebt den Wert zwischen sichtbarem und Lösungs-Attribut. */
const LoesungSchalter = ({ abb, feld }: FeldEigenschaften<Feld>) => {
	const w = wertVon(feld, abb);
	if (!feld.loesung || !w) {
		return null;
	}
	return (
		<Haken
			name={feld.loesung.name}
			aktiv={w.nurLoesung}
			aus={w.wert === null}
			setze={(an) => abb.aendere(feld, w.wert, { nurLoesung: an })}
		/>
	);
};

const Rahmen = ({
	abb,
	children,
	daneben = false,
	feld,
	id,
}: {
	feld: Feld;
	abb: AbbildungSteuerung;
	id: string;
	/** Kurze Werte stehen rechts neben dem Namen; Listen und Raster brauchen die ganze Breite. */
	daneben?: boolean;
	children: ReactNode;
}) => {
	const fehler = abb.fehler[feld.attribut];
	return (
		<div data-feld={feld.attribut}>
			{daneben ? (
				<Zeile titel={feld.name} fuer={id} hilfe={feld.hilfe}>
					{children}
				</Zeile>
			) : (
				<>
					<span className="flex h-zeile items-center gap-1 text-leise">
						<label htmlFor={id}>{feld.name}</label>
						{feld.hilfe && <Hilfetipp name={feld.name}>{feld.hilfe}</Hilfetipp>}
					</span>
					<div>{children}</div>
				</>
			)}
			{feld.loesung && <LoesungSchalter feld={feld} abb={abb} />}
			{fehler && (
				<p className="mt-2 flex gap-2 font-medium text-fehler" role="alert" data-fehler={feld.attribut}>
					<Symbol name="achtung" className="size-3.5 flex-none" />
					{fehler}
				</p>
			)}
		</div>
	);
};

const Zahl = ({ abb, feld }: FeldEigenschaften<ZahlFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const standard = zahlStandard(feld, abb.werte);
	const { feld: eingabe, setText, text } = useEingabe(wert ?? String(standard));
	const jetzt = alsZahl(wert ?? String(standard));
	const schritt = feld.schritt ?? 1;
	const springe = (richtung: 1 | -1) => {
		const basis = Number.isFinite(jetzt) ? jetzt : standard;
		const neu = Math.min(
			feld.max,
			Math.max(feld.min, Math.round((basis + richtung * schritt) / schritt) * schritt),
		);
		setText(String(neu));
		abb.aendere(feld, String(neu));
	};
	return (
		<Rahmen daneben feld={feld} abb={abb} id={id}>
			<div className="flex items-center gap-1">
				<Knopf
					art="zweit"
					groesse="klein"
					className="size-knopf-klein flex-none px-0"
					aria-label={`${feld.name}: weniger`}
					disabled={Number.isFinite(jetzt) && jetzt <= feld.min}
					onClick={() => springe(-1)}
				>
					<Symbol name="minus" />
				</Knopf>
				<input
					ref={eingabe}
					id={id}
					type="text"
					inputMode="numeric"
					enterKeyHint="done"
					autoComplete="off"
					className={`${EINGABE} w-11 text-center tabular-nums`}
					aria-invalid={Boolean(abb.fehler[feld.attribut])}
					value={text}
					onChange={(e) => {
						setText(e.target.value);
						const roh = e.target.value.trim();
						abb.aendere(feld, roh === '' ? null : roh, { uebernehmen: false });
					}}
					onBlur={() => {
						setText(wert ?? String(standard));
						abb.uebernimm();
					}}
					onKeyDown={fertigMitEnter}
				/>
				<Knopf
					art="zweit"
					groesse="klein"
					className="size-knopf-klein flex-none px-0"
					aria-label={`${feld.name}: mehr`}
					disabled={Number.isFinite(jetzt) && jetzt >= feld.max}
					onClick={() => springe(1)}
				>
					<Symbol name="plus" />
				</Knopf>
				{feld.einheit && <span className="text-leise">{feld.einheit}</span>}
			</div>
		</Rahmen>
	);
};

const STUNDEN = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTEN = Array.from({ length: 12 }, (_, i) => i * 5);

const zweistellig = (n: number) => String(n).padStart(2, '0');

const uhrzeitVon = ({ abb, feld }: FeldEigenschaften<UhrzeitFeld>) => {
	const wert = wertVon(feld, abb)?.wert ?? null;
	const teile = /^(\d{1,2}):(\d{2})$/.exec(wert ?? '');
	const stunde = teile ? Number(teile[1]) : null;
	const minute = teile ? Number(teile[2]) : null;
	return {
		stunde,
		minute,
		stunden: stunde === null || STUNDEN.includes(stunde) ? STUNDEN : [stunde, ...STUNDEN],
		minuten: minute === null || MINUTEN.includes(minute) ? MINUTEN : [...MINUTEN, minute].sort((a, b) => a - b),
		setze: (h: number | null, m: number | null) =>
			abb.aendere(feld, h === null ? null : `${h}:${zweistellig(m ?? 0)}`),
	};
};

/** Stunde und Minute (in 5er-Schritten) als Auswahl; Werte aus der Quelle außerhalb davon bleiben wählbar. */
const Uhrzeit = ({ abb, feld }: FeldEigenschaften<UhrzeitFeld>) => {
	const id = useId();
	const { minute, minuten, setze, stunde, stunden } = uhrzeitVon({ abb, feld });
	return (
		<Rahmen daneben feld={feld} abb={abb} id={id}>
			<div className="flex items-center gap-1" data-uhrzeit>
				<select
					id={id}
					aria-label="Stunde"
					className={EINGABE}
					aria-invalid={Boolean(abb.fehler[feld.attribut])}
					value={stunde ?? ''}
					onChange={(e) => setze(e.target.value === '' ? null : Number(e.target.value), minute)}
				>
					<option value="">–</option>
					{stunden.map((h) => (
						<option key={h} value={h}>
							{h}
						</option>
					))}
				</select>
				<span className="text-leise">:</span>
				<select
					aria-label="Minuten"
					className={EINGABE}
					disabled={stunde === null}
					value={minute ?? ''}
					onChange={(e) => setze(stunde, Number(e.target.value))}
				>
					{minute === null && <option value="">–</option>}
					{minuten.map((m) => (
						<option key={m} value={m}>
							{zweistellig(m)}
						</option>
					))}
				</select>
			</div>
		</Rahmen>
	);
};

const Auswahl = ({ abb, feld }: FeldEigenschaften<AuswahlFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? feld.standard ?? null;
	const aus = feld.optionenAus && abb.werte ? (abb.werte[feld.optionenAus] ?? '') : '';
	const dazu = aus.split('|').flatMap((t) => (t.trim() ? [{ wert: t.trim(), name: t.trim() }] : []));
	const moeglich = [...feld.optionen, ...dazu];
	const bekannt = moeglich.some((o) => o.wert === wert);
	const optionen = bekannt ? moeglich : [...moeglich, { wert, name: wert ?? '–' }];
	const index = optionen.findIndex((o) => o.wert === wert);
	const blaettere = (schritt: number) => abb.aendere(feld, optionen[index + schritt]?.wert ?? null);
	return (
		<Rahmen daneben={!feld.vorschau && !feld.blaettern} feld={feld} abb={abb} id={id}>
			<select
				id={id}
				className={`${EINGABE} ${feld.vorschau || feld.blaettern ? 'w-full' : 'w-auto max-w-32'}`}
				aria-invalid={Boolean(abb.fehler[feld.attribut])}
				value={index}
				onChange={(e) => abb.aendere(feld, optionen[Number(e.target.value)]?.wert ?? null)}
			>
				{optionen.map((o, i) => (
					<option key={o.wert ?? ''} value={i}>
						{o.name}
					</option>
				))}
			</select>
			{feld.vorschau && wert !== null && (
				<img
					className="mt-2 h-16 w-auto"
					alt=""
					data-vorschau={wert}
					src={`${abb.bildBasis}${feld.vorschau.replace('{wert}', encodeURIComponent(wert))}`}
				/>
			)}
			{feld.blaettern && (
				<div className="mt-2 flex gap-2">
					<Knopf
						art="zweit"
						className="flex-1"
						aria-label={`${feld.name}: zurück`}
						disabled={index <= 0}
						onClick={() => blaettere(-1)}
					>
						Zurück
					</Knopf>
					<Knopf
						art="zweit"
						className="flex-1"
						aria-label={`${feld.name}: vor`}
						disabled={index >= optionen.length - 1}
						onClick={() => blaettere(1)}
					>
						Vor
					</Knopf>
				</div>
			)}
		</Rahmen>
	);
};

/** Was dem Standard entspricht, steht nicht in der Quelle. */
const schalterWert = (feld: SchalterFeld, an: boolean) => {
	if (an === feld.standard) {
		return null;
	}
	return an ? feld.an : feld.aus;
};

const Schalter = ({ abb, feld }: FeldEigenschaften<SchalterFeld>) => {
	const wert = wertVon(feld, abb)?.wert ?? null;
	const an = wert === null ? feld.standard : wert === feld.an;
	return (
		<div data-feld={feld.attribut}>
			<Haken name={feld.name} aktiv={an} setze={(neu) => abb.aendere(feld, schalterWert(feld, neu))} />
		</div>
	);
};

const Zahlen = ({ abb, feld }: FeldEigenschaften<ZahlenFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const { feld: eingabe, setText, text } = useEingabe(wert ?? '');
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<input
				ref={eingabe}
				id={id}
				type="text"
				inputMode="decimal"
				enterKeyHint="done"
				autoComplete="off"
				className={`${EINGABE} w-full`}
				placeholder={`z. B. ${feld.beispiel}`}
				aria-invalid={Boolean(abb.fehler[feld.attribut])}
				value={text}
				onChange={(e) => {
					setText(e.target.value);
					abb.aendere(feld, e.target.value.trim() === '' ? null : e.target.value, { uebernehmen: false });
				}}
				onBlur={() => {
					const sauber = listeVon(text).join(' ');
					setText(sauber);
					abb.aendere(feld, sauber === '' ? null : sauber);
				}}
				onKeyDown={fertigMitEnter}
			/>
		</Rahmen>
	);
};

/** Je Stelle eine Zahl; leere Stellen rechts bleiben leer. */
const Ziffern = ({ abb, feld }: FeldEigenschaften<ZiffernFeld>) => {
	const id = useId();
	if (!abb.werte) {
		return null;
	}
	const stellen = stellenVon(abb.werte, feld.stellen);
	const liste = listeVon(feldWert(feld, abb.werte).wert);
	const zellen = stellen.map((_, i) => (liste[i] === '?' ? '' : (liste[i] ?? '')));
	const setze = (i: number, ziffer: string, uebernehmen: boolean) => {
		const neu = zellen.map((z, j) => (j === i ? ziffer.trim() : z));
		abb.aendere(feld, ziffernText(neu), { uebernehmen });
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="flex flex-wrap gap-2" data-ziffern>
				{stellen.map((stelle, i) => (
					<label key={`${stelle}-${String(i)}`} className="flex flex-col items-center gap-1">
						<span className="font-medium text-leise">{stelle}</span>
						<input
							id={i === 0 ? id : undefined}
							type="text"
							inputMode="numeric"
							enterKeyHint="done"
							autoComplete="off"
							maxLength={2}
							aria-label={`${feld.name}: ${stelle}`}
							className={`${EINGABE} w-14 px-0 text-center text-lg font-medium`}
							aria-invalid={Boolean(abb.fehler[feld.attribut])}
							value={zellen[i] ?? ''}
							onChange={(e) => setze(i, e.target.value, false)}
							onBlur={() => abb.uebernimm()}
							onKeyDown={fertigMitEnter}
						/>
					</label>
				))}
			</div>
		</Rahmen>
	);
};

const Text = ({ abb, feld }: FeldEigenschaften<TextFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const [text, setText] = useState(wert ?? '');
	const eingabe = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

	useEffect(() => {
		if (eingabe.current?.ownerDocument.activeElement !== eingabe.current) {
			setText(wert ?? '');
		}
	}, [wert]);

	const vorschau = (neu: string) => {
		setText(neu);
		abb.aendere(feld, neu === '' ? null : neu, { uebernehmen: false });
	};
	const gemeinsam = {
		id,
		'autoComplete': 'off',
		'className': `${EINGABE} w-full`,
		'aria-invalid': Boolean(abb.fehler[feld.attribut]),
		'placeholder': feld.beispiel && `z. B. ${feld.beispiel}`,
		'value': text,
		'onBlur': () => abb.aendere(feld, text.trim() === '' ? null : text.trim()),
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			{feld.zeilen && feld.zeilen > 1 ? (
				<textarea
					{...gemeinsam}
					ref={eingabe}
					rows={feld.zeilen}
					className={`${gemeinsam.className} py-2`}
					onChange={(e) => vorschau(e.target.value)}
				/>
			) : (
				<input
					{...gemeinsam}
					ref={eingabe}
					type="text"
					enterKeyHint="done"
					onChange={(e) => vorschau(e.target.value)}
					onKeyDown={fertigMitEnter}
				/>
			)}
			{feld.einfuegen && (
				<Knopf
					art="zweit"
					className="mt-2"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => {
						const stelle = eingabe.current?.selectionStart ?? text.length;
						const ende = feld.einfuegen?.bis ? (eingabe.current?.selectionEnd ?? stelle) : stelle;
						const neu = `${text.slice(0, stelle)}${feld.einfuegen?.zeichen ?? ''}${text.slice(stelle, ende)}${feld.einfuegen?.bis ?? ''}${text.slice(ende)}`;
						vorschau(neu);
						eingabe.current?.focus();
					}}
				>
					{feld.einfuegen.name}
				</Knopf>
			)}
		</Rahmen>
	);
};

/** Füllung als kleines Feld: im s/w-Blatt das Muster, im Farbblatt die Farbe. */
const MUSTER_BILD: Record<string, string> = {
	rot: 'repeating-linear-gradient(135deg,#1d1d1b 0 1.5px,#fff 1.5px 7px)',
	blau: 'radial-gradient(#1d1d1b 1.5px,#fff 2px) 0 0/8px 8px',
	gruen: 'linear-gradient(#1d1d1b 1px,transparent 1px) 0 0/8px 8px,linear-gradient(90deg,#1d1d1b 1px,#fff 1px) 0 0/8px 8px',
	gelb: 'repeating-linear-gradient(0deg,#1d1d1b 0 2px,#fff 2px 8px)',
	orange: 'repeating-linear-gradient(135deg,#1d1d1b 0 1.5px,#fff 1.5px 4px)',
	lila: 'repeating-linear-gradient(135deg,#1d1d1b 0 1px,transparent 1px 8px),repeating-linear-gradient(45deg,#1d1d1b 0 1px,#fff 1px 8px)',
	grau: '#808080',
	leer: '#fff',
};
const FARB_BILD: Record<string, string> = {
	rot: '#D8392B',
	blau: '#2F6FD6',
	gruen: '#2E9E4F',
	gelb: '#FFD23F',
	orange: '#F28C28',
	lila: '#7B4FA3',
	grau: '#9A9A9A',
	leer: '#fff',
};

const Muster = ({
	aktiv,
	name,
	optionen,
	setze,
	sw,
}: {
	optionen: Option[];
	aktiv: string | null;
	name: string;
	sw: boolean;
	setze: (wert: string) => void;
}) => (
	<div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name} data-muster-wahl>
		{optionen.map((o) => (
			<button
				key={o.wert}
				type="button"
				role="radio"
				aria-checked={aktiv === o.wert}
				aria-label={o.name}
				title={o.name}
				data-muster={o.wert}
				className={`size-11 rounded-xl border ${aktiv === o.wert ? 'border-brand-500 ring-2 ring-brand-500' : 'border-rand'}`}
				style={{ background: (sw ? MUSTER_BILD : FARB_BILD)[o.wert] ?? '#fff' }}
				onClick={() => setze(o.wert)}
			/>
		))}
	</div>
);

const MusterEingabe = ({ abb, feld }: FeldEigenschaften<MusterFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? feld.standard ?? null;
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<Muster
				optionen={feld.optionen}
				aktiv={wert}
				name={feld.name}
				sw={abb.sw}
				setze={(w) => abb.aendere(feld, w)}
			/>
		</Rahmen>
	);
};

const Mehrfach = ({ abb, feld }: FeldEigenschaften<MehrfachFeld>) => {
	const id = useId();
	const roh = wertVon(feld, abb)?.wert ?? null;
	const gewaehlt = listeVon(roh ?? feld.standard?.join(' ') ?? null);
	const je = feld.optionenJe;
	const optionen = je ? (je.werte[abb.werte?.[je.feld] ?? Object.keys(je.werte)[0] ?? ''] ?? []) : feld.optionen;
	const setze = (wert: string, an: boolean) => {
		const neu = optionen.map((o) => o.wert).filter((w) => (w === wert ? an : gewaehlt.includes(w)));
		const gleich = feld.standard && neu.join(' ') === feld.standard.join(' ');
		abb.aendere(feld, gleich || (neu.length === 0 && !feld.standard) ? null : neu.join(' '));
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div data-mehrfach>
				{optionen.map((o) => (
					<Haken
						key={o.wert}
						name={o.name}
						aktiv={gewaehlt.includes(o.wert)}
						setze={(an) => setze(o.wert, an)}
					/>
				))}
			</div>
		</Rahmen>
	);
};

const Mischen = ({ abb, feld }: FeldEigenschaften<MischenFeld>) => (
	<div className="mt-5" data-feld={feld.attribut}>
		<Knopf
			art="zweit"
			onClick={() => abb.aendere(feld, String(Math.floor(Math.random() * 1_000_000) + 1))}
			data-mischen={feld.attribut}
		>
			<Symbol name="neueZahlen" />
			{feld.knopf ?? 'Neu mischen'}
		</Knopf>
		{feld.hilfe && <p className="mt-1 text-leise">{feld.hilfe}</p>}
	</div>
);

/** Bild einer Listenzeile: aus der Sammlung oder hochgeladen; gespeichert wird nur der Pfad. */
const BildWahl = ({
	abb,
	aendere,
	name,
	wert,
}: {
	abb: AbbildungSteuerung;
	aendere: (neu: string, sofort: boolean) => void;
	name: string;
	wert: string;
}) => {
	const [sammlung, setSammlung] = useState(false);
	const [fehler, setFehler] = useState<string | null>(null);
	const datei = useRef<HTMLInputElement>(null);
	const arbeite = (schritt: () => Promise<{ src: string }>) => {
		setFehler(null);
		schritt().then(
			({ src }) => aendere(src, true),
			(e: unknown) => setFehler(meldung(e)),
		);
	};
	const lade = async (d: File) => {
		const { daten, name: dateiname } = await bereiteVor(d);
		return sendeDatei<{ src: string }>(`${abb.adresse}/bilder`, daten, dateiname);
	};
	return (
		<div className="flex flex-wrap items-center gap-2" role="group" aria-label={name}>
			{wert && <img className="h-12 w-12 flex-none object-contain" alt="" src={`${abb.bildBasis}${wert}`} />}
			<Knopf art="zweit" className="flex-1" onClick={() => setSammlung(true)}>
				Aus der Sammlung
			</Knopf>
			<Knopf art="zweit" className="flex-1" onClick={() => datei.current?.click()}>
				Hochladen
			</Knopf>
			{wert && (
				<Knopf art="zweit" className="flex-1" onClick={() => aendere('', true)}>
					Bild entfernen
				</Knopf>
			)}
			<input
				ref={datei}
				type="file"
				accept="image/*"
				className="hidden"
				aria-label={`${name} hochladen`}
				onChange={(e) => {
					const d = e.target.files?.[0];
					e.target.value = '';
					if (d) {
						arbeite(() => lade(d));
					}
				}}
			/>
			{fehler && (
				<p className="w-full text-fehler" role="alert">
					{fehler}
				</p>
			)}
			{sammlung && (
				<SammlungDialog
					adresse={abb.adresse}
					schliessen={() => setSammlung(false)}
					waehle={(eintrag) => {
						setSammlung(false);
						arbeite(() =>
							sende<{ src: string }>(`${abb.adresse}/bilder/uebernehmen`, {
								schluessel: eintrag.schluessel,
							}),
						);
					}}
				/>
			)}
		</div>
	);
};

const MINI_BEISPIEL: Record<string, string> = {
	uhr: '7:30',
	wuerfel: '5',
	menge: '7',
	geld: '2€ 50ct',
	rhythmus: '4 8 8 4',
};

/** Ein Feldinhalt: Art wählen, dazu die passende Eingabe. Im Attribut steht `uhr:7:30`, Text ohne Vorsatz. */
const MiniEingabe = ({
	abb,
	aendere,
	name,
	uebernimm,
	wert,
}: {
	wert: string;
	name: string;
	abb: AbbildungSteuerung;
	aendere: (neu: string, sofort: boolean) => void;
	uebernimm: () => void;
}) => {
	const { art, inhalt } = miniTeile(wert);
	const mitArt = (neu: string, neuInhalt: string) => (neu ? `${neu}:${neuInhalt}` : neuInhalt);
	return (
		<div className="flex flex-col gap-2">
			<select
				aria-label={`Art: ${name}`}
				className={`${EINGABE} w-full`}
				value={art}
				onChange={(e) => {
					const neu = e.target.value;
					aendere(mitArt(neu, neu === art ? inhalt : (MINI_BEISPIEL[neu] ?? '')), true);
				}}
			>
				{MINI_ARTEN.map((o) => (
					<option key={o.wert} value={o.wert}>
						{o.name}
					</option>
				))}
			</select>
			{art === 'bild' ? (
				<BildWahl
					abb={abb}
					aendere={(w, sofort) => aendere(mitArt(art, w), sofort)}
					name={name}
					wert={inhalt}
				/>
			) : (
				<input
					type="text"
					aria-label={name}
					placeholder={MINI_BEISPIEL[art] ?? name}
					enterKeyHint="done"
					autoComplete="off"
					className={`${EINGABE} w-full min-w-0`}
					value={inhalt}
					onChange={(e) => aendere(mitArt(art, e.target.value), false)}
					onBlur={uebernimm}
					onKeyDown={fertigMitEnter}
				/>
			)}
		</div>
	);
};

const UnterEingabe = ({
	abb,
	aendere,
	name,
	u,
	uebernimm,
	wert,
}: {
	u: UnterFeld;
	wert: string;
	name: string;
	abb: AbbildungSteuerung;
	aendere: (neu: string, sofort: boolean) => void;
	uebernimm: () => void;
}) => {
	if (u.art === 'auswahl') {
		return (
			<select
				aria-label={name}
				className={`${EINGABE} w-full`}
				value={wert}
				onChange={(e) => aendere(e.target.value, true)}
			>
				{!u.optionen?.some((o) => o.wert === wert) && <option value={wert}>{wert || '–'}</option>}
				{u.optionen?.map((o) => (
					<option key={o.wert} value={o.wert}>
						{o.name}
					</option>
				))}
			</select>
		);
	}
	if (u.art === 'bild') {
		return <BildWahl abb={abb} aendere={aendere} name={name} wert={wert} />;
	}
	if (u.art === 'mini') {
		return <MiniEingabe abb={abb} aendere={aendere} name={name} uebernimm={uebernimm} wert={wert} />;
	}
	if (u.art === 'muster') {
		return (
			<Muster optionen={u.optionen ?? []} aktiv={wert} name={name} sw={abb.sw} setze={(w) => aendere(w, true)} />
		);
	}
	if (u.art === 'schalter') {
		return (
			<Haken
				name={u.name}
				aktiv={wert === (u.an ?? 'ja')}
				setze={(an) => aendere(an ? (u.an ?? 'ja') : '', true)}
			/>
		);
	}
	return (
		<input
			type="text"
			aria-label={name}
			placeholder={u.name}
			inputMode={u.art === 'zahl' ? 'decimal' : undefined}
			enterKeyHint="done"
			autoComplete="off"
			className={`${EINGABE} w-full min-w-0`}
			value={wert}
			onChange={(e) => aendere(e.target.value, false)}
			onBlur={uebernimm}
			onKeyDown={fertigMitEnter}
		/>
	);
};

const Liste = ({ abb, feld }: FeldEigenschaften<ListeFeld>) => {
	const id = useId();
	const zeilen = zeilenVon(feld, wertVon(feld, abb)?.wert ?? null);
	const schreibe = (neu: string[][], sofort = true) =>
		abb.aendere(feld, zeilenText(feld, neu), { uebernehmen: sofort });
	const mitZelle = (i: number, j: number, wert: string) =>
		zeilen.map((z, n) => (n === i ? feld.unter.map((_, m) => (m === j ? wert : (z[m] ?? ''))) : z));
	const tausche = (i: number, j: number) => {
		const neu = [...zeilen];
		const [a, b] = [neu[i], neu[j]];
		if (a && b) {
			neu[i] = b;
			neu[j] = a;
			schreibe(neu);
		}
	};
	const voll = feld.max !== undefined && zeilen.length >= feld.max;
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="flex flex-col gap-3" data-liste={feld.attribut}>
				{zeilen.map((zeile, i) => (
					// Zeilen tragen keine eigene Kennung; beim Verschieben folgen die Werte dem Entwurf.
					<div key={String(i)} className="rounded-xl border border-rand p-2" data-zeile={i}>
						<div className="flex flex-wrap gap-2">
							{feld.unter.map((u, j) => (
								<div key={u.name} className={u.art === 'zahl' ? 'w-20 flex-none' : 'min-w-28 flex-1'}>
									<UnterEingabe
										u={u}
										abb={abb}
										name={`${u.name} in Zeile ${i + 1}`}
										wert={zeile[j] ?? ''}
										aendere={(w, sofort) => schreibe(mitZelle(i, j, w), sofort)}
										uebernimm={abb.uebernimm}
									/>
								</div>
							))}
						</div>
						<div className="mt-2 flex gap-2">
							<Knopf
								art="zweit"
								className="w-12 flex-none px-0"
								aria-label={`Zeile ${i + 1} nach oben`}
								disabled={i === 0}
								onClick={() => tausche(i, i - 1)}
							>
								↑
							</Knopf>
							<Knopf
								art="zweit"
								className="w-12 flex-none px-0"
								aria-label={`Zeile ${i + 1} nach unten`}
								disabled={i === zeilen.length - 1}
								onClick={() => tausche(i, i + 1)}
							>
								↓
							</Knopf>
							<Knopf
								art="zweit"
								className="w-12 flex-none px-0"
								aria-label={`Zeile ${i + 1} löschen`}
								disabled={feld.min !== undefined && zeilen.length <= feld.min}
								onClick={() => schreibe(zeilen.filter((_, n) => n !== i))}
							>
								<Symbol name="minus" />
							</Knopf>
						</div>
					</div>
				))}
			</div>
			<Knopf
				art="zweit"
				className="mt-3"
				disabled={voll}
				onClick={() => schreibe([...zeilen, feld.unter.map((u) => u.standard ?? '')])}
				data-zeile-neu={feld.attribut}
			>
				<Symbol name="plus" />
				Zeile hinzufügen
			</Knopf>
		</Rahmen>
	);
};

const ZELLE =
	'flex h-knopf min-w-11 items-center justify-center rounded-md border border-rand bg-flaeche text-base font-medium';

const rasterMass = (angabe: string | number | undefined, abb: AbbildungSteuerung, sonst: number) => {
	if (typeof angabe === 'number') {
		return angabe;
	}
	const roh = angabe ? abb.werte?.[angabe] : null;
	const n = roh ? alsZahl(roh) : NaN;
	if (Number.isFinite(n)) {
		return n;
	}
	const feld = abb.schema?.felder.find((f) => f.attribut === angabe);
	return feld?.art === 'zahl' ? feld.standard : sonst;
};

/** Zelle in der Gestalt des Elements: Antippen nimmt sie in die Liste auf oder heraus. */
const FormRaster = ({ abb, feld }: FeldEigenschaften<RasterFeld>) => {
	const wert = wertVon(feld, abb)?.wert ?? null;
	const zellen = abb.zellen[feld.attribut] ?? [];
	const gewaehlt = wert === null ? zellen.filter((z) => z.an).map((z) => z.id) : listeVon(wert);
	const setze = (zelle: string) => {
		const neu = gewaehlt.includes(zelle) ? gewaehlt.filter((g) => g !== zelle) : [...gewaehlt, zelle];
		abb.aendere(feld, neu.length === 0 ? null : neu.join(' '));
	};
	const breite = Math.max(1, ...zellen.map((z) => z.x + (z.b ?? 1)));
	const hoehe = Math.max(1, ...zellen.map((z) => z.y + (z.h ?? 1)));
	return (
		<div
			className="relative w-full overflow-x-auto"
			style={{ height: `${hoehe * 46}px`, minWidth: `${Math.min(breite * 46, 280)}px` }}
			data-form-raster={feld.attribut}
		>
			{zellen.map((z) => (
				<button
					key={z.id}
					type="button"
					aria-pressed={gewaehlt.includes(z.id)}
					aria-label={`Feld ${z.text ?? z.id}`}
					data-zelle={z.id}
					className={`${ZELLE} absolute ${gewaehlt.includes(z.id) ? 'border-brand-500 bg-brand-500 text-white' : 'text-leise'}`}
					style={{
						left: `${z.x * 46}px`,
						top: `${z.y * 46}px`,
						width: `${(z.b ?? 1) * 46 - 2}px`,
						height: `${(z.h ?? 1) * 46 - 2}px`,
					}}
					onClick={() => setze(z.id)}
				>
					{z.text}
				</button>
			))}
		</div>
	);
};

/** Gitter im Panel: Antippen schaltet die Zustände durch; mit `zahlen` nimmt die Zelle eine Zahl auf. */
const GitterRaster = ({ abb, feld }: FeldEigenschaften<RasterFeld>) => {
	const wert = wertVon(feld, abb)?.wert ?? null;
	const gelesen = rasterVon(wert);
	const spalten = feld.wachsen
		? Math.max(1, ...gelesen.map((z) => z.length))
		: rasterMass(feld.spalten, abb, gelesen[0]?.length ?? 1);
	const zeilen = feld.wachsen ? Math.max(1, gelesen.length) : rasterMass(feld.zeilen, abb, gelesen.length || 1);
	const zustaende = feld.zustaende ?? [
		{ wert: '0', name: 'leer', zeichen: '' },
		{ wert: '1', name: 'voll', zeichen: '■' },
	];
	const leer = feld.zahlen ? String(feld.zahlen.min) : (zustaende[0]?.wert ?? '0');
	const voll = Array.from({ length: zeilen }, (_, r) =>
		Array.from({ length: spalten }, (__, c) => gelesen[r]?.[c] ?? leer),
	);
	const schreibe = (neu: string[][], sofort = true) => {
		const allesLeer = neu.flat().every((z) => z === leer);
		abb.aendere(feld, allesLeer && !feld.wachsen ? null : rasterText(neu), { uebernehmen: sofort });
	};
	const setze = (r: number, c: number, zelle: string, sofort = true) =>
		schreibe(
			voll.map((z, i) => (i === r ? z.map((x, j) => (j === c ? zelle : x)) : z)),
			sofort,
		);
	const naechster = (zelle: string) => {
		const i = zustaende.findIndex((z) => z.wert === zelle);
		return zustaende[(i + 1) % zustaende.length]?.wert ?? leer;
	};
	return (
		<>
			<div className="max-w-full overflow-x-auto" data-raster={feld.attribut}>
				<div
					className="grid w-fit gap-0.5"
					style={{ gridTemplateColumns: `repeat(${spalten}, minmax(44px, 44px))` }}
				>
					{voll.map((zeile, r) =>
						zeile.map((zelle, c) =>
							feld.zahlen ? (
								<input
									key={`${String(r)}-${String(c)}`}
									type="text"
									inputMode="numeric"
									enterKeyHint="done"
									autoComplete="off"
									aria-label={`Zeile ${r + 1}, Spalte ${c + 1}`}
									data-zelle={`${r}-${c}`}
									className={`${ZELLE} w-11 text-center focus:border-brand-500 focus:outline-none`}
									value={zelle}
									onChange={(e) => setze(r, c, e.target.value.trim() || leer, false)}
									onBlur={abb.uebernimm}
									onKeyDown={fertigMitEnter}
								/>
							) : (
								<button
									key={`${String(r)}-${String(c)}`}
									type="button"
									aria-label={`Zeile ${r + 1}, Spalte ${c + 1}: ${zustaende.find((z) => z.wert === zelle)?.name ?? zelle}`}
									data-zelle={`${r}-${c}`}
									data-wert={zelle}
									className={`${ZELLE} ${zelle === leer ? '' : 'border-brand-500 bg-brand-500 text-white'}`}
									onClick={() => setze(r, c, naechster(zelle))}
								>
									{zustaende.find((z) => z.wert === zelle)?.zeichen ?? zelle}
								</button>
							),
						),
					)}
				</div>
			</div>
			{feld.wachsen && (
				<div className="mt-2 grid grid-cols-2 gap-2">
					<Knopf
						art="zweit"
						disabled={zeilen >= feld.wachsen.zeilen}
						onClick={() => schreibe([...voll, voll[0]?.map(() => leer) ?? [leer]])}
					>
						Zeile +
					</Knopf>
					<Knopf art="zweit" disabled={zeilen <= 1} onClick={() => schreibe(voll.slice(0, -1))}>
						Zeile −
					</Knopf>
					<Knopf
						art="zweit"
						disabled={spalten >= feld.wachsen.spalten}
						onClick={() => schreibe(voll.map((z) => [...z, leer]))}
					>
						Spalte +
					</Knopf>
					<Knopf
						art="zweit"
						disabled={spalten <= 1}
						onClick={() => schreibe(voll.map((z) => z.slice(0, -1)))}
					>
						Spalte −
					</Knopf>
				</div>
			)}
		</>
	);
};

const Raster = ({ abb, feld }: FeldEigenschaften<RasterFeld>) => {
	const id = useId();
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			{feld.form ? <FormRaster feld={feld} abb={abb} /> : <GitterRaster feld={feld} abb={abb} />}
		</Rahmen>
	);
};

/** Satz als Wort-Chips. Getippt wird gegen den Stand beim Betreten, damit ein halbes Wort keine Markierung verliert. */
const Markierung = ({ abb, feld }: FeldEigenschaften<MarkierungFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? '';
	const satz = markierungLesen(wert, feld.gruppen);
	const klartext = markierungKlartext(satz);
	const [text, setText] = useState(klartext);
	const [gewaehlt, setGewaehlt] = useState<number | null>(null);
	const eingabe = useRef<HTMLTextAreaElement>(null);
	const basis = useRef(satz);

	useEffect(() => {
		if (eingabe.current?.ownerDocument.activeElement !== eingabe.current) {
			setText(klartext);
		}
	}, [klartext]);

	const schreibe = (neu: typeof satz, uebernehmen = true) => {
		const quelle = markierungText(neu, feld.gruppen);
		abb.aendere(feld, quelle.trim() === '' ? null : quelle, uebernehmen ? undefined : { uebernehmen: false });
	};
	const wort = gewaehlt === null ? undefined : satz.woerter[gewaehlt];
	const umschalten = (i: number) =>
		schreibe(
			satz.woerter[i]?.gruppe === satz.woerter[i + 1]?.gruppe ? markeTrennen(satz, i) : markeVerbinden(satz, i),
		);
	const naechstes = gewaehlt === null ? undefined : satz.woerter[gewaehlt + 1];
	const verbunden = Boolean(wort && naechstes && wort.gruppe === naechstes.gruppe);
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="flex flex-wrap gap-1" data-markierung>
				{satz.woerter.map((w, i) => {
					const schluss = satz.woerter[i + 1]?.gruppe !== w.gruppe;
					const anfang = satz.woerter[i - 1]?.gruppe !== w.gruppe;
					const name = feld.optionen.find((o) => o.wert === w.marke)?.name;
					return (
						<button
							key={`${i}-${w.wort}`}
							type="button"
							data-chip={i}
							data-marke={w.marke ?? ''}
							aria-pressed={gewaehlt === i}
							className={`h-knopf border px-2 ${anfang ? 'rounded-l-xl' : '-ml-1.5 border-l-0'} ${schluss ? 'rounded-r-xl' : 'border-r-0'} ${gewaehlt === i ? 'border-brand-500 bg-brand-50' : 'border-rand bg-flaeche'}`}
							onClick={() => setGewaehlt(gewaehlt === i ? null : i)}
						>
							<span className="block">{w.wort}</span>
							{schluss && <span className="block text-sm text-leise">{name ?? '–'}</span>}
						</button>
					);
				})}
			</div>
			{gewaehlt !== null && wort && (
				<div className="mt-2">
					<select
						aria-label={`${feld.markeName} von „${wort.wort}“`}
						className={`${EINGABE} w-full`}
						value={wort.marke ?? ''}
						onChange={(e) => schreibe(markeSetzen(satz, gewaehlt, e.target.value || null))}
					>
						<option value="">Keine</option>
						{feld.optionen.map((o) => (
							<option key={o.wert} value={o.wert}>
								{o.name}
							</option>
						))}
					</select>
					{feld.gruppen && naechstes && (
						<Knopf art="zweit" className="mt-2" onClick={() => umschalten(gewaehlt)}>
							{verbunden ? `Von „${naechstes.wort}“ trennen` : `Mit „${naechstes.wort}“ verbinden`}
						</Knopf>
					)}
				</div>
			)}
			<textarea
				id={id}
				ref={eingabe}
				rows={2}
				autoComplete="off"
				className={`${EINGABE} mt-2 w-full py-2`}
				aria-invalid={Boolean(abb.fehler[feld.attribut])}
				placeholder={feld.beispiel && `z. B. ${feld.beispiel}`}
				value={text}
				onFocus={() => {
					basis.current = satz;
				}}
				onChange={(e) => {
					setText(e.target.value);
					setGewaehlt(null);
					schreibe(markierungNeuerText(basis.current, e.target.value), false);
				}}
				onBlur={() => schreibe(markierungNeuerText(basis.current, text.trim()))}
			/>
		</Rahmen>
	);
};

const PLAN_TOENE: Record<string, string> = {
	strasse: '#a9a9a9',
	wasser: '#8ec5f2',
	wald: '#5fa768',
	wiese: '#c6e6a8',
	platz: '#eadbb5',
};

/** Gitter für zwei Attribute: Jede Wahl ändert genau eins davon und ist ein Rückgängig-Schritt. */
const Plan = ({ abb, feld }: FeldEigenschaften<PlanFeld>) => {
	const id = useId();
	const [gewaehlt, setGewaehlt] = useState<string | null>(null);
	const w = abb.werte ?? {};
	const spalten = Number(w.spalten ?? 6);
	const zeilen = Number(w.zeilen ?? 5);
	const boden = rasterVon(w[feld.attribut] ?? null);
	const orte = planObjekteVon(w[feld.objekte] ?? null);
	const symbole = feld.symbole[w.art ?? 'ort'] ?? [];
	const name = (q: string) => String.fromCharCode(65 + Number(q.split(',')[0]));
	const quadrate = Array.from({ length: zeilen }, (_, y) =>
		Array.from({ length: spalten }, (__, x) => ({ q: `${name(String(x))}${y + 1}`, x, y })),
	);
	const flaecheVon = (x: number, y: number) => boden[y]?.[x] ?? 'leer';
	const lage = quadrate.flat().find((z) => z.q === gewaehlt);
	const setzeFlaeche = (x: number, y: number, wert: string) => {
		const neu = quadrate.map((reihe) => reihe.map((z) => (z.x === x && z.y === y ? wert : flaecheVon(z.x, z.y))));
		abb.aendere(feld, neu.flat().every((z) => z === 'leer') ? null : rasterText(neu));
	};
	const setzeSymbol = (q: string, wert: string) => {
		const neu = new Map(orte);
		if (wert) {
			neu.set(q, wert);
		} else {
			neu.delete(q);
		}
		abb.aendere({ art: 'text', attribut: feld.objekte, name: 'Symbol' }, planObjekteText(neu));
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="overflow-x-auto" id={id} data-plan>
				<div className="grid w-max gap-0.5" style={{ gridTemplateColumns: `repeat(${spalten}, 2.75rem)` }}>
					{quadrate.flat().map((z) => {
						const symbol = symbole.find((o) => o.wert === orte.get(z.q));
						return (
							<button
								key={z.q}
								type="button"
								data-plan-zelle={z.q}
								data-flaeche={flaecheVon(z.x, z.y)}
								aria-label={`Planquadrat ${z.q}${symbol ? `: ${symbol.name}` : ''}`}
								aria-pressed={gewaehlt === z.q}
								className={`size-11 overflow-hidden rounded border text-xs ${gewaehlt === z.q ? 'border-brand-500' : 'border-rand'}`}
								style={{ background: PLAN_TOENE[flaecheVon(z.x, z.y)] ?? '#fff' }}
								onClick={() => setGewaehlt(gewaehlt === z.q ? null : z.q)}
							>
								{symbol ? symbol.name.slice(0, 5) : z.q}
							</button>
						);
					})}
				</div>
			</div>
			{lage && (
				<div className="mt-2 grid gap-2">
					<select
						aria-label={`Fläche in ${lage.q}`}
						className={`${EINGABE} w-full`}
						value={flaecheVon(lage.x, lage.y)}
						onChange={(e) => setzeFlaeche(lage.x, lage.y, e.target.value)}
					>
						{feld.flaechen.map((o) => (
							<option key={o.wert} value={o.wert}>
								{o.name}
							</option>
						))}
					</select>
					<select
						aria-label={`Symbol in ${lage.q}`}
						className={`${EINGABE} w-full`}
						value={orte.get(lage.q) ?? ''}
						onChange={(e) => setzeSymbol(lage.q, e.target.value)}
					>
						<option value="">Kein Symbol</option>
						{symbole.map((o) => (
							<option key={o.wert} value={o.wert}>
								{o.name}
							</option>
						))}
					</select>
				</div>
			)}
		</Rahmen>
	);
};

const NOTEN_KNOEPFE = [
	{ name: 'Viertel', woerter: ['4'] },
	{ name: 'Achtelpaar', woerter: ['8', '8'] },
	{ name: 'Halbe', woerter: ['2'] },
	{ name: 'Ganze', woerter: ['1'] },
	{ name: 'Viertelpause', woerter: ['r4'] },
	{ name: 'Achtelpause', woerter: ['r8'] },
	{ name: 'Halbe Pause', woerter: ['r2'] },
];

const NotenEingabe = ({ abb, feld }: FeldEigenschaften<NotenFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? '';
	const takt = abb.werte?.takt ?? '4/4';
	const mitTon = notenMitTon(wert);
	const [gewaehlt, setGewaehlt] = useState<number | null>(null);
	const stelle = gewaehlt !== null && gewaehlt < mitTon.length ? gewaehlt : mitTon.length - 1;
	const schreibe = (neu: string) => abb.aendere(feld, neu.trim() === '' ? null : neu);
	const fuegeAn = (woerter: string[]) => {
		const ton = /^[a-h]'{1,2}/.exec(mitTon.at(-1) ?? '')?.[0] ?? String.raw`g'`;
		schreibe(
			woerter.reduce(
				(text, w) => notenAnfuegen(text, feld.tonhoehe && !w.startsWith('r') ? `${ton}${w}` : w, takt),
				wert,
			),
		);
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="grid grid-cols-2 gap-2" role="group" aria-label="Note anfügen">
				{NOTEN_KNOEPFE.map((k) => (
					<Knopf key={k.name} art="zweit" onClick={() => fuegeAn(k.woerter)}>
						{k.name}
					</Knopf>
				))}
				<Knopf art="zweit" onClick={() => schreibe(notenPunkt(wert))}>
					Punkt
				</Knopf>
				<Knopf art="zweit" className="col-span-2" onClick={() => schreibe(notenZuruecknehmen(wert))}>
					Letzte Note zurücknehmen
				</Knopf>
			</div>
			{feld.tonhoehe && mitTon.length > 0 && (
				<div className="mt-2">
					<div className="flex flex-wrap gap-1" role="group" aria-label="Note wählen">
						{mitTon.map((w, i) => (
							<button
								// Die Noten tragen keine Kennung; ihre Stelle ist die Kennung.
								key={String(i)}
								type="button"
								aria-pressed={i === stelle}
								className={`h-knopf min-w-11 rounded-lg border px-1 ${i === stelle ? 'border-brand-500 font-medium' : 'border-rand'}`}
								onClick={() => setGewaehlt(i)}
							>
								{w}
							</button>
						))}
					</div>
					<div className="mt-2 flex gap-2">
						<Knopf art="zweit" className="flex-1" onClick={() => schreibe(notenTon(wert, stelle, 1))}>
							Höher ↑
						</Knopf>
						<Knopf art="zweit" className="flex-1" onClick={() => schreibe(notenTon(wert, stelle, -1))}>
							Tiefer ↓
						</Knopf>
					</div>
				</div>
			)}
			<div className="mt-2">
				<Text
					abb={abb}
					feld={{
						art: 'text',
						attribut: feld.attribut,
						name: 'Als Text',
						beispiel: feld.tonhoehe ? String.raw`c'4 d'4 e'4 f'4 | g'2 g'2` : '4 8 8 4 r4',
					}}
				/>
			</div>
		</Rahmen>
	);
};

const BildEingabe = ({ abb, feld }: FeldEigenschaften<BildFeld>) => {
	const id = useId();
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<BildWahl
				abb={abb}
				aendere={(neu) => abb.aendere(feld, neu || null)}
				name={feld.name}
				wert={wertVon(feld, abb)?.wert ?? ''}
			/>
		</Rahmen>
	);
};

interface BildPunkt {
	x: number;
	y: number;
	wort: string;
}

const punkteAus = (wert: string): BildPunkt[] =>
	wert
		.split(';')
		.map((z) => z.trim())
		.filter(Boolean)
		.map((z) => {
			const i = z.indexOf(':');
			const [x = '0', y = '0'] = (i < 0 ? z : z.slice(0, i)).split(',');
			return { x: Number(x), y: Number(y), wort: i < 0 ? '' : z.slice(i + 1).trim() };
		});

const punkteText = (punkte: BildPunkt[]) => punkte.map((p) => `${p.x},${p.y}: ${p.wort}`).join('; ');

/** So nah am Punkt (in Prozent) greift der Finger ihn, statt einen neuen zu setzen. */
const PUNKT_GREIFEN = 6;

/**
 * Punkte auf dem Bild: Tippen setzt einen neuen, Ziehen verschiebt ihn, das Wort steht im Panel. Das sind Daten am
 * Element, keine freie Ebene (Entscheidung 2). Nur solange „Punkte setzen“ an ist, gehört das Bild diesem Werkzeug.
 */
const PunkteEingabe = ({ abb, feld }: FeldEigenschaften<PunkteFeld>) => {
	const id = useId();
	const [setzen, setSetzen] = useState(false);
	const wert = wertVon(feld, abb)?.wert ?? '';
	const punkte = useMemo(() => punkteAus(wert), [wert]);
	const aktuell = useRef({ abb, feld, punkte });
	useEffect(() => {
		aktuell.current = { abb, feld, punkte };
	});
	const { doc, nr } = abb;

	useEffect(() => {
		const element = doc && nr !== null ? (elementZu(doc, nr) as HTMLElement | null) : null;
		if (!setzen || !element) {
			return undefined;
		}
		const schreibe = (neu: BildPunkt[], uebernehmen: boolean) => {
			const { abb: a, feld: f } = aktuell.current;
			aktuell.current.punkte = neu;
			a.aendere(f, punkteText(neu), { uebernehmen });
		};
		const flaeche = () => {
			const r = element.querySelector('.bildflaeche')?.getBoundingClientRect();
			return r && r.width > 0 && r.height > 0 ? r : null;
		};
		const lage = (e: PointerEvent, r: DOMRect) => {
			const x = Math.round(((e.clientX - r.left) / r.width) * 100);
			const y = Math.round(((e.clientY - r.top) / r.height) * 100);
			return {
				x: Math.min(100, Math.max(0, x)),
				y: Math.min(100, Math.max(0, y)),
				drin: x >= 0 && x <= 100 && y >= 0 && y <= 100,
			};
		};
		let griff: number | null = null;
		let bewegt = false;
		// Beim Ziehen zeichnet das Element neu, dabei hat das Bild kurz keine Höhe: Es gilt die Fläche vom Aufsetzen.
		let beimDruck: DOMRect | null = null;
		const runter = (e: PointerEvent) => {
			const r = flaeche();
			const l = r && lage(e, r);
			if (!r || !l?.drin) {
				return;
			}
			beimDruck = r;
			e.preventDefault();
			e.stopPropagation();
			element.setPointerCapture(e.pointerId);
			const { punkte: alle } = aktuell.current;
			const nah = alle.findIndex((p) => Math.hypot(p.x - l.x, p.y - l.y) <= PUNKT_GREIFEN);
			bewegt = false;
			griff = nah < 0 ? null : nah;
			if (nah < 0) {
				schreibe([...alle, { x: l.x, y: l.y, wort: 'Wort' }], true);
			}
		};
		const bewege = (e: PointerEvent) => {
			if (griff === null || !beimDruck) {
				return;
			}
			const l = lage(e, beimDruck);
			e.preventDefault();
			e.stopPropagation();
			bewegt = true;
			const i = griff;
			schreibe(
				aktuell.current.punkte.map((p, j) => (j === i ? { ...p, x: l.x, y: l.y } : p)),
				false,
			);
		};
		const hoch = (e: PointerEvent) => {
			if (!beimDruck) {
				return;
			}
			e.stopPropagation();
			// Der letzte Stand kommt vom Finger selbst: `aktuell` hinkt dem Zeichnen um einen Durchlauf nach.
			if (griff !== null && bewegt) {
				const l = lage(e, beimDruck);
				const i = griff;
				schreibe(
					aktuell.current.punkte.map((p, j) => (j === i ? { ...p, x: l.x, y: l.y } : p)),
					true,
				);
			}
			griff = null;
			beimDruck = null;
		};
		const klick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
		};
		const stil = element.style;
		const alt = stil.touchAction;
		stil.touchAction = 'none';
		element.addEventListener('pointerdown', runter, true);
		element.addEventListener('pointermove', bewege, true);
		element.addEventListener('pointerup', hoch, true);
		element.addEventListener('click', klick, true);
		return () => {
			stil.touchAction = alt;
			element.removeEventListener('pointerdown', runter, true);
			element.removeEventListener('pointermove', bewege, true);
			element.removeEventListener('pointerup', hoch, true);
			element.removeEventListener('click', klick, true);
		};
	}, [doc, nr, setzen]);

	const setze = (neu: BildPunkt[], uebernehmen: boolean) =>
		abb.aendere(feld, punkteText(neu) || null, { uebernehmen });

	const entferne = (i: number) => {
		const uebrig = punkte.filter((_, j) => j !== i);
		setze(uebrig, true);
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<p className="mb-2 text-leise">
				Tippe aufs Bild, um einen Punkt zu setzen. Ziehe einen Punkt, um ihn zu verschieben.
			</p>
			<Knopf
				id={id}
				art={setzen ? 'haupt' : 'zweit'}
				aria-pressed={setzen}
				data-punkte-setzen
				onClick={() => setSetzen((an) => !an)}
			>
				{setzen ? 'Punkte setzen beenden' : 'Punkte setzen'}
			</Knopf>
			<ul className="mt-2 flex flex-col gap-2" data-punkte-liste>
				{punkte.map((p, i) => (
					// Die Reihenfolge ist die Nummer des Punkts: Nur Löschen verschiebt sie, und dann soll das Feld neu entstehen.
					<li key={`${i}-${punkte.length}`} className="flex items-center gap-2">
						<b className="w-6 flex-none text-center">{i + 1}</b>
						<input
							aria-label={`Wort zu Punkt ${i + 1}`}
							className={`${EINGABE} w-full min-w-0 flex-1`}
							defaultValue={p.wort}
							onChange={(e) => {
								setze(
									punkte.map((q, j) =>
										j === i ? { ...q, wort: e.target.value.replace(/[;:]/g, ' ') } : q,
									),
									false,
								);
							}}
							onBlur={() => abb.uebernimm()}
						/>
						<Knopf art="zweit" aria-label={`Punkt ${i + 1} entfernen`} onClick={() => entferne(i)}>
							<Symbol name="papierkorb" />
						</Knopf>
					</li>
				))}
			</ul>
		</Rahmen>
	);
};

const Eingabe = ({ abb, feld }: FeldEigenschaften<Feld>) => {
	switch (feld.art) {
		case 'zahl':
			return <Zahl feld={feld} abb={abb} />;
		case 'uhrzeit':
			return <Uhrzeit feld={feld} abb={abb} />;
		case 'auswahl':
			return <Auswahl feld={feld} abb={abb} />;
		case 'schalter':
			return <Schalter feld={feld} abb={abb} />;
		case 'zahlen':
			return <Zahlen feld={feld} abb={abb} />;
		case 'ziffern':
			return <Ziffern feld={feld} abb={abb} />;
		case 'text':
			return <Text feld={feld} abb={abb} />;
		case 'liste':
			return <Liste feld={feld} abb={abb} />;
		case 'mehrfach':
			return <Mehrfach feld={feld} abb={abb} />;
		case 'raster':
			return <Raster feld={feld} abb={abb} />;
		case 'muster':
			return <MusterEingabe feld={feld} abb={abb} />;
		case 'mischen':
			return <Mischen feld={feld} abb={abb} />;
		case 'noten':
			return <NotenEingabe abb={abb} feld={feld} />;
		case 'markierung':
			return <Markierung feld={feld} abb={abb} />;
		case 'plan':
			return <Plan feld={feld} abb={abb} />;
		case 'bild':
			return <BildEingabe feld={feld} abb={abb} />;
		case 'punkte':
			return <PunkteEingabe feld={feld} abb={abb} />;
		default:
			return null;
	}
};

const LEISTE_AUSWAHL = 'h-feld rounded-md border border-rand-feld bg-flaeche px-1 text-xs text-tinte';

/** Dieselben Werte wie im Inspektor, nur kompakt: `aendere` hält beide auf demselben Stand. */
const UhrzeitInLeiste = ({ abb, feld }: FeldEigenschaften<UhrzeitFeld>) => {
	const { minute, minuten, setze, stunde, stunden } = uhrzeitVon({ abb, feld });
	return (
		<span className="flex flex-none items-center gap-1 text-xs text-leise" data-leiste-uhrzeit>
			{feld.name}
			<select
				aria-label="Stunde"
				className={LEISTE_AUSWAHL}
				value={stunde ?? ''}
				onChange={(e) => setze(e.target.value === '' ? null : Number(e.target.value), minute)}
			>
				<option value="">–</option>
				{stunden.map((h) => (
					<option key={h} value={h}>
						{h}
					</option>
				))}
			</select>
			:
			<select
				aria-label="Minuten"
				className={LEISTE_AUSWAHL}
				disabled={stunde === null}
				value={minute ?? ''}
				onChange={(e) => setze(stunde, Number(e.target.value))}
			>
				{minute === null && <option value="">–</option>}
				{minuten.map((m) => (
					<option key={m} value={m}>
						{zweistellig(m)}
					</option>
				))}
			</select>
		</span>
	);
};

export const AbbildungLeiste = ({ abb }: { abb: AbbildungSteuerung }) =>
	leistenFelder(abb).map((f) => <UhrzeitInLeiste key={f.attribut} abb={abb} feld={f} />);

/** Beispiel, Hinweise und was gerade nicht übernommen wird: Zustände stehen über den Abschnitten. */
export const AbbildungHinweise = ({ abb }: { abb: AbbildungSteuerung }) => {
	if (!abb.aktiv || !abb.schema) {
		return null;
	}
	const ungueltig = Object.keys(abb.fehler).length > 0;
	return (
		<>
			{abb.beispiel && (
				<p className="flex gap-2 rounded-md bg-brand-50 p-2 text-xs" data-hinweis="beispiel">
					<Symbol name="blatt" className="size-3.5 flex-none" />
					Das ist das Beispiel. Die Lösung ist auf dem Arbeitsblatt sichtbar.
				</p>
			)}
			{abb.info && (
				<p className="text-xs text-leise" data-abbildung-info>
					{abb.info}
				</p>
			)}
			{abb.fehler._element && (
				<p className="flex gap-2 font-medium text-fehler" role="alert" data-fehler="_element">
					<Symbol name="achtung" className="size-3.5 flex-none" />
					{abb.fehler._element}
				</p>
			)}
			{ungueltig && abb.offen && (
				<div className="rounded-md bg-warnung-hell p-2" role="status" data-nicht-uebernommen>
					<p>Noch nicht gespeichert, weil eine Angabe nicht passt.</p>
					<Knopf art="zweit" className="mt-2" onClick={abb.zuruecksetzen}>
						<Symbol name="rueckgaengig" />
						Zurücksetzen
					</Knopf>
				</div>
			)}
		</>
	);
};

/** Die Felder der gewählten Abbildung, die in diesen Abschnitt gehören. Jede Änderung zeigt sich sofort im Blatt. */
export const AbbildungFelder = ({ abb, abschnitt }: { abb: AbbildungSteuerung; abschnitt: AbschnittName }) => {
	if (!abb.aktiv || !abb.schema) {
		return null;
	}
	const felder = abb.schema.felder.filter((f) => abschnittVon(f) === abschnitt);
	return felder.length === 0 ? null : (
		<div className="flex flex-col gap-1">
			{felder.map((feld) => (
				<Eingabe key={feld.attribut} feld={feld} abb={abb} />
			))}
		</div>
	);
};
