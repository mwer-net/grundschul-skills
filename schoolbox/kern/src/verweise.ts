import type { Knoten, Zerlegung } from './quelltext';
import { entschluessele, innenVon, klassenVon } from './quelltext';

/** Ein Tipp der Leitfigur „Zu 3: …“, dessen Aufgabe seit dem Ausgangsstand eine andere Nummer hat. */
export interface Verweis {
	/** `data-sb` der Sprechblase in der aktuellen Fassung. */
	blase: number;
	/** Die Nummer im Tipp. */
	alt: number;
	/** Die Nummer, die die gemeinte Aufgabe jetzt hat; `null`, wenn sie nicht mehr zu finden ist. */
	neu: number | null;
}

const VERWEIS = /^\s*Zu (\d+)\s*:/;

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

const reinerText = (html: string) =>
	entschluessele(html.replace(/<[^>]*>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();

interface Aufgabe {
	nr: number | null;
	/** Der ganze Text ohne Nummer: gleich, solange niemand in der Aufgabe getippt hat. */
	inhalt: string;
	anweisung: string;
}

const aufgabenVon = (z: Zerlegung): Aufgabe[] =>
	z.knoten
		.filter((k) => hat(k, 'aufgabe'))
		.map((k) => {
			const nummer = k.kinder.find((c) => hat(c, 'nr'));
			const text = nummer ? reinerText(innenVon(z, nummer)) : '';
			const ohneNummer = nummer
				? z.quelle.slice(k.oeffnerEnde, nummer.start) + z.quelle.slice(nummer.ende, k.schliesserStart)
				: innenVon(z, k);
			const anw = k.kinder.find((c) => hat(c, 'anw'));
			return {
				nr: /^\d+$/.test(text) ? Number(text) : null,
				inhalt: reinerText(ohneNummer),
				anweisung: anw ? reinerText(innenVon(z, anw)) : '',
			};
		});

const blasenVon = (z: Zerlegung) =>
	z.knoten
		.filter((k) => hat(k, 'blase'))
		.map((k) => ({ k, text: reinerText(innenVon(z, k)) }))
		.flatMap(({ k, text }) => {
			const treffer = VERWEIS.exec(text);
			return treffer?.[1] ? [{ k, text, nr: Number(treffer[1]) }] : [];
		});

/**
 * Tipps „Zu 3: …“, die nach dem Umsortieren, Löschen oder Kopieren auf eine andere Aufgabe zeigen als im
 * `ausgang` (der Stand beim Öffnen). Erkannt wird die Aufgabe an ihrem Text, zur Not an der Anweisung. Wer den Tipp
 * selbst geändert hat, hat ihn geprüft: Dann gilt er.
 */
export const verschobeneVerweise = (ausgang: Zerlegung, jetzt: Zerlegung): Verweis[] => {
	const vorher = aufgabenVon(ausgang);
	const nachher = aufgabenVon(jetzt);
	const alteTipps = new Set(blasenVon(ausgang).map((b) => b.text));
	return blasenVon(jetzt).flatMap(({ k, nr, text }) => {
		const gemeint = vorher.find((a) => a.nr === nr);
		if (!alteTipps.has(text) || !gemeint) {
			return [];
		}
		const gleich = nachher.filter((a) => a.inhalt === gemeint.inhalt);
		const kandidaten = gleich.length > 0 ? gleich : nachher.filter((a) => a.anweisung === gemeint.anweisung);
		// Nicht mehr zu erkennen und keine Aufgabe weniger: Wahrscheinlich wurde nur in ihr getippt.
		const bearbeitet = kandidaten.length === 0 && nachher.length >= vorher.length;
		if (bearbeitet || kandidaten.some((a) => a.nr === nr)) {
			return [];
		}
		return [{ blase: k.nr, alt: nr, neu: kandidaten[0]?.nr ?? null }];
	});
};

/** Der Satz für die Prüfliste. */
export const verweisText = ({ alt, neu }: Verweis) =>
	neu === null
		? `Der Tipp „Zu ${alt}“ gehört zu einer Aufgabe, die es nicht mehr gibt.`
		: `Der Tipp „Zu ${alt}“ gehört jetzt zu Aufgabe ${neu}.`;
