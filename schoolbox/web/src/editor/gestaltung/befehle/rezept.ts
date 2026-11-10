import { leseAufmachung } from '@schoolbox/kern/src/aufmachungen';
import { aufmachungVon } from '@schoolbox/kern/src/rezepte/index';

import type { Befehl, Kontext } from '../../befehle';
import type { Aendere } from '../rezept/aktionen';
import { entferne, FREILEGEN_HINWEIS, legeFrei, wuerfle } from '../rezept/aktionen';

const blatt = () =>
	document.querySelector<HTMLIFrameElement>('[data-editor-rahmen="sichtbar"]')?.contentDocument ?? null;

const rezept = (k: Kontext) => (k.quelle ? aufmachungVon(leseAufmachung(k.quelle)?.id) : null);

/** Nur mit Rezept am Material, nicht im Mini-Book (7-rezepte.md). */
const verfuegbar = (k: Kontext) => k.aktiv && !k.festeSeiten && Boolean(rezept(k));

const aendere =
	(k: Kontext): Aendere =>
	(beschreibung, rechne) =>
		k.tu.struktur.aendereAttribute(beschreibung, rechne);

/** Würfeln, Freilegen, Entfernen (119); ohne Taste, in Palette und im ⋯ der Gestaltung. */
export const REZEPT_BEFEHLE: Befehl[] = [
	{
		id: 'rezept.wuerfeln',
		titel: (k) => `${rezept(k)?.name ?? 'Rezept'} neu würfeln`,
		gruppe: 'blatt',
		symbol: 'wuerfeln',
		suchwoerter: ['rezept', 'würfeln', 'konfetti', 'zufall', 'neu', 'aufmachung'],
		orte: ['palette', 'gestaltung'],
		sichtbarUnter: 'blatt',
		verfuegbar,
		aus: (k) => wuerfle(aendere(k)),
	},
	{
		id: 'rezept.freilegen',
		titel: 'Rezept freilegen',
		gruppe: 'blatt',
		symbol: 'entsperrt',
		suchwoerter: ['rezept', 'freilegen', 'lösen', 'aufmachung', 'gestaltung', FREILEGEN_HINWEIS],
		orte: ['palette', 'gestaltung'],
		sichtbarUnter: 'blatt',
		verfuegbar,
		aus: (k) => legeFrei(aendere(k), blatt()),
	},
	{
		id: 'rezept.entfernen',
		titel: 'Rezept entfernen',
		gruppe: 'blatt',
		symbol: 'papierkorb',
		suchwoerter: ['rezept', 'entfernen', 'löschen', 'aufmachung'],
		orte: ['palette', 'gestaltung'],
		sichtbarUnter: 'blatt',
		gefahr: true,
		verfuegbar,
		aus: (k) => entferne(aendere(k)),
	},
];
