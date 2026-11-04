import { kann, kannImFormat } from '@schoolbox/kern/src/bausteine';
import type { BlattWerte as BlattWerteTyp } from '@schoolbox/kern/src/kit-einstellungen';
import {
	BLATT_FORMATE,
	KIT_FELDER,
	leseBlatt,
	leseKit,
	leseSichtbarkeit,
	PALETTEN,
	setzeBlatt,
	setzeKit,
	setzeSichtbarkeit,
	SICHTBARKEITEN,
} from '@schoolbox/kern/src/kit-einstellungen';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import { ABSTAND, SPALTEN } from '@schoolbox/kern/src/struktur';
import { groesseVon, setzeGroesse, setzeKopfzeile } from '@schoolbox/kern/src/tabelle';
import type { Format as Format2 } from '@schoolbox/kern/src/werte';
import { FORMAT_NAME, KLASSEN } from '@schoolbox/kern/src/werte';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { klasseName } from '../lib/text';
import type { Ablage } from './ablage';
import type { PfadTeil } from './darstellung';
import type { Spalten, Struktur } from './struktur';
import type { Befehle } from './useBefehle';

/** Nur für die Punkte im Panel; die Farben selbst stehen in `blatt.css`. */
const PALETTEN_FARBE = { sonnig: '#F28C28', himmel: '#3A86FF', wiese: '#43AA8B', beere: '#E76F51' };

interface Eigenschaften {
	pfad: PfadTeil[];
	waehle: (nr: number | null) => void;
	/** Was die folgenden Issues hier einhängen: Text, Bilder, Abbildungen … */
	children?: ReactNode;
	/** Ohne Auswahl: Einstellungen für das ganze Blatt. */
	leer?: ReactNode;
}

/** Rechts neben dem Blatt (iPad hoch: darunter): was gewählt ist und was sich damit tun lässt. */
export const AuswahlPanel = ({ children, leer, pfad, waehle }: Eigenschaften) => {
	const gewaehlt = pfad.at(-1);
	if (!gewaehlt) {
		return (
			<div>
				<h2 className="text-xl">Auswahl</h2>
				<p className="mt-2 text-leise">
					Tippe auf einen Teil des Blatts, zum Beispiel eine Aufgabe oder eine Überschrift, um ihn
					auszuwählen.
				</p>
				{leer}
			</div>
		);
	}
	return (
		<div data-auswahl={gewaehlt.baustein.art}>
			<nav aria-label="Wo im Blatt" className="-ml-2 flex flex-wrap items-center" data-breadcrumb>
				{pfad.map((teil, i) => (
					<span key={teil.nr} className="flex items-center">
						{i > 0 && <span className="px-0.5 text-leise">›</span>}
						<button
							type="button"
							className="h-knopf rounded-lg px-2 font-medium text-tinte hover:bg-flaeche-2 aria-[current=true]:text-tinte"
							aria-current={teil === gewaehlt}
							onClick={() => waehle(teil.nr)}
						>
							{teil.name}
						</button>
					</span>
				))}
			</nav>
			<h2 className="mt-2 text-xl">{gewaehlt.name}</h2>
			{children}
			<Knopf art="leise" className="mt-4 -ml-5" onClick={() => waehle(null)}>
				<Symbol name="schliessen" />
				Auswahl aufheben
			</Knopf>
		</div>
	);
};

interface StrukturEigenschaften {
	quelle: string | null;
	pfad: PfadTeil[];
	aktiv: boolean;
	format: string;
	struktur: Struktur;
	befehle: Befehle;
	ablage: Ablage;
}

/** Baustein in die Sammlung legen, kopieren und aus einem anderen Dokument einfügen (051). */
const Wiederverwenden = ({
	ablage,
	befehle,
	gewaehlt,
}: {
	ablage: Ablage;
	befehle: Befehle;
	gewaehlt: PfadTeil;
}) => {
	const { abgelegt, sammle, sammlungName: name, setSammlungName: setName } = ablage;
	return (
		<div className="flex flex-col gap-2" data-wiederverwenden>
			<div className="flex flex-wrap gap-2">
				{gewaehlt.baustein.art !== 'seite' && (
					<>
						<Knopf art="zweit" data-baustein-kopieren onClick={() => befehle.fuehreAus('auswahl.kopieren')}>
							<Symbol name="kopieren" />
							Kopieren
						</Knopf>
						<Knopf art="zweit" data-in-sammlung onClick={() => befehle.fuehreAus('auswahl.in-sammlung')}>
							<Symbol name="plus" />
							In Sammlung legen
						</Knopf>
					</>
				)}
				{abgelegt && (
					<Knopf art="zweit" data-ablage-einfuegen onClick={() => befehle.fuehreAus('auswahl.einfuegen')}>
						<Symbol name="kopieren" />
						{`„${abgelegt.name}“ einfügen`}
					</Knopf>
				)}
			</div>
			{name !== null && (
				<div className="flex flex-wrap items-end gap-2">
					<label className="flex-1 font-medium">
						Name
						<input
							className="mt-1 h-knopf w-full rounded-xl border border-rand bg-flaeche px-3 font-normal"
							value={name}
							data-sammlung-name
							onChange={(e) => setName(e.target.value)}
						/>
					</label>
					<Knopf disabled={name.trim() === ''} data-sammlung-speichern onClick={() => void sammle()}>
						Hineinlegen
					</Knopf>
				</div>
			)}
		</div>
	);
};

const Spaltenwahl = ({ eigene, spalten, struktur }: { spalten: Spalten; eigene: boolean; struktur: Struktur }) => (
	<div>
		<h3 className="font-medium">{eigene ? 'Spalten' : `Spalten (${spalten.name})`}</h3>
		<div role="group" aria-label="Spalten" className="mt-2 flex items-center gap-2" data-spalten={spalten.wert}>
			<Knopf
				art="zweit"
				className="size-knopf px-0"
				aria-label="Eine Spalte weniger"
				disabled={spalten.wert <= SPALTEN.min}
				onClick={() => struktur.spalten(spalten.nr, spalten.wert - 1)}
			>
				<Symbol name="minus" />
			</Knopf>
			<span className="min-w-8 text-center text-xl font-medium">{spalten.wert}</span>
			<Knopf
				art="zweit"
				className="size-knopf px-0"
				aria-label="Eine Spalte mehr"
				disabled={spalten.wert >= SPALTEN.max}
				onClick={() => struktur.spalten(spalten.nr, spalten.wert + 1)}
			>
				<Symbol name="plus" />
			</Knopf>
		</div>
	</div>
);

const FELD = 'mt-1 h-knopf w-full rounded-xl border border-rand bg-flaeche px-3 font-normal';

/** Zeichnet die Felder aus `KIT_FELDER`; Grenzen und Wirkung stehen dort, nicht hier. */
const KitWerkzeug = ({
	art,
	folien,
	nr,
	quelle,
	struktur,
}: {
	art: string;
	folien: boolean;
	nr: number;
	quelle: string | null;
	struktur: Struktur;
}) => {
	const felder = KIT_FELDER[art];
	if (!felder || !quelle) {
		return null;
	}
	const werte = leseKit(quelle, nr, art);
	const setze = (name: string, titel: string, wert: string | number | boolean) =>
		struktur.aendereAttribute(`${titel} geändert`, (q) => setzeKit(q, nr, art, name, wert, { jeSeite: folien }));
	return (
		<div className="flex flex-col gap-3" data-kit={art}>
			{felder.map((f) => {
				const wert = werte[f.name];
				if (f.typ === 'schalter') {
					return (
						<label key={f.name} className="flex h-knopf items-center gap-2 font-medium">
							<input
								type="checkbox"
								className="size-5"
								checked={wert === true}
								onChange={(e) => setze(f.name, f.titel, e.target.checked)}
							/>
							{f.titel}
						</label>
					);
				}
				return (
					<label key={f.name} className="block font-medium">
						{f.titel}
						{f.typ === 'zahl' && (
							<input
								key={String(wert)}
								type="number"
								className={FELD}
								min={f.min}
								max={f.max}
								step={f.schritt}
								defaultValue={Number(wert)}
								onBlur={(e) => setze(f.name, f.titel, Number(e.target.value))}
							/>
						)}
						{f.typ === 'wahl' && (
							<select
								className={FELD}
								value={String(wert)}
								onChange={(e) => setze(f.name, f.titel, e.target.value)}
							>
								{f.optionen.map((o) => (
									<option key={o.wert} value={o.wert}>
										{o.titel}
									</option>
								))}
							</select>
						)}
						{f.typ === 'text' && (
							<input
								key={String(wert)}
								className={FELD}
								defaultValue={String(wert)}
								onBlur={(e) => setze(f.name, f.titel, e.target.value)}
							/>
						)}
					</label>
				);
			})}
		</div>
	);
};

/** Zeilen und Spalten der Kit-Tabelle (047), gewählt ist die Tabelle oder etwas darin. */
const TabellenWerkzeug = ({
	befehle,
	folien,
	nr,
	pfad,
	quelle,
	struktur,
}: {
	befehle: Befehle;
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
	const tu = (name: string, rechne: (q: string) => StrukturErgebnis) => struktur.fuehreAus(name, rechne);
	const inZelle = pfad.at(-1)?.baustein.art === 'tabellenzelle';
	return (
		<div className="flex flex-col gap-3" data-tabelle-werkzeug>
			<label className="flex h-knopf items-center gap-2 font-medium">
				<input
					type="checkbox"
					className="size-5"
					checked={g.kopf}
					onChange={(e) => tu('Kopfzeile geändert', (q) => setzeKopfzeile(q, nr, e.target.checked, n))}
				/>
				Kopfzeile
			</label>
			<div className="flex gap-2">
				{(['zeilen', 'spalten'] as const).map((was) => (
					<label key={was} className="block flex-1 font-medium">
						{was === 'zeilen' ? 'Zeilen' : 'Spalten'}
						<input
							key={g[was]}
							type="number"
							className={FELD}
							min={1}
							max={30}
							defaultValue={g[was]}
							onBlur={(e) => {
								const wert = Math.max(1, Math.min(30, Number(e.target.value)));
								if (wert !== g[was]) {
									tu('Tabellengröße geändert', (q) => setzeGroesse(q, nr, { [was]: wert }, n));
								}
							}}
						/>
					</label>
				))}
			</div>
			{inZelle && (
				<div className="grid grid-cols-2 gap-2">
					<Knopf art="zweit" onClick={() => befehle.fuehreAus('tabelle.zeile-davor')}>
						Zeile davor
					</Knopf>
					<Knopf art="zweit" onClick={() => befehle.fuehreAus('tabelle.zeile-danach')}>
						Zeile danach
					</Knopf>
					<Knopf art="zweit" onClick={() => befehle.fuehreAus('tabelle.spalte-davor')}>
						Spalte davor
					</Knopf>
					<Knopf art="zweit" onClick={() => befehle.fuehreAus('tabelle.spalte-danach')}>
						Spalte danach
					</Knopf>
					<Knopf art="gefahr" onClick={() => befehle.fuehreAus('tabelle.zeile-weg')}>
						Zeile löschen
					</Knopf>
					<Knopf art="gefahr" onClick={() => befehle.fuehreAus('tabelle.spalte-weg')}>
						Spalte löschen
					</Knopf>
				</div>
			)}
		</div>
	);
};

/** Verschieben, Duplizieren, Löschen und Spalten für den gewählten Baustein. */
export const Strukturwerkzeug = ({
	ablage,
	aktiv,
	befehle,
	format,
	pfad,
	quelle,
	struktur,
}: StrukturEigenschaften) => {
	const gewaehlt = pfad.at(-1);
	const w = struktur.werte;
	if (!aktiv || !gewaehlt || !w) {
		return null;
	}
	const { baustein, nr } = gewaehlt;
	const { nach } = w;
	const einzigeSeite = baustein.art === 'seite' && w.seiten <= 1;
	const loeschbar = kannImFormat(baustein, 'loeschen', format);
	const duplizierbar = kannImFormat(baustein, 'duplizieren', format);
	return (
		<div className="mt-4 flex flex-col gap-5" data-struktur>
			{nach && (
				<div>
					<div role="group" aria-label="Verschieben" className="flex flex-wrap gap-2">
						<Knopf
							art="zweit"
							className="px-4"
							disabled={!nach.zurueck}
							onClick={() => befehle.fuehreAus('auswahl.hoch')}
						>
							<Symbol name={nach.quer ? 'links' : 'hoch'} />
							{nach.quer ? 'Nach links' : 'Nach oben'}
						</Knopf>
						<Knopf
							art="zweit"
							className="px-4"
							disabled={!nach.vor}
							onClick={() => befehle.fuehreAus('auswahl.runter')}
						>
							<Symbol name={nach.quer ? 'rechts' : 'runter'} />
							{nach.quer ? 'Nach rechts' : 'Nach unten'}
						</Knopf>
					</div>
					<p className="mt-2 text-leise">
						{baustein.ordnenInLeiste
							? 'Oder links in der Seitenleiste gedrückt halten und ziehen.'
							: 'Oder im Blatt gedrückt halten und ziehen.'}
					</p>
				</div>
			)}
			<TabellenWerkzeug
				befehle={befehle}
				folien={format === 'folie'}
				nr={nr}
				pfad={pfad}
				quelle={quelle}
				struktur={struktur}
			/>
			<KitWerkzeug art={baustein.art} folien={format === 'folie'} nr={nr} quelle={quelle} struktur={struktur} />
			{kann(baustein, 'ordnen') && baustein.art !== 'seite' && (
				<label className="block font-medium">
					Sichtbarkeit
					<select
						className="mt-1 h-knopf w-full rounded-xl border border-rand bg-flaeche px-3 font-normal"
						aria-label="Sichtbarkeit"
						data-sichtbarkeit
						value={quelle ? leseSichtbarkeit(quelle, nr) : ''}
						onChange={(e) => {
							struktur.aendereAttribute('Sichtbarkeit geändert', (q) =>
								setzeSichtbarkeit(q, nr, e.target.value),
							);
						}}
					>
						{SICHTBARKEITEN.map((s) => (
							<option key={s.wert} value={s.wert}>
								{s.titel}
							</option>
						))}
					</select>
				</label>
			)}
			{(duplizierbar || loeschbar) && (
				<div className="flex flex-wrap gap-2">
					{duplizierbar && (
						<Knopf art="zweit" onClick={() => befehle.fuehreAus('auswahl.duplizieren')}>
							<Symbol name="duplizieren" />
							Duplizieren
						</Knopf>
					)}
					{loeschbar && (
						<Knopf
							art="gefahr"
							disabled={einzigeSeite}
							title={einzigeSeite ? 'Die einzige Seite bleibt.' : undefined}
							onClick={() => befehle.fuehreAus('auswahl.loeschen')}
						>
							<Symbol name="papierkorb" />
							Löschen
						</Knopf>
					)}
				</div>
			)}
			{quelle && <Wiederverwenden ablage={ablage} befehle={befehle} gewaehlt={gewaehlt} />}
			{w.spalten && <Spaltenwahl spalten={w.spalten} eigene={w.spalten.nr === nr} struktur={struktur} />}
		</div>
	);
};

/**
 * Abstand zwischen den Aufgaben für das ganze Blatt. Beim Ziehen zeigt das Blatt den Abstand sofort, die Quelle
 * ändert sich erst beim Loslassen: ein Schritt zum Rückgängigmachen.
 */
/** Titel, Klasse, Palette, Format und Trennlinien; jede Änderung ist ein Schritt im Verlauf (046). */
const BlattWerte = ({ quelle, struktur }: { quelle: string; struktur: Struktur }) => {
	const w = leseBlatt(quelle);
	const setze = (titel: string, neu: Partial<BlattWerteTyp>) =>
		struktur.aendereAttribute(`${titel} geändert`, (q) => setzeBlatt(q, neu));
	return (
		<div className="mt-3 flex flex-col gap-3">
			<label className="block font-medium">
				Titel
				<input
					key={w.titel}
					className={FELD}
					defaultValue={w.titel}
					onBlur={(e) => e.target.value.trim() && setze('Titel', { titel: e.target.value.trim() })}
				/>
			</label>
			<label className="block font-medium">
				Klasse
				<select
					className={FELD}
					value={String(w.klasse)}
					onChange={(e) => {
						setze('Klasse', { klasse: KLASSEN.find((k) => String(k) === e.target.value) ?? 'gemischt' });
					}}
				>
					{KLASSEN.map((k) => (
						<option key={k} value={String(k)}>
							{klasseName(k)}
						</option>
					))}
				</select>
			</label>
			<div role="group" aria-label="Palette" className="flex flex-wrap gap-2" data-palette>
				{PALETTEN.map((p) => (
					<Knopf
						key={p}
						art={w.palette === p ? 'haupt' : 'zweit'}
						aria-pressed={w.palette === p}
						className="px-3"
						onClick={() => setze('Palette', { palette: p })}
					>
						<span aria-hidden className="size-4 rounded-full" style={{ background: PALETTEN_FARBE[p] }} />
						{p[0]?.toUpperCase()}
						{p.slice(1)}
					</Knopf>
				))}
			</div>
			<label className="block font-medium">
				Format
				<select
					className={FELD}
					value={w.format}
					disabled={w.format === 'minibuch'}
					onChange={(e) => setze('Format', { format: e.target.value as Format2 })}
				>
					{(w.format === 'minibuch' ? ['minibuch' as const] : BLATT_FORMATE).map((f) => (
						<option key={f} value={f}>
							{FORMAT_NAME[f]}
						</option>
					))}
				</select>
				<span className="mt-1 block font-normal text-leise">
					Passt danach etwas nicht mehr, meldet es die Prüfung.
				</span>
			</label>
			<label className="flex h-knopf items-center gap-2 font-medium">
				<input
					type="checkbox"
					className="size-5"
					checked={w.trenner}
					onChange={(e) => setze('Trennlinien', { trenner: e.target.checked })}
				/>
				Trennlinien zwischen Aufgaben
			</label>
			<label className="flex h-knopf items-center gap-2 font-medium">
				<input
					type="checkbox"
					className="size-5"
					checked={w.punkte}
					onChange={(e) => setze('Punkte drucken', { punkte: e.target.checked })}
				/>
				Punkte drucken
			</label>
		</div>
	);
};

export const Blattwerkzeug = ({
	aktiv,
	quelle,
	struktur,
}: {
	aktiv: boolean;
	quelle: string | null;
	struktur: Struktur;
}) => {
	const wert = struktur.werte?.abstand ?? null;
	const [jetzt, setJetzt] = useState(wert ?? ABSTAND.min);
	const regler = useRef<HTMLInputElement>(null);
	const setze = useRef(struktur.abstand);

	useEffect(() => {
		setze.current = struktur.abstand;
	});

	useEffect(() => {
		if (wert !== null) {
			setJetzt(Math.max(ABSTAND.min, Math.min(ABSTAND.max, wert)));
		}
	}, [wert]);

	useEffect(() => {
		const element = regler.current;
		if (!element) {
			return undefined;
		}
		const fertig = () => setze.current(Number(element.value));
		element.addEventListener('change', fertig);
		return () => element.removeEventListener('change', fertig);
	}, [aktiv, wert]);

	if (!aktiv || wert === null) {
		return null;
	}
	return (
		<div className="mt-6 border-t border-rand pt-4" data-blatt>
			<h2 className="text-xl">Ganzes Blatt</h2>
			{quelle && <BlattWerte quelle={quelle} struktur={struktur} />}
			<label className="mt-3 block">
				<span className="flex justify-between font-medium">
					Abstand zwischen Aufgaben
					<span className="font-normal text-leise">{`${jetzt} px`}</span>
				</span>
				<input
					ref={regler}
					type="range"
					aria-label="Abstand zwischen Aufgaben"
					className="mt-2 h-11 w-full accent-brand-500"
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
			</label>
		</div>
	);
};
