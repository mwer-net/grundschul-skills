import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Segment } from '../bausteine/Segment';
import { Tooltip } from '../bausteine/Tooltip';
import type { Art, Fach } from '../lib/text';
import { ART_NAME, FACH_NAME, KLASSEN_NAMEN } from '../lib/text';
import { findeOrdner, ortName, WURZEL_NAME } from './objekte';
import type { AblageStand } from './typen';

type FilterName = 'fach' | 'klasse' | 'art';

/** Lange Ordnernamen im Bereich kürzen mit „…“ (189-24). */
const BEREICH_ZEICHEN = 24;
const kurzerName = (name: string) =>
	name.length > BEREICH_ZEICHEN ? `${name.slice(0, BEREICH_ZEICHEN - 1).trimEnd()}…` : name;

/** Bereich und Filter stehen nur hier, in der URL. Die Zahl der Treffer steht in der Statuszeile (189-25). */
export const Suchleiste = ({ stand }: { stand: AblageStand }) => {
	const [parameter, setParameter] = useSearchParams();
	const von = parameter.get('von');
	const bereich = parameter.get('in');

	const gruppen = useMemo(() => {
		const faecher = new Set(stand.dokumente.map((d) => d.fach));
		const klassen = new Set(stand.dokumente.map((d) => String(d.klasse)));
		const arten = new Set(stand.dokumente.map((d) => d.meta.art));
		return [
			{
				name: 'fach' as const,
				titel: 'Fach',
				werte: (Object.keys(FACH_NAME) as Fach[])
					.filter((f) => faecher.has(f))
					.map((f) => ({ wert: f, titel: FACH_NAME[f] })),
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
	}, [stand.dokumente]);

	const setze = (aenderung: (p: URLSearchParams) => void) => {
		const neu = new URLSearchParams(parameter);
		aenderung(neu);
		setParameter(neu, { replace: true });
	};
	const waehle = (name: FilterName, wert: string) =>
		setze((p) => {
			if (p.get(name) === wert) {
				p.delete(name);
			} else {
				p.set(name, wert);
			}
		});
	const gefiltert = gruppen.some((g) => parameter.has(g.name));

	const waehleBereich = (w: string) =>
		setze((p) => {
			if (w === 'hier' && von) {
				p.set('in', von);
			} else {
				p.delete('in');
			}
		});

	return (
		<div
			className="flex flex-wrap items-center gap-1.5 border-b border-rand bg-flaeche px-3 py-1.5"
			data-suchleiste
		>
			{von && (
				<Tooltip text={`In „${ortName(stand, von)}“`}>
					<span className="inline-flex">
						<Segment
							beschriftung="Bereich"
							wert={bereich ? 'hier' : 'ueberall'}
							waehle={waehleBereich}
							werte={[
								{ wert: 'ueberall', titel: 'Überall' },
								{
									wert: 'hier',
									titel: `In „${kurzerName(findeOrdner(stand, von)?.name ?? WURZEL_NAME)}“`,
								},
							]}
						/>
					</span>
				</Tooltip>
			)}
			{gruppen.map(({ name, titel, werte }) => {
				const jetzt = werte.find((w) => w.wert === parameter.get(name));
				return (
					<Menue
						key={name}
						beschriftung={jetzt ? `${titel}: ${jetzt.titel}` : titel}
						eintraege={werte.map((w) => ({
							titel: w.titel,
							aktiv: parameter.get(name) === w.wert,
							waehle: () => waehle(name, w.wert),
						}))}
					/>
				);
			})}
			{gefiltert && (
				<Knopf art="leise" onClick={() => setze((p) => gruppen.forEach((g) => p.delete(g.name)))}>
					Zurücksetzen
				</Knopf>
			)}
		</div>
	);
};
