import type { AbbildungSchema, Fehler, Feld, FormZelle, Werte } from '@schoolbox/kern/src/abbildungen';
import {
	aendereFeld,
	pruefeWerte,
	schemaVon,
	setzeAbbildung,
	unterschiede,
	werteVon,
} from '@schoolbox/kern/src/abbildungen';
import { kann } from '@schoolbox/kern/src/bausteine';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { PfadTeil } from './darstellung';
import { elementZu } from './darstellung';
import { zuSehen } from './gezeigt';
import type { Struktur } from './struktur';

type Zeichner = Window & {
	zeichneAbbildungen?: (wurzel: Element) => void;
	setzeAbbildungsInhalt?: (element: Element, wert: string) => void;
	schoolboxAbbildungen?: {
		neueZahlen: (tag: string, werte: Werte, seed: string) => Werte | null;
		NEUE_ZAHLEN: string[];
	};
};

/** Was das Zeichnen am Element hinterlässt: Fehler, Felder eines Rasters in der Gestalt des Elements, Hinweis. */
type Gezeichnet = Element & { _abbZellen?: Record<string, FormZelle[]>; _abbInfo?: string; _abbInhalt?: string };

export interface AusDemBlatt {
	fehler: string | null;
	zellen: Record<string, FormZelle[]>;
	info: string | null;
	sw: boolean;
}

const LEER: AusDemBlatt = { fehler: null, zellen: {}, info: null, sw: true };

interface Optionen {
	pfad: PfadTeil[];
	/** Blatt und Zerlegung aus `struktur.gezeigt` (171): Sie bleiben beim Nachladen stehen. */
	struktur: Struktur;
	/** `/api/dokumente/<mappe>/<dok>`: Dorthin gehen Bilder einer Abbildung. */
	adresse: string;
	/** Adresse der Darstellung, gegen die Bildpfade aufgelöst werden. */
	basis: string;
}

export interface Aenderung {
	/** Nur mit Lösungs-Gegenstück: Steht der Wert nur in der Lösung? Ohne Angabe bleibt es, wie es war. */
	nurLoesung?: boolean;
	/** Ohne Übernehmen nur Vorschau, z. B. während getippt wird; übernommen wird dann mit `uebernimm`. */
	uebernehmen?: boolean;
}

/** Setzt die Attribute im Element der Darstellung und zeichnet es neu, wenn sich etwas geändert hat. */
const zeichne = (doc: Document, nr: number, werte: Werte, schema: AbbildungSchema | undefined) => {
	const element: Gezeichnet | null = elementZu(doc, nr);
	if (!element) {
		return;
	}
	const fenster = doc.defaultView as Zeichner | null;
	let anders = false;
	for (const [name, wert] of Object.entries(werte)) {
		if (schema?.felder.some((f) => f.attribut === name && f.quelle === 'inhalt')) {
			if ((element._abbInhalt ?? '') !== (wert ?? '')) {
				anders = true;
				fenster?.setzeAbbildungsInhalt?.(element, wert ?? '');
			}
		} else if (element.getAttribute(name) !== wert) {
			anders = true;
			if (wert === null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, wert);
			}
		}
	}
	if (anders) {
		fenster?.zeichneAbbildungen?.(element);
	}
};

const liesVomBlatt = (doc: Document, nr: number): AusDemBlatt => {
	const element: Gezeichnet | null = elementZu(doc, nr);
	return {
		fehler: element?.getAttribute('data-fehler') ?? null,
		zellen: element?._abbZellen ?? {},
		info: element?._abbInfo ?? null,
		sw: !doc.body.classList.contains('farbe'),
	};
};

/**
 * Das Abbildungs-Panel (018): die Werte der gewählten Abbildung nach ihrem Schema, als Entwurf. Jede Eingabe zeigt
 * sich sofort im Blatt (Attribut im `iframe` setzen, Element neu zeichnen). Ist der ganze Entwurf gültig, wird er
 * übernommen: ein Schritt im Verlauf, der nur die geänderten Attribute in der Quelle setzt. Ein ungültiger Entwurf
 * bleibt Vorschau, bis er stimmt oder zurückgesetzt wird.
 */
export const useAbbildung = ({ adresse, basis: bildBasis, pfad, struktur }: Optionen) => {
	const { doc, zerlegung } = zuSehen(struktur.gezeigt);
	const gewaehlt = pfad.at(-1);
	const nr = gewaehlt && kann(gewaehlt.baustein, 'abbildung') ? gewaehlt.nr : null;
	const knoten = nr === null ? undefined : zerlegung?.knoten[nr];
	const tag = knoten?.tag ?? null;
	const schema = tag ? schemaVon(tag) : undefined;

	const quelle = useMemo(
		() => (schema && knoten && zerlegung ? werteVon(schema, knoten, zerlegung) : null),
		[schema, knoten, zerlegung],
	);
	const basis = quelle && nr !== null ? `${nr}:${JSON.stringify(quelle)}` : null;
	const [entwurf, setEntwurf] = useState<{ basis: string; werte: Werte } | null>(null);
	// Hat sich die Quelle bewegt, ist der Entwurf vorbei; sonst lebte er nach „Rückgängig“ mit derselben Quelle wieder auf.
	if (entwurf && entwurf.basis !== basis) {
		setEntwurf(null);
	}
	const werte = entwurf && entwurf.basis === basis ? entwurf.werte : quelle;
	const [ausBlatt, setAusBlatt] = useState<AusDemBlatt>(LEER);
	const regelFehler: Fehler = useMemo(() => (schema && werte ? pruefeWerte(schema, werte) : {}), [schema, werte]);
	const fehler: Fehler = useMemo(
		() =>
			ausBlatt.fehler && Object.keys(regelFehler).length === 0
				? { ...regelFehler, _element: ausBlatt.fehler }
				: regelFehler,
		[regelFehler, ausBlatt.fehler],
	);
	const beispiel = useMemo(() => Boolean(doc && nr !== null && elementZu(doc, nr)?.closest('.beispiel')), [doc, nr]);

	const zuletzt = useRef<{
		doc: Document;
		nr: number;
		werte: Werte;
		schema: AbbildungSchema | undefined;
	} | null>(null);
	const aktuell = useRef({ werte, quelle, schema, nr, basis, doc });

	useEffect(() => {
		aktuell.current = { werte, quelle, schema, nr, basis, doc };
	});

	// Weg von der Abbildung, ohne dass ein Entwurf übernommen wurde: In der Darstellung wieder die Quelle zeigen.
	useEffect(() => {
		const alt = zuletzt.current;
		if (alt && alt.doc === doc && alt.nr !== nr) {
			zeichne(alt.doc, alt.nr, alt.werte, alt.schema);
		}
		zuletzt.current = doc && nr !== null && quelle ? { doc, nr, werte: quelle, schema } : null;
	}, [doc, nr, quelle, schema]);

	useEffect(() => {
		if (doc && nr !== null && werte) {
			zeichne(doc, nr, werte, schema);
			setAusBlatt(liesVomBlatt(doc, nr));
		} else {
			setAusBlatt(LEER);
		}
	}, [doc, nr, werte, schema]);

	/** Übernimmt den Entwurf als einen Schritt, wenn er gültig ist und sich etwas geändert hat. */
	const uebernimm = (neu?: Werte, was?: string) => {
		const { doc: d, nr: n, quelle: q, schema: s, werte: w } = aktuell.current;
		const fassung = neu ?? w;
		if (!s || !q || !fassung || n === null || Object.keys(pruefeWerte(s, fassung)).length > 0) {
			return;
		}
		// Was nur das Zeichnen weiß (lösbar, passt aufs Gitter), meldet das Element; dann bleibt es beim Entwurf.
		if (d) {
			zeichne(d, n, fassung, s);
			if (liesVomBlatt(d, n).fehler) {
				return;
			}
		}
		const geaendert = unterschiede(q, fassung);
		if (geaendert.length === 0) {
			return;
		}
		const attribute = Object.fromEntries(geaendert.map((a) => [a, fassung[a] ?? null]));
		struktur.aendereAttribute(`${s.name}: ${was ?? 'geändert'}`, (alt) => setzeAbbildung(alt, n, attribute).quelle);
	};

	/** Neue Zahlen aus `abbildungen.js`, das auch das Blatt zeichnet; `null`, wenn es hier keine gibt. */
	const gewuerfelt = (ausgang: Werte) => {
		const { doc: d } = aktuell.current;
		const fenster = d?.defaultView as Zeichner | null | undefined;
		return tag && fenster?.schoolboxAbbildungen
			? fenster.schoolboxAbbildungen.neueZahlen(tag, ausgang, `${Date.now()}-${Math.random()}`)
			: null;
	};

	const aendere = (feld: Feld, wert: string | null, { nurLoesung, uebernehmen = true }: Aenderung = {}) => {
		const { basis: b, schema: s, werte: w } = aktuell.current;
		if (!s || !w || b === null) {
			return;
		}
		const geaendert = aendereFeld(s, w, feld, wert, nurLoesung);
		// Die erzeugten Aufgaben gehören zu den Einstellungen: Ändert sich eine, entstehen sie neu.
		const erzeugt = s.generiert && feld.attribut !== s.generiert ? gewuerfelt(geaendert) : null;
		const neu =
			s.generiert && feld.attribut !== s.generiert
				? { ...geaendert, [s.generiert]: erzeugt?.[s.generiert] ?? null }
				: geaendert;
		aktuell.current = { ...aktuell.current, werte: neu };
		setEntwurf({ basis: b, werte: neu });
		if (uebernehmen) {
			uebernimm(neu, feld.name);
		}
	};

	const zuruecksetzen = () => setEntwurf(null);

	const kerne = (doc?.defaultView as Zeichner | null)?.schoolboxAbbildungen;
	const hatNeueZahlen = Boolean(tag && kerne?.NEUE_ZAHLEN.includes(tag));

	/** Ein Schritt in „Rückgängig“; liefert, ob es geklappt hat. */
	const neueZahlen = () => {
		const { basis: b, schema: s, werte: w } = aktuell.current;
		if (!s || !w || b === null) {
			return false;
		}
		const werteNeu = gewuerfelt(w);
		if (!werteNeu) {
			return false;
		}
		const neu = { ...w, ...werteNeu };
		aktuell.current = { ...aktuell.current, werte: neu };
		setEntwurf({ basis: b, werte: neu });
		uebernimm(neu, 'Neue Zahlen');
		return true;
	};

	const offen = Boolean(quelle && werte && unterschiede(quelle, werte).length > 0);

	return {
		aktiv: struktur.aktiv && schema !== undefined && werte !== null,
		adresse,
		bildBasis,
		doc,
		nr,
		schema,
		werte,
		fehler,
		beispiel,
		info: ausBlatt.info,
		zellen: ausBlatt.zellen,
		sw: ausBlatt.sw,
		/** Ungespeicherte Eingaben, weil etwas noch nicht stimmt. */
		offen,
		aendere,
		uebernimm: () => uebernimm(),
		zuruecksetzen,
		hatNeueZahlen,
		neueZahlen,
	};
};

export type AbbildungSteuerung = ReturnType<typeof useAbbildung>;
