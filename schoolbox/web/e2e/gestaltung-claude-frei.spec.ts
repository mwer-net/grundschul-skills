/**
 * Claude-Elemente frei legen (117). Ein freies Element aus 088 kommt über ⋯ „Frei legen“ an derselben Stelle nach
 * vorne und behält `data-frei`.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { gespeichert, imMehr, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const zurueck = (page: Page) => page.getByRole('button', { name: /^Rückgängig/ }).first();

const TANGRAM =
	'<figure data-frei data-frei-titel="Tangram Waschbär"><svg viewBox="0 0 100 100" width="100%"><polygon points="0,0 100,0 50,50" fill="none" stroke="#000" stroke-width="2"/></svg><figcaption>Lege den Waschbären.</figcaption></figure>';

const blatt = async (page: Page, html: string) => {
	const u = await uhrzeit();
	await writeFile(u.material, html);
	await oeffne(page, u.id, u.dok);
	return u;
};

const gegenSeite = async (page: Page, ziel: Locator) => {
	const e = await ziel.boundingBox();
	const s = await material(page).locator('.seite').first().boundingBox();
	if (!e || !s) {
		throw new Error('nicht sichtbar');
	}
	return { x: e.x - s.x, y: e.y - s.y, b: e.width };
};

test.describe('Claude-Elemente frei legen (117)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
	});

	test('Frei legen über ⋯: dieselbe Stelle, data-frei bleibt, wählbar mit Drehgriff, Name in den Ebenen, ⌘Z', async ({
		page,
	}) => {
		const u = await blatt(page, blattMit({ stapel: [TANGRAM] }));
		const stand = await quelle(page);
		const element = material(page).locator('figure[data-frei]');
		await element.evaluate((e) => e.scrollIntoView({ block: 'center' }));
		// Gegen die Seite gemessen: Wird das Element aus dem Stapel genommen, wird die Seite kürzer und das Blatt rollt.
		const vorher = await gegenSeite(page, element);
		await element.click();
		await imMehr(page, 'Frei legen');
		await expect
			.poll(() => quelle(page))
			.toMatch(
				/<div class="ebene vorne">\s*<figure data-frei data-frei-titel="Tangram Waschbär"[^>]*data-lage="frei"/,
			);
		const nachher = await gegenSeite(page, material(page).locator('figure[data-frei][data-lage="frei"]'));
		expect(Math.abs(nachher.x - vorher.x)).toBeLessThan(2);
		expect(Math.abs(nachher.y - vorher.y)).toBeLessThan(2);
		expect(Math.abs(nachher.b - vorher.b)).toBeLessThan(2);
		await expect(page.locator('[data-gestaltung-griff="drehen"]')).toBeVisible();

		await oeffneSchublade(page, 'ebenen');
		await expect(page.locator('[data-zeilen-art="vorne"]').filter({ hasText: 'Tangram Waschbär' })).toHaveCount(1);

		await zurueck(page).click();
		await gespeichert(page, u.material);
		expect(await quelle(page)).toBe(stand);
	});
});
