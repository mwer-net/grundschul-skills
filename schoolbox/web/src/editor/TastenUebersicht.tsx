import { Dialog } from '../bausteine/Dialog';
import { Kuerzel } from '../bausteine/Kuerzel';
import type { Gruppe, Kontext } from './befehle';
import { BEFEHLE, kuerzelText, titelVon } from './befehle';

const ABSCHNITTE: { titel: string; gruppen: Gruppe[] }[] = [
	{ titel: 'Gewählter Baustein', gruppen: ['bearbeiten', 'ablage', 'ordnen', 'gefahr'] },
	{ titel: 'Im Blatt bewegen', gruppen: ['baustein', 'blatt'] },
	{ titel: 'Ansicht', gruppen: ['ansicht'] },
	{ titel: 'Dokument', gruppen: ['dokument'] },
];

/** Aus dem Register, nicht von Hand: Was hier steht, gilt auch. */
export const TastenUebersicht = ({ kontext, schliessen }: { kontext: Kontext; schliessen: () => void }) => (
	<Dialog titel="Tasten" breit schliessen={schliessen}>
		<div className="grid gap-x-6 gap-y-4 sm:grid-cols-2" data-tasten-uebersicht>
			{ABSCHNITTE.map(({ gruppen, titel }) => (
				<section key={titel}>
					<h3 className="mb-1 font-medium">{titel}</h3>
					<ul>
						{BEFEHLE.filter(
							(b) => gruppen.includes(b.gruppe) && b.kuerzel?.length && (b.inUebersicht?.() ?? true),
						).map((b) => (
							<li
								key={b.id}
								className="flex h-zeile items-center justify-between gap-3"
								data-taste={b.id}
							>
								<span className="truncate">{titelVon(b, kontext)}</span>
								<span className="flex flex-none gap-1.5">
									{(b.kuerzel ?? [])
										.filter((k, i) => i === 0 || !k.wenn)
										.map((k) => (
											<Kuerzel key={kuerzelText(k)} text={kuerzelText(k)} />
										))}
								</span>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
		<p className="mt-3 text-leise">
			Beim Tippen im Blatt oder in einem Feld gelten nur ⌘K, ⌘J, ⌘Z und ⇧⌘Z, der Rest gehört dem Text.
		</p>
	</Dialog>
);
