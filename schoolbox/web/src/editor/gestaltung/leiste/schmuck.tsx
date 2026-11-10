import { leseSchmuck } from '@schoolbox/kern/src/schmuck';

import { Knopf } from '../../../bausteine/Knopf';
import { Popover } from '../../../bausteine/Popover';
import { BogenSchalter, KonturWahl } from '../inspektor/kontur-bogen-teile';
import { FarbeWahl, GroesseFeld, SchriftWahl } from '../inspektor/text-teile';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/** Wie die Schrift im Material gerade aussieht (Variablen aufgelöst). */
const sichtbareFarbe = (element: Element) =>
	element.ownerDocument.defaultView?.getComputedStyle(element).color ?? '#1f2937';

/**
 * Schmuckschrift an der Leiste (5.7): Schrift, Größe, Farbe, Kontur und Bogen als kleine Popover vor „Drehen“ und ⋯.
 * Der Bogen gilt nur für den Titel (110).
 */
const SchmuckKnoepfe = ({ aktiv, k, quelle }: LeistenTeile) => {
	const stand = leseSchmuck(quelle, k.nr);
	if (!stand) {
		return null;
	}
	const groesse =
		stand.gr ??
		Math.round(parseFloat(k.element.ownerDocument.defaultView?.getComputedStyle(k.element).fontSize ?? ''));
	const schriftKnopf = (
		<Knopf art="leise" groesse="klein" data-leiste-schrift disabled={!aktiv}>
			<span aria-hidden className="font-semibold">
				Aa
			</span>
			{stand.schrift}
		</Knopf>
	);
	const groesseKnopf = (
		<Knopf art="leise" groesse="klein" data-leiste-groesse disabled={!aktiv}>
			<span className="tabular-nums">{Number.isFinite(groesse) ? `${groesse} px` : 'Größe'}</span>
		</Knopf>
	);
	const farbeKnopf = (
		<Knopf art="leise" groesse="klein" data-leiste-farbe disabled={!aktiv}>
			<span
				aria-hidden
				className="size-4 flex-none rounded-full border border-black/20"
				style={{ background: sichtbareFarbe(k.element) }}
			/>
			Farbe
		</Knopf>
	);
	const konturKnopf = (
		<Knopf art="leise" groesse="klein" data-leiste-kontur disabled={!aktiv}>
			Kontur
		</Knopf>
	);
	const bogenKnopf = (
		<Knopf art="leise" groesse="klein" data-leiste-bogen disabled={!aktiv}>
			Bogen
		</Knopf>
	);
	return (
		<>
			<Popover name="Schrift" className="w-auto" ausloeser={schriftKnopf}>
				<SchriftWahl k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
			<Popover name="Größe" className="w-auto" ausloeser={groesseKnopf}>
				<GroesseFeld k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
			<Popover name="Farbe" className="w-auto max-w-72" ausloeser={farbeKnopf}>
				<FarbeWahl k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
			<Popover name="Kontur" className="w-56" ausloeser={konturKnopf}>
				<KonturWahl k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
			{stand.art === 'titel' && (
				<Popover name="Bogen" className="w-56" ausloeser={bogenKnopf}>
					<BogenSchalter k={k} quelle={quelle} aktiv={aktiv} />
				</Popover>
			)}
		</>
	);
};

export const SCHMUCK_LEISTE: LeistenKnoepfe | null = SchmuckKnoepfe;
