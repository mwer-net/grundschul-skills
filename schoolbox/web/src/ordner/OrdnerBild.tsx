// >> 178
import { vorschaubildAdresse } from '@schoolbox/kern/src/bildbefehle';

// << 178
import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { vorschauAdresse } from '../lib/zugang';
import type { AblageDok, Objekt } from './typen';

type DatenAttribute = Record<`data-${string}`, string>;

/**
 * Die erste Seite als kleines Blatt: in der Listenzeile und im Ordnerbild. Ohne Vorschau, oder solange Entwürfe auf
 * die Wahl der Lehrkraft warten, ein leeres Blatt (dieselbe Regel wie `Vorschau`).
 */
export const BlattMini = ({
	className,
	dok,
	token,
	...rest
}: { dok: AblageDok; token: string | null; className?: string } & DatenAttribute) => (
	<span
		className={klassen('flex flex-none items-center justify-center overflow-hidden bg-flaeche', className)}
		{...rest}
	>
		{dok.vorschau && !(token === null && hatOffeneEntwuerfe(dok.meta)) ? (
			<img
				className="size-full object-cover object-top"
				// >> 178
				src={vorschaubildAdresse(vorschauAdresse({ mappe: dok.mappe, token }, dok.id, dok.vorschau))}
				// << 178
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

/**
 * Ein Ordner, aus dem bis zu drei Dinge herausschauen, die direkt darin liegen: Material als Blatt, Unterordner als
 * kleine Ordnerform. Leer bleibt er leer. Ohne Text, damit keine Namen aus dem Ordner an der Kachel stehen.
 */
export const OrdnerBild = ({ token, vorne }: { vorne: readonly Objekt[]; token: string | null }) => (
	<div
		className="flex aspect-[8/7] items-center justify-center overflow-hidden bg-leinwand"
		aria-hidden="true"
		data-ordner-bild
	>
		<div className="relative mt-[4%] aspect-[100/74] w-[78%]">
			<svg viewBox="0 0 100 74" className="absolute inset-0 size-full fill-brand-200">
				<path d="M0 5a5 5 0 0 1 5-5h28a5 5 0 0 1 5 5v1h56a6 6 0 0 1 6 6v56a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" />
			</svg>
			<div className="absolute inset-x-[8%] top-[13%] flex h-[68%] justify-center gap-[4%]">
				{vorne.map((o) =>
					o.istOrdner ? (
						<svg
							key={o.schluessel}
							data-vorne="ordner"
							viewBox="0 0 40 50"
							preserveAspectRatio="none"
							className="mt-auto mb-[24%] h-[62%] w-[31%] flex-none fill-brand-500/45"
						>
							<path d="M0 3a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3h19a3 3 0 0 1 3 3v38a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3z" />
						</svg>
					) : (
						<BlattMini
							key={o.schluessel}
							data-vorne="blatt"
							dok={o.dok}
							token={token}
							className="h-full w-[31%] rounded-[2px] shadow-[0_0_0_1px_rgb(16_16_20/8%),0_1px_3px_rgb(16_16_20/12%)]"
						/>
					),
				)}
			</div>
			<div className="absolute inset-x-0 bottom-0 h-[46%] rounded-[6px_6px_8px_8px] bg-brand-100 shadow-[inset_0_1px_0_rgb(255_255_255/70%),0_-2px_6px_rgb(16_16_20/8%)]" />
		</div>
	</div>
);
