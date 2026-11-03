import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

test.describe('Editor: Tabelle', () => {
	test('einfügen, Zeile im Panel, Tab springt, am Ende neue Zeile, Rückgängig', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.getByRole('button', { name: 'Bausteine' }).click();
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Tabelle');
		await page.locator('[data-einfuegen="tabelle"]').click();
		const tabelle = material(page).locator('table.kit-tabelle');
		await expect(tabelle).toHaveCount(1);
		const zelle = tabelle.locator('tbody td').first();
		await druecke(zelle);
		await page.getByRole('button', { name: 'Zeile danach' }).click();
		await expect(tabelle.locator('tbody tr')).toHaveCount(3);
		const vorher = await quelle(page);
		await page.getByRole('button', { name: 'Rückgängig' }).click();
		await expect(tabelle.locator('tbody tr')).toHaveCount(2);
		expect(await quelle(page)).not.toBe(vorher);
		const letzte = tabelle.locator('tbody tr').last().locator('td').last();
		await druecke(letzte);
		await druecke(letzte);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.type('x');
		await page.keyboard.press('Tab');
		await expect(tabelle.locator('tbody tr')).toHaveCount(3);
		await expect(letzte).toHaveCount(1);
		await expect.poll(() => quelle(page)).toContain('>x<');
	});
});
