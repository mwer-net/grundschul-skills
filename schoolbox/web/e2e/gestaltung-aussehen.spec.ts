import type { Locator, Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, FORM } from './gestaltung-daten';
import { expect, test } from './hilfe';

/**
 * 108: Verlauf in der Füllung (auch in s/w), Kontur gestrichelt und gepunktet, Schatten, Deckkraft. Jede Änderung ist
 * ein Schritt, der Regler einer beim Loslassen.
 */

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const formen = (page: Page) => material(page).locator('svg.form');
const fuellung = (page: Page) => page.locator('[data-farbwahl-verlauf="form-fuellung"]');

/** Ein Bild in der Ebene hinten, unter den Aufgaben frei zu treffen, für Schatten und Deckkraft. */
const BILD_HINTEN =
	'<img class="bild-frei" data-lage="frei" src="bilder/wachstum.png" alt="Wachstum" style="--x:420px;--y:900px;--b:200px">';

const oeffneBlatt = async (page: Page, html: string) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, html);
};

const waehle = async (page: Page, element: Locator, art: string) => {
	await element.click();
	await expect(page.locator(`[data-gestaltung-inspektor="${art}"]`)).toBeVisible();
};

/** Farben (RGBA) an Anteilen der Box des Elements, aus einem Bildschirmfoto. */
const pixel = async (page: Page, element: Locator, punkte: [number, number][]) => {
	const bild = await element.screenshot();
	return page.evaluate(
		async ({ daten, liste }) => {
			const img = new Image();
			img.src = `data:image/png;base64,${daten}`;
			await img.decode();
			const c = document.createElement('canvas');
			c.width = img.width;
			c.height = img.height;
			const g = c.getContext('2d');
			g?.drawImage(img, 0, 0);
			return liste.map(([ax, ay]) => [
				...(g?.getImageData(Math.round((img.width - 1) * ax), Math.round((img.height - 1) * ay), 1, 1).data ?? []),
			]);
		},
		{ daten: bild.toString('base64'), liste: punkte },
	);
};

const bunt = (p: number[]) => Math.max(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0) - Math.min(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0) > 12;

/** Oben und unten in der Mitte des Sterns: innen gefüllt, nicht auf der Kontur. */
const OBEN_UNTEN: [number, number][] = [
	[0.5, 0.3],
	[0.5, 0.7],
];

test.describe('Aussehen: Verlauf', () => {
	test('Stern mit linearem Verlauf: bunt in Farbe, grau in s/w', async ({ page }) => {
		await oeffneBlatt(page, blattMit({ vorne: [FORM] }));
		const stern = formen(page).first();
		await waehle(page, stern, 'form');
		await fuellung(page).getByRole('button', { name: 'Verlauf', exact: true }).click();
		await expect(stern.locator('path')).toHaveAttribute('fill', /^url\(#verlauf-[a-z0-9]{4}\)$/);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Verlauf geändert');
		expect(await quelle(page)).toMatch(/<linearGradient id="verlauf-[a-z0-9]{4}" gradientTransform="rotate\(90 \.5 \.5\)">/);

		// Von der Akzentfarbe oben zur Hauptfarbe unten (Standard des ersten Verlaufs).
		const [oben, unten] = await pixel(page, stern, OBEN_UNTEN);
		expect(oben && bunt(oben)).toBe(true);
		expect(oben).not.toEqual(unten);

		await page.locator('[data-profilschalter]').getByRole('button', { name: 's/w', exact: true }).click();
		await expect(material(page).locator('body.sw')).toHaveCount(1);
		await expect
			.poll(async () => (await pixel(page, stern, OBEN_UNTEN)).some(bunt), { timeout: 5000 })
			.toBe(false);
	});

	test('Verlauf folgt der Palette', async ({ page }) => {
		await oeffneBlatt(page, blattMit({ vorne: [FORM] }));
		const stern = formen(page).first();
		await waehle(page, stern, 'form');
		await fuellung(page).getByRole('button', { name: 'Verlauf', exact: true }).click();
		const stopp = () => stern.locator('stop').last().evaluate((s) => getComputedStyle(s).stopColor);
		const vorher = await stopp();
		await aendere(page, (await quelle(page)).replace('palette-himmel', 'palette-beere'));
		await expect.poll(stopp).not.toBe(vorher);
	});

	test('Duplizieren, dann den Verlauf der Kopie ändern: Das Original bleibt', async ({ page }) => {
		await oeffneBlatt(page, blattMit({ vorne: [FORM] }));
		await waehle(page, formen(page).first(), 'form');
		await fuellung(page).getByRole('button', { name: 'Verlauf', exact: true }).click();
		await expect(formen(page).first().locator('path')).toHaveAttribute('fill', /url\(#verlauf-/);
		await page.keyboard.press('ControlOrMeta+d');
		await expect(formen(page)).toHaveCount(2);
		const ids = await formen(page).evaluateAll((alle) => alle.map((f) => f.querySelector('[id]')?.id ?? ''));
		expect(new Set(ids).size).toBe(2);

		// Gewählt ist die Kopie; ihre zweite Farbe wird Weiß.
		await fuellung(page).locator('[data-farbwahl="form-fuellung-f2"] [data-farbe="#ffffff"]').click();
		const zweite = await formen(page).evaluateAll((alle) =>
			alle.map((f) => f.querySelector('stop:last-child')?.getAttribute('style') ?? ''),
		);
		expect(zweite.filter((s) => s.includes('#ffffff'))).toHaveLength(1);
		expect(zweite.filter((s) => s.includes('var(--haupt)'))).toHaveLength(1);
	});

	test('einfarbige Füllung entfernt den Verlauf, ⌘Z holt ihn zurück', async ({ page }) => {
		await oeffneBlatt(page, blattMit({ vorne: [FORM] }));
		const stern = formen(page).first();
		await waehle(page, stern, 'form');
		await fuellung(page).getByRole('button', { name: 'Verlauf', exact: true }).click();
		await expect(stern.locator('linearGradient')).toHaveCount(1);
		await fuellung(page).getByRole('button', { name: 'Farbe', exact: true }).click();
		await expect(stern.locator('defs')).toHaveCount(0);
		await expect(stern.locator('path')).not.toHaveAttribute('fill', /url/);
		await zurueck(page).click();
		await expect(stern.locator('linearGradient')).toHaveCount(1);
	});
});

test.describe('Aussehen: Kontur, Schatten, Deckkraft', () => {
	test('gestrichelte Kontur bleibt bei doppelter Stärke im Verhältnis', async ({ page }) => {
		await oeffneBlatt(page, blattMit({ vorne: [FORM] }));
		const stern = formen(page).first();
		await waehle(page, stern, 'form');
		await page.getByRole('group', { name: 'Stil der Kontur' }).getByRole('button', { name: 'Striche' }).click();
		await expect(stern).toHaveAttribute('data-kontur-stil', 'gestrichelt');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Stil der Kontur');
		await expect(stern.locator('path')).toHaveAttribute('style', /stroke-dasharray:9 6/);

		const staerke = page.locator('[data-form-staerke]').getByRole('textbox', { name: 'Stärke der Kontur' });
		await staerke.fill('6');
		await staerke.press('Enter');
		await expect(stern.locator('path')).toHaveAttribute('style', /stroke-dasharray:18 12/);

		await page.getByRole('group', { name: 'Stil der Kontur' }).getByRole('button', { name: 'Punkte' }).click();
		await expect(stern.locator('path')).toHaveAttribute('style', /stroke-dasharray:0 12.*stroke-linecap:round|stroke-linecap:round.*stroke-dasharray:0 12/);
		await page.getByRole('group', { name: 'Stil der Kontur' }).getByRole('button', { name: 'Striche' }).click();
		await page.getByRole('group', { name: 'Enden der Kontur' }).getByRole('button', { name: 'Rund' }).click();
		await expect(stern).toHaveAttribute('data-kontur-enden', 'rund');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Enden der Kontur');
	});

	test('Schatten unter einem Bild, Deckkraft 40 % bei einem Bild hinten', async ({ page }) => {
		await oeffneBlatt(page, blattMit({ hinten: [BILD_HINTEN] }));
		const bild = material(page).locator('img.bild-frei');
		await expect(bild).toBeVisible();
		await waehle(page, bild, 'bildfrei');

		const abschnitt = page.locator('[data-abschnitt="bild"] [data-gestaltung-aussehen]');
		await abschnitt.getByRole('group', { name: 'Schatten' }).getByRole('button', { name: 'Mittel' }).click();
		await expect(bild).toHaveAttribute('data-schatten', 'mittel');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Schatten geändert');
		expect(await bild.evaluate((e) => getComputedStyle(e).filter)).toContain('drop-shadow');

		// Regler: `fill` setzt den Wert und lässt los (input, dann change), das ist genau ein Schritt.
		const vorher = await quelle(page);
		const regler = abschnitt.locator('[data-aussehen-deckkraft] input[type="range"]');
		await regler.fill('40');
		await expect(abschnitt.locator('[data-regler-wert]')).toHaveText('40 %');
		await expect.poll(() => quelle(page)).toContain(';opacity:0.4"');
		expect(vorher).not.toContain('opacity');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Deckkraft geändert');
		expect(await bild.evaluate((e) => getComputedStyle(e).opacity)).toBe('0.4');
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).not.toContain('opacity');
	});

	test('Opacity ändert die Reihenfolge in der Ebene nicht', async ({ page }) => {
		const ohneDrehen = FORM.replace(';--drehen:12deg', '');
		const rot = ohneDrehen.replace('--x:610px;--y:84px', '--x:200px;--y:200px').replace('fill:var(--akzent)', 'fill:#ff0000');
		const blau = ohneDrehen
			.replace('--x:610px;--y:84px', '--x:240px;--y:200px')
			.replace('--h:120px', '--h:120px;opacity:0.5')
			.replace('fill:var(--akzent)', 'fill:#0000ff');
		await oeffneBlatt(page, blattMit({ vorne: [rot, blau] }));
		// Im Überlapp liegt die zweite (blau, halb durchsichtig) über der ersten: Blau überwiegt, Rot scheint durch.
		const box = await formen(page).first().boundingBox();
		if (!box) {
			throw new Error('Form nicht zu sehen');
		}
		// Bei rot 70/120 von links liegt blau (40 px weiter rechts) bei 30/120: beide innen gefüllt.
		const x = box.x + (box.width * 70) / 120;
		const y = box.y + (box.height * 55) / 120;
		const bild = await page.screenshot({ clip: { x, y, width: 4, height: 4 } });
		const [p] = await page.evaluate(async (daten) => {
			const img = new Image();
			img.src = `data:image/png;base64,${daten}`;
			await img.decode();
			const c = document.createElement('canvas');
			c.width = img.width;
			c.height = img.height;
			const g = c.getContext('2d');
			g?.drawImage(img, 0, 0);
			return [[...(g?.getImageData(1, 1, 1, 1).data ?? [])]];
		}, bild.toString('base64'));
		expect(p?.[2] ?? 0).toBeGreaterThan(80);
		expect(p?.[0] ?? 0).toBeGreaterThan(80);
	});
});
