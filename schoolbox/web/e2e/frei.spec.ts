import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

/** Wie ein frei gestaltetes Blatt: eigene Klassen, Entitäten, ungewöhnliche Schreibweisen. Alles soll so bleiben. */
const FREI = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Fall 8</title>
<link rel="stylesheet" href="blatt.css"><link rel="stylesheet" href="../../reihe.css">
<script src="abbildungen.js" defer></script>
<style>.eigen{border:2px solid #333;padding:8px;margin:8px}.ab-rahmen{padding:4px}</style></head>
<body class="kl3 sw">
<div class="seite">
    <div class="ab-kopf"><span class="marke">Fall&nbsp;8</span></div>
    <div class="ab-rahmen">
        <div class="eigen" id="erster">K&auml;fer &amp; Krokodil <b class="zz">7</b><b>&lt;</b></div>
        <div class="eigen" id="zweiter">Zweite Spur</div>
    </div>
    <div class="eigen" id="dritter">Dritte Spur</div>
    <table id="plan"><tr><th>Tag</th><th>Spur</th></tr><tr><td id="zelle">Mo</td><td>Teich</td></tr></table>
    <table id="breit"><tr><td colspan="2" id="verbunden">Ganz</td></tr><tr><td>A</td><td>B</td></tr></table>
    <x-uhr stunde="3" minute="0" id="uhr"></x-uhr>
</div>
</body></html>
`;

const blatt = async (page: Page) => {
	const { dok, id, material: datei, ordner } = await uhrzeit();
	await writeFile(path.join(ordner, '..', '..', 'reihe.css'), '.eigen{outline:3px solid #123456}');
	await writeFile(datei, FREI);
	await oeffne(page, id, dok);
	return datei;
};

/** Mit dem Finger beginnt das Tippen im gewählten Text schon beim Antippen; „Fertig“ führt zu den Werkzeugen des Blocks. */
const zuDenWerkzeugen = async (page: Page, werkzeug: Locator) => {
	const fertig = page.getByRole('button', { name: 'Fertig' });
	await expect(werkzeug.or(fertig).first()).toBeVisible();
	if (await fertig.isVisible()) {
		await fertig.click();
	}
	await expect(werkzeug).toBeVisible();
};

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });

test.describe('Editor: frei gestaltetes Material (054)', () => {
	test('Text in fremden Elementen: nur das Wort ändert sich, zurück ist es Byte für Byte die alte Quelle', async ({
		druecke,
		page,
	}) => {
		const datei = await blatt(page);
		const ziel = material(page).locator('#erster');
		await druecke(ziel);
		await expect(page.locator('[data-auswahl="freitext"]')).toBeVisible();
		await expect(ziel).toHaveAttribute('contenteditable', 'true');
		await druecke(ziel);
		await page.keyboard.press('End');
		await page.keyboard.type('X');
		await page.keyboard.press('Escape');
		await expect.poll(() => readFile(datei, 'utf8')).toContain('&lt;X</b>');
		expect(await readFile(datei, 'utf8')).toBe(FREI.replace('<b>&lt;</b>', '<b>&lt;X</b>'));

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(FREI);
	});

	test('Tippen und wieder Löschen führt ohne Rückgängig zur alten Quelle, auch mit Entitäten', async ({
		druecke,
		page,
	}) => {
		const datei = await blatt(page);
		const ziel = material(page).locator('.marke');
		await druecke(ziel);
		await druecke(ziel);
		await page.keyboard.press('End');
		await page.keyboard.type('X');
		await page.keyboard.press('Escape');
		await expect.poll(() => readFile(datei, 'utf8')).toContain('Fall&nbsp;8X</span>');

		await druecke(ziel);
		await druecke(ziel);
		await page.keyboard.press('End');
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Escape');
		await expect.poll(() => readFile(datei, 'utf8')).toBe(FREI);
	});

	test('Antippen und Verlassen ohne Tippen ändert nichts', async ({ druecke, page }) => {
		const datei = await blatt(page);
		for (const stelle of ['#erster', '.marke', '#zelle', '#verbunden']) {
			const ziel = material(page).locator(stelle);
			await druecke(ziel);
			await druecke(ziel);
			await page.keyboard.press('Escape');
		}
		expect(await quelle(page)).toBe(FREI);
		expect(await readFile(datei, 'utf8')).toBe(FREI);
	});

	test('Blöcke lassen sich im Panel verschieben, kopieren und löschen, zwischen allen Geschwistern', async ({
		druecke,
		page,
	}) => {
		const datei = await blatt(page);
		await druecke(material(page).locator('.ab-kopf'));
		await expect(page.locator('[data-auswahl="block"], [data-auswahl="freitext"]')).toBeVisible();
		await zuDenWerkzeugen(page, page.getByRole('button', { name: 'Nach unten' }));
		await druecke(page.getByRole('button', { name: 'Nach unten' }));
		await gespeichert(page, datei);
		const eins = await readFile(datei, 'utf8');
		expect(eins.indexOf('ab-rahmen">')).toBeLessThan(eins.indexOf('ab-kopf'));

		await druecke(material(page).locator('#dritter'));
		await zuDenWerkzeugen(page, page.getByRole('button', { name: 'Duplizieren' }));
		await druecke(page.getByRole('button', { name: 'Duplizieren' }));
		await gespeichert(page, datei);
		expect((await readFile(datei, 'utf8')).match(/Dritte Spur/g)).toHaveLength(2);
		await druecke(page.getByRole('button', { name: 'Löschen' }));
		await gespeichert(page, datei);
		expect((await readFile(datei, 'utf8')).match(/Dritte Spur/g)).toHaveLength(1);
		await druecke(zurueck(page));
		await druecke(zurueck(page));
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(FREI);
	});

	test('Einfügen: Das Plus setzt hinter den gewählten fremden Block', async ({ druecke, page }) => {
		const datei = await blatt(page);
		await druecke(material(page).locator('#dritter'));
		await zuDenWerkzeugen(page, page.locator('[data-einfuegen-plus]'));
		await druecke(page.locator('[data-einfuegen-plus]'));
		const fenster = page.locator('[data-schnellauswahl]');
		await fenster.getByRole('searchbox').fill('Schreiblinie');
		await druecke(fenster.locator('[data-katalog-eintrag="schreiblinie"]'));
		await gespeichert(page, datei);
		const neu = await readFile(datei, 'utf8');
		expect(neu.length).toBeGreaterThan(FREI.length);
		const zwischen = neu.slice(neu.indexOf('Dritte Spur'), neu.indexOf('<table id="plan"'));
		expect(zwischen).toContain('schreiblinie');
	});

	test('Fremde Tabelle: Einfache bekommt die Tabellen-Werkzeuge, verbundene nur den Zellentext', async ({
		druecke,
		page,
	}) => {
		const datei = await blatt(page);
		const zelle = material(page).locator('#zelle');
		await druecke(zelle);
		await expect(page.locator('[data-auswahl="tabellenzelle"]')).toBeVisible();
		const werkzeuge = page.getByRole('button', { name: 'Zeilen und Spalten' });
		const zeile = page.getByRole('button', { name: 'Zeile danach' });
		await expect(werkzeuge.or(zeile)).toBeVisible();
		if (await werkzeuge.isVisible()) {
			await werkzeuge.click();
		}
		await zeile.click();
		await gespeichert(page, datei);
		await expect(material(page).locator('#plan tr')).toHaveCount(3);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(FREI);

		await druecke(material(page).locator('#verbunden'));
		await expect(page.locator('[data-auswahl="freitext"]')).toBeVisible();
		await expect(page.locator('[data-tabelle-werkzeug]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Zeile danach' })).toHaveCount(0);
	});

	test('Abbildungen bleiben Abbildungen: ihr Inhalt ist nie freier Text', async ({ druecke, page }) => {
		await blatt(page);
		const uhr = material(page).locator('#uhr');
		await druecke(uhr);
		await expect(page.locator('[data-auswahl="abbildung"]')).toBeVisible();
		await expect(uhr).not.toHaveAttribute('contenteditable', 'true');
		expect(await uhr.evaluate((e) => e.querySelector('[contenteditable="true"]') === null)).toBe(true);
	});

	test('Mappen-Stylesheet und eigener Stil gelten auch im Editor', async ({ page }) => {
		await blatt(page);
		const stil = await material(page)
			.locator('#dritter')
			.evaluate((e) => {
				const { borderTopWidth, outlineWidth } = getComputedStyle(e);
				return { borderTopWidth, outlineWidth };
			});
		expect(stil).toEqual({ borderTopWidth: '2px', outlineWidth: '3px' });
	});
});
