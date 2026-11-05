import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, MATERIAL_DIR, objekt, oeffneObjekt, test } from './hilfe';

const mappenzahl = async () => (await readdir(MATERIAL_DIR)).length;

const neuerOrdner = async (page: Page, name: string) => {
	await page.locator('[data-werkzeugleiste] [data-neuer-ordner]').click();
	await expect(page.locator('[data-namensfeld] input')).toBeFocused();
	await page.keyboard.type(name);
	await page.keyboard.press('Enter');
	await expect(objekt(page, name)).toBeVisible();
	await oeffneObjekt(page, name);
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
};

test.describe('Anlegen ohne Claude', () => {
	test('Von „Mein Material“ zum Arbeitsblatt: Ordner, Assistent, Baustein', async ({ page }) => {
		await page.goto('/');
		await neuerOrdner(page, `Testordner ${Date.now()}`);

		await page.locator('[data-werkzeugleiste] [data-material-anlegen]').click();
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

	test('Abbrechen hinterlässt nichts; gleicher Ordnername: Das Feld bleibt offen, nichts wird ersetzt', async ({
		page,
	}) => {
		await page.goto('/');
		const vorher = await mappenzahl();
		await page.locator('[data-werkzeugleiste] [data-material-anlegen]').click();
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		expect(await mappenzahl()).toBe(vorher);

		const titel = `Doppelt ${Date.now()}`;
		const nenne = async () => {
			await page.locator('[data-werkzeugleiste] [data-neuer-ordner]').click();
			await expect(page.locator('[data-namensfeld] input')).toBeFocused();
			await page.keyboard.type(titel);
			await page.keyboard.press('Enter');
		};
		await nenne();
		await expect(objekt(page, titel)).toBeVisible();
		await nenne();
		await expect(page.getByRole('alert')).toContainText('Diesen Namen gibt es hier schon.');
		await page.keyboard.press('Escape');
		await expect(objekt(page, titel)).toHaveCount(1);
		await expect(objekt(page, 'Neuer Ordner')).toHaveCount(1);
	});

	test('Jede Art führt zu einem bearbeitbaren Dokument', async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto('/');
		await neuerOrdner(page, `Alle Arten ${Date.now()}`);
		await expect(page).toHaveURL(/\/o\//);
		const ordner = page.url();
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
			await page.goto(ordner);
			await page.locator('[data-werkzeugleiste] [data-material-anlegen]').click();
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
