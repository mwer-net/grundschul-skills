import { BAUSTEINE } from '@schoolbox/kern/src/bausteine';
import { useRef } from 'react';

import { Dialog } from '../bausteine/Dialog';
import { Knopf } from '../bausteine/Knopf';

const AUSWAHL = [
	...BAUSTEINE.filter((b) => b.frei !== 'text' && b.frei !== 'block').map((b) => b.selektor),
	'.seite > *',
].join(',');

/** Hebt in der Fassung von Claude die Bausteine hervor, die es im alten Blatt so nicht gibt. */
const hebeHervor = (alt: Document, neu: Document) => {
	const vorher = new Set([...alt.querySelectorAll(AUSWAHL)].map((e) => e.outerHTML));
	const anders = [...neu.querySelectorAll<HTMLElement>(AUSWAHL)].filter((e) => !vorher.has(e.outerHTML));
	for (const element of anders.filter((e) => !anders.some((d) => d !== e && e.contains(d)))) {
		element.style.outline = '3px solid #d97706';
		element.style.outlineOffset = '2px';
		element.dataset.kiGeaendert = '';
	}
};

/** Beide Fassungen ganz in der Breite: In der halben Fensterbreite wäre ein A4-Blatt sonst rechts abgeschnitten. */
const passeEin = (rahmen: HTMLIFrameElement, doc: Document) => {
	const breite = doc.documentElement.scrollWidth;
	if (breite > rahmen.clientWidth) {
		doc.documentElement.style.setProperty('zoom', String(rahmen.clientWidth / breite));
	}
};

/** Nichts ändert sich ohne „Annehmen“ (Entscheidung 25). */
export const Vergleich = ({
	adresse,
	annehmen,
	konflikt,
	nachbessern,
	schliessen,
	schluessel,
	verwerfen,
}: {
	adresse: string;
	/** Welcher Vorschlag (135); ohne Angabe der jüngste. */
	schluessel?: string;
	annehmen: () => void;
	konflikt: boolean;
	nachbessern: () => void;
	schliessen: () => void;
	verwerfen: () => void;
}) => {
	const alt = useRef<HTMLIFrameElement>(null);
	const neu = useRef<HTMLIFrameElement>(null);
	const geladen = useRef(0);
	const fertig = () => {
		geladen.current += 1;
		const a = alt.current?.contentDocument;
		const n = neu.current?.contentDocument;
		if (geladen.current === 2 && a && n && alt.current && neu.current) {
			hebeHervor(a, n);
			passeEin(alt.current, a);
			passeEin(neu.current, n);
		}
	};
	const trenner = adresse.includes('?') ? '&' : '?';
	return (
		<Dialog titel="Vorschlag von Claude" schliessen={schliessen} breit>
			<div className="grid h-[70dvh] grid-cols-2 gap-3">
				<figure className="flex min-h-0 flex-col">
					<figcaption className="mb-1 font-medium">Jetzt</figcaption>
					<iframe
						ref={alt}
						src={adresse}
						title="Jetzt"
						onLoad={fertig}
						className="min-h-0 flex-1 rounded-xl border border-rand bg-flaeche"
					/>
				</figure>
				<figure className="flex min-h-0 flex-col">
					<figcaption className="mb-1 font-medium">Vorschlag</figcaption>
					<iframe
						ref={neu}
						src={`${adresse}${trenner}vorschlag=${encodeURIComponent(schluessel ?? '1')}`}
						title="Vorschlag"
						onLoad={fertig}
						data-vorschlag-rahmen
						className="min-h-0 flex-1 rounded-xl border border-rand bg-flaeche"
					/>
				</figure>
			</div>
			{konflikt && (
				<p role="alert" className="mt-2 font-medium">
					Das Blatt wurde seit dem Auftrag geändert. Starte den Auftrag bitte neu.
				</p>
			)}
			<div className="mt-3 flex flex-wrap gap-2">
				<Knopf onClick={annehmen} disabled={konflikt}>
					Annehmen
				</Knopf>
				<Knopf art="zweit" onClick={nachbessern}>
					Nachbessern
				</Knopf>
				<Knopf art="zweit" onClick={verwerfen}>
					Verwerfen
				</Knopf>
			</div>
		</Dialog>
	);
};
