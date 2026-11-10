import { WERKZEUGE } from '../../gestaltung/werkzeuge';

export const bereite = () => WERKZEUGE.filter((w) => w.bereit(LAGE));

/** Die Schublade erscheint nur, wo frei gestaltet werden darf; dort gilt diese Lage. */
export const LAGE = { frei: true };
