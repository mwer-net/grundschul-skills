import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';
import { vorschaubildAdresse } from '@schoolbox/kern/src/bildbefehle';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Chip } from '../bausteine/Chip';
import { Dialog } from '../bausteine/Dialog';
import { FELD_KLASSEN, klassen, knopfKlassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { KACHELNAME, nichtsPasst, raster, SCHUBLADENKACHEL, Schubladenleer } from '../bausteine/Schublade';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { Zeile } from '../bausteine/Zeile';
import { useLaden } from '../lib/laden';
import type { BildSteuerung, BildWerte, NeuerPlatz } from './bild';
import { beschreibungAus } from './bild';
import { gesehen, merkeGesehen, passt } from './bild-sammlung';
import type { AblegenTeile } from './gestaltung/ablegen/ablegen';
import { AblageKachel } from './gestaltung/ablegen/Kachel';
import type { GestaltungsGut } from './gestaltung/ablegen/ziehgut';
import { EIGENE_GESCHICHTE } from './tasten';

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
 * zuverlässig. Das Feld bleibt immer im Dokument, auch während der Hinweis steht. `neu`: ohne gewähltes Bild entsteht
 * ein neuer Bild-Baustein (Bilder-Schublade).
 */
export const Hochladen = ({
	bild,
	breit = false,
	neu,
}: {
	bild: BildSteuerung;
	neu?: NeuerPlatz | undefined;
	/** Über die ganze Breite, wie in der Bilder-Schublade. */
	breit?: boolean;
}) => {
	const feld = useId();
	const [hinweis, setHinweis] = useState(false);
	const eingabe = (
		<input
			id={feld}
			type="file"
			accept="image/*"
			className="sr-only"
			tabIndex={-1}
			data-bild-datei
			onChange={(e) => {
				const datei = e.target.files?.[0];
				e.target.value = '';
				setHinweis(false);
				if (datei) {
					void bild.hochladen(datei, neu);
				}
			}}
		/>
	);
	if (hinweis) {
		return (
			<div className="basis-full rounded-xl border border-entwurf bg-warnung-hell p-4" role="note">
				{eingabe}
				<p className="font-medium">{FOTO_HINWEIS}</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<label htmlFor={feld} className={knopfKlassen('haupt', 'cursor-pointer')} onClick={merkeGesehen}>
						Verstanden, Foto wählen
					</label>
					<Knopf art="leise" onClick={() => setHinweis(false)}>
						Abbrechen
					</Knopf>
				</div>
			</div>
		);
	}
	return (
		<>
			{eingabe}
			{gesehen() ? (
				<label htmlFor={feld} className={knopfKlassen('zweit', klassen('cursor-pointer', breit && 'w-full'))}>
					<Symbol name="hochladen" />
					Foto hochladen
				</label>
			) : (
				<Knopf art="zweit" className={breit ? 'w-full' : undefined} onClick={() => setHinweis(true)}>
					<Symbol name="hochladen" />
					Foto hochladen
				</Knopf>
			)}
		</>
	);
};

const GRUPPEN = [
	{ art: 'sammlung', titel: 'Willi & Co.' },
	{ art: 'mappe', titel: 'Dieser Ordner' },
	{ art: 'meine', titel: 'Meine Bilder' },
] as const;

export type SammlungsGruppe = (typeof GRUPPEN)[number]['art'];

/** Ziehen aus der Bilder-Schublade (103): das Gut zu einem Eintrag, sobald die Maße der Vorschau bekannt sind. */
export type BildZiehen = (
	eintrag: SammlungsBild,
	natur: { breite: number; hoehe: number } | null,
) => { gut: GestaltungsGut; teile: AblegenTeile } | null;

const Kachel = ({
	aus,
	eintrag,
	klein,
	waehle,
	ziehen,
}: {
	eintrag: SammlungsBild;
	waehle: () => void;
	klein: boolean;
	aus: boolean;
	ziehen?: BildZiehen | undefined;
}) => {
	const [natur, setNatur] = useState<{ breite: number; hoehe: number } | null>(null);
	const name = eintrag.alt[0] ?? eintrag.name;
	// In der Schublade die Kachel aller Schubladen, im Dialog wie bisher.
	const klasse = klein
		? klassen(SCHUBLADENKACHEL, 'flex w-full flex-col items-center gap-1 p-2')
		: 'flex w-full flex-col gap-1 rounded-xl border border-rand bg-flaeche p-2 text-left hover:border-brand-200 hover:bg-flaeche-2 disabled:opacity-50';
	const inhalt = (
		<>
			<img
				src={vorschaubildAdresse(`/ansicht/${eintrag.schluessel}`)}
				alt=""
				loading="lazy"
				decoding="async"
				draggable={false}
				className={klein ? 'h-24 w-full object-contain' : 'h-28 w-full rounded-lg bg-papier object-contain'}
				onLoad={(e) => {
					const { naturalHeight: hoehe, naturalWidth: breite } = e.currentTarget;
					setNatur(breite > 0 ? { breite, hoehe } : null);
				}}
			/>
			<span className={klein ? KACHELNAME : 'truncate font-medium'}>{name}</span>
			{eintrag.mappe && (
				<span className={klein ? KACHELNAME : 'truncate text-sm text-leise'}>{eintrag.mappe}</span>
			)}
		</>
	);
	const zug = ziehen?.(eintrag, natur);
	const knopf = (
		<button
			type="button"
			className={klasse}
			disabled={aus}
			data-sammlung-bild={eintrag.schluessel}
			onClick={waehle}
		>
			{inhalt}
		</button>
	);
	return (
		<li className="min-w-0">
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
			) : klein ? (
				<Tooltip text={name}>{knopf}</Tooltip>
			) : (
				knopf
			)}
		</li>
	);
};

/** Ein Wortlaut für jede Suche ohne Treffer, in der Schublade wie im Dialog. */
const leerText = (suche: string) => (suche.trim() ? nichtsPasst(suche) : 'Hier gibt es noch keine Bilder.');

/** Kacheln einer Gruppe mit Laden, Fehler und Leerzustand; im Dialog groß, in der Bilder-Schublade klein. */
export const SammlungsKacheln = ({
	aus = false,
	fehler,
	geladen,
	gruppe,
	klein = false,
	liste,
	suche,
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
}) => (
	<>
		{fehler && <p className="font-medium text-fehler">{fehler}</p>}
		{!geladen && !fehler && <Laeuft text="Bilder werden geladen …" />}
		{geladen &&
			liste.length === 0 &&
			(klein ? (
				<Schubladenleer>{leerText(suche)}</Schubladenleer>
			) : (
				<p className="text-leise">{leerText(suche)}</p>
			))}
		<ul
			className={klein ? raster(2) : 'grid grid-cols-4 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2'}
			data-sammlung={gruppe}
		>
			{liste.map((eintrag) => (
				<Kachel
					key={eintrag.schluessel}
					eintrag={eintrag}
					klein={klein}
					aus={aus}
					waehle={() => waehle(eintrag)}
					ziehen={ziehen}
				/>
			))}
		</ul>
	</>
);

/** Bilder zum Austauschen: Leitfiguren und Grafiken aus assets/, Bilder dieser Mappe und aller anderen. */
export const SammlungDialog = ({
	adresse,
	schliessen,
	waehle,
}: {
	adresse: string;
	schliessen: () => void;
	waehle: (eintrag: SammlungsBild) => void;
}) => {
	// >> 177
	const { daten: roh, fehler } = useLaden<Sammlung>(`${adresse}/bilder`);
	// Unter „Willi & Co.“ stehen die Posen der Figurenbibliothek vor den übrigen Bildern aus assets/.
	const daten = useMemo(() => roh && { ...roh, sammlung: [...roh.figuren, ...roh.sammlung] }, [roh]);
	// << 177
	const [gruppe, setGruppe] = useState<SammlungsGruppe>('sammlung');
	const [suche, setSuche] = useState('');
	const liste = useMemo(() => (daten ? daten[gruppe].filter((e) => passt(e, suche)) : []), [daten, gruppe, suche]);

	return (
		<Dialog titel="Bild aus der Sammlung" schliessen={schliessen} breit>
			<div className="flex flex-wrap items-center gap-2" role="group" aria-label="Welche Bilder?">
				{GRUPPEN.map((g) => (
					<Chip
						key={g.art}
						titel={`${g.titel}${daten ? ` (${daten[g.art].length})` : ''}`}
						aktiv={gruppe === g.art}
						waehle={() => setGruppe(g.art)}
					/>
				))}
			</div>
			<label className="relative block">
				<span className="sr-only">Bilder suchen</span>
				<Symbol
					name="suche"
					className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-leise"
				/>
				<input
					{...EIGENE_GESCHICHTE}
					type="search"
					className="h-knopf w-full rounded-lg border border-rand bg-papier pr-4 pl-12 placeholder:text-leise focus:border-brand-500 focus:bg-flaeche focus:outline-none"
					placeholder="Suchen, z. B. Willi oder Kartoffel"
					autoComplete="off"
					spellCheck={false}
					value={suche}
					onChange={(e) => setSuche(e.target.value)}
				/>
			</label>
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

const Vorschau = ({ w }: { w: BildWerte }) => (
	<figure className="mt-3">
		<img
			src={w.url}
			alt=""
			className="max-h-40 w-full rounded-xl border border-rand bg-[repeating-conic-gradient(#f1efe9_0_25%,#fff_0_50%)] bg-[length:16px_16px] object-contain"
		/>
		{w.natur && (
			<figcaption className="mt-1 text-sm text-leise">{`${w.natur.breite} × ${w.natur.hoehe} Pixel`}</figcaption>
		)}
	</figure>
);

/** Im s/w-Druck kann eine andere Datei erscheinen als am Bildschirm (041); entschieden wird das nur an einer Stelle. */
const Druckfassung = ({ adresse, src }: { adresse: string; src: string }) => {
	const { daten } = useLaden<{ strich: string | null }>(`${adresse}/bilder/fassung?src=${encodeURIComponent(src)}`);
	if (!daten) {
		return null;
	}
	return (
		<p className="flex gap-2 rounded-xl bg-brand-50 p-3" data-hinweis="druckfassung">
			<Symbol name="drucker" className="size-3.5 flex-none" />
			{daten.strich
				? `Im s/w-PDF erscheint hier die Strichzeichnung „${daten.strich}“.`
				: 'Im s/w-PDF erscheint dieses Bild in Graustufen.'}
		</p>
	);
};

const Hinweise = ({ adresse, w }: { adresse: string; w: BildWerte }) => {
	if (!w.unscharf && !w.sw) {
		return null;
	}
	return (
		<div className="mt-3 flex flex-col gap-3" data-bild-hinweise>
			{w.sw && <Druckfassung adresse={adresse} src={w.src} />}
			{w.unscharf && (
				<p className="flex gap-2 rounded-xl bg-warnung-hell p-3" data-hinweis="dpi">
					<Symbol name="achtung" className="size-3.5 flex-none" />
					{`Das Bild ist für diese Größe zu klein und wird im Druck unscharf (${w.dpi ?? 0} dpi). Mach es kleiner oder nimm ein größeres Bild.`}
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

const Beschreibung = ({ bild, w }: { bild: BildSteuerung; w: BildWerte }) => {
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
				placeholder="Was zeigt das Bild?"
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
 * Für Bilder, Bildplatzhalter und leere Bildrahmen: austauschen bzw. einsetzen, Beschreibung, Entfernen. Die Größe
 * steht unter „Darstellung“. Freie Bilder (103) zeigen es ohne Entfernen: Das geht dort über ⌫ und ⋯ wie bei aller
 * Gestaltung.
 */
export const Bildwerkzeug = ({ bild, ohneEntfernen = false }: { bild: BildSteuerung; ohneEntfernen?: boolean }) => {
	const [sammlung, setSammlung] = useState(false);
	const w = bild.werte;
	if (!bild.aktiv || !w) {
		return null;
	}
	const beschaeftigt = bild.arbeit !== null;
	return (
		<div data-bildwerkzeug={w.platzhalter ? 'platzhalter' : 'bild'}>
			{!w.platzhalter && <Vorschau w={w} />}
			{!w.platzhalter && <Hinweise adresse={bild.adresse} w={w} />}
			<span className="mb-0.5 flex min-h-5 items-center text-leise">
				{w.platzhalter ? 'Bild einsetzen' : 'Austauschen'}
			</span>
			<div className="flex flex-wrap gap-1">
				{bild.arbeit === 'hochladen' || bild.arbeit === 'sammlung' ? (
					<Laeuft text={bild.arbeit === 'hochladen' ? 'Foto wird hochgeladen …' : 'Bild wird eingesetzt …'} />
				) : (
					<>
						<Hochladen bild={bild} />
						<Knopf art="zweit" disabled={beschaeftigt} onClick={() => setSammlung(true)}>
							<Symbol name="bild" />
							Aus der Sammlung
						</Knopf>
					</>
				)}
			</div>
			{!w.platzhalter && (
				<>
					<Beschreibung bild={bild} w={w} />
					{!ohneEntfernen && (
						<Knopf art="gefahr" className="mt-2 self-start" disabled={beschaeftigt} onClick={bild.entferne}>
							<Symbol name="papierkorb" />
							Bild entfernen
						</Knopf>
					)}
				</>
			)}
			{sammlung && (
				<SammlungDialog
					adresse={bild.adresse}
					schliessen={() => setSammlung(false)}
					waehle={(eintrag) => {
						setSammlung(false);
						void bild.uebernimm(eintrag.schluessel, eintrag.alt[0] ?? beschreibungAus(eintrag.name));
					}}
				/>
			)}
		</div>
	);
};
