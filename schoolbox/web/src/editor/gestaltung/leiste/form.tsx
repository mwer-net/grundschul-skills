import { leseForm } from '@schoolbox/kern/src/formen-aendern';

import { Knopf } from '../../../bausteine/Knopf';
import { Popover } from '../../../bausteine/Popover';
import { pfadDerForm } from '../anzeige-folgen';
import { FuellungWahl, KonturWahl } from '../inspektor/form-farben';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/** Wie die Farbe im Material gerade aussieht (Variablen aufgelöst); ohne Pfad `null`. */
const sichtbar = (element: Element, eigenschaft: 'fill' | 'stroke') => {
	const pfad = pfadDerForm(element); // 107: auch in `.form-text`
	const fenster = element.ownerDocument.defaultView;
	return pfad && fenster ? fenster.getComputedStyle(pfad).getPropertyValue(eigenschaft) : null;
};

const KEINE = 'linear-gradient(135deg, #fff 42%, #e11d48 42% 58%, #fff 58%)';

/** Füllung und Kontur als kleine Farb-Popover (5.7), vor „Drehen“ und ⋯. */
const FormKnoepfe = ({ aktiv, k, quelle }: LeistenTeile) => {
	const stand = leseForm(quelle, k.nr);
	if (!stand) {
		return null;
	}
	const fuellung = stand.fuellung === null ? null : sichtbar(k.element, 'fill');
	const kontur = stand.kontur === null ? null : sichtbar(k.element, 'stroke');
	return (
		<>
			{/* 107: Die Linie hat keine Füllung. */}
			{!k.element.matches('svg.form[data-form="linie"]') && (
			<Popover
				name="Füllung"
				className="w-auto max-w-72"
				ausloeser={
					<Knopf art="leise" groesse="klein" data-leiste-fuellung disabled={!aktiv}>
						<span
							aria-hidden
							className="size-4 flex-none rounded-full border border-black/20"
							style={{ background: fuellung ?? KEINE }}
						/>
						Füllung
					</Knopf>
				}
			>
				<FuellungWahl k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
			)}
			<Popover
				name="Kontur"
				className="w-auto max-w-72"
				ausloeser={
					<Knopf art="leise" groesse="klein" data-leiste-kontur disabled={!aktiv}>
						<span
							aria-hidden
							className="size-4 flex-none rounded-full border-[3px] bg-white"
							style={kontur ? { borderColor: kontur } : { background: KEINE, borderColor: '#d4d4d8' }}
						/>
						Kontur
					</Knopf>
				}
			>
				<KonturWahl k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
		</>
	);
};

export const FORM_LEISTE: LeistenKnoepfe | null = FormKnoepfe;
