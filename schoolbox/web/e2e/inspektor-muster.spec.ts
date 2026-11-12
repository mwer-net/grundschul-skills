/**
 * Ein Muster für den Inspektor (182): runde Farbpunkte in fester Reihe, gewählt als Ring bzw. Rand in Tinte, Schalter
 * statt Knöpfe „… an/aus“, eine Beschriftung je Wert, die Einheit im Feld und keine Sätze. Am Mac (1512 × 982), die
 * Größe der Punkte einmal am iPad quer.
 */
import { readFile, writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, uhrzeit } from './editorhilfe';
import type { Einsatz } from './gestaltung-daten';
import { BILDRAHMEN, blattMit, FIGUR_ANKER, FORM, GRUPPE, SCHMUCK, SEITENFLAECHE, STREUUNG } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const TINTE = 'rgb(28, 28, 31)';
const WEISS = 'rgb(255, 255, 255)';

/** Die Sätze, die 182 aus dem Inspektor nimmt (Entscheidung 53). */
const SAETZE = [
	'Farbe, Muster und Rahmen stellst du',
	'Elemente gewählt.',
	'Am Anker liegt es immer vorne.',
	'Maske und Rahmen-Stil schließen sich aus.',
	'Gruppe · ',
	'Tippe aufs Bild',
];

const REIHENFOLGE = [
	'keine',
	'#000000',
	'var(--haupt)',
	'var(--akzent)',
	'var(--dunkel)',
	'var(--linie)',
	'var(--fuell)',
	'#ffffff',
	'eigen',
];

const inspektor = (page: Page) => page.locator('[data-inspektor]');

const blatt = async (page: Page, einsatz: Einsatz) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit(einsatz));
	await oeffne(page, u.id, u.dok);
};

/** Das Testdokument mit einer Abbildung an Stelle der ersten Uhr. */
const mitAbbildung = async (page: Page, html: string) => {
	const u = await uhrzeit();
	await writeFile(u.material, (await readFile(u.material, 'utf8')).replace('<x-uhr zeit="4:30"></x-uhr>', html));
	await oeffne(page, u.id, u.dok);
};

const waehle = async (druecke: (ziel: Locator) => Promise<void>, page: Page, element: Locator, art: string) => {
	await element.evaluate((e) => e.scrollIntoView({ block: 'center' }));
	await druecke(element);
	await expect(page.locator(`[data-gestaltung-inspektor="${art}"]`)).toBeVisible();
};

/** Größe und Mitte jedes sichtbaren Punkts einer Reihe (Knöpfe und der Farbkreis im `label`). */
const punkte = (reihe: Locator) =>
	reihe.locator(':scope > button > span, :scope > label > span').evaluateAll((alle) =>
		alle.map((s) => {
			const r = s.getBoundingClientRect();
			return { b: r.width, h: r.height, y: Math.round(r.top + r.height / 2) };
		}),
	);

/** Jeder Punkt ist rund und `groesse` px groß; zurück kommen die Mitten. */
const rund = async (reihe: Locator, groesse: number) => {
	const alle = await punkte(reihe);
	expect(alle.length).toBeGreaterThan(0);
	for (const p of alle) {
		expect(Math.abs(p.b - groesse)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(p.h - groesse)).toBeLessThanOrEqual(0.5);
	}
	return alle.map((p) => p.y);
};

const reihenfolge = (reihe: Locator) =>
	reihe
		.locator(':scope > *')
		.evaluateAll((alle) =>
			alle.map((e) => e.getAttribute('data-farbe') ?? e.querySelector('[data-farbe]')?.getAttribute('data-farbe')),
		);

const ohneSaetze = async (page: Page) => {
	const text = await inspektor(page).innerText();
	for (const satz of SAETZE) {
		expect(text).not.toContain(satz);
	}
	await expect(page.locator('[data-gestaltung-inspektor] > p')).toHaveCount(0);
};

test.describe('Muster des Inspektors (182)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'am Mac');
	test.use({ viewport: { width: 1512, height: 982 } });

	test('Form: Füllung und Kontur je eine Reihe runder Punkte in fester Reihenfolge', async ({ druecke, page }) => {
		await blatt(page, { vorne: [FORM] });
		await waehle(druecke, page, material(page).locator('svg.form'), 'form');
		for (const name of ['form-fuellung', 'form-kontur']) {
			const reihe = page.locator(`[data-form-farben="${name}"] [data-farbwahl="${name}"]`);
			expect(await reihenfolge(reihe)).toEqual(REIHENFOLGE);
			const mitten = await rund(reihe, 18);
			expect(new Set(mitten).size).toBe(1);
		}
		// Gewählt ist genau die Akzentfarbe der Füllung, als Ring in Tinte.
		const fuellung = page.locator('[data-farbwahl="form-fuellung"]');
		await expect(fuellung.locator('[aria-pressed="true"]')).toHaveCount(1);
		await expect(fuellung.locator('[data-farbe="var(--akzent)"]')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('button', { name: /^(Kontur|Bogen) (an|aus)$/ })).toHaveCount(0);
	});

	test('Gegenprobe: Streuung und Farbschema haben dieselben runden Punkte', async ({ druecke, page }) => {
		await blatt(page, { vorne: [STREUUNG] });
		await waehle(druecke, page, material(page).locator('svg.streuung circle').first(), 'streuung');
		const farben = page.locator('[data-streuung-farben] [role="group"]');
		const mitten = await rund(farben, 18);
		expect(new Set(mitten).size).toBe(1);
		await expect(farben.locator('[data-streuung-farbe="haupt"]')).toHaveAttribute('aria-pressed', 'true');

		await druecke(page.getByRole('tab', { name: 'Blatt' }).first());
		const palette = page.locator('[data-palette]');
		await expect(palette.locator('button')).toHaveCount(4);
		expect(new Set(await rund(palette, 18)).size).toBe(1);
	});

	test('Schmuckschrift: Schalter „Kontur“, danach „Stärke“ mit genau einer Beschriftung', async ({
		druecke,
		page,
	}) => {
		await blatt(page, { vorne: [SCHMUCK.replace(' data-kontur', '')] });
		await waehle(druecke, page, material(page).locator('div.schmuck'), 'schmuck');
		const schalter = page.getByRole('switch', { name: 'Kontur', exact: true });
		await expect(schalter).toHaveAttribute('aria-checked', 'false');
		await expect(inspektor(page).getByText('Stärke', { exact: true })).toHaveCount(0);
		await druecke(schalter);
		await expect(schalter).toHaveAttribute('aria-checked', 'true');
		await expect(inspektor(page).getByText('Stärke', { exact: true })).toHaveCount(1);
		await expect(inspektor(page).getByText('Größe', { exact: true })).toHaveCount(1);
		await expect(page.getByRole('switch', { name: 'Bogen', exact: true })).toBeVisible();
	});

	test('Gewählte Kachel: Rand in Tinte, Grund weiß; die Figur ist nicht mehr blau', async ({ druecke, page }) => {
		await blatt(page, { vorne: [BILDRAHMEN] });
		await waehle(druecke, page, material(page).locator('img.bild-frei'), 'bildfrei');
		// Ohne Rahmen-Stil und ohne bekannte Maske: „Gerade“ und „Keine“ sind gewählt.
		for (const kachel of [
			page.locator('[data-rahmenstil-knopf="gerade"]'),
			page.locator('[data-maske-knopf="keine"]'),
		]) {
			await expect(kachel).toHaveAttribute('aria-pressed', 'true');
			await expect(kachel).toHaveCSS('border-top-color', TINTE);
			await expect(kachel).toHaveCSS('background-color', WEISS);
		}
		await expect(page.locator('[data-rahmenstil-knopf="schraeg"]')).toHaveCSS('background-color', WEISS);
		await ohneSaetze(page);

		// Kiki aus der Figurenbibliothek des Testservers (177) hat zwei Posen, also ein Raster.
		await oeffneSchublade(page, 'figuren');
		await druecke(page.locator('[data-schublade-figuren] [data-ablage-gut="Kiki"]'));
		await expect(page.locator('[data-gestaltung-inspektor="figurfrei"]')).toBeVisible();
		const kiki = page.locator('[data-figur-wahl] button[aria-pressed="true"]');
		await expect(kiki).toHaveCount(1);
		await expect(kiki).toHaveAccessibleName('Kiki');
		await expect(kiki).toHaveCSS('border-top-color', TINTE);
		await expect(kiki).toHaveCSS('background-color', WEISS);
	});

	test('Zahlenstrahl: Die Stepper in „Darstellung“ enden an derselben Kante, die Einheit steht im Feld', async ({
		druecke,
		page,
	}) => {
		await mitAbbildung(page, '<x-zahlenstrahl von="0" bis="20" pfeile="7 13"></x-zahlenstrahl>');
		await druecke(material(page).locator('x-zahlenstrahl'));
		const darstellung = page.locator('[data-abschnitt="darstellung"]');
		const mehr = darstellung.getByRole('button', { name: /: mehr$/ });
		expect(await mehr.count()).toBeGreaterThan(1);
		const rechts = await mehr.evaluateAll((alle) => alle.map((k) => Math.round(k.getBoundingClientRect().right)));
		expect(new Set(rechts).size).toBe(1);
		// „px“ steht zwischen − und +, nicht dahinter.
		const breite = darstellung.locator('[data-feld="breite"]');
		const plus = await breite.getByRole('button', { name: /: mehr$/ }).boundingBox();
		const px = await breite.getByText('px', { exact: true }).boundingBox();
		expect((px?.x ?? 0) + (px?.width ?? 0)).toBeLessThanOrEqual(plus?.x ?? 0);
	});

	test('Keine Sätze: Anker, Gruppe, leerer Bildrahmen, Seitenfläche, Beschriften', async ({ druecke, page }) => {
		await blatt(page, { hinten: [SEITENFLAECHE], vorne: [GRUPPE], anker: [FIGUR_ANKER] });

		await waehle(druecke, page, material(page).locator('img.figur-frei[data-anker]'), 'figurfrei');
		// 185: Am Anker fehlt die Zeile „Ebene“ ganz; „Darf Inhalt überdecken“ steht unter „Anordnen“.
		const anordnen = page.locator('[data-abschnitt="anordnen"]');
		await expect(anordnen).toBeVisible();
		await expect(anordnen.getByRole('group', { name: 'Ebene' })).toHaveCount(0);
		await expect(anordnen.getByRole('switch', { name: 'Darf Inhalt überdecken' })).toBeVisible();
		await ohneSaetze(page);

		await waehle(druecke, page, material(page).locator('.gruppe .form-text'), 'gruppe');
		await ohneSaetze(page);

		await oeffneSchublade(page, 'werkzeuge');
		await druecke(page.locator('[data-bildrahmen-kachel="kreis"]'));
		await expect(page.locator('[data-gestaltung-inspektor="bildrahmen"]')).toBeVisible();
		await expect(page.locator('[data-maske-knopf="ellipse"]')).toHaveAttribute('aria-pressed', 'true');
		await ohneSaetze(page);

		await oeffneSchublade(page, 'ebenen');
		await druecke(page.locator('[data-zeilen-art="seitenflaeche"] [data-gliederung-titel]'));
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await ohneSaetze(page);

		await mitAbbildung(page, '<x-beschriften bild="bilder/wachstum.png" punkte="10,50: Samen"></x-beschriften>');
		await druecke(material(page).locator('x-beschriften'));
		await expect(page.locator('[data-punkte-setzen]')).toBeVisible();
		await ohneSaetze(page);
	});
});

test.describe('Muster des Inspektors am iPad (182)', () => {
	test.skip(() => test.info().project.name !== 'ipad-quer', 'nur iPad quer');

	test('Farbpunkte: 44 px Trefferfläche, 28 px Punkt', async ({ druecke, page }) => {
		await blatt(page, { vorne: [FORM] });
		await waehle(druecke, page, material(page).locator('svg.form'), 'form');
		const reihe = page.locator('[data-farbwahl="form-fuellung"]');
		await rund(reihe, 28);
		const flaeche = await reihe.locator(':scope > button').first().boundingBox();
		expect(flaeche?.width).toBe(44);
		expect(flaeche?.height).toBe(44);
	});
});
