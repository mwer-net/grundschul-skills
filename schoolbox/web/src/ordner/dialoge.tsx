import { useEffect, useState } from 'react';

import { Dialog } from '../bausteine/Dialog';
import { Knopf } from '../bausteine/Knopf';
import { Kuerzel } from '../bausteine/Kuerzel';
import { Symbol } from '../bausteine/Symbol';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { ART_NAME, datum, FACH_NAME, FORMAT_NAME, klasseName } from '../lib/text';
import { vorschauAdresse } from '../lib/zugang';
import { Baum } from './Baum';
import { tastenAbschnitte } from './befehle';
import { useAblage } from './kontext';
import { bewegtText } from './meldungen';
import { elternVon, objekteZahl, WURZEL_NAME, zielGueltig } from './objekte';
import { pfadText } from './pfad';
import type { AblageOrdner, Objekt } from './typen';

/** Der Weg ohne Ziehen: Ziel im Baum wählen, auf Wunsch dort einen neuen Ordner anlegen. */
export const BewegenDialog = ({ objekte, schliessen }: { objekte: Objekt[]; schliessen: () => void }) => {
	const { setBenennen, stand, tu } = useAblage();
	const [ziel, setZiel] = useState<string | null | undefined>(undefined);
	const [offen, setOffen] = useState<ReadonlySet<string>>(new Set());
	if (!stand) {
		return null;
	}
	const gesperrt = (id: string | null) => !zielGueltig(stand, objekte, id);
	const klappe = (id: string) =>
		setOffen((alt) => {
			const neu = new Set(alt);
			if (!neu.delete(id)) {
				neu.add(id);
			}
			return neu;
		});
	const neuerOrdner = async () => {
		const eltern = ziel ?? null;
		const antwort = await tu({ art: 'neu', eltern });
		const id = antwort?.ergebnis.neu;
		if (id) {
			if (eltern) {
				setOffen((alt) => new Set([...alt, eltern]));
			}
			setZiel(id);
			setBenennen({ schluessel: id, neu: true, wo: 'dialog' });
		}
	};
	const bewege = async () => {
		if (ziel === undefined || gesperrt(ziel)) {
			return;
		}
		schliessen();
		await tu(
			{ art: 'bewegen', knoten: objekte.map((o) => o.knoten), ziel },
			{ text: (a) => bewegtText(stand, objekte, ziel, a) },
		);
	};
	const [erstes] = objekte;
	return (
		<Dialog
			titel={`${objekte.length === 1 && erstes ? `„${erstes.name}“` : `${objekte.length} Objekte`} bewegen nach …`}
			schliessen={schliessen}
		>
			<div className="max-h-[50dvh] overflow-y-auto rounded-lg border border-rand p-1" data-bewegen-baum>
				<Baum
					stand={stand}
					aktuell={ziel}
					offen={offen}
					klappe={klappe}
					waehle={setZiel}
					gesperrt={gesperrt}
					wurzelGesperrt={gesperrt(null)}
					benennWo="dialog"
				/>
			</div>
			<div className="flex items-center justify-between gap-2">
				<Knopf art="zweit" onClick={() => void neuerOrdner()}>
					<Symbol name="ordnerNeu" />
					Neuer Ordner
				</Knopf>
				<span className="flex gap-2">
					<Knopf art="leise" onClick={schliessen}>
						Abbrechen
					</Knopf>
					<Knopf
						data-hauptaktion
						disabled={ziel === undefined || gesperrt(ziel)}
						onClick={() => void bewege()}
					>
						Hierher bewegen
					</Knopf>
				</span>
			</div>
		</Dialog>
	);
};

const Angabe = ({ name, wert }: { name: string; wert: string }) => (
	<div className="flex justify-between gap-4 border-b border-rand py-1 last:border-b-0">
		<dt className="flex-none text-leise">{name}</dt>
		<dd className="min-w-0 text-right break-words">{wert}</dd>
	</div>
);

export const InfoDialog = ({
	objekt,
	ordner,
	schliessen,
}: {
	objekt: Objekt | null;
	ordner: AblageOrdner | null;
	schliessen: () => void;
}) => {
	const { stand } = useAblage();
	if (!stand) {
		return null;
	}
	const eltern = objekt ? elternVon(objekt) : (ordner?.eltern ?? null);
	const ort = pfadText(stand, eltern);
	const anzahl = (id: string | null) =>
		stand.ordner.filter((o) => o.eltern === id).length + stand.dokumente.filter((d) => d.ordner === id).length;
	if (objekt && !objekt.istOrdner) {
		const { dok } = objekt;
		return (
			<Dialog titel={`Informationen: ${objekt.name}`} schliessen={schliessen}>
				<dl data-informationen>
					<Angabe name="Art" wert={`${ART_NAME[dok.meta.art]} · ${FORMAT_NAME[dok.meta.format]}`} />
					<Angabe name="Fach" wert={FACH_NAME[dok.fach]} />
					<Angabe name="Klasse" wert={klasseName(dok.klasse)} />
					<Angabe name="Seiten" wert={dok.meta.seiten ? String(dok.meta.seiten) : 'noch nicht gezählt'} />
					<Angabe name="Stand" wert={dok.meta.status === 'entwurf' ? 'Entwurf' : 'Fertig'} />
					<Angabe name="Erstellt" wert={datum(objekt.erstellt)} />
					<Angabe name="Geändert" wert={datum(objekt.geaendert)} />
					<Angabe name="Ort" wert={ort} />
					<Angabe name="Geteilt" wert={objekt.geteilt ? 'Ja, mit Link' : 'Nein'} />
				</dl>
			</Dialog>
		);
	}
	const ziel = objekt?.istOrdner ? objekt.ordner : ordner;
	return (
		<Dialog titel={`Informationen: ${ziel?.name ?? WURZEL_NAME}`} schliessen={schliessen}>
			<dl data-informationen>
				<Angabe name="Art" wert="Ordner" />
				<Angabe name="Inhalt" wert={objekteZahl(anzahl(ziel?.id ?? null))} />
				{ziel && <Angabe name="Erstellt" wert={datum(ziel.erstellt)} />}
				{ziel && <Angabe name="Geändert" wert={datum(ziel.geaendert)} />}
				{ziel && <Angabe name="Ort" wert={ort} />}
				{ziel && (
					<Angabe name="Geteilt" wert={stand.geteilt.ordner.includes(ziel.id) ? 'Ja, mit Link' : 'Nein'} />
				)}
			</dl>
		</Dialog>
	);
};

/** Leertaste: große Vorschau, ←→ wechselt, Esc schließt (das macht der Dialog). */
export const UebersichtDialog = ({
	objekte,
	oeffne,
	schliessen,
	start,
}: {
	objekte: Objekt[];
	start: string | null;
	schliessen: () => void;
	oeffne: (o: Objekt) => void;
}) => {
	const [stelle, setStelle] = useState(() =>
		Math.max(
			0,
			objekte.findIndex((o) => o.schluessel === start),
		),
	);
	const objekt = objekte[stelle];
	useEffect(() => {
		const taste = (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft') {
				setStelle((s) => Math.max(0, s - 1));
			} else if (e.key === 'ArrowRight') {
				setStelle((s) => Math.min(objekte.length - 1, s + 1));
			} else if (e.key === ' ') {
				e.preventDefault();
				schliessen();
			}
		};
		window.addEventListener('keydown', taste);
		return () => window.removeEventListener('keydown', taste);
	}, [objekte.length, schliessen]);
	if (!objekt) {
		return null;
	}
	const bild =
		!objekt.istOrdner && objekt.dok.vorschau && !hatOffeneEntwuerfe(objekt.dok.meta)
			? vorschauAdresse({ mappe: objekt.dok.mappe, token: null }, objekt.dok.id, objekt.dok.vorschau)
			: null;
	return (
		<Dialog titel={objekt.name} breit schliessen={schliessen}>
			<div
				className="flex h-[65dvh] items-center justify-center rounded-lg bg-leinwand p-3"
				data-uebersicht={objekt.schluessel}
			>
				{bild ? (
					<img src={bild} alt="" className="h-full max-w-full bg-white object-contain shadow-2" />
				) : (
					<Symbol name={objekt.istOrdner ? 'ordner' : 'blatt'} className="size-24 text-brand-200" />
				)}
			</div>
			<div className="flex items-center justify-between gap-2">
				<span className="flex items-center gap-1">
					<Knopf
						art="leise"
						disabled={stelle === 0}
						aria-label="Vorheriges"
						onClick={() => setStelle(stelle - 1)}
					>
						<Symbol name="links" />
					</Knopf>
					<Knopf
						art="leise"
						disabled={stelle === objekte.length - 1}
						aria-label="Nächstes"
						onClick={() => setStelle(stelle + 1)}
					>
						<Symbol name="rechts" />
					</Knopf>
					<span className="text-sm text-leise">{`${stelle + 1} von ${objekte.length}`}</span>
				</span>
				<Knopf data-hauptaktion onClick={() => oeffne(objekt)}>
					{objekt.istOrdner ? 'Öffnen' : 'Ansehen'}
				</Knopf>
			</div>
		</Dialog>
	);
};

export const TastenDialog = ({ schliessen }: { schliessen: () => void }) => (
	<Dialog titel="Tasten" breit schliessen={schliessen}>
		<div className="grid gap-x-6 gap-y-4 sm:grid-cols-2" data-tasten-uebersicht>
			{tastenAbschnitte().map(({ befehle, titel }) => (
				<section key={titel}>
					<h3 className="mb-1 font-medium">{titel}</h3>
					<ul>
						{befehle.map((b) => (
							<li
								key={b.id}
								data-taste={b.id}
								className="flex h-zeile items-center justify-between gap-3"
							>
								<span className="truncate">{b.titel}</span>
								<Kuerzel text={b.taste === ' ' ? 'Leertaste' : b.taste} />
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
		<p className="mt-3 text-leise">
			Dazu: Pfeile bewegen die Auswahl, ⇧ erweitert. Buchstaben springen zum Namen. Esc hebt auf.
		</p>
	</Dialog>
);
