import type { Schublade } from '.';
import { Inhalt } from './bilder-teile';
import { kopf } from './reihe';

/**
 * ⌥6: Fotos hochladen, Bilder aus dem Ordner, aus anderen Ordnern und der Sammlung. Klick setzt ein wie im Bild-Panel;
 * Ziehen legt frei ab, auf ein Bild tauscht es aus, in einen Platzhalter füllt es ihn, mit ⌘ wird es Baustein (103).
 */
export const schublade: Schublade = { ...kopf('bilder'), bereit: () => true, Inhalt };
