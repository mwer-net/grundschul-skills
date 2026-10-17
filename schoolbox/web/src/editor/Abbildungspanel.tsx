import type {
	AuswahlFeld,
	Feld,
	SchalterFeld,
	UhrzeitFeld,
	ZahlenFeld,
	ZahlFeld,
	ZiffernFeld,
} from '@schoolbox/kern/src/abbildungen';
import { alsZahl, feldWert, listeVon, stellenVon, ziffernText } from '@schoolbox/kern/src/abbildungen';
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
	const bekannt = feld.optionen.some((o) => o.wert === wert);
	const optionen = bekannt ? feld.optionen : [...feld.optionen, { wert, name: wert ?? '–' }];
	const index = optionen.findIndex((o) => o.wert === wert);
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
		default:
			return null;
	}
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
			{schema.felder.map((feld) => (
				<Eingabe key={feld.attribut} feld={feld} abb={abb} />
			))}
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
