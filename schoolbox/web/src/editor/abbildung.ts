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
import { hatNeueZahlenImKern, KERN_NEUE_ZAHLEN, neueZahlenImKern } from '@schoolbox/kern/src/neue-zahlen';
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
	/** 207: gezeichnet, aber über dem Zahlenraum der Klasse (`data-warnung`); nur ein Prüfpunkt, kein Fehler. */
	warnung: string | null;
	/** 207-N02: Der Fehler kommt vom Platz (`data-fehler-platz`); nur dann sucht das Panel eine passende Zahl. */
	platz: boolean;
	zellen: Record<string, FormZelle[]>;
	info: string | null;
	sw: boolean;
}

/**
 * 207 (197-N02, 207-N02): Grenzen, die vom Platz abhängen, kennt nur die Zeichnung in `abbildungen.js`. Bricht sie
 * wegen des Platzes ab (`data-fehler-platz`), die gespeicherte Zahl aber zeichnet, nimmt das Panel die nächste Zahl
 * zur Eingabe hin, die sich noch zeichnen lässt. Jeder andere Fehler (keine Lösung, zu viele Linien) bleibt stehen,
 * wie er ist, mit dem Text der Zeichnung. So bleibt die Zeichnung die eine Quelle, und nichts, was zeichnet, wird
 * abgewiesen.
 */
const zeichenbarBis = (doc: Document, nr: number, s: AbbildungSchema, vorher: Werte, neu: Werte, feld: Feld) => {
	if (feld.art !== 'zahl' || feld.loesung) {
		return null;
	}
	const alt = Number(vorher[feld.attribut] ?? feld.standardJe?.(vorher) ?? feld.standard);
	const ziel = Number(neu[feld.attribut]);
	if (!Number.isFinite(alt) || !Number.isFinite(ziel) || alt === ziel) {
		return null;
	}
	const mit = (z: number): Werte => ({ ...neu, [feld.attribut]: String(z) });
	const stand = (z: number) => {
		zeichne(doc, nr, mit(z), s);
		return liesVomBlatt(doc, nr);
	};
	const amZiel = stand(ziel);
	if (!amZiel.fehler || !amZiel.platz || stand(alt).fehler) {
		return null;
	}
	const geht = (z: number) => !stand(z).fehler;
	const schritt = Number.isInteger(alt) && Number.isInteger(ziel) ? 1 : (feld.schritt ?? 1);
	let gut = alt;
	let schlecht = ziel;
	while (Math.abs(schlecht - gut) > schritt + 1e-9) {
		const k = Math.max(1, Math.floor(Math.abs(schlecht - gut) / schritt / 2));
		const mitte = Number((gut + Math.sign(schlecht - gut) * k * schritt).toFixed(6));
		if (geht(mitte)) {
			gut = mitte;
		} else {
			schlecht = mitte;
		}
	}
	return gut === alt ? null : { werte: mit(gut), wert: gut, grund: amZiel.fehler };
};

const klasseVon = (doc: Document | null | undefined) => {
	const k = /\bkl([1-4])\b/.exec(doc?.body.className ?? '')?.[1];
	return k ? Number(k) : undefined;
};

const LEER: AusDemBlatt = { fehler: null, warnung: null, platz: false, zellen: {}, info: null, sw: true };

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
 * Namen aus dem Schema. Technik-Text fängt seit 207 die Zeichnung selbst ab (Konsole statt Meldung).
 */
export const lesbareMeldung = (text: string, schema: AbbildungSchema | undefined) => {
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
		warnung: element?.getAttribute('data-warnung') ?? null,
		platz: element?.hasAttribute('data-fehler-platz') ?? false,
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
	const klasse = klasseVon(doc);
	const feldFehler: Fehler = useMemo(
		() => (schema && werte ? pruefeFelder(schema, werte, klasse) : {}),
		[schema, werte, klasse],
	);
	const zeichenbar = Object.keys(feldFehler).length === 0;
	const regelFehler: Fehler = useMemo(
		() => (schema && werte ? pruefeWerte(schema, werte, klasse) : {}),
		[schema, werte, klasse],
	);
	/** 197-N02: Das zuletzt geänderte Feld dieser Abbildung; dort steht eine Meldung der Zeichnung ohne eigenes Feld. */
	const [geaendertZuletzt, setGeaendertZuletzt] = useState<{ nr: number; attribut: string } | null>(null);
	const zuletztFeld =
		geaendertZuletzt?.nr === nr ? schema?.felder.find((f) => f.attribut === geaendertZuletzt.attribut) : undefined;
	const meldungAm =
		zuletztFeld && !zuletztFeld.ohneFeld && (!zuletztFeld.nurWenn || !werte || zuletztFeld.nurWenn(werte))
			? zuletztFeld.attribut
			: '_element';
	const fehler: Fehler = useMemo(
		() =>
			ausBlatt.fehler && Object.keys(regelFehler).length === 0
				? { ...regelFehler, [meldungAm]: lesbareMeldung(ausBlatt.fehler, schema) }
				: regelFehler,
		[regelFehler, ausBlatt.fehler, schema, meldungAm],
	);
	/**
	 * 197-02: Was das Panel aus Zahlen baut (Raster, Planquadrate, Stellen), nimmt diese Werte: Ein Feld, das seine
	 * Prüfung, eine Regel oder die Zeichnung nicht besteht, zählt mit dem gespeicherten Wert. So wird aus „9999“ im
	 * Entwurf nie ein Raster.
	 */
	const geprueft = useMemo(() => {
		const falsch = [...Object.keys(feldFehler), ...Object.keys(fehler)];
		if (!schema || !werte || falsch.length === 0) {
			return werte;
		}
		const neu: Werte = { ...werte };
		for (const feld of schema.felder.filter((f) => falsch.includes(f.attribut))) {
			for (const a of [feld.attribut, feld.loesung?.attribut]) {
				if (a) {
					neu[a] = quelle?.[a] ?? null;
				}
			}
		}
		return neu;
	}, [schema, werte, quelle, feldFehler, fehler]);
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
		if (!s || !q || !fassung || n === null || Object.keys(pruefeWerte(s, fassung, klasseVon(d))).length > 0) {
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

	/** Liefert den Wert, der im Feld steht; bei einer Grenze der Zeichnung (207) ist das nicht der eingegebene. */
	const aendere = (
		feld: Feld,
		wert: string | null,
		{ nurLoesung, uebernehmen = true }: Aenderung = {},
	): string | null | undefined => {
		const { basis: b, schema: s, werte: w } = aktuell.current;
		if (!s || !w || b === null) {
			return undefined;
		}
		const geaendert = aendereFeld(s, w, feld, wert, nurLoesung);
		if (s.felder.some((f) => f.attribut === feld.attribut)) {
			setGeaendertZuletzt({ nr: aktuell.current.nr ?? -1, attribut: feld.attribut });
		}
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
		const gewollt = wuerfeln && s.generiert ? { ...geaendert, [s.generiert]: erzeugt?.[s.generiert] ?? null } : geaendert;
		// Verglichen wird mit dem Gespeicherten: Beim Tippen steht die neue Zahl schon im Entwurf.
		const { doc: d, nr: n, quelle: q } = aktuell.current;
		const grenze =
			uebernehmen && d && q && n !== null ? zeichenbarBis(d, n, s, q, gewollt, feld) : null;
		const neu = grenze?.werte ?? gewollt;
		if (grenze) {
			const z = grenze.wert.toLocaleString('de-DE');
			zeige({ text: `${feld.name}: ${lesbareMeldung(grenze.grund, s)} Jetzt steht ${z} da.` });
		}
		aktuell.current = { ...aktuell.current, werte: neu };
		setEntwurf({ basis: b, werte: neu });
		if (uebernehmen) {
			uebernimm(neu, feld.name);
		}
		return neu[feld.attribut];
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
	const hatNeueZahlen = Boolean(tag && (kerne?.NEUE_ZAHLEN.includes(tag) || hatNeueZahlenImKern(tag, werte)));

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
		// 207: Über dem Zahlenraum wird gezeichnet; „Neue Zahlen“ bleibt trotzdem darin.
		const vorher = liesVomBlatt(d, n);
		const warRot = Boolean(vorher.fehler ?? vorher.warnung);
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
			if (Object.keys(pruefeWerte(s, neu, klasseVon(d))).length > 0) {
				continue;
			}
			zeichne(d, n, neu, s);
			const blatt = liesVomBlatt(d, n);
			if (!blatt.fehler && !blatt.warnung) {
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
		geprueft,
		/** Klasse des Blatts; manche Grenzen hängen davon ab (197-N02). */
		klasse,
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
