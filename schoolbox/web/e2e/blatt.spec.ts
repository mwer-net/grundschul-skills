import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const allesWaehlen = (ziel: Locator) =>
	ziel.evaluate((el) => {
		el.ownerDocument.getSelection()?.selectAllChildren(el);
	});

test.describe('Editor: ganzes Blatt und Einstellungen (046, 048)', () => {
	test('Palette und Format ändern genau das, je ein Schritt in Rückgängig', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const palette = page.locator('[data-palette]').getByRole('button').last();
		await druecke(palette);
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(vorher);
		await page.getByLabel('Format').selectOption('a4-quer');
		await expect.poll(() => quelle(page)).toContain('a4-quer');
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Sichtbarkeit setzt die Klasse und lässt sich zurücknehmen', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		await druecke(material(page).locator('.aufgabe').first().locator('h2, .anw').first());
		await druecke(page.locator('[data-breadcrumb]').getByRole('button', { name: 'Aufgabe 1' }));
		await page.getByLabel('Sichtbarkeit').selectOption('loesung');
		await expect.poll(() => quelle(page)).toContain('nur-loesung');
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Hervorheben legt mark um die Auswahl', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const h1 = material(page).locator('h1');
		await druecke(h1);
		await druecke(h1);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await allesWaehlen(h1);
		await page.getByRole('button', { name: 'Hervorheben' }).click();
		await page.getByRole('button', { name: 'Fertig' }).click();
		await expect.poll(() => quelle(page)).toContain('<mark>');
	});

	test('Lückentext: einfügen, im Panel ändern, ohne Lücke ein Hinweis statt Speichern', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.getByRole('button', { name: 'Bausteine' }).click();
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Lückentext');
		await page.locator('[data-einfuegen="x-lueckentext"]').click();
		const element = material(page).locator('x-lueckentext');
		await expect(element.locator('.luecke').first()).toBeVisible();
		await druecke(element);
		const werkzeug = page.locator('[data-abbildungswerkzeug]');
		const text = werkzeug.getByLabel('Text', { exact: true });
		await text.fill('Der [Hund] bellt.');
		await text.blur();
		await expect(element.locator('.luecke')).toHaveCount(1);
		const stand = await quelle(page);
		await text.fill('Der Hund bellt.');
		await text.blur();
		await expect(werkzeug.locator('[data-fehler="_element"]')).toContainText('keine Lücke');
		expect(await quelle(page)).toBe(stand);
	});
});
