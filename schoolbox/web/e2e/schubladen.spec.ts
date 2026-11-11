import { readFile, writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { gespeichert, material, oeffne, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';
import type { SchubladenName } from './schubladen-hilfe';
import { oeffneSchublade, schubladenKnopf } from './schubladen-hilfe';

/**
 * Schubladenleiste (093): Ebenen ⌥1, Bausteine ⌥2, Werkzeuge ⌥3 (104, 175), Figuren ⌥4 (102), Bilder ⌥5. Die Ebenen
 * bleiben offen, bis man sie schließt; jede andere Schublade steht rechts daneben (183). Die Projektmaße sind eng
 * (iPad, 1280 mit Inspektor): Dort steht die Schublade allein an der Stelle der Ebenen, `offen` trifft höchstens eine
 * Spalte. Am Mac fragt `spalte` jede Spalte einzeln ab.
 */

const offen = (page: Page) => page.locator('[data-panel-links]');
const spalte = (page: Page, name: SchubladenName) => page.locator(`[data-panel-links="${name}"]`);
const blattBreite = async (page: Page) => (await page.locator('main').boundingBox())?.width ?? 0;
const palette = (page: Page) => page.locator('[data-befehlspalette]');
const bilder = (page: Page) => page.locator('[data-schublade-bilder]');
const ALLE: SchubladenName[] = ['ebenen', 'bausteine', 'werkzeuge', 'figuren', 'bilder'];
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
		await page.keyboard.press('Alt+Digit5');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bilder');
		await page.goto(`/m/${id}/${dok}/bearbeiten?neu=1`);
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await expect(schubladenKnopf(page, 'bausteine')).toHaveAttribute('aria-pressed', 'true');
	});

	test('⌥1, ⌥2, ⌥3 und ⌥5 öffnen, wechseln und schließen', async ({ page }) => {
		await blatt(page);
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await page.keyboard.press('Alt+Digit5');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bilder');
		await page.keyboard.press('Alt+Digit3');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'werkzeuge');
		await expect(page.locator('[data-schublade-werkzeuge]')).toBeVisible();
		// Eng stand die Schublade an der Stelle der Ebenen; zu kommen die Ebenen zurück (183).
		await page.keyboard.press('Alt+Digit3');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'ebenen');
		await page.keyboard.press('Alt+Digit1');
		await expect(offen(page)).toHaveCount(0);
		await page.keyboard.press('Alt+Digit1');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'ebenen');
	});

	test('Klick öffnet und wechselt, ein Klick auf das offene Symbol schließt, das Blatt wird breiter', async ({
		druecke,
		page,
	}) => {
		await blatt(page);
		// Erst die Ebenen schließen, sonst kommen sie nach der Schublade zurück (183).
		await druecke(schubladenKnopf(page, 'ebenen'));
		await expect(offen(page)).toHaveCount(0);
		await druecke(schubladenKnopf(page, 'bausteine'));
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await druecke(schubladenKnopf(page, 'bilder'));
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bilder');
		const schmal = await blattBreite(page);
		await druecke(schubladenKnopf(page, 'bilder'));
		await expect(offen(page)).toHaveCount(0);
		await expect(schubladenKnopf(page, 'bilder')).toHaveAttribute('aria-pressed', 'false');
		expect(await blattBreite(page)).toBeGreaterThan(schmal + 200);
		// Ohne etwas, das sie selbst geschlossen hat, öffnet die Statusleiste die Ebenen.
		await druecke(page.getByRole('button', { name: 'Linke Leiste' }));
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'ebenen');
	});

	test('alle fünf Schubladen sind überall: Leiste, Palette, Tastenübersicht, Hilfe', async ({ page }) => {
		await blatt(page);
		await expect(page.locator('[data-schublade-knopf]')).toHaveCount(ALLE.length);
		await page.keyboard.press('ControlOrMeta+k');
		await palette(page).getByRole('combobox').fill('Bilder');
		await expect(palette(page).locator('[data-palette-zeile="ansicht.links-bilder"]')).toHaveCount(1);
		await page.keyboard.press('Escape');
		await page.locator('[data-statusleiste]').getByRole('button', { name: 'Tasten' }).click();
		const tasten = page.locator('[data-tasten-uebersicht]');
		for (const name of ALLE) {
			await expect(tasten.locator(`[data-taste="ansicht.links-${name}"]`)).toBeVisible();
		}
		await page.keyboard.press('Escape');
		await page.goto('/hilfe#gestalten');
		const liste = page.locator('[data-hilfe-schubladen]');
		await expect(liste.locator('[data-hilfe-schublade]')).toHaveCount(ALLE.length);
		await expect(liste).toContainText('Bilder');
	});

	test('„Formen“ oder „Text“ von früher öffnen „Werkzeuge“ (175)', async ({ page }) => {
		await blatt(page);
		for (const wert of ['text', 'formen']) {
			await page.evaluate((w) => localStorage.setItem('schoolbox-panel-links', w), wert);
			await page.reload();
			await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
			await expect(offen(page)).toHaveAttribute('data-panel-links', 'werkzeuge');
			await expect(schubladenKnopf(page, 'werkzeuge')).toHaveAttribute('aria-pressed', 'true');
			await expect(page.locator('[data-schublade-werkzeuge]')).toBeVisible();
		}
	});

	test('„Werkzeuge“ steht in der Leiste ganz da, nicht abgeschnitten (175)', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'am iPad zeigt die Leiste nur Symbole');
		await blatt(page);
		const name = schubladenKnopf(page, 'werkzeuge').getByText('Werkzeuge', { exact: true });
		await expect(name).toBeVisible();
		// Mit `px-0.5` am Knopf stand hier „Werkzeu…“: Dann ist der Text breiter als sein Platz.
		expect(await name.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
	});

	test('⌘K: „Formen“ und „Text“ finden „Werkzeuge“ (175)', async ({ page }) => {
		await blatt(page);
		for (const wort of ['Formen', 'Text']) {
			await page.keyboard.press('ControlOrMeta+k');
			await palette(page).getByRole('combobox').fill(wort);
			await expect(palette(page).locator('[data-palette-zeile="ansicht.links-werkzeuge"]')).toHaveCount(1);
			await page.keyboard.press('Escape');
		}
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

test.describe('Ebenen und Schublade nebeneinander am Mac (183)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Mac-Maß mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 982 });
	});

	/** Was nach einer Änderung der Breite noch rendert (Maßstab des Blatts), ist danach da. */
	const zweiBilder = (page: Page) =>
		page.evaluate(
			() =>
				new Promise((weiter) => {
					requestAnimationFrame(() => requestAnimationFrame(weiter));
				}),
		);

	test('⌥2: Bausteine (280 px) rechts neben den Ebenen (240 px), „Einpassen“ bleibt gleich', async ({
		druecke,
		page,
	}) => {
		await blatt(page);
		const zoom = page.locator('[data-zoom-wert]');
		const einpassen = page.getByRole('button', { name: 'Einpassen' });
		await druecke(einpassen);
		await zweiBilder(page);
		const allein = (await zoom.textContent()) ?? '';
		expect(allein).toMatch(/^\d+\s*%$/);

		await page.keyboard.press('Alt+Digit2');
		await expect(spalte(page, 'bausteine')).toBeVisible();
		const ebenen = await spalte(page, 'ebenen').boundingBox();
		const bausteine = await spalte(page, 'bausteine').boundingBox();
		expect(Math.round(ebenen?.width ?? 0)).toBe(240);
		expect(Math.round(bausteine?.width ?? 0)).toBe(280);
		expect(Math.round(bausteine?.x ?? 0)).toBe(Math.round((ebenen?.x ?? 0) + (ebenen?.width ?? 0)));
		for (const name of ['ebenen', 'bausteine'] as const) {
			await expect(schubladenKnopf(page, name)).toHaveAttribute('aria-pressed', 'true');
		}
		// Gegenprobe von Hand: Mit `BREITE.schublade = 400` in `spalten.ts` scheitert diese Zeile.
		await druecke(einpassen);
		await zweiBilder(page);
		await expect(zoom).toHaveText(allein);
	});

	test('ein zweiter Klick schließt nur die Schublade, beim Wechsel bleiben die Ebenen eingehängt', async ({
		druecke,
		page,
	}) => {
		await blatt(page);
		await page.locator('[data-gliederung]').evaluate((e) => e.setAttribute('data-probe', ''));
		await druecke(schubladenKnopf(page, 'bausteine'));
		await expect(spalte(page, 'bausteine')).toBeVisible();
		await druecke(schubladenKnopf(page, 'bausteine'));
		await expect(spalte(page, 'bausteine')).toHaveCount(0);
		await expect(spalte(page, 'ebenen')).toHaveCount(1);
		for (const [taste, name] of [
			['Alt+Digit3', 'werkzeuge'],
			['Alt+Digit4', 'figuren'],
		] as const) {
			await page.keyboard.press(taste);
			await expect(spalte(page, name)).toBeVisible();
			await expect(offen(page)).toHaveCount(2);
			await expect(spalte(page, 'ebenen')).toHaveCount(1);
		}
		await expect(page.locator('[data-gliederung][data-probe]')).toHaveCount(1);
	});

	test('⌥1 schließt nur die Ebenen, die Schublade rückt an die Leiste; ⌥1 holt sie links davon zurück', async ({
		page,
	}) => {
		await blatt(page);
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveCount(2);
		await page.keyboard.press('Alt+Digit1');
		await expect(spalte(page, 'ebenen')).toHaveCount(0);
		await expect(spalte(page, 'bausteine')).toBeVisible();
		await expect(schubladenKnopf(page, 'ebenen')).toHaveAttribute('aria-pressed', 'false');
		const leiste = await page.locator('[data-schubladenleiste]').boundingBox();
		const allein = await spalte(page, 'bausteine').boundingBox();
		expect(Math.round(allein?.x ?? 0)).toBe(Math.round((leiste?.x ?? 0) + (leiste?.width ?? 0)));

		await page.keyboard.press('Alt+Digit1');
		await expect(spalte(page, 'ebenen')).toBeVisible();
		const ebenen = await spalte(page, 'ebenen').boundingBox();
		const bausteine = await spalte(page, 'bausteine').boundingBox();
		expect(Math.round(bausteine?.x ?? 0)).toBe(Math.round((ebenen?.x ?? 0) + (ebenen?.width ?? 0)));
	});

	test('Ebenen und Figuren bleiben nach dem Neuladen offen', async ({ page }) => {
		await blatt(page);
		await page.keyboard.press('Alt+Digit4');
		await expect(offen(page)).toHaveCount(2);
		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(spalte(page, 'ebenen')).toBeVisible();
		await expect(spalte(page, 'figuren')).toBeVisible();
		expect(
			await page.evaluate(() => [
				localStorage.getItem('schoolbox-ebenen-offen'),
				localStorage.getItem('schoolbox-panel-links'),
			]),
		).toEqual(['1', 'figuren']);
	});

	test('alte Werte werden übernommen, danach sind die alten Schlüssel weg', async ({ page }) => {
		await blatt(page);
		const lade = async (werte: Record<string, string>) => {
			await page.evaluate((w) => {
				localStorage.removeItem('schoolbox-ebenen-offen');
				localStorage.removeItem('schoolbox-ebenen-angeheftet');
				for (const [schluessel, wert] of Object.entries(w)) {
					localStorage.setItem(schluessel, wert);
				}
			}, werte);
			await page.reload();
			await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		};
		const speicher = () =>
			page.evaluate(() =>
				['schoolbox-ebenen-offen', 'schoolbox-ebenen-angeheftet', 'schoolbox-ebenen-teilung'].map((s) =>
					localStorage.getItem(s),
				),
			);

		await lade({
			'schoolbox-panel-links': 'bausteine',
			'schoolbox-ebenen-angeheftet': '1',
			'schoolbox-ebenen-teilung': '0.4',
		});
		await expect(spalte(page, 'ebenen')).toBeVisible();
		await expect(spalte(page, 'bausteine')).toBeVisible();
		await expect.poll(speicher).toEqual(['1', null, null]);

		// Gegenprobe: nicht angeheftet steht die Schublade allein.
		await lade({ 'schoolbox-panel-links': 'bausteine' });
		await expect(spalte(page, 'bausteine')).toBeVisible();
		await expect(spalte(page, 'ebenen')).toHaveCount(0);
		await expect.poll(speicher).toEqual(['0', null, null]);
	});

	test('im schmalen Fenster steht die Schublade allein, breit wieder neben den Ebenen', async ({ page }) => {
		await blatt(page);
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveCount(2);
		await page.setViewportSize({ width: 1080, height: 810 });
		await expect(offen(page)).toHaveCount(1);
		await expect(spalte(page, 'bausteine')).toBeVisible();
		await expect(schubladenKnopf(page, 'ebenen')).toHaveAttribute('aria-pressed', 'false');
		await page.setViewportSize({ width: 1512, height: 982 });
		await expect(offen(page)).toHaveCount(2);
		await expect(schubladenKnopf(page, 'ebenen')).toHaveAttribute('aria-pressed', 'true');
	});

	test('„Linke Leiste“ schließt Ebenen und Schublade und holt beide wieder', async ({ druecke, page }) => {
		await blatt(page);
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveCount(2);
		const knopf = page.getByRole('button', { name: 'Linke Leiste' });
		await expect(knopf).toHaveAttribute('aria-pressed', 'true');
		await druecke(knopf);
		await expect(offen(page)).toHaveCount(0);
		await expect(knopf).toHaveAttribute('aria-pressed', 'false');
		await druecke(knopf);
		await expect(spalte(page, 'ebenen')).toBeVisible();
		await expect(spalte(page, 'bausteine')).toBeVisible();
		await expect(knopf).toHaveAttribute('aria-pressed', 'true');
	});

	test('keine Stecknadel, kein Teiler; ⌘K kennt kein Anheften, aber „Ebenen“', async ({ page }) => {
		await blatt(page);
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveCount(2);
		await expect(page.locator('[data-ebenen-anheften]')).toHaveCount(0);
		await expect(page.locator('[data-teiler]')).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+k');
		await palette(page).getByRole('combobox').fill('anheften');
		// Nur „An Claude schicken: anheften“, das jede Suche anbietet.
		const claude = '[data-palette-zeile="claude:schicken"]';
		await expect(palette(page).locator(claude)).toBeVisible();
		await expect(palette(page).locator(`[data-palette-zeile]:not(${claude})`)).toHaveCount(0);
		await palette(page).getByRole('combobox').fill('Ebenen');
		await expect(palette(page).locator('[data-palette-zeile="ansicht.links-ebenen"]')).toContainText('Ebenen');
	});
});

test.describe('Schublade an der Stelle der Ebenen, wenn es eng ist (183)', () => {
	test('⌥2 ersetzt die Ebenen und gibt sie zurück; der Ebenen-Knopf schließt die Schublade', async ({
		druecke,
		page,
	}) => {
		await blatt(page);
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'ebenen');
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await expect(schubladenKnopf(page, 'ebenen')).toHaveAttribute('aria-pressed', 'false');
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'ebenen');
		await page.keyboard.press('Alt+Digit2');
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'bausteine');
		await druecke(schubladenKnopf(page, 'ebenen'));
		await expect(offen(page)).toHaveAttribute('data-panel-links', 'ebenen');
		await expect(schubladenKnopf(page, 'bausteine')).toHaveAttribute('aria-pressed', 'false');
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
		await expect(bilder(page).locator('[data-hinweis="figuren"]')).toHaveCount(0);
		await bilder(page).getByRole('searchbox', { name: 'Bilder suchen' }).fill('keimling');
		await expect(bilder(page).locator('[data-sammlung-bild]')).toHaveCount(1);
		await bilder(page).getByRole('searchbox', { name: 'Bilder suchen' }).fill('kartoffelsalat');
		await expect(bilder(page).getByText('Kein Bild passt zur Suche.')).toBeVisible();
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
