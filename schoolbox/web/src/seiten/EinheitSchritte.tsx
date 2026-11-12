import type { Antworten, EinheitWahl } from '@schoolbox/kern/src/assistent';
import {
	EINHEIT_AUSSEHEN_WAHL,
	EINHEIT_BESTANDTEILE,
	EINHEIT_FELDER,
	EINHEIT_LEITFIGUR_NAME,
	EINHEIT_MENGE_NAME,
	einheitAngabenAus,
	einheitBestandteile,
	einheitRahmen,
	FREITEXT,
	ZIEL_ANFAENGE,
} from '@schoolbox/kern/src/assistent';
import {
	EINHEIT_AUFTRAG_ZEICHEN,
	EINHEIT_AUSSEHEN,
	EINHEIT_DAUER,
	EINHEIT_LEITFIGUR,
	EINHEIT_MENGE,
	EINHEIT_VERBRAUCH,
	einheitAuftragAus,
} from '@schoolbox/kern/src/einheit';
import type { ReactNode } from 'react';

import { Chip } from '../bausteine/Chip';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Schalter } from '../bausteine/Schalter';
import { Segment } from '../bausteine/Segment';
import { Symbol } from '../bausteine/Symbol';
import type { limitHinweis } from '../editor/ki';
import { LimitZeile } from '../editor/LimitZeile';
import type { Ordnerangabe } from './anlegen-hilfe';
import type { AuftragText } from './AnlegenSchritte';
import { Empfohlen, Etikett, OrdnerFeld, TitelFeld } from './AnlegenSchritte';

/** Die Schritte der Unterrichtseinheit im Assistenten (140, Entwurf E1). Daten aus `assistent.ts` und `einheit.ts`. */

const FELD = `${FELD_KLASSEN} w-full`;

type SetzeEh = (teil: Partial<EinheitWahl>) => void;

const EinheitFeld = ({
	feld,
	fokus,
	mehrzeilig,
	setze,
	wert,
}: {
	feld: keyof typeof EINHEIT_FELDER;
	wert: string;
	setze: (text: string) => void;
	mehrzeilig?: boolean;
	fokus?: boolean;
}) => {
	const f = EINHEIT_FELDER[feld];
	return mehrzeilig ? (
		<textarea
			className={klassen(FELD_KLASSEN, 'h-auto w-full py-1.5')}
			rows={3}
			aria-label={f.name}
			placeholder={f.platz}
			maxLength={f.zeichen}
			value={wert}
			data-einheit-feld={feld}
			onChange={(e) => setze(e.target.value)}
		/>
	) : (
		<input
			className={FELD}
			aria-label={f.name}
			placeholder={f.platz}
			maxLength={f.zeichen}
			value={wert}
			autoFocus={fokus}
			data-einheit-feld={feld}
			onChange={(e) => setze(e.target.value)}
		/>
	);
};

const Zeile = ({ children, ...daten }: { 'children': ReactNode; 'data-einheit-aussehen'?: string }) => (
	<div className="mb-4 flex flex-wrap items-center gap-3" {...daten}>
		{children}
	</div>
);

export const SchrittEThema = ({
	a,
	setze,
	setzeEh,
}: {
	a: Antworten;
	setze: (teil: Partial<Antworten>) => void;
	setzeEh: SetzeEh;
}) => {
	const ziele = a.eh.ziele.length > 0 ? a.eh.ziele : [''];
	const setzeZiel = (i: number, text: string) => setzeEh({ ziele: ziele.map((z, j) => (j === i ? text : z)) });
	return (
		<>
			<label className="mb-4 block">
				<Etikett>{FREITEXT.thema.name}</Etikett>
				<input
					className={FELD}
					placeholder="z. B. Uhrzeit: volle und halbe Stunden"
					maxLength={FREITEXT.thema.zeichen}
					value={a.thema}
					data-fokus
					onChange={(e) => setze({ thema: e.target.value })}
				/>
			</label>
			<div className="mb-4" data-einheit-ziele>
				<Etikett zusatz="optional, mehrere">Ich-kann-Ziele</Etikett>
				<div className="flex flex-col gap-1.5">
					{ziele.map((z, i) => (
						<input
							key={i}
							className={FELD}
							aria-label={`Ich-kann-Ziel ${i + 1}`}
							placeholder={i === 0 ? EINHEIT_FELDER.ziel.platz : ''}
							maxLength={EINHEIT_FELDER.ziel.zeichen}
							value={z}
							onChange={(e) => setzeZiel(i, e.target.value)}
						/>
					))}
				</div>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{ziele.length < 8 && (
						<Knopf art="leise" groesse="klein" onClick={() => setzeEh({ ziele: [...ziele, ''] })}>
							<Symbol name="plus" />
							Weiteres Ziel
						</Knopf>
					)}
					{ZIEL_ANFAENGE.map((anfang) => (
						<button
							key={anfang}
							type="button"
							className="inline-flex h-knopf-klein items-center rounded-md border border-dashed border-rand-feld px-2 text-sm text-leise hover:bg-flaeche-2"
							onClick={() => {
								const leer = ziele.findIndex((z) => z.trim() === '');
								setzeEh({
									ziele:
										leer >= 0 ? ziele.map((z, j) => (j === leer ? anfang : z)) : [...ziele, anfang],
								});
							}}
						>
							{`+ ${anfang.trim()} …`}
						</button>
					))}
				</div>
			</div>
			<label className="block">
				<Etikett zusatz="optional">{EINHEIT_FELDER.vorwissen.name}</Etikett>
				<EinheitFeld
					feld="vorwissen"
					mehrzeilig
					wert={a.eh.vorwissen}
					setze={(t) => setzeEh({ vorwissen: t })}
				/>
			</label>
		</>
	);
};

export const SchrittEUmfang = ({
	a,
	offen,
	setzeEh,
	setzeOffen,
}: {
	a: Antworten;
	offen: boolean;
	setzeEh: SetzeEh;
	setzeOffen: (offen: boolean) => void;
}) => (
	<>
		<div className="mb-4">
			<Etikett>Dauer</Etikett>
			<Segment<string>
				beschriftung="Dauer"
				werte={[...EINHEIT_DAUER.map((d) => ({ wert: d, titel: d })), { wert: 'anders', titel: 'Anders …' }]}
				wert={offen ? 'anders' : a.eh.dauer}
				waehle={(w) => {
					const dauer = EINHEIT_DAUER.find((d) => d === w);
					if (dauer) {
						setzeOffen(false);
						setzeEh({ dauer, dauerText: '' });
					} else {
						setzeOffen(true);
					}
				}}
			/>
			{offen && (
				<div className="mt-2">
					<EinheitFeld
						feld="dauerText"
						fokus
						wert={a.eh.dauerText}
						setze={(t) => setzeEh({ dauerText: t })}
					/>
				</div>
			)}
		</div>
		<Zeile>
			<span className="font-medium">Stunden je Woche</span>
			<Knopf
				art="zweit"
				groesse="klein"
				aria-label="Eine Stunde weniger"
				disabled={a.eh.stunden <= 1}
				onClick={() => setzeEh({ stunden: a.eh.stunden - 1 })}
			>
				<Symbol name="minus" />
			</Knopf>
			<span className="w-6 text-center tabular-nums" data-einheit-stunden>
				{a.eh.stunden}
			</span>
			<Knopf
				art="zweit"
				groesse="klein"
				aria-label="Eine Stunde mehr"
				disabled={a.eh.stunden >= 10}
				onClick={() => setzeEh({ stunden: a.eh.stunden + 1 })}
			>
				<Symbol name="plus" />
			</Knopf>
		</Zeile>
		<div>
			<Etikett>Zahl der Materialien</Etikett>
			<Segment<(typeof EINHEIT_MENGE)[number]>
				beschriftung="Zahl der Materialien"
				werte={EINHEIT_MENGE.map((m) => ({ wert: m, titel: EINHEIT_MENGE_NAME[m] }))}
				wert={a.eh.menge}
				waehle={(menge) => setzeEh({ menge })}
			/>
		</div>
	</>
);

/** Nimmt einen Bestandteil heraus oder dazu. */
const umgeschaltet = (an: string[], name: string, gewaehlt: boolean) =>
	gewaehlt ? an.filter((x) => x !== name) : [...an, name];

export const SchrittEBestandteile = ({ a, setzeEh }: { a: Antworten; setzeEh: SetzeEh }) => {
	const an = einheitBestandteile(a.eh);
	return (
		<>
			<div role="group" aria-label="Bestandteile" className="flex flex-wrap gap-1.5" data-einheit-bestandteile>
				{EINHEIT_BESTANDTEILE.map((b) => {
					const gewaehlt = an.includes(b.name);
					return (
						<Chip
							key={b.name}
							titel={b.empfohlen ? `${b.name} ★` : b.name}
							aktiv={gewaehlt}
							waehle={() => setzeEh({ bestandteile: umgeschaltet(an, b.name, gewaehlt) })}
						/>
					);
				})}
			</div>
			<p className="mt-2 text-sm text-leise">★ Empfehlung</p>
			<label className="mt-4 block">
				<Etikett zusatz="optional">{EINHEIT_FELDER.nochEtwas.name}</Etikett>
				<EinheitFeld feld="nochEtwas" wert={a.eh.nochEtwas} setze={(t) => setzeEh({ nochEtwas: t })} />
			</label>
		</>
	);
};

export const SchrittERahmen = ({ a, setzeEh }: { a: Antworten; setzeEh: SetzeEh }) => {
	const rahmen = einheitRahmen(a.eh, a.klasse);
	return (
		<>
			<div className="mb-4 rounded-lg border border-rand px-3 py-2">
				<div className="flex items-center gap-3">
					<span className="min-w-0 flex-1">
						<span className="block font-medium">Rahmengeschichte</span>
						<span className="block text-sm text-leise">
							Eine Geschichte verbindet die Materialien, z. B. Fälle für Detektive.
						</span>
					</span>
					{(a.klasse === 1 || a.klasse === 2) && <Empfohlen />}
					<Schalter name="Rahmengeschichte" an={rahmen} setze={(an) => setzeEh({ rahmen: an })} />
				</div>
				{rahmen && (
					<div className="mt-2">
						<EinheitFeld feld="idee" wert={a.eh.idee} setze={(t) => setzeEh({ idee: t })} />
					</div>
				)}
			</div>
			<Zeile>
				<span className="font-medium">Leitfigur</span>
				<Segment<(typeof EINHEIT_LEITFIGUR)[number]>
					beschriftung="Leitfigur"
					werte={EINHEIT_LEITFIGUR.map((l) => ({ wert: l, titel: EINHEIT_LEITFIGUR_NAME[l] }))}
					wert={a.eh.leitfigur}
					waehle={(leitfigur) => setzeEh({ leitfigur })}
				/>
			</Zeile>
			<Zeile data-einheit-aussehen={a.eh.aussehen}>
				<span className="font-medium">Aussehen</span>
				<Segment<(typeof EINHEIT_AUSSEHEN)[number]>
					beschriftung="Aussehen"
					werte={EINHEIT_AUSSEHEN_WAHL.map((w) => ({ wert: w.wert, titel: w.name }))}
					wert={a.eh.aussehen}
					waehle={(aussehen) => setzeEh({ aussehen })}
				/>
			</Zeile>
			<div className="mt-4 flex items-center gap-3 rounded-lg border border-rand px-3 py-2">
				<Symbol name="bild" className="size-5 flex-none text-leise" />
				<span className="min-w-0 flex-1">
					<span className="block font-medium">Neue Bilder mit Canva</span>
					<span className="block text-sm text-leise">
						Szenen und Motive passend zur Geschichte. Verbraucht dein Canva-Kontingent; Mail und Dateien
						bleiben gesperrt.
					</span>
				</span>
				<Empfohlen />
				<Schalter name="Neue Bilder mit Canva" an={a.eh.bilder} setze={(an) => setzeEh({ bilder: an })} />
			</div>
		</>
	);
};

/** „Auftrag prüfen“ der Einheit: Auftrag, Titel und Ort des neuen Ordners, Verbrauch (E1, 140). */
export const SchrittPruefenEinheit = ({
	a,
	gesperrt,
	hinweis,
	laeuftSchon,
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
	laeuftSchon: string | null;
	pruefeLimit: () => Promise<void>;
}) => {
	const ausAntworten = einheitAuftragAus(einheitAngabenAus(a));
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
					<div className="flex flex-col gap-1 text-sm">
						{ausAntworten.split('\n').map((satz) => (
							<p key={satz}>{satz}</p>
						))}
					</div>
				) : (
					<textarea
						className={klassen(FELD_KLASSEN, 'h-auto w-full py-1.5')}
						aria-label="Auftrag"
						rows={8}
						maxLength={EINHEIT_AUFTRAG_ZEICHEN}
						value={text.wert}
						autoFocus
						onChange={(e) => setzeText({ ...text, wert: e.target.value })}
					/>
				)}
			</div>
			<div className="mt-3 flex items-end gap-3">
				<TitelFeld titel={a.titel} setzeTitel={setzeTitel} vorschlag={titelVorschlagen} />
				<OrdnerFeld name={ordner.name} />
			</div>
			<p className="mt-1 text-sm text-leise">Der Titel wird der Name des neuen Ordners.</p>
			<div className="mt-3 rounded-md bg-warnung-hell px-3 py-2 text-sm text-warnung" data-einheit-verbrauch>
				<p className="flex items-center gap-2 font-medium">
					<Symbol name="uhr" />
					{EINHEIT_VERBRAUCH}
				</p>
				{laeuftSchon !== null && (
					<p className="mt-1" data-einheit-laeuft-schon>
						{`Claude baut gerade „${laeuftSchon}“. Es geht nur eine Einheit zur Zeit.`}
					</p>
				)}
			</div>
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
