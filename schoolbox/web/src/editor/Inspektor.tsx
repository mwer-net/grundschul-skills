import { ABSCHNITT_TITEL } from '@schoolbox/kern/src/abschnitte';
import { FREIES_ELEMENT, kann } from '@schoolbox/kern/src/bausteine';
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Abschnitt } from '../bausteine/Abschnitt';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Reiter } from '../bausteine/Reiter';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import type { AbbildungSteuerung } from './abbildung';
import { hatWeitere } from './abbildung-felder';
import { AbbildungFelder, AbbildungHinweise } from './Abbildungspanel';
import type { Ablage } from './ablage';
import type { BildSteuerung } from './bild';
import { BildDarstellung, Bildwerkzeug } from './Bildpanel';
import { useChat } from './chat-kontext';
import type { PfadTeil } from './darstellung';
import { elementZu } from './darstellung';
import type { Einblendung } from './Leinwand';
import type { LoesungSteuerung } from './loesung';
import { Loesungswerkzeug } from './Loesungspanel';
import { KitWerkzeug, SammlungName, Sichtbarkeit, Spaltenwahl, TabellenWerkzeug } from './Panel';
import { Pruefhinweise } from './Pruefliste';
import type { Pruefstand } from './pruefung';
import { Sprachwerkzeug } from './Sprachwerkzeug';
import type { Struktur } from './struktur';
import type { useText } from './text';

type ReiterName = 'auswahl' | 'blatt';

const STUFE = 'size-knopf-status h-zeile truncate rounded px-1 text-xs text-leise hover:bg-flaeche-2 hover:text-tinte';

/**
 * Wo im Blatt: die Elternkette in einer Zeile, der Baustein darunter. Überfahren rahmt die Ebene im Blatt, damit man
 * vor dem Klick sieht, was „Reihe“ ist. Passt die Kette nicht, fassen sich die vorderen Stufen zu „…“ zusammen.
 */
const Pfad = ({
	pfad,
	umriss,
	waehle,
}: {
	pfad: PfadTeil[];
	umriss: (nr: number | null) => void;
	waehle: (nr: number | null) => void;
}) => {
	const zeile = useRef<HTMLDivElement>(null);
	const eltern = pfad.slice(0, -1);
	const gewaehlt = pfad.at(-1);
	const schluessel = pfad.map((t) => t.nr).join('/');
	const [wegBei, setWeg] = useState({ schluessel, n: 0 });
	const weg = wegBei.schluessel === schluessel ? wegBei.n : 0;

	useLayoutEffect(() => {
		const el = zeile.current;
		if (el && el.scrollWidth > el.clientWidth && weg < eltern.length - 1) {
			setWeg({ schluessel, n: weg + 1 });
		}
	}, [schluessel, weg, eltern.length]);

	if (!gewaehlt) {
		return null;
	}
	return (
		<nav aria-label="Wo im Blatt" className="min-w-0" data-breadcrumb>
			<div ref={zeile} className="-ml-1 flex h-zeile items-center overflow-hidden whitespace-nowrap">
				{weg > 0 && (
					<>
						<Menue
							art="leise"
							groesse="klein"
							name="Weitere Ebenen"
							beschriftung="…"
							eintraege={eltern.slice(0, weg).map((t) => ({ titel: t.name, waehle: () => waehle(t.nr) }))}
						/>
						<span className="flex-none px-0.5 text-xs text-dezent">›</span>
					</>
				)}
				{eltern.slice(weg).map((teil, i) => (
					<span key={teil.nr} className="flex min-w-0 flex-none items-center">
						{i > 0 && <span className="px-0.5 text-xs text-dezent">›</span>}
						<button
							type="button"
							className={STUFE}
							data-pfad-stufe={teil.nr}
							onPointerEnter={() => umriss(teil.nr)}
							onPointerLeave={() => umriss(null)}
							onFocus={() => umriss(teil.nr)}
							onBlur={() => umriss(null)}
							onClick={() => {
								umriss(null);
								waehle(teil.nr);
							}}
						>
							{teil.name}
						</button>
					</span>
				))}
			</div>
			{eltern.length > 0 && <span className="sr-only">›</span>}
			<h2 className="min-w-0 truncate pr-7 text-base font-semibold">
				<button
					type="button"
					className="h-knopf-status max-w-full truncate"
					aria-current="true"
					onClick={() => waehle(gewaehlt.nr)}
				>
					{gewaehlt.name}
				</button>
			</h2>
		</nav>
	);
};

interface Eigenschaften {
	pfad: PfadTeil[];
	waehle: (nr: number | null) => void;
	umriss: (nr: number | null) => void;
	/** Der Inhalt des Reiters „Blatt“. */
	blatt: ReactNode;
	/** Zählt hoch, wenn die Palette zu einer Einstellung des Blatts springt. */
	zumBlatt: number;
	children: ReactNode;
}

/** Rechts neben dem Blatt: zwei Reiter, damit immer klar ist, worauf sich eine Einstellung bezieht. */
export const Inspektor = ({ blatt, children, pfad, umriss, waehle, zumBlatt }: Eigenschaften) => {
	const gewaehlt = pfad.at(-1);
	const nr = gewaehlt?.nr ?? null;
	const [wunsch, setWunsch] = useState<ReiterName>('auswahl');
	const [zuletzt, setZuletzt] = useState(nr);
	if (zuletzt !== nr) {
		setZuletzt(nr);
		if (nr !== null) {
			setWunsch('auswahl');
		}
	}
	const [blattZuletzt, setBlattZuletzt] = useState(zumBlatt);
	if (blattZuletzt !== zumBlatt) {
		setBlattZuletzt(zumBlatt);
		setWunsch('blatt');
	}
	const reiter = gewaehlt ? wunsch : 'blatt';
	return (
		<div data-inspektor={reiter}>
			<Reiter
				beschriftung="Worauf sich die Einstellungen beziehen"
				className="border-b border-rand px-3"
				wert={reiter}
				waehle={setWunsch}
				werte={[
					{ wert: 'auswahl', titel: 'Auswahl', aus: !gewaehlt },
					{ wert: 'blatt', titel: 'Blatt' },
				]}
			/>
			{reiter === 'blatt' || !gewaehlt ? (
				blatt
			) : (
				<div data-auswahl={gewaehlt.baustein.art}>
					<div className="relative px-3 pt-1 pb-2">
						<Pfad pfad={pfad} umriss={umriss} waehle={waehle} />
						<span className="absolute right-2 bottom-2">
							<SymbolKnopf
								symbol="schliessen"
								beschriftung="Auswahl aufheben"
								groesse="klein"
								onClick={() => waehle(null)}
							/>
						</span>
					</div>
					{children}
				</div>
			)}
		</div>
	);
};

/** Gestrichelter Rahmen um die Ebene, die im Pfad gerade überfahren wird; gleiche Maße wie der Auswahlrahmen. */
export const Umriss = ({ e, nr }: { e: Einblendung; nr: number | null }) => {
	const r = nr === null ? null : elementZu(e.doc, nr)?.getBoundingClientRect();
	if (!r) {
		return null;
	}
	return (
		<div
			className={klassen(
				'umriss pointer-events-none absolute rounded-[2px] border border-dashed border-brand-500',
			)}
			data-umriss={nr}
			style={{
				left: e.links + r.left * e.skala - 4,
				top: r.top * e.skala - 4,
				width: r.width * e.skala + 8,
				height: r.height * e.skala + 8,
			}}
		/>
	);
};

interface EinstellungenEigenschaften {
	/** Zeigt der Editor gerade die Lösung? */
	loesung: boolean;
	schalteAnsicht: () => void;
	pfad: PfadTeil[];
	quelle: string | null;
	format: string;
	frei: boolean;
	doc: Document | null;
	geladen: { doc: Document } | null;
	struktur: Struktur;
	ablage: Ablage;
	abb: AbbildungSteuerung;
	bild: BildSteuerung;
	loes: LoesungSteuerung;
	text: ReturnType<typeof useText>;
	pruefung: Pruefstand | null;
}

const eintraegeIn = (doc: Document | null, nr: number | undefined) =>
	(doc && nr !== undefined ? elementZu(doc, nr)?.children.length : 0) ?? 0;

const SichtbarkeitWenn = ({
	baustein,
	nr,
	quelle,
	struktur,
}: {
	baustein: PfadTeil['baustein'];
	nr: number;
	quelle: string | null;
	struktur: Struktur;
}) =>
	quelle && kann(baustein, 'ordnen') && baustein.art !== 'seite' ? (
		<Sichtbarkeit nr={nr} quelle={quelle} struktur={struktur} />
	) : null;

/** Der Chip im Chat folgt der Auswahl: Geöffnet ist das Element also schon der Kontext des Auftrags (Entscheidung 38). */
const FreiesElementHinweis = () => {
	const chat = useChat();
	return (
		<div className="flex flex-col items-start gap-1.5" data-frei-hinweis>
			<p className="text-sm text-leise">Von Claude gebaut. Hier gibt es keine Einstellungen.</p>
			<Knopf art="zweit" groesse="klein" onClick={() => chat.oeffne()}>
				Claude fragen
			</Knopf>
		</div>
	);
};

/**
 * Das gewählte Element ist in dieser Ansicht nicht zu sehen (nur in der Lösung, nur auf der Folie): Ohne Hinweis sähe
 * es aus, als wäre nichts passiert. Bewusst ein Hinweis und kein Umschalten, das würde beim Einfügen überraschen (G9).
 */
const UnsichtbarHinweis = ({
	doc,
	loesung,
	nr,
	quelle,
	schalte,
}: {
	doc: Document | null;
	loesung: boolean;
	nr: number;
	quelle: string | null;
	schalte: () => void;
}) => {
	const [element, setElement] = useState<Element | null>(null);
	useEffect(() => {
		const el = doc ? (elementZu(doc, nr) ?? null) : null;
		setElement(el && el.getClientRects().length === 0 ? el : null);
	}, [doc, nr, quelle, loesung]);
	if (!element) {
		return null;
	}
	if (element.matches('.notiz')) {
		return (
			<p className="text-sm text-leise" data-hinweis="unsichtbar">
				Die Notiz siehst du nur in der Präsentation, nicht auf dem Blatt.
			</p>
		);
	}
	return (
		<div className="flex flex-col items-start gap-1.5" data-hinweis="unsichtbar">
			<p className="text-sm text-leise">
				{loesung ? 'Das steht nur im Arbeitsblatt.' : 'Das steht nur in der Lösung.'} Hier siehst du es nicht.
			</p>
			<Knopf art="zweit" groesse="klein" onClick={schalte}>
				{loesung ? 'Zum Arbeitsblatt' : 'Zur Lösung'}
			</Knopf>
		</div>
	);
};

/** Feste Abschnitte in fester Reihenfolge; was leer bleibt, blendet `Abschnitt` aus. */
export const Einstellungen = ({
	abb,
	ablage,
	bild,
	doc,
	format,
	frei,
	geladen,
	loes,
	loesung,
	pfad,
	pruefung,
	quelle,
	schalteAnsicht,
	struktur,
	text,
}: EinstellungenEigenschaften) => {
	const gewaehlt = pfad.at(-1);
	if (!gewaehlt) {
		return null;
	}
	const { baustein, nr } = gewaehlt;
	const aktiv = struktur.aktiv && struktur.werte !== null;
	const folien = format === 'folie';
	const kit = { art: baustein.art, folien, nr, quelle, struktur };
	const spalten = aktiv ? struktur.werte?.spalten : null;
	const anzahl = eintraegeIn(doc, spalten?.nr);
	return (
		<div {...(abb.aktiv ? { 'data-abbildungswerkzeug': '' } : {})}>
			<div className="flex flex-col gap-2 px-3 pb-2 empty:hidden" data-abschnitt="hinweise">
				{FREIES_ELEMENT.has(baustein.art) && <FreiesElementHinweis />}
				<UnsichtbarHinweis doc={doc} loesung={loesung} nr={nr} quelle={quelle} schalte={schalteAnsicht} />
				<Pruefhinweise stand={pruefung} nr={nr} />
				<AbbildungHinweise abb={abb} />
				{aktiv && quelle && <SammlungName ablage={ablage} />}
			</div>
			<Sprachwerkzeug
				pfad={pfad}
				aktiv={frei}
				geladen={geladen}
				quelle={quelle}
				bearbeitet={text.bearbeitet}
				beende={text.beende}
				struktur={struktur}
			/>
			<Abschnitt name="inhalt" titel={ABSCHNITT_TITEL.inhalt}>
				<Bildwerkzeug bild={bild} />
				<AbbildungFelder abb={abb} abschnitt="inhalt" />
				{aktiv && (
					<>
						<TabellenWerkzeug folien={folien} nr={nr} pfad={pfad} quelle={quelle} struktur={struktur} />
						<KitWerkzeug {...kit} abschnitt="inhalt" />
					</>
				)}
			</Abschnitt>
			<Abschnitt name="darstellung" titel={ABSCHNITT_TITEL.darstellung}>
				<BildDarstellung bild={bild} />
				<AbbildungFelder abb={abb} abschnitt="darstellung" />
				{aktiv && <KitWerkzeug {...kit} abschnitt="darstellung" />}
				{spalten?.nr === nr && <Spaltenwahl spalten={spalten} struktur={struktur} />}
			</Abschnitt>
			<Abschnitt name="loesung" titel={ABSCHNITT_TITEL.loesung}>
				<Loesungswerkzeug l={loes} />
				<AbbildungFelder abb={abb} abschnitt="loesung" />
				{aktiv && <KitWerkzeug {...kit} abschnitt="loesung" />}
			</Abschnitt>
			<Abschnitt name="bewertung" titel={ABSCHNITT_TITEL.bewertung}>
				<AbbildungFelder abb={abb} abschnitt="bewertung" />
				{aktiv && <KitWerkzeug {...kit} abschnitt="bewertung" />}
			</Abschnitt>
			<Abschnitt name="sichtbarkeit" titel="Sichtbarkeit">
				{aktiv && <SichtbarkeitWenn baustein={baustein} nr={nr} quelle={quelle} struktur={struktur} />}
			</Abschnitt>
			<Abschnitt
				name="eltern"
				titel={spalten?.name ?? ''}
				notiz={anzahl > 0 ? `gilt für alle ${anzahl} Einträge` : undefined}
			>
				{spalten && spalten.nr !== nr && <Spaltenwahl spalten={spalten} struktur={struktur} />}
			</Abschnitt>
			{hatWeitere(abb) && (
				<Abschnitt name="weitere" titel={ABSCHNITT_TITEL.weitere} einklappbar zu>
					<AbbildungFelder abb={abb} abschnitt="weitere" />
				</Abschnitt>
			)}
		</div>
	);
};
