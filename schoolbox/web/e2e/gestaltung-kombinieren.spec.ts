/**
 * Kombinieren und Formen-Schere (121, Briefing 3-formen, Z9): Kreis und Rechteck werden ein Pfad, je ein Schritt. Die
 * Schere zerlegt zwei Kreise in drei Bereiche; ein Zug vereint markierte, mit ⌥ entfernt er sie.
 */
import { writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import type { Einsatz } from './gestaltung-daten';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';

const MAUS = ['chromium', 'mac-safari'];

const KREIS =
	'<svg class="form" data-lage="frei" data-name="Kreis" data-form="ellipse" viewBox="0 0 160 160" style="--x:200px;--y:300px;--b:160px;--h:160px">' +
	'<path d="M80 1.5 C123.4 1.5 158.5 36.6 158.5 80 C158.5 123.4 123.4 158.5 80 158.5 C36.6 158.5 1.5 123.4 1.5 80 C1.5 36.6 36.6 1.5 80 1.5 Z" style="fill:#ff0000;stroke:var(--dunkel);stroke-width:3px"/></svg>';
const RECHTECK =
	'<svg class="form" data-lage="frei" data-name="Rechteck" data-form="rechteck" viewBox="0 0 240 200" style="--x:120px;--y:260px;--b:240px;--h:200px">' +
	'<path d="M1.5 1.5 L238.5 1.5 L238.5 198.5 L1.5 198.5 Z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px"/></svg>';
const RECHTS = KREIS.replace('data-name="Kreis"', 'data-name="Rechts"').replace('--x:200px', '--x:300px');

const blatt = async (page: Page, einsatz: Einsatz = { vorne: [RECHTECK, KREIS] }) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit(einsatz));
	await oeffne(page, u.id, u.dok);
	return u;
};

const form = (page: Page, name: string) => material(page).locator(`[data-name="${name}"]`);
const pfade = (q: string) => (q.match(/data-form="pfad"/g) ?? []).length;
const geladen = (page: Page) => expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();

/** `a` am Rand (das Rechteck liegt teils unter dem Kreis), `b` in der Mitte. */
const waehle = async (page: Page, a: string, b: string) => {
	await form(page, a).click(a === 'Rechteck' ? { position: { x: 20, y: 180 } } : {});
	await form(page, b).click({ modifiers: ['Shift'] });
	await expect(page.locator('[data-gestaltung-rahmen="mehrfach"]')).toHaveAttribute('data-mehrfach-anzahl', '2');
};

const ueberMehr = async (page: Page, befehl: string) => {
	await page
		.locator('[data-gestaltungsleiste="mehrfach"]')
		.getByRole('button', { name: /^Mehr zu/ })
		.click();
	await page.locator(`[data-befehl="${befehl}"]`).click();
};

test.describe('Kombinieren (121)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test('Vereinen im Inspektor: ein Pfad, ein Schritt, ⌘Z bringt beide zurück', async ({ page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		await waehle(page, 'Rechteck', 'Kreis');
		await page.locator('[data-kombinieren] [data-befehl="auswahl.vereinen"]').click();
		await expect.poll(async () => pfade(await quelle(page))).toBe(1);
		const q = await quelle(page);
		expect(q).not.toContain('data-form="ellipse"');
		expect(q).not.toContain('data-form="rechteck"');
		expect(q).toContain('fill:#ff0000'); // Aussehen der vordersten Form
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Abziehen, Schnitt und Ausschluss über das ⋯', async ({ page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		for (const [befehl, evenodd] of [
			['auswahl.abziehen', true],
			['auswahl.schneiden', false],
			['auswahl.ausschliessen', true],
		] as const) {
			await waehle(page, 'Rechteck', 'Kreis');
			await ueberMehr(page, befehl);
			await expect.poll(async () => pfade(await quelle(page))).toBe(1);
			expect((await quelle(page)).includes('fill-rule:evenodd')).toBe(evenodd);
			await geladen(page);
			await page.keyboard.press('ControlOrMeta+z');
			await expect.poll(() => quelle(page)).toBe(vorher);
			await geladen(page);
		}
	});

	test('Form mit Text: Die Knöpfe sind aus und sagen warum', async ({ page }) => {
		const blase =
			'<div class="form-text" data-lage="frei" data-name="Blase" data-form="sprechblase" style="--x:500px;--y:300px;--b:180px;--h:84px">' +
			'<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="2" y="2" width="176" height="80" rx="18" style="fill:#fff;stroke:var(--dunkel);stroke-width:3px"/></svg>' +
			'<div class="form-inhalt">Hallo!</div></div>';
		await blatt(page, { vorne: [KREIS, blase] });
		await waehle(page, 'Kreis', 'Blase');
		await expect(page.locator('[data-kombi-hinweis]')).toHaveText('Nur Formen ohne Text lassen sich kombinieren.');
		await expect(page.locator('[data-kombinieren] [data-befehl="auswahl.vereinen"]')).toBeDisabled();
	});

	test('Leeres Ergebnis ändert nichts und sagt es', async ({ page }) => {
		const weit = KREIS.replace('data-name="Kreis"', 'data-name="Weit"').replace('--x:200px', '--x:520px');
		await blatt(page, { vorne: [RECHTECK, weit] });
		const vorher = await quelle(page);
		await waehle(page, 'Rechteck', 'Weit');
		await page.locator('[data-kombinieren] [data-befehl="auswahl.schneiden"]').click();
		await expect(page.locator('[data-kombi-hinweis]')).toHaveText('Das Ergebnis wäre leer.');
		expect(await quelle(page)).toBe(vorher);
	});

	test('Das Ergebnis lässt sich per Doppelklick wie jeder Pfad bearbeiten', async ({ page }) => {
		await blatt(page);
		await waehle(page, 'Rechteck', 'Kreis');
		await page.locator('[data-kombinieren] [data-befehl="auswahl.abziehen"]').click();
		await expect.poll(async () => pfade(await quelle(page))).toBe(1);
		await geladen(page);
		const pfad = material(page).locator('svg[data-form="pfad"]');
		await pfad.dblclick({ position: { x: 10, y: 10 } });
		await expect(page.locator('[data-pfad-punkt]').first()).toBeVisible();
	});
});

test.describe('Formen-Schere (121)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	const bereich = (page: Page, i: number) => page.locator(`[data-schere-bereich="${i}"]`);

	test('⇧M zeigt drei Bereiche; ein Zug über zwei ist ein Schritt, mit ⌥ fallen sie weg', async ({ page }) => {
		await blatt(page, { vorne: [KREIS, RECHTS] });
		const vorher = await quelle(page);
		await waehle(page, 'Kreis', 'Rechts');
		await page.keyboard.press('Shift+KeyM');
		await expect(page.locator('[data-schere-anzeige="3"]')).toBeVisible();
		// Von der Mitte des linken Kreises in die Überlappung.
		const k = await form(page, 'Kreis').boundingBox();
		if (!k) {
			throw new Error('nicht sichtbar');
		}
		const y = k.y + k.height / 2;
		await page.mouse.move(k.x + 30, y);
		await page.mouse.down();
		await page.mouse.move(k.x + 80, y, { steps: 4 });
		await page.mouse.move(k.x + 130, y, { steps: 4 });
		await expect(page.locator('[data-schere-bereich][data-markiert]')).toHaveCount(2);
		await page.mouse.up();
		await expect.poll(async () => pfade(await quelle(page))).toBe(2);
		await geladen(page);
		await expect(page.locator('[data-schere-anzeige]')).toBeVisible(); // die Schere bleibt aktiv
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
		await geladen(page);

		await page.keyboard.press('Escape');
		await waehle(page, 'Kreis', 'Rechts');
		await page.keyboard.press('Shift+KeyM');
		await expect(page.locator('[data-schere-anzeige="3"]')).toBeVisible();
		await expect(bereich(page, 0)).toBeVisible();
		await page.mouse.move(k.x + 30, y);
		await page.mouse.down();
		await page.mouse.move(k.x + 40, y, { steps: 2 });
		await page.keyboard.down('Alt');
		await page.mouse.up();
		await page.keyboard.up('Alt');
		await expect.poll(async () => pfade(await quelle(page))).toBe(2);
		expect(await quelle(page)).not.toContain('data-form="ellipse"');
	});

	test('Ohne Überlappung sagt die Schere warum', async ({ page }) => {
		const weit = RECHTS.replace('--x:300px', '--x:520px');
		await blatt(page, { vorne: [KREIS, weit] });
		await waehle(page, 'Kreis', 'Rechts');
		await page.keyboard.press('Shift+KeyM');
		await expect(page.locator('[data-schere-grund]')).toContainText('überlappen sich nicht');
	});
});
