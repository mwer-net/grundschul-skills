import type { Antworten, AssistentSchrittId, Weg } from '@schoolbox/kern/src/assistent';
import { formatOptionen, formatWahl, titelVorschlag } from '@schoolbox/kern/src/assistent';
import type { Fach, Klasse } from '@schoolbox/kern/src/werte';

import type { KiLimit } from '../editor/ki';
import type { AblageStand } from '../ordner/typen';

export const LETZTE = 'schoolbox.zuletzt-fach-klasse';

export interface Vorbelegung {
	/** `null`: Nichts spricht für ein Fach; nichts ist vorgewählt, die Wahl ist Pflicht (S-14). */
	fach: Fach | null;
	klasse: Klasse | null;
	/** `behaelter`: Der Ordner legt Fach und Klasse fest, der Server nimmt nur seine. */
	quelle: 'behaelter' | null;
	/** Woher der Wert kam, klein am Feld; nur, was wirklich so ist (S-14). */
	herkunft: { fach?: string; klasse?: string };
}

/** Der Ordner und alle darunter. */
const mitUnterordnern = (stand: AblageStand, ordner: string): Set<string> => {
	const ids = new Set([ordner]);
	for (let neu = true; neu;) {
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

const KLASSE_IM_NAMEN = /\bkl(?:asse|\.)?\s*([1-4])\b/i;
/** Fachnamen und ihre üblichen Kurzformen in Ordnernamen. */
const FACH_IM_NAMEN: [RegExp, Fach][] = [
	[/\bdeutsch\b/i, 'deutsch'],
	[/\bmathe(matik)?\b/i, 'mathematik'],
	[/\bsachunterricht\b|\bsu\b|\bhsu\b|\bmnk\b/i, 'sachunterricht'],
	[/\benglisch\b/i, 'englisch'],
	[/\bkunst\b/i, 'kunst'],
	[/\bmusik\b/i, 'musik'],
];

export const klasseAusNamen = (name: string): Klasse | null => {
	const treffer = KLASSE_IM_NAMEN.exec(name)?.[1];
	return treffer ? (Number(treffer) as Klasse) : null;
};

export const fachAusNamen = (name: string): Fach | null =>
	FACH_IM_NAMEN.find(([muster]) => muster.test(name))?.[1] ?? null;

interface Fund {
	fach?: Fach;
	klasse?: Klasse;
	herkunft: string;
}

const zuletzt = (): Fund | null => {
	try {
		const roh = JSON.parse(localStorage.getItem(LETZTE) ?? 'null') as { fach?: Fach; klasse?: Klasse } | null;
		if (roh?.fach || roh?.klasse !== undefined) {
			return {
				...(roh.fach ? { fach: roh.fach } : {}),
				...(roh.klasse !== undefined ? { klasse: roh.klasse } : {}),
				herkunft: 'wie zuletzt',
			};
		}
	} catch {
		// Kaputtes im Speicher zählt nicht.
	}
	return null;
};

/**
 * Klasse und Fach je für sich, das erste, was etwas sagt (S-14): das jüngste Material im Ordner, die Namen des
 * Ordners und seiner Eltern („Klasse 2“, „Mathe“), das jüngste Material darunter oder im Elternordner, zuletzt
 * benutzt. Sagt nichts etwas, bleibt das Feld leer. Ein Behälter legt beides fest.
 */
export const vorbelegung = (stand: AblageStand | null, ordner: string | null): Vorbelegung => {
	const eintrag = stand?.ordner.find((o) => o.id === ordner);
	const behaelter = eintrag?.behaelter ? stand?.dokumente.find((d) => d.mappe === eintrag.behaelter) : undefined;
	if (behaelter) {
		return { fach: behaelter.fach, klasse: behaelter.klasse, quelle: 'behaelter', herkunft: {} };
	}
	const ordnerName = (id: string | null) =>
		id === null ? 'Mein Material' : (stand?.ordner.find((o) => o.id === id)?.name ?? '');
	const juengstesIn = (passt: (ort: string | null) => boolean) =>
		(stand?.dokumente ?? [])
			.filter((d) => passt(d.ordner))
			.sort((a, b) => b.meta.geaendert.localeCompare(a.meta.geaendert))[0];
	const ausMaterial = (d: AblageStand['dokumente'][number] | undefined): Fund | null =>
		d ? { fach: d.fach, klasse: d.klasse, herkunft: `aus dem Ordner „${ordnerName(d.ordner)}“ übernommen` } : null;

	const funde: (Fund | null)[] = [ausMaterial(juengstesIn((ort) => ort === ordner))];
	// Die Namen des Ordners und seiner Eltern, der nächste zuerst.
	for (let o = eintrag; o && stand; o = stand.ordner.find((x) => x.id === o?.eltern)) {
		const klasse = klasseAusNamen(o.name);
		const fach = fachAusNamen(o.name);
		if (klasse !== null || fach !== null) {
			funde.push({
				...(klasse !== null ? { klasse } : {}),
				...(fach !== null ? { fach } : {}),
				herkunft: `aus dem Ordnernamen „${o.name}“`,
			});
		}
	}
	if (stand && eintrag) {
		const unten = mitUnterordnern(stand, eintrag.id);
		funde.push(ausMaterial(juengstesIn((ort) => ort !== null && ort !== ordner && unten.has(ort))));
		funde.push(ausMaterial(juengstesIn((ort) => ort === eintrag.eltern)));
	} else if (ordner === null) {
		// „Mein Material“: Darunter liegt alles.
		funde.push(ausMaterial(juengstesIn((ort) => ort !== null)));
	}
	funde.push(zuletzt());

	const fachFund = funde.find((f) => f?.fach !== undefined);
	const klasseFund = funde.find((f) => f?.klasse !== undefined);
	return {
		fach: fachFund?.fach ?? null,
		klasse: klasseFund?.klasse ?? null,
		quelle: null,
		herkunft: {
			...(fachFund ? { fach: fachFund.herkunft } : {}),
			...(klasseFund ? { klasse: klasseFund.herkunft } : {}),
		},
	};
};

/** Platzhalter für die Antworten, solange Klasse oder Fach noch offen ist; zu sehen ist er nie (S-14). */
export const OHNE_VORBELEGUNG = { fach: 'deutsch', klasse: 1 } as const satisfies { fach: Fach; klasse: Klasse };

/** Was an Klasse und Fach noch niemand gewählt hat und nichts nahelegt. */
export interface KlasseFachOffen {
	fach: boolean;
	klasse: boolean;
}

export const KLASSE_FACH_FEHLT = 'Bitte wähle Klasse und Fach.';

export const klasseFachFehlt = (offen: KlasseFachOffen) => {
	if (offen.klasse && offen.fach) {
		return KLASSE_FACH_FEHLT;
	}
	if (offen.klasse) {
		return 'Bitte wähle eine Klasse.';
	}
	return offen.fach ? 'Bitte wähle ein Fach.' : null;
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
	/** Klasse oder Fach fehlt noch (S-14). */
	offen?: KlasseFachOffen;
	/** Selbst gewählt: Dann steht keine Herkunft mehr daneben. */
	gewaehlt?: KlasseFachOffen;
	/** Weiter wurde ohne Wahl versucht: „bitte wählen“ steht rot da. */
	mahnen?: boolean;
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
export const wirksameAntworten = (
	antworten: Antworten,
	vorbelegt: Vorbelegung,
	titelEigen: boolean,
	gewaehlt: KlasseFachOffen = { fach: true, klasse: true },
): Antworten => {
	const fest = vorbelegt.quelle === 'behaelter';
	// Bis zur eigenen Wahl folgt der Wert der Vorbelegung, auch wenn die Ablage erst nach dem Öffnen da ist (S-14).
	const fach = (fest || !gewaehlt.fach) && vorbelegt.fach !== null ? vorbelegt.fach : antworten.fach;
	const klasse = (fest || !gewaehlt.klasse) && vorbelegt.klasse !== null ? vorbelegt.klasse : antworten.klasse;
	const a = { ...antworten, fach, klasse };
	return { ...a, titel: titelEigen ? antworten.titel : titelVorschlag(a) };
};

/** Klasse oder Fach ist noch offen: nicht gewählt und nichts legt es nahe. */
export const offenVon = (vorbelegt: Vorbelegung, gewaehlt: KlasseFachOffen): KlasseFachOffen => ({
	fach: !gewaehlt.fach && vorbelegt.fach === null,
	klasse: !gewaehlt.klasse && vorbelegt.klasse === null,
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

/** Der Satz zum 5-Stunden-Fenster, sobald es zu `warnAb` genutzt ist (190-12). Vorher stand er nach dem Start. */
export const fensterWarnung = (limit: KiLimit | null, warnAb: number) => {
	const fenster = limit?.fenster.fuenfStunden.auslastung ?? null;
	return fenster !== null && fenster >= warnAb
		? `Dein 5-Stunden-Fenster ist schon zu ${Math.round(fenster * 100)} % genutzt. Die Einheit kann daran scheitern; „Weiterbauen“ geht danach.`
		: null;
};
