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
	PaarFeld,
	PlanFeld,
	PunkteFeld,
	RasterFeld,
	SchalterFeld,
	TextFeld,
	UhrzeitFeld,
	UnterFeld,
	ZahlenFeld,
	ZeitspanneFeld,
	ZahlFeld,
	ZiffernFeld,
} from '@schoolbox/kern/src/abbildungen';
import {
	abschnittVon,
	alsZahl,
	auswahlOptionen,
	feldWert,
	listeAusZeilen,
	listeVon,
	markeSetzen,
	markeTrennen,
	markeVerbinden,
	markierungKlartext,
	markierungLesen,
	markierungNeuerText,
	markierungText,
	mehrfachOptionen,
	MINI_ARTEN,
	miniTeile,
	notenAnfuegen,
	notenMitTon,
	notenPunkt,
	notenTon,
	notenZuruecknehmen,
	paarVon,
	planObjekteText,
	planObjekteVon,
	rasterText,
	rasterVon,
	stellenVon,
	zahlMax,
	zahlStandard,
	zeilenAlsText,
	zeilenAusListe,
	zeilenAusText,
	zeilenText,
	zeilenVon,
	ziffernText,
} from '@schoolbox/kern/src/abbildungen';
import type { AbschnittName } from '@schoolbox/kern/src/abschnitte';
import { cmZuPx, grenzenInCm, inCm, liesZahl, pxZuCm, rasteEin, zahlMitKomma } from '@schoolbox/kern/src/masse';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';

import { meldung, sende, sendeDatei } from '../api';
import { Griff } from '../bausteine/Griff';
import { Hilfetipp } from '../bausteine/Hilfetipp';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Popover } from '../bausteine/Popover';
import { Schalter as Umschalter } from '../bausteine/Schalter';
import { STEPPER_EINHEIT, STEPPER_RAHMEN, STEPPER_STUFE, STEPPER_WERT } from '../bausteine/Stepper';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { folgeZeiger, rolleAmRand, schluckeKlick } from '../bausteine/zeigerzug';
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

/** 196-09: Enter übernimmt (wie Verlassen) und lässt den Fokus im Feld. */
const fertigMitEnter = (e: KeyboardEvent<HTMLInputElement>) => {
	if (e.key === 'Enter') {
		const feld = e.currentTarget;
		feld.blur();
		feld.focus();
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
	const l = feld.loesung;
	if (!l || !w) {
		return null;
	}
	// 197-10: Teilen sich Felder die Lösung, steht der Schalter einmal, unter dem letzten.
	const teil = l.teil;
	if (
		teil !== undefined &&
		abb.schema?.felder.some((f) => f.loesung?.attribut === l.attribut && (f.loesung.teil ?? -1) > teil)
	) {
		return null;
	}
	return (
		<Haken
			name={l.name}
			aktiv={w.nurLoesung}
			aus={teil === undefined && w.wert === null}
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
	meldung,
}: {
	feld: Feld;
	abb: AbbildungSteuerung;
	id: string;
	/** Eigener Wortlaut der Meldung am Feld, z. B. in cm statt px. */
	meldung?: string | undefined;
	/** Kurze Werte stehen rechts neben dem Namen; Listen und Raster brauchen die ganze Breite. */
	daneben?: boolean;
	children: ReactNode;
}) => {
	const fehler = abb.fehler[feld.attribut] ? (meldung ?? abb.fehler[feld.attribut]) : undefined;
	return (
		<div data-feld={feld.attribut}>
			<Zeile titel={feld.name} fuer={id} hilfe={feld.hilfe} darunter={!daneben}>
				{children}
			</Zeile>
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

/**
 * Zahl mit −/+ (196-10, 197-02, 197-12, 197-19): Getippt wird mit Komma oder Punkt; was nicht passt, ist rot und wird
 * nicht gezeichnet. Enter oder Verlassen setzt die nächste erlaubte Zahl, leer oder Text den alten Wert; Esc stellt
 * ihn wieder her. Maße in px erscheinen in cm (197-U3), gespeichert bleibt px.
 */
const Zahl = ({ abb, feld }: FeldEigenschaften<ZahlFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const standard = zahlStandard(feld, abb.werte);
	const cm = inCm(feld);
	const max = zahlMax(feld, abb.klasse);
	const grenzen = cm
		? grenzenInCm({ min: feld.min, max, schritt: feld.schritt ?? 1 })
		: { min: feld.min, max, schritt: feld.schritt ?? 1 };
	const zeigen = (px: number) => (cm ? pxZuCm(px) : px);
	const speichern = (n: number) => String(cm ? cmZuPx(n) : n);
	const anzeige = (roh: string | null) => {
		if (roh === null) {
			return feld.automatisch ? '' : zahlMitKomma(zeigen(standard));
		}
		const n = alsZahl(roh);
		return Number.isFinite(n) ? zahlMitKomma(zeigen(n)) : roh;
	};
	const { feld: eingabe, setText, text } = useEingabe(anzeige(wert));
	/**
	 * Der zuletzt übernommene Wert: dorthin führen leer, Text und Esc zurück (196-10). `getippt` ist der Text beim
	 * Betreten oder nach dem letzten Übernehmen; solange er gleich bleibt, schreibt das Feld nichts (197-N01).
	 */
	const vorher = useRef<string | null>(wert);
	const getippt = useRef<string | null>(null);
	// Ohne Fokus folgt der zuletzt übernommene Wert dem Blatt, z. B. nach ⌘Z (197-N01).
	useEffect(() => {
		if (eingabe.current?.ownerDocument.activeElement !== eingabe.current) {
			vorher.current = wert;
		}
	}, [wert, eingabe]);
	/** Nimmt einen Entwurf dieses Felds zurück, ohne zu schreiben; ohne Entwurf geschieht nichts (würfelt nicht neu). */
	const zurueckZu = (roh: string | null) => {
		if (wert !== roh) {
			abb.aendere(feld, roh, { uebernehmen: false });
		}
	};
	const jetzt = zeigen(alsZahl(wert ?? String(standard)));
	const setze = (n: number) => {
		const neu = rasteEin(n, grenzen);
		setText(zahlMitKomma(neu));
		getippt.current = zahlMitKomma(neu);
		// Derselbe gezeigte Wert schreibt nichts: 88 px bleiben 88 px, auch wenn 2,3 cm umgerechnet 87 px wären.
		if (vorher.current !== null && neu === zeigen(alsZahl(vorher.current))) {
			zurueckZu(vorher.current);
			return;
		}
		vorher.current = speichern(neu);
		const gesetzt = abb.aendere(feld, speichern(neu));
		// 207: Passt die Zahl nicht auf den Platz, setzt das Panel die nächste, die passt; das Feld zeigt sie.
		if (gesetzt && gesetzt !== vorher.current) {
			vorher.current = gesetzt;
			setText(anzeige(gesetzt));
			getippt.current = anzeige(gesetzt);
		}
	};
	const springe = (richtung: 1 | -1) => setze((Number.isFinite(jetzt) ? jetzt : zeigen(standard)) + richtung * grenzen.schritt);
	const fertig = () => {
		if (getippt.current !== null && text === getippt.current) {
			zurueckZu(vorher.current);
			return;
		}
		const n = liesZahl(text);
		// 207-N03: „7,5“ in einem Feld für ganze Zahlen wird nicht still zu 7. Der Entwurf bleibt rot mit dem Hinweis am
		// Feld, gespeichert bleibt der alte Wert.
		if (Number.isFinite(n) && !cm && Number.isInteger(grenzen.schritt) && !Number.isInteger(n)) {
			abb.aendere(feld, String(n), { uebernehmen: false });
			return;
		}
		if (Number.isFinite(n)) {
			setze(n);
		} else if (text.trim() === '' && feld.automatisch) {
			setText('');
			getippt.current = '';
			vorher.current = null;
			abb.aendere(feld, null);
		} else {
			setText(anzeige(vorher.current));
			getippt.current = anzeige(vorher.current);
			abb.aendere(feld, vorher.current, { uebernehmen: vorher.current !== wert });
		}
	};
	// Die Grenzen in cm statt px; eine Meldung der Zeichnung (197-N02) bleibt, wie sie ist.
	const meldung =
		cm && /^Bitte eine/.test(abb.fehler[feld.attribut] ?? '')
			? `Bitte eine Zahl von ${zahlMitKomma(grenzen.min)} bis ${zahlMitKomma(grenzen.max)} cm.`
			: undefined;
	return (
		<Rahmen daneben feld={feld} abb={abb} id={id} meldung={meldung}>
			<div className={klassen(STEPPER_RAHMEN, 'has-[[aria-invalid=true]]:border-fehler')}>
				<button
					type="button"
					className={STEPPER_STUFE}
					aria-label={`${feld.name}: weniger`}
					disabled={!abb.aktiv || (Number.isFinite(jetzt) && jetzt <= grenzen.min)}
					onClick={() => springe(-1)}
				>
					<Symbol name="minus" className="size-3 flex-none" />
				</button>
				<span className={STEPPER_WERT}>
					<input
						ref={eingabe}
						id={id}
						type="text"
						inputMode="decimal"
						enterKeyHint="done"
						autoComplete="off"
						disabled={!abb.aktiv}
						placeholder={
							feld.automatisch && feld.standardJe
								? `${feld.automatisch} (${zahlMitKomma(zeigen(standard))})`
								: feld.automatisch
						}
						className={klassen(
							'min-w-0 bg-transparent outline-none placeholder:text-leise',
							feld.automatisch ? 'w-28' : cm ? 'w-10' : 'w-9',
							feld.einheit ? 'text-right' : 'text-center',
						)}
						aria-invalid={Boolean(abb.fehler[feld.attribut])}
						value={text}
						onFocus={() => {
							// Ein Feld ohne Fokus folgt dem Blatt; beim Betreten gilt, was jetzt gespeichert ist.
							vorher.current = wert;
							setText(anzeige(wert));
							getippt.current = anzeige(wert);
						}}
						onChange={(e) => {
							setText(e.target.value);
							const roh = e.target.value.trim();
							const n = liesZahl(roh);
							// Nur den Entwurf ändern; gezeichnet wird er erst, wenn das Feld passt (197-02).
							abb.aendere(feld, roh === '' ? (feld.automatisch ? null : vorher.current) : Number.isFinite(n) ? speichern(n) : roh, {
								uebernehmen: false,
							});
						}}
						onBlur={() => {
							fertig();
							getippt.current = null;
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								fertig();
							} else if (e.key === 'Escape') {
								e.preventDefault();
								e.stopPropagation();
								setText(anzeige(vorher.current));
								getippt.current = anzeige(vorher.current);
								abb.aendere(feld, vorher.current, { uebernehmen: false });
							}
						}}
					/>
					{feld.einheit && <span className={STEPPER_EINHEIT}>{cm ? 'cm' : feld.einheit}</span>}
				</span>
				<button
					type="button"
					className={STEPPER_STUFE}
					aria-label={`${feld.name}: mehr`}
					disabled={!abb.aktiv || (Number.isFinite(jetzt) && jetzt >= grenzen.max)}
					onClick={() => springe(1)}
				>
					<Symbol name="plus" className="size-3 flex-none" />
				</button>
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
	// 197-14: Eine leere Uhr gibt es nur, solange die Zeiger nicht nur in der Lösung stehen.
	const leerErlaubt = !wertVon(feld, abb)?.nurLoesung;
	return (
		<Rahmen daneben feld={feld} abb={abb} id={id}>
			<div className="flex items-center gap-1" data-uhrzeit>
				<select
					id={id}
					aria-label="Stunde"
					className={`${EINGABE} pr-4`}
					aria-invalid={Boolean(abb.fehler[feld.attribut])}
					value={stunde ?? ''}
					onChange={(e) => setze(e.target.value === '' ? null : Number(e.target.value), minute)}
				>
					{(leerErlaubt || stunde === null) && <option value="">–</option>}
					{stunden.map((h) => (
						<option key={h} value={h}>
							{h}
						</option>
					))}
				</select>
				<span className="text-leise">:</span>
				<select
					aria-label="Minuten"
					className={`${EINGABE} pr-4`}
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

/** So viele Zeichen passen mit Pfeil neben einen Feldnamen. */
const AUSWAHL_DANEBEN = 12;

const Auswahl = ({ abb, feld }: FeldEigenschaften<AuswahlFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? feld.standard ?? null;
	const aus = feld.optionenAus && abb.werte ? (abb.werte[feld.optionenAus] ?? '') : '';
	const dazu = aus.split('|').flatMap((t) => (t.trim() ? [{ wert: t.trim(), name: t.trim() }] : []));
	const moeglich = [...auswahlOptionen(feld, abb.werte, abb.klasse), ...dazu];
	const bekannt = moeglich.some((o) => o.wert === wert);
	// 197-16: Optionen über der Klasse des Blatts sagen es.
	const klasse = Number(/\bkl([1-4])\b/.exec(abb.doc?.body.className ?? '')?.[1] ?? 0);
	const mitKlasse = (o: { wert: string | null; name: string }) => {
		const ab = o.wert === null ? undefined : feld.abKlasse?.[o.wert];
		return klasse && ab && ab > klasse ? { ...o, name: `${o.name} (über Klasse ${klasse})` } : o;
	};
	const optionen = (bekannt ? moeglich : [...moeglich, { wert, name: wert ?? '–' }]).map(mitKlasse);
	const index = optionen.findIndex((o) => o.wert === wert);
	const blaettere = (schritt: number) => abb.aendere(feld, optionen[index + schritt]?.wert ?? null);
	// Lange Texte bekämen neben dem Namen zu wenig Platz: Sie stehen über die ganze Breite (G6).
	const breit = feld.vorschau || feld.blaettern || optionen.some((o) => o.name.length > AUSWAHL_DANEBEN);
	return (
		<Rahmen daneben={!breit} feld={feld} abb={abb} id={id}>
			<select
				id={id}
				className={`${EINGABE} ${breit ? 'w-full' : 'w-auto min-w-14 pr-5'}`}
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

/**
 * 197-04: Ziffer, Komma, Ziffer ist eine Zahl. Felder mit `komma` nehmen sie (gespeichert mit Punkt, gezeigt mit
 * Komma); die übrigen melden es am Feld und ändern nichts.
 */
const KOMMAZAHL = /(\d),(\d)/g;
const HAT_KOMMA = /\d,\d/;
const zahlenZeigen = (wert: string | null, komma: boolean) => (komma ? (wert ?? '').replace(/(\d)\.(\d)/g, '$1,$2') : (wert ?? ''));

/**
 * 197-11: Eine Zahl je Zeile einer anderen Liste, z. B. der Anteil je Feld des Glücksrads, neben dem Namen der Zeile.
 * Alle leer entfernt das Attribut.
 */
const ZahlenJeZeile = ({ abb, feld, liste }: FeldEigenschaften<ZahlenFeld> & { liste: string }) => {
	const id = useId();
	const zeilen = (abb.werte?.[liste] ?? '')
		.split(';')
		.map((z) => z.trim())
		.filter(Boolean);
	const zahlen = listeVon(wertVon(feld, abb)?.wert ?? null);
	const setze = (i: number, roh: string) => {
		const neu = zeilen.map((_, j) => (j === i ? roh.trim() : (zahlen[j] ?? '')));
		const alleLeer = neu.every((z) => z === '');
		// Eine Lücke bekäme sonst die nächste Zahl; leere Zeilen zählen mit 1, wie ohne Angabe.
		abb.aendere(feld, alleLeer ? null : neu.map((z) => z || '1').join(' '));
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1" data-zahlen-je-zeile>
				{zeilen.map((z, i) => {
					const [fuellung = '', text = ''] = z.split(':').map((t) => t.trim());
					return (
						<Fragment key={`${z}-${String(i)}-${zahlen[i] ?? ''}`}>
							<span className="truncate text-leise">{text || fuellung}</span>
							<input
								id={i === 0 ? id : undefined}
								type="text"
								inputMode="numeric"
								enterKeyHint="done"
								autoComplete="off"
								aria-label={`${feld.name}: ${text || fuellung}`}
								className={`${EINGABE} w-14 text-center`}
								aria-invalid={Boolean(abb.fehler[feld.attribut])}
								placeholder="1"
								defaultValue={zahlen.length > 0 ? (zahlen[i] ?? '') : ''}
								onBlur={(e) => {
									if (e.target.value.trim() !== (zahlen[i] ?? '')) {
										setze(i, e.target.value);
									}
								}}
								onKeyDown={fertigMitEnter}
							/>
						</Fragment>
					);
				})}
			</div>
		</Rahmen>
	);
};

/** 197-11: Zwei Zahlen in einem Attribut (Malwinkel „3x7“, Start „2,3“, Striche „10 1“). */
const Paar = ({ abb, feld }: FeldEigenschaften<PaarFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const [a, b] = paarVon(feld, wert);
	const zeige = (n: number | null) => (n === null || !Number.isFinite(n) ? '' : zahlMitKomma(n));
	const setze = (i: 0 | 1, roh: string) => {
		const n = liesZahl(roh);
		const jetzt: [number | null, number | null] = [a, b];
		jetzt[i] = roh.trim() === '' ? null : Number.isFinite(n) ? n : jetzt[i];
		if (feld.leer && jetzt[0] === null && jetzt[1] === null) {
			abb.aendere(feld, null);
			return;
		}
		const teile = jetzt.map((x, k) => String(x ?? feld.teile[k]?.standard ?? 0));
		abb.aendere(feld, teile.join(feld.trenner));
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="flex flex-wrap items-center gap-2" data-paar={feld.attribut}>
				{feld.teile.map((t, i) => (
					<label key={t.name} className="flex items-center gap-1 text-leise">
						{t.name}
						<input
							key={zeige(i === 0 ? a : b)}
							id={i === 0 ? id : undefined}
							type="text"
							inputMode="decimal"
							enterKeyHint="done"
							autoComplete="off"
							aria-label={`${feld.name}: ${t.name}`}
							className={`${EINGABE} w-14 text-center text-tinte`}
							aria-invalid={Boolean(abb.fehler[feld.attribut])}
							disabled={!abb.aktiv}
							defaultValue={zeige(i === 0 ? a : b)}
							onBlur={(e) => {
								if (e.target.value.trim() !== zeige(i === 0 ? a : b)) {
									setze(i === 0 ? 0 : 1, e.target.value);
								}
							}}
							onKeyDown={fertigMitEnter}
						/>
					</label>
				))}
			</div>
		</Rahmen>
	);
};

/** 197-11: Zeitspanne „4:30-4:50“ als zwei Uhrzeiten; „–“ bei der ersten Stunde entfernt sie. */
const Zeitspanne = ({ abb, feld }: FeldEigenschaften<ZeitspanneFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const [von = '', bis = ''] = (wert ?? '').split('-');
	const lies = (t: string) => {
		const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
		return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
	};
	const zeiten = [lies(von), lies(bis)];
	const setze = (i: 0 | 1, h: number | null, m: number | null) => {
		if (h === null) {
			abb.aendere(feld, null);
			return;
		}
		const neu = zeiten.map((z) => (z ? `${z.h}:${zweistellig(z.m)}` : `${h}:${zweistellig(m ?? 0)}`));
		neu[i] = `${h}:${zweistellig(m ?? 0)}`;
		abb.aendere(feld, neu.join('-'));
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="flex flex-wrap items-center gap-1" data-zeitspanne>
				{zeiten.map((z, i) => (
					<Fragment key={i === 0 ? 'von' : 'bis'}>
						{i === 1 && <span className="px-1 text-leise">bis</span>}
						<select
							id={i === 0 ? id : undefined}
							aria-label={i === 0 ? 'Von: Stunde' : 'Bis: Stunde'}
							className={`${EINGABE} pr-4`}
							disabled={!abb.aktiv || (i === 1 && !zeiten[0])}
							value={z?.h ?? ''}
							onChange={(e) => setze(i === 0 ? 0 : 1, e.target.value === '' ? null : Number(e.target.value), z?.m ?? 0)}
						>
							<option value="">–</option>
							{(z && !STUNDEN.includes(z.h) ? [z.h, ...STUNDEN] : STUNDEN).map((h) => (
								<option key={h} value={h}>
									{h}
								</option>
							))}
						</select>
						<span className="text-leise">:</span>
						<select
							aria-label={i === 0 ? 'Von: Minuten' : 'Bis: Minuten'}
							className={`${EINGABE} pr-4`}
							disabled={!abb.aktiv || !z}
							value={z?.m ?? ''}
							onChange={(e) => z && setze(i === 0 ? 0 : 1, z.h, Number(e.target.value))}
						>
							{!z && <option value="">–</option>}
							{(z && !MINUTEN.includes(z.m) ? [...MINUTEN, z.m].sort((x, y) => x - y) : MINUTEN).map((m) => (
								<option key={m} value={m}>
									{zweistellig(m)}
								</option>
							))}
						</select>
					</Fragment>
				))}
			</div>
		</Rahmen>
	);
};

const Zahlen = ({ abb, feld }: FeldEigenschaften<ZahlenFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const komma = Boolean(feld.komma);
	const { feld: eingabe, setText, text } = useEingabe(zahlenZeigen(wert, komma));
	const [ganz, setGanz] = useState(false);
	/** Die Zahlen, wie sie gespeichert werden; `null`, wenn eine Kommazahl hier nicht geht. */
	const sauber = (roh: string) => {
		if (!komma && HAT_KOMMA.test(roh)) {
			return null;
		}
		return listeVon(komma ? roh.replace(KOMMAZAHL, '$1.$2') : roh).join(' ');
	};
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
				placeholder={`z. B. ${zahlenZeigen(feld.beispiel, komma)}`}
				aria-invalid={ganz || Boolean(abb.fehler[feld.attribut])}
				value={text}
				onChange={(e) => {
					setText(e.target.value);
					const neu = sauber(e.target.value);
					setGanz(neu === null);
					if (neu !== null) {
						abb.aendere(feld, neu === '' ? null : neu, { uebernehmen: false });
					}
				}}
				onBlur={() => {
					const neu = sauber(text);
					if (neu === null) {
						return;
					}
					setText(zahlenZeigen(neu, komma));
					abb.aendere(feld, neu === '' ? null : neu);
				}}
				onKeyDown={fertigMitEnter}
			/>
			{ganz && (
				<p className="mt-2 flex gap-2 font-medium text-fehler" role="alert" data-fehler={feld.attribut}>
					<Symbol name="achtung" className="size-3.5 flex-none" />
					Hier gehen nur ganze Zahlen.
				</p>
			)}
		</Rahmen>
	);
};

/** Je Stelle eine Zahl; leere Stellen rechts bleiben leer. */
const Ziffern = ({ abb, feld }: FeldEigenschaften<ZiffernFeld>) => {
	const id = useId();
	if (!abb.werte) {
		return null;
	}
	const stellen = stellenVon(abb.geprueft ?? abb.werte, feld.stellen);
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
	const roh = wertVon(feld, abb)?.wert ?? null;
	// 197-17: Listen mit `;` stehen im Panel zeilenweise.
	const wert = feld.jeZeile ? zeilenAusListe(roh) || null : roh;
	const imBlatt = (t: string) => (feld.jeZeile ? listeAusZeilen(t) : t);
	const [text, setText] = useState(wert ?? '');
	const eingabe = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

	useEffect(() => {
		if (eingabe.current?.ownerDocument.activeElement !== eingabe.current) {
			setText(wert ?? '');
		}
	}, [wert]);

	const vorschau = (neu: string) => {
		setText(neu);
		abb.aendere(feld, neu.trim() === '' ? null : imBlatt(neu), { uebernehmen: false });
	};
	/** 196-09: Esc stellt den Wert beim Betreten wieder her. */
	const vorher = useRef<string | null>(wert);
	const zurueck = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			setText(vorher.current ?? '');
			abb.aendere(feld, vorher.current === null ? null : imBlatt(vorher.current), { uebernehmen: false });
		}
	};
	const gemeinsam = {
		id,
		'onFocus': () => {
			vorher.current = wert;
		},
		'autoComplete': 'off',
		'className': `${EINGABE} w-full`,
		'aria-invalid': Boolean(abb.fehler[feld.attribut]),
		'placeholder': feld.beispiel && `z. B. ${feld.jeZeile ? zeilenAusListe(feld.beispiel) : feld.beispiel}`,
		'value': text,
		'onBlur': () => abb.aendere(feld, text.trim() === '' ? null : imBlatt(text.trim())),
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
					onKeyDown={zurueck}
				/>
			) : (
				<input
					{...gemeinsam}
					ref={eingabe}
					type="text"
					enterKeyHint="done"
					onChange={(e) => vorschau(e.target.value)}
					onKeyDown={(e) => {
						zurueck(e);
						fertigMitEnter(e);
					}}
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
			<Tooltip key={o.wert} text={o.name}>
				<button
					type="button"
					role="radio"
					aria-checked={aktiv === o.wert}
					aria-label={o.name}
					data-muster={o.wert}
					className={`size-11 rounded-xl border ${aktiv === o.wert ? 'border-tinte ring-1 ring-tinte' : 'border-rand'}`}
					style={{ background: (sw ? MUSTER_BILD : FARB_BILD)[o.wert] ?? '#fff' }}
					onClick={() => setze(o.wert)}
				/>
			</Tooltip>
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
	const optionen = mehrfachOptionen(feld, abb.werte);
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

/** Steht an seinem Feld (197-15); oben steht nur „Neue Zahlen“ (197-06). */
const Mischen = ({ abb, feld }: FeldEigenschaften<MischenFeld>) => (
	<div className="flex items-center gap-1 py-1" data-feld={feld.attribut}>
		<Knopf
			art="zweit"
			onClick={() => abb.aendere(feld, String(Math.floor(Math.random() * 1_000_000) + 1))}
			data-mischen={feld.attribut}
		>
			<Symbol name="neueZahlen" />
			{feld.knopf ?? 'Neu mischen'}
		</Knopf>
		{feld.hilfe && <Hilfetipp name={feld.knopf ?? 'Neu mischen'}>{feld.hilfe}</Hilfetipp>}
	</div>
);

interface BildWahlEigenschaften {
	abb: AbbildungSteuerung;
	aendere: (neu: string, sofort: boolean) => void;
	name: string;
	wert: string;
}

/** Bild aus der Sammlung oder hochgeladen; gespeichert wird nur der Pfad. Beide Darstellungen teilen das. */
const useBildWahl = ({ abb, aendere, name }: BildWahlEigenschaften) => {
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
	return {
		oeffneSammlung: () => setSammlung(true),
		oeffneDatei: () => datei.current?.click(),
		dazu: (
			<>
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
			</>
		),
	};
};

/** Ein Bild-Feld für sich: alle Wege als Knöpfe. */
const BildWahl = (e: BildWahlEigenschaften) => {
	const { abb, aendere, name, wert } = e;
	const { dazu, oeffneDatei, oeffneSammlung } = useBildWahl(e);
	return (
		<div className="flex flex-wrap items-center gap-2" role="group" aria-label={name}>
			{wert && <img className="h-12 w-12 flex-none object-contain" alt="" src={`${abb.bildBasis}${wert}`} />}
			<Knopf art="zweit" className="flex-1" onClick={oeffneSammlung}>
				Aus Bildern wählen
			</Knopf>
			<Knopf art="zweit" className="flex-1" onClick={oeffneDatei}>
				Hochladen
			</Knopf>
			{wert && (
				<Knopf art="zweit" className="flex-1" onClick={() => aendere('', true)}>
					Bild entfernen
				</Knopf>
			)}
			{dazu}
		</div>
	);
};

/** In einer Listenzeile: ein Symbol, das die Wege als Menü öffnet (G3). Ist ein Bild gesetzt, zeigt es das Bild. */
const BildKnopf = (e: BildWahlEigenschaften) => {
	const { abb, aendere, name, wert } = e;
	const { dazu, oeffneDatei, oeffneSammlung } = useBildWahl(e);
	const ausloeser = (
		<button
			type="button"
			className="flex size-(--hoehe-feld) flex-none items-center justify-center overflow-hidden rounded-md border border-rand-feld bg-flaeche text-leise hover:bg-flaeche-2"
			data-bild-knopf={wert ? 'gesetzt' : 'leer'}
		>
			{wert ? (
				<img className="size-full object-contain" alt="" src={`${abb.bildBasis}${wert}`} />
			) : (
				<Symbol name="bild" />
			)}
		</button>
	);
	return (
		<>
			<Menue
				name={name}
				eintraege={[
					{ titel: 'Aus Bildern wählen', waehle: oeffneSammlung },
					{ titel: 'Hochladen', waehle: oeffneDatei },
					...(wert ? [{ titel: 'Bild entfernen', gefahr: true, waehle: () => aendere('', true) }] : []),
				]}
				ausloeser={ausloeser}
			/>
			{dazu}
		</>
	);
};

const MINI_BEISPIEL: Record<string, string> = {
	uhr: '7:30',
	wuerfel: '5',
	menge: '7',
	geld: '2€ 50ct',
	rhythmus: '4 8 8 4',
};

const mitMiniArt = (art: string, inhalt: string) => (art ? `${art}:${inhalt}` : inhalt);

/** Art eines Feldinhalts: Im Attribut steht `uhr:7:30`, Text ohne Vorsatz. Steht im ⋯ der Zeile (G3). */
const MiniArt = ({
	aendere,
	name,
	wert,
}: {
	wert: string;
	name: string;
	aendere: (neu: string, sofort: boolean) => void;
}) => {
	const { art, inhalt } = miniTeile(wert);
	return (
		<select
			aria-label={`Art: ${name}`}
			className={`${EINGABE} w-full`}
			value={art}
			onChange={(e) => {
				const neu = e.target.value;
				aendere(mitMiniArt(neu, neu === art ? inhalt : (MINI_BEISPIEL[neu] ?? '')), true);
			}}
		>
			{MINI_ARTEN.map((o) => (
				<option key={o.wert} value={o.wert}>
					{o.name}
				</option>
			))}
		</select>
	);
};

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
	return art === 'bild' ? (
		<BildKnopf abb={abb} aendere={(w, sofort) => aendere(mitMiniArt(art, w), sofort)} name={name} wert={inhalt} />
	) : (
		<input
			type="text"
			aria-label={name}
			placeholder={MINI_BEISPIEL[art] ?? name.replace(/ in Zeile \d+$/, '')}
			enterKeyHint="done"
			autoComplete="off"
			className={`${EINGABE} w-full min-w-0`}
			value={inhalt}
			onChange={(e) => aendere(mitMiniArt(art, e.target.value), false)}
			onBlur={uebernimm}
			onKeyDown={fertigMitEnter}
		/>
	);
};

/** Füllung in einer Zeile: ein kleines Feld, das die Muster aufklappt. */
const MusterKnopf = ({
	aendere,
	name,
	optionen,
	sw,
	wert,
}: {
	optionen: Option[];
	name: string;
	sw: boolean;
	wert: string;
	aendere: (neu: string, sofort: boolean) => void;
}) => {
	const ausloeser = (
		<button
			type="button"
			className="size-(--hoehe-feld) flex-none rounded-md border border-rand-feld"
			style={{ background: (sw ? MUSTER_BILD : FARB_BILD)[wert] ?? '#fff' }}
			data-muster-knopf={wert}
		/>
	);
	return (
		<Popover name={name} className="w-auto" ausloeser={ausloeser}>
			{(schliessen) => (
				<div className="w-52">
					<Muster
						optionen={optionen}
						aktiv={wert}
						name={name}
						sw={sw}
						setze={(w) => {
							aendere(w, true);
							schliessen();
						}}
					/>
				</div>
			)}
		</Popover>
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
		return <BildKnopf abb={abb} aendere={aendere} name={name} wert={wert} />;
	}
	if (u.art === 'mini') {
		return <MiniEingabe abb={abb} aendere={aendere} name={name} uebernimm={uebernimm} wert={wert} />;
	}
	if (u.art === 'muster') {
		return <MusterKnopf optionen={u.optionen ?? []} wert={wert} name={name} sw={abb.sw} aendere={aendere} />;
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

/** Breite einer Spalte in der Zeile: Zahlen und Symbole so schmal wie möglich, Text teilt sich den Rest. */
const spaltenKlasse = (u: UnterFeld) => {
	if (u.art === 'zahl') {
		return 'w-12 flex-none';
	}
	if (u.art === 'bild' || u.art === 'muster') {
		return 'flex-none';
	}
	return u.breit ? 'min-w-0 flex-[1.5]' : 'min-w-0 flex-1';
};

/** Griff zum Umsortieren: Der Zug sagt nur, wohin; geschrieben wird erst beim Loslassen, ein Schritt im Verlauf. */
const useZeilenZug = (verschiebe: (von: number, nach: number) => void) => {
	const behaelter = useRef<HTMLDivElement>(null);
	const [zug, setZug] = useState<{ von: number; nach: number } | null>(null);
	const zielBei = (y: number) => {
		const zeilen = [...(behaelter.current?.querySelectorAll(':scope > [data-zeile]') ?? [])];
		const i = zeilen.findIndex((z) => {
			const r = z.getBoundingClientRect();
			return y < r.top + r.height / 2;
		});
		return i < 0 ? zeilen.length : i;
	};
	const greife = (von: number, e: ReactPointerEvent<HTMLButtonElement>) => {
		if (e.button !== 0) {
			return;
		}
		e.preventDefault();
		const griff = e.currentTarget;
		const start = e.clientY;
		let y = start;
		let laeuft = false;
		const rolle = behaelter.current?.closest('.overflow-y-auto') ?? null;
		const hoereAuf = folgeZeiger({
			bewegen: (m) => {
				y = m.clientY;
				if (!laeuft && Math.abs(y - start) >= 4) {
					laeuft = true;
					// Stünde der Fokus im Blatt, käme Esc dort an und wählte das Elternteil, statt den Zug abzubrechen.
					// `blur()` am Rahmen gibt ihn in Safari nicht frei, der Griff nimmt ihn.
					griff.focus({ preventScroll: true });
					setZug({ von, nach: zielBei(y) });
				}
			},
			los: (m) => {
				hoereAuf();
				setZug(null);
				if (laeuft) {
					schluckeKlick();
					verschiebe(von, zielBei(m.clientY));
				}
			},
			abbruch: () => {
				hoereAuf();
				setZug(null);
			},
			taste: (k) => {
				if (k.key === 'Escape') {
					k.preventDefault();
					k.stopPropagation();
					hoereAuf();
					setZug(null);
				}
			},
			bild: () => {
				if (laeuft) {
					if (rolle) {
						rolleAmRand(rolle, y);
					}
					setZug({ von, nach: zielBei(y) });
				}
			},
			sperrtRollen: () => laeuft,
		});
	};
	return { behaelter, zug, greife };
};

/** Was nicht in die Zeile passt: Art, Schalter, Entfernen. ↑ ↓ nur am Finger, die Maus nimmt den Griff. */
const ZeilenMenue = ({
	abb,
	aendere,
	entfernen,
	i,
	nachOben,
	nachUnten,
	u,
	uebernimm,
	zeile,
}: {
	abb: AbbildungSteuerung;
	u: UnterFeld[];
	zeile: string[];
	i: number;
	aendere: (j: number, wert: string, sofort: boolean) => void;
	uebernimm: () => void;
	entfernen: (() => void) | null;
	nachOben: (() => void) | null;
	nachUnten: (() => void) | null;
}) => {
	const ausloeser = (
		<button
			type="button"
			className="flex size-(--hoehe-feld) flex-none items-center justify-center rounded-md text-leise hover:bg-flaeche-2"
			data-zeile-mehr={i}
		>
			<Symbol name="mehr" />
		</button>
	);
	return (
		<Popover name={`Zeile ${i + 1}: mehr`} ausrichtung="end" ausloeser={ausloeser}>
			<div className="flex flex-col gap-2">
				{u.map((unter, j) =>
					unter.art === 'mini' ? (
						<MiniArt
							key={unter.name}
							name={`${unter.name} in Zeile ${i + 1}`}
							wert={zeile[j] ?? ''}
							aendere={(w, sofort) => aendere(j, w, sofort)}
						/>
					) : (
						unter.art === 'schalter' && (
							<UnterEingabe
								key={unter.name}
								u={unter}
								abb={abb}
								name={`${unter.name} in Zeile ${i + 1}`}
								wert={zeile[j] ?? ''}
								aendere={(w, sofort) => aendere(j, w, sofort)}
								uebernimm={uebernimm}
							/>
						)
					),
				)}
				<div className="hidden gap-2 [@media(any-pointer:coarse)]:flex">
					<Knopf
						art="zweit"
						className="flex-1"
						aria-label={`Zeile ${i + 1} nach oben`}
						disabled={!nachOben}
						onClick={() => nachOben?.()}
					>
						↑
					</Knopf>
					<Knopf
						art="zweit"
						className="flex-1"
						aria-label={`Zeile ${i + 1} nach unten`}
						disabled={!nachUnten}
						onClick={() => nachUnten?.()}
					>
						↓
					</Knopf>
				</div>
				<Knopf
					art="zweit"
					aria-label={`Zeile ${i + 1} löschen`}
					disabled={!entfernen}
					onClick={() => entfernen?.()}
				>
					<Symbol name="papierkorb" />
					Entfernen
				</Knopf>
			</div>
		</Popover>
	);
};

/** Viele Einträge auf einmal: eine Zeile je Eintrag. Ersetzt das Klicken durch 30 Felder. */
const ListeAlsText = ({
	abb,
	feld,
	schreibe,
	zeilen,
}: FeldEigenschaften<ListeFeld> & { zeilen: string[][]; schreibe: (neu: string[][], sofort: boolean) => void }) => {
	const [text, setText] = useState(() => zeilenAlsText(feld, zeilen));
	return (
		<textarea
			aria-label={`${feld.name} als Text`}
			rows={Math.min(14, zeilen.length + 2)}
			autoComplete="off"
			autoFocus
			className={`${EINGABE} h-auto w-full py-2`}
			data-liste-text={feld.attribut}
			value={text}
			onChange={(e) => {
				setText(e.target.value);
				schreibe(zeilenAusText(feld, e.target.value), false);
			}}
			onBlur={abb.uebernimm}
		/>
	);
};

/** Eine Zeile je Eintrag: Griff, Text, ⋯. Was die Zeile sonst sprengt, liegt im ⋯ oder hinter einem Symbol (G3). */
const Liste = ({ abb, feld }: FeldEigenschaften<ListeFeld>) => {
	const id = useId();
	const [alsText, setAlsText] = useState(false);
	const zeilen = zeilenVon(feld, wertVon(feld, abb)?.wert ?? null);
	const schreibe = (neu: string[][], sofort = true) =>
		abb.aendere(feld, zeilenText(feld, neu), { uebernehmen: sofort });
	const mitZelle = (i: number, j: number, wert: string) =>
		zeilen.map((z, n) => (n === i ? feld.unter.map((_, m) => (m === j ? wert : (z[m] ?? ''))) : z));
	const verschiebe = (von: number, nach: number) => {
		const ziel = nach > von ? nach - 1 : nach;
		const neu = [...zeilen];
		const [zeile] = neu.splice(von, 1);
		if (zeile && ziel !== von) {
			neu.splice(ziel, 0, zeile);
			schreibe(neu);
		}
	};
	const { behaelter, greife, zug } = useZeilenZug(verschiebe);
	/** Die Einfügemarke steht unter der letzten Zeile. */
	const unterLetzter = (i: number) => zug?.nach === zeilen.length && i === zeilen.length - 1;
	const griffTaste = (i: number, e: KeyboardEvent<HTMLButtonElement>) => {
		const ziel = { ArrowUp: i - 1, ArrowDown: i + 1 }[e.key];
		if (ziel === undefined || ziel < 0 || ziel >= zeilen.length) {
			return;
		}
		e.preventDefault();
		verschiebe(i, ziel > i ? ziel + 1 : ziel);
		const griffe = behaelter.current?.querySelectorAll<HTMLButtonElement>('[data-zeile-griff]');
		griffe?.[ziel]?.focus();
	};
	const spalten = feld.unter.filter((u) => u.art !== 'schalter');
	const sortierbar = feld.sortierbar !== false;
	const voll = feld.max !== undefined && zeilen.length >= feld.max;
	const ohneZeile = feld.min !== undefined && zeilen.length <= feld.min;
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			{alsText ? (
				<ListeAlsText abb={abb} feld={feld} zeilen={zeilen} schreibe={schreibe} />
			) : (
				<div ref={behaelter} className="flex flex-col gap-0.5" data-liste={feld.attribut}>
					{spalten.length > 1 && zeilen.length > 0 && (
						<div
							className={klassen(
								'flex items-center gap-1 pr-[calc(var(--hoehe-feld)+0.25rem)] text-xs text-leise',
								sortierbar && 'pl-6',
							)}
							data-liste-kopf
						>
							{spalten.map((u) =>
								u.art === 'bild' || u.art === 'muster' ? (
									<Tooltip key={u.name} text={u.name}>
										<span className="w-(--hoehe-feld) flex-none" />
									</Tooltip>
								) : (
									<span key={u.name} className={klassen(spaltenKlasse(u), 'truncate')}>
										{u.name}
									</span>
								),
							)}
						</div>
					)}
					{zeilen.map((zeile, i) => (
						// Zeilen tragen keine eigene Kennung; beim Verschieben folgen die Werte dem Entwurf.
						<div
							key={String(i)}
							className={klassen(
								'flex items-center gap-1 rounded-sm',
								zug?.von === i && 'opacity-40',
								zug?.nach === i && 'shadow-[0_-2px_0_0_var(--color-brand-500)]',
								unterLetzter(i) && 'shadow-[0_2px_0_0_var(--color-brand-500)]',
							)}
							data-zeile={i}
						>
							{sortierbar && (
								<Griff
									beschriftung={`Zeile ${i + 1} verschieben`}
									className="h-feld"
									data-zeile-griff={i}
									onPointerDown={(e) => greife(i, e)}
									onKeyDown={(e) => griffTaste(i, e)}
								/>
							)}
							{feld.unter.flatMap((u, j) =>
								u.art === 'schalter'
									? []
									: [
											<div key={u.name} className={spaltenKlasse(u)}>
												<UnterEingabe
													u={u}
													abb={abb}
													name={`${u.name} in Zeile ${i + 1}`}
													wert={zeile[j] ?? ''}
													aendere={(w, sofort) => schreibe(mitZelle(i, j, w), sofort)}
													uebernimm={abb.uebernimm}
												/>
											</div>,
										],
							)}
							<ZeilenMenue
								abb={abb}
								u={feld.unter}
								zeile={zeile}
								i={i}
								aendere={(j, w, sofort) => schreibe(mitZelle(i, j, w), sofort)}
								uebernimm={abb.uebernimm}
								entfernen={ohneZeile ? null : () => schreibe(zeilen.filter((_, n) => n !== i))}
								nachOben={!sortierbar || i === 0 ? null : () => verschiebe(i, i - 1)}
								nachUnten={!sortierbar || i === zeilen.length - 1 ? null : () => verschiebe(i, i + 2)}
							/>
						</div>
					))}
				</div>
			)}
			<div className="mt-1 flex flex-wrap gap-1">
				{!alsText && (
					<Knopf
						art="zweit"
						groesse="klein"
						disabled={voll}
						onClick={() => schreibe([...zeilen, feld.unter.map((u) => u.standard ?? '')])}
						data-zeile-neu={feld.attribut}
					>
						<Symbol name="plus" />
						Zeile hinzufügen
					</Knopf>
				)}
				{feld.alsText && (
					<Knopf
						art="zweit"
						groesse="klein"
						onClick={() => setAlsText(!alsText)}
						data-liste-als-text={feld.attribut}
					>
						{alsText ? 'Als Liste bearbeiten' : 'Als Text bearbeiten'}
					</Knopf>
				)}
			</div>
		</Rahmen>
	);
};

/** Am Mac teilen sich die Zellen die Breite, bis 14 px herunter: So passen 16 Spalten ohne Bildlauf. Am Finger bleiben sie 44 px, dann mit sichtbarem Bildlauf (G2). */
const ZELLE =
	'flex min-w-0 items-center justify-center overflow-hidden rounded-sm border border-rand text-xs font-medium tabular-nums [@media(any-pointer:coarse)]:rounded-md [@media(any-pointer:coarse)]:text-base';
const ZELLE_RASTER = 'h-6 [@media(any-pointer:coarse)]:h-knopf';
const ZELLEN_SPALTEN =
	'[--zellen-spalte:minmax(14px,1fr)] [@media(any-pointer:coarse)]:[--zellen-spalte:minmax(44px,44px)]';
const ZELLEN_ROLLEN =
	'max-w-full overflow-x-auto [scrollbar-width:thin] [scrollbar-color:var(--color-rand-feld)_transparent]';

/**
 * 197-02: Wie viele Spalten oder Zeilen ein Raster im Panel hat, aus geprüften Werten und auf die Grenzen des Felds
 * gesetzt. Ein Entwurf wie „9999“ baut so kein Raster aus Zehntausenden Knöpfen, auch eine zu große Quelle nicht.
 */
const rasterMass = (angabe: string | number | undefined, abb: AbbildungSteuerung, sonst: number) => {
	if (typeof angabe === 'number') {
		return angabe;
	}
	const feld = abb.schema?.felder.find((f) => f.attribut === angabe);
	const roh = angabe ? abb.geprueft?.[angabe] : null;
	const n = roh ? alsZahl(roh) : NaN;
	if (feld?.art !== 'zahl') {
		return Number.isFinite(n) ? Math.max(1, Math.min(n, 100)) : sonst;
	}
	return Math.round(Math.min(feld.max, Math.max(feld.min, Number.isFinite(n) ? n : feld.standard)));
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
	const anteil = (n: number, von: number) => `${(n / von) * 100}%`;
	return (
		<div className={ZELLEN_ROLLEN}>
			<div
				className="relative max-w-(--voll) min-w-(--min) [--min:calc(var(--spalten)*14px)] [@media(any-pointer:coarse)]:min-w-(--voll) [--voll:calc(var(--spalten)*46px)]"
				style={{ '--spalten': breite, 'aspectRatio': `${breite} / ${hoehe}` } as CSSProperties}
				data-form-raster={feld.attribut}
			>
				{zellen.map((z) => (
					<button
						key={z.id}
						type="button"
						aria-pressed={gewaehlt.includes(z.id)}
						aria-label={`Feld ${z.text ?? z.id}`}
						data-zelle={z.id}
						className={klassen(
							ZELLE,
							'absolute box-border',
							gewaehlt.includes(z.id)
								? 'border-brand-500 bg-brand-500 text-white'
								: 'bg-flaeche text-leise',
						)}
						style={{
							left: anteil(z.x, breite),
							top: anteil(z.y, hoehe),
							width: `calc(${anteil(z.b ?? 1, breite)} - 2px)`,
							height: `calc(${anteil(z.h ?? 1, hoehe)} - 2px)`,
						}}
						onClick={() => setze(z.id)}
					>
						{z.text}
					</button>
				))}
			</div>
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
			<div className={ZELLEN_ROLLEN} data-raster={feld.attribut}>
				<div
					className={klassen('grid gap-0.5 [@media(any-pointer:coarse)]:w-fit', ZELLEN_SPALTEN)}
					style={{ gridTemplateColumns: `repeat(${spalten}, var(--zellen-spalte))` }}
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
									className={klassen(
										ZELLE,
										ZELLE_RASTER,
										'w-full bg-flaeche text-center focus:border-brand-500 focus:outline-none',
									)}
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
									className={klassen(
										ZELLE,
										ZELLE_RASTER,
										zelle === leer ? 'bg-flaeche' : 'border-brand-500 bg-brand-500 text-white',
									)}
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
	// 197-02: Die Planquadrate entstehen nur aus geprüften, begrenzten Werten.
	const spalten = rasterMass('spalten', abb, 6);
	const zeilen = rasterMass('zeilen', abb, 5);
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
			<div className={ZELLEN_ROLLEN} id={id} data-plan>
				<div
					className={klassen('grid gap-0.5 [@media(any-pointer:coarse)]:w-max', ZELLEN_SPALTEN)}
					style={{ gridTemplateColumns: `repeat(${spalten}, var(--zellen-spalte))` }}
				>
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
								className={`aspect-square min-w-0 overflow-hidden rounded border text-[10px] ${gewaehlt === z.q ? 'border-brand-500' : 'border-rand'}`}
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
			return feld.jeZeileVon ? (
				<ZahlenJeZeile feld={feld} abb={abb} liste={feld.jeZeileVon} />
			) : (
				<Zahlen feld={feld} abb={abb} />
			);
		case 'paar':
			return <Paar feld={feld} abb={abb} />;
		case 'zeitspanne':
			return <Zeitspanne feld={feld} abb={abb} />;
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
					Das ist das Beispiel. Die Lösung bleibt sichtbar.
				</p>
			)}
			{abb.schema.zustand && abb.schema.felder.length === 0 && (
				<p className="text-sm text-leise" data-abbildung-zustand>
					{abb.schema.zustand}
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
				<div className="flex items-center justify-between gap-2" role="status" data-nicht-uebernommen>
					<p className="text-xs">Noch nicht gespeichert.</p>
					<Knopf art="zweit" onClick={abb.zuruecksetzen}>
						<Symbol name="rueckgaengig" />
						Zurücksetzen
					</Knopf>
				</div>
			)}
		</>
	);
};

const sichtbarWenn = (feld: Feld, abb: AbbildungSteuerung) => !feld.nurWenn || !abb.werte || feld.nurWenn(abb.werte);

/** Die Felder der gewählten Abbildung, die in diesen Abschnitt gehören. Jede Änderung zeigt sich sofort im Blatt. */
export const AbbildungFelder = ({ abb, abschnitt }: { abb: AbbildungSteuerung; abschnitt: AbschnittName }) => {
	if (!abb.aktiv || !abb.schema) {
		return null;
	}
	const felder = abb.schema.felder.filter(
		(f) => abschnittVon(f) === abschnitt && !f.ohneFeld && sichtbarWenn(f, abb),
	);
	const rest = felder;
	// Eine Überschrift lohnt erst ab zwei Feldern; „Mehr“ ist nur der Sammelplatz.
	const ueberschrift = (feld: Feld) =>
		feld.gruppe && feld.gruppe !== 'Mehr' && rest.filter((f) => f.gruppe === feld.gruppe).length > 1
			? feld.gruppe
			: undefined;
	// 197-06: „Neue Zahlen“ als erste Zeile unter „Inhalt“; bleibt beim Rollen oben.
	const wuerfel = abschnitt === 'inhalt' && abb.hatNeueZahlen;
	return felder.length === 0 && !wuerfel ? null : (
		<div className="flex flex-col gap-1">
			{wuerfel && (
				<div className="sticky top-0 z-10 bg-flaeche py-1" data-neue-zahlen>
					<Knopf art="zweit" disabled={!abb.aktiv} onClick={() => abb.neueZahlen()}>
						<Symbol name="neueZahlen" />
						Neue Zahlen
					</Knopf>
				</div>
			)}
			{rest.map((feld, i) => {
				const gruppe = ueberschrift(feld);
				return (
					// Ein anderes Element bekommt frische Felder: Getipptes und der alte Wert bleiben nicht hängen.
					<Fragment key={`${String(abb.nr)}-${abb.schema?.name ?? ''}-${feld.attribut}`}>
						{gruppe && rest[i - 1]?.gruppe !== feld.gruppe && (
							<h4 className="mt-2 text-xs font-medium text-dezent" data-feldgruppe={gruppe}>
								{gruppe}
							</h4>
						)}
						{feld.attribut === abb.schema?.generiert && abb.eigeneAufgaben && (
							<p className="text-xs text-leise" data-eigene-aufgaben>
								Eigene Aufgaben. Die Einstellungen oben wirken erst wieder nach ‚Neue Zahlen‘.
							</p>
						)}
						<Eingabe feld={feld} abb={abb} />
					</Fragment>
				);
			})}
		</div>
	);
};
