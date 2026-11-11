import { zerlege } from '@schoolbox/kern/src/quelltext';
import type { Druckprofil } from '@schoolbox/kern/src/werte';
import { useMemo, useState } from 'react';

import { loeseAnker } from './claude-faeden';
import { editorHtml, elementZu } from './darstellung';

const BREITE = 236;
const HOEHE = 150;
/** Breit genug für A4 quer; die Miniatur misst danach nur den Ausschnitt. */
const RAHMEN_BREITE = 1200;

export interface Darstellung {
	basis: string;
	loesung: boolean;
	profil?: Druckprofil | undefined;
}

interface Ausschnitt {
	links: number;
	oben: number;
	breite: number;
	hoehe: number;
	ganz: number;
}

/**
 * „Vorher“ und „Nachher“ in der Blase (134): das Element in seiner Fassung, verkleinert. Wie in der Leinwand laufen
 * die Skripte des Materials, denn sie zeichnen etwa die Uhren.
 */
export const Miniatur = ({
	darstellung,
	quelle,
	referenz,
	titel,
}: {
	quelle: string;
	referenz: string | null;
	darstellung: Darstellung;
	titel: string;
}) => {
	const z = useMemo(() => zerlege(quelle), [quelle]);
	const html = useMemo(() => editorHtml(z, darstellung), [z, darstellung]);
	const nr = useMemo(() => (referenz ? loeseAnker(z, referenz) : null), [z, referenz]);
	const [ausschnitt, setAusschnitt] = useState<Ausschnitt | null>(null);

	const miss = (rahmen: HTMLIFrameElement) => {
		const doc = rahmen.contentDocument;
		if (!doc) {
			return;
		}
		const messen = () => {
			const ziel = (nr === null ? null : elementZu(doc, nr)) ?? doc.querySelector('.seite');
			const r = ziel?.getBoundingClientRect();
			if (r && r.width > 0) {
				setAusschnitt({
					links: r.left,
					oben: r.top,
					breite: r.width,
					hoehe: r.height,
					ganz: doc.documentElement.scrollHeight,
				});
			}
		};
		// Die Schriften des Blatts verschieben das Element, wenn sie nach `load` kommen.
		void doc.fonts.ready.then(messen, messen);
	};

	const mass = ausschnitt ? Math.min(BREITE / ausschnitt.breite, HOEHE / ausschnitt.hoehe, 1) : 0;
	return (
		<figure className="min-w-0 flex-1" data-claude-miniatur={titel}>
			<figcaption className="mb-0.5 text-xs text-leise">{titel}</figcaption>
			<div
				className="relative overflow-hidden rounded-md border border-tinte/12 bg-white"
				style={{ height: ausschnitt ? Math.ceil(ausschnitt.hoehe * mass) : HOEHE }}
			>
				<iframe
					srcDoc={html}
					title={titel}
					tabIndex={-1}
					aria-hidden
					scrolling="no"
					className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
					style={{
						width: RAHMEN_BREITE,
						height: ausschnitt?.ganz ?? 2000,
						visibility: ausschnitt ? undefined : 'hidden',
						transform: ausschnitt
							? `scale(${mass}) translate(${-ausschnitt.links}px, ${-ausschnitt.oben}px)`
							: undefined,
					}}
					onLoad={(e) => miss(e.currentTarget)}
				/>
			</div>
		</figure>
	);
};
