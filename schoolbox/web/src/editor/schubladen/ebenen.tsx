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

/** ⌥1: der Baum der Seiten, bis 093 „Gliederung“; seit 101 mit Gestaltung, Auge und Schloss. */
export const schublade: Schublade = { ...kopf('ebenen'), bereit: () => true, Inhalt };
