import { hyphenateSync } from 'hyphen/de-1996';

import type { Knoten, Zerlegung } from './quelltext';
import { ersetzeInnen, innenVon, klassenVon, setzeAttribut, wendeAn, zerlege } from './quelltext';

/** Sprach-Werkzeuge (052): Sie erzeugen normale Bausteine, nichts Eigenes im Datenmodell. */
export type LueckenRegel = 'nte' | 'nomen' | 'vokale' | 'konsonanten' | 'ie-ei' | 'anfang';

interface SilbenWerkzeug {
	art: 'silben';
	darstellung: 'boegen' | 'farbe';
}
interface MarkierWerkzeug {
	art: 'markieren';
	buchstaben: string;
}
interface LueckenWerkzeug {
	art: 'luecken';
	regel: LueckenRegel;
	n?: number;
}
interface MischWerkzeug {
	art: 'woerter-mischen' | 'buchstaben-mischen';
}
export type SprachWerkzeug = SilbenWerkzeug | MarkierWerkzeug | LueckenWerkzeug | MischWerkzeug;

/** Zeichen im sichtbaren Text, mit zusammengefasstem Leerraum. */
export interface Bereich {
	von: number;
	bis: number;
}

export interface SprachErgebnis {
	quelle: string;
	nr: number;
	/** Wörter, deren Trennung ein Mensch ansehen sollte. */
	unsicher: string[];
}

const VOKAL = 'aeiouäöüyAEIOUÄÖÜY';
const istVokal = (z: string) => VOKAL.includes(z);
/** Laute aus zwei Vokalbuchstaben: Sie bleiben in einer Silbe. */
const EIN_LAUT = new Set(['au', 'äu', 'ei', 'eu', 'ai', 'ie', 'aa', 'ee', 'oo', 'oi', 'ui', 'ey', 'ay']);

/** Die Muster setzen am Wortanfang keine Grenze nach einem Buchstaben: A|bend, O|ma, E|le|fant. */
const mitAnfang = (getrennt: string) => {
	const [a, b, c] = getrennt;
	return a && b && c && istVokal(a) && !istVokal(b) && b !== '|' && istVokal(c)
		? `${a}|${getrennt.slice(1)}`
		: getrennt;
};

/** Ein Wort nach Sprechsilben, mit `|`. Verfahren: Trennmuster aus tex-hyphen (de-1996), Paket `hyphen`, ISC. */
export const silbenVon = (wort: string) => mitAnfang(hyphenateSync(wort, { hyphenChar: '|', minWordLength: 3 }));

/**
 * Regeln allein raten bei Fremdwörtern und Vokalfolgen: Enthält eine Silbe mehr als einen einzelnen Laut (Thea|ter,
 * neue), gilt die Trennung als unsicher und das Panel weist darauf hin.
 */
export const istUnsicher = (getrennt: string) =>
	getrennt.split('|').some((silbe) => {
		const folgen = silbe.toLowerCase().match(new RegExp(`[${VOKAL.toLowerCase()}]{2,}`, 'g')) ?? [];
		return folgen.some((f) => !EIN_LAUT.has(f));
	});

const WORT = /[\p{L}]+(?:-[\p{L}]+)*/gu;

const ENTITAETEN: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&nbsp;': ' ',
	'&shy;': '',
};
const entschluessele = (e: string) => {
	if (ENTITAETEN[e] !== undefined) {
		return ENTITAETEN[e];
	}
	const z = /^&#(x?)([0-9a-f]+);$/i.exec(e);
	return z?.[2] ? String.fromCodePoint(Number.parseInt(z[2], z[1] ? 16 : 10)) : e;
};
export const maskiere = (t: string) =>
	t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Zerlegt HTML in Tags und Zeichen. Der Leerraum ist zusammengefasst wie im Browser, die Zählung passt zur Auswahl. */
interface Stueck {
	roh: string;
	zeichen: string;
	tag: boolean;
}
const stueckeVon = (html: string) => {
	const stuecke: Stueck[] = [];
	let leer = true;
	for (const m of html.matchAll(/<[^>]*>|&[#\w]+;|\s+|[\s\S]/gu)) {
		const roh = m[0];
		if (roh.startsWith('<')) {
			stuecke.push({ roh, zeichen: '', tag: true });
			continue;
		}
		const istLeer = /^\s+$/.test(roh);
		const zeichen = roh.startsWith('&') ? entschluessele(roh) : (istLeer && ' ') || roh;
		const weg = zeichen === ' ' && leer;
		stuecke.push({ roh, zeichen: weg ? '' : zeichen, tag: false });
		leer = zeichen === ' ';
	}
	return stuecke;
};
export const reinerText = (html: string) =>
	stueckeVon(html)
		.map((s) => s.zeichen)
		.join('')
		.trimEnd();

/** Gleichmäßig, aber ohne Zufall: Dasselbe Wort sieht bei jedem Zeichnen gleich aus. */
const zahlVon = (t: string) => [...t].reduce((h, z) => (h * 31 + (z.codePointAt(0) ?? 0)) >>> 0, 7);
export const mischeBuchstaben = (wort: string) => {
	const z = [...wort];
	let h = zahlVon(wort);
	for (let i = z.length - 1; i > 0; i--) {
		h = (h * 1103515245 + 12345) >>> 0;
		const j = h % (i + 1);
		[z[i], z[j]] = [z[j] as string, z[i] as string];
	}
	if (z.join('') === wort && new Set(z).size > 1) {
		const i = z.findIndex((b) => b !== z[0]);
		[z[0], z[i]] = [z[i] as string, z[0] as string];
	}
	return z;
};

/** Silbentext; nur das Wort selbst wird getrennt, Satzzeichen bleiben. */
export const silbentext = (text: string) => {
	const unsicher: string[] = [];
	const inhalt = text.replace(WORT, (wort) => {
		const g = wort
			.split('-')
			.map((t) => silbenVon(t))
			.join('-');
		if (istUnsicher(g)) {
			unsicher.push(g);
		}
		return g;
	});
	return { inhalt, unsicher };
};

const SATZ_ENDE = /[.!?…]["“]?\s*$/;

const lueckeIm = (wort: string, regel: LueckenRegel) => {
	if (regel === 'anfang') {
		return `[${wort[0]}]${wort.slice(1)}`;
	}
	const MUSTER: Record<string, RegExp> = {
		'vokale': new RegExp(`[${VOKAL}]`, 'g'),
		'konsonanten': new RegExp(`[^${VOKAL}]`, 'g'),
		'ie-ei': /ie|ei/gi,
	};
	const muster = MUSTER[regel] ?? /$^/;
	return wort.replace(muster, (t) => `[${t}]`);
};

/** Lückentext aus Text. `von`/`bis`: nur Wörter darin bekommen Lücken. */
export const lueckenText = (text: string, regel: LueckenRegel, n = 5, bereich?: Bereich) => {
	if (regel === 'nte' && (!Number.isInteger(n) || n < 2)) {
		throw new Error('Wähle mindestens jedes zweite Wort.');
	}
	let zaehler = 0;
	let davor = '';
	let stelle = 0;
	const inhalt = text.replace(WORT, (wort, ort: number) => {
		davor += text.slice(stelle, ort);
		stelle = ort + wort.length;
		const satzanfang = davor.trim() === '' || SATZ_ENDE.test(davor);
		davor = wort;
		if (bereich && (ort < bereich.von || ort + wort.length > bereich.bis)) {
			return wort;
		}
		zaehler += 1;
		if (regel === 'nte') {
			return zaehler % n === 0 ? `[${wort}]` : wort;
		}
		if (regel === 'nomen') {
			// Nur der sichere Fall: groß geschrieben und nicht am Satzanfang.
			return !satzanfang && /^\p{Lu}/u.test(wort) ? `[${wort}]` : wort;
		}
		return lueckeIm(wort, regel);
	});
	if (!inhalt.includes('[')) {
		throw new Error('Nach dieser Regel gibt es in diesem Text keine Lücke.');
	}
	return inhalt;
};

const MAX_EINTRAEGE = 12;

/** Ein Satz als Einträge für `x-sortieren`; doppelte Wörter gehen mit dem nächsten zusammen, sonst gäbe es zwei Lösungen. */
const eintraegeVon = (satz: string) => {
	const woerter = satz.replace(/[;:]/g, ',').trim().split(/\s+/).filter(Boolean);
	const ergebnis: string[] = [];
	for (let i = 0; i < woerter.length; i++) {
		const w = woerter[i] as string;
		const doppelt = woerter.some((t, j) => j !== i && t === w);
		const danach = woerter[i + 1];
		if (doppelt && danach) {
			ergebnis.push(`${w} ${danach}`);
			i++;
		} else {
			ergebnis.push(w);
		}
	}
	return [...new Set(ergebnis)];
};

export const woerterMischen = (text: string) => {
	const saetze = text.match(/[^.!?…]+[.!?…]*["“]?/g)?.filter((s) => s.trim() !== '') ?? [];
	const einzeln = saetze.map((s) => eintraegeVon(s));
	if (einzeln.some((e) => e.length < 2)) {
		throw new Error('Zum Mischen braucht ein Satz mindestens zwei Wörter.');
	}
	if (einzeln.some((e) => e.length > MAX_EINTRAEGE)) {
		throw new Error(`Ein Satz hat mehr als ${MAX_EINTRAEGE} Wörter. Kürze ihn oder markiere einen kürzeren.`);
	}
	if (einzeln.length === 0) {
		throw new Error('Hier steht kein Satz zum Mischen.');
	}
	return einzeln
		.map((e) => `<x-sortieren art="woerter" eintraege="${maskiere(e.join('; '))}"></x-sortieren>`)
		.join('\n');
};

const MAX_MISCHWOERTER = 8;
export const buchstabenMischen = (text: string) => {
	const woerter = (text.match(WORT) ?? []).filter((w) => w.length > 1);
	if (woerter.length === 0) {
		throw new Error('Hier steht kein Wort zum Mischen.');
	}
	if (woerter.length > MAX_MISCHWOERTER) {
		throw new Error(`Das sind mehr als ${MAX_MISCHWOERTER} Wörter. Markiere nur die, die du üben willst.`);
	}
	return woerter.map((w) => `${mischeBuchstaben(w).join(' ')} → [${w}]`).join(' · ');
};

/** Markiert Buchstaben mit `<mark>`, Tags bleiben stehen; in s/w ist `mark` fett und unterstrichen (046). */
export const markiereBuchstaben = (html: string, buchstaben: string, bereich?: Bereich) => {
	const gesucht = buchstaben === 'vokale' ? null : buchstaben.toLowerCase();
	if (gesucht === '') {
		throw new Error('Gib die Buchstaben an, die du markieren willst.');
	}
	const stuecke = stueckeVon(html);
	const text = stuecke.map((s) => s.zeichen);
	const treffer = new Set<number>();
	let ort = 0;
	let offen = 0;
	const laenge = gesucht?.length ?? 1;
	stuecke.forEach((s, i) => {
		if (s.tag) {
			return;
		}
		if (!s.zeichen) {
			return;
		}
		const imBereich = !bereich || (ort >= bereich.von && ort + laenge <= bereich.bis);
		if (imBereich && i >= offen) {
			if (gesucht === null) {
				if (istVokal(s.zeichen)) {
					treffer.add(i);
				}
			} else {
				const folge: number[] = [];
				for (let j = i; j < stuecke.length && folge.length < laenge; j++) {
					if ((stuecke[j] as Stueck).tag) {
						break;
					}
					if (text[j]) {
						folge.push(j);
					}
				}
				if (
					folge
						.map((j) => text[j])
						.join('')
						.toLowerCase() === gesucht
				) {
					folge.forEach((j) => treffer.add(j));
					offen = (folge.at(-1) as number) + 1;
				}
			}
		}
		ort += s.zeichen.length;
	});
	if (treffer.size === 0) {
		throw new Error('Diese Buchstaben kommen hier nicht vor.');
	}
	let aus = '';
	let auf = false;
	stuecke.forEach((s, i) => {
		const soll = treffer.has(i);
		if (soll !== auf) {
			aus += soll ? '<mark>' : '</mark>';
			auf = soll;
		}
		aus += s.roh;
	});
	return auf ? `${aus}</mark>` : aus;
};

const BLOCK_ERSETZT = new Set(['p', 'div']);
const BLOCK_INNEN = new Set(['td', 'th', 'li']);

/** Ein Block (`x-lueckentext`, `x-sortieren`) statt des Textes: `p` wird ersetzt, Zellen und Listenpunkte behalten ihn. */
const setzeBlock = (z: Zerlegung, k: Knoten, davor: string, block: string, danach: string) => {
	if (BLOCK_INNEN.has(k.tag)) {
		return wendeAn(
			z.quelle,
			ersetzeInnen(z, k, [maskiere(davor), block, maskiere(danach)].filter(Boolean).join('\n')),
		);
	}
	if (!BLOCK_ERSETZT.has(k.tag)) {
		throw new Error('Das geht nur bei einem Absatz, einer Zelle oder einem Listenpunkt.');
	}
	const offen = z.quelle.slice(k.start, k.oeffnerEnde);
	const absatz = (t: string) => (t.trim() ? `${offen}${maskiere(t.trim())}</${k.tag}>` : '');
	return wendeAn(z.quelle, [
		{ von: k.start, bis: k.ende, text: [absatz(davor), block, absatz(danach)].filter(Boolean).join('\n') },
	]);
};

const WERKZEUG_TEXT_FEHLT = 'Hier steht kein Text.';

export const wendeSprachwerkzeugAn = (
	quelle: string,
	nr: number,
	werkzeug: SprachWerkzeug,
	bereich?: Bereich,
): SprachErgebnis => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k) {
		throw new Error('Dieser Text ist nicht mehr da.');
	}
	const innen = innenVon(z, k);
	if (/<x-/.test(innen) && werkzeug.art !== 'markieren') {
		throw new Error('In diesem Text steckt schon eine Abbildung. Markiere einen anderen Text.');
	}
	const text = reinerText(innen);
	if (text.trim() === '') {
		throw new Error(WERKZEUG_TEXT_FEHLT);
	}
	const gueltig = bereich && bereich.bis > bereich.von ? bereich : undefined;
	const von = gueltig?.von ?? 0;
	const bis = gueltig?.bis ?? text.length;
	const davor = text.slice(0, von);
	const mitte = text.slice(von, bis);
	const danach = text.slice(bis);
	const fertig = (neu: string, unsicher: string[] = []) => ({ quelle: neu, nr, unsicher });

	switch (werkzeug.art) {
		case 'markieren':
			return fertig(wendeAn(quelle, ersetzeInnen(z, k, markiereBuchstaben(innen, werkzeug.buchstaben, gueltig))));
		case 'silben': {
			const { inhalt, unsicher } = silbentext(mitte);
			const farbe = werkzeug.darstellung === 'farbe' ? ' darstellung="farbe"' : '';
			if (!gueltig || (davor.trim() === '' && danach.trim() === '')) {
				// Das Element bleibt: Sein Abstand und seine Zeilennummern gelten weiter.
				const element = `<x-silben${farbe}>${maskiere(inhalt.trim())}</x-silben>`;
				return fertig(wendeAn(quelle, ersetzeInnen(z, k, element)), unsicher);
			}
			const element = `<x-silben im-text${farbe}>${maskiere(inhalt)}</x-silben>`;
			return fertig(
				wendeAn(quelle, ersetzeInnen(z, k, `${maskiere(davor)}${element}${maskiere(danach)}`)),
				unsicher,
			);
		}
		case 'luecken': {
			const inhalt = lueckenText(text, werkzeug.regel, werkzeug.n, gueltig);
			return fertig(setzeBlock(z, k, '', `<x-lueckentext>${maskiere(inhalt)}</x-lueckentext>`, ''));
		}
		case 'woerter-mischen':
			return fertig(setzeBlock(z, k, davor, woerterMischen(mitte), danach));
		case 'buchstaben-mischen':
			return fertig(
				setzeBlock(z, k, davor, `<x-lueckentext>${maskiere(buchstabenMischen(mitte))}</x-lueckentext>`, danach),
			);
	}
};

/** Absätze eines Lesetexts: direkt auf der Seite, damit auch die nächsten Seiten dazugehören. */
const istLesetext = (k: Knoten) =>
	k.tag === 'p' && klassenVon(k).includes('text') && k.eltern !== null && klassenVon(k.eltern).includes('seite');

/** Zeilennummern: Der Browser zählt sie beim Zeichnen, deshalb stimmen sie bei jedem Umbruch. `null` nimmt sie weg. */
export const setzeZeilennummern = (quelle: string, nr: number, schritt: 1 | 5 | null) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k) {
		throw new Error('Dieser Text ist nicht mehr da.');
	}
	const ziele = istLesetext(k) ? z.knoten.filter(istLesetext) : [k];
	return {
		quelle: wendeAn(
			quelle,
			ziele.flatMap((t) => setzeAttribut(z, t, 'data-zeilennummern', schritt === null ? null : String(schritt))),
		),
		nr,
	};
};
