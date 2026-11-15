import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';
import { vorschaubildAdresse } from '@schoolbox/kern/src/bildbefehle';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Dialog } from '../bausteine/Dialog';
import { FELD_KLASSEN, klassen, knopfKlassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import {
	KACHELNAME,
	NOTIZ,
	SCHUBLADENKACHEL,
	Schubladenleer,
	Schubladensuche,
	STEUER_SEGMENT,
} from '../bausteine/Schublade';
import { nichtsPasst, raster } from '../bausteine/schubladenhilfe';
import { Segment } from '../bausteine/Segment';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { Zeile } from '../bausteine/Zeile';
import { useLaden } from '../lib/laden';
import type { BildSteuerung, BildWerte, FreiAblegen } from './bild';
import { gesehen, merkeGesehen, passt } from './bild-sammlung';
import { bildBeschreibung, bilderZahl } from './bildpanel-hilfe';
import { elementZu } from './darstellung';
import type { AblegenTeile } from './gestaltung/ablegen/ablegen';
import { AblageKachel } from './gestaltung/ablegen/Kachel';
import type { GestaltungsGut } from './gestaltung/ablegen/ziehgut';
import { adresseVon } from './gestaltung/figuren-quelle';
import { FigurAuswahl } from './gestaltung/inspektor/figur-teile';
import { KACHEL_MEHR } from './schubladen/kreise';

/** Der Hinweis selbst; 103 zeigt ihn auch, wenn ein Foto aus dem Finder aufs Blatt fällt. */
export const FOTO_HINWEIS = 'Bitte keine Fotos, auf denen Kinder zu erkennen sind.';

export const Laeuft = ({ text }: { text: string }) => (
	<p className="flex items-center gap-2 text-leise" role="status">
		<Symbol name="laden" className="size-3.5 animate-spin" />
		{text}
	</p>
);

/**
 * „Foto hochladen“ ist ein `<label>` für ein verstecktes Dateifeld: So öffnet Safari auf dem iPad die Fotomediathek
 * zuverlässig. Das Feld bleibt immer im Dokument, auch während der Hinweis steht. `frei`: aus der Bilder-Schublade legt
 * das Foto ein neues Bild in die Mitte (199-02), außer ein leerer Platz ist gewählt.
 */
export const Hochladen = ({
	aus = false,
	bild,
	breit = false,
	frei,
}: {
	bild: BildSteuerung;
	frei?: FreiAblegen | undefined;
	/** Über die ganze Breite, wie in der Bilder-Schublade und im Inspektor. */
	breit?: boolean;
	/** 199-17: gesperrtes Blatt (Versionsvorschau, Konflikt) wie die Kacheln daneben. */
	aus?: boolean;
}) => {
	const feld = useId();
	const [hinweis, setHinweis] = useState(false);
	const eingabe = (
		<input
			id={feld}
			type="file"
			accept="image/*"
			// 199-N04: mehrere auf einmal; die erste wird eingesetzt, die übrigen liegen in „Dieser Ordner“.
			multiple
			className="sr-only"
			tabIndex={-1}
			data-bild-datei
			onChange={(e) => {
				const dateien = [...(e.target.files ?? [])];
				e.target.value = '';
				setHinweis(false);
				if (dateien.length > 0) {
					void bild.hochladen(dateien, frei);
				}
			}}
		/>
	);
	if (hinweis) {
		return (
			<div className="w-full basis-full rounded-xl border border-entwurf bg-warnung-hell p-3" role="note">
				{eingabe}
				<p className="font-medium">{FOTO_HINWEIS}</p>
				{/* 199-23: eine Zeile wie in jedem Dialog, „Abbrechen“ links, die Hauptaktion rechts. */}
				<div className="mt-3 flex items-center justify-end gap-2" data-foto-hinweis-knoepfe>
					<Knopf art="leise" groesse="klein" onClick={() => setHinweis(false)}>
						Abbrechen
					</Knopf>
					<label
						htmlFor={feld}
						className={knopfKlassen('haupt', 'cursor-pointer', 'klein')}
						data-hauptaktion
						onClick={merkeGesehen}
					>
						Verstanden, Foto wählen
					</label>
				</div>
			</div>
		);
	}
	return (
		<>
			{eingabe}
			{gesehen() && !aus ? (
				<label
					htmlFor={feld}
					className={knopfKlassen('zweit', klassen('cursor-pointer', breit && 'w-full'), 'standard')}
				>
					<Symbol name="hochladen" />
					Foto hochladen
				</label>
			) : (
				<Knopf
					art="zweit"
					className={breit ? 'w-full' : undefined}
					disabled={aus}
					onClick={() => setHinweis(true)}
				>
					<Symbol name="hochladen" />
					Foto hochladen
				</Knopf>
			)}
		</>
	);
};

/**
 * Die drei Gruppen der Bildauswahl, in Schublade und Dialog gleich (199-12, 199-13): erst die Bilder dieses Ordners,
 * dann die der anderen Ordner, dann die mitgelieferten. Figuren stehen nur in „Figuren“ (55).
 */
export const BILDGRUPPEN = [
	{ wert: 'mappe', titel: 'Dieser Ordner' },
	{ wert: 'meine', titel: 'Andere Ordner' },
	{ wert: 'sammlung', titel: 'Mitgeliefert' },
] as const;

export type SammlungsGruppe = (typeof BILDGRUPPEN)[number]['wert'];

const bildName = (eintrag: SammlungsBild) => bildBeschreibung(eintrag) || eintrag.name;

/** Ziehen aus der Bilder-Schublade (103): das Gut zu einem Eintrag, sobald die Maße der Vorschau bekannt sind. */
export type BildZiehen = (
	eintrag: SammlungsBild,
	natur: { breite: number; hoehe: number } | null,
) => { gut: GestaltungsGut; teile: AblegenTeile } | null;

/**
 * Eine Bildkachel, in Schublade und Dialog gleich (199-12). `entferne`: das ⋯ an der Kachel mit „Entfernen“; steht das
 * Bild noch in einem Material, ist der Eintrag gesperrt und sagt, wo (199, entschieden vom Admin).
 */
const Kachel = ({
	aus,
	eintrag,
	entferne,
	waehle,
	ziehen,
}: {
	eintrag: SammlungsBild;
	waehle: () => void;
	aus: boolean;
	ziehen?: BildZiehen | undefined;
	entferne?: ((eintrag: SammlungsBild) => void) | undefined;
}) => {
	const [natur, setNatur] = useState<{ breite: number; hoehe: number } | null>(null);
	const name = bildName(eintrag);
	const klasse = klassen(SCHUBLADENKACHEL, 'flex w-full flex-col items-center gap-1 p-2');
	const inhalt = (
		<>
			<img
				src={vorschaubildAdresse(`/ansicht/${eintrag.schluessel}`)}
				alt=""
				loading="lazy"
				decoding="async"
				draggable={false}
				className="h-24 w-full object-contain"
				onLoad={(e) => {
					const { naturalHeight: hoehe, naturalWidth: breite } = e.currentTarget;
					setNatur(breite > 0 ? { breite, hoehe } : null);
				}}
			/>
			<span className={KACHELNAME}>{name}</span>
		</>
	);
	const zug = ziehen?.(eintrag, natur);
	const genutzt = eintrag.genutzt?.[0];
	const mehr = entferne && eintrag.kopien && (
		<Menue
			name="Weitere Aktionen"
			rechtsbuendig
			ausloeser={KACHEL_MEHR}
			eintraege={[
				{
					titel: 'Entfernen',
					symbol: 'papierkorb',
					gefahr: true,
					aus: aus || Boolean(genutzt),
					...(genutzt ? { beschreibung: `Steht in „${genutzt}“.` } : {}),
					waehle: () => entferne(eintrag),
				},
			]}
		/>
	);
	return (
		<li className="group relative min-w-0">
			{zug ? (
				<AblageKachel
					teile={zug.teile}
					gut={zug.gut}
					beschriftung={name}
					className={klasse}
					aus={aus}
					klick={waehle}
					daten={{ 'data-sammlung-bild': eintrag.schluessel }}
				>
					{inhalt}
				</AblageKachel>
			) : (
				<Tooltip text={eintrag.mappe ? `${name} · ${eintrag.mappe}` : name}>
					<button
						type="button"
						className={klasse}
						disabled={aus}
						data-sammlung-bild={eintrag.schluessel}
						onClick={waehle}
					>
						{inhalt}
					</button>
				</Tooltip>
			)}
			{mehr}
		</li>
	);
};

/** Ein Wortlaut für jede Suche ohne Treffer, in der Schublade wie im Dialog. */
const leerText = (suche: string) => (suche.trim() ? nichtsPasst(suche) : 'Hier gibt es noch keine Bilder.');

/** Kacheln einer Gruppe mit Laden, Fehler und Leerzustand; Schublade und Dialog zeigen dieselben Kacheln (199-12). */
export const SammlungsKacheln = ({
	aus = false,
	entferne,
	fehler,
	geladen,
	gruppe,
	klein = false,
	liste,
	suche,
	vorne,
	waehle,
	ziehen,
}: {
	geladen: boolean;
	fehler: string | null;
	gruppe: SammlungsGruppe;
	liste: SammlungsBild[];
	suche: string;
	waehle: (eintrag: SammlungsBild) => void;
	klein?: boolean;
	aus?: boolean;
	/** Nur in der Bilder-Schublade: Kacheln lassen sich aufs Blatt ziehen (103). */
	ziehen?: BildZiehen | undefined;
	/** Erste `<li>` derselben Liste: die Canva-Aufträge in „Dieser Ordner“. */
	vorne?: ReactNode;
	entferne?: ((eintrag: SammlungsBild) => void) | undefined;
}) => (
	<>
		{fehler && <p className="font-medium text-fehler">{fehler}</p>}
		{!geladen && !fehler && <Laeuft text="Bilder werden geladen …" />}
		{geladen && liste.length === 0 && !vorne && <Schubladenleer>{leerText(suche)}</Schubladenleer>}
		<ul className={klein ? raster(2) : raster(4)} data-sammlung={gruppe}>
			{vorne}
			{liste.map((eintrag) => (
				<Kachel
					key={eintrag.schluessel}
					eintrag={eintrag}
					aus={aus}
					waehle={() => waehle(eintrag)}
					ziehen={ziehen}
					entferne={entferne}
				/>
			))}
		</ul>
	</>
);

/**
 * „Bild wählen“ (199-13): dieselben drei Gruppen, Suche und Kacheln wie die Bilder-Schublade. Figuren stehen nur in
 * der Schublade „Figuren“ (55); die Leitfigur tauscht ihre Pose im Inspektor.
 */
export const SammlungDialog = ({
	adresse,
	schliessen,
	waehle,
}: {
	adresse: string;
	schliessen: () => void;
	waehle: (eintrag: SammlungsBild) => void;
}) => {
	const { daten, fehler } = useLaden<Sammlung>(`${adresse}/bilder`);
	const [gruppe, setGruppe] = useState<SammlungsGruppe>('mappe');
	const [suche, setSuche] = useState('');
	const liste = useMemo(() => (daten ? daten[gruppe].filter((e) => passt(e, suche)) : []), [daten, gruppe, suche]);
	const zahl = daten ? bilderZahl(daten[gruppe].length) : undefined;

	return (
		<Dialog titel="Bild wählen" schliessen={schliessen} breit>
			<Schubladensuche beschriftung="Bilder suchen" wert={suche} setWert={setSuche} />
			{/* 199-N06: Der Zähler steht unter dem Umschalter; daneben ragte er aus dem Fenster. */}
			<div className="flex flex-col gap-1">
				<Segment
					beschriftung="Welche Bilder?"
					className={STEUER_SEGMENT}
					werte={[...BILDGRUPPEN]}
					wert={gruppe}
					waehle={setGruppe}
				/>
				{zahl && (
					<span className={NOTIZ} data-bilder-zahl>
						{zahl}
					</span>
				)}
			</div>
			<SammlungsKacheln
				geladen={Boolean(daten)}
				fehler={fehler?.message ?? null}
				gruppe={gruppe}
				liste={liste}
				suche={suche}
				waehle={waehle}
			/>
		</Dialog>
	);
};

/**
 * Im s/w-Druck kann eine andere Datei erscheinen als am Bildschirm (041); entschieden wird das nur an einer Stelle.
 * 199-16: Nur dann steht der Hinweis; Graustufen zeigt die s/w-Ansicht schon selbst.
 */
const Druckfassung = ({ adresse, src }: { adresse: string; src: string }) => {
	const { daten } = useLaden<{ strich: string | null }>(`${adresse}/bilder/fassung?src=${encodeURIComponent(src)}`);
	if (!daten?.strich) {
		return null;
	}
	return (
		<p className="flex gap-2 rounded-xl bg-brand-50 p-3" data-hinweis="druckfassung">
			<Symbol name="drucker" className="size-3.5 flex-none" />
			{`Im s/w-PDF erscheint hier die Strichzeichnung „${daten.strich}“.`}
		</p>
	);
};

const Hinweise = ({ adresse, w }: { adresse: string; w: BildWerte }) => {
	if (!w.unscharf && !w.sw) {
		return null;
	}
	return (
		<div className="mt-2 flex flex-col gap-2" data-bild-hinweise>
			{w.sw && <Druckfassung adresse={adresse} src={w.src} />}
			{w.unscharf && (
				<p className="flex gap-2 rounded-xl bg-warnung-hell p-3" data-hinweis="dpi">
					<Symbol name="achtung" className="size-3.5 flex-none" />
					Das Bild ist für diese Größe zu klein und wird im Druck unscharf. Mach es kleiner oder nimm ein
					größeres Bild.
				</p>
			)}
		</div>
	);
};

/** Größe als Regler; im Blatt geht es auch an den Ecken. Die Quelle ändert erst das Loslassen. */
const Groesse = ({ bild, w }: { bild: BildSteuerung; w: BildWerte }) => {
	const vorher = Math.round(w.breite);
	const [jetzt, setJetzt] = useState(vorher);
	const regler = useRef<HTMLInputElement>(null);
	const setze = useRef({ bild, vorher });

	useEffect(() => {
		setze.current = { bild, vorher };
	});

	useEffect(() => {
		setJetzt(vorher);
	}, [vorher]);

	useEffect(() => {
		const element = regler.current;
		if (!element) {
			return undefined;
		}
		const fertig = () => {
			const px = Number(element.value);
			if (px !== setze.current.vorher) {
				setze.current.bild.setzeBreite(px);
			}
		};
		element.addEventListener('change', fertig);
		return () => element.removeEventListener('change', fertig);
	}, []);

	return (
		<div>
			<Zeile titel="Größe" hilfe="Geht auch im Blatt: an einer Ecke ziehen.">
				<span className="text-xs text-leise tabular-nums">{`${jetzt} px`}</span>
			</Zeile>
			<input
				ref={regler}
				type="range"
				aria-label="Größe des Bildes"
				className="h-zeile w-full accent-brand-500"
				min={Math.min(24, vorher)}
				max={Math.max(w.max, vorher)}
				step={1}
				value={jetzt}
				data-bild-groesse
				onChange={(e) => {
					const px = Number(e.target.value);
					setJetzt(px);
					bild.zeigeBreite(px);
				}}
			/>
		</div>
	);
};

const Beschreibung = ({ aus, bild, w }: { bild: BildSteuerung; w: BildWerte; aus: boolean }) => {
	const [text, setText] = useState(w.alt);

	useEffect(() => {
		setText(w.alt);
	}, [w.alt, w.nr]);

	return (
		<label className="block">
			<span className="mt-1 mb-0.5 flex min-h-5 items-center text-leise">Beschreibung</span>
			<input
				type="text"
				className={FELD_KLASSEN}
				disabled={aus}
				value={text}
				data-bild-beschreibung
				enterKeyHint="done"
				onChange={(e) => setText(e.target.value)}
				onBlur={() => bild.beschreibe(text)}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.currentTarget.blur();
					}
				}}
			/>
		</label>
	);
};

export const BildDarstellung = ({ bild }: { bild: BildSteuerung }) => {
	const w = bild.werte;
	return bild.aktiv && w && !w.platzhalter ? <Groesse bild={bild} w={w} /> : null;
};

/**
 * Für Bilder, Bildplatzhalter und leere Bildrahmen (199-15, 199-17): zuerst austauschen bzw. einsetzen, dann die
 * Hinweise zum Druck, dann die Beschreibung. Entfernen geht wie bei aller Gestaltung über ⌫ und ⋯. Die Größe steht
 * unter „Darstellung“. Die Leitfigur im Tipp tauscht Figur und Pose wie die freie Figur (199-11). Bei gesperrtem Blatt
 * bleibt alles sichtbar, die Knöpfe sind aus.
 */
export const Bildwerkzeug = ({ bild }: { bild: BildSteuerung }) => {
	const [sammlung, setSammlung] = useState(false);
	const w = bild.werte;
	if (!w) {
		return null;
	}
	const aus = !bild.aktiv || bild.arbeit !== null;
	const leitfigur = w.figur && !w.frei && bild.doc ? elementZu(bild.doc, w.nr) : null;
	if (leitfigur) {
		return (
			<div data-bildwerkzeug="figur">
				<FigurAuswahl
					adresse={adresseVon(bild.doc) ?? bild.adresse}
					aktiv={bild.aktiv}
					an={0}
					nr={w.nr}
					quelle={leitfigur.outerHTML}
					fuehreAus={bild.fuehreAus}
					mitTitel
				/>
				<Hinweise adresse={bild.adresse} w={w} />
			</div>
		);
	}
	return (
		<div data-bildwerkzeug={w.platzhalter ? 'platzhalter' : 'bild'}>
			<Zeile titel={w.platzhalter ? 'Bild einsetzen' : 'Austauschen'} darunter>
				<div className="flex flex-col gap-1">
					{bild.arbeit === 'hochladen' || bild.arbeit === 'sammlung' ? (
						<Laeuft
							text={bild.arbeit === 'hochladen' ? 'Foto wird hochgeladen …' : 'Bild wird eingesetzt …'}
						/>
					) : (
						<>
							<Hochladen bild={bild} breit aus={aus} />
							<Knopf art="zweit" className="w-full" disabled={aus} onClick={() => setSammlung(true)}>
								<Symbol name="bild" />
								Aus Bildern wählen
							</Knopf>
						</>
					)}
				</div>
			</Zeile>
			{!w.platzhalter && <Hinweise adresse={bild.adresse} w={w} />}
			{!w.platzhalter && <Beschreibung bild={bild} w={w} aus={!bild.aktiv} />}
			{sammlung && (
				<SammlungDialog
					adresse={bild.adresse}
					schliessen={() => setSammlung(false)}
					waehle={(eintrag) => {
						setSammlung(false);
						void bild.uebernimm(eintrag.schluessel, bildBeschreibung(eintrag));
					}}
				/>
			)}
		</div>
	);
};
