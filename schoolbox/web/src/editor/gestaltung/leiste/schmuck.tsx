import { leseSchmuck } from '@schoolbox/kern/src/schmuck';

import { Knopf } from '../../../bausteine/Knopf';
import { Popover } from '../../../bausteine/Popover';
import { FarbeWahl, GroesseFeld, SchriftWahl } from '../inspektor/text';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/** Wie die Schrift im Material gerade aussieht (Variablen aufgelöst). */
const sichtbareFarbe = (element: Element) =>
	element.ownerDocument.defaultView?.getComputedStyle(element).color ?? '#1f2937';

/**
 * Schmuckschrift an der Leiste (5.7): Schrift, Größe, Farbe als kleine Popover vor „Drehen“ und ⋯. Kontur und Bogen
 * bringt 110.
 */
const SchmuckKnoepfe = ({ aktiv, k, quelle }: LeistenTeile) => {
	const stand = leseSchmuck(quelle, k.nr);
	if (!stand) {
		return null;
	}
	const groesse =
		stand.gr ?? Math.round(parseFloat(k.element.ownerDocument.defaultView?.getComputedStyle(k.element).fontSize ?? ''));
	return (
		<>
			<Popover
				name="Schrift"
				className="w-auto"
				ausloeser={
					<Knopf art="leise" groesse="klein" data-leiste-schrift disabled={!aktiv}>
						<span aria-hidden className="font-semibold">
							Aa
						</span>
						{stand.schrift}
					</Knopf>
				}
			>
				<SchriftWahl k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
			<Popover
				name="Größe"
				className="w-auto"
				ausloeser={
					<Knopf art="leise" groesse="klein" data-leiste-groesse disabled={!aktiv}>
						<span className="tabular-nums">{Number.isFinite(groesse) ? `${groesse} px` : 'Größe'}</span>
					</Knopf>
				}
			>
				<GroesseFeld k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
			<Popover
				name="Farbe"
				className="w-auto max-w-72"
				ausloeser={
					<Knopf art="leise" groesse="klein" data-leiste-farbe disabled={!aktiv}>
						<span
							aria-hidden
							className="size-4 flex-none rounded-full border border-black/20"
							style={{ background: sichtbareFarbe(k.element) }}
						/>
						Farbe
					</Knopf>
				}
			>
				<FarbeWahl k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
		</>
	);
};

export const SCHMUCK_LEISTE: LeistenKnoepfe | null = SchmuckKnoepfe;
