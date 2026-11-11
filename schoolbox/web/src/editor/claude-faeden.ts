import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import type { Ort } from '@schoolbox/kern/src/referenz';
import { bausteinVonKnoten, erzeugeReferenz, liesReferenzen, loeseReferenz } from '@schoolbox/kern/src/referenz';

import type { ChatNachricht } from './chat-verlauf';
import { istRueckfrage } from './chat-verlauf';
import type { KiAuftrag, Vorschlag, VorschlagAmBlatt } from './ki';

/** So viele Gespräche je Blatt, wie die Warteschlange des Servers Aufträge fasst (`KI_GRENZEN.warten`, 135). */
export const MAX_GESPRAECHE = 5;
/** Der Vorschlag eines Auftrags ohne Gespräch heißt am Server so (`SCHLUESSEL_BLATT`). */
export const OHNE_GESPRAECH = 'blatt';

/** Ein Gespräch an einem Element (134, 135). Es lebt nur im Speicher der Seite (Entscheidung 37). */
export interface Faden {
	/** Bleibt, solange es den Faden gibt: Schlüssel für React und für die Blase. */
	key: string;
	/**
	 * Unter diesem Namen liegt sein Vorschlag am Server, solange das Gespräch keinen neueren hat. Der Server legt das
	 * Ergebnis unter der Id des Gesprächs ab und verwirft den alten erst dann; bis dahin gilt dieser.
	 */
	schluessel: string;
	/** Das laufende Gespräch; `null`: noch keins oder beendet (×, Neuladen). Ein Vorschlag kann bleiben. */
	gespraech: string | null;
	/** Woran der Faden hängt; ohne: an der ersten Seite. */
	referenz: string | null;
	nr: number | null;
	/** Stufe „Ganzes Material“: Claude bekommt keine Referenz, sieht also das ganze Blatt. */
	ganz: boolean;
	verlauf: ChatNachricht[];
	entwurf: string;
	zitat: string | null;
	auftragId: string | null;
	fehler: string | null;
	/** Eine Antwort ohne Vorschlag kam, während die Blase eingeklappt war. */
	ungelesen: boolean;
	/** Der getippte Auftrag: Lehnt das Konto ab, kommt er ins Feld zurück. */
	gesendet: string | null;
	/** Zuletzt benutzt: Die Statusleiste öffnet bei mehreren dieses. */
	zuletzt: number;
}

export type FadenStand = 'laeuft' | 'wartet' | 'frage' | 'vorschlag' | 'antwort' | 'ruhig';

/** Was die Blase vom Blatt braucht, um Elemente zu finden und zu benennen. */
export interface ClaudeLage {
	z: Zerlegung;
	ort: Ort;
	loesung: boolean;
	/** Das Blatt zeigt die Quelle selbst, keinen Vorschlag: Nur dann folgen die Referenzen dem Blatt. */
	echt: boolean;
}

export const neuerFaden = (teil: Partial<Faden> & Pick<Faden, 'key' | 'schluessel' | 'referenz'>): Faden => ({
	gespraech: null,
	nr: null,
	ganz: false,
	verlauf: [],
	entwurf: '',
	zitat: null,
	auftragId: null,
	fehler: null,
	ungelesen: false,
	gesendet: null,
	zuletzt: Date.now(),
	...teil,
});

export const istFertig = (a: KiAuftrag | undefined) =>
	a?.status === 'fertig' || a?.status === 'fehler' || a?.status === 'abgebrochen';

export const laeuftNoch = (a: KiAuftrag | undefined) => Boolean(a && !istFertig(a));

/**
 * Unter welchen Namen ein Faden Vorschläge führt, der jüngste zuerst: sein Gespräch; das seines Auftrags, der nach ×
 * oder dem Neuladen ohne Gespräch weiterläuft; sein Schlüssel; der Vorschlag, auf dem der Auftrag aufbaut. Den
 * verwirft der Server erst am Ende des Nachbesserns.
 */
const namenDes = (f: Faden, auftraege: Record<string, KiAuftrag>) => {
	const a = f.auftragId ? auftraege[f.auftragId] : undefined;
	return [f.gespraech, a?.gespraech, f.schluessel, a?.grundlage].filter((k): k is string => Boolean(k));
};

export const gehoert = (f: Faden, schluessel: string, auftraege: Record<string, KiAuftrag>) =>
	namenDes(f, auftraege).includes(schluessel);

export const vorschlagDes = (
	f: Faden,
	vorschlaege: readonly VorschlagAmBlatt[],
	auftraege: Record<string, KiAuftrag>,
) => {
	for (const name of namenDes(f, auftraege)) {
		const v = vorschlaege.find((x) => x.schluessel === name);
		if (v) {
			return v;
		}
	}
	return undefined;
};

export const seitenVon = (z: Zerlegung, loesung: boolean) =>
	z.knoten.filter((k) => bausteinVonKnoten(k, loesung)?.art === 'seite');

export const ersteSeite = (z: Zerlegung, loesung: boolean) => seitenVon(z, loesung)[0]?.nr ?? null;

/** Bei nur einer Seite meint die Seite das ganze Blatt: Format und Palette am `body` bleiben für Claude erreichbar. */
export const meintGanzesBlatt = (f: Pick<Faden, 'ganz' | 'nr'>, { loesung, z }: Pick<ClaudeLage, 'loesung' | 'z'>) => {
	const seiten = seitenVon(z, loesung);
	return f.ganz || (seiten.length === 1 && seiten[0]?.nr === f.nr);
};

export const loeseAnker = (z: Zerlegung, referenz: string) => {
	const [ref] = liesReferenzen(referenz);
	return ref ? (loeseReferenz(z, ref).ziel?.k.nr ?? null) : null;
};

const artAn = (z: Zerlegung, nr: number | null, loesung: boolean) => {
	const k = nr === null ? undefined : z.knoten[nr];
	return k ? (bausteinVonKnoten(k, loesung)?.art ?? null) : null;
};

const zahlDerArt = (z: Zerlegung, art: string, loesung: boolean) =>
	z.knoten.filter((k) => bausteinVonKnoten(k, loesung)?.art === art).length;

/**
 * Passt nur noch die Stelle, nicht der Text, wurde das Element neu geschrieben oder gelöscht. Neu geschrieben ist es
 * nur, wenn es gleich viele seiner Art gibt wie vorher; sonst stünde dort sein Nachbar.
 */
const nurDieStelle = (f: Faden, z: Zerlegung, vorher: Zerlegung | null, loesung: boolean) => {
	const art = vorher ? artAn(vorher, f.nr, loesung) : null;
	return Boolean(vorher && art && zahlDerArt(vorher, art, loesung) === zahlDerArt(z, art, loesung));
};

/**
 * Wo der Faden jetzt hängt; `null`: Sein Element gibt es nicht mehr. Auf einem gezeigten Vorschlag bleibt er.
 * `vorher` ist die Zerlegung, in der er zuletzt verankert wurde.
 */
export const verankert = (
	f: Faden,
	{ echt, loesung, ort, z }: ClaudeLage,
	vorher: Zerlegung | null = null,
): Pick<Faden, 'nr' | 'referenz'> | null => {
	if (!f.referenz) {
		return { nr: ersteSeite(z, loesung), referenz: null };
	}
	if (!echt) {
		return f.nr === null ? { nr: loeseAnker(z, f.referenz), referenz: f.referenz } : f;
	}
	const [ref] = liesReferenzen(f.referenz);
	const { befund, ziel } = ref ? loeseReferenz(z, ref) : { befund: 'fehlt', ziel: null };
	if (!ziel || (befund === 'nur-pfad' && !nurDieStelle(f, z, vorher, loesung))) {
		return null;
	}
	return { nr: ziel.k.nr, referenz: erzeugeReferenz(z, ziel.k.nr, ort, loesung) };
};

/**
 * Das Gespräch endet, ein Lauf oder Vorschlag bleibt (Entscheidung 37). Was ein laufender Auftrag bringt, findet der
 * Faden über dessen Gespräch (`namenDes`).
 */
export const ohneGespraech = (f: Faden, v: VorschlagAmBlatt | undefined) => ({
	gespraech: null,
	schluessel: v?.schluessel ?? f.schluessel,
	verlauf: [],
	entwurf: '',
	zitat: null,
	fehler: null,
	ungelesen: false,
	gesendet: null,
});

export const antwortVon = (auftrag: KiAuftrag, vorschlag: Vorschlag | undefined) => {
	if (auftrag.status === 'abgebrochen') {
		return 'Abgebrochen.';
	}
	return auftrag.ergebnis === 'antwort' ? auftrag.antwort : vorschlag?.antwort;
};

export const nachricht = (
	rolle: ChatNachricht['rolle'],
	text: string,
	auftragId: string | null = null,
): ChatNachricht => ({ rolle, text, kontext: null, zeit: new Date().toISOString(), auftragId });

export const standVon = (
	f: Faden,
	auftrag: KiAuftrag | undefined,
	vorschlag: VorschlagAmBlatt | undefined,
): FadenStand => {
	if (auftrag?.status === 'laeuft' || auftrag?.status === 'wartet') {
		return auftrag.status;
	}
	if (vorschlag) {
		return 'vorschlag';
	}
	const juengste = f.verlauf.at(-1);
	if (juengste?.rolle === 'claude' && istRueckfrage(juengste.text)) {
		return 'frage';
	}
	return f.ungelesen ? 'antwort' : 'ruhig';
};

/** Was weder Gespräch noch Auftrag noch Vorschlag hat, ist vorbei; die offene Blase bleibt. */
export const lebt = (
	f: Faden,
	offen: string | null,
	auftraege: Record<string, KiAuftrag>,
	vorschlaege: readonly VorschlagAmBlatt[],
) =>
	f.key === offen ||
	f.gespraech !== null ||
	f.verlauf.length > 0 ||
	f.entwurf.trim() !== '' ||
	(f.auftragId !== null && laeuftNoch(auftraege[f.auftragId])) ||
	vorschlaege.some((v) => gehoert(f, v.schluessel, auftraege));

/**
 * Nach dem Neuladen oder aus einem anderen Tab: Vorschläge und laufende Aufträge ohne Faden bekommen einen, ohne
 * Gespräch. Ein neuer Auftrag eines vorhandenen Fadens (etwa aus der Warteschlange) wird dessen Auftrag.
 */
export const ergaenzeFaeden = (
	alt: readonly Faden[],
	auftraege: Record<string, KiAuftrag>,
	vorschlaege: readonly VorschlagAmBlatt[],
) => {
	const neu = [...alt];
	const von = (schluessel: string | undefined) =>
		schluessel ? neu.find((f) => gehoert(f, schluessel, auftraege)) : undefined;
	const laufend = Object.values(auftraege).filter(laeuftNoch);
	for (const v of vorschlaege) {
		// Der Vorschlag, an dem ein Auftrag nachbessert, gehört zu dessen Faden.
		if (!von(v.schluessel) && !laufend.some((a) => a.grundlage === v.schluessel)) {
			const referenz = v.referenz ?? null;
			neu.push(neuerFaden({ key: v.schluessel, schluessel: v.schluessel, referenz, ganz: !referenz }));
		}
	}
	for (const a of laufend) {
		const schluessel = a.gespraech ?? OHNE_GESPRAECH;
		const da = neu.find((f) => f.auftragId === a.id) ?? von(schluessel) ?? von(a.grundlage);
		if (!da) {
			const referenz = a.referenz ?? null;
			neu.push(neuerFaden({ key: schluessel, schluessel, referenz, ganz: !referenz, auftragId: a.id }));
		} else if (da.auftragId !== a.id && !laeuftNoch(da.auftragId ? auftraege[da.auftragId] : undefined)) {
			neu[neu.indexOf(da)] = { ...da, auftragId: a.id };
		}
	}
	return neu;
};
