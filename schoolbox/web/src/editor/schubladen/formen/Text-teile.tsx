import type { SchmuckArt } from '@schoolbox/kern/src/schmuck';
import { SCHMUCK_ARTEN } from '@schoolbox/kern/src/schmuck';
import type { CSSProperties } from 'react';
import { useEffect } from 'react';

import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import { ARTEN, fsVon, gutVon, namenVon } from './Text-daten';
import type { FormenTeile } from './typ';
import { passtZurSuche } from './typ';

/** Die Schrift des Blatts in der Leiste; die Oberfläche lädt sie nicht selbst (`useBlattSchriften`). */
const FREDOKA = 'SchoolboxFredoka, Fredoka, sans-serif';

/** Der eingebettete Schnitt aus `blatt.css` (Entscheidung 29), für die Leiste unter eigenem Namen. */
const SCHNITTE = [{ familie: 'SchoolboxFredoka', datei: 'Fredoka-SemiBold.woff2', gewicht: '600' }] as const;

/**
 * Die Kacheln zeigen Text in seiner Schrift. Die Oberfläche lädt Fredoka nicht selbst; sie kommt aus dem Ordner neben
 * `blatt.css` des Materials, einmal je Fenster. Ohne sie bleibt die Ersatzschrift.
 */
const useBlattSchriften = (doc: Document | null) => {
	useEffect(() => {
		const blatt = [...(doc?.styleSheets ?? [])].find((s) => s.href?.split('?')[0]?.endsWith('/blatt.css'))?.href;
		if (!blatt || [...document.fonts].some((f) => f.family === SCHNITTE[0].familie)) {
			return;
		}
		for (const { datei, familie, gewicht } of SCHNITTE) {
			const schrift = new FontFace(familie, `url(${new URL(`fonts/${datei}`, blatt).href})`, { weight: gewicht });
			document.fonts.add(schrift);
			void schrift.load().catch(() => undefined);
		}
	}, [doc]);
};

/** Vorschau in der Kachel: so groß, dass nichts abgeschnitten wird, am Mac wie am iPad (Skizze in 154). */
const AUSSEHEN: Record<SchmuckArt, CSSProperties> = {
	titel: { fontSize: 22, color: '#1f2937' },
	stempel: {
		fontSize: 12,
		color: '#be123c',
		border: '2px solid currentColor',
		borderRadius: 6,
		padding: '0 6px',
		textTransform: 'uppercase',
		letterSpacing: '0.06em',
		transform: 'rotate(-8deg)',
	},
	etikett: { fontSize: 12, color: '#fff', background: '#f59e0b', borderRadius: 999, padding: '2px 8px' },
};

export const Kacheln = ({ suche, teile }: FormenTeile) => {
	useBlattSchriften(teile.doc);
	const fs = fsVon(teile.doc);
	const liste = ARTEN.filter((art) => passtZurSuche(namenVon(art), suche));
	return (
		<div className="grid grid-cols-3 gap-1" data-schmuck-kacheln>
			{liste.map((art) => {
				const { name, text } = SCHMUCK_ARTEN[art];
				return (
					<AblageKachel
						key={art}
						teile={teile}
						gut={gutVon(art, fs)}
						daten={{ 'data-schmuck-kachel': art }}
						className="flex h-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg bg-flaeche-2 px-1 hover:bg-brand-50"
					>
						<span
							aria-hidden
							className="whitespace-nowrap"
							style={{ fontFamily: FREDOKA, fontWeight: 600, lineHeight: 1.1, ...AUSSEHEN[art] }}
						>
							{text}
						</span>
						{text !== name && <span className="text-xs text-leise">{name}</span>}
					</AblageKachel>
				);
			})}
		</div>
	);
};
