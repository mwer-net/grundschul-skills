import type { Blick } from '@schoolbox/kern/src/figuren';
import { FIGUREN, figurSchluessel, spiegelnFuer } from '@schoolbox/kern/src/figuren';
import { useEffect, useState } from 'react';

import { klassen } from '../../bausteine/klassen';
import { Schubladenhinweis, Schubladenkopf } from '../../bausteine/Schubladenkopf';
import { Segment } from '../../bausteine/Segment';
import { AblageKachel } from '../gestaltung/ablegen/Kachel';
import { adresseVon, ladeVor, useFigurSrc } from '../gestaltung/figuren-quelle';
import type { SchubladenTeile } from '.';
import { blickJetzt, gutFuer, merkeBlick } from './figuren-daten';

// Später: 128 setzt einen Abschnitt „Sticker“ unter „Willi & Co.“ (nur bei „ja“ zu F3), als eigenen Abschnitt in
// `Inhalt`; die Liste der Figuren bleibt.

const BLICKE: { wert: Blick; titel: string }[] = [
	{ wert: 'links', titel: 'schaut nach links' },
	{ wert: 'rechts', titel: 'schaut nach rechts' },
];

export const Inhalt = (t: SchubladenTeile) => {
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
				<section
					className="flex flex-col gap-2 border-t border-rand px-2 pt-2 pb-3"
					data-figuren-gruppe="willi-co"
				>
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
									className={klassen(
										'aspect-square w-full object-contain',
										spiegelnFuer(f, blick) && '-scale-x-100',
									)}
									data-figur-kachel={f.id}
								/>
								<span>{f.name}</span>
							</AblageKachel>
						))}
					</div>
				</section>
			</div>
			{/* >> 166 */}
			<Schubladenhinweis>Ziehen: frei hinlegen</Schubladenhinweis>
			{/* << 166 */}
		</div>
	);
};
