import { Zeichenkacheln } from '../../gestaltung/werkzeuge/werkzeugknoepfe';
import type { FormenTeile } from './typ';
import { LAGE } from './Werkzeuge-daten';

/** 198-10: die Kacheln Stift, Form aus Punkten und Konfetti; die Suche zeigt nur, was passt. */
export const Inhalt = ({ suche }: FormenTeile) => <Zeichenkacheln lage={LAGE} suche={suche} />;
