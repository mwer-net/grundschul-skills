import type { Fehler, Feld, Werte } from '@schoolbox/kern/src/abbildungen';
import {
	aendereFeld,
	pruefeWerte,
	schemaVon,
	setzeAbbildung,
	unterschiede,
	werteVon,
} from '@schoolbox/kern/src/abbildungen';
import { kann } from '@schoolbox/kern/src/bausteine';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { PfadTeil } from './darstellung';
import { elementZu } from './darstellung';
import type { Struktur } from './struktur';

type Zeichner = Window & { zeichneAbbildungen?: (wurzel: Element) => void };

interface Optionen {
	/** Das sichtbare Dokument; die Vorschau zeichnet nur, wenn es zur aktuellen Quelle (`html`) gehört. */
	geladen: { doc: Document; html: string } | null;
	html: string | null;
	/** Zerlegung der Quelle, aus der die Darstellung stammt. */
	zerlegung: Zerlegung | null;
	pfad: PfadTeil[];
	struktur: Struktur;
}

export interface Aenderung {
	/** Nur mit Lösungs-Gegenstück: Steht der Wert nur in der Lösung? Ohne Angabe bleibt es, wie es war. */
	nurLoesung?: boolean;
	/** Ohne Übernehmen nur Vorschau, z. B. während getippt wird; übernommen wird dann mit `uebernimm`. */
	uebernehmen?: boolean;
}

/** Setzt die Attribute im Element der Darstellung und zeichnet es neu, wenn sich etwas geändert hat. */
const zeichne = (doc: Document, nr: number, werte: Werte) => {
	const element = elementZu(doc, nr);
	if (!element) {
		return;
	}
	let anders = false;
	for (const [name, wert] of Object.entries(werte)) {
		if (element.getAttribute(name) !== wert) {
			anders = true;
			if (wert === null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, wert);
			}
		}
	}
	if (anders) {
		(doc.defaultView as Zeichner | null)?.zeichneAbbildungen?.(element);
	}
};

/**
 * Das Abbildungs-Panel (018): die Werte der gewählten Abbildung nach ihrem Schema, als Entwurf. Jede Eingabe zeigt
 * sich sofort im Blatt (Attribut im `iframe` setzen, Element neu zeichnen). Ist der ganze Entwurf gültig, wird er
 * übernommen: ein Schritt im Verlauf, der nur die geänderten Attribute in der Quelle setzt. Ein ungültiger Entwurf
 * bleibt Vorschau, bis er stimmt oder zurückgesetzt wird.
 */
export const useAbbildung = ({ geladen, html, pfad, struktur, zerlegung }: Optionen) => {
	const doc = geladen?.html === html ? geladen.doc : null;
	const gewaehlt = pfad.at(-1);
	const nr = gewaehlt && kann(gewaehlt.baustein, 'abbildung') ? gewaehlt.nr : null;
	const knoten = nr === null ? undefined : zerlegung?.knoten[nr];
	const tag = knoten?.tag ?? null;
	const schema = tag ? schemaVon(tag) : undefined;

	const quelle = useMemo(() => (schema && knoten ? werteVon(schema, knoten) : null), [schema, knoten]);
	const basis = quelle && nr !== null ? `${nr}:${JSON.stringify(quelle)}` : null;
	const [entwurf, setEntwurf] = useState<{ basis: string; werte: Werte } | null>(null);
	const werte = entwurf && entwurf.basis === basis ? entwurf.werte : quelle;
	const fehler: Fehler = useMemo(() => (schema && werte ? pruefeWerte(schema, werte) : {}), [schema, werte]);
	const beispiel = useMemo(() => Boolean(doc && nr !== null && elementZu(doc, nr)?.closest('.beispiel')), [doc, nr]);

	const zuletzt = useRef<{ doc: Document; nr: number; werte: Werte } | null>(null);
	const aktuell = useRef({ werte, quelle, schema, nr, basis });

	useEffect(() => {
		aktuell.current = { werte, quelle, schema, nr, basis };
	});

	// Weg von der Abbildung, ohne dass ein Entwurf übernommen wurde: In der Darstellung wieder die Quelle zeigen.
	useEffect(() => {
		const alt = zuletzt.current;
		if (alt && alt.doc === doc && alt.nr !== nr) {
			zeichne(alt.doc, alt.nr, alt.werte);
		}
		zuletzt.current = doc && nr !== null && quelle ? { doc, nr, werte: quelle } : null;
	}, [doc, nr, quelle]);

	useEffect(() => {
		if (doc && nr !== null && werte) {
			zeichne(doc, nr, werte);
		}
	}, [doc, nr, werte]);

	/** Übernimmt den Entwurf als einen Schritt, wenn er gültig ist und sich etwas geändert hat. */
	const uebernimm = (neu?: Werte, was?: string) => {
		const { nr: n, quelle: q, schema: s, werte: w } = aktuell.current;
		const fassung = neu ?? w;
		if (!s || !q || !fassung || n === null || Object.keys(pruefeWerte(s, fassung)).length > 0) {
			return;
		}
		const geaendert = unterschiede(q, fassung);
		if (geaendert.length === 0) {
			return;
		}
		const attribute = Object.fromEntries(geaendert.map((a) => [a, fassung[a] ?? null]));
		struktur.aendereAttribute(`${s.name}: ${was ?? 'geändert'}`, (alt) => setzeAbbildung(alt, n, attribute).quelle);
	};

	const aendere = (feld: Feld, wert: string | null, { nurLoesung, uebernehmen = true }: Aenderung = {}) => {
		const { basis: b, schema: s, werte: w } = aktuell.current;
		if (!s || !w || b === null) {
			return;
		}
		const neu = aendereFeld(s, w, feld, wert, nurLoesung);
		aktuell.current = { ...aktuell.current, werte: neu };
		setEntwurf({ basis: b, werte: neu });
		if (uebernehmen) {
			uebernimm(neu, feld.name);
		}
	};

	const zuruecksetzen = () => setEntwurf(null);

	const offen = Boolean(quelle && werte && unterschiede(quelle, werte).length > 0);

	return {
		aktiv: struktur.aktiv && schema !== undefined && werte !== null,
		schema,
		werte,
		fehler,
		beispiel,
		/** Ungespeicherte Eingaben, weil etwas noch nicht stimmt. */
		offen,
		aendere,
		uebernimm: () => uebernimm(),
		zuruecksetzen,
	};
};

export type AbbildungSteuerung = ReturnType<typeof useAbbildung>;
