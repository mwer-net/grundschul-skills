import { Dialog } from '../bausteine/Dialog';
import { Tastenliste } from '../bausteine/Tastenliste';
import type { Kontext } from './befehle';
import { tastenAbschnitte, tastenBeimTippen } from './befehle';

/** „A, B und C“ */
const aufzaehlung = (teile: string[]) =>
	teile.length > 1 ? `${teile.slice(0, -1).join(', ')} und ${teile.at(-1) ?? ''}` : (teile[0] ?? '');

/** Aus dem Register, nicht von Hand: Was hier steht, gilt auch. Ohne Kontext (Hilfe) mit den Namen der Hilfe. */
export const EditorTasten = ({ ebene, kontext }: { kontext?: Kontext; ebene?: 'h3' | 'h4' }) => (
	<>
		<Tastenliste abschnitte={tastenAbschnitte(kontext)} ebene={ebene} />
		<p className="mt-3 text-leise">
			{`Beim Tippen im Blatt oder in einem Feld gelten nur ${aufzaehlung(tastenBeimTippen())}, der Rest gehört dem Text.`}
		</p>
	</>
);

export const TastenUebersicht = ({ kontext, schliessen }: { kontext: Kontext; schliessen: () => void }) => (
	<Dialog titel="Tasten" breit schliessen={schliessen}>
		<EditorTasten kontext={kontext} />
	</Dialog>
);
