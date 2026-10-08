import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

import { ASSETS } from './konfig';

/**
 * Bildet `suche()` aus blatt.py nach: erst neben der Quelle, dann in assets/. Wie Pythons `Path.resolve()`
 * werden Symlinks aufgelöst. Grenzen (z. B. nichts außerhalb der Ablage) setzt erst der Aufrufer.
 */
export const sucheRessource = (name: string, quelleDir: string, assetsDir = ASSETS): string | null => {
	for (const basis of [quelleDir, assetsDir]) {
		const kandidat = path.resolve(basis, name);
		if (existsSync(kandidat)) {
			return realpathSync(kandidat);
		}
	}
	return null;
};
