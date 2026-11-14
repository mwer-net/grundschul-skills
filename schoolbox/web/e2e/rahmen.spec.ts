/**
 * Rahmen und Grundbausteine (UX-Durchsicht 186, Tickets 187 und 193): Suchfeld im Kopf, Dialog, Käfer und
 * Fehlergrenze. Je Befund der Schwere A ein Test.
 */
import type { Locator, Page } from '@playwright/test';

import { oeffne } from './editorhilfe';
import { expect, legeMappeAn, test, waehleObjekt } from './hilfe';

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

const suchfeld = (page: Page) => page.locator('[data-suchfeld]');
const kaefer = (page: Page) => page.locator('[data-meldeknopf]');

const box = async (ziel: Locator): Promise<Box> => {
	const b = await ziel.boundingBox();
	expect(b).not.toBeNull();
	return b as Box;
};

const schneiden = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('Suchfeld im Kopf (187-01)', () => {
	for (const start of ['/', '/hilfe']) {
		for (const delay of [30, 60, 100]) {
			test(`von ${start}, ${delay} ms je Taste: kein Buchstabe geht verloren`, async ({ page }) => {
				await page.goto(start);
				await suchfeld(page).click();
				await page.keyboard.type('kartoffel', { delay });
				await expect(suchfeld(page)).toHaveValue('kartoffel');
				await expect(page).toHaveURL(/\/suche\?q=kartoffel$/);
			});
		}
	}

	test('ein Zeichen in der Wortmitte bleibt an seiner Stelle, die Marke dahinter', async ({ page }) => {
		await page.goto('/');
		await suchfeld(page).click();
		await page.keyboard.type('igel', { delay: 30 });
		await expect(page).toHaveURL(/q=igel$/);
		await page.keyboard.press('Home');
		await page.keyboard.type('xy', { delay: 30 });
		await expect(suchfeld(page)).toHaveValue('xyigel');
		expect(await suchfeld(page).evaluate((e: HTMLInputElement) => e.selectionStart)).toBe(2);
	});

	test('Zurück im Browser füllt das Feld passend zur Adresse; Esc leert und verlässt die Suche (189-05)', async ({
		page,
	}) => {
		await page.goto('/');
		await suchfeld(page).click();
		await page.keyboard.type('igel', { delay: 30 });
		await expect(page).toHaveURL(/q=igel$/);
		await suchfeld(page).blur();
		await page.goBack();
		await expect(page).toHaveURL(/\/$/);
		await expect(suchfeld(page)).toHaveValue('');
		await page.goForward();
		await expect(suchfeld(page)).toHaveValue('igel');
		await suchfeld(page).click();
		await page.keyboard.press('Escape');
		await expect(suchfeld(page)).toHaveValue('');
		await expect(page).not.toHaveURL(/\/suche/);
	});
});

test.describe('Dialog (187-02)', () => {
	test('Markieren, das neben dem Fenster endet, schließt nichts; Drücken und Loslassen daneben schließt', async ({
		page,
	}) => {
		await legeMappeAn('Die Kartoffel', 'sachunterricht', 3, [{ titel: 'Teile der Kartoffel' }]);
		await page.goto('/');
		await waehleObjekt(page, 'Die Kartoffel');
		await page.keyboard.press('ControlOrMeta+i');
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		const fenster = await box(dialog);
		const titel = await box(dialog.getByRole('heading').first());
		await page.mouse.move(titel.x + titel.width - 2, titel.y + titel.height / 2);
		await page.mouse.down();
		await page.mouse.move(fenster.x - 40, titel.y + titel.height / 2, { steps: 8 });
		await page.mouse.up();
		await expect(dialog).toBeVisible();

		await page.mouse.click(fenster.x - 40, fenster.y + fenster.height + 20);
		await expect(dialog).toHaveCount(0);
	});
});

test.describe('Käfer (193-27)', () => {
	test('liegt im Editor über keiner Taste der Statusleiste und der Schubladenleiste', async ({ page }) => {
		const mappe = await legeMappeAn('Uhrzeit', 'mathematik', 2, [{ titel: 'Volle Stunden' }]);
		await oeffne(page, mappe.id, mappe.dokumente[0] ?? '');
		const k = await box(kaefer(page));
		for (const knopf of await page.locator('[data-statusleiste] button').all()) {
			if (await knopf.isVisible()) {
				expect(schneiden(k, await box(knopf)), (await knopf.getAttribute('aria-label')) ?? '').toBe(false);
			}
		}
		// Ein Klick auf den Anfang der Statusleiste startet keine Auswahl des Käfers.
		await page.locator('[data-seite-von]').click();
		await expect(page.getByRole('dialog', { name: 'Bereich für die Meldung wählen' })).toHaveCount(0);
	});

	test('liegt in der Ablage unter „Papierkorb“, nicht darauf', async ({ page }) => {
		await page.goto('/');
		const k = await box(kaefer(page));
		const papierkorb = await box(page.locator('[data-ablage-ziel="papierkorb"]'));
		expect(schneiden(k, papierkorb)).toBe(false);
		expect(papierkorb.y + papierkorb.height).toBeLessThanOrEqual(k.y);
	});
});

test.describe('Fehlergrenze (193-29)', () => {
	test('ein Fehler beim Zeichnen zeigt „Neu laden“ statt eines weißen Fensters, der Käfer bleibt', async ({
		page,
	}) => {
		// Kaputte Daten der Ablage lassen das Zeichnen scheitern.
		await page.route('**/api/ordner', (anfrage) =>
			anfrage.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({ rev: 1, ordner: null, dokumente: null, defekt: [], geteilt: null }),
			}),
		);
		await page.goto('/');
		await expect(page.locator('[data-fehlergrenze]')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Da ist etwas schiefgegangen' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Neu laden' })).toBeVisible();
		await expect(kaefer(page)).toBeVisible();
	});
});
