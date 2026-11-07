import type { SchmuckArt } from '@schoolbox/kern/src/schmuck';
import { SCHMUCK_ARTEN, schmuckHtml, standardGroesse } from '@schoolbox/kern/src/schmuck';
import type { CSSProperties } from 'react';
import { useEffect } from 'react';

import { klassen } from '../../bausteine/klassen';
import { Knopf } from '../../bausteine/Knopf';
import { Schubladenkopf } from '../../bausteine/Schubladenkopf';
import { Symbol } from '../../bausteine/Symbol';
import { Tooltip } from '../../bausteine/Tooltip';
import { Karte } from '../Bibliothek';
import type { Posten } from '../einfuegen';
import { AblageKachel } from '../gestaltung/ablegen/Kachel';
import { ablegenEintrag } from '../gestaltung/ablegen/ablegen';
import type { GestaltungsGut } from '../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../gestaltung/ablegen/ziehgut';
import { wuenscheTextsitzung } from '../gestaltung/textsitzung';
import { werkzeugVon } from '../gestaltung/werkzeuge';
import { useWerkzeugStand, waehleWerkzeug } from '../gestaltung/werkzeuge/stand';
import type { Schublade, SchubladenTeile } from '.';
import { kopf } from './reihe';

/** Die Schriften des Blatts in der Leiste; die Oberfläche lädt sie nicht selbst (`useBlattSchriften`). */
const FREDOKA = 'SchoolboxFredoka, Fredoka, sans-serif';
const ANDIKA = 'SchoolboxAndika, Andika, sans-serif';

/**
 * Inhalt: die vorhandenen Katalog-Einträge unter dem Namen, den die Schublade zeigt, mit einer Zeile in ihrem Aussehen
 * (5-text.md, Inhalt 1; Bild schublade-text.png).
 */
const INHALT: readonly { id: string; name: string; zeile: string; stil: CSSProperties; leise?: string }[] = [
	{ id: 'kopf', name: 'Überschrift', zeile: 'Überschrift', stil: { fontFamily: FREDOKA, fontWeight: 600, fontSize: 20 } },
	{ id: 'text', name: 'Absatz', zeile: 'Absatz für die Kinder', stil: { fontFamily: ANDIKA, fontSize: 16 } },
	{
		id: 'tipp',
		name: 'Tipp',
		zeile: 'Tipp: Zähl die Ecken.',
		stil: { fontFamily: ANDIKA, fontSize: 15, background: '#fef3c7', borderRadius: 6, padding: '2px 8px' },
	},
	{
		id: 'ziel',
		name: 'Lernziel',
		zeile: 'Ich kann …',
		stil: { fontFamily: ANDIKA, fontWeight: 700, fontSize: 15, color: '#0e7490' },
		leise: 'Lernziel',
	},
];

const ARTEN = Object.keys(SCHMUCK_ARTEN) as SchmuckArt[];

/** `--fs` des Blatts: Keine Standardgröße fällt darunter unter die Grenze von `schrift-klein`. */
const fsVon = (doc: Document | null) => {
	const body = doc?.body;
	const wert = body ? parseFloat(doc.defaultView?.getComputedStyle(body).getPropertyValue('--fs') ?? '') : NaN;
	return Number.isFinite(wert) ? wert : undefined;
};

/**
 * Das Gut einer Schmuckschrift: ohne `--b`, so breit wie ihr Text. Die Breite zum Mitten ist geschätzt (der Text ist
 * kurz), danach öffnet sich die Textsitzung mit markiertem Platzhalter.
 */
const gutVon = (art: SchmuckArt, fs: number | undefined): GestaltungsGut => {
	const { name, text } = SCHMUCK_ARTEN[art];
	const gr = standardGroesse(art, fs);
	return gestaltungsgut({
		name,
		html: schmuckHtml({ art, fs }),
		groesse: { b: Math.round(text.length * gr * 0.6 + (art === 'titel' ? 0 : gr)) },
		ebene: 'vorne',
		breiteAusInhalt: true,
		vorDemAblegen: wuenscheTextsitzung,
	});
};

/** Die eingebetteten Schnitte aus `blatt.css` (Entscheidung 29), für die Leiste unter eigenem Namen. */
const SCHNITTE = [
	{ familie: 'SchoolboxFredoka', datei: 'Fredoka-SemiBold.woff2', gewicht: '600' },
	{ familie: 'SchoolboxAndika', datei: 'Andika-Regular.woff2', gewicht: '400' },
	{ familie: 'SchoolboxAndika', datei: 'Andika-Bold.woff2', gewicht: '700' },
] as const;

/**
 * Die Kacheln zeigen Text in seiner Schrift. Die Oberfläche lädt Fredoka und Andika nicht selbst; sie kommen aus dem
 * Ordner neben `blatt.css` des Materials, einmal je Fenster. Ohne sie bleibt die Ersatzschrift.
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

const AUSSEHEN: Record<SchmuckArt, CSSProperties> = {
	titel: { fontSize: 24, color: '#1f2937' },
	stempel: {
		fontSize: 13,
		color: '#be123c',
		border: '2px solid currentColor',
		borderRadius: 6,
		padding: '0 6px',
		textTransform: 'uppercase',
		letterSpacing: '0.06em',
		transform: 'rotate(-8deg)',
	},
	etikett: { fontSize: 13, color: '#fff', background: '#f59e0b', borderRadius: 999, padding: '2px 10px' },
};

/** Wie die Abschnitte der Formen-Schublade: Nummer, Titel, rechts leise, was beim Ablegen passiert. */
const Ueberschrift = ({ hinweis, nr, titel }: { nr: number; titel: string; hinweis: string }) => (
	<h3 className="flex items-center gap-2 text-sm font-semibold">
		<span
			aria-hidden
			className="flex size-5 flex-none items-center justify-center rounded-full bg-brand-600 text-[11px] text-white"
		>
			{nr}
		</span>
		<span className="min-w-0 flex-1 truncate">{titel}</span>
		<span className="flex-none text-xs font-normal text-leise" data-text-hinweis>
			{hinweis}
		</span>
	</h3>
);

/** T oben im Abschnitt Schmuckschrift: derselbe Stand wie die Taste und die Knöpfe der Formen. */
const TKnopf = () => {
	const stand = useWerkzeugStand();
	const t = werkzeugVon('text');
	if (!t) {
		return null;
	}
	const aktiv = stand.id === t.id;
	return (
		<Tooltip text="Text schreiben: in die Seite klicken oder aufziehen (⇧ hält es)" kuerzel="T">
			<Knopf
				art="zweit"
				groesse="klein"
				className={klassen('self-start', aktiv && 'bg-brand-50 text-brand-700 hover:bg-brand-50')}
				aria-pressed={aktiv}
				data-werkzeug="text"
				onClick={(ev) => waehleWerkzeug(t.id, ev.shiftKey)}
			>
				<Symbol name="schrift" />
				Text schreiben
			</Knopf>
		</Tooltip>
	);
};

const Inhalt = (teile: SchubladenTeile) => {
	const { doc, einfuegen } = teile;
	useBlattSchriften(doc);
	const fs = fsVon(doc);
	const posten = INHALT.flatMap((z) => {
		const e = einfuegen.eintraege.find((p) => p.id === z.id);
		return e ? [{ eintrag: { ...e, name: z.name } satisfies Posten, z }] : [];
	});
	return (
		<div className="flex min-h-0 flex-1 flex-col" data-schublade-text>
			<Schubladenkopf titel="Text" />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="flex flex-col gap-3 p-2">
					<section className="flex flex-col gap-1.5" data-text-abschnitt="inhalt">
						<Ueberschrift nr={1} titel="Inhalt" hinweis="rastet ein" />
						<ul className="flex flex-col gap-1.5">
							{posten.map(({ eintrag, z }) => (
								<Karte
									key={eintrag.id}
									eintrag={eintrag}
									doc={doc}
									einfuegen={einfuegen}
									anzeige={
										<span className="flex items-baseline gap-2 py-1 font-normal">
											<span style={z.stil}>{z.zeile}</span>
											{z.leise && <span className="text-xs text-leise">{z.leise}</span>}
										</span>
									}
								/>
							))}
						</ul>
					</section>
					<section className="flex flex-col gap-1.5" data-text-abschnitt="schmuck">
						<Ueberschrift nr={2} titel="Schmuckschrift" hinweis="liegt frei" />
						<TKnopf />
						<div className="grid grid-cols-2 gap-1.5" data-schmuck-kacheln>
							{ARTEN.map((art) => (
								<AblageKachel
									key={art}
									teile={teile}
									gut={gutVon(art, fs)}
									className="flex h-20 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg bg-flaeche-2 px-1 hover:bg-brand-50"
								>
									<span
										aria-hidden
										className="whitespace-nowrap"
										style={{ fontFamily: FREDOKA, fontWeight: 600, lineHeight: 1.1, ...AUSSEHEN[art] }}
									>
										{SCHMUCK_ARTEN[art].text}
									</span>
									{SCHMUCK_ARTEN[art].text !== SCHMUCK_ARTEN[art].name && (
										<span className="text-xs text-leise">{SCHMUCK_ARTEN[art].name}</span>
									)}
								</AblageKachel>
							))}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
};

/** ⌥5: Schmuckschrift (liegt frei) und Inhalt (rastet ein), sichtbar getrennt, dazu T. Nur wo frei bearbeitet werden darf. */
export const schublade: Schublade = {
	...kopf('text'),
	bereit: (k) => k.frei,
	Inhalt,
	suche: (_k, z) =>
		ARTEN.map((art) => ({
			...ablegenEintrag(gutVon(art, fsVon(z.teile.doc)), z, 'Text'),
			symbol: 'schrift' as const,
			suchwoerter: ['Schmuckschrift', 'Schrift'],
		})),
};
