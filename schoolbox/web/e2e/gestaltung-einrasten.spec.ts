/**
 * Einrasten mit Hilfslinien, Reihenfolge, Pfeiltasten und Durchblick (100). Quelle mit eigenen Formen, direkt in die
 * Ablage geschrieben. Das Blatt aus `blattMit` ist A4 hoch (794 px breit, Seitenmitte bei 397 px).
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import type { Einsatz } from './gestaltung-daten';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';

const MAUS = ['chromium', 'mac-safari'];

/** Gerade, nicht gedreht: Mitte bei x = 250. */
const RECHTECK =
	'<svg class="form" data-lage="frei" data-form="rechteck" viewBox="0 0 100 60" preserveAspectRatio="none" style="--x:200px;--y:420px;--b:100px;--h:60px"><rect x="0" y="0" width="100" height="60" style="fill:var(--akzent)"/></svg>';

const KREIS =
	'<svg class="form" data-lage="frei" data-form="kreis" viewBox="0 0 100 100" style="--x:230px;--y:430px;--b:100px;--h:100px"><circle cx="50" cy="50" r="48" style="fill:var(--haupt)"/></svg>';

const blatt = async (page: Page, einsatz: Einsatz) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit(einsatz));
	await oeffne(page, u.id, u.dok);
	return u;
};

const rechteck = (page: Page) => material(page).locator('svg.form[data-form="rechteck"]');
const kreis = (page: Page) => material(page).locator('svg.form[data-form="kreis"]');
const rahmen = (page: Page) => page.locator('[data-gestaltung-rahmen]');
const geladen = (page: Page) => expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
const auswahlName = (page: Page) => page.locator('[data-auswahl] h2');

const skalaVon = (page: Page) =>
	page.evaluate(() => {
		const f = document.querySelector<HTMLElement>('[data-editor-rahmen="sichtbar"]');
		return f ? f.getBoundingClientRect().width / f.offsetWidth : 1;
	});

/** Eine Stelle links im Element, die die Form trifft (nicht der Kreis darüber). */
const griffpunkt = async (ziel: Locator) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return { x: b.x + 6, y: b.y + b.height / 2 };
};

const ziehe = async (
	page: Page,
	von: { x: number; y: number },
	dx: number,
	dy: number,
	mittendrin?: () => Promise<void>,
	vorher?: () => Promise<void>,
) => {
	await page.mouse.move(von.x, von.y);
	await page.mouse.down();
	await page.mouse.move(von.x + dx / 3, von.y + dy / 3, { steps: 3 });
	await vorher?.();
	await page.mouse.move(von.x + dx, von.y + dy, { steps: 6 });
	await mittendrin?.();
	await page.mouse.up();
};

test.describe('Einrasten, Reihenfolge, Pfeile, Durchblick (100)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit Maus und Tastatur');

	test('Ziehen nahe der Seitenmitte rastet ein und zeigt eine Hilfslinie', async ({ page }) => {
		await blatt(page, { vorne: [RECHTECK] });
		await rechteck(page).click();
		await expect(rahmen(page)).toBeVisible();
		const skala = await skalaVon(page);
		// 145 px nach rechts: Mitte bei 395, 2 px neben der Seitenmitte.
		await ziehe(page, await griffpunkt(rechteck(page)), 145 * skala, 0, async () => {
			await expect(page.locator('[data-hilfslinie]').first()).toBeVisible();
		});
		await expect.poll(() => quelle(page)).toContain('--x:347px');
		await expect(page.locator('[data-hilfslinie]')).toHaveCount(0);
	});

	test('⌘ während der Geste schaltet das Einrasten aus', async ({ page }) => {
		await blatt(page, { vorne: [RECHTECK] });
		await rechteck(page).click();
		const skala = await skalaVon(page);
		await ziehe(
			page,
			await griffpunkt(rechteck(page)),
			145 * skala,
			0,
			async () => {
				await expect(page.locator('[data-hilfslinie]')).toHaveCount(0);
			},
			() => page.keyboard.down('Meta'),
		);
		await page.keyboard.up('Meta');
		await expect.poll(() => quelle(page)).toContain('--x:345px');
	});

	test('⌥⇧⌘F bringt ein Element über ein anderes; ⇧⌘B von ganz hinten in „vorne“ wechselt nach „hinten“', async ({
		page,
	}) => {
		await blatt(page, { vorne: [RECHTECK, KREIS] });
		await rechteck(page).click({ position: { x: 6, y: 30 } });
		await expect(rahmen(page)).toBeVisible();
		const vorher = await quelle(page);
		expect(vorher.indexOf('data-form="rechteck"')).toBeLessThan(vorher.indexOf('data-form="kreis"'));

		await page.keyboard.press('Alt+Shift+Meta+KeyF');
		await expect
			.poll(async () => {
				const q = await quelle(page);
				return q.indexOf('data-form="kreis"') < q.indexOf('data-form="rechteck"');
			})
			.toBe(true);
		await geladen(page);
		await expect(rahmen(page)).toBeVisible();

		// Der Kreis liegt jetzt zuunterst in „vorne“: ganz nach hinten wechselt die Ebene.
		await kreis(page).click({ position: { x: 90, y: 50 } });
		await page.keyboard.press('Shift+Meta+KeyB');
		await expect(material(page).locator('.ebene.hinten svg[data-form="kreis"]')).toHaveCount(1);
		await expect(material(page).locator('.ebene.vorne svg[data-form="rechteck"]')).toHaveCount(1);
	});

	test('Pfeil → schiebt 1 px, ⇧→ 10 px, je ein Schritt; bei einem Baustein wählt ↓ den nächsten', async ({ page }) => {
		await blatt(page, { vorne: [RECHTECK] });
		await rechteck(page).click();
		await expect(rahmen(page)).toBeVisible();

		await page.keyboard.press('ArrowRight');
		await expect.poll(() => quelle(page)).toContain('--x:201px');
		await geladen(page);
		await page.keyboard.press('Shift+ArrowRight');
		await expect.poll(() => quelle(page)).toContain('--x:211px');
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+KeyZ');
		await expect.poll(() => quelle(page)).toContain('--x:201px');
		await geladen(page);

		// Gehalten: der erste Druck ist ein Schritt, die Wiederholungen ein weiterer beim Loslassen.
		await rechteck(page).click();
		await page.keyboard.down('ArrowDown');
		await expect.poll(() => quelle(page)).toContain('--y:421px');
		await geladen(page);
		await page.keyboard.down('ArrowDown');
		await page.keyboard.down('ArrowDown');
		await page.keyboard.down('ArrowDown');
		await page.keyboard.up('ArrowDown');
		await expect.poll(() => quelle(page)).toContain('--y:424px');
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+KeyZ');
		await expect.poll(() => quelle(page)).toContain('--y:421px');
		await geladen(page);

		// Baustein: Pfeile wählen wie vorher.
		const vorher = await quelle(page);
		await material(page).locator('.aufgabe').first().locator('.anw .text').click();
		await page.keyboard.press('Escape');
		await expect(auswahlName(page)).toHaveText('Aufgabe 1');
		await page.keyboard.press('ArrowDown');
		await expect(auswahlName(page)).toHaveText('Aufgabe 2');
		expect(await quelle(page)).toBe(vorher);
	});

	test('G halten zeigt den Durchblick, Loslassen versteckt ihn; nichts davon im Material', async ({ page }) => {
		const ausgeblendet = RECHTECK.replace('data-form="rechteck"', 'data-form="rechteck" data-aus');
		await blatt(page, { vorne: [ausgeblendet, KREIS] });
		await kreis(page).click();
		await expect(rahmen(page)).toBeVisible();
		await expect(page.locator('[data-durchblick]')).toHaveCount(0);

		await page.keyboard.down('g');
		await expect(page.locator('[data-durchblick]')).toBeVisible();
		await expect(page.locator('[data-durchblick-stapel]')).toHaveCount(1);
		await expect(page.locator('[data-durchblick] [data-druckrand]')).toHaveCount(1);
		await expect(page.locator('[data-durchblick-aus]')).toHaveCount(1);
		await expect(material(page).locator('[data-durchblick], [data-druckrand]')).toHaveCount(0);

		await page.keyboard.up('g');
		await expect(page.locator('[data-durchblick]')).toHaveCount(0);
	});
});
