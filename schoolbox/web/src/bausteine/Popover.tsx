import { Popover as BasePopover } from '@base-ui/react/popover';
import type { ReactElement, ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { klassen } from './klassen';
import { useDaneben } from './ueberlagerung';

interface Eigenschaften {
	ausloeser: ReactElement<Record<string, unknown>>;
	children: ReactNode | ((schliessen: () => void) => ReactNode);
	seite?: 'top' | 'bottom' | 'left' | 'right';
	ausrichtung?: 'start' | 'center' | 'end';
	className?: string;
	name?: string;
}

/** Kleines Fenster an einem Anker. Esc und Klick daneben schließen, auch im `iframe`; der Fokus kommt zurück. */
export const Popover = ({ ausloeser, ausrichtung = 'start', children, className, name, seite = 'bottom' }: Eigenschaften) => {
	const [offen, setOffen] = useState(false);
	const schliessen = useCallback(() => setOffen(false), []);
	useDaneben(offen, schliessen);
	return (
		<BasePopover.Root open={offen} modal={false} onOpenChange={setOffen}>
			<BasePopover.Trigger aria-label={name} render={ausloeser} />
			<BasePopover.Portal>
				<BasePopover.Positioner
					className="z-menue outline-none"
					side={seite}
					align={ausrichtung}
					sideOffset={4}
					collisionPadding={8}
				>
					<BasePopover.Popup
						className={klassen(
							'max-h-[var(--available-height)] overflow-y-auto rounded-xl border border-rand bg-flaeche p-2 text-sm text-tinte shadow-2 outline-none',
							className ?? 'w-64',
						)}
					>
						{typeof children === 'function' ? children(schliessen) : children}
					</BasePopover.Popup>
				</BasePopover.Positioner>
			</BasePopover.Portal>
		</BasePopover.Root>
	);
};
