import { ART_KURZ, ART_NAME, FACH_NAME } from '@schoolbox/kern/src/namen';
import type { Art, Fach, Format, Klasse } from '@schoolbox/kern/src/werte';
import {
	ART_ANGABEN,
	ART_FORMATE,
	ARTEN,
	FAECHER,
	FORMAT_NAME,
	KLASSEN,
	VORLAGE_FORMAT,
} from '@schoolbox/kern/src/werte';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { Dialog } from '../bausteine/Dialog';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { melde } from '../ereignisse';
import { useLaden } from '../lib/laden';
import { klasseName } from '../lib/text';

const FELD = 'min-h-12 w-full rounded-xl border border-rand px-3';

const Feld = ({ children, name }: { name: string; children: ReactNode }) => (
	<label className="mb-3 block font-bold">
		<span className="mb-1 block">{name}</span>
		{children}
	</label>
);

const Fehler = ({ text }: { text: string | null }) =>
	text ? (
		<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-fehler" data-anlegen-fehler>
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
			'min-h-12 w-full rounded-xl border-2 p-3 text-left',
			aktiv ? 'border-brand-500 bg-brand-50' : 'border-rand bg-white hover:bg-brand-50',
		)}
		onClick={waehle}
	>
		<span className="block font-bold">{titel}</span>
		{children}
	</button>
);

/** Knopf und Dialog „Mappe anlegen“: Titel, Fach, Klasse. Danach direkt in der Mappe. */
export const MappeAnlegen = () => {
	const [offen, setOffen] = useState(false);
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
			const { mappe } = await sende<{ mappe: { id: string } }>('/api/mappen', { titel, fach, klasse });
			melde({ typ: 'mappe-neu', mappe: mappe.id });
			void navigate(`/m/${mappe.id}`);
		} catch (grund) {
			setFehler(meldung(grund));
			setLaeuft(false);
		}
	};

	return (
		<>
			<Knopf onClick={() => setOffen(true)}>
				<Symbol name="plus" />
				Mappe anlegen
			</Knopf>
			{offen && (
				<Dialog titel="Mappe anlegen" schliessen={() => setOffen(false)}>
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
							<Knopf art="zweit" onClick={() => setOffen(false)}>
								Abbrechen
							</Knopf>
							<Knopf type="submit" disabled={laeuft}>
								Anlegen
							</Knopf>
						</div>
					</form>
				</Dialog>
			)}
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
		const fest = VORLAGE_FORMAT[v]?.format;
		if (fest) {
			return art === 'arbeitsblatt' || art === 'lesetext' || art === 'sonstiges';
		}
		if (v === 'praesentation') {
			return art === 'praesentation' && format === 'folie';
		}
		return format === 'a4-hoch' && art !== 'praesentation';
	});

/** Assistent „Material anlegen“: Art, Format, Titel, Start. Abbrechen legt nichts an; erst der letzte Schritt schreibt. */
export const MaterialAnlegen = ({ mappe }: { mappe: string }) => {
	const [offen, setOffen] = useState(false);
	const [schritt, setSchritt] = useState(0);
	const [art, setArt] = useState<Art>('arbeitsblatt');
	const [format, setFormat] = useState<Format>(ART_ANGABEN.arbeitsblatt.format);
	const [titel, setTitel] = useState('');
	const [vorlage, setVorlage] = useState<string | null>(null);
	const [zusatz, setZusatz] = useState<Partial<Record<ZusatzName, boolean>>>({});
	const [fehler, setFehler] = useState<string | null>(null);
	const [laeuft, setLaeuft] = useState(false);
	const navigate = useNavigate();
	const { daten } = useLaden<{ vorlagen: string[] }>('/api/mappen/vorlagen/liste');
	const vorlagen = passendeVorlagen(daten?.vorlagen ?? [], art, format);
	const zusaetze = zusatzVon(art);

	const waehleArt = (a: Art) => {
		setArt(a);
		setFormat(ART_ANGABEN[a].format);
		setVorlage(null);
		setZusatz({});
	};
	const zu = () => {
		setOffen(false);
		setSchritt(0);
		setFehler(null);
	};
	const weiter = () => {
		if (SCHRITTE[schritt] === 'Titel' && titel.trim() === '') {
			setFehler('Bitte gib einen Titel ein.');
			return;
		}
		setFehler(null);
		setSchritt(schritt + 1);
	};
	const anlegen = async () => {
		setLaeuft(true);
		setFehler(null);
		try {
			const endFormat = vorlage ? (VORLAGE_FORMAT[vorlage]?.format ?? format) : format;
			const { id } = await sende<{ id: string }>(`/api/mappen/${mappe}/dokumente`, {
				titel,
				art,
				format: endFormat,
				...(vorlage ? { vorlage } : {}),
				zusatz,
			});
			melde({ typ: 'mappe-neu', mappe });
			void navigate(`/m/${mappe}/${id}/bearbeiten?neu=1`);
		} catch (grund) {
			setFehler(meldung(grund));
			setLaeuft(false);
		}
	};
	const name = SCHRITTE[schritt] ?? 'Art';
	const letzter = schritt === SCHRITTE.length - 1;

	return (
		<>
			<Knopf onClick={() => setOffen(true)} data-material-anlegen>
				<Symbol name="plus" />
				Material anlegen
			</Knopf>
			{offen && (
				<Dialog titel={`Material anlegen: ${name}`} schliessen={zu}>
					<div data-assistent={name}>
						<Fehler text={fehler} />
						{name === 'Art' && (
							<div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
								{ARTEN.map((a) => (
									<Wahl
										key={a}
										id={a}
										titel={ART_NAME[a]}
										aktiv={a === art}
										waehle={() => waehleArt(a)}
									>
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
							<Feld name="Titel">
								<input
									className={FELD}
									value={titel}
									autoFocus
									onChange={(e) => setTitel(e.target.value)}
								/>
							</Feld>
						)}
						{name === 'Start' && (
							<>
								<div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
									<Wahl
										id="leer"
										titel="Leer"
										aktiv={vorlage === null}
										waehle={() => setVorlage(null)}
									>
										<span className="block text-sm text-leise">
											Du fügst die Bausteine selbst ein.
										</span>
									</Wahl>
									{vorlagen.map((v) => (
										<Wahl
											key={v}
											id={v}
											titel={`Vorlage: ${v}`}
											aktiv={vorlage === v}
											waehle={() => setVorlage(v)}
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
								{vorlagen.length === 0 && (
									<p className="mt-2 text-leise">
										Für diese Art gibt es noch keine Vorlage. Du startest mit einem leeren Blatt.
									</p>
								)}
								{zusaetze.length > 0 && (
									<fieldset className="mt-4">
										<legend className="font-bold">Gleich dazu (kannst du überspringen)</legend>
										{zusaetze.map(([z, titelZ]) => (
											<label key={z} className="flex min-h-11 items-center gap-2">
												<input
													type="checkbox"
													className="size-5"
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
							<Knopf art="leise" onClick={zu}>
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
			)}
		</>
	);
};
