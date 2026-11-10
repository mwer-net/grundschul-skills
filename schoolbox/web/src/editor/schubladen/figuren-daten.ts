import type { Blick, Figur } from '@schoolbox/kern/src/figuren';
import { FIGUR_BREITE, FIGUREN, figurHtml } from '@schoolbox/kern/src/figuren';

import { legeInMitte } from '../gestaltung/ablegen/ablegen';
import type { GestaltungsGut } from '../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../gestaltung/ablegen/ziehgut';
import { adresseVon, bekannteSrc, holeSrc } from '../gestaltung/figuren-quelle';
import type { PalettenEintrag } from '../palette-suche';
import type { SchubladenTeile, SchubladenZiele } from '.';

export const BLICK = 'schoolbox.figuren-blick';

/** Gemerkt je Gerät; ohne Wahl schaut die Figur wie in ihrer Datei. */
export const leseBlick = (): Blick | null => {
	try {
		const wert = localStorage.getItem(BLICK);
		return wert === 'links' || wert === 'rechts' ? wert : null;
	} catch {
		return null;
	}
};

export const merkeBlick = (blick: Blick) => {
	try {
		localStorage.setItem(BLICK, blick);
	} catch {
		// Ohne Speicher gilt die Wahl nur bis zum Neuladen.
	}
};

/** Ohne gemerkte Wahl die Richtung der ersten Figur (alle schauen heute nach rechts). */
export const blickJetzt = () => leseBlick() ?? FIGUREN[0]?.blickt ?? 'rechts';

/**
 * ⌘ beim Ziehen: der Baustein „Tipp“ mit dieser Figur als Leitfigur, so wie die Bibliothek ihn einfügt. Die Leitfigur
 * ist der Starter des Katalog-Eintrags der Figur (`willi`, `wilma`), mit dem `src` dieses Dokuments.
 */
export const tippMit = (t: SchubladenTeile, f: Figur, src: string): GestaltungsGut['imStapel'] => {
	const tipp = t.einfuegen.eintraege.find((e) => e.id === 'tipp');
	const leit = t.einfuegen.eintraege.find((e) => e.id === f.id)?.einfuegbar.html;
	const html = tipp?.einfuegbar.html;
	if (!tipp || !leit || !html) {
		return undefined;
	}
	const figur = leit.replace(/\ssrc="[^"]*"/, ` src="${src}"`);
	const mitFigur = html.replace(/<img\b[^>]*\bclass="figur"[^>]*>/, figur);
	return {
		html: mitFigur,
		legeAb: (ablage) =>
			t.einfuegen.fuegeAn({ ...tipp, einfuegbar: { ...tipp.einfuegbar, html: mitFigur } }, ablage),
	};
};

export const gutFuer = (t: SchubladenTeile, f: Figur, src: string, blick: Blick) =>
	gestaltungsgut({
		name: f.name,
		html: figurHtml(f, src, blick),
		groesse: { b: FIGUR_BREITE },
		imStapel: tippMit(t, f, src),
	});

/** ⌘K: „Willi“, „Wilma“, „Figur“; Enter legt die Figur in die Mitte, wie ein Klick in der Schublade. */
export const suche = (_k: unknown, z: SchubladenZiele): PalettenEintrag[] =>
	FIGUREN.map((f) => ({
		id: `figur:${f.id}`,
		titel: f.name,
		gruppe: 'Figuren',
		symbol: 'figuren',
		notiz: 'frei hinlegen',
		suchwoerter: ['Figur', 'Figuren', ...f.suchwoerter],
		aus: async () => {
			const adresse = adresseVon(z.teile.doc) ?? z.teile.bild.adresse;
			const src = await holeSrc(adresse, f).catch(() => bekannteSrc(adresse, f));
			legeInMitte(z.teile, gutFuer(z.teile, f, src, blickJetzt()));
		},
	}));
