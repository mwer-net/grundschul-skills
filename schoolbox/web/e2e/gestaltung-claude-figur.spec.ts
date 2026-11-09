/**
 * Claude-Elemente frei legen und „Figur von Claude zeichnen lassen“ (117). Ein freies Element aus 088 kommt über ⋯
 * „Frei legen“ an derselben Stelle nach vorne und behält `data-frei`. Das Feld unten in der Figuren-Schublade schickt
 * einen Auftrag mit festem Vorsatz und der richtigen Seite ab; die Claude-Attrappe (Fall `figur`) zeichnet eine Eule.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { gespeichert, imMehr, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, MATERIAL_DIR, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const KI = `${MATERIAL_DIR}-ki`;
const kiFall = (name: string) => writeFile(path.join(KI, 'fall.txt'), name);
const chat = (page: Page) => page.locator('[data-chat]');
const zurueck = (page: Page) => page.getByRole('button', { name: /^Rückgängig/ }).first();

const TANGRAM =
	'<figure data-frei data-frei-titel="Tangram Waschbär"><svg viewBox="0 0 100 100" width="100%"><polygon points="0,0 100,0 50,50" fill="none" stroke="#000" stroke-width="2"/></svg><figcaption>Lege den Waschbären.</figcaption></figure>';

const blatt = async (page: Page, html: string) => {
	const u = await uhrzeit();
	await writeFile(u.material, html);
	await oeffne(page, u.id, u.dok);
	return u;
};

const gegenSeite = async (page: Page, ziel: Locator) => {
	const e = await ziel.boundingBox();
	const s = await material(page).locator('.seite').first().boundingBox();
	if (!e || !s) {
		throw new Error('nicht sichtbar');
	}
	return { x: e.x - s.x, y: e.y - s.y, b: e.width };
};

const feld = (page: Page) => page.locator('[data-figur-von-claude] input');
const eule = (page: Page) => material(page).locator('svg[data-frei-titel="Eule mit Brille"]');

test.describe('Claude-Elemente frei legen und Figur von Claude (117)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
	});

	test.afterEach(async () => {
		await kiFall('gut');
	});

	test('Frei legen über ⋯: dieselbe Stelle, data-frei bleibt, wählbar mit Drehgriff, Name in den Ebenen, ⌘Z', async ({
		page,
	}) => {
		const u = await blatt(page, blattMit({ stapel: [TANGRAM] }));
		const stand = await quelle(page);
		const element = material(page).locator('figure[data-frei]');
		await element.evaluate((e) => e.scrollIntoView({ block: 'center' }));
		// Gegen die Seite gemessen: Wird das Element aus dem Stapel genommen, wird die Seite kürzer und das Blatt rollt.
		const vorher = await gegenSeite(page, element);
		await element.click();
		await imMehr(page, 'Frei legen');
		await expect.poll(() => quelle(page)).toMatch(/<div class="ebene vorne">\s*<figure data-frei data-frei-titel="Tangram Waschbär"[^>]*data-lage="frei"/);
		const nachher = await gegenSeite(page, material(page).locator('figure[data-frei][data-lage="frei"]'));
		expect(Math.abs(nachher.x - vorher.x)).toBeLessThan(2);
		expect(Math.abs(nachher.y - vorher.y)).toBeLessThan(2);
		expect(Math.abs(nachher.b - vorher.b)).toBeLessThan(2);
		await expect(page.locator('[data-gestaltung-griff="drehen"]')).toBeVisible();

		await oeffneSchublade(page, 'ebenen');
		await expect(page.locator('[data-zeilen-art="vorne"]').filter({ hasText: 'Tangram Waschbär' })).toHaveCount(1);

		await zurueck(page).click();
		await gespeichert(page, u.material);
		expect(await quelle(page)).toBe(stand);
	});

	const zeichneEule = async (page: Page, waehle?: (page: Page) => Promise<void>) => {
		const u = await uhrzeit();
		await kiFall('figur');
		await oeffne(page, u.id, u.dok);
		await waehle?.(page);
		const prompts = path.join(KI, 'prompts.txt');
		await writeFile(prompts, '');
		await oeffneSchublade(page, 'figuren');
		await feld(page).fill('eine Eule mit Brille');
		await feld(page).press('Enter');
		await expect(chat(page).locator('[data-ki-vorschlag]')).toBeVisible();
		const auftrag = await readFile(prompts, 'utf8');
		expect(auftrag).toContain('Neue Figur als neues Gestaltungselement auf Seite 1, frei in `.ebene.vorne`');
		expect(auftrag).toContain('eine Eule mit Brille');
		await expect(feld(page)).toHaveValue('');
		return u;
	};

	test('Figur von Claude: Auftrag mit Vorsatz und Seite, Vorschlag annehmen, die Eule liegt vorne und ist gewählt', async ({
		page,
	}) => {
		const u = await zeichneEule(page);
		await chat(page).getByRole('button', { name: 'Vergleichen' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Annehmen' }).click();
		await expect(eule(page)).toBeVisible();
		await gespeichert(page, u.material);
		expect(await quelle(page)).toMatch(/<div class="ebene vorne"><svg data-frei data-frei-titel="Eule mit Brille" data-lage="frei"/);
		await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
		await expect(page.locator('[data-gestaltung-griff="drehen"]')).toBeVisible();
	});

	test('Figur von Claude mit gewählter Aufgabe: die Aufgabe bleibt unverändert', async ({ page }) => {
		let aufgabe = '';
		const u = await zeichneEule(page, async (p) => {
			const erste = material(p).locator('.aufgabe').first();
			aufgabe = (await erste.textContent()) ?? '';
			await erste.click();
		});
		await chat(page).getByRole('button', { name: 'Vergleichen' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Annehmen' }).click();
		await expect(eule(page)).toBeVisible();
		await gespeichert(page, u.material);
		expect(await material(page).locator('.aufgabe').first().textContent()).toBe(aufgabe);
		expect(await quelle(page)).not.toContain('Eule mit Brille</');
	});

	test('Ein offener Vorschlag sperrt das Feld: Es nennt den Grund und behält den Text', async ({ page }) => {
		await zeichneEule(page);
		await feld(page).fill('ein Fuchs');
		await feld(page).press('Enter');
		await expect(page.locator('[data-figur-grund]')).toContainText('offenen Vorschlag');
		await expect(feld(page)).toHaveValue('ein Fuchs');
	});
});
