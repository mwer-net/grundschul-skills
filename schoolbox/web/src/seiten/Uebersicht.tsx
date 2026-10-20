import { Link, useSearchParams } from 'react-router-dom';

import { Chip } from '../bausteine/Chip';
import { Kachel, Marke } from '../bausteine/Kachel';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import { useSuche } from '../bausteine/suche';
import { Symbol } from '../bausteine/Symbol';
import { Vorschau } from '../bausteine/Vorschau';
import { Zustand } from '../bausteine/Zustand';
import { useEreignisse } from '../ereignisse';
import { useLaden } from '../lib/laden';
import type { Art, Fach } from '../lib/text';
import { anzahl, ART_NAME, datum, FACH_FARBE, FACH_NAME, filtere, KLASSEN_NAMEN, klasseName } from '../lib/text';
import { useTitel } from '../lib/titel';
import type { DefekteMappe, MappenEintrag, MappenListe } from '../typen';

type FilterName = 'fach' | 'klasse' | 'art';

interface Auswahl {
	wert: string;
	titel: string;
	farbe?: string;
}

/** Nur was es wirklich gibt, steht zur Wahl; und nur, wenn es mindestens zwei Möglichkeiten sind. */
const auswahlen = (mappen: MappenEintrag[]): { name: FilterName; titel: string; werte: Auswahl[] }[] => {
	const faecher = new Set(mappen.map((e) => e.mappe.fach));
	const klassen = new Set(mappen.map((e) => String(e.mappe.klasse)));
	const arten = new Set(mappen.flatMap((e) => e.dokumente.map((d) => d.meta.art)));
	const gruppen = [
		{
			name: 'fach' as const,
			titel: 'Fach',
			werte: (Object.keys(FACH_NAME) as Fach[])
				.filter((f) => faecher.has(f))
				.map((f) => ({ wert: f, titel: FACH_NAME[f], farbe: FACH_FARBE[f] })),
		},
		{
			name: 'klasse' as const,
			titel: 'Klasse',
			werte: Object.entries(KLASSEN_NAMEN)
				.filter(([k]) => klassen.has(k))
				.map(([wert, titel]) => ({ wert, titel })),
		},
		{
			name: 'art' as const,
			titel: 'Art',
			werte: (Object.keys(ART_NAME) as Art[])
				.filter((a) => arten.has(a))
				.map((a) => ({ wert: a, titel: ART_NAME[a] })),
		},
	];
	return gruppen.filter((g) => g.werte.length > 1);
};

const umfang = (dokumente: number) => (dokumente === 0 ? 'Noch leer' : anzahl(dokumente, 'Dokument', 'Dokumente'));

const MappenKachel = ({ dokumente, mappe }: MappenEintrag) => (
	<li>
		<Link to={`/m/${mappe.id}`} className="block h-full rounded-2xl text-tinte no-underline" data-mappe={mappe.id}>
			<Kachel className="flex h-full flex-col transition-shadow hover:shadow-lg">
				<div className="h-2 flex-none" style={{ background: FACH_FARBE[mappe.fach] }} />
				<div className="relative">
					<Vorschau zugang={{ mappe: mappe.id, token: null }} dokument={dokumente[0]} />
					{mappe.status === 'entwurf' && (
						<span className="absolute top-3 left-3">
							<Marke>Entwurf</Marke>
						</span>
					)}
				</div>
				<div className="flex flex-1 flex-col gap-1 border-t border-rand p-4">
					<h2 className="text-xl">{mappe.titel}</h2>
					<p className="text-leise">{`${FACH_NAME[mappe.fach]} · ${klasseName(mappe.klasse)}`}</p>
					<p className="mt-auto pt-1 text-sm text-leise">
						{`${umfang(dokumente.length)} · ${datum(mappe.geaendert)}`}
					</p>
				</div>
			</Kachel>
		</Link>
	</li>
);

const Defekte = ({ defekt }: { defekt: DefekteMappe[] }) => (
	<aside className="mt-10 rounded-2xl border-2 border-entwurf bg-white p-5">
		<h2 className="text-lg">
			{defekt.length === 1
				? 'Eine Mappe lässt sich gerade nicht öffnen'
				: 'Einige Mappen lassen sich gerade nicht öffnen'}
		</h2>
		<p className="mt-1 text-leise">
			Deine anderen Mappen sind davon nicht betroffen. Sag Claude Bescheid, dann wird das repariert:
		</p>
		<ul className="mt-2 list-disc pl-6">
			{defekt.map(({ fehler, id }) => (
				<li key={id}>
					<strong>{id}</strong>
					<span className="text-leise">{` (${fehler})`}</span>
				</li>
			))}
		</ul>
	</aside>
);

export const Uebersicht = () => {
	const { setSuche, suche } = useSuche();
	const [parameter, setParameter] = useSearchParams();
	const { daten, fehler, neuLaden } = useLaden<MappenListe>('/api/mappen');
	useTitel();
	useEreignisse(({ typ }) => {
		if (typ !== 'pdf-fertig') {
			neuLaden();
		}
	});

	if (!daten) {
		return fehler ? (
			<Zustand symbol="achtung" titel="Das hat gerade nicht geklappt">
				<p className="text-leise">{fehler.message}</p>
				<Knopf onClick={neuLaden}>Noch einmal versuchen</Knopf>
			</Zustand>
		) : null;
	}

	const { defekt, mappen } = daten;
	if (mappen.length === 0) {
		return (
			<>
				<Zustand symbol="blatt" titel="Noch kein Material">
					<p className="text-lg">Schreib Claude, was du brauchst, zum Beispiel:</p>
					<p className="rounded-2xl bg-white px-6 py-4 text-lg shadow-karte">
						„Ich brauche ein Arbeitsblatt zur Uhrzeit für Klasse 2.“
					</p>
					<p className="text-leise">Sobald Claude etwas angelegt hat, erscheint es hier von selbst.</p>
					<KnopfLink to="/hilfe" art="zweit">
						<Symbol name="hilfe" />
						So geht’s
					</KnopfLink>
				</Zustand>
				{defekt.length > 0 && <Defekte defekt={defekt} />}
			</>
		);
	}

	const gewaehlt = (name: FilterName) => parameter.get(name);
	const filter = { suche, fach: gewaehlt('fach'), klasse: gewaehlt('klasse'), art: gewaehlt('art') };
	const treffer = filtere(mappen, filter);
	const gefiltert = suche.trim() !== '' || filter.fach !== null || filter.klasse !== null || filter.art !== null;

	const waehle = (name: FilterName, wert: string) => {
		const neu = new URLSearchParams(parameter);
		if (neu.get(name) === wert) {
			neu.delete(name);
		} else {
			neu.set(name, wert);
		}
		setParameter(neu, { replace: true });
	};
	const allesZeigen = () => {
		setSuche('');
		setParameter({}, { replace: true });
	};

	return (
		<>
			<div className="flex items-end justify-between gap-4">
				<h1 className="text-3xl max-md:text-2xl">Meine Mappen</h1>
				<p className="text-leise" aria-live="polite">
					{gefiltert
						? `${treffer.length} von ${mappen.length} ${mappen.length === 1 ? 'Mappe' : 'Mappen'}`
						: anzahl(mappen.length, 'Mappe', 'Mappen')}
				</p>
			</div>
			<div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
				{auswahlen(mappen).map(({ name, titel, werte }) => (
					<div key={name} className="flex flex-wrap items-center gap-2" role="group" aria-label={titel}>
						<span className="text-sm font-bold text-leise">{titel}</span>
						{werte.map(({ farbe, titel: wertTitel, wert }) => (
							<Chip
								key={wert}
								titel={wertTitel}
								farbe={farbe}
								aktiv={gewaehlt(name) === wert}
								waehle={() => waehle(name, wert)}
							/>
						))}
					</div>
				))}
			</div>
			{treffer.length === 0 ? (
				<Zustand symbol="suche" titel="Dazu habe ich nichts gefunden">
					<p className="text-leise">Vielleicht mit einem anderen Wort? Oder schau dir wieder alles an.</p>
					<Knopf onClick={allesZeigen}>Alle Mappen zeigen</Knopf>
				</Zustand>
			) : (
				<ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-6 max-md:gap-4">
					{treffer.map((eintrag) => (
						<MappenKachel key={eintrag.mappe.id} {...eintrag} />
					))}
				</ul>
			)}
			{defekt.length > 0 && <Defekte defekt={defekt} />}
		</>
	);
};
