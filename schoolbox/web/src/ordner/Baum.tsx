import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useMemo } from 'react';

import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import { useAblage } from './kontext';
import { NamensFeld } from './NamensFeld';
import { ordnerObjekt, WURZEL_NAME } from './objekte';
import type { AblageOrdner, AblageStand } from './typen';

const NATUERLICH = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

/** Einrücken je Ebene; ab der 5. Ebene nicht mehr, sonst bliebe bei 220 px Breite für den Namen nichts übrig. */
const einzug = (tiefe: number) => 6 + Math.min(tiefe, 5) * 12;

interface Eigenschaften {
	stand: AblageStand;
	aktuell: string | null | undefined;
	offen: ReadonlySet<string>;
	klappe: (id: string, alles?: boolean) => void;
	waehle: (id: string | null) => void;
	kontext?: (e: MouseEvent, ordner: AblageOrdner | null) => void;
	/** Nur diese Ordner sind Ziele (Dialog „Bewegen nach …“). */
	gesperrt?: (id: string | null) => boolean;
	wurzelGesperrt?: boolean;
	/** Wo das Namensfeld steht: Baum der Leiste oder des Dialogs. */
	benennWo?: 'baum' | 'dialog';
	/** Nur in der Leiste: Jede Ordnerzeile ist Quelle desselben Zugs wie der Inhalt. */
	ziehen?: (e: ReactPointerEvent, id: string) => void;
	/** Gezogen: blass samt dem sichtbaren Zweig darunter. */
	blass?: ReadonlySet<string>;
}

interface ZeileEigenschaften {
	id: string | null;
	tiefe: number;
	name: ReactNode;
	aktiv: boolean;
	aus: boolean;
	blass: boolean;
	geteilt?: boolean;
	dreieck: 'auf' | 'zu' | null;
	symbol: 'ordner' | 'blatt';
	klappe?: (alles: boolean) => void;
	waehle: () => void;
	kontext?: (e: MouseEvent) => void;
	ziehen?: (e: ReactPointerEvent) => void;
}

const BaumZeile = ({
	aktiv,
	aus,
	blass,
	dreieck,
	geteilt,
	id,
	klappe,
	kontext,
	name,
	symbol,
	tiefe,
	waehle,
	ziehen,
}: ZeileEigenschaften) => (
	<div
		role="treeitem"
		aria-selected={aktiv}
		aria-expanded={dreieck === null ? undefined : dreieck === 'auf'}
		aria-disabled={aus || undefined}
		tabIndex={-1}
		data-baum-ordner={id ?? 'wurzel'}
		data-ablage-ziel={id ?? 'wurzel'}
		className={klassen(
			'ablage-objekt flex h-[var(--hoehe-baumzeile)] items-center gap-1 rounded-md pr-1 text-sm select-none',
			aktiv ? 'bg-brand-100 font-medium text-tinte' : 'text-tinte hover:bg-flaeche-2',
			aus && 'opacity-40',
			blass && 'opacity-50',
		)}
		style={{ paddingLeft: einzug(tiefe) }}
		onPointerDown={ziehen}
		onClick={() => {
			if (!aus) {
				waehle();
			}
		}}
		onKeyDown={(e: KeyboardEvent) => {
			if (e.key === 'Enter' && !aus) {
				waehle();
			}
		}}
		onContextMenu={kontext}
	>
		{dreieck ? (
			<button
				type="button"
				aria-label={dreieck === 'auf' ? 'Zuklappen' : 'Aufklappen'}
				className="baum-dreieck flex size-4 flex-none items-center justify-center rounded-sm text-dezent hover:bg-rand"
				onClick={(e) => {
					e.stopPropagation();
					klappe?.(e.altKey);
				}}
			>
				<Symbol name={dreieck === 'auf' ? 'runter' : 'rechts'} className="size-3" />
			</button>
		) : (
			<span className="size-4 flex-none" />
		)}
		<Symbol name={symbol} className={klassen('size-3.5 flex-none', aktiv ? 'text-brand-600' : 'text-leise')} />
		<span className="min-w-0 flex-1 truncate">{name}</span>
		{geteilt && (
			<span title="Geteilt" className="flex-none text-dezent">
				<Symbol name="teilen" className="size-3" />
				<span className="sr-only">geteilt</span>
			</span>
		)}
	</div>
);

/** Der ganze Ordnerbaum: in der Seitenleiste und im Dialog „Bewegen nach …“. */
const dreieckVon = (unter: boolean, auf: boolean) => {
	if (!unter) {
		return null;
	}
	return auf ? 'auf' : 'zu';
};

export const Baum = ({
	aktuell,
	benennWo = 'baum',
	blass,
	gesperrt,
	klappe,
	kontext,
	offen,
	stand,
	waehle,
	wurzelGesperrt,
	ziehen,
}: Eigenschaften) => {
	const { benennen } = useAblage();
	const kinderVon = useMemo(() => {
		const karte = new Map<string | null, AblageOrdner[]>();
		for (const o of stand.ordner) {
			karte.set(o.eltern, [...(karte.get(o.eltern) ?? []), o]);
		}
		for (const liste of karte.values()) {
			liste.sort((a, b) => NATUERLICH.compare(a.name, b.name));
		}
		return karte;
	}, [stand.ordner]);

	const zweig = (eltern: string | null, tiefe: number, imBlassen: boolean): ReactNode =>
		(kinderVon.get(eltern) ?? []).map((o) => {
			const unter = (kinderVon.get(o.id)?.length ?? 0) > 0;
			const auf = offen.has(o.id);
			const imFeld = benennen?.schluessel === o.id && benennen.wo === benennWo;
			const istBlass = imBlassen || (blass?.has(o.id) ?? false);
			return (
				<div key={o.id} role="none">
					<BaumZeile
						id={o.id}
						tiefe={tiefe}
						name={imFeld ? <NamensFeld objekt={ordnerObjekt(stand, o)} /> : o.name}
						aktiv={aktuell === o.id}
						aus={gesperrt?.(o.id) ?? false}
						blass={istBlass}
						geteilt={stand.geteilt.ordner.includes(o.id)}
						dreieck={dreieckVon(unter, auf)}
						symbol="ordner"
						klappe={(alles) => klappe(o.id, alles)}
						waehle={() => waehle(o.id)}
						{...(kontext ? { kontext: (e: MouseEvent) => kontext(e, o) } : {})}
						{...(ziehen ? { ziehen: (e: ReactPointerEvent) => ziehen(e, o.id) } : {})}
					/>
					{unter && auf && <div role="group">{zweig(o.id, tiefe + 1, istBlass)}</div>}
				</div>
			);
		});

	return (
		<div role="tree" aria-label="Ordner">
			<BaumZeile
				id={null}
				tiefe={0}
				name={WURZEL_NAME}
				aktiv={aktuell === null}
				aus={wurzelGesperrt ?? false}
				blass={false}
				dreieck={null}
				symbol="blatt"
				waehle={() => waehle(null)}
				{...(kontext ? { kontext: (e: MouseEvent) => kontext(e, null) } : {})}
			/>
			{zweig(null, 1, false)}
		</div>
	);
};
