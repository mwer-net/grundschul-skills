/**
 * Gestaltungselemente wählen, ziehen, skalieren, drehen (097). Quelle mit Beispielen aus `gestaltung-daten.ts`, direkt in
 * die Ablage geschrieben. Jede Geste ist ein Schritt; während der Geste ändert sich die Quelle nicht und das Blatt lädt
 * nicht neu (Z12).
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import type { Einsatz } from './gestaltung-daten';
import { BILD_FREI, blattMit, FIGUR_FREI, FORM, STREUUNG } from './gestaltung-daten';
import { expect, test } from './hilfe';

const MAUS = ['chromium', 'mac-safari'];

/** Bild aus dem Testdokument, damit es Maße hat. */
const BILD = BILD_FREI.replace('bilder/marktplatz.jpg', 'bilder/wachstum.png');

const KREIS_UNTEN =
	'<svg class="form" data-lage="frei" data-form="kreis" viewBox="0 0 100 100" style="--x:300px;--y:960px;--b:100px;--h:100px"><circle cx="50" cy="50" r="48" style="fill:var(--akzent)"/></svg>';

/** Über der ersten Aufgabe, gesperrt: Klicks gehen durch. */
const GESPERRT =
	'<svg class="form" data-lage="frei" data-gesperrt data-form="rechteck" viewBox="0 0 100 100" style="--x:60px;--y:150px;--b:680px;--h:260px"><rect x="0" y="0" width="100" height="100" style="fill:rgba(0,0,0,.05)"/></svg>';

const VORNE_UEBER_STREUUNG =
	'<svg class="form" data-lage="frei" data-form="kreis" viewBox="0 0 100 100" style="--x:20px;--y:900px;--b:120px;--h:120px"><circle cx="50" cy="50" r="48" style="fill:var(--haupt)"/></svg>';

const zweiteSeite = (html: string) =>
	html.replace(
		'</section>',
		'</section>\n<section class="seite">\n  <div class="aufgabe"><span class="nr">4</span><div class="anw"><span class="text">Noch eine.</span></div></div>\n</section>',
	);

const blatt = async (page: Page, einsatz: Einsatz, zwei = false) => {
	const u = await uhrzeit();
	const html = blattMit(einsatz);
	await writeFile(u.material, zwei ? zweiteSeite(html) : html);
	await oeffne(page, u.id, u.dok);
	return u;
};

const mitte = async (ziel: Locator) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const rahmen = (page: Page) => page.locator('[data-gestaltung-rahmen]');
const griff = (page: Page, name: string) => page.locator(`[data-gestaltung-griff="${name}"]`);
const iframes = (page: Page) => page.locator('[data-leinwand] iframe');
const stern = (page: Page) => material(page).locator('svg.form[data-form="stern"]');

/** Zieht mit der Maus von `von` um `dx`/`dy`; `mittendrin` läuft, solange die Taste gedrückt ist. */
const ziehe = async (
	page: Page,
	von: { x: number; y: number },
	dx: number,
	dy: number,
	mittendrin?: () => Promise<void>,
) => {
	await page.mouse.move(von.x, von.y);
	await page.mouse.down();
	await page.mouse.move(von.x + dx / 2, von.y + dy / 2, { steps: 4 });
	await page.mouse.move(von.x + dx, von.y + dy, { steps: 4 });
	await mittendrin?.();
	await page.mouse.up();
};

test.describe('Gestaltung wählen und bewegen (097)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test('Klick wählt, der Rahmen hat Ecken, Kanten und den Drehgriff', async ({ page }) => {
		await blatt(page, { vorne: [FORM] });
		await stern(page).click();
		await expect(rahmen(page)).toBeVisible();
		await expect(griff(page, 'drehen')).toBeVisible();
		await expect(page.locator('[data-gestaltung-griff]')).toHaveCount(10);
		// Acht Griffe zur Größe, Drehen und (106) der Anker.
		await expect(page.getByRole('button', { name: /^Größe ändern/ })).toHaveCount(8);
		await expect(griff(page, 'anker')).toBeVisible();
		// Der gerade Rahmen der Bausteine bleibt unsichtbar, der Stapel zieht nicht.
		await expect(page.locator('[data-auswahlrahmen]')).toBeHidden();
	});

	test('Ziehen ändert --x/--y erst beim Loslassen, ohne Neuladen und ohne Schritt dazwischen', async ({ page }) => {
		await blatt(page, { vorne: [FORM] });
		const vorher = await quelle(page);
		await stern(page).click();
		const von = await mitte(stern(page));
		const skala = await page.evaluate(() => {
			const f = document.querySelector<HTMLElement>('[data-editor-rahmen="sichtbar"]');
			return f ? f.getBoundingClientRect().width / f.offsetWidth : 1;
		});
		await ziehe(page, von, 50 * skala, 40 * skala, async () => {
			expect(await quelle(page)).toBe(vorher);
			await expect(iframes(page)).toHaveCount(1);
			await expect(page.locator('[data-druckrand]')).toBeVisible();
			await expect(page.locator('[data-wert-am-zeiger]')).toContainText('X 660 · Y 124');
			expect(await stern(page).evaluate((e) => (e as SVGElement).style.getPropertyValue('--x'))).toBe('660px');
		});
		await expect
			.poll(() => quelle(page))
			.toContain('style="--x:660px;--y:124px;--b:120px;--h:120px;--drehen:12deg"');
		await expect(page.locator('[data-druckrand]')).toHaveCount(0);
		await geladen(page);
		await expect(rahmen(page)).toBeVisible();
	});

	test('jede Geste ist ein Schritt: ⌘Z nimmt sie ganz zurück', async ({ page }) => {
		await blatt(page, { vorne: [FORM] });
		const vorher = await quelle(page);
		await stern(page).click();
		await ziehe(page, await mitte(stern(page)), 30, 30);
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('die Ecke am Bild skaliert proportional, ohne --h', async ({ page }) => {
		await blatt(page, { vorne: [BILD] });
		const bild = material(page).locator('img.bild-frei');
		await bild.click();
		const g = await mitte(griff(page, 'unten-rechts'));
		await ziehe(page, g, 60, 5);
		await expect.poll(() => quelle(page)).not.toContain('--b:420px');
		const q = await quelle(page);
		const b = Number(/class="bild-frei"[^>]*--b:(\d+)px/.exec(q)?.[1]);
		expect(b).toBeGreaterThan(450);
		expect(/class="bild-frei"[^>]*>/.exec(q)?.[0]).not.toContain('--h');
	});

	test('Drehen mit ⇧ rastet in 15°-Schritten', async ({ page }) => {
		await blatt(page, { vorne: [FIGUR_FREI] });
		const figur = material(page).locator('img.figur-frei');
		await figur.click();
		const g = await mitte(griff(page, 'drehen'));
		const m = await mitte(rahmen(page));
		// Ein Viertel im Uhrzeigersinn, etwas daneben: Das Raster macht 90° daraus. ⇧ erst im Zug, sonst ist es ein ⇧-Klick.
		await page.mouse.move(g.x, g.y);
		await page.mouse.down();
		await page.keyboard.down('Shift');
		await page.mouse.move(g.x + (m.x - g.x + (m.y - g.y)) / 2, g.y + (m.y - g.y + 6) / 2, { steps: 4 });
		await page.mouse.move(g.x + m.x - g.x + (m.y - g.y), g.y + m.y - g.y + 6, { steps: 4 });
		await page.mouse.up();
		await page.keyboard.up('Shift');
		await expect.poll(() => quelle(page)).toContain('--drehen:');
		const winkel = Number(/data-figur="wilma"[^>]*--drehen:(-?[\d.]+)deg/.exec(await quelle(page))?.[1]);
		expect(winkel % 15).toBe(0);
		expect(winkel).not.toBe(0);
	});

	test('⌥-Ziehen legt eine Kopie ab, das Original bleibt', async ({ page }) => {
		await blatt(page, { vorne: [FORM] });
		await stern(page).click();
		const von = await mitte(stern(page));
		await page.keyboard.down('Alt');
		await ziehe(page, von, 80, 0);
		await page.keyboard.up('Alt');
		await expect.poll(async () => (await quelle(page)).split('data-form="stern"').length).toBe(3);
		expect(await quelle(page)).toContain('style="--x:610px;--y:84px;--b:120px;--h:120px;--drehen:12deg"');
	});

	test('Esc bricht ab: nichts ändert sich', async ({ page }) => {
		await blatt(page, { vorne: [FORM] });
		const vorher = await quelle(page);
		await stern(page).click();
		await ziehe(page, await mitte(stern(page)), 60, 60, async () => {
			await page.keyboard.press('Escape');
			expect(await stern(page).evaluate((e) => (e as SVGElement).style.getPropertyValue('--x'))).toBe('610px');
		});
		await page.waitForTimeout(300);
		expect(await quelle(page)).toBe(vorher);
		await expect(iframes(page)).toHaveCount(1);
		// Esc während der Geste geht keine Ebene hoch.
		await expect(rahmen(page)).toBeVisible();
	});

	test('Ziehen auf Seite 2 verschiebt dorthin', async ({ page }) => {
		await blatt(page, { vorne: [KREIS_UNTEN] }, true);
		const kreis = material(page).locator('svg[data-form="kreis"]');
		await kreis.scrollIntoViewIfNeeded();
		await kreis.click();
		const von = await mitte(kreis);
		const seite2 = await material(page).locator('section.seite').nth(1).boundingBox();
		expect(seite2).not.toBeNull();
		await ziehe(page, von, 0, (seite2?.y ?? 0) + 60 - von.y);
		await expect
			.poll(async () => (await quelle(page)).split('<section').at(-1) ?? '')
			.toContain('data-form="kreis"');
		expect((await quelle(page)).split('<section')[1]).not.toContain('data-form="kreis"');
	});

	test('Gesperrtes ist im Blatt nicht wählbar: der Klick wählt darunter', async ({ page }) => {
		await blatt(page, { vorne: [GESPERRT] });
		const aufgabe = material(page).locator('.aufgabe').first();
		await aufgabe.locator('.anw').click();
		await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();
		await expect(rahmen(page)).toHaveCount(0);
	});

	test('⌥-Klick wählt das hinterste Element unter dem Zeiger', async ({ page }) => {
		await blatt(page, { hinten: [STREUUNG], vorne: [VORNE_UEBER_STREUUNG] });
		const kreis = material(page).locator('svg[data-form="kreis"]');
		await kreis.scrollIntoViewIfNeeded();
		await kreis.click();
		const klein = await rahmen(page).boundingBox();
		// Mit ⌥ gewinnt sonst das schon gewählte Element unter dem Zeiger (für ⌥-Ziehen = Kopie).
		await page.keyboard.press('Escape');
		await expect(rahmen(page)).toHaveCount(0);
		await kreis.click({ modifiers: ['Alt'] });
		const streuung = await material(page).locator('svg.streuung').boundingBox();
		await expect
			.poll(async () => Math.round((await rahmen(page).boundingBox())?.width ?? 0))
			.toBe(Math.round(streuung?.width ?? -1));
		const gross = await rahmen(page).boundingBox();
		expect(gross?.width ?? 0).toBeGreaterThan(klein?.width ?? 0);
	});
});

test.describe('Gestaltung am iPad (097)', () => {
	test.skip(({ hasTouch }) => !hasTouch || test.info().project.name !== 'ipad-quer', 'nur ipad-quer');

	test('die Griffe sind 44 px groß', async ({ page }) => {
		await blatt(page, { vorne: [FORM] });
		await stern(page).tap();
		await expect(rahmen(page)).toBeVisible();
		// Der Stern ist gedreht, sein Rahmen mit ihm: Die umschließende Box wäre größer als der Griff selbst.
		for (const name of ['unten-rechts', 'drehen']) {
			const g = await griff(page, name).evaluate((e: HTMLElement) => [e.offsetWidth, e.offsetHeight]);
			expect(g).toEqual([44, 44]);
		}
	});
});
