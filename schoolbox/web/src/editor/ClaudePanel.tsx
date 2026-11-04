import { BAUSTEINE } from '@schoolbox/kern/src/bausteine';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import type { Ort } from '@schoolbox/kern/src/referenz';
import { erzeugeReferenz } from '@schoolbox/kern/src/referenz';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Chip } from '../bausteine/Chip';
import { Dialog } from '../bausteine/Dialog';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import type { KiAuftrag, KiZustand, Vorschlag } from './ki';
import { limitHinweis, useKiAuftrag } from './ki';

const BEISPIELE = [
	'Mach die Aufgabe leichter',
	'Ergänze eine Aufgabe zum Weiterdenken',
	'Korrigiere die Rechtschreibung',
];
const AUSWAHL = [
	...BAUSTEINE.filter((b) => b.frei !== 'text' && b.frei !== 'block').map((b) => b.selektor),
	'.seite > *',
].join(',');

type Umfang = 'baustein' | 'seite' | 'blatt';

const kleinsterUmfang = (baustein: boolean, seite: boolean): Umfang => {
	if (baustein) {
		return 'baustein';
	}
	return seite ? 'seite' : 'blatt';
};

interface Eigenschaften {
	mappe: string;
	dok: string;
	adresse: string;
	zustand: KiZustand;
	neuLaden: () => void;
	/** Speichert den Stand des Editors, bevor Claude ihn liest. */
	vorbereiten: () => Promise<unknown>;
	zerlegung: Zerlegung | null;
	ort: Ort;
	loesung: boolean;
	nr: number | null;
	pfad: { nr: number; name: string }[] | null;
	frei: boolean;
}

/** Hebt in der Fassung von Claude die Bausteine hervor, die es im alten Blatt so nicht gibt. */
const hebeHervor = (alt: Document, neu: Document) => {
	const vorher = new Set([...alt.querySelectorAll(AUSWAHL)].map((e) => e.outerHTML));
	const anders = [...neu.querySelectorAll<HTMLElement>(AUSWAHL)].filter((e) => !vorher.has(e.outerHTML));
	for (const element of anders.filter((e) => !anders.some((d) => d !== e && e.contains(d)))) {
		element.style.outline = '3px solid #d97706';
		element.style.outlineOffset = '2px';
		element.dataset.kiGeaendert = '';
	}
};

/** Beide Fassungen ganz in der Breite: In der halben Fensterbreite wäre ein A4-Blatt sonst rechts abgeschnitten. */
const passeEin = (rahmen: HTMLIFrameElement, doc: Document) => {
	const breite = doc.documentElement.scrollWidth;
	if (breite > rahmen.clientWidth) {
		doc.documentElement.style.setProperty('zoom', String(rahmen.clientWidth / breite));
	}
};

const Vergleich = ({
	adresse,
	annehmen,
	konflikt,
	nachbessern,
	schliessen,
	verwerfen,
}: {
	adresse: string;
	annehmen: () => void;
	konflikt: boolean;
	nachbessern: () => void;
	schliessen: () => void;
	verwerfen: () => void;
}) => {
	const alt = useRef<HTMLIFrameElement>(null);
	const neu = useRef<HTMLIFrameElement>(null);
	const geladen = useRef(0);
	const fertig = () => {
		geladen.current += 1;
		const a = alt.current?.contentDocument;
		const n = neu.current?.contentDocument;
		if (geladen.current === 2 && a && n && alt.current && neu.current) {
			hebeHervor(a, n);
			passeEin(alt.current, a);
			passeEin(neu.current, n);
		}
	};
	const trenner = adresse.includes('?') ? '&' : '?';
	return (
		<Dialog titel="Vorschlag von Claude" schliessen={schliessen} breit>
			<div className="grid h-[70dvh] grid-cols-2 gap-3">
				<figure className="flex min-h-0 flex-col">
					<figcaption className="mb-1 font-bold">Jetzt</figcaption>
					<iframe
						ref={alt}
						src={adresse}
						title="Jetzt"
						onLoad={fertig}
						className="min-h-0 flex-1 rounded-xl border border-rand bg-white"
					/>
				</figure>
				<figure className="flex min-h-0 flex-col">
					<figcaption className="mb-1 font-bold">Vorschlag</figcaption>
					<iframe
						ref={neu}
						src={`${adresse}${trenner}vorschlag=1`}
						title="Vorschlag"
						onLoad={fertig}
						data-vorschlag-rahmen
						className="min-h-0 flex-1 rounded-xl border border-rand bg-white"
					/>
				</figure>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<Knopf onClick={annehmen} disabled={konflikt}>
					Annehmen
				</Knopf>
				<Knopf art="zweit" onClick={nachbessern}>
					Nachbessern
				</Knopf>
				<Knopf art="zweit" onClick={verwerfen}>
					Verwerfen
				</Knopf>
			</div>
		</Dialog>
	);
};

const VorschlagKarte = ({
	v,
	vergleichen,
	verwerfen,
}: {
	v: Vorschlag;
	vergleichen: () => void;
	verwerfen: () => void;
}) => (
	<div className="mb-4 rounded-xl border-2 border-brand-500 bg-white p-3" data-ki-vorschlag>
		<p className="font-bold">{`Vorschlag: ${v.auftrag}`}</p>
		<p className="text-leise">{v.umfang}</p>
		{v.antwort && <p className="mt-2 whitespace-pre-line">{v.antwort}</p>}
		{v.meldungen.length > 0 && (
			<ul className="mt-2 list-disc pl-5" data-ki-meldungen>
				{v.meldungen.map((m) => (
					<li key={`${m.seite}-${m.text}`}>{`Seite ${m.seite}: ${m.text}`}</li>
				))}
			</ul>
		)}
		{v.konflikt && (
			<p role="alert" className="mt-2 font-bold">
				Das Blatt wurde seit dem Auftrag geändert. Starte den Auftrag bitte neu.
			</p>
		)}
		<div className="mt-3 flex flex-wrap gap-2">
			<Knopf onClick={vergleichen}>Vergleichen</Knopf>
			<Knopf art="zweit" onClick={verwerfen}>
				Verwerfen
			</Knopf>
		</div>
	</div>
);

const LaufKarte = ({ abbrechen, auftrag }: { auftrag: KiAuftrag; abbrechen: () => void }) => (
	<div className="mb-4 rounded-xl border-2 border-rand bg-white p-3" data-ki-lauf role="status">
		<p className="font-bold">
			{auftrag.status === 'wartet' ? 'Wartet auf den vorigen Auftrag' : 'Claude arbeitet'}
		</p>
		<ul className="mt-1 text-leise">
			{auftrag.schritte.map((s) => (
				<li key={s}>{s}</li>
			))}
		</ul>
		<Knopf art="zweit" className="mt-2" onClick={abbrechen}>
			Abbrechen
		</Knopf>
	</div>
);

const UmfangWahl = ({
	baustein,
	seite,
	setUmfang,
	umfang,
}: {
	baustein: string | null;
	seite: string | null;
	umfang: Umfang;
	setUmfang: (u: Umfang) => void;
}) => (
	<>
		<div role="group" aria-label="Worauf bezieht sich der Auftrag?" className="mb-3 flex flex-wrap gap-2">
			{baustein && <Chip titel={baustein} aktiv={umfang === 'baustein'} waehle={() => setUmfang('baustein')} />}
			{seite && seite !== baustein && (
				<Chip titel={seite} aktiv={umfang === 'seite'} waehle={() => setUmfang('seite')} />
			)}
			<Chip titel="Ganzes Blatt" aktiv={umfang === 'blatt'} waehle={() => setUmfang('blatt')} />
		</div>
		{umfang === 'blatt' && <p className="mb-3 text-leise">Das ganze Blatt verbraucht deutlich mehr vom Limit.</p>}
	</>
);

const AuftragFeld = ({
	aus,
	feld,
	nachbessern,
	setText,
	starte,
	text,
}: {
	aus: boolean;
	feld: RefObject<HTMLTextAreaElement | null>;
	nachbessern: boolean;
	text: string;
	setText: (t: string) => void;
	starte: () => void;
}) => (
	<>
		<label className="block font-bold" htmlFor="ki-auftrag">
			{nachbessern ? 'Was soll Claude am Vorschlag ändern?' : 'Was soll Claude ändern?'}
		</label>
		<textarea
			id="ki-auftrag"
			ref={feld}
			value={text}
			rows={4}
			maxLength={4000}
			onChange={(e) => setText(e.target.value)}
			className="mt-1 w-full rounded-xl border-2 border-rand bg-white p-3"
		/>
		<p className="mt-1 font-bold">Keine Namen von Kindern eintragen.</p>
		{!text && !nachbessern && (
			<div className="mt-2 flex flex-wrap gap-2" data-ki-beispiele>
				{BEISPIELE.map((b) => (
					<Knopf key={b} art="leise" onClick={() => setText(b)}>
						{b}
					</Knopf>
				))}
			</div>
		)}
		<Knopf className="mt-3" disabled={aus || !text.trim()} onClick={starte}>
			<Symbol name="sprechblase" />
			Auftrag starten
		</Knopf>
	</>
);

/** Was der gewählte Umfang als Stelle im Blatt bedeutet; das ganze Blatt hat keine. */
const zielVon = (umfang: Umfang, nr: number | null, seite: number | null) => {
	if (umfang === 'baustein') {
		return nr;
	}
	return umfang === 'seite' ? seite : null;
};

/** Auftrag an Claude aus dem Editor (058, 059): ein Auftrag, ein Vorschlag, nichts ändert sich ohne Annehmen. */
export const ClaudePanel = ({
	adresse,
	dok,
	frei,
	loesung,
	mappe,
	neuLaden,
	nr,
	ort,
	pfad,
	vorbereiten,
	zerlegung,
	zustand,
}: Eigenschaften) => {
	const gestartet = (useLocation().state as { kiAuftrag?: string } | null)?.kiAuftrag;
	const ki = useKiAuftrag(mappe, dok, neuLaden, gestartet);
	const [text, setText] = useState('');
	const seite = pfad?.[0] ?? null;
	const baustein = nr === null ? null : (pfad?.at(-1) ?? null);
	const kleinster = kleinsterUmfang(baustein !== null, seite !== null);
	const [umfang, setUmfang] = useState<Umfang>(kleinster);
	const [vergleich, setVergleich] = useState(false);
	const [nachbessern, setNachbessern] = useState(false);
	const feld = useRef<HTMLTextAreaElement>(null);

	// Der kleinste passende Teil ist vorgewählt: Das schont das Limit.
	useEffect(() => setUmfang(kleinster), [kleinster, nr]);

	const hinweis = limitHinweis(zustand.limit, zustand.warnAb);
	const referenz = () => {
		const ziel = zielVon(umfang, nr, seite?.nr ?? null);
		return zerlegung && ziel !== null ? erzeugeReferenz(zerlegung, ziel, ort, loesung) : undefined;
	};

	const starte = async (wunsch: { auftrag?: string; aktion?: string }) => {
		await vorbereiten();
		await ki.starte({ ...wunsch, referenz: nachbessern ? undefined : referenz(), aufVorschlag: nachbessern });
		setNachbessern(false);
		setText('');
	};

	const aktionen = zustand.aktionen.filter((a) => a.auf.includes(umfang));
	const aus = !frei || ki.laeuft || hinweis?.art === 'gesperrt';

	return (
		<div data-ki-panel>
			<h2 className="mb-3 text-xl">Mit Claude ändern</h2>
			{hinweis && (
				<p
					role="status"
					className="mb-3 rounded-xl border-2 border-rand bg-white p-3"
					data-ki-limit={hinweis.art}
				>
					{hinweis.text}
				</p>
			)}
			{ki.vorschlag && (
				<VorschlagKarte
					v={ki.vorschlag}
					vergleichen={() => setVergleich(true)}
					verwerfen={() => void ki.verwerfen()}
				/>
			)}
			{vergleich && ki.vorschlag && (
				<Vergleich
					adresse={adresse}
					konflikt={ki.vorschlag.konflikt}
					schliessen={() => setVergleich(false)}
					annehmen={() => {
						setVergleich(false);
						void ki.annehmen();
					}}
					verwerfen={() => {
						setVergleich(false);
						void ki.verwerfen();
					}}
					nachbessern={() => {
						setVergleich(false);
						setNachbessern(true);
						feld.current?.focus();
					}}
				/>
			)}
			{ki.laeuft && ki.auftrag && <LaufKarte auftrag={ki.auftrag} abbrechen={() => void ki.abbrechen()} />}
			{ki.fehler && (
				<p role="alert" className="mb-3 font-bold" data-ki-fehler>
					{ki.fehler}
				</p>
			)}
			{!nachbessern && (
				<UmfangWahl
					baustein={baustein?.name ?? null}
					seite={seite?.name ?? null}
					umfang={umfang}
					setUmfang={setUmfang}
				/>
			)}
			{!nachbessern && aktionen.length > 0 && (
				<div className="mb-3 flex flex-wrap gap-2" data-ki-aktionen>
					{aktionen.map((a) => (
						<Knopf key={a.id} art="zweit" disabled={aus} onClick={() => void starte({ aktion: a.id })}>
							{a.name}
						</Knopf>
					))}
				</div>
			)}
			<AuftragFeld
				aus={aus}
				feld={feld}
				nachbessern={nachbessern}
				text={text}
				setText={setText}
				starte={() => void starte({ auftrag: text })}
			/>
			<p className="mt-4 text-leise">
				Für Reihen und neue Bilder bleibt „Claude fragen“ der Weg über die Claude-App.
			</p>
		</div>
	);
};
