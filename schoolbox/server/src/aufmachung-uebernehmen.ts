import type { AufmachungWerte } from '@schoolbox/kern/src/aufmachungen';
import {
	aufmachungsFormatVon,
	aufmachungVon,
	leseAufmachung,
	wendeAufmachungAn,
} from '@schoolbox/kern/src/aufmachungen';
import { attribut, klassenVon, zerlege } from '@schoolbox/kern/src/quelltext';
import { dokKnotenSchluessel, dokumenteIn, dokumentDir, legeVersionAn, leseMeta, lebenderOrdner } from '@schoolbox/kern';
import type { Request } from 'express';
import { Router } from 'express';

import { leseQuelle, nimmFremdeAenderungAuf, schreibeQuelle, verlangeDokument } from './dokumente';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { dokSchluessel } from './kontext';

/**
 * Rezept „Auf alle Blätter im Ordner übernehmen“ (122, Entscheidung 44, F5): kopiert die Werte des Rezepts **einmal**
 * auf alle anderen Materialien im selben Ordner (ohne Unterordner, ohne Minibücher). Danach ist jedes unabhängig.
 * Jedes Material bekommt vorher eine Version mit seinem alten Stand, jedes in seiner eigenen Sperre, nacheinander.
 */

interface Ziel {
	mappe: string;
	dok: string;
	titel: string;
}

/** Eigene Gestaltung in `.ebene.hinten`, die nicht zum Rezept gehört: Sie bleibt und kann doppelt aussehen. */
const hatEigeneGestaltungHinten = (quelle: string) => {
	const z = zerlege(quelle);
	return z.knoten.some((k) => {
		const klassen = klassenVon(k);
		return (
			klassen.includes('ebene') &&
			klassen.includes('hinten') &&
			k.kinder.some((c) => !attribut(c, 'data-aufmachung-teil'))
		);
	});
};

/** Das offene Material, sein Rezept und die anderen Materialien in seinem Ordner, mit Titeln. */
const lage = async (kontext: Kontext, req: Request) => {
	const { dok, mappe } = req.params as { mappe: string; dok: string };
	const dir = verlangeDokument(kontext, mappe, dok);
	const werte = leseAufmachung(await leseQuelle(dir));
	if (!werte) {
		throw new HttpFehler(400, 'Dieses Material hat kein Rezept.');
	}
	const baum = kontext.ordner.baum();
	const ordner = lebenderOrdner(baum, baum.dokumente[dokKnotenSchluessel(mappe, dok)]?.ordner ?? null);
	if (!ordner) {
		throw new HttpFehler(400, 'Nur für Materialien in einem Ordner.');
	}
	const { materialDir } = kontext.konfig;
	const andere = dokumenteIn(baum, ordner.id).filter((d) => !(d.mappe === mappe && d.dok === dok));
	const ziele: Ziel[] = [];
	for (const d of andere) {
		try {
			ziele.push({ ...d, titel: (await leseMeta(materialDir, d.mappe, d.dok)).titel });
		} catch {
			// Ein Eintrag im Baum ohne Dateien zählt nicht.
		}
	}
	return { werte, ordner, ziele, materialDir };
};

const quelleVon = (materialDir: string, z: Ziel) => leseQuelle(dokumentDir(materialDir, z.mappe, z.dok));

/** Die Werte aus dem Dialog: ein bekanntes Rezept, der Rest prüft `wendeAufmachungAn` selbst. */
const leseWerte = (body: unknown): AufmachungWerte => {
	const werte = (body as { werte?: unknown } | null)?.werte;
	const id = (werte as { id?: unknown } | null)?.id;
	if (!werte || typeof werte !== 'object' || typeof id !== 'string' || !aufmachungVon(id)) {
		throw new HttpFehler(400, 'Bitte die Werte des Rezepts mitschicken.');
	}
	return werte as AufmachungWerte;
};

export const aufmachungUebernehmenApi = (kontext: Kontext) => {
	const router = Router({ mergeParams: true });

	/** Vorschau ohne Änderung: was der Dialog zeigt. */
	router.get('/', async (req, res) => {
		const { materialDir, ordner, werte, ziele } = await lage(kontext, req);
		const minibuch: string[] = [];
		const anderesRezept: string[] = [];
		const gestaltungHinten: string[] = [];
		let aendern = 0;
		for (const z of ziele) {
			const quelle = await quelleVon(materialDir, z).catch(() => null);
			if (quelle === null) {
				continue;
			}
			if (!aufmachungsFormatVon(quelle)) {
				minibuch.push(z.titel);
				continue;
			}
			aendern += 1;
			const alt = leseAufmachung(quelle);
			if (alt && alt.id !== werte.id) {
				anderesRezept.push(z.titel);
			}
			if (hatEigeneGestaltungHinten(quelle)) {
				gestaltungHinten.push(z.titel);
			}
		}
		res.json({
			rezept: aufmachungVon(werte.id)?.name ?? werte.id,
			ordner: ordner.name,
			werte,
			aendern,
			minibuch,
			anderesRezept,
			gestaltungHinten,
		});
	});

	/** Übernehmen mit den Werten aus der Vorschau; je Material eine Sperre, Fehler überspringen und sammeln. */
	router.post('/', async (req, res) => {
		const werte = leseWerte(req.body);
		const { materialDir, ziele } = await lage(kontext, req);
		const { id, ...rest } = werte;
		const geaendert: string[] = [];
		const uebersprungen: string[] = [];
		const fehlgeschlagen: string[] = [];
		for (const z of ziele) {
			try {
				const ergebnis = await kontext.sperre(dokSchluessel(z.mappe, z.dok), async () => {
					await nimmFremdeAenderungAuf(kontext, z.mappe, z.dok);
					const quelle = await quelleVon(materialDir, z);
					if (!aufmachungsFormatVon(quelle)) {
						return 'uebersprungen' as const;
					}
					const neu = wendeAufmachungAn(quelle, id, rest);
					if (neu === quelle) {
						return 'gleich' as const;
					}
					// Der Stand vor dem Rezept als eigene Version, auch wenn die letzte der Lehrkraft jung ist.
					const dir = dokumentDir(materialDir, z.mappe, z.dok);
					await legeVersionAn(dir, 'lehrkraft', new Date(), { zusammenfassen: false });
					await schreibeQuelle(kontext, z.mappe, z.dok, neu, { urheber: 'lehrkraft', zusammenfassen: false });
					return 'geaendert' as const;
				});
				if (ergebnis === 'uebersprungen') {
					uebersprungen.push(z.titel);
				} else {
					geaendert.push(z.titel);
				}
			} catch {
				fehlgeschlagen.push(z.titel);
			}
		}
		res.json({ geaendert, uebersprungen, fehlgeschlagen });
	});

	return router;
};
