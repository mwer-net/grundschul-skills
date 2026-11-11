import type { Blick } from '@schoolbox/kern/src/figuren';
import { FIGUREN, figurSchluessel, spiegelnFuer } from '@schoolbox/kern/src/figuren';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { attribut } from '@schoolbox/kern/src/quelltext';
import { useEffect, useState } from 'react';

import { FELD_KLASSEN, klassen } from '../../bausteine/klassen';
import { Schubladenhinweis, Schubladenkopf } from '../../bausteine/Schubladenkopf';
import { Segment } from '../../bausteine/Segment';
import { useClaudeSteuerung } from '../claude-kontext';
import { elementZu } from '../darstellung';
import { sichtbarsteSeite } from '../gestaltung/ablegen/ablegen';
import { AblageKachel } from '../gestaltung/ablegen/Kachel';
import { seitenIn } from '../gestaltung/ablegen/vorschau';
import { adresseVon, ladeVor, useFigurSrc } from '../gestaltung/figuren-quelle';
import type { SchubladenTeile } from '.';
import { blickJetzt, gutFuer, merkeBlick } from './figuren-daten';

// Später: 128 setzt einen Abschnitt „Sticker“ unter „Willi & Co.“ (nur bei „ja“ zu F3), als eigenen Abschnitt in
// `Inhalt`; die Liste der Figuren bleibt.

const BLICKE: { wert: Blick; titel: string }[] = [
	{ wert: 'links', titel: 'schaut nach links' },
	{ wert: 'rechts', titel: 'schaut nach rechts' },
];

// Figur von Claude zeichnen lassen
/** Seite n (ab 1): die der Auswahl, sonst die, von der am meisten zu sehen ist. `null` ohne Seite (Übersicht). */
const seiteFuerFigur = (t: SchubladenTeile) => {
	const { doc } = t;
	if (!doc) {
		return null;
	}
	const seiten = seitenIn(doc);
	const gewaehlt = t.auswahl === null ? null : elementZu(doc, t.auswahl)?.closest('.seite');
	const seite = gewaehlt ?? sichtbarsteSeite(doc)?.seite;
	const i = seite ? seiten.indexOf(seite) : -1;
	return i === -1 ? null : i + 1;
};

/** Der feste Vorsatz: Der Kontext steckt im Text, der Chat bekommt keine neue Art. */
const figurAuftrag = (seite: number, wunsch: string) =>
	`Neue Figur als neues Gestaltungselement auf Seite ${seite}, frei in \`.ebene.vorne\` ` +
	`(references/gestaltung.md, Figur von Claude); bestehende Elemente bleiben unverändert: ${wunsch}`;

/** Freie Elemente von Claude, die schon frei liegen, als Quelltext. */
const freieFiguren = (z: Zerlegung | null) =>
	(z?.knoten ?? [])
		.filter((k) => attribut(k, 'data-frei') && attribut(k, 'data-lage'))
		.map((k) => ({ nr: k.nr, html: z?.quelle.slice(k.start, k.ende) ?? '' }));

/** Was vor dem Abschicken schon da war; nach „Annehmen“ ist das erste neue Element die Figur und wird gewählt. */
let wartet: Set<string> | null = null;

const FigurVonClaude = ({ t }: { t: SchubladenTeile }) => {
	const { schicke } = useClaudeSteuerung();
	const [wunsch, setWunsch] = useState('');
	const [grund, setGrund] = useState<string | null>(null);
	const { setAuswahl, zerlegung } = t;
	useEffect(() => {
		const neu = wartet && freieFiguren(zerlegung).find((f) => !wartet?.has(f.html));
		if (neu) {
			wartet = null;
			setAuswahl(neu.nr);
		}
	}, [setAuswahl, zerlegung]);
	const aus = !t.doc || !t.struktur.aktiv || seitenIn(t.doc).length === 0;
	const abschicken = () => {
		const text = wunsch.trim();
		const seite = seiteFuerFigur(t);
		if (!text || seite === null) {
			return;
		}
		const vorher = new Set(freieFiguren(t.zerlegung).map((f) => f.html));
		const nein = schicke(figurAuftrag(seite, text));
		setGrund(nein);
		if (!nein) {
			wartet = vorher;
			setWunsch('');
		}
	};
	return (
		<section className="flex flex-col gap-1 border-t border-rand px-2 pt-2 pb-3" data-figur-von-claude>
			<label className="text-xs font-semibold text-leise" htmlFor="figur-von-claude">
				Figur von Claude zeichnen lassen …
			</label>
			<input
				id="figur-von-claude"
				className={`${FELD_KLASSEN} w-full`}
				placeholder="z. B. eine Eule mit Brille"
				value={wunsch}
				disabled={aus}
				onChange={(e) => {
					setWunsch(e.target.value);
					setGrund(null);
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
						e.preventDefault();
						abschicken();
					}
				}}
			/>
			{grund && (
				<p className="text-xs text-leise" role="status" data-figur-grund>
					{grund}
				</p>
			)}
		</section>
	);
};

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
				<FigurVonClaude t={t} />
			</div>
			<Schubladenhinweis>Ziehen: frei hinlegen · mit ⌘: als Tipp in die Zeile</Schubladenhinweis>
		</div>
	);
};
