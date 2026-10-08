import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { ServerKonfig } from './konfig';

export const SITZUNG_COOKIE = 'schoolbox_sitzung';
const MINUTE_MS = 60_000;
const STUNDE_MS = 60 * MINUTE_MS;
const TAG_MS = 24 * STUNDE_MS;

/** Gültigkeit seit der letzten Ausstellung; bei Nutzung wird nach `erneuern` neu ausgestellt. */
export const DAUER = {
	dauerhaft: { gueltig: 365 * TAG_MS, erneuern: TAG_MS },
	sitzung: { gueltig: 12 * STUNDE_MS, erneuern: STUNDE_MS },
};

const COOKIE_MUSTER = /^(v1\.([0-9a-z]{1,11})\.([ds]))\.([A-Za-z0-9_-]{43})$/;

export interface Sitzung {
	ausgestellt: number;
	dauerhaft: boolean;
}

type Schluessel = Pick<ServerKonfig, 'passwortHash' | 'sitzungGeheimnis'>;

/** Der Fingerabdruck des Passwort-Hashes steckt in jeder Signatur: Ein neues Passwort entwertet alle Sitzungen. */
const signatur = ({ passwortHash, sitzungGeheimnis }: Schluessel, nutzlast: string) => {
	const fingerabdruck = createHash('sha256').update(passwortHash).digest('hex').slice(0, 16);
	return createHmac('sha256', sitzungGeheimnis).update(`${nutzlast}|${fingerabdruck}`).digest('base64url');
};

const dauerVon = (sitzung: Sitzung) => (sitzung.dauerhaft ? DAUER.dauerhaft : DAUER.sitzung);

export const signiereSitzung = (schluessel: Schluessel, sitzung: Sitzung) => {
	const nutzlast = `v1.${sitzung.ausgestellt.toString(36)}.${sitzung.dauerhaft ? 'd' : 's'}`;
	return `${nutzlast}.${signatur(schluessel, nutzlast)}`;
};

export const pruefeSitzung = (schluessel: Schluessel, wert: string | undefined, jetzt = Date.now()) => {
	const [, nutzlast, zeit, art, sig] = COOKIE_MUSTER.exec(wert ?? '') ?? [];
	if (!nutzlast || !zeit || !art || !sig) {
		return null;
	}
	if (!timingSafeEqual(Buffer.from(sig), Buffer.from(signatur(schluessel, nutzlast)))) {
		return null;
	}
	const sitzung: Sitzung = { ausgestellt: parseInt(zeit, 36), dauerhaft: art === 'd' };
	const alter = jetzt - sitzung.ausgestellt;
	return alter >= -MINUTE_MS && alter <= dauerVon(sitzung).gueltig ? sitzung : null;
};

export const sollErneuern = (sitzung: Sitzung, jetzt = Date.now()) =>
	jetzt - sitzung.ausgestellt > dauerVon(sitzung).erneuern;

export const maxAlter = (sitzung: Sitzung) => (sitzung.dauerhaft ? DAUER.dauerhaft.gueltig : undefined);

/** Liest ein Cookie aus dem Kopf, ohne Abhängigkeit. Doppelte Namen: das erste gilt (wie in Browsern üblich). */
export const leseCookie = (kopf: string | undefined, name: string): string | undefined => {
	for (const teil of (kopf ?? '').split(';')) {
		const gleich = teil.indexOf('=');
		if (gleich !== -1 && teil.slice(0, gleich).trim() === name) {
			return teil.slice(gleich + 1).trim();
		}
	}
	return undefined;
};
