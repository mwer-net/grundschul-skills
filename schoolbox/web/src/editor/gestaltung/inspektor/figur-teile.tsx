import type { Figur } from '@schoolbox/kern/src/figuren';
import { figurAn, FIGUREN, figurSchluessel, tauscheFigur } from '@schoolbox/kern/src/figuren';

import { KACHEL, klassen } from '../../../bausteine/klassen';
import { Zeile } from '../../../bausteine/Zeile';
import { adresseVon, bekannteSrc, holeSrc } from '../figuren-quelle';
import type { InspektorTeile } from './abschnitte';

const aktuelle = (quelle: string, nr: number) => {
	try {
		return figurAn(quelle, nr);
	} catch {
		return undefined;
	}
};

/** Abschnitt 6 bei einer Figur (102): eine andere Figur wählen. Lage, Größe, Drehen und Spiegeln bleiben. */
export const FigurWahl = ({ aktiv, k, quelle }: InspektorTeile) => {
	const jetzt = aktuelle(quelle, k.nr);
	const waehle = async (f: Figur) => {
		const adresse = adresseVon(k.doc);
		const src = adresse ? await holeSrc(adresse, f).catch(() => bekannteSrc(adresse, f)) : bekannteSrc(null, f);
		k.fuehreAus(`${f.name} statt ${jetzt?.name ?? 'Figur'}`, (q) => tauscheFigur(q, k.nr, f, src));
	};
	return (
		<div data-figur-wahl={jetzt?.id ?? ''}>
			<Zeile titel="Figur" darunter>
				<div role="group" aria-label="Figur" className="grid grid-cols-4 gap-1">
					{FIGUREN.map((f) => (
						<button
							key={f.id}
							type="button"
							title={f.name}
							aria-pressed={f.id === jetzt?.id}
							disabled={!aktiv}
							className={klassen(KACHEL, 'flex-col py-1')}
							onClick={() => {
								if (f.id !== jetzt?.id) {
									void waehle(f);
								}
							}}
						>
							<img
								src={`/ansicht/${figurSchluessel(f)}`}
								alt=""
								className="aspect-square w-full object-contain"
							/>
							<span className="max-w-full text-[11px] leading-tight">{f.name}</span>
						</button>
					))}
				</div>
			</Zeile>
		</div>
	);
};
