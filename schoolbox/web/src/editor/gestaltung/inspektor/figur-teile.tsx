import type { BibliotheksFigur, Pose } from '@schoolbox/kern/src/figuren';
import { figurAn, poseName, tauscheFigur } from '@schoolbox/kern/src/figuren';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';
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

interface Auswahl {
	/** `/api/dokumente/<mappe>/<dok>`, dorthin kommt die neue Pose. */
	adresse: string | null;
	aktiv: boolean;
	/** Das Element, das getauscht wird. */
	nr: number;
	/** Quelle, in der `an` die Figur steht (bei der Leitfigur ihr eigenes HTML mit `an` = 0). */
	quelle: string;
	an: number;
	fuehreAus: (beschreibung: string, rechne: (q: string) => StrukturErgebnis) => unknown;
	/** Im Inspektor der Bausteine (Leitfigur, 199-11) steht „Figur“ über dem Menü; bei Gestaltung heißt so der Abschnitt. */
	mitTitel?: boolean;
}

/**
 * Die Figur im Menü, darunter ihre Posen (102, 177, 199-11). Ein Wechsel tauscht `data-figur`, `src` und `alt` in einem
 * Schritt; Lage, Größe, Drehen und Spiegeln bleiben. Eine unbekannte Pose wählt keine Kachel.
 */
export const FigurAuswahl = ({ adresse, aktiv, an, fuehreAus, mitTitel = false, nr, quelle }: Auswahl) => {
	const figuren = useFiguren();
	const id = useId();
	const zeigeHinweis = useHinweis();
	const jetzt = aktuelle(quelle, an, figuren);
	const vorher = jetzt?.pose ? poseName(jetzt.figur, jetzt.pose) : (jetzt?.figur.name ?? 'Figur');
	const waehle = async (figur: BibliotheksFigur, pose: Pose) => {
		if (!adresse) {
			return;
		}
		try {
			const src = await holeSrc(adresse, pose);
			fuehreAus(`${poseName(figur, pose)} statt ${vorher}`, (q) => tauscheFigur(q, nr, figur, pose, src));
		} catch (fehler) {
			zeigeHinweis({ text: meldung(fehler), art: 'fehler' });
		}
	};
	const posen = jetzt?.figur.posen ?? [];
	const menue = (
		<select
			id={id}
			aria-label="Figur"
			className={klassen(FELD_KLASSEN, mitTitel ? 'w-fit! max-w-36 pr-5!' : 'pr-5!')}
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
	);
	return (
		<div className="flex flex-col gap-1" data-figur-wahl={jetzt?.figur.id ?? ''}>
			{mitTitel ? (
				<Zeile titel="Figur" fuer={id}>
					{menue}
				</Zeile>
			) : (
				menue
			)}
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

/** Abschnitt „Figur“ bei einer freien Figur (199-20): das Menü ohne eigene Überschrift, darunter die Posen. */
export const FigurWahl = ({ aktiv, k, quelle }: InspektorTeile) => (
	<FigurAuswahl
		adresse={adresseVon(k.doc)}
		aktiv={aktiv}
		nr={k.nr}
		an={k.nr}
		quelle={quelle}
		fuehreAus={k.fuehreAus}
	/>
);
