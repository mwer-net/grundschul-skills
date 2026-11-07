import { readFile, writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { gespeichert, material, oeffne, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';
import type { SchubladenName } from './schubladen-hilfe';
import { oeffneSchublade, schubladenKnopf } from './schubladen-hilfe';

/** Schubladenleiste (093): Ebenen ⌥1, Bausteine ⌥2, Formen ⌥3 (104), Figuren ⌥4 (102), Bilder ⌥6; Text und Rezepte noch unsichtbar. */

const offen = (page: Page) => page.locator('[data-panel-links]');
const blattBreite = async (page: Page) => (await page.locator('main').boundingBox())?.width ?? 0;
const palette = (page: Page) => page.locator('[data-befehlspalette]');
const bilder = (page: Page) => page.locator('[data-schublade-bilder]');
const UNSICHTBAR: SchubladenName[] = ['text', 'rezepte'];
const WACHSTUM = '_assets/bilder/wachstum.png';

const blatt = async (page: Page) => {
	const { dok, id, material: datei } = await uhrzeit();
	await oeffne(page, id, dok);
	return { dok, id, datei };
};

const zurSammlung = async (page: Page) => {
	await oeffneSchublade(page, 'bilder');
	await bilder(page).getByRole('button', { name: 'Sammlung', exact: true }).click();
	await expect(bilder(page).locator(`[data-sammlung-bild="${WACHSTUM}"]`)).toBeVisible();
};

test.describe('Schubladenleiste (093)', () => {
	test('ein neues Material öffnet „Bausteine“, auch wenn zuletzt etwas anderes offen war', async ({ page }) => {
		const { dok, id } = await blatt(page);
		await page.keyboard.press('Alt+Digit6');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bilder');
		await page.goto(`/m/${id}/${dok}/bearbeiten?neu=1`);
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await expect(schubladenKnopf(page, 'bausteine')).toHaveAttribute('aria-pressed', 'true');
	});

	test('⌥1, ⌥2, ⌥3 und ⌥6 öffnen, wechseln und schließen; ⌥7 tut nichts', async ({ page }) => {
		await blatt(page);
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await page.keyboard.press('Alt+Digit6');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bilder');
		await page.keyboard.press('Alt+Digit7');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bilder');
		await page.keyboard.press('Alt+Digit3');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'formen');
		await page.keyboard.press('Alt+Digit3');
		await expect(offen(page)).toHaveCount(0);
		await page.keyboard.press('Alt+Digit1');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'ebenen');
		await page.keyboard.press('Alt+Digit1');
		await expect(offen(page)).toHaveCount(0);
	});

	test('Klick öffnet und wechselt, ein Klick auf das offene Symbol schließt, das Blatt wird breiter', async ({
		druecke,
		page,
	}) => {
		await blatt(page);
		await druecke(schubladenKnopf(page, 'bausteine'));
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await druecke(schubladenKnopf(page, 'bilder'));
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bilder');
		const schmal = await blattBreite(page);
		await druecke(schubladenKnopf(page, 'bilder'));
		await expect(offen(page)).toHaveCount(0);
		await expect(schubladenKnopf(page, 'bilder')).toHaveAttribute('aria-pressed', 'false');
		expect(await blattBreite(page)).toBeGreaterThan(schmal + 200);
		// Die Statusleiste öffnet die zuletzt offene wieder.
		await druecke(page.getByRole('button', { name: 'Linke Leiste' }));
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bilder');
	});

	test('die leeren Schubladen sind nirgends: Leiste, Palette, Tastenübersicht, Hilfe', async ({ page }) => {
		await blatt(page);
		await expect(page.locator('[data-schublade-knopf]')).toHaveCount(4);
		for (const name of UNSICHTBAR) {
			await expect(schubladenKnopf(page, name)).toHaveCount(0);
		}
		await page.keyboard.press('ControlOrMeta+k');
		for (const wort of ['Rezepte']) {
			await palette(page).getByRole('combobox').fill(wort);
			await expect(palette(page).locator(`[data-palette-zeile^="ansicht.links-"]`)).toHaveCount(0);
		}
		await page.keyboard.press('Escape');
		await page.locator('[data-statusleiste]').getByRole('button', { name: 'Tasten' }).click();
		const tasten = page.locator('[data-tasten-uebersicht]');
		await expect(tasten.locator('[data-taste="ansicht.links-bilder"]')).toBeVisible();
		for (const name of UNSICHTBAR) {
			await expect(tasten.locator(`[data-taste="ansicht.links-${name}"]`)).toHaveCount(0);
		}
		await page.keyboard.press('Escape');
		await page.goto('/hilfe#gestalten');
		const liste = page.locator('[data-hilfe-schubladen]');
		await expect(liste.locator('[data-hilfe-schublade]')).toHaveCount(5);
		await expect(liste).not.toContainText('Rezepte');
	});

	test('angeheftete Ebenen und der Teiler bleiben nach dem Neuladen, wie sie waren', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'der Teiler wird mit der Maus gezogen');
		await blatt(page);
		await oeffneSchublade(page, 'ebenen');
		await page.locator('[data-ebenen-anheften]').click();
		await expect(page.locator('[data-ebenen-anheften]')).toHaveAttribute('aria-pressed', 'true');
		await oeffneSchublade(page, 'bausteine');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await expect(page.locator('[data-schublade-unten]').getByRole('navigation', { name: 'Ebenen' })).toBeVisible();

		const teiler = page.locator('[data-teiler]');
		const box = await teiler.boundingBox();
		if (!box) {
			throw new Error('Teiler nicht sichtbar');
		}
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		for (let i = 1; i <= 6; i += 1) {
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - (120 * i) / 6);
		}
		await page.mouse.up();
		const oben = page.locator('[data-schublade-oben]');
		const hoehe = (await oben.boundingBox())?.height ?? 0;
		expect(hoehe).toBeLessThan(box.y - 60);

		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await expect(page.locator('[data-schublade-unten]').getByRole('navigation', { name: 'Ebenen' })).toBeVisible();
		await expect.poll(async () => Math.round((await oben.boundingBox())?.height ?? 0)).toBe(Math.round(hoehe));

		// Geschlossen bleiben die angehefteten Ebenen allein stehen; gelöst gehen sie mit.
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveCount(0);
		await expect(page.locator('[data-ebenen-angeheftet]').getByRole('navigation', { name: 'Ebenen' })).toBeVisible();
		await page.locator('[data-ebenen-anheften]').click();
		await expect(page.locator('[data-ebenen-angeheftet]')).toHaveCount(0);
	});

	test('⌘K findet „Ebenen“ auch mit „Gliederung“', async ({ page }) => {
		await blatt(page);
		await page.keyboard.press('Alt+Digit2');
		await page.keyboard.press('ControlOrMeta+k');
		await palette(page).getByRole('combobox').fill('Gliederung');
		const zeile = palette(page).locator('[data-palette-zeile="ansicht.links-ebenen"]');
		await expect(zeile).toContainText('Ebenen');
		await zeile.click();
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'ebenen');
	});
});

test.describe('Bilder-Schublade (093)', () => {
	test('zeigt drei Gruppen mit Suche; Willi & Co. stehen nicht in der Sammlung', async ({ page }) => {
		await blatt(page);
		await zurSammlung(page);
		for (const name of ['Dieser Ordner', 'Meine Bilder', 'Sammlung']) {
			await expect(bilder(page).getByRole('button', { name, exact: true })).toBeVisible();
		}
		await expect(bilder(page).locator('[data-sammlung-bild="_assets/bilder/willi.png"]')).toHaveCount(0);
		await expect(bilder(page).locator('[data-sammlung-bild="_assets/bilder/wilma.png"]')).toHaveCount(0);
		await expect(bilder(page).locator('[data-hinweis="figuren"]')).toContainText('Willi & Co.');
		await bilder(page).getByRole('searchbox', { name: 'Bilder suchen' }).fill('keimling');
		await expect(bilder(page).locator('[data-sammlung-bild]')).toHaveCount(1);
		await bilder(page).getByRole('searchbox', { name: 'Bilder suchen' }).fill('kartoffelsalat');
		await expect(bilder(page).getByText('Kein Bild passt zur Suche.')).toBeVisible();
		// 102: Der Hinweis führt zu den Figuren.
		await bilder(page).locator('[data-hinweis="figuren"]').getByRole('button', { name: 'Figuren ⌥4' }).click();
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'figuren');
	});

	test('„Foto hochladen“ zeigt den Hinweis', async ({ druecke, page }) => {
		await blatt(page);
		await oeffneSchublade(page, 'bilder');
		await druecke(bilder(page).getByRole('button', { name: 'Foto hochladen' }));
		await expect(bilder(page).getByText('Bitte keine Fotos, auf denen Kinder zu erkennen sind.')).toBeVisible();
	});

	test('Klick füllt den gewählten Bildplatzhalter', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const roh = await readFile(datei, 'utf8');
		const linie = '<div class="schreiblinie nicht-loesung"></div>';
		await writeFile(
			datei,
			roh.replace(linie, `<div class="platzhalter" style="--h:120px">Pflanze wächst</div>${linie}`),
		);
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.platzhalter'));
		await expect(page.locator('[data-bildwerkzeug="platzhalter"]')).toBeVisible();
		await zurSammlung(page);
		await druecke(bilder(page).locator(`[data-sammlung-bild="${WACHSTUM}"]`));
		await expect.poll(() => readFile(datei, 'utf8'), { timeout: 15_000 }).toContain('style="width:238px"');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(
			`<img src="bilder/wachstum.png" alt="Samen, Keimling, Pflanze, Blume" style="width:238px">${linie}`,
		);
		await expect(material(page).locator('.platzhalter')).toHaveCount(0);
	});

	test('ohne gewähltes Bild fügt der Klick einen Bild-Baustein ein, ⌘Z nimmt beides in einem Schritt zurück', async ({
		druecke,
		page,
	}) => {
		const { datei } = await blatt(page);
		const bild = material(page).locator('img[src="bilder/wachstum.png"]');
		const vorher = await bild.count();
		await druecke(material(page).locator('.aufgabe .nr').first());
		await zurSammlung(page);
		await druecke(bilder(page).locator(`[data-sammlung-bild="${WACHSTUM}"]`));
		await expect(bild).toHaveCount(vorher + 1);
		await expect(material(page).locator('.platzhalter')).toHaveCount(0);
		await gespeichert(page, datei);
		await expect(page.getByRole('button', { name: /^Rückgängig/ }).first()).toHaveAttribute(
			'data-schritt',
			'Bild eingefügt',
		);

		await page.keyboard.press('ControlOrMeta+z');
		await expect(bild).toHaveCount(vorher);
		await expect(material(page).locator('.platzhalter')).toHaveCount(0);
	});
});
