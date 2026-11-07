/**
 * Schmuckschrift (105, Briefing 3.4 und schubladen/5-text.md): Titel, Stempel und Etikett liegen frei wie eine Form
 * (`div.schmuck[data-lage="frei"]`) und stehen nicht in der Lösung. Inhalt (Überschrift, Absatz …) bleibt Baustein.
 * Aussehen über Variablen im `style`: `--gr` Größe, `--farbe` Schriftfarbe, `--hg` Hintergrund (Etikett), `--schrift`
 * (Fredoka oder Andika) und `--ausrichtung`. Alles hier sind reine Umformungen der Quelle.
 */

import type { LageTeil } from './gestaltung';
import { leseLage, legeGestaltungAb, loescheGestaltung, setzeStilWerte } from './gestaltung';
import type { Verlauf } from './quelltext';
import { attribut, innenVon, klassenVon, rueckwaerts, schuetzeText, unterschied, zerlege } from './quelltext';
import type { StrukturErgebnis } from './struktur';

export type SchmuckArt = 'titel' | 'stempel' | 'etikett';

/**
 * Die Arten mit Platzhaltertext und Standardgröße in px. Kein Standard liegt unter der Grenze der Prüfung
 * `schrift-klein` (`standardGroesse`).
 */
export const SCHMUCK_ARTEN: Readonly<Record<SchmuckArt, { name: string; text: string; gr: number }>> = {
	titel: { name: 'Titel', text: 'Titel', gr: 56 },
	stempel: { name: 'Stempel', text: 'Prima!', gr: 28 },
	etikett: { name: 'Etikett', text: '13 Fälle', gr: 18 },
};

export const istSchmuckArt = (art: string | null | undefined): art is SchmuckArt =>
	art !== null && art !== undefined && Object.hasOwn(SCHMUCK_ARTEN, art);

/** Nur die Schriften, die `blatt.css` einbettet (Entscheidung 29). Die erste ist der Standard und steht nie im `style`. */
export const SCHRIFTEN = ['Fredoka', 'Andika'] as const;
export type Schrift = (typeof SCHRIFTEN)[number];

export const GROESSE_MIN = 12;
export const GROESSE_MAX = 160;

export type Ausrichtung = 'links' | 'mitte' | 'rechts';
/** Links ist der Standard und steht nie im `style`. */
const AUSRICHTUNG_CSS: Record<Ausrichtung, string> = { links: 'left', mitte: 'center', rechts: 'right' };

/** Die Standardgröße der Art, nie unter der Grenze von `schrift-klein` (`0.8 × --fs`, gerundet wie in `pruefung.js`). */
export const standardGroesse = (art: SchmuckArt, fs?: number) =>
	Math.max(SCHMUCK_ARTEN[art].gr, fs && Number.isFinite(fs) ? Math.round(fs * 0.8) : 0);

/** Farben des Blatts als Variable oder Hex; alles andere (Namen, `rgb()`, `url()`) nicht. */
const FARBE = /^(var\(--(haupt|akzent|dunkel|linie|fuell|text|strich)\)|#[0-9a-f]{3}|#[0-9a-f]{6})$/i;
export const istFarbe = (wert: string) => FARBE.test(wert.trim());

const px = (wert: number) => `${Math.round(wert)}px`;

/** Größe in ihren Bereich gebracht, ganze px. */
export const groesseIm = (wert: number) => Math.min(GROESSE_MAX, Math.max(GROESSE_MIN, Math.round(wert)));

export interface SchmuckNeu {
	art: SchmuckArt;
	/** Ohne Angabe der Platzhalter der Art. Wird geschützt, HTML darin bleibt Text. */
	text?: string;
	/** `--fs` des Blatts, damit die Standardgröße nicht unter `schrift-klein` fällt. */
	fs?: number;
	gr?: number;
}

/** Das Element ohne Lage; `legeGestaltungAb` setzt `--x`, `--y` (und `--b`) davor. Der Stempel steht leicht schräg. */
export const schmuckHtml = ({ art, fs, gr, text }: SchmuckNeu) => {
	const stil = [
		...(art === 'stempel' ? ['--drehen:-8deg'] : []),
		`--gr:${px(groesseIm(gr ?? standardGroesse(art, fs)))}`,
	].join(';');
	const inhalt = schuetzeText(text ?? SCHMUCK_ARTEN[art].text);
	return `<div class="schmuck" data-lage="frei" data-schmuck="${art}" style="${stil}">${inhalt}</div>`;
};

export interface SchmuckAblegen extends SchmuckNeu {
	/** Nummer der `.seite` in der Quelle. */
	seite: number;
	/** Mit `b` bricht der Text um, ohne ist die Schmuckschrift so breit wie ihr Text. */
	lage?: LageTeil;
}

/** Legt Schmuckschrift ganz nach vorne in die Ebene `vorne`. Ein Schritt, danach ist sie gewählt. */
export const legeSchmuck = (quelle: string, { lage, seite, ...neu }: SchmuckAblegen): StrukturErgebnis =>
	legeGestaltungAb(quelle, { seite, html: schmuckHtml(neu), ...(lage ? { lage } : {}) });

const schmuckAn = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k || (!klassenVon(k).includes('schmuck') && !klassenVon(k).includes('form-text'))) {
		throw new Error(`Das Element ${nr} ist keine Schmuckschrift.`);
	}
	return { z, k };
};

/** Was `setzeSchmuck` ändert: ein Wert setzt, `null` nimmt ihn heraus (dann gilt der Standard), ohne Angabe bleibt er. */
export interface SchmuckTeil {
	gr?: number;
	farbe?: string | null;
	/** Hintergrund, nur beim Etikett sichtbar. */
	hg?: string | null;
	schrift?: Schrift | null;
	ausrichtung?: Ausrichtung | null;
}

/**
 * Setzt Größe, Farben, Schrift und Ausrichtung. Gilt auch für Form mit Text (`.form-text`, 107), die dieselben
 * Variablen liest. Unbekannte Farben und Schriften wirft die Funktion ab, statt sie zu schreiben.
 */
export const setzeSchmuck = (quelle: string, nr: number, teil: SchmuckTeil) => {
	schmuckAn(quelle, nr);
	const werte: Record<string, string | null> = {};
	if (teil.gr !== undefined) {
		werte['--gr'] = px(groesseIm(teil.gr));
	}
	for (const [name, wert] of [
		['--farbe', teil.farbe],
		['--hg', teil.hg],
	] as const) {
		if (wert === undefined) {
			continue;
		}
		if (wert !== null && !istFarbe(wert)) {
			throw new Error(`„${wert}“ ist keine Farbe des Blatts.`);
		}
		werte[name] = wert === null ? null : wert.trim();
	}
	if (teil.schrift !== undefined) {
		if (teil.schrift !== null && !SCHRIFTEN.includes(teil.schrift)) {
			throw new Error(`Die Schrift „${String(teil.schrift)}“ ist nicht eingebettet.`);
		}
		werte['--schrift'] = teil.schrift === null || teil.schrift === SCHRIFTEN[0] ? null : teil.schrift;
	}
	if (teil.ausrichtung !== undefined) {
		werte['--ausrichtung'] =
			teil.ausrichtung === null || teil.ausrichtung === 'links' ? null : AUSRICHTUNG_CSS[teil.ausrichtung];
	}
	return Object.keys(werte).length ? setzeStilWerte(quelle, nr, werte) : quelle;
};

export interface SchmuckStand {
	/** `null` bei Form mit Text. */
	art: SchmuckArt | null;
	gr: number | null;
	farbe: string | null;
	hg: string | null;
	schrift: Schrift;
	ausrichtung: Ausrichtung;
	/** `--b` steht im `style`: Der Text bricht um. */
	breite: number | null;
}

const stilWert = (stil: string, name: string) => {
	for (const teil of stil.split(';')) {
		const i = teil.indexOf(':');
		if (i > 0 && teil.slice(0, i).trim() === name) {
			return teil.slice(i + 1).trim();
		}
	}
	return null;
};

/** Liest, was `setzeSchmuck` schreibt; `null`, wenn das Element keine Schmuckschrift ist. */
export const leseSchmuck = (quelle: string, nr: number): SchmuckStand | null => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k || (!klassenVon(k).includes('schmuck') && !klassenVon(k).includes('form-text')) || k.tag === 'svg') {
		return null;
	}
	const stil = attribut(k, 'style')?.wert ?? '';
	const art = attribut(k, 'data-schmuck')?.wert ?? null;
	const schrift = stilWert(stil, '--schrift');
	const ausrichtung = stilWert(stil, '--ausrichtung');
	const gr = parseFloat(stilWert(stil, '--gr') ?? '');
	return {
		art: istSchmuckArt(art) ? art : null,
		gr: Number.isFinite(gr) ? gr : null,
		farbe: stilWert(stil, '--farbe'),
		hg: stilWert(stil, '--hg'),
		schrift: SCHRIFTEN.find((s) => s.toLowerCase() === schrift?.toLowerCase()) ?? SCHRIFTEN[0],
		ausrichtung:
			(Object.entries(AUSRICHTUNG_CSS) as [Ausrichtung, string][]).find(([, css]) => css === ausrichtung)?.[0] ??
			'links',
		breite: leseLage(quelle, nr).b ?? null,
	};
};

/** Kein sichtbares Zeichen: nur Leerraum, `<br>` und Kommentare. */
const ohneText = (html: string) =>
	html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;|&#160;| /g, ' ')
		.trim() === '';

/**
 * Leere Schmuckschrift gibt es nicht (Werkzeug T, 5.10): Ist der Text von `nr` leer, verschwindet das Element (mit
 * einer leer gewordenen Ebene). Jede andere Quelle kommt unverändert zurück.
 */
export const entferneLeereSchmuck = (quelle: string, nr: number): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k || k.tag !== 'div' || !klassenVon(k).includes('schmuck') || !ohneText(innenVon(z, k))) {
		return { quelle, nr };
	}
	return loescheGestaltung(quelle, nr);
};

/**
 * Anlegen und die erste Textsitzung sind **ein** Schritt (Entscheidung 36, 5.10): Der letzte Schritt im Verlauf (das
 * Anlegen) nimmt die Fassung nach der Sitzung mit auf und behält seinen Namen. Kommt dabei die Quelle von vor dem
 * Anlegen heraus (leerer Text, Element wieder weg), bleibt kein Schritt.
 */
export const fasseMitAnlegenZusammen = (v: Verlauf, neu: string, auswahl: number | null = null): Verlauf => {
	const anlegen = v.zurueck.at(-1);
	if (!anlegen) {
		const schritt = unterschied(v.quelle, neu, 'Text geändert');
		return schritt ? { quelle: neu, zurueck: [{ ...schritt, auswahlVorher: auswahl }], vor: [] } : v;
	}
	const vorher = rueckwaerts(v.quelle, anlegen);
	const schritt = unterschied(vorher, neu, anlegen.beschreibung);
	const frueher = v.zurueck.slice(0, -1);
	return {
		quelle: neu,
		zurueck: schritt ? [...frueher, { ...schritt, auswahlVorher: anlegen.auswahlVorher ?? null }] : frueher,
		vor: [],
	};
};
