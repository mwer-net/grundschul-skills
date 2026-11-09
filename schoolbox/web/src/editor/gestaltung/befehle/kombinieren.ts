import { formVon } from '@schoolbox/kern/src/formen';
import type { KombiArt } from '@schoolbox/kern/src/kombinieren';
import { kombiniere } from '@schoolbox/kern/src/kombinieren';
import { useSyncExternalStore } from 'react';

import type { SymbolName } from '../../../bausteine/Symbol';
import type { Befehl, Kontext } from '../../befehle';
import { elementZu } from '../../darstellung';
import { gleicherElternteil } from '../gruppe-messen';
import type { GestaltungKontext } from '../kontext';
import { leereMehrfach } from '../mehrfach';

/** Titel der Knöpfe im Inspektor (Briefing): Das Ergebnis ist keine Form mit Einstellungen mehr. */
export const KOMBI_HINWEIS = 'Ergibt eine eigene Form. Ecken, Zacken und andere Einstellungen gehen verloren.';

export const KOMBI_ARTEN: readonly { art: KombiArt; id: string; titel: string; schritt: string; symbol: SymbolName }[] =
	[
		{ art: 'vereinen', id: 'auswahl.vereinen', titel: 'Vereinen', schritt: 'Vereint', symbol: 'vereinen' },
		{ art: 'abziehen', id: 'auswahl.abziehen', titel: 'Abziehen', schritt: 'Abgezogen', symbol: 'abziehen' },
		{ art: 'schneiden', id: 'auswahl.schneiden', titel: 'Schnitt', schritt: 'Geschnitten', symbol: 'schnitt' },
		{
			art: 'ausschliessen',
			id: 'auswahl.ausschliessen',
			titel: 'Ausschluss',
			schritt: 'Ausgeschlossen',
			symbol: 'ausschluss',
		},
	];

/** Darf das Element mitmachen? Formen ohne Text und eigene Pfade (wie `istKombinierbar` im Kern, am Blatt). */
const kombinierbar = (element: Element | null) =>
	Boolean(
		element?.matches('svg.form[data-lage="frei"]') &&
			['ohne-text', 'pfad'].includes(formVon(element.getAttribute('data-form'))?.klasse ?? ''),
	);

/** Warum die Auswahl sich nicht kombinieren lässt; `null`, wenn es geht. Wie `kombiGrund` im Kern, aber am Blatt. */
export const kombiGrundIm = (g: Pick<GestaltungKontext, 'doc' | 'nrn'> | null) => {
	if (!g || g.nrn.length < 2) {
		return 'Wähle mindestens zwei Formen.';
	}
	if (!g.nrn.every((nr) => kombinierbar(elementZu(g.doc, nr) ?? null))) {
		return 'Nur Formen ohne Text lassen sich kombinieren.';
	}
	return gleicherElternteil(g.doc, g.nrn) ? null : 'Nur Formen derselben Ebene lassen sich kombinieren.';
};

// ── Meldung „Das Ergebnis wäre leer.“ ───────────────────────────────────────

let meldung: string | null = null;
const hoerer = new Set<() => void>();
const setzeMeldung = (text: string | null) => {
	if (meldung === text) {
		return;
	}
	meldung = text;
	for (const h of hoerer) {
		h();
	}
};

/** Die letzte Meldung des Kombinierens; der Inspektor zeigt sie, bis sich die Auswahl ändert. */
export const useKombiMeldung = () =>
	useSyncExternalStore(
		(h) => {
			hoerer.add(h);
			return () => {
				hoerer.delete(h);
			};
		},
		() => meldung,
	);

export const vergissKombiMeldung = () => setzeMeldung(null);

/** Führt das Kombinieren aus: ein Schritt, danach ist der neue Pfad gewählt. Ein leeres Ergebnis ändert nichts. */
export const kombiniereIm = (g: GestaltungKontext, art: KombiArt) => {
	const eintrag = KOMBI_ARTEN.find((a) => a.art === art);
	if (!eintrag || kombiGrundIm(g)) {
		return false;
	}
	const nrn = [...g.nrn];
	let leer = false;
	const geklappt = g.fuehreAus(eintrag.schritt, (q) => {
		const r = kombiniere(q, nrn, art);
		leer = r === null;
		return r ?? { quelle: q, nr: g.nr };
	});
	setzeMeldung(leer ? 'Das Ergebnis wäre leer.' : null);
	if (geklappt) {
		leereMehrfach();
	}
	return geklappt;
};

const kann = (k: Kontext) => k.aktiv && kombiGrundIm(k.gestaltung) === null;

/** Vereinen, Abziehen, Schnitt, Ausschluss (121, Briefing 3-formen): keine Taste, in Palette, ⋯ und Inspektor. */
export const KOMBINIEREN_BEFEHLE: Befehl[] = KOMBI_ARTEN.map(({ art, id, symbol, titel }) => ({
	id,
	titel,
	gruppe: 'ordnen',
	symbol,
	modus: ['auswahl'],
	suchwoerter: ['kombinieren', 'formen', 'pfad', titel.toLowerCase(), art],
	orte: ['palette', 'gestaltung'],
	sichtbarUnter: 'leiste',
	verfuegbar: kann,
	aus: (k) => (k.gestaltung ? kombiniereIm(k.gestaltung, art) : false),
}));
