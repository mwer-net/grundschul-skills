import { useNavigate, useSearchParams } from 'react-router-dom';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import type { ObjektAnsicht, ZeileAnsicht } from './darstellung';
import { Kachel, LISTEN_RASTER, Zeile } from './darstellung';
import { PapierkorbSeite } from './PapierkorbSeite';
import { naechsteSortierung } from './sortierung';
import type { AblageOrdner, Darstellung, Objekt, Seite, Sortierung } from './typen';

const FILTER = ['fach', 'klasse', 'art'];

const SPALTEN: { feld: 'name' | 'geaendert' | 'art' | null; titel: string; klasse?: string }[] = [
	{ feld: 'name', titel: 'Name' },
	{ feld: 'geaendert', titel: 'Geändert' },
	{ feld: 'art', titel: 'Art' },
	{ feld: null, titel: 'Fach', klasse: '@max-3xl:hidden' },
	{ feld: null, titel: 'Klasse', klasse: '@max-4xl:hidden' },
	{ feld: null, titel: 'Format', klasse: '@max-4xl:hidden' },
	{ feld: null, titel: 'Seiten', klasse: '@max-4xl:hidden' },
];

export interface AblageZeile {
	objekt: Objekt;
	tiefe: number;
}

const OrdnerFehlt = () => {
	const navigate = useNavigate();
	return (
		<Zustand symbol="suche" titel="Diesen Ordner gibt es nicht mehr">
			<div className="flex gap-2">
				<Knopf onClick={() => void navigate('/')}>Zu meinem Material</Knopf>
				<Knopf art="zweit" onClick={() => void navigate('/papierkorb')}>
					Im Papierkorb nachsehen
				</Knopf>
			</div>
		</Zustand>
	);
};

const LeererOrdner = ({
	dieseLeiste,
	hier,
}: {
	dieseLeiste: (id: string) => () => void;
	hier: AblageOrdner | null;
}) => (
	<Zustand symbol={hier ? 'ordner' : 'blatt'} titel={hier ? 'Dieser Ordner ist leer' : 'Noch kein Material'}>
		{!hier && (
			<>
				<p className="text-lg">Schreib Claude, was du brauchst, zum Beispiel:</p>
				<p className="rounded-2xl bg-flaeche px-6 py-4 text-lg shadow-2">
					„Ich brauche ein Arbeitsblatt zur Uhrzeit für Klasse 2.“
				</p>
				<p className="text-leise">Sobald Claude etwas angelegt hat, erscheint es hier von selbst.</p>
			</>
		)}
		<div className="flex gap-2">
			<Knopf art="zweit" onClick={dieseLeiste('neuerOrdner')}>
				<Symbol name="ordnerNeu" />
				Neuer Ordner
			</Knopf>
			<Knopf onClick={dieseLeiste('materialAnlegen')}>
				<Symbol name="plus" />
				Material anlegen
			</Knopf>
		</div>
	</Zustand>
);

const KeinTreffer = () => {
	const navigate = useNavigate();
	const [parameter] = useSearchParams();
	const ohne = (namen: string[]) => () => {
		const neu = new URLSearchParams(parameter);
		namen.forEach((n) => neu.delete(n));
		void navigate(`/suche?${neu.toString()}`, { replace: true });
	};
	return (
		<Zustand symbol="suche" titel="Dazu habe ich nichts gefunden">
			<div className="flex gap-2">
				{parameter.has('in') && <Knopf onClick={ohne(['in'])}>Überall suchen</Knopf>}
				{FILTER.some((n) => parameter.has(n)) && (
					<Knopf art="zweit" onClick={ohne(FILTER)}>
						Filter zurücksetzen
					</Knopf>
				)}
			</div>
		</Zustand>
	);
};

interface ListeEigenschaften {
	ansicht: (z: AblageZeile) => ObjektAnsicht & { tiefe: number };
	klappeAlle: (klappe: (id: string, an?: boolean) => void, offen: ReadonlySet<string>, id: string) => void;
	klappeListe: (id: string, an?: boolean) => void;
	offenListe: ReadonlySet<string>;
	seite: Seite;
	sortierung: Sortierung;
	sortiere: (s: Sortierung) => void;
	zeilen: AblageZeile[];
}

const Liste = ({
	ansicht,
	klappeAlle,
	klappeListe,
	offenListe,
	seite,
	sortiere,
	sortierung,
	zeilen,
}: ListeEigenschaften) => {
	const koepfe = SPALTEN.map((s) =>
		s.titel === 'Art' && seite.art !== 'ordner' ? { ...s, titel: 'Ort', feld: null } : s,
	);
	return (
		<div>
			<div
				className={`${LISTEN_RASTER} sticky top-[calc(var(--kopf,0px)+var(--hoehe-werkzeug))] z-ueberlagerung h-6 items-center border-b border-rand bg-flaeche px-1 text-xs font-medium text-leise`}
			>
				{koepfe.map(({ feld, klasse, titel }) =>
					feld && seite.art === 'ordner' ? (
						<button
							key={titel}
							type="button"
							data-spalte={feld}
							className={`flex items-center gap-1 text-left hover:text-tinte ${klasse ?? ''}`}
							onPointerDown={(e) => e.stopPropagation()}
							onClick={(e) => {
								e.stopPropagation();
								sortiere(naechsteSortierung(sortierung, feld));
							}}
						>
							{titel}
							{sortierung.feld === feld && (
								<Symbol name={sortierung.auf ? 'hoch' : 'runter'} className="size-3" />
							)}
						</button>
					) : (
						<span key={titel} className={klasse}>
							{titel}
						</span>
					),
				)}
			</div>
			{zeilen.map((z) => {
				const { objekt } = z;
				const a: ZeileAnsicht = {
					...ansicht(z),
					offen: objekt.istOrdner && offenListe.has(objekt.ordner.id),
					klappe:
						objekt.istOrdner && seite.art === 'ordner'
							? (alle) =>
									alle
										? klappeAlle(klappeListe, offenListe, objekt.ordner.id)
										: klappeListe(objekt.ordner.id)
							: null,
				};
				return <Zeile key={objekt.schluessel} {...a} />;
			})}
		</div>
	);
};

interface Eigenschaften extends ListeEigenschaften {
	darstellung: Darstellung;
	dieseLeiste: (id: string) => () => void;
	hier: AblageOrdner | null;
	objektZahl: number;
	ordnerFehlt: boolean;
}

/** Was in der Fläche steht: Kacheln, Liste oder der passende leere Zustand. */
export const AblageInhalt = ({ darstellung, dieseLeiste, hier, objektZahl, ordnerFehlt, ...liste }: Eigenschaften) => {
	const { ansicht, seite, zeilen } = liste;
	if (seite.art === 'papierkorb') {
		return <PapierkorbSeite />;
	}
	if (ordnerFehlt) {
		return <OrdnerFehlt />;
	}
	if (objektZahl === 0) {
		if (seite.art === 'ordner') {
			return <LeererOrdner dieseLeiste={dieseLeiste} hier={hier} />;
		}
		return seite.art === 'suche' ? <KeinTreffer /> : <Zustand symbol="uhr" titel="Noch nichts geändert" />;
	}
	if (darstellung === 'kacheln') {
		return (
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
				{zeilen.map((z) => (
					<Kachel key={z.objekt.schluessel} {...ansicht(z)} />
				))}
			</ul>
		);
	}
	return <Liste {...liste} />;
};
