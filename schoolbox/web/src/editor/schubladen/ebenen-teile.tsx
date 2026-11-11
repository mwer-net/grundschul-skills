import { Ebenen } from '../Ebenen';
import type { SchubladenTeile } from '.';

export const Inhalt = (t: SchubladenTeile) => (
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
	/>
);
