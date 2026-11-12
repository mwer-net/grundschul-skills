/**
 * Reiter „Blatt“: Seitenfläche, Rahmen und Kopfband als eigene Abschnitte (095, 181). Jede Änderung ist ein Schritt.
 * „Gilt für“ steht je Abschnitt, sobald das Blatt mehr als eine Seite hat. Ein neues Kopfband reicht bis unter den
 * Kopf. In s/w fallen Fläche und Kopfband weg, außer mit „In s/w: Grau“.
 */
import { writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import type { Einsatz } from './gestaltung-daten';
import { blattMit, KOPFBAND, SEITENFLAECHE, SEITENRAHMEN, STREUUNG } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

type Teil = 'seitenflaeche' | 'seitenrahmen' | 'kopfband';

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

const reiterBlatt = (page: Page) => page.getByRole('tab', { name: 'Blatt' }).first().click();
const abschnitt = (page: Page, teil: Teil) => page.locator(`[data-abschnitt="${teil}"]`);
/** Ein Knopf einer Gruppe im Abschnitt, z. B. Kopfband › „Kopfband“ › „Farbe“. */
const knopf = (page: Page, teil: Teil, gruppe: string, name: string) =>
	abschnitt(page, teil).getByRole('group', { name: gruppe, exact: true }).getByRole('button', { name, exact: true });
const anzahl = (text: string, teil: string) => text.split(`class="${teil}"`).length - 1;
const kopfbaender = (text: string) => text.match(/<div class="kopfband"[^>]*>/g) ?? [];
const hoeheIn = (text: string) => Number(/class="kopfband"[^>]*--h:([\d.]+)px/.exec(text)?.[1]);
const schwarzWeiss = (page: Page) =>
	page.locator('[data-profilschalter]').getByRole('button', { name: 's/w', exact: true });
/** Lage des Elements zur Seite: 0, 0, 0 heißt bündig oben links und über die ganze Breite. */
const lageZurSeite = (element: Element) => {
	const e = element.getBoundingClientRect();
	const s = element.closest('.seite')?.getBoundingClientRect();
	return { links: e.left - (s?.left ?? 0), oben: e.top - (s?.top ?? 0), breite: e.width - (s?.width ?? 0) };
};
/** Nur Grautöne im Hintergrund, und nicht nur Weiß. */
const grau = (element: Element) => {
	const stil = getComputedStyle(element);
	const farben = [...`${stil.backgroundColor} ${stil.backgroundImage}`.matchAll(/rgba?\(([^)]*)\)/g)].map((m) =>
		(m[1] ?? '').split(',').slice(0, 3).map(Number),
	);
	return farben.every(([r, g, b]) => r === g && g === b) && farben.some(([r]) => r !== 255 && r !== 0);
};

test.describe('Seitenfläche, Rahmen und Kopfband (095, 181)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Inspektor und Ebenen nebeneinander nur am Mac');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 982 });
	});

	test('Drei Abschnitte am Ende des Reiters, ohne Klappkopf; bei einer Seite kein „Gilt für“', async ({ page }) => {
		await blatt(page);
		await reiterBlatt(page);
		const reiter = page.locator('[data-inspektor="blatt"]');
		await expect(abschnitt(page, 'kopfband')).toBeVisible();
		const reihe = await reiter
			.locator('[data-abschnitt]')
			.evaluateAll((liste) => liste.map((a) => a.getAttribute('data-abschnitt')));
		expect(reihe.slice(-3)).toEqual(['seitenflaeche', 'seitenrahmen', 'kopfband']);
		await expect(page.locator('[data-gestaltung-kopf], [data-blatt-gestaltung]')).toHaveCount(0);
		await expect(reiter.getByRole('group', { name: 'Gilt für' })).toHaveCount(0);
		await expect(knopf(page, 'kopfband', 'Kopfband', 'Keine')).toHaveAttribute('aria-pressed', 'true');
	});

	test('„Verlauf“ in zwei Klicks; die Fläche reicht bis an den Blattrand', async ({ page }) => {
		await blatt(page);
		await reiterBlatt(page);
		await knopf(page, 'seitenflaeche', 'Seitenfläche', 'Verlauf').click();

		await expect.poll(() => quelle(page)).toContain('data-flaeche="verlauf"');
		const flaeche = material(page).locator('.seite > .ebene.hinten > .seitenflaeche');
		await expect(flaeche).toBeVisible();
		expect(await flaeche.evaluate(lageZurSeite)).toEqual({ links: 0, oben: 0, breite: 0 });
		expect(await flaeche.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
	});

	test('In s/w ist der Grund weiß, mit „In s/w: Grau“ grau', async ({ page }) => {
		await blatt(page);
		await reiterBlatt(page);
		await knopf(page, 'seitenflaeche', 'Seitenfläche', 'Farbe').click();
		await expect.poll(() => quelle(page)).toContain('data-flaeche="farbe"');
		await page.locator('[data-farbwahl="flaeche-f1"] [data-farbe="var(--haupt)"]').click();
		await expect.poll(() => quelle(page)).toContain('--f1:var(--haupt)');

		const flaeche = material(page).locator('.seitenflaeche');
		await schwarzWeiss(page).click();
		await expect(material(page).locator('body.sw')).toHaveCount(1);
		await expect(flaeche).toBeHidden();

		await knopf(page, 'seitenflaeche', 'In s/w', 'Grau').click();
		await expect.poll(() => quelle(page)).toContain('data-sw="grau"');
		await expect(flaeche).toBeVisible();
		await expect.poll(() => flaeche.evaluate(grau)).toBe(true);
	});

	test('Rahmen-Kacheln: „Gestrichelt“ liegt 24 px vom Blattrand, „Keine“ entfernt den Rahmen', async ({ page }) => {
		await blatt(page);
		await reiterBlatt(page);
		const gestrichelt = knopf(page, 'seitenrahmen', 'Seitenrahmen', 'Gestrichelt');
		await gestrichelt.click();
		await expect.poll(() => quelle(page)).toContain('data-rahmen="gestrichelt"');
		await expect(gestrichelt).toHaveAttribute('aria-pressed', 'true');
		const abstand = await material(page)
			.locator('.seitenrahmen')
			.evaluate((el) => {
				const r = el.getBoundingClientRect();
				const s = el.closest('.seite')?.getBoundingClientRect();
				return { links: r.left - (s?.left ?? 0), oben: r.top - (s?.top ?? 0) };
			});
		expect(abstand).toEqual({ links: 24, oben: 24 });
		await expect(abschnitt(page, 'seitenrahmen').locator('[data-regler="abstand"] [data-regler-wert]')).toHaveText(
			'24 px',
		);

		await knopf(page, 'seitenrahmen', 'Seitenrahmen', 'Keine').click();
		await expect.poll(() => quelle(page)).not.toContain('seitenrahmen');
		expect(await quelle(page)).not.toContain('class="ebene');
	});

	test('Kopfband bis unter den Kopf; Form, Höhe, Verlauf und Grau je ein Schritt', async ({ page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		await reiterBlatt(page);
		await knopf(page, 'kopfband', 'Kopfband', 'Farbe').click();
		await expect.poll(async () => kopfbaender(await quelle(page))).toHaveLength(1);
		const [neu = ''] = kopfbaender(await quelle(page));
		expect(neu).toMatch(/^<div class="kopfband" style="--f1:#[0-9a-f]{6};--h:\d+px">$/);

		// Bis 18 px unter den Kopf, auf 1 px genau, und oben über die ganze Breite.
		const band = material(page).locator('.seite > .ebene.hinten > .kopfband');
		const erwartet = await material(page)
			.locator('.seite')
			.first()
			.evaluate((seite) => {
				const kopf = seite.querySelector('.kopf')?.getBoundingClientRect();
				return (kopf?.bottom ?? 0) - (seite.getBoundingClientRect().top + seite.clientTop) + 18;
			});
		const hoehe = hoeheIn(await quelle(page));
		expect(Math.abs(hoehe - erwartet)).toBeLessThanOrEqual(1);
		expect(await band.evaluate(lageZurSeite)).toEqual({ links: 0, oben: 0, breite: 0 });

		await knopf(page, 'kopfband', 'Form', 'Welle').click();
		await expect.poll(() => quelle(page)).toContain('data-form="welle"');
		await expect(abschnitt(page, 'kopfband').locator('[data-blatt-kopfband="welle"]')).toHaveCount(1);

		// Höhe: Beim Ziehen nur ansehen, beim Loslassen ein Schritt.
		const vorDemZiehen = await quelle(page);
		const regler = abschnitt(page, 'kopfband').locator('[data-regler="hoehe"] input');
		await regler.scrollIntoViewIfNeeded();
		const box = await regler.boundingBox();
		expect(box).not.toBeNull();
		const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
		await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.45, y);
		await page.mouse.down();
		await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.25, y, { steps: 8 });
		await expect
			.poll(() => band.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--h')))
			.not.toBe(`${hoehe}px`);
		expect(await quelle(page)).toBe(vorDemZiehen);
		await page.mouse.up();
		await expect.poll(() => quelle(page)).not.toBe(vorDemZiehen);
		expect(hoeheIn(await quelle(page))).not.toBe(hoehe);

		// Verlauf mit zwei Farben.
		await knopf(page, 'kopfband', 'Kopfband', 'Verlauf').click();
		await expect.poll(() => quelle(page)).toContain('data-flaeche="verlauf"');
		await abschnitt(page, 'kopfband').locator('[data-farbwahl="kopfband-f2"] [data-farbe="var(--haupt)"]').click();
		await expect.poll(() => quelle(page)).toContain('--f2:var(--haupt)');

		// In s/w weg, mit „Grau“ grau.
		await schwarzWeiss(page).click();
		await expect(material(page).locator('body.sw')).toHaveCount(1);
		await expect(band).toBeHidden();
		await knopf(page, 'kopfband', 'In s/w', 'Grau').click();
		await expect.poll(() => quelle(page)).toContain('data-sw="grau"');
		await expect(band).toBeVisible();
		await expect.poll(() => band.evaluate(grau)).toBe(true);

		// Sechs Schritte: Nach fünf steht noch das erste Band da, nach dem sechsten der alte Stand.
		for (let i = 0; i < 5; i += 1) {
			await page.keyboard.press('ControlOrMeta+z');
		}
		await expect.poll(async () => kopfbaender(await quelle(page))).toEqual([neu]);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('„Keine“ entfernt das Kopfband und mit ihm die leere Ebene', async ({ page }) => {
		await blatt(page, { hinten: [KOPFBAND] });
		await reiterBlatt(page);
		await expect(knopf(page, 'kopfband', 'Kopfband', 'Verlauf')).toHaveAttribute('aria-pressed', 'true');
		await expect(abschnitt(page, 'kopfband').locator('[data-blatt-kopfband="welle"]')).toHaveCount(1);
		await knopf(page, 'kopfband', 'Kopfband', 'Keine').click();
		await expect.poll(() => quelle(page)).not.toContain('class="kopfband"');
		expect(await quelle(page)).not.toContain('class="ebene');
	});

	test('Zwei Seiten: Rahmen für alle, Kopfband für Seite 1; ⌘Z je ein Schritt', async ({ page }) => {
		await blatt(page, {}, true);
		const vorher = await quelle(page);
		await reiterBlatt(page);
		await expect(knopf(page, 'seitenrahmen', 'Gilt für', 'Alle Seiten')).toHaveAttribute('aria-pressed', 'true');
		await knopf(page, 'seitenrahmen', 'Seitenrahmen', 'Linie').click();
		await expect.poll(async () => anzahl(await quelle(page), 'seitenrahmen')).toBe(2);

		await knopf(page, 'kopfband', 'Gilt für', 'Seite 1').click();
		await knopf(page, 'kopfband', 'Kopfband', 'Farbe').click();
		await expect.poll(async () => anzahl(await quelle(page), 'kopfband')).toBe(1);
		const text = await quelle(page);
		expect(text.indexOf('class="kopfband"')).toBeLessThan(text.indexOf('</section>'));

		// Seite 2: kein Kopfband, also „Seite 2“; der Rahmen ist auf beiden Seiten gleich, also „Alle Seiten“.
		await oeffneSchublade(page, 'ebenen');
		await page.locator('[data-panel-links]').getByText('Seite 2', { exact: true }).click();
		await reiterBlatt(page);
		await expect(knopf(page, 'kopfband', 'Gilt für', 'Seite 2')).toHaveAttribute('aria-pressed', 'true');
		await expect(knopf(page, 'kopfband', 'Kopfband', 'Keine')).toHaveAttribute('aria-pressed', 'true');
		await expect(knopf(page, 'seitenrahmen', 'Gilt für', 'Alle Seiten')).toHaveAttribute('aria-pressed', 'true');

		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(async () => anzahl(await quelle(page), 'kopfband')).toBe(0);
		expect(anzahl(await quelle(page), 'seitenrahmen')).toBe(2);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Ebenen: Kopfband über der Streuung, Rahmen und Fläche zuunterst; ein Klick öffnet den Abschnitt', async ({
		page,
	}) => {
		await blatt(page, { hinten: [SEITENFLAECHE, SEITENRAHMEN, KOPFBAND, STREUUNG] });
		await oeffneSchublade(page, 'ebenen');
		const seite = page.locator('[data-gliederung-seite="1"]');
		const band = seite.locator('[data-zeilen-art="kopfband"]');
		await expect(band).toHaveCount(1);
		const arten = await seite
			.locator('[data-zeilen-art]')
			.evaluateAll((liste) =>
				liste.map((z) => z.getAttribute('data-zeilen-art')).filter((a) => a !== 'baustein'),
			);
		expect(arten).toEqual(['hauptstapel', 'kopfband', 'hinten', 'seitenrahmen', 'seitenflaeche']);
		await expect(band).toHaveAttribute('data-gliederung-fest', 'true');
		await expect(band.locator('[data-griff-zeile]')).toHaveCount(0);

		await material(page).locator('.aufgabe').first().locator('.nr').click();
		await expect(page.locator('[data-inspektor="auswahl"]')).toBeVisible();
		await band.locator('[data-gliederung-titel]').click();
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await expect(abschnitt(page, 'kopfband')).toBeInViewport();
		await expect(knopf(page, 'kopfband', 'Kopfband', 'Verlauf')).toHaveAttribute('aria-pressed', 'true');

		await material(page).locator('.aufgabe').first().locator('.nr').click();
		await seite.locator('[data-zeilen-art="seitenflaeche"] [data-gliederung-titel]').click();
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await expect(abschnitt(page, 'seitenflaeche')).toBeInViewport();
		await expect(abschnitt(page, 'seitenflaeche').locator('[data-blatt-flaeche="verlauf"]')).toHaveCount(1);
		await expect(abschnitt(page, 'seitenrahmen').locator('[data-blatt-rahmen="gestrichelt"]')).toHaveCount(1);
	});
});

test('iPad quer: „Gilt für“ und das Segment stehen in einer Zeile', async ({ page }) => {
	test.skip(test.info().project.name !== 'ipad-quer', 'nur am iPad quer');
	await blatt(page, {}, true);
	await reiterBlatt(page);
	const kopfband = abschnitt(page, 'kopfband');
	await kopfband.scrollIntoViewIfNeeded();
	const titel = await kopfband.getByText('Gilt für', { exact: true }).boundingBox();
	const segment = await kopfband.getByRole('group', { name: 'Gilt für' }).boundingBox();
	expect(titel).not.toBeNull();
	expect(segment).not.toBeNull();
	// Die Beschriftung steht mittig zum Segment: gleiche Mitte statt gleicher Oberkante.
	const mitte = (b: typeof titel) => (b?.y ?? 0) + (b?.height ?? 0) / 2;
	expect(Math.abs(mitte(titel) - mitte(segment))).toBeLessThanOrEqual(2);
	expect((titel?.x ?? 0) + (titel?.width ?? 0)).toBeLessThanOrEqual(segment?.x ?? 0);
});
