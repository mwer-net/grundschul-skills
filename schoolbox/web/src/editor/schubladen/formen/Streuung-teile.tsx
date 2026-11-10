import type { StreuArt } from '@schoolbox/kern/src/streuen';
import {
	STANDARD_FARBEN,
	STANDARD_FORMEN,
	STREU_ARTEN,
	STREU_NAMEN,
	streue,
	teileAlsSvg,
} from '@schoolbox/kern/src/streuen';

import { klassen } from '../../../bausteine/klassen';
import { SymbolKnopf } from '../../../bausteine/SymbolKnopf';
import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import { useStreuArt } from '../../gestaltung/streuung-stand';
import { waehleWerkzeug } from '../../gestaltung/werkzeuge/stand';
import { gutVon, NAMEN, SUCHE } from './Streuung-daten';
import type { FormenTeile } from './typ';
import { passtZurSuche } from './typ';

/** Fest, damit die Kacheln ruhig bleiben. */
const VORSCHAU_SAAT: Record<StreuArt, number> = { punkte: 11, konfetti: 23, sterne: 5 };
const VORSCHAU = { b: 150, h: 100 } as const;

/** Wie die Variable im Material gerade aussieht; ohne Material ein neutrales Grau. */
const farbe = (doc: Document | null, name: string) => {
	const body = doc?.body;
	const fenster = doc?.defaultView;
	return (body && fenster?.getComputedStyle(body).getPropertyValue(`--${name}`).trim()) || '#9ca3af';
};

/** Vorschau aus derselben Funktion, die die Streuung im Blatt zeichnet, in den Farben des Materials. */
export const Vorschau = ({ art, doc }: { art: StreuArt; doc: Document | null }) => {
	const teile = streue({
		art,
		saat: VORSCHAU_SAAT[art],
		dichte: 0.6,
		formen: STANDARD_FORMEN[art],
		farben: STANDARD_FARBEN,
		groesse: 'mittel',
		...VORSCHAU,
		...(art === 'punkte' ? { ecke: 'ul' as const } : {}),
	});
	return (
		<svg
			aria-hidden
			viewBox={`0 0 ${VORSCHAU.b} ${VORSCHAU.h}`}
			className="h-10 w-full"
			dangerouslySetInnerHTML={{ __html: teileAlsSvg(teile, (name) => farbe(doc, name)) }}
		/>
	);
};

export const Kacheln = ({ suche, teile }: FormenTeile) => {
	const zuletzt = useStreuArt();
	const liste = STREU_ARTEN.filter((art) => passtZurSuche([...NAMEN[art]], suche));
	const knopf = passtZurSuche(SUCHE, suche) || suche.trim() === '';
	return (
		<div className="flex items-start gap-1" data-streuung-abschnitt>
			<div className="grid min-w-0 flex-1 grid-cols-3 gap-1" data-streuung-kacheln>
				{liste.map((art) => (
					<AblageKachel
						key={art}
						teile={teile}
						gut={gutVon(art, teile.doc)}
						daten={{ 'data-streuung-art': art }}
						className={klassen(
							'flex h-14 flex-col items-center justify-center rounded-lg bg-flaeche-2 px-1 hover:bg-brand-50',
							zuletzt === art && 'ring-2 ring-brand-500/60',
						)}
					>
						<Vorschau art={art} doc={teile.doc} />
						<span className="text-xs text-leise">{STREU_NAMEN[art]}</span>
					</AblageKachel>
				))}
			</div>
			{knopf && (
				<SymbolKnopf
					symbol="streuung"
					beschriftung="Streuen"
					tooltip="Streuen: Fläche aufziehen (⇧ hält es)"
					data-streuen-knopf
					onClick={(ev) => waehleWerkzeug('streuen', ev.shiftKey)}
				/>
			)}
		</div>
	);
};
