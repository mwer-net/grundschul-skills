import { leseForm, setzeFormParameter, wechsleForm } from '@schoolbox/kern/src/formen-aendern';
import { BLASEN } from '@schoolbox/kern/src/formen-text';
import { leseSchmuck } from '@schoolbox/kern/src/schmuck';

import { Knopf } from '../../../bausteine/Knopf';
import { Popover } from '../../../bausteine/Popover';
import { Symbol } from '../../../bausteine/Symbol';
import { pfadDerForm } from '../anzeige-folgen';
import { KonturWahl } from '../inspektor/form-farben';
import { SchriftWahl } from '../inspektor/text';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

interface Eintrag {
	id: string;
	name: string;
	art: string;
	blase: number | null;
}

/** Die Arten im Menü „Art ▾“: drei Blasen und das Band. */
const ARTEN: Eintrag[] = [
	...BLASEN.map((b, i) => ({
		id: `sprechblase-${b.wert}`,
		name: b.wert === 'gedanke' ? 'Denkblase' : `Sprechblase ${b.name.toLowerCase()}`,
		art: 'sprechblase',
		blase: i as number | null,
	})),
	{ id: 'band', name: 'Band', art: 'band', blase: null },
];

/** Form wechseln (Text, Füllung, Kontur und Lage bleiben), bei der Sprechblase mit der Art der Blase: ein Schritt. */
const waehle = (k: LeistenTeile['k'], eintrag: Eintrag) =>
	k.fuehreAus(`Form: ${eintrag.name}`, (q) => {
		const gewechselt = wechsleForm(q, k.nr, eintrag.art);
		return {
			quelle:
				eintrag.blase === null ? gewechselt : setzeFormParameter(gewechselt, k.nr, { 'data-blase': eintrag.blase }),
			nr: k.nr,
		};
	});

/** Form mit Text an der Leiste (5.7): Art (Sprechblase ▾), Kontur, Schrift (Aa), vor „Drehen“ und ⋯. */
const FormTextKnoepfe = ({ aktiv, k, quelle }: LeistenTeile) => {
	const stand = leseForm(quelle, k.nr);
	const text = leseSchmuck(quelle, k.nr);
	if (!stand) {
		return null;
	}
	const jetzt = ARTEN.find((a) => a.art === stand.art && (a.blase === null || a.blase === stand.param['data-blase']));
	const pfad = pfadDerForm(k.element);
	const fenster = k.element.ownerDocument.defaultView;
	const kontur = stand.kontur && pfad && fenster ? fenster.getComputedStyle(pfad).getPropertyValue('stroke') : null;
	return (
		<>
			<Popover
				name="Art"
				className="w-auto"
				ausloeser={
					<Knopf art="leise" groesse="klein" data-leiste-formart={jetzt?.id} disabled={!aktiv}>
						{jetzt?.name ?? 'Art'}
						<Symbol name="runter" />
					</Knopf>
				}
			>
				<div className="flex flex-col items-stretch gap-0.5" role="menu" aria-label="Art">
					{ARTEN.map((a) => (
						<Knopf
							key={a.id}
							art="leise"
							groesse="klein"
							role="menuitemradio"
							aria-checked={a.id === jetzt?.id}
							data-formart={a.id}
							disabled={!aktiv}
							onClick={() => a.id !== jetzt?.id && waehle(k, a)}
						>
							{a.name}
						</Knopf>
					))}
				</div>
			</Popover>
			<Popover
				name="Kontur"
				className="w-auto max-w-72"
				ausloeser={
					<Knopf art="leise" groesse="klein" data-leiste-kontur disabled={!aktiv}>
						<span
							aria-hidden
							className="size-4 flex-none rounded-full border-[3px] bg-white"
							style={kontur ? { borderColor: kontur } : { borderColor: '#d4d4d8' }}
						/>
						Kontur
					</Knopf>
				}
			>
				<KonturWahl k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
			{text && (
				<Popover
					name="Schrift"
					className="w-auto"
					ausloeser={
						<Knopf art="leise" groesse="klein" data-leiste-schrift disabled={!aktiv}>
							<span aria-hidden className="font-semibold">
								Aa
							</span>
							{text.schrift}
						</Knopf>
					}
				>
					<SchriftWahl k={k} quelle={quelle} aktiv={aktiv} />
				</Popover>
			)}
		</>
	);
};

/** 107: Art (Sprechblase ▾), Kontur, Schrift (Briefing 5.7). */
export const FORMTEXT_LEISTE: LeistenKnoepfe | null = FormTextKnoepfe;
