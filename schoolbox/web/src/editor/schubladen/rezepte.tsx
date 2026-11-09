import type { Aufmachung } from '@schoolbox/kern/src/aufmachungen';
import {
	AUFMACHUNGEN,
	aufmachungsFormatVon,
	aufmachungVon,
	hatThemaKopf,
	leseAufmachung,
	wendeAufmachungAn,
} from '@schoolbox/kern/src/aufmachungen';

import { Knopf } from '../../bausteine/Knopf';
import { Schubladenhinweis, Schubladenkopf } from '../../bausteine/Schubladenkopf';
import { Symbol } from '../../bausteine/Symbol';
import { SPEICHERN_MS } from '../speichern';
import type { Aendere } from '../gestaltung/rezept/aktionen';
import { entferne, FREILEGEN_HINWEIS, legeFrei, wuerfle } from '../gestaltung/rezept/aktionen';
import { ansichtVon, RezeptKachel, useGespeicherterStand } from '../gestaltung/rezept/Kachel';
import { RezeptRegler } from '../gestaltung/rezept/Regler';
import { RezeptUebernehmen } from '../gestaltung/rezept/uebernehmen';
import type { Schublade, SchubladenTeile } from '.';
import { kopf } from './reihe';

const Inhalt = (t: SchubladenTeile) => {
	const quelle = t.zerlegung?.quelle ?? '';
	const stand = useGespeicherterStand(quelle, SPEICHERN_MS + 500);
	const werte = quelle ? leseAufmachung(quelle) : null;
	const aktiv = aufmachungVon(werte?.id);
	const format = quelle ? aufmachungsFormatVon(quelle) : null;
	const ansicht = ansichtVon(t.doc);
	const aus = !t.struktur.aktiv;
	const aendere: Aendere = (beschreibung, rechne) => t.struktur.aendereAttribute(beschreibung, rechne);
	const waehle = (a: Aufmachung) => {
		if (a.id !== aktiv?.id) {
			aendere(`Rezept ${a.name}`, (q) => wendeAufmachungAn(q, a.id));
		}
	};

	if (t.festeSeiten || !format) {
		return (
			<div className="flex min-h-0 flex-1 flex-col" data-schublade-rezepte>
				<Schubladenkopf titel="Rezepte" />
				<p className="p-3 text-sm text-leise">Rezepte gibt es nicht für Minibücher.</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-schublade-rezepte>
			<Schubladenkopf
				titel="Rezepte"
				mehr={
					aktiv
						? [{ titel: 'Rezept entfernen', symbol: 'papierkorb', gefahr: true, aus, waehle: () => entferne(aendere) }]
						: []
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<section className="flex flex-col gap-2 px-2 pt-2 pb-3">
					<h3 className="text-xs font-semibold text-leise">Für dieses Blatt</h3>
					{ansicht && (
						<div className="grid grid-cols-2 gap-2">
							{AUFMACHUNGEN.map((a) => (
								<RezeptKachel
									key={a.id}
									a={a}
									ansicht={ansicht}
									format={format}
									stand={stand}
									aktiv={a.id === aktiv?.id}
									aus={aus}
									waehle={() => waehle(a)}
								/>
							))}
						</div>
					)}
				</section>
				{aktiv && werte && (
					<section className="flex flex-col gap-2 border-t border-rand px-2 pt-2 pb-3" data-rezept-anpassen>
						<div className="flex gap-1">
							<Knopf art="zweit" groesse="klein" disabled={aus} onClick={() => wuerfle(aendere)} data-rezept-wuerfeln>
								<Symbol name="wuerfeln" />
								Würfeln
							</Knopf>
							<Knopf
								art="zweit"
								groesse="klein"
								disabled={aus}
								title={FREILEGEN_HINWEIS}
								onClick={() => legeFrei(aendere, t.doc)}
								data-rezept-freilegen
							>
								<Symbol name="entsperrt" />
								Freilegen
							</Knopf>
						</div>
						<h3 className="text-xs font-semibold text-leise">{`${aktiv.name} anpassen`}</h3>
						<RezeptRegler
							quelle={quelle}
							doc={t.doc}
							werte={werte}
							themaKopf={hatThemaKopf(quelle)}
							aendere={aendere}
							aus={aus}
						/>
						<RezeptUebernehmen quelle={quelle} />
					</section>
				)}
			</div>
			<Schubladenhinweis>Ein Rezept gilt für das ganze Material und lässt sich jederzeit wechseln.</Schubladenhinweis>
		</div>
	);
};

/** Rezepte (119, 7-rezepte.md): Kacheln mit dem offenen Material, Regler, Würfeln, Freilegen, Entfernen. */
export const schublade: Schublade = { ...kopf('rezepte'), bereit: (k) => k.frei, Inhalt };
