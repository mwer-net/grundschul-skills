import type { Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/**
 * 098: Ablegen aus der Schublade und Werkzeug-Modus. Ohne Schublade mit Inhalt (102–105) prüft der Testzugang
 * (`window.__schoolboxTest.gestaltung`) das Grundgerüst: ein Test-Gut, ein Test-Ziel (`.testziel`) und ein
 * Test-Werkzeug (Taste Q), die nur im Test bereit sind.
 */

const TESTZIEL =
	'<div class="testziel" data-lage="frei" style="--x:480px;--y:820px;--b:160px;--h:110px;background:#e5e7eb"></div>';

const gut = (page: Page) => page.locator('[data-testfach] [data-ablage-gut]');
const vorschau = (page: Page, klasse: string) => material(page).locator(`[data-ablage-vorschau] .${klasse}`);
const anzeige = (page: Page) => page.locator('[data-zug-anzeige]');
const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const flaeche = (page: Page) => page.locator('[data-werkzeugflaeche]');
const knopf = (page: Page, id: string) => page.locator(`[data-testfach] [data-werkzeug="${id}"]`);
const anzahl = (html: string, klasse: string) => html.split(`class="${klasse}"`).length - 1;

/** Maßstab der Leinwand: Bildschirm-px je px des Materials. */
const skala = (page: Page) =>
	page
		.locator('[data-editor-rahmen="sichtbar"]')
		.evaluate((f: HTMLElement) => f.getBoundingClientRect().width / f.offsetWidth);

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

/** Rollt das Element in die Mitte der Ansicht: Außerhalb davon trifft der Zeiger nichts im Blatt. */
const zeige = (page: Page, selektor: string) =>
	material(page)
		.locator(selektor)
		.evaluate((e) => e.scrollIntoView({ block: 'center' }));

const mitte = async (page: Page, wo: ReturnType<typeof material>, selektor: string) => {
	const r = await wo.locator(selektor).boundingBox();
	if (!r) {
		throw new Error(`${selektor} nicht zu sehen`);
	}
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

/** Greift das Test-Gut und zieht über die Schwelle; die Maus bleibt unten. */
const greife = async (page: Page) => {
	const r = await gut(page).boundingBox();
	if (!r) {
		throw new Error('Test-Gut nicht zu sehen');
	}
	await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
	await page.mouse.down();
	await page.mouse.move(r.x + r.width / 2 - 20, r.y + r.height / 2 - 12, { steps: 3 });
	await expect(anzeige(page)).toBeVisible();
};

const oeffneMitZiel = async (page: Page) => {
	await page.addInitScript(() => {
		(window as unknown as { __schoolboxTest: { gestaltung: boolean } }).__schoolboxTest = { gestaltung: true };
	});
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, blattMit({ vorne: [TESTZIEL] }));
	await expect(material(page).locator('.testziel')).toBeVisible();
	await expect(gut(page)).toBeVisible();
};

test.describe('Gestaltung ablegen (098)', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
		await oeffneMitZiel(page);
	});

	test('Klick legt in die Mitte des sichtbaren Teils der Seite, ein Schritt, danach gewählt', async ({ page }) => {
		const vorher = await quelle(page);
		const ziel = await aufSeite(page, 0.5, 0.5);
		await gut(page).click();
		await expect.poll(async () => anzahl(await quelle(page), 'testgut')).toBe(1);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Testgut abgelegt');
		const neu = material(page).locator('.testgut');
		await expect(neu).toHaveAttribute('data-lage', 'frei');
		const m = await mitte(page, material(page), '.testgut');
		expect(Math.abs(m.x - ziel.x)).toBeLessThan(20);
		expect(Math.abs(m.y - ziel.y)).toBeLessThan(20);
		await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();
		expect(await quelle(page)).toMatch(/<div class="ebene vorne">[\s\S]*class="testgut"/);

		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Ziehen legt frei ab, Zeiger in der Mitte; Vorschau nur im Blatt, kein Schritt vor dem Loslassen', async ({
		page,
	}) => {
		const vorher = await quelle(page);
		await greife(page);
		const ziel = await aufSeite(page, 0.3, 0.3);
		await page.mouse.move(ziel.x, ziel.y, { steps: 8 });
		await expect(vorschau(page, 'testgut')).toBeVisible();
		await expect(anzeige(page)).toHaveText('Testgut');
		expect(await quelle(page)).toBe(vorher);
		await expect(zurueck(page)).toBeDisabled();

		await page.mouse.up();
		await expect.poll(async () => anzahl(await quelle(page), 'testgut')).toBe(1);
		await expect(material(page).locator('[data-ablage-vorschau]')).toHaveCount(0);
		const m = await mitte(page, material(page), '.testgut[data-lage]');
		expect(Math.abs(m.x - ziel.x)).toBeLessThan(4);
		expect(Math.abs(m.y - ziel.y)).toBeLessThan(4);
		const s = await skala(page);
		const r = await material(page).locator('.testgut').boundingBox();
		expect(Math.round((r?.width ?? 0) / s)).toBe(120);
		await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();
	});

	test('Esc bricht ab, nichts ändert sich', async ({ page }) => {
		const vorher = await quelle(page);
		await greife(page);
		const ziel = await aufSeite(page, 0.5, 0.4);
		await page.mouse.move(ziel.x, ziel.y, { steps: 6 });
		await expect(vorschau(page, 'testgut')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(anzeige(page)).toHaveCount(0);
		await expect(material(page).locator('[data-ablage-vorschau]')).toHaveCount(0);
		await page.mouse.up();
		expect(await quelle(page)).toBe(vorher);
		await expect(zurueck(page)).toBeDisabled();
	});

	test('⌘ während des Zugs: Lücke für eine Fläche (115), Loslassen mit ⌘ legt Fläche mit Element; ohne ⌘ wieder frei', async ({
		page,
	}) => {
		const vorher = await quelle(page);
		await greife(page);
		const ziel = await aufSeite(page, 0.4, 0.4);
		await page.mouse.move(ziel.x, ziel.y, { steps: 6 });
		await expect(vorschau(page, 'testgut')).toBeVisible();
		await page.keyboard.down('Meta');
		await page.mouse.move(ziel.x + 2, ziel.y + 2, { steps: 2 });
		await expect(anzeige(page)).not.toHaveText('Geht noch nicht');
		await expect(material(page).locator('[data-ablage-vorschau]')).toHaveCount(0);
		await expect(material(page).locator('[data-luecke]')).toHaveCount(1);
		await page.keyboard.up('Meta');
		await expect(anzeige(page)).toHaveText('Testgut');
		await expect(vorschau(page, 'testgut')).toBeVisible();
		await page.keyboard.down('Meta');
		await page.mouse.move(ziel.x, ziel.y, { steps: 2 });
		await page.mouse.up();
		await page.keyboard.up('Meta');
		await expect(anzeige(page)).toHaveCount(0);
		await expect.poll(() => quelle(page)).toMatch(/<div class="flaeche" style="--h:\d+px">[\s\S]*class="testgut"/);
		expect(await quelle(page)).not.toBe(vorher);
	});

	test('Ein Ziel unter dem Zeiger zeigt Rahmen und Text und gewinnt', async ({ page }) => {
		await zeige(page, '.testziel');
		await greife(page);
		const ziel = await mitte(page, material(page), '.testziel');
		await page.mouse.move(ziel.x, ziel.y, { steps: 8 });
		await expect(material(page).locator('.testziel[data-ablage-ziel]')).toHaveCount(1);
		await expect(anzeige(page)).toHaveText('Testziel füllen');
		await expect(material(page).locator('[data-ablage-vorschau]')).toHaveCount(0);
		await page.mouse.up();
		await expect.poll(() => quelle(page)).toMatch(/class="testziel"[^>]*data-name="getroffen"/);
		const nachher = await quelle(page);
		expect(anzahl(nachher, 'testgut')).toBe(0);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Testziel füllen');
		await expect(material(page).locator('[data-ablage-ziel]')).toHaveCount(0);
	});

	test('Werkzeug zieht ein Element auf, danach ist V aktiv; ein Strich auf einem Element wählt es nicht', async ({
		page,
	}) => {
		await page.keyboard.press('q');
		await expect(flaeche(page)).toHaveAttribute('data-werkzeugflaeche', 'test');
		await expect(knopf(page, 'test')).toHaveAttribute('aria-pressed', 'true');
		await expect(flaeche(page)).toHaveCSS('cursor', 'crosshair');

		// Der Strich beginnt auf dem Testziel: Es wird nicht gewählt.
		await zeige(page, '.testziel');
		const a = await mitte(page, material(page), '.testziel');
		await page.mouse.move(a.x, a.y);
		await page.mouse.down();
		await page.mouse.move(a.x + 90, a.y + 60, { steps: 6 });
		await expect(vorschau(page, 'testform')).toBeVisible();
		await page.mouse.up();
		await expect.poll(async () => anzahl(await quelle(page), 'testform')).toBe(1);
		const s = await skala(page);
		const html = await quelle(page);
		expect(html).toContain(`--b:${Math.round(90 / s)}px`);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Testrechteck');
		await expect(flaeche(page)).toHaveCount(0);
		await expect(knopf(page, 'auswahl')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();
		const rahmen = await page.locator('[data-auswahlrahmen]').boundingBox();
		// Der Auswahlrahmen liegt um das neue Rechteck (4,5 px Abstand je Seite), nicht um das Testziel.
		expect(Math.abs((rahmen?.width ?? 0) - (90 + 9))).toBeLessThan(3);
	});

	test('Mit ⇧ gewählt bleibt das Werkzeug bis Esc, dann gilt V', async ({ page }) => {
		await knopf(page, 'test').click({ modifiers: ['Shift'] });
		await expect(knopf(page, 'test')).toHaveAttribute('data-gehalten', '');
		for (const [ax, ay] of [
			[0.2, 0.2],
			[0.5, 0.5],
		] as const) {
			const p = await aufSeite(page, ax, ay);
			await page.mouse.move(p.x, p.y);
			await page.mouse.down();
			await page.mouse.move(p.x + 40, p.y + 30, { steps: 4 });
			await page.mouse.up();
		}
		await expect.poll(async () => anzahl(await quelle(page), 'testform')).toBe(2);
		await expect(flaeche(page)).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(flaeche(page)).toHaveCount(0);
		await expect(knopf(page, 'auswahl')).toHaveAttribute('aria-pressed', 'true');

		// Auch ⇧Q hält.
		await page.keyboard.press('Shift+KeyQ');
		await expect(knopf(page, 'test')).toHaveAttribute('data-gehalten', '');
	});

	test('Esc → V, ohne Strich', async ({ page }) => {
		const vorher = await quelle(page);
		await page.keyboard.press('q');
		await expect(flaeche(page)).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(flaeche(page)).toHaveCount(0);
		expect(await quelle(page)).toBe(vorher);
	});

	test('Eine Taste im Suchfeld tippt den Buchstaben, statt das Werkzeug zu wählen', async ({ page }) => {
		await oeffneSchublade(page, 'bausteine');
		const suche = page.getByRole('searchbox', { name: 'Baustein suchen' }).first();
		await suche.click();
		await page.keyboard.type('qv');
		await expect(suche).toHaveValue('qv');
		await expect(flaeche(page)).toHaveCount(0);
		await expect(knopf(page, 'test')).toHaveAttribute('aria-pressed', 'false');
	});

	test('⌘V bleibt Einfügen, V allein wählt die Auswahl', async ({ page }) => {
		await page.keyboard.press('q');
		await expect(flaeche(page)).toHaveCount(1);
		await page.keyboard.press('v');
		await expect(flaeche(page)).toHaveCount(0);
		await page.keyboard.press('Meta+KeyV');
		await expect(flaeche(page)).toHaveCount(0);
		await expect(knopf(page, 'auswahl')).toHaveAttribute('aria-pressed', 'true');
	});
});

test('ohne Testzugang gibt es weder Werkzeuge noch Testfach', async ({ page }) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await expect(page.locator('[data-testfach]')).toHaveCount(0);
	await page.keyboard.press('q');
	await page.keyboard.press('v');
	await expect(flaeche(page)).toHaveCount(0);
});
