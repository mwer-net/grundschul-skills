import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

import { Kuerzel } from './Kuerzel';

export const TooltipAnbieter = ({ children }: { children: ReactNode }) => (
	<BaseTooltip.Provider delay={400} closeDelay={0}>
		{children}
	</BaseTooltip.Provider>
);

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
}) => (
	<BaseTooltip.Root disabled={aus}>
		<BaseTooltip.Trigger render={children} />
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
