import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { oeffne, uhrzeit } from './editorhilfe';
import { dokumentOrdner, expect, MATERIAL_DIR, test } from './hilfe';

const fall = (name: string) => writeFile(path.join(`${MATERIAL_DIR}-ki`, 'fall.txt'), name);
const panel = (page: Page) => page.locator('[data-chat]');
const oeffnePanel = (page: Page) => page.getByRole('button', { name: 'Claude', exact: true }).click();
const quelleAufPlatte = (mappe: string, dok: string) =>
	readFile(path.join(dokumentOrdner(mappe, dok), 'material.html'), 'utf8');

const beauftrage = async (page: Page, text = 'Mach es schöner') => {
	await panel(page).getByLabel('Was soll Claude ändern?').fill(text);
	await panel(page).getByRole('button', { name: 'Senden' }).click();
	await expect(panel(page).locator('[data-ki-vorschlag]')).toBeVisible();
};

const startSchritt = async (page: Page, mappe: string) => {
	await page.goto(`/m/${mappe}`);
	await page.getByRole('button', { name: 'Material anlegen' }).click();
	await page.getByRole('button', { name: 'Weiter', exact: true }).click();
	await page.getByRole('button', { name: 'Weiter', exact: true }).click();
	await page.getByRole('textbox', { name: 'Titel' }).fill('Igel');
	await page.getByRole('button', { name: 'Weiter', exact: true }).click();
};

test.describe('Assistent: Mit Claude (060)', () => {
	test.afterEach(() => fall('gut'));

	test('Aus einem Satz wird ein Vorschlag im Editor', async ({ page }) => {
		const { id: mappe } = await uhrzeit();
		await startSchritt(page, mappe);
		await page.locator('[data-wahl="mit-claude"]').click();
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByText('Bitte schreib, worum es geht.')).toBeVisible();
		await page.getByLabel('Worum geht es').fill('Igel im Herbst');
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page).toHaveURL(/bearbeiten\?claude=1/);
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeVisible();
		await panel(page).getByRole('button', { name: 'Vergleichen' }).click();
		await page.getByRole('button', { name: 'Annehmen' }).click();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeHidden();
		const dok = new URL(page.url()).pathname.split('/')[3] ?? '';
		await expect.poll(() => quelleAufPlatte(mappe, dok)).toContain('von Claude');
	});

	test('Ohne angemeldetes claude fehlt die Option', async ({ page }) => {
		await page.route('**/api/ki/status', (r) =>
			r.fulfill({ json: { verfuegbar: false, limit: null, warnAb: 1, aktionen: [] } }),
		);
		const { id: mappe } = await uhrzeit();
		await startSchritt(page, mappe);
		await expect(page.locator('[data-wahl="leer"]')).toBeVisible();
		await expect(page.locator('[data-wahl="mit-claude"]')).toHaveCount(0);
	});
});

test.describe('Editor: Mit Claude ändern (058, 059)', () => {
	test.afterEach(() => fall('gut'));

	test('Auftrag, Vorschlag vergleichen, annehmen: genau dann ändert sich die Quelle', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		const vorher = await quelleAufPlatte(mappe, dok);
		await oeffnePanel(page);
		await expect(panel(page).getByText('Keine Namen von Kindern eintragen.')).toBeVisible();
		await beauftrage(page);
		await expect(panel(page).getByText('Annahme: Klasse 2')).toBeVisible();
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);

		await panel(page).getByRole('button', { name: 'Vergleichen' }).click();
		const rahmen = page.frameLocator('[data-vorschlag-rahmen]');
		await expect(rahmen.locator('h1').first()).toContainText('von Claude');
		await expect(rahmen.locator('[data-ki-geaendert]').first()).toBeVisible();
		// Das ganze Blatt ist in der Breite zu sehen, nichts ragt aus dem Rahmen
		await expect
			.poll(() => rahmen.locator('html').evaluate((el) => el.scrollWidth <= window.innerWidth + 1))
			.toBe(true);
		await page.getByRole('button', { name: 'Annehmen' }).click();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeHidden();
		await expect.poll(() => quelleAufPlatte(mappe, dok)).toContain('von Claude');
	});

	test('Verwerfen lässt die Quelle byteidentisch', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		const vorher = await quelleAufPlatte(mappe, dok);
		await oeffnePanel(page);
		await beauftrage(page);
		await panel(page).locator('[data-ki-vorschlag]').getByRole('button', { name: 'Verwerfen' }).click();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeHidden();
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);
	});

	test('Fortschritt und Abbrechen', async ({ page }) => {
		await fall('haenger');
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		await panel(page).getByLabel('Was soll Claude ändern?').fill('Dauert');
		await panel(page).getByRole('button', { name: 'Senden' }).click();
		const lauf = panel(page).locator('[data-ki-lauf]');
		await expect(lauf.getByText('Ändert das Blatt')).toBeVisible();
		await lauf.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(lauf).toBeHidden();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeHidden();
	});

	test('Aktionen passen zum gewählten Teil, Nachbessern arbeitet am Vorschlag', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		const aktionen = panel(page).locator('[data-ki-aktionen]');
		await panel(page).getByRole('button', { name: 'Worauf bezieht sich der Auftrag?' }).click();
		await expect(page.getByRole('menuitem').getByText('verbraucht deutlich mehr')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(aktionen.getByRole('button', { name: 'Drei Niveaus' })).toBeVisible();
		await expect(aktionen.getByRole('button', { name: 'Baustein füllen' })).toBeHidden();
		await aktionen.getByRole('button', { name: 'Leichter' }).click();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeVisible();
		await expect(panel(page).locator('[data-chat-nachricht="lehrkraft"]').getByText('Leichter')).toBeVisible();

		await panel(page).getByRole('button', { name: 'Vergleichen' }).click();
		await page.getByRole('button', { name: 'Nachbessern' }).click();
		await panel(page).getByLabel('Was soll Claude am Vorschlag ändern?').fill('Noch etwas');
		await panel(page).getByRole('button', { name: 'Senden' }).click();
		await expect(panel(page).locator('[data-chat-nachricht="lehrkraft"]').getByText('Noch etwas')).toBeVisible();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeVisible();
	});

	test('Geändertes Blatt: Der Vorschlag lässt sich nicht annehmen', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		await beauftrage(page);
		const datei = path.join(dokumentOrdner(mappe, dok), 'material.html');
		await writeFile(datei, (await readFile(datei, 'utf8')).replace('</h1>', ' Eigenes</h1>'));
		await page.reload();
		// Das Fenster startet nach dem Neuladen zu (087); der Vorschlag wartet in der Statusleiste.
		await expect(panel(page)).toHaveCount(0);
		await oeffnePanel(page);
		await expect(panel(page).getByRole('alert')).toContainText('seit dem Auftrag geändert');
		await expect(panel(page).getByRole('button', { name: 'Vergleichen' })).toHaveCount(0);
		await expect(panel(page).getByRole('button', { name: 'Neu starten' })).toBeVisible();
	});

	test('Limit: Hinweis davor, gesperrt danach', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		const antwort = (status: string, auslastung: number) => ({
			verfuegbar: true,
			warnAb: 0.8,
			aktionen: [],
			limit: {
				status,
				zurueck: '2030-03-17T18:00:00.000Z',
				guthaben: status === 'rejected' ? 'abgelehnt' : null,
				laeuftUeberGuthaben: false,
				fensterArt: 'fuenfStunden',
				fenster: { fuenfStunden: { auslastung, zurueck: null }, sieben: { auslastung: 0.1, zurueck: null } },
			},
		});
		await page.route('**/api/ki/status', (r) => r.fulfill({ json: antwort('allowed', 0.85) }));
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		await expect(panel(page).locator('[data-ki-limit="warnung"]')).toContainText('85 %');
		await expect(panel(page).locator('[data-ki-limit="warnung"]')).toContainText('Claude-App');

		await page.unroute('**/api/ki/status');
		await page.route('**/api/ki/status', (r) => r.fulfill({ json: antwort('rejected', 1) }));
		await page.reload();
		await oeffnePanel(page);
		await expect(panel(page).locator('[data-ki-limit="gesperrt"]')).toContainText('Wieder möglich ab');
		await panel(page).getByLabel('Was soll Claude ändern?').fill('Geht nicht');
		await expect(panel(page).getByRole('button', { name: 'Senden' })).toBeDisabled();
	});

	test('Ohne angemeldetes claude bleibt nur der Weg über die Claude-App', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await page.route('**/api/ki/status', (r) =>
			r.fulfill({ json: { verfuegbar: false, limit: null, warnAb: 1, aktionen: [] } }),
		);
		await oeffne(page, mappe, dok);
		await expect(page.getByRole('tab', { name: 'Gliederung' })).toBeVisible();
		await oeffnePanel(page);
		await expect(panel(page).locator('#ki-auftrag')).toHaveCount(0);
		await expect(panel(page).getByRole('button', { name: 'In der Claude-App weiterarbeiten' })).toBeVisible();
	});

	test('Knöpfe im Chat sind groß genug für den Finger', async ({ hasTouch, page }) => {
		test.skip(!hasTouch, 'nur mit dem Finger');
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		const knoepfe = panel(page).getByRole('button');
		for (let i = 0; i < (await knoepfe.count()); i += 1) {
			const box = await knoepfe.nth(i).boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
		}
	});
});
