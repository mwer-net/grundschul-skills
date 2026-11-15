import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, MATERIAL_DIR, objekt, oeffneObjekt, test } from './hilfe';

// Nur Mappen zählen: `_ordner.json` und andere Verwaltungsdateien schreibt der Server nach Bedarf neu.
const mappenzahl = async () => (await readdir(MATERIAL_DIR)).filter((n) => !n.startsWith('_')).length;

const neuerOrdner = async (page: Page, name: string) => {
	await page.locator('[data-werkzeugleiste] [data-neuer-ordner]').click();
	await expect(page.locator('[data-namensfeld] input')).toBeFocused();
	await page.keyboard.type(name);
	await page.keyboard.press('Enter');
	await expect(objekt(page, name)).toBeVisible();
	await oeffneObjekt(page, name);
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
};

const dialog = (page: Page) => page.getByRole('dialog');
const schritt = (page: Page, id: string) => dialog(page).locator(`[data-assistent="${id}"]`);
const leiste = (page: Page, id: string) => dialog(page).locator(`[data-schritt="${id}"]`);

/** Öffnet den Assistenten und wartet, bis feststeht, ob es Claude gibt. */
const oeffneAssistent = async (page: Page) => {
	await page.locator('[data-werkzeugleiste] [data-material-anlegen]').click();
	await expect(schritt(page, 'start')).toBeVisible();
	await expect(dialog(page).locator('[data-hauptaktion]')).toBeEnabled();
};

const imEditor = async (page: Page) => {
	await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
	const [, , mappe = '', dok = ''] = new URL(page.url()).pathname.split('/');
	return { mappe, dok, dir: path.join(MATERIAL_DIR, mappe, 'dokumente', dok) };
};

const metaVon = async (dir: string) =>
	JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8')) as { titel: string; art: string; format: string };

test.describe('Anlegen ohne Claude', () => {
	test('Von „Mein Material“ zum Arbeitsblatt: Ordner, Assistent, Baustein', async ({ page }) => {
		await page.goto('/');
		await neuerOrdner(page, `Testordner ${Date.now()}`);

		await oeffneAssistent(page);
		await expect(dialog(page)).not.toContainText('Farbe');
		await dialog(page).locator('[data-wahl="leer"]').click();
		await dialog(page).locator('[data-wahl="arbeitsblatt"]').click();
		await expect(schritt(page, 'format')).toBeVisible();
		await page.keyboard.press('Enter');
		await expect(schritt(page, 'titel')).toBeVisible();
		await page.getByRole('textbox', { name: 'Titel' }).fill('');
		await page.keyboard.press('Enter');
		await expect(dialog(page).locator('[data-anlegen-fehler]')).toContainText('Titel');
		await page.getByRole('textbox', { name: 'Titel' }).fill('Mein Blatt');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/bearbeiten\?neu=1/);
		await expect(page.locator('[data-bibliothek]')).toBeVisible();

		const { dir } = await imEditor(page);
		const versionen = await readdir(path.join(dir, 'versionen'));
		expect(versionen.some((v) => v.includes('lehrkraft'))).toBe(true);
		await page.locator('[data-bereich="Aufgaben"]').click();
		await page.locator('[data-einfuegen="aufgabe"]').click();
		await expect(page.frameLocator('[data-editor-rahmen="sichtbar"]').locator('.aufgabe')).toHaveCount(1);
		await expect.poll(async () => readFile(path.join(dir, 'material.html'), 'utf8')).toContain('class="aufgabe"');
	});

	test('Leeres Blatt in fünf Handgriffen, der Titel ist vorbelegt', async ({ page }) => {
		await page.goto('/');
		await neuerOrdner(page, `Fünf Griffe ${Date.now()}`);
		await oeffneAssistent(page);
		await dialog(page).locator('[data-wahl="leer"]').click();
		await dialog(page).locator('[data-wahl="arbeitsblatt"]').click();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('Neues Arbeitsblatt');
		await page.keyboard.press('Enter');
		const { dir } = await imEditor(page);
		expect(await metaVon(dir)).toMatchObject({
			titel: 'Neues Arbeitsblatt',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
		});
	});

	test('Esc und Abbrechen legen nichts an; gleicher Ordnername: Das Feld bleibt offen, nichts wird ersetzt', async ({
		page,
	}) => {
		await page.goto('/');
		const vorher = await mappenzahl();
		await oeffneAssistent(page);
		await page.keyboard.press('Enter');
		await expect(schritt(page, 'art')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog(page)).toBeHidden();
		await oeffneAssistent(page);
		await dialog(page).getByRole('button', { name: 'Abbrechen' }).click();
		expect(await mappenzahl()).toBe(vorher);

		const titel = `Doppelt ${Date.now()}`;
		const nenne = async () => {
			await page.locator('[data-werkzeugleiste] [data-neuer-ordner]').click();
			await expect(page.locator('[data-namensfeld] input')).toBeFocused();
			await page.keyboard.type(titel);
			await page.keyboard.press('Enter');
		};
		await nenne();
		await expect(objekt(page, titel)).toBeVisible();
		await nenne();
		await expect(page.getByRole('alert')).toContainText('Diesen Namen gibt es hier schon.');
		await page.keyboard.press('Escape');
		await expect(objekt(page, titel)).toHaveCount(1);
		await expect(objekt(page, 'Neuer Ordner')).toHaveCount(1);
	});

	test('Jede Art führt zu einem bearbeitbaren Dokument', async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto('/');
		await neuerOrdner(page, `Alle Arten ${Date.now()}`);
		await expect(page).toHaveURL(/\/o\//);
		const ordner = page.url();
		for (const art of [
			'lesetext',
			'lernspiel',
			'karten',
			'lernplakat',
			'stationen',
			'praesentation',
			'unterrichtsplanung',
			'klassenarbeit',
			'lernzielkontrolle',
			'sonstiges',
		]) {
			await page.goto(ordner);
			await oeffneAssistent(page);
			await dialog(page).locator('[data-wahl="leer"]').click();
			await dialog(page).locator(`[data-wahl="${art}"]`).click();
			await expect(schritt(page, 'format').or(schritt(page, 'titel'))).toBeVisible();
			if (await schritt(page, 'format').isVisible()) {
				await page.keyboard.press('Enter');
			}
			await expect(schritt(page, 'titel')).toBeVisible();
			await page.getByRole('textbox', { name: 'Titel' }).fill(art);
			await page.keyboard.press('Enter');
			await imEditor(page);
		}
	});

	test('Mini-Book beim Lesetext öffnet mit dem Mini-Book-Gerüst', async ({ page }) => {
		await page.goto('/');
		await neuerOrdner(page, `Mini ${Date.now()}`);
		await oeffneAssistent(page);
		await page.keyboard.press('2');
		await page.keyboard.press('Enter');
		await dialog(page).locator('[data-wahl="lesetext"]').click();
		await dialog(page).locator('[data-wahl="Mini-Book"]').click();
		await page.keyboard.press('Enter');
		const { dir } = await imEditor(page);
		expect(await metaVon(dir)).toMatchObject({ art: 'lesetext', format: 'minibuch' });
		expect(await readFile(path.join(dir, 'material.html'), 'utf8')).toMatch(/<body class="[^"]*minibuch/);
	});
});

test.describe('Assistent (132)', () => {
	test('Schritte fallen je Art weg, die Zählung passt sich an', async ({ page }) => {
		await page.goto('/');
		await oeffneAssistent(page);
		await expect(dialog(page)).toContainText('Schritt 1 von 8');
		await page.keyboard.press('Enter');
		await dialog(page).locator('[data-wahl="praesentation"]').click();
		await expect(schritt(page, 'fuerWen')).toBeVisible();
		await expect(dialog(page)).toContainText('Schritt 3 von 7');
		await expect(leiste(page, 'format')).toHaveCount(0);
		await expect(leiste(page, 'bausteine')).toHaveCount(1);

		await leiste(page, 'art').click();
		await dialog(page).locator('[data-wahl="lernplakat"]').click();
		await expect(schritt(page, 'format')).toBeVisible();
		await expect(leiste(page, 'bausteine')).toHaveCount(0);
		await expect(dialog(page)).toContainText('Schritt 3 von 7');
	});

	test('Freitext bei Art und Format steht in der Leiste; Zurückspringen behält „Anders …“', async ({ page }) => {
		await page.goto('/');
		await oeffneAssistent(page);
		await page.keyboard.press('Enter');
		await dialog(page).locator('[data-wahl="sonstiges"]').click();
		await expect(dialog(page).locator('[data-freitext="artText"]')).toBeFocused();
		await page.keyboard.type('Rätselheft');
		await page.keyboard.press('Enter');
		await dialog(page).locator('[data-wahl="anders"]').click();
		await expect(dialog(page).locator('[data-freitext="formatText"]')).toBeFocused();
		await page.keyboard.type('A5 quer');
		await page.keyboard.press('Enter');
		await expect(leiste(page, 'format')).toContainText('Anders: A5 quer');
		await page.keyboard.press('Enter');
		await page.keyboard.type('Tiere im Winter');
		// Der Titel steht beim Thema und folgt ihm (190-37).
		await expect(dialog(page).getByRole('textbox', { name: 'Titel' })).toHaveValue('Tiere im Winter');
		await page.keyboard.press('Enter');
		await expect(schritt(page, 'klasse')).toBeVisible();
		await expect(leiste(page, 'art')).toContainText('Rätselheft');
		await expect(dialog(page).locator('[data-hauptaktion]')).toHaveText('Aufgabenplan holen');

		// Zurück zu einer Art mit Wahl: Der Text hinter „Anders …“ bleibt für die Rückkehr (190-19).
		await leiste(page, 'format').click();
		await dialog(page).locator('[data-wahl-nr="1"]').click();
		await dialog(page).locator('[data-wahl="anders"]').click();
		await expect(dialog(page).locator('[data-freitext="formatText"]')).toHaveValue('A5 quer');
	});

	test('Leeres „Anders …“ geht nicht stumm weiter (190-19)', async ({ page }) => {
		await page.goto('/');
		await oeffneAssistent(page);
		await page.keyboard.press('Enter');
		await dialog(page).locator('[data-wahl="arbeitsblatt"]').click();
		await page.keyboard.press('Enter');
		await dialog(page).locator('[data-wahl="anders"]').click();
		await page.keyboard.press('Enter');
		await expect(dialog(page)).toContainText('Bitte schreib, was du meinst, oder wähle eine Angabe.');
		await expect(dialog(page).locator('[data-freitext="formatText"]')).toBeFocused();
		await page.keyboard.type('A5');
		await expect(dialog(page)).not.toContainText('Bitte schreib, was du meinst');
	});

	test('Geschlossen: Jeder Weg setzt beim gemerkten Schritt fort, „Von vorn beginnen“ vergisst (190-02)', async ({
		page,
	}) => {
		await page.goto('/');
		await oeffneAssistent(page);
		await page.keyboard.press('Enter');
		await dialog(page).locator('[data-wahl="arbeitsblatt"]').click();
		await page.keyboard.press('Enter');
		await page.keyboard.press('Enter');
		await expect(schritt(page, 'thema')).toBeVisible();
		await page.keyboard.type('Igel im Herbst');
		await dialog(page).getByRole('button', { name: 'Schließen' }).click();
		await expect(dialog(page)).toBeHidden();

		// Über den Knopf, ohne den Hinweis „Weiter ausfüllen“
		await page.locator('[data-werkzeugleiste] [data-material-anlegen]').click();
		await expect(schritt(page, 'thema')).toBeVisible();
		await expect(dialog(page).locator('[data-fokus]').first()).toHaveValue('Igel im Herbst');
		await dialog(page).getByRole('button', { name: 'Schließen' }).click();
		await expect(dialog(page)).toBeHidden();

		// Über ⌘K
		await page.keyboard.press('ControlOrMeta+k');
		await page.keyboard.type('Material anlegen');
		await page.keyboard.press('Enter');
		await expect(schritt(page, 'thema')).toBeVisible();
		await dialog(page).getByRole('button', { name: 'Von vorn beginnen' }).click();
		await expect(schritt(page, 'start')).toBeVisible();
		await expect(dialog(page).getByRole('button', { name: 'Von vorn beginnen' })).toHaveCount(0);
		await dialog(page).getByRole('button', { name: 'Abbrechen' }).click();
		await oeffneAssistent(page);
	});

	test('„Doch lieber leeres Blatt“ behält Art, Format und Titel', async ({ page }) => {
		await page.goto('/');
		await neuerOrdner(page, `Wechsel ${Date.now()}`);
		await oeffneAssistent(page);
		await page.keyboard.press('Enter');
		await dialog(page).locator('[data-wahl="arbeitsblatt"]').click();
		await dialog(page).locator('[data-wahl="A4 quer"]').click();
		await page.keyboard.press('Enter');
		await page.keyboard.type('Igel im Herbst');
		await dialog(page).getByRole('button', { name: 'Doch lieber leeres Blatt' }).click();
		await expect(schritt(page, 'titel')).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('Igel im Herbst');
		await expect(leiste(page, 'format')).toContainText('A4 quer');
		await page.keyboard.press('Enter');
		const { dir } = await imEditor(page);
		expect(await metaVon(dir)).toMatchObject({ titel: 'Igel im Herbst', art: 'arbeitsblatt', format: 'a4-quer' });
	});
});
