import { fehlendeLoesungen, hatLoesung } from '@schoolbox/kern/src/loesungen';
import type { Meldung, MeldungCode, MeldungZiel } from '@schoolbox/kern/src/meldungen';
import { erklaere, zitat } from '@schoolbox/kern/src/meldungen';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { zerlege } from '@schoolbox/kern/src/quelltext';
import { verschobeneVerweise, verweisText } from '@schoolbox/kern/src/verweise';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { elementZu, pfadZu, trefferAn } from './darstellung';

/** Nach der letzten Eingabe so lange warten, bevor geprüft wird: Tippen bleibt flüssig. */
const RUHE_MS = 500;

/** In Koordinaten des Materials im `iframe`. */
export interface Rechteck {
	links: number;
	oben: number;
	breite: number;
	hoehe: number;
}

/** Eine Zeile der Prüfliste. */
export interface Pruefpunkt {
	stufe: Meldung['stufe'];
	code: MeldungCode | null;
	seite: number;
	satz: string;
	tipp: string | null;
	/** Die betroffenen Bausteine (`data-sb`); Antippen wählt den ersten. */
	bausteine: number[];
	/** Rot bzw. orange im Blatt; nicht für Hinweise und nicht um ganze Seiten. */
	rahmen: Rechteck[];
}

export interface Pruefstand {
	doc: Document;
	punkte: Pruefpunkt[];
	mehrereSeiten: boolean;
}

type PruefeBlatt = (optionen: { warten: boolean }) => Promise<{ meldungen: Meldung[] }>;

const seitenIn = (doc: Document) =>
	[...doc.querySelectorAll('.seite')].filter((s) => !s.parentElement?.closest('.seite'));

const rechteckVon = (element: Element): Rechteck => {
	const r = element.getBoundingClientRect();
	return { links: r.left, oben: r.top, breite: r.width, hoehe: r.height };
};

/**
 * Wie die Lehrkraft das Element kennt: „Aufgabe 4“, „Item 2 in Aufgabe 3“, sonst der Text aus dem Bericht, mit dem
 * Baustein, in dem er steht.
 */
const nameIm = (doc: Document, ziel: MeldungZiel) => {
	const element = ziel.sb === null ? null : elementZu(doc, ziel.sb);
	const treffer = trefferAn(element);
	const eigen = zitat(ziel.name);
	if (!element || !treffer || treffer.baustein.art === 'seite') {
		return eigen;
	}
	const pfad = pfadZu(doc, treffer.nr);
	const name = pfad.at(-1)?.name ?? treffer.baustein.name;
	const aufgabe = pfad.slice(0, -1).findLast((t) => t.baustein.art === 'aufgabe')?.name;
	const wer = aufgabe ? `${name} in ${aufgabe}` : name;
	return treffer.element === element ? wer : `${eigen} in ${wer}`;
};

const ausBericht = (doc: Document, meldungen: Meldung[]): Pruefpunkt[] => {
	const seiten = seitenIn(doc);
	return meldungen.map((m) => {
		const ziele = m.ziele ?? [];
		const seite = seiten[m.seite - 1]?.getBoundingClientRect();
		const ganzeSeite = (z: MeldungZiel) =>
			seite !== undefined && (z.rechteck[2] ?? 0) >= seite.width - 1 && (z.rechteck[3] ?? 0) >= seite.height - 1;
		const rahmen =
			m.stufe === 'HINWEIS' || !seite
				? []
				: ziele
						.filter((z) => !ganzeSeite(z))
						.map(({ rechteck: [x = 0, y = 0, breite = 0, hoehe = 0] }) => ({
							links: seite.left + x,
							oben: seite.top + y,
							breite,
							hoehe,
						}));
		const bausteine = ziele.flatMap((z) => {
			const nr = z.sb === null ? null : trefferAn(elementZu(doc, z.sb))?.nr;
			return nr === null || nr === undefined ? [] : [nr];
		});
		const { satz, tipp } = erklaere(
			m,
			ziele.map((z) => nameIm(doc, z)),
		);
		return { stufe: m.stufe, code: m.code ?? null, seite: m.seite, satz, tipp, bausteine, rahmen };
	});
};

const seiteVon = (doc: Document, element: Element | null) => {
	const seite = element?.closest('.seite');
	return seite ? seitenIn(doc).indexOf(seite) + 1 : 0;
};

/** Was nur der Editor weiß: fehlende Lösungen (019) und Tipps, die nach dem Umsortieren falsch zählen (016). */
const eigenePunkte = (doc: Document, zerlegung: Zerlegung, ausgang: Zerlegung | null): Pruefpunkt[] => {
	const punkte: Pruefpunkt[] = [];
	const fehlend = hatLoesung(zerlegung.quelle) ? fehlendeLoesungen(zerlegung) : [];
	if (fehlend.length > 0) {
		const satz =
			fehlend.length === 1
				? 'Eine Antwortlinie hat noch keine Lösung.'
				: `${fehlend.length} Antwortlinien haben noch keine Lösung.`;
		const m: Meldung = { stufe: 'HINWEIS', seite: 0, code: 'loesung-fehlt', text: satz };
		punkte.push({
			...erklaere(m),
			stufe: m.stufe,
			code: 'loesung-fehlt',
			seite: seiteVon(doc, elementZu(doc, fehlend[0]?.nr ?? -1)),
			bausteine: fehlend.map((k) => k.nr),
			rahmen: [],
		});
	}
	if (ausgang && !doc.body.classList.contains('folie')) {
		for (const verweis of verschobeneVerweise(ausgang, zerlegung)) {
			const blase = elementZu(doc, verweis.blase);
			const m: Meldung = { stufe: 'WARNUNG', seite: 0, code: 'verweis', text: verweisText(verweis) };
			punkte.push({
				...erklaere(m),
				stufe: m.stufe,
				code: 'verweis',
				seite: seiteVon(doc, blase),
				bausteine: [verweis.blase],
				rahmen: blase ? [rechteckVon(blase)] : [],
			});
		}
	}
	return punkte;
};

const RANG: Record<Meldung['stufe'], number> = { FEHLER: 0, WARNUNG: 1, HINWEIS: 2 };

interface Optionen {
	/** Das sichtbare Dokument im `iframe` mit dem HTML, aus dem es entstand. */
	geladen: { doc: Document; html: string } | null;
	html: string | null;
	zerlegung: Zerlegung | null;
	/** Die Quelle beim Öffnen, für die Verweise „Zu 3: …“. */
	ausgang: string | null;
	/** Vorschau einer Version: nicht prüfen, nichts melden. */
	aus: boolean;
}

/**
 * Die Prüfung aus blatt.py im sichtbaren Material: sofort, wenn eine neue Fassung zu sehen ist, und beim Tippen
 * kurz nach der letzten Eingabe, im Dokument des `iframe` (die Quelle ändert sich erst am Ende). Gemessen wird im
 * sichtbaren `iframe`, ein zweiter Aufbau entfällt.
 */
export const usePruefung = ({ aus, ausgang, geladen, html, zerlegung }: Optionen) => {
	const doc = !aus && geladen && geladen.html === html ? geladen.doc : null;
	const ausgangZerlegt = useMemo(() => (ausgang === null ? null : zerlege(ausgang)), [ausgang]);
	const [stand, setStand] = useState<Pruefstand | null>(null);
	const aktuell = useRef({ doc, zerlegung, ausgangZerlegt });
	const lauf = useRef(0);
	const uhr = useRef<number | undefined>(undefined);

	useEffect(() => {
		aktuell.current = { doc, zerlegung, ausgangZerlegt };
	}, [doc, zerlegung, ausgangZerlegt]);

	const pruefe = useCallback(async () => {
		const { doc: d } = aktuell.current;
		const pruefeBlatt = (d?.defaultView as (Window & { pruefeBlatt?: PruefeBlatt }) | null)?.pruefeBlatt;
		if (!d || !pruefeBlatt) {
			return;
		}
		lauf.current += 1;
		const nr = lauf.current;
		const bericht = await pruefeBlatt({ warten: false });
		const jetzt = aktuell.current;
		if (nr !== lauf.current || jetzt.doc !== d || !jetzt.zerlegung) {
			return;
		}
		const punkte = [
			...ausBericht(d, bericht.meldungen),
			...eigenePunkte(d, jetzt.zerlegung, jetzt.ausgangZerlegt),
		].sort((a, b) => RANG[a.stufe] - RANG[b.stufe]);
		setStand({ doc: d, punkte, mehrereSeiten: seitenIn(d).length > 1 });
	}, []);

	useEffect(() => {
		window.clearTimeout(uhr.current);
		if (doc) {
			void pruefe();
		}
	}, [doc, ausgangZerlegt, pruefe]);

	useEffect(() => () => window.clearTimeout(uhr.current), []);

	const getippt = useCallback(() => {
		window.clearTimeout(uhr.current);
		uhr.current = window.setTimeout(() => void pruefe(), RUHE_MS);
	}, [pruefe]);

	return { stand: aus ? null : stand, getippt };
};

export type Pruefung = ReturnType<typeof usePruefung>;
