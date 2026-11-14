import type { MouseEvent } from 'react';

import { Gekuerzt } from '../bausteine/Gekuerzt';
import { Marke } from '../bausteine/Kachel';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { Vorschau } from '../bausteine/Vorschau';
import { laufzeit, useJetzt } from '../editor/entwurf';
import { ART_NAME, datum, FACH_FARBE, FACH_NAME, FORMAT_NAME, klasseName } from '../lib/text';
import { NamensFeld } from './NamensFeld';
import { inhaltText, seitenText, STRICH } from './objekte';
import { BlattMini, OrdnerBild } from './OrdnerBild';
import type { Objekt } from './typen';

/** Was Kachel und Zeile gemeinsam brauchen. Alle Ereignisse behandelt die Ablage über `data-objekt`. */
export interface ObjektAnsicht {
	objekt: Objekt;
	gewaehlt: boolean;
	blass: boolean;
	benennt: boolean;
	/** In Suche und „Zuletzt“: kurz in der Zeile, voll beim Verweilen (189-13). */
	ort?: { kurz: string; voll: string };
	/** Das ⋯ am Finger (Regel aus 070: kein Halten fürs Menü). */
	menue: (e: MouseEvent) => void;
	/** Nur im Auswahlmodus am iPad: Haken statt Öffnen. */
	haken: boolean;
	/** Was aus der Ordnerkachel herausschaut. */
	vorne?: readonly Objekt[];
}

/** Claude baut das Blatt gerade (133): `seit` ist der Beginn, `null` wartet es noch. */
export interface ClaudeBaut {
	seit: string | null;
}

const ClaudeBautMarke = ({ seit }: ClaudeBaut) => {
	const jetzt = useJetzt(true);
	const zeit = laufzeit(seit, jetzt);
	return (
		<span
			role="status"
			className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-md border border-rand bg-flaeche/95 px-2 py-1 text-xs font-medium text-brand-700 shadow-sm"
			data-claude-baut
		>
			<Symbol name="laden" className="size-3 flex-none animate-spin" />
			<span className="min-w-0 flex-1 truncate">Claude baut …</span>
			{zeit && <span className="flex-none text-leise tabular-nums">{zeit}</span>}
		</span>
	);
};

/**
 * Die Ablage behandelt Klicks gesammelt. Safari am Finger hält ein Element ohne eigenen Lauscher für nicht antippbar und
 * lenkt den Tipp auf den nächsten Knopf in der Nähe um, zum Beispiel auf ⋯. Ein eigener Lauscher verhindert das.
 */
const antwortetAufTipp = (el: HTMLElement | null) => {
	el?.addEventListener('click', () => undefined);
};

const GeteiltMarke = () => (
	<Tooltip text="Geteilt">
		<span className="inline-flex flex-none items-center text-dezent" data-marke-geteilt>
			<Symbol name="teilen" className="size-3" />
			<span className="sr-only">geteilt</span>
		</span>
	</Tooltip>
);

const FingerMenue = ({ menue, name }: { menue: (e: MouseEvent) => void; name: string }) => (
	<Knopf
		art="leise"
		groesse="klein"
		className="nur-finger size-knopf-klein flex-none"
		aria-label={`Aktionen: ${name}`}
		data-finger-menue
		onClick={(e) => {
			e.stopPropagation();
			menue(e);
		}}
	>
		<Symbol name="mehr" />
	</Knopf>
);

const Haken = ({ an }: { an: boolean }) => (
	<span
		aria-hidden
		className={klassen(
			'flex size-5 flex-none items-center justify-center rounded-full border',
			an ? 'border-brand-500 bg-brand-500 text-white' : 'border-rand-feld bg-flaeche',
		)}
	>
		{an && <Symbol name="haken" className="size-3" />}
	</span>
);

export const Kachel = ({
	benennt,
	blass,
	claude,
	gewaehlt,
	haken,
	menue,
	objekt,
	ort,
	vorne,
}: ObjektAnsicht & { claude?: ClaudeBaut | undefined }) => (
	<li
		data-objekt={objekt.schluessel}
		data-art={objekt.istOrdner ? 'ordner' : 'dokument'}
		aria-selected={gewaehlt}
		role="option"
		ref={antwortetAufTipp}
		{...(objekt.istOrdner ? { 'data-ablage-ziel': objekt.ordner.id } : {})}
		className={klassen(
			'ablage-objekt relative flex flex-col rounded-[10px] border',
			gewaehlt
				? 'border-brand-500 bg-brand-100 outline outline-1 outline-brand-500'
				: 'border-rand bg-flaeche hover:border-rand-feld',
			blass && 'opacity-50',
		)}
	>
		<div className="relative overflow-hidden rounded-t-[9px]">
			{objekt.istOrdner ? (
				<OrdnerBild vorne={vorne ?? []} token={null} />
			) : (
				<>
					<Vorschau zugang={{ mappe: objekt.dok.mappe, token: null }} dokument={objekt.dok} />
					{objekt.dok.meta.status === 'entwurf' && (
						<span className="absolute top-2 left-2">
							<Marke>Entwurf</Marke>
						</span>
					)}
					{claude && <ClaudeBautMarke seit={claude.seit} />}
				</>
			)}
			{haken && (
				<span className="absolute top-2 right-2">
					<Haken an={gewaehlt} />
				</span>
			)}
		</div>
		<div className="flex items-start gap-1 border-t border-rand px-2.5 py-2">
			<div className="min-w-0 flex-1">
				<h2 className="flex items-center gap-1.5 text-sm font-medium" data-objekt-name={!benennt || undefined}>
					{!objekt.istOrdner && (
						<span
							className="size-2 flex-none rounded-full"
							style={{ background: FACH_FARBE[objekt.dok.fach] }}
						/>
					)}
					{benennt ? (
						// Das Feld steht genau an der Stelle des Namens; die Kachel wächst nicht (188-15).
						<span className="min-w-0 flex-1">
							<NamensFeld objekt={objekt} className="-ml-[5px] h-4 py-0 leading-4" />
						</span>
					) : (
						<Gekuerzt text={objekt.name} />
					)}
					{!benennt && objekt.geteilt && <GeteiltMarke />}
				</h2>
				<p className="truncate text-xs text-leise">
					{objekt.istOrdner
						? inhaltText(objekt.inhalt)
						: `${ART_NAME[objekt.dok.meta.art]} · ${FORMAT_NAME[objekt.dok.meta.format]}`}
				</p>
				{ort && <Gekuerzt text={ort.kurz} voll={ort.voll} className="block text-xs text-dezent" />}
			</div>
			<FingerMenue menue={menue} name={objekt.name} />
		</div>
	</li>
);

export interface ZeileAnsicht extends ObjektAnsicht {
	tiefe: number;
	offen: boolean;
	klappe: ((alles: boolean) => void) | null;
	mitMaterial: boolean;
}

/**
 * Spalten nach Platz: Unter dem Inhaltscontainer fallen Format, Klasse und Fach nacheinander weg. Ohne Material in
 * Sicht gibt es die drei gar nicht, der Platz geht an den Namen (188-35).
 */
export const listenRaster = (mitMaterial: boolean) =>
	mitMaterial
		? 'grid grid-cols-[minmax(0,1fr)_6.5rem_8rem] @3xl:grid-cols-[minmax(0,1fr)_6.5rem_8rem_7rem] @4xl:grid-cols-[minmax(0,1fr)_6.5rem_8rem_7rem_5rem_5rem_9rem]'
		: 'grid grid-cols-[minmax(0,1fr)_6.5rem_8rem] @4xl:grid-cols-[minmax(0,1fr)_6.5rem_8rem_9rem]';

/** Im laufenden Jahr ohne Jahr, sonst mit (188-18). */
const geaendertText = (wann: string) =>
	new Date(wann).getFullYear() === new Date().getFullYear() ? datum(wann).replace(/ \d{4}$/, '') : datum(wann);

export const Zeile = ({
	benennt,
	blass,
	gewaehlt,
	haken,
	klappe,
	menue,
	mitMaterial,
	objekt,
	offen,
	ort,
	tiefe,
}: ZeileAnsicht) => (
	<div
		role="option"
		aria-selected={gewaehlt}
		data-objekt={objekt.schluessel}
		data-art={objekt.istOrdner ? 'ordner' : 'dokument'}
		ref={antwortetAufTipp}
		{...(objekt.istOrdner ? { 'data-ablage-ziel': objekt.ordner.id } : {})}
		className={klassen(
			'ablage-objekt',
			listenRaster(mitMaterial),
			'h-[var(--hoehe-listenzeile)] items-center rounded-md px-1 text-sm',
			gewaehlt ? 'bg-brand-100' : 'hover:bg-flaeche-2',
			blass && 'opacity-50',
		)}
	>
		<div className="flex min-w-0 items-center gap-1.5 pr-3" style={{ paddingLeft: tiefe * 16 }}>
			{haken && <Haken an={gewaehlt} />}
			{klappe ? (
				<button
					type="button"
					aria-label={offen ? 'Zuklappen' : 'Aufklappen'}
					className="flex size-4 flex-none items-center justify-center rounded-sm text-dezent hover:bg-rand"
					data-dreieck
					onClick={(e) => {
						e.stopPropagation();
						klappe(e.altKey);
					}}
					onDoubleClick={(e) => e.stopPropagation()}
				>
					<Symbol name={offen ? 'runter' : 'rechts'} className="size-3" />
				</button>
			) : (
				<span className="size-4 flex-none" />
			)}
			{objekt.istOrdner ? (
				<span className="flex h-[26px] w-5 flex-none items-center justify-center" data-zieh-griff>
					<Symbol name="ordner" className="size-4 text-brand-500" />
				</span>
			) : (
				<BlattMini
					dok={objekt.dok}
					token={null}
					className="relative h-[26px] w-5 rounded-[2px] border border-rand"
					data-zieh-griff=""
				/>
			)}
			<div className="min-w-0 flex-1">
				{benennt ? (
					<NamensFeld objekt={objekt} />
				) : (
					<span className="flex min-w-0 items-center gap-1.5" data-objekt-name>
						<Gekuerzt text={objekt.name} data-zieh-griff />
						{!objekt.istOrdner && objekt.dok.meta.status === 'entwurf' && <Marke>Entwurf</Marke>}
						{objekt.geteilt && <GeteiltMarke />}
					</span>
				)}
			</div>
			<FingerMenue menue={menue} name={objekt.name} />
		</div>
		<span className="truncate text-xs text-leise">{geaendertText(objekt.geaendert)}</span>
		{ort ? (
			<Gekuerzt text={ort.kurz} voll={ort.voll} className="pr-2 text-xs text-leise" />
		) : (
			<span className="truncate pr-2 text-xs text-leise">{objekt.istOrdner ? 'Ordner' : objekt.art}</span>
		)}
		{mitMaterial && (
			<>
				<span className="truncate text-xs text-leise @max-3xl:hidden">
					{objekt.istOrdner ? STRICH : FACH_NAME[objekt.dok.fach]}
				</span>
				<span className="truncate text-xs text-leise @max-4xl:hidden">
					{objekt.istOrdner ? STRICH : klasseName(objekt.dok.klasse).replace('Klasse ', '')}
				</span>
				<span className="truncate text-xs text-leise @max-4xl:hidden">
					{objekt.istOrdner ? STRICH : FORMAT_NAME[objekt.dok.meta.format]}
				</span>
			</>
		)}
		<span className="truncate text-xs text-leise @max-4xl:hidden">
			{objekt.istOrdner ? inhaltText(objekt.inhalt) : seitenText(objekt.dok.meta.seiten)}
		</span>
	</div>
);
