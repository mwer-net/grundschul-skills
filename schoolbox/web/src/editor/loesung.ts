import { kann } from '@schoolbox/kern/src/bausteine';
import {
	andereBeispiele,
	fehlendeLoesungen,
	istAntwort,
	istBeispiel,
	kannBeispielSein,
	loesungVon,
	setzeBeispiel,
	setzeLoesung,
} from '@schoolbox/kern/src/loesungen';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { zerlege } from '@schoolbox/kern/src/quelltext';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useHinweis } from '../bausteine/hinweis';
import type { PfadTeil } from './darstellung';
import { elementZu, pfadZu } from './darstellung';
import type { Struktur } from './struktur';

interface Optionen {
	/** Das sichtbare Dokument; die Vorschau gilt nur, wenn es zur aktuellen Quelle (`html`) gehört. */
	geladen: { doc: Document; html: string } | null;
	html: string | null;
	zerlegung: Zerlegung | null;
	pfad: PfadTeil[];
	struktur: Struktur;
	/** Lösungsansicht statt Arbeitsblatt. */
	loesung: boolean;
	rueckgaengig: () => void;
}

/** Zeigt im Blatt die Lösung, die gerade getippt wird; leer heißt: Linie ohne Lösung. */
const zeige = (doc: Document, nr: number, wert: string) => {
	const element = elementZu(doc, nr);
	if (!element) {
		return;
	}
	if (wert.trim()) {
		element.setAttribute('data-l', wert);
	} else {
		element.removeAttribute('data-l');
	}
};

/**
 * Lösungen im Editor (019): die richtige Antwort einer Antwortlinie als Entwurf, der sich sofort im Blatt zeigt und
 * beim Verlassen des Felds bzw. mit ⏎ ein Schritt im Verlauf wird; Antwortlinien ohne Lösung; „Als Beispiel zeigen“
 * für Items. Nur Attribute ändern sich, die Nummern und damit die Auswahl bleiben.
 */
export const useLoesung = ({ geladen, html, loesung, pfad, rueckgaengig, struktur, zerlegung }: Optionen) => {
	const hinweis = useHinweis();
	const doc = geladen?.html === html ? geladen.doc : null;
	const gewaehlt = pfad.at(-1);
	const knoten = gewaehlt ? zerlegung?.knoten[gewaehlt.nr] : undefined;

	const antwort = gewaehlt && knoten && kann(gewaehlt.baustein, 'loesung') && istAntwort(knoten) ? gewaehlt.nr : null;
	const gespeichert = antwort !== null && knoten ? loesungVon(knoten) : '';
	const basis = antwort === null ? null : `${antwort}:${gespeichert}`;
	const [entwurf, setEntwurf] = useState<{ basis: string; wert: string } | null>(null);
	const wert = entwurf && entwurf.basis === basis ? entwurf.wert : gespeichert;

	const fehlend = useMemo(() => (zerlegung ? fehlendeLoesungen(zerlegung).map((k) => k.nr) : []), [zerlegung]);
	const antwortlinien = useMemo(() => zerlegung?.knoten.filter(istAntwort).length ?? 0, [zerlegung]);
	const imBeispiel = useMemo(
		() => Boolean(doc && antwort !== null && elementZu(doc, antwort)?.closest('.beispiel')),
		[doc, antwort],
	);

	/**
	 * Übernimmt einen Entwurf, solange an dieser Stelle noch dieselbe Antwortlinie mit derselben Lösung steht; so
	 * landet er nie in einem Element, das inzwischen anders aussieht.
	 */
	const schreibe = (nr: number, alt: string, neu: string) => {
		if (neu.trim() === alt) {
			return;
		}
		struktur.aendereAttribute('Lösung', (q) => {
			const k = zerlege(q).knoten[nr];
			return k && istAntwort(k) && loesungVon(k) === alt ? setzeLoesung(q, nr, neu) : q;
		});
	};

	const aktuell = useRef({ antwort, gespeichert, wert });
	const zuletzt = useRef<{ doc: Document | null; nr: number; gespeichert: string; wert: string } | null>(null);
	useEffect(() => {
		aktuell.current = { antwort, gespeichert, wert };
		// Weg von der Antwortlinie, ohne das Feld zu verlassen (Antippen im Blatt): Der Entwurf geht nicht verloren.
		const alt = zuletzt.current;
		if (alt && alt.nr !== antwort) {
			schreibe(alt.nr, alt.gespeichert, alt.wert);
			if (alt.doc) {
				zeige(alt.doc, alt.nr, alt.gespeichert);
			}
		}
		zuletzt.current = antwort === null ? null : { doc, nr: antwort, gespeichert, wert };
	});

	const uebernimm = () => {
		const { antwort: nr, gespeichert: alt, wert: neu } = aktuell.current;
		if (nr !== null) {
			schreibe(nr, alt, neu);
		}
	};

	useEffect(() => {
		if (doc && antwort !== null) {
			zeige(doc, antwort, wert);
		}
	}, [doc, antwort, wert]);

	const tippe = (neu: string) => {
		if (basis !== null) {
			aktuell.current = { ...aktuell.current, wert: neu };
			setEntwurf({ basis, wert: neu });
		}
	};

	const verwirf = () => setEntwurf(null);

	/** Die nächste Antwortlinie ohne Lösung nach der gewählten, sonst die erste. */
	const naechsteFehlende = () => {
		const ab = gewaehlt?.nr ?? -1;
		const ziel = fehlend.find((nr) => nr > ab && nr !== antwort) ?? fehlend.find((nr) => nr !== antwort);
		if (ziel !== undefined) {
			uebernimm();
			struktur.zeigeAn(ziel);
		}
	};

	const item = gewaehlt && knoten && kann(gewaehlt.baustein, 'beispiel') ? gewaehlt.nr : null;
	const beispiel = useMemo(() => {
		if (item === null || !zerlegung || !knoten || loesung) {
			return null;
		}
		const an = istBeispiel(knoten);
		if (!an && !kannBeispielSein(zerlegung, item)) {
			return null;
		}
		const andere = andereBeispiele(zerlegung, item).map((k) => k.nr);
		const namen = doc ? andere.map((nr) => pfadZu(doc, nr).at(-1)?.name ?? 'Ein anderes Item') : [];
		return { an, andere: namen };
	}, [item, zerlegung, knoten, loesung, doc]);

	const setzeAlsBeispiel = (an: boolean) => {
		if (item === null) {
			return;
		}
		const abgeloest = an ? (beispiel?.andere ?? []) : [];
		const ok = struktur.aendereAttribute(
			an ? 'Als Beispiel' : 'Kein Beispiel mehr',
			(q) => setzeBeispiel(q, item, an).quelle,
		);
		if (ok && abgeloest.length > 0) {
			hinweis({
				text: `${abgeloest.join(', ')} ${abgeloest.length > 1 ? 'sind' : 'ist'} jetzt kein Beispiel mehr.`,
				aktion: { titel: 'Rückgängig', ausfuehren: rueckgaengig },
			});
		}
	};

	return {
		aktiv: struktur.aktiv,
		/** Gewählte Antwortlinie (nur in der Lösungsansicht wählbar). */
		antwort,
		wert,
		imBeispiel,
		tippe,
		uebernimm,
		verwirf,
		/** Antwortlinien ohne Lösung im ganzen Blatt. */
		fehlend,
		antwortlinien,
		naechsteFehlende,
		/** „Als Beispiel zeigen“ für das gewählte Item, nur auf dem Arbeitsblatt und nur mit etwas zum Zeigen. */
		beispiel,
		setzeAlsBeispiel,
	};
};

export type LoesungSteuerung = ReturnType<typeof useLoesung>;
