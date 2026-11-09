import { Abschnitt } from '../../../bausteine/Abschnitt';
import type { PfadTeil } from '../../darstellung';
import type { Struktur } from '../../struktur';
import { bausteinVon, elementZu } from '../../darstellung';
import { gruppiere, gruppiereMehrfach, INSPEKTOR_TEILE, MEHRFACH_TEILE } from './index';
import { kontextFuerGestaltung, liegtFreiAuf } from './kontext-ersatz';

interface Eigenschaften {
	doc: Document | null;
	pfad: PfadTeil[];
	quelle: string | null;
	struktur: Struktur;
}

/**
 * Reiter „Auswahl“ bei Gestaltung (099): feste Abschnitte in fester Reihenfolge (Briefing 5.8), gefüllt aus
 * `INSPEKTOR_TEILE`. Was die Art nicht hat, fehlt. Pfad und Hinweise zeigt `Inspektor.tsx` wie bei Bausteinen.
 */
export const Gestaltungsinspektor = ({ doc, pfad, quelle, struktur }: Eigenschaften) => {
	const k = kontextFuerGestaltung({ doc, pfad, struktur });
	if (!k || !quelle) {
		return null;
	}
	const aktiv = struktur.aktiv;
	return (
		<div data-gestaltung-inspektor={k.art}>
			{!liegtFreiAuf(k.baustein) && (
				<p className="px-3 pb-2 text-sm text-leise" data-hinweis="blatt">
					Farbe, Muster und Rahmen stellst du im Reiter „Blatt“ unter „Gestaltung“ ein.
				</p>
			)}
			{k.nrn.length > 1 && (
				<p className="px-3 pb-2 text-sm text-leise" data-hinweis="mehrfach">
					{k.nrn.length} Elemente gewählt.
				</p>
			)}
			{(k.nrn.length > 1
				? gruppiereMehrfach(
						[...MEHRFACH_TEILE, ...INSPEKTOR_TEILE],
						k.nrn.flatMap((n) => {
							const element = elementZu(k.doc, n);
							const baustein = element ? bausteinVon(element) : null;
							return baustein ? [{ art: baustein.art, baustein }] : [];
						}),
					)
				: gruppiere(INSPEKTOR_TEILE, k.art, k.baustein)
			).map((g) => (
				<Abschnitt key={g.nr} name={g.name} titel={g.titel}>
					{g.teile.map(({ Inhalt, id }) => (
						<Inhalt key={id} k={k} quelle={quelle} aktiv={aktiv} />
					))}
				</Abschnitt>
			))}
		</div>
	);
};
