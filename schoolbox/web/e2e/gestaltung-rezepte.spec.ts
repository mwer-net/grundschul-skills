/**
 * Rezepte im Editor (119): Schublade ⌥7 mit Vorschau, Regler in Schublade und Inspektor, Würfeln, Freilegen,
 * Entfernen; Thema mit eigenem Kopf, Ebenen und Minibuch.
 */
import { writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, legeMappeAn, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const blatt = async (page: Page, html = blattMit()) => {
	const u = await uhrzeit();
	await writeFile(u.material, html);
	await oeffne(page, u.id, u.dok);
	return u;
};

const schublade = (page: Page) => page.locator('[data-schublade-rezepte]');
const kachel = (page: Page, id: string) => page.locator(`[data-rezept-kachel="${id}"]`);
const segment = (page: Page, gruppe: string, name: string) =>
	schublade(page).getByRole('group', { name: gruppe }).getByRole('button', { name, exact: true });
const teile = (page: Page) => material(page).locator('[data-aufmachung-teil]');
const schwarzWeiss = (page: Page) =>
	page.locator('[data-profilschalter]').getByRole('button', { name: 's/w', exact: true });
const farbe = (page: Page) =>
	page.locator('[data-profilschalter]').getByRole('button', { name: 'Farbe', exact: true });

const mitZirkus = async (page: Page) => {
	await blatt(page);
	await page.keyboard.press('Alt+Digit7');
	await expect(schublade(page)).toBeVisible();
	await kachel(page, 'zirkus').click();
	await expect.poll(() => quelle(page)).toContain('data-aufmachung="zirkus"');
};

/** Anteil der Bildpunkte, die sich deutlich unterscheiden; im Browser verglichen, ohne weitere Abhängigkeit. */
const abweichung = (page: Page, a: Buffer, b: Buffer) =>
	page.evaluate(
		async ({ x, y }) => {
			const lade = async (b64: string) => {
				const bild = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
				const c = new OffscreenCanvas(bild.width, bild.height);
				const g = c.getContext('2d');
				g?.drawImage(bild, 0, 0);
				return g?.getImageData(0, 0, bild.width, bild.height).data ?? new Uint8ClampedArray();
			};
			const [p, q] = await Promise.all([lade(x), lade(y)]);
			if (p.length !== q.length) {
				return 1;
			}
			let anders = 0;
			for (let i = 0; i < p.length; i += 4) {
				const d = Math.max(
					Math.abs((p[i] ?? 0) - (q[i] ?? 0)),
					Math.abs((p[i + 1] ?? 0) - (q[i + 1] ?? 0)),
					Math.abs((p[i + 2] ?? 0) - (q[i + 2] ?? 0)),
				);
				if (d > 48) {
					anders++;
				}
			}
			return anders / (p.length / 4);
		},
		{ x: a.toString('base64'), y: b.toString('base64') },
	);

const bildDerSeite = (page: Page) => material(page).locator('.seite').first().screenshot({ animations: 'disabled' });

test.describe('Rezepte (119)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Schublade und Inspektor nebeneinander nur am Mac');

	test('⌥7 zeigt die Rezepte mit Vorschau; ein Klick ist ein Schritt, ⌘Z stellt her', async ({ page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		await page.keyboard.press('Alt+Digit7');
		await expect(schublade(page)).toBeVisible();
		await expect(schublade(page).locator('[data-rezept-kachel]')).toHaveCount(4);
		await expect(kachel(page, 'zirkus').locator('iframe')).toHaveAttribute('src', /aufmachung=zirkus&seite=1/);

		await kachel(page, 'zirkus').click();
		await expect.poll(() => quelle(page)).toContain('data-aufmachung="zirkus"');
		await expect(kachel(page, 'zirkus')).toHaveAttribute('aria-pressed', 'true');
		await expect(material(page).locator('[data-aufmachung-teil="flaeche"]')).toHaveCount(1);
		await expect(material(page).locator('[data-aufmachung-teil="streuung"]').first()).toBeAttached();
		const vorKopf = await material(page)
			.locator('.kopf')
			.evaluate((k) => getComputedStyle(k, '::before').content);
		expect(vorKopf).not.toBe('none');

		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Regler: Farben, Konfetti, Kopfband, Rahmen, je ein Schritt', async ({ page }) => {
		await mitZirkus(page);
		await schublade(page).locator('[data-rezept-farben="2"]').click();
		await expect.poll(() => quelle(page)).toContain('data-aufmachung-farben="2"');

		await segment(page, 'Kopfband', 'gerade').click();
		await expect.poll(() => quelle(page)).toContain('data-aufmachung-kopfband="gerade"');
		await segment(page, 'Rahmen', 'Linie').click();
		await expect.poll(() => quelle(page)).toContain('data-aufmachung-rahmen="linie"');

		// Schieber: Beim Ziehen nur Vorschau, beim Loslassen ein Schritt.
		const schieber = schublade(page).locator('[data-regler="rezept-konfetti"] input');
		await schieber.focus();
		await page.keyboard.press('Home');
		await expect.poll(() => quelle(page)).toContain('data-aufmachung-konfetti="0 ');
		await expect(material(page).locator('[data-aufmachung-teil="streuung"]')).toHaveCount(0);

		for (let i = 0; i < 4; i++) {
			await page.keyboard.press('ControlOrMeta+z');
		}
		await expect.poll(() => quelle(page)).not.toContain('data-aufmachung-farben="2"');
	});

	test('Würfeln ändert nur die Streuungen', async ({ page }) => {
		await mitZirkus(page);
		const vorher = await quelle(page);
		await schublade(page).locator('[data-rezept-wuerfeln]').click();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		const ohneStreuung = (q: string) =>
			q
				.replace(/<svg[^>]*data-aufmachung-teil="streuung"[\s\S]*?<\/svg>/g, '')
				.replace(/data-aufmachung-saat="\d+"/, '');
		expect(ohneStreuung(await quelle(page))).toBe(ohneStreuung(vorher));
	});

	test('Freilegen: normale Gestaltung, das Blatt sieht gleich aus, Titel in s/w dunkel', async ({ page }) => {
		await mitZirkus(page);
		await page.waitForTimeout(300);
		const farbeVorher = await bildDerSeite(page);
		await schwarzWeiss(page).click();
		const swVorher = await bildDerSeite(page);
		await farbe(page).click();

		await schublade(page).locator('[data-rezept-freilegen]').click();
		await expect.poll(() => quelle(page)).not.toContain('data-aufmachung=');
		await expect(teile(page)).toHaveCount(0);
		await expect(material(page).locator('[data-gesperrt]')).toHaveCount(0);
		await expect(schublade(page).locator('[aria-pressed="true"][data-rezept-kachel]')).toHaveCount(0);
		await expect(schublade(page).locator('[data-rezept-anpassen]')).toHaveCount(0);

		expect(await abweichung(page, farbeVorher, await bildDerSeite(page))).toBeLessThan(0.01);
		await schwarzWeiss(page).click();
		expect(await abweichung(page, swVorher, await bildDerSeite(page))).toBeLessThan(0.01);
		const titel = material(page).locator('.kopf h1');
		await expect(titel).toHaveAttribute('data-sw', 'dunkel');
		const hell = await titel.evaluate((h) => (getComputedStyle(h).color.match(/\d+/g) ?? []).map(Number));
		expect(Math.max(...hell)).toBeLessThan(128);
	});

	test('Entfernen im ⋯ der Schublade', async ({ page }) => {
		await mitZirkus(page);
		await schublade(page).getByRole('button', { name: 'Mehr zu Rezepte' }).click();
		await page.getByRole('menuitem', { name: 'Rezept entfernen' }).click();
		await expect.poll(() => quelle(page)).not.toContain('data-aufmachung');
		await expect(teile(page)).toHaveCount(0);
	});

	test('Thema mit eigenem Kopf: Kopfband nur „ohne“ mit Hinweis', async ({ page }) => {
		await blatt(
			page,
			blattMit().replace(
				'<div class="kopf">',
				'<div class="thema-band"></div>\n  <div class="kopf thema-kopf">',
			).replace('palette-himmel', 'palette-himmel thema-wald'),
		);
		await oeffneSchublade(page, 'rezepte');
		await kachel(page, 'zirkus').click();
		await expect.poll(() => quelle(page)).toContain('data-aufmachung="zirkus"');
		const gruppe = schublade(page).getByRole('group', { name: 'Kopfband' });
		await expect(gruppe.getByRole('button')).toHaveCount(1);
		await expect(schublade(page)).toContainText('Das Thema dieser Reihe gestaltet den Kopf.');
	});

	test('Ebenen: Rezept-Zeichen und Zeile „Kopfband (Rezept)“ öffnen den Inspektor', async ({ page }) => {
		await mitZirkus(page);
		await oeffneSchublade(page, 'ebenen');
		const zeile = page.getByRole('navigation', { name: 'Ebenen' }).getByText('Kopfband (Rezept)');
		await expect(zeile).toBeVisible();
		await expect(page.locator('[data-ebenen-zeichen="rezept"]').first()).toBeVisible();
		await page.locator('[data-ebenen-zeichen="rezept"]').first().click();
		await expect(page.locator('[data-blatt-rezept="zirkus"]')).toBeVisible();
		await expect(page.locator('[data-blatt-rezept="zirkus"] [data-rezept-regler]')).toBeVisible();
	});

	test('Inspektor ohne Rezept öffnet die Schublade', async ({ page }) => {
		await blatt(page);
		await material(page).locator('.aufgabe').first().locator('.nr').click();
		await page.getByRole('tab', { name: 'Blatt' }).first().click();
		await page.locator('[data-gestaltung-kopf]').click();
		await expect(page.locator('[data-blatt-rezept=""]')).toContainText('Kein Rezept.');
		await page.getByRole('button', { name: 'Rezepte öffnen' }).click();
		await expect(schublade(page)).toBeVisible();
	});

	test('Minibuch: Hinweis, keine Kachel', async ({ page }) => {
		const { dokumente, id } = await legeMappeAn('Farben', 'englisch', 3, [
			{ titel: 'Farben', format: 'minibuch', vorlage: 'minibuch' },
		]);
		await oeffne(page, id, dokumente[0] ?? '');
		await oeffneSchublade(page, 'rezepte');
		await expect(schublade(page)).toContainText('Rezepte gibt es nicht für Minibücher.');
		await expect(page.locator('[data-rezept-kachel]')).toHaveCount(0);
	});
});
