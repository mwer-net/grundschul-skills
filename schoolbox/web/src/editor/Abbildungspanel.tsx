import type {
	AuswahlFeld,
	Feld,
	ListeFeld,
	MarkierungFeld,
	MehrfachFeld,
	MischenFeld,
	MusterFeld,
	Option,
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
	rasterText,
	rasterVon,
	stellenVon,
	zeilenText,
	zeilenVon,
	ziffernText,
} from '@schoolbox/kern/src/abbildungen';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import type { AbbildungSteuerung } from './abbildung';

const EINGABE =
	'min-h-12 rounded-xl border-2 border-rand bg-white px-3 focus:border-brand-500 focus:outline-none disabled:opacity-50 aria-invalid:border-fehler';

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
}) => (
	<label className="mt-1 flex min-h-11 cursor-pointer items-center gap-3 has-disabled:cursor-default has-disabled:opacity-50">
		<input
			type="checkbox"
			className="size-6 flex-none accent-brand-500"
			checked={aktiv}
			disabled={aus}
			onChange={(e) => setze(e.target.checked)}
		/>
		{name}
	</label>
);

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
	feld,
	id,
}: {
	feld: Feld;
	abb: AbbildungSteuerung;
	id: string;
	children: ReactNode;
}) => {
	const fehler = abb.fehler[feld.attribut];
	return (
		<div className="mt-5" data-feld={feld.attribut}>
			<label htmlFor={id} className="font-bold">
				{feld.name}
			</label>
			<div className="mt-2">{children}</div>
			{feld.hilfe && <p className="mt-1 text-leise">{feld.hilfe}</p>}
			{feld.loesung && <LoesungSchalter feld={feld} abb={abb} />}
			{fehler && (
				<p className="mt-2 flex gap-2 font-bold text-fehler" role="alert" data-fehler={feld.attribut}>
					<Symbol name="achtung" className="size-5 flex-none" />
					{fehler}
				</p>
			)}
		</div>
	);
};

const Zahl = ({ abb, feld }: FeldEigenschaften<ZahlFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const { feld: eingabe, setText, text } = useEingabe(wert ?? String(feld.standard));
	const jetzt = alsZahl(wert ?? String(feld.standard));
	const schritt = feld.schritt ?? 1;
	const springe = (richtung: 1 | -1) => {
		const basis = Number.isFinite(jetzt) ? jetzt : feld.standard;
		const neu = Math.min(
			feld.max,
			Math.max(feld.min, Math.round((basis + richtung * schritt) / schritt) * schritt),
		);
		setText(String(neu));
		abb.aendere(feld, String(neu));
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="flex items-center gap-2">
				<Knopf
					art="zweit"
					className="w-12 flex-none px-0"
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
					className={`${EINGABE} w-24 text-center text-lg font-bold`}
					aria-invalid={Boolean(abb.fehler[feld.attribut])}
					value={text}
					onChange={(e) => {
						setText(e.target.value);
						const roh = e.target.value.trim();
						abb.aendere(feld, roh === '' ? null : roh, { uebernehmen: false });
					}}
					onBlur={() => {
						setText(wert ?? String(feld.standard));
						abb.uebernimm();
					}}
					onKeyDown={fertigMitEnter}
				/>
				<Knopf
					art="zweit"
					className="w-12 flex-none px-0"
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

/** Stunde und Minute (in 5er-Schritten) als Auswahl; Werte aus der Quelle außerhalb davon bleiben wählbar. */
const Uhrzeit = ({ abb, feld }: FeldEigenschaften<UhrzeitFeld>) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const teile = /^(\d{1,2}):(\d{2})$/.exec(wert ?? '');
	const stunde = teile ? Number(teile[1]) : null;
	const minute = teile ? Number(teile[2]) : null;
	const stunden = stunde === null || STUNDEN.includes(stunde) ? STUNDEN : [stunde, ...STUNDEN];
	const minuten = minute === null || MINUTEN.includes(minute) ? MINUTEN : [...MINUTEN, minute].sort((a, b) => a - b);
	const setze = (h: number | null, m: number | null) =>
		abb.aendere(feld, h === null ? null : `${h}:${zweistellig(m ?? 0)}`);
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div className="flex items-center gap-2" data-uhrzeit>
				<select
					id={id}
					aria-label="Stunde"
					className={`${EINGABE} w-24 text-lg font-bold`}
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
				<span className="text-xl font-bold">:</span>
				<select
					aria-label="Minuten"
					className={`${EINGABE} w-24 text-lg font-bold`}
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
				<span className="text-leise">Uhr</span>
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
		<Rahmen feld={feld} abb={abb} id={id}>
			<select
				id={id}
				className={`${EINGABE} w-full`}
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
		<div className="mt-4" data-feld={feld.attribut}>
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
						<span className="font-bold text-leise">{stelle}</span>
						<input
							id={i === 0 ? id : undefined}
							type="text"
							inputMode="numeric"
							enterKeyHint="done"
							autoComplete="off"
							maxLength={2}
							aria-label={`${feld.name}: ${stelle}`}
							className={`${EINGABE} w-14 px-0 text-center text-lg font-bold`}
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
						const neu = `${text.slice(0, stelle)}${feld.einfuegen?.zeichen ?? ''}${text.slice(stelle)}`;
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
				className={`size-11 rounded-xl border-2 ${aktiv === o.wert ? 'border-brand-500 ring-2 ring-brand-500' : 'border-rand'}`}
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
	const setze = (wert: string, an: boolean) => {
		const neu = feld.optionen.map((o) => o.wert).filter((w) => (w === wert ? an : gewaehlt.includes(w)));
		const gleich = feld.standard && neu.join(' ') === feld.standard.join(' ');
		abb.aendere(feld, gleich || (neu.length === 0 && !feld.standard) ? null : neu.join(' '));
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div data-mehrfach>
				{feld.optionen.map((o) => (
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
			<Symbol name="rueckgaengig" />
			{feld.knopf ?? 'Neu mischen'}
		</Knopf>
		{feld.hilfe && <p className="mt-1 text-leise">{feld.hilfe}</p>}
	</div>
);

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
					<div key={String(i)} className="rounded-xl border-2 border-rand p-2" data-zeile={i}>
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
	'flex min-h-11 min-w-11 items-center justify-center rounded-md border-2 border-rand bg-white text-base font-bold';

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
							className={`min-h-11 border-2 px-2 ${anfang ? 'rounded-l-xl' : '-ml-1.5 border-l-0'} ${schluss ? 'rounded-r-xl' : 'border-r-0'} ${gewaehlt === i ? 'border-brand-500 bg-brand-50' : 'border-rand bg-white'}`}
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
		case 'markierung':
			return <Markierung feld={feld} abb={abb} />;
		default:
			return null;
	}
};

/** Felder der Reihe nach, gleiche `gruppe` zusammen; Felder ohne Gruppe stehen für sich. */
const gruppen = (felder: Feld[]) => {
	const liste: { name: string | null; felder: Feld[] }[] = [];
	for (const feld of felder) {
		const name = feld.gruppe ?? null;
		const letzte = liste.at(-1);
		if (letzte && letzte.name === name) {
			letzte.felder.push(feld);
		} else {
			liste.push({ name, felder: [feld] });
		}
	}
	return liste;
};

/**
 * Einstellungen der gewählten Abbildung nach ihrem Schema. Jede Änderung zeigt sich sofort im Blatt und ist ein
 * Schritt im Verlauf; was nicht stimmt, wird nicht gespeichert.
 */
export const Abbildungswerkzeug = ({ abb }: { abb: AbbildungSteuerung }) => {
	const { schema } = abb;
	if (!abb.aktiv || !schema) {
		return null;
	}
	const ungueltig = Object.keys(abb.fehler).length > 0;
	return (
		<div className="mt-1" data-abbildungswerkzeug>
			{abb.beispiel && (
				<p className="mt-2 flex gap-2 rounded-xl bg-brand-50 p-3" data-hinweis="beispiel">
					<Symbol name="blatt" className="size-5 flex-none" />
					Das ist das Beispiel. Die Lösung ist auf dem Arbeitsblatt sichtbar.
				</p>
			)}
			{gruppen(schema.felder).map(({ felder, name }, i) =>
				name ? (
					<details key={name} className="mt-4 border-t-2 border-rand pt-2" open={i === 0} data-gruppe={name}>
						<summary className="flex min-h-11 cursor-pointer items-center font-bold">{name}</summary>
						{felder.map((feld) => (
							<Eingabe key={feld.attribut} feld={feld} abb={abb} />
						))}
					</details>
				) : (
					felder.map((feld) => <Eingabe key={feld.attribut} feld={feld} abb={abb} />)
				),
			)}
			{abb.info && (
				<p className="mt-4 text-leise" data-abbildung-info>
					{abb.info}
				</p>
			)}
			{abb.fehler._element && (
				<p className="mt-4 flex gap-2 font-bold text-fehler" role="alert" data-fehler="_element">
					<Symbol name="achtung" className="size-5 flex-none" />
					{abb.fehler._element}
				</p>
			)}
			{ungueltig && abb.offen && (
				<div className="mt-5 rounded-xl bg-[#fff8e1] p-3" role="status" data-nicht-uebernommen>
					<p>Noch nicht gespeichert, weil eine Angabe nicht passt.</p>
					<Knopf art="zweit" className="mt-2" onClick={abb.zuruecksetzen}>
						<Symbol name="rueckgaengig" />
						Zurücksetzen
					</Knopf>
				</div>
			)}
		</div>
	);
};
