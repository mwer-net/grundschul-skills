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

/** Von „Material anlegen“ bis zum letzten Schritt „Deine Klasse“: nur das Thema eintippen, sonst ⏎ (190-37). */
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
	for (const id of ['eUmfang', 'eBestandteile', 'eRahmen', 'bausteine', 'klasse']) {
		await page.keyboard.press('Enter');
		await expect(schritt(page, id)).toBeVisible();
	}
};

/** Der Plan steht im Band; gebaut wird erst nach „So bauen“. */
const gibFrei = async (page: Page) => {
	await expect(band(page)).toHaveAttribute('data-einheit-band', 'plan');
	await expect(band(page).locator('[data-einheit-plan]')).toContainText('Zwei Fälle');
	await band(page).getByRole('button', { name: 'So bauen' }).click();
};

test.describe('Unterrichtseinheit (140)', () => {
	test('Mit Thema und ⏎ starten, Band und Platzhalter, fertige Kacheln, Pille, Meldung', async ({ page }) => {
		await kiFall('einheit');
		await page.goto('/');
		await bisPruefen(page, 'Uhrzeit');
		await expect(dialog(page).locator('[data-einheit-verbrauch]')).toContainText('Minuten');
		await expect(dialog(page).locator('[data-hauptaktion]')).toHaveText('Plan holen');
		await expect(dialog(page)).not.toContainText('leeres Blatt');
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL(/\/o\//);
		await expect(band(page)).toBeVisible();
		await expect(page.locator('[data-einheit-pille]')).toBeVisible();
		await gibFrei(page);
		await expect(band(page)).toContainText('von 2 fertig');
		await expect(page.locator('[data-objekt]').filter({ hasText: 'Fall 1' })).toBeVisible();
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'fertig', { timeout: 30_000 });
		await expect(page.locator('[data-objekt]').filter({ hasText: 'Fall 2' })).toBeVisible();
		await expect(page.locator('[data-einheit-platzhalter]')).toHaveCount(0);
		// Im offenen Ordner sagt das Band es schon: keine Meldung mit „Öffnen“ (190-29).
		await expect(page.getByText('„Uhrzeit“ ist fertig: 2 Materialien')).toHaveCount(0);
		await expect(page.locator('[data-einheit-pille]')).toHaveCount(0);

		// Neu laden zeigt denselben Stand; × schließt das Band für immer (190-42).
		await page.reload();
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'fertig');
		await band(page).getByRole('button', { name: 'Schließen' }).click();
		await expect(band(page)).toHaveCount(0);
		await page.reload();
		await expect(page.locator('[data-objekt]').filter({ hasText: 'Fall 2' })).toBeVisible();
		await expect(band(page)).toHaveCount(0);
	});

	test('Freitext „Noch etwas …“ kommt in den Auftrag', async ({ page }) => {
		await kiFall('einheit');
		await page.goto('/');
		await bisPruefen(page, 'Igel');
		await dialog(page).locator('[data-schritt="eBestandteile"]').click();
		await dialog(page).locator('[data-einheit-feld="nochEtwas"]').fill('ein Elternbrief');
		await dialog(page).locator('[data-schritt="klasse"]').click();
		await page.keyboard.press('Meta+Enter');
		await expect(band(page).locator('details', { hasText: 'Auftrag' })).toContainText('ein Elternbrief');
	});

	test('Doppelklick auf „So bauen“ startet einen Bau (190-32)', async ({ page }) => {
		await kiFall('einheit');
		await page.goto('/');
		await bisPruefen(page, 'Herbst');
		await page.keyboard.press('Enter');
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'plan');
		const freigaben: string[] = [];
		page.on('request', (r) => {
			if (r.method() === 'POST' && r.url().endsWith('/freigeben')) {
				freigaben.push(r.url());
			}
		});
		await band(page).locator('[data-plan-freigeben]').dblclick();
		await expect(band(page)).toHaveAttribute('data-einheit-band', /laeuft|fertig/);
		await expect(page.getByRole('status').filter({ hasText: 'arbeitet schon' })).toHaveCount(0);
		// Die Sperre greift schon im Klick: Der Server sieht genau eine Freigabe.
		expect(freigaben).toHaveLength(1);
	});

	test('Abbrechen, Weiterbauen, Verwerfen in den Papierkorb; Pille auf anderen Seiten', async ({ page }) => {
		await kiFall('einheit-haenger');
		await page.goto('/');
		await bisPruefen(page, 'Wetter');
		await page.keyboard.press('Enter');
		await gibFrei(page);
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
		await gibFrei(page);
		await band(page).getByRole('button', { name: 'Abbrechen' }).click();
		await band(page).getByRole('button', { name: 'Verwerfen' }).click();
		// Ohne Rückfrage in den Ordner darüber, mit „Rückgängig“ wie in der Ablage (190-30).
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByText('Ordner „Wind“ in den Papierkorb gelegt.')).toBeVisible();
		await page.goto('/papierkorb');
		await expect(page.getByText('Wind')).toBeVisible();
		const ordnerJson = await readFile(path.join(MATERIAL_DIR, '_ordner.json'), 'utf8');
		expect(ordnerJson).toContain('Wind');
	});

	test('Verwerfen am Plan lässt sich rückgängig machen (190-30)', async ({ page }) => {
		await kiFall('einheit');
		await page.goto('/');
		await bisPruefen(page, 'Regen');
		await page.keyboard.press('Enter');
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'plan');
		await band(page).locator('[data-plan-verwerfen]').click();
		await expect(page).toHaveURL(/\/$/);
		await page.getByRole('button', { name: 'Rückgängig' }).click();
		await expect(page).toHaveURL(/\/o\//);
		await expect(band(page)).toHaveAttribute('data-einheit-band', 'plan');
	});
});
