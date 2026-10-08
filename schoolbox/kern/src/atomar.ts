import { randomBytes } from 'node:crypto';
import { open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

export const istTempDatei = (name: string) => name.startsWith('.') && name.endsWith('.tmp');

export const schreibeAtomar = async (ziel: string, inhalt: string | Buffer): Promise<void> => {
	const tmp = path.join(
		path.dirname(ziel),
		`.${path.basename(ziel)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`,
	);
	try {
		const datei = await open(tmp, 'wx');
		try {
			await datei.writeFile(inhalt);
			await datei.sync();
		} finally {
			await datei.close();
		}
		await rename(tmp, ziel);
	} catch (fehler) {
		await rm(tmp, { force: true });
		throw fehler;
	}
};

export const schreibeJson = (ziel: string, daten: unknown) =>
	schreibeAtomar(ziel, `${JSON.stringify(daten, null, '\t')}\n`);

export const kopiereAtomar = async (quelle: string, ziel: string) => schreibeAtomar(ziel, await readFile(quelle));
