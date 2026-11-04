import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

import { Kuerzel } from './Kuerzel';

export const TooltipAnbieter = ({ children }: { children: ReactNode }) => (
	<BaseTooltip.Provider delay={400} closeDelay={0}>
		{children}
	</BaseTooltip.Provider>
);

/** Am Mac nach 400 ms, bei Fokus sofort. Auf dem iPad erscheint er nicht: Nichts Nötiges darf nur hier stehen. */
export const Tooltip = ({
	children,
	kuerzel,
	text,
}: {
	text: string;
	kuerzel?: string;
	children: ReactElement<Record<string, unknown>>;
}) => (
	<BaseTooltip.Root>
		<BaseTooltip.Trigger render={children} />
		<BaseTooltip.Portal>
			<BaseTooltip.Positioner className="z-menue" sideOffset={4} collisionPadding={8}>
				<BaseTooltip.Popup className="flex items-center gap-2 rounded-md bg-tinte px-1.5 py-1 text-xs text-white shadow-1">
					{text}
					{kuerzel && <Kuerzel text={kuerzel} className="text-white/70" />}
				</BaseTooltip.Popup>
			</BaseTooltip.Positioner>
		</BaseTooltip.Portal>
	</BaseTooltip.Root>
);
