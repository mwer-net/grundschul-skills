import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Chip } from '../bausteine/Chip';
import { Dialog } from '../bausteine/Dialog';
import { FELD_KLASSEN, knopfKlassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zeile } from '../bausteine/Zeile';
import { useLaden } from '../lib/laden';
import type { BildSteuerung, BildWerte } from './bild';
import { beschreibungAus } from './bild';

/** Der Hinweis zum Datenschutz kommt einmal je Sitzung im Browser (Leitlinie aus 007). */
const HINWEIS_GESEHEN = 'schoolbox-foto-hinweis';

const gesehen = () => {
	try {
		return window.sessionStorage.getItem(HINWEIS_GESEHEN) === '1';
	} catch {
		return false;
	}
};

const merkeGesehen = () => {
	try {
		window.sessionStorage.setItem(HINWEIS_GESEHEN, '1');
	} catch {
		// Ohne Speicher kommt der Hinweis eben noch einmal.
	}
};

const Laeuft = ({ text }: { text: string }) => (
	<p className="flex items-center gap-2 text-leise" role="status">
		<Symbol name="laden" className="size-3.5 animate-spin" />
		{text}
	</p>
);

/**
 * „Foto hochladen“ ist ein `<label>` für ein verstecktes Dateifeld: So öffnet Safari auf dem iPad die Fotomediathek
 * zuverlässig. Das Feld bleibt immer im Dokument, auch während der Hinweis steht.
 */
const Hochladen = ({ bild }: { bild: BildSteuerung }) => {
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
					void bild.hochladen(datei);
				}
			}}
		/>
	);
	if (hinweis) {
		return (
			<div className="basis-full rounded-xl border border-entwurf bg-warnung-hell p-4" role="note">
				{eingabe}
				<p className="font-medium">Bitte keine Fotos, auf denen Kinder zu erkennen sind.</p>
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
				<label htmlFor={feld} className={knopfKlassen('zweit', 'cursor-pointer')}>
					<Symbol name="hochladen" />
					Foto hochladen
				</label>
			) : (
				<Knopf art="zweit" onClick={() => setHinweis(true)}>
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

type Gruppe = (typeof GRUPPEN)[number]['art'];

const falte = (text: string) =>
	text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, ' ');

const passt = (eintrag: SammlungsBild, suche: string) => {
	const text = falte([eintrag.name, ...eintrag.alt, eintrag.mappe ?? ''].join(' '));
	return falte(suche)
		.split(' ')
		.filter(Boolean)
		.every((wort) => text.includes(wort));
};

const Kachel = ({ eintrag, waehle }: { eintrag: SammlungsBild; waehle: () => void }) => (
	<li>
		<button
			type="button"
			className="flex w-full flex-col gap-1 rounded-xl border border-rand bg-flaeche p-2 text-left hover:border-brand-200 hover:bg-flaeche-2"
			data-sammlung-bild={eintrag.schluessel}
			onClick={waehle}
		>
			<img
				src={`/ansicht/${eintrag.schluessel}`}
				alt=""
				loading="lazy"
				className="h-28 w-full rounded-lg bg-papier object-contain"
			/>
			<span className="truncate font-medium">{eintrag.alt[0] ?? eintrag.name}</span>
			{eintrag.mappe && <span className="truncate text-sm text-leise">{eintrag.mappe}</span>}
		</button>
	</li>
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
	const { daten, fehler } = useLaden<Sammlung>(`${adresse}/bilder`);
	const [gruppe, setGruppe] = useState<Gruppe>('sammlung');
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
					type="search"
					className="h-knopf w-full rounded-lg border border-rand bg-papier pr-4 pl-12 placeholder:text-leise focus:border-brand-500 focus:bg-flaeche focus:outline-none"
					placeholder="Suchen, z. B. Willi oder Kartoffel"
					autoComplete="off"
					spellCheck={false}
					value={suche}
					onChange={(e) => setSuche(e.target.value)}
				/>
			</label>
			{fehler && <p className="font-medium text-fehler">{fehler.message}</p>}
			{!daten && !fehler && <Laeuft text="Bilder werden geladen …" />}
			{daten && liste.length === 0 && (
				<p className="text-leise">{suche ? 'Kein Bild passt zur Suche.' : 'Hier gibt es noch keine Bilder.'}</p>
			)}
			<ul className="grid grid-cols-4 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2" data-sammlung={gruppe}>
				{liste.map((eintrag) => (
					<Kachel key={eintrag.schluessel} eintrag={eintrag} waehle={() => waehle(eintrag)} />
				))}
			</ul>
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
			<span className="flex h-zeile items-center text-leise">Beschreibung</span>
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

/** Für Bilder und Bildplatzhalter: austauschen bzw. einsetzen, Beschreibung, Entfernen. Die Größe steht unter „Darstellung“. */
export const Bildwerkzeug = ({ bild }: { bild: BildSteuerung }) => {
	const [sammlung, setSammlung] = useState(false);
	const w = bild.werte;
	if (!bild.aktiv || !w) {
		return null;
	}
	const beschaeftigt = bild.arbeit !== null;
	return (
		<div data-bildwerkzeug={w.platzhalter ? 'platzhalter' : 'bild'}>
			{w.platzhalter ? <p className="text-leise">{`Hier soll ein Bild hin: ${w.alt}`}</p> : <Vorschau w={w} />}
			{!w.platzhalter && <Hinweise adresse={bild.adresse} w={w} />}
			<h3 className="flex h-zeile items-center text-leise">{w.platzhalter ? 'Bild einsetzen' : 'Austauschen'}</h3>
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
					<Knopf art="gefahr" className="mt-2 self-start" disabled={beschaeftigt} onClick={bild.entferne}>
						<Symbol name="papierkorb" />
						Bild entfernen
					</Knopf>
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
