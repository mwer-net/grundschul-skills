import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import { WURZEL_NAME } from './objekte';
import type { AblageOrdner } from './typen';

interface Eigenschaften {
	pfad: AblageOrdner[];
	gehe: (pfad: string) => void;
}

const STUECK =
	'flex h-knopf-klein max-w-44 min-w-0 flex-none items-center rounded-sm px-1 text-sm text-leise no-underline hover:bg-flaeche-2 hover:text-tinte';

const Trenner = () => <Symbol name="rechts" className="size-3 flex-none text-dezent" />;

const adresse = (id: string | null) => (id === null ? '/' : `/o/${id}`);

/** Jedes Stück ist Link und Ablageziel; das letzte ist die Überschrift. Bei wenig Platz werden die mittleren zu „…“. */
export const Pfad = ({ gehe, pfad }: Eigenschaften) => {
	const leiste = useRef<HTMLDivElement>(null);
	const [knapp, setKnapp] = useState(false);
	const schluessel = pfad.map((o) => o.id).join('/');

	useLayoutEffect(() => {
		setKnapp(false);
	}, [schluessel]);
	useLayoutEffect(() => {
		const el = leiste.current;
		if (el && !knapp && el.scrollWidth > el.clientWidth + 1 && pfad.length > 2) {
			setKnapp(true);
		}
	}, [knapp, pfad.length, schluessel]);

	const letzter = pfad.at(-1);
	const davor = pfad.slice(0, -1);
	const mitte = knapp ? davor.slice(0, -1) : [];
	const sichtbar = knapp ? davor.slice(-1) : davor;

	return (
		<div ref={leiste} className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden" data-pfad>
			{letzter ? (
				<Link to="/" className={STUECK} data-ablage-ziel="wurzel" data-pfad-stueck="wurzel">
					<span className="truncate">{WURZEL_NAME}</span>
				</Link>
			) : (
				<h1 className="truncate px-1 text-sm font-semibold">{WURZEL_NAME}</h1>
			)}
			{mitte.length > 0 && (
				<>
					<Trenner />
					<Menue
						name="Weitere Ordner im Pfad"
						beschriftung="…"
						art="leise"
						groesse="klein"
						eintraege={mitte.map((o) => ({
							titel: o.name,
							symbol: 'ordner' as const,
							waehle: () => gehe(adresse(o.id)),
						}))}
					/>
				</>
			)}
			{sichtbar.map((o) => (
				<span key={o.id} className="contents">
					<Trenner />
					<Link to={adresse(o.id)} className={STUECK} data-ablage-ziel={o.id} data-pfad-stueck={o.id}>
						<span className="truncate">{o.name}</span>
					</Link>
				</span>
			))}
			{letzter && (
				<>
					<Trenner />
					<h1 className="min-w-0 truncate px-1 text-sm font-semibold" data-ablage-ziel={letzter.id}>
						{letzter.name}
					</h1>
				</>
			)}
		</div>
	);
};
