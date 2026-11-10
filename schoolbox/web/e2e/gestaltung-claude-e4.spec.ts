/**
 * Claude schreibt Gruppen und Pfade (124, E4): Eine Gruppe aus Wilma und Sprechblase lässt sich nach dem Annehmen wie
 * eine eigene lösen, ein Pfad mit relativen Befehlen und Bogen wie ein eigener bearbeiten. Die Claude-Attrappe
 * (`server/src/testhilfe.ts`, Fälle `gruppe` und `pfad`) schreibt die Vorschläge. Muster: `gestaltung-claude.spec.ts`.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, MATERIAL_DIR, test } from './hilfe';

const MAUS = ['chromium', 'mac-safari'];

const kiFall = (name: string) => writeFile(path.join(`${MATERIAL_DIR}-ki`, 'fall.txt'), name);
const chat = (page: Page) => page.locator('[data-chat]');
const gruppe = (page: Page) => material(page).locator('.gruppe');
const pfad = (page: Page) => material(page).locator('svg.form[data-form="pfad"]');

/** Auftrag, Vergleich, Annehmen: danach liegt der Vorschlag im Blatt und ist gespeichert. */
const nimmAn = async (page: Page, fall: string, auftrag: string, angenommen: (page: Page) => Locator) => {
	const u = await uhrzeit();
	await kiFall(fall);
	await oeffne(page, u.id, u.dok);
	await page.getByRole('button', { name: 'Claude', exact: true }).click();
	await chat(page).getByLabel('Was soll Claude ändern?').fill(auftrag);
	await chat(page).getByRole('button', { name: 'Senden' }).click();
	await expect(chat(page).locator('[data-ki-vorschlag]')).toBeVisible();
	await chat(page).getByRole('button', { name: 'Vergleichen' }).click();
	await expect(page.frameLocator('[data-vorschlag-rahmen]').locator('[data-form]').first()).toBeAttached();
	await page.getByRole('dialog').getByRole('button', { name: 'Annehmen' }).click();
	await expect(angenommen(page)).toHaveCount(1);
	// Die Blase ohne SVG ergänzt der Editor beim Laden; geschrieben wird das erst mit dem nächsten Schritt (104).
	await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();
	await geladen(page);
	return u;
};

test.describe('Gruppen und Pfade von Claude (124)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
	});

	test.afterEach(async () => {
		await kiFall('gut');
	});

	test('Die Gruppe von Claude ist wählbar, ⇧⌘G löst sie, die Teile bleiben, ⌘Z stellt her', async ({ page }) => {
		await nimmAn(
			page,
			'gruppe',
			'Stell Wilma mit einer Sprechblase „Zähl genau!“ als Gruppe unten aufs Blatt.',
			gruppe,
		);
		await expect(gruppe(page)).toHaveCount(1);
		const stand = await quelle(page);
		await gruppe(page).locator('img.figur-frei').click();
		await expect(page.locator('[data-gruppe-teile]')).toContainText('2 Teile');
		await page.keyboard.press('ControlOrMeta+Shift+g');
		await expect(gruppe(page)).toHaveCount(0);
		await expect(material(page).locator('img.figur-frei')).toHaveCount(1);
		await expect(material(page).locator('.form-text[data-form="sprechblase"]')).toHaveCount(1);
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(stand);
	});

	test('Der Pfad von Claude: Doppelklick zeigt die Punkte, Ziehen schreibt ihn neu, ⌘Z stellt her', async ({
		page,
	}) => {
		await nimmAn(page, 'pfad', 'Zeichne eine Wolke als eigene Form.', pfad);
		await expect(pfad(page)).toHaveCount(1);
		const stand = await quelle(page);
		expect(stand).toContain(' a40');
		await pfad(page).click();
		await pfad(page).dblclick();
		await expect(page.locator('[data-pfad-punkt]')).toHaveCount(3);
		const b = await page.locator('[data-pfad-punkt="1"]').boundingBox();
		if (!b) {
			throw new Error('Punkt fehlt');
		}
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
		await page.mouse.down();
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 30, { steps: 5 });
		await page.mouse.up();
		await expect.poll(() => quelle(page)).not.toBe(stand);
		expect(await quelle(page)).not.toContain(' a40');
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(stand);
	});
});
