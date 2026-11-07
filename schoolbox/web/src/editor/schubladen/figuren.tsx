import type { Blick, Figur } from '@schoolbox/kern/src/figuren';
import { FIGUR_BREITE, FIGUREN, figurHtml, figurSchluessel, spiegelnFuer } from '@schoolbox/kern/src/figuren';
import { useEffect, useState } from 'react';

import { klassen } from '../../bausteine/klassen';
import { Schubladenhinweis, Schubladenkopf } from '../../bausteine/Schubladenkopf';
import { Segment } from '../../bausteine/Segment';
import type { PalettenEintrag } from '../palette-suche';
import { legeInMitte } from '../gestaltung/ablegen/ablegen';
import { AblageKachel } from '../gestaltung/ablegen/Kachel';
import type { GestaltungsGut } from '../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../gestaltung/ablegen/ziehgut';
import { adresseVon, bekannteSrc, holeSrc, ladeVor, useFigurSrc } from '../gestaltung/figuren-quelle';
import type { Schublade, SchubladenTeile, SchubladenZiele } from '.';
import { kopf } from './reihe';

// Später: 117 setzt unten das Feld „Figur von Claude zeichnen lassen …“ ein, 128 einen Abschnitt „Sticker“ unter
// „Willi & Co.“ (nur bei „ja“ zu F3). Beide als eigener Abschnitt in `Inhalt`, die Liste der Figuren bleibt.

const BLICK = 'schoolbox.figuren-blick';

const BLICKE: { wert: Blick; titel: string }[] = [
	{ wert: 'links', titel: 'schaut nach links' },
	{ wert: 'rechts', titel: 'schaut nach rechts' },
];

/** Gemerkt je Gerät; ohne Wahl schaut die Figur wie in ihrer Datei. */
const leseBlick = (): Blick | null => {
	try {
		const wert = localStorage.getItem(BLICK);
		return wert === 'links' || wert === 'rechts' ? wert : null;
	} catch {
		return null;
	}
};

const merkeBlick = (blick: Blick) => {
	try {
		localStorage.setItem(BLICK, blick);
	} catch {
		// Ohne Speicher gilt die Wahl nur bis zum Neuladen.
	}
};

/** Ohne gemerkte Wahl die Richtung der ersten Figur (alle schauen heute nach rechts). */
const blickJetzt = () => leseBlick() ?? FIGUREN[0]?.blickt ?? 'rechts';

/**
 * ⌘ beim Ziehen: der Baustein „Tipp“ mit dieser Figur als Leitfigur, so wie die Bibliothek ihn einfügt. Die Leitfigur
 * ist der Starter des Katalog-Eintrags der Figur (`willi`, `wilma`), mit dem `src` dieses Dokuments.
 */
const tippMit = (t: SchubladenTeile, f: Figur, src: string): GestaltungsGut['imStapel'] => {
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
		legeAb: (ablage) => t.einfuegen.fuegeAn({ ...tipp, einfuegbar: { ...tipp.einfuegbar, html: mitFigur } }, ablage),
	};
};

const gutFuer = (t: SchubladenTeile, f: Figur, src: string, blick: Blick) =>
	gestaltungsgut({
		name: f.name,
		html: figurHtml(f, src, blick),
		groesse: { b: FIGUR_BREITE },
		imStapel: tippMit(t, f, src),
	});

const Inhalt = (t: SchubladenTeile) => {
	const [blick, setBlick] = useState<Blick>(blickJetzt);
	const adresse = adresseVon(t.doc) ?? t.bild.adresse;
	const srcVon = useFigurSrc(adresse);
	const srcs = FIGUREN.map(srcVon);
	const schluessel = srcs.join('|');

	// Jedes neue Dokument im `iframe` (nach jeder Änderung) bekommt die Bilder vorgeladen.
	useEffect(() => ladeVor(t.doc, schluessel.split('|')), [t.doc, schluessel]);

	const waehleBlick = (neu: Blick) => {
		setBlick(neu);
		merkeBlick(neu);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-schublade-figuren>
			<Schubladenkopf titel="Figuren" />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="p-2">
					<Segment
						beschriftung="Blickrichtung"
						className="flex w-full *:flex-auto *:px-1 *:text-[11px]"
						werte={BLICKE}
						wert={blick}
						waehle={waehleBlick}
					/>
				</div>
				<section className="flex flex-col gap-2 border-t border-rand px-2 pt-2 pb-3" data-figuren-gruppe="willi-co">
					<h3 className="text-xs font-semibold text-leise">Willi & Co.</h3>
					<div className="grid grid-cols-2 gap-2">
						{FIGUREN.map((f) => (
							<AblageKachel
								key={f.id}
								teile={t}
								gut={gutFuer(t, f, srcVon(f), blick)}
								beschriftung={f.name}
								className={klassen(
									'flex flex-col items-center gap-1 rounded-lg border border-rand bg-flaeche p-2 text-sm hover:border-brand-500 hover:bg-brand-50',
									!t.struktur.aktiv && 'pointer-events-none opacity-50',
								)}
							>
								<img
									src={`/ansicht/${figurSchluessel(f)}`}
									alt=""
									draggable={false}
									className={klassen('aspect-square w-full object-contain', spiegelnFuer(f, blick) && '-scale-x-100')}
									data-figur-kachel={f.id}
								/>
								<span>{f.name}</span>
							</AblageKachel>
						))}
					</div>
				</section>
			</div>
			<Schubladenhinweis>Ziehen: frei hinlegen · mit ⌘: als Tipp in die Zeile</Schubladenhinweis>
		</div>
	);
};

/** ⌘K: „Willi“, „Wilma“, „Figur“; Enter legt die Figur in die Mitte, wie ein Klick in der Schublade. */
const suche = (_k: unknown, z: SchubladenZiele): PalettenEintrag[] =>
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

/** ⌥4: Willi & Co. frei hinlegen (102). Nur wo frei bearbeitet werden darf, wie „Bausteine“. */
export const schublade: Schublade = { ...kopf('figuren'), bereit: (k) => k.frei, Inhalt, suche };
