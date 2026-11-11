/**
 * Unterrichtseinheit im Assistenten und Warten im Ordner (140). Die Claude-Attrappe (Fälle `einheit`, `einheit-haenger`
 * aus 139) schreibt einen Plan mit zwei Fällen und baut sie nacheinander.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, MATERIAL_DIR, test } from './hilfe';

const kiFall = (name: string) => writeFile(path.join(`${MATERIAL_DIR}-ki`, 'fall.txt'), name);
const dialog = (page: Page) => page.getByRole('dialog');
const schritt = (page: Page, id: string) => dialog(page).locator(`[data-assistent="${id}"]`);
const band = (page: Page) => page.locator('[data-einheit-band]');

/** Von „Material anlegen“ bis „Auftrag prüfen“: nur das Thema eintippen, sonst ⏎. */
const bisPruefen = async (page: Page, thema: string) => {
	await page.locator('[data-werkzeugleiste] [data-material-anlegen]').click();
	await expect(schritt(page, 'start')).toBeVisible();
	await expect(dialog(page).locator('[data-hauptaktion]')).toBeEnabled();
	await page.keyboard.press('Enter');
	await dialog(page).locator('[data-wahl="einheit"]').click();
	await expect(schritt(page, 'fuerWen')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(schritt(page, 'eThema')).toBeVisible();
	await page.keyboard.type(thema);
	for (const id of ['eUmfang', 'eBestandteile', 'eRahmen', 'bausteine', 'klasse', 'pruefen']) {
		await page.keyboard.press('Enter');
		await expect(schritt(page, id)).toBeVisible();
	}
};

test.describe('Unterrichtseinheit (140)', () => {
	test('Mit Thema und ⏎ starten, Band und Platzhalter, fertige Kacheln, Pille, Meldung', async ({ page }) => {
		await kiFall('einheit');
		await page.goto('/');
		await bisPruefen(page, 'Uhrzeit');
		const auftrag = dialog(page).locator('[data-auftrag]');
		await expect(auftrag).toContainText('Unterrichtseinheit');
		await expect(auftrag).toContainText('Lernzielkontrolle');
		await expect(dialog(page).locator('[data-einheit-verbrauch]')).toContainText('Minuten');
		await expect(dialog(page)).not.toContainText('Nur leeres Blatt');
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL(/\/o\//);
		await expect(band(page)).toBeVisible();
		await expect(page.locator('[data-einheit-pille]')).toBeVisible();
		await expect(band(page)).toContainText('von 2 fertig');
		await expect(page.locator('[data-objekt]').filter({ hasText: 'Fall 1' })).toBeVisible();
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'fertig', { timeout: 30_000 });
		await expect(page.locator('[data-objekt]').filter({ hasText: 'Fall 2' })).toBeVisible();
		await expect(page.locator('[data-einheit-platzhalter]')).toHaveCount(0);
		await expect(page.getByText('„Uhrzeit“ ist fertig: 2 Materialien')).toBeVisible();
		await expect(page.locator('[data-einheit-pille]')).toHaveCount(0);

		// Neu laden zeigt denselben Stand.
		await page.reload();
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'fertig');
	});

	test('Freitext „Noch etwas …“ kommt in den Auftrag', async ({ page }) => {
		await kiFall('einheit');
		await page.goto('/');
		await bisPruefen(page, 'Igel');
		await dialog(page).locator('[data-schritt="eBestandteile"]').click();
		await dialog(page).locator('[data-einheit-feld="nochEtwas"]').fill('ein Elternbrief');
		await dialog(page).locator('[data-schritt="pruefen"]').click();
		await expect(dialog(page).locator('[data-auftrag]')).toContainText('ein Elternbrief');
	});

	test('Abbrechen, Weiterbauen, Verwerfen in den Papierkorb; Pille auf anderen Seiten', async ({ page }) => {
		await kiFall('einheit-haenger');
		await page.goto('/');
		await bisPruefen(page, 'Wetter');
		await page.keyboard.press('Enter');
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'laeuft');
		await expect(page.locator('[data-objekt]').filter({ hasText: 'Fall 1' })).toBeVisible();
		await expect(page.locator('[data-einheit-platzhalter] li')).toHaveCount(1);
		const ordner = page.url();

		await page.goto('/hilfe');
		await page.locator('[data-einheit-pille]').click();
		await expect(page).toHaveURL(ordner);

		await band(page).getByRole('button', { name: 'Abbrechen' }).click();
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'unvollstaendig');
		await expect(page.locator('[data-objekt]').filter({ hasText: 'Fall 1' })).toBeVisible();

		await kiFall('einheit');
		await band(page).getByRole('button', { name: 'Weiterbauen' }).click();
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'fertig', { timeout: 30_000 });

		await kiFall('einheit-haenger');
		await bisPruefen(page, 'Wind');
		await page.keyboard.press('Enter');
		await band(page).getByRole('button', { name: 'Abbrechen' }).click();
		await band(page).getByRole('button', { name: 'Verwerfen' }).click();
		await expect(page).toHaveURL(/\/$/);
		await page.goto('/papierkorb');
		await expect(page.getByText('Wind')).toBeVisible();
		const ordnerJson = await readFile(path.join(MATERIAL_DIR, '_ordner.json'), 'utf8');
		expect(ordnerJson).toContain('Wind');
	});
});
