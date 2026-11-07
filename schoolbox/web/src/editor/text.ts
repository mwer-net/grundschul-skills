import { kann } from '@schoolbox/kern/src/bausteine';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { useCallback, useEffect, useRef, useState } from 'react';

import { entferneLeereSchmuck } from '@schoolbox/kern/src/schmuck';

import type { Urheber } from './bearbeitung';
import { elementZu, trefferAn } from './darstellung';
import { endetNachAnlegen, nimmTextsitzungWunsch } from './gestaltung/textsitzung';
import type { Format, TextSteuerung, TextZustand } from './textdom';
import { ruesteText } from './textdom';

/** Knöpfe im Panel mit diesem Attribut nehmen dem Text den Fokus nicht weg. */
export const TEXTWERKZEUG = 'data-textwerkzeug';

/** So heißt der Schritt, den eine Textsitzung hinterlässt. */
export const TEXT_GEAENDERT = 'Text geändert';

const RUHE: TextZustand = { fett: false, unterstrichen: false, fettMoeglich: true, geaendert: false, farbe: false };

interface Optionen {
	/** Das sichtbare Dokument im `iframe` mit dem HTML, aus dem es entstand. */
	geladen: { doc: Document; html: string } | null;
	/** Das HTML der aktuellen Quelle: Bearbeitet wird nur, wenn das sichtbare Dokument dazu passt. */
	html: string | null;
	zerlegung: Zerlegung | null;
	auswahl: number | null;
	setAuswahl: (neu: (alt: number | null) => number | null) => void;
	bearbeitbar: boolean;
	/** `mitAnlegen` (105): Der Schritt gehört zum Anlegen davor und wird mit ihm einer. */
	befehl: (neu: string, beschreibung: string, mitAnlegen?: boolean) => void;
	/** Nachsehen, ob jemand anderes das Material geändert hat. */
	pruefe: (urheber: Urheber) => Promise<void>;
	/** Bei jeder Eingabe, z. B. für die Live-Prüfung: Die Quelle ändert sich erst am Ende. */
	getippt?: () => void;
	/** Rückgängig oder Wiederholen aus dem Menü des Browsers, während der Text bearbeitbar ist. */
	geschichte: (richtung: 'zurueck' | 'vor') => void;
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
	geschichte,
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
	const rueckrufe = useRef({ befehl, setAuswahl, getippt, geschichte });

	useEffect(() => {
		rueckrufe.current = { befehl, setAuswahl, getippt, geschichte };
	}, [befehl, setAuswahl, getippt, geschichte]);

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
			geschichte: (richtung) => rueckrufe.current.geschichte(richtung),
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
				setZustand({ ...RUHE, fettMoeglich: s.zustand().fettMoeglich, farbe: s.zustand().farbe });
				// 105: Die erste Sitzung neuer Schmuckschrift ist mit dem Anlegen ein Schritt; leer bleibt keiner.
				const anlegen = endetNachAnlegen(zerlegung.quelle);
				if (ergebnis) {
					const fertig = anlegen
						? entferneLeereSchmuck(ergebnis.quelle, ergebnis.umrechnen(treffer.nr))
						: { quelle: ergebnis.quelle, nr: 0 };
					rueckrufe.current.befehl(fertig.quelle, TEXT_GEAENDERT, anlegen);
					rueckrufe.current.setAuswahl((alt) =>
						alt === null || fertig.quelle !== ergebnis.quelle ? null : ergebnis.umrechnen(alt),
					);
				}
			},
		});
		steuerung.current = s;
		if (nimmTextsitzungWunsch(treffer.element, zerlegung.quelle)) {
			s.fokussiere();
			s.markiereAlles();
		}
		// Schon bei der Auswahl: Der Knopf ist dort gesperrt, wo Fett nicht geht.
		setZustand({ ...RUHE, fettMoeglich: s.zustand().fettMoeglich, farbe: s.zustand().farbe });
		return () => {
			steuerung.current = null;
			s.abbauen();
		};
	}, [auswahl, bearbeitbar, doc, zerlegung]);

	// Ein Knopf außerhalb des Materials (Zoom, Zurück …) beendet zuerst die Bearbeitung, damit er mit dem
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
	/** 105: Farbe für die markierten Wörter, nur in Schmuckschrift; `null` nimmt sie heraus. */
	const faerbe = useCallback((farbe: string | null) => steuerung.current?.faerbe(farbe), []);
	/** Aus der Auswahl: Sitzung starten, alles markieren, formatieren. Am Ende bleibt das ein Schritt im Verlauf. */
	const formatiereGanz = useCallback((format: Format) => {
		const s = steuerung.current;
		if (!s) {
			return;
		}
		if (!s.aktiv()) {
			s.fokussiere();
			s.markiereAlles();
		}
		s.formatiere(format);
	}, []);
	const beende = useCallback(() => steuerung.current?.beende(), []);
	const fokussiere = useCallback(() => steuerung.current?.fokussiere(), []);
	const halte = useCallback((an: boolean) => steuerung.current?.halte(an), []);

	return { bearbeitet, zustand, formatiere, formatiereGanz, faerbe, beende, fokussiere, halte, pruefeSpaeter, doc };
};
