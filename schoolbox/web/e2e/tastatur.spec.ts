import type { Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const auswahlName = (page: Page) => page.locator('[data-auswahl] h2');
const bereit = (page: Page) => expect(page.locator('[data-auswahlrahmen]')).toBeVisible();

test.describe('Tastatur (069)', () => {
	test('⌫ löscht und wählt den Nachbarn, dreimal in Folge; ⌘Z holt byteidentisch zurück', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const aufgaben = material(page).locator('.aufgabe');
		const anzahl = await aufgaben.count();

		await druecke(aufgaben.first().locator('.anw .text'));
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();

		await page.keyboard.press('Backspace');
		await expect(aufgaben).toHaveCount(anzahl - 1);
		await expect(page.getByRole('button', { name: 'Rückgängig' }).last()).toBeVisible();
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();

		await page.keyboard.press('Backspace');
		await expect(aufgaben).toHaveCount(anzahl - 2);
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();

		await page.keyboard.press('Delete');
		await expect(aufgaben).toHaveCount(anzahl - 3);
		await bereit(page);
		const name = await auswahlName(page).textContent();
		await page.keyboard.press('ArrowUp');
		await bereit(page);
		expect(name).toBeTruthy();

		for (let i = 0; i < 3; i += 1) {
			await page.keyboard.press('ControlOrMeta+z');
		}
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('↑↓ wechseln, der Inspektor folgt; ⏎ startet Text, Esc beendet ihn und geht dann hoch', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.aufgabe').first().locator('.anw .text'));
		await page.keyboard.press('Escape');
		await expect(auswahlName(page)).toHaveText('Aufgabe 1');

		await page.keyboard.press('ArrowDown');
		await expect(auswahlName(page)).toHaveText('Aufgabe 2');
		await page.keyboard.press('ArrowUp');
		await expect(auswahlName(page)).toHaveText('Aufgabe 1');

		await druecke(material(page).locator('.aufgabe').first().locator('.anw .text'));
		await expect(page.locator('[data-auswahl="anweisung"]')).toBeVisible();
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();

		// In der Sitzung löscht ⌫ nur Text.
		const vorher = await material(page).locator('.aufgabe').count();
		await page.keyboard.press('Backspace');
		await expect(material(page).locator('.aufgabe')).toHaveCount(vorher);

		await page.keyboard.press('Escape');
		await expect(page.locator('[data-textbearbeitung]')).toHaveCount(0);
		await expect(page.locator('[data-auswahl="anweisung"]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-auswahl="seite"]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-auswahlrahmen]')).toHaveCount(0);
	});

	test('Duplizieren, ⌥↑↓, Kopieren und Einfügen, Ausschneiden und Einfügen', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const aufgaben = material(page).locator('.aufgabe');
		const anzahl = await aufgaben.count();
		const wahlAufgabe = async (i: number) => {
			await druecke(aufgaben.nth(i).locator('.anw .text'));
			await page.keyboard.press('Escape');
			await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
		};

		await wahlAufgabe(0);
		await page.keyboard.press('ControlOrMeta+Shift+d');
		await expect(aufgaben).toHaveCount(anzahl + 1);
		await bereit(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect(aufgaben).toHaveCount(anzahl);

		await wahlAufgabe(0);
		const erste = await aufgaben.first().locator('.anw .text').textContent();
		await page.keyboard.press('Alt+ArrowDown');
		await expect(aufgaben.nth(1).locator('.anw .text')).toHaveText(erste ?? '');
		await bereit(page);
		await page.keyboard.press('Alt+ArrowUp');
		await expect(aufgaben.first().locator('.anw .text')).toHaveText(erste ?? '');
		await bereit(page);

		await page.keyboard.press('ControlOrMeta+c');
		await expect(page.getByText('kopiert')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+v');
		await expect(aufgaben).toHaveCount(anzahl + 1);
		await bereit(page);

		await page.keyboard.press('ControlOrMeta+x');
		await expect(aufgaben).toHaveCount(anzahl);
		await bereit(page);
		await page.keyboard.press('ControlOrMeta+v');
		await expect(aufgaben).toHaveCount(anzahl + 1);
	});

	test('Feld und Dialog behalten ihre Tasten, Nicht-Löschbares meldet sich', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const seiten = material(page).locator('.seite');
		await druecke(seiten.first().locator('.aufgabe').first().locator('.anw .text'));
		await page.keyboard.press('Escape');
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-auswahl="seite"]')).toBeVisible();

		// Die einzige Seite bleibt.
		await page.keyboard.press('Backspace');
		await expect(page.getByText('Die einzige Seite bleibt.')).toBeVisible();
		expect(await quelle(page)).toBe(vorher);

		await page.keyboard.press('Shift+?');
		const uebersicht = page.locator('[data-tasten-uebersicht]');
		await expect(uebersicht).toBeVisible();
		await expect(uebersicht.locator('[data-taste="auswahl.loeschen"]')).toBeVisible();
		await page.keyboard.press('Backspace');
		await expect(uebersicht).toBeVisible();
		expect(await quelle(page)).toBe(vorher);
		await page.keyboard.press('Escape');
		await expect(uebersicht).toBeHidden();
		await expect(page.locator('[data-auswahl="seite"]')).toBeVisible();

		await page.keyboard.press('Escape');
		const titel = page.getByLabel('Titel');
		await titel.first().focus();
		const text = await titel.first().inputValue();
		await page.keyboard.press('End');
		await page.keyboard.press('Backspace');
		await expect(titel.first()).toHaveValue(text.slice(0, -1));
		await expect(material(page).locator('.seite')).toHaveCount(1);
	});

	test('`/` öffnet die Schnellauswahl sichtbar, `0` und `1` ändern die Größe', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.aufgabe').first().locator('.anw .text'));
		await page.keyboard.press('Slash');
		const schnell = page.locator('[data-schnellauswahl]');
		await expect(schnell).toBeInViewport();
		await page.keyboard.press('Escape');
		await expect(schnell).toHaveCount(0);

		const wert = page.locator('[data-zoom-wert]');
		await page.keyboard.press('1');
		const hundert = await wert.textContent();
		await page.keyboard.press('Minus');
		await expect(wert).not.toHaveText(hundert ?? '');
		await page.keyboard.press('1');
		await expect(wert).toHaveText(hundert ?? '');
		await page.keyboard.press('0');
		await expect(page.getByRole('button', { name: 'Einpassen' })).toHaveAttribute('aria-pressed', 'true');
	});

	test('⌘S meldet sich, ⌘P öffnet das PDF-Menü', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.keyboard.press('ControlOrMeta+s');
		await expect(page.getByText('Wird automatisch gespeichert.')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+p');
		await expect(page.getByRole('menu')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toBeHidden();
	});
});
