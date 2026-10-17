import { kann } from '@schoolbox/kern/src/bausteine';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Urheber } from './bearbeitung';
import { elementZu, trefferAn } from './darstellung';
import type { Format, TextSteuerung, TextZustand } from './textdom';
import { ruesteText } from './textdom';

/** Knöpfe im Panel mit diesem Attribut nehmen dem Text den Fokus nicht weg. */
export const TEXTWERKZEUG = 'data-textwerkzeug';

const RUHE: TextZustand = { fett: false, unterstrichen: false, fettMoeglich: true };

interface Optionen {
	/** Das sichtbare Dokument im `iframe` mit dem HTML, aus dem es entstand. */
	geladen: { doc: Document; html: string } | null;
	/** Das HTML der aktuellen Quelle: Bearbeitet wird nur, wenn das sichtbare Dokument dazu passt. */
	html: string | null;
	zerlegung: Zerlegung | null;
	auswahl: number | null;
	setAuswahl: (neu: (alt: number | null) => number | null) => void;
	bearbeitbar: boolean;
	befehl: (neu: string, beschreibung: string) => void;
	/** Nachsehen, ob jemand anderes das Material geändert hat. */
	pruefe: (urheber: Urheber) => Promise<void>;
	/** Bei jeder Eingabe, z. B. für die Live-Prüfung: Die Quelle ändert sich erst am Ende. */
	getippt?: () => void;
}

/**
 * Text im Material bearbeiten: Ein gewählter Textträger wird bearbeitbar, ein zweites Antippen setzt den Cursor.
 * Während getippt wird, ändert sich die Quelle nicht; erst am Ende entsteht daraus **ein** Befehl.
 */
export const useText = ({
	auswahl,
	bearbeitbar,
	befehl,
	geladen,
	getippt,
	html,
	pruefe,
	setAuswahl,
	zerlegung,
}: Optionen) => {
	const doc = geladen && geladen.html === html ? geladen.doc : null;
	const [bearbeitet, setBearbeitet] = useState(false);
	const [zustand, setZustand] = useState<TextZustand>(RUHE);
	const steuerung = useRef<TextSteuerung | null>(null);
	const rueckrufe = useRef({ befehl, setAuswahl, getippt });

	useEffect(() => {
		rueckrufe.current = { befehl, setAuswahl, getippt };
	}, [befehl, setAuswahl, getippt]);

	useEffect(() => {
		const element = doc && auswahl !== null ? elementZu(doc, auswahl) : null;
		const treffer = trefferAn(element);
		if (
			!doc ||
			!zerlegung ||
			!bearbeitbar ||
			!treffer ||
			treffer.element !== element ||
			!kann(treffer.baustein, 'text')
		) {
			return undefined;
		}
		const s = ruesteText({
			doc,
			element: treffer.element as HTMLElement,
			baustein: treffer.baustein,
			zerlegung,
			beginnt: () => {
				setBearbeitet(true);
				setZustand(s.zustand());
			},
			aendert: () => {
				setZustand(s.zustand());
				rueckrufe.current.getippt?.();
			},
			endet: (ergebnis) => {
				setBearbeitet(false);
				setZustand(RUHE);
				if (ergebnis) {
					rueckrufe.current.befehl(ergebnis.quelle, 'Text geändert');
					rueckrufe.current.setAuswahl((alt) => (alt === null ? null : ergebnis.umrechnen(alt)));
				}
			},
		});
		steuerung.current = s;
		return () => {
			steuerung.current = null;
			s.abbauen();
		};
	}, [auswahl, bearbeitbar, doc, zerlegung]);

	// Ein Knopf außerhalb des Materials (Rückgängig, Zoom, Zurück …) beendet zuerst die Bearbeitung, damit er mit dem
	// fertigen Text arbeitet. Pointer-Ereignisse kommen vor `click`, das Ergebnis ist also schon im Verlauf.
	useEffect(() => {
		const druck = (e: PointerEvent) => {
			const ziel = e.target instanceof Element ? e.target : null;
			if (steuerung.current?.aktiv() && !ziel?.closest(`[${TEXTWERKZEUG}]`)) {
				steuerung.current.beende();
			}
		};
		window.addEventListener('pointerdown', druck, true);
		return () => window.removeEventListener('pointerdown', druck, true);
	}, []);

	// Ändert Claude das Material, während getippt wird, kommt das erst nach dem Tippen an die Reihe.
	const ausstehend = useRef<Urheber | undefined>(undefined);
	useEffect(() => {
		const urheber = ausstehend.current;
		if (!bearbeitet && urheber !== undefined) {
			ausstehend.current = undefined;
			void pruefe(urheber);
		}
	}, [bearbeitet, zerlegung, pruefe]);
	const pruefeSpaeter = (urheber: Urheber) => {
		if (bearbeitet) {
			ausstehend.current = urheber;
		} else {
			void pruefe(urheber);
		}
	};

	const formatiere = useCallback((format: Format) => steuerung.current?.formatiere(format), []);
	const beende = useCallback(() => steuerung.current?.beende(), []);
	const fokussiere = useCallback(() => steuerung.current?.fokussiere(), []);

	return { bearbeitet, zustand, formatiere, beende, fokussiere, pruefeSpaeter };
};
