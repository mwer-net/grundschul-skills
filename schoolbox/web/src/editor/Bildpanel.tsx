import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Chip } from '../bausteine/Chip';
import { Dialog } from '../bausteine/Dialog';
import { knopfKlassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
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
		<Symbol name="laden" className="size-5 animate-spin" />
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
			<div className="basis-full rounded-xl border-2 border-entwurf bg-[#fff8e1] p-4" role="note">
				{eingabe}
				<p className="font-bold">Bitte keine Fotos, auf denen Kinder zu erkennen sind.</p>
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
	{ art: 'mappe', titel: 'Diese Mappe' },
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
			className="flex w-full flex-col gap-1 rounded-xl border-2 border-rand bg-white p-2 text-left hover:border-brand-200 hover:bg-brand-50"
			data-sammlung-bild={eintrag.schluessel}
			onClick={waehle}
		>
			<img
				src={`/ansicht/${eintrag.schluessel}`}
				alt=""
				loading="lazy"
				className="h-28 w-full rounded-lg bg-papier object-contain"
			/>
			<span className="truncate font-bold">{eintrag.alt[0] ?? eintrag.name}</span>
			{eintrag.mappe && <span className="truncate text-sm text-leise">{eintrag.mappe}</span>}
		</button>
	</li>
);

/** Bilder zum Austauschen: Leitfiguren und Grafiken aus assets/, Bilder dieser Mappe und aller anderen. */
const SammlungDialog = ({
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
					className="min-h-12 w-full rounded-full border-2 border-rand bg-papier pr-4 pl-12 placeholder:text-leise focus:border-brand-500 focus:bg-white focus:outline-none"
					placeholder="Suchen, z. B. Willi oder Kartoffel"
					autoComplete="off"
					spellCheck={false}
					value={suche}
					onChange={(e) => setSuche(e.target.value)}
				/>
			</label>
			{fehler && <p className="font-bold text-fehler">{fehler.message}</p>}
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

const Hinweise = ({ bild, w }: { bild: BildSteuerung; w: BildWerte }) => {
	if (!w.unscharf && !w.farbig) {
		return null;
	}
	return (
		<div className="mt-3 flex flex-col gap-3" data-bild-hinweise>
			{w.unscharf && (
				<p className="flex gap-2 rounded-xl bg-[#fff8e1] p-3" data-hinweis="dpi">
					<Symbol name="achtung" className="size-5 flex-none" />
					{`Das Bild ist für diese Größe zu klein und wird im Druck unscharf (${w.dpi ?? 0} dpi). Mach es kleiner oder nimm ein größeres Bild.`}
				</p>
			)}
			{w.farbig && (
				<div className="rounded-xl bg-[#fff8e1] p-3" data-hinweis="farbig">
					<p className="flex gap-2">
						<Symbol name="achtung" className="size-5 flex-none" />
						Das Bild ist farbig, das Blatt wird schwarz-weiß gedruckt.
					</p>
					{bild.arbeit === 'grau' ? (
						<div className="mt-2">
							<Laeuft text="Wird umgewandelt …" />
						</div>
					) : (
						<Knopf
							art="zweit"
							className="mt-2"
							disabled={bild.arbeit !== null}
							onClick={() => void bild.graustufen()}
						>
							In Graustufen umwandeln
						</Knopf>
					)}
					<p className="mt-2 text-leise">Für eine Strichzeichnung schreib Claude.</p>
				</div>
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
		<label className="mt-5 block">
			<span className="flex justify-between font-bold">
				Größe
				<span className="font-normal text-leise">{`${jetzt} px`}</span>
			</span>
			<input
				ref={regler}
				type="range"
				aria-label="Größe des Bildes"
				className="mt-2 h-11 w-full accent-brand-500"
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
			<span className="text-leise">Oder im Blatt an einer Ecke ziehen.</span>
		</label>
	);
};

const Beschreibung = ({ bild, w }: { bild: BildSteuerung; w: BildWerte }) => {
	const [text, setText] = useState(w.alt);

	useEffect(() => {
		setText(w.alt);
	}, [w.alt, w.nr]);

	return (
		<label className="mt-5 block">
			<span className="font-bold">Beschreibung</span>
			<input
				type="text"
				className="mt-2 min-h-12 w-full rounded-xl border-2 border-rand px-3 focus:border-brand-500 focus:outline-none"
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
			<span className="mt-1 block text-leise">
				{w.alt.trim() ? 'Hilft beim Prüfen und beim Vorlesen.' : 'Beschreibe das Bild in ein paar Worten.'}
			</span>
		</label>
	);
};

/** Für Bilder und Bildplatzhalter: austauschen bzw. einsetzen, Größe, Beschreibung, Entfernen. */
export const Bildwerkzeug = ({ bild }: { bild: BildSteuerung }) => {
	const [sammlung, setSammlung] = useState(false);
	const w = bild.werte;
	if (!bild.aktiv || !w) {
		return null;
	}
	const beschaeftigt = bild.arbeit !== null;
	return (
		<div className="mt-3" data-bildwerkzeug={w.platzhalter ? 'platzhalter' : 'bild'}>
			{w.platzhalter ? <p className="text-leise">{`Hier soll ein Bild hin: ${w.alt}`}</p> : <Vorschau w={w} />}
			{!w.platzhalter && <Hinweise bild={bild} w={w} />}
			<h3 className="mt-5 font-bold">{w.platzhalter ? 'Bild einsetzen' : 'Austauschen'}</h3>
			<div className="mt-2 flex flex-wrap gap-2">
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
					<Groesse bild={bild} w={w} />
					<Beschreibung bild={bild} w={w} />
					<Knopf art="gefahr" className="mt-4 -ml-5" disabled={beschaeftigt} onClick={bild.entferne}>
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
