import { accessSync, constants, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

import type { Konfig } from '@schoolbox/kern';
import { STANDARD_HOST, STANDARD_PORT } from '@schoolbox/kern';

export interface ServerKonfig extends Konfig {
	portNummer: number;
	hostName: string;
}

const MIN_GEHEIMNIS = 32;

const pruefeMaterialDir = (materialDir: string): string | null => {
	if (existsSync(materialDir) && !statSync(materialDir).isDirectory()) {
		return `MATERIAL_DIR „${materialDir}“ ist kein Ordner.`;
	}
	try {
		mkdirSync(materialDir, { recursive: true });
		accessSync(materialDir, constants.R_OK | constants.W_OK);
		return null;
	} catch {
		return `MATERIAL_DIR „${materialDir}“ lässt sich nicht anlegen oder nicht beschreiben.`;
	}
};

const pruefeUrl = (url: string | null): string | null => {
	if (url === null) {
		return null;
	}
	try {
		return ['http:', 'https:'].includes(new URL(url).protocol)
			? null
			: `SCHOOLBOX_URL „${url}“ ist keine Web-Adresse.`;
	} catch {
		return `SCHOOLBOX_URL „${url}“ ist keine Web-Adresse.`;
	}
};

const pruefeMail = (schluessel: string, wert: string | null) =>
	wert === null || /^[^\s@]+@[^\s@]+$/.test(wert) ? null : `${schluessel} „${wert}“ ist keine Mailadresse.`;

/** Prüft beim Start alles, was der Server braucht, und meldet alle Probleme auf einmal. */
export const pruefeServerKonfig = (konfig: Konfig): ServerKonfig => {
	const portNummer = Number(konfig.port ?? STANDARD_PORT);
	const probleme = [
		Number.isInteger(portNummer) && portNummer >= 1 && portNummer <= 65535
			? null
			: `PORT „${konfig.port}“ ist keine Portnummer (1–65535).`,
		pruefeUrl(konfig.schoolboxUrl),
		pruefeMaterialDir(konfig.materialDir),
		path.isAbsolute(konfig.pythonBin) && !existsSync(konfig.pythonBin)
			? `PYTHON_BIN „${konfig.pythonBin}“ gibt es nicht.`
			: null,
		konfig.sitzungGeheimnis !== null && konfig.sitzungGeheimnis.length < MIN_GEHEIMNIS
			? `SITZUNG_GEHEIMNIS ist zu kurz (mindestens ${MIN_GEHEIMNIS} Zeichen, z. B. „openssl rand -hex 32“).`
			: null,
		pruefeMail('MAIL_AN', konfig.mail.an),
		pruefeMail('MAIL_VON', konfig.mail.von),
	].filter((p): p is string => p !== null);
	if (probleme.length > 0) {
		const datei = path.join(konfig.wurzel, '.env');
		throw new Error(`Die Konfiguration in ${datei} ist nicht in Ordnung:\n  - ${probleme.join('\n  - ')}`);
	}
	return { ...konfig, portNummer, hostName: konfig.host ?? STANDARD_HOST };
};
