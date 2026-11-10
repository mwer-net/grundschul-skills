/**
 * Anker (106): Gestaltung an einen Baustein hängen, sie wandert mit (Z5). Am ⚓-Griff, im Inspektor, in den Ebenen und
 * als Befehl; je ein Schritt, die Lage im Blatt bleibt. Löschen nennt die mitgelöschten Elemente.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { aendere, geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, FIGUR_ANKER, FIGUR_FREI, FORM } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const wilma = (page: Page) => material(page).locator('img.figur-frei');
const aufgabe = (page: Page, i: number) => material(page).locator('.aufgabe').nth(i);
const griff = (page: Page) => page.locator('[data-gestaltung-griff="anker"]');
const haengtAn = (page: Page) => page.locator('[data-gestaltung-anker] select');
const zurueck = (page: Page) => page.getByRole('button', { name: /^Rückgängig/ }).first();
const figurTag = (html: string) => /<img class="figur-frei"[^>]*>/.exec(html)?.[0] ?? '';
const amAnker = async (page: Page) => figurTag(await quelle(page)).includes('data-anker');

/** Wilma frei, um 12° gedreht. */
const GEDREHT = FIGUR_FREI.replace('--spiegeln:-1', '--spiegeln:-1;--drehen:12deg');

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

/** Die Lage im Blatt, relativ zur Seite: unabhängig vom Rollen. */
const imBlatt = async (page: Page) => {
	await geladen(page);
	const w = await kasten(wilma(page));
	const s = await kasten(material(page).locator('.seite').first());
	return { x: w.x - s.x, y: w.y - s.y, b: w.width, h: w.height };
};

const gleich = (a: { x: number; y: number }, b: { x: number; y: number }) => {
	expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
};

/** ⚓ auf die Aufgabe ziehen; während des Zugs Rahmen und „hängt an …“. */
const ziehAnkerAuf = async (page: Page, ziel: Locator, text: string) => {
	const g = await kasten(griff(page));
	const z = await kasten(ziel);
	await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
	await page.mouse.down();
	await page.mouse.move(z.x + 80, z.y + z.height / 2, { steps: 8 });
	await expect(page.locator('[data-wert-am-zeiger]')).toHaveText(text);
	await expect(page.locator('[data-zusatz-ziel]')).toBeVisible();
	await page.mouse.up();
};

test.describe('Anker (106)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
	});

	test('Z5: Wilma per ⚓ an Aufgabe 3, eine Aufgabe davor: Wilma wandert mit; gedreht bleibt die Lage', async ({
		page,
	}) => {
		await blatt(page, blattMit({ vorne: [GEDREHT] }));
		await wilma(page).click();
		const vorher = await imBlatt(page);
		await ziehAnkerAuf(page, aufgabe(page, 2), 'hängt an Aufgabe 3');
		await expect.poll(() => amAnker(page)).toBe(true);
		gleich(await imBlatt(page), vorher);
		await expect(material(page).locator('.ebene')).toHaveCount(0);
		const a3 = await kasten(aufgabe(page, 2));
		const w = await kasten(wilma(page));
		const davor = await quelle(page);
		await aendere(
			page,
			davor.replace(
				'<div class="aufgabe">',
				'<div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">Neu.</span></div><div class="koerper" style="height:120px"></div></div>\n  <div class="aufgabe">',
			),
		);
		await expect.poll(async () => (await kasten(aufgabe(page, 3))).y).toBeGreaterThan(a3.y + 100);
		const a3neu = await kasten(aufgabe(page, 3));
		const wneu = await kasten(wilma(page));
		gleich({ x: wneu.x - a3neu.x, y: wneu.y - a3neu.y }, { x: w.x - a3.x, y: w.y - a3.y });
	});

	test('Aufgabe auf die nächste Seite verschoben: Wilma geht mit', async ({ page }) => {
		const zwei = blattMit({ anker: [FIGUR_ANKER] }).replace(
			'</section>',
			'</section>\n<section class="seite">\n  <div class="aufgabe"><span class="nr">4</span><div class="anw"><span class="text">Vier.</span></div></div>\n</section>',
		);
		await blatt(page, zwei);
		const q = await quelle(page);
		const erste = /\n {2}<div class="aufgabe">[\s\S]*?\n {2}<\/div>\n/.exec(q)?.[0] ?? '';
		expect(erste).toContain('figur-frei');
		await aendere(
			page,
			q.replace(erste, '\n').replace('<span class="nr">4</span>', `${erste.trim()}\n  <span class="nr">4</span>`),
		);
		await expect(material(page).locator('.seite').nth(1).locator('img.figur-frei')).toHaveCount(1);
	});

	test('Inspektor „Hängt an“ hängt an und löst, je ein Schritt; ⌘Z stellt her; Lage bleibt', async ({ page }) => {
		await blatt(page, blattMit({ vorne: [GEDREHT] }));
		await wilma(page).click();
		const vorher = await imBlatt(page);
		const start = await quelle(page);
		await expect(haengtAn(page)).toHaveValue('');
		await haengtAn(page).selectOption({ label: 'Aufgabe 2 · Zeichne ein Haus aus Formen.' });
		await expect.poll(() => amAnker(page)).toBe(true);
		gleich(await imBlatt(page), vorher);
		await expect(page.locator('[data-gestaltung-ebene="anker"]')).toContainText('Am Anker liegt es immer vorne.');
		await haengtAn(page).selectOption('');
		await expect.poll(() => amAnker(page)).toBe(false);
		gleich(await imBlatt(page), vorher);
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => amAnker(page)).toBe(true);
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(start);
	});

	test('Ziehen in den Ebenen hängt an und löst', async ({ page }) => {
		// Eine zweite freie Form hält die Zeile „Hauptstapel“ da: Ohne freie Ebenen blendet die Gliederung sie aus.
		const bleibt = FORM.replace('--y:84px', '--y:1000px').replace('--x:610px', '--x:300px');
		await blatt(page, blattMit({ vorne: [FORM.replace('--y:84px', '--y:900px'), bleibt], anker: [FIGUR_ANKER] }));
		await oeffneSchublade(page, 'ebenen');
		const rechne = page.locator('[data-zeile-nr]', { hasText: 'Rechne' });
		await rechne.getByRole('button', { name: 'Aufklappen' }).click();
		const anker = page.locator('[data-zeilen-art="anker"]');
		await expect(anker).toHaveCount(1);
		await expect(anker.locator('[data-ebenen-zeichen="anker"]')).toBeVisible();
		// Stern auf Aufgabe 2
		const stern = await kasten(page.locator('[data-zeilen-art="vorne"]').first());
		const ziel = await kasten(page.locator('[data-gliederung-titel]', { hasText: 'Zeichne ein Haus' }));
		await page.mouse.move(stern.x + 60, stern.y + stern.height / 2);
		await page.mouse.down();
		await page.mouse.move(ziel.x + 60, ziel.y + ziel.height / 2, { steps: 10 });
		await page.mouse.up();
		await expect.poll(async () => /<svg class="form"[^>]*data-anker/.test(await quelle(page))).toBe(true);
		// Wilma aus Aufgabe 1 heraus, über den Hauptstapel: gelöst, vorne
		// Der Stern hat jetzt auch eine Ankerzeile (unter Aufgabe 2); gemeint ist Wilma, erst wenn die Zeilen stehen.
		await expect(anker).toHaveCount(2);
		const w = await kasten(anker.filter({ hasText: 'Wilma' }));
		const oben = await kasten(page.locator('[data-zeilen-art="hauptstapel"]'));
		await page.mouse.move(w.x + 60, w.y + w.height / 2);
		await page.mouse.down();
		await page.mouse.move(oben.x + 60, oben.y + 2, { steps: 10 });
		await page.mouse.up();
		await expect.poll(() => amAnker(page)).toBe(false);
		await expect(material(page).locator('.ebene.vorne img.figur-frei')).toHaveCount(1);
	});

	test('Befehle in der Palette hängen an und lösen', async ({ page }) => {
		await blatt(page, blattMit({ vorne: [FIGUR_FREI] }));
		await wilma(page).click();
		await page.keyboard.press('ControlOrMeta+k');
		await page.keyboard.type('Anhängen an Baustein');
		await page.keyboard.press('Enter');
		await expect.poll(() => amAnker(page)).toBe(true);
		await page.keyboard.press('ControlOrMeta+k');
		await page.keyboard.type('Vom Baustein lösen');
		await page.keyboard.press('Enter');
		await expect.poll(() => amAnker(page)).toBe(false);
	});

	test('Esc vom Element am Anker wählt die Aufgabe', async ({ page }) => {
		await blatt(page, blattMit({ anker: [FIGUR_ANKER] }));
		await wilma(page).click({ force: true });
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-bausteinleiste="aufgabe"]')).toContainText('Aufgabe 1');
	});

	test('Aufgabe mit Wilma löschen: der Schritt nennt sie, ⌘Z bringt beide zurück', async ({ page }) => {
		await blatt(page, blattMit({ anker: [FIGUR_ANKER] }));
		const start = await quelle(page);
		await aufgabe(page, 0).locator('.nr').click();
		await page.keyboard.press('Backspace');
		await expect(page.getByText('Aufgabe 1 gelöscht, mit Wilma.')).toBeVisible();
		await expect(zurueck(page)).toBeEnabled();
		expect(await quelle(page)).not.toContain('figur-frei');
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(start);
	});

	test('Nummer und Ziehen der Aufgabe sind mit Anker unverändert', async ({ page }) => {
		await blatt(page, blattMit({ anker: [FIGUR_ANKER] }));
		await expect(aufgabe(page, 0).locator(':scope > .nr')).toHaveText('1');
		await expect(aufgabe(page, 1).locator(':scope > .nr')).toHaveText('2');
		await aufgabe(page, 0).locator('.nr').click();
		await expect(page.locator('[data-bausteinleiste="aufgabe"]')).toContainText('Aufgabe 1');
		await expect(page.locator('[data-bausteinleiste="aufgabe"] [data-leiste-griff]')).toBeVisible();
	});
});
