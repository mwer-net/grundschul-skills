/**
 * Gruppen (120, Briefing 5.11): Wilma und eine Sprechblase werden mit ⌘G eine Gruppe, die sich als Ganzes zieht,
 * dreht und skaliert; ⇧⌘G löst sie wieder, die Teile bleiben an ihrem Platz. Doppelklick wählt ein Teil, Esc die
 * Gruppe.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import type { Einsatz } from './gestaltung-daten';
import { blattMit, FIGUR_ANKER } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const WILMA =
	'<img class="figur-frei" data-lage="frei" data-name="Wilma" data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:300px;--y:560px;--b:130px">';
const BLASE =
	'<div class="form-text" data-lage="frei" data-name="Blase" data-form="sprechblase" style="--x:120px;--y:520px;--b:180px;--h:84px">' +
	'<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="2" y="2" width="176" height="80" rx="18" style="fill:#fff;stroke:var(--dunkel);stroke-width:3px"/></svg>' +
	'<div class="form-inhalt">Hallo!</div></div>';

const blatt = async (page: Page, einsatz: Einsatz = { vorne: [WILMA, BLASE] }) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit(einsatz));
	await oeffne(page, u.id, u.dok);
	return u;
};

const teil = (page: Page, name: string) => material(page).locator(`[data-name="${name}"]`);
const gruppe = (page: Page) => material(page).locator('.gruppe');
const mehrfach = (page: Page) => page.locator('[data-gestaltung-rahmen="mehrfach"]');

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

/** Wie die Teile auf dem Blatt liegen (Bildschirm), gerundet. */
const kaesten = async (page: Page) => {
	const runde = async (name: string) => {
		const b = await teil(page, name).boundingBox();
		return b && [b.x, b.y, b.width, b.height].map(Math.round);
	};
	return { wilma: await runde('Wilma'), blase: await runde('Blase') };
};

const gruppiere = async (page: Page) => {
	await teil(page, 'Wilma').click();
	await teil(page, 'Blase').click({ modifiers: ['Shift'] });
	await expect(mehrfach(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
	await page.keyboard.press('ControlOrMeta+g');
	await expect(gruppe(page)).toHaveCount(1);
	await geladen(page);
};

test.describe('Gruppen (120)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test('⌘G gruppiert in einem Schritt, die Teile bleiben, wo sie waren', async ({ page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		const lage = await kaesten(page);
		await gruppiere(page);
		await expect(gruppe(page).locator('[data-name]')).toHaveCount(2);
		expect(await kaesten(page)).toEqual(lage);
		await expect(page.locator('[data-gruppe-teile]')).toHaveText('Gruppe · 2 Teile');
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Ziehen, Drehen, Skalieren an der Gruppe; ⇧⌘G löst, die Teile bleiben', async ({ page }) => {
		await blatt(page);
		await gruppiere(page);
		await ziehe(page, await mitte(teil(page, 'Wilma')), 60, 40);
		// Die Gruppe beginnt bei x 120 (die Blase), nach dem Ziehen weiter rechts.
		await expect.poll(() => quelle(page)).not.toMatch(/class="gruppe"[^>]*--x:120px/);
		await geladen(page);

		await page.locator('[data-gestaltungsleiste] [data-drehen]').click();
		await expect.poll(() => quelle(page)).toMatch(/class="gruppe"[^>]*--drehen:/);
		await geladen(page);

		// Gedreht reicht die Gruppe bis unter die Statusleiste; in der Mitte ist die Ecke frei.
		await gruppe(page).evaluate((g) => g.scrollIntoView({ block: 'center' }));
		const ecke = page.locator('[data-gestaltung-rahmen] [data-gestaltung-griff="unten-rechts"]');
		const breite = (await teil(page, 'Blase').boundingBox())?.width ?? 0;
		// Die Gruppe ist gedreht: vom Mittelpunkt des Rahmens weg nach außen ziehen, wo auch immer die Ecke jetzt liegt.
		const e = await mitte(ecke);
		const m = await mitte(page.locator('[data-gestaltung-rahmen]'));
		await ziehe(page, e, Math.sign(e.x - m.x) * 50, Math.sign(e.y - m.y) * 50);
		await expect
			.poll(async () => (await teil(page, 'Blase').boundingBox())?.width ?? 0)
			.toBeGreaterThan(breite + 5);
		await geladen(page);

		const lage = await kaesten(page);
		await page.keyboard.press('ControlOrMeta+Shift+g');
		await expect(gruppe(page)).toHaveCount(0);
		await expect(mehrfach(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
		const danach = await kaesten(page);
		// Gedrehte Teile: Der umschließende Kasten bleibt bis auf Rundung gleich.
		for (const k of ['wilma', 'blase'] as const) {
			danach[k]?.forEach((wert, i) => expect(Math.abs(wert - (lage[k]?.[i] ?? 0))).toBeLessThanOrEqual(2));
		}
	});

	test('Doppelklick wählt ein Teil, Esc wieder die Gruppe', async ({ page }) => {
		await blatt(page);
		await gruppiere(page);
		await teil(page, 'Blase').dblclick();
		await expect(page.locator('[data-gruppe-teile]')).toHaveCount(0);
		const vorher = await quelle(page);
		await page.keyboard.press('ArrowRight');
		await expect.poll(() => quelle(page)).toMatch(/data-name="Blase"[^>]*--x:1px/);
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
		await geladen(page);
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-gruppe-teile]')).toBeVisible();
	});

	test('Ein Teil einer gedrehten Gruppe: Rahmen ohne Griffe, Pfeiltasten gehen', async ({ page }) => {
		await blatt(page);
		await gruppiere(page);
		await page.locator('[data-gestaltungsleiste] [data-drehen]').click();
		await expect.poll(() => quelle(page)).toMatch(/class="gruppe"[^>]*--drehen:90deg/);
		await geladen(page);
		await teil(page, 'Blase').dblclick();
		await expect(page.locator('[data-gruppe-teile]')).toHaveCount(0);
		await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
		await expect(page.locator('[data-gestaltung-griff]')).toHaveCount(0);
		await page.keyboard.press('ArrowDown');
		await expect.poll(() => quelle(page)).toMatch(/data-name="Blase"[^>]*--y:1px/);
	});

	test('Die Ebenen zeigen die Teile unter der Gruppe und wählen sie', async ({ page }) => {
		await blatt(page);
		await gruppiere(page);
		await oeffneSchublade(page, 'ebenen');
		const auf = page
			.locator('[data-zeilen-art="vorne"]')
			.filter({ hasText: 'Gruppe' })
			.getByRole('button', { name: 'Aufklappen' });
		if (await auf.count()) {
			await auf.click();
		}
		const zeilen = page.locator('[data-zeilen-art="gruppe"]');
		await expect(zeilen).toHaveCount(2);
		await zeilen.first().locator('[data-gliederung-titel]').click();
		await expect(page.locator('[data-gruppe-teile]')).toHaveCount(0);
		await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
	});

	test('⌘G ohne passende Auswahl tut nichts', async ({ page }) => {
		await blatt(page, { vorne: [BLASE], anker: [FIGUR_ANKER] });
		const vorher = await quelle(page);
		await page.keyboard.press('ControlOrMeta+g');
		await teil(page, 'Blase').click();
		await page.keyboard.press('ControlOrMeta+g');
		// Wilma am Anker und die Blase haben verschiedene Eltern: gesperrt.
		await material(page)
			.locator('img.figur-frei')
			.click({ modifiers: ['Shift'] });
		await expect(mehrfach(page)).toHaveAttribute('data-mehrfach-anzahl', '2');
		await page.keyboard.press('ControlOrMeta+g');
		await expect(gruppe(page)).toHaveCount(0);
		expect(await quelle(page)).toBe(vorher);
	});
});
