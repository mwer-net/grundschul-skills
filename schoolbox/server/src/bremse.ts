import { isIPv4, isIPv6 } from 'node:net';

const MINUTE_MS = 60_000;
export const ERLAUBTE_FEHLVERSUCHE = 5;
export const FENSTER_MS = 15 * MINUTE_MS;
const MAX_SPERRE_MS = 24 * 60 * MINUTE_MS;
const VERGESSEN_MS = 24 * 60 * MINUTE_MS;
const MAX_EINTRAEGE = 10_000;

interface Stand {
	anzahl: number;
	erster: number;
	letzter: number;
	gesperrtBis: number;
}

export interface Bremse {
	/**
	 * Merkt einen Versuch vor, bevor das Passwort geprüft wird, damit parallele Anfragen die Grenze nicht
	 * überholen. Gibt die Wartezeit in ms zurück, wenn gesperrt ist (dann zählt der Versuch nicht).
	 */
	versuch: (schluessel: string, jetzt?: number) => number;
	erfolg: (schluessel: string) => void;
}

/**
 * Fehlversuche je Adresse, im Speicher: 5 in 15 Minuten sperren 15 Minuten, jeder weitere Fehlversuch nach einer
 * Sperre verdoppelt sie (höchstens 24 Stunden). Nach 24 Stunden Ruhe ist alles vergessen.
 */
export const erstelleBremse = (): Bremse => {
	const staende = new Map<string, Stand>();

	const raeumeAuf = (jetzt: number) => {
		for (const [schluessel, stand] of staende) {
			if (jetzt - stand.letzter > VERGESSEN_MS && jetzt >= stand.gesperrtBis) {
				staende.delete(schluessel);
			}
		}
		const aeltester = staende.keys().next();
		if (staende.size >= MAX_EINTRAEGE && !aeltester.done) {
			staende.delete(aeltester.value);
		}
	};

	return {
		versuch: (schluessel, jetzt = Date.now()) => {
			let stand = staende.get(schluessel);
			if (stand && jetzt < stand.gesperrtBis) {
				return stand.gesperrtBis - jetzt;
			}
			const fensterVorbei = stand && stand.anzahl < ERLAUBTE_FEHLVERSUCHE && jetzt - stand.erster > FENSTER_MS;
			if (!stand || fensterVorbei || jetzt - stand.letzter > VERGESSEN_MS) {
				if (!stand && staende.size >= MAX_EINTRAEGE) {
					raeumeAuf(jetzt);
				}
				stand = { anzahl: 0, erster: jetzt, letzter: jetzt, gesperrtBis: 0 };
				staende.set(schluessel, stand);
			}
			stand.anzahl += 1;
			stand.letzter = jetzt;
			if (stand.anzahl >= ERLAUBTE_FEHLVERSUCHE) {
				const stufe = stand.anzahl - ERLAUBTE_FEHLVERSUCHE;
				stand.gesperrtBis = jetzt + Math.min(FENSTER_MS * 2 ** stufe, MAX_SPERRE_MS);
			}
			return 0;
		},
		erfolg: (schluessel) => {
			staende.delete(schluessel);
		},
	};
};

const erweitereIPv6 = (adresse: string): string[] => {
	const [kopf = '', schwanz] = adresse.split('::');
	const vorne = kopf ? kopf.split(':') : [];
	const hinten = schwanz ? schwanz.split(':') : [];
	const fuellung = schwanz === undefined ? [] : Array<string>(8 - vorne.length - hinten.length).fill('0');
	return [...vorne, ...fuellung, ...hinten];
};

/** IPv4 einzeln, IPv6 je /64: Ein Anschluss bekommt meist ein ganzes /64 und könnte sonst Adressen wechseln. */
export const ipSchluessel = (ip: string | undefined): string => {
	const adresse = (ip ?? '').replace(/%.*$/, '');
	const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(adresse)?.[1];
	if (v4 !== undefined || isIPv4(adresse)) {
		return v4 ?? adresse;
	}
	if (isIPv6(adresse)) {
		const gruppen = erweitereIPv6(adresse.toLowerCase());
		return `${gruppen
			.slice(0, 4)
			.map((g) => g.replace(/^0+(?=.)/, ''))
			.join(':')}::/64`;
	}
	return adresse || 'unbekannt';
};
