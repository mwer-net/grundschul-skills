/**
 * Besitzer: 246. Der Kanon der Einheit: was in Geschichte und Fach für alle Materialien gilt. Der Planlauf schreibt ihn
 * in `einheit.json` (`kanon`), er gilt als Teil des freigegebenen Plans. Bau-, Bilder-, Prüf- und Schlusslauf bekommen
 * ihn als Text; ein Material ergänzt ihn über `steckbrief.json` (`kanon.neu`), ändert ihn aber nie. Ohne `kanon` im Plan
 * (Einheiten vor 246) ist jeder Text hier leer und kein Auftrag ändert sich.
 */
import type { EinheitPlan, PlanDokument } from './einheit';
import { rolleVon } from './einheit-bau';

/** Grenzen beim Lesen, wie `kurz` und `kurzListe` für die übrigen Felder des Plans. */
export const KANON_GRENZEN = {
	figuren: 8,
	merkmale: 5,
	nie: 4,
	merkmal: 100,
	dinge: 10,
	name: 60,
	zustand: 140,
	geheim: 6,
	was: 200,
	regeln: 8,
	regel: 200,
	begriffe: 15,
	wort: 40,
	bedeutung: 160,
	/** Ergänzungen der Materialien im Stand und je Steckbrief. */
	nachtrag: 20,
	neuJeMaterial: 6,
	widerspruch: 6,
	widerspruchText: 240,
} as const;

/** Höchste Nummer eines Kapitels (wie `MAX_KAPITEL` im Plan). */
const MAX_KAPITEL = 30;

/** Eine Figur der Geschichte: was an ihr nie wechselt (`fest`, auch Zahlen) und was sie nie hat (`nie`). */
export interface KanonFigur {
	name: string;
	fest: string[];
	nie: string[];
}

/** Ein Gegenstand der Handlung mit seinem Zustand ab einem Kapitel; Schlüssel ist die Nummer des Kapitels. */
export interface KanonDing {
	name: string;
	kapitel: Record<string, string>;
}

/** Was bis zu einem Kapitel weder gezeigt noch gesagt wird; `bis` `null`: in der ganzen Reihe nicht. */
export interface KanonGeheim {
	was: string;
	bis: number | null;
}

/** Ein Fachwort, seine Bedeutung in Kindersprache und die Stunde, ab der es gilt (`null`: von Anfang an). */
export interface KanonBegriff {
	wort: string;
	bedeutung: string;
	ab: number | null;
}

export interface EinheitKanon {
	figuren: KanonFigur[];
	dinge: KanonDing[];
	geheim: KanonGeheim[];
	regeln: string[];
	begriffe: KanonBegriff[];
}

/** Was ein fertiges Material neu festgelegt hat (`kanon.neu` im Steckbrief), im Stand der Einheit. */
export interface KanonNachtrag {
	name: string;
	was: string;
	/** Slug des Materials. */
	von: string;
}

const kurz = (wert: unknown, max: number) =>
	typeof wert === 'string' ? wert.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const kurzListe = (wert: unknown, max: number, laenge: number) =>
	(Array.isArray(wert) ? wert : [])
		.map((w) => kurz(w, max))
		.filter(Boolean)
		.slice(0, laenge);

const objekt = (wert: unknown) => (typeof wert === 'object' && wert !== null ? wert : {}) as Record<string, unknown>;

const nummer = (wert: unknown) => {
	const n = typeof wert === 'string' && wert.trim() ? Number(wert) : wert;
	return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_KAPITEL ? n : null;
};

const leseFiguren = (roh: unknown) =>
	(Array.isArray(roh) ? roh : [])
		.map((f): KanonFigur => {
			const x = objekt(f);
			return {
				name: kurz(x.name, KANON_GRENZEN.name),
				fest: kurzListe(x.fest, KANON_GRENZEN.merkmal, KANON_GRENZEN.merkmale),
				nie: kurzListe(x.nie, KANON_GRENZEN.merkmal, KANON_GRENZEN.nie),
			};
		})
		.filter((f) => f.name && (f.fest.length || f.nie.length))
		.slice(0, KANON_GRENZEN.figuren);

const leseDinge = (roh: unknown) =>
	(Array.isArray(roh) ? roh : [])
		.map((d): KanonDing => {
			const x = objekt(d);
			const kapitel: Record<string, string> = {};
			for (const [k, v] of Object.entries(objekt(x.kapitel))) {
				const nr = nummer(k);
				const zustand = kurz(v, KANON_GRENZEN.zustand);
				if (nr !== null && zustand) {
					kapitel[String(nr)] = zustand;
				}
			}
			return { name: kurz(x.name, KANON_GRENZEN.name), kapitel };
		})
		.filter((d) => d.name && Object.keys(d.kapitel).length)
		.slice(0, KANON_GRENZEN.dinge);

const leseGeheim = (roh: unknown) =>
	(Array.isArray(roh) ? roh : [])
		.map((g): KanonGeheim => {
			const x = objekt(g);
			return { was: kurz(x.was, KANON_GRENZEN.was), bis: nummer(x.bis) };
		})
		.filter((g) => g.was)
		.slice(0, KANON_GRENZEN.geheim);

const leseBegriffe = (roh: unknown) =>
	(Array.isArray(roh) ? roh : [])
		.map((b): KanonBegriff => {
			const x = objekt(b);
			return {
				wort: kurz(x.wort, KANON_GRENZEN.wort),
				bedeutung: kurz(x.bedeutung, KANON_GRENZEN.bedeutung),
				ab: nummer(x.ab),
			};
		})
		.filter((b) => b.wort && b.bedeutung)
		.slice(0, KANON_GRENZEN.begriffe);

/** Liest `kanon` aus dem Plan; Ungültiges fällt heraus, ein leerer Kanon ist `undefined`. */
export const leseKanon = (roh: unknown): EinheitKanon | undefined => {
	if (typeof roh !== 'object' || roh === null) {
		return undefined;
	}
	const x = roh as Record<string, unknown>;
	const kanon: EinheitKanon = {
		figuren: leseFiguren(x.figuren),
		dinge: leseDinge(x.dinge),
		geheim: leseGeheim(x.geheim),
		regeln: kurzListe(x.regeln, KANON_GRENZEN.regel, KANON_GRENZEN.regeln),
		begriffe: leseBegriffe(x.begriffe),
	};
	const listen: readonly (readonly unknown[])[] = [
		kanon.figuren,
		kanon.dinge,
		kanon.geheim,
		kanon.regeln,
		kanon.begriffe,
	];
	return listen.some((l) => l.length > 0) ? kanon : undefined;
};

// ── Wo ein Material in der Geschichte steht ──

/** Rollen über die ganze Reihe: Sie haben kein Kapitel, auch wenn eine Stunde sie nennt. */
const GANZE_REIHE = new Set(['vorleseheft', 'hinweise', 'deckblatt', 'quellen', 'angebot']);

/**
 * Das Kapitel eines Materials: die eine Stunde, die es in der Aufgaben-Übersicht nennt (Stunde und Kapitel haben dieselbe
 * Nummer). `null` für Rollen über die ganze Reihe, für den Auftakt und für ein Material, das mehrere Stunden nennen.
 */
export const kapitelVon = (
	plan: Pick<EinheitPlan, 'stunden'> & { dokumente?: readonly PlanDokument[] },
	slug: string,
) => {
	const d = plan.dokumente?.find((x) => x.slug === slug);
	if (GANZE_REIHE.has(rolleVon(d ?? { slug, art: 'arbeitsblatt' }))) {
		return null;
	}
	const stunden = (plan.stunden ?? []).filter((s) => s.aufgaben.some((a) => a.dokument === slug));
	return stunden.length === 1 ? (stunden[0]?.nr ?? null) : null;
};

/** Der Zustand eines Gegenstands in einem Kapitel: der Eintrag dieses Kapitels oder des letzten davor. */
export const zustandIn = (ding: KanonDing, kapitel: number) => {
	const seit = Object.keys(ding.kapitel)
		.map(Number)
		.filter((k) => k <= kapitel)
		.sort((a, b) => b - a)[0];
	return seit === undefined ? null : { zustand: ding.kapitel[String(seit)] ?? '', seit };
};

/** Ist es im Kapitel noch geheim? Ohne Kapitel (ganze Reihe) gilt jedes Geheimnis. */
const nochGeheim = (g: KanonGeheim, kapitel: number | null) => kapitel === null || g.bis === null || kapitel < g.bis;

const geheimBis = (g: KanonGeheim) =>
	g.bis === null ? 'bleibt in der ganzen Reihe geheim' : `erst ab Kapitel ${g.bis}`;

/** Wann ein Geheimnis verraten ist: für Bau, Kinderaugen, Fachblick und Schlusslauf gleich. */
const VERRAT =
	'Verraten ist ein Geheimnis erst, wenn ein Kind es vor seinem Kapitel eindeutig erkennen kann: wer es war, die Lösung, der gesuchte Gegenstand im Bild. Spuren und Andeutungen, die Plan, Rätselkette oder falsche Fährte vorsehen, gehören dazu und sind kein Verrat.';

const ohnePunkt = (text: string) => text.replace(/[.!?…]+$/, '');

const figurZeile = (f: KanonFigur) =>
	`- ${f.name}: ${[f.fest.map(ohnePunkt).join('; '), f.nie.length ? `Nie: ${f.nie.map(ohnePunkt).join('; ')}` : '']
		.filter(Boolean)
		.join('. ')}.`;

const dingZeile = (d: KanonDing) =>
	`- ${d.name}: ${Object.entries(d.kapitel)
		.sort(([a], [b]) => Number(a) - Number(b))
		.map(([k, z]) => `Kap. ${k} ${ohnePunkt(z)}`)
		.join(' · ')}`;

const abStunde = (b: KanonBegriff) => (b.ab === null ? '' : ` (ab Stunde ${b.ab})`);

/** Was im Kapitel des Materials gilt, für den Anfang des Kanons. */
const kapitelBlock = (k: EinheitKanon, kapitel: number) => {
	const zustaende = k.dinge.flatMap((d) => {
		const z = zustandIn(d, kapitel);
		return z ? [`- ${d.name}: ${ohnePunkt(z.zustand)}${z.seit < kapitel ? ` (seit Kapitel ${z.seit})` : ''}.`] : [];
	});
	const geheim = k.geheim
		.filter((g) => nochGeheim(g, kapitel))
		.map((g) => `- Noch geheim, nicht erkennbar verraten: ${ohnePunkt(g.was)} (${geheimBis(g)}).`);
	const spaeter = k.begriffe.filter((b) => b.ab !== null && b.ab > kapitel);
	const zeilen = [
		...zustaende,
		...geheim,
		...(spaeter.length
			? [`- Noch nicht eingeführt: ${spaeter.map((b) => `${b.wort}${abStunde(b)}`).join(', ')}.`]
			: []),
	];
	return zeilen.length ? [`In Kapitel ${kapitel} gilt, für dieses Material zuerst:`, ...zeilen].join('\n') : '';
};

const nachtragBlock = (nachtrag: readonly KanonNachtrag[]) =>
	nachtrag.length
		? [
				'Von fertigen Materialien festgelegt (gilt ebenso):',
				...nachtrag.map((n) => `- ${n.name}: ${ohnePunkt(n.was)} (dokumente/${n.von}).`),
			].join('\n')
		: '';

/**
 * Der ganze Kanon für einen Bau-, Fach- oder Schlusslauf. Mit `kapitel` stehen die Zustände dieses Kapitels, was dort
 * noch geheim ist und welche Fachwörter noch nicht eingeführt sind, vorn. Ohne Kanon leer.
 */
export const kanonText = (
	kanon: EinheitKanon | undefined,
	o: { kapitel?: number | null; nachtrag?: readonly KanonNachtrag[] } = {},
) => {
	if (!kanon) {
		return '';
	}
	const k = kanon;
	return [
		'Kanon der Einheit (Teil des freigegebenen Plans; gilt für jedes Material, nur lesen):',
		o.kapitel === null || o.kapitel === undefined ? '' : kapitelBlock(k, o.kapitel),
		k.figuren.length ? ['Figuren, in jedem Material gleich:', ...k.figuren.map(figurZeile)].join('\n') : '',
		k.dinge.length ? ['Gegenstände der Handlung, Zustand ab Kapitel:', ...k.dinge.map(dingZeile)].join('\n') : '',
		k.geheim.length
			? [`Geheimnisse. ${VERRAT}`, ...k.geheim.map((g) => `- ${ohnePunkt(g.was)}: ${geheimBis(g)}.`)].join('\n')
			: '',
		k.regeln.length ? ['Regeln der Welt:', ...k.regeln.map((r) => `- ${r}`)].join('\n') : '',
		k.begriffe.length
			? [
					'Fachwörter, so erklärt und erst ab ihrer Stunde verwendet:',
					...k.begriffe.map((b) => `- ${b.wort}: ${ohnePunkt(b.bedeutung)}${abStunde(b)}.`),
				].join('\n')
			: '',
		nachtragBlock(o.nachtrag ?? []),
	]
		.filter(Boolean)
		.join('\n');
};

/**
 * Für den Prüflauf mit Kinderaugen (und den zweiten Blick auf Bilder): nur, was noch geheim ist. Ohne Kapitel jedes
 * Geheimnis mit dem Kapitel, ab dem es gezeigt werden darf. Leer ohne Kanon oder wenn nichts mehr geheim ist.
 */
export const geheimText = (kanon: EinheitKanon | undefined, kapitel: number | null) => {
	const geheim = (kanon?.geheim ?? []).filter((g) => nochGeheim(g, kapitel));
	if (!geheim.length) {
		return '';
	}
	return [
		kapitel === null
			? 'Was die Geschichte nicht zu früh verraten darf (aus dem Plan; eine Bildfolie „3.1“ gehört zu Kapitel 3). Kann ein Kind es auf einer Seite oder einem Bild vor seinem Kapitel eindeutig erkennen, melde es als „kanon“:'
			: `Was die Geschichte in Kapitel ${kapitel} noch nicht verraten darf (aus dem Plan). Kann ein Kind es auf einer Seite oder einem Bild eindeutig erkennen, melde es als „kanon“:`,
		...geheim.map((g) => `- ${ohnePunkt(g.was)} (${geheimBis(g)})`),
		'Spuren und Andeutungen, die Plan, Rätselkette oder falsche Fährte vorsehen, sind kein Befund.',
	].join('\n');
};

/** Für den Bildvertrag eines Bildes (248): der Zustand der Gegenstände im Kapitel und was nicht zu sehen sein darf. */
export const bildKanon = (kanon: EinheitKanon | undefined, kapitel: number) => ({
	zustand: (kanon?.dinge ?? []).flatMap((d) => {
		const z = zustandIn(d, kapitel);
		return z ? [`${d.name}: ${ohnePunkt(z.zustand)}`] : [];
	}),
	verboten: (kanon?.geheim ?? []).filter((g) => nochGeheim(g, kapitel)).map((g) => ohnePunkt(g.was)),
});

// ── Bildvertrag aus dem Kanon (248) ──

/** Ein Vorschlag für den Bildvertrag: Zeilen, die wörtlich in `pflicht` und `verboten` stehen müssen. */
export interface BildVorschlag {
	pflicht: string[];
	verboten: string[];
}

const BILD_DATEI_KAPITEL = /^(?:fall|folie)-(\d{1,2})(?=[-.])/;
const BILDFOLIE_IM_MOTIV = /^(?:bildfolie\s+)?(\d{1,2})\.(\d{1,2})(?!\d)/i;
const KAPITEL_IM_MOTIV = /^kapitel\s+(\d{1,2})\s*:/i;

/**
 * Das Kapitel eines Bildes: aus dem Dateinamen (`fall-3.jpg`, `folie-3-1.jpg`), aus einem Motiv, das mit „Kapitel 6:“
 * beginnt (eine Pose für die Auflösung), oder, wenn das Motiv mit der Nummer einer Bildfolie des Plans beginnt
 * („Bildfolie 3.1: …“), aus `geschichte.kapitel.bildfolien`. `null`, wenn die Geschichte das Kapitel nicht hat oder
 * nichts darauf zeigt (Grundpose, Pose, Deckblatt).
 */
export const bildKapitel = (plan: Pick<EinheitPlan, 'geschichte'>, datei: string, motiv = '') => {
	const kapitel = plan.geschichte?.kapitel ?? [];
	const aus = BILD_DATEI_KAPITEL.exec(datei);
	if (aus) {
		const nr = Number(aus[1]);
		return kapitel.some((k) => k.nr === nr) ? nr : null;
	}
	const genannt = KAPITEL_IM_MOTIV.exec(motiv.trim());
	if (genannt) {
		const nr = Number(genannt[1]);
		return kapitel.some((k) => k.nr === nr) ? nr : null;
	}
	const folie = BILDFOLIE_IM_MOTIV.exec(motiv.trim());
	if (!folie) {
		return null;
	}
	const nr = Number(folie[1]);
	const nummer = `${nr}.${Number(folie[2])}`;
	return kapitel.some((k) => k.nr === nr && k.bildfolien.some((b) => b.startsWith(nummer))) ? nr : null;
};

const woerterVon = (text: string) => new Set(schluessel(text).split(' ').filter(Boolean));

/** Nennt der Text die Figur? Ihr Name (das letzte Wort) als ganzes Wort, auch im Genitiv („Ellas“). */
const nenntFigur = (woerter: ReadonlySet<string>, name: string) => {
	const kern = schluessel(name).split(' ').at(-1) ?? '';
	return kern.length >= 3 && (woerter.has(kern) || woerter.has(`${kern}s`));
};

/** Die Nomen einer Regel: groß geschrieben, mindestens vier Buchstaben, nicht am Satzanfang, keine Figur. */
const nomenDerRegel = (regel: string, figuren: readonly string[]) => {
	const namen = new Set(figuren.map((f) => schluessel(f)));
	return [...regel.matchAll(/(^|[.!?]\s+|\s)(\p{Lu}[\p{L}-]{3,})/gu)]
		.filter((t) => !/^$|[.!?]\s+$/u.test(t[1] ?? ''))
		.map((t) => schluessel(t[2] ?? ''))
		.filter((n) => n && !namen.has(n) && !namen.has(n.replace(/s$/, '')));
};

/** Ein Wort des Vertrags trifft ein Nomen der Regel: gleich, gebeugt („Spiegeln“) oder als Ende eines Kompositums. */
const trifft = (nomen: string, wort: string) =>
	wort === nomen ||
	(wort.startsWith(nomen) && wort.length - nomen.length <= 2) ||
	(nomen.length >= 5 && wort.endsWith(nomen));

/** Handelt eine Regel der Welt von etwas im Bild (Werkzeug, Fachgegenstand)? Dann gehört sie in `pflicht`. */
const regelImBild = (regel: string, woerter: ReadonlySet<string>, figuren: readonly string[]) =>
	nomenDerRegel(regel, figuren).some((n) => [...woerter].some((w) => trifft(n, w)));

const figurPflicht = (f: KanonFigur) => `${f.name}: ${f.fest.map(ohnePunkt).join('; ')}`;
/** Ohne doppelte Verneinung: „nie: keine Brille“ wird „nie: Brille“. */
const ohneKein = (text: string) => ohnePunkt(text).replace(/^(?:kein|keine|keinen|keinem|keiner|nie)\s+/i, '');
const figurNie = (f: KanonFigur) => `${f.name}, nie: ${f.nie.map(ohneKein).join('; ')}`;
const dingZustand = (d: KanonDing, zustand: string) => `${d.name}: ${ohnePunkt(zustand)}`;
const geheimZeile = (g: KanonGeheim) =>
	`erkennbar${g.bis === null ? '' : ` vor Kapitel ${g.bis}`}: ${ohnePunkt(g.was)}`;
const dingBei = (d: KanonDing, f: KanonFigur) => `${d.name} bei ${f.name}`;

/** Hat die Figur den Gegenstand je in der Geschichte, aber nicht in diesem Kapitel? Dann darf er nicht an ihr sein. */
const nichtBeiFigur = (d: KanonDing, f: KanonFigur, kapitel: number) => {
	const nennt = (zustand: string) => nenntFigur(woerterVon(zustand), f.name);
	if (!Object.values(d.kapitel).some(nennt)) {
		return false;
	}
	const jetzt = zustandIn(d, kapitel);
	return !jetzt || !nennt(jetzt.zustand);
};

/**
 * Der Vorschlag für den Bildvertrag eines Bildes aus dem Kanon. `text` ist, was der Vertrag zeigen will (Motiv und
 * `pflicht`): Daraus kommen die Figuren, die Gegenstände und die Regeln der Welt, von denen das Bild handelt.
 * - `pflicht`: je Figur ihre festen Merkmale, je Gegenstand im Bild sein Zustand im Kapitel, je Regel zu einem
 *   Werkzeug oder Fachgegenstand im Bild die Regel.
 * - `verboten`: was im Kapitel noch geheim ist, je Figur ihr `nie`, Gegenstände, die die Figur nur in anderen
 *   Kapiteln hat.
 * Ohne Kapitel (Grundpose, Pose, Deckblatt) Figuren, Regeln und die Geheimnisse wie in Kapitel 0: Diese Bilder sehen
 * die Kinder vor der Auflösung. Zustände und „Ding bei Figur“ nur mit Kapitel.
 */
export const bildVorschlag = (kanon: EinheitKanon, kapitel: number | null, text: string): BildVorschlag => {
	const woerter = woerterVon(text);
	const figuren = kanon.figuren.filter((f) => nenntFigur(woerter, f.name));
	const namen = kanon.figuren.map((f) => f.name);
	const mitKapitel = <T>(liste: () => T[]) => (kapitel === null ? [] : liste());
	return {
		pflicht: [
			...figuren.filter((f) => f.fest.length).map(figurPflicht),
			...mitKapitel(() =>
				kanon.dinge
					.filter((d) => nenntNamen(text, d.name))
					.flatMap((d) => {
						const z = zustandIn(d, kapitel ?? 0);
						return z ? [dingZustand(d, z.zustand)] : [];
					}),
			),
			...kanon.regeln.filter((r) => regelImBild(r, woerter, namen)).map(ohnePunkt),
		],
		verboten: [
			...kanon.geheim.filter((g) => nochGeheim(g, kapitel ?? 0)).map(geheimZeile),
			...figuren.filter((f) => f.nie.length).map(figurNie),
			...mitKapitel(() =>
				figuren.flatMap((f) =>
					kanon.dinge.filter((d) => nichtBeiFigur(d, f, kapitel ?? 0)).map((d) => dingBei(d, f)),
				),
			),
		],
	};
};

/** Alle Texte in einem Wert aus `bilder.json`: Zeichenketten, auch in Listen und Objekten. */
const blaetter = (wert: unknown): string[] => {
	if (typeof wert === 'string') {
		return [wert];
	}
	if (Array.isArray(wert)) {
		return wert.flatMap(blaetter);
	}
	return typeof wert === 'object' && wert !== null ? Object.values(wert).flatMap(blaetter) : [];
};

/** Für den Abgleich: Groß- und Kleinschreibung, Leerraum, Anführungszeichen und Satzzeichen am Ende zählen nicht. */
const abgleichText = (text: string) =>
	text
		.normalize('NFC')
		.toLowerCase()
		.replace(/[„“”‚‘’"«»]/g, '')
		.replace(/\s+/g, ' ')
		.replace(/[\s.!?…;:,]+$/, '')
		.trim();

/** Die Zeilen des Vorschlags, die im Vertrag fehlen: Jede muss in einem Eintrag ihres Felds wörtlich stehen. */
export const fehlendeZeilen = (vorschlag: BildVorschlag, vertrag: unknown): BildVorschlag => {
	const v = objekt(vertrag);
	const fehlt = (zeilen: readonly string[], feld: unknown) => {
		const da = blaetter(feld).map(abgleichText);
		return zeilen.filter((z) => !da.some((d) => d.includes(abgleichText(z))));
	};
	return { pflicht: fehlt(vorschlag.pflicht, v.pflicht), verboten: fehlt(vorschlag.verboten, v.verboten) };
};

const dateiName = (name: string) =>
	name
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

/** Eine Grundpose: Das Motiv beginnt mit „Grundpose“, oder die Datei heißt wie eine Figur des Kanons (`ella.png`). */
const istGrundpose = (kanon: EinheitKanon, datei: string, motiv: string) => {
	const stamm = datei.replace(/\.(png|jpg)$/, '');
	return /^grundpose\b/i.test(motiv.trim()) || kanon.figuren.some((f) => dateiName(f.name) === stamm);
};

/** Was das Bild zeigen will: Motiv und `pflicht`, ohne die Zeilen, die schon aus dem Kanon kommen. */
const zeigtText = (kanon: EinheitKanon, motiv: string, vertrag: unknown) => {
	const ausKanon = (leaf: string) => {
		const t = abgleichText(leaf);
		return (
			kanon.dinge.some((d) => t.startsWith(`${abgleichText(d.name)}:`)) ||
			kanon.regeln.some((r) => t.includes(abgleichText(r)))
		);
	};
	return [motiv, ...blaetter(objekt(vertrag).pflicht).filter((b) => !ausKanon(b))].join('\n');
};

export const GRUNDPOSE_SATZ =
	'Die Grundpose zeigt nur, was die Figur in jeder Szene hat (Kanon `figuren.fest`). Gegenstände der Handlung (Kanon `dinge`) kommen nie in die Grundpose.';

const zitiert = (zeilen: readonly string[]) => zeilen.map((z) => `„${z}“`).join(', ');

/**
 * Prüft den Bildvertrag aus `bilder.json` vor `bild_erzeugen` gegen den Kanon (248) und gibt den Satz der Ablehnung
 * zurück, `null`, wenn er passt. Eine Grundpose nennt keinen Gegenstand der Handlung; jeder Vertrag hat jede Zeile
 * seines Vorschlags. Ohne Kanon im Plan immer `null`: Dann bleibt alles wie vor 248.
 */
export const pruefeBildVertrag = (
	plan: Pick<EinheitPlan, 'kanon' | 'geschichte'>,
	e: { datei: string; motiv: string; vertrag?: unknown },
): string | null => {
	const kanon = plan.kanon;
	if (!kanon) {
		return null;
	}
	const text = zeigtText(kanon, e.motiv, e.vertrag);
	if (istGrundpose(kanon, e.datei, e.motiv)) {
		const dinge = kanon.dinge.filter((d) => nenntNamen(text, d.name)).map((d) => d.name);
		if (dinge.length) {
			return `${GRUNDPOSE_SATZ} Nimm ${zitiert(dinge)} aus „motiv“ und „pflicht“ von ${e.datei} in bilder.json und erzeuge die Grundpose dann.`;
		}
	}
	const kapitel = istGrundpose(kanon, e.datei, e.motiv) ? null : bildKapitel(plan, e.datei, e.motiv);
	const fehlt = fehlendeZeilen(bildVorschlag(kanon, kapitel, text), e.vertrag);
	if (!fehlt.pflicht.length && !fehlt.verboten.length) {
		return null;
	}
	return [
		`Dem Bildvertrag von ${e.datei} in bilder.json fehlen Zeilen aus dem Kanon${kapitel === null ? '' : ` (Kapitel ${kapitel})`}. Übernimm jede wörtlich als eigenen Eintrag in ihr Feld von „vertrag“ und erzeuge das Bild dann:`,
		fehlt.pflicht.length ? `- pflicht: ${zitiert(fehlt.pflicht)}` : '',
		fehlt.verboten.length ? `- verboten: ${zitiert(fehlt.verboten)}` : '',
	]
		.filter(Boolean)
		.join('\n');
};

/** Die Zeilen eines Kapitels für den Auftrag des Bilderlaufs, wie `bildVorschlag` sie verlangt. */
const kapitelZeilen = (kanon: EinheitKanon, nr: number) => {
	const geheim = kanon.geheim.filter((g) => nochGeheim(g, nr)).map(geheimZeile);
	const dinge = kanon.dinge.flatMap((d) => {
		const z = zustandIn(d, nr);
		return z ? [`im Bild „${d.name}“: pflicht „${dingZustand(d, z.zustand)}“`] : [];
	});
	const bei = kanon.figuren.flatMap((f) =>
		kanon.dinge.filter((d) => nichtBeiFigur(d, f, nr)).map((d) => `im Bild ${f.name}: verboten „${dingBei(d, f)}“`),
	);
	const teile = [...(geheim.length ? [`verboten ${zitiert(geheim)}`] : []), ...dinge, ...bei];
	return teile.length ? [`- Kapitel ${nr}: ${teile.join('; ')}.`] : [];
};

/**
 * Der Kanon für den Bilderlauf (248): die Zeilen, die `pruefeBildVertrag` je Bild verlangt, nach Figur, Regel und
 * Kapitel, dazu die Figuren und Regeln. Leer ohne Kanon.
 */
export const bilderKanonText = (kanon: EinheitKanon | undefined, kapitel: readonly number[]) => {
	if (!kanon) {
		return '';
	}
	const nummern = [...new Set([...kapitel, ...kanon.dinge.flatMap((d) => Object.keys(d.kapitel).map(Number))])].sort(
		(a, b) => a - b,
	);
	const figuren = kanon.figuren.map((f) =>
		[
			`- im Bild ${f.name}:`,
			f.fest.length ? ` pflicht „${figurPflicht(f)}“` : '',
			f.fest.length && f.nie.length ? ';' : '',
			f.nie.length ? ` verboten „${figurNie(f)}“` : '',
		].join(''),
	);
	const je = nummern.flatMap((nr) => kapitelZeilen(kanon, nr));
	return [
		'Kanon für die Bilder (aus dem freigegebenen Plan). Ein Bild gehört zum Kapitel seiner Fall-Karte oder Bildfolie („3.1“ zu Kapitel 3).',
		`Bildvertrag aus dem Kanon: Übernimm jede Zeile, die zu einem Bild passt, wörtlich als eigenen Eintrag in „pflicht“ oder „verboten“ seines Vertrags und ergänze, was das Bild sonst braucht. bild_erzeugen lehnt einen Vertrag ab, dem eine dieser Zeilen fehlt, und nennt sie. ${GRUNDPOSE_SATZ} Grundposen, Posen und das Deckblatt haben kein Kapitel: Für sie gelten Figuren, Regeln und die Geheimnisse von Kapitel 0. Eine Pose, die erst ab einem Kapitel vorkommt, nennt es am Anfang des Motivs („Kapitel 6: …“); die Grundpose nie.`,
		figuren.length ? ['Je Figur, in jedem Bild:', ...figuren].join('\n') : '',
		kanon.regeln.length
			? [
					'Regeln der Welt. Handelt eine von einem Werkzeug oder Gegenstand im Bild, steht sie in „pflicht“; sie sagt, wie er aussieht und benutzt wird:',
					...kanon.regeln.map((r) => `- „${ohnePunkt(r)}“`),
				].join('\n')
			: '',
		je.length
			? [
					'Je Kapitel. Eine Spur im Bild ist erlaubt, die erkennbare Auflösung nicht:',
					...je,
				].join('\n')
			: '',
	]
		.filter(Boolean)
		.join('\n');
};

/** Vorleseheft und Hinweise prüft der Fachblick vor allem gegen den Kanon (Ticket 246, Punkt 6). */
const KANON_ZUERST = new Set(['vorleseheft', 'hinweise']);

/**
 * Was die Prüfläufe eines Materials vom Kanon bekommen; Server und Prüfstand rufen beide diese Funktion. Kinderaugen nur
 * `geheim`, der Fachblick den ganzen Kanon. Ohne Kanon leere Objekte: Die Aufträge bleiben wie vor 246.
 */
export const pruefKanon = (
	plan: Pick<EinheitPlan, 'kanon' | 'stunden'> & { dokumente?: readonly PlanDokument[] },
	d: Pick<PlanDokument, 'slug' | 'art'>,
	nachtrag: readonly KanonNachtrag[] = [],
): { kind: { geheim?: string }; fach: { kanon?: string; kanonZuerst?: boolean } } => {
	if (!plan.kanon) {
		return { kind: {}, fach: {} };
	}
	const kapitel = GANZE_REIHE.has(rolleVon(d)) ? null : kapitelVon(plan, d.slug);
	const geheim = geheimText(plan.kanon, kapitel);
	return {
		kind: geheim ? { geheim } : {},
		fach: {
			kanon: kanonText(plan.kanon, { kapitel, nachtrag }),
			...(KANON_ZUERST.has(rolleVon(d)) ? { kanonZuerst: true } : {}),
		},
	};
};

// ── Steckbrief: ergänzen, nie ändern ──

/** Das Feld in `steckbrief.json`: `{ neu: [{ name, was }], widerspruch: ["…"] }`. */
export const KANON_FELD = 'kanon';

export interface SteckbriefKanon {
	neu: { name: string; was: string }[];
	widerspruch: string[];
}

/** Liest `kanon` aus `steckbrief.json` tolerant. */
export const leseSteckbriefKanon = (roh: unknown): SteckbriefKanon => {
	const k = objekt(objekt(roh)[KANON_FELD]);
	return {
		neu: (Array.isArray(k.neu) ? k.neu : [])
			.map((n) => {
				const x = objekt(n);
				return { name: kurz(x.name, KANON_GRENZEN.name), was: kurz(x.was, KANON_GRENZEN.was) };
			})
			.filter((n) => n.name && n.was)
			.slice(0, KANON_GRENZEN.neuJeMaterial),
		widerspruch: kurzListe(k.widerspruch, KANON_GRENZEN.widerspruchText, KANON_GRENZEN.widerspruch),
	};
};

const schluessel = (name: string) =>
	name
		.toLowerCase()
		.replace(/^(der|die|das|ein|eine|einen|den|dem)\s+/, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();

/**
 * Nennt ein Text den Gegenstand `name` (247)? Gleich wie der Namensvergleich der Ergänzungen (`schluessel`), dazu
 * genügt das letzte Wort des Namens als ganzes Wort im Text: „das goldene Glöckchen“ steht in „trägt ein kleines
 * goldenes Glöckchen“. Kein Wortstamm, keine Ähnlichkeit; Wörter unter drei Zeichen zählen nicht.
 */
export const nenntNamen = (text: string, name: string) => {
	const kern = schluessel(name).split(' ').at(-1) ?? '';
	return kern.length >= 3 && schluessel(text).split(' ').includes(kern);
};

/** Namen, die der Plan schon festlegt: Figuren (auch `plan.figuren`), Gegenstände und Fachwörter. */
const planNamen = (plan: Pick<EinheitPlan, 'kanon' | 'figuren'>) =>
	new Set(
		[
			...(plan.figuren ?? []).map((f) => f.name),
			...(plan.kanon?.figuren ?? []).map((f) => f.name),
			...(plan.kanon?.dinge ?? []).map((d) => d.name),
			...(plan.kanon?.begriffe ?? []).map((b) => b.wort),
		]
			.filter(Boolean)
			.map(schluessel),
	);

/**
 * Führt `kanon.neu` eines fertigen Materials in die Ergänzungen des Stands nach. Nur Ergänzungen: Nennt `neu` einen
 * Namen, den der Plan schon festlegt, oder eine Ergänzung eines anderen Materials anders, übernimmt der Server es
 * nicht; es wird ein Widerspruch für den Schlusslauf. Die eigenen Ergänzungen eines Materials ersetzt sein nächster
 * Steckbrief (Korrekturrunde). Ohne Kanon im Plan bleibt alles, wie es ist.
 */
export const fuehreKanonNach = (
	plan: Pick<EinheitPlan, 'kanon' | 'figuren'>,
	bisher: readonly KanonNachtrag[],
	slug: string,
	roh: unknown,
): { nachtrag: KanonNachtrag[]; widerspruch: string[] } => {
	if (!plan.kanon) {
		return { nachtrag: [...bisher], widerspruch: [] };
	}
	const steckbrief = leseSteckbriefKanon(roh);
	const fest = planNamen(plan);
	const andere = bisher.filter((n) => n.von !== slug);
	const eigene: KanonNachtrag[] = [];
	const widerspruch = [...steckbrief.widerspruch];
	for (const n of steckbrief.neu) {
		const k = schluessel(n.name);
		const frueher = andere.find((a) => schluessel(a.name) === k);
		if (fest.has(k)) {
			widerspruch.push(`Will den Plan ändern („${n.name}“), nicht übernommen: ${n.was}`);
		} else if (frueher && frueher.was !== n.was) {
			widerspruch.push(
				`Weicht von dokumente/${frueher.von} ab („${n.name}“: ${frueher.was}), nicht übernommen: ${n.was}`,
			);
		} else if (!frueher && !eigene.some((e) => schluessel(e.name) === k)) {
			eigene.push({ ...n, von: slug });
		}
	}
	return {
		nachtrag: [...andere, ...eigene].slice(0, KANON_GRENZEN.nachtrag),
		widerspruch: widerspruch.map((w) => w.slice(0, KANON_GRENZEN.widerspruchText)),
	};
};

/** Die Abweichungen aller Steckbriefe für den Schlusslauf, „Punkt für Punkt“. Leer ohne Kanon. */
export const widerspruchText = (
	plan: Pick<EinheitPlan, 'kanon' | 'dokumente'>,
	widerspruch: (slug: string) => readonly string[] | undefined,
) => {
	if (!plan.kanon) {
		return '';
	}
	const zeilen = plan.dokumente.flatMap((d) => (widerspruch(d.slug) ?? []).map((w) => `- dokumente/${d.slug}: ${w}`));
	return zeilen.length
		? [
				'Abweichungen vom Kanon aus den Steckbriefen, Punkt für Punkt: Passt jede zur Geschichte? Bringe die Materialien in Einklang mit dem Kanon oder melde, was offen bleibt, als „kanon“:',
				...zeilen,
			].join('\n')
		: 'Abweichungen vom Kanon: Kein Steckbrief meldet eine.';
};
