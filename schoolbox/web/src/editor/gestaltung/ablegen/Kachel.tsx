import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { AmZeiger } from '../../../bausteine/AmZeiger';
import { klassen } from '../../../bausteine/klassen';
import { Tooltip } from '../../../bausteine/Tooltip';
import { FINGER_WEG, HALTEN_MS, MAUS_WEG } from '../../ziehen';
import type { AblegenTeile } from './ablegen';
import { GEHT_NOCH_NICHT } from './ablegen';
import { useAblegen } from './useAblegen';
import type { GestaltungsGut } from './ziehgut';

/**
 * Ein Eintrag einer Schublade mit Gestaltung (102–105): Klick legt in die Mitte, Ziehen legt frei ab. Wie die Karten
 * der Bausteine (094): mit der Maus ab `MAUS_WEG`, mit dem Finger nach `HALTEN_MS`, damit Wischen die Liste rollt.
 * Den Namen zeigt der Tooltip, ohne Kürzel; während des Zugs ist er aus (167).
 */
export const AblageKachel = ({
	aus = false,
	beschriftung,
	children,
	className,
	daten,
	gut,
	klick: eigenerKlick,
	teile,
}: {
	teile: AblegenTeile;
	gut: GestaltungsGut;
	/** Für Vorleser und Tooltip; ohne Angabe der Name des Guts. */
	beschriftung?: string;
	className?: string;
	children: ReactNode;
	/** Klick ohne Ziehen; ohne Angabe legt er das Gut in die Mitte (103: Bilder setzen wie heute ein). */
	klick?: () => void;
	aus?: boolean;
	/** `data-*`-Attribute am Knopf, etwa für Tests. */
	daten?: Readonly<Record<`data-${string}`, string>>;
}) => {
	const { amZeiger, klick, ziehe } = useAblegen(teile);
	const druckAn = useRef<{ x: number; y: number; id: number; maus: boolean; timer: number } | null>(null);
	const gezogen = useRef(false);
	const knopf = useRef<HTMLButtonElement>(null);

	const loese = () => {
		if (druckAn.current) {
			window.clearTimeout(druckAn.current.timer);
		}
		druckAn.current = null;
	};
	useEffect(() => loese, []);

	const beginne = (x: number, y: number, id: number, cmd: boolean) => {
		loese();
		if (!ziehe(gut, { x, y, id, cmd })) {
			return;
		}
		gezogen.current = true;
		try {
			knopf.current?.setPointerCapture(id);
		} catch {
			// Ohne Fangen endet der Zug trotzdem beim Loslassen.
		}
	};
	const druck = (ev: ReactPointerEvent<HTMLElement>) => {
		gezogen.current = false;
		loese();
		if (!ev.isPrimary) {
			return;
		}
		const { clientX: x, clientY: y, pointerId: id } = ev;
		if (ev.pointerType !== 'mouse') {
			druckAn.current = {
				x,
				y,
				id,
				maus: false,
				timer: window.setTimeout(() => beginne(x, y, id, false), HALTEN_MS),
			};
		} else if (ev.button === 0 && !ev.ctrlKey) {
			druckAn.current = { x, y, id, maus: true, timer: 0 };
		}
	};
	const bewege = (ev: ReactPointerEvent<HTMLElement>) => {
		const start = druckAn.current;
		if (!start || ev.pointerId !== start.id) {
			return;
		}
		const weg = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
		if (start.maus && weg > MAUS_WEG) {
			beginne(ev.clientX, ev.clientY, ev.pointerId, ev.metaKey);
		} else if (!start.maus && weg > FINGER_WEG) {
			loese();
		}
	};
	const name = beschriftung ?? gut.name;

	return (
		<>
			<Tooltip text={name} aus={amZeiger !== null}>
				<button
					ref={knopf}
					type="button"
					aria-label={name}
					className={klassen('select-none', amZeiger ? 'cursor-grabbing' : 'cursor-grab', className)}
					disabled={aus}
					{...daten}
					data-ablage-gut={gut.name}
					onPointerDown={druck}
					onPointerMove={bewege}
					onPointerLeave={(ev) => {
						if (druckAn.current?.maus && ev.pointerId === druckAn.current.id) {
							beginne(ev.clientX, ev.clientY, ev.pointerId, ev.metaKey);
						}
					}}
					onPointerUp={loese}
					onPointerCancel={loese}
					onContextMenu={(ev) => {
						if (druckAn.current || gezogen.current) {
							ev.preventDefault();
						}
					}}
					onClick={() => {
						// Nach einem Zug schluckt `schluckeKlick` den Klick meist schon; sonst hier.
						if (!gezogen.current) {
							if (eigenerKlick) {
								eigenerKlick();
							} else {
								klick(gut);
							}
						}
						gezogen.current = false;
					}}
				>
					{children}
				</button>
			</Tooltip>
			{amZeiger && (
				<AmZeiger
					className={klassen(
						'rounded-lg px-3 py-2 font-medium whitespace-nowrap text-white shadow-2',
						amZeiger.name === GEHT_NOCH_NICHT ? 'bg-leise' : 'bg-tinte',
					)}
					data-zug-anzeige
					data-geht-nicht={amZeiger.name === GEHT_NOCH_NICHT ? '' : undefined}
					x={amZeiger.x + 10}
					y={amZeiger.y + 10}
				>
					{amZeiger.name}
				</AmZeiger>
			)}
		</>
	);
};
