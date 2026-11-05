import { hyphenateSync } from 'hyphen/de-1996';

import type { Knoten, Zerlegung } from './quelltext';
import { ersetzeInnen, innenVon, klassenVon, setzeAttribut, wendeAn, zerlege } from './quelltext';
import type { SilbenDarstellung, Stelle } from './sprachstand';
import {
	beruehrt,
	decktAlles,
	hatFremdeAbbildung,
	istUmwandelbar,
	ohneMarken,
	stellenIn,
	textZielVon,
	VOKAL,
} from './sprachstand';
import type { Bereich, Stueck } from './textstuecke';
import {
	maskiere,
	offeneTags,
	reinerText,
	schliesser,
	SILBEN_AUF,
	SILBEN_ZU,
	stueckeVon,
	textVon,
} from './textstuecke';

export type { Sprachstand } from './sprachstand';
export { leseSprachstand } from './sprachstand';
export type { Bereich } from './textstuecke';
export { maskiere, reinerText } from './textstuecke';

/** Lesehilfen und Übungen aus Text (052, 083): Sie erzeugen normale Bausteine, nichts Eigenes im Datenmodell. */
export type LueckenRegel = 'nte' | 'nomen' | 'vokale' | 'konsonanten' | 'ie-ei' | 'anfang';

interface LueckenWerkzeug {
	art: 'luecken';
	regel: LueckenRegel;
	n?: number;
}
interface MischWerkzeug {
	art: 'woerter-mischen' | 'buchstaben-mischen';
}
export type SprachWerkzeug = LueckenWerkzeug | MischWerkzeug;

export interface SprachErgebnis {
	quelle: string;
	nr: number;
	/** Wörter, deren Trennung ein Mensch ansehen sollte. */
	unsicher: string[];
}

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

/** Getrennte Angabe wie „ie, ei“. */
const suchListe = (buchstaben: string) =>
	[
		...new Set(
			buchstaben
				.toLowerCase()
				.split(/[,;\s]+/)
				.filter(Boolean),
		),
	].sort((a, b) => b.length - a.length);

/** Welche Stücke zu den gesuchten Buchstaben gehören. Tags und Silbenstriche unterbrechen ein „ie“ nicht. */
const trefferIn = (stuecke: Stueck[], was: string, bereich?: Bereich) => {
	const sichtbar: { i: number; zeichen: string; ort: number }[] = [];
	let ort = 0;
	stuecke.forEach((s, i) => {
		if (s.zeichen) {
			sichtbar.push({ i, zeichen: s.zeichen, ort });
			ort += s.zeichen.length;
		}
	});
	const imBereich = (von: number, bis: number) => !bereich || (von >= bereich.von && bis <= bereich.bis);
	const treffer = new Set<number>();
	if (was === 'vokale') {
		for (const z of sichtbar) {
			if (VOKAL.includes(z.zeichen) && imBereich(z.ort, z.ort + 1)) {
				treffer.add(z.i);
			}
		}
		return treffer;
	}
	const liste = suchListe(was);
	if (liste.length === 0) {
		throw new Error('Gib die Buchstaben an, die du markieren willst.');
	}
	for (let a = 0; a < sichtbar.length;) {
		const passend = liste.find((g) => {
			const folge = sichtbar.slice(a, a + [...g].length);
			const letztes = folge.at(-1);
			return (
				letztes &&
				folge
					.map((f) => f.zeichen)
					.join('')
					.toLowerCase() === g &&
					imBereich(folge[0]?.ort ?? 0, letztes.ort + letztes.zeichen.length)
			);
		});
		if (passend) {
			sichtbar.slice(a, a + [...passend].length).forEach((f) => treffer.add(f.i));
			a += [...passend].length;
		} else {
			a += 1;
		}
	}
	return treffer;
};

/** Schreibt die Stücke mit `<mark>`. Tags beenden eine Marke, so bleibt die Schachtelung gültig. Ein Strich bleibt drin, wenn beide Seiten markiert sind. */
const mitMarken = (stuecke: Stueck[], markiert: ReadonlySet<number>) => {
	let aus = '';
	let auf = false;
	stuecke.forEach((s, i) => {
		const soll = s.strich ? markiert.has(i - 1) && markiert.has(i + 1) : markiert.has(i);
		if (soll !== auf) {
			aus += soll ? '<mark>' : '</mark>';
			auf = soll;
		}
		aus += s.roh;
	});
	return auf ? `${aus}</mark>` : aus;
};

/** Markiert Buchstaben mit `<mark>`, Tags bleiben stehen; in s/w ist `mark` fett und unterstrichen (046). */
export const markiereBuchstaben = (html: string, buchstaben: string, bereich?: Bereich) => {
	const { markiert, stuecke } = ohneMarken(html);
	const treffer = trefferIn(stuecke, buchstaben, bereich);
	if (treffer.size === 0) {
		throw new Error('Diese Buchstaben kommen hier nicht vor.');
	}
	return mitMarken(stuecke, new Set([...markiert, ...treffer]));
};

const nurGueltig = (bereich?: Bereich) => (bereich && bereich.bis > bereich.von ? bereich : undefined);

/** Das Ziel eines Werkzeugs, mit dem, was überall gilt. */
const zielIn = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k) {
		throw new Error('Dieser Text ist nicht mehr da.');
	}
	const ziel = textZielVon(k);
	const innen = innenVon(z, ziel);
	if (hatFremdeAbbildung(innen)) {
		throw new Error('In diesem Text steckt schon eine Abbildung. Markiere einen anderen Text.');
	}
	return { z, k, ziel, innen };
};

/**
 * Schaltet Buchstaben oder `'vokale'` um: an, wenn sie im Text oder Bereich nicht überall markiert sind; sonst aus. Mit
 * `soll` steht die Richtung fest, das braucht der Schalter, wenn nur ein Teil markiert ist. Die Quelle kommt zeichengleich
 * zurück, und andere Marken bleiben.
 */
export const schalteMarkierung = (
	quelle: string,
	nr: number,
	was: string,
	bereich?: Bereich,
	soll?: boolean,
): SprachErgebnis => {
	const { innen, z, ziel } = zielIn(quelle, nr);
	const gueltig = nurGueltig(bereich);
	const { markiert, stuecke } = ohneMarken(innen, ziel.tag === 'x-silben');
	const treffer = trefferIn(stuecke, was, gueltig);
	if (treffer.size === 0) {
		throw new Error('Diese Buchstaben kommen hier nicht vor.');
	}
	const an = soll ?? [...treffer].some((i) => !markiert.has(i));
	const neu = new Set(markiert);
	for (const i of treffer) {
		if (an) {
			neu.add(i);
		} else {
			neu.delete(i);
		}
	}
	return { quelle: wendeAn(quelle, ersetzeInnen(z, ziel, mitMarken(stuecke, neu))), nr: ziel.nr, unsicher: [] };
};

/** Die Stelle, vor der ein neues Tag oder ein Strich steht: vor den Tags, die den Buchstaben gerade öffnen. */
const vorOeffnern = (stuecke: Stueck[], i: number) => {
	let j = i;
	while (j > 0 && stuecke[j - 1]?.tag && !stuecke[j - 1]?.roh.startsWith('</')) {
		j -= 1;
	}
	return j;
};

/** Trennt die Wörter im Bereich, Wort für Wort über Tags hinweg. Was schon in `x-silben` stand, behält seine Striche. */
const mitStrichen = (stuecke: Stueck[], von: number, bis: number) => {
	const ort: number[] = [];
	let lauf = 0;
	stuecke.forEach((s, i) => {
		for (let n = 0; n < s.zeichen.length; n += 1) {
			ort[lauf + n] = i;
		}
		lauf += s.zeichen.length;
	});
	const text = textVon(stuecke);
	const unsicher: string[] = [];
	const davor = new Set<number>();
	for (const m of text.slice(von, bis).matchAll(WORT)) {
		const start = von + m.index;
		if (stuecke[ort[start] ?? 0]?.inSilben) {
			continue;
		}
		const getrennt = m[0]
			.split('-')
			.map((t) => silbenVon(t))
			.join('-');
		if (istUnsicher(getrennt)) {
			unsicher.push(getrennt);
		}
		let buchstabe = 0;
		for (const z of getrennt) {
			if (z === '|') {
				davor.add(vorOeffnern(stuecke, ort[start + buchstabe] ?? 0));
			} else {
				buchstabe += z.length;
			}
		}
	}
	const neu: Stueck[] = [];
	stuecke.forEach((s, i) => {
		if (davor.has(i)) {
			neu.push({ roh: '|', zeichen: '', tag: false, strich: true });
		}
		neu.push(s);
	});
	return { stuecke: neu, unsicher };
};

const silbenTag = (darstellung: SilbenDarstellung, imText: boolean) =>
	`<x-silben${imText ? ' im-text' : ''}${darstellung === 'boegen' ? '' : ` darstellung="${darstellung}"`}>`;

/** Legt `x-silben` um den Bereich; berührte Stellen gehen darin auf und behalten ihre Striche. */
const wickle = (innen: string, darstellung: SilbenDarstellung, stellen: Stelle[], bereich: Bereich) => {
	const roh = stueckeVon(innen);
	const text = textVon(roh);
	let von = Math.min(bereich.von, ...stellen.map((s) => s.von));
	let bis = Math.max(bereich.bis, ...stellen.map((s) => s.bis));
	// `abbildungen.js` nimmt den Leerraum am Rand weg, im Fließtext gehört er also davor und dahinter.
	while (von < bis && /\s/.test(text[von] ?? '')) {
		von += 1;
	}
	while (bis > von && /\s/.test(text[bis - 1] ?? '')) {
		bis -= 1;
	}
	// Die Tags der berührten Stellen fallen weg, ihre Zeichen bleiben als `inSilben` erkennbar.
	const weg = new Set<number>();
	let auf = -1;
	roh.forEach((s, i) => {
		if (s.tag && SILBEN_AUF.test(s.roh)) {
			auf = i;
		} else if (s.tag && SILBEN_ZU.test(s.roh)) {
			const anfangsOrt = textVon(roh.slice(0, auf)).length;
			if (stellen.some((t) => t.von === anfangsOrt)) {
				weg.add(auf).add(i);
			}
		}
	});
	const erhalten = roh.filter((_, i) => !weg.has(i));
	const { stuecke, unsicher } = mitStrichen(erhalten, von, bis);
	let ort = 0;
	let anfang = stuecke.length;
	let ende = stuecke.length;
	let davorFertig = false;
	for (let i = 0; i < stuecke.length; i += 1) {
		const laenge = (stuecke[i] as Stueck).zeichen.length;
		if (!davorFertig && laenge > 0 && ort >= von) {
			anfang = vorOeffnern(stuecke, i);
			davorFertig = true;
		}
		ort += laenge;
		if (laenge > 0 && ort >= bis) {
			ende = i + 1;
			break;
		}
	}
	// Dahinter schließen, was im Bereich aufging: so entsteht kein leeres `<b></b>`.
	while (stuecke[ende]?.tag && stuecke[ende]?.roh.startsWith('</')) {
		ende += 1;
	}
	const offenVorn = offeneTags(stuecke.slice(0, anfang));
	const offenHinten = offeneTags(stuecke.slice(0, ende));
	const zu = (t: string[]) => t.map(schliesser).reverse().join('');
	const imText = /\S/.test(text.slice(0, von) + text.slice(bis));
	const teil = (a: number, b: number) =>
		stuecke
			.slice(a, b)
			.map((s) => s.roh)
			.join('');
	return {
		html: [
			teil(0, anfang),
			zu(offenVorn),
			silbenTag(darstellung, imText),
			offenVorn.join(''),
			teil(anfang, ende),
			zu(offenHinten),
			'</x-silben>',
			offenHinten.join(''),
			teil(ende, stuecke.length),
		].join(''),
		unsicher,
	};
};

const ohneStriche = (html: string) => html.replace(/<[^>]*>|\|/g, (t) => (t === '|' ? '' : t));

/** Hatte `wickle` ein `<b>` aufgetrennt, wächst es hier wieder zusammen. */
const fuege = (links: string, rechts: string) => {
	const zu = /<\/([a-z][\w-]*)>$/i.exec(links);
	const auf = zu && new RegExp(`^<${zu[1]}>`, 'i').exec(rechts);
	return zu && auf ? links.slice(0, -zu[0].length) + rechts.slice(auf[0].length) : links + rechts;
};

const nimmStellenWeg = (z: Zerlegung, ziel: Knoten, stellen: Stelle[]) => {
	let aus = '';
	let ort = ziel.oeffnerEnde;
	for (const { k } of stellen) {
		aus = fuege(aus + z.quelle.slice(ort, k.start), ohneStriche(innenVon(z, k)));
		ort = k.ende;
	}
	return fuege(aus, z.quelle.slice(ort, ziel.schliesserStart));
};

const BLOSS_SILBEN = new Set(['darstellung', 'farben', 'aufgabe', 'im-text']);

/** Ein `x-silben` allein auf der Seite: Ohne Silben bleibt ein Absatz mit demselben Text. */
const zuAbsatz = (z: Zerlegung, k: Knoten) => {
	const rest = k.attribute.filter((a) => !BLOSS_SILBEN.has(a.name));
	const klasse = rest.some((a) => a.name === 'class') ? '' : ' class="text"';
	const attribute = rest.map((a) => ` ${z.quelle.slice(a.start, a.ende)}`).join('');
	return `<p${klasse}${attribute}>${ohneStriche(innenVon(z, k)).trim()}</p>`;
};

/**
 * Silben an, in anderer Darstellung, oder mit `null` weg. Der Text bleibt, `mark` und Fett auch. Ist `x-silben` gewählt,
 * wirkt es auf diese Stelle, sonst mit Bereich auf die berührten und ohne auf alle. Ein Wechsel ändert nur das Attribut,
 * die Trennstriche bleiben, auch die von Hand.
 */
export const setzeSilben = (
	quelle: string,
	nr: number,
	darstellung: SilbenDarstellung | null,
	bereich?: Bereich,
): SprachErgebnis => {
	const { innen, k, z, ziel } = zielIn(quelle, nr);
	if (reinerText(innen).trim() === '') {
		throw new Error(WERKZEUG_TEXT_FEHLT);
	}
	const fertig = (neu: string, knoten: Knoten, unsicher: string[] = []) => ({
		quelle: neu,
		nr: knoten.nr,
		unsicher,
	});
	const gueltig = nurGueltig(bereich);
	const alle = stellenIn(z, ziel);
	const eigene = k !== ziel ? alle.filter((s) => s.k === k) : null;
	const eineGewaehlt = eigene !== null && !gueltig;
	const getroffen = eigene && !gueltig ? eigene : alle.filter((s) => !gueltig || beruehrt(s, gueltig));

	if (darstellung === null) {
		if (getroffen.length === 0) {
			return fertig(quelle, ziel);
		}
		if (ziel.tag === 'x-silben') {
			return fertig(wendeAn(quelle, [{ von: ziel.start, bis: ziel.ende, text: zuAbsatz(z, ziel) }]), ziel);
		}
		return fertig(wendeAn(quelle, ersetzeInnen(z, ziel, nimmStellenWeg(z, ziel, getroffen))), ziel);
	}

	const umfasst = (s: Stelle, b: Bereich) => s.von <= b.von && b.bis <= s.bis;
	const nurAttribut =
		getroffen.length > 0 &&
		(eineGewaehlt ||
			(gueltig ? getroffen.length === 1 && umfasst(getroffen[0] as Stelle, gueltig) : decktAlles(z, ziel, alle)));
	if (nurAttribut) {
		const wert = darstellung === 'boegen' ? null : darstellung;
		return fertig(
			wendeAn(
				quelle,
				getroffen.flatMap((s) => setzeAttribut(z, s.k, 'darstellung', wert)),
			),
			eigene ? k : ziel,
		);
	}
	const text = textVon(stueckeVon(innen));
	const { html, unsicher } = wickle(innen, darstellung, getroffen, gueltig ?? { von: 0, bis: text.length });
	return fertig(wendeAn(quelle, ersetzeInnen(z, ziel, html)), ziel, unsicher);
};

/** Ein Block (`x-lueckentext`, `x-sortieren`) statt des Textes: `p` wird ersetzt, Zellen und Listenpunkte behalten ihn. */
const setzeBlock = (z: Zerlegung, k: Knoten, davor: string, block: string, danach: string) => {
	if (!istUmwandelbar(k)) {
		throw new Error('Das geht nur bei einem Absatz, einer Zelle oder einem Listenpunkt.');
	}
	if (k.tag === 'td' || k.tag === 'th' || k.tag === 'li') {
		return wendeAn(
			z.quelle,
			ersetzeInnen(z, k, [maskiere(davor), block, maskiere(danach)].filter(Boolean).join('\n')),
		);
	}
	const offen = z.quelle.slice(k.start, k.oeffnerEnde);
	const absatz = (t: string) => (t.trim() ? `${offen}${maskiere(t.trim())}</${k.tag}>` : '');
	return wendeAn(z.quelle, [
		{ von: k.start, bis: k.ende, text: [absatz(davor), block, absatz(danach)].filter(Boolean).join('\n') },
	]);
};

const WERKZEUG_TEXT_FEHLT = 'Hier steht kein Text.';

/** Macht aus Text eine Übung, einen neuen Baustein. Silben und Hervorhebung bleiben dabei nicht erhalten, Rückgängig holt sie zurück. */
export const wendeSprachwerkzeugAn = (
	quelle: string,
	nr: number,
	werkzeug: SprachWerkzeug,
	bereich?: Bereich,
): SprachErgebnis => {
	const { innen, z, ziel } = zielIn(quelle, nr);
	const text = reinerText(innen);
	if (text.trim() === '') {
		throw new Error(WERKZEUG_TEXT_FEHLT);
	}
	const gueltig = nurGueltig(bereich);
	const von = gueltig?.von ?? 0;
	const bis = gueltig?.bis ?? text.length;
	const davor = text.slice(0, von);
	const mitte = text.slice(von, bis);
	const danach = text.slice(bis);
	const fertig = (neu: string) => ({ quelle: neu, nr: ziel.nr, unsicher: [] });

	switch (werkzeug.art) {
		case 'luecken': {
			const inhalt = lueckenText(text, werkzeug.regel, werkzeug.n, gueltig);
			return fertig(setzeBlock(z, ziel, '', `<x-lueckentext>${maskiere(inhalt)}</x-lueckentext>`, ''));
		}
		case 'woerter-mischen':
			return fertig(setzeBlock(z, ziel, davor, woerterMischen(mitte), danach));
		case 'buchstaben-mischen':
			return fertig(
				setzeBlock(
					z,
					ziel,
					davor,
					`<x-lueckentext>${maskiere(buchstabenMischen(mitte))}</x-lueckentext>`,
					danach,
				),
			);
	}
};

/** Absätze eines Lesetexts: direkt auf der Seite, damit auch die nächsten Seiten dazugehören. */
const istLesetext = (k: Knoten) =>
	k.tag === 'p' && klassenVon(k).includes('text') && k.eltern !== null && klassenVon(k.eltern).includes('seite');

/** Zeilennummern: Der Browser zählt sie beim Zeichnen, deshalb stimmen sie bei jedem Umbruch. `null` nimmt sie weg. */
export const setzeZeilennummern = (quelle: string, nr: number, schritt: 1 | 5 | null) => {
	const z = zerlege(quelle);
	const gewaehlt = z.knoten[nr];
	if (!gewaehlt) {
		throw new Error('Dieser Text ist nicht mehr da.');
	}
	const k = textZielVon(gewaehlt);
	const ziele = istLesetext(k) ? z.knoten.filter(istLesetext) : [k];
	return {
		quelle: wendeAn(
			quelle,
			ziele.flatMap((t) => setzeAttribut(z, t, 'data-zeilennummern', schritt === null ? null : String(schritt))),
		),
		nr: k.nr,
	};
};
