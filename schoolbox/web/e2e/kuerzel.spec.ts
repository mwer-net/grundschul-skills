/**
 * Kürzel nur in Menü, Palette, Tooltip und Hilfe (166, Entscheidung 53). Ein Rundgang am Mac prüft alles, was dauerhaft
 * sichtbar ist, dazu `title` und `placeholder`; die Tooltips zeigen Name und Kürzel aus dem Register.
 */
import { writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { material, oeffne, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, legeMappeAn, test } from './hilfe';
import type { SchubladenName } from './schubladen-hilfe';
import { oeffneSchublade, schubladenKnopf } from './schubladen-hilfe';

/** Das Muster aus `src/bausteine/kuerzel.test.ts`, dazu die Schreibweise außerhalb des Mac. */
const MUSTER =
	/[⌘⌥⇧⏎⌫]|\bEsc\b|\besc [a-zäöü]|\bLeertaste\b|\bPfeiltasten?\b|\bTaste [A-Z0-9]\b|Strg\+|Alt\+|Umschalt\+/u;

const ALLE: SchubladenName[] = ['ebenen', 'bausteine', 'werkzeuge', 'figuren', 'bilder'];

/** Sichtbarer Text, `title` und `placeholder`, zeilenweise; was ein Kürzel nennt. */
const funde = async (page: Page) => {
	const texte = await page.evaluate(() => [
		document.body.innerText,
		...[...document.querySelectorAll('[title]')].map((e) => e.getAttribute('title') ?? ''),
		...[...document.querySelectorAll('[placeholder]')].map((e) => e.getAttribute('placeholder') ?? ''),
	]);
	return texte.flatMap((t) => t.split('\n')).filter((z) => MUSTER.test(z));
};

const keinKuerzel = async (page: Page, wo: string) => {
	await expect.poll(() => funde(page), { message: wo }).toEqual([]);
};

const tooltip = (page: Page) => page.locator('[data-tooltip]');

/** Zeiger weg, damit der nächste Tooltip nicht der alte ist. */
const zeigerWeg = async (page: Page) => {
	await page.mouse.move(1, 1);
	await expect(tooltip(page)).toHaveCount(0);
};

const kreis = (name: string, x: number) =>
	`<svg class="form" data-lage="frei" data-name="${name}" data-form="ellipse" viewBox="0 0 100 100" style="--x:${x}px;--y:620px;--b:80px;--h:80px"><path d="M50 2 C76.5 2 98 23.5 98 50 C98 76.5 76.5 98 50 98 C23.5 98 2 76.5 2 50 C2 23.5 23.5 2 50 2 Z" style="fill:var(--akzent)"/></svg>`;
const FIGUR =
	'<img class="figur-frei" data-lage="frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:560px;--y:820px;--b:150px">';

const dialog = (page: Page) => page.getByRole('dialog');
const schritt = (page: Page, id: string) => dialog(page).locator(`[data-assistent="${id}"]`);

test.describe('Kürzel nur in Menü, Palette, Tooltip und Hilfe (53)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'am Mac; das iPad zeigt keine Tooltips');

	test('Ablage, Baustein, jede Schublade, Textsitzung; die offene Palette zeigt Kürzel', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByPlaceholder('Material und Ordner suchen')).toBeVisible();
		await keinKuerzel(page, 'Ablage');

		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await material(page).locator('.aufgabe').first().click();
		await expect(page.locator('[data-bausteinleiste]')).toBeVisible();
		await keinKuerzel(page, 'Baustein gewählt');

		for (const name of ALLE) {
			await oeffneSchublade(page, name);
			await keinKuerzel(page, `Schublade ${name}`);
		}

		const h1 = material(page).locator('h1');
		await h1.click();
		await expect(h1).toHaveAttribute('contenteditable', 'true');
		await h1.click();
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await keinKuerzel(page, 'Textsitzung');
		await page.getByRole('button', { name: 'Fertig' }).click();
		await expect(page.locator('[data-textbearbeitung]')).toHaveCount(0);

		// Gegenprobe: Der Helfer sieht Text. Die Zeilen der Palette zeigen ihr Kürzel weiter.
		await page.locator('[data-palette-knopf]').click();
		const palette = page.locator('[data-befehlspalette]');
		await expect(palette.getByRole('option').locator('kbd').first()).toBeVisible();
		await expect.poll(() => funde(page)).not.toEqual([]);
		await page.keyboard.press('Escape');
	});

	test('eine Form, zwei Formen, eine Figur', async ({ page }) => {
		const u = await uhrzeit();
		await writeFile(u.material, blattMit({ vorne: [kreis('A', 100), kreis('B', 300), FIGUR] }));
		await oeffne(page, u.id, u.dok);
		const form = (name: string) => material(page).locator(`[data-name="${name}"]`);

		await form('A').click();
		await expect(page.locator('[data-gestaltungsleiste="form"]')).toBeVisible();
		await keinKuerzel(page, 'eine Form');

		await form('B').click({ modifiers: ['Shift'] });
		await expect(page.locator('[data-gestaltungsleiste="mehrfach"]')).toBeVisible();
		await keinKuerzel(page, 'zwei Formen');

		await material(page).locator('.figur-frei').click();
		await expect(page.locator('[data-gestaltungsleiste="figurfrei"]')).toBeVisible();
		await keinKuerzel(page, 'Figur');
	});

	test('Assistent: Start, Art, „Sonst noch etwas“; Startseite der Präsentation', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-werkzeugleiste] [data-material-anlegen]').click();
		await expect(schritt(page, 'start')).toBeVisible();
		await expect(dialog(page).locator('[data-hauptaktion]')).toBeEnabled();
		await keinKuerzel(page, 'Assistent: Start');
		await page.keyboard.press('Enter');
		await expect(schritt(page, 'art')).toBeVisible();
		await keinKuerzel(page, 'Assistent: Art');
		await dialog(page).locator('[data-wahl="einheit"]').click();
		await expect(schritt(page, 'fuerWen')).toBeVisible();
		await page.keyboard.press('Enter');
		await expect(schritt(page, 'eThema')).toBeVisible();
		await page.keyboard.type('Uhrzeit');
		for (const id of ['eUmfang', 'eBestandteile', 'eRahmen', 'bausteine', 'klasse']) {
			await page.keyboard.press('Enter');
			await expect(schritt(page, id)).toBeVisible();
		}
		await expect(dialog(page)).toContainText('Sonst noch etwas');
		await keinKuerzel(page, 'Assistent: Sonst noch etwas');

		const { dokumente, id } = await legeMappeAn('Kartoffeln', 'sachunterricht', 3, [
			{ titel: 'Kreisinput Kartoffel', art: 'praesentation', format: 'folie', vorlage: 'praesentation' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}/praesentation`);
		await expect(page.getByRole('button', { name: 'Präsentation starten' })).toBeVisible();
		await keinKuerzel(page, 'Präsentation');
	});

	test('Tooltips zeigen Name und Kürzel aus dem Register, ohne Gesten', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-kopf-rechts] [data-palette-knopf]').hover();
		await expect(tooltip(page)).toContainText('Befehle');
		await expect(tooltip(page)).toContainText(/⌘K|Strg\+K/);
		await zeigerWeg(page);

		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await schubladenKnopf(page, 'werkzeuge').hover();
		await expect(tooltip(page)).toContainText('Werkzeuge');
		await expect(tooltip(page)).toContainText(/⌥3|Alt\+3/);
		await zeigerWeg(page);

		await page.locator('[data-statusleiste] [data-palette-knopf]').hover();
		await expect(tooltip(page)).toContainText(/⌘K|Strg\+K/);
		await zeigerWeg(page);

		await oeffneSchublade(page, 'werkzeuge');
		await zeigerWeg(page);
		await page.locator('[data-werkzeug="rechteck"]').hover();
		await expect(tooltip(page)).toContainText('Rechteck');
		await expect(tooltip(page)).toContainText('R');
		await expect(tooltip(page)).not.toContainText('hält');
		await zeigerWeg(page);

		await material(page).locator('.aufgabe').first().click();
		await page.locator('[data-bausteinleiste] [data-claude-knopf]').hover();
		await expect(tooltip(page)).toContainText('Mit Claude ändern');
		await expect(tooltip(page)).toContainText(/⌘J|Strg\+J/);
	});

	test('nach dem Klick auf eine Schublade steht kein Tooltip mehr', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const knopf = schubladenKnopf(page, 'werkzeuge');
		await knopf.hover();
		await expect(tooltip(page)).toBeVisible();
		await knopf.click();
		await expect(knopf).toHaveAttribute('aria-pressed', 'true');
		await expect(tooltip(page)).toHaveCount(0);
		// Auch nicht nach der Wartezeit des Tooltips (400 ms), solange der Zeiger dort bleibt.
		await page.waitForTimeout(800);
		await expect(tooltip(page)).toHaveCount(0);
	});

	test('Ablage: Suchfeld ohne Kürzel, „Befehle“ im Kopf öffnet die Palette', async ({ page }) => {
		await page.goto('/');
		const suche = page.getByPlaceholder('Material und Ordner suchen');
		await expect(suche).toBeVisible();
		await expect(page.locator('header kbd')).toHaveCount(0);
		await page.locator('[data-kopf-rechts]').getByRole('button', { name: 'Befehle' }).click();
		await expect(page.locator('[data-befehlspalette]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-befehlspalette]')).toBeHidden();
	});
});
