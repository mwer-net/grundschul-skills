import type { KnopfArt, KnopfGroesse } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import type { MenueEintrag } from '../bausteine/Menue';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import type { PdfWahl } from './usePdf';
import { usePdf } from './usePdf';

export type { PdfWahl } from './usePdf';

/** Name des Knopfs, solange der Server baut; zu sehen ist nur der drehende Kreisel (191-22). */
export const PDF_LAEUFT = 'PDF wird erstellt …';

/** Leise Zeile unter den Einträgen bei Material mit echten Maßen (191-45, Meldung `masstab`). */
export const ECHTE_MASSE = 'Echte Maße: in Originalgröße drucken (100 %).';

interface Eigenschaften {
	beschriftung: string;
	/** Eine Wahl: ein einfacher Knopf, der sofort lädt (191-41). Mehrere: ein Menü. */
	wahl: PdfWahl[];
	mappe: { id: string; titel: string };
	/** Teilen-Links laden ohne Warnung herunter: Reparieren kann dort ohnehin niemand. */
	warnen: boolean;
	ganzeMappe?: boolean;
	art?: KnopfArt;
	groesse?: KnopfGroesse;
	rechtsbuendig?: boolean;
	/** Ohne Pfeil am Menü und mit wenig Rand, für die enge Kachel. */
	knapp?: boolean;
	/** Das Material hat echte Maße: Das Menü sagt unten, wie zu drucken ist, auch bei nur einer Datei. */
	echteMasse?: boolean;
}

/** Für die Statuszeile der Ablage: Kreisel und Text. */
export const PdfLaeuft = ({ text = PDF_LAEUFT }: { text?: string }) => (
	<>
		<Symbol name="laden" className="size-4 flex-none animate-spin" />
		{text}
	</>
);

/** Solange der Server baut, dreht sich statt des Symbols ein Kreisel; Breite und Wort bleiben (191-22). */
export const PdfKnopf = ({
	art = 'zweit',
	beschriftung,
	echteMasse,
	ganzeMappe,
	groesse,
	knapp,
	mappe,
	rechtsbuendig,
	wahl,
	warnen,
}: Eigenschaften) => {
	const { dialog, hole, laeuft } = usePdf({ mappe, warnen, ganzeMappe });
	const [erste] = wahl;
	const inhalt = (
		<>
			<Symbol name={laeuft ? 'laden' : 'herunterladen'} className={laeuft ? 'animate-spin' : undefined} />
			{beschriftung}
		</>
	);
	const eintraege: MenueEintrag[] = [
		...wahl.map((w) => ({
			titel: w.titel,
			beschreibung: w.hinweis,
			gruppe: w.gruppe,
			waehle: () => void hole(w),
		})),
		...(echteMasse ? [{ titel: ECHTE_MASSE, gruppe: 'masse', aus: true }] : []),
	];
	const name = laeuft ? PDF_LAEUFT : undefined;
	return (
		<>
			{wahl.length > 1 || (echteMasse && erste) ? (
				<Menue
					art={art}
					groesse={groesse}
					name={name}
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
					eintraege={eintraege}
				/>
			) : (
				<Knopf
					art={art}
					groesse={groesse}
					className={knapp ? 'px-1.5!' : undefined}
					aria-label={name}
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
