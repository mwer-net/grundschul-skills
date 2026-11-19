import type { BildlaufStand } from '@schoolbox/kern/src/bild-auftrag';
import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';
import { vorschaubildAdresse } from '@schoolbox/kern/src/bildbefehle';
import type { DragEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { meldung, sende } from '../../api';
import { useHinweis } from '../../bausteine/hinweis';
import { Schublade, Schubladenabschnitt, Schubladensuche, STEUER_SEGMENT } from '../../bausteine/Schublade';
import { Segment } from '../../bausteine/Segment';
import { useEreignisse } from '../../ereignisse';
import { useLaden } from '../../lib/laden';
import type { FreiAblegen } from '../bild';
import { bildLaeufe, bildlaufAktion, starteBild, useBildlaufLaeufe } from '../bild-lauf';
import { passt } from '../bild-sammlung';
import type { BildZiehen } from '../Bildpanel';
import { Hochladen, Laeuft, SammlungsKacheln } from '../Bildpanel';
import type { SammlungsGruppe } from '../bildpanel-hilfe';
import { BILDGRUPPEN, bildBeschreibung, bildgruppenWerte, bilderZahl } from '../bildpanel-hilfe';
import { legeInMitte } from '../gestaltung/ablegen/ablegen';
import { bildGut, mitGeholtemBild } from '../gestaltung/ablegen/bild-gut';
import { useHolenAmZeiger } from '../gestaltung/ablegen/holen-am-zeiger';
import { bildFeld } from '../ki';
import type { SchubladenTeile } from '.';
import { BildBeschreiben, OhneBildApi } from './bild-beschreiben';
import { BildlaufBildKacheln } from './BildlaufKachel';
import { kopf } from './reihe';

/** Zieht jemand Dateien herein? Nur dann nimmt die Schublade das Ablegen an (199, entschieden vom Admin). */
const mitDateien = (e: DragEvent) => [...e.dataTransfer.types].includes('Files');

export const Inhalt = (t: SchubladenTeile) => {
	const { bild } = t;
	const { daten, fehler, neuLaden } = useLaden<Sammlung>(`${bild.adresse}/bilder`);
	const [gewaehlt, setGruppe] = useState<SammlungsGruppe | null>(null);
	const [suche, setSuche] = useState('');
	// Neue KI-Bilder: Aufträge dieses Blatts stehen vorn in „Dieser Ordner“, fertige laden die Liste neu. Ohne Bild-API
	// bleiben laufende und gescheiterte Aufträge sichtbar, nur das Feld fehlt (237).
	const { laeufe } = useBildlaufLaeufe();
	const feldArt = bildFeld(t.ki);
	const mitClaude = feldArt !== 'nichts';
	const meineLaeufe = mitClaude ? bildLaeufe(laeufe, t.dokument) : [];
	// Ohne eigene Wahl die erste Gruppe mit Bildern oder Aufträgen, damit die Schublade nicht leer aufgeht.
	const ersteMitBildern = BILDGRUPPEN.find(
		(g) => (daten?.[g.wert].length ?? 0) > 0 || (g.wert === 'mappe' && meineLaeufe.length > 0),
	);
	const gruppe = gewaehlt ?? ersteMitBildern?.wert ?? 'mappe';
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
				{ src: vorschau, alt: bildBeschreibung(eintrag), natur },
				{ platz, jeSeite: folien, struktur: holend },
			),
		};
	};

	/**
	 * 199-02, 199-05: Die Schublade fügt hinzu, der Inspektor tauscht aus. Klick und „Foto hochladen“ legen ein neues
	 * freies Bild in die Mitte der sichtbaren Seite; nur ein gewählter Platzhalter oder leerer Bildrahmen wird gefüllt.
	 */
	const frei: FreiAblegen = (b) => void legeInMitte({ doc, folien, struktur }, bildGut(b));
	const waehle = (eintrag: SammlungsBild) => void bild.uebernimm(eintrag.schluessel, bildBeschreibung(eintrag), frei);
	const zeigeHinweis = useHinweis();
	const entferne = (eintrag: SammlungsBild) => {
		const schluessel = eintrag.kopien ?? [eintrag.schluessel];
		const ziel = `${bild.adresse}/bilder/entfernen`;
		void sende<{ tage?: number }>(ziel, { schluessel }).then(
			({ tage = 30 }) => {
				neuLaden();
				zeigeHinweis({
					// 199-N02: ehrlich, wann es wirklich weg ist (Frist wie der Papierkorb, vom Server).
					text: `Bild entfernt. Es wird in ${tage} Tagen endgültig gelöscht.`,
					aktion: {
						titel: 'Rückgängig',
						ausfuehren: () =>
							void sende(ziel, { schluessel, zurueck: true }).then(neuLaden, (grund: unknown) =>
								zeigeHinweis({ text: meldung(grund), art: 'fehler' }),
							),
					},
				});
			},
			(grund: unknown) => zeigeHinweis({ text: meldung(grund), art: 'fehler' }),
		);
	};
	// Eine Datei aus dem Finder auf der Schublade: hochladen wie mit „Foto hochladen“.
	const [drueber, setDrueber] = useState(false);
	const ablegen = {
		onDragOver: (e: DragEvent) => {
			if (!mitDateien(e) || !bild.aktiv) {
				return;
			}
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
			setDrueber(true);
		},
		onDragLeave: (e: DragEvent) => {
			if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
				setDrueber(false);
			}
		},
		onDrop: (e: DragEvent) => {
			setDrueber(false);
			if (!mitDateien(e) || !bild.aktiv) {
				return;
			}
			e.preventDefault();
			// 199-N04: alle Bilder hochladen, das erste einsetzen.
			const dateien = [...e.dataTransfer.files].filter((d) => d.type.startsWith('image/'));
			if (dateien.length === 0) {
				zeigeHinweis({ text: 'Hier lassen sich nur Bilder ablegen.' });
				return;
			}
			void bild.hochladen(dateien, frei);
		},
	};
	const [bildlaufFehler, setBildlaufFehler] = useState<string | null>(null);
	useEreignisse((e) => {
		if (e.typ === 'bildlauf-stand' && e.art === 'bild' && e.status === 'fertig') {
			neuLaden();
		}
	});
	const auftraege = gruppe === 'mappe' && !suche.trim() ? meineLaeufe : [];
	const nochmal = (stand: BildlaufStand) =>
		void starteBild({ mappe: stand.ziel.mappe ?? '', dok: stand.ziel.dok ?? '' }, stand.text).then(
			() => bildlaufAktion(stand.id, 'verwerfen'),
			(grund: unknown) => setBildlaufFehler(meldung(grund)),
		);
	const hochladen =
		bild.arbeit === 'hochladen' ? (
			<Laeuft text="Foto wird hochgeladen …" />
		) : (
			<Hochladen bild={bild} frei={frei} breit aus={!bild.aktiv} />
		);
	const titel = BILDGRUPPEN.find((g) => g.wert === gruppe)?.titel ?? '';
	const anzahl = bilderZahl(daten?.[gruppe].length ?? 0);

	const steuerung = (
		<>
			<Schubladensuche beschriftung="Bilder suchen" wert={suche} setWert={setSuche} />
			<Segment
				beschriftung="Welche Bilder?"
				className={STEUER_SEGMENT}
				werte={bildgruppenWerte(daten)}
				wert={gruppe}
				waehle={setGruppe}
			/>
			{feldArt === 'grund' && <OhneBildApi grund={t.ki.bilder.grund} />}
			{feldArt === 'feld' && (
				<BildBeschreiben
					ki={t.ki}
					ort={t.dokument}
					fehler={bildlaufFehler}
					setFehler={setBildlaufFehler}
					gesendet={() => {
						setGruppe('mappe');
						setSuche('');
					}}
				/>
			)}
			{hochladen}
		</>
	);

	return (
		<div
			className={drueber ? 'contents *:outline-2 *:-outline-offset-2 *:outline-brand-500' : 'contents'}
			data-bilder-ablage={drueber ? 'drueber' : undefined}
			{...ablegen}
		>
			<Schublade titel={kopf('bilder').titel} daten={{ 'data-schublade-bilder': '' }} steuerung={steuerung}>
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
						entferne={entferne}
						vorne={
							auftraege.length > 0 ? (
								<BildlaufBildKacheln laeufe={auftraege} nochmal={nochmal} />
							) : undefined
						}
					/>
				</Schubladenabschnitt>
			</Schublade>
			{holen}
		</div>
	);
};
