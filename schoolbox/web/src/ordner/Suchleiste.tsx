import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Segment } from '../bausteine/Segment';
import type { Art, Fach } from '../lib/text';
import { ART_NAME, FACH_NAME, KLASSEN_NAMEN } from '../lib/text';
import { ortName } from './objekte';
import type { AblageStand } from './typen';

type FilterName = 'fach' | 'klasse' | 'art';

/** Bereich und Filter stehen nur hier, in der URL. Der Ordner selbst bleibt damit ruhig. */
export const Suchleiste = ({ anzahl, stand }: { stand: AblageStand; anzahl: number }) => {
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
				werte: (Object.keys(FACH_NAME) as Fach[]).filter((f) => faecher.has(f)).map((f) => ({ wert: f, titel: FACH_NAME[f] })),
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
				werte: (Object.keys(ART_NAME) as Art[]).filter((a) => arten.has(a)).map((a) => ({ wert: a, titel: ART_NAME[a] })),
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

	return (
		<div className="flex flex-wrap items-center gap-1.5 border-b border-rand bg-flaeche px-3 py-1.5" data-suchleiste>
			{von && (
				<Segment
					beschriftung="Bereich"
					wert={bereich ? 'hier' : 'ueberall'}
					waehle={(w) =>
						setze((p) => {
							if (w === 'hier') {
								p.set('in', von);
							} else {
								p.delete('in');
							}
						})
					}
					werte={[
						{ wert: 'ueberall', titel: 'Überall' },
						{ wert: 'hier', titel: `In „${ortName(stand, von)}“` },
					]}
				/>
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
			<span className="ml-auto text-xs text-leise" aria-live="polite">
				{anzahl === 1 ? '1 Treffer' : `${anzahl} Treffer`}
			</span>
		</div>
	);
};
