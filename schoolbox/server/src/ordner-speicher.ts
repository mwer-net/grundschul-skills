import { statSync } from 'node:fs';

import type { Baum } from '@schoolbox/kern';
import {
	gleicheAb,
	ladeBaum,
	leererBaum,
	leseBestand,
	ORDNER_SPERRE,
	ordnerDatei,
	schreibeBaum,
} from '@schoolbox/kern';

import type { Ereignisse } from './ereignisse';
import type { Sperre } from './sperre';

export interface Aenderung<T> {
	baum: Baum;
	ergebnis: T;
	/** Vor dem Löschen entsteht immer eine Sicherung. */
	loescht?: boolean;
}

export interface OrdnerSpeicher {
	/** Der zuletzt bekannte Stand im Speicher: Nur der Server schreibt ihn. */
	baum: () => Baum;
	/** Meldung nach einer kaputten Datei, sichtbar in der Oberfläche. */
	hinweis: () => string | undefined;
	/** Macht den Baum zur Sicht auf die Ablage, an der Claude vorbeischreibt. Bleibt alles gleich, wird nichts geschrieben. */
	abgleichen: () => Promise<Baum>;
	/** Eine Änderung unter der Sperre, auf frischem Stand. Wirft sie, bleibt der Baum, wie er war. */
	aendere: <T>(arbeit: (baum: Baum) => Promise<Aenderung<T>>) => Promise<T>;
}

export const erstelleOrdnerSpeicher = (
	materialDir: string,
	sperre: Sperre,
	ereignisse: Ereignisse,
): OrdnerSpeicher => {
	let geladen = false;
	let aktuell: Baum | null = null;
	let hinweis: string | undefined;
	let dateiZeit: number | null = null;

	const zeitDerDatei = () => {
		try {
			return statSync(ordnerDatei(materialDir)).mtimeMs;
		} catch {
			return null;
		}
	};

	const lade = () => {
		const { baum, hinweis: meldung } = ladeBaum(materialDir);
		aktuell = baum;
		hinweis = meldung ?? hinweis;
		dateiZeit = zeitDerDatei();
		geladen = true;
	};

	const frisch = () => {
		// Hat jemand an der Datei vorbei geschrieben (oder sie zerstört), gilt die Datei, nicht der Speicher.
		if (!geladen || zeitDerDatei() !== dateiZeit) {
			lade();
		}
	};

	const schreibe = async (baum: Baum, loescht: boolean) => {
		await schreibeBaum(materialDir, baum, new Date(), loescht);
		aktuell = baum;
		dateiZeit = zeitDerDatei();
		ereignisse.sende({ typ: 'ordner-geaendert', daten: { rev: baum.rev } });
	};

	const gleiche = async () => {
		frisch();
		const { baum, geaendert, meldungen } = gleicheAb(aktuell, await leseBestand(materialDir));
		for (const meldung of meldungen) {
			console.error(`Ordner: ${meldung}`);
		}
		if (geaendert) {
			await schreibe(baum, false);
		}
		return baum;
	};

	return {
		baum: () => {
			if (!geladen) {
				lade();
			}
			return aktuell ?? leererBaum();
		},
		hinweis: () => hinweis,
		abgleichen: () => sperre(ORDNER_SPERRE, gleiche),
		aendere: (arbeit) =>
			sperre(ORDNER_SPERRE, async () => {
				const vorher = await gleiche();
				const { baum, ergebnis, loescht = false } = await arbeit(vorher);
				// Dasselbe Objekt zurück heißt: nichts zu tun.
				if (baum !== vorher) {
					await schreibe(baum, loescht);
				}
				return ergebnis;
			}),
	};
};
