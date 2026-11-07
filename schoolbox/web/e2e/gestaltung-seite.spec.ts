/**
 * Seitenfläche und Seitenrahmen im Reiter „Blatt“ › Gestaltung (095). Jede Änderung ist ein Schritt; „alle Seiten“
 * setzt jede Seite in einem Schritt. In s/w fällt die Fläche weg, außer mit „In s/w: grau“.
 */
import { writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import type { Einsatz } from './gestaltung-daten';
import { blattMit, SEITENFLAECHE, SEITENRAHMEN } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const zweiteSeite = (html: string) =>
	html.replace(
		'</section>',
		'</section>\n<section class="seite">\n  <div class="aufgabe"><span class="nr">4</span><div class="anw"><span class="text">Noch eine.</span></div></div>\n</section>',
	);

const blatt = async (page: Page, einsatz: Einsatz = {}, zwei = false) => {
	const u = await uhrzeit();
	const html = blattMit(einsatz);
	await writeFile(u.material, zwei ? zweiteSeite(html) : html);
	await oeffne(page, u.id, u.dok);
	return u;
};

const abschnitt = (page: Page) => page.locator('[data-abschnitt="gestaltung"]');
const kopf = (page: Page) => page.locator('[data-gestaltung-kopf]');
const flaechenArt = (page: Page, name: string) =>
	abschnitt(page).getByRole('group', { name: 'Seitenfläche' }).getByRole('button', { name, exact: true });
const anzahl = (text: string, teil: string) => text.split(`class="${teil}"`).length - 1;
const schwarzWeiss = (page: Page) =>
	page.locator('[data-profilschalter]').getByRole('button', { name: 's/w', exact: true });

test.describe('Seitenfläche und Seitenrahmen (095)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Inspektor und Ebenen nebeneinander nur am Mac');

	test('„Verlauf“ in drei Klicks; die Fläche reicht bis an den Blattrand', async ({ page }) => {
		await blatt(page);
		await material(page).locator('.aufgabe').first().locator('.nr').click();
		await page.getByRole('tab', { name: 'Blatt' }).first().click();
		await expect(kopf(page)).toHaveAttribute('aria-expanded', 'false');
		await kopf(page).click();
		await flaechenArt(page, 'Verlauf').click();

		await expect.poll(() => quelle(page)).toContain('data-flaeche="verlauf"');
		const flaeche = material(page).locator('.seite > .ebene.hinten > .seitenflaeche');
		await expect(flaeche).toBeVisible();
		const lage = await flaeche.evaluate((el) => {
			const f = el.getBoundingClientRect();
			const s = el.closest('.seite')?.getBoundingClientRect();
			return { links: f.left - (s?.left ?? 0), oben: f.top - (s?.top ?? 0), breite: f.width - (s?.width ?? 0) };
		});
		expect(lage).toEqual({ links: 0, oben: 0, breite: 0 });
		expect(await flaeche.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
	});

	test('In s/w ist der Grund weiß, mit „In s/w: grau“ grau', async ({ page }) => {
		await blatt(page);
		await kopf(page).click();
		await flaechenArt(page, 'Farbe').click();
		await expect.poll(() => quelle(page)).toContain('data-flaeche="farbe"');
		await abschnitt(page).locator('[data-farbwahl="flaeche-f1"] [data-farbe="var(--haupt)"]').click();
		await expect.poll(() => quelle(page)).toContain('--f1:var(--haupt)');

		const flaeche = material(page).locator('.seitenflaeche');
		await schwarzWeiss(page).click();
		await expect(material(page).locator('body.sw')).toHaveCount(1);
		await expect(flaeche).toBeHidden();

		await abschnitt(page).getByRole('group', { name: 'In s/w' }).first().getByRole('button', { name: 'grau' }).click();
		await expect.poll(() => quelle(page)).toContain('data-sw="grau"');
		await expect(flaeche).toBeVisible();
		await expect
			.poll(() =>
				flaeche.evaluate((el) => {
					const [r, g, b] = (getComputedStyle(el).backgroundColor.match(/\d+/g) ?? []).map(Number);
					return r === g && g === b && r !== 255;
				}),
			)
			.toBe(true);
	});

	test('Der Rahmen liegt 24 px vom Blattrand, außerhalb des Druckrands', async ({ page }) => {
		await blatt(page);
		await kopf(page).click();
		await abschnitt(page).locator('[data-rahmen-art]').selectOption('gestrichelt');
		await expect.poll(() => quelle(page)).toContain('data-rahmen="gestrichelt"');
		const rahmen = material(page).locator('.seitenrahmen');
		const abstand = await rahmen.evaluate((el) => {
			const r = el.getBoundingClientRect();
			const s = el.closest('.seite')?.getBoundingClientRect();
			return { links: r.left - (s?.left ?? 0), oben: r.top - (s?.top ?? 0) };
		});
		expect(abstand).toEqual({ links: 24, oben: 24 });
		await expect(abschnitt(page).locator('[data-regler="abstand"] [data-regler-wert]')).toHaveText('24 px');
	});

	test('„Alle Seiten“ setzt jede Seite in einem Schritt, ⌘Z nimmt alles zurück', async ({ page }) => {
		await blatt(page, {}, true);
		const vorher = await quelle(page);
		await kopf(page).click();
		await abschnitt(page).getByRole('button', { name: 'alle Seiten' }).click();
		await flaechenArt(page, 'Verlauf').click();
		await expect.poll(async () => anzahl(await quelle(page), 'seitenflaeche')).toBe(2);
		await abschnitt(page).locator('[data-rahmen-art]').selectOption('linie');
		await expect.poll(async () => anzahl(await quelle(page), 'seitenrahmen')).toBe(2);

		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(async () => anzahl(await quelle(page), 'seitenrahmen')).toBe(0);
		expect(anzahl(await quelle(page), 'seitenflaeche')).toBe(2);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('„Keine“ entfernt die Fläche und mit ihr die leere Ebene', async ({ page }) => {
		await blatt(page, { hinten: [SEITENFLAECHE] });
		await expect(kopf(page)).toHaveAttribute('aria-expanded', 'true');
		await flaechenArt(page, 'Keine').click();
		await expect.poll(() => quelle(page)).not.toContain('seitenflaeche');
		expect(await quelle(page)).not.toContain('class="ebene');
	});

	test('Die Ebenen zeigen Seitenrahmen und Seitenfläche zuunterst; ein Klick öffnet Blatt › Gestaltung', async ({
		page,
	}) => {
		await blatt(page, { hinten: [SEITENFLAECHE, SEITENRAHMEN] });
		await oeffneSchublade(page, 'ebenen');
		const zeilen = page.locator('[data-gliederung-seite="1"] [data-zeile-unten]');
		await expect(zeilen).toHaveCount(2);
		await expect(zeilen.nth(0)).toHaveAttribute('data-zeile-unten', 'seitenrahmen');
		await expect(zeilen.nth(1)).toHaveAttribute('data-zeile-unten', 'seitenflaeche');
		await expect(zeilen.nth(1).locator('[data-griff-zeile]')).toHaveCount(0);

		await material(page).locator('.aufgabe').first().locator('.nr').click();
		await expect(page.locator('[data-inspektor="auswahl"]')).toBeVisible();
		await zeilen.nth(1).getByRole('button').click();
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await expect(kopf(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(abschnitt(page).locator('[data-blatt-flaeche="verlauf"]')).toBeVisible();
		await expect(abschnitt(page).locator('[data-blatt-rahmen="gestrichelt"]')).toBeVisible();
	});
});
