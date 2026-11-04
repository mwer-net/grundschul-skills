import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { material, oeffne, uhrzeit } from './editorhilfe';
import { dokumentOrdner, expect, MATERIAL_DIR, test } from './hilfe';

const kiOrdner = `${MATERIAL_DIR}-ki`;
const fall = (name: string) => writeFile(path.join(kiOrdner, 'fall.txt'), name);
const chat = (page: Page) => page.locator('[data-chat]');
const feld = (page: Page) => chat(page).locator('#ki-auftrag');
const chip = (page: Page) => chat(page).locator('[data-chat-chip]');
const karte = (page: Page) => chat(page).locator('[data-ki-vorschlag]');
const quelleAufPlatte = (mappe: string, dok: string) =>
	readFile(path.join(dokumentOrdner(mappe, dok), 'material.html'), 'utf8');
const fokusIm = (page: Page) => page.evaluate(() => document.activeElement?.tagName);

const offenesBlatt = async (page: Page) => {
	const { dok, id: mappe } = await uhrzeit();
	await oeffne(page, mappe, dok);
	return { dok, mappe };
};

const schreibe = async (page: Page, text: string) => {
	if (!(await chat(page).isVisible())) {
		await page.getByRole('button', { name: 'Claude', exact: true }).click();
	}
	await feld(page).fill(text);
	await feld(page).press('Enter');
};

test.describe('Chat im Editor (074)', () => {
	test.afterEach(() => fall('gut'));

	test('⌘J öffnet mit Fokus, Esc klappt ein und schließt, danach gehören die Tasten dem Blatt', async ({ page }) => {
		await offenesBlatt(page);
		await material(page).locator('.aufgabe').first().locator('.nr').click();
		const anzahl = await material(page).locator('.aufgabe').count();

		await page.keyboard.press('ControlOrMeta+j');
		await expect(feld(page)).toBeFocused();
		await expect(chip(page)).toContainText('Aufgabe 1');
		await page.keyboard.press('ControlOrMeta+j');
		await expect(chat(page)).toHaveCount(0);

		await page.keyboard.press('ControlOrMeta+j');
		await schreibe(page, 'Mach es schöner');
		await expect(chat(page)).toHaveAttribute('data-chat-fenster', 'verlauf');
		await expect(karte(page)).toBeVisible();
		await feld(page).focus();
		await page.keyboard.press('Escape');
		await expect(chat(page)).toHaveAttribute('data-chat-fenster', 'zeile');
		await page.keyboard.press('Escape');
		await expect(chat(page)).toHaveCount(0);
		await expect.poll(() => fokusIm(page)).toBe('IFRAME');
		await page.keyboard.press('Backspace');
		await expect(material(page).locator('.aufgabe')).toHaveCount(anzahl - 1);
	});

	test('Der Chip folgt der Auswahl, der Fokus bleibt im Blatt, im Chip wählt man die Ebene', async ({ page }) => {
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(chip(page)).toHaveText('Ganzes Blatt');

		await material(page).locator('.aufgabe').nth(1).locator('.nr').click();
		await expect(chip(page)).toContainText('Aufgabe 2');
		await expect(chat(page)).toBeVisible();
		await expect.poll(() => fokusIm(page)).toBe('IFRAME');

		await chip(page).click();
		const menue = page.getByRole('menu');
		await expect(menue.getByRole('menuitem', { name: /Seite 1/ })).toBeVisible();
		await expect(menue.getByRole('menuitem', { name: /Ganzes Blatt/ })).toContainText('verbraucht deutlich mehr');
		await menue.getByRole('menuitem', { name: /Ganzes Blatt/ }).click();
		await expect(chip(page)).toHaveText('Ganzes Blatt');
		await expect(feld(page)).toBeFocused();
	});

	test('„Mit Claude ändern …“ am Baustein öffnet den Chat dazu', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Rechtsklick gibt es nur mit der Maus');
		await offenesBlatt(page);
		await material(page).locator('.aufgabe').first().locator('.nr').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Mit Claude ändern …' }).click();
		await expect(feld(page)).toBeFocused();
		await expect(chip(page)).toContainText('Aufgabe 1');
	});

	test('Das Fenster verdeckt die Auswahl nicht, auch nicht unten am Blatt', async ({ page }) => {
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+j');
		await page.evaluate(() => {
			const ansicht = document.querySelector('main');
			ansicht?.scrollTo(0, ansicht.scrollHeight);
		});
		const letzte = material(page).locator('.seite > *').last();
		await letzte.click({ position: { x: 5, y: 5 } });
		await expect.poll(async () => {
			const rahmen = await page.locator('[data-auswahlrahmen]').boundingBox();
			const fenster = await chat(page).boundingBox();
			return rahmen && fenster ? rahmen.y + rahmen.height <= fenster.y : false;
		}).toBe(true);
	});

	test('Nachricht, Vergleich, Annehmen, Rückgängig; Verwerfen lässt die Quelle byteidentisch', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		const vorher = await quelleAufPlatte(mappe, dok);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);
		await karte(page).getByRole('button', { name: 'Verwerfen' }).click();
		await expect(karte(page)).toHaveCount(0);
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);

		await schreibe(page, 'Noch einmal');
		await karte(page).getByRole('button', { name: 'Vergleichen' }).click();
		await page.getByRole('button', { name: 'Annehmen' }).click();
		await expect.poll(() => quelleAufPlatte(mappe, dok)).toContain('von Claude');
		await expect(material(page).locator('h1').first()).toContainText('von Claude');
		await page.getByRole('button', { name: 'Rückgängig' }).click();
		await expect.poll(() => quelleAufPlatte(mappe, dok)).not.toContain('von Claude');
	});

	test('Nachricht auf offenen Vorschlag bessert ihn nach', async ({ page }) => {
		await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		await expect(feld(page)).toHaveAccessibleName('Was soll Claude am Vorschlag ändern?');
		await fall('haenger');
		await schreibe(page, 'Noch kürzer');
		await expect(chat(page).locator('[data-ki-lauf]')).toContainText('Claude bessert den Vorschlag nach');
		await feld(page).fill('Zweite Nachricht');
		await feld(page).press('Enter');
		await expect(feld(page)).toHaveValue('Zweite Nachricht');
		await expect(chat(page).locator('[data-chat-nachricht="lehrkraft"]')).toHaveCount(2);
		await chat(page).locator('[data-ki-lauf]').getByRole('button', { name: 'Abbrechen' }).click();
		await expect(karte(page)).toBeVisible();
	});

	test('Eine Frage bekommt eine Antwort, und das Blatt bleibt', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		const vorher = await quelleAufPlatte(mappe, dok);
		await schreibe(page, 'FRAGE: Wie viele Uhren sind das?');
		await expect(chat(page).locator('[data-chat-nachricht="claude"]')).toHaveText('Das Blatt hat vier Uhren.');
		await expect(karte(page)).toHaveCount(0);
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);
	});

	test('Geändertes Blatt: Annehmen ist gesperrt, „Neu starten“ schickt dieselbe Nachricht', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		const datei = path.join(dokumentOrdner(mappe, dok), 'material.html');
		await writeFile(datei, (await readFile(datei, 'utf8')).replace('</h1>', ' Eigenes</h1>'));
		await expect(karte(page).getByRole('alert')).toContainText('seit dem Auftrag geändert');
		await karte(page).getByRole('button', { name: 'Neu starten' }).click();
		await expect(chat(page).locator('[data-chat-nachricht="lehrkraft"]')).toHaveCount(2);
		await expect(karte(page).getByRole('button', { name: 'Vergleichen' })).toBeVisible();
		await expect(karte(page).getByRole('alert')).toHaveCount(0);
	});

	test('Neu laden: Verlauf, Vorschlag und laufender Auftrag sind wieder da', async ({ page }) => {
		await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(chat(page).locator('[data-chat-nachricht="lehrkraft"]')).toHaveText(/Mach es schöner/);
		await expect(karte(page)).toBeVisible();
		await expect.poll(() => fokusIm(page)).not.toBe('TEXTAREA');

		await fall('haenger');
		await schreibe(page, 'Dauert');
		await expect(chat(page).locator('[data-ki-lauf]')).toBeVisible();
		await page.reload();
		await expect(chat(page).locator('[data-ki-lauf]')).toBeVisible();
		await page.keyboard.press('Escape');
		await chat(page).getByRole('button', { name: 'Chat schließen' }).click();
		await expect(page.locator('[data-claude-stand="arbeitet"]')).toContainText('Claude arbeitet');
		await page.locator('[data-claude-stand]').click();
		await expect(chat(page).locator('[data-ki-lauf]')).toBeVisible();
		await chat(page).locator('[data-ki-lauf]').getByRole('button', { name: 'Abbrechen' }).click();
		await expect(chat(page).locator('[data-ki-lauf]')).toHaveCount(0);
	});

	test('Die Markierung der Textsitzung kommt beim Wechsel mit und geht zum Auftrag', async ({ page }) => {
		await offenesBlatt(page);
		const ueberschrift = material(page).locator('h1');
		await ueberschrift.click();
		await ueberschrift.click();
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await ueberschrift.evaluate((el) => el.ownerDocument.getSelection()?.selectAllChildren(el));
		await page.keyboard.press('ControlOrMeta+j');
		const zitat = chat(page).locator('[data-chat-zitat]');
		await expect(zitat).toContainText('Wie spät ist es?');
		await expect(feld(page)).toBeFocused();
		await expect(page.locator('[data-textbearbeitung]')).toHaveCount(0);
		const prompts = path.join(kiOrdner, 'prompts.txt');
		await writeFile(prompts, '');
		await feld(page).fill('Kürzer');
		await feld(page).press('Enter');
		await expect(karte(page)).toBeVisible();
		await expect(zitat).toHaveCount(0);
		expect(await readFile(prompts, 'utf8')).toContain('markierte Stelle');
	});

	test('Die Palette schreibt ins Feld und schickt nichts ab', async ({ page }) => {
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+k');
		await page.getByRole('combobox').fill('Mach die Uhren größer');
		const zeile = page.locator('[data-palette-zeile="claude:schicken"]');
		await expect(zeile).toContainText('An Claude schicken: Mach die Uhren größer');
		await zeile.click();
		await expect(feld(page)).toHaveValue('Mach die Uhren größer');
		await expect(feld(page)).toBeFocused();
		await expect(chat(page).locator('[data-ki-lauf]')).toHaveCount(0);
		await expect(chat(page).locator('[data-chat-nachricht]')).toHaveCount(0);
	});

	test('Präsentation und Druck haben keinen Chat', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		await page.goto(`/m/${mappe}/${dok}/drucken`);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(page.locator('[data-chat]')).toHaveCount(0);
		await page.goto(`/m/${mappe}/${dok}/praesentation`);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(page.locator('[data-chat]')).toHaveCount(0);
	});
});
