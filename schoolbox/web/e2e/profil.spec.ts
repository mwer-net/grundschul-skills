import { readFile, writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';
import { legeFreigabeAn, leseMeta } from '@schoolbox/kern';

import { material, oeffne, quelle, uhrzeit, versionen } from './editorhilfe';
import { expect, legeMappeAn, oeffneMehr, test } from './hilfe';

const MATERIAL_DIR = process.env.E2E_MATERIAL_DIR ?? '';

const schalter = (page: Page) => page.locator('[data-profilschalter]');
const farbe = (page: Page) => schalter(page).getByRole('button', { name: 'Farbe', exact: true });
const sw = (page: Page) => schalter(page).getByRole('button', { name: 's/w', exact: true });

const buntesBlatt = async () => {
	const dok = await uhrzeit();
	const html = await readFile(dok.material, 'utf8');
	await writeFile(dok.material, html.replace(/<h1[^>]*>/, '<h1 data-bunt style="color:#c62828">'));
	return dok;
};

const blatt = (page: Page) => page.locator('[data-blattansicht] iframe').last().contentFrame();

const textFarbe = (page: Page) =>
	blatt(page)
		.locator('[data-bunt]')
		.evaluate((el) => getComputedStyle(el).color);

const erwarteAnsicht = async (page: Page, grau: boolean) => {
	await expect(grau ? sw(page) : farbe(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(blatt(page).locator('body.sw')).toHaveCount(grau ? 1 : 0);
	await expect.poll(() => textFarbe(page)).toBe(grau ? 'rgb(87, 87, 87)' : 'rgb(198, 40, 40)');
};

test.describe('Farbe und s/w', () => {
	test('Dokumentansicht: ein Klick wechselt, die Wahl überlebt Neuladen und bleibt reine Ansicht', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		const { dok, id, material: datei, ordner } = await buntesBlatt();
		const vorher = await readFile(datei);
		const stand = await versionen(ordner);
		await page.goto(`/m/${id}/${dok}`);
		await expect(page.locator('[data-blattansicht][data-geladen]')).toBeVisible();
		await erwarteAnsicht(page, false);

		for (const knopf of [farbe(page), sw(page)]) {
			const box = await knopf.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(hasTouch ? 44 : 20);
		}

		await page.evaluate(() => window.scrollTo(0, 200));
		const hoehe = await page.evaluate(() => window.scrollY);
		await druecke(sw(page));
		await erwarteAnsicht(page, true);
		expect(Math.abs((await page.evaluate(() => window.scrollY)) - hoehe)).toBeLessThan(5);

		await expect.poll(async () => (await leseMeta(MATERIAL_DIR, id, dok)).druckprofil).toBe('sw');
		await page.reload();
		await erwarteAnsicht(page, true);

		await druecke(farbe(page));
		await erwarteAnsicht(page, false);
		await expect(page.getByText('Aktualisiert: Das Material')).toHaveCount(0);
		expect(await readFile(datei)).toEqual(vorher);
		expect(await versionen(ordner)).toEqual(stand);
	});

	test('Dokumentansicht: Menü und Drucken nehmen die aktuelle Ansicht, die andere ist wählbar', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await buntesBlatt();
		await page.goto(`/m/${id}/${dok}`);
		await druecke(sw(page));
		await erwarteAnsicht(page, true);
		const tab = page.context().waitForEvent('page');
		await oeffneMehr(druecke, page);
		await druecke(page.getByRole('menuitem', { name: 'Drucken' }));
		const druck = await tab;
		expect(druck.url()).toMatch(/profil=sw/);
		await druck.close();
		await druecke(page.getByRole('button', { name: 'PDF', exact: true }));
		await expect(page.getByRole('menuitem', { name: /in Farbe/ }).first()).toBeVisible();
		await page.keyboard.press('Escape');
	});

	test('Editor: Bearbeiten in s/w schreibt keine Farbe und keine sw-Klasse in die Quelle', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei } = await buntesBlatt();
		await oeffne(page, id, dok);
		await druecke(sw(page));
		await expect(material(page).locator('body.sw')).toHaveCount(1);
		await expect
			.poll(() =>
				material(page)
					.locator('[data-bunt]')
					.evaluate((el) => getComputedStyle(el).color),
			)
			.toBe('rgb(87, 87, 87)');

		const anweisung = material(page).locator('.aufgabe').first().locator('.anw .text');
		await druecke(anweisung);
		await druecke(anweisung);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.press('End');
		await page.keyboard.insertText(' Neu getippt.');
		await page.getByRole('button', { name: 'Fertig' }).click();
		await expect.poll(() => quelle(page)).toContain('Neu getippt.');
		await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();

		await expect.poll(() => readFile(datei, 'utf8')).toContain('Neu getippt.');
		const gespeichert = await readFile(datei, 'utf8');
		expect(/<body[^>]*>/.exec(gespeichert)?.[0]).not.toMatch(/\bsw\b/);
		expect(gespeichert).not.toContain('!important');
		expect(gespeichert).not.toMatch(/style="[^"]*rgb\(/);
		expect(gespeichert).toContain('color:#c62828');
		expect(gespeichert).not.toContain('data-grau');

		await druecke(farbe(page));
		await expect(material(page).locator('body.sw')).toHaveCount(0);
		await expect
			.poll(() =>
				material(page)
					.locator('[data-bunt]')
					.evaluate((el) => getComputedStyle(el).color),
			)
			.toBe('rgb(198, 40, 40)');
	});

	test('Teilen-Link: umschalten geht, der Server merkt sich nichts', async ({ druecke, page }) => {
		const { dok, id } = await buntesBlatt();
		const { token } = await legeFreigabeAn(MATERIAL_DIR, { mappe: id, dok });
		const vorher = await leseMeta(MATERIAL_DIR, id, dok);
		await page.goto(`/f/${token}/d/${dok}`);
		await expect(page.locator('[data-blattansicht][data-geladen]')).toBeVisible();
		await erwarteAnsicht(page, false);
		await druecke(sw(page));
		await erwarteAnsicht(page, true);
		await page.reload();
		await erwarteAnsicht(page, true);
		await druecke(farbe(page));
		await erwarteAnsicht(page, false);
		expect(await leseMeta(MATERIAL_DIR, id, dok)).toEqual(vorher);
	});

	test('Folien haben keinen Schalter', async ({ page }) => {
		const { dokumente, id } = await legeMappeAn('Folien', 'mathematik', 2, [
			{ titel: 'Uhr', format: 'folie', vorlage: 'praesentation' },
		]);
		await page.goto(`/m/${id}/${dokumente[0] ?? ''}`);
		await expect(page.getByRole('link', { name: 'Präsentieren' })).toBeVisible();
		await expect(schalter(page)).toHaveCount(0);
	});
});
