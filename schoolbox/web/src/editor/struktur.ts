import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { kann } from '@schoolbox/kern/src/bausteine';
import type { Ablage, StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import {
	ABSTAND,
	dupliziereBaustein,
	fuegeSeiteEin,
	loescheBaustein,
	setzeAbstand,
	setzeSpalten,
	sternNichtAmEnde,
	verschiebeBaustein,
} from '@schoolbox/kern/src/struktur';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { meldung } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import type { PfadTeil } from './darstellung';
import { elementZu, nrVon, VERALTET } from './darstellung';
import { nachbarAblage, nebeneinander, ordnungVon } from './ziele';

interface Optionen {
	/** Das sichtbare Dokument im `iframe` mit dem HTML, aus dem es entstand. */
	geladen: { doc: Document; html: string } | null;
	html: string | null;
	verlauf: { quelle: string } | null;
	pfad: PfadTeil[];
	setAuswahl: (nr: number | null) => void;
	befehl: (neu: string, beschreibung: string) => void;
	rueckgaengig: () => void;
	/** Folien zählen ihre Aufgaben je Folie. */
	folien: boolean;
	/** Keine Versionsvorschau und kein Konflikt offen. */
	frei: boolean;
	/** Im Blatt wird gerade getippt. */
	bearbeitet: boolean;
}

interface Folge {
	quelle: string;
	nr: number | null;
	springen: boolean;
}

export interface Spalten {
	nr: number;
	name: string;
	wert: number;
}

/** Was das Panel zur aktuellen Auswahl anbietet; `null` heißt: geht hier nicht. */
export interface StrukturWerte {
	nach: { zurueck: Ablage | null; vor: Ablage | null; quer: boolean } | null;
	spalten: Spalten | null;
	abstand: number;
	seite: number | null;
	seiten: number;
}

const zahl = (wert: string | undefined, sonst: number) => {
	const n = parseFloat(wert ?? '');
	return Number.isFinite(n) ? n : sonst;
};

const werteVon = (doc: Document, pfad: PfadTeil[]): StrukturWerte => {
	const gewaehlt = pfad.at(-1);
	const element = gewaehlt ? elementZu(doc, gewaehlt.nr) : null;
	const fenster = doc.defaultView;
	let nach: StrukturWerte['nach'] = null;
	if (gewaehlt && element && kann(gewaehlt.baustein, 'ordnen')) {
		const ordnung = ordnungVon(element, gewaehlt.baustein);
		const gruppe = ordnung.gruppen.find((g) => g.glieder.includes(element));
		nach = {
			zurueck: nachbarAblage(ordnung, -1),
			vor: nachbarAblage(ordnung, 1),
			quer: nebeneinander(gruppe?.glieder ?? []),
		};
	}
	const mitSpalten = pfad.findLast((t) => kann(t.baustein, 'spalten'));
	const spaltenElement = mitSpalten ? elementZu(doc, mitSpalten.nr) : null;
	const standard = (b: Baustein) => b.spaltenStandard ?? 1;
	const spalten =
		mitSpalten && spaltenElement
			? {
					nr: mitSpalten.nr,
					name: mitSpalten.name,
					wert: zahl(
						fenster?.getComputedStyle(spaltenElement).getPropertyValue('--spalten'),
						standard(mitSpalten.baustein),
					),
				}
			: null;
	const seite = element?.closest('.seite');
	return {
		nach,
		spalten,
		abstand: zahl(fenster?.getComputedStyle(doc.body).getPropertyValue('--abstand'), ABSTAND.min),
		seite: seite ? nrVon(seite) : null,
		seiten: doc.querySelectorAll('.seite').length,
	};
};

/**
 * Struktur-Befehle aus Panel, Seitenleiste und Ziehen. Jeder ist ein Schritt im Verlauf. Danach steht die Auswahl
 * auf dem verschobenen bzw. neuen Baustein, sobald die neue Fassung zu sehen ist; bis dahin nimmt die alte
 * Darstellung nichts mehr an, weil ihre Nummern nicht mehr stimmen.
 */
export const useStruktur = (o: Optionen) => {
	const zeige = useHinweis();
	const doc = o.geladen && o.geladen.html === o.html ? o.geladen.doc : null;
	const [folge, setFolge] = useState<Folge | null>(null);
	const [springe, setSpringe] = useState(0);
	const quelle = o.verlauf?.quelle ?? null;
	const aktiv = o.frei && !o.bearbeitet;
	const aktuell = useRef({ ...o, quelle, aktiv });

	useEffect(() => {
		aktuell.current = { ...o, quelle, aktiv };
	});

	const { setAuswahl } = o;
	useEffect(() => {
		if (!folge) {
			return;
		}
		if (quelle !== folge.quelle) {
			setFolge(null);
		} else if (doc) {
			setAuswahl(folge.nr);
			if (folge.springen) {
				setSpringe((n) => n + 1);
			}
			setFolge(null);
		}
	}, [folge, doc, quelle, setAuswahl]);

	const fuehreAus = useCallback(
		(beschreibung: string, rechne: (q: string) => StrukturErgebnis, springen = false) => {
			const { aktiv: bereit, befehl, folien, geladen, quelle: alt } = aktuell.current;
			if (!alt || !bereit) {
				return null;
			}
			try {
				const ergebnis = rechne(alt);
				if (ergebnis.quelle === alt) {
					return null;
				}
				befehl(ergebnis.quelle, beschreibung);
				geladen?.doc.documentElement.setAttribute(VERALTET, '');
				aktuell.current.setAuswahl(null);
				setFolge({ quelle: ergebnis.quelle, nr: ergebnis.nr, springen });
				return { alt, folien, ...ergebnis };
			} catch (fehler) {
				zeige({ text: meldung(fehler), art: 'fehler' });
				return null;
			}
		},
		[zeige],
	);

	const nummerierung = () => ({ jeSeite: aktuell.current.folien });

	const zurueckKnopf = () => ({ titel: 'Rückgängig', ausfuehren: () => aktuell.current.rueckgaengig() });

	const verschiebe = (nr: number, ablage: Ablage, springen = false) => {
		const e = fuehreAus('Verschoben', (q) => verschiebeBaustein(q, nr, ablage, nummerierung()), springen);
		if (e && sternNichtAmEnde(e.quelle) && !sternNichtAmEnde(e.alt)) {
			zeige({ text: 'Die Sternchenaufgabe steht jetzt nicht mehr am Ende.', aktion: zurueckKnopf() });
		}
	};

	const dupliziere = (nr: number) => fuehreAus('Kopiert', (q) => dupliziereBaustein(q, nr, nummerierung()), true);

	const loesche = (nr: number, name: string) => {
		if (fuehreAus('Gelöscht', (q) => loescheBaustein(q, nr, nummerierung()))) {
			zeige({ text: `${name} gelöscht.`, aktion: zurueckKnopf() });
		}
	};

	const werte = useMemo(() => (doc ? werteVon(doc, o.pfad) : null), [doc, o.pfad]);

	const neueSeite = (mitNamenszeile: boolean) =>
		fuehreAus(
			'Seite hinzugefügt',
			(q) => fuegeSeiteEin(q, { nach: werte?.seite ?? null, mitNamenszeile }, nummerierung()),
			true,
		);

	/** Ändert nur ein Attribut: Die Nummern bleiben, die Auswahl auch. */
	const spalten = (nr: number, anzahl: number) =>
		fuehreAus('Spalten', (q) => ({ quelle: setzeSpalten(q, nr, anzahl), nr: o.pfad.at(-1)?.nr ?? null }));

	const abstand = (px: number) =>
		fuehreAus('Abstand', (q) => ({ quelle: setzeAbstand(q, px), nr: o.pfad.at(-1)?.nr ?? null }));

	/** Nur zum Ansehen, während der Regler gezogen wird; die Quelle ändert erst das Loslassen. */
	const zeigeAbstand = (px: number) => doc?.body.style.setProperty('--abstand', `${px}px`);

	/** Auswahl von außerhalb des Blatts (Seitenleiste): dorthin rollen. */
	const zeigeAn = (nr: number) => {
		o.setAuswahl(nr);
		setSpringe((n) => n + 1);
	};

	return {
		aktiv,
		werte,
		springe,
		zeigeAn,
		verschiebe,
		dupliziere,
		loesche,
		neueSeite,
		spalten,
		abstand,
		zeigeAbstand,
	};
};

export type Struktur = ReturnType<typeof useStruktur>;
