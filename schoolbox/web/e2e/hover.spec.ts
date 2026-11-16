/**
 * Hover zeigt, was der Klick wählt (205): ein Rahmen mit Namensschild um das Ziel unter der Maus, die ganze
 * Einfüge-Linie als Knopf und ein Rechtsklick, der dasselbe wählt wie der Klick.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, uhrzeit } from './editorhilfe';
import { blattMit, GRUPPE } from './gestaltung-daten';
import { expect, test } from './hilfe';

const rahmen = (page: Page) => page.locator('[data-hover-rahmen]');
const schild = (page: Page) => page.locator('[data-hover-schild]');

/** Die Maus an eine Stelle im Blatt, in Pixeln des Elternfensters. */
const zeigeAuf = async (page: Page, ziel: Locator, dx = 0.5, dy = 0.5) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	await page.mouse.move(b.x + b.width * dx, b.y + b.height * dy);
};

test.describe('Hover-Rahmen (205)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Finger bekommen keinen Rahmen');

	test('Rahmen und Schild zeigen, was der Klick wählt; über der Auswahl steht keiner', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const uhr = material(page).locator('x-uhr').first();

		await zeigeAuf(page, uhr);
		await expect(rahmen(page)).toHaveCount(1);
		await expect(rahmen(page)).toHaveAttribute('data-hover-art', 'baustein');
		await expect(schild(page)).toHaveText('Uhr');

		await zeigeAuf(page, material(page).locator('.aufgabe').first().locator('.nr'));
		await expect(schild(page)).toHaveText('Aufgabe 1');

		// Ein Klick wählt genau das Umrahmte; danach steht dort kein Hover-Rahmen mehr.
		await zeigeAuf(page, uhr);
		const nr = await rahmen(page).getAttribute('data-hover-rahmen');
		await page.mouse.down();
		await page.mouse.up();
		await expect(page.locator('[data-auswahl="abbildung"]')).toBeVisible();
		await page.mouse.move(1, 1);
		await zeigeAuf(page, uhr);
		await expect(rahmen(page)).toHaveCount(0);
		expect(await uhr.getAttribute('data-sb')).toBe(nr);
	});

	test('Gedrückte Taste, Tippen und die Leiste nehmen den Rahmen weg', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const uhr = material(page).locator('x-uhr').first();

		await zeigeAuf(page, uhr);
		await expect(rahmen(page)).toHaveCount(1);
		await page.keyboard.press('Shift');
		await expect(rahmen(page)).toHaveCount(0);

		await zeigeAuf(page, uhr, 0.4);
		await expect(rahmen(page)).toHaveCount(1);
		await page.mouse.down();
		await zeigeAuf(page, uhr, 0.6);
		await expect(rahmen(page)).toHaveCount(0);
		await page.mouse.up();
	});

	test('205-04: Der Klick neben der Pille in den Zwischenraum öffnet die Schnellauswahl', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const aufgabe = material(page).locator('.aufgabe').first();
		const b = await aufgabe.boundingBox();
		if (!b) {
			throw new Error('nicht sichtbar');
		}
		await page.mouse.move(b.x + b.width - 30, b.y + b.height + 6);
		const linie = page.locator('[data-einfuege-luecke]');
		await expect(linie).toBeVisible();
		await expect(rahmen(page)).toHaveCount(0);
		await expect(linie).toHaveCSS('cursor', 'pointer');
		await page.mouse.click(b.x + b.width - 30, b.y + b.height + 6);
		await expect(page.locator('[data-schnellauswahl]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-schnellauswahl]')).toBeHidden();
		await expect(page.locator('[data-auswahl]')).toHaveCount(0);
	});

	test('205-05: Rechtsklick in der Gruppe wählt die Gruppe wie der Klick', async ({ page }) => {
		const u = await uhrzeit();
		await writeFile(u.material, blattMit({ vorne: [GRUPPE] }));
		await oeffne(page, u.id, u.dok);
		const kind = material(page).locator('.gruppe > [data-lage="frei"]').first();

		await zeigeAuf(page, kind);
		await expect(rahmen(page)).toHaveAttribute('data-hover-art', 'gestaltung');
		// 196-15/205-03: derselbe Name wie in den Ebenen, mit der Zahl der Teile.
		await expect(schild(page)).toHaveText('Gruppe (2)');
		await kind.click({ button: 'right' });
		await expect(page.locator('[data-auswahl="gruppe"]')).toBeVisible();
	});
});
