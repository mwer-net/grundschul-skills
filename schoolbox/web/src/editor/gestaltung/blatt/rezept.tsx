import { hatThemaKopf, leseAufmachung } from '@schoolbox/kern/src/aufmachungen';
import { aufmachungVon } from '@schoolbox/kern/src/rezepte/index';

import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import { entferne, FREILEGEN_HINWEIS, legeFrei, REZEPTE_OEFFNEN, wuerfle } from '../rezept/aktionen';
import { RezeptRegler } from '../rezept/Regler';
import type { BlattTeile } from './teile';

/**
 * Rezept des Materials (119), über Fläche und Rahmen: Name, Regler, Würfeln, Freilegen, Entfernen. Ein Rezept gilt
 * immer für das ganze Material, „Gilt für“ betrifft es nicht.
 */
export const BlattRezept = (t: BlattTeile) => {
	if (t.minibuch) {
		return null;
	}
	const werte = leseAufmachung(t.quelle);
	const a = aufmachungVon(werte?.id);
	if (!werte || !a) {
		return (
			<div className="flex flex-col gap-1" data-blatt-rezept="">
				<span className="font-medium">Rezept</span>
				<p className="text-xs text-leise">Kein Rezept. Rezepte stehen in der Schublade ⌥7.</p>
				<Knopf
					art="zweit"
					groesse="klein"
					className="self-start"
					onClick={() => window.dispatchEvent(new CustomEvent(REZEPTE_OEFFNEN))}
				>
					<Symbol name="rezepte" />
					Rezepte öffnen
				</Knopf>
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-2" data-blatt-rezept={a.id}>
			<div className="flex items-center justify-between gap-2">
				<span className="font-medium">{`Rezept: ${a.name}`}</span>
			</div>
			<p className="text-xs text-leise">Ein Rezept gilt immer für das ganze Material.</p>
			<RezeptRegler
				quelle={t.quelle}
				doc={t.doc}
				werte={werte}
				themaKopf={hatThemaKopf(t.quelle)}
				aendere={t.aendere}
			/>
			<div className="flex flex-wrap gap-1">
				<Knopf art="zweit" groesse="klein" onClick={() => wuerfle(t.aendere)} data-rezept-wuerfeln>
					<Symbol name="wuerfeln" />
					Würfeln
				</Knopf>
				<Knopf
					art="zweit"
					groesse="klein"
					title={FREILEGEN_HINWEIS}
					onClick={() => legeFrei(t.aendere, t.doc)}
					data-rezept-freilegen
				>
					<Symbol name="entsperrt" />
					Freilegen
				</Knopf>
				<Knopf art="leise" groesse="klein" onClick={() => entferne(t.aendere)} data-rezept-entfernen>
					<Symbol name="papierkorb" />
					Entfernen
				</Knopf>
			</div>
		</div>
	);
};
