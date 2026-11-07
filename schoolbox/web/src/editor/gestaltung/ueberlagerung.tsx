import { gestaltungArtNach } from '@schoolbox/kern/src/gestaltung-arten';

import type { PfadTeil } from '../darstellung';
import { elementZu } from '../darstellung';
import type { Einblendung } from '../Leinwand';
import type { Struktur } from '../struktur';
import { Auswahlrahmen } from './auswahlrahmen';
import { Druckrand } from './druckrand';
import { Durchblick } from './durchblick';
import type { GroessenArt } from './geste';
import { griffeFuer } from './geste';
import { ZUSATZ_GRIFFE } from './griffe';
import { Hilfslinien, useAblageLinien } from './hilfslinien';
import { istGestaltungElement } from './kontext';
import { messe, useGeste } from './useGeste';
import { WertAmZeiger } from './wert-am-zeiger';

interface Eigenschaften {
	e: Einblendung;
	pfad: PfadTeil[];
	struktur: Pick<Struktur, 'aktiv' | 'fuehreAus'>;
	waehle: (nr: number | null) => void;
	textsitzung: boolean;
}

/**
 * Alles über dem Blatt, was zur Gestaltung gehört (097): Auswahlrahmen mit Griffen, Wert am Zeiger, Druckrand-Linie und
 * die Hilfslinien des Einrastens. Die Gesten selbst stecken in `useGeste`.
 */
export const GestaltungUeberlagerung = ({ e, pfad, struktur, textsitzung, waehle }: Eigenschaften) => {
	const { links, skala } = e;
	const geste = useGeste({ doc: e.doc, skala, pfad, struktur, waehle, textsitzung });
	const { stand } = geste;
	const ablageLinien = useAblageLinien(e.doc);
	const gewaehlt = pfad.at(-1);
	const element = gewaehlt ? elementZu(e.doc, gewaehlt.nr) : null;
	const istFrei = istGestaltungElement(element);
	// Während der Geste aus dem Stand, sonst gemessen: ein Element, nicht alle.
	const lage =
		istFrei && stand && stand.nr === gewaehlt?.nr
			? { kasten: stand.kasten, ursprung: stand.ursprung }
			: istFrei
				? messe(element)
				: null;
	const groesse = (gestaltungArtNach(gewaehlt?.baustein.art ?? '')?.groesse ?? 'frei') as GroessenArt;
	const bedienbar = struktur.aktiv && !textsitzung;

	return (
		<>
			{stand?.seite && <Druckrand links={links} seite={stand.seite} skala={skala} />}
			{stand && <Hilfslinien links={links} skala={skala} ursprung={stand.ursprung} linien={stand.linien} />}
			{ablageLinien && <Hilfslinien links={links} skala={skala} {...ablageLinien} />}
			<Durchblick e={e} />
			{istFrei && lage && (
				<Auswahlrahmen
					element={element}
					kasten={lage.kasten}
					ursprung={lage.ursprung}
					links={links}
					skala={skala}
					gesperrt={element.hasAttribute('data-gesperrt')}
					bedienbar={bedienbar}
					griffe={griffeFuer(groesse)}
					zusatz={ZUSATZ_GRIFFE.filter((g) => g.fuer(gewaehlt?.baustein.art ?? '', element))}
					inGeste={stand !== null}
					starteGriff={geste.starteGriff}
					starteZusatz={geste.starteZusatz}
				/>
			)}
			{stand && <WertAmZeiger links={links} skala={skala} text={stand.text} zeiger={stand.zeiger} />}
		</>
	);
};
