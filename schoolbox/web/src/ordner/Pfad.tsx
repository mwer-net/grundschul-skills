import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Gekuerzt } from '../bausteine/Gekuerzt';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import { WURZEL_NAME } from './objekte';
import type { AblageOrdner } from './typen';

interface Eigenschaften {
	pfad: AblageOrdner[];
	gehe: (pfad: string) => void;
	/** Der Ordner fehlt: „Mein Material“ ist dann ein Weg zurück, keine Überschrift (189-02). */
	fehlt?: boolean;
}

const STUECK =
	'flex h-knopf-klein max-w-44 min-w-0 flex-none items-center rounded-sm px-1 text-sm text-leise no-underline hover:bg-flaeche-2 hover:text-tinte';

/** So schmal wird der aktuelle Ordner höchstens, bevor weitere Stufen hinter „…“ gehen (189-03). */
const LETZTER_MIN = 96;
/** „…“ (klein), Trenner und die Abstände davor: was ganz gekürzt vor dem aktuellen Ordner steht. */
const VORSPANN = 68;

const Trenner = () => <Symbol name="rechts" className="size-3 flex-none text-dezent" />;

const adresse = (id: string | null) => (id === null ? '/' : `/o/${id}`);

/**
 * Jedes Stück ist Link und Ablageziel; das letzte ist die Überschrift. Fehlt Platz, gehen die Stufen nach „Mein
 * Material“ von vorn nach hinten hinter „…“; reicht er wieder, kommen sie zurück. Gemessen wird bei jeder Breite.
 */
export const Pfad = ({ fehlt = false, gehe, pfad }: Eigenschaften) => {
	const leiste = useRef<HTMLDivElement>(null);
	const kopf = useRef<HTMLHeadingElement>(null);
	const [weg, setWeg] = useState(0);
	const [breite, setBreite] = useState(0);
	/** Was der aktuelle Ordner ungekürzt bräuchte: Darunter wird er höchstens bis `LETZTER_MIN` schmal. */
	const [natuerlich, setNatuerlich] = useState(0);
	const schluessel = pfad.map((o) => o.id).join('/');
	const davor = pfad.slice(0, -1);
	const letzter = pfad.at(-1);
	const letzterDa = letzter !== undefined;

	useLayoutEffect(() => {
		const el = leiste.current;
		if (!el) {
			return;
		}
		const beobachter = new ResizeObserver(([eintrag]) => setBreite(Math.round(eintrag?.contentRect.width ?? 0)));
		beobachter.observe(el);
		return () => beobachter.disconnect();
	}, []);
	// Jede neue Breite und jeder neue Pfad beginnt ganz ausgeklappt und kürzt dann Stufe für Stufe.
	useLayoutEffect(() => {
		setWeg(0);
		const name = kopf.current?.firstElementChild;
		setNatuerlich(name instanceof HTMLElement ? name.scrollWidth : 0);
	}, [breite, schluessel]);
	useLayoutEffect(() => {
		const el = leiste.current;
		const name = kopf.current?.firstElementChild;
		// Ein Schritt mehr als Stufen: Zuletzt geht auch „Mein Material“ hinter „…“, der aktuelle Ordner bleibt lesbar.
		if (!el || !letzterDa || weg > davor.length) {
			return;
		}
		const zuEng = el.scrollWidth > el.clientWidth + 1;
		const h = kopf.current;
		const kopfZuSchmal =
			h !== null && name instanceof HTMLElement && h.clientWidth < Math.min(LETZTER_MIN, name.scrollWidth + 8);
		if (zuEng || kopfZuSchmal) {
			setWeg(weg + 1);
		}
	}, [breite, davor.length, letzterDa, schluessel, weg]);

	const mitte = davor.slice(0, weg);
	const sichtbar = davor.slice(weg);
	const ohneWurzel = weg > davor.length;
	const letzterMin = Math.min(LETZTER_MIN, natuerlich + 8);

	return (
		<div
			ref={leiste}
			className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
			// Ganz gekürzt bleiben „…“, Trenner und der aktuelle Ordner; weniger Platz nimmt die Leiste den Knöpfen.
			style={letzter ? { minWidth: VORSPANN + letzterMin } : undefined}
			data-pfad
		>
			{ohneWurzel ? null : letzter || fehlt ? (
				<Link to="/" className={STUECK} data-ablage-ziel="wurzel" data-pfad-stueck="wurzel">
					<Gekuerzt text={WURZEL_NAME} />
				</Link>
			) : (
				<h1 className="truncate px-1 text-sm font-semibold">{WURZEL_NAME}</h1>
			)}
			{(mitte.length > 0 || ohneWurzel) && (
				<>
					{!ohneWurzel && <Trenner />}
					<Menue
						name="Weitere Ordner im Pfad"
						beschriftung="…"
						art="leise"
						groesse="klein"
						eintraege={[
							...(ohneWurzel
								? [{ titel: WURZEL_NAME, symbol: 'ordner' as const, waehle: () => gehe('/') }]
								: []),
							...mitte.map((o) => ({
								titel: o.name,
								symbol: 'ordner' as const,
								waehle: () => gehe(adresse(o.id)),
							})),
						]}
					/>
				</>
			)}
			{sichtbar.map((o) => (
				<span key={o.id} className="contents">
					<Trenner />
					<Link to={adresse(o.id)} className={STUECK} data-ablage-ziel={o.id} data-pfad-stueck={o.id}>
						<Gekuerzt text={o.name} />
					</Link>
				</span>
			))}
			{letzter && (
				<>
					<Trenner />
					<h1
						ref={kopf}
						className="flex min-w-0 flex-none px-1 text-sm font-semibold"
						style={{ minWidth: letzterMin, flexShrink: 1 }}
						data-ablage-ziel={letzter.id}
					>
						<Gekuerzt text={letzter.name} />
					</h1>
				</>
			)}
		</div>
	);
};
