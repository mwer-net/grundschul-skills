import type { PlanPruefPunkt, PlanPruefStand } from '@schoolbox/kern/src/einheit-plan-pruefung';

import { Symbol } from '../bausteine/Symbol';
import { planPruefAnzeige, punktKopf } from './einheit-plan-pruefung-text';
import { Aufklapp } from './EinheitPlanDetails';

const Punkt = ({ p }: { p: PlanPruefPunkt }) => (
	<li>
		<span className="text-leise">{`${punktKopf(p)}: `}</span>
		{p.text}
		{p.antwort && <span className="text-leise">{` Claude: ${p.antwort}`}</span>}
	</li>
);

/**
 * „Geprüft“ am Plan (247): was Rechnung und Prüfung fanden. Offenes ist ein Hinweis, keine Sperre; Behobenes zum
 * Aufklappen. Vor der Freigabe offen sichtbar, danach (`zu`) nur noch zum Aufklappen. Ohne Stand nichts.
 */
export const PlanGeprueft = ({ stand, zu = false }: { stand: PlanPruefStand | undefined; zu?: boolean }) => {
	const a = planPruefAnzeige(stand);
	if (!a) {
		return null;
	}
	const inhalt = (
		<div className="flex flex-col gap-1">
			{a.hinweis && <p className="text-leise">{a.hinweis}</p>}
			{a.offen.length > 0 && (
				<ul className="flex flex-col gap-0.5" data-plan-offen>
					{a.offen.map((p, i) => (
						<Punkt key={`${i}-${p.text}`} p={p} />
					))}
				</ul>
			)}
			{a.behoben.length > 0 && (
				<Aufklapp titel={`Behoben (${a.behoben.length})`}>
					<ul className="flex flex-col gap-0.5">
						{a.behoben.map((p, i) => (
							<Punkt key={`${i}-${p.text}`} p={p} />
						))}
					</ul>
				</Aufklapp>
			)}
		</div>
	);
	if (zu) {
		return <Aufklapp titel={`${a.titel} (vor der Freigabe)`}>{inhalt}</Aufklapp>;
	}
	return (
		<div className="flex max-w-[46rem] flex-col gap-1 text-sm" data-einheit-geprueft>
			<h3 className="flex items-center gap-1 font-medium">
				<Symbol name={a.offen.length || a.nurGerechnet ? 'info' : 'haken'} className="size-3.5 text-leise" />
				{a.titel}
			</h3>
			{inhalt}
		</div>
	);
};
