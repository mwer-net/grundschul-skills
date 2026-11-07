import type { Figur } from '@schoolbox/kern/src/figuren';
import { FIGUREN, figurAn, figurSchluessel, tauscheFigur } from '@schoolbox/kern/src/figuren';

import { klassen } from '../../../bausteine/klassen';
import { adresseVon, bekannteSrc, holeSrc } from '../figuren-quelle';
import type { InspektorTeil, InspektorTeile } from './abschnitte';

const aktuelle = (quelle: string, nr: number) => {
	try {
		return figurAn(quelle, nr);
	} catch {
		return undefined;
	}
};

/** Abschnitt 6 bei einer Figur (102): eine andere Figur wählen. Lage, Größe, Drehen und Spiegeln bleiben. */
const FigurWahl = ({ aktiv, k, quelle }: InspektorTeile) => {
	const jetzt = aktuelle(quelle, k.nr);
	const waehle = async (f: Figur) => {
		const adresse = adresseVon(k.doc);
		const src = adresse ? await holeSrc(adresse, f).catch(() => bekannteSrc(adresse, f)) : bekannteSrc(null, f);
		k.fuehreAus(`${f.name} statt ${jetzt?.name ?? 'Figur'}`, (q) => tauscheFigur(q, k.nr, f, src));
	};
	return (
		<div className="flex flex-col gap-1" data-figur-wahl={jetzt?.id ?? ''}>
			<span className="text-leise">Figur</span>
			<div role="group" aria-label="Figur" className="grid grid-cols-4 gap-1">
				{FIGUREN.map((f) => (
					<button
						key={f.id}
						type="button"
						title={f.name}
						aria-pressed={f.id === jetzt?.id}
						disabled={!aktiv}
						className={klassen(
							'flex flex-col items-center gap-0.5 rounded-md border p-1 text-[11px] disabled:opacity-50',
							f.id === jetzt?.id ? 'border-brand-500 bg-brand-50' : 'border-rand hover:bg-flaeche-2',
						)}
						onClick={() => {
							if (f.id !== jetzt?.id) {
								void waehle(f);
							}
						}}
					>
						<img src={`/ansicht/${figurSchluessel(f)}`} alt="" className="aspect-square w-full object-contain" />
						{f.name}
					</button>
				))}
			</div>
		</div>
	);
};

export const FIGUR_TEILE: InspektorTeil[] = [
	{ id: 'figur', abschnitt: 6, reihenfolge: 2, fuer: (art) => art === 'figurfrei', Inhalt: FigurWahl },
];
