/**
 * Schublade „Figuren“ (102): Willi und Wilma frei hinlegen (Klick, Ziehen, ⌘ als Tipp), Blickrichtung, Spiegeln (⇧H),
 * proportional skalieren, Figur tauschen, s/w. Bestand: Blätter mit Leitfigur bleiben, wie sie sind.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, FIGUR_FREI } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const schublade = (page: Page) => page.locator('[data-schublade-figuren]');
const kachel = (page: Page, name: string) => schublade(page).locator(`[data-ablage-gut="${name}"]`);
const anzeige = (page: Page) => page.locator('[data-zug-anzeige]');
const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const frei = (page: Page) => material(page).locator('img.figur-frei');
const griff = (page: Page, name: string) => page.locator(`[data-gestaltung-griff="${name}"]`);
const palette = (page: Page) => page.locator('[data-befehlspalette]');
const anzahl = (html: string, teil: string) => html.split(teil).length - 1;
/** Das `<img>` der frei liegenden Figur in der Quelle. */
const figurTag = (html: string) => /<img class="figur-frei"[^>]*>/.exec(html)?.[0] ?? '';

/** Die Leitfigur im Tipp, wie sie im Bestand vorkommt. */
const TIPP = '  <div class="tipp"><img class="figur" src="bilder/willi.png" alt="Willi"><div class="blase">Zu 1: Ein Tipp.</div></div>';

const mitTipp = (html: string) => html.replace('</section>', `${TIPP}\n</section>`);

const blatt = async (page: Page, html = blattMit()) => {
	const u = await uhrzeit();
	await writeFile(u.material, html);
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

/** Ein Punkt auf der ersten Seite, Anteile ihrer sichtbaren Box. */
const aufSeite = async (page: Page, ax: number, ay: number) => {
	const seite = material(page).locator('.seite').first();
	const r = await seite.boundingBox();
	const sicht = await page.locator('main').boundingBox();
	if (!r || !sicht) {
		throw new Error('Seite nicht zu sehen');
	}
	const oben = Math.max(r.y, sicht.y);
	const unten = Math.min(r.y + r.height, sicht.y + sicht.height);
	return { x: r.x + r.width * ax, y: oben + (unten - oben) * ay };
};

/** Greift die Kachel und zieht über die Schwelle; die Maus bleibt unten. */
const greife = async (page: Page, name: string) => {
	const m = await mitte(kachel(page, name));
	await page.mouse.move(m.x, m.y);
	await page.mouse.down();
	await page.mouse.move(m.x + 20, m.y - 12, { steps: 3 });
	await expect(anzeige(page)).toBeVisible();
};

test.describe('Figuren (102)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
	});

	test('⌥4 öffnet die Schublade; Klick legt Wilma 150 px breit in die Mitte, gewählt, ein Schritt', async ({ page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		await page.keyboard.press('Alt+Digit4');
		await expect(schublade(page)).toBeVisible();
		await expect(schublade(page).locator('[data-schubladenhinweis]')).toContainText('mit ⌘: als Tipp');
		const ziel = await aufSeite(page, 0.5, 0.5);
		await kachel(page, 'Wilma').click();

		await expect.poll(async () => figurTag(await quelle(page))).toContain('data-figur="wilma"');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Wilma abgelegt');
		const tag = figurTag(await quelle(page));
		expect(tag).toContain('data-lage="frei"');
		expect(tag).toContain('--b:150px');
		expect(tag).not.toContain('class="figur"');
		expect(tag).not.toContain('--h');
		expect(await quelle(page)).toMatch(/<div class="ebene vorne">[\s\S]*class="figur-frei"/);
		await expect(frei(page)).toBeVisible();
		const m = await mitte(frei(page));
		expect(Math.abs(m.x - ziel.x)).toBeLessThan(20);
		expect(Math.abs(m.y - ziel.y)).toBeLessThan(20);
		expect(await frei(page).evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(150);
		await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();
		await expect(page.locator('[data-gestaltungsleiste="figurfrei"]')).toBeVisible();

		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Ziehen legt frei ab, wo losgelassen wird', async ({ page }) => {
		await blatt(page);
		await oeffneSchublade(page, 'figuren');
		await greife(page, 'Willi');
		const ziel = await aufSeite(page, 0.3, 0.6);
		await page.mouse.move(ziel.x, ziel.y, { steps: 8 });
		await expect(material(page).locator('[data-ablage-vorschau] .figur-frei')).toBeVisible();
		await page.mouse.up();
		await expect.poll(async () => figurTag(await quelle(page))).toContain('data-figur="willi"');
		const m = await mitte(frei(page));
		// Einrasten (100) darf ein paar Pixel ziehen.
		expect(Math.abs(m.x - ziel.x)).toBeLessThan(30);
		expect(Math.abs(m.y - ziel.y)).toBeLessThan(30);
		await expect(material(page).locator('[data-ablage-vorschau]')).toHaveCount(0);
	});

	test('mit ⌘ gezogen: Tipp mit Leitfigur im Stapel, mit Lücke', async ({ page }) => {
		await blatt(page);
		await oeffneSchublade(page, 'figuren');
		const vorher = await quelle(page);
		await greife(page, 'Wilma');
		const ziel = await mitte(material(page).locator('.aufgabe').nth(1));
		await page.mouse.move(ziel.x, ziel.y, { steps: 8 });
		await page.keyboard.down('Meta');
		await page.mouse.move(ziel.x, ziel.y + 4, { steps: 2 });
		await expect(material(page).locator('[data-luecke]')).toHaveCount(1);
		await expect(material(page).locator('[data-ablage-vorschau]')).toHaveCount(0);
		await page.mouse.up();
		await page.keyboard.up('Meta');

		await expect.poll(async () => anzahl(await quelle(page), 'class="tipp"')).toBe(1);
		const q = await quelle(page);
		expect(q).toMatch(/<div class="tipp"><img class="figur" src="[^"]*wilma\.png" alt="Wilma"><div class="blase">/);
		expect(q).not.toContain('figur-frei');
		expect(q).not.toContain('class="ebene');
		await expect(material(page).locator('[data-luecke]')).toHaveCount(0);
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Blickrichtung gegen die Datei ergibt --spiegeln:-1 und bleibt nach dem Neuladen', async ({ page }) => {
		await blatt(page);
		await oeffneSchublade(page, 'figuren');
		const blick = schublade(page).getByRole('group', { name: 'Blickrichtung' });
		// Willi und Wilma zeigen in ihrer Datei nach rechts (`blickt` in `kern/src/figuren.ts`).
		await expect(blick.getByRole('button', { name: 'schaut nach rechts' })).toHaveAttribute('aria-pressed', 'true');
		await blick.getByRole('button', { name: 'schaut nach links' }).click();
		await kachel(page, 'Wilma').click();
		await expect.poll(async () => figurTag(await quelle(page))).toContain('--spiegeln:-1');

		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await oeffneSchublade(page, 'figuren');
		await expect(blick.getByRole('button', { name: 'schaut nach links' })).toHaveAttribute('aria-pressed', 'true');
		await blick.getByRole('button', { name: 'schaut nach rechts' }).click();
		await kachel(page, 'Willi').click();
		await expect.poll(async () => anzahl(await quelle(page), 'class="figur-frei"')).toBe(2);
		expect(/<img class="figur-frei" data-figur="willi"[^>]*>/.exec(await quelle(page))?.[0]).not.toContain('--spiegeln');
	});

	test('⇧H spiegelt und spiegelt zurück, je ein Schritt; „Spiegeln“ an der Leiste tut dasselbe', async ({ page }) => {
		await blatt(page, blattMit({ vorne: [FIGUR_FREI.replace(';--spiegeln:-1', '')] }));
		await frei(page).click();
		await expect(page.locator('[data-gestaltungsleiste="figurfrei"]')).toBeVisible();
		await page.keyboard.press('Shift+KeyH');
		await expect.poll(async () => figurTag(await quelle(page))).toContain('--spiegeln:-1');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Gespiegelt');
		expect(await frei(page).evaluate((e) => getComputedStyle(e).transform)).toMatch(/^matrix\(-1,/);
		await page.keyboard.press('Shift+KeyH');
		await expect.poll(async () => figurTag(await quelle(page))).not.toContain('--spiegeln');

		const knopf = page.locator('[data-gestaltungsleiste="figurfrei"] [data-spiegeln]');
		await expect(knopf).toHaveAttribute('aria-pressed', 'false');
		await knopf.click();
		await expect.poll(async () => figurTag(await quelle(page))).toContain('--spiegeln:-1');
		await expect(knopf).toHaveAttribute('aria-pressed', 'true');
	});

	test('⇧H gilt nicht für die Leitfigur im Stapel', async ({ page }) => {
		await blatt(page, mitTipp(blattMit()));
		const vorher = await quelle(page);
		await material(page).locator('img.figur').click();
		await page.keyboard.press('Shift+KeyH');
		await page.waitForTimeout(200);
		expect(await quelle(page)).toBe(vorher);
	});

	test('die Ecke skaliert proportional, ohne --h', async ({ page }) => {
		await blatt(page, blattMit({ vorne: [FIGUR_FREI] }));
		await frei(page).click();
		const vorher = await frei(page).boundingBox();
		const g = await mitte(griff(page, 'unten-rechts'));
		await page.mouse.move(g.x, g.y);
		await page.mouse.down();
		await page.mouse.move(g.x + 30, g.y + 5, { steps: 4 });
		await page.mouse.move(g.x + 60, g.y + 5, { steps: 4 });
		await page.mouse.up();
		await expect.poll(async () => figurTag(await quelle(page))).not.toContain('--b:150px');
		const tag = figurTag(await quelle(page));
		expect(Number(/--b:(\d+)px/.exec(tag)?.[1])).toBeGreaterThan(170);
		expect(tag).not.toContain('--h');
		const nachher = await frei(page).boundingBox();
		if (!vorher || !nachher) {
			throw new Error('Figur nicht zu sehen');
		}
		expect(Math.abs(nachher.width / nachher.height - vorher.width / vorher.height)).toBeLessThan(0.02);
	});

	test('Inspektor: andere Figur wählen, Lage und Größe bleiben', async ({ page }) => {
		await blatt(page, blattMit({ vorne: [FIGUR_FREI] }));
		await frei(page).click();
		const wahl = page.locator('[data-figur-wahl]');
		await expect(wahl).toHaveAttribute('data-figur-wahl', 'wilma');
		const lage = /style="[^"]*"/.exec(figurTag(await quelle(page)))?.[0];
		await wahl.getByRole('button', { name: 'Willi' }).click();
		await expect.poll(async () => figurTag(await quelle(page))).toContain('data-figur="willi"');
		const tag = figurTag(await quelle(page));
		expect(tag).toContain('alt="Willi"');
		expect(tag).toMatch(/src="[^"]*willi\.png"/);
		expect(/style="[^"]*"/.exec(tag)?.[0]).toBe(lage);
		await expect(wahl).toHaveAttribute('data-figur-wahl', 'willi');
	});

	test('⌘K findet „Wilma“; Enter legt sie in die Mitte', async ({ page }) => {
		await blatt(page);
		await page.keyboard.press('ControlOrMeta+k');
		await palette(page).getByRole('combobox').fill('Wilma');
		const zeile = palette(page).locator('[data-palette-zeile="figur:wilma"]');
		await expect(zeile).toBeVisible();
		await zeile.click();
		await expect.poll(async () => figurTag(await quelle(page))).toContain('data-figur="wilma"');
	});

	test('s/w: Willi druckt sein Strichbild, Wilma ist grau', async ({ page }) => {
		const u = await blatt(page, blattMit({ vorne: [FIGUR_FREI] }));
		const fassung = (src: string) =>
			page.evaluate(
				async (adresse) => ((await (await fetch(adresse)).json()) as { strich: string | null }).strich,
				`/api/dokumente/${u.id}/${u.dok}/bilder/fassung?src=${encodeURIComponent(src)}`,
			);
		expect(await fassung('bilder/willi.png')).toBe('willi-strich.png');
		expect(await fassung('bilder/wilma.png')).toBeNull();
		await page.locator('[data-profilschalter]').getByRole('button', { name: 's/w', exact: true }).click();
		await expect(material(page).locator('body.sw')).toHaveCount(1);
		await expect.poll(() => frei(page).evaluate((e) => getComputedStyle(e).filter)).toContain('grayscale');
	});

	test('Bestand: die Leitfigur im Tipp bleibt, wie sie war; der Baustein „Willi“ fügt sie weiter ein', async ({
		page,
	}) => {
		await blatt(page, mitTipp(blattMit()));
		const leit = material(page).locator('.tipp > img.figur');
		await expect(leit).toBeVisible();
		const stil = await leit.evaluate((e) => {
			const s = getComputedStyle(e);
			return { breite: e.getBoundingClientRect().width, position: s.position, transform: s.transform };
		});
		expect(stil).toEqual({ breite: 84, position: 'static', transform: 'none' });
		await leit.click();
		await expect(page.locator('[data-gestaltungsleiste]')).toHaveCount(0);
		await expect(page.locator('[data-bausteinleiste]')).toBeVisible();

		await oeffneSchublade(page, 'bausteine');
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).first().fill('Wilma');
		await expect(page.locator('[data-bibliothek-eintrag="wilma"]')).toBeVisible();
	});
});
