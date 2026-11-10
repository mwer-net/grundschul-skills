/**
 * Claude ändert ein Rezept (123, Z11): Der Server gleicht den Vorschlag ab, bevor er ihn schreibt. Ändert Claude nur
 * einen Wert am `body` (Fall `rezept-wert`), zeigt der Vergleich neue Teile; ändert Claude ein Teil von Hand (Fall
 * `rezept-teil`), zeigt er das Teil wie vorher. Die Attrappe steht in `server/src/testhilfe.ts`.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';
import { wendeAufmachungAn } from '@schoolbox/kern/src/aufmachungen';

import { gespeichert, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, MATERIAL_DIR, test } from './hilfe';

const kiFall = (name: string) => writeFile(path.join(`${MATERIAL_DIR}-ki`, 'fall.txt'), name);
const chat = (page: Page) => page.locator('[data-chat]');
const vergleich = (page: Page) => page.frameLocator('[data-vorschlag-rahmen]');
const zurueck = (page: Page) => page.getByRole('button', { name: /^Rückgängig/ }).first();

const beauftrage = async (page: Page, text: string) => {
	await page.getByRole('button', { name: 'Claude', exact: true }).click();
	await chat(page).getByLabel('Was soll Claude ändern?').fill(text);
	await chat(page).getByRole('button', { name: 'Senden' }).click();
	await expect(chat(page).locator('[data-ki-vorschlag]')).toBeVisible();
	await chat(page).getByRole('button', { name: 'Vergleichen' }).click();
};

const mitZirkus = async (page: Page) => {
	const u = await uhrzeit();
	await writeFile(u.material, wendeAufmachungAn(blattMit(), 'zirkus'));
	await oeffne(page, u.id, u.dok);
	return u;
};

test.describe('Rezept von Claude (123)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Vergleich mit der Maus');

	test.afterEach(async () => {
		await kiFall('gut');
	});

	test('Claude ändert nur den Wert: Vergleich zeigt das neue Kopfband, Annehmen ist ein Schritt, ⌘Z stellt her', async ({
		page,
	}) => {
		const u = await mitZirkus(page);
		const vorher = await quelle(page);
		await kiFall('rezept-wert');
		await beauftrage(page, 'Mach das Kopfband zackig.');
		await expect(vergleich(page).locator('body[data-aufmachung-kopfband="zacken"]')).toBeAttached();
		await page.getByRole('dialog').getByRole('button', { name: 'Annehmen' }).click();
		await gespeichert(page, u.material);
		const danach = await quelle(page);
		expect(danach).toBe(wendeAufmachungAn(blattMit(), 'zirkus', { kopfband: 'zacken' }));

		await zurueck(page).click();
		await gespeichert(page, u.material);
		expect(await quelle(page)).toBe(vorher);
	});

	test('Claude ändert ein Teil von Hand: Der Vergleich zeigt das Teil wie vorher', async ({ page }) => {
		await mitZirkus(page);
		const vorher = await quelle(page);
		await kiFall('rezept-teil');
		await beauftrage(page, 'Mach die Fläche blasser.');
		const flaeche = vergleich(page).locator('[data-aufmachung-teil="flaeche"]').first();
		await expect(flaeche).toBeAttached();
		expect(await flaeche.getAttribute('style')).not.toContain('opacity:0.2');
		await page.getByRole('dialog').getByRole('button', { name: 'Annehmen' }).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});
});
