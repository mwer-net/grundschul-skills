import { readFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

interface Punkt {
	x: number;
	y: number;
}

const rechteck = (ziel: Locator) =>
	ziel.evaluate((e) => {
		const r = e.getBoundingClientRect();
		return { x: r.left, y: r.top, breite: r.width, hoehe: r.height };
	});

/**
 * Mit dem Finger: halten, dann ziehen. Playwright kennt für Touch nur `tap`; die Pointer-Ereignisse entstehen deshalb
 * im Dokument selbst, so wie Safari sie schickt (Koordinaten dieses Dokuments).
 */
const finger = (ziel: Locator, punkte: Punkt[], halten: number, ende: 'pointerup' | 'pointercancel' = 'pointerup') =>
	ziel.evaluate(
		async (element, { ende: art, halten: ms, punkte: weg }) => {
			const doc = element.ownerDocument;
			const warte = (n: number) => new Promise((fertig) => setTimeout(fertig, n));
			const sende = (typ: string, { x, y }: { x: number; y: number }) => {
				const unter = doc.elementFromPoint(x, y) ?? doc.body;
				const optionen = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y };
				unter.dispatchEvent(
					new PointerEvent(typ, { ...optionen, pointerId: 7, pointerType: 'touch', isPrimary: true }),
				);
			};
			const [start, ...rest] = weg;
			if (!start) {
				return;
			}
			sende('pointerdown', start);
			await warte(ms);
			for (const p of rest) {
				sende('pointermove', p);
				await warte(20);
			}
			sende(art, rest.at(-1) ?? start);
		},
		{ ende, halten, punkte },
	);

const zwischen = (von: Punkt, nach: Punkt, schritte = 8) =>
	Array.from({ length: schritte + 1 }, (_, i) => ({
		x: von.x + ((nach.x - von.x) * i) / schritte,
		y: von.y + ((nach.y - von.y) * i) / schritte,
	}));

/** Zieht `von` an den Anfang bzw. das Ende von `nach`: mit der Maus über Playwright, mit dem Finger wie oben. */
const ziehe = async (page: Page, hasTouch: boolean, von: Locator, nach: Locator, wo: 'oben' | 'unten') => {
	if (hasTouch) {
		const a = await rechteck(von);
		const b = await rechteck(nach);
		const start = { x: a.x + a.breite / 2, y: a.y + a.hoehe / 2 };
		const ziel = { x: b.x + b.breite / 2, y: wo === 'oben' ? b.y + 6 : b.y + b.hoehe - 6 };
		await finger(von, zwischen(start, ziel), 450);
		return;
	}
	const a = await von.boundingBox();
	const b = await nach.boundingBox();
	if (!a || !b) {
		throw new Error('Nicht sichtbar');
	}
	await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
	await page.mouse.down();
	for (const p of zwischen(
		{ x: a.x + a.width / 2, y: a.y + a.height / 2 },
		{ x: b.x + b.width / 2, y: wo === 'oben' ? b.y + 6 : b.y + b.height - 6 },
	)) {
		await page.mouse.move(p.x, p.y);
	}
	await page.mouse.up();
};

const anweisungen = (html: string) => [...html.matchAll(/<span class="text">([^<]{0,12})/g)].map((m) => m[1]);
const nummern = (html: string) => [...html.matchAll(/<span class="nr( stern)?">([^<]*)</g)].map((m) => m[2]);
const ANFANG = ['Lies ab. Sch', 'Zeichne die ', 'Willi sagt: ', 'Sternchenauf'];

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const hinweis = (page: Page) => page.locator('div[role="status"][aria-live]');

test.describe('Editor: Struktur', () => {
	test('zieht eine Aufgabe nach vorn, zählt neu und macht es mit einem Schritt rückgängig', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		expect(anweisungen(vorher)).toEqual(ANFANG);
		await oeffne(page, id, dok);
		await druecke(page.getByRole('button', { name: 'Kleiner' }));
		const aufgaben = material(page).locator('.aufgabe');

		await ziehe(page, hasTouch, aufgaben.nth(2).locator('.anw .text'), aufgaben.nth(0), 'oben');
		await gespeichert(page, datei);
		const nachher = await readFile(datei, 'utf8');
		expect(anweisungen(nachher)).toEqual(['Willi sagt: ', 'Lies ab. Sch', 'Zeichne die ', 'Sternchenauf']);
		expect(nummern(nachher)).toEqual(['1', '2', '3', '★']);
		await expect(page.locator('[data-auswahl="aufgabe"] h2')).toHaveText('Aufgabe 1');
		await expect(material(page).locator('.aufgabe').first()).toContainText('Willi sagt');
		await expect(page.locator('[data-einfuegemarke], [data-zug]')).toHaveCount(0);

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});

	test('rollt beim Wischen mit dem Finger weiter und zieht dabei nichts', async ({ druecke, hasTouch, page }) => {
		test.skip(!hasTouch, 'nur mit Finger');
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const text = material(page).locator('.aufgabe').nth(1).locator('.anw .text');
		const r = await rechteck(text);
		const start = { x: r.x + r.breite / 2, y: r.y + r.hoehe / 2 };
		// So beginnt Safari ein Rollen: Der Finger bewegt sich sofort, dann übernimmt der Browser (pointercancel).
		await finger(text, zwischen(start, { x: start.x, y: start.y - 120 }, 4), 30, 'pointercancel');
		await page.waitForTimeout(500);
		await expect(page.locator('[data-zug]')).toHaveCount(0);
		expect(await quelle(page)).toBe(vorher);
		expect(await text.evaluate((e) => getComputedStyle(e.ownerDocument.body).touchAction)).toBe('auto');

		// Halten ohne Ziehen bleibt Antippen, wenn es kürzer als das Halten zum Ziehen ist.
		await druecke(text);
		await expect(page.locator('[data-auswahl="anweisung"]')).toBeVisible();
		expect(await quelle(page)).toBe(vorher);
	});

	test('kopiert ein Item mit seiner Lösung und löscht es mit Hinweis „Rückgängig“', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.reihe').first().locator('x-uhr').nth(1));
		await druecke(page.locator('[data-breadcrumb]').getByRole('button', { name: 'Item 2' }));
		await druecke(page.getByRole('button', { name: 'Duplizieren' }));
		await expect(page.locator('[data-auswahl="item"] h2')).toHaveText('Item 3');
		await gespeichert(page, datei);
		const kopiert = await readFile(datei, 'utf8');
		expect(kopiert.split('data-l="halb 5"').length - 1).toBe(2);
		expect(kopiert.split('\n').length).toBe(vorher.split('\n').length + 1);

		await druecke(page.getByRole('button', { name: 'Löschen' }));
		await expect(hinweis(page)).toContainText('Item 3 gelöscht.');
		await expect(page.getByText('Tippe auf einen Teil des Blatts')).toBeVisible();
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
		await druecke(hinweis(page).getByRole('button', { name: 'Rückgängig' }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(kopiert);
	});

	test('ändert Spalten von 1 bis 6 und den Abstand nie unter 24 px', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.reihe').first().locator('x-uhr').first());
		const spalten = page.locator('[data-spalten]');
		await expect(spalten).toHaveAttribute('data-spalten', '4');
		await expect(page.getByText('Spalten (Reihe)')).toBeVisible();
		const mehr = page.getByRole('button', { name: 'Eine Spalte mehr' });
		await druecke(mehr);
		await expect(spalten).toHaveAttribute('data-spalten', '5');
		await druecke(mehr);
		await expect(spalten).toHaveAttribute('data-spalten', '6');
		await expect(mehr).toBeDisabled();
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<div class="reihe" style="--spalten:6">');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<div class="reihe" style="--spalten:5">');
		await druecke(zurueck(page));

		await page.keyboard.press('Escape');
		const regler = page.getByRole('slider', { name: 'Abstand zwischen Aufgaben' });
		await expect(regler).toHaveValue('28');
		await expect(regler).toHaveAttribute('min', '24');
		await regler.fill('36');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<body style="--abstand:36px" class="kl2');
		await regler.press('Home');
		await expect(regler).toHaveValue('24');
		await regler.press('ArrowLeft');
		await expect(regler).toHaveValue('24');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<body style="--abstand:24px" class="kl2');
		const abstand = await material(page)
			.locator('body')
			.evaluate((b) => getComputedStyle(b).getPropertyValue('--abstand').trim());
		expect(abstand).toBe('24px');

		await druecke(zurueck(page));
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});

	test('legt eine Seite mit Namenszeile an, zieht eine Aufgabe hinüber und ordnet die Seiten', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const leiste = page.locator('[data-seitenleiste]');
		await expect(leiste.locator('[data-seite-miniatur]')).toHaveCount(1);
		await expect(leiste.getByLabel('mit Namenszeile')).toBeChecked();
		await druecke(leiste.getByRole('button', { name: 'Seite hinzufügen' }));
		await expect(leiste.locator('[data-seite-miniatur]')).toHaveCount(2);
		await expect(page.locator('[data-auswahl="seite"] h2')).toHaveText('Seite 2');
		await expect(leiste.getByRole('button', { name: 'Seite 2' })).toHaveAttribute('aria-current', 'true');
		await gespeichert(page, datei);
		const zweiSeiten = await readFile(datei, 'utf8');
		expect(zweiSeiten).toMatch(
			/<section class="seite">\n {2}<div class="namenszeile">.*<\/div>\n {2}<span class="loesung-marke">Lösung<\/span>\n<\/section>\n<\/body>/,
		);

		// Beide Seiten auf den Bildschirm, dann Aufgabe 2 auf die leere Seite.
		await druecke(page.getByRole('button', { name: 'Kleiner' }));
		await druecke(page.getByRole('button', { name: 'Kleiner' }));
		const zweite = material(page).locator('.seite').nth(1);
		await ziehe(page, hasTouch, material(page).locator('.aufgabe').nth(1).locator('.anw .text'), zweite, 'oben');
		await gespeichert(page, datei);
		const verschoben = await readFile(datei, 'utf8');
		expect(nummern(verschoben)).toEqual(['1', '2', '★', '3']);
		await expect(hinweis(page)).toContainText('Sternchenaufgabe steht jetzt nicht mehr am Ende');
		await expect(zweite.locator('.aufgabe')).toContainText('Zeichne die Zeiger ein.');

		// In der Seitenleiste Seite 2 vor Seite 1 ziehen: Die verschobene Aufgabe ist danach Aufgabe 1.
		const miniaturen = leiste.locator('[data-seite-miniatur]');
		await ziehe(page, hasTouch, miniaturen.nth(1), miniaturen.nth(0), 'oben');
		await gespeichert(page, datei);
		const geordnet = await readFile(datei, 'utf8');
		expect(nummern(geordnet)).toEqual(['1', '2', '3', '★']);
		expect(anweisungen(geordnet)[0]).toBe('Zeichne die ');
		expect(geordnet.indexOf('<span class="nr">1</span>')).toBeLessThan(geordnet.indexOf('<h1>Wie spät ist es?'));
		await expect(page.locator('[data-auswahl="seite"] h2')).toHaveText('Seite 1');

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(verschoben);
	});

	test('verschiebt per Knopf, auch über die Seitengrenze, und warnt bei der Sternchenaufgabe', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.nr.stern'));
		await expect(page.getByRole('button', { name: 'Nach unten' })).toBeDisabled();
		await druecke(page.getByRole('button', { name: 'Nach oben' }));
		await expect(hinweis(page)).toContainText('Sternchenaufgabe steht jetzt nicht mehr am Ende');
		await expect(page.locator('[data-auswahl="aufgabe"] h2')).toHaveText('Sternchenaufgabe');
		await gespeichert(page, datei);
		expect(nummern(await readFile(datei, 'utf8'))).toEqual(['1', '2', '★', '3']);
		await druecke(page.getByRole('button', { name: 'Nach unten' }));
		await gespeichert(page, datei);
		expect(nummern(await readFile(datei, 'utf8'))).toEqual(['1', '2', '3', '★']);

		await druecke(material(page).locator('.nr').first());
		await expect(page.getByRole('button', { name: 'Nach oben' })).toBeDisabled();
		await druecke(material(page).locator('x-uhr').first());
		await druecke(page.locator('[data-breadcrumb]').getByRole('button', { name: 'Item 1' }));
		await expect(page.getByRole('button', { name: 'Nach links' })).toBeDisabled();
		await druecke(page.getByRole('button', { name: 'Nach rechts' }));
		await expect(page.locator('[data-auswahl="item"] h2')).toHaveText('Item 2');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toMatch(/zeit="4:30".*\n.*zelle beispiel.*zeit="3:00"/);
	});
});
