import { createPortal } from 'react-dom';

import type { AblegenTeile } from './ablegen/ablegen';
import { AblageKachel } from './ablegen/Kachel';
import { gestaltungsgut } from './ablegen/ziehgut';
import { Werkzeugknoepfe } from './werkzeuge/werkzeugknoepfe';

/** Das Gut des Tests: ein Rechteck mit fester Größe. */
export const TEST_GUT = gestaltungsgut({
	name: 'Testgut',
	html: '<div class="testgut" style="background:#bfdbfe;border:2px solid #1e3a8a"></div>',
	groesse: { b: 120, h: 80 },
});

/**
 * Nur im Test (`window.__schoolboxTest.gestaltung`): Werkzeugknöpfe und ein Gut zum Klicken und Ziehen, unten rechts
 * über allem. So prüft `gestaltung-ablegen.spec.ts` das Grundgerüst ohne Schublade mit Inhalt.
 */
export const Testfach = ({ teile }: { teile: AblegenTeile }) =>
	createPortal(
		<div
			className="fixed right-4 bottom-16 z-meldung flex items-center gap-2 rounded-lg border border-rand bg-flaeche p-2 shadow-2"
			data-testfach
		>
			<Werkzeugknoepfe lage={{ frei: true }} />
			<AblageKachel teile={teile} gut={TEST_GUT} className="h-10 w-16 rounded border border-rand bg-brand-50">
				Gut
			</AblageKachel>
		</div>,
		document.body,
	);
