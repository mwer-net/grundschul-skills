import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

/**
 * 196-36: Der Regler schreibt beim Loslassen einen Schritt im Verlauf. Mit den Pfeiltasten wäre jeder Druck einer;
 * Drücke innerhalb von 800 ms werden ein Schritt, geschrieben nach der Pause oder beim Verlassen.
 */
export const useReglerSchreiben = (
	element: RefObject<HTMLInputElement | null>,
	setze: (wert: number) => void,
	an: unknown = true,
) => {
	const setzeJetzt = useRef(setze);
	useEffect(() => {
		setzeJetzt.current = setze;
	});
	useEffect(() => {
		const e = element.current;
		if (!e) {
			return undefined;
		}
		let taste = false;
		let uhr: ReturnType<typeof setTimeout> | undefined;
		const schreibe = () => {
			clearTimeout(uhr);
			uhr = undefined;
			setzeJetzt.current(Number(e.value));
		};
		const fertig = () => {
			if (!taste) {
				schreibe();
				return;
			}
			clearTimeout(uhr);
			uhr = setTimeout(schreibe, 800);
		};
		const druecke = () => {
			taste = true;
		};
		const zeige = () => {
			taste = false;
		};
		const weg = () => {
			if (uhr !== undefined) {
				schreibe();
			}
		};
		e.addEventListener('change', fertig);
		e.addEventListener('keydown', druecke);
		e.addEventListener('pointerdown', zeige);
		e.addEventListener('blur', weg);
		return () => {
			e.removeEventListener('change', fertig);
			e.removeEventListener('keydown', druecke);
			e.removeEventListener('pointerdown', zeige);
			e.removeEventListener('blur', weg);
			if (uhr !== undefined) {
				schreibe();
			}
		};
	}, [element, an]);
};
