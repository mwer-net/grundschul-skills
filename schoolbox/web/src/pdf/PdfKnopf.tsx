import type { KnopfArt, KnopfGroesse } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import type { PdfWahl } from './usePdf';
import { usePdf } from './usePdf';

export type { PdfWahl } from './usePdf';

interface Eigenschaften {
	beschriftung: string;
	/** Eine Wahl: ein einfacher Knopf. Mehrere: ein Menü. */
	wahl: PdfWahl[];
	mappe: { id: string; titel: string };
	/** Teilen-Links laden ohne Warnung herunter: Reparieren kann dort ohnehin niemand. */
	warnen: boolean;
	ganzeMappe?: boolean;
	art?: KnopfArt;
	groesse?: KnopfGroesse;
	rechtsbuendig?: boolean;
	/** Was der Knopf zeigt, solange der Server baut. */
	laeuft?: string;
	/** Ohne Pfeil am Menü und mit wenig Rand, für die enge Kachel. */
	knapp?: boolean;
}

export const PdfLaeuft = ({ text = 'PDF wird erstellt …' }: { text?: string }) => (
	<>
		<Symbol name="laden" className="size-4 flex-none animate-spin" />
		{text}
	</>
);

/** Solange der Server baut, dreht sich der Knopf. */
export const PdfKnopf = ({
	art = 'zweit',
	beschriftung,
	ganzeMappe,
	groesse,
	knapp,
	laeuft: laeuftText,
	mappe,
	rechtsbuendig,
	wahl,
	warnen,
}: Eigenschaften) => {
	const { dialog, hole, laeuft } = usePdf({ mappe, warnen, ganzeMappe });
	const [erste] = wahl;
	const inhalt = laeuft ? (
		<PdfLaeuft text={laeuftText} />
	) : (
		<>
			<Symbol name="herunterladen" />
			{beschriftung}
		</>
	);
	return (
		<>
			{wahl.length > 1 ? (
				<Menue
					art={art}
					groesse={groesse}
					beschriftung={inhalt}
					disabled={laeuft}
					rechtsbuendig={rechtsbuendig}
					ausloeser={
						knapp ? (
							<Knopf art={art} groesse={groesse} className="px-1.5!">
								{inhalt}
							</Knopf>
						) : undefined
					}
					eintraege={wahl.map((w) => ({
						titel: w.titel,
						beschreibung: w.hinweis,
						waehle: () => void hole(w),
					}))}
				/>
			) : (
				<Knopf
					art={art}
					groesse={groesse}
					className={knapp ? 'px-1.5!' : undefined}
					disabled={laeuft || !erste}
					onClick={() => erste && void hole(erste)}
				>
					{inhalt}
				</Knopf>
			)}
			{dialog}
		</>
	);
};
