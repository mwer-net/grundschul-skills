import type { Antworten, EinheitWahl } from '@schoolbox/kern/src/assistent';
import {
	EINHEIT_AUSSEHEN_WAHL,
	EINHEIT_FELDER,
	EINHEIT_LEITFIGUR_NAME,
	EINHEIT_LEITFIGUR_WAHL,
	einheitBestandteile,
	FREITEXT,
	ZIEL_ANFAENGE,
} from '@schoolbox/kern/src/assistent';
import type { EINHEIT_LEITFIGUR } from '@schoolbox/kern/src/einheit';
import { EINHEIT_AUSSEHEN, EINHEIT_BESTANDTEILE, EINHEIT_DAUER, EINHEIT_VERBRAUCH } from '@schoolbox/kern/src/einheit';
import type { ReactNode } from 'react';

import { Chip } from '../bausteine/Chip';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Schalter } from '../bausteine/Schalter';
import { Segment } from '../bausteine/Segment';
import { Stepper } from '../bausteine/Stepper';
import { Symbol } from '../bausteine/Symbol';
import { Empfohlen, Etikett, TitelFeld, Zaehler } from './AnlegenSchritte';

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
	const eingabe = mehrzeilig ? (
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
			data-anders-feld={feld === 'dauerText' ? '' : undefined}
			onChange={(e) => setze(e.target.value)}
		/>
	);
	return (
		<>
			{eingabe}
			<Zaehler wert={wert} max={f.zeichen} />
		</>
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
	setzeTitel,
	titelVorschlagen,
}: {
	a: Antworten;
	setze: (teil: Partial<Antworten>) => void;
	setzeEh: SetzeEh;
	setzeTitel: (titel: string) => void;
	titelVorschlagen: boolean;
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
				<Zaehler wert={a.thema} max={FREITEXT.thema.zeichen} />
			</label>
			{/* Der Titel steht beim Thema und folgt ihm, bis man ihn selbst ändert (190-37). */}
			<div className="mb-4">
				<TitelFeld titel={a.titel} setzeTitel={setzeTitel} vorschlag={titelVorschlagen} fokus={false} />
				<p className="mt-1 text-sm text-leise">Der Titel wird der Name des neuen Ordners.</p>
			</div>
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
						<Knopf
							key={anfang}
							art="leise"
							groesse="klein"
							onClick={() => {
								const leer = ziele.findIndex((z) => z.trim() === '');
								setzeEh({
									ziele:
										leer >= 0 ? ziele.map((z, j) => (j === leer ? anfang : z)) : [...ziele, anfang],
								});
							}}
						>
							<Symbol name="plus" />
							{`${anfang.trim()} …`}
						</Knopf>
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
		{/* Die Zahl der Materialien zeigt der Plan; „Ändern …“ nimmt weniger oder mehr (190-39). */}
		<Zeile>
			<span className="font-medium">Stunden je Woche</span>
			<Stepper
				name="Stunden je Woche"
				id="einheit-stunden"
				wert={a.eh.stunden}
				min={1}
				max={10}
				setze={(stunden) => setzeEh({ stunden })}
			/>
		</Zeile>
	</>
);

/** Der Name auf dem Deckblatt bleibt für die nächste Einheit stehen. */
const AUTOR = 'schoolbox.einheit.autor';
const gemerkterAutor = () => {
	try {
		return (localStorage.getItem(AUTOR) ?? '').slice(0, EINHEIT_FELDER.autor.zeichen);
	} catch {
		return '';
	}
};
const merkeAutor = (name: string) => {
	try {
		localStorage.setItem(AUTOR, name.trim());
	} catch {
		// Ohne Speicher tippt die Lehrkraft den Namen beim nächsten Mal neu.
	}
};

/** Nimmt einen Bestandteil heraus oder dazu. */
const umgeschaltet = (an: string[], name: string, gewaehlt: boolean) =>
	gewaehlt ? an.filter((x) => x !== name) : [...an, name];

export const SchrittEBestandteile = ({ a, setzeEh }: { a: Antworten; setzeEh: SetzeEh }) => {
	const an = einheitBestandteile(a.eh);
	const schalteVerkauf = (ein: boolean) =>
		setzeEh({ verkauf: ein, autor: ein && a.eh.autor === '' ? gemerkterAutor() : a.eh.autor });
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
			<div className="mt-4 rounded-lg border border-rand px-3 py-2" data-einheit-verkauf={a.eh.verkauf}>
				<div className="flex items-center gap-3">
					<span className="min-w-0 flex-1">
						<span className="block font-medium">Für den Verkauf auf Eduki</span>
						<span className="block text-sm text-leise">
							Dazu kommen ein Deckblatt, eine Handreichung für andere Lehrkräfte, das Quellenverzeichnis
							und ein Text für dein Angebot.
						</span>
					</span>
					<Schalter name="Für den Verkauf auf Eduki" an={a.eh.verkauf} setze={schalteVerkauf} />
				</div>
				{a.eh.verkauf && (
					<label className="mt-2 block">
						<Etikett zusatz="optional">{EINHEIT_FELDER.autor.name}</Etikett>
						<EinheitFeld
							feld="autor"
							wert={a.eh.autor}
							setze={(t) => {
								merkeAutor(t);
								setzeEh({ autor: t });
							}}
						/>
					</label>
				)}
			</div>
		</>
	);
};

/** Eine Einheit erzählt immer eine Geschichte (Vorlage seit 140); der Schalter dafür entfällt (190-39). */
export const SchrittERahmen = ({ a, setzeEh }: { a: Antworten; setzeEh: SetzeEh }) => (
	<>
		<label className="mb-4 block">
			<Etikett zusatz="optional">{EINHEIT_FELDER.idee.name}</Etikett>
			<EinheitFeld feld="idee" wert={a.eh.idee} setze={(t) => setzeEh({ idee: t })} />
		</label>
		<Zeile>
			<span className="font-medium">Leitfigur</span>
			<Segment<(typeof EINHEIT_LEITFIGUR)[number]>
				beschriftung="Leitfigur"
				werte={EINHEIT_LEITFIGUR_WAHL.map((l) => ({ wert: l, titel: EINHEIT_LEITFIGUR_NAME[l] }))}
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
					Szenen und Motive passend zur Geschichte. Verbraucht dein Canva-Kontingent; Mail und Dateien bleiben
					gesperrt.
				</span>
			</span>
			<Empfohlen />
			<Schalter name="Neue Bilder mit Canva" an={a.eh.bilder} setze={(an) => setzeEh({ bilder: an })} />
		</div>
	</>
);

/** Im letzten Schritt der Einheit: Dauer, Verbrauch und warum es gerade nicht geht (vorher „Auftrag prüfen“, 190-37). */
export const EinheitVerbrauch = ({ laeuftSchon, warnung }: { laeuftSchon: string | null; warnung: string | null }) => (
	<div className="mt-3 rounded-md bg-warnung-hell px-3 py-2 text-sm text-warnung" data-einheit-verbrauch>
		<p className="flex items-center gap-2 font-medium">
			<Symbol name="uhr" />
			{EINHEIT_VERBRAUCH}
		</p>
		{warnung && (
			<p className="mt-1" data-einheit-fenster>
				{warnung}
			</p>
		)}
		{laeuftSchon !== null && (
			<p className="mt-1" data-einheit-laeuft-schon>
				{`Claude baut gerade „${laeuftSchon}“. Es geht nur eine Einheit zur Zeit.`}
			</p>
		)}
	</div>
);
