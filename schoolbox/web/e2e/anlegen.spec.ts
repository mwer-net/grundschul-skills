import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, MATERIAL_DIR, test } from './hilfe';

const mappenzahl = async () => (await readdir(MATERIAL_DIR)).length;

test.describe('Anlegen ohne Claude', () => {
	test('Von der Übersicht zum Arbeitsblatt: Mappe, Assistent, Baustein', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Mappe anlegen' }).first().click();
		const titel = `Testmappe ${Date.now()}`;
		await page.getByRole('textbox', { name: 'Titel' }).fill(titel);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: titel })).toBeVisible();

		await page.getByRole('button', { name: 'Material anlegen' }).click();
		await expect(page.locator('[data-assistent="Art"]')).toBeVisible();
		await expect(page.locator('dialog')).not.toContainText('Farbe');
		await page.getByRole('button', { name: 'Weiter', exact: true }).click();
		await page.getByRole('button', { name: 'Weiter', exact: true }).click();
		await page.getByRole('button', { name: 'Weiter', exact: true }).click();
		await expect(page.locator('[data-anlegen-fehler]')).toContainText('Titel');
		await page.getByRole('textbox', { name: 'Titel' }).fill('Mein Blatt');
		await page.getByRole('button', { name: 'Weiter', exact: true }).click();
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page).toHaveURL(/bearbeiten\?neu=1/);
		await expect(page.locator('[data-bibliothek]')).toBeVisible();

		const [, , mappe = '', dok = ''] = new URL(page.url()).pathname.split('/');
		const versionen = await readdir(path.join(MATERIAL_DIR, mappe, 'dokumente', dok, 'versionen'));
		expect(versionen.some((v) => v.includes('lehrkraft'))).toBe(true);
		await page.locator('[data-bereich="Aufgabe und Text"]').click();
		await page.locator('[data-einfuegen="aufgabe"]').click();
		await expect(page.frameLocator('[data-editor-rahmen="sichtbar"]').locator('.aufgabe')).toHaveCount(1);
		await expect
			.poll(async () => readFile(path.join(MATERIAL_DIR, mappe, 'dokumente', dok, 'material.html'), 'utf8'))
			.toContain('class="aufgabe"');
	});

	test('Abbrechen hinterlässt nichts; doppelter Titel gibt eine klare Meldung', async ({ page }) => {
		await page.goto('/');
		const vorher = await mappenzahl();
		await page.getByRole('button', { name: 'Mappe anlegen' }).first().click();
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		expect(await mappenzahl()).toBe(vorher);

		const titel = `Doppelt ${Date.now()}`;
		for (const i of [1, 2]) {
			await page.goto('/');
			await page.getByRole('button', { name: 'Mappe anlegen' }).first().click();
			await page.getByRole('textbox', { name: 'Titel' }).fill(titel);
			await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
			if (i === 1) {
				await expect(page.getByRole('heading', { name: titel })).toBeVisible();
			}
		}
		await expect(page.locator('[data-anlegen-fehler]')).toContainText('gibt es schon');
	});

	test('Jede Art führt zu einem bearbeitbaren Dokument', async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto('/');
		await page.getByRole('button', { name: 'Mappe anlegen' }).first().click();
		await page.getByRole('textbox', { name: 'Titel' }).fill(`Alle Arten ${Date.now()}`);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page).toHaveURL(/\/m\//);
		const mappe = page.url();
		for (const art of [
			'lesetext',
			'lernspiel',
			'karten',
			'lernplakat',
			'stationen',
			'praesentation',
			'unterrichtsplanung',
			'klassenarbeit',
			'lernzielkontrolle',
			'sonstiges',
		]) {
			await page.goto(mappe);
			await page.getByRole('button', { name: 'Material anlegen' }).click();
			await page.locator(`[data-wahl="${art}"]`).click();
			await page.getByRole('button', { name: 'Weiter', exact: true }).click();
			await page.getByRole('button', { name: 'Weiter', exact: true }).click();
			await page.getByRole('textbox', { name: 'Titel' }).fill(art);
			await page.getByRole('button', { name: 'Weiter', exact: true }).click();
			await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
			await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		}
	});
});
