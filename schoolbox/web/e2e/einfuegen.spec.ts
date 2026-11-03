import type { Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const wartePlus = (page: Page) => expect(page.locator('[data-einfuegen-plus]')).toBeVisible();

test.describe('Editor: Bausteine einfügen', () => {
	test('Bibliothek: Klick fügt ein, ein Schritt in Rückgängig, Rest unverändert', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		await page.getByRole('button', { name: 'Bausteine' }).click();
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Uhr');
		await page.locator('[data-einfuegen="x-uhr"]').click();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Plus unter dem gewählten Baustein öffnet die Schnellauswahl', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.aufgabe').first());
		await wartePlus(page);
		await page.locator('[data-einfuegen-plus]').click();
		const fenster = page.locator('[data-schnellauswahl]');
		await fenster.getByRole('searchbox').fill('Schreiblinie');
		await fenster.locator('[data-katalog-eintrag="schreiblinie"]').click();
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
	});

	test('Ziehen aus der Bibliothek legt an der Stelle unter dem Zeiger ab', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.getByRole('button', { name: 'Bausteine' }).click();
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Notiz');
		const griff = await page.locator('[data-ziehgriff="notiz"]').boundingBox();
		const ziel = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
		if (!griff || !ziel) {
			throw new Error('nicht zu sehen');
		}
		await page.mouse.move(griff.x + 20, griff.y + 20);
		await page.mouse.down();
		await page.mouse.move(ziel.x + ziel.width / 2, ziel.y + 300, { steps: 5 });
		await page.mouse.up();
		await expect.poll(() => quelle(page)).toContain('notiz');
	});

	test('Ziehen mit dem Finger (Pointer-Ereignisse mit Touch)', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.getByRole('button', { name: 'Bausteine' }).click();
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Notiz');
		const griff = page.locator('[data-ziehgriff="notiz"]');
		const ziel = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
		if (!ziel) {
			throw new Error('nicht zu sehen');
		}
		const punkt = { pointerType: 'touch', pointerId: 7, bubbles: true };
		await griff.dispatchEvent('pointerdown', { ...punkt, clientX: 0, clientY: 0 });
		await griff.dispatchEvent('pointermove', { ...punkt, clientX: ziel.x + ziel.width / 2, clientY: ziel.y + 300 });
		await griff.dispatchEvent('pointerup', { ...punkt, clientX: ziel.x + ziel.width / 2, clientY: ziel.y + 300 });
		await expect.poll(() => quelle(page)).toContain('notiz');
	});

	test('Slash: / allein in einer Zeile öffnet das Menü, Esc lässt den Text stehen, mitten im Text nichts', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const text = material(page).locator('.aufgabe .anw .text').first();
		await druecke(text);
		await druecke(text);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.press('End');
		await page.keyboard.type('1/2');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Delete');
		await page.keyboard.type('/');
		await expect(page.locator('[data-slash-menue]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
		await expect(text).toHaveText('/');
		await page.keyboard.type('uhr');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
	});

	test('Slash: Weitertippen filtert, Enter fügt ein', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const text = material(page).locator('.aufgabe .anw .text').first();
		await druecke(text);
		await druecke(text);
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Delete');
		await page.keyboard.type('/schreiblin');
		await expect(page.locator('[data-slash-menue] [data-katalog-eintrag]').first()).toContainText('Schreib');
		await page.keyboard.press('Enter');
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
	});

	test('Überlauf: Die Meldung bietet das Verschieben an, danach passt alles', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const anweisung = material(page).locator('.aufgabe').nth(2).locator('.anw .text');
		await druecke(anweisung);
		await druecke(anweisung);
		await page.keyboard.press('End');
		await page.keyboard.insertText(' Und dann noch ein Satz, der immer weiter geht.'.repeat(20));
		await material(page).locator('.kopf').first().click();
		const summe = page.locator('[data-pruefung] > button');
		await expect(page.locator('[data-pruefung="fehler"]')).toBeVisible();
		await summe.click();
		await page.locator('[data-ueberlauf-verschieben]').first().click();
		await expect(page.locator('[data-pruefung="ok"]')).toBeVisible();
		await expect(material(page).locator('.seite')).toHaveCount(2);
	});

	test('Gliederung: Klick springt, Pfeile ordnen', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		await page.getByRole('button', { name: 'Gliederung' }).click();
		const zeilen = page.locator('[data-gliederung-aufgabe]');
		await zeilen.nth(0).getByRole('button', { name: 'Nach unten' }).click();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
	});
});
