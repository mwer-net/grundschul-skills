import { Schubladenleiste } from '../../bausteine/Schubladenleiste';
import { kuerzelText } from '../befehle';
import { halteFokus } from '../halteFokus';
import type { SchubladenId, SchubladenLage, SchubladenTeile } from '.';
import { SCHUBLADEN, schubladeVon } from '.';
// >> 183
import type { LinksZeigt } from './spalten';
import { breiteVon, sichtbar } from './spalten';
// << 183

interface Eigenschaften {
	// >> 183
	/** Was links zu sehen ist (`spalten.ts`). */
	zeigt: LinksZeigt;
	// << 183
	lage: SchubladenLage;
	// >> 183
	/** Warum das Blatt gerade gesperrt ist (133); steht oben in der Spalte am Blatt. */
	// << 183
	grund?: string | null;
	teile: SchubladenTeile;
	/** Über das Befehlsregister, damit Klick und Taste dasselbe tun. */
	waehle: (id: SchubladenId) => void;
}

// >> 183
/**
 * Links im Editor: die Leiste mit allen bereiten Schubladen, daneben die Ebenen und rechts davon die offene Schublade,
 * jede in ihrer festen Breite (183). Bleibt dafür zu wenig Platz, steht die Schublade allein; das rechnet `spalten.ts`.
 * Die Ebenen bleiben beim Wechsel der Schublade eingehängt.
 */
export const Schubladen = ({ grund = null, lage, teile, waehle, zeigt }: Eigenschaften) => {
	const spalten = sichtbar(zeigt);
	return (
		<>
			<Schubladenleiste
				eintraege={SCHUBLADEN.filter((s) => s.bereit(lage)).map((s) => ({
					id: s.id,
					titel: s.titel,
					symbol: s.symbol,
					kuerzel: kuerzelText({ code: s.taste, wahl: true }),
					trenner: s.id === 'ebenen',
				}))}
				offen={spalten}
				waehle={waehle}
				knopf={halteFokus}
			/>
			{spalten.map((id, i) => {
				const Inhalt = schubladeVon(id)?.Inhalt;
				return (
					Inhalt && (
						<div
							key={id}
							className="flex min-h-0 flex-none flex-col border-r border-rand bg-flaeche"
							style={{ width: breiteVon(id) }}
							data-panel-links={id}
						>
							{grund && i === spalten.length - 1 && (
								<p
									className="flex-none border-b border-rand px-3 py-2 text-xs text-leise"
									data-sperre-grund
								>
									{grund}
								</p>
							)}
							<Inhalt {...teile} />
						</div>
					)
				);
			})}
		</>
	);
};
// << 183
