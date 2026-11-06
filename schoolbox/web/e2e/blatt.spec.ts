import type { Locator, Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const allesWaehlen = (ziel: Locator) =>
	ziel.evaluate((el) => {
		el.ownerDocument.getSelection()?.selectAllChildren(el);
	});

test.describe('Editor: ganzes Blatt und Einstellungen (046, 048)', () => {
	test('Palette und Format ändern genau das, je ein Schritt in Rückgängig', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const palette = page.locator('[data-palette]').getByRole('button').last();
		await druecke(palette);
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(vorher);
		await page.getByLabel('Format', { exact: true }).selectOption('a4-quer');
		await expect.poll(() => quelle(page)).toContain('a4-quer');
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Sichtbarkeit setzt die Klasse und lässt sich zurücknehmen', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		await druecke(material(page).locator('.aufgabe').first().locator('h2, .anw').first());
		await druecke(page.locator('[data-breadcrumb]').getByRole('button', { name: 'Aufgabe 1' }));
		await page.getByLabel('Sichtbarkeit').selectOption('loesung');
		await expect.poll(() => quelle(page)).toContain('nur-loesung');
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Hervorheben legt mark um die Auswahl', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const h1 = material(page).locator('h1');
		await druecke(h1);
		await druecke(h1);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await allesWaehlen(h1);
		await page.getByRole('button', { name: 'Hervorheben' }).click();
		await page.getByRole('button', { name: 'Fertig' }).click();
		await expect.poll(() => quelle(page)).toContain('<mark>');
	});

	test('Lückentext: einfügen, im Panel ändern, ohne Lücke ein Hinweis statt Speichern', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await oeffneSchublade(page, 'bausteine');
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Lückentext');
		await page.locator('[data-einfuegen="x-lueckentext"]').click();
		const element = material(page).locator('x-lueckentext');
		await expect(element.locator('.luecke').first()).toBeVisible();
		await druecke(element);
		const werkzeug = page.locator('[data-abbildungswerkzeug]');
		const text = werkzeug.getByLabel('Text', { exact: true });
		await text.fill('Der [Hund] bellt.');
		await text.blur();
		await expect(element.locator('.luecke')).toHaveCount(1);
		const stand = await quelle(page);
		await text.fill('Der Hund bellt.');
		await text.blur();
		await expect(werkzeug.locator('[data-fehler="_element"]')).toContainText('keine Lücke');
		expect(await quelle(page)).toBe(stand);
	});
});

test.describe('Reiter „Blatt“: Abstand, Punkte (082)', () => {
	const regler = (page: Page) => page.getByRole('slider', { name: 'Abstand zwischen Aufgaben' });
	const zweiteAufgabe = (page: Page) =>
		material(page)
			.locator('.aufgabe')
			.nth(1)
			.evaluate((a) => a.getBoundingClientRect().top);
	const schalter = (page: Page) => page.getByRole('switch', { name: 'Punkte zeigen' });

	test('der Regler verschiebt Aufgabe 2 von Anschlag zu Anschlag um mindestens 100 px', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await regler(page).fill('16');
		await expect.poll(() => quelle(page)).toContain('--abstand:16px');
		await expect(page.locator('[data-editor-rahmen="sichtbar"]')).toBeVisible();
		await expect.poll(async () => material(page).locator('body').getAttribute('style')).toContain('16px');
		const oben = await zweiteAufgabe(page);
		await regler(page).fill('120');
		await expect.poll(() => quelle(page)).toContain('--abstand:120px');
		await expect.poll(() => zweiteAufgabe(page)).toBeGreaterThanOrEqual(oben + 100);
	});

	test('„Vorgabe“ erscheint erst mit eigenem Wert, stellt zurück und ist ein Rückgängig-Schritt', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const vorgabe = page.locator('[data-abstand-vorgabe]');
		await expect(vorgabe).toHaveCount(0);
		await expect(page.locator('[data-abstand-marke]')).toHaveAttribute('data-abstand-marke', '28');
		await regler(page).fill('60');
		await expect.poll(() => quelle(page)).toContain('--abstand:60px');
		const gesetzt = await quelle(page);
		await expect(vorgabe).toHaveText('Vorgabe');
		await druecke(vorgabe);
		await expect.poll(() => quelle(page)).toBe(vorher);
		await expect(regler(page)).toHaveValue('28');
		await expect(vorgabe).toHaveCount(0);
		await expect(page.locator('[data-abstand-marke]')).toHaveAttribute('data-abstand-marke', '28');
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(gesetzt);
		await expect(regler(page)).toHaveValue('60');
	});

	test('läuft eine Seite über, sagt es der Regler und kürzt nichts', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const hinweis = page.locator('[data-abstand-ueberlauf]');
		await expect(hinweis).toHaveCount(0);
		await regler(page).fill('120');
		await expect(hinweis).toHaveText('Seite 1 läuft über.');
		expect(await quelle(page)).toContain('--abstand:120px');
		await expect(regler(page)).toHaveValue('120');
	});

	test('„Punkte zeigen“ gibt es nur, wenn er wirkt', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await expect(schalter(page)).toHaveCount(0);
		await expect(page.locator('[data-abschnitt="loesung-und-punkte"]')).toHaveCount(0);

		await druecke(material(page).locator('.aufgabe').first().locator('.nr'));
		await page.locator('[data-kit="aufgabe"]').getByRole('button', { name: 'Punkte größer' }).click();
		await expect.poll(() => quelle(page)).toContain('class="punkte"');
		await page.getByRole('tab', { name: 'Blatt' }).first().click();
		await expect(schalter(page)).toBeVisible();
		const punkte = material(page).locator('.punkte').first();
		await expect(punkte).toBeVisible();

		await schalter(page).click();
		await expect.poll(() => quelle(page)).toContain('ohne-punkte');
		await expect(punkte).toBeHidden();

		const ohne = (await quelle(page)).replace(/<span class="punkte">[^<]*<\/span>/, '');
		await aendere(page, ohne);
		await expect(schalter(page)).toBeVisible();
		await expect(schalter(page)).toHaveAttribute('aria-checked', 'false');
	});

	test('Trennlinien gibt es nirgends mehr, alte Blätter behalten ihre Linie', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await expect(page.getByText(/Trennlinie/)).toHaveCount(0);
		await oeffneSchublade(page, 'bausteine');
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Trennlinien');
		await expect(page.locator('[data-einfuegen="trenner"]')).toHaveCount(0);

		await aendere(page, (await quelle(page)).replace('<body class="', '<body class="trenner '));
		await expect
			.poll(() =>
				material(page)
					.locator('.aufgabe')
					.nth(1)
					.evaluate((a) => getComputedStyle(a).borderTopWidth),
			)
			.toBe('1px');
	});

	test('der Reiter bleibt beim Regeln und Schalten stehen', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.evaluate(() => {
			const w = window as unknown as { leerGesehen: number };
			w.leerGesehen = 0;
			const pruefe = () => {
				if (!document.querySelector('[data-blatt]')?.childElementCount) {
					w.leerGesehen += 1;
				}
			};
			new MutationObserver(pruefe).observe(document.body, { childList: true, subtree: true });
		});
		await regler(page).fill('60');
		await expect.poll(() => quelle(page)).toContain('--abstand:60px');
		await druecke(page.locator('[data-palette]').getByRole('button').last());
		await expect.poll(() => quelle(page)).toContain('palette-beere');
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).not.toContain('palette-beere');
		await page.waitForTimeout(300);
		expect(await page.evaluate(() => (window as unknown as { leerGesehen: number }).leerGesehen)).toBe(0);
	});

	test('mit gewähltem Baustein bleibt der Reiter „Blatt“ offen, und die Auswahl bleibt', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.aufgabe').first().locator('.nr'));
		await page.getByRole('tab', { name: 'Blatt' }).first().click();
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await regler(page).fill('60');
		await expect.poll(() => quelle(page)).toContain('--abstand:60px');
		await page.waitForTimeout(500);
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await page.locator('[data-abstand-vorgabe]').click();
		await expect.poll(() => quelle(page)).not.toContain('--abstand');
		await page.waitForTimeout(500);
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await page.getByRole('tab', { name: 'Auswahl' }).click();
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
	});
});
