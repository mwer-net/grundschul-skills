import { readFile, writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, STREUUNG } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/**
 * 109: Streuung (Konfetti, Punkte, Sterne), Würfeln, Dichte, s/w. 174: Sie entsteht nur mit dem Werkzeug Streuen, als
 * Konfetti; Punkte und Sterne wählt der Inspektor unter „Art“.
 */

/** Sterne ohne Teile, wie im Bestand: Der Editor zeichnet sie beim Öffnen, schreibt sie aber nicht. */
const STERNE =
	'<svg class="streuung" data-lage="frei" data-streuung="sterne" data-saat="4711" data-dichte="0.5" data-formen="stern" data-farben="haupt akzent dunkel" data-groesse="mittel" viewBox="0 0 300 300" style="--x:470px;--y:800px;--b:300px;--h:300px"></svg>';

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const streuungen = (page: Page) => material(page).locator('svg.streuung');
const anzahl = (html: string) => html.split('<svg class="streuung"').length - 1;
const saat = (html: string) => /data-saat="(\d+)"/.exec(html)?.[1] ?? '';
const werkzeug = (page: Page) => page.locator('[data-schublade-werkzeuge] [data-werkzeug="streuen"]');
const inspektor = (page: Page) => page.locator('[data-gestaltung-streuung]');
/** `data-streuung-art` steht nur hier im Inspektor um das Segment „Art“. */
const art = (page: Page, name: string) =>
	inspektor(page).locator('[data-streuung-art]').getByRole('button', { name, exact: true });

const oeffneFormen = async (page: Page, hinten: string[] = []) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit({ hinten }));
	await oeffne(page, u.id, u.dok);
	await oeffneSchublade(page, 'werkzeuge');
	await expect(page.locator('[data-schublade-werkzeuge]')).toBeVisible();
	return u;
};

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

/** Streuen wählen und einmal auf die Seite klicken: Konfetti in Standardgröße, die Mitte am Zeiger, danach gewählt. */
const streue = async (page: Page, ax = 0.5, ay = 0.5) => {
	const vorher = anzahl(await quelle(page));
	await werkzeug(page).click();
	await expect(werkzeug(page)).toHaveAttribute('aria-pressed', 'true');
	const p = await aufSeite(page, ax, ay);
	await page.mouse.click(p.x, p.y);
	await expect.poll(async () => anzahl(await quelle(page))).toBe(vorher + 1);
	await expect(inspektor(page)).toBeVisible();
};

test.describe('Streuung (109, 174)', () => {
	test('Die Schublade hat keinen Abschnitt Konfetti, Streuen steht einmal in der Werkzeugreihe', async ({ page }) => {
		await oeffneFormen(page);
		await expect(page.locator('[data-formen-abschnitt="grundformen"]')).toBeVisible();
		await expect(page.locator('[data-formen-abschnitt="streuung"]')).toHaveCount(0);
		await expect(page.locator('[data-streuung-kacheln]')).toHaveCount(0);
		await expect(page.locator('[data-streuen-knopf]')).toHaveCount(0);
		await expect(werkzeug(page)).toHaveCount(1);
		await expect(werkzeug(page).locator('svg.lucide-party-popper')).toBeVisible();
	});

	test('Ein Klick mit Streuen legt Konfetti in 300 × 300 an, hinten, mit Teilen, ein Schritt', async ({ page }) => {
		await oeffneFormen(page);
		await streue(page);
		const text = await quelle(page);
		expect(text).toMatch(/class="ebene hinten"[^]*data-streuung="konfetti"/);
		expect(text).toMatch(/<svg class="streuung"[^>]*--b:300px;--h:300px/);
		await expect(streuungen(page).first()).toBeVisible();
		expect(await streuungen(page).first().locator('> *').count()).toBeGreaterThan(5);
		expect(await streuungen(page).first().locator('> *').count()).toBeLessThanOrEqual(200);
		await zurueck(page).click();
		await expect.poll(async () => anzahl(await quelle(page))).toBe(0);
	});

	for (const [name, wert, form] of [
		['Punkte', 'punkte', 'punkt'],
		['Sterne', 'sterne', 'stern'],
	] as const) {
		test(`Art im Inspektor macht daraus ${name}, mit den Formen der Art, ein Schritt`, async ({ page }) => {
			await oeffneFormen(page);
			await streue(page);
			await art(page, name).click();
			await expect.poll(async () => await quelle(page)).toContain(`data-streuung="${wert}"`);
			expect(await quelle(page)).toContain(`data-formen="${form}"`);
			await expect(inspektor(page)).toHaveAttribute('data-gestaltung-streuung', wert);
			await zurueck(page).click();
			await expect.poll(async () => await quelle(page)).toContain('data-streuung="konfetti"');
			expect(await quelle(page)).toContain('data-formen="punkt dreieck raute streifen"');
			expect(anzahl(await quelle(page))).toBe(1);
		});
	}

	test('Punkte nehmen die nächste Blattecke, auch in s/w, wo die Streuung weg ist', async ({ page }) => {
		for (const [ax, ecke, sw] of [
			[0.8, 'or', false],
			[0.2, 'ol', false],
			[0.8, 'or', true],
		] as const) {
			await oeffneFormen(page);
			await streue(page, ax, 0.2);
			expect(await quelle(page)).not.toContain('data-ecke=');
			if (sw) {
				const s = streuungen(page).first();
				await s.evaluate((e) => e.ownerDocument.body.classList.add('sw'));
				await expect(s).toBeHidden();
			}
			await art(page, 'Punkte').click();
			await expect.poll(async () => await quelle(page)).toContain(`data-ecke="${ecke}"`);
			await expect(inspektor(page).locator(`[data-streuung-ecke="${ecke}"]`)).toBeVisible();
		}
	});

	test('Eine gewählte Ecke bleibt beim Wechsel der Art', async ({ page }) => {
		await oeffneFormen(page);
		await streue(page, 0.2, 0.2);
		await art(page, 'Punkte').click();
		await expect.poll(async () => await quelle(page)).toContain('data-ecke="ol"');
		await inspektor(page).locator('[data-streuung-ecke] [data-ecke="ur"]').click();
		await expect.poll(async () => await quelle(page)).toContain('data-ecke="ur"');
		await art(page, 'Konfetti').click();
		await expect.poll(async () => await quelle(page)).toContain('data-streuung="konfetti"');
		await art(page, 'Punkte').click();
		await expect.poll(async () => await quelle(page)).toContain('data-streuung="punkte"');
		expect(await quelle(page)).toContain('data-ecke="ur"');
		expect(await quelle(page)).not.toContain('data-ecke="ol"');
	});

	test('Neu laden ergibt dasselbe Bild', async ({ page }) => {
		const u = await oeffneFormen(page);
		await streue(page);
		await expect(streuungen(page).first()).toBeVisible();
		// Ohne Auswahlrahmen, wie nach dem Neuladen.
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-gestaltung-rahmen]')).toHaveCount(0);
		const vorher = await streuungen(page).first().screenshot();
		await gespeichert(page, u.material);
		await page.reload();
		await expect(streuungen(page).first()).toBeVisible();
		const nachher = await streuungen(page).first().screenshot();
		expect(nachher.equals(vorher)).toBe(true);
	});

	test('Würfeln ist ein Schritt, ⌘Z bringt das alte Bild zurück', async ({ page }) => {
		await oeffneFormen(page);
		await streue(page);
		await expect(page.locator('[data-streuung-wuerfeln]').first()).toBeVisible();
		const vorher = await quelle(page);
		await page.locator('[data-streuung-wuerfeln]').first().click();
		await expect.poll(async () => saat(await quelle(page))).not.toBe(saat(vorher));
		await zurueck(page).click();
		await expect.poll(async () => await quelle(page)).toBe(vorher);
	});

	test('Größe ändern erzeugt neu, mit derselben Saat', async ({ page }) => {
		await oeffneFormen(page);
		await streue(page);
		const vorher = await quelle(page);
		const feld = page.locator('[data-abschnitt="anordnen"] input[aria-label="Breite"]').first();
		await feld.fill('150');
		await feld.press('Enter');
		await expect.poll(async () => await quelle(page)).toContain('--b:150px');
		const neu = await quelle(page);
		expect(saat(neu)).toBe(saat(vorher));
		expect(neu).toContain('viewBox="0 0 150 300"');
	});

	test('Inspektor: Art, Formen, Farben, Größe, Dichte, je ein Schritt', async ({ page }) => {
		await oeffneFormen(page);
		await streue(page);
		const abschnitt = inspektor(page);
		await abschnitt.locator('[data-streuung-form="stern"]').click();
		await expect.poll(async () => await quelle(page)).toMatch(/data-formen="[^"]*stern/);
		await abschnitt.locator('[data-streuung-farbe="dunkel"]').click();
		await expect.poll(async () => await quelle(page)).toMatch(/data-farben="haupt akzent"/);
		await abschnitt.getByRole('button', { name: 'Groß' }).click();
		await expect.poll(async () => await quelle(page)).toContain('data-groesse="gross"');
		await art(page, 'Sterne').click();
		await expect.poll(async () => await quelle(page)).toContain('data-streuung="sterne"');
		// Seit 171 schreibt der Inspektor erst, wenn das Bild des Schritts zu sehen ist.
		await expect(streuungen(page).first()).toHaveAttribute('data-streuung', 'sterne');
		const regler = abschnitt.locator('input[aria-label="Dichte"]');
		await regler.fill('100');
		await expect.poll(async () => await quelle(page)).toContain('data-dichte="1"');
	});

	test('In s/w ist sie weg, mit „In s/w: grau“ ist sie grau', async ({ page }) => {
		await oeffneFormen(page);
		await streue(page);
		const s = streuungen(page).first();
		await expect(s).toBeVisible();
		await s.evaluate((e) => e.ownerDocument.body.classList.add('sw'));
		await expect(s).toBeHidden();
		await s.evaluate((e) => e.setAttribute('data-sw', 'grau'));
		await expect(s).toBeVisible();
	});

	test('Das Werkzeug Streuen zieht eine auf, hinten, in dieser Größe', async ({ page }) => {
		await oeffneFormen(page);
		await werkzeug(page).click();
		const von = await aufSeite(page, 0.2, 0.2);
		const bis = await aufSeite(page, 0.7, 0.5);
		await page.mouse.move(von.x, von.y);
		await page.mouse.down();
		await page.mouse.move(bis.x, bis.y, { steps: 6 });
		await page.mouse.up();
		await expect.poll(async () => anzahl(await quelle(page))).toBe(1);
		expect(await quelle(page)).toMatch(/class="ebene hinten"[^]*data-streuung="konfetti"/);
		await zurueck(page).click();
		await expect.poll(async () => anzahl(await quelle(page))).toBe(0);
	});

	test('Suche „Konfetti“, „Punkte“, „Sterne“ in der Schublade zeigt Streuen', async ({ page }) => {
		await oeffneFormen(page);
		const suche = page.locator('[data-schublade-werkzeuge]').getByRole('searchbox');
		for (const wort of ['Konfetti', 'Punkte', 'Sterne']) {
			await suche.fill(wort);
			await expect(page.locator('[data-formen-abschnitt="werkzeuge"] [data-werkzeug="streuen"]')).toBeVisible();
			await expect(page.locator('[data-schublade-werkzeuge] [data-schublade-leer]')).toHaveCount(0);
		}
		await suche.fill('Zebra');
		await expect(page.locator('[data-schublade-werkzeuge] [data-schublade-leer]')).toBeVisible();
		await expect(page.locator('[data-formen-abschnitt="werkzeuge"]')).toHaveCount(0);
	});

	test('⌘K „Konfetti“, „Punkte“, „Sterne“ findet Streuen', async ({ page }) => {
		await oeffneFormen(page);
		const palette = page.locator('[data-befehlspalette]');
		for (const wort of ['Konfetti', 'Punkte', 'Sterne']) {
			await page.keyboard.press('ControlOrMeta+k');
			await palette.getByRole('combobox').fill(wort);
			const zeile = palette.locator('[data-palette-zeile="werkzeug.streuen"]');
			await expect(zeile).toBeVisible();
			await expect(palette.locator(`[data-palette-zeile="ablegen:${wort}"]`)).toHaveCount(0);
			await zeile.click();
			await expect(palette).toBeHidden();
			await expect(werkzeug(page)).toHaveAttribute('aria-pressed', 'true');
			// Esc gibt V zurück, für das nächste Wort.
			await page.keyboard.press('Escape');
			await expect(werkzeug(page)).toHaveAttribute('aria-pressed', 'false');
		}
	});

	test('Bestand: Punkte und Sterne bleiben in der Datei gleich und bearbeitbar', async ({ page }) => {
		const u = await oeffneFormen(page, [STREUUNG, STERNE]);
		const vorher = blattMit({ hinten: [STREUUNG, STERNE] });
		const sterne = material(page).locator('svg.streuung[data-streuung="sterne"]');
		await expect.poll(async () => sterne.locator('> *').count()).toBeGreaterThan(0);
		expect(await readFile(u.material, 'utf8')).toBe(vorher);

		await sterne.click();
		await expect(page.locator('[data-gestaltung-inspektor="streuung"]')).toBeVisible();
		await expect(page.locator('[data-gestaltung-streuung="sterne"]')).toBeVisible();

		// Gegenprobe: Eine Änderung sähe der Test in der Datei.
		await page.locator('[data-streuung-wuerfeln]').first().click();
		await expect.poll(async () => await quelle(page)).not.toContain('data-streuung="sterne" data-saat="4711"');
		await gespeichert(page, u.material);
		const nachher = await readFile(u.material, 'utf8');
		expect(nachher).not.toBe(vorher);
		expect(nachher).toContain(STREUUNG);
	});

	test('Eine Streuung über einer Aufgabe in .ebene.hinten bleibt ohne Fund der Prüfung', async ({ page }) => {
		const streuung =
			'<svg class="streuung" data-lage="frei" data-streuung="konfetti" data-saat="9" data-dichte="1" viewBox="0 0 700 300" style="--x:40px;--y:120px;--b:700px;--h:300px"></svg>';
		await oeffneFormen(page, [streuung]);
		// Die Kinder fehlen: Der Editor erzeugt sie beim Öffnen.
		await expect.poll(async () => streuungen(page).first().locator('> *').count()).toBeGreaterThan(5);
		await expect(page.locator('[data-pruefung="fehler"]')).toHaveCount(0);
		await expect(page.locator('[data-pruefpunkt="verdeckt"], [data-pruefpunkt="ueberlappung"]')).toHaveCount(0);
	});
});
