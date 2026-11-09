/**
 * Rezepte im Kern (Oberfläche „Rezept“, Code „Aufmachung“, Ticket 114; Briefing 03-modell.md 3.10 und
 * schubladen/7-rezepte.md). Ein Rezept besteht aus Werten am `body`, aus erzeugten Teilen je Seite (Seitenfläche,
 * Seitenrahmen, Streuungen, alle mit `data-aufmachung-teil` und `data-gesperrt` in `.ebene.hinten`) und aus Regeln in
 * `blatt.css` (Kopfband, Titelfarbe). Die Funktionen hier sind rein und messen nichts, damit der Server sie auch auf
 * Materialien anwenden kann, die nicht offen sind.
 *
 * Ein Rezept fasst nur Elemente mit `data-aufmachung-teil` und die eigenen Werte am `body` an (Z7). Einzige Ausnahme:
 * Beim ersten Anwenden ersetzt es eine eigene Seitenfläche und einen eigenen Seitenrahmen (ein Schritt, ⌘Z holt sie
 * zurück); `legeAufmachungFrei` gibt dem Titel eine Farbe.
 */

import type {
	Aufmachung,
	AufmachungsFormat,
	AufmachungWerte,
	Farbwelt,
	Kopfband,
	Regler,
	StreuZone,
} from './aufmachungen/index';
import {
	AUFMACHUNG_FORMATE,
	AUFMACHUNG_RAHMEN,
	aufmachungVon,
	KONFETTI_FORMEN,
	KOPFBAENDER,
} from './aufmachungen/index';
import { istEbene, legeGestaltungAb, neueId, stilMitLage } from './gestaltung';
import { formatAusHtml } from './html';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	einrueckung,
	entferne,
	fuegeEin,
	innenVon,
	klassenVon,
	quelleVon,
	rueckeUm,
	schuetzeAttribut,
	setzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';
import { saatAus, streuungHtml } from './streuen';

export * from './aufmachungen/index';

/** Kennzeichen eines erzeugten Teils; der Wert nennt die Art (`flaeche`, `rahmen`, `streuung`). */
export const TEIL = 'data-aufmachung-teil';
const GESPERRT = 'data-gesperrt';
const EINZUG = '  ';

/** Saat, wenn keine angegeben ist: Gleiche Werte ergeben so überall dasselbe Blatt. */
export const STANDARD_SAAT = 4711;

/** Die Attribute am `body`, in dieser Reihenfolge geschrieben. */
const ATTRIBUTE = [
	'data-aufmachung',
	'data-aufmachung-farben',
	'data-aufmachung-kopfband',
	'data-aufmachung-rahmen',
	'data-aufmachung-konfetti',
	'data-aufmachung-saat',
] as const;

/** Die Farben im `style` des `body`; sie bleiben beim Freilegen, weil die Teile auf sie verweisen. */
const FARB_VARIABLEN = ['--a1', '--a2', '--a3', '--a4', '--a-flaeche', '--a-titel', '--a-muster'] as const;
/** Maße des Kopfbands je Rezept und Format (nur, wenn das Rezept eigene hat). */
const BAND_VARIABLEN = ['--kopfband-unten', '--kopfband-kante', '--kopfband-welle'] as const;
const VARIABLEN: readonly string[] = [...FARB_VARIABLEN, ...BAND_VARIABLEN];

// ── Hilfen ──────────────────────────────────────────────────────────────────

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

const seitenIn = (z: Zerlegung) => z.knoten.filter((k) => hat(k, 'seite'));

const hintenIn = (seite: Knoten) => seite.kinder.find((k) => istEbene(k) && hat(k, 'hinten'));

const bodyIn = (z: Zerlegung) => z.knoten.find((k) => k.tag === 'body');

const istTeil = (k: Knoten) => attribut(k, TEIL) !== undefined;

const nachfahren = (k: Knoten): Knoten[] => k.kinder.flatMap((c) => [c, ...nachfahren(c)]);

const alleTeile = (z: Zerlegung) => z.knoten.filter(istTeil);

/** Eine eigene (nicht vom Rezept erzeugte) Seitenfläche bzw. ein eigener Seitenrahmen. */
const eigenesIn = (seite: Knoten, klasse: string) => hintenIn(seite)?.kinder.find((k) => hat(k, klasse) && !istTeil(k));

const formatVon = (quelle: string): AufmachungsFormat | null =>
	AUFMACHUNG_FORMATE.find((f) => f === formatAusHtml(quelle)) ?? null;

/** Format des Materials für Rezepte; `null` im Minibuch (119: Vorschaubilder). */
export const aufmachungsFormatVon = formatVon;

const auswahl = <T extends string | number>(liste: readonly T[], wert: unknown): T | undefined =>
	liste.find((w) => String(w) === String(wert ?? '').trim());

/** Steht das Tag allein, als `name` ohne Wert, am Ende des Start-Tags; mit Wert als `name="wert"`. */
const amEnde = (z: Zerlegung, k: Knoten, text: string): Aenderung => {
	const tag = z.quelle.slice(k.start, k.oeffnerEnde);
	const pos = k.start + (/\s*\/?>$/.exec(tag)?.index ?? tag.length);
	return { von: pos, bis: pos, text };
};

// ── Deckblatt und Thema ─────────────────────────────────────────────────────

/**
 * Ein Deckblatt ist die erste Seite eines Materials, wenn sie keine `.aufgabe` enthält (Regel aus 114). `seite` ist die
 * Nummer der `.seite` in der Quelle.
 */
export const istDeckblatt = (quelle: string, seite: number) => {
	const z = zerlege(quelle);
	const s = z.knoten[seite];
	if (!s || !hat(s, 'seite')) {
		throw new Error(`Das Element ${seite} ist keine Seite.`);
	}
	return seitenIn(z)[0] === s && !nachfahren(s).some((k) => hat(k, 'aufgabe'));
};

/** Ein Thema mit eigenem Kopf (Bausteine `themakopf`, `themaband`): Dann setzt das Rezept kein Kopfband. */
export const hatThemaKopf = (quelle: string) =>
	quelle.includes('thema-') && zerlege(quelle).knoten.some((k) => hat(k, 'thema-kopf') || hat(k, 'thema-band'));

// ── Werte lesen ─────────────────────────────────────────────────────────────

const STANDARD_REGLER: Regler = {
	farben: 1,
	kopfband: 'ohne',
	rahmen: 'ohne',
	konfetti: { menge: 0, formen: [] },
};

const menge = (wert: number) => Math.round(Math.min(1, Math.max(0, Number.isFinite(wert) ? wert : 0)) * 100) / 100;

/** Formen in fester Reihenfolge, ohne Doppelte und ohne Unbekannte. */
const formenAus = (formen: readonly string[]) => KONFETTI_FORMEN.filter((f) => formen.includes(f));

const konfettiAus = (text: string | null | undefined) => {
	if (text === undefined || text === null) {
		return null;
	}
	const [zahl = '', ...rest] = text.trim().split(/\s+/);
	return { menge: menge(Number(zahl)), formen: formenAus(rest) };
};

/** Die Werte am `body`, ergänzt um die Standards des Rezepts; `null` ohne `data-aufmachung`. */
export const leseAufmachung = (quelle: string): AufmachungWerte | null => {
	if (!quelle.includes('data-aufmachung')) {
		return null;
	}
	const body = bodyIn(zerlege(quelle));
	const lies = (name: string) => (body ? attribut(body, name)?.wert : undefined);
	const id = lies('data-aufmachung')?.trim();
	if (!id) {
		return null;
	}
	const standard = aufmachungVon(id)?.standard ?? STANDARD_REGLER;
	const saat = Number(lies('data-aufmachung-saat'));
	return {
		id,
		farben: auswahl([1, 2, 3] as const, lies('data-aufmachung-farben')) ?? standard.farben,
		// Fehlt das Kopfband, ist es „ohne“ (7-rezepte.md, Regler).
		kopfband: auswahl(KOPFBAENDER, lies('data-aufmachung-kopfband')) ?? 'ohne',
		rahmen: auswahl(AUFMACHUNG_RAHMEN, lies('data-aufmachung-rahmen')) ?? standard.rahmen,
		konfetti: konfettiAus(lies('data-aufmachung-konfetti')) ?? standard.konfetti,
		saat: lies('data-aufmachung-saat') && Number.isFinite(saat) ? saatAus(saat) : STANDARD_SAAT,
	};
};

// ── Werte am body ───────────────────────────────────────────────────────────

/** Entfernt die Variablen aus dem `style`-Text, Zeichen für Zeichen wie vor dem Setzen (sie stehen vorne). */
const ohneVariablen = (stil: string, namen: readonly string[]) =>
	stil
		.split(';')
		.filter((t) => !namen.includes(t.slice(0, t.indexOf(':')).trim()))
		.join(';');

/** Die Werte am `body` weg: Attribute und, je nach `namen`, Variablen im `style`. */
const ohneWerte = (quelle: string, namen: readonly string[] = VARIABLEN) => {
	const z = zerlege(quelle);
	const body = bodyIn(z);
	if (!body) {
		return quelle;
	}
	const aenderungen = ATTRIBUTE.flatMap((name) => setzeAttribut(z, body, name, null));
	const stil = attribut(body, 'style')?.wert;
	if (stil !== undefined && stil !== null) {
		const rest = ohneVariablen(stil, namen);
		if (rest !== stil) {
			aenderungen.push(...setzeAttribut(z, body, 'style', rest === '' ? null : rest));
		}
	}
	return aenderungen.length ? wendeAn(quelle, aenderungen) : quelle;
};

const px = (n: number | undefined) => (n === undefined ? null : `${Math.round(n)}px`);

const setzeWerte = (quelle: string, a: Aufmachung, w: AufmachungWerte, format: AufmachungsFormat, band: Kopfband) => {
	const ohne = ohneWerte(quelle);
	const z = zerlege(ohne);
	const body = bodyIn(z);
	if (!body) {
		throw new Error('Das Material hat kein <body>.');
	}
	const welt = farbwelt(a, w);
	const masse = a.formate[format].kopfband ?? {};
	const variablen: [string, string | null][] = [
		['--a1', welt.a1],
		['--a2', welt.a2],
		['--a3', welt.a3],
		['--a4', welt.a4],
		['--a-flaeche', welt.aFlaeche],
		['--a-titel', band === 'ohne' ? welt.aTitelOhneBand : welt.aTitel],
		['--a-muster', welt.aMuster],
		['--kopfband-unten', band === 'ohne' ? null : px(masse.unten)],
		['--kopfband-kante', band === 'ohne' ? null : px(masse.kante)],
		['--kopfband-welle', band === 'ohne' ? null : px(masse.welle)],
	];
	const neu = variablen.flatMap(([n, v]) => (v === null ? [] : [`${n}:${v}`])).join(';');
	const werte: [string, string | null][] = [
		['data-aufmachung', a.id],
		['data-aufmachung-farben', String(w.farben)],
		['data-aufmachung-kopfband', band === 'ohne' ? null : band],
		['data-aufmachung-rahmen', w.rahmen],
		['data-aufmachung-konfetti', [String(w.konfetti.menge), ...w.konfetti.formen].join(' ')],
		['data-aufmachung-saat', String(w.saat)],
	];
	const text = werte.map(([n, v]) => (v === null ? '' : ` ${n}="${schuetzeAttribut(v)}"`)).join('');
	const stil = attribut(body, 'style')?.wert;
	// Die Variablen kommen vor den bisherigen `style`, so stellt `ohneVariablen` ihn Zeichen für Zeichen wieder her.
	const aenderungen: Aenderung[] =
		stil === undefined || stil === null || stil === ''
			? [amEnde(z, body, `${text} style="${neu}"`), ...setzeAttribut(z, body, 'style', null)]
			: [amEnde(z, body, text), ...setzeAttribut(z, body, 'style', `${neu};${stil}`)];
	return wendeAn(ohne, aenderungen);
};

const farbwelt = (a: Aufmachung, w: Pick<AufmachungWerte, 'farben'>): Farbwelt => a.farbwelten[w.farben - 1] ?? a.farbwelten[0];

// ── Teile ───────────────────────────────────────────────────────────────────

/** Enthält die Ebene nichts außer `kinder` (und Leerraum)? */
const nurDiese = (z: Zerlegung, ebene: Knoten, kinder: readonly Knoten[]) =>
	ebene.kinder.every((k) => kinder.includes(k)) &&
	ebene.kinder.reduce((text, k) => text.replace(quelleVon(z, k), ''), innenVon(z, ebene)).trim() === '';

/**
 * Entfernt alle Teile. Eine Ebene, in der nur Teile lagen, verschwindet mit ihnen; eine Ebene mit anderem Inhalt
 * bleibt. So kommt die Quelle Zeichen für Zeichen zurück, wie sie vor dem Rezept war.
 */
const ohneTeile = (quelle: string) => {
	if (!quelle.includes(TEIL)) {
		return quelle;
	}
	const z = zerlege(quelle);
	const teile = alleTeile(z).filter((k) => !k.eltern || !istTeil(k.eltern));
	const ebenen = new Set(teile.map((k) => k.eltern).filter((e): e is Knoten => istEbene(e)));
	const ganz = [...ebenen].filter((e) => nurDiese(z, e, e.kinder.filter(istTeil)));
	const aenderungen = [
		...ganz.flatMap((e) => entferne(z, e)),
		...teile.filter((k) => !ganz.includes(k.eltern as Knoten)).flatMap((k) => entferne(z, k)),
	];
	return wendeAn(quelle, aenderungen);
};

const flaecheHtml = (f: NonNullable<ReturnType<Aufmachung['formate'][AufmachungsFormat]['flaeche']>>) =>
	f.art === 'farbe'
		? `<div class="seitenflaeche" ${TEIL}="flaeche" ${GESPERRT} data-flaeche="farbe" style="--f1:${f.f1}"></div>`
		: `<div class="seitenflaeche" ${TEIL}="flaeche" ${GESPERRT} data-flaeche="muster" data-muster="${f.muster}"` +
			` style="--f1:${f.f1};--f2:${f.f2};--muster-groesse:${Math.round(f.musterGroesse)}px"></div>`;

const rahmenHtml = (art: string, r: Aufmachung['formate'][AufmachungsFormat]['rahmen']) =>
	`<div class="seitenrahmen" ${TEIL}="rahmen" ${GESPERRT} data-rahmen="${art}"` +
	` style="--rahmen-farbe:${r.farbe};--rahmen-staerke:${Math.round(r.staerke)}px;` +
	`--rahmen-abstand:${Math.round(r.abstand)}px;--rahmen-ecke:${Math.round(r.ecke)}px"></div>`;

/** Die Streuung einer Zone; `null`, wenn der Regler „Konfetti“ sie abschaltet. */
const streuungTeil = (zone: StreuZone, w: AufmachungWerte, standard: Regler, saat: number) => {
	if (w.konfetti.menge <= 0 || zone.rechtecke.length === 0) {
		return null;
	}
	const bezug = standard.konfetti.menge > 0 ? standard.konfetti.menge : 1;
	const dichte = menge((zone.dichte * w.konfetti.menge) / bezug);
	const gewaehlt = zone.formen.filter((f) => (w.konfetti.formen as readonly string[]).includes(f));
	// Passt keine Form der Zone zum Regler, nimmt die Zone die Formen des Reglers.
	const formen = gewaehlt.length ? gewaehlt : w.konfetti.formen.length ? w.konfetti.formen : zone.formen;
	if (dichte <= 0) {
		return null;
	}
	const x = Math.min(...zone.rechtecke.map((r) => r.x));
	const y = Math.min(...zone.rechtecke.map((r) => r.y));
	const b = Math.max(...zone.rechtecke.map((r) => r.x + r.b)) - x;
	const h = Math.max(...zone.rechtecke.map((r) => r.y + r.h)) - y;
	const html = streuungHtml({
		art: zone.art,
		saat,
		b,
		h,
		dichte,
		formen,
		farben: zone.farben ?? ['a1', 'a2', 'a3', 'a4'],
		...(zone.groesse ? { groesse: zone.groesse } : {}),
		...(zone.ecke ? { ecke: zone.ecke } : {}),
		...(zone.rechtecke.length > 1
			? { zonen: zone.rechtecke.map((r) => ({ x: r.x - x, y: r.y - y, b: r.b, h: r.h })) }
			: {}),
	});
	const kopf = '<svg class="streuung" data-lage="frei"';
	const groesse = `style="--b:${Math.round(b)}px;--h:${Math.round(h)}px"`;
	if (!html.startsWith(kopf) || !html.includes(groesse)) {
		throw new Error('Unerwartetes Format der Streuung.');
	}
	const lage = stilMitLage(`--b:${Math.round(b)}px;--h:${Math.round(h)}px`, { x, y }) ?? '';
	return `<svg class="streuung" ${TEIL}="streuung" ${GESPERRT} data-lage="frei"${html
		.slice(kopf.length)
		.replace(groesse, `style="${lage}"`)}`;
};

interface SeitenPlan {
	/** Eigene Fläche bzw. eigener Rahmen, die das Rezept beim ersten Anwenden ersetzt. */
	ersetzt: Knoten[];
	html: string[];
}

const planFuer = (
	z: Zerlegung,
	seite: Knoten,
	index: number,
	a: Aufmachung,
	w: AufmachungWerte,
	format: AufmachungsFormat,
	ersetze: boolean,
): SeitenPlan => {
	const daten = a.formate[format];
	const deckblatt = index === 0 && !nachfahren(seite).some((k) => hat(k, 'aufgabe'));
	const ersetzt: Knoten[] = [];
	const html: string[] = [];
	const flaeche = daten.flaeche(deckblatt);
	const eigeneFlaeche = eigenesIn(seite, 'seitenflaeche');
	if (flaeche && (!eigeneFlaeche || ersetze)) {
		html.push(flaecheHtml(flaeche));
		if (eigeneFlaeche) {
			ersetzt.push(eigeneFlaeche);
		}
	}
	const eigenerRahmen = eigenesIn(seite, 'seitenrahmen');
	if (w.rahmen !== 'ohne' && (!eigenerRahmen || ersetze)) {
		html.push(rahmenHtml(w.rahmen, daten.rahmen));
		if (eigenerRahmen) {
			ersetzt.push(eigenerRahmen);
		}
	}
	daten.zonen(deckblatt).forEach((zone, i) => {
		// Saat je Seite: Saat + Seitennummer; weitere Zonen derselben Seite versetzt.
		const teil = streuungTeil(zone, w, a.standard, saatAus(w.saat + index + 1 + i * 1000));
		if (teil) {
			html.push(teil);
		}
	});
	return { ersetzt, html };
};

/** Legt die Teile zuunterst in `.ebene.hinten`, über eine eigene Fläche und einen eigenen Rahmen. */
const legeTeile = (z: Zerlegung, seite: Knoten, html: readonly string[]): Aenderung[] => {
	const ebene = hintenIn(seite);
	if (ebene) {
		const eigene = ebene.kinder.filter((k) => (hat(k, 'seitenflaeche') || hat(k, 'seitenrahmen')) && !istTeil(k));
		const ziel = eigene.at(-1) ?? ebene.kinder[0];
		if (!ziel) {
			return [{ von: ebene.oeffnerEnde, bis: ebene.oeffnerEnde, text: html.join('') }];
		}
		const einzug = einrueckung(z, ziel);
		return fuegeEin(z, ziel, eigene.length ? 'nach' : 'vor', html.join(einzug === null ? '' : `\n${einzug}`));
	}
	const vorne = seite.kinder.find((k) => istEbene(k) && hat(k, 'vorne'));
	const ziel = vorne ?? seite.kinder.at(-1);
	const huelle = '<div class="ebene hinten">';
	if (!ziel) {
		return [{ von: seite.schliesserStart, bis: seite.schliesserStart, text: `${huelle}${html.join('')}</div>` }];
	}
	const aussen = einrueckung(z, ziel);
	if (aussen === null) {
		return fuegeEin(z, ziel, vorne ? 'vor' : 'nach', `${huelle}${html.join('')}</div>`);
	}
	const innen = `${aussen}${EINZUG}`;
	const block = `${huelle}\n${innen}${html.map((h) => rueckeUm(h, null, innen)).join(`\n${innen}`)}\n${aussen}</div>`;
	return fuegeEin(z, ziel, vorne ? 'vor' : 'nach', block);
};

/** Erzeugt die Teile auf jeder Seite, von hinten nach vorne, damit die Stellen davor gültig bleiben. */
const erzeugeTeile = (quelle: string, a: Aufmachung, w: AufmachungWerte, format: AufmachungsFormat, ersetze: boolean) => {
	const anzahl = seitenIn(zerlege(quelle)).length;
	let q = quelle;
	for (let i = anzahl - 1; i >= 0; i -= 1) {
		let z = zerlege(q);
		let seite = seitenIn(z)[i];
		if (!seite) {
			continue;
		}
		const plan = planFuer(z, seite, i, a, w, format, ersetze);
		if (plan.ersetzt.length) {
			// War die Ebene danach leer, geht sie mit: Die Teile legen sie neu an, wie beim nächsten Anwenden.
			const ebene = hintenIn(seite);
			const leer = ebene && nurDiese(z, ebene, plan.ersetzt);
			q = wendeAn(q, leer ? entferne(z, ebene) : plan.ersetzt.flatMap((k) => entferne(z, k)));
			z = zerlege(q);
			seite = seitenIn(z)[i];
		}
		if (seite && plan.html.length) {
			q = wendeAn(q, legeTeile(z, seite, plan.html));
		}
	}
	return q;
};

// ── Anwenden, Würfeln, Entfernen ────────────────────────────────────────────

/** Was `wendeAufmachungAn` an Werten nimmt; fehlende nehmen die Standards des Rezepts. */
export type AufmachungEingabe = Partial<Omit<AufmachungWerte, 'id'>>;

const vollstaendig = (a: Aufmachung, werte: AufmachungEingabe): AufmachungWerte => {
	const k = werte.konfetti ?? a.standard.konfetti;
	return {
		id: a.id,
		farben: auswahl([1, 2, 3] as const, werte.farben) ?? a.standard.farben,
		kopfband: auswahl(KOPFBAENDER, werte.kopfband) ?? a.standard.kopfband,
		rahmen: auswahl(AUFMACHUNG_RAHMEN, werte.rahmen) ?? a.standard.rahmen,
		konfetti: { menge: menge(k.menge), formen: formenAus(k.formen) },
		saat: werte.saat === undefined ? STANDARD_SAAT : saatAus(werte.saat),
	};
};

/**
 * Wendet das Rezept `id` auf das ganze Material an (7-rezepte.md, „Wie ein Rezept wirkt“): Werte am `body` setzen,
 * alle Teile entfernen, Teile je Seite neu erzeugen. Kopfband und Titelfarbe folgen aus `blatt.css`. Zweimal mit
 * denselben Werten ergibt dieselbe Zeichenkette. Im Minibuch und bei unbekanntem Rezept ein Fehler.
 */
export const wendeAufmachungAn = (quelle: string, id: string, werte: AufmachungEingabe = {}) => {
	const a = aufmachungVon(id);
	if (!a) {
		throw new Error(`Das Rezept „${id}“ gibt es nicht.`);
	}
	const format = formatVon(quelle);
	if (!format) {
		throw new Error('Im Minibuch gibt es keine Rezepte, die Seiten sind zu klein.');
	}
	const w = vollstaendig(a, werte);
	// Beim ersten Anwenden ersetzt das Rezept eigene Fläche und eigenen Rahmen; danach bleiben sie.
	const ersetze = leseAufmachung(quelle) === null;
	const band: Kopfband = hatThemaKopf(quelle) ? 'ohne' : w.kopfband;
	const mitWerten = setzeWerte(ohneTeile(quelle), a, { ...w, kopfband: band }, format, band);
	return erzeugeTeile(mitWerten, a, w, format, ersetze);
};

/** Neue Saat, also neue Streuungen; alle anderen Werte bleiben. Ohne Rezept unverändert. */
export const wuerfleAufmachung = (quelle: string, saat: number) => {
	const w = leseAufmachung(quelle);
	return w && aufmachungVon(w.id) ? wendeAufmachungAn(quelle, w.id, { ...w, saat }) : quelle;
};

/** Werte am `body` und alle Teile weg; das Blatt sieht aus wie vor dem Rezept, bis auf eine ersetzte eigene Fläche. */
export const entferneAufmachung = (quelle: string) => ohneWerte(ohneTeile(quelle));

/**
 * Nach neuen Seiten (`fuegeSeiteEin`) und einem Formatwechsel (`setzeBlatt`): die Teile mit den Werten am `body` neu
 * erzeugen. Ohne Rezept unverändert; im Minibuch fällt das Rezept weg (4.8).
 */
export const zieheAufmachungNach = (quelle: string) => {
	const w = leseAufmachung(quelle);
	if (!w || !aufmachungVon(w.id)) {
		return quelle;
	}
	return formatVon(quelle) ? wendeAufmachungAn(quelle, w.id, w) : entferneAufmachung(quelle);
};

/**
 * Nach einem Vorschlag von Claude (123): die Teile aus den Werten am `body` neu erzeugen. So passen Teile und Werte
 * wieder zusammen, auch wenn Claude nur einen Wert geändert oder ein Teil von Hand angefasst hat. Ohne Rezept, mit
 * unbekanntem Rezept (Claude hat eines erfunden) und im Minibuch bleibt die Quelle unverändert.
 */
export const gleicheAufmachungAb = (quelle: string) => {
	const w = leseAufmachung(quelle);
	if (!w || !aufmachungVon(w.id) || !formatVon(quelle)) {
		return quelle;
	}
	return wendeAufmachungAn(quelle, w.id, w);
};

// ── Freilegen ───────────────────────────────────────────────────────────────

/** Das Kopfband einer Seite, wie der Editor es misst: Rechteck in px der Seite und Umriss als SVG-Pfad darin. */
export interface KopfbandMass {
	/** Nummer der `.seite` in der Quelle. */
	seite: number;
	x: number;
	y: number;
	b: number;
	h: number;
	/** `d` des Umrisses in px des Rechtecks. */
	d: string;
}

const PFAD = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;

// Freilegen: Farben einfrieren, Titel in s/w, Kopfband als Pfad mit derselben Kante wie die Maske

/** Die Variablen der Farbwelt als `style`-Text, damit ein freigelegtes Teil ohne Rezept am `body` gleich bleibt. */
const eingefroren = (welt: Farbwelt) =>
	[
		['--a1', welt.a1],
		['--a2', welt.a2],
		['--a3', welt.a3],
		['--a4', welt.a4],
		['--a-flaeche', welt.aFlaeche],
		['--a-muster', welt.aMuster],
	]
		.map(([n, v]) => `${n}:${v}`)
		.join(';');

/** Hell genug, dass der Titel in s/w auf weißem Papier verschwände (Weiß auf dem Band). */
const istHell = (hex: string) => {
	const m = /^#([0-9a-f]{6})$/i.exec(hex);
	if (!m?.[1]) {
		return false;
	}
	const n = Number.parseInt(m[1], 16);
	const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
	return 0.299 * r + 0.587 * g + 0.114 * b > 186;
};

/**
 * Die Kanten des Kopfbands, wie sie als Maske in `blatt.css` stehen (Kachel `b` × `h`, Pfad `d`). Ein Test prüft, dass
 * `blatt.css` dieselben Zahlen enthält.
 */
export const KOPFBAND_MASKEN = {
	welle: { b: 120, h: 24, d: 'M0 0H120V12C100 0 80 0 60 12S20 24 0 12Z' },
	bogen: { b: 100, h: 24, d: 'M0 0H100V0Q50 48 0 0Z' },
	zacken: { b: 32, h: 24, d: 'M0 0H32L16 24Z' },
} as const;

const zahl = (n: number) => String(Math.round(n * 10) / 10);

/**
 * Der Umriss des Kopfbands in px eines Rechtecks `b` × `h`, wie die Maske in `blatt.css`: oben voll, unten die Kante
 * der Höhe `kante`, Wellen bzw. Zacken der Breite `welle` (Zacken: 1,4 × `kante`) ab links wiederholt. Was rechts über
 * `b` hinausgeht, schneidet die `viewBox` ab.
 */
export const kopfbandPfad = (form: Exclude<Kopfband, 'ohne'>, b: number, h: number, kante: number, welle: number) => {
	const yk = h - kante;
	const sy = kante / 24;
	if (form === 'gerade' || kante <= 0) {
		return `M0 0H${zahl(b)}V${zahl(h)}H0Z`;
	}
	if (form === 'bogen') {
		return `M0 0H${zahl(b)}V${zahl(yk)}Q${zahl(b / 2)} ${zahl(yk + 48 * sy)} 0 ${zahl(yk)}Z`;
	}
	const kachel = form === 'zacken' ? kante * 1.4 : welle;
	const n = Math.max(1, Math.ceil(b / kachel));
	const sx = kachel / KOPFBAND_MASKEN[form].b;
	const teile: string[] = [];
	for (let i = n - 1; i >= 0; i--) {
		const x0 = i * kachel;
		const x = (v: number) => zahl(x0 + v * sx);
		const y = (v: number) => zahl(yk + v * sy);
		teile.push(
			form === 'welle'
				? `C${x(100)} ${y(0)} ${x(80)} ${y(0)} ${x(60)} ${y(12)}C${x(40)} ${y(24)} ${x(20)} ${y(24)} ${x(0)} ${y(12)}`
				: `L${x(16)} ${y(24)}L${x(0)} ${y(0)}`,
		);
	}
	const start = form === 'welle' ? yk + 12 * sy : yk;
	return `M0 0H${zahl(n * kachel)}V${zahl(start)}${teile.join('')}Z`;
};

const kopfbandHtml = (id: string, { b, d, h }: KopfbandMass, welt: Farbwelt | null) =>
	`<svg class="form" data-form="pfad" data-name="Kopfband" data-sw="weg" viewBox="0 0 ${Math.round(b)} ${Math.round(h)}"` +
	`${welt ? ` style="${eingefroren(welt)}"` : ''}>` +
	`<defs><linearGradient id="${id}"><stop offset="0" style="stop-color:var(--a1)"/>` +
	`<stop offset="1" style="stop-color:var(--a2)"/></linearGradient></defs>` +
	`<path d="${d.trim()}" fill="url(#${id})" style="stroke:none"/></svg>`;

/** Der Titel im Kopf einer Seite: das erste `h1` in `.kopf`. */
const titelIn = (seite: Knoten) =>
	nachfahren(seite)
		.filter((k) => hat(k, 'kopf'))
		.flatMap((k) => nachfahren(k))
		.find((k) => k.tag === 'h1');

/**
 * Macht aus dem Rezept normale Gestaltung (7-rezepte.md, Freilegen): Teile ohne `data-aufmachung-teil` und ohne
 * Sperre, die Werte am `body` weg; 119: jedes Teil trägt die Farben `--a1` … selbst im `style`, ein heller Titel
 * bekommt `data-sw="dunkel"`. Der Titel bekommt seine Farbe als `style`. Das Kopfband misst der Editor (`kopfbaender`) und es kommt als Form ganz oben
 * in `.ebene.hinten`; ohne Maße entfällt es auf der Seite.
 */
export const legeAufmachungFrei = (quelle: string, kopfbaender: readonly KopfbandMass[] = []) => {
	const w = leseAufmachung(quelle);
	if (!w) {
		return quelle;
	}
	const a = aufmachungVon(w.id);
	const welt = a ? farbwelt(a, w) : null;
	const z = zerlege(quelle);
	const aenderungen: Aenderung[] = alleTeile(z).flatMap((k) => {
		// 119: Die Farben ziehen ins Teil; ein späteres Rezept am `body` färbt es nicht mehr um.
		const stil = attribut(k, 'style')?.wert;
		const farben = welt ? eingefroren(welt) : '';
		return [
			...setzeAttribut(z, k, TEIL, null),
			...setzeAttribut(z, k, GESPERRT, null),
			...(farben ? setzeAttribut(z, k, 'style', stil ? `${farben};${stil}` : farben) : []),
		];
	});
	if (welt) {
		const mitBand = new Set(kopfbaender.map((k) => k.seite));
		for (const seite of seitenIn(z)) {
			const titel = titelIn(seite);
			if (!titel) {
				continue;
			}
			const farbe = w.kopfband !== 'ohne' && mitBand.has(seite.nr) ? welt.aTitel : welt.aTitelOhneBand;
			const stil = attribut(titel, 'style')?.wert;
			// 119: Ein heller Titel (Weiß auf dem Band) wird in s/w dunkel, sonst stünde er weiß auf weißem Papier.
			const sw = istHell(farbe) && !attribut(titel, 'data-sw') ? ' data-sw="dunkel"' : '';
			aenderungen.push(
				...(stil
					? [...setzeAttribut(z, titel, 'style', `${stil.replace(/;\s*$/, '')};color:${farbe}`), ...(sw ? [amEnde(z, titel, sw)] : [])]
					: [amEnde(z, titel, ` style="color:${farbe}"${sw}`)]),
			);
		}
	}
	// 119: Alle Werte am `body` weg; die Teile tragen ihre Farben selbst.
	let q = ohneWerte(wendeAn(quelle, aenderungen), welt ? VARIABLEN : BAND_VARIABLEN);
	if (w.kopfband === 'ohne') {
		return q;
	}
	for (const band of [...kopfbaender].sort((x, y) => y.seite - x.seite)) {
		if (!PFAD.test(band.d) || !(band.b > 0) || !(band.h > 0)) {
			throw new Error('Das Kopfband hat keinen gültigen Umriss.');
		}
		const html = kopfbandHtml(neueId('verlauf', q), band, welt);
		const lage = { x: band.x, y: band.y, b: band.b, h: band.h };
		q = legeGestaltungAb(q, { seite: band.seite, ebene: 'hinten', html, lage }).quelle;
	}
	return q;
};
