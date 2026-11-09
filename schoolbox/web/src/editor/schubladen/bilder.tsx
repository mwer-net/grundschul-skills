import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';
import { fuelleBildrahmen, istBildrahmenLeer } from '@schoolbox/kern/src/bildrahmen';
import { fuegeBausteinEin } from '@schoolbox/kern/src/einfuegen';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AmZeiger } from '../../bausteine/AmZeiger';
import { Schubladenhinweis, Schubladenkopf, Schubladensuche } from '../../bausteine/Schubladenkopf';
import { Segment } from '../../bausteine/Segment';
import { useLaden } from '../../lib/laden';
import type { NeuerPlatz } from '../bild';
import { beschreibungAus } from '../bild';
import type { BildZiehen, SammlungsGruppe } from '../Bildpanel';
import { Hochladen, Laeuft, passt, SammlungsKacheln } from '../Bildpanel';
import { bildGut, mitGeholtemBild } from '../gestaltung/ablegen/bild-gut';
import type { Schublade, SchubladenTeile } from '.';
import { kopf } from './reihe';

/** Reihenfolge in der Schublade; „Sammlung“ ist die Gruppe `sammlung` ohne Willi und Wilma (die gehören zu den Figuren). */
const GRUPPEN: { wert: SammlungsGruppe; titel: string }[] = [
	{ wert: 'mappe', titel: 'Dieser Ordner' },
	{ wert: 'meine', titel: 'Meine Bilder' },
	{ wert: 'sammlung', titel: 'Sammlung' },
];

const FIGUR = /^(willi|wilma)[-.]/i;

const ohneFiguren = (daten: Sammlung): Sammlung => ({
	...daten,
	sammlung: daten.sammlung.filter((e) => !FIGUR.test(e.name)),
});

/** Der Platzhalter aus dem Katalog, hinter der Auswahl; `setzeBildEin` füllt ihn im selben Schritt. */
const neuerPlatz = (t: SchubladenTeile): NeuerPlatz | undefined => {
	const platz = t.einfuegen.eintraege.find((e) => e.id === 'platzhalter');
	return platz ? (q) => fuegeBausteinEin(q, platz.einfuegbar, t.auswahl, { jeSeite: t.folien }) : undefined;
};

const Inhalt = (t: SchubladenTeile) => {
	const { bild } = t;
	const { daten: roh, fehler, neuLaden } = useLaden<Sammlung>(`${bild.adresse}/bilder`);
	const daten = useMemo(() => (roh ? ohneFiguren(roh) : null), [roh]);
	const [gewaehlt, setGruppe] = useState<SammlungsGruppe | null>(null);
	const [suche, setSuche] = useState('');
	// Ohne eigene Wahl die erste Gruppe mit Bildern, damit die Schublade nicht leer aufgeht.
	const gruppe = gewaehlt ?? GRUPPEN.find((g) => (daten?.[g.wert].length ?? 0) > 0)?.wert ?? 'mappe';
	const liste = useMemo(() => (daten ? daten[gruppe].filter((e) => passt(e, suche)) : []), [daten, gruppe, suche]);

	// Nach dem Hochladen steht das Foto unter „Dieser Ordner“.
	const lief = useRef(bild.arbeit);
	useEffect(() => {
		if (lief.current && !bild.arbeit) {
			neuLaden();
		}
		lief.current = bild.arbeit;
	}, [bild.arbeit, neuLaden]);

	// Ziehen (103): Erst beim Loslassen holt der Server das Bild in diesen Ordner; so lange steht das am Zeiger.
	const zeiger = useRef({ x: 0, y: 0 });
	const [geholt, setGeholt] = useState<{ x: number; y: number } | null>(null);
	useEffect(() => {
		const merke = (e: PointerEvent) => {
			zeiger.current = { x: e.clientX, y: e.clientY };
		};
		window.addEventListener('pointermove', merke, true);
		window.addEventListener('pointerup', merke, true);
		return () => {
			window.removeEventListener('pointermove', merke, true);
			window.removeEventListener('pointerup', merke, true);
		};
	}, []);
	const zeigeGeholt = useCallback((laeuft: boolean) => setGeholt(laeuft ? zeiger.current : null), []);
	const { doc, einfuegen, folien, struktur } = t;
	const platz = einfuegen.eintraege.find((e) => e.id === 'platzhalter');
	const ziehen: BildZiehen = (eintrag, natur) => {
		const vorschau = `/ansicht/${eintrag.schluessel}`;
		const holend = mitGeholtemBild(struktur, vorschau, () => bild.hole(eintrag.schluessel), zeigeGeholt);
		return {
			teile: { doc, folien, struktur: holend },
			gut: bildGut(
				{ src: vorschau, alt: eintrag.alt[0] ?? beschreibungAus(eintrag.name), natur },
				{ platz, jeSeite: folien, struktur: holend },
			),
		};
	};

	const ziel = bild.werte;
	const neu = ziel ? undefined : neuerPlatz(t);
	// 111: Ist ein leerer Bildrahmen gewählt, füllt ein Klick ihn (das Bild kommt erst in diesen Ordner).
	const rahmen = t.auswahl !== null && istBildrahmenLeer(t.zerlegung?.knoten[t.auswahl]) ? t.auswahl : null;
	const waehle = (eintrag: SammlungsBild) =>
		rahmen === null
			? void bild.uebernimm(eintrag.schluessel, eintrag.alt[0] ?? beschreibungAus(eintrag.name), neu)
			: void bild.hole(eintrag.schluessel).then((src) => {
					const alt = eintrag.alt[0] ?? beschreibungAus(eintrag.name);
					return src && struktur.fuehreAus('Bild in den Rahmen', (q) => fuelleBildrahmen(q, rahmen, { src, alt }), false, true);
				});
	const titel = GRUPPEN.find((g) => g.wert === gruppe)?.titel ?? '';

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-schublade-bilder>
			<Schubladenkopf titel="Bilder" />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="flex flex-col gap-2 p-2">
					{bild.arbeit === 'hochladen' ? (
						<Laeuft text="Foto wird hochgeladen …" />
					) : (
						<Hochladen bild={bild} neu={neu} breit />
					)}
					<Segment
						beschriftung="Welche Bilder?"
						className="flex w-full *:flex-auto *:px-1 *:text-[11px]"
						werte={GRUPPEN.map((g) => ({ wert: g.wert, titel: g.titel }))}
						wert={gruppe}
						waehle={setGruppe}
					/>
					<Schubladensuche
						beschriftung="Bilder suchen"
						platzhalter="Bilder suchen"
						wert={suche}
						setWert={setSuche}
					/>
				</div>
				<section className="flex flex-col gap-2 border-t border-rand px-2 pt-2 pb-3" data-bilder-gruppe={gruppe}>
					<h3 className="flex items-center justify-between gap-2 text-xs font-semibold text-leise">
						<span className="truncate">{titel}</span>
						{daten && <span className="font-normal text-dezent">{`${daten[gruppe].length} Bilder`}</span>}
					</h3>
					{gruppe === 'sammlung' && (
						<p className="text-xs text-leise" data-hinweis="figuren">
							Willi & Co. findest du unter{' '}
							<button
								type="button"
								className="font-medium text-brand-700 underline-offset-2 hover:underline"
								onClick={() => t.oeffneSchublade('figuren')}
							>
								Figuren ⌥4
							</button>
							.
						</p>
					)}
					{bild.arbeit === 'sammlung' && <Laeuft text="Bild wird eingesetzt …" />}
					<SammlungsKacheln
						klein
						aus={!bild.aktiv || bild.arbeit !== null}
						geladen={Boolean(daten)}
						fehler={fehler?.message ?? null}
						gruppe={gruppe}
						liste={liste}
						suche={suche}
						waehle={waehle}
						ziehen={ziehen}
					/>
				</section>
			</div>
			<Schubladenhinweis>
				{rahmen !== null
					? 'Klick auf ein Bild füllt den Bildrahmen.'
					: ziel
					? `Klick auf ein Bild ${ziel.platzhalter ? 'setzt es in den Platzhalter ein' : 'tauscht das gewählte Bild aus'}.`
					: 'Klick auf ein Bild fügt es hinter der Auswahl ein.'}{' '}
				Ziehen legt es frei aufs Blatt, mit ⌘ als Baustein.
			</Schubladenhinweis>
			{geholt && (
				<AmZeiger
					className="rounded-lg bg-tinte px-3 py-2 font-medium whitespace-nowrap text-white shadow-2"
					data-bild-holen
					x={geholt.x + 10}
					y={geholt.y + 10}
				>
					Bild wird geholt …
				</AmZeiger>
			)}
		</div>
	);
};

/**
 * ⌥6: Fotos hochladen, Bilder aus dem Ordner, aus anderen Ordnern und der Sammlung. Klick setzt ein wie im Bild-Panel;
 * Ziehen legt frei ab, auf ein Bild tauscht es aus, in einen Platzhalter füllt es ihn, mit ⌘ wird es Baustein (103).
 */
export const schublade: Schublade = { ...kopf('bilder'), bereit: () => true, Inhalt };
