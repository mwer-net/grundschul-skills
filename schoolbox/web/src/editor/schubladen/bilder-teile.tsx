import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';
import { vorschaubildAdresse } from '@schoolbox/kern/src/bildbefehle';
import type { CanvaStand } from '@schoolbox/kern/src/canva-auftrag';
import { fuegeBausteinEin } from '@schoolbox/kern/src/einfuegen';
import { useEffect, useMemo, useRef, useState } from 'react';

import { meldung } from '../../api';
import { Schublade, Schubladenabschnitt, Schubladensuche, STEUER_SEGMENT } from '../../bausteine/Schublade';
import { Segment } from '../../bausteine/Segment';
import { useEreignisse } from '../../ereignisse';
import { useLaden } from '../../lib/laden';
import type { NeuerPlatz } from '../bild';
import { beschreibungAus } from '../bild';
import { passt } from '../bild-sammlung';
import type { BildZiehen, SammlungsGruppe } from '../Bildpanel';
import { Hochladen, Laeuft, SammlungsKacheln } from '../Bildpanel';
import { canvaAktion, starteBild, useCanvaLaeufe } from '../canva';
import { bildGut, mitGeholtemBild } from '../gestaltung/ablegen/bild-gut';
import { useHolenAmZeiger } from '../gestaltung/ablegen/holen-am-zeiger';
import type { SchubladenTeile } from '.';
import { BildBeschreiben } from './bild-beschreiben';
import { bildLaeufe, CanvaBildKacheln } from './CanvaKachel';
import { kopf } from './reihe';

/** Reihenfolge in der Schublade; Figuren stehen nur in „Figuren“ (177), der Server lässt sie hier schon weg. */
const GRUPPEN: { wert: SammlungsGruppe; titel: string }[] = [
	{ wert: 'mappe', titel: 'Dieser Ordner' },
	{ wert: 'meine', titel: 'Meine Bilder' },
	{ wert: 'sammlung', titel: 'Sammlung' },
];

/** Der Platzhalter aus dem Katalog, hinter der Auswahl; `setzeBildEin` füllt ihn im selben Schritt. */
const neuerPlatz = (t: SchubladenTeile): NeuerPlatz | undefined => {
	const platz = t.einfuegen.eintraege.find((e) => e.id === 'platzhalter');
	return platz ? (q) => fuegeBausteinEin(q, platz.einfuegbar, t.auswahl, { jeSeite: t.folien }) : undefined;
};

export const Inhalt = (t: SchubladenTeile) => {
	const { bild } = t;
	const { daten, fehler, neuLaden } = useLaden<Sammlung>(`${bild.adresse}/bilder`);
	const [gewaehlt, setGruppe] = useState<SammlungsGruppe | null>(null);
	const [suche, setSuche] = useState('');
	// Neue Bilder aus Canva: Aufträge dieses Blatts stehen vorn in „Dieser Ordner“, fertige laden die Liste neu.
	const { laeufe } = useCanvaLaeufe();
	const mitClaude = !(t.ki.geladen && !t.ki.verfuegbar);
	const meineLaeufe = mitClaude ? bildLaeufe(laeufe, t.dokument) : [];
	// Ohne eigene Wahl die erste Gruppe mit Bildern oder Aufträgen, damit die Schublade nicht leer aufgeht.
	const gruppe =
		gewaehlt ??
		GRUPPEN.find((g) => (daten?.[g.wert].length ?? 0) > 0 || (g.wert === 'mappe' && meineLaeufe.length > 0))
			?.wert ??
		'mappe';
	const liste = useMemo(() => (daten ? daten[gruppe].filter((e) => passt(e, suche)) : []), [daten, gruppe, suche]);

	// Nach dem Hochladen steht das Foto unter „Dieser Ordner“.
	const lief = useRef(bild.arbeit);
	useEffect(() => {
		if (lief.current && !bild.arbeit) {
			neuLaden();
		}
		lief.current = bild.arbeit;
	}, [bild.arbeit, neuLaden]);

	const { anzeige: holen, zeige: zeigeGeholt } = useHolenAmZeiger();
	const { doc, einfuegen, folien, struktur } = t;
	const platz = einfuegen.eintraege.find((e) => e.id === 'platzhalter');
	const ziehen: BildZiehen = (eintrag, natur) => {
		// Dieselbe Adresse wie das Bild der Kachel; `mitGeholtemBild` tauscht genau diese gegen den echten `src`.
		const vorschau = vorschaubildAdresse(`/ansicht/${eintrag.schluessel}`);
		const holend = mitGeholtemBild(struktur, vorschau, () => bild.hole(eintrag.schluessel), zeigeGeholt);
		return {
			teile: { doc, folien, struktur: holend },
			gut: bildGut(
				{ src: vorschau, alt: eintrag.alt[0] ?? beschreibungAus(eintrag.name), natur },
				{ platz, jeSeite: folien, struktur: holend },
			),
		};
	};

	// Gewählt ist ein Bild, ein Platzhalter oder ein leerer Bildrahmen (172): Klick und „Foto hochladen“ füllen es.
	const ziel = bild.werte;
	const neu = ziel ? undefined : neuerPlatz(t);
	const waehle = (eintrag: SammlungsBild) =>
		void bild.uebernimm(eintrag.schluessel, eintrag.alt[0] ?? beschreibungAus(eintrag.name), neu);
	const [canvaFehler, setCanvaFehler] = useState<string | null>(null);
	useEreignisse((e) => {
		if (e.typ === 'canva-stand' && e.art === 'bild' && e.status === 'fertig') {
			neuLaden();
		}
	});
	const auftraege = gruppe === 'mappe' && !suche.trim() ? meineLaeufe : [];
	const nochmal = (stand: CanvaStand) =>
		void starteBild({ mappe: stand.ziel.mappe ?? '', dok: stand.ziel.dok ?? '' }, stand.text).then(
			() => canvaAktion(stand.id, 'verwerfen'),
			(grund: unknown) => setCanvaFehler(meldung(grund)),
		);
	const hochladen =
		bild.arbeit === 'hochladen' ? (
			<Laeuft text="Foto wird hochgeladen …" />
		) : (
			<Hochladen bild={bild} neu={neu} breit={!mitClaude} klein={mitClaude} />
		);
	const titel = GRUPPEN.find((g) => g.wert === gruppe)?.titel ?? '';
	const zahl = daten?.[gruppe].length ?? 0;
	const anzahl = zahl === 0 ? undefined : zahl === 1 ? '1 Bild' : `${zahl} Bilder`;

	return (
		<>
			<Schublade
				titel={kopf('bilder').titel}
				daten={{ 'data-schublade-bilder': '' }}
				steuerung={
					<>
						<Schubladensuche beschriftung="Bilder suchen" wert={suche} setWert={setSuche} />
						<Segment
							beschriftung="Welche Bilder?"
							className={STEUER_SEGMENT}
							werte={GRUPPEN.map((g) => ({ wert: g.wert, titel: g.titel }))}
							wert={gruppe}
							waehle={setGruppe}
						/>
						{mitClaude ? (
							<BildBeschreiben
								ki={t.ki}
								ort={t.dokument}
								hochladen={hochladen}
								fehler={canvaFehler}
								setFehler={setCanvaFehler}
								gesendet={() => {
									setGruppe('mappe');
									setSuche('');
								}}
							/>
						) : (
							hochladen
						)}
					</>
				}
			>
				<Schubladenabschnitt titel={titel} notiz={anzahl} daten={{ 'data-bilder-gruppe': gruppe }}>
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
						vorne={
							auftraege.length > 0 ? <CanvaBildKacheln laeufe={auftraege} nochmal={nochmal} /> : undefined
						}
					/>
				</Schubladenabschnitt>
			</Schublade>
			{holen}
		</>
	);
};
