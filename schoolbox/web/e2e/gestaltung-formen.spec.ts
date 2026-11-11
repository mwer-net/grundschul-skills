import type { Page } from '@playwright/test';

import { aendere, geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/** 104: Grundformen aus der Schublade Werkzeuge (⌥3), Strecken ohne Verzerren, Füllung und Kontur, Parameter. */

const GRUNDFORMEN = [
	'Kreis',
	'Rechteck',
	'Abgerundetes Rechteck',
	'Dreieck',
	'Stern',
	'Herz',
	'Pfeil',
	'Wolke',
	'Sechseck',
	'Raute',
] as const;

const kachel = (page: Page, name: string) => page.locator(`[data-grundformen] [data-ablage-gut="${name}"]`);
const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const formen = (page: Page) => material(page).locator('svg.form');
const anzahl = (html: string) => html.split('<svg class="form"').length - 1;

/** Ein Punkt auf der ersten Seite, Anteile ihrer sichtbaren Box. */
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

const oeffneFormen = async (page: Page, vorne: string[] = []) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, blattMit({ vorne }));
	await oeffneSchublade(page, 'werkzeuge');
	await expect(page.locator('[data-schublade-werkzeuge]')).toBeVisible();
};

/** Legt eine Form per Klick ab und gibt sie (gewählt) zurück. */
const legeAb = async (page: Page, name: string) => {
	const vorher = anzahl(await quelle(page));
	await kachel(page, name).click();
	await expect.poll(async () => anzahl(await quelle(page))).toBe(vorher + 1);
	await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
	return formen(page).last();
};

test.describe('Formen: Grundformen ablegen', () => {
	test('jede Grundform per Klick: ein Schritt, danach gewählt, mit Pfad', async ({ page }) => {
		await oeffneFormen(page);
		await expect(page.locator('[data-grundformen] [data-ablage-gut]')).toHaveCount(GRUNDFORMEN.length);
		for (const name of GRUNDFORMEN) {
			const form = await legeAb(page, name);
			await expect(zurueck(page)).toHaveAttribute('data-schritt', `${name} abgelegt`);
			await expect(form.locator('path')).toHaveAttribute('d', /^M/);
			await expect(page.locator('[data-gestaltung-form]')).toBeVisible();
			await expect(page.locator('[data-gestaltung-fuellung]')).toBeVisible();
		}
	});

	test('jede Grundform per Ziehen: frei abgelegt, 120 × 120, danach gewählt', async ({ page }) => {
		await oeffneFormen(page);
		for (const [i, name] of GRUNDFORMEN.entries()) {
			const vorher = anzahl(await quelle(page));
			const r = await kachel(page, name).boundingBox();
			if (!r) {
				throw new Error(`${name} nicht zu sehen`);
			}
			await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
			await page.mouse.down();
			await page.mouse.move(r.x + r.width / 2 - 20, r.y + r.height / 2 - 12, { steps: 3 });
			const ziel = await aufSeite(page, 0.2 + (i % 5) * 0.15, 0.3 + Math.floor(i / 5) * 0.3);
			await page.mouse.move(ziel.x, ziel.y, { steps: 8 });
			await page.mouse.up();
			await expect.poll(async () => anzahl(await quelle(page))).toBe(vorher + 1);
			await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
			expect(await quelle(page)).toMatch(/<svg class="form" data-lage="frei"[^>]*--b:120px;--h:120px/);
		}
	});

	test('⌘K „Stern“ legt einen Stern ab', async ({ page }) => {
		await oeffneFormen(page);
		await page.keyboard.press('ControlOrMeta+k');
		await page.locator('[data-befehlspalette]').getByRole('combobox').fill('Stern');
		await page.locator('[data-palette-zeile="ablegen:Stern"]').click();
		await expect.poll(async () => anzahl(await quelle(page))).toBe(1);
		expect(await quelle(page)).toMatch(/data-form="stern"/);
	});
});

test.describe('Formen: Größe, Farben, Parameter', () => {
	test('doppelte Breite: gleiche Strichstärke, runde Ecken bleiben rund, auch während der Geste', async ({
		page,
	}) => {
		await oeffneFormen(page);
		const form = await legeAb(page, 'Abgerundetes Rechteck');
		const griff = page.locator('[data-gestaltung-griff="rechts"]');
		const r = await griff.boundingBox();
		const vorher = await form.boundingBox();
		if (!r || !vorher) {
			throw new Error('Griff nicht zu sehen');
		}
		await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
		await page.mouse.down();
		await page.mouse.move(r.x + r.width / 2 + vorher.width, r.y + r.height / 2, { steps: 6 });
		// Während der Geste ist der Pfad schon in der neuen Breite gezeichnet, ohne Verzerrung.
		await expect(form).toHaveAttribute('viewBox', /^0 0 2\d\d 120$/);
		await page.mouse.up();
		await expect.poll(async () => (await quelle(page)).match(/viewBox="0 0 (\d+) 120"/)?.[1]).toBe('240');
		await geladen(page);
		// Die Pixelprobe ohne den Auswahlrahmen darüber.
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-gestaltung-rahmen]')).toHaveCount(0);

		expect(await form.locator('path').evaluate((p) => getComputedStyle(p).strokeWidth)).toBe('3px');
		// Pixel-Stichprobe: Die Ecke oben links ist außen frei (rund), die Mitte der linken Kante ist Kontur.
		const bild = await form.screenshot();
		const farben = await page.evaluate(async (daten) => {
			const img = new Image();
			img.src = `data:image/png;base64,${daten}`;
			await img.decode();
			const c = document.createElement('canvas');
			c.width = img.width;
			c.height = img.height;
			const g = c.getContext('2d');
			g?.drawImage(img, 0, 0);
			const px = (x: number, y: number) => [...(g?.getImageData(x, y, 1, 1).data ?? [])];
			return {
				ecke: px(3, 3),
				kante: px(1, Math.round(img.height / 2)),
				mitte: px(Math.round(img.width / 2), Math.round(img.height / 2)),
				breite: img.width,
			};
		}, bild.toString('base64'));
		expect(farben.breite).toBeGreaterThan(200);
		// Außen an der runden Ecke liegt weder Füllung noch Kontur; Kante und Mitte haben ihre eigene Farbe.
		const gleich = (a: number[], b: number[]) => a.slice(0, 3).every((k, i) => Math.abs(k - (b[i] ?? 0)) < 24);
		expect(gleich(farben.ecke, farben.mitte)).toBe(false);
		expect(gleich(farben.ecke, farben.kante)).toBe(false);
		expect(gleich(farben.kante, farben.mitte)).toBe(false);
	});

	test('Füllung Akzent folgt dem Wechsel der Palette', async ({ page }) => {
		await oeffneFormen(page);
		const form = await legeAb(page, 'Kreis');
		await expect(form.locator('path')).toHaveAttribute('style', /fill:var\(--akzent\)/);
		const fill = () =>
			form
				.locator('path')
				.evaluate((p) => getComputedStyle(p).fill)
				.catch(() => null);
		await geladen(page);
		const vorher = await fill();
		expect(vorher).not.toBeNull();
		await aendere(page, (await quelle(page)).replace('palette-himmel', 'palette-beere'));
		await geladen(page);
		await expect
			.poll(async () => {
				const jetzt = await fill();
				return jetzt !== null && jetzt !== vorher;
			})
			.toBe(true);
		expect(await quelle(page)).toMatch(/fill:var\(--akzent\)/);
	});

	test('Füllung „Keine“ und Kontur aus dem Inspektor, je ein Schritt', async ({ page }) => {
		await oeffneFormen(page);
		const form = await legeAb(page, 'Herz');
		await page.locator('[data-form-farben="form-fuellung"] [data-farbe="keine"]').click();
		await expect(form.locator('path')).toHaveAttribute('style', /fill:none/);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Füllung entfernt');
		await page.locator('[data-form-farben="form-kontur"] [data-farbe="#000000"]').click();
		await expect(form.locator('path')).toHaveAttribute('style', /stroke:#000000/);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Kontur geändert');
	});

	test('Zacken 5 → 8 ist ein Schritt', async ({ page }) => {
		await oeffneFormen(page);
		const form = await legeAb(page, 'Stern');
		const feld = page.locator('[data-form-parameter="data-zacken"]').getByRole('textbox', { name: 'Zacken' });
		await feld.fill('8');
		await feld.press('Enter');
		await expect(form).toHaveAttribute('data-zacken', '8');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Zacken geändert');
		await zurueck(page).click();
		await expect(form).toHaveAttribute('data-zacken', '5');
	});
});
