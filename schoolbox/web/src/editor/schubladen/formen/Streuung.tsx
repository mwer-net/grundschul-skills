import type { Ecke, StreuArt } from '@schoolbox/kern/src/streuen';
import {
	naechsteEcke,
	saatAus,
	STANDARD_FARBEN,
	STANDARD_FORMEN,
	STANDARD_MASS,
	STREU_ARTEN,
	STREU_NAMEN,
	streue,
	streuungHtml,
	teileAlsSvg,
} from '@schoolbox/kern/src/streuen';

import { klassen } from '../../../bausteine/klassen';
import { SymbolKnopf } from '../../../bausteine/SymbolKnopf';
import { nrVon } from '../../darstellung';
import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';
import { seitenIn } from '../../gestaltung/ablegen/vorschau';
import { useStreuArt, waehleStreuArt } from '../../gestaltung/streuung-stand';
import { waehleWerkzeug } from '../../gestaltung/werkzeuge/stand';
import type { FormenAbschnitt, FormenTeile } from './typ';
import { passtZurSuche } from './typ';

/** Weitere Wörter für Suchfeld und ⌘K; „Streuung“ trifft alle drei. */
const NAMEN: Readonly<Record<StreuArt, readonly string[]>> = {
	punkte: ['Punkte', 'Streuung', 'Muster', 'Raster'],
	konfetti: ['Konfetti', 'Streuung', 'Feier'],
	sterne: ['Sterne', 'Streuung', 'Stern'],
};

const SUCHE = ['Streuen', ...Object.values(NAMEN).flat()];

/**
 * Die Saat, mit der die nächste Streuung dieser Art abgelegt wird. Vorschau am Zeiger und Ablegen nehmen dieselbe,
 * sonst springt das Bild beim Loslassen. Nach dem Ablegen kommt eine neue, damit zwei Streuungen nie gleich aussehen.
 */
const SAATEN: Record<StreuArt, number> = {
	punkte: saatAus(Date.now()),
	konfetti: saatAus(Date.now() + 1),
	sterne: saatAus(Date.now() + 2),
};

/** Fest, damit die Kacheln ruhig bleiben. */
const VORSCHAU_SAAT: Record<StreuArt, number> = { punkte: 11, konfetti: 23, sterne: 5 };
const VORSCHAU = { b: 150, h: 100 } as const;

/** Die Seite der Nummer `nr` im Material: wohin die Punkte dichter werden, hängt an ihrer Größe. */
const eckeAn = (doc: Document | null, ort: { seite: number; x: number; y: number }): Ecke | undefined => {
	const seite = doc ? seitenIn(doc).find((s) => nrVon(s) === ort.seite) : undefined;
	return seite instanceof HTMLElement
		? naechsteEcke({ ...ort, ...STANDARD_MASS }, { b: seite.offsetWidth, h: seite.offsetHeight })
		: undefined;
};

const gutVon = (art: StreuArt, doc: Document | null): GestaltungsGut => {
	const html = (ecke?: Ecke) =>
		streuungHtml({ art, saat: SAATEN[art], ...STANDARD_MASS, ...(ecke ? { ecke } : {}) });
	return gestaltungsgut({
		name: STREU_NAMEN[art],
		html: html(),
		groesse: { b: STANDARD_MASS.b, h: STANDARD_MASS.h },
		// Die Saat gilt erst beim Ablegen (sie wechselt danach); Punkte werden zur nächsten Blattecke dichter, und die steht
		// erst fest, wenn der Ort feststeht.
		anpassen: (_html, ort) => html(art === 'punkte' ? eckeAn(doc, ort) : undefined),
		vorDemAblegen: () => {
			waehleStreuArt(art);
			// Der Schritt läuft gleich danach mit der alten Saat; erst dann kommt die neue.
			window.setTimeout(() => {
				SAATEN[art] = saatAus(Date.now());
			}, 0);
		},
	});
};

/** Wie die Variable im Material gerade aussieht; ohne Material ein neutrales Grau. */
const farbe = (doc: Document | null, name: string) => {
	const body = doc?.body;
	const fenster = doc?.defaultView;
	return (body && fenster?.getComputedStyle(body).getPropertyValue(`--${name}`).trim()) || '#9ca3af';
};

/** Vorschau aus derselben Funktion, die die Streuung im Blatt zeichnet, in den Farben des Materials. */
const Vorschau = ({ art, doc }: { art: StreuArt; doc: Document | null }) => {
	const teile = streue({
		art,
		saat: VORSCHAU_SAAT[art],
		dichte: 0.6,
		formen: STANDARD_FORMEN[art],
		farben: STANDARD_FARBEN,
		groesse: 'mittel',
		...VORSCHAU,
		...(art === 'punkte' ? { ecke: 'ul' as const } : {}),
	});
	return (
		<svg
			aria-hidden
			viewBox={`0 0 ${VORSCHAU.b} ${VORSCHAU.h}`}
			className="h-10 w-full"
			dangerouslySetInnerHTML={{ __html: teileAlsSvg(teile, (name) => farbe(doc, name)) }}
		/>
	);
};

const Kacheln = ({ suche, teile }: FormenTeile) => {
	const zuletzt = useStreuArt();
	const liste = STREU_ARTEN.filter((art) => passtZurSuche([...NAMEN[art]], suche));
	const knopf = passtZurSuche(SUCHE, suche) || suche.trim() === '';
	return (
		<div className="flex items-start gap-1" data-streuung-abschnitt>
			<div className="grid min-w-0 flex-1 grid-cols-3 gap-1" data-streuung-kacheln>
				{liste.map((art) => (
					<AblageKachel
						key={art}
						teile={teile}
						gut={gutVon(art, teile.doc)}
						daten={{ 'data-streuung-art': art }}
						className={klassen(
							'flex h-14 flex-col items-center justify-center rounded-lg bg-flaeche-2 px-1 hover:bg-brand-50',
							zuletzt === art && 'ring-2 ring-brand-500/60',
						)}
					>
						<Vorschau art={art} doc={teile.doc} />
						<span className="text-xs text-leise">{STREU_NAMEN[art]}</span>
					</AblageKachel>
				))}
			</div>
			{knopf && (
				<SymbolKnopf
					symbol="streuung"
					beschriftung="Streuen"
					tooltip="Streuen: Fläche aufziehen (⇧ hält es)"
					data-streuen-knopf
					onClick={(ev) => waehleWerkzeug('streuen', ev.shiftKey)}
				/>
			)}
		</div>
	);
};

export const abschnitt: FormenAbschnitt | null = {
	id: 'streuung',
	titel: 'Konfetti und Muster',
	hinweis: 'Klick oder ziehen',
	zeigt: ({ suche }) => passtZurSuche(SUCHE, suche),
	Inhalt: Kacheln,
	suche: (z) =>
		STREU_ARTEN.map((art) => ({
			...ablegenEintrag(gutVon(art, z.teile.doc), z, 'Formen'),
			symbol: 'streuung',
			suchwoerter: NAMEN[art].slice(1),
		})),
};
