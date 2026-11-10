import { Werkzeugknoepfe } from '../../gestaltung/werkzeuge/werkzeugknoepfe';
import { LAGE } from './Werkzeuge-daten';

/** Die Knöpfe aus 098; V allein zeigt `Werkzeugknoepfe` nicht, dann fehlt der Abschnitt (bis 107 R O Y L bringt). */
export const Inhalt = () => <Werkzeugknoepfe lage={LAGE} />;
