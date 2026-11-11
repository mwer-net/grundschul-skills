import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import type { Art, Fach, Klasse } from '@schoolbox/kern/src/werte';
import type { ComponentType } from 'react';

import type { SymbolName } from '../../bausteine/Symbol';
import type { Kontext } from '../befehle';
import type { BildSteuerung } from '../bild';
import type { Einfuegen } from '../einfuegen';
import type { GliederungStand } from '../gliederung-stand';
import type { PalettenEintrag } from '../palette-suche';
import type { Struktur } from '../struktur';
import { schublade as bausteine } from './bausteine';
import { schublade as bilder } from './bilder';
import { schublade as ebenen } from './ebenen';
import { schublade as figuren } from './figuren';
import { schublade as formen } from './formen';
import type { SchubladenId } from './reihe';

export type { SchubladenId } from './reihe';

/** Was eine Schublade über den Editor wissen muss, um zu erscheinen. Tastenübersicht und Hilfe fragen mit `JEDE_LAGE`. */
export type SchubladenLage = Pick<Kontext, 'frei'>;

/** Was der Editor jeder Schublade mitgibt. Ein Ticket, das mehr braucht, ergänzt hier ein Feld. */
export interface SchubladenTeile {
	doc: Document | null;
	zerlegung: Zerlegung | null;
	auswahl: number | null;
	struktur: Struktur;
	einfuegen: Einfuegen;
	bild: BildSteuerung;
	mappe: { fach: Fach; klasse: Klasse };
	art: Art;
	folien: boolean;
	/** Ebenen: Stand des Baums (auf- und zugeklappt). */
	gliederungStand: GliederungStand;
	/** Im Mini-Book steht die Zahl der Seiten fest. */
	festeSeiten: boolean;
	/** Wählt den Baustein, rollt das Blatt dorthin und zeigt rechts seine Einstellungen. */
	zeigeAn: (nr: number) => void;
	kontextmenue: (nr: number, art: 'baustein' | 'miniatur', punkt: { x: number; y: number }) => void;
	/** Ebenen: Zeile „Seitenfläche“ oder „Seitenrahmen“ öffnet Reiter „Blatt“ › Gestaltung dieser Seite (095). */
	zeigeSeitengestaltung: (seite: number) => void;
	/** Ebenen angeheftet (Stecknadel im Kopf der Ebenen). */
	angeheftet: boolean;
	schalteAnheften: () => void;
	/** Öffnet eine andere Schublade, etwa „Figuren“ aus dem Hinweis in „Bilder“ (102). */
	oeffneSchublade: (id: SchubladenId) => void;
}

/** Ziele für Einträge der Palette aus einer Schublade (⌘K findet auch den Inhalt der Schubladen). */
export interface SchubladenZiele {
	teile: SchubladenTeile;
	fuehreAus: (id: string) => unknown;
}

export interface Schublade {
	id: SchubladenId;
	/** Name in der Leiste und im Kopf der Schublade. */
	titel: string;
	symbol: SymbolName;
	/** Mit ⌥, über `code`: ⌥ erzeugt am Mac Sonderzeichen. Folgt der Reihenfolge in `reihe.ts`. */
	taste: string;
	/** Nur bereite Schubladen erscheinen (Leiste, Palette, Tastenübersicht, Hilfe); die Taste bleibt reserviert. */
	bereit: (k: SchubladenLage) => boolean;
	Inhalt: ComponentType<SchubladenTeile>;
	/** Einträge für ⌘K im Format von `palette-eintraege.ts`; füllen die Tickets mit Inhalt (102–105). */
	suche?: (k: Kontext, z: SchubladenZiele) => PalettenEintrag[];
}

/** Reihenfolge der Leiste, ⌥1 bis ⌥5. Ein späteres Ticket ersetzt nur seine eigene Datei, nicht diese Liste. */
export const SCHUBLADEN: readonly Schublade[] = [ebenen, bausteine, formen, figuren, bilder];

export const schubladeVon = (id: SchubladenId) => SCHUBLADEN.find((s) => s.id === id);

/** Für Tastenübersicht und Hilfe, die keinen Editor kennen: Was hier nicht bereit ist, erscheint nirgends. */
export const JEDE_LAGE: SchubladenLage = { frei: true };
