import { Kuerzel } from '../bausteine/Kuerzel';
import { kuerzelText } from '../editor/befehle';
import { JEDE_LAGE, SCHUBLADEN } from '../editor/schubladen';
import type { Abschnitt } from './hilfe-teile';

/** Nur bereite Schubladen; Name und Taste aus dem Register, damit die Hilfe nie etwas anderes sagt. */
const Schubladenliste = () => (
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

/**
 * Abschnitt „Gestalten“ der Hilfe (Phase 12). Jedes sichtbare Ticket schreibt nur zwischen seinen Marken; 124 räumt
 * die Marken am Ende auf.
 */
export const GESTALTEN: Abschnitt = {
	id: 'gestalten',
	titel: 'Gestalten',
	inhalt: (
		<>
			<p>
				Links neben dem Blatt steht die Leiste mit den Schubladen. Jede hat ihre eigene Taste: <Schubladenliste />.
				Ein Klick öffnet eine Schublade, ein Klick auf eine andere wechselt, ein zweiter Klick schließt sie, und das
				Blatt bekommt den Platz. Mit der Stecknadel im Kopf der Ebenen bleiben sie unter jeder anderen Schublade offen;
				den Teiler dazwischen ziehst du nach oben oder unten.
			</p>
			{/* >> 094 */}
			{/* << 094 */}

			{/* >> 095 */}
			{/* << 095 */}

			{/* >> 096 */}
			{/* << 096 */}

			{/* >> 097 */}
			{/* << 097 */}

			{/* >> 099 */}
			{/* << 099 */}

			{/* >> 100 */}
			{/* << 100 */}

			{/* >> 101 */}
			{/* << 101 */}

			{/* >> 102 */}
			{/* << 102 */}

			{/* >> 103 */}
			{/* << 103 */}

			{/* >> 104 */}
			{/* << 104 */}

			{/* >> 105 */}
			{/* << 105 */}

			{/* >> 106 */}
			{/* << 106 */}

			{/* >> 107 */}
			{/* << 107 */}

			{/* >> 108 */}
			{/* << 108 */}

			{/* >> 109 */}
			{/* << 109 */}

			{/* >> 110 */}
			{/* << 110 */}

			{/* >> 111 */}
			{/* << 111 */}

			{/* >> 113 */}
			{/* << 113 */}

			{/* >> 115 */}
			{/* << 115 */}

			{/* >> 116 */}
			{/* << 116 */}

			{/* >> 117 */}
			{/* << 117 */}

			{/* >> 119 */}
			{/* << 119 */}

			{/* >> 120 */}
			{/* << 120 */}

			{/* >> 121 */}
			{/* << 121 */}

			{/* >> 122 */}
			{/* << 122 */}
		</>
	),
	bilder: [],
};
