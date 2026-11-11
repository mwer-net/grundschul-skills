/**
 * Stift P, Pfad ⇧P und Punkte bearbeiten (116). Werkzeuge wie in `gestaltung-werkzeuge.spec.ts`; jede Änderung ist ein
 * Schritt, ⌘Z nimmt sie zurück und bleibt im Modus.
 */
import type { Page } from '@playwright/test';

import { aendere, geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const pfade = (page: Page) => material(page).locator('svg.form[data-form="pfad"]');
const anzahl = (html: string) => html.split('data-form="pfad"').length - 1;
const aktivesWerkzeug = (page: Page) => page.locator('[data-werkzeug][aria-pressed="true"]');
const punkte = (page: Page) => page.locator('[data-pfad-punkt]');

/** Ein Pfad von Claude: relative Befehle und ein Bogen. */
const VON_CLAUDE =
	'<svg class="form" data-lage="frei" data-form="pfad" viewBox="0 0 100 60" style="--x:300px;--y:600px;--b:100px;--h:60px"><path d="m10 50 a40 40 0 0 1 80 0 z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px"/></svg>';

const oeffneBlatt = async (page: Page, vorne: string[] = []) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, blattMit({ vorne }));
	await oeffneSchublade(page, 'werkzeuge');
};

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

/** Zeichnet mit gedrückter Maus durch die Punkte. */
const zeichne = async (page: Page, liste: { x: number; y: number }[]) => {
	const [erster, ...rest] = liste;
	if (!erster) {
		return;
	}
	await page.mouse.move(erster.x, erster.y);
	await page.mouse.down();
	for (const p of rest) {
		await page.mouse.move(p.x, p.y, { steps: 3 });
	}
	await page.mouse.up();
};

const kreisUm = (m: { x: number; y: number }, r: number, bis = 1) =>
	Array.from({ length: 40 }, (_, i) => {
		const w = (i / 39) * 2 * Math.PI * bis;
		return { x: m.x + r * Math.cos(w), y: m.y + r * Math.sin(w) };
	});

const mitteVon = async (page: Page, sel: string) => {
	const b = await page.locator(sel).boundingBox();
	if (!b) {
		throw new Error(`${sel} fehlt`);
	}
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test.describe('Stift und Pfad (116)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test('P zeichnet geschlossen gefüllt und offen nur mit Kontur, danach gilt V', async ({ page }) => {
		await oeffneBlatt(page);
		await page.keyboard.press('KeyP');
		await expect(aktivesWerkzeug(page)).toHaveAttribute('data-werkzeug', 'stift');
		await zeichne(page, kreisUm(await aufSeite(page, 0.3, 0.4), 50));
		await expect.poll(async () => anzahl(await quelle(page))).toBe(1);
		const geschlossen = await quelle(page);
		expect(geschlossen).toMatch(/data-form="pfad"[^>]*><path d="M[^"]*Z" style="fill:var\(--akzent\)/);
		await expect(aktivesWerkzeug(page)).toHaveAttribute('data-werkzeug', 'auswahl');

		await geladen(page);
		await page.keyboard.press('KeyP');
		await zeichne(page, kreisUm(await aufSeite(page, 0.7, 0.6), 50, 0.5));
		await expect.poll(async () => anzahl(await quelle(page))).toBe(2);
		expect(await quelle(page)).toMatch(/<path d="M[^"Z]*" style="fill:none;stroke:var\(--dunkel\)/);
	});

	test('⇧P setzt Ecken und Kurven, Enter beendet offen, Klick auf den Start schließt', async ({ page }) => {
		await oeffneBlatt(page);
		await page.keyboard.press('Shift+KeyP');
		await expect(aktivesWerkzeug(page)).toHaveAttribute('data-werkzeug', 'pfad');
		const a = await aufSeite(page, 0.3, 0.3);
		await page.mouse.click(a.x, a.y);
		await page.mouse.click(a.x + 120, a.y);
		// Ziehen beim Setzen: Kurvenpunkt.
		await page.mouse.move(a.x + 120, a.y + 100);
		await page.mouse.down();
		await page.mouse.move(a.x + 160, a.y + 120, { steps: 4 });
		await page.mouse.up();
		await expect(material(page).locator('[data-ablage-vorschau]')).toHaveCount(1);
		expect(anzahl(await quelle(page))).toBe(0);
		await page.keyboard.press('Enter');
		await expect.poll(async () => anzahl(await quelle(page))).toBe(1);
		expect(await quelle(page)).toMatch(/<path d="M[^"]* C[^"Z]*" style="fill:none/);

		await geladen(page);
		await page.keyboard.press('Shift+KeyP');
		const b = await aufSeite(page, 0.3, 0.7);
		await page.mouse.click(b.x, b.y);
		await page.mouse.click(b.x + 100, b.y);
		await page.mouse.click(b.x + 50, b.y + 80);
		await page.mouse.click(b.x + 2, b.y + 2);
		await expect.poll(async () => anzahl(await quelle(page))).toBe(2);
		expect(await quelle(page)).toMatch(/<path d="M[^"]*Z" style="fill:var\(--akzent\)/);
	});

	test('⇧P: Backspace nimmt den letzten Punkt, Esc bricht ohne Element ab', async ({ page }) => {
		await oeffneBlatt(page);
		const vorher = await quelle(page);
		await page.keyboard.press('Shift+KeyP');
		const a = await aufSeite(page, 0.4, 0.4);
		await page.mouse.click(a.x, a.y);
		await page.mouse.click(a.x + 80, a.y);
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Escape');
		await expect(aktivesWerkzeug(page)).toHaveAttribute('data-werkzeug', 'auswahl');
		await expect(material(page).locator('[data-ablage-vorschau]')).toHaveCount(0);
		expect(await quelle(page)).toBe(vorher);
	});

	test('Doppelklick, Punkt ziehen, ⌥-Klick löscht, Esc beendet; je ein Schritt, ⌘Z bleibt im Modus', async ({
		page,
	}) => {
		await oeffneBlatt(page, [VON_CLAUDE]);
		await pfade(page).click();
		const inspektor = page.locator('[data-gestaltung-inspektor="form"]');
		await expect(inspektor).toBeVisible();
		await expect(inspektor).not.toContainText('Doppelklick');
		await expect(page.locator('[data-hinweis="pfad"]')).toHaveCount(0);
		await pfade(page).dblclick();
		await expect(page.locator('[data-hinweis="pfad-punkte"]')).toBeVisible();
		await expect(punkte(page)).toHaveCount(3);
		// Ein Pfad von Claude: A und relative Befehle werden bei der ersten Änderung zu M L C Z.
		const vorher = await quelle(page);
		const p = await mitteVon(page, '[data-pfad-punkt="1"]');
		await page.mouse.move(p.x, p.y);
		await page.mouse.down();
		await page.mouse.move(p.x, p.y - 30, { steps: 5 });
		await page.mouse.up();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		expect(await quelle(page)).not.toContain(' a40');
		await geladen(page);
		await expect(punkte(page)).toHaveCount(3);

		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
		await geladen(page);
		await expect(punkte(page)).toHaveCount(3);

		await page.locator('[data-pfad-punkt="1"]').click({ modifiers: ['Alt'] });
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await geladen(page);
		await expect(punkte(page)).toHaveCount(2);

		await page.keyboard.press('Escape');
		await expect(punkte(page)).toHaveCount(0);
		await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
	});

	test('Größe ändern behält die Strichstärke', async ({ page }) => {
		await oeffneBlatt(page, [VON_CLAUDE]);
		await pfade(page).click();
		const g = await mitteVon(page, '[data-gestaltung-griff="unten-rechts"]');
		await page.mouse.move(g.x, g.y);
		await page.mouse.down();
		await page.mouse.move(g.x + 80, g.y + 40, { steps: 5 });
		await page.mouse.up();
		await expect
			.poll(async () => /--b:(\d+)px/.exec((await quelle(page)).split('data-form="pfad"')[1] ?? '')?.[1])
			.not.toBe('100');
		const q = await quelle(page);
		expect(q).toContain('stroke-width:3px');
		const vb = /data-form="pfad" viewBox="0 0 (\d+) (\d+)"/.exec(q);
		const b = /--b:(\d+)px;--h:(\d+)px/.exec(q.split('data-form="pfad"')[1] ?? '');
		expect([vb?.[1], vb?.[2]]).toEqual([b?.[1], b?.[2]]);
	});
});
