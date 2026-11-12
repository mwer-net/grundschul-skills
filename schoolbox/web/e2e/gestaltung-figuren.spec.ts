/**
 * Schublade „Figuren“ (102, 177): Willi, Wilma und die Testfigur Kiki aus der Figurenbibliothek des Testservers frei
 * hinlegen (Klick, Ziehen, ⌘ als Tipp), suchen, spiegeln (⇧H), proportional skalieren, Figur und Pose tauschen, s/w.
 * Bestand: Blätter mit Leitfigur bleiben, wie sie sind.
 */
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, FIGUR_FREI } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade, schubladenKnopf } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const schublade = (page: Page) => page.locator('[data-schublade-figuren]');
const kachel = (page: Page, name: string) => schublade(page).locator(`[data-ablage-gut="${name}"]`);
const gruppen = (page: Page) => schublade(page).locator('[data-figuren-gruppe]');
const gruppe = (page: Page, id: string) => schublade(page).locator(`[data-figuren-gruppe="${id}"]`);
const anzeige = (page: Page) => page.locator('[data-zug-anzeige]');
const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const frei = (page: Page) => material(page).locator('img.figur-frei');
const griff = (page: Page, name: string) => page.locator(`[data-gestaltung-griff="${name}"]`);
const palette = (page: Page) => page.locator('[data-befehlspalette]');
const anzahl = (html: string, teil: string) => html.split(teil).length - 1;
/** Das `<img>` der frei liegenden Figur in der Quelle. */
const figurTag = (html: string) => /<img class="figur-frei"[^>]*>/.exec(html)?.[0] ?? '';

/** Die Leitfigur im Tipp, wie sie im Bestand vorkommt. */
const TIPP =
	'  <div class="tipp"><img class="figur" src="bilder/willi.png" alt="Willi"><div class="blase">Zu 1: Ein Tipp.</div></div>';

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

/** Was `blatt.py` in s/w für dieses `src` druckt (`/bilder/fassung`). */
const strichVon = (page: Page, u: { id: string; dok: string }, src: string) =>
	page.evaluate(
		async (adresse) => ((await (await fetch(adresse)).json()) as { strich: string | null }).strich,
		`/api/dokumente/${u.id}/${u.dok}/bilder/fassung?src=${encodeURIComponent(src)}`,
	);

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

	test('⌥4 öffnet die Schublade; Klick legt Wilma 150 px breit in die Mitte, gewählt, ein Schritt', async ({
		page,
	}) => {
		await blatt(page);
		// Ohne die Ebenen daneben bleibt „100 %“ echt, Wilma also 150 px breit am Bildschirm (183).
		await page.keyboard.press('Alt+Digit1');
		await expect(schubladenKnopf(page, 'ebenen')).toHaveAttribute('aria-pressed', 'false');
		const vorher = await quelle(page);
		await page.keyboard.press('Alt+Digit4');
		await expect(schublade(page)).toBeVisible();
		await expect(schublade(page).locator('[data-schubladenhinweis]')).toHaveCount(0);
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
		await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
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
		// Wilma hat nur ihre Grundpose: kein Raster der Posen.
		await expect(wahl.getByRole('group', { name: 'Pose' })).toHaveCount(0);
		const lage = /style="[^"]*"/.exec(figurTag(await quelle(page)))?.[0];
		await wahl.getByRole('combobox', { name: 'Figur' }).selectOption('willi');
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
		const fassung = (src: string) => strichVon(page, u, src);
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

test.describe('Figurenbibliothek (177)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
	});

	test('je Figur ein Abschnitt mit ihren Posen: Willi, Wilma, Kiki; Öffnen holt nichts ins Dokument', async ({
		page,
	}) => {
		const u = await blatt(page);
		await page.keyboard.press('Alt+Digit4');
		await expect(schublade(page).locator('[data-figuren-gruppe] > h3')).toHaveText(['Willi', 'Wilma', 'Kiki']);
		for (const [i, id] of ['willi', 'wilma', 'kiki'].entries()) {
			await expect(gruppen(page).nth(i)).toHaveAttribute('data-figuren-gruppe', id);
		}
		await expect(gruppe(page, 'kiki').locator('[data-ablage-gut]')).toHaveCount(2);
		await kachel(page, 'Kiki winkt').hover();
		await expect(page.locator('[data-tooltip]')).toHaveText('Kiki winkt');
		// Gegenprobe: kein Segment mehr oben, kein Abschnitt „Willi & Co.“.
		await expect(schublade(page).getByRole('group')).toHaveCount(0);
		await expect(gruppe(page, 'willi-co')).toHaveCount(0);

		// Die Kacheln zeigen ihr Vorschaubild; in `bilder/` des Dokuments kommt dabei nichts.
		const bilder = schublade(page).locator('[data-figur-kachel]');
		await expect
			.poll(() => bilder.evaluateAll((alle) => alle.every((b) => (b as HTMLImageElement).naturalWidth > 0)))
			.toBe(true);
		const imDokument = await readdir(path.join(u.ordner, 'bilder')).catch(() => []);
		expect(imDokument.filter((name) => name.startsWith('kiki'))).toEqual([]);
	});

	test('Klick auf „Kiki“ holt die Pose mit Strichfassung, in einem Schritt; „Kiki winkt“ hat keine', async ({
		page,
	}) => {
		const u = await blatt(page);
		await oeffneSchublade(page, 'figuren');
		const vorher = await quelle(page);
		await kachel(page, 'Kiki').click();
		await expect.poll(async () => figurTag(await quelle(page))).toContain('data-figur="kiki"');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Kiki abgelegt');
		const tag = figurTag(await quelle(page));
		expect(tag).toContain('src="bilder/kiki.png"');
		expect(tag).toContain('alt="Kiki"');
		expect(tag).toContain('--b:150px');
		expect(await strichVon(page, u, 'bilder/kiki.png')).toBe('kiki-strich.png');
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);

		await kachel(page, 'Kiki winkt').click();
		await expect.poll(async () => figurTag(await quelle(page))).toContain('data-figur="kiki-winkt"');
		expect(figurTag(await quelle(page))).toContain('src="bilder/kiki-winkt.png"');
		expect(await strichVon(page, u, 'bilder/kiki-winkt.png')).toBeNull();
		expect(await quelle(page)).not.toContain('/ansicht/');
	});

	test('mit ⌘ gezogen: Tipp mit Kiki als Leitfigur, mit dem geholten src', async ({ page }) => {
		await blatt(page);
		await oeffneSchublade(page, 'figuren');
		await greife(page, 'Kiki');
		const ziel = await mitte(material(page).locator('.aufgabe').nth(1));
		await page.mouse.move(ziel.x, ziel.y, { steps: 8 });
		await page.keyboard.down('Meta');
		await page.mouse.move(ziel.x, ziel.y + 4, { steps: 2 });
		await expect(material(page).locator('[data-luecke]')).toHaveCount(1);
		await page.mouse.up();
		await page.keyboard.up('Meta');

		await expect.poll(async () => anzahl(await quelle(page), 'class="tipp"')).toBe(1);
		const q = await quelle(page);
		expect(q).toMatch(/<div class="tipp"><img class="figur" src="bilder\/kiki\.png" alt="Kiki">/);
		expect(q).not.toContain('/ansicht/');
		expect(q).not.toContain('figur-frei');
	});

	test('Suche: „winkt“ lässt nur die Pose übrig, „zebra“ nichts', async ({ page }) => {
		await blatt(page);
		await oeffneSchublade(page, 'figuren');
		const suche = schublade(page).getByRole('searchbox', { name: 'Figuren suchen' });
		await suche.fill('winkt');
		await expect(gruppen(page)).toHaveCount(1);
		await expect(gruppe(page, 'kiki').locator('[data-ablage-gut]')).toHaveCount(1);
		await expect(kachel(page, 'Kiki winkt')).toBeVisible();
		await suche.fill('zebra');
		await expect(gruppen(page)).toHaveCount(0);
		await expect(schublade(page).locator('[data-schublade-leer]')).toHaveText('Nichts passt zu „zebra“.');
		// Gegenprobe: Leer ist alles wieder da.
		await suche.fill('');
		await expect(gruppen(page)).toHaveCount(3);
	});

	test('Inspektor an Kiki: Menü „Figur“ und Raster der Posen tauschen; Lage und Größe bleiben', async ({ page }) => {
		await blatt(page);
		await oeffneSchublade(page, 'figuren');
		await kachel(page, 'Kiki').click();
		await expect.poll(async () => figurTag(await quelle(page))).toContain('data-figur="kiki"');
		const wahl = page.locator('[data-figur-wahl]');
		await expect(wahl).toHaveAttribute('data-figur-wahl', 'kiki');
		const menue = wahl.getByRole('combobox', { name: 'Figur' });
		await expect(menue).toHaveValue('kiki');
		const posen = wahl.getByRole('group', { name: 'Pose' });
		await expect(posen.getByRole('button')).toHaveCount(2);
		await expect(posen.getByRole('button', { name: 'Kiki', exact: true })).toHaveAttribute('aria-pressed', 'true');
		const lage = /style="[^"]*"/.exec(figurTag(await quelle(page)))?.[0];

		await posen.getByRole('button', { name: 'Kiki winkt' }).click();
		await expect.poll(async () => figurTag(await quelle(page))).toContain('data-figur="kiki-winkt"');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Kiki winkt statt Kiki');
		expect(/style="[^"]*"/.exec(figurTag(await quelle(page)))?.[0]).toBe(lage);
		await expect(posen.getByRole('button', { name: 'Kiki winkt' })).toHaveAttribute('aria-pressed', 'true');

		await menue.selectOption('willi');
		await expect.poll(async () => figurTag(await quelle(page))).toContain('data-figur="willi"');
		expect(figurTag(await quelle(page))).toMatch(/src="[^"]*willi\.png"/);
		await expect(wahl).toHaveAttribute('data-figur-wahl', 'willi');
		expect(/style="[^"]*"/.exec(figurTag(await quelle(page)))?.[0]).toBe(lage);
	});
});
