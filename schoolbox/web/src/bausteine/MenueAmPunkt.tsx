import { Menu } from '@base-ui/react/menu';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { MenueEintrag } from './Menue';
import { MenueEintraege, POPUP_KLASSEN } from './Menue';
import { useDaneben } from './ueberlagerung';

export interface Punkt {
	x: number;
	y: number;
}

interface Offen {
	punkt: Punkt;
	eintraege: MenueEintrag[];
	/** Wohin der Fokus beim Schließen zurückgeht. Das Blatt liegt im `iframe`, das findet Base UI nicht von selbst. */
	fokusZurueck?: () => void;
}

export type ZeigeMenue = (punkt: Punkt, eintraege: MenueEintrag[], fokusZurueck?: () => void) => void;

const MenueKontext = createContext<ZeigeMenue>(() => undefined);

/** Öffnet ein Menü an Koordinaten im Elternfenster, zum Beispiel beim Rechtsklick. */
export const useZeigeMenue = () => useContext(MenueKontext);

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
		window.addEventListener('resize', zu);
		window.addEventListener('scroll', zu, true);
		return () => {
			window.removeEventListener('resize', zu);
			window.removeEventListener('scroll', zu, true);
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
