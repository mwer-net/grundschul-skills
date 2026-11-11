import { mitAnkern } from '@schoolbox/kern/src/anker';
import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { kann } from '@schoolbox/kern/src/bausteine';
// >> 171
import type { LetzterSchritt, Zerlegung } from '@schoolbox/kern/src/quelltext';
// << 171
import type { Ablage, StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import {
	ABSTAND,
	dupliziereBaustein,
	entferneAbstand,
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
// >> 171
import { elementZu, nrVon, trefferAn, VERALTET, zielNachSchritt } from './darstellung';
import type { Geladen } from './gezeigt';
import { gezeigtVon } from './gezeigt';
// << 171
import { nachbarAblage, nebeneinander, ordnungVon } from './ziele';

interface Optionen {
	// >> 171
	/** Das sichtbare Dokument im `iframe` mit dem HTML und der Zerlegung, aus denen es entstand. */
	geladen: Geladen | null;
	html: string | null;
	/** Die neueste Zerlegung, aus der `html` entsteht. */
	zerlegung: Zerlegung | null;
	verlauf: { quelle: string; zuletzt?: LetzterSchritt } | null;
	// << 171
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
	/** Was das Blatt ohne eigenen Abstand hätte (Klasse, Format); `null` ohne `blatt.css`. */
	abstandVorgabe: number | null;
	seite: number | null;
	seiten: number;
}

const zahl = (wert: string | undefined, sonst: number) => {
	const n = parseFloat(wert ?? '');
	return Number.isFinite(n) ? n : sonst;
};

/** Liest den Stil ohne die Überschreibung am `<body>`: Die Vorgabe steht in `blatt.css`, nicht in einer zweiten Tabelle. */
const abstandOhneUeberschreibung = (doc: Document) => {
	const { style } = doc.body;
	const gesetzt = style.getPropertyValue('--abstand');
	style.removeProperty('--abstand');
	const px = parseFloat(doc.defaultView?.getComputedStyle(doc.body).getPropertyValue('--abstand') ?? '');
	if (gesetzt) {
		style.setProperty('--abstand', gesetzt);
	}
	return Number.isFinite(px) ? px : null;
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
		abstandVorgabe: abstandOhneUeberschreibung(doc),
		seite: seite ? nrVon(seite) : null,
		seiten: doc.querySelectorAll('.seite:not([data-erzeugt])').length,
	};
};

// >> 171
/**
 * Struktur-Befehle aus Panel, Gliederung und Ziehen. Jeder ist ein Schritt im Verlauf. Seitenleisten und Leisten lesen
 * `gezeigt`: das Blatt, das zu sehen ist, bis das nächste da ist. Ändert ein Schritt die Nummer der Auswahl, wartet die
 * neue und gilt im selben Render wie das neue Bild (`nachBild`); bis dahin schreibt nichts mit den alten Nummern, und
 * die alte Darstellung nimmt nichts mehr an.
 */
export const useStruktur = (o: Optionen) => {
	const zeige = useHinweis();
	const [folge, setFolge] = useState<Folge | null>(null);
	const [springe, setSpringe] = useState(0);
	const quelle = o.verlauf?.quelle ?? null;
	const aktiv = o.frei && !o.bearbeitet;
	// Der Schritt von ⌘Z/⇧⌘Z, dessen Stelle schon zu sehen ist; ein neuer wartet aufs Bild (`nimmAuf` lässt ihn weg).
	const zuletzt = o.verlauf?.zuletzt;
	const [gezeigterSchritt, setGezeigterSchritt] = useState(zuletzt);
	const wartet = folge !== null || (zuletzt !== undefined && zuletzt !== gezeigterSchritt);
	const { geladen, html, zerlegung } = o;
	const gezeigt = useMemo(
		() => gezeigtVon({ geladen, zerlegung, quelle, html, wartet }),
		[geladen, zerlegung, quelle, html, wartet],
	);
	const gleich = gezeigt?.gleich ?? false;
	const doc = gezeigt?.doc ?? null;
	const aktuell = useRef({ ...o, quelle, aktiv, gleich, folge, gezeigterSchritt });

	useEffect(() => {
		aktuell.current = { ...o, quelle, aktiv, gleich, folge, gezeigterSchritt };
	});

	/**
	 * Das nächste Bild ist da. `merken` im Editor ruft das im selben Aufruf wie `setGeladen`, damit Bild und Auswahl in
	 * einem Render wechseln. Erst ein Bild der neuesten Quelle (`frisch`) löst auf, was wartet.
	 */
	const nachBild = useCallback((bild: Document, z: Zerlegung, frisch: boolean) => {
		if (!frisch) {
			return;
		}
		const { folge: f, frei, gezeigterSchritt: schon, setAuswahl, verlauf } = aktuell.current;
		if (f) {
			// Nicht alles ist wählbar (z. B. ein Fuß): dann der Baustein darum. Eine ältere Folge verfällt.
			const ziel = f.quelle === z.quelle && f.nr !== null ? (trefferAn(elementZu(bild, f.nr))?.nr ?? f.nr) : null;
			setAuswahl(ziel);
			if (f.springen && ziel !== null) {
				setSpringe((n) => n + 1);
			}
			aktuell.current.folge = null;
			setFolge(null);
		}
		// Nach dem Schritt ist zu sehen, was er zurückgenommen hat. Gezeigt gilt er in jedem Fall, sonst wartete er ewig.
		const schritt = verlauf?.zuletzt;
		if (schritt !== undefined && schritt !== schon) {
			if (frei) {
				const ziel = zielNachSchritt(bild, z, schritt);
				setAuswahl(ziel);
				if (ziel !== null) {
					setSpringe((n) => n + 1);
				}
			}
			aktuell.current.gezeigterSchritt = schritt;
			setGezeigterSchritt(schritt);
		}
	}, []);

	// Ergibt ein Schritt dasselbe HTML, lädt das Blatt nicht neu: Dann gilt das gezeigte Bild schon für die neue Quelle.
	const bildFrisch = gezeigt?.frisch ?? false;
	useEffect(() => {
		if (wartet && bildFrisch && doc && zerlegung) {
			nachBild(doc, zerlegung, true);
		}
	}, [wartet, bildFrisch, doc, zerlegung, nachBild]);

	const fuehreAus = useCallback(
		(beschreibung: string, rechne: (q: string) => StrukturErgebnis, springen = false) => {
			const { aktiv: bereit, befehl, folien, geladen: bild, gleich: passt, pfad, quelle: alt } = aktuell.current;
			// Stimmen die Nummern des Bilds nicht mehr, träfe der Schritt ein anderes Element: nichts tun, ohne Sperre.
			if (!alt || !bereit || !passt) {
				return null;
			}
			try {
				const ergebnis = rechne(alt);
				if (ergebnis.quelle === alt) {
					return null;
				}
				befehl(ergebnis.quelle, beschreibung);
				bild?.doc.documentElement.setAttribute(VERALTET, '');
				if (springen || ergebnis.nr !== (pfad.at(-1)?.nr ?? null)) {
					const neu = { quelle: ergebnis.quelle, nr: ergebnis.nr, springen };
					// Sofort: Ein zweiter Aufruf im selben Zug schreibt nicht mit den alten Nummern.
					aktuell.current.folge = neu;
					aktuell.current.gleich = false;
					setFolge(neu);
				}
				return { alt, folien, ...ergebnis };
			} catch (fehler) {
				zeige({ text: meldung(fehler), art: 'fehler' });
				return null;
			}
		},
		[zeige],
	);
	// << 171

	/**
	 * Nur Attribute ändern sich (Abbildungen): Die Nummern bleiben gleich, deshalb bleibt die Auswahl stehen und die
	 * alte Darstellung darf bis zur neuen weiter antippen.
	 */
	const aendereAttribute = useCallback(
		(beschreibung: string, rechne: (q: string) => string) => {
			// >> 171
			const { aktiv: bereit, befehl, gleich: passt, quelle: alt } = aktuell.current;
			if (!alt || !bereit || !passt) {
				// << 171
				return false;
			}
			try {
				const neu = rechne(alt);
				if (neu !== alt) {
					befehl(neu, beschreibung);
				}
				return true;
			} catch (fehler) {
				zeige({ text: meldung(fehler), art: 'fehler' });
				return false;
			}
		},
		[zeige],
	);

	const nummerierung = () => ({ jeSeite: aktuell.current.folien });

	const zurueckKnopf = () => ({ titel: 'Rückgängig', ausfuehren: () => aktuell.current.rueckgaengig() });

	const verschiebe = (nr: number, ablage: Ablage, springen = false, beschreibung = 'Verschoben') => {
		const e = fuehreAus(beschreibung, (q) => verschiebeBaustein(q, nr, ablage, nummerierung()), springen);
		if (e && sternNichtAmEnde(e.quelle) && !sternNichtAmEnde(e.alt)) {
			zeige({ text: 'Die Sternchenaufgabe steht jetzt nicht mehr am Ende.', aktion: zurueckKnopf() });
		}
		return e !== null;
	};

	/** Probelauf ohne Wirkung: Der Kern entscheidet, was geht, nicht die Oberfläche. */
	const kannVerschieben = (nr: number, ablage: Ablage) => {
		// >> 171
		const { aktiv: bereit, gleich: passt, quelle: stand } = aktuell.current;
		if (!stand || !bereit || !passt) {
			// << 171
			return false;
		}
		try {
			verschiebeBaustein(stand, nr, ablage, nummerierung());
			return true;
		} catch {
			return false;
		}
	};

	const dupliziere = (nr: number) => fuehreAus('Kopiert', (q) => dupliziereBaustein(q, nr, nummerierung()), true);

	const loesche = (nr: number, name: string, wie: 'Gelöscht' | 'Ausgeschnitten' = 'Gelöscht') => {
		const mit = quelle ? mitAnkern(quelle, nr) : ''; // 106: „Gelöscht, mit Wilma“
		if (fuehreAus(`${wie}${mit}`, (q) => loescheBaustein(q, nr, nummerierung()))) {
			zeige({ text: `${name} ${wie.toLowerCase()}${mit}.`, aktion: zurueckKnopf() });
		}
	};

	// >> 171: am gezeigten Blatt gemessen, also auch beim Nachladen da
	const werte = useMemo(() => (doc ? werteVon(doc, o.pfad) : null), [doc, o.pfad]);
	// << 171

	const neueSeite = (mitNamenszeile: boolean) =>
		fuehreAus(
			'Seite hinzugefügt',
			(q) => fuegeSeiteEin(q, { nach: werte?.seite ?? null, mitNamenszeile }, nummerierung()),
			true,
		);

	/** Ändert nur ein Attribut: Die Nummern bleiben, die Auswahl auch. */
	const spalten = (nr: number, anzahl: number) =>
		fuehreAus('Spalten', (q) => ({ quelle: setzeSpalten(q, nr, anzahl), nr: o.pfad.at(-1)?.nr ?? null }));

	/** Nur ein Attribut am `<body>`: Die Auswahl bleibt, und der Reiter „Blatt“ springt nicht zurück auf „Auswahl“. */
	const abstand = (px: number) => aendereAttribute('Abstand', (q) => setzeAbstand(q, px));

	/** Das Blatt folgt wieder der Vorgabe seiner Klasse. */
	const abstandZurVorgabe = () => aendereAttribute('Abstand', entferneAbstand);

	/** Nur zum Ansehen, während der Regler gezogen wird; die Quelle ändert erst das Loslassen. */
	const zeigeAbstand = (px: number) => doc?.body.style.setProperty('--abstand', `${px}px`);

	/** Auswahl von außerhalb des Blatts (Gliederung): dorthin rollen. */
	const zeigeAn = (nr: number) => {
		o.setAuswahl(nr);
		setSpringe((n) => n + 1);
	};

	return {
		aktiv,
		// >> 171
		gezeigt,
		nachBild,
		// << 171
		fuehreAus,
		aendereAttribute,
		werte,
		springe,
		zeigeAn,
		verschiebe,
		kannVerschieben,
		dupliziere,
		loesche,
		neueSeite,
		spalten,
		abstand,
		abstandZurVorgabe,
		zeigeAbstand,
	};
};

export type Struktur = ReturnType<typeof useStruktur>;
