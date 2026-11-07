import { leseBlatt } from '@schoolbox/kern/src/kit-einstellungen';
import type { Seiten } from '@schoolbox/kern/src/seitengestaltung';
import { bleibtNummer, leseSeitengestaltung, seitenNummern } from '@schoolbox/kern/src/seitengestaltung';
import { useEffect, useMemo, useState } from 'react';

import { Segment } from '../../../bausteine/Segment';
import { Symbol } from '../../../bausteine/Symbol';
import { elementZu, nrVon } from '../../darstellung';
import type { Struktur } from '../../struktur';
import { BlattFlaeche } from './flaeche';
import { BlattRahmen } from './rahmen';
import { BlattRezept } from './rezept';
import type { BlattTeile } from './teile';
import { quellSeiten, zeigeAmTeil } from './teile';

/** Welche Seite der Abschnitt zeigt: die der Auswahl, ohne Auswahl die sichtbare (wie die Palette). */
export interface BlattSeite {
	auswahl: number | null;
	/** Die sichtbare Seite im Blatt, ab 1, wie `useSichtbareSeite` sie zählt. */
	sichtbar: number;
}

const OEFFNEN = 'schoolbox-blatt-gestaltung';
/** Kommt der Wunsch, bevor der Reiter „Blatt“ zu sehen ist, liest ihn der Abschnitt beim Erscheinen. */
let offenerWunsch: number | null = null;

/**
 * Index der Seite unter den Seiten der Quelle. Über den Index, nicht die Nummer: Nach einer Änderung auf einer früheren
 * Seite verschieben sich die Nummern, solange das Blatt noch die alte Fassung zeigt.
 */
const seitenIndex = (doc: Document | null, { auswahl, sichtbar }: BlattSeite) => {
	if (!doc) {
		return 0;
	}
	const seiten = quellSeiten(doc);
	const nrDer = (e: Element | null | undefined) => (e ? nrVon(e) : null);
	const gewaehlt = auswahl === null ? null : nrDer(elementZu(doc, auswahl)?.closest('.seite'));
	const nr = gewaehlt ?? nrDer(doc.querySelectorAll('.seite')[sichtbar - 1]);
	return Math.max(0, seiten.findIndex((s) => nrVon(s) === nr));
};

/**
 * Aus den Ebenen: Seite `nr` wählen, Reiter „Blatt“ zeigen und den Abschnitt „Gestaltung“ aufklappen.
 * `zeigeEinstellung` ist die Sprungfunktion des Editors (wie aus der Palette).
 */
export const zeigeBlattGestaltung = (nr: number, zeigeAn: (nr: number) => void, zeigeEinstellung: (ort: string) => void) => {
	offenerWunsch = nr;
	zeigeAn(nr);
	zeigeEinstellung('gestaltung');
	window.dispatchEvent(new CustomEvent(OEFFNEN));
};

interface Eigenschaften {
	doc: Document | null;
	quelle: string;
	struktur: Struktur;
	seite: BlattSeite;
}

/**
 * Reiter „Blatt“ › Gestaltung (5.8): „Gilt für“, darunter Rezept (119), Seitenfläche und Rahmen. Eingeklappt, wenn die
 * Seite weder Fläche noch Rahmen hat.
 */
export const BlattGestaltung = ({ doc, quelle, seite, struktur }: Eigenschaften) => {
	const nummern = useMemo(() => seitenNummern(quelle), [quelle]);
	const index = Math.min(seitenIndex(doc, seite), Math.max(0, nummern.length - 1));
	const nr = nummern[index] ?? null;
	const gestaltung = useMemo(() => (nr === null ? null : leseSeitengestaltung(quelle, nr)), [quelle, nr]);
	const minibuch = useMemo(() => leseBlatt(quelle).format === 'minibuch', [quelle]);
	const [gilt, setGilt] = useState<'seite' | 'alle'>('seite');
	const [gemerkt, setGemerkt] = useState<{ index: number; offen: boolean } | null>(null);
	/** Nummer der Seite, die aus den Ebenen aufgeklappt werden soll. */
	const [wunsch, setWunsch] = useState<number | null>(null);

	useEffect(() => {
		const oeffne = () => {
			if (offenerWunsch !== null) {
				setWunsch(offenerWunsch);
				offenerWunsch = null;
			}
		};
		oeffne();
		window.addEventListener(OEFFNEN, oeffne);
		return () => window.removeEventListener(OEFFNEN, oeffne);
	}, []);

	if (nr === null || !gestaltung) {
		return null;
	}
	const hat = gestaltung.flaeche !== null || gestaltung.rahmen !== null;
	// Ein Wunsch aus den Ebenen gilt für die Seite, die er gewählt hat, sobald sie hier ankommt.
	let offen = gemerkt?.index === index ? gemerkt.offen : hat;
	if (wunsch !== null && wunsch === nr) {
		offen = true;
	}
	const ziel: Seiten = gilt === 'alle' ? 'alle' : [nr];
	const teile: BlattTeile = {
		doc,
		quelle,
		seite: nr,
		ziel,
		gestaltung,
		minibuch,
		aendere: (beschreibung, rechne) => {
			const { auswahl } = seite;
			struktur.fuehreAus(
				beschreibung,
				(q) => {
					const neu = rechne(q);
					return { quelle: neu, nr: auswahl !== null && bleibtNummer(q, neu, auswahl) ? auswahl : null };
				},
				false,
				true,
			);
		},
		zeige: (teil, werte) => zeigeAmTeil(doc, gilt === 'alle' ? null : [index], teil, werte),
	};
	return (
		<section className="border-t border-rand px-3 py-2" data-abschnitt="gestaltung" data-einstellung="gestaltung">
			<button
				type="button"
				aria-expanded={offen}
				className="flex h-menue w-full items-center gap-1 text-left text-xs font-semibold text-leise"
				data-gestaltung-kopf
				onClick={() => {
					setWunsch(null);
					setGemerkt({ index, offen: !offen });
				}}
			>
				<Symbol name={offen ? 'runter' : 'rechts'} className="size-3 flex-none" />
				<span className="min-w-0 flex-1 truncate">Gestaltung</span>
				{nummern.length > 1 && <span className="font-normal text-dezent">{`Seite ${index + 1}`}</span>}
			</button>
			{offen && (
				<div className="mt-1 flex flex-col gap-2" data-blatt-gestaltung>
					<div className="flex min-h-zeile items-center justify-between gap-x-2">
						<span className="text-leise">Gilt für</span>
						<Segment
							beschriftung="Gilt für"
							werte={[
								{ wert: 'seite', titel: 'diese Seite' },
								{ wert: 'alle', titel: 'alle Seiten' },
							]}
							wert={gilt}
							waehle={setGilt}
							className="ml-auto"
						/>
					</div>
					<BlattRezept {...teile} />
					<BlattFlaeche {...teile} />
					<BlattRahmen {...teile} />
				</div>
			)}
		</section>
	);
};
