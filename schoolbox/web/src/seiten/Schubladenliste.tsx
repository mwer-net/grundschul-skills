import { Kuerzel } from '../bausteine/Kuerzel';
import { kuerzelText } from '../editor/befehle';
import { JEDE_LAGE, SCHUBLADEN } from '../editor/schubladen';

/** Nur bereite Schubladen; Name und Taste aus dem Register, damit die Hilfe nie etwas anderes sagt. */
export const Schubladenliste = () => (
	<span data-hilfe-schubladen>
		{SCHUBLADEN.filter((s) => s.bereit(JEDE_LAGE)).map((s, i, alle) => (
			<span key={s.id} data-hilfe-schublade={s.id}>
				{`„${s.titel}“ `}
				<Kuerzel text={kuerzelText({ code: s.taste, wahl: true })} className="text-[length:inherit]" />
				{i < alle.length - 1 ? ', ' : ''}
			</span>
		))}
	</span>
);
