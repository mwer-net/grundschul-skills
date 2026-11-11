import { klassen } from './klassen';
import { Kuerzel } from './Kuerzel';

export interface TastenAbschnitt {
	titel: string;
	zeilen: { id: string; titel: string; tasten: string[] }[];
}

/** Das Raster der Tasten für Tastenübersicht, Tastendialog der Ablage und Hilfe (dort eine Stufe tiefer und leiser). */
export const Tastenliste = ({
	abschnitte,
	ebene: Ueberschrift = 'h3',
}: {
	abschnitte: TastenAbschnitt[];
	ebene?: 'h3' | 'h4';
}) => (
	<div className="grid gap-x-6 gap-y-4 sm:grid-cols-2" data-tasten-uebersicht>
		{abschnitte.map(({ titel, zeilen }) => (
			<section key={titel}>
				<Ueberschrift className={klassen('mb-1 font-medium', Ueberschrift === 'h4' && 'text-sm text-leise')}>
					{titel}
				</Ueberschrift>
				<ul className="pl-0">
					{zeilen.map((z) => (
						<li key={z.id} className="flex h-zeile items-center justify-between gap-3" data-taste={z.id}>
							<span className="truncate">{z.titel}</span>
							<span className="flex flex-none gap-1.5">
								{z.tasten.map((t) => (
									<Kuerzel key={t} text={t} />
								))}
							</span>
						</li>
					))}
				</ul>
			</section>
		))}
	</div>
);
