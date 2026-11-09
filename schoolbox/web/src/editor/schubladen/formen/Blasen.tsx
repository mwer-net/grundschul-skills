import { formVon, STRICH, werteVon } from '@schoolbox/kern/src/formen';
import { formMitTextHtml, linieHtml } from '@schoolbox/kern/src/formen-aendern';
import type { Ende } from '@schoolbox/kern/src/formen-linie';
import { LINIEN_GROESSE } from '@schoolbox/kern/src/formen-linie';
import type { BlasenArt } from '@schoolbox/kern/src/formen-text';
import { BLASEN_GROESSE } from '@schoolbox/kern/src/formen-text';

import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';
import { wuenscheTextsitzung } from '../../gestaltung/textsitzung';
import type { FormenAbschnitt, FormenTeile } from './typ';
import { passtZurSuche } from './typ';

interface Eintrag {
	id: string;
	name: string;
	art: 'sprechblase' | 'band' | 'linie';
	blase?: BlasenArt;
	ende?: Ende;
	/** Weitere Wörter für Suchfeld und ⌘K. */
	auch?: readonly string[];
}

/** Reihenfolge der Kacheln (107): drei Blasen, Band, Linie, Pfeil. */
const EINTRAEGE: readonly Eintrag[] = [
	{ id: 'sprechblase-rund', name: 'Sprechblase', art: 'sprechblase', blase: 'rund', auch: ['Blase', 'rund'] },
	{ id: 'sprechblase-eckig', name: 'Sprechblase eckig', art: 'sprechblase', blase: 'eckig', auch: ['Blase'] },
	{ id: 'denkblase', name: 'Denkblase', art: 'sprechblase', blase: 'gedanke', auch: ['Gedanke', 'Gedankenblase'] },
	{ id: 'band', name: 'Band', art: 'band', auch: ['Banner', 'Schleife'] },
	{ id: 'linie', name: 'Linie', art: 'linie', auch: ['Strich'] },
	{ id: 'pfeil', name: 'Pfeil', art: 'linie', ende: 'pfeil', auch: ['Linie'] },
];

const namenVon = (e: Eintrag) => [e.name, ...(e.auch ?? [])];

/** `--fs` des Blatts: `--gr` der Blase ist mindestens das (und mindestens 22 px). */
const fsVon = (doc: Document | null) => {
	const body = doc?.body;
	const wert = body ? parseFloat(doc.defaultView?.getComputedStyle(body).getPropertyValue('--fs') ?? '') : NaN;
	return Number.isFinite(wert) ? wert : undefined;
};

/**
 * Das Gut zum Ablegen. Formen mit Text öffnen danach die Textsitzung mit markiertem „Text“ (105); Anlegen und erste
 * Sitzung sind ein Schritt.
 */
const gutVon = (e: Eintrag, fs: number | undefined): GestaltungsGut =>
	e.art === 'linie'
		? gestaltungsgut({ name: e.name, html: linieHtml(e.ende ? { ende: e.ende } : {}), groesse: LINIEN_GROESSE })
		: gestaltungsgut({
				name: e.name,
				html: formMitTextHtml({ art: e.art, ...(e.blase ? { blase: e.blase } : {}), ...(fs ? { fs } : {}) }),
				groesse: BLASEN_GROESSE,
				ebene: 'vorne',
				vorDemAblegen: wuenscheTextsitzung,
			});

/** Wie die Variable im Material gerade aussieht; ohne Material ein neutrales Grau. */
const farbe = (doc: Document | null, variable: string, ersatz: string) => {
	const body = doc?.body;
	const fenster = doc?.defaultView;
	return (body && fenster?.getComputedStyle(body).getPropertyValue(variable).trim()) || ersatz;
};

/** Vorschau aus derselben Funktion, die die Form im Blatt zeichnet, verkleinert. */
const Vorschau = ({ doc, e }: { e: Eintrag; doc: Document | null }) => {
	const html = gutVon(e, undefined).html;
	const form = formVon(e.art);
	const vorlage = document.createElement('template');
	vorlage.innerHTML = html;
	const element = vorlage.content.firstElementChild;
	if (!form || !element) {
		return null;
	}
	const { b, h } = form.standardGroesse;
	const strich = STRICH * (b / 56);
	const { d, spitzen } = form.zeichne(werteVon(form, (a) => element.getAttribute(a)), b, h, strich);
	const dunkel = farbe(doc, '--dunkel', '#1f2937');
	// Der Zipfel ragt heraus: Platz rundherum, damit er in der Kachel bleibt.
	const rand = e.art === 'sprechblase' ? 40 : 6;
	return (
		<svg aria-hidden viewBox={`${-rand} ${-rand} ${b + 2 * rand} ${h + 2 * rand}`} className="h-8 w-12 overflow-visible">
			<path
				d={d}
				fill={e.art === 'linie' ? 'none' : '#fff'}
				stroke={dunkel}
				strokeWidth={strich}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			{spitzen && <path d={spitzen} fill={dunkel} />}
		</svg>
	);
};

const Kacheln = ({ suche, teile }: FormenTeile) => {
	const fs = fsVon(teile.doc);
	const liste = EINTRAEGE.filter((e) => passtZurSuche(namenVon(e), suche));
	return (
		<div className="grid grid-cols-3 gap-1" data-blasen>
			{liste.map((e) => (
				<AblageKachel
					key={e.id}
					teile={teile}
					gut={gutVon(e, fs)}
					daten={{ 'data-blase-kachel': e.id }}
					className="flex h-12 items-center justify-center rounded-lg bg-flaeche-2 hover:bg-brand-50"
				>
					<Vorschau e={e} doc={teile.doc} />
				</AblageKachel>
			))}
		</div>
	);
};

/** 107: Abschnitt „Blasen und Linien“ der Schublade „Formen“. Klick legt in die Mitte, Ziehen legt frei ab. */
export const abschnitt: FormenAbschnitt | null = {
	id: 'blasen',
	titel: 'Blasen und Linien',
	hinweis: 'Klick oder ziehen',
	zeigt: ({ suche }) => EINTRAEGE.some((e) => passtZurSuche(namenVon(e), suche)),
	Inhalt: Kacheln,
	suche: (z) =>
		EINTRAEGE.map((e) => ({
			...ablegenEintrag(gutVon(e, undefined), z, 'Formen'),
			symbol: e.art === 'linie' ? (e.ende ? 'pfeil' : 'linie') : e.blase === 'gedanke' ? 'denkblase' : e.art === 'band' ? 'band' : 'sprechblase',
			suchwoerter: namenVon(e).slice(1),
		})),
};
