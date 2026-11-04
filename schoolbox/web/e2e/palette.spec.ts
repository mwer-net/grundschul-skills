import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, legeMappeAn, test } from './hilfe';

const palette = (page: import('@playwright/test').Page) => page.locator('[data-befehlspalette]');
const feld = (page: import('@playwright/test').Page) => palette(page).getByRole('combobox');

test.describe('Befehlspalette (073)', () => {
	test('öffnet mit der Taste und über die Statusleiste, findet Spalten', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.keyboard.press('ControlOrMeta+k');
		await expect(palette(page)).toBeVisible();
		await feld(page).fill('abst');
		await expect(palette(page).getByRole('option').first()).toContainText('Abstand zwischen Aufgaben');
		await page.keyboard.press('Escape');
		await expect(palette(page)).toBeHidden();

		await page.locator('[data-palette-knopf]').click();
		await expect(palette(page)).toBeVisible();
		await page.keyboard.press('Escape');
	});

	test('Esc gibt den Fokus ans Blatt zurück, Tasten wirken danach ohne Klick', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await material(page).locator('.aufgabe').first().click();
		await expect(page.locator('[data-bausteinleiste]')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+k');
		await expect(feld(page)).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(palette(page)).toBeHidden();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-breadcrumb] h2')).not.toContainText('Aufgabe');
	});

	test('führt einen Befehl aus und merkt ihn sich', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await material(page).locator('.aufgabe').first().locator('.nr').click();
		const vorher = await material(page).locator('.aufgabe').count();
		await page.keyboard.press('ControlOrMeta+k');
		await feld(page).fill('duplizieren');
		await expect(palette(page).getByRole('option').first()).toContainText('Duplizieren');
		await expect(palette(page).getByRole('option').first().locator('kbd')).toBeVisible();
		await page.keyboard.press('Enter');
		await expect(palette(page)).toBeHidden();
		await expect(material(page).locator('.aufgabe')).toHaveCount(vorher + 1);

		await page.keyboard.press('ControlOrMeta+k');
		await expect(palette(page).locator('[data-palette-gruppe="Zuletzt benutzt"]')).toContainText('Duplizieren');
		await page.keyboard.press('Escape');
	});

	test('zeigt die Spalten als Befehl mit Wirkung', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await material(page).locator('.reihe').first().locator('x-uhr').first().click();
		await page.keyboard.press('ControlOrMeta+k');
		await feld(page).fill('spal');
		await expect(palette(page).getByRole('option').first()).toContainText('Spalten');
		await page.keyboard.press('Escape');
	});

	test('fügt einen Baustein aus dem Katalog ein', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await material(page).locator('.aufgabe').first().click();
		const vorher = (await quelle(page)).length;
		await page.keyboard.press('ControlOrMeta+k');
		await feld(page).fill('schreiblinie');
		const zeile = palette(page).locator('[data-palette-gruppe="Baustein einfügen"]').getByRole('option').first();
		await expect(zeile).toBeVisible();
		await zeile.click();
		await expect(palette(page)).toBeHidden();
		await expect.poll(async () => (await quelle(page)).length).toBeGreaterThan(vorher);
	});

	test('springt zur Einstellung im Reiter Blatt', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await material(page).locator('.aufgabe').first().click();
		await page.keyboard.press('ControlOrMeta+k');
		await feld(page).fill('abstand');
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await expect(page.getByLabel('Abstand zwischen Aufgaben')).toBeFocused();
	});

	test('in der Textsitzung läuft die Sitzung nach Esc weiter', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await material(page).locator('.anw .text').first().dblclick();
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+k');
		await expect(palette(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(palette(page)).toBeHidden();
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.type('X');
		await expect(material(page).locator('.anw .text').first()).toContainText('X');
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
	});

	test('außerhalb des Editors öffnet sie eine Mappe', async ({ page }) => {
		const { id } = await legeMappeAn('Kartoffelernte', 'sachunterricht', 3, []);
		await page.goto('/');
		await page.locator('[data-palette-knopf]').click();
		await feld(page).fill('kartoffeler');
		await expect(palette(page).getByRole('option').first()).toContainText('Kartoffelernte');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(new RegExp(`/m/${id}$`));
	});

	test('Zeilen sind auf dem iPad groß genug', async ({ page }, info) => {
		test.skip(!info.project.name.startsWith('ipad'), 'nur mit Finger');
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.locator('[data-palette-knopf]').click();
		const box = await palette(page).getByRole('option').first().boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		await page.keyboard.press('Escape');
	});
});
