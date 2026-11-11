/**
 * Z9 (124): Eine eigene Form mit dem Stift zeichnen, mit einem Kreis vereinen, ein Rechteck abziehen. Jeder Schritt ist
 * genau ein ⌘Z, ⇧⌘Z stellt ihn wieder her. Muster: `gestaltung-pfad.spec.ts` und `gestaltung-kombinieren.spec.ts`.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const KREIS =
	'<svg class="form" data-lage="frei" data-name="Kreis" data-form="ellipse" viewBox="0 0 160 160" style="--x:200px;--y:300px;--b:160px;--h:160px">' +
	'<path d="M80 1.5 C123.4 1.5 158.5 36.6 158.5 80 C158.5 123.4 123.4 158.5 80 158.5 C36.6 158.5 1.5 123.4 1.5 80 C1.5 36.6 36.6 1.5 80 1.5 Z" style="fill:#ff0000;stroke:var(--dunkel);stroke-width:3px"/></svg>';
const RECHTECK =
	'<svg class="form" data-lage="frei" data-name="Rechteck" data-form="rechteck" viewBox="0 0 120 60" style="--x:330px;--y:410px;--b:120px;--h:60px">' +
	'<path d="M1.5 1.5 L118.5 1.5 L118.5 58.5 L1.5 58.5 Z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px"/></svg>';

const form = (page: Page, name: string) => material(page).locator(`[data-name="${name}"]`);
const pfad = (page: Page) => material(page).locator('svg.form[data-form="pfad"]');
const pfade = (q: string) => (q.match(/data-form="pfad"/g) ?? []).length;
const mehrfach = (page: Page) => page.locator('[data-gestaltung-rahmen="mehrfach"]');

const kasten = async (ziel: Locator) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return b;
};

/** ⌘Z bringt `vorher`, ⇧⌘Z wieder `nachher`. */
const einSchritt = async (page: Page, vorher: string, nachher: string) => {
	await geladen(page);
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(() => quelle(page)).toBe(vorher);
	await geladen(page);
	await page.keyboard.press('ControlOrMeta+Shift+z');
	await expect.poll(() => quelle(page)).toBe(nachher);
	await geladen(page);
	await page.keyboard.press('Escape');
};

test.describe('Z9: zeichnen, vereinen, abziehen (124)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test('Stift, Vereinen, Abziehen: je ein Schritt, ⌘Z und ⇧⌘Z', async ({ page }) => {
		const u = await uhrzeit();
		await writeFile(u.material, blattMit({ vorne: [KREIS, RECHTECK] }));
		await oeffne(page, u.id, u.dok);
		await oeffneSchublade(page, 'werkzeuge');
		await form(page, 'Kreis').evaluate((k) => k.scrollIntoView({ block: 'center' }));
		const start = await quelle(page);

		// 1. Mit P einen Kreis um den rechten Rand des roten Kreises zeichnen.
		const k = await kasten(form(page, 'Kreis'));
		const s = k.width / 160;
		const m = { x: k.x + k.width, y: k.y + k.height / 2 };
		await page.keyboard.press('KeyP');
		const zug = Array.from({ length: 40 }, (_, i) => {
			const w = (i / 39) * 2 * Math.PI;
			return { x: m.x + 50 * s * Math.cos(w), y: m.y + 50 * s * Math.sin(w) };
		});
		await page.mouse.move(zug[0]!.x, zug[0]!.y);
		await page.mouse.down();
		for (const p of zug.slice(1)) {
			await page.mouse.move(p.x, p.y, { steps: 3 });
		}
		await page.mouse.up();
		await expect.poll(async () => pfade(await quelle(page))).toBe(1);
		const gezeichnet = await quelle(page);
		await einSchritt(page, start, gezeichnet);

		// 2. Den gezeichneten Pfad mit dem Kreis vereinen.
		await pfad(page).click({ position: { x: Math.round(80 * s), y: Math.round(20 * s) } });
		await form(page, 'Kreis').click({
			modifiers: ['Shift'],
			position: { x: Math.round(30 * s), y: Math.round(80 * s) },
		});
		await expect(mehrfach(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
		await page.locator('[data-kombinieren] [data-befehl="auswahl.vereinen"]').click();
		await expect.poll(async () => (await quelle(page)).includes('data-form="ellipse"')).toBe(false);
		const vereint = await quelle(page);
		expect(pfade(vereint)).toBe(1);
		await einSchritt(page, gezeichnet, vereint);

		// 3. Das Rechteck abziehen.
		await pfad(page).click({ position: { x: Math.round(40 * s), y: Math.round(80 * s) } });
		const r = await kasten(form(page, 'Rechteck'));
		await form(page, 'Rechteck').click({
			modifiers: ['Shift'],
			position: { x: Math.round(r.width - 8 * s), y: Math.round(r.height - 8 * s) },
		});
		await expect(mehrfach(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
		await page
			.locator('[data-gestaltungsleiste="mehrfach"]')
			.getByRole('button', { name: /^Mehr zu/ })
			.click();
		await page.locator('[data-befehl="auswahl.abziehen"]').click();
		await expect.poll(async () => (await quelle(page)).includes('data-form="rechteck"')).toBe(false);
		const abgezogen = await quelle(page);
		expect(pfade(abgezogen)).toBe(1);
		await einSchritt(page, vereint, abgezogen);
	});
});
