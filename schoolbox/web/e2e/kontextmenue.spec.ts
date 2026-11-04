import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

test.describe('Kontextmenü (070)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'am iPad ist ⋯ der Weg');

	test('Rechtsklick wählt und zeigt, was zum Baustein passt', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const menue = page.getByRole('menu');

		await material(page).locator('x-uhr').first().click({ button: 'right' });
		await expect(page.locator('[data-auswahl="uhr"]')).toBeVisible();
		await expect(menue.getByRole('menuitem', { name: /Neue Zahlen/ })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(menue).toBeHidden();

		await material(page).locator('.aufgabe').first().locator('.nr').click({ button: 'right' });
		await expect(menue.getByRole('menuitem', { name: /Duplizieren/ })).toBeVisible();
		await expect(menue.getByRole('menuitem', { name: /Neue Zahlen/ })).toHaveCount(0);
		await expect(menue.getByRole('menuitem').last()).toHaveText(/Löschen/);
		expect(await menue.getByRole('menuitem').count()).toBeLessThanOrEqual(12);
	});

	test('Duplizieren aus dem Menü, Rückgängig, die Tastatur bleibt im Blatt', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const aufgaben = material(page).locator('.aufgabe');
		const anzahl = await aufgaben.count();

		await aufgaben.first().locator('.nr').click({ button: 'right' });
		await page.getByRole('menuitem', { name: /Duplizieren/ }).click();
		await expect(aufgaben).toHaveCount(anzahl + 1);
		await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.locator('[data-auswahl="seite"]')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Menü schließt mit Esc, und der Fokus liegt wieder im Blatt', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await material(page).locator('.aufgabe').first().locator('.nr').click({ button: 'right' });
		await expect(page.getByRole('menu')).toBeVisible();
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toBeHidden();
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
		await page.keyboard.press('ArrowDown');
		await expect(page.locator('[data-auswahl="aufgabe"] h2')).toHaveText('Aufgabe 2');
	});

	test('In der Textsitzung bleibt das Browsermenü', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const ziel = material(page).locator('.aufgabe').first().locator('.anw .text');
		await druecke(ziel);
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		const verhindert = await ziel.evaluate((e) => {
			const ereignis = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
			e.dispatchEvent(ereignis);
			return ereignis.defaultPrevented;
		});
		expect(verhindert).toBe(false);
		await expect(page.getByRole('menu')).toHaveCount(0);
	});

	test('Am unteren Rand bleibt es im Sichtfeld, bei „Einpassen“ am Mauszeiger', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(page.getByRole('button', { name: 'Einpassen' }));
		await expect(page.getByRole('button', { name: 'Einpassen' })).toHaveAttribute('aria-pressed', 'true');
		const stelle = material(page).locator('.aufgabe').last().locator('.nr');
		const box = await stelle.boundingBox();
		if (!box) {
			throw new Error('nicht sichtbar');
		}
		await stelle.click({ button: 'right' });
		const menue = page.getByRole('menu');
		await expect(menue).toBeInViewport({ ratio: 1 });
		const m = await menue.boundingBox();
		expect(Math.abs((m?.x ?? 0) - (box.x + box.width / 2))).toBeLessThan(40);
	});

	test('Leere Stelle, Miniatur und Gliederung haben ihr Menü', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const menue = page.getByRole('menu');

		await material(page)
			.locator('.seite')
			.first()
			.click({ button: 'right', position: { x: 4, y: 4 } });
		await expect(menue.getByRole('menuitem', { name: /Baustein einfügen/ })).toBeVisible();
		await expect(menue.getByRole('menuitem', { name: /Löschen/ })).toHaveCount(0);
		await page.keyboard.press('Escape');

		await page.locator('[data-seite-miniatur="1"]').click({ button: 'right' });
		await expect(menue.getByRole('menuitem', { name: /Neue Seite danach/ })).toBeVisible();
		await page.keyboard.press('Escape');

		await druecke(page.getByRole('tab', { name: 'Gliederung' }));
		await page.locator('[data-gliederung-aufgabe]').first().getByRole('button').click({ button: 'right' });
		await expect(menue.getByRole('menuitem', { name: /Nach unten/ })).toBeVisible();
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
	});

	test('Rechtsklick startet keinen Zug', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		await material(page).locator('.aufgabe').first().locator('.nr').click({ button: 'right' });
		await page.keyboard.press('Escape');
		await page.mouse.move(400, 500);
		await expect(page.locator('[data-zug]')).toHaveCount(0);
		expect(await quelle(page)).toBe(vorher);
	});
});
