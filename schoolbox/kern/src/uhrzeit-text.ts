import type { Knoten, Zerlegung } from './quelltext';
import { attribut, klassenVon, zerlege } from './quelltext';

/**
 * 197-01: Ändert sich die Zeit einer Uhr, steht daneben oft dieselbe Zeit als Text oder als Lösung einer Antwortlinie
 * („3 Uhr“, „halb 4“, „3:30 Uhr“, „3.30 Uhr“). Sie wird mit umgeschrieben, im selben Eintrag der Reihe, sonst in
 * derselben Aufgabe. Was dort als Lösung steht und nicht erkannt wird, sperrt „Neue Zahlen“.
 */

interface Zeit {
	stunde: number;
	minute: number;
}

const lies = (zeit: string | null): Zeit | null => {
	const t = /^(\d{1,2}):(\d{2})$/.exec(zeit?.trim() ?? '');
	return t ? { stunde: Number(t[1]), minute: Number(t[2]) } : null;
};

const zwoelf = (h: number) => ((h + 11) % 12) + 1;

/** Ein Ausdruck für alle Schreibweisen der Zeit, mit Gruppen für die Art. */
const muster = ({ minute, stunde }: Zeit) => {
	const stunden = [...new Set([stunde, zwoelf(stunde), zwoelf(stunde) + 12].filter((h) => h <= 24))];
	const h = `(?:0?(?:${stunden.join('|')}))`;
	const mm = String(minute).padStart(2, '0');
	const teile = [`(?<punkt>\\b${h}(?<trenner>[:.])${mm}\\s?Uhr\\b)`];
	if (minute === 0) {
		teile.push(`(?<voll>\\b(?<h>${h})\\s?Uhr\\b)`);
	}
	if (minute === 30) {
		teile.push(`(?<halb>\\bhalb\\s(?:${zwoelf(stunde + 1)})\\b)`);
	}
	return new RegExp(teile.join('|'), 'g');
};

const schreibe = (neu: Zeit, art: 'punkt' | 'voll' | 'halb', trenner = ':', vierundzwanzig = false) => {
	const h = vierundzwanzig && neu.stunde < 12 ? neu.stunde + 12 : neu.stunde;
	const mm = String(neu.minute).padStart(2, '0');
	if (art === 'halb' && neu.minute === 30) {
		return `halb ${zwoelf(neu.stunde + 1)}`;
	}
	if (art === 'voll' && neu.minute === 0) {
		return `${h} Uhr`;
	}
	return `${h}${art === 'punkt' ? trenner : ':'}${mm} Uhr`;
};

const ersetze = (text: string, alt: Zeit, neu: Zeit) =>
	text.replace(muster(alt), (...args: unknown[]) => {
		const gruppen = args.at(-1) as Record<string, string | undefined>;
		if (gruppen.halb) {
			return schreibe(neu, 'halb');
		}
		if (gruppen.voll) {
			return schreibe(neu, 'voll', ':', Number(gruppen.h) > 12);
		}
		return schreibe(neu, 'punkt', gruppen.trenner ?? ':', Number(/\d+/.exec(gruppen.punkt ?? '')?.[0]) > 12);
	});

const erkannt = (text: string, alt: Zeit) => muster(alt).test(text);

/** Der Eintrag der Reihe um die Uhr, sonst ihre Aufgabe. */
const umfeld = (k: Knoten): Knoten | null => {
	let aufgabe: Knoten | null = null;
	for (let e = k.eltern; e; e = e.eltern) {
		const klassen = klassenVon(e);
		if (klassen.includes('zelle') && e.eltern && klassenVon(e.eltern).includes('reihe')) {
			return e;
		}
		if (!aufgabe && klassen.includes('aufgabe')) {
			aufgabe = e;
		}
	}
	return aufgabe;
};

const antworten = (z: Zerlegung, feld: Knoten) =>
	z.knoten.filter(
		(k) => k.start >= feld.oeffnerEnde && k.ende <= feld.schliesserStart && klassenVon(k).includes('antwort'),
	);

/** Die Zeit, die die Uhr zeigt (im Blatt oder in der Lösung). */
export const zeitDerUhr = (w: Record<string, string | null>) => w.zeit ?? w.loesung ?? null;

/** Schreibt im Umfeld der Uhr `nr` die alte Zeit in die neue um; ohne Umfeld oder ohne Fund bleibt die Quelle. */
export const schreibeUhrzeitUm = (quelle: string, nr: number, alt: string | null, neu: string | null) => {
	const [a, n] = [lies(alt), lies(neu)];
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const feld = k && umfeld(k);
	if (!a || !n || !k || !feld || (a.stunde === n.stunde && a.minute === n.minute)) {
		return quelle;
	}
	const innen = quelle.slice(feld.oeffnerEnde, feld.schliesserStart);
	const umgeschrieben = innen.replace(
		/(<[^>]*>)|([^<]+)/g,
		(_, tag: string | undefined, text: string | undefined) => {
			if (tag) {
				return tag.replace(
					/(\sdata-l=")([^"]*)(")/,
					(__, vor: string, wert: string, nach: string) => vor + ersetze(wert, a, n) + nach,
				);
			}
			return ersetze(text ?? '', a, n);
		},
	);
	return quelle.slice(0, feld.oeffnerEnde) + umgeschrieben + quelle.slice(feld.schliesserStart);
};

/**
 * Steht neben der Abbildung eine Lösung, die „Neue Zahlen“ nicht mitändern kann? Liefert die Nummer der Antwortlinie.
 * Uhr: eine Lösung ohne erkannte Uhrzeit. Geld, Kalender, Zeitspanne: jede Lösung.
 */
export const loesungDaneben = (quelle: string, nr: number, tag: string, zeit: string | null): number | null => {
	if (!['x-uhr', 'x-geld', 'x-kalender', 'x-zeitspanne'].includes(tag)) {
		return null;
	}
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const feld = k && umfeld(k);
	if (!feld) {
		return null;
	}
	const a = lies(zeit);
	const fremd = antworten(z, feld).find((antwort) => {
		const l = attribut(antwort, 'data-l')?.wert?.trim();
		return l ? tag !== 'x-uhr' || !a || !erkannt(l, a) : false;
	});
	return fremd?.nr ?? null;
};
