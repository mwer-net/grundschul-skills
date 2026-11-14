import type { AbbildungSchema, Fehler, Feld, FormZelle, Werte } from '@schoolbox/kern/src/abbildungen';
import {
	abbildungsName,
	aendereFeld,
	pruefeFelder,
	pruefeWerte,
	schemaVon,
	setzeAbbildung,
	unterschiede,
	werteVon,
} from '@schoolbox/kern/src/abbildungen';
import { kann } from '@schoolbox/kern/src/bausteine';
import { KERN_NEUE_ZAHLEN, neueZahlenImKern } from '@schoolbox/kern/src/neue-zahlen';
import { loesungDaneben, schreibeUhrzeitUm, zeitDerUhr } from '@schoolbox/kern/src/uhrzeit-text';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useHinweis } from '../bausteine/hinweis';

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

const klasseVon = (doc: Document | null | undefined) => {
	const k = /\bkl([1-4])\b/.exec(doc?.body.className ?? '')?.[1];
	return k ? Number(k) : undefined;
};

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

/**
 * 197-18: Meldungen der Zeichnung (Texte in `abbildungen.js`) nennen Attribute und Optionswerte; das Panel zeigt die
 * Namen aus dem Schema. Ein Absturz der Zeichnung erscheint nicht als Technik-Text (197-U2).
 */
export const lesbareMeldung = (text: string, schema: AbbildungSchema | undefined) => {
	if (/ließ sich nicht zeichnen/.test(text)) {
		return 'Mit diesen Angaben lässt sich die Abbildung nicht zeichnen. Ändere eine Angabe oder setze zurück.';
	}
	const namen = new Map<string, string>();
	for (const feld of schema?.felder ?? []) {
		if ('optionen' in feld && Array.isArray(feld.optionen)) {
			for (const o of feld.optionen as { wert: string | null; name: string }[]) {
				if (o.wert) {
					namen.set(o.wert.toLowerCase(), o.name);
				}
			}
		}
	}
	for (const feld of schema?.felder ?? []) {
		namen.set(feld.attribut.toLowerCase(), feld.name);
	}
	return text.replace(/„([^“„]+)“/g, (ganz, wort: string) => {
		const name = namen.get(wort.toLowerCase());
		return name ? `„${name}“` : ganz;
	});
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
	const zeige = useHinweis();
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
	/** 197-02: Besteht ein Feld seine eigene Prüfung nicht, bleibt im Blatt die letzte gültige Zeichnung. */
	const feldFehler: Fehler = useMemo(() => (schema && werte ? pruefeFelder(schema, werte) : {}), [schema, werte]);
	const zeichenbar = Object.keys(feldFehler).length === 0;
	const regelFehler: Fehler = useMemo(() => (schema && werte ? pruefeWerte(schema, werte) : {}), [schema, werte]);
	const fehler: Fehler = useMemo(
		() =>
			ausBlatt.fehler && Object.keys(regelFehler).length === 0
				? { ...regelFehler, _element: lesbareMeldung(ausBlatt.fehler, schema) }
				: regelFehler,
		[regelFehler, ausBlatt.fehler, schema],
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

	/** Gibt es gerade einen Entwurf, der nicht gespeichert ist? (197-08: Beim Weggehen sagt die Hinweisleiste es.) */
	const offenBeim = useRef<{ nr: number; name: string } | null>(null);

	// Weg von der Abbildung, ohne dass ein Entwurf übernommen wurde: In der Darstellung wieder die Quelle zeigen.
	useEffect(() => {
		const alt = zuletzt.current;
		if (alt && alt.doc === doc && alt.nr !== nr) {
			zeichne(alt.doc, alt.nr, alt.werte, alt.schema);
			const verworfen = offenBeim.current;
			if (verworfen && verworfen.nr === alt.nr) {
				zeige({
					text: `Die Änderung an ‚${verworfen.name}‘ wurde verworfen.`,
					aktion: { titel: 'Zurück zur Abbildung', ausfuehren: () => struktur.zeigeAn(verworfen.nr) },
				});
			}
			offenBeim.current = null;
		}
		zuletzt.current = doc && nr !== null && quelle ? { doc, nr, werte: quelle, schema } : null;
	}, [doc, nr, quelle, schema]);

	useEffect(() => {
		if (doc && nr !== null && werte) {
			if (zeichenbar) {
				zeichne(doc, nr, werte, schema);
				setAusBlatt(liesVomBlatt(doc, nr));
			}
		} else {
			setAusBlatt(LEER);
		}
	}, [doc, nr, werte, schema, zeichenbar]);

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
		const [zeitAlt, zeitNeu] = [zeitDerUhr(q), zeitDerUhr(fassung)];
		struktur.aendereAttribute(`${s.name}: ${was ?? 'geändert'}`, (alt) => {
			const neu = setzeAbbildung(alt, n, attribute).quelle;
			// 197-01: Die Zeit daneben (Text, Lösung der Antwortlinie) geht mit.
			return tag === 'x-uhr' ? schreibeUhrzeitUm(neu, n, zeitAlt, zeitNeu) : neu;
		});
	};

	/** Neue Zahlen aus `abbildungen.js`, das auch das Blatt zeichnet; `null`, wenn es hier keine gibt. */
	const gewuerfelt = (ausgang: Werte) => {
		const { doc: d } = aktuell.current;
		const fenster = d?.defaultView as Zeichner | null | undefined;
		if (tag && KERN_NEUE_ZAHLEN[tag]) {
			return neueZahlenImKern(tag, ausgang, klasseVon(d));
		}
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
		if (s.generiert && feld.attribut === s.generiert && b) {
			eigene.current.add(schluessel());
		}
		// Die erzeugten Aufgaben gehören zu den Einstellungen: Ändert sich eine, entstehen sie neu. Nicht bei der
		// Anordnung und nicht, wenn die Lehrkraft die Liste selbst geschrieben hat (197-03).
		const wuerfeln =
			s.generiert &&
			feld.attribut !== s.generiert &&
			!s.generiertOhne?.includes(feld.attribut) &&
			!eigeneListe(s, w);
		const erzeugt = wuerfeln ? gewuerfelt(geaendert) : null;
		const neu = wuerfeln && s.generiert ? { ...geaendert, [s.generiert]: erzeugt?.[s.generiert] ?? null } : geaendert;
		aktuell.current = { ...aktuell.current, werte: neu };
		setEntwurf({ basis: b, werte: neu });
		if (uebernehmen) {
			uebernimm(neu, feld.name);
		}
	};

	const zuruecksetzen = () => setEntwurf(null);

	/** 197-03: Welche Rechenreihen ihre Liste von Hand bekommen haben, in dieser Sitzung. */
	const eigene = useRef(new Set<string>());
	const schluessel = () => `${adresse}:${aktuell.current.nr}`;
	/** Die Liste passt nicht mehr zu den Einstellungen: andere Anzahl, andere Rechenart oder von Hand geschrieben. */
	const eigeneListe = (s: AbbildungSchema, w: Werte) => {
		const liste = s.generiert ? w[s.generiert] : null;
		if (!liste?.trim()) {
			return false;
		}
		if (eigene.current.has(schluessel())) {
			return true;
		}
		const aufgaben = liste.split(';').filter((a) => a.trim());
		const anzahl = Number(w.anzahl ?? 10);
		const zeichen = w.rechenart ?? '+';
		return aufgaben.length !== anzahl || aufgaben.some((a) => !a.includes(zeichen));
	};

	const kerne = (doc?.defaultView as Zeichner | null)?.schoolboxAbbildungen;
	const hatNeueZahlen = Boolean(tag && (kerne?.NEUE_ZAHLEN.includes(tag) || KERN_NEUE_ZAHLEN[tag]));

	/** 197-05: Kleinere Zahlen, wenn die Klasse die Stellen der gespeicherten Abbildung nicht erlaubt. */
	const kleiner = (s: AbbildungSchema, w: Werte): Werte => {
		const neu: Werte = { ...w };
		for (const feld of s.felder) {
			const wert = w[feld.attribut];
			if (feld.art === 'zahlen' && wert) {
				neu[feld.attribut] = wert
					.split(/\s+/)
					.map((z) => (/^\d{2,}$/.test(z) ? String(Math.floor(Number(z) / 10)) : z))
					.join(' ');
			} else if (feld.art === 'zahl' && wert && /^\d{2,}$/.test(wert) && !feld.einheit) {
				neu[feld.attribut] = String(Math.max(feld.min, Math.floor(Number(wert) / 10)));
			}
		}
		return neu;
	};

	/** Warum es keine neuen Zahlen gibt (197-20). */
	const grundOhneZahlen = (w: Werte) => {
		if (tag === 'x-zahlenstrahl') {
			return 'Trag erst Pfeile mit Kästchen ein.';
		}
		if (tag === 'x-uhr') {
			return 'Stell erst eine Uhrzeit ein.';
		}
		return w.fehlerhaft === 'ja'
			? 'Hier gibt es gerade keine neuen Zahlen. Bei Sprüngen und Fehleraufgaben hängen die Zahlen zusammen.'
			: 'Hier gibt es gerade keine neuen Zahlen.';
	};

	/**
	 * Ein Schritt in „Rückgängig“; liefert, ob es geklappt hat, und meldet sonst den Grund. Gewürfelt wird, bis die
	 * Zeichnung fehlerfrei ist, höchstens 30-mal (197-05). Steht daneben eine Lösung, die nicht mitgehen kann, würfelt
	 * es nicht (197-01).
	 */
	const neueZahlen = () => {
		const { basis: b, doc: d, nr: n, quelle: q, schema: s, werte: w } = aktuell.current;
		if (!s || !w || b === null || n === null || !d) {
			return false;
		}
		const daneben = tag && struktur.gezeigt ? loesungDaneben(zuSehen(struktur.gezeigt).zerlegung?.quelle ?? '', n, tag, zeitDerUhr(w)) : null;
		if (daneben !== null) {
			zeige({
				text: `Neben ${tag === 'x-uhr' ? 'der Uhr' : 'der Abbildung'} steht eine Lösung. Ändere sie zuerst.`,
				aktion: { titel: 'Zeigen', ausfuehren: () => struktur.zeigeAn(daneben) },
			});
			return false;
		}
		const warRot = Boolean(liesVomBlatt(d, n).fehler);
		let ausgang = w;
		let treffer: Werte | null = null;
		let leer = false;
		for (let versuch = 0; versuch < 30 && !treffer; versuch++) {
			if (warRot && versuch > 0 && versuch % 10 === 0) {
				ausgang = kleiner(s, ausgang);
			}
			const werteNeu = gewuerfelt(ausgang);
			if (!werteNeu) {
				leer = true;
				break;
			}
			const neu = { ...w, ...werteNeu };
			if (Object.keys(pruefeWerte(s, neu)).length > 0) {
				continue;
			}
			zeichne(d, n, neu, s);
			if (!liesVomBlatt(d, n).fehler) {
				treffer = neu;
			}
		}
		if (!treffer) {
			zeichne(d, n, w, s);
			const klasse = klasseVon(d);
			zeige({
				text: leer
					? grundOhneZahlen(w)
					: `Für ${klasse ? `Klasse ${klasse}` : 'dieses Blatt'} gibt es hier keine passenden Zahlen. Ändere die Zahlen von Hand.`,
			});
			return false;
		}
		eigene.current.delete(schluessel());
		aktuell.current = { ...aktuell.current, werte: treffer };
		setEntwurf({ basis: b, werte: treffer });
		uebernimm(treffer, 'Neue Zahlen');
		return true;
	};

	const offen = Boolean(quelle && werte && unterschiede(quelle, werte).length > 0);
	useEffect(() => {
		offenBeim.current =
			offen && nr !== null && tag ? { nr, name: abbildungsName(tag) ?? schema?.name ?? 'Abbildung' } : null;
	});

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
		/** 197-03: Die erzeugte Liste ist von Hand geschrieben; die Einstellungen würfeln sie nicht neu. */
		eigeneAufgaben: Boolean(schema && werte && schema.generiert && eigeneListe(schema, werte)),
		aendere,
		uebernimm: () => uebernimm(),
		zuruecksetzen,
		hatNeueZahlen,
		neueZahlen,
	};
};

export type AbbildungSteuerung = ReturnType<typeof useAbbildung>;
