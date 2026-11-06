import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';
import { fuegeBausteinEin } from '@schoolbox/kern/src/einfuegen';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Schubladenhinweis, Schubladenkopf, Schubladensuche } from '../../bausteine/Schubladenkopf';
import { Segment } from '../../bausteine/Segment';
import { useLaden } from '../../lib/laden';
import type { NeuerPlatz } from '../bild';
import { beschreibungAus } from '../bild';
import type { SammlungsGruppe } from '../Bildpanel';
import { Hochladen, Laeuft, passt, SammlungsKacheln } from '../Bildpanel';
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

	const ziel = bild.werte;
	const neu = ziel ? undefined : neuerPlatz(t);
	const waehle = (eintrag: SammlungsBild) =>
		void bild.uebernimm(eintrag.schluessel, eintrag.alt[0] ?? beschreibungAus(eintrag.name), neu);
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
							Willi & Co. findest du bald unter Figuren.
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
					/>
				</section>
			</div>
			<Schubladenhinweis>
				{ziel
					? `Klick auf ein Bild ${ziel.platzhalter ? 'setzt es in den Platzhalter ein' : 'tauscht das gewählte Bild aus'}.`
					: 'Klick auf ein Bild fügt es hinter der Auswahl ein.'}
			</Schubladenhinweis>
		</div>
	);
};

/** ⌥6: Fotos hochladen, Bilder aus dem Ordner, aus anderen Ordnern und der Sammlung. Ziehen kommt mit 103. */
export const schublade: Schublade = { ...kopf('bilder'), bereit: () => true, Inhalt };
