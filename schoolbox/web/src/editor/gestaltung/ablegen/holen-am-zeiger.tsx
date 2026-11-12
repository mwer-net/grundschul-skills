import { useCallback, useEffect, useRef, useState } from 'react';

import { AmZeiger } from '../../../bausteine/AmZeiger';

/**
 * Ziehen aus „Bilder“ und „Figuren“ (103, 177): Erst beim Loslassen holt der Server das Bild in diesen Ordner; so lange
 * steht „Bild wird geholt …“ am Zeiger. `zeige` passt zu `mitGeholtemBild`, `anzeige` gehört neben die Schublade.
 */
export const useHolenAmZeiger = () => {
	const zeiger = useRef({ x: 0, y: 0 });
	const [geholt, setGeholt] = useState<{ x: number; y: number } | null>(null);
	useEffect(() => {
		const merke = (e: PointerEvent) => {
			zeiger.current = { x: e.clientX, y: e.clientY };
		};
		window.addEventListener('pointermove', merke, true);
		window.addEventListener('pointerup', merke, true);
		return () => {
			window.removeEventListener('pointermove', merke, true);
			window.removeEventListener('pointerup', merke, true);
		};
	}, []);
	const zeige = useCallback((laeuft: boolean) => setGeholt(laeuft ? zeiger.current : null), []);
	const anzeige = geholt && (
		<AmZeiger
			className="rounded-lg bg-tinte px-3 py-2 font-medium whitespace-nowrap text-white shadow-2"
			data-bild-holen
			x={geholt.x + 10}
			y={geholt.y + 10}
		>
			Bild wird geholt …
		</AmZeiger>
	);
	return { zeige, anzeige };
};
