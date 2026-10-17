import { readFile, writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const panel = (page: Page) => page.locator('[data-abbildungswerkzeug]');

/** Zeilen der neuen Fassung, die sich geändert haben. */
const geaendert = (alt: string, neu: string) => {
	const vorher = alt.split('\n');
	return neu.split('\n').filter((zeile, i) => zeile !== vorher[i]);
};

/** Der Minutenzeiger einer gezeichneten Uhr: Endpunkt der dritten Linie vom Mittelpunkt aus. */
const minutenzeiger = (page: Page, nr: number) =>
	material(page)
		.locator('x-uhr')
		.nth(nr)
		.evaluate((uhr) => {
			const zeiger = [...uhr.querySelectorAll('line[x1="50"][y1="50"]')].at(-1);
			return `${zeiger?.getAttribute('x2') ?? ''} ${zeiger?.getAttribute('y2') ?? ''}`;
		});

test.describe('Editor: Abbildungen', () => {
	test('Uhrzeit ändern: sofort neu gezeichnet, nur das Attribut in der Quelle, jede Änderung ein Schritt', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);

		await druecke(material(page).locator('x-uhr').first());
		await expect(page.locator('[data-breadcrumb]')).toHaveText('Seite 1›Aufgabe 1›Reihe›Item 1›Uhr');
		await expect(page.locator('[data-hinweis="beispiel"]')).toContainText('Das ist das Beispiel.');

		await druecke(material(page).locator('x-uhr').nth(1));
		await expect(panel(page)).toBeVisible();
		await expect(page.locator('[data-hinweis="beispiel"]')).toHaveCount(0);
		expect(await minutenzeiger(page, 1)).toBe('50 77');

		await page.getByLabel('Stunde').selectOption('5');
		await page.getByLabel('Minuten').selectOption('45');
		await expect.poll(() => minutenzeiger(page, 1)).toBe('23 50');
		await gespeichert(page, datei);
		const nachher = await readFile(datei, 'utf8');
		expect(geaendert(vorher, nachher)).toEqual([
			'        <div class="zelle"><x-uhr zeit="5:45"></x-uhr><span class="antwort breit" data-l="halb 5"></span></div>',
		]);
		expect(nachher).not.toContain('<svg');
		await expect(page.locator('[data-auswahl="abbildung"]')).toBeVisible();

		await page.getByLabel('Zeiger nur in der Lösung').check();
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-uhr loesung="5:45"></x-uhr>');
		await expect.poll(() => minutenzeiger(page, 1)).toBe(' ');

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(nachher);
		await druecke(zurueck(page));
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});

	test('ungültige Eingaben zeigen einen Hinweis und werden nicht gespeichert', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await writeFile(
			datei,
			(await readFile(datei, 'utf8'))
				.replace(
					'<x-uhr zeit="4:30"></x-uhr>',
					'<x-zahlenstrahl von="0" bis="20" pfeile="7 13"></x-zahlenstrahl>',
				)
				.replace('<x-uhr zeit="7:00"></x-uhr>', '<x-menge n="23" form="nuss"></x-menge>'),
		);
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		const strahl = material(page).locator('x-zahlenstrahl');
		await druecke(strahl);
		await expect(page.locator('[data-breadcrumb]')).toContainText('Zahlenstrahl');

		const bis = page.getByLabel('Bis', { exact: true });
		await bis.fill('10');
		await bis.press('Enter');
		await expect(page.locator('[data-fehler="pfeile"]')).toHaveText('13 liegt nicht zwischen 0 und 10.');
		await expect(page.locator('[data-nicht-uebernommen]')).toBeVisible();
		await expect(strahl).toHaveAttribute('bis', '10');
		expect(await quelle(page)).toBe(vorher);
		await page.waitForTimeout(2000);
		expect(await readFile(datei, 'utf8')).toBe(vorher);

		await druecke(page.getByRole('button', { name: 'Zurücksetzen' }));
		await expect(strahl).toHaveAttribute('bis', '20');
		await expect(page.locator('[data-fehler]')).toHaveCount(0);

		await bis.fill('30');
		await bis.press('Enter');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-zahlenstrahl von="0" bis="30" pfeile="7 13">');

		await druecke(material(page).locator('x-menge'));
		const buendel = page.locator('[data-feld="buendel"]');
		for (let i = 0; i < 3; i += 1) {
			await druecke(page.getByRole('button', { name: 'Eingekreiste Zehner: mehr' }));
		}
		await expect(page.locator('[data-fehler="buendel"]')).toHaveText('Es gibt nur 2 volle Zehnerreihen.');
		await expect(buendel.locator('input[type="text"]')).toHaveValue('3');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-menge buendel="2" n="23" form="nuss">');
		await expect(material(page).locator('x-menge rect')).toHaveCount(3);

		await druecke(page.getByRole('button', { name: 'Auswahl aufheben' }));
		await expect(material(page).locator('x-menge rect')).toHaveCount(2);
		await druecke(zurueck(page));
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-menge n="23" form="nuss">');
	});
});
