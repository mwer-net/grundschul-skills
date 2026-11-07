import { Ebenen } from '../Ebenen';
import type { Schublade, SchubladenTeile } from '.';
import { kopf } from './reihe';

const Inhalt = (t: SchubladenTeile) => (
	<Ebenen
		doc={t.doc}
		zerlegung={t.zerlegung}
		auswahl={t.auswahl}
		struktur={t.struktur}
		stand={t.gliederungStand}
		zeigeAn={t.zeigeAn}
		festeSeiten={t.festeSeiten}
		kontextmenue={t.kontextmenue}
		zeigeSeitengestaltung={t.zeigeSeitengestaltung}
		angeheftet={t.angeheftet}
		schalteAnheften={t.schalteAnheften}
	/>
);

/** ⌥1: der Baum der Seiten, bis 093 „Gliederung“. Auge, Schloss und Gestaltung kommen mit 101. */
export const schublade: Schublade = { ...kopf('ebenen'), bereit: () => true, Inhalt };
