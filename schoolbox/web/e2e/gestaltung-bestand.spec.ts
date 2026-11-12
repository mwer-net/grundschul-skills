/**
 * Ältere Blätter mit Rezept (180): Rezepte gibt es nicht mehr, das Blatt sieht aus wie vorher und bleibt in der Datei
 * unverändert, außer an der Stelle, die die Lehrkraft selbst ändert. Probe:
 * `kern/src/testdaten/bestand-aufmachung.html`, Rezept „Detektiv“ mit Kopfband Welle, Seitenfläche und zwei Streuungen,
 * alle mit `data-aufmachung-teil` und Schloss. Das alte Kopfband zeigt der Abschnitt „Kopfband“ (181); die erste
 * Änderung schreibt es als `.kopfband` auf die Seite, der `body` bleibt.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const PROBE = path.join(__dirname, '../../kern/src/testdaten/bestand-aufmachung.html');
const MAUS = ['chromium', 'mac-safari'];

const blatt = async (page: Page) => {
	const u = await uhrzeit();
	const probe = await readFile(PROBE, 'utf8');
	await writeFile(u.material, probe);
	await oeffne(page, u.id, u.dok);
	return { ...u, probe };
};

const bodyTag = (html: string) => /<body[^>]*>/.exec(html)?.[0] ?? '';
const ebenen = (page: Page) => page.getByRole('navigation', { name: 'Ebenen' });
const panel = (page: Page) => page.locator('[data-panel-links]');
const flaeche = (page: Page) => page.locator('[data-abschnitt="seitenflaeche"]');
const band = (page: Page) => page.locator('[data-abschnitt="kopfband"]');
const reiterBlatt = (page: Page) => page.getByRole('tab', { name: 'Blatt' }).first().click();
const bandKnopf = (page: Page, gruppe: string, name: string) =>
	band(page).getByRole('group', { name: gruppe, exact: true }).getByRole('button', { name, exact: true });
const gesperrteStreuungen = async (page: Page) =>
	(await quelle(page)).match(/<svg class="streuung"[^>]*data-gesperrt/g)?.length ?? 0;

/** Das Kopfband ist `::before` am `.kopf`, nur aus `blatt.css`. */
const kopfband = (page: Page) =>
	material(page)
		.locator('.kopf')
		.first()
		.evaluate((kopf) => getComputedStyle(kopf, '::before').content);

test.describe('Ältere Blätter mit Rezept (180)', () => {
	test.describe('am Mac', () => {
		test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

		test.beforeEach(async ({ page }) => {
			await page.setViewportSize({ width: 1512, height: 982 });
		});

		test('keine Rezepte-Schublade, ⌥7 öffnet nichts, die Palette kennt kein Rezept', async ({ page }) => {
			await blatt(page);
			await expect(page.locator('[data-schublade-knopf]')).toHaveCount(5);
			await expect(page.locator('[data-schublade-knopf="rezepte"]')).toHaveCount(0);
			await oeffneSchublade(page, 'bilder');
			await page.keyboard.press('Alt+Digit7');
			// Am Mac stehen die Ebenen daneben (183).
			await expect(page.locator('[data-panel-links="bilder"]')).toBeVisible();

			await page.keyboard.press('ControlOrMeta+k');
			const palette = page.locator('[data-befehlspalette]');
			await palette.getByRole('combobox').fill('Rezept');
			// Nur „An Claude schicken: Rezept“, das jede Suche anbietet.
			const claude = '[data-palette-zeile="claude:schicken"]';
			await expect(palette.locator(claude)).toBeVisible();
			await expect(palette.locator(`[data-palette-zeile]:not(${claude})`)).toHaveCount(0);
		});

		test('Ebenen: ohne Rezept und Kopfband, Fläche und Streuungen mit Schloss', async ({ page }) => {
			await blatt(page);
			await oeffneSchublade(page, 'ebenen');
			await expect(ebenen(page)).toBeVisible();
			await expect(ebenen(page).locator('[data-ebenen-zeichen="rezept"]')).toHaveCount(0);
			await expect(ebenen(page).locator('[data-zeile-nr]', { hasText: /Kopfband/ })).toHaveCount(0);
			const flaecheZeile = ebenen(page).locator('[data-zeilen-art="seitenflaeche"]');
			await expect(flaecheZeile).toHaveCount(1);
			await expect(flaecheZeile).toHaveAttribute('data-gesperrt', 'true');
			const streuungen = ebenen(page).locator('[data-zeilen-art="hinten"]');
			await expect(streuungen).toHaveCount(2);
			for (const zeile of await streuungen.all()) {
				await expect(zeile).toHaveAttribute('data-gesperrt', 'true');
				await expect(zeile.locator('[data-ebenen-zeichen="schloss"][data-gesetzt]')).toBeVisible();
			}

			// Das Schloss öffnet eine Streuung wie jede andere Gestaltung.
			const erste = streuungen.first();
			await erste.hover();
			await erste.locator('[data-ebenen-zeichen="schloss"]').click();
			await expect.poll(() => gesperrteStreuungen(page)).toBe(1);
		});

		test('Reiter „Blatt“: Fläche frei änderbar, die Datei ändert sich nur an dieser Stelle', async ({ page }) => {
			const { material: datei, probe } = await blatt(page);
			expect(await kopfband(page)).not.toBe('none');

			await reiterBlatt(page);
			await expect(flaeche(page)).toBeVisible();
			await expect(page.locator('[data-aus-rezept]')).toHaveCount(0);
			await expect(flaeche(page).locator('[data-blatt-flaeche="farbe"]')).toHaveCount(1);
			await flaeche(page).locator('[data-farbwahl="flaeche-f1"] [data-farbe="var(--haupt)"]').click();
			await expect.poll(() => quelle(page)).toContain('style="--f1:var(--haupt)"');
			await gespeichert(page, datei);

			const neu = await readFile(datei, 'utf8');
			expect(bodyTag(neu)).toBe(bodyTag(probe));
			expect(neu).toBe(probe.replace('style="--f1:var(--a-flaeche)"', 'style="--f1:var(--haupt)"'));
			// Das Kopfband steht weiter da: Es hängt nur an den Werten am body und an blatt.css.
			expect(await kopfband(page)).not.toBe('none');
		});

		test('Kopfband (181): zeigt das alte Band, die Datei bleibt beim Öffnen gleich', async ({ page }) => {
			const { material: datei, probe } = await blatt(page);
			await reiterBlatt(page);
			const a1 = /--a1:(#[0-9a-f]{6})/.exec(bodyTag(probe))?.[1];
			expect(a1).toBeTruthy();
			await expect(bandKnopf(page, 'Kopfband', 'Verlauf')).toHaveAttribute('aria-pressed', 'true');
			await expect(bandKnopf(page, 'Form', 'Welle')).toHaveAttribute('aria-pressed', 'true');
			const farbe1 = band(page).locator('[data-farbwahl="kopfband-f1"] input[data-farbe="eigen"]');
			await expect(farbe1).toHaveValue(a1 ?? '');
			await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();
			expect(await quelle(page)).toBe(probe);
			expect(await readFile(datei, 'utf8')).toBe(probe);
		});

		test('Kopfband (181): Höhe +10 schreibt das Band auf die Seite, der body bleibt, der Titel weiß', async ({
			page,
		}) => {
			const { material: datei, probe } = await blatt(page);
			await reiterBlatt(page);
			const regler = band(page).locator('[data-regler="hoehe"] input');
			const hoehe = Number(await regler.inputValue());
			expect(hoehe).toBeGreaterThan(100);
			await regler.fill(String(hoehe + 10));
			await expect.poll(() => quelle(page)).toContain('<div class="kopfband"');
			await gespeichert(page, datei);

			const neu = await readFile(datei, 'utf8');
			expect(bodyTag(neu)).toBe(bodyTag(probe));
			const [, a1, a2] = /--a1:(#[0-9a-f]{6});--a2:(#[0-9a-f]{6})/.exec(probe) ?? [];
			const stil = `--f1:${a1};--f2:${a2};--h:${hoehe + 10}px`;
			expect(/<div class="kopfband"[^>]*>/.exec(neu)?.[0]).toBe(
				`<div class="kopfband" data-form="welle" data-flaeche="verlauf" style="${stil}">`,
			);
			const kopf = material(page).locator('.kopf').first();
			await expect.poll(() => kopf.evaluate((k) => getComputedStyle(k, '::before').display)).toBe('none');
			expect(await kopf.locator('h1').evaluate((h) => getComputedStyle(h).color)).toBe('rgb(255, 255, 255)');
		});

		test('Kopfband (181): „Keine“ nimmt Band und weißen Titel, ⌘Z stellt den alten Stand her', async ({ page }) => {
			const { probe } = await blatt(page);
			await reiterBlatt(page);
			await bandKnopf(page, 'Kopfband', 'Keine').click();
			await expect.poll(async () => bodyTag(await quelle(page))).not.toContain('data-aufmachung-kopfband');
			const ohne = await quelle(page);
			expect(ohne).not.toContain('class="kopfband"');
			expect(bodyTag(ohne)).not.toContain('--a-titel');
			expect(bodyTag(ohne)).toContain('data-aufmachung="detektiv"');
			await expect.poll(() => kopfband(page)).toBe('none');
			// Die h1 steht in --dunkel der Palette (Hex am body, die h1 meldet rgb).
			const [farbe, dunkel] = await material(page)
				.locator('.kopf h1')
				.first()
				.evaluate((h1) => {
					const stil = getComputedStyle(h1);
					return [stil.color, stil.getPropertyValue('--dunkel').trim()];
				});
			const hex = `#${(farbe?.match(/\d+/g) ?? []).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
			expect(hex).toBe(dunkel?.toLowerCase());

			await page.keyboard.press('ControlOrMeta+z');
			await expect.poll(() => quelle(page)).toBe(probe);
			expect(await kopfband(page)).not.toBe('none');
		});

		test('ein alter Speicherwert `rezepte` öffnet die Ebenen', async ({ page }) => {
			await blatt(page);
			await page.evaluate(() => localStorage.setItem('schoolbox-panel-links', 'rezepte'));
			await page.reload();
			await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
			await expect(panel(page)).toHaveAttribute('data-panel-links', 'ebenen');
			await expect(ebenen(page)).toBeVisible();
		});
	});

	test('iPad quer: Kopfband sichtbar, keine Rezepte-Schublade, kein Rezept-Zeichen', async ({ page }) => {
		test.skip(test.info().project.name !== 'ipad-quer', 'nur am iPad quer');
		await blatt(page);
		expect(await kopfband(page)).not.toBe('none');
		await expect(page.locator('[data-schublade-knopf="rezepte"]')).toHaveCount(0);
		await oeffneSchublade(page, 'ebenen');
		await expect(ebenen(page).locator('[data-ebenen-zeichen="rezept"]')).toHaveCount(0);
		const flaecheZeile = ebenen(page).locator('[data-zeilen-art="seitenflaeche"]');
		await expect(flaecheZeile).toHaveAttribute('data-gesperrt', 'true');
	});
});
