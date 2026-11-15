/**
 * S-06 (UX 186): Ankreuzen und Richtig/falsch als Zeilen im Inspektor. Gelesen wird wie `ankreuzenLesen` und
 * `aussagenLesen` in `abbildungen.js`; geschrieben wird die Kurzschrift, die das Asset liest. Was die Zeilen nicht
 * verlustfrei zeigen können, bleibt Text.
 */

export interface Antwort {
	text: string;
	richtig: boolean;
}

export interface Frage {
	frage: string;
	antworten: Antwort[];
}

export interface Aussage {
	text: string;
	/** `r`, `f`; alles andere kann die Zeile nicht zeigen. */
	wert: string;
}

const teileZeilen = (roh: string | null) =>
	(roh ?? '')
		.split(';')
		.map((z) => z.trim())
		.filter(Boolean);

/** `Wie viele Beine hat ein Hund?: *4, 3, 6; …` */
export const fragenVon = (roh: string | null): Frage[] =>
	teileZeilen(roh).map((z) => {
		const i = z.lastIndexOf(':');
		const antworten = (i < 0 ? z : z.slice(i + 1))
			.split(',')
			.map((o) => o.trim())
			.filter(Boolean);
		return {
			frage: i < 0 ? '' : z.slice(0, i).trim(),
			antworten: antworten.map((o) => ({ text: o.replace(/^\*/, '').trim(), richtig: o.startsWith('*') })),
		};
	});

export const fragenText = (fragen: Frage[]): string | null =>
	fragen.length === 0
		? null
		: fragen
				.map((f) => `${f.frage}: ${f.antworten.map((a) => `${a.richtig ? '*' : ''}${a.text}`).join(', ')}`)
				.join('; ');

/** `Hunde bellen: r; Katzen fliegen: f` */
export const aussagenVon = (roh: string | null): Aussage[] =>
	teileZeilen(roh).map((z) => {
		const i = z.lastIndexOf(':');
		return { text: (i < 0 ? z : z.slice(0, i)).trim(), wert: i < 0 ? '' : z.slice(i + 1).trim() };
	});

export const aussagenText = (aussagen: Aussage[]): string | null =>
	aussagen.length === 0 ? null : aussagen.map((a) => `${a.text}: ${a.wert}`).join('; ');

/** Lesen, schreiben und wieder lesen ergibt dasselbe: Dann zeigt die Zeilenliste alles, was im Wert steht. */
export const fragenVerlustfrei = (roh: string | null) =>
	JSON.stringify(fragenVon(fragenText(fragenVon(roh)))) === JSON.stringify(fragenVon(roh));

export const aussagenVerlustfrei = (roh: string | null) => {
	const aussagen = aussagenVon(roh);
	return (
		aussagen.every((a) => a.wert === 'r' || a.wert === 'f') &&
		JSON.stringify(aussagenVon(aussagenText(aussagen))) === JSON.stringify(aussagen)
	);
};

/** Zeichen, die in einer Zelle die Kurzschrift zerbrächen. */
export const VERBOTEN = {
	frage: /;/g,
	antwort: /[;,:]|^\*/g,
	aussage: /;/g,
} as const;
