import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { dokumentDir, mappenDir, neueMappe, neuesDokument } from './ablage';
import { schreibeAtomar } from './atomar';
import type { Fertig } from './bauen';
import { fertigstellen } from './bauen';
import type { Konfig } from './konfig';
import { WURZEL } from './konfig';
import { idsImPapierkorb } from './papierkorb';
import { legeVersionAn } from './versionen';

export const HILFE_MAPPE = 'schoolbox-hilfe';
export const KURZANLEITUNG = 'kurzanleitung';
export const KURZANLEITUNG_VORLAGE = path.join(WURZEL, 'schoolbox', 'vorlagen', 'kurzanleitung.html');
/** Prüfsumme der Vorlage, aus der material.html zuletzt geschrieben wurde. */
const STAND_DATEI = '.vorlage-stand';

export type KurzanleitungStand = 'angelegt' | 'aktualisiert' | 'aktuell' | 'im-papierkorb';

/**
 * Hält die Mappe „Schoolbox-Hilfe“ mit der Kurzanleitung auf dem Stand der Vorlage im Repo (`scripts/ausrollen.sh`
 * ruft das nach jedem Ausrollen auf). Neu geschrieben wird nur, wenn sich die Vorlage seit dem letzten Mal geändert
 * hat; was die Lehrkraft inzwischen geändert hat, bleibt vorher als Version erhalten. Liegt die Mappe im Papierkorb,
 * hat die Lehrkraft sie gelöscht, und sie kommt nicht wieder.
 */
export const richteKurzanleitungEin = async (
	konfig: Pick<Konfig, 'materialDir' | 'pythonBin'>,
	jetzt = new Date(),
	vorlage = KURZANLEITUNG_VORLAGE,
): Promise<{ stand: KurzanleitungStand; fertig: Fertig | null }> => {
	const { materialDir } = konfig;
	const mappeDa = existsSync(mappenDir(materialDir, HILFE_MAPPE));
	if (!mappeDa && idsImPapierkorb(materialDir).has(HILFE_MAPPE)) {
		return { stand: 'im-papierkorb', fertig: null };
	}
	if (!mappeDa) {
		const angaben = { titel: 'Schoolbox-Hilfe', fach: 'faecheruebergreifend', klasse: 'gemischt' } as const;
		await neueMappe(materialDir, { ...angaben, id: HILFE_MAPPE }, jetzt);
	}
	const dir = dokumentDir(materialDir, HILFE_MAPPE, KURZANLEITUNG);
	const neu = !existsSync(dir);
	if (neu) {
		await neuesDokument(
			materialDir,
			HILFE_MAPPE,
			{ titel: 'Kurzanleitung', art: 'sonstiges', format: 'a4-hoch', druckprofil: 'farbe', druckhinweise: [] },
			jetzt,
		);
	}
	const html = await readFile(vorlage, 'utf8');
	const pruefsumme = createHash('sha256').update(html).digest('hex');
	const standDatei = path.join(dir, STAND_DATEI);
	if (!neu && (await readFile(standDatei, 'utf8').catch(() => '')) === pruefsumme) {
		return { stand: 'aktuell', fertig: null };
	}
	if (!neu) {
		await legeVersionAn(dir, 'lehrkraft', jetzt, { zusammenfassen: false });
	}
	await schreibeAtomar(path.join(dir, 'material.html'), html);
	const fertig = await fertigstellen(konfig, { mappe: HILFE_MAPPE, dok: KURZANLEITUNG }, jetzt);
	await schreibeAtomar(standDatei, pruefsumme);
	return { stand: neu ? 'angelegt' : 'aktualisiert', fertig };
};
