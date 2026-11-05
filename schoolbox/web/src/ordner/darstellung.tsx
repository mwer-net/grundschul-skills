import { Marke } from '../bausteine/Kachel';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Vorschau } from '../bausteine/Vorschau';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { anzahl, ART_NAME, datum, FACH_FARBE, FACH_NAME, FORMAT_NAME, klasseName } from '../lib/text';
import { vorschauAdresse } from '../lib/zugang';
import { NamensFeld } from './NamensFeld';
import type { DokObjekt, Objekt } from './typen';

/** Was Kachel und Zeile gemeinsam brauchen. Alle Ereignisse behandelt die Ablage über `data-objekt`. */
export interface ObjektAnsicht {
	objekt: Objekt;
	gewaehlt: boolean;
	blass: boolean;
	benennt: boolean;
	ort?: string;
	/** Das ⋯ am Finger (Regel aus 070: kein Halten fürs Menü). */
	menue: (e: React.MouseEvent) => void;
	/** Nur im Auswahlmodus am iPad: Haken statt Öffnen. */
	haken: boolean;
}

export const objekteText = (n: number) => anzahl(n, 'Objekt', 'Objekte');

const GeteiltMarke = () => (
	<span title="Geteilt" className="inline-flex flex-none items-center text-dezent" data-marke-geteilt>
		<Symbol name="teilen" className="size-3" />
		<span className="sr-only">geteilt</span>
	</span>
);

const FingerMenue = ({ menue, name }: { menue: (e: React.MouseEvent) => void; name: string }) => (
	<Knopf
		art="leise"
		groesse="klein"
		className="nur-finger size-knopf-klein flex-none px-0"
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

export const Kachel = ({ benennt, blass, gewaehlt, haken, menue, objekt, ort }: ObjektAnsicht) => (
	<li
		data-objekt={objekt.schluessel}
		data-art={objekt.istOrdner ? 'ordner' : 'dokument'}
		aria-selected={gewaehlt}
		role="option"
		{...(objekt.istOrdner ? { 'data-ablage-ziel': objekt.ordner.id } : {})}
		className={klassen(
			'ablage-objekt relative flex flex-col overflow-hidden rounded-[10px] border bg-flaeche',
			gewaehlt ? 'border-brand-500 bg-brand-50 outline outline-1 outline-brand-500' : 'border-rand hover:border-rand-feld',
			blass && 'opacity-50',
		)}
	>
		<div className="relative">
			{objekt.istOrdner ? (
				<div className="flex aspect-[8/7] items-center justify-center bg-leinwand">
					<Symbol name="ordner" className="size-20 text-brand-200" />
				</div>
			) : (
				<>
					<Vorschau zugang={{ mappe: objekt.dok.mappe, token: null }} dokument={objekt.dok} />
					{objekt.dok.meta.status === 'entwurf' && (
						<span className="absolute top-2 left-2">
							<Marke>Entwurf</Marke>
						</span>
					)}
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
				{benennt ? (
					<NamensFeld objekt={objekt} />
				) : (
					<h2 className="flex items-center gap-1.5 text-sm font-medium" data-objekt-name>
						{!objekt.istOrdner && (
							<span className="size-2 flex-none rounded-full" style={{ background: FACH_FARBE[objekt.dok.fach] }} />
						)}
						<span className="truncate">{objekt.name}</span>
						{objekt.geteilt && <GeteiltMarke />}
					</h2>
				)}
				<p className="truncate text-xs text-leise">
					{objekt.istOrdner
						? objekteText(objekt.anzahl).replace(/^Ein Objekt$/, '1 Objekt')
						: `${ART_NAME[objekt.dok.meta.art]} · ${FORMAT_NAME[objekt.dok.meta.format]}`}
				</p>
				{ort && <p className="truncate text-xs text-dezent">{ort}</p>}
			</div>
			<FingerMenue menue={menue} name={objekt.name} />
		</div>
	</li>
);

const Miniatur = ({ objekt }: { objekt: DokObjekt }) => {
	const { dok } = objekt;
	return (
		<span className="relative flex h-[26px] w-5 flex-none items-center justify-center overflow-hidden rounded-[2px] border border-rand bg-flaeche">
			{dok.vorschau && !hatOffeneEntwuerfe(dok.meta) ? (
				<img
					className="size-full object-cover object-top"
					src={vorschauAdresse({ mappe: dok.mappe, token: null }, dok.id, dok.vorschau)}
					alt=""
					loading="lazy"
					decoding="async"
					draggable={false}
				/>
			) : (
				<Symbol name="blatt" className="size-3 text-dezent" />
			)}
		</span>
	);
};

const STRICH = '–';

export interface ZeileAnsicht extends ObjektAnsicht {
	tiefe: number;
	offen: boolean;
	klappe: ((alles: boolean) => void) | null;
}

/** Spalten nach Platz: Unter dem Inhaltscontainer fallen Format, Klasse und Fach nacheinander weg. */
export const LISTEN_RASTER =
	'grid grid-cols-[minmax(0,1fr)_6.5rem_8rem] @3xl:grid-cols-[minmax(0,1fr)_6.5rem_8rem_7rem] @4xl:grid-cols-[minmax(0,1fr)_6.5rem_8rem_7rem_5rem_5rem_5.5rem]';

export const Zeile = ({ benennt, blass, gewaehlt, haken, klappe, menue, objekt, offen, ort, tiefe }: ZeileAnsicht) => (
	<div
		role="option"
		aria-selected={gewaehlt}
		data-objekt={objekt.schluessel}
		data-art={objekt.istOrdner ? 'ordner' : 'dokument'}
		{...(objekt.istOrdner ? { 'data-ablage-ziel': objekt.ordner.id } : {})}
		className={klassen(
			'ablage-objekt',
			LISTEN_RASTER,
			'h-[var(--hoehe-listenzeile)] items-center rounded-md px-1 text-sm',
			gewaehlt ? 'bg-brand-100' : 'hover:bg-flaeche-2',
			blass && 'opacity-50',
		)}
	>
		<div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: tiefe * 16 }}>
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
				<span className="flex h-[26px] w-5 flex-none items-center justify-center">
					<Symbol name="ordner" className="size-4 text-brand-500" />
				</span>
			) : (
				<Miniatur objekt={objekt} />
			)}
			<div className="min-w-0 flex-1">
				{benennt ? (
					<NamensFeld objekt={objekt} />
				) : (
					<span className="flex min-w-0 items-center gap-1.5" data-objekt-name>
						<span className="truncate">{objekt.name}</span>
						{!objekt.istOrdner && objekt.dok.meta.status === 'entwurf' && <Marke>Entwurf</Marke>}
						{objekt.geteilt && <GeteiltMarke />}
					</span>
				)}
			</div>
			<FingerMenue menue={menue} name={objekt.name} />
		</div>
		<span className="truncate text-xs text-leise">{datum(objekt.geaendert).replace(/ \d{4}$/, '')}</span>
		<span className="truncate text-xs text-leise">{ort ?? (objekt.istOrdner ? 'Ordner' : objekt.art)}</span>
		<span className="truncate text-xs text-leise max-@3xl:hidden">
			{objekt.istOrdner ? STRICH : FACH_NAME[objekt.dok.fach]}
		</span>
		<span className="truncate text-xs text-leise max-@4xl:hidden">
			{objekt.istOrdner ? STRICH : klasseName(objekt.dok.klasse).replace('Klasse ', '')}
		</span>
		<span className="truncate text-xs text-leise max-@4xl:hidden">
			{objekt.istOrdner ? STRICH : FORMAT_NAME[objekt.dok.meta.format]}
		</span>
		<span className="truncate text-xs text-leise max-@4xl:hidden">
			{objekt.istOrdner ? objekteText(objekt.anzahl).replace(/^Ein Objekt$/, '1 Objekt') : objekt.dok.meta.seiten || STRICH}
		</span>
	</div>
);
