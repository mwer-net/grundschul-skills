import type { Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/** 109: Streuung (Konfetti, Punkte, Sterne) aus der Schublade Formen, Werkzeug Streuen, Würfeln, Dichte, s/w. */

const ARTEN = [
	['punkte', 'Punkte'],
	['konfetti', 'Konfetti'],
	['sterne', 'Sterne'],
] as const;

const kachel = (page: Page, art: string) => page.locator(`[data-streuung-kacheln] [data-streuung-art="${art}"]`);
const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const streuungen = (page: Page) => material(page).locator('svg.streuung');
const anzahl = (html: string) => html.split('<svg class="streuung"').length - 1;
const saat = (html: string) => /data-saat="(\d+)"/.exec(html)?.[1] ?? '';

const oeffneFormen = async (page: Page, hinten: string[] = []) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, blattMit({ hinten }));
	await oeffneSchublade(page, 'formen');
	await expect(page.locator('[data-schublade-formen]')).toBeVisible();
};

const aufSeite = async (page: Page, ax: number, ay: number) => {
	const seite = material(page).locator('.seite').first();
	await seite.evaluate((s) => s.scrollIntoView({ block: 'center' }));
	const r = await seite.boundingBox();
	const sicht = await page.locator('main').boundingBox();
	if (!r || !sicht) {
		throw new Error('Seite nicht zu sehen');
	}
	const oben = Math.max(r.y, sicht.y);
	const unten = Math.min(r.y + r.height, sicht.y + sicht.height);
	return { x: r.x + r.width * ax, y: oben + (unten - oben) * ay };
};

test.describe('Streuung (109)', () => {
	for (const [art, name] of ARTEN) {
		test(`${name}: per Klick abgelegt liegt sie hinten, mit Teilen, ein Schritt`, async ({ page }) => {
			await oeffneFormen(page);
			await kachel(page, art).click();
			await expect.poll(async () => anzahl(await quelle(page))).toBe(1);
			const text = await quelle(page);
			expect(text).toMatch(new RegExp(`class="ebene hinten"[^]*data-streuung="${art}"`));
			await expect(streuungen(page).first()).toBeVisible();
			expect(await streuungen(page).first().locator('> *').count()).toBeGreaterThan(5);
			expect(await streuungen(page).first().locator('> *').count()).toBeLessThanOrEqual(200);
			await zurueck(page).click();
			await expect.poll(async () => anzahl(await quelle(page))).toBe(0);
		});
	}

	test('Neu laden ergibt dasselbe Bild', async ({ page }) => {
		await oeffneFormen(page);
		await kachel(page, 'konfetti').click();
		await expect(streuungen(page).first()).toBeVisible();
		const vorher = await streuungen(page).first().screenshot();
		await page.reload();
		await expect(streuungen(page).first()).toBeVisible();
		const nachher = await streuungen(page).first().screenshot();
		expect(nachher.equals(vorher)).toBe(true);
	});

	test('Würfeln ist ein Schritt, ⌘Z bringt das alte Bild zurück', async ({ page }) => {
		await oeffneFormen(page);
		await kachel(page, 'konfetti').click();
		await expect(page.locator('[data-streuung-wuerfeln]').first()).toBeVisible();
		const vorher = await quelle(page);
		await page.locator('[data-streuung-wuerfeln]').first().click();
		await expect.poll(async () => saat(await quelle(page))).not.toBe(saat(vorher));
		await zurueck(page).click();
		await expect.poll(async () => await quelle(page)).toBe(vorher);
	});

	test('Größe ändern erzeugt neu, mit derselben Saat', async ({ page }) => {
		await oeffneFormen(page);
		await kachel(page, 'sterne').click();
		const vorher = await quelle(page);
		const feld = page.locator('[data-abschnitt="position"] input[aria-label="Breite"]').first();
		await feld.fill('150');
		await feld.press('Enter');
		await expect.poll(async () => await quelle(page)).toContain('--b:150px');
		const neu = await quelle(page);
		expect(saat(neu)).toBe(saat(vorher));
		expect(neu).toContain('viewBox="0 0 150 300"');
	});

	test('Inspektor: Art, Formen, Farben, Größe, Dichte, je ein Schritt', async ({ page }) => {
		await oeffneFormen(page);
		await kachel(page, 'konfetti').click();
		const abschnitt = page.locator('[data-gestaltung-streuung]');
		await expect(abschnitt).toBeVisible();
		await abschnitt.locator('[data-streuung-form="stern"]').click();
		await expect.poll(async () => await quelle(page)).toMatch(/data-formen="[^"]*stern/);
		await abschnitt.locator('[data-streuung-farbe="dunkel"]').click();
		await expect.poll(async () => await quelle(page)).toMatch(/data-farben="haupt akzent"/);
		await abschnitt.getByRole('button', { name: 'Groß' }).click();
		await expect.poll(async () => await quelle(page)).toContain('data-groesse="gross"');
		await abschnitt.getByRole('button', { name: 'Sterne' }).click();
		await expect.poll(async () => await quelle(page)).toContain('data-streuung="sterne"');
		const regler = abschnitt.locator('input[aria-label="Dichte"]');
		await regler.fill('100');
		await expect.poll(async () => await quelle(page)).toContain('data-dichte="1"');
	});

	test('In s/w ist sie weg, mit „In s/w: grau“ ist sie grau', async ({ page }) => {
		await oeffneFormen(page);
		await kachel(page, 'konfetti').click();
		const s = streuungen(page).first();
		await expect(s).toBeVisible();
		await s.evaluate((e) => e.ownerDocument.body.classList.add('sw'));
		await expect(s).toBeHidden();
		await s.evaluate((e) => e.setAttribute('data-sw', 'grau'));
		await expect(s).toBeVisible();
	});

	test('Das Werkzeug Streuen zieht eine auf, hinten, in dieser Größe', async ({ page }) => {
		await oeffneFormen(page);
		await page.locator('[data-streuen-knopf]').click();
		const von = await aufSeite(page, 0.2, 0.2);
		const bis = await aufSeite(page, 0.7, 0.5);
		await page.mouse.move(von.x, von.y);
		await page.mouse.down();
		await page.mouse.move(bis.x, bis.y, { steps: 6 });
		await page.mouse.up();
		await expect.poll(async () => anzahl(await quelle(page))).toBe(1);
		expect(await quelle(page)).toMatch(/class="ebene hinten"[^]*data-streuung="konfetti"/);
		await zurueck(page).click();
		await expect.poll(async () => anzahl(await quelle(page))).toBe(0);
	});

	test('Eine Streuung über einer Aufgabe in .ebene.hinten bleibt ohne Fund der Prüfung', async ({ page }) => {
		const streuung =
			'<svg class="streuung" data-lage="frei" data-streuung="konfetti" data-saat="9" data-dichte="1" viewBox="0 0 700 300" style="--x:40px;--y:120px;--b:700px;--h:300px"></svg>';
		await oeffneFormen(page, [streuung]);
		// Die Kinder fehlen: Der Editor erzeugt sie beim Öffnen.
		await expect.poll(async () => streuungen(page).first().locator('> *').count()).toBeGreaterThan(5);
		await expect(page.locator('[data-pruefung="fehler"]')).toHaveCount(0);
		await expect(page.locator('[data-pruefpunkt="verdeckt"], [data-pruefpunkt="ueberlappung"]')).toHaveCount(0);
	});
});
