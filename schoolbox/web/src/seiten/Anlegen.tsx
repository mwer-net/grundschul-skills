import type { EigeneVorlage } from '@schoolbox/kern/src/eigene';
import type { Einordnung } from '@schoolbox/kern/src/einordnung';
import { ART_KURZ, ART_NAME, FACH_NAME } from '@schoolbox/kern/src/namen';
import type { Art, Fach, Format, Klasse } from '@schoolbox/kern/src/werte';
import {
	ART_ANGABEN,
	ART_FORMATE,
	ARTEN,
	FAECHER,
	FORMAT_NAME,
	KLASSEN,
	VORLAGE_ART,
	VORLAGE_FORMAT,
} from '@schoolbox/kern/src/werte';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { Dialog } from '../bausteine/Dialog';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { useKiZustand } from '../editor/ki';
import { useLaden } from '../lib/laden';
import { klasseName } from '../lib/text';
import { legeMappeAn, legeMaterialAn } from './material-anlegen';

const FELD = `${FELD_KLASSEN} w-full`;

const Feld = ({ children, name }: { name: string; children: ReactNode }) => (
	<label className="mb-2 block font-medium">
		<span className="mb-0.5 block">{name}</span>
		{children}
	</label>
);

const Fehler = ({ text }: { text: string | null }) =>
	text ? (
		<p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-fehler" data-anlegen-fehler>
			{text}
		</p>
	) : null;

/** Eine Auswahl als große Fläche: gut zu treffen, zeigt auch die Beschreibung. */
const Wahl = ({
	aktiv,
	children,
	id,
	titel,
	waehle,
}: {
	id: string;
	titel: string;
	aktiv: boolean;
	waehle: () => void;
	children?: ReactNode;
}) => (
	<button
		type="button"
		aria-pressed={aktiv}
		data-wahl={id}
		className={klassen(
			'w-full rounded-md border px-2.5 py-1.5 text-left',
			aktiv ? 'border-brand-500 bg-brand-50' : 'border-rand bg-flaeche hover:bg-flaeche-2',
		)}
		onClick={waehle}
	>
		<span className="block font-medium">{titel}</span>
		{children}
	</button>
);

/** Dialog „Mappe anlegen“: Titel, Fach, Klasse. Danach direkt in der Mappe. */
export const MappeDialog = ({ schliessen }: { schliessen: () => void }) => {
	const [titel, setTitel] = useState('');
	const [fach, setFach] = useState<Fach>('deutsch');
	const [klasse, setKlasse] = useState<Klasse>(1);
	const [fehler, setFehler] = useState<string | null>(null);
	const [laeuft, setLaeuft] = useState(false);
	const navigate = useNavigate();

	const anlegen = async (e: FormEvent) => {
		e.preventDefault();
		setLaeuft(true);
		setFehler(null);
		try {
			void navigate(`/m/${await legeMappeAn({ titel, fach, klasse })}`);
		} catch (grund) {
			setFehler(meldung(grund));
			setLaeuft(false);
		}
	};

	return (
		<Dialog titel="Mappe anlegen" schliessen={schliessen}>
			<form onSubmit={(e) => void anlegen(e)}>
				<Fehler text={fehler} />
				<Feld name="Titel">
					<input className={FELD} value={titel} required onChange={(e) => setTitel(e.target.value)} />
				</Feld>
				<Feld name="Fach">
					<select className={FELD} value={fach} onChange={(e) => setFach(e.target.value as Fach)}>
						{FAECHER.map((f) => (
							<option key={f} value={f}>
								{FACH_NAME[f]}
							</option>
						))}
					</select>
				</Feld>
				<Feld name="Klasse">
					<select
						className={FELD}
						value={String(klasse)}
						onChange={(e) => setKlasse(KLASSEN.find((k) => String(k) === e.target.value) ?? 1)}
					>
						{KLASSEN.map((k) => (
							<option key={k} value={String(k)}>
								{klasseName(k)}
							</option>
						))}
					</select>
				</Feld>
				<div className="flex justify-end gap-2">
					<Knopf art="zweit" onClick={schliessen}>
						Abbrechen
					</Knopf>
					<Knopf type="submit" disabled={laeuft}>
						Anlegen
					</Knopf>
				</div>
			</form>
		</Dialog>
	);
};

/** Knopf zum Dialog. */
export const MappeAnlegen = () => {
	const [offen, setOffen] = useState(false);
	return (
		<>
			<Knopf onClick={() => setOffen(true)}>
				<Symbol name="plus" />
				Mappe anlegen
			</Knopf>
			{offen && <MappeDialog schliessen={() => setOffen(false)} />}
		</>
	);
};

const ZUSATZ = [
	['selbsteinschaetzung', 'Selbsteinschätzung'],
	['niveaus', 'Niveaus zur Selbstwahl (Churer Modell)'],
	['sternchen', 'Sternchenaufgabe'],
] as const;
type ZusatzName = (typeof ZUSATZ)[number][0];

/** Nur was die Tabelle je Art anbietet; „–“ heißt: nicht fragen. */
const zusatzVon = (art: Art) => {
	const b = ART_ANGABEN[art].bausteine;
	return b ? ZUSATZ.filter(([name]) => b[name].startsWith('ja')) : [];
};

const SCHRITTE = ['Art', 'Format', 'Titel', 'Start'] as const;

const passendeVorlagen = (vorlagen: string[], art: Art, format: Format) =>
	vorlagen.filter((v) => {
		const nurFuer = VORLAGE_ART[v];
		if (nurFuer) {
			return nurFuer === art;
		}
		const fest = VORLAGE_FORMAT[v]?.format;
		if (fest) {
			return art === 'arbeitsblatt' || art === 'lesetext' || art === 'sonstiges';
		}
		if (v === 'praesentation') {
			return art === 'praesentation' && format === 'folie';
		}
		return format === 'a4-hoch' && art !== 'praesentation';
	});

/** Eigene Vorlage im Schritt „Start“: wählen, als Standard markieren, umbenennen, löschen (051). */
const EigeneWahl = ({
	aktiv,
	neuLaden,
	vorlage,
	waehle,
}: {
	vorlage: EigeneVorlage;
	aktiv: boolean;
	waehle: () => void;
	neuLaden: () => void;
}) => {
	const [neu, setNeu] = useState<string | null>(null);
	const aendere = (pfad: string, daten: object) => {
		void sende(`/api/eigene/vorlagen/${vorlage.id}/${pfad}`, daten).then(neuLaden);
	};
	return (
		<div data-eigene-vorlage={vorlage.id}>
			<Wahl id={`eigen-${vorlage.id}`} titel={`Eigene Vorlage: ${vorlage.name}`} aktiv={aktiv} waehle={waehle}>
				<span className="block text-sm text-leise">
					{vorlage.standard ? 'Dein Standard für diese Art' : 'Deine Vorlage'}
				</span>
			</Wahl>
			<div className="mt-1 flex flex-wrap items-center gap-1">
				<Knopf
					art="zweit"
					aria-pressed={vorlage.standard}
					onClick={() => aendere('aendern', { standard: !vorlage.standard })}
				>
					Standard
				</Knopf>
				{neu === null ? (
					<Knopf art="zweit" onClick={() => setNeu(vorlage.name)}>
						Umbenennen
					</Knopf>
				) : (
					<>
						<input
							aria-label="Neuer Name"
							className={`${FELD_KLASSEN} min-w-0 flex-1`}
							value={neu}
							onChange={(e) => setNeu(e.target.value)}
						/>
						<Knopf
							disabled={neu.trim() === ''}
							onClick={() => {
								setNeu(null);
								aendere('aendern', { name: neu });
							}}
						>
							Speichern
						</Knopf>
					</>
				)}
				<Knopf
					art="gefahr"
					aria-label={`Vorlage ${vorlage.name} löschen`}
					onClick={() => aendere('loeschen', {})}
				>
					<Symbol name="papierkorb" />
				</Knopf>
			</div>
		</div>
	);
};

interface MaterialDialogEigenschaften {
	/** Die Mappe des Assistenten; sonst die aus der Einordnung, oder eine neue. */
	mappe?: string;
	/** Aus dem Chat (077): alles vorbelegt, Claude schreibt den Entwurf. */
	einordnung?: Einordnung;
	wunsch?: string;
	schliessen: () => void;
	vorDemSprung?: (mappe: string, dok: string) => void;
}

const NeueMappeFelder = ({
	fach,
	klasse,
	setFach,
	setKlasse,
	setTitel,
	titel,
}: {
	fach: Fach;
	klasse: Klasse;
	setFach: (fach: Fach) => void;
	setKlasse: (klasse: Klasse) => void;
	setTitel: (titel: string) => void;
	titel: string;
}) => (
	<>
		<Feld name="Neue Mappe">
			<input className={FELD} value={titel} onChange={(e) => setTitel(e.target.value)} />
		</Feld>
		<Feld name="Fach">
			<select className={FELD} value={fach} onChange={(e) => setFach(e.target.value as Fach)}>
				{FAECHER.map((f) => (
					<option key={f} value={f}>
						{FACH_NAME[f]}
					</option>
				))}
			</select>
		</Feld>
		<Feld name="Klasse">
			<select
				className={FELD}
				value={String(klasse)}
				onChange={(e) => setKlasse(KLASSEN.find((k) => String(k) === e.target.value) ?? 1)}
			>
				{KLASSEN.map((k) => (
					<option key={k} value={String(k)}>
						{klasseName(k)}
					</option>
				))}
			</select>
		</Feld>
	</>
);

const startWerte = (einordnung?: Einordnung, festeMappe?: string, wunsch?: string) => {
	const ziel = einordnung?.mappe;
	return {
		mappe: festeMappe ?? (ziel && 'id' in ziel ? ziel.id : null),
		mappeTitel: ziel && 'neu' in ziel ? ziel.neu : '',
		fach: einordnung?.fach ?? 'deutsch',
		klasse: einordnung?.klasse ?? 1,
		art: einordnung?.art ?? 'arbeitsblatt',
		format: einordnung?.format ?? ART_ANGABEN.arbeitsblatt.format,
		titel: einordnung?.titel ?? '',
		wunsch: wunsch ?? '',
	};
};

/** Assistent „Material anlegen“: Art, Format, Titel, Start. Abbrechen legt nichts an; erst der letzte Schritt schreibt. */
export const MaterialDialog = ({
	einordnung,
	mappe: festeMappe,
	schliessen,
	vorDemSprung,
	wunsch: wunschVorher,
}: MaterialDialogEigenschaften) => {
	const start = startWerte(einordnung, festeMappe, wunschVorher);
	const { mappe } = start;
	const [mappeTitel, setMappeTitel] = useState(start.mappeTitel);
	const [fach, setFach] = useState<Fach>(start.fach);
	const [klasse, setKlasse] = useState<Klasse>(start.klasse);
	const [schritt, setSchritt] = useState(0);
	const [art, setArt] = useState<Art>(start.art);
	const [format, setFormat] = useState<Format>(start.format);
	const [titel, setTitel] = useState(start.titel);
	const [vorlage, setVorlage] = useState<string | null>(null);
	const [zusatz, setZusatz] = useState<Partial<Record<ZusatzName, boolean>>>({});
	const [fehler, setFehler] = useState<string | null>(null);
	const [laeuft, setLaeuft] = useState(false);
	const [mitClaude, setMitClaude] = useState(Boolean(einordnung));
	const [wunsch, setWunsch] = useState(start.wunsch);
	const ausDemChat = Boolean(einordnung);
	const ki = useKiZustand().zustand;
	const navigate = useNavigate();
	const { daten } = useLaden<{ vorlagen: string[] }>('/api/mappen/vorlagen/liste');
	const vorlagen = passendeVorlagen(daten?.vorlagen ?? [], art, format);
	const eigen = useLaden<{ vorlagen: EigeneVorlage[] }>('/api/eigene/vorlagen');
	const eigene = useMemo(() => (eigen.daten?.vorlagen ?? []).filter((v) => v.art === art), [eigen.daten, art]);
	// Die als Standard markierte Vorlage ist vorgewählt, sobald die Art feststeht.
	useEffect(() => {
		const standard = eigene.find((v) => v.standard);
		if (standard && !ausDemChat) {
			setVorlage(`eigen-${standard.id}`);
		}
	}, [ausDemChat, eigene]);
	const zusaetze = zusatzVon(art);

	const waehleArt = (a: Art) => {
		setArt(a);
		setFormat(ART_ANGABEN[a].format);
		setVorlage(null);
		setZusatz({});
	};
	const weiter = () => {
		if (SCHRITTE[schritt] === 'Titel' && (titel.trim() === '' || (!mappe && mappeTitel.trim() === ''))) {
			setFehler('Bitte gib einen Titel ein.');
			return;
		}
		setFehler(null);
		setSchritt(schritt + 1);
	};
	const anlegen = async () => {
		if (mitClaude && wunsch.trim() === '') {
			setFehler('Bitte schreib, worum es geht.');
			return;
		}
		setLaeuft(true);
		setFehler(null);
		try {
			const endFormat = vorlage ? (VORLAGE_FORMAT[vorlage]?.format ?? format) : format;
			const ziel = mappe ?? (await legeMappeAn({ titel: mappeTitel, fach, klasse }));
			const {
				id,
				state,
				ziel: adresse,
			} = await legeMaterialAn({
				mappe: ziel,
				titel,
				art,
				format: endFormat,
				vorlage,
				zusatz: mitClaude ? {} : zusatz,
				wunsch: mitClaude ? wunsch : null,
			});
			vorDemSprung?.(ziel, id);
			void navigate(adresse, { state });
		} catch (grund) {
			setFehler(meldung(grund));
			setLaeuft(false);
		}
	};
	const name = SCHRITTE[schritt] ?? 'Art';
	const letzter = schritt === SCHRITTE.length - 1;

	return (
		<Dialog titel={`Material anlegen: ${name}`} schliessen={schliessen}>
			<div data-assistent={name}>
				<Fehler text={fehler} />
				{name === 'Art' && (
					<div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
						{ARTEN.map((a) => (
							<Wahl key={a} id={a} titel={ART_NAME[a]} aktiv={a === art} waehle={() => waehleArt(a)}>
								<span className="block text-sm text-leise">{ART_KURZ[a]}</span>
							</Wahl>
						))}
					</div>
				)}
				{name === 'Format' && (
					<div className="flex flex-col gap-2">
						{ART_FORMATE[art].map((f, i) => (
							<Wahl
								key={f}
								id={f}
								titel={FORMAT_NAME[f]}
								aktiv={f === format}
								waehle={() => setFormat(f)}
							>
								{i === 0 && <span className="block text-sm text-leise">Empfehlung</span>}
							</Wahl>
						))}
					</div>
				)}
				{name === 'Titel' && (
					<>
						<Feld name="Titel">
							<input
								className={FELD}
								value={titel}
								autoFocus
								onChange={(e) => setTitel(e.target.value)}
							/>
						</Feld>
						{!mappe && (
							<NeueMappeFelder
								fach={fach}
								klasse={klasse}
								setFach={setFach}
								setKlasse={setKlasse}
								setTitel={setMappeTitel}
								titel={mappeTitel}
							/>
						)}
					</>
				)}
				{name === 'Start' && (
					<>
						<div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
							<Wahl
								id="leer"
								titel="Leer"
								aktiv={vorlage === null && !mitClaude}
								waehle={() => {
									setVorlage(null);
									setMitClaude(false);
								}}
							>
								<span className="block text-sm text-leise">Du fügst die Bausteine selbst ein.</span>
							</Wahl>
							{ki.verfuegbar && (
								<Wahl
									id="mit-claude"
									titel="Mit Claude"
									aktiv={mitClaude}
									waehle={() => {
										setVorlage(null);
										setMitClaude(true);
									}}
								>
									<span className="block text-sm text-leise">
										Claude schreibt einen Entwurf, du bearbeitest ihn weiter.
									</span>
								</Wahl>
							)}
							{eigene.map((v) => (
								<EigeneWahl
									key={v.id}
									vorlage={v}
									aktiv={vorlage === `eigen-${v.id}`}
									waehle={() => {
										setVorlage(`eigen-${v.id}`);
										setMitClaude(false);
									}}
									neuLaden={eigen.neuLaden}
								/>
							))}
							{vorlagen.map((v) => (
								<Wahl
									key={v}
									id={v}
									titel={`Vorlage: ${v}`}
									aktiv={vorlage === v}
									waehle={() => {
										setVorlage(v);
										setMitClaude(false);
									}}
								>
									<iframe
										src={`/ansicht/_assets/vorlage-${v}.html`}
										title={`Vorschau ${v}`}
										loading="lazy"
										tabIndex={-1}
										className="pointer-events-none mt-2 h-64 w-[250%] origin-top-left scale-[0.4] border-0 [margin-bottom:-9.6rem]"
									/>
								</Wahl>
							))}
						</div>
						{vorlagen.length === 0 && eigene.length === 0 && (
							<p className="mt-2 text-leise">
								Für diese Art gibt es noch keine Vorlage. Du startest mit einem leeren Blatt.
							</p>
						)}
						{mitClaude && (
							<label className="mt-4 block font-medium">
								Worum geht es, und was sollen die Kinder können?
								<textarea
									className={`${FELD_KLASSEN} mt-1 h-auto w-full py-1.5 font-normal`}
									rows={3}
									maxLength={2000}
									value={wunsch}
									onChange={(e) => setWunsch(e.target.value)}
								/>
								<span className="mt-1 block text-sm font-normal text-leise">
									Keine Namen von Kindern eintragen. Reihen, mehrere Dokumente und neue Bilder gehen
									in der Claude-App.
								</span>
							</label>
						)}
						{!mitClaude && zusaetze.length > 0 && (
							<fieldset className="mt-4">
								<legend className="font-medium">Gleich dazu (kannst du überspringen)</legend>
								{zusaetze.map(([z, titelZ]) => (
									<label key={z} className="flex h-knopf items-center gap-2">
										<input
											type="checkbox"
											className="size-4"
											checked={zusatz[z] === true}
											onChange={(e) => setZusatz({ ...zusatz, [z]: e.target.checked })}
										/>
										{titelZ}
									</label>
								))}
							</fieldset>
						)}
					</>
				)}
				<div className="mt-4 flex justify-end gap-2">
					<Knopf art="leise" onClick={schliessen}>
						Abbrechen
					</Knopf>
					{schritt > 0 && (
						<Knopf art="zweit" onClick={() => setSchritt(schritt - 1)}>
							Zurück
						</Knopf>
					)}
					{letzter ? (
						<Knopf disabled={laeuft} onClick={() => void anlegen()}>
							Anlegen
						</Knopf>
					) : (
						<Knopf onClick={weiter}>Weiter</Knopf>
					)}
				</div>
			</div>
		</Dialog>
	);
};

export const MaterialAnlegen = ({ mappe }: { mappe: string }) => {
	const [offen, setOffen] = useState(false);
	return (
		<>
			<Knopf onClick={() => setOffen(true)} data-material-anlegen>
				<Symbol name="plus" />
				Material anlegen
			</Knopf>
			{offen && <MaterialDialog mappe={mappe} schliessen={() => setOffen(false)} />}
		</>
	);
};
