import { readFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { aendere, gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, legeMappeAn, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/** 094: Bausteine aus der Schublade ziehen, mit Lücke; dieselbe Lücke beim Ziehen im Blatt. */
const oeffneBausteine = async (page: Page) => {
	await oeffneSchublade(page, 'bausteine');
	await expect(page.locator('[data-bereich]').first()).toBeVisible();
};
const suche = (page: Page) => page.getByRole('searchbox', { name: 'Baustein suchen' }).first();
const luecke = (page: Page) => material(page).locator('[data-luecke]');
/** Die Nummern, wie sie im Blatt zu sehen sind (ohne das Original, das die Lücke beim Ziehen im Blatt ausblendet). */
const angezeigt = (page: Page) => material(page).locator('.aufgabe:not([data-luecke-weg]) > .nr').allTextContents();
const nummern = (html: string) => [...html.matchAll(/<span class="nr( stern)?">([^<]*)</g)].map((m) => m[2]);
const anweisungen = (html: string) => [...html.matchAll(/<span class="text">([^<]{0,12})/g)].map((m) => m[1]);
const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });

/** Drückt die Kachel und zieht über die Schwelle von `MAUS_WEG`; die Maus bleibt unten. */
const greife = async (page: Page, id: string, suchwort: string) => {
	await suche(page).fill(suchwort);
	const kachel = await page.locator(`[data-bibliothek-eintrag="${id}"] [data-einfuegen]`).boundingBox();
	if (!kachel) {
		throw new Error('Kachel nicht zu sehen');
	}
	await page.mouse.move(kachel.x + 20, kachel.y + kachel.height / 2);
	await page.mouse.down();
	await page.mouse.move(kachel.x + 40, kachel.y + kachel.height / 2 + 12, { steps: 3 });
	await expect(page.locator('[data-zug-anzeige]')).toBeVisible();
};

/**
 * Fährt zu einem Anteil der Höhe von `ziel` (0 oben, 1 unten). Die Lücke verschiebt das Blatt unterwegs, darum wird
 * nach dem ersten Weg neu gemessen und noch einmal hingefahren, wie es auch eine Hand tut.
 */
const fahreZu = async (page: Page, ziel: Locator, anteil: number) => {
	// Mitten in die Ansicht: Am Rand rollte sie beim Ziehen weiter.
	await ziel.evaluate((e) => e.scrollIntoView({ block: 'center' }));
	for (let i = 0; i < 2; i++) {
		const r = await ziel.boundingBox();
		if (!r) {
			throw new Error('Ziel nicht zu sehen');
		}
		await page.mouse.move(r.x + r.width / 2, r.y + r.height * anteil, { steps: 8 });
	}
};

const aufgabeOhneLuecke = (page: Page, i: number) => material(page).locator('.aufgabe:not([data-luecke])').nth(i);

test.describe('Editor: Bausteine ziehen mit Lücke', () => {
	test('Aufgabe an Stelle 2: Lücke und 3 an der alten 2, Loslassen fügt ein, ⌘Z in einem Schritt', async ({
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await oeffneBausteine(page);
		const vorher = await quelle(page);
		const datei0 = await readFile(datei, 'utf8');
		await expect(zurueck(page)).toBeDisabled();

		await greife(page, 'aufgabe', 'Aufgabe');
		await fahreZu(page, aufgabeOhneLuecke(page, 0), 0.85);
		await expect(luecke(page)).toHaveCount(1);
		await expect(luecke(page).locator('> .nr')).toHaveText('2');
		await expect(aufgabeOhneLuecke(page, 1).locator('> .nr')).toHaveText('3');
		expect(await angezeigt(page)).toEqual(['1', '2', '3', '4', '★']);
		// Kein Schritt, keine Speicherung während des Zugs.
		expect(await quelle(page)).toBe(vorher);
		await expect(zurueck(page)).toBeDisabled();
		expect(await readFile(datei, 'utf8')).toBe(datei0);
		await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();
		await expect(page.locator('[data-einfuegemarke]')).toHaveCount(0);

		await page.mouse.up();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		const nachher = await quelle(page);
		expect(anweisungen(nachher)[1]).toBe('Anweisung');
		expect(nummern(nachher)).toEqual(['1', '2', '3', '4', '★']);
		await gespeichert(page, datei);
		await expect(luecke(page)).toHaveCount(0);

		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Anfang und Ende des Stapels', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await oeffneBausteine(page);
		const vorher = await quelle(page);

		await greife(page, 'aufgabe', 'Aufgabe');
		await fahreZu(page, aufgabeOhneLuecke(page, 0), 0.1);
		await expect(luecke(page).locator('> .nr')).toHaveText('1');
		await page.mouse.up();
		await expect.poll(async () => anweisungen(await quelle(page))[0]).toBe('Anweisung');

		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
		await greife(page, 'aufgabe', 'Aufgabe');
		await fahreZu(page, aufgabeOhneLuecke(page, 3), 0.9);
		await expect(luecke(page).locator('> .nr')).toHaveText('4');
		expect(await angezeigt(page)).toEqual(['1', '2', '3', '★', '4']);
		await page.mouse.up();
		await expect.poll(async () => nummern(await quelle(page))).toEqual(['1', '2', '3', '★', '4']);
	});

	test('auf eine zweite Seite: die Nummern zählen durch das Dokument', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const zweite =
			'<section class="seite"><div class="aufgabe"><span class="nr">4</span><div class="anw"><span class="text">Zweite Seite</span></div><div class="koerper"></div></div></section>';
		await aendere(page, (await quelle(page)).replace('</body>', `${zweite}</body>`));
		await expect(material(page).locator('.seite')).toHaveCount(2);
		await oeffneBausteine(page);

		await greife(page, 'aufgabe', 'Aufgabe');
		const ziel = material(page).locator('.seite').nth(1).locator('.aufgabe:not([data-luecke])').first();
		await fahreZu(page, ziel, 0.1);
		await expect(material(page).locator('.seite').nth(1).locator('[data-luecke] > .nr')).toHaveText('4');
		await expect(ziel.locator('> .nr')).toHaveText('5');
		await page.mouse.up();
		await expect.poll(async () => anweisungen(await quelle(page)).slice(-2)).toEqual(['Anweisung', 'Zweite Seite']);
	});

	test('Esc und Loslassen außerhalb der Seite lassen Quelle und Anzeige wie vorher', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await oeffneBausteine(page);
		const vorher = await quelle(page);
		const zahlen = await angezeigt(page);

		await greife(page, 'aufgabe', 'Aufgabe');
		await fahreZu(page, aufgabeOhneLuecke(page, 1), 0.2);
		await expect(luecke(page)).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(luecke(page)).toHaveCount(0);
		await expect(page.locator('[data-zug-anzeige]')).toHaveCount(0);
		expect(await angezeigt(page)).toEqual(zahlen);
		await page.mouse.up();
		await page.waitForTimeout(300);
		expect(await quelle(page)).toBe(vorher);

		await greife(page, 'aufgabe', 'Aufgabe');
		await fahreZu(page, aufgabeOhneLuecke(page, 1), 0.2);
		await expect(luecke(page)).toHaveCount(1);
		const rahmen = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
		if (!rahmen) {
			throw new Error('Blatt nicht zu sehen');
		}
		// Im Rand neben der Seite.
		await page.mouse.move(rahmen.x + 4, rahmen.y + 300, { steps: 6 });
		await expect(luecke(page)).toHaveCount(0);
		expect(await angezeigt(page)).toEqual(zahlen);
		await page.mouse.up();
		await page.waitForTimeout(300);
		expect(await quelle(page)).toBe(vorher);
	});

	test('Klick auf die Kachel fügt wie heute hinter der Auswahl ein', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.aufgabe').first().locator('> .nr'));
		await oeffneBausteine(page);
		await suche(page).fill('Aufgabe');
		await page.locator('[data-einfuegen="aufgabe"]').click();
		await expect.poll(async () => anweisungen(await quelle(page))[1]).toBe('Anweisung');
		await expect(luecke(page)).toHaveCount(0);
	});

	test('Ziehen im Blatt zeigt dieselbe Lücke statt der Linie', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const text = material(page).locator('.aufgabe').nth(2).locator('.anw .text');
		const r = await text.boundingBox();
		if (!r) {
			throw new Error('nicht zu sehen');
		}
		await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
		await page.mouse.down();
		await page.mouse.move(r.x + r.width / 2 + 10, r.y + r.height / 2 - 10, { steps: 3 });
		await fahreZu(page, aufgabeOhneLuecke(page, 0), 0.1);
		await expect(luecke(page)).toHaveCount(1);
		await expect(material(page).locator('[data-luecke-weg]')).toHaveCount(1);
		await expect(page.locator('[data-einfuegemarke]')).toHaveCount(0);
		expect(await angezeigt(page)).toEqual(['1', '2', '3', '★']);
		await expect(luecke(page)).toContainText('Willi sagt');
		expect(await quelle(page)).toBe(vorher);

		await page.mouse.up();
		await expect.poll(async () => anweisungen(await quelle(page))[0]).toBe('Willi sagt: ');
		await expect(luecke(page)).toHaveCount(0);
		await expect(material(page).locator('[data-luecke-weg]')).toHaveCount(0);
	});

	test('Ein Starter mit Abbildung (x-uhr) erscheint gezeichnet in der Lücke', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await oeffneBausteine(page);
		await greife(page, 'x-uhr', 'Uhr');
		await fahreZu(page, aufgabeOhneLuecke(page, 1), 0.2);
		await expect(luecke(page).locator('x-uhr svg')).toHaveCount(1);
		await page.keyboard.press('Escape');
		await page.mouse.up();
	});

	test('Folien zählen die Lücke je Folie', async ({ page }) => {
		const { dokumente, id } = await legeMappeAn('Kartoffel', 'sachunterricht', 3, [
			{ titel: 'Kreisinput', art: 'praesentation', format: 'folie', vorlage: 'praesentation' },
		]);
		await oeffne(page, id, dokumente[0] ?? '');
		await oeffneBausteine(page);
		const vorher = await quelle(page);
		const ziel = aufgabeOhneLuecke(page, 0);
		const folie = material(page).locator('.seite', { has: ziel });
		const davor = await folie.locator('.aufgabe > .nr').allTextContents();

		await greife(page, 'aufgabe', 'Aufgabe');
		await fahreZu(page, ziel, 0.1);
		await expect(luecke(page).locator('> .nr')).toHaveText('1');
		expect(await folie.locator('.aufgabe > .nr').allTextContents()).toEqual(
			['1', ...davor].map((_, i) => String(i + 1)),
		);
		await page.keyboard.press('Escape');
		await page.mouse.up();
		expect(await folie.locator('.aufgabe > .nr').allTextContents()).toEqual(davor);
		expect(await quelle(page)).toBe(vorher);
	});

	test('Finger: Halten auf der Kachel beginnt das Ziehen, Wischen rollt weiter', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await oeffneBausteine(page);
		await suche(page).fill('Schreiblinie');
		const vorschau = page.locator('[data-bibliothek-eintrag="schreiblinie"] [data-karten-vorschau]');
		const kachel = page.locator('[data-einfuegen="schreiblinie"]');
		await aufgabeOhneLuecke(page, 1).evaluate((e) => e.scrollIntoView({ block: 'center' }));
		const start = await vorschau.boundingBox();
		const ziel = await aufgabeOhneLuecke(page, 1).boundingBox();
		if (!start || !ziel) {
			throw new Error('nicht zu sehen');
		}
		const vorher = await quelle(page);
		const punkt = { pointerType: 'touch', pointerId: 9, isPrimary: true, bubbles: true };
		const s = { clientX: start.x + start.width / 2, clientY: start.y + start.height / 2 };
		const z = { clientX: ziel.x + ziel.width / 2, clientY: ziel.y + 10 };

		// Wischen: Der Finger bewegt sich sofort, nichts wird gezogen.
		await kachel.dispatchEvent('pointerdown', { ...punkt, ...s });
		await kachel.dispatchEvent('pointermove', { ...punkt, clientX: s.clientX, clientY: s.clientY - 40 });
		await page.waitForTimeout(450);
		await expect(page.locator('[data-zug-anzeige]')).toHaveCount(0);
		await kachel.dispatchEvent('pointerup', { ...punkt, clientX: s.clientX, clientY: s.clientY - 40 });

		// Halten, dann ziehen.
		await kachel.dispatchEvent('pointerdown', { ...punkt, ...s });
		await page.waitForTimeout(450);
		await expect(page.locator('[data-zug-anzeige]')).toBeVisible();
		await kachel.dispatchEvent('pointermove', { ...punkt, ...z });
		await expect(luecke(page)).toHaveCount(1);
		await kachel.dispatchEvent('pointerup', { ...punkt, ...z });
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		expect(await quelle(page)).toContain('schreiblinie');
	});
});
