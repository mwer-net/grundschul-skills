/**
 * Die Leiste am Element (204): ein Bauplan für Bausteine und Gestaltung, ohne Griff; Gesperrtes und Ausgeblendetes
 * bekommen keine; die Pfeile überspringen, was man nicht sieht.
 */
import { writeFile } from 'node:fs/promises';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, FORM } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const leiste = '[data-bausteinleiste], [data-gestaltungsleiste]';

test.describe('Leiste am Element (204)', () => {
	test('204-01: Die Leiste hat keinen Griff; ein Klick auf sie verschiebt nichts', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.aufgabe').nth(1).locator('.nr'));
		const l = page.locator('[data-bausteinleiste="aufgabe"]');
		await expect(l).toBeVisible();
		await expect(l.locator('[data-leiste-griff]')).toHaveCount(0);
		const vorher = await quelle(page);
		const b = await l.boundingBox();
		await page.mouse.click((b?.x ?? 0) + 3, (b?.y ?? 0) + (b?.height ?? 0) / 2);
		expect(await quelle(page)).toBe(vorher);
	});

	test('204-03: Gesperrte und ausgeblendete Elemente haben keine Leiste', async ({ page }) => {
		const u = await uhrzeit();
		const gesperrt = FORM.replace('data-lage="frei"', 'data-lage="frei" data-gesperrt');
		const aus = FORM.replace('data-lage="frei"', 'data-lage="frei" data-aus').replace('--x:610px', '--x:300px');
		await writeFile(u.material, blattMit({ vorne: [gesperrt, aus] }));
		await oeffne(page, u.id, u.dok);
		await oeffneSchublade(page, 'ebenen');
		for (const art of ['gesperrt', 'aus']) {
			await page.locator(`[data-gliederung-zeile][data-${art}] [data-gliederung-titel]`).first().click();
			await expect(page.locator('[data-gestaltung-inspektor]')).toBeVisible();
			await expect(page.locator(leiste)).toHaveCount(0);
		}
	});

	test('204-04: „Nach unten“ an der Namenszeile tauscht mit dem Kopf, nicht mit der Lösungsmarke', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.namenszeile').first());
		await druecke(page.locator('[data-bausteinleiste]').getByRole('button', { name: /Nach unten/ }));
		await expect
			.poll(() =>
				material(page)
					.locator('.kopf')
					.first()
					.evaluate((kopf) => {
						const zeile = kopf.ownerDocument.querySelector('.namenszeile');
						return Boolean(zeile && kopf.compareDocumentPosition(zeile) & Node.DOCUMENT_POSITION_FOLLOWING);
					}),
			)
			.toBe(true);
	});

	test('204-13: Nach einem Mausklick in die Leiste nimmt ein Esc die Auswahl eine Ebene hoch', async ({
		hasTouch,
		page,
	}) => {
		test.skip(hasTouch, 'Esc gibt es nur an der Tastatur');
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await material(page).locator('.aufgabe').nth(1).locator('.nr').click();
		await page.locator('[data-bausteinleiste]').getByRole('button', { name: 'Duplizieren' }).click();
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-auswahl="seite"]')).toBeVisible();
	});

	test('194-18: Eine geleerte Überschrift bleibt eine Zeile hoch und lässt sich anklicken', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const h1 = material(page).locator('h1').first();
		await druecke(h1);
		await druecke(h1);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Delete');
		await page.keyboard.type(' ');
		await page.keyboard.press('Escape');
		await expect.poll(() => quelle(page)).toMatch(/<h1[^>]*><\/h1>/);
		await page.keyboard.press('Escape');
		await page.keyboard.press('Escape');
		const box = await h1.boundingBox();
		expect(box?.height ?? 0).toBeGreaterThan(10);
		await druecke(h1);
		await expect(page.locator('[data-auswahl="ueberschrift"]')).toBeVisible();
	});
});
