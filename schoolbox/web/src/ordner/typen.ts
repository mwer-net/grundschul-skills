import type { Sortierung } from '@schoolbox/kern/src/ordner-sortierung';
import type { Fach, Klasse } from '@schoolbox/kern/src/werte';

import type { DefekteMappe, DokumentEintrag } from '../typen';

export type DefektEintrag = DefekteMappe;

export type { Sortierung };

export interface AblageOrdner {
	id: string;
	name: string;
	eltern: string | null;
	behaelter: string | null;
	erstellt: string;
	geaendert: string;
}

export interface AblageDok extends DokumentEintrag {
	mappe: string;
	fach: Fach;
	klasse: Klasse;
	ordner: string | null;
}

export interface AblageStand {
	rev: number;
	ordner: AblageOrdner[];
	dokumente: AblageDok[];
	defekt: DefekteMappe[];
	geteilt: { ordner: string[]; dokumente: string[] };
	hinweis?: string;
}

export type Knoten = { ordner: string } | { mappe: string; dok: string };

interface AktionsAngaben {
	neu: { eltern: string | null; name?: string; inhalt?: Knoten[]; id?: string };
	umbenennen: { knoten: Knoten; name: string };
	bewegen: { knoten: Knoten[]; ziel: string | null; namen?: Record<string, string> };
	kopieren: { knoten: Knoten[]; ziel: string | null };
	papierkorb: { knoten: Knoten[] };
	zuruecklegen: { knoten: Knoten[] };
	entfernen: { ordner: string };
}

export type Aktion = { [A in keyof AktionsAngaben]: { art: A } & AktionsAngaben[A] }[keyof AktionsAngaben];

export interface AktionsAntwort {
	rev: number;
	umkehr: Aktion[];
	ergebnis: {
		neu?: string;
		knoten: Knoten[];
		umbenannt: { knoten: Knoten; von: string; nach: string }[];
		uebersprungen: number;
		geteilt: string | null;
	};
}

interface Gemeinsam {
	schluessel: string;
	name: string;
	erstellt: string;
	geaendert: string;
	art: string;
	geteilt: boolean;
}

export interface OrdnerObjekt extends Gemeinsam {
	istOrdner: true;
	knoten: { ordner: string };
	ordner: AblageOrdner;
	/** Was direkt darin liegt. */
	anzahl: number;
}

export interface DokObjekt extends Gemeinsam {
	istOrdner: false;
	knoten: { mappe: string; dok: string };
	dok: AblageDok;
}

export type Objekt = OrdnerObjekt | DokObjekt;

export type Seite =
	{ art: 'ordner'; ordner: string | null } | { art: 'zuletzt' } | { art: 'suche' } | { art: 'papierkorb' };

export type Darstellung = 'kacheln' | 'liste';
