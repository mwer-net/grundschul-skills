import type { AufmachungsRahmen, AufmachungWerte, KonfettiForm, Kopfband } from '@schoolbox/kern/src/aufmachungen';
import { aufmachungVon, KONFETTI_FORMEN, wendeAufmachungAn } from '@schoolbox/kern/src/aufmachungen';

import { klassen } from '../../../bausteine/klassen';
import { Segment } from '../../../bausteine/Segment';
import { Regler } from '../blatt/regler';
import type { Aendere } from './aktionen';
import { zeigeKonfetti } from './vorschau';

const KOPFBAND: { wert: Kopfband; titel: string }[] = [
	{ wert: 'ohne', titel: 'ohne' },
	{ wert: 'gerade', titel: 'gerade' },
	{ wert: 'welle', titel: 'Welle' },
	{ wert: 'bogen', titel: 'Bogen' },
	{ wert: 'zacken', titel: 'Zacken' },
];

const RAHMEN: { wert: AufmachungsRahmen; titel: string }[] = [
	{ wert: 'ohne', titel: 'ohne' },
	{ wert: 'linie', titel: 'Linie' },
	{ wert: 'gestrichelt', titel: 'gestr.' },
	{ wert: 'gepunktet', titel: 'gepunkt.' },
	{ wert: 'doppelt', titel: 'doppelt' },
];

const FORM_NAMEN: Record<KonfettiForm, string> = { punkt: 'Punkt', dreieck: 'Dreieck', raute: 'Raute', stern: 'Stern' };

interface Eigenschaften {
	quelle: string;
	doc: Document | null;
	werte: AufmachungWerte;
	themaKopf: boolean;
	aendere: Aendere;
	aus?: boolean;
}

/**
 * Die Regler eines Rezepts (119, Tabelle „Regler“ in 7-rezepte.md), in Schublade und Inspektor gleich. Jede Änderung
 * ist ein Schritt; der Schieber zeigt beim Ziehen nur an und schreibt beim Loslassen.
 */
export const RezeptRegler = ({ aendere, aus, doc, quelle, themaKopf, werte }: Eigenschaften) => {
	const a = aufmachungVon(werte.id);
	if (!a) {
		return null;
	}
	const setze = (beschreibung: string, neu: Partial<AufmachungWerte>) =>
		aendere(beschreibung, (q) => wendeAufmachungAn(q, werte.id, { ...werte, ...neu }));
	const schalteForm = (f: KonfettiForm) => {
		const an = werte.konfetti.formen.includes(f);
		const formen = an
			? werte.konfetti.formen.filter((x) => x !== f)
			: KONFETTI_FORMEN.filter((x) => x === f || werte.konfetti.formen.includes(x));
		if (formen.length > 0) {
			setze('Konfetti', { konfetti: { ...werte.konfetti, formen } });
		}
	};
	return (
		<div className="flex flex-col gap-3" data-rezept-regler>
			<div className="flex items-center justify-between gap-2">
				<span className="text-leise">Farben</span>
				<div className="flex gap-2" role="group" aria-label="Farben">
					{a.farbwelten.map((w, i) => {
						const nr = (i + 1) as 1 | 2 | 3;
						return (
							<button
								key={w.name}
								type="button"
								title={w.name}
								aria-label={`Farben ${w.name}`}
								aria-pressed={werte.farben === nr}
								disabled={aus}
								data-rezept-farben={nr}
								className={klassen(
									'size-7 overflow-hidden rounded-full border-2 disabled:opacity-50',
									werte.farben === nr ? 'border-brand-500' : 'border-rand hover:border-leise',
								)}
								style={{ background: `linear-gradient(90deg, ${w.a1} 50%, ${w.a2} 50%)` }}
								onClick={() => werte.farben !== nr && setze('Farben', { farben: nr })}
							/>
						);
					})}
				</div>
			</div>
			<div>
				<Regler
					name="rezept-konfetti"
					titel="Konfetti"
					wert={Math.round(werte.konfetti.menge * 100)}
					min={0}
					max={100}
					schritt={5}
					einheit=" %"
					aus={aus}
					zeige={(n) => zeigeKonfetti(doc, quelle, { ...werte.konfetti, menge: n / 100 })}
					setze={(n) => setze('Konfetti', { konfetti: { ...werte.konfetti, menge: n / 100 } })}
				/>
				<div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Formen des Konfettis">
					{KONFETTI_FORMEN.map((f) => (
						<button
							key={f}
							type="button"
							aria-pressed={werte.konfetti.formen.includes(f)}
							disabled={aus}
							data-rezept-form={f}
							className={klassen(
								'rounded-md px-2 py-0.5 text-sm disabled:opacity-50',
								werte.konfetti.formen.includes(f)
									? 'bg-flaeche-2 text-tinte'
									: 'text-leise hover:text-tinte',
							)}
							onClick={() => schalteForm(f)}
						>
							{FORM_NAMEN[f]}
						</button>
					))}
				</div>
			</div>
			<div className="flex flex-col gap-1" data-rezept-kopfband>
				<span className="text-leise">Kopfband</span>
				<Segment
					beschriftung="Kopfband"
					className="flex w-full *:flex-auto *:px-1 *:text-[11px]"
					werte={themaKopf ? KOPFBAND.slice(0, 1) : KOPFBAND}
					wert={themaKopf ? 'ohne' : werte.kopfband}
					aus={aus}
					waehle={(kopfband) => kopfband !== werte.kopfband && setze('Kopfband', { kopfband })}
				/>
				{themaKopf && <p className="text-xs text-leise">Das Thema dieser Reihe gestaltet den Kopf.</p>}
			</div>
			<div className="flex flex-col gap-1" data-rezept-rahmen>
				<span className="text-leise">Rahmen</span>
				<Segment
					beschriftung="Rahmen"
					className="flex w-full *:flex-auto *:px-1 *:text-[11px]"
					werte={RAHMEN}
					wert={werte.rahmen}
					aus={aus}
					waehle={(rahmen) => rahmen !== werte.rahmen && setze('Rahmen', { rahmen })}
				/>
			</div>
		</div>
	);
};
