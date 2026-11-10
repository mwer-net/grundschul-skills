import { leseBogen } from '@schoolbox/kern/src/bogen';

import { Knopf } from '../../../bausteine/Knopf';
import { Popover } from '../../../bausteine/Popover';
import {
	BogenFarbeWahl,
	BogenGroesseFeld,
	BogenRegler,
	BogenSchalter,
	BogenSchriftWahl,
	BogenTextFeld,
	KonturWahl,
} from '../inspektor/kontur-bogen-teile';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/**
 * Titel im Bogen an der Leiste (5.7, 110): einzeiliges Textfeld, Schrift, Größe, Farbe, Kontur, Krümmung. Das Feld
 * bekommt beim Doppelklick auf den Bogen den Fokus; Enter oder Verlassen übernimmt, Esc verwirft.
 */
const SchmuckbogenKnoepfe = ({ aktiv, k, quelle }: LeistenTeile) => {
	const stand = leseBogen(quelle, k.nr);
	if (!stand) {
		return null;
	}
	const teile = { k, quelle, aktiv };
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
			<span className="tabular-nums">{`${Math.round(stand.gr)} px`}</span>
		</Knopf>
	);
	const farbeKnopf = (
		<Knopf art="leise" groesse="klein" data-leiste-farbe disabled={!aktiv}>
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
			<BogenTextFeld {...teile} leiste />
			<Popover name="Schrift" className="w-auto" ausloeser={schriftKnopf}>
				<BogenSchriftWahl {...teile} />
			</Popover>
			<Popover name="Größe" className="w-auto" ausloeser={groesseKnopf}>
				<BogenGroesseFeld {...teile} />
			</Popover>
			<Popover name="Farbe" className="w-auto max-w-72" ausloeser={farbeKnopf}>
				<BogenFarbeWahl {...teile} />
			</Popover>
			<Popover name="Kontur" className="w-56" ausloeser={konturKnopf}>
				<KonturWahl {...teile} />
			</Popover>
			<Popover name="Bogen" className="w-56" ausloeser={bogenKnopf}>
				<div className="flex flex-col gap-1">
					<BogenRegler {...teile} />
					<BogenSchalter {...teile} />
				</div>
			</Popover>
		</>
	);
};

export const SCHMUCKBOGEN_LEISTE: LeistenKnoepfe | null = SchmuckbogenKnoepfe;
