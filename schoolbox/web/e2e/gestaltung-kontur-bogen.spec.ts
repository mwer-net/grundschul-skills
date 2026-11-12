import type { Locator, Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, SCHMUCK_BOGEN } from './gestaltung-daten';
import { expect, test } from './hilfe';

/**
 * 110: Schmuckschrift mit Kontur (HTML) und Titel im Bogen (SVG mit textPath). Jede Änderung ist ein Schritt; der
 * Regler einer beim Loslassen. Der Pixelvergleich Safari gegen PDF läuft in `mac-safari` mit derselben Spec.
 */

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const titel = (page: Page) => material(page).locator('div.schmuck[data-schmuck="titel"]');
const bogen = (page: Page) => material(page).locator('svg.schmuck[data-schmuck="bogen"]');

/** Ein dunkler Titel mit weißer Kontur auf einem dunklen Streifen, damit der Rand zu sehen ist. */
const MIT_KONTUR =
	'<div class="schmuck" data-lage="frei" data-schmuck="titel" data-kontur="" style="--x:80px;--y:220px;--gr:72px;--farbe:#000000;--kontur:10px;--kontur-farbe:#ffffff">Mmm</div>';
const TITEL =
	'<div class="schmuck" data-lage="frei" data-schmuck="titel" style="--x:80px;--y:220px;--gr:56px">Zirkus</div>';
const STREIFEN = '<div data-lage="frei" style="--x:0px;--y:180px;--b:794px;--h:200px;background:#e11d48"></div>';

const oeffneBlatt = async (page: Page, vorne: string[], hinten: string[] = []) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, blattMit({ vorne, hinten }));
};

const waehle = async (page: Page, element: Locator, art: string) => {
	await element.click();
	await expect(page.locator(`[data-gestaltung-inspektor="${art}"]`)).toBeVisible();
};

const pixelListe = async (page: Page, element: Locator) => {
	const bild = await element.screenshot();
	return page.evaluate(async (daten) => {
		const img = new Image();
		img.src = `data:image/png;base64,${daten}`;
		await img.decode();
		const c = document.createElement('canvas');
		c.width = img.width;
		c.height = img.height;
		const g = c.getContext('2d');
		g?.drawImage(img, 0, 0);
		return { b: img.width, h: img.height, daten: [...(g?.getImageData(0, 0, img.width, img.height).data ?? [])] };
	}, bild.toString('base64'));
};

test.describe('Schmuckschrift mit Kontur', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Inspektor nur am Mac');

	test('Rand weiß um dunkle Buchstaben', async ({ page }) => {
		await oeffneBlatt(page, [MIT_KONTUR], [STREIFEN]);
		const bild = await pixelListe(page, titel(page));
		// Es gibt dunkle (Füllung) und weiße (Kontur) Pixel im Ausschnitt über dem roten Streifen.
		let dunkel = 0;
		let weiss = 0;
		for (let i = 0; i < bild.daten.length; i += 4) {
			const [r = 0, g = 0, b = 0] = bild.daten.slice(i, i + 3);
			if (r + g + b < 120) {
				dunkel += 1;
			}
			if (r > 240 && g > 240 && b > 240) {
				weiss += 1;
			}
		}
		expect(dunkel).toBeGreaterThan(200);
		expect(weiss).toBeGreaterThan(200);
	});

	test('Schalter „Kontur“ im Inspektor, je ein Schritt; Stärke und Farbe', async ({ page }) => {
		await oeffneBlatt(page, [TITEL]);
		await waehle(page, titel(page), 'schmuck');
		const schalter = page.getByRole('switch', { name: 'Kontur', exact: true });
		await expect(schalter).toHaveAttribute('aria-checked', 'false');
		await schalter.click();
		await expect.poll(() => quelle(page)).toMatch(/data-kontur=""[^>]*--kontur:6px;--kontur-farbe:#ffffff/);
		await expect(schalter).toHaveAttribute('aria-checked', 'true');
		await page.getByRole('textbox', { name: 'Konturstärke' }).fill('9');
		await page.keyboard.press('Enter');
		await expect.poll(() => quelle(page)).toContain('--kontur:9px');
		await schalter.click();
		await expect.poll(() => quelle(page)).not.toContain('data-kontur');
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toContain('--kontur:9px');
	});

	test('in s/w bleibt die weiße Kontur weiß, die Schrift grau', async ({ page }) => {
		await oeffneBlatt(
			page,
			[MIT_KONTUR.replace('#000000', 'var(--haupt)')],
			[STREIFEN.replace('#e11d48', '#9ca3af')],
		);
		await page.locator('[data-profilschalter]').getByRole('button', { name: 's/w', exact: true }).click();
		await expect(material(page).locator('body.sw')).toHaveCount(1);
		const bild = await pixelListe(page, titel(page));
		let bunt = 0;
		for (let i = 0; i < bild.daten.length; i += 4) {
			const [r = 0, g = 0, b = 0] = bild.daten.slice(i, i + 3);
			if (Math.max(r, g, b) - Math.min(r, g, b) > 12) {
				bunt += 1;
			}
		}
		expect(bunt).toBe(0);
	});
});

test.describe('Titel im Bogen', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Inspektor nur am Mac');

	test('einschalten, Krümmung ändern, Text ändern, ausschalten: je ein Schritt', async ({ page }) => {
		await oeffneBlatt(page, [TITEL]);
		const start = await quelle(page);
		await waehle(page, titel(page), 'schmuck');
		await page.getByRole('switch', { name: 'Bogen', exact: true }).click();
		await expect.poll(() => quelle(page)).toContain('data-schmuck="bogen"');
		await expect(bogen(page)).toHaveCount(1);
		await expect.poll(() => quelle(page)).toContain('>Zirkus</textPath>');
		await expect(page.locator('[data-gestaltung-inspektor="schmuckbogen"]')).toBeVisible();

		const regler = page.locator('[data-regler="Krümmung"] input');
		await regler.fill('-60');
		await expect.poll(() => quelle(page)).toContain('data-bogen="-60"');

		const feld = page.locator('[data-leiste-bogen-text]');
		await feld.fill('Mathe-Zirkus');
		await page.keyboard.press('Enter');
		await expect.poll(() => quelle(page)).toContain('>Mathe-Zirkus</textPath>');

		const schalter = page.getByRole('switch', { name: 'Bogen', exact: true });
		await expect(schalter).toHaveAttribute('aria-checked', 'true');
		await schalter.click();
		await expect.poll(() => quelle(page)).toContain('data-schmuck="titel"');

		for (let i = 0; i < 4; i += 1) {
			await zurueck(page).click();
		}
		await expect.poll(() => quelle(page)).toBe(start);
	});

	test('Esc im Feld verwirft', async ({ page }) => {
		await oeffneBlatt(page, [SCHMUCK_BOGEN]);
		await waehle(page, bogen(page), 'schmuckbogen');
		const vorher = await quelle(page);
		const feld = page.locator('[data-leiste-bogen-text]');
		await feld.fill('Etwas anderes');
		await page.keyboard.press('Escape');
		await expect(feld).toHaveValue('Zahlenzirkus');
		expect(await quelle(page)).toBe(vorher);
	});

	test('Doppelklick auf den Bogen öffnet das Feld mit Fokus', async ({ page }) => {
		await oeffneBlatt(page, [SCHMUCK_BOGEN]);
		await waehle(page, bogen(page), 'schmuckbogen');
		await bogen(page).dblclick();
		await expect(page.locator('[data-leiste-bogen-text]')).toBeFocused();
	});

	test('in s/w: der Bogen ist grau, die weiße Kontur bleibt weiß', async ({ page }) => {
		await oeffneBlatt(page, [SCHMUCK_BOGEN]);
		await page.locator('[data-profilschalter]').getByRole('button', { name: 's/w', exact: true }).click();
		await expect(material(page).locator('body.sw')).toHaveCount(1);
		const text = bogen(page).locator('text');
		const farben = await text.evaluate((e) => {
			const s = getComputedStyle(e);
			return { fill: s.fill, stroke: s.stroke };
		});
		const kanaele = (f: string) => (f.match(/\d+/g) ?? []).slice(0, 3).map(Number);
		const [r = 0, g = 0, b = 0] = kanaele(farben.fill);
		expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(6);
		expect(kanaele(farben.stroke)).toEqual([255, 255, 255]);
	});
});
