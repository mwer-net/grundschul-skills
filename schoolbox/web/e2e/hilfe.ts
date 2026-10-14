import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';
import { expect, test as basis } from '@playwright/test';
import type { Art, Fach, Format, Klasse } from '@schoolbox/kern';
import { neueMappe, neuesDokument } from '@schoolbox/kern';

const MATERIAL_DIR = process.env.E2E_MATERIAL_DIR ?? '';
/** Wie `TEST_PASSWORT` in server/src/testhilfe.ts; der Testserver kennt nur dieses. */
export const PASSWORT = 'drei-kleine-woerter';

interface NeuesDokument {
	titel: string;
	art?: Art;
	format?: Format;
}

/** Legt eine Mappe so an, wie Claude es tut: direkt in der Ablage, am Server vorbei. */
export const legeMappeAn = async (titel: string, fach: Fach, klasse: Klasse, dokumente: NeuesDokument[] = []) => {
	const { mappe } = await neueMappe(MATERIAL_DIR, { titel, fach, klasse });
	const ids: string[] = [];
	for (const { art = 'arbeitsblatt', format = 'a4-hoch', titel: dokTitel } of dokumente) {
		const angaben = { titel: dokTitel, art, format, druckprofil: 'sw', druckhinweise: [] } as const;
		ids.push((await neuesDokument(MATERIAL_DIR, mappe.id, angaben)).id);
	}
	return { id: mappe.id, dokumente: ids };
};

const leereAblage = async () => {
	const namen = await readdir(MATERIAL_DIR);
	await Promise.all(namen.map((name) => rm(path.join(MATERIAL_DIR, name), { recursive: true, force: true })));
};

export const meldeAn = async (page: Page) => {
	const antwort = await page.request.post('/api/anmelden', {
		headers: { 'x-schoolbox': '1' },
		data: { passwort: PASSWORT },
	});
	expect(antwort.status()).toBe(200);
};

interface Hilfen {
	/** Tippt mit dem Finger, wo das Gerät einen Touchscreen hat, sonst klickt die Maus. */
	druecke: (ziel: Locator) => Promise<void>;
}

/** Jeder Test beginnt angemeldet und mit leerer Ablage. */
export const test = basis.extend<Hilfen>({
	page: async ({ page }, nutze) => {
		await leereAblage();
		await meldeAn(page);
		await nutze(page);
	},
	druecke: async ({ hasTouch }, nutze) => {
		await nutze((ziel) => (hasTouch ? ziel.tap() : ziel.click()));
	},
});

export { expect };
