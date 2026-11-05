/** Prüfmaschine 084: Welche Werte ein Feld durchläuft. Nur aus dem Schema, keine Liste von Hand. */

import type { AbbildungSchema, Feld, Werte } from '@schoolbox/kern/src/abbildungen';
import {
	aendereFeld,
	auswahlOptionen,
	feldWert,
	listeVon,
	markeSetzen,
	markierungLesen,
	markierungText,
	pruefeWerte,
	rasterText,
	rasterVon,
	stellenVon,
	unterschiede,
	zahlStandard,
	zeilenText,
	zeilenVon,
	ziffernText,
} from '@schoolbox/kern/src/abbildungen';

export interface Fall {
	feld: string;
	/** Lesbarer Name des Werts, für Bericht und Kontaktbild. */
	wert: string;
	werte: Werte;
	/** Nur die geänderten Attribute. */
	aenderung: Werte;
}

/** Der Wert, den das Feld ohne eigene Angabe wirksam hat: Dieser Wert kann nichts ändern und zählt nicht. */
const wirksam = (feld: Feld, w: Werte): string | null => {
	const roh = feldWert(feld, w).wert;
	if (roh !== null) {
		return roh;
	}
	if (feld.art === 'zahl') {
		return String(zahlStandard(feld, w));
	}
	if (feld.art === 'auswahl' || feld.art === 'muster') {
		return feld.standard ?? null;
	}
	if (feld.art === 'schalter') {
		return feld.standard ? feld.an : feld.aus;
	}
	if (feld.art === 'mehrfach') {
		return feld.standard?.join(' ') ?? null;
	}
	return null;
};

const neueZeile = (feld: Feld & { art: 'liste' }) =>
	feld.unter.map((u, i) => {
		if (u.standard) {
			return u.standard;
		}
		if (u.art === 'zahl') {
			return String(u.min ?? 1);
		}
		if (u.art === 'auswahl' || u.art === 'muster') {
			return u.optionen?.[0]?.wert ?? '';
		}
		return u.art === 'bild' || u.art === 'schalter' ? '' : `Neu${i}`;
	});

const listenWerte = (feld: Feld & { art: 'liste' }, roh: string | null): [string, string | null][] => {
	const z = zeilenVon(feld, roh);
	const faelle: [string, string | null][] = [];
	if (feld.max === undefined || z.length < feld.max) {
		faelle.push(['hinzufügen', zeilenText(feld, [...z, neueZeile(feld)])]);
	}
	if (z.length > (feld.min ?? 0)) {
		faelle.push(['entfernen', zeilenText(feld, z.slice(0, -1))]);
	}
	const [a, b] = z;
	if (a && b && a.join() !== b.join() && feld.sortierbar !== false) {
		faelle.push(['umsortieren', zeilenText(feld, [b, a, ...z.slice(2)])]);
	}
	return faelle;
};

const rasterWerte = (
	feld: Feld & { art: 'raster' },
	roh: string | null,
	zellen: string[],
): [string, string | null][] => {
	if (feld.form) {
		const [erste] = zellen;
		if (!erste) {
			return [];
		}
		const jetzt = listeVon(roh);
		const neu = jetzt.includes(erste) ? jetzt.filter((z) => z !== erste) : [...jetzt, erste];
		return [['eine Zelle', neu.length > 0 ? neu.join(' ') : null]];
	}
	const zeilen = rasterVon(roh);
	const erste = zeilen[0]?.[0];
	const zustaende = feld.zustaende?.map((z) => z.wert) ?? ['0', '1'];
	const leer = zeilen.length > 0 ? zeilen : [[zustaende[0] ?? '0']];
	const anders = feld.zahlen ? String(feld.zahlen.min + 1) : (zustaende.find((z) => z !== erste) ?? '1');
	const neu = leer.map((z, r) => z.map((c, s) => (r === 0 && s === 0 ? anders : c)));
	return [['eine Zelle', rasterText(neu)]];
};

/** Dieselbe Form, ein anderer Inhalt: Die erste Ziffer steigt, ohne Ziffer kommt ein Buchstabe dazu. */
const anders = (wert: string) =>
	/\d/.test(wert) ? wert.replace(/\d/, (d) => String((Number(d) + 1) % 10)) : `${wert}x`;

const schalterWerte = (feld: Feld & { art: 'schalter' }): [string, string | null][] => [
	['an', feld.standard ? null : feld.an],
	['aus', feld.standard ? feld.aus : null],
];

// Das Beispiel ist oft zugleich der Standard: Darum zusätzlich ein Wert, der sicher anders ist.
const textWerte = (feld: Feld & { art: 'text' }, roh: string | null): [string, string | null][] => [
	['Text', feld.beispiel ?? (feld.muster ? roh : 'Ab')],
	['Text anders', anders(feld.beispiel ?? 'Ab')],
];

const mehrfachWerte = (feld: Feld & { art: 'mehrfach' }, w: Werte): [string, string | null][] => {
	const optionen = feld.optionenJe
		? (feld.optionenJe.werte[w[feld.optionenJe.feld] ?? Object.keys(feld.optionenJe.werte)[0] ?? ''] ?? [])
		: feld.optionen;
	const jetzt = listeVon(wirksam(feld, w));
	return optionen.map((o) => {
		const neu = jetzt.includes(o.wert) ? jetzt.filter((x) => x !== o.wert) : [...jetzt, o.wert];
		return [o.name, neu.join(' ') || null];
	});
};

const markierungWerte = (feld: Feld & { art: 'markierung' }, roh: string | null): [string, string | null][] => {
	const satz = markierungLesen(roh ?? '', feld.gruppen);
	const marke = feld.optionen.find((o) => o.wert !== satz.woerter[0]?.marke)?.wert ?? null;
	return satz.woerter.length > 0 ? [['eine Marke', markierungText(markeSetzen(satz, 0, marke), feld.gruppen)]] : [];
};

const roheWerte = (
	schema: AbbildungSchema,
	feld: Feld,
	w: Werte,
	zellen: Record<string, string[]>,
): [string, string | null][] => {
	const roh = feldWert(feld, w).wert;
	switch (feld.art) {
		case 'auswahl':
			return auswahlOptionen(feld, w).map((o) => [o.name, o.wert]);
		case 'muster':
			return feld.optionen.map((o) => [o.name, o.wert]);
		case 'schalter':
			return schalterWerte(feld);
		case 'zahl':
			return [
				['min', String(feld.min)],
				['max', String(feld.max)],
				['standard', null],
			];
		case 'uhrzeit':
			return [['3:15', '3:15']];
		case 'text':
			return textWerte(feld, roh);
		case 'zahlen':
			return [
				['Liste', feld.beispiel],
				['Liste anders', anders(feld.beispiel)],
			];
		case 'ziffern': {
			const n = stellenVon(w, feld.stellen).length;
			return [['Ziffern', ziffernText(Array.from({ length: n }, (_, i) => String(i + 1)))]];
		}
		case 'liste':
			return listenWerte(feld, roh);
		case 'mehrfach':
			return mehrfachWerte(feld, w);
		case 'raster':
			return rasterWerte(feld, roh, zellen[feld.attribut] ?? []);
		case 'mischen':
			return [['neu mischen', '424242']];
		case 'markierung':
			return markierungWerte(feld, roh);
		case 'noten':
			return [['eine Note', `${roh ?? ''} ${feld.tonhoehe ? `g${String.fromCharCode(39)}4` : '4'}`.trim()]];
		case 'plan':
			return [['eine Fläche', rasterText([[feld.flaechen.at(-1)?.wert ?? 'wiese']])]];
		case 'bild':
			return [['Bild', 'bilder/probe.png']];
		case 'punkte':
			return [['ein Punkt', '10,10: Wort']];
		default:
			return schema ? [] : [];
	}
};

/** Alle Fälle eines Felds ausgehend von `w`. Der Wert, der schon gilt, entfällt. */
export const faelleVon = (
	schema: AbbildungSchema,
	feld: Feld,
	w: Werte,
	zellen: Record<string, string[]>,
): { faelle: Fall[]; abgewiesen: string[] } => {
	const faelle: Fall[] = [];
	const abgewiesen: string[] = [];
	const jetzt = wirksam(feld, w);
	const paare = roheWerte(schema, feld, w, zellen);
	for (const [name, roh] of paare) {
		const effektiv = feld.art === 'zahl' && roh === null ? String(zahlStandard(feld, w)) : roh;
		if ((effektiv ?? null) === jetzt || (roh === null && feldWert(feld, w).wert === null)) {
			continue;
		}
		const neu = aendereFeld(schema, w, feld, roh);
		if (Object.keys(pruefeWerte(schema, neu)).length > 0) {
			abgewiesen.push(`${feld.attribut}=${name}`);
			continue;
		}
		const namen = unterschiede(w, neu);
		if (namen.length > 0) {
			faelle.push({
				feld: feld.attribut,
				wert: name,
				werte: neu,
				aenderung: Object.fromEntries(namen.map((a) => [a, neu[a] ?? null])),
			});
		}
	}
	return { faelle, abgewiesen };
};
