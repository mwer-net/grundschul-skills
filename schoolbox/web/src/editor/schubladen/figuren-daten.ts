import type { BibliotheksFigur, Pose } from '@schoolbox/kern/src/figuren';
import { FIGUR_BREITE, figurHtml, poseName } from '@schoolbox/kern/src/figuren';
import { schuetzeAttribut } from '@schoolbox/kern/src/quelltext';

import { legeInMitte } from '../gestaltung/ablegen/ablegen';
import type { GestaltungsGut } from '../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../gestaltung/ablegen/ziehgut';
import { adresseVon, figurenJetzt, holeSrc, ladeFiguren } from '../gestaltung/figuren-quelle';
import type { PalettenEintrag } from '../palette-suche';
import type { SchubladenTeile, SchubladenZiele } from '.';

/**
 * Das `src` der Pose in diesem Dokument; erst jetzt kommt sie hinein (177). Scheitert das, holt `bild.hole` noch einmal
 * und meldet den Fehler wie die Schublade „Bilder“; dann `null`.
 */
export const srcFuer = (t: SchubladenTeile, pose: Pose) =>
	holeSrc(adresseVon(t.doc) ?? t.bild.adresse, pose).catch(() => t.bild.hole(pose.schluessel));

/** Der Baustein „Tipp“ mit der Pose als Leitfigur; Vorlage ist der Starter des Katalog-Eintrags `willi`. */
const tippMitSrc = (t: SchubladenTeile, figur: BibliotheksFigur, src: string) => {
	const tipp = t.einfuegen.eintraege.find((e) => e.id === 'tipp');
	const leit = t.einfuegen.eintraege.find((e) => e.id === 'willi')?.einfuegbar.html;
	const html = tipp?.einfuegbar.html;
	if (!tipp || !leit || !html) {
		return null;
	}
	const bild = leit
		.replace(/\ssrc="[^"]*"/, () => ` src="${schuetzeAttribut(src)}"`)
		.replace(/\salt="[^"]*"/, () => ` alt="${schuetzeAttribut(figur.name)}"`);
	const mitFigur = html.replace(/<img\b[^>]*\bclass="figur"[^>]*>/, () => bild);
	return { ...tipp, einfuegbar: { ...tipp.einfuegbar, html: mitFigur } };
};

/**
 * ⌘ beim Ziehen: der Baustein „Tipp“ mit dieser Pose als Leitfigur, so wie die Bibliothek ihn einfügt. Gezeigt wird die
 * Vorschau; abgelegt wird erst mit dem geholten `src`, in einem Schritt, damit nie `/ansicht/…` ins Material kommt.
 */
export const tippMit = (
	t: SchubladenTeile,
	figur: BibliotheksFigur,
	pose: Pose,
	vorschau: string,
	zeige: (laeuft: boolean) => void = () => undefined,
): GestaltungsGut['imStapel'] => {
	const html = tippMitSrc(t, figur, vorschau)?.einfuegbar.html;
	if (!html) {
		return undefined;
	}
	return {
		html,
		legeAb: (ablage) => {
			zeige(true);
			void srcFuer(t, pose).then((src) => {
				zeige(false);
				const tipp = src ? tippMitSrc(t, figur, src) : null;
				if (tipp) {
					t.einfuegen.fuegeAn(tipp, ablage);
				}
			});
		},
	};
};

/** Das Gut einer Pose; `src` ist beim Ziehen aus der Schublade die Vorschau, die `mitGeholtemBild` austauscht. */
export const gutFuer = (
	t: SchubladenTeile,
	figur: BibliotheksFigur,
	pose: Pose,
	src: string,
	zeige?: (laeuft: boolean) => void,
) =>
	gestaltungsgut({
		name: poseName(figur, pose),
		html: figurHtml(figur, pose, src),
		groesse: { b: FIGUR_BREITE },
		imStapel: tippMit(t, figur, pose, src, zeige),
	});

/** ⌘K: jede Figur mit ihrem Namen; Enter legt die Grundpose in die Mitte, wie ein Klick in der Schublade. */
export const suche = (_k: unknown, z: SchubladenZiele): PalettenEintrag[] => {
	void ladeFiguren();
	return figurenJetzt().flatMap((figur) => {
		const grund = figur.posen[0];
		return grund
			? [
					{
						id: `figur:${figur.id}`,
						titel: figur.name,
						gruppe: 'Figuren',
						symbol: 'figuren' as const,
						notiz: 'frei hinlegen',
						suchwoerter: ['Figur', 'Figuren', ...figur.suchwoerter],
						aus: async () => {
							const src = await srcFuer(z.teile, grund);
							if (src) {
								legeInMitte(z.teile, gutFuer(z.teile, figur, grund, src));
							}
						},
					},
				]
			: [];
	});
};
