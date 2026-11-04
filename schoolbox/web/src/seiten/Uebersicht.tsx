import { Link, useSearchParams } from 'react-router-dom';

import { Marke } from '../bausteine/Kachel';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
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
import { MappeAnlegen } from './Anlegen';

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
		<Link
			to={`/m/${mappe.id}`}
			className="block h-full overflow-hidden rounded-[10px] border border-rand bg-flaeche text-tinte no-underline hover:border-rand-feld"
			data-mappe={mappe.id}
		>
			<div className="relative">
				<Vorschau zugang={{ mappe: mappe.id, token: null }} dokument={dokumente[0]} />
				{mappe.status === 'entwurf' && (
					<span className="absolute top-2 left-2">
						<Marke>Entwurf</Marke>
					</span>
				)}
			</div>
			<div className="border-t border-rand px-2.5 py-2">
				<h2 className="flex items-center gap-1.5 text-sm font-medium">
					<span className="size-2 flex-none rounded-full" style={{ background: FACH_FARBE[mappe.fach] }} />
					<span className="truncate">{mappe.titel}</span>
				</h2>
				<p className="truncate text-xs text-leise">{`${FACH_NAME[mappe.fach]} · ${klasseName(mappe.klasse)}`}</p>
				<p className="truncate text-xs text-leise">{`${umfang(dokumente.length)} · ${datum(mappe.geaendert)}`}</p>
			</div>
		</Link>
	</li>
);

const Defekte = ({ defekt }: { defekt: DefekteMappe[] }) => (
	<aside className="mt-10 rounded-2xl border border-entwurf bg-flaeche p-5">
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
					<p className="rounded-2xl bg-flaeche px-6 py-4 text-lg shadow-2">
						„Ich brauche ein Arbeitsblatt zur Uhrzeit für Klasse 2.“
					</p>
					<p className="text-leise">Sobald Claude etwas angelegt hat, erscheint es hier von selbst.</p>
					<MappeAnlegen />
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
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl">Meine Mappen</h1>
				<MappeAnlegen />
			</div>
			<div className="mt-2 flex flex-wrap items-center gap-1.5">
				{auswahlen(mappen).map(({ name, titel, werte }) => {
					const jetzt = werte.find((w) => w.wert === gewaehlt(name));
					return (
						<Menue
							key={name}
							beschriftung={jetzt ? `${titel}: ${jetzt.titel}` : titel}
							eintraege={werte.map(({ titel: wertTitel, wert }) => ({
								titel: wertTitel,
								aktiv: gewaehlt(name) === wert,
								waehle: () => waehle(name, wert),
							}))}
						/>
					);
				})}
				{(filter.fach !== null || filter.klasse !== null || filter.art !== null) && (
					<Knopf art="leise" onClick={() => setParameter({}, { replace: true })}>
						Zurücksetzen
					</Knopf>
				)}
				<p className="ml-auto text-sm text-leise" aria-live="polite">
					{gefiltert
						? `${treffer.length} von ${mappen.length} ${mappen.length === 1 ? 'Mappe' : 'Mappen'}`
						: anzahl(mappen.length, 'Mappe', 'Mappen')}
				</p>
			</div>
			{treffer.length === 0 ? (
				<Zustand symbol="suche" titel="Dazu habe ich nichts gefunden">
					<p className="text-leise">Vielleicht mit einem anderen Wort? Oder schau dir wieder alles an.</p>
					<Knopf onClick={allesZeigen}>Alle Mappen zeigen</Knopf>
				</Zustand>
			) : (
				<ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
					{treffer.map((eintrag) => (
						<MappenKachel key={eintrag.mappe.id} {...eintrag} />
					))}
				</ul>
			)}
			{defekt.length > 0 && <Defekte defekt={defekt} />}
		</>
	);
};
