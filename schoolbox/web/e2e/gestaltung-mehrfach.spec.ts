/**
 * Mehrfachauswahl, Ausrichten und Verteilen (113, Briefing 5.9 und 5.11). Drei Kreise mit Namen A, B, C auf Seite 1;
 * jede Aktion an mehreren ist ein Schritt, ⌘Z nimmt sie ganz zurück.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import type { Einsatz } from './gestaltung-daten';
import { blattMit, FIGUR_ANKER } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { schubladenKnopf } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const kreis = (name: string, x: number, y: number, b = 80) =>
	`<svg class="form" data-lage="frei" data-name="${name}" data-form="kreis" viewBox="0 0 100 100" style="--x:${x}px;--y:${y}px;--b:${b}px;--h:${b}px"><circle cx="50" cy="50" r="48" style="fill:var(--akzent)"/></svg>`;

const A = kreis('A', 100, 600);
const B = kreis('B', 260, 640, 60);
const C = kreis('C', 520, 700);
const DREI = [A, B, C];

const blatt = async (page: Page, einsatz: Einsatz = { vorne: DREI }) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit(einsatz));
	await oeffne(page, u.id, u.dok);
	return u;
};

const form = (page: Page, name: string) => material(page).locator(`[data-name="${name}"]`);
const rahmen = (page: Page) => page.locator('[data-gestaltung-rahmen="mehrfach"]');
const geladen = (page: Page) => expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();

/** `--x`/`--y` eines Elements in der Quelle. */
const lage = (q: string, name: string) => {
	const m = new RegExp(`data-name="${name}"[^>]*--x:(-?\\d+)px;--y:(-?\\d+)px`).exec(q);
	return { x: Number(m?.[1]), y: Number(m?.[2]) };
};

const mitte = async (ziel: Locator) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const ziehe = async (page: Page, von: { x: number; y: number }, dx: number, dy: number) => {
	await page.mouse.move(von.x, von.y);
	await page.mouse.down();
	await page.mouse.move(von.x + dx / 2, von.y + dy / 2, { steps: 4 });
	await page.mouse.move(von.x + dx, von.y + dy, { steps: 4 });
	await page.mouse.up();
};

const waehleDrei = async (page: Page) => {
	await form(page, 'A').click();
	await form(page, 'B').click({ modifiers: ['Shift'] });
	await form(page, 'C').click({ modifiers: ['Shift'] });
	await expect(rahmen(page)).toHaveAttribute('data-mehrfach-anzahl', '3');
};

/** ⌘Z bringt genau den Stand vor der Aktion zurück: Es war ein Schritt. */
const einSchritt = async (page: Page, vorher: string) => {
	await expect.poll(() => quelle(page)).not.toBe(vorher);
	await geladen(page);
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(() => quelle(page)).toBe(vorher);
};

test.describe('Mehrfachauswahl (113)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test('⇧-Klick nimmt dazu und wieder weg, Klick ohne ⇧ wählt eins', async ({ page }) => {
		await blatt(page);
		await form(page, 'A').click();
		await form(page, 'B').click({ modifiers: ['Shift'] });
		await expect(rahmen(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
		await expect(page.locator('[data-mehrfach-umriss]')).toHaveCount(2);
		await expect(page.locator('[data-gestaltungsleiste="mehrfach"]')).toBeVisible();
		await form(page, 'B').click({ modifiers: ['Shift'] });
		await expect(rahmen(page)).toHaveCount(0);
		await form(page, 'C').click({ modifiers: ['Shift'] });
		await expect(rahmen(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
		await form(page, 'B').click();
		await expect(rahmen(page)).toHaveCount(0);
		await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
	});

	test('Gummiband auf freier Fläche wählt, was ganz darin liegt', async ({ page }) => {
		await blatt(page);
		const a = await form(page, 'A').boundingBox();
		const b = await form(page, 'B').boundingBox();
		if (!a || !b) {
			throw new Error('nicht sichtbar');
		}
		await ziehe(page, { x: a.x - 15, y: a.y - 15 }, b.x + b.width + 30 - a.x, b.y + b.height + 30 - a.y);
		await expect(rahmen(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
	});

	test('Ziehen bewegt alle als einen Schritt', async ({ page }) => {
		await blatt(page);
		await waehleDrei(page);
		const vorher = await quelle(page);
		await ziehe(page, await mitte(form(page, 'B')), 40, 30);
		await expect.poll(async () => lage(await quelle(page), 'A').x).not.toBe(100);
		const q = await quelle(page);
		const dx = lage(q, 'A').x - 100;
		expect(dx).toBeGreaterThan(0);
		expect(lage(q, 'B').x - 260).toBe(dx);
		expect(lage(q, 'C').x - 520).toBe(dx);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Drehen am gemeinsamen Griff ist ein Schritt', async ({ page }) => {
		await blatt(page);
		await waehleDrei(page);
		const vorher = await quelle(page);
		const g = await mitte(page.locator('[data-gestaltung-rahmen="mehrfach"] [data-gestaltung-griff="drehen"]'));
		await ziehe(page, g, 120, 60);
		await expect.poll(() => quelle(page)).toContain('--drehen:');
		expect((await quelle(page)).match(/--drehen:/g)?.length).toBeGreaterThanOrEqual(3);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('⌫ löscht alle, ⌘Z holt alle zurück', async ({ page }) => {
		await blatt(page);
		await waehleDrei(page);
		const vorher = await quelle(page);
		await page.keyboard.press('Backspace');
		await expect.poll(() => quelle(page)).not.toContain('data-name="B"');
		const q = await quelle(page);
		expect(q).not.toContain('data-name="A"');
		expect(q).not.toContain('data-name="C"');
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Pfeiltaste schiebt alle drei um 1 px', async ({ page }) => {
		await blatt(page);
		await waehleDrei(page);
		const vorher = await quelle(page);
		await page.keyboard.press('ArrowRight');
		await expect.poll(async () => lage(await quelle(page), 'C').x).toBe(521);
		const q = await quelle(page);
		expect(lage(q, 'A').x).toBe(101);
		expect(lage(q, 'B').x).toBe(261);
		await einSchritt(page, vorher);
	});

	test('Ausrichten links und Verteilen waagerecht, je ein Schritt', async ({ page }) => {
		await blatt(page);
		await waehleDrei(page);
		const vorher = await quelle(page);
		await page.locator('[data-gestaltungsleiste="mehrfach"]').getByRole('button', { name: 'Ausrichten' }).click();
		await page.locator('[data-befehl="auswahl.ausrichten-links"]').click();
		await expect.poll(async () => lage(await quelle(page), 'C').x).toBe(100);
		expect(lage(await quelle(page), 'B').x).toBe(100);
		await einSchritt(page, vorher);

		await waehleDrei(page);
		await page.locator('[data-gestaltungsleiste="mehrfach"]').getByRole('button', { name: 'Verteilen' }).click();
		await page.locator('[data-befehl="auswahl.verteilen-waagerecht"]').click();
		// A endet bei 180, C beginnt bei 520: 340 Platz minus 60 für B, zweimal 140 Lücke. B beginnt bei 320.
		await expect.poll(async () => lage(await quelle(page), 'B').x).toBe(320);
		await einSchritt(page, vorher);
	});

	test('⌥A richtet aus, nicht beim Tippen', async ({ page }) => {
		await blatt(page);
		await waehleDrei(page);
		await page.keyboard.press('Alt+KeyA');
		await expect.poll(async () => lage(await quelle(page), 'C').x).toBe(100);
	});

	test('der Inspektor zeigt „gemischt“ bei verschiedenen Füllungen', async ({ page }) => {
		await blatt(page, { vorne: [A, B.replace('var(--akzent)', 'var(--haupt)'), C] });
		await waehleDrei(page);
		await expect(page.locator('[data-hinweis="mehrfach"]')).toContainText('3 Elemente');
		await expect(page.locator('[data-gestaltung-fuellung="mehrfach"] [data-gemischt]')).toBeVisible();
		await expect(page.locator('[data-gestaltung-position="mehrfach"]')).toBeVisible();
	});

	test('⇧-Klick in den Ebenen nimmt dazu', async ({ page }) => {
		await blatt(page);
		await form(page, 'A').click();
		await schubladenKnopf(page, 'ebenen').click();
		const zeile = page
			.locator('[data-zeilen-art="vorne"]')
			.filter({ hasText: /^C/ })
			.locator('[data-gliederung-titel]');
		await zeile.click({ modifiers: ['Shift'] });
		await expect(rahmen(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
	});

	test('Wilma am Anker und eine Blase bewegen sich gemeinsam', async ({ page }) => {
		await blatt(page, { vorne: [A], anker: [FIGUR_ANKER] });
		await material(page).locator('img.figur-frei').click();
		await form(page, 'A').click({ modifiers: ['Shift'] });
		await expect(rahmen(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
		const vorher = await quelle(page);
		await page.keyboard.press('ArrowDown');
		await expect.poll(async () => lage(await quelle(page), 'A').y).toBe(601);
		expect(await quelle(page)).not.toBe(vorher);
	});
});
