import type { BildlaufStand } from '@schoolbox/kern/src/bild-auftrag';
import { BILDLAUF_TEXT_ZEICHEN } from '@schoolbox/kern/src/bild-auftrag';
import type { BibliotheksFigur, Pose } from '@schoolbox/kern/src/figuren';
import { figurNameVergeben, NAME_VERGEBEN, poseName } from '@schoolbox/kern/src/figuren';
import type { FigurRueckweg } from '@schoolbox/kern/src/figurenbibliothek';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { meldung, sende } from '../../api';
import { useHinweis } from '../../bausteine/hinweis';
import { klassen } from '../../bausteine/klassen';
import { Menue } from '../../bausteine/Menue';
import {
	ABSCHNITT_TITEL,
	Schublade,
	Schubladenabschnitt,
	SCHUBLADENKACHEL,
	Schubladenleer,
	Schubladensuche,
} from '../../bausteine/Schublade';
import { nichtsPasst, raster } from '../../bausteine/schubladenhilfe';
import { Symbol } from '../../bausteine/Symbol';
import { bildlaufAktion, starteFigur, useBildlaufLaeufe } from '../bild-lauf';
import { falte } from '../bild-sammlung';
import { ClaudeWahl } from '../ClaudeWahl';
import { mitGeholtemBild } from '../gestaltung/ablegen/bild-gut';
import { useHolenAmZeiger } from '../gestaltung/ablegen/holen-am-zeiger';
import { AblageKachel } from '../gestaltung/ablegen/Kachel';
import { ladeFigurenNeu, ladeVor, useFiguren, vorschauVon } from '../gestaltung/figuren-quelle';
import { bildFeld } from '../ki';
import { LimitZeile } from '../LimitZeile';
import type { SchubladenTeile } from '.';
import { OhneBildApi } from './bild-beschreiben';
import { BildlaufKacheln } from './BildlaufKachel';
import { gutFuer, srcFuer } from './figuren-daten';
import { KACHEL_MEHR, SendenKreis } from './kreise';
import { kopf } from './reihe';

// Später: 128 setzt einen Abschnitt „Sticker“ unter die Figuren (nur bei „ja“ zu F3), als eigenen Abschnitt in `Inhalt`.

/** Jedes Wort der Suche steht im Namen der Figur, der Pose oder in den Suchwörtern; ohne Groß/klein und Umlaute. */
const passt = (figur: BibliotheksFigur, pose: Pose, woerter: readonly string[]) => {
	const text = falte([figur.name, poseName(figur, pose), ...figur.suchwoerter].join(' '));
	return woerter.every((wort) => text.includes(wort));
};

/**
 * Der Titel eines Figurenabschnitts. Doppelklick (oder ⋯ → „Figur umbenennen“) macht ihn zum Feld: Enter oder
 * Verlassen übernimmt, Esc bricht ab (199, entschieden vom Admin). Willi und Wilma heißen fest.
 */
const FigurTitel = ({
	alle,
	bearbeitet,
	figur,
	setBearbeitet,
}: {
	figur: BibliotheksFigur;
	/** 199-N01: alle Figuren, gegen deren Namen der neue geprüft wird. */
	alle: readonly BibliotheksFigur[];
	bearbeitet: boolean;
	setBearbeitet: (an: boolean) => void;
}) => {
	const [name, setName] = useState(figur.name);
	const vergeben = name.trim() !== '' && figurNameVergeben(name.trim(), alle, figur.id);
	const zeigeHinweis = useHinweis();
	// Enter und Esc beenden; das `blur` beim Verschwinden des Felds zählt dann nicht mehr.
	const fertigSchon = useRef(false);
	useEffect(() => {
		setName(figur.name);
		fertigSchon.current = false;
	}, [figur.name, bearbeitet]);
	const fertig = (uebernehmen: boolean) => {
		if (fertigSchon.current) {
			return;
		}
		// 199-N01: Ein vergebener Name bleibt im offenen Feld stehen, der Satz darunter sagt warum.
		if (uebernehmen && vergeben) {
			return;
		}
		fertigSchon.current = true;
		setBearbeitet(false);
		const neu = name.trim();
		if (!uebernehmen || !neu || neu === figur.name) {
			return;
		}
		void sende(`/api/figuren/${encodeURIComponent(figur.id)}/umbenennen`, { name: neu }).then(
			() => ladeFigurenNeu(),
			(grund: unknown) => zeigeHinweis({ text: meldung(grund), art: 'fehler' }),
		);
	};
	if (bearbeitet) {
		return (
			<div className="flex flex-col gap-1">
				<input
					// Wie `EIGENE_GESCHICHTE`: ⌘Z im Feld gehört dem Feld.
					data-eigene-geschichte=""
					data-figur-name-feld={figur.id}
					aria-label="Name der Figur"
					// Das Feld erscheint erst auf Doppelklick oder „Figur umbenennen“: Dorthin gehört der Fokus.
					autoFocus
					maxLength={40}
					value={name}
					onFocus={(e) => e.currentTarget.select()}
					onChange={(e) => setName(e.target.value)}
					onBlur={() => fertig(true)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							fertig(true);
						} else if (e.key === 'Escape') {
							e.preventDefault();
							e.stopPropagation();
							fertig(false);
						}
					}}
					className={klassen(
						ABSCHNITT_TITEL,
						'h-knopf w-full rounded-lg border border-brand-500 bg-flaeche px-2 focus:outline-none',
						vergeben && 'border-fehler',
					)}
					aria-invalid={vergeben}
					aria-describedby={vergeben ? `figur-name-${figur.id}` : undefined}
				/>
				{vergeben && (
					<p id={`figur-name-${figur.id}`} className="text-xs text-fehler" data-figur-name-vergeben>
						{NAME_VERGEBEN}
					</p>
				)}
			</div>
		);
	}
	return (
		<h3
			className={klassen(ABSCHNITT_TITEL, 'truncate')}
			data-figur-titel={figur.id}
			onDoubleClick={figur.eingebaut ? undefined : () => setBearbeitet(true)}
		>
			{figur.name}
		</h3>
	);
};

/** Läuft für diesen Text schon ein Auftrag? Dann sendet Enter nicht noch einmal (199, entschieden vom Admin). */
const laeuftSchon = (laeufe: readonly BildlaufStand[], text: string) =>
	laeufe.some((l) => l.art === 'figur' && l.status !== 'fehler' && l.text.trim() === text.trim());

/**
 * „Figur beschreiben“ unter der Suche (Optik wie `Schubladensuche`). Nach der Antwort bleibt der Text markiert:
 * Weitertippen ersetzt ihn, Enter gibt eine weitere Fassung.
 */
const FigurBeschreiben = ({
	fehler,
	ki,
	laeufe,
	setFehler,
}: {
	ki: SchubladenTeile['ki'];
	laeufe: readonly BildlaufStand[];
	fehler: string | null;
	setFehler: (fehler: string | null) => void;
}) => {
	const [text, setText] = useState('');
	const [sendet, setSendet] = useState(false);
	const feld = useRef<HTMLInputElement>(null);
	const gesperrt = ki.hinweis?.art === 'gesperrt';
	const doppelt = text.trim() !== '' && laeuftSchon(laeufe, text);
	const kannSenden = text.trim() !== '' && !sendet && !gesperrt && !doppelt;
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
					maxLength={BILDLAUF_TEXT_ZEICHEN}
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
					<SendenKreis />
				</button>
			</form>
			<div className="flex justify-end">
				<ClaudeWahl />
			</div>
			{fehler && (
				<p role="alert" className="text-xs text-fehler" data-figur-fehler>
					{fehler}
				</p>
			)}
			{doppelt && !fehler && (
				<p className="text-xs text-leise" data-figur-laeuft-schon>
					Diese Figur wird schon gemalt. Ändere die Beschreibung für eine weitere Fassung.
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

	const { laeufe } = useBildlaufLaeufe();
	const [fehler, setFehler] = useState<string | null>(null);
	const zeigeHinweis = useHinweis();
	// Steht etwas im Suchfeld, zeigt die Schublade keine Kacheln laufender Aufträge.
	const bildlauf = woerter.length === 0;
	const neueFigur = bildlauf && laeufe.some((l) => l.art === 'figur' && !l.ziel.figur);
	const nochmal = (stand: BildlaufStand) =>
		void starteFigur(stand.text).then(
			() => bildlaufAktion(stand.id, 'verwerfen'),
			(grund: unknown) => setFehler(meldung(grund)),
		);
	// 199-03: Entfernen geht sofort, der Hinweis bietet „Rückgängig“ (wie ⌫ im Blatt).
	const entferne = (figur: BibliotheksFigur, pose: Pose) =>
		void sende<{ rueckweg: FigurRueckweg }>(`/api/figuren/posen/${encodeURIComponent(pose.id)}/entfernen`).then(
			({ rueckweg }) => {
				void ladeFigurenNeu();
				zeigeHinweis({
					text: rueckweg.art === 'figur' ? `${figur.name} entfernt.` : 'Pose entfernt.',
					aktion: {
						titel: 'Rückgängig',
						ausfuehren: () =>
							void sende('/api/figuren/wiederherstellen', { rueckweg }).then(
								() => ladeFigurenNeu(),
								(grund: unknown) => zeigeHinweis({ text: meldung(grund), art: 'fehler' }),
							),
					},
				});
			},
			(grund: unknown) => zeigeHinweis({ text: meldung(grund), art: 'fehler' }),
		);
	const [umbenennen, setUmbenennen] = useState<string | null>(null);

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
					ausloeser={KACHEL_MEHR}
					eintraege={[
						...(figur.eingebaut
							? []
							: [
									{
										titel: 'Figur umbenennen',
										symbol: 'stift' as const,
										waehle: () => setUmbenennen(figur.id),
									},
								]),
						{
							titel: grundpose ? 'Figur entfernen' : 'Pose entfernen',
							symbol: 'papierkorb',
							gefahr: true,
							waehle: () => entferne(figur, pose),
						},
					]}
				/>
			</div>
		);
	};

	const steuerung = (
		<>
			<Schubladensuche beschriftung="Figuren suchen" wert={suche} setWert={setSuche} />
			{bildFeld(t.ki) === 'grund' && <OhneBildApi grund={t.ki.bilder.grund} />}
			{bildFeld(t.ki) === 'feld' && (
				<FigurBeschreiben ki={t.ki} laeufe={laeufe} fehler={fehler} setFehler={setFehler} />
			)}
		</>
	);

	return (
		<>
			<Schublade titel={kopf('figuren').titel} daten={{ 'data-schublade-figuren': '' }} steuerung={steuerung}>
				{neueFigur && (
					<Schubladenabschnitt titel="Neue Figur" daten={{ 'data-bildlauf-neu': '' }}>
						<div className={raster(3)}>
							<BildlaufKacheln laeufe={laeufe} figur={null} nochmal={nochmal} nur="fehler" />
							<BildlaufKacheln laeufe={laeufe} figur={null} nochmal={nochmal} nur="offen" />
						</div>
					</Schubladenabschnitt>
				)}
				{gezeigt.map(({ figur, posen }) => (
					<Schubladenabschnitt key={figur.id} daten={{ 'data-figuren-gruppe': figur.id }}>
						<FigurTitel
							alle={figuren}
							figur={figur}
							bearbeitet={umbenennen === figur.id}
							setBearbeitet={(an) => setUmbenennen(an ? figur.id : null)}
						/>
						{/* 253: woher die Figur kam, und was die Lehrkraft an ihr prüfen sollte, direkt unter dem Namen. */}
						{(figur.aus || figur.vermerk) && (
							<p className="-mt-1.5 text-xs" data-figur-herkunft={figur.id}>
								{figur.aus && <span className="text-leise">{`aus „${figur.aus}“`}</span>}
								{figur.aus && figur.vermerk && <span className="text-leise"> · </span>}
								{figur.vermerk && (
									<>
										<span className="font-medium text-warnung" data-figur-vermerk>
											{figur.vermerk}
										</span>{' '}
										<button
											type="button"
											data-figur-geprueft={figur.id}
											title="Vermerk entfernen: Die Figur ist geprüft."
											className="rounded px-1 font-medium text-brand-700 hover:bg-brand-50"
											onClick={() =>
												void sende(`/api/figuren/${encodeURIComponent(figur.id)}/geprueft`, {}).then(
													() => ladeFigurenNeu(),
													(grund: unknown) => zeigeHinweis({ text: meldung(grund), art: 'fehler' }),
												)
											}
										>
											Geprüft
										</button>
									</>
								)}
							</p>
						)}
						<div className={raster(3)}>
							{bildlauf && (
								<BildlaufKacheln laeufe={laeufe} figur={figur.id} nochmal={nochmal} nur="fehler" />
							)}
							{posen.map((pose) => kachel(figur, pose))}
							{bildlauf && (
								<BildlaufKacheln laeufe={laeufe} figur={figur.id} nochmal={nochmal} nur="offen" />
							)}
						</div>
					</Schubladenabschnitt>
				))}
				{gezeigt.length === 0 && <Schubladenleer>{nichtsPasst(suche)}</Schubladenleer>}
			</Schublade>
			{holen}
		</>
	);
};
