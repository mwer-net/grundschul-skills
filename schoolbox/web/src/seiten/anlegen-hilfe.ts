import type { Antworten, AssistentSchrittId, Weg } from '@schoolbox/kern/src/assistent';
import { formatOptionen, formatWahl, titelVorschlag } from '@schoolbox/kern/src/assistent';
import type { Einordnung } from '@schoolbox/kern/src/einordnung';
import type { Fach, Klasse } from '@schoolbox/kern/src/werte';

import type { AblageStand } from '../ordner/typen';

export const LETZTE = 'schoolbox.zuletzt-fach-klasse';

export interface Vorbelegung {
	fach: Fach;
	klasse: Klasse;
	/** `behaelter`: Der Ordner legt Fach und Klasse fest, der Server nimmt nur seine. */
	quelle: 'behaelter' | 'ordner' | 'zuletzt' | null;
}

/** Der Behälter des Ordners, sonst das jüngste Dokument im Ordner, sonst zuletzt benutzt. */
export const vorbelegung = (stand: AblageStand | null, ordner: string | null): Vorbelegung => {
	const eintrag = stand?.ordner.find((o) => o.id === ordner);
	const behaelter = eintrag?.behaelter ? stand?.dokumente.find((d) => d.mappe === eintrag.behaelter) : undefined;
	if (behaelter) {
		return { fach: behaelter.fach, klasse: behaelter.klasse, quelle: 'behaelter' };
	}
	const juengstes = (stand?.dokumente ?? [])
		.filter((d) => d.ordner === ordner)
		.sort((a, b) => b.meta.geaendert.localeCompare(a.meta.geaendert))[0];
	if (juengstes) {
		return { fach: juengstes.fach, klasse: juengstes.klasse, quelle: 'ordner' };
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

/** Wo der Assistent anlegt und was er vorbelegt: der feste Ordner, sonst der aus der Einordnung des Chats (077). */
export const ortDesAssistenten = (
	stand: AblageStand | null,
	festerOrdner: string | null | undefined,
	einordnung: Einordnung | undefined,
) => {
	const ordner = festerOrdner === undefined ? (einordnung?.ordner?.id ?? null) : festerOrdner;
	const vorbelegt: Vorbelegung = einordnung?.fest
		? { fach: einordnung.fach, klasse: einordnung.klasse, quelle: 'behaelter' }
		: vorbelegung(stand, ordner);
	const name =
		stand?.ordner.find((o) => o.id === ordner)?.name ??
		einordnung?.ordner?.pfad.split(' > ').at(-1) ??
		'Mein Material';
	const angabe: Ordnerangabe = { name, vorbelegt };
	return { ordner, vorbelegt, angabe };
};

/** Aus dem Chat beim Auftrag; hat Claude nicht eingeordnet, zuerst bei Klasse und Fach (sonst geraten). */
export const ersterSchritt = (einordnung: Einordnung | undefined): AssistentSchrittId => {
	if (!einordnung) {
		return 'start';
	}
	return einordnung.rueckfall && !einordnung.fest ? 'fuerWen' : 'pruefen';
};

/**
 * Die Antworten, wie sie gelten: Der Behälter legt Fach und Klasse fest, auch wenn die Ablage erst nach dem Öffnen
 * geladen ist. Der Titel ist bis zur ersten Eingabe der Vorschlag.
 */
export const wirksameAntworten = (antworten: Antworten, vorbelegt: Vorbelegung, titelEigen: boolean): Antworten => ({
	...antworten,
	...(vorbelegt.quelle === 'behaelter' ? { fach: vorbelegt.fach, klasse: vorbelegt.klasse } : {}),
	titel: titelEigen ? antworten.titel : titelVorschlag(antworten),
});
