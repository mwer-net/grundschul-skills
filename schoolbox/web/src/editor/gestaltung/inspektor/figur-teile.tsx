import type { BibliotheksFigur, Pose } from '@schoolbox/kern/src/figuren';
import { figurAn, poseName, tauscheFigur } from '@schoolbox/kern/src/figuren';
import { useId } from 'react';

import { meldung } from '../../../api';
import { useHinweis } from '../../../bausteine/hinweis';
import { FELD_KLASSEN, KACHEL, klassen } from '../../../bausteine/klassen';
import { Tooltip } from '../../../bausteine/Tooltip';
import { Zeile } from '../../../bausteine/Zeile';
import { adresseVon, holeSrc, useFiguren, vorschauVon } from '../figuren-quelle';
import type { InspektorTeile } from './abschnitte';

const aktuelle = (quelle: string, nr: number, figuren: readonly BibliotheksFigur[]) => {
	try {
		return figurAn(quelle, nr, figuren);
	} catch {
		return undefined;
	}
};

/**
 * Abschnitt 6 bei einer Figur (102, 177): die Figur im Menü, darunter ihre Posen. Ein Wechsel tauscht `data-figur`,
 * `src` und `alt` in einem Schritt; Lage, Größe, Drehen und Spiegeln bleiben. Eine unbekannte Pose wählt keine Kachel.
 */
export const FigurWahl = ({ aktiv, k, quelle }: InspektorTeile) => {
	const figuren = useFiguren();
	const id = useId();
	const zeigeHinweis = useHinweis();
	const jetzt = aktuelle(quelle, k.nr, figuren);
	const vorher = jetzt?.pose ? poseName(jetzt.figur, jetzt.pose) : (jetzt?.figur.name ?? 'Figur');
	const waehle = async (figur: BibliotheksFigur, pose: Pose) => {
		const adresse = adresseVon(k.doc);
		if (!adresse) {
			return;
		}
		try {
			const src = await holeSrc(adresse, pose);
			k.fuehreAus(`${poseName(figur, pose)} statt ${vorher}`, (q) => tauscheFigur(q, k.nr, figur, pose, src));
		} catch (fehler) {
			zeigeHinweis({ text: meldung(fehler), art: 'fehler' });
		}
	};
	const posen = jetzt?.figur.posen ?? [];
	return (
		<div className="flex flex-col gap-1" data-figur-wahl={jetzt?.figur.id ?? ''}>
			<Zeile titel="Figur" fuer={id}>
				<select
					id={id}
					className={klassen(FELD_KLASSEN, 'w-fit! max-w-36 pr-5!')}
					disabled={!aktiv}
					value={jetzt?.figur.id ?? ''}
					onChange={(e) => {
						const figur = figuren.find((f) => f.id === e.target.value);
						const grund = figur?.posen[0];
						if (figur && grund) {
							void waehle(figur, grund);
						}
					}}
				>
					{!jetzt && <option value="" />}
					{figuren.map((f) => (
						<option key={f.id} value={f.id}>
							{f.name}
						</option>
					))}
				</select>
			</Zeile>
			{jetzt && posen.length > 1 && (
				<div role="group" aria-label="Pose" className="grid grid-cols-4 gap-1">
					{posen.map((pose) => {
						const name = poseName(jetzt.figur, pose);
						return (
							<Tooltip key={pose.id} text={name}>
								<button
									type="button"
									aria-label={name}
									aria-pressed={pose.id === jetzt.pose?.id}
									disabled={!aktiv}
									className={klassen(KACHEL, 'aspect-square p-1')}
									onClick={() => {
										if (pose.id !== jetzt.pose?.id) {
											void waehle(jetzt.figur, pose);
										}
									}}
								>
									<img src={vorschauVon(pose)} alt="" className="size-full object-contain" />
								</button>
							</Tooltip>
						);
					})}
				</div>
			)}
		</div>
	);
};
