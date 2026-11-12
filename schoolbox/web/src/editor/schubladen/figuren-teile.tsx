import type { CanvaStand } from '@schoolbox/kern/src/canva-auftrag';
import { CANVA_TEXT_ZEICHEN } from '@schoolbox/kern/src/canva-auftrag';
import type { BibliotheksFigur, Pose } from '@schoolbox/kern/src/figuren';
import { poseName } from '@schoolbox/kern/src/figuren';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { meldung, sende } from '../../api';
import { useHinweis } from '../../bausteine/hinweis';
import { klassen } from '../../bausteine/klassen';
import { Menue } from '../../bausteine/Menue';
import {
	nichtsPasst,
	raster,
	Schublade,
	Schubladenabschnitt,
	SCHUBLADENKACHEL,
	Schubladenleer,
	Schubladensuche,
} from '../../bausteine/Schublade';
import { Symbol } from '../../bausteine/Symbol';
import { falte } from '../bild-sammlung';
import { canvaAktion, starteFigur, useCanvaLaeufe } from '../canva';
import { mitGeholtemBild } from '../gestaltung/ablegen/bild-gut';
import { useHolenAmZeiger } from '../gestaltung/ablegen/holen-am-zeiger';
import { AblageKachel } from '../gestaltung/ablegen/Kachel';
import { ladeFigurenNeu, ladeVor, useFiguren, vorschauVon } from '../gestaltung/figuren-quelle';
import { LimitZeile } from '../LimitZeile';
import type { SchubladenTeile } from '.';
import { CanvaKacheln } from './CanvaKachel';
import { gutFuer, srcFuer } from './figuren-daten';
import { kopf } from './reihe';

// Später: 128 setzt einen Abschnitt „Sticker“ unter die Figuren (nur bei „ja“ zu F3), als eigenen Abschnitt in `Inhalt`.

/** Jedes Wort der Suche steht im Namen der Figur, der Pose oder in den Suchwörtern; ohne Groß/klein und Umlaute. */
const passt = (figur: BibliotheksFigur, pose: Pose, woerter: readonly string[]) => {
	const text = falte([figur.name, poseName(figur, pose), ...figur.suchwoerter].join(' '));
	return woerter.every((wort) => text.includes(wort));
};

/** Das ⋯ an einer Posenkachel: beim Überfahren und bei Fokus, am iPad immer. */
const MEHR = (
	<button
		type="button"
		className="absolute top-0 right-0 flex size-7 items-start justify-end p-1 opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 data-[popup-open]:opacity-100 [@media(any-pointer:coarse)]:size-11 [@media(any-pointer:coarse)]:opacity-100"
	>
		<span className="flex size-5 items-center justify-center rounded-full bg-flaeche text-tinte shadow-1 [@media(any-pointer:coarse)]:size-7">
			<Symbol name="mehr" className="size-3.5" />
		</span>
	</button>
);

/**
 * „Figur beschreiben“ unter der Suche (Optik wie `Schubladensuche`). Nach der Antwort bleibt der Text markiert:
 * Weitertippen ersetzt ihn, Enter gibt eine weitere Fassung.
 */
const FigurBeschreiben = ({
	fehler,
	ki,
	setFehler,
}: {
	ki: SchubladenTeile['ki'];
	fehler: string | null;
	setFehler: (fehler: string | null) => void;
}) => {
	const [text, setText] = useState('');
	const [sendet, setSendet] = useState(false);
	const feld = useRef<HTMLInputElement>(null);
	const gesperrt = ki.hinweis?.art === 'gesperrt';
	const kannSenden = text.trim() !== '' && !sendet && !gesperrt;
	const schicke = async (ev: FormEvent) => {
		ev.preventDefault();
		if (!kannSenden) {
			return;
		}
		setSendet(true);
		try {
			await starteFigur(text);
			feld.current?.select();
		} catch (grund) {
			setFehler(meldung(grund));
		}
		setSendet(false);
	};
	return (
		<>
			<form data-figur-beschreiben className="relative" onSubmit={(ev) => void schicke(ev)}>
				<Symbol
					name="funken"
					className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-brand-600"
				/>
				<input
					ref={feld}
					// Wie `EIGENE_GESCHICHTE`: ⌘Z im Feld gehört dem Feld.
					data-eigene-geschichte=""
					id="figur-beschreiben"
					aria-label="Figur beschreiben"
					placeholder="Figur beschreiben …"
					maxLength={CANVA_TEXT_ZEICHEN}
					autoComplete="off"
					enterKeyHint="send"
					value={text}
					onChange={(ev) => {
						setText(ev.target.value);
						setFehler(null);
					}}
					className="h-knopf w-full rounded-lg border border-rand bg-papier pr-7 pl-8 text-sm placeholder:text-leise focus:border-brand-500 focus:bg-flaeche focus:outline-none [@media(any-pointer:coarse)]:pr-12"
				/>
				<button
					type="submit"
					aria-label="Senden"
					disabled={!kannSenden}
					className="group/senden absolute top-1/2 right-0 flex size-knopf-klein -translate-y-1/2 items-center justify-center"
				>
					<span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-white group-hover/senden:bg-brand-600 group-disabled/senden:bg-rand group-disabled/senden:text-leise [@media(any-pointer:coarse)]:size-8">
						<Symbol name="senden" className="size-3 [@media(any-pointer:coarse)]:size-4" />
					</span>
				</button>
			</form>
			{fehler && (
				<p role="alert" className="text-xs text-fehler" data-figur-fehler>
					{fehler}
				</p>
			)}
			{gesperrt && ki.hinweis && <LimitZeile hinweis={ki.hinweis} pruefeLimit={ki.pruefeLimit} />}
		</>
	);
};

/** Figuren (177): je Figur ein Abschnitt mit allen Posen. Eine Pose kommt erst beim Ablegen ins Dokument. */
export const Inhalt = (t: SchubladenTeile) => {
	const figuren = useFiguren();
	const [suche, setSuche] = useState('');
	const { anzeige: holen, zeige } = useHolenAmZeiger();
	const woerter = falte(suche).split(' ').filter(Boolean);
	const gezeigt = figuren
		.map((figur) => ({ figur, posen: figur.posen.filter((p) => passt(figur, p, woerter)) }))
		.filter((f) => f.posen.length > 0);

	// Jedes neue Dokument im `iframe` (nach jeder Änderung) bekommt die Bilder vorgeladen.
	const vorschauen = figuren.flatMap((f) => f.posen.map(vorschauVon)).join('|');
	useEffect(() => ladeVor(t.doc, vorschauen.split('|')), [t.doc, vorschauen]);

	const { laeufe } = useCanvaLaeufe();
	const [fehler, setFehler] = useState<string | null>(null);
	const zeigeHinweis = useHinweis();
	// Steht etwas im Suchfeld, zeigt die Schublade keine Canva-Kacheln.
	const canva = woerter.length === 0;
	const neueFigur = canva && laeufe.some((l) => l.art === 'figur' && !l.ziel.figur);
	const nochmal = (stand: CanvaStand) =>
		void starteFigur(stand.text).then(
			() => canvaAktion(stand.id, 'verwerfen'),
			(grund: unknown) => setFehler(meldung(grund)),
		);
	const entferne = (pose: Pose) =>
		void sende(`/api/figuren/posen/${encodeURIComponent(pose.id)}/entfernen`).then(
			() => ladeFigurenNeu(),
			(grund: unknown) => zeigeHinweis({ text: meldung(grund), art: 'fehler' }),
		);

	const { doc, folien, struktur } = t;
	const kachel = (figur: BibliotheksFigur, pose: Pose) => {
		// Dieselbe Adresse wie das Bild der Kachel; `mitGeholtemBild` tauscht genau diese gegen den echten `src`.
		const vorschau = vorschauVon(pose);
		const name = poseName(figur, pose);
		const ablage = (
			<AblageKachel
				key={pose.id}
				teile={{ doc, folien, struktur: mitGeholtemBild(struktur, vorschau, () => srcFuer(t, pose), zeige) }}
				gut={gutFuer(t, figur, pose, vorschau, zeige)}
				beschriftung={name}
				className={klassen(
					SCHUBLADENKACHEL,
					'flex aspect-square items-center justify-center p-1.5',
					'w-full',
					!struktur.aktiv && 'pointer-events-none opacity-50',
				)}
			>
				<img
					src={vorschau}
					alt=""
					draggable={false}
					className="size-full object-contain"
					data-figur-kachel={pose.id}
				/>
			</AblageKachel>
		);
		// Die Grundposen von Willi und Wilma bleiben. Das ⋯ liegt neben der Kachel, nicht darin (kein Knopf im Knopf).
		if (figur.eingebaut && pose.id === figur.id) {
			return ablage;
		}
		const grundpose = figur.posen[0]?.id === pose.id;
		return (
			<div key={pose.id} className="group relative">
				{ablage}
				<Menue
					name="Weitere Aktionen"
					rechtsbuendig
					ausloeser={MEHR}
					eintraege={[
						{
							titel: grundpose ? 'Figur entfernen' : 'Entfernen',
							symbol: 'papierkorb',
							gefahr: true,
							waehle: () => entferne(pose),
						},
					]}
				/>
			</div>
		);
	};

	return (
		<>
			<Schublade
				titel={kopf('figuren').titel}
				daten={{ 'data-schublade-figuren': '' }}
				steuerung={
					<>
						<Schubladensuche beschriftung="Figuren suchen" wert={suche} setWert={setSuche} />
						{!(t.ki.geladen && !t.ki.verfuegbar) && (
							<FigurBeschreiben ki={t.ki} fehler={fehler} setFehler={setFehler} />
						)}
					</>
				}
			>
				{neueFigur && (
					<Schubladenabschnitt titel="Neue Figur" daten={{ 'data-canva-neu': '' }}>
						<div className={raster(3)}>
							<CanvaKacheln laeufe={laeufe} figur={null} nochmal={nochmal} />
						</div>
					</Schubladenabschnitt>
				)}
				{gezeigt.map(({ figur, posen }) => (
					<Schubladenabschnitt key={figur.id} titel={figur.name} daten={{ 'data-figuren-gruppe': figur.id }}>
						<div className={raster(3)}>
							{canva && <CanvaKacheln laeufe={laeufe} figur={figur.id} nochmal={nochmal} />}
							{posen.map((pose) => kachel(figur, pose))}
						</div>
					</Schubladenabschnitt>
				))}
				{gezeigt.length === 0 && <Schubladenleer>{nichtsPasst(suche)}</Schubladenleer>}
			</Schublade>
			{holen}
		</>
	);
};
