import { Menu } from '@base-ui/react/menu';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MenueEintrag } from './Menue';
import { MenueEintraege, POPUP_KLASSEN } from './Menue';
import type { Punkt, ZeigeMenue } from './menue-kontext';
import { MenueKontext } from './menue-kontext';
import { useDaneben } from './ueberlagerung';

interface Offen {
	punkt: Punkt;
	eintraege: MenueEintrag[];
	/** Wohin der Fokus beim Schließen zurückgeht. Das Blatt liegt im `iframe`, das findet Base UI nicht von selbst. */
	fokusZurueck?: () => void;
}

export const MenueAnbieter = ({ children }: { children: ReactNode }) => {
	const [offen, setOffen] = useState<Offen | null>(null);
	const [sichtbar, setSichtbar] = useState(false);
	const zeige = useCallback<ZeigeMenue>((punkt, eintraege, fokusZurueck) => {
		setOffen({ punkt, eintraege, fokusZurueck });
		setSichtbar(true);
	}, []);
	const schliessen = useCallback(() => setSichtbar(false), []);
	useDaneben(sichtbar, schliessen);
	const fokus = useRef(offen?.fokusZurueck);
	fokus.current = offen?.fokusZurueck;

	useEffect(() => {
		if (!sichtbar) {
			return undefined;
		}
		const zu = () => setSichtbar(false);
		// Ein langes Menü rollt in sich selbst (iPad): Das darf es nicht schließen.
		const gerollt = (e: Event) => {
			if (!(e.target instanceof Element && e.target.closest('[role="menu"]'))) {
				zu();
			}
		};
		window.addEventListener('resize', zu);
		window.addEventListener('scroll', gerollt, true);
		return () => {
			window.removeEventListener('resize', zu);
			window.removeEventListener('scroll', gerollt, true);
		};
	}, [sichtbar]);

	const anker = useMemo(() => {
		const x = offen?.punkt.x ?? 0;
		const y = offen?.punkt.y ?? 0;
		return { getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) };
	}, [offen]);

	return (
		<MenueKontext value={zeige}>
			{children}
			<Menu.Root open={sichtbar} modal={false} onOpenChange={setSichtbar}>
				<Menu.Portal>
					<Menu.Positioner
						className="z-menue outline-none"
						anchor={anker}
						side="bottom"
						align="start"
						collisionPadding={8}
					>
						<Menu.Popup
							className={POPUP_KLASSEN}
							data-kontextmenue
							finalFocus={() => {
								if (fokus.current) {
									fokus.current();
									return false;
								}
								return true;
							}}
						>
							{offen && <MenueEintraege eintraege={offen.eintraege} />}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
		</MenueKontext>
	);
};
