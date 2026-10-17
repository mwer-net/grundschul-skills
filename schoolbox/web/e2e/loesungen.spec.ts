import { readFile, writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const fassung = (page: Page, name: 'Lösung' | 'Arbeitsblatt') =>
	page.getByRole('group', { name: 'Was zeigen?' }).getByRole('button', { name, exact: true });
const antwort = (page: Page) => page.getByLabel('Richtige Antwort');
const breadcrumb = (page: Page) => page.locator('[data-breadcrumb]');

/** Zeilen der neuen Fassung, die sich geändert haben. */
const geaendert = (alt: string, neu: string) => {
	const vorher = alt.split('\n');
	return neu.split('\n').filter((zeile, i) => zeile !== vorher[i]);
};

/** Was die Antwortlinie gerade zeigt (blatt.css schreibt die Lösung per `::after`). */
const sichtbar = (linie: Locator) =>
	linie.evaluate((el) => el.ownerDocument.defaultView?.getComputedStyle(el, '::after').content ?? '');

/** Cursor ans Ende des Texts, wie Antippen hinter dem letzten Wort. */
const ansEnde = (ziel: Locator) =>
	ziel.evaluate((el) => {
		const auswahl = el.ownerDocument.getSelection();
		auswahl?.selectAllChildren(el);
		auswahl?.collapseToEnd();
	});

test.describe('Editor: Lösungen', () => {
	test('Lösung einer Antwortlinie ändern: sofort im Blatt, nur data-l in der Quelle, ein Schritt', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);

		await druecke(material(page).locator('.antwort').nth(1));
		await expect(page.locator('[data-auswahl="antwort"]')).toHaveCount(0);

		await druecke(fassung(page, 'Lösung'));
		const linie = material(page).locator('.antwort').nth(1);
		await druecke(linie);
		await expect(breadcrumb(page)).toHaveText('Seite 1›Aufgabe 1›Reihe›Item 2›Antwortlinie');
		await expect(antwort(page)).toHaveValue('halb 5');
		await antwort(page).fill('halb fünf');
		await expect.poll(() => sichtbar(material(page).locator('.antwort').nth(1))).toBe('"halb fünf"');
		await antwort(page).press('Enter');
		await gespeichert(page, datei);
		const nachher = await readFile(datei, 'utf8');
		expect(geaendert(vorher, nachher)).toEqual([
			'        <div class="zelle"><x-uhr zeit="4:30"></x-uhr><span class="antwort breit" data-l="halb fünf"></span></div>',
		]);

		await druecke(fassung(page, 'Arbeitsblatt'));
		await expect(breadcrumb(page)).toHaveText('Seite 1›Aufgabe 1›Reihe›Item 2');
		await expect.poll(() => sichtbar(material(page).locator('.antwort').nth(1))).toBe('" "');

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});

	test('fehlende Lösungen sind markiert und lassen sich der Reihe nach nachtragen', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await writeFile(
			datei,
			(await readFile(datei, 'utf8')).replace(' data-l="7 Uhr"', '').replace(' data-l="halb 1"', ' data-l=""'),
		);
		await oeffne(page, id, dok);
		await expect(page.locator('[data-loesungsuebersicht]')).toHaveCount(0);

		await druecke(fassung(page, 'Lösung'));
		const uebersicht = page.locator('[data-loesungsuebersicht]');
		await expect(uebersicht).toContainText('Bei 2 Antwortlinien fehlt noch die Lösung.');
		await expect.poll(() => sichtbar(material(page).locator('.antwort').nth(2))).toBe('"?"');
		await expect.poll(() => sichtbar(material(page).locator('.antwort').nth(1))).toBe('"halb 5"');

		await druecke(uebersicht.getByRole('button', { name: 'Zeigen' }));
		await expect(antwort(page)).toHaveValue('');
		await expect(page.locator('[data-hinweis="fehlt"]')).toHaveText('Hier fehlt noch die Lösung.');
		await antwort(page).fill('7 Uhr');
		await druecke(page.getByRole('button', { name: 'Zur anderen fehlenden Lösung' }));
		await expect(breadcrumb(page)).toHaveText('Seite 1›Sternchenaufgabe›Antwortlinie');
		await expect(antwort(page)).toHaveValue('');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('data-l="7 Uhr"');

		await page.getByRole('button', { name: 'Auswahl aufheben' }).click();
		await expect(uebersicht).toContainText('Bei einer Antwortlinie fehlt noch die Lösung.');
	});

	test('Wechsel der Ansicht verliert keine offene Eingabe', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(fassung(page, 'Lösung'));

		await druecke(material(page).locator('.antwort').nth(2));
		await antwort(page).fill('sieben Uhr');
		await druecke(fassung(page, 'Arbeitsblatt'));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('data-l="sieben Uhr"');
		await expect(breadcrumb(page)).toHaveText('Seite 1›Aufgabe 1›Reihe›Item 3');

		await druecke(fassung(page, 'Lösung'));
		await druecke(material(page).locator('.antwort').nth(3));
		await antwort(page).fill('halb zehn');
		await druecke(material(page).locator('h1'));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('data-l="halb zehn"');

		const h1 = material(page).locator('h1');
		await expect(h1).toHaveAttribute('contenteditable', 'true');
		await druecke(h1);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await ansEnde(h1);
		await page.keyboard.type(' Prima');
		await druecke(fassung(page, 'Arbeitsblatt'));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<h1>Wie spät ist es? Prima</h1>');
	});

	test('Lösungstext ist nur in der Lösungsansicht wählbar und wird wie Text bearbeitet', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(fassung(page, 'Lösung'));
		const text = material(page).locator('.nur-loesung');
		await druecke(text);
		await expect(breadcrumb(page)).toHaveText('Seite 1›Aufgabe 3›Lösungstext');
		await expect(text).toHaveAttribute('contenteditable', 'true');
		await druecke(text);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await ansEnde(text);
		await page.keyboard.type(' Genau.');
		await page.getByRole('button', { name: 'Fertig' }).click();
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(
			'<div class="nur-loesung"><b>Nein. Eine halbe Stunde nach 7 Uhr ist es halb 8. Genau.</b></div>',
		);
	});

	test('Als Beispiel zeigen: höchstens eins je Aufgabe, nur mit Lösung, ein Schritt', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await writeFile(
			datei,
			(await readFile(datei, 'utf8')).replace(
				'<div class="zelle"><b>halb 12</b><x-uhr loesung="11:30" groesse="88"></x-uhr></div>',
				'<div class="zelle"><b>halb 12</b></div>',
			),
		);
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		const zelle = (nr: number) => material(page).locator('.reihe > .zelle').nth(nr);
		const schalter = page.getByLabel('Als Beispiel zeigen');

		await druecke(zelle(1).locator('.antwort'));
		await expect(breadcrumb(page)).toHaveText('Seite 1›Aufgabe 1›Reihe›Item 2');
		await expect(schalter).not.toBeChecked();
		await expect(page.locator('[data-hinweis="anderes-beispiel"]')).toContainText(
			'In dieser Aufgabe ist schon Item 1 das Beispiel.',
		);
		await schalter.check();
		await expect(
			page.getByRole('status').filter({ hasText: 'Item 1 ist jetzt kein Beispiel mehr.' }),
		).toBeVisible();
		await gespeichert(page, datei);
		expect(geaendert(vorher, await readFile(datei, 'utf8'))).toEqual([
			'        <div class="zelle"><x-uhr zeit="3:00"></x-uhr><span class="antwort breit" data-l="3 Uhr"></span></div>',
			'        <div class="zelle beispiel"><x-uhr zeit="4:30"></x-uhr><span class="antwort breit" data-l="halb 5"></span></div>',
		]);
		await expect.poll(() => sichtbar(zelle(1).locator('.antwort'))).toBe('"halb 5"');
		await expect.poll(() => sichtbar(zelle(0).locator('.antwort'))).toBe('" "');
		await expect(schalter).toBeChecked();
		await expect(page.locator('[data-hinweis="anderes-beispiel"]')).toHaveCount(0);

		await druecke(zelle(4).locator('b'));
		await expect(breadcrumb(page)).toHaveText('Seite 1›Aufgabe 2›Reihe›Item 1');
		await expect(schalter).not.toBeChecked();
		await druecke(zelle(6).locator('b'));
		await expect(breadcrumb(page)).toHaveText('Seite 1›Aufgabe 2›Reihe›Item 3');
		await expect(schalter).toHaveCount(0);

		await druecke(fassung(page, 'Lösung'));
		await druecke(zelle(4).locator('b'));
		await expect(breadcrumb(page)).toHaveText('Seite 1›Aufgabe 2›Reihe›Item 1');
		await expect(schalter).toHaveCount(0);

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
		expect(await quelle(page)).toBe(vorher);
	});
});
