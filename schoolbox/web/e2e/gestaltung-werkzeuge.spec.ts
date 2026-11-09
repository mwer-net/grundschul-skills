import type { Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, FIGUR_FREI } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/** 107: Werkzeuge R O Y L ★, Sprechblase mit Zipfel, Denkblase, Band, Linie und Pfeil. */

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const formen = (page: Page, art: string) => material(page).locator(`svg.form[data-form="${art}"]`);
const blasen = (page: Page) => material(page).locator('.form-text[data-lage="frei"]');
const anzahl = (html: string, art: string) => html.split(`data-form="${art}"`).length - 1;
const aktivesWerkzeug = (page: Page) => page.locator('[data-werkzeug][aria-pressed="true"]');

const oeffneFormen = async (page: Page, vorne: string[] = []) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, blattMit({ vorne }));
	await oeffneSchublade(page, 'formen');
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

const ziehe = async (page: Page, von: { x: number; y: number }, dx: number, dy: number, taste?: 'Shift' | 'Alt') => {
	await page.mouse.move(von.x, von.y);
	await page.mouse.down();
	if (taste) {
		await page.keyboard.down(taste);
	}
	await page.mouse.move(von.x + dx, von.y + dy, { steps: 6 });
	await page.mouse.up();
	if (taste) {
		await page.keyboard.up(taste);
	}
};

const griff = async (page: Page, name: string) => {
	const r = await page.locator(`[data-gestaltung-griff="${name}"]`).boundingBox();
	if (!r) {
		throw new Error(`Griff ${name} fehlt`);
	}
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

/** `--b` und `--h` des letzten Elements dieser Form in der Quelle. */
const groesse = async (page: Page, art: string) => {
	const html = await quelle(page);
	const teil = html.slice(html.lastIndexOf(`data-form="${art}"`));
	const b = Number(/--b:(\d+)px/.exec(teil)?.[1]);
	const h = Number(/--h:(\d+)px/.exec(teil)?.[1]);
	return { b, h };
};

test.describe('Werkzeuge R O Y L ★ (107)', () => {
	for (const [taste, art] of [
		['KeyR', 'rechteck'],
		['KeyO', 'ellipse'],
		['KeyY', 'vieleck'],
		['KeyL', 'linie'],
	] as const) {
		test(`${taste.slice(3)} zeichnet ${art}, danach ist V aktiv, ein Schritt`, async ({ page }) => {
			await oeffneFormen(page);
			await page.keyboard.press(taste);
			await expect(aktivesWerkzeug(page)).toHaveAttribute('data-werkzeug', art);
			await ziehe(page, await aufSeite(page, 0.3, 0.4), 160, 90);
			await expect.poll(async () => anzahl(await quelle(page), art)).toBe(1);
			await expect(aktivesWerkzeug(page)).toHaveAttribute('data-werkzeug', 'auswahl');
			await expect(zurueck(page)).toHaveAttribute('data-schritt', /.+/);
			await zurueck(page).click();
			await expect.poll(async () => anzahl(await quelle(page), art)).toBe(0);
		});
	}

	test('der Stern zeichnet über seinen Knopf; Esc bricht ab', async ({ page }) => {
		await oeffneFormen(page);
		await page.locator('[data-werkzeug="stern"]').click();
		await ziehe(page, await aufSeite(page, 0.3, 0.4), 120, 120);
		await expect(formen(page, 'stern')).toHaveCount(1);
		await page.keyboard.press('KeyR');
		await page.keyboard.press('Escape');
		await expect(aktivesWerkzeug(page)).toHaveAttribute('data-werkzeug', 'auswahl');
		await ziehe(page, await aufSeite(page, 0.6, 0.6), 80, 80);
		expect(anzahl(await quelle(page), 'rechteck')).toBe(0);
	});

	test('⇧ gibt Quadrat und Kreis, ⌥ zieht aus der Mitte auf, Klick legt die Standardgröße ab', async ({ page }) => {
		await oeffneFormen(page);
		await page.keyboard.press('KeyR');
		await ziehe(page, await aufSeite(page, 0.2, 0.3), 160, 60, 'Shift');
		await expect.poll(() => groesse(page, 'rechteck')).toEqual(expect.objectContaining({ b: expect.any(Number) }));
		const quadrat = await groesse(page, 'rechteck');
		expect(quadrat.b).toBe(quadrat.h);

		await page.keyboard.press('KeyO');
		await ziehe(page, await aufSeite(page, 0.6, 0.3), 50, 120, 'Shift');
		await expect.poll(async () => anzahl(await quelle(page), 'ellipse')).toBe(1);
		const kreis = await groesse(page, 'ellipse');
		expect(kreis.b).toBe(kreis.h);

		await page.keyboard.press('KeyY');
		const mitte = await aufSeite(page, 0.5, 0.7);
		await ziehe(page, mitte, 40, 30, 'Alt');
		await expect.poll(async () => anzahl(await quelle(page), 'vieleck')).toBe(1);
		const vieleck = await formen(page, 'vieleck').boundingBox();
		expect(Math.abs((vieleck?.x ?? 0) + (vieleck?.width ?? 0) / 2 - mitte.x)).toBeLessThan(4);

		await page.keyboard.press('KeyR');
		const klick = await aufSeite(page, 0.5, 0.5);
		await page.mouse.click(klick.x, klick.y);
		await expect.poll(async () => anzahl(await quelle(page), 'rechteck')).toBe(2);
		const html = await quelle(page);
		expect(html.slice(html.lastIndexOf('data-form="rechteck"'))).toMatch(/--b:120px;--h:120px/);
	});

	test('in der Sprechblase getippt bleibt R ein Buchstabe', async ({ page }) => {
		await oeffneFormen(page);
		await page.locator('[data-blase-kachel="sprechblase-rund"]').click();
		await page.keyboard.type('Rate mal!');
		await page.keyboard.press('Escape');
		await expect.poll(() => quelle(page)).toContain('Rate mal!');
		await expect(aktivesWerkzeug(page)).toHaveAttribute('data-werkzeug', 'auswahl');
	});
});

test.describe('Sprechblase, Denkblase, Band (107)', () => {
	test('aus der Schublade: Text tippen, Zipfel zu Wilma ziehen, rastet an ihrer Mitte ein; je ein Schritt', async ({
		page,
	}) => {
		await oeffneFormen(page, [FIGUR_FREI]);
		await page.locator('[data-blase-kachel="sprechblase-rund"]').click();
		await page.keyboard.type('Zähl genau!');
		await page.keyboard.press('Escape');
		await expect.poll(() => quelle(page)).toMatch(/<div class="form-inhalt">Zähl genau!<\/div>/);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Sprechblase abgelegt');

		await blasen(page).first().click();
		const wilma = await material(page).locator('img.figur-frei').boundingBox();
		if (!wilma) {
			throw new Error('Wilma fehlt');
		}
		const von = await griff(page, 'zipfel');
		await ziehe(page, von, wilma.x + wilma.width / 2 + 7 - von.x, wilma.y + wilma.height / 2 - 9 - von.y);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Zipfel gezogen');
		const spitze = await griff(page, 'zipfel');
		expect(Math.abs(spitze.x - (wilma.x + wilma.width / 2))).toBeLessThan(3);
		expect(Math.abs(spitze.y - (wilma.y + wilma.height / 2))).toBeLessThan(3);
		await zurueck(page).click();
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Sprechblase abgelegt');
	});

	test('Denkblase und Band ablegen, Form im Inspektor wechseln, der Text bleibt', async ({ page }) => {
		await oeffneFormen(page);
		await page.locator('[data-blase-kachel="denkblase"]').click();
		await page.keyboard.type('Hm …');
		await page.keyboard.press('Escape');
		await expect.poll(() => quelle(page)).toMatch(/data-blase="gedanke"/);
		await page.locator('[data-blase-kachel="band"]').click();
		await page.keyboard.press('Escape');
		await expect(blasen(page)).toHaveCount(2);

		await blasen(page).first().click();
		await page.locator('[data-form-art]').selectOption('band');
		await expect.poll(() => quelle(page)).not.toMatch(/data-blase="gedanke"/);
		const html = await quelle(page);
		expect(html.split('data-form="band"').length - 1).toBe(2);
		expect(html).toContain('Hm …');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Form: Band');
	});

	test('zu viel Text in der Blase meldet abgeschnitten; Zipfel im Druckrand nicht, die Box schon', async ({ page }) => {
		const lang =
			'<div class="form-text" data-lage="frei" data-form="sprechblase" data-zipfel="-90,40" style="--x:100px;--y:200px;--b:180px;--h:84px;--gr:22px"><div class="form-inhalt">Hier steht viel zu viel Text für eine so kleine Blase, er passt nie hinein.</div></div>';
		await oeffneFormen(page, [lang]);
		await page.locator('[data-pruefung] > button').click();
		await expect(page.locator('[data-pruefliste] [data-pruefpunkt="abgeschnitten"]')).toBeVisible();
		await expect(page.locator('[data-pruefliste] [data-pruefpunkt="druckrand"]')).toHaveCount(0);
		await aendere(page, blattMit({ vorne: [lang.replace('--x:100px', '--x:6px').replace('viel zu viel Text für eine so kleine Blase, er passt nie hinein.', 'kurz')] }));
		await page.locator('[data-pruefung] > button').click();
		await expect(page.locator('[data-pruefliste] [data-pruefpunkt="druckrand"]')).toBeVisible();
	});
});

test.describe('Linie und Pfeil (107)', () => {
	test('Endpunkt-Griffe statt Rahmen, ⇧ 45°, Pfeilspitze am Ende im Inspektor', async ({ page }) => {
		await oeffneFormen(page);
		await page.locator('[data-blase-kachel="linie"]').click();
		await expect(formen(page, 'linie')).toHaveCount(1);
		await expect(page.locator('[data-gestaltung-griff="linie-ende"]')).toBeVisible();
		await expect(page.locator('[data-gestaltung-griff="drehen"]')).toHaveCount(0);
		await expect(page.locator('[data-gestaltung-griff="unten-rechts"]')).toHaveCount(0);

		const ende = await griff(page, 'linie-ende');
		await ziehe(page, ende, 10, 120, 'Shift');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Linie geändert');
		const punkte = /data-punkte="([\d.]+),([\d.]+) ([\d.]+),([\d.]+)"/.exec(await quelle(page));
		expect(punkte).not.toBeNull();
		const [, x1, , x2] = (punkte ?? []).map(Number);
		expect(x1).toBe(x2);

		await page.locator('[data-form-parameter="data-ende"]').getByRole('button', { name: 'Pfeil' }).click();
		await expect.poll(() => quelle(page)).toMatch(/data-ende="pfeil"/);
		await expect(material(page).locator('svg.form[data-form="linie"] path.spitzen')).toHaveCount(1);
		await expect(page.locator('[data-gestaltung-fuellung]')).not.toContainText('Füllung');
	});

	test('der Pfeil aus der Schublade hat eine Spitze in der Farbe der Kontur', async ({ page }) => {
		await oeffneFormen(page);
		await page.locator('[data-blase-kachel="pfeil"]').click();
		await expect.poll(() => quelle(page)).toMatch(/<path class="spitzen" d="[^"]+" style="fill:var\(--dunkel\);stroke:none"\/>/);
	});
});
