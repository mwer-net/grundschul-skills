import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { FocusEvent, ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Kuerzel } from './Kuerzel';

export const TooltipAnbieter = ({ children }: { children: ReactNode }) => (
	<BaseTooltip.Provider delay={400} closeDelay={0}>
		{children}
	</BaseTooltip.Provider>
);

/** Fokus, der aus einem Menü, Popover oder Dialog zurückkommt (Esc, Auswahl), zeigt keinen Tooltip. */
const ausEinemPopup = (e: FocusEvent) =>
	e.relatedTarget instanceof Element && e.relatedTarget.closest('[role="menu"], [role="dialog"], [role="listbox"]');

/**
 * Am Mac nach 400 ms, bei Fokus sofort. Auf dem iPad erscheint er nicht: Nichts Nötiges darf nur hier stehen.
 * `kuerzel` kommt aus einem Register (`kuerzelVon`), nie als Text. Der Tooltip zeigt Name und Kürzel, keine Gesten (53).
 * An einer senkrechten Leiste steht er daneben (`seite`), sonst über dem Knopf.
 */
export const Tooltip = ({
	aus = false,
	children,
	kuerzel,
	seite = 'top',
	text,
}: {
	text: string;
	kuerzel?: string;
	seite?: 'top' | 'right';
	/** Während eines Zugs (167). */
	aus?: boolean;
	children: ReactElement<Record<string, unknown>>;
}) => {
	// Ist der Knopf selbst Auslöser eines Menüs, schweigt der Tooltip, solange es offen ist, und danach, bis Fokus oder
	// Zeiger den Knopf verlassen: Das Menü gibt den Fokus beim Schließen zurück (188-20).
	const offen = children.props['data-popup-open'] !== undefined;
	const [still, setStill] = useState(false);
	useEffect(() => {
		if (offen) {
			setStill(true);
		}
	}, [offen]);
	const weiter = () => {
		if (!offen) {
			setStill(false);
		}
	};
	return (
		<BaseTooltip.Root disabled={aus || offen || still}>
			<BaseTooltip.Trigger
				render={children}
				onFocus={(e) => {
					if (ausEinemPopup(e)) {
						setStill(true);
					}
				}}
				onBlur={weiter}
				onPointerLeave={weiter}
			/>
		<BaseTooltip.Portal>
			<BaseTooltip.Positioner className="z-menue" side={seite} sideOffset={4} collisionPadding={8}>
				<BaseTooltip.Popup
					className="flex items-center gap-2 rounded-md bg-tinte px-1.5 py-1 text-xs text-white shadow-1"
					data-tooltip
				>
					{text}
					{kuerzel && <Kuerzel text={kuerzel} className="text-white/70" />}
				</BaseTooltip.Popup>
			</BaseTooltip.Positioner>
			</BaseTooltip.Portal>
		</BaseTooltip.Root>
	);
};
