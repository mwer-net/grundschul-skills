import { useNavigate, useSearchParams } from 'react-router-dom';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { useClaudeBaut } from './claude-baut';
import type { ObjektAnsicht, ZeileAnsicht } from './darstellung';
import { Kachel, Zeile } from './darstellung';
import { listenRaster } from './darstellung-hilfe';
import { EinheitBand } from './EinheitBand';
import { einheitFuer, useEinheiten } from './einheiten';
import { PapierkorbSeite } from './PapierkorbSeite';
import { naechsteSortierung } from './sortierung';
import type { AblageOrdner, Darstellung, Objekt, Seite, Sortierung } from './typen';

const FILTER = ['fach', 'klasse', 'art'];

/** Nur mit Material in Sicht (188-35). */
const NUR_MATERIAL = new Set(['Fach', 'Klasse', 'Format']);

const SPALTEN: { feld: 'name' | 'geaendert' | 'art' | null; titel: string; klasse?: string }[] = [
	{ feld: 'name', titel: 'Name', klasse: 'pr-3' },
	{ feld: 'geaendert', titel: 'Geändert' },
	{ feld: 'art', titel: 'Art' },
	{ feld: null, titel: 'Fach', klasse: '@max-3xl:hidden' },
	{ feld: null, titel: 'Klasse', klasse: '@max-4xl:hidden' },
	{ feld: null, titel: 'Format', klasse: '@max-4xl:hidden' },
	{ feld: null, titel: 'Inhalt', klasse: '@max-4xl:hidden' },
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
				<Knopf art="zweit" onClick={() => void navigate('/papierkorb')}>
					Im Papierkorb nachsehen
				</Knopf>
				<Knopf onClick={() => void navigate('/')}>Zu meinem Material</Knopf>
			</div>
		</Zustand>
	);
};

/** Nur Symbol und Titel: Anlegen steht in der Leiste, im Menü der Fläche und auf ⌥N (189-33). */
const LeererOrdner = ({ hier }: { hier: AblageOrdner | null }) => (
	<Zustand symbol={hier ? 'ordner' : 'blatt'} titel={hier ? 'Dieser Ordner ist leer' : 'Noch kein Material'} />
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
	baut,
	klappeAlle,
	klappeListe,
	offenListe,
	seite,
	sortiere,
	sortierung,
	zeilen,
}: ListeEigenschaften & { baut: ReturnType<typeof useClaudeBaut> }) => {
	const mitMaterial = zeilen.some((z) => !z.objekt.istOrdner);
	const mitOrt = seite.art !== 'ordner';
	const koepfe = SPALTEN.filter((s) => mitMaterial || !NUR_MATERIAL.has(s.titel)).map((s) =>
		s.titel === 'Art' && seite.art !== 'ordner' ? { ...s, titel: 'Ort', feld: null } : s,
	);
	return (
		<div>
			<div
				className={`${listenRaster(mitMaterial, mitOrt)} sticky top-[calc(var(--kopf,0px)+var(--hoehe-werkzeug))] z-ueberlagerung h-6 items-center border-b border-rand bg-flaeche px-1 text-xs font-medium text-leise`}
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
					claude: objekt.istOrdner ? undefined : baut.get(`${objekt.dok.mappe}/${objekt.dok.id}`),
					mitMaterial,
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

const FlaecheInhalt = ({
	baut,
	darstellung,
	liste,
}: {
	baut: ReturnType<typeof useClaudeBaut>;
	darstellung: Darstellung;
	liste: ListeEigenschaften;
}) => {
	const { ansicht, zeilen } = liste;
	if (darstellung === 'kacheln') {
		return (
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
				{zeilen.map((z) => {
					const { objekt } = z;
					const claude = objekt.istOrdner ? undefined : baut.get(`${objekt.dok.mappe}/${objekt.dok.id}`);
					return <Kachel key={objekt.schluessel} {...ansicht(z)} claude={claude} />;
				})}
			</ul>
		);
	}
	return <Liste {...liste} baut={baut} />;
};

interface Eigenschaften extends ListeEigenschaften {
	darstellung: Darstellung;
	hier: AblageOrdner | null;
	objektZahl: number;
	ordnerFehlt: boolean;
}

/** Was in der Fläche steht: Kacheln, Liste oder der passende leere Zustand. */
export const AblageInhalt = ({ darstellung, hier, objektZahl, ordnerFehlt, ...liste }: Eigenschaften) => {
	const { seite } = liste;
	const baut = useClaudeBaut();
	const { einheiten } = useEinheiten();
	const einheit = seite.art === 'ordner' ? einheitFuer(einheiten, hier?.id) : null;
	if (seite.art === 'papierkorb') {
		return <PapierkorbSeite />;
	}
	if (ordnerFehlt) {
		return <OrdnerFehlt />;
	}
	if (einheit) {
		return (
			<>
				<EinheitBand s={einheit} />
				{objektZahl > 0 && <FlaecheInhalt darstellung={darstellung} baut={baut} liste={liste} />}
			</>
		);
	}
	if (objektZahl === 0) {
		if (seite.art === 'ordner') {
			return <LeererOrdner hier={hier} />;
		}
		return seite.art === 'suche' ? <KeinTreffer /> : <Zustand symbol="uhr" titel="Noch nichts geändert" />;
	}
	return <FlaecheInhalt darstellung={darstellung} baut={baut} liste={liste} />;
};
