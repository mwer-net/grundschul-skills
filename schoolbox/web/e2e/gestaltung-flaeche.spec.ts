/**
 * Fläche im Stapel (115): ein Baustein mit Platz zum freien Gestalten. Elemente kommen per Ziehen, per „In den Stapel“
 * im ⋯ und mit ⌘ aus der Schublade hinein und wieder heraus; die Lage im Blatt bleibt, je ein Schritt. Die Höhe zieht
 * man am Griff unter der Fläche, ragt etwas über den Rand, meldet die Prüfung `abgeschnitten`.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, FORM } from './gestaltung-daten';
import { expect, test } from './hilfe';

const MAUS = ['chromium', 'mac-safari'];

const LEER = '<div class="flaeche" style="--h:240px"></div>';

const form = (page: Page) => material(page).locator('svg.form');
const flaeche = (page: Page) => material(page).locator('.flaeche');
const zurueck = (page: Page) => page.getByRole('button', { name: /^Rückgängig/ }).first();
const hoehenGriff = (page: Page) => page.locator('[data-gestaltung-griff="hoehe"]');

const blatt = async (page: Page, html: string) => {
	const u = await uhrzeit();
	await writeFile(u.material, html);
	await oeffne(page, u.id, u.dok);
	return u;
};

const kasten = async (ziel: Locator) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return b;
};

/** Die Lage der Form im Blatt, relativ zur ersten Seite: unabhängig vom Rollen. */
const imBlatt = async (page: Page) => {
	const f = await kasten(form(page));
	const s = await kasten(material(page).locator('.seite').first());
	return { x: f.x - s.x, y: f.y - s.y };
};

const gleich = (a: { x: number; y: number }, b: { x: number; y: number }) => {
	expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
};

const ziehe = async (page: Page, von: { x: number; y: number }, nach: { x: number; y: number }) => {
	await page.mouse.move(von.x, von.y);
	await page.mouse.down();
	await page.mouse.move(nach.x, nach.y, { steps: 10 });
};

const mitteVon = async (ziel: Locator) => {
	const b = await kasten(ziel);
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test.describe('Fläche im Stapel (115)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
	});

	test('Form auf die Fläche ziehen legt sie hinein, ein Schritt; die Lage im Blatt bleibt; heraus ziehen nimmt sie wieder', async ({
		page,
	}) => {
		await blatt(page, blattMit({ vorne: [FORM], stapel: [LEER] }));
		await form(page).scrollIntoViewIfNeeded();
		await form(page).click();
		const vorher = await quelle(page);
		const start = await mitteVon(form(page));
		const ziel = await mitteVon(flaeche(page));
		await ziehe(page, start, ziel);
		await expect(page.locator('[data-wert-am-zeiger]')).toHaveText('In die Fläche');
		await page.mouse.up();
		await expect.poll(async () => (await quelle(page)) !== vorher).toBe(true);
		await expect(flaeche(page).locator('svg.form')).toHaveCount(1);
		await expect(material(page).locator('.ebene svg.form')).toHaveCount(0);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'In die Fläche gelegt');

		// Wieder heraus, auf die Seite über der Fläche.
		const drin = await mitteVon(form(page));
		const seite = await kasten(material(page).locator('.seite').first());
		await ziehe(page, drin, { x: seite.x + seite.width / 2, y: seite.y + 80 });
		await expect(page.locator('[data-wert-am-zeiger]')).toHaveText('Aus der Fläche');
		await page.mouse.up();
		await expect(material(page).locator('.ebene.vorne svg.form, .ebene svg.form')).toHaveCount(1);
		await expect(flaeche(page).locator('svg.form')).toHaveCount(0);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Aus der Fläche genommen');
	});

	test('„In den Stapel“ im ⋯: neue Fläche um die Form, ein Schritt, die Lage im Blatt bleibt', async ({ page }) => {
		await blatt(page, blattMit({ vorne: [FORM] }));
		await form(page).scrollIntoViewIfNeeded();
		await form(page).click();
		const vorher = await imBlatt(page);
		await page.getByRole('button', { name: /^Mehr zu / }).click();
		await page.getByRole('menuitem', { name: 'In den Stapel' }).click();
		await expect(flaeche(page)).toHaveCount(1);
		await expect(flaeche(page).locator('svg.form')).toHaveCount(1);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'In den Stapel gelegt');
		// Fläche = Höhe der Form + 2 × 16 px Rand
		const f = await kasten(flaeche(page));
		const h = await kasten(form(page));
		expect(Math.abs(f.height - h.height - 32)).toBeLessThanOrEqual(2);
		await zurueck(page).click();
		await expect(flaeche(page)).toHaveCount(0);
		gleich(await imBlatt(page), vorher);
	});

	test('Höhe am Griff unter der Fläche: ein Schritt, Mindesthöhe 40, ⌘Z stellt sie wieder her', async ({ page }) => {
		await blatt(page, blattMit({ stapel: [LEER] }));
		await flaeche(page).scrollIntoViewIfNeeded();
		await flaeche(page).click({ position: { x: 20, y: 20 } });
		const alt = (await kasten(flaeche(page))).height;
		const g = await mitteVon(hoehenGriff(page));
		await ziehe(page, g, { x: g.x, y: g.y + 60 });
		await expect(page.locator('[data-wert-am-zeiger]')).toContainText('Höhe');
		await page.mouse.up();
		await expect.poll(async () => (await kasten(flaeche(page))).height).toBeGreaterThan(alt + 40);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Höhe der Fläche geändert');
		await zurueck(page).click();
		await expect.poll(async () => (await kasten(flaeche(page))).height).toBeCloseTo(alt, 0);

		const g2 = await mitteVon(hoehenGriff(page));
		await ziehe(page, g2, { x: g2.x, y: g2.y - 2000 });
		await page.mouse.up();
		await expect.poll(async () => (await kasten(flaeche(page))).height).toBeLessThanOrEqual(60);
		expect(await quelle(page)).toMatch(/class="flaeche" style="--h:40px"/);
	});

	test('Ragt ein Element über den Rand hinaus, meldet die Prüfung „abgeschnitten“', async ({ page }) => {
		await blatt(page, blattMit({ stapel: [LEER.replace('240px', '60px').replace('></div>', `>${FORM}</div>`)] }));
		const pruefung = page.locator('[data-pruefung] > button');
		await expect(pruefung).toContainText('prüfen');
		await pruefung.click();
		await expect(page.getByText(/ist ein Teil nicht zu sehen/).first()).toBeVisible();
	});

	test('Die Ebenen zeigen die Elemente einer Fläche unter ihr', async ({ page }) => {
		await blatt(page, blattMit({ stapel: [LEER.replace('></div>', `>${FORM}</div>`)] }));
		// Wie jeder Baustein steht die Fläche zugeklappt da.
		await page
			.locator('[data-zeile-nr]', { hasText: /^Fläche/ })
			.getByRole('button', { name: 'Aufklappen' })
			.click();
		await expect(page.locator('[data-zeilen-art="flaeche"]')).toHaveCount(1);
	});
});
