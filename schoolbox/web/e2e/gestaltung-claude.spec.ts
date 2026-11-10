/**
 * Claude schreibt Gestaltung (112, Z11): Ein Vorschlag mit Wilma frei vorne, einem Stern ohne Pfad und einer
 * Sprechblase am Anker der ersten Aufgabe lässt sich annehmen und danach von Hand bearbeiten. Die Claude-Attrappe
 * (`server/src/testhilfe.ts`, Fälle `gestaltung` und `gestaltung-fremd`) schreibt die Vorschläge. Muster: `frei.spec.ts`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { aendere, gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, MATERIAL_DIR, test } from './hilfe';

const MAUS = ['chromium', 'mac-safari'];

const kiFall = (name: string) => writeFile(path.join(`${MATERIAL_DIR}-ki`, 'fall.txt'), name);
const chat = (page: Page) => page.locator('[data-chat]');
const wilma = (page: Page) => material(page).locator('img.figur-frei');
const stern = (page: Page) => material(page).locator('svg.form[data-form="stern"]');
const blase = (page: Page) => material(page).locator('.form-text[data-form="sprechblase"]');
const aufgabe = (page: Page, i: number) => material(page).locator('.aufgabe').nth(i);
const zurueck = (page: Page) => page.getByRole('button', { name: /^Rückgängig/ }).first();

const beauftrage = async (page: Page, text: string) => {
	await page.getByRole('button', { name: 'Claude', exact: true }).click();
	await chat(page).getByLabel('Was soll Claude ändern?').fill(text);
	await chat(page).getByRole('button', { name: 'Senden' }).click();
};

const kasten = async (ziel: Locator) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return b;
};

/** Auftrag, Vergleich, Annehmen: danach liegt der Vorschlag im Blatt und ist gespeichert. */
const nimmGestaltungAn = async (page: Page) => {
	const u = await uhrzeit();
	await kiFall('gestaltung');
	await oeffne(page, u.id, u.dok);
	await beauftrage(
		page,
		'Setz Wilma rechts neben Aufgabe 1, häng ihr eine Sprechblase „Zähl genau!“ an und einen Stern.',
	);
	await expect(chat(page).locator('[data-ki-vorschlag]')).toBeVisible();
	await chat(page).getByRole('button', { name: 'Vergleichen' }).click();
	await expect(page.frameLocator('[data-vorschlag-rahmen]').locator('img.figur-frei')).toBeAttached();
	await page.getByRole('dialog').getByRole('button', { name: 'Annehmen' }).click();
	await expect(wilma(page)).toBeVisible();
	// Was der Editor beim Laden ergänzt (Pfad des Sterns, SVG der Blase), schreibt erst der nächste Schritt (104).
	await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();
	return u;
};

test.describe('Gestaltung von Claude (112)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
	});

	test.afterEach(async () => {
		await kiFall('gut');
	});

	test('Z11: Wilma aus dem Vorschlag ist wählbar und lässt sich ziehen, ein Schritt, ⌘Z stellt her', async ({
		page,
	}) => {
		const { material: datei } = await nimmGestaltungAn(page);
		const stand = await quelle(page);
		expect(stand).toMatch(/<div class="ebene vorne"><img class="figur-frei" data-lage="frei"/);

		await wilma(page).click();
		await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
		const w = await kasten(wilma(page));
		await page.mouse.move(w.x + w.width / 2, w.y + w.height / 2);
		await page.mouse.down();
		await page.mouse.move(w.x + w.width / 2 - 40, w.y + w.height / 2 + 30, { steps: 4 });
		await page.mouse.move(w.x + w.width / 2 - 80, w.y + w.height / 2 + 60, { steps: 4 });
		await page.mouse.up();
		await gespeichert(page, datei);
		const danach = await quelle(page);
		expect(danach).not.toBe(stand);
		expect(/<img class="figur-frei"[^>]*>/.exec(danach)?.[0]).not.toContain('--x:560px');

		await zurueck(page).click();
		await gespeichert(page, datei);
		expect(await quelle(page)).toBe(stand);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});

	test('Der Stern ohne Pfad und die Blase ohne SVG werden beim Öffnen ergänzt; die Blase wandert mit ihrer Aufgabe', async ({
		page,
	}) => {
		await nimmGestaltungAn(page);
		await expect(stern(page).locator('path').first()).toHaveAttribute('d', /^M/);
		await expect(stern(page)).toHaveAttribute('viewBox', /^0 0 /);
		await expect(blase(page).locator('svg path').first()).toHaveAttribute('d', /^M/);
		await expect(aufgabe(page, 0).locator('.form-text[data-anker]')).toHaveCount(1);

		const a1 = await kasten(aufgabe(page, 0));
		const b1 = await kasten(blase(page));
		const davor = await quelle(page);
		await aendere(
			page,
			davor.replace(
				/<div class="aufgabe[" ]/,
				(treffer) =>
					`<div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">Neu.</span></div><div class="koerper" style="height:120px"></div></div>\n  ${treffer}`,
			),
		);
		await expect.poll(async () => (await kasten(aufgabe(page, 1))).y).toBeGreaterThan(a1.y + 100);
		const a2 = await kasten(aufgabe(page, 1));
		const b2 = await kasten(blase(page));
		expect(Math.abs(b2.x - a2.x - (b1.x - a1.x))).toBeLessThanOrEqual(1);
		expect(Math.abs(b2.y - a2.y - (b1.y - a1.y))).toBeLessThanOrEqual(1);
	});

	test('Gegenprobe: foreignObject in einer Ebene führt zu keinem Vorschlag, das Blatt bleibt', async ({ page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await kiFall('gestaltung-fremd');
		await oeffne(page, id, dok);
		await beauftrage(page, 'Leg einen Stern mit Text darin aufs Blatt');
		await expect(chat(page).getByText(/keinen Vorschlag/)).toBeVisible();
		await expect(chat(page).locator('[data-ki-vorschlag]')).toHaveCount(0);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});
});
