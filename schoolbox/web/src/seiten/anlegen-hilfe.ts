import type { Antworten, AssistentSchrittId, Weg } from '@schoolbox/kern/src/assistent';
import { formatOptionen, formatWahl, titelVorschlag } from '@schoolbox/kern/src/assistent';
import type { Fach, Klasse } from '@schoolbox/kern/src/werte';

import type { AblageStand } from '../ordner/typen';

export const LETZTE = 'schoolbox.zuletzt-fach-klasse';

export interface Vorbelegung {
	fach: Fach;
	klasse: Klasse;
	/** `behaelter`: Der Ordner legt Fach und Klasse fest, der Server nimmt nur seine. */
	quelle: 'behaelter' | 'ordner' | 'zuletzt' | null;
	/** Kam es aus einem Unter- oder dem übergeordneten Ordner, dessen Name (190-22). */
	ordnerName?: string;
}

/** Der Ordner und alle darunter. */
const mitUnterordnern = (stand: AblageStand, ordner: string): Set<string> => {
	const ids = new Set([ordner]);
	for (let neu = true; neu; ) {
		neu = false;
		for (const o of stand.ordner) {
			if (o.eltern !== null && ids.has(o.eltern) && !ids.has(o.id)) {
				ids.add(o.id);
				neu = true;
			}
		}
	}
	return ids;
};

/** Der Behälter des Ordners, sonst das jüngste Dokument im Ordner, sonst zuletzt benutzt. */
export const vorbelegung = (stand: AblageStand | null, ordner: string | null): Vorbelegung => {
	const eintrag = stand?.ordner.find((o) => o.id === ordner);
	const behaelter = eintrag?.behaelter ? stand?.dokumente.find((d) => d.mappe === eintrag.behaelter) : undefined;
	if (behaelter) {
		return { fach: behaelter.fach, klasse: behaelter.klasse, quelle: 'behaelter' };
	}
	const juengstesIn = (passt: (ort: string | null) => boolean) =>
		(stand?.dokumente ?? [])
			.filter((d) => passt(d.ordner))
			.sort((a, b) => b.meta.geaendert.localeCompare(a.meta.geaendert))[0];
	const juengstes = juengstesIn((ort) => ort === ordner);
	if (juengstes) {
		return { fach: juengstes.fach, klasse: juengstes.klasse, quelle: 'ordner' };
	}
	// Ohne eigenes Material: erst die Unterordner, dann der übergeordnete Ordner (190-22).
	if (stand && eintrag) {
		const unten = mitUnterordnern(stand, eintrag.id);
		const darunter = juengstesIn((ort) => ort !== null && ort !== ordner && unten.has(ort));
		const darueber = darunter ?? juengstesIn((ort) => ort === eintrag.eltern);
		if (darueber) {
			const name =
				stand.ordner.find((o) => o.id === darueber.ordner)?.name ?? (darueber.ordner === null ? 'Mein Material' : '');
			return { fach: darueber.fach, klasse: darueber.klasse, quelle: 'ordner', ordnerName: name };
		}
	}
	try {
		const roh = JSON.parse(localStorage.getItem(LETZTE) ?? 'null') as { fach?: Fach; klasse?: Klasse } | null;
		if (roh?.fach && roh.klasse !== undefined) {
			return { fach: roh.fach, klasse: roh.klasse, quelle: 'zuletzt' };
		}
	} catch {
		// Kaputtes im Speicher zählt nicht.
	}
	return { fach: 'deutsch', klasse: 1, quelle: null };
};

/** Beim Wechsel des Wegs bleibt das Format: dieselbe Seitenform oder dasselbe Gerüst im anderen Angebot. */
export const mitWeg = (a: Antworten, weg: Weg): Antworten => {
	if (a.weg === weg) {
		return a;
	}
	const wahl = formatWahl(a);
	const passend = formatOptionen({ art: a.art, weg }).find((o) =>
		wahl.vorlage ? o.vorlage === wahl.vorlage : !o.vorlage && o.format === wahl.format,
	);
	return { ...a, weg, format: passend && !passend.empfohlen ? passend.wert : '' };
};

export interface Ordnerangabe {
	name: string;
	vorbelegt: Vorbelegung;
}

/** Wo der Assistent anlegt und was er vorbelegt: der Ordner, aus dem er kommt, sonst „Mein Material“. */
export const ortDesAssistenten = (stand: AblageStand | null, festerOrdner: string | null | undefined) => {
	const ordner = festerOrdner ?? null;
	const vorbelegt = vorbelegung(stand, ordner);
	const name = stand?.ordner.find((o) => o.id === ordner)?.name ?? 'Mein Material';
	const angabe: Ordnerangabe = { name, vorbelegt };
	return { ordner, vorbelegt, angabe };
};

/** Aus der Palette („Material anlegen: …“, 136): Das Thema steht schon, es geht bei der Materialart los. */
export const ersterSchritt = (thema: string | undefined): AssistentSchrittId => (thema ? 'art' : 'start');

/**
 * Die Antworten, wie sie gelten: Der Behälter legt Fach und Klasse fest, auch wenn die Ablage erst nach dem Öffnen
 * geladen ist. Der Titel ist bis zur ersten Eingabe der Vorschlag.
 */
export const wirksameAntworten = (antworten: Antworten, vorbelegt: Vorbelegung, titelEigen: boolean): Antworten => ({
	...antworten,
	...(vorbelegt.quelle === 'behaelter' ? { fach: vorbelegt.fach, klasse: vorbelegt.klasse } : {}),
	titel: titelEigen ? antworten.titel : titelVorschlag(antworten),
});

const vergleichbar = (name: string) => name.trim().toLocaleLowerCase('de');

/**
 * Ein selbst geschriebener Titel, den es im Ordner schon gibt: Der Satz steht am Titelfeld, sobald der Titel feststeht
 * (190-N01). Der Server prüft gleich (`namenIn`); ein vorgeschlagener Titel weicht dort auf „… 2“ aus.
 */
export const titelFehler = (stand: AblageStand | null, ordner: string | null, titel: string): string | null => {
	const t = vergleichbar(titel);
	if (!stand || t === '') {
		return null;
	}
	const vergeben =
		stand.ordner.some((o) => o.eltern === ordner && vergleichbar(o.name) === t) ||
		stand.dokumente.some((d) => d.ordner === ordner && vergleichbar(d.meta.titel) === t);
	return vergeben ? `In diesem Ordner gibt es „${titel.trim()}“ schon. Wähle bitte einen anderen Titel.` : null;
};
