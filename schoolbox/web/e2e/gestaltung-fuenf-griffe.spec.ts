/**
 * Abnahme E3, Z6 (123): „Ein Blatt in fünf Griffen“ nach 05-bedienung.md 5.14, nur mit Klicks, Ziehen, ⌥1–⌥7 und
 * Tippen. Jeder Griff ist ein Schritt (der Name am Knopf „Rückgängig“ wechselt mit jedem). Danach: Nummern lückenlos,
 * Lösung vollständig, s/w ohne Fläche, Kopfband und Punkte mit dunklem Titel, Prüfung ohne FEHLER und WARNUNG.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';

const MAUS = ['chromium', 'mac-safari'];

/** Das Blatt der Formen-Detektive mit nur einer Aufgabe: Platz für die fünf Griffe auf einer Seite. */
const START = blattMit().replace(
	/ {2}<div class="aufgabe">\n {4}<span class="nr">2<\/span>[\s\S]*?<\/div>\n {2}<\/div>\n {2}<div class="aufgabe">\n {4}<span class="nr">3<\/span>[\s\S]*?<\/div>\n {2}<\/div>\n/,
	'',
);

const zurueck = (page: Page) => page.getByRole('button', { name: /^Rückgängig/ }).first();
const schritt = (page: Page, name: string) => expect(zurueck(page)).toHaveAttribute('data-schritt', name);
const nummern = (html: string) => [...html.matchAll(/<span class="nr( stern)?">([^<]*)</g)].map((m) => m[2]);
const aufgabe = (page: Page, i: number) => material(page).locator('.aufgabe:not([data-luecke])').nth(i);
const stern = (page: Page) => material(page).locator('.aufgabe:has(> .nr.stern)');
const wilma = (page: Page) => material(page).locator('img.figur-frei');
const blase = (page: Page) => material(page).locator('.form-text[data-form="sprechblase"]');

const kasten = async (ziel: Locator) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return b;
};
const mitte = async (ziel: Locator) => {
	const b = await kasten(ziel);
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const ziehe = async (page: Page, von: { x: number; y: number }, nach: { x: number; y: number }) => {
	await page.mouse.move(von.x, von.y);
	await page.mouse.down();
	await page.mouse.move(von.x + 8, von.y + 8, { steps: 2 });
	await page.mouse.move(nach.x, nach.y, { steps: 10 });
	await page.mouse.up();
};

/** Karte aus „Bausteine“ unter das Ziel ziehen; die Lücke verschiebt das Blatt, darum zweimal hinfahren. */
const ziehBaustein = async (page: Page, id: string, suchwort: string, ziel: Locator) => {
	await page.getByRole('searchbox', { name: 'Baustein suchen' }).first().fill(suchwort);
	const k = await kasten(page.locator(`[data-bibliothek-eintrag="${id}"] [data-einfuegen]`));
	await page.mouse.move(k.x + 20, k.y + k.height / 2);
	await page.mouse.down();
	await page.mouse.move(k.x + 40, k.y + k.height / 2 + 12, { steps: 3 });
	await expect(page.locator('[data-zug-anzeige]')).toBeVisible();
	await ziel.evaluate((e) => e.scrollIntoView({ block: 'center' }));
	for (let i = 0; i < 2; i++) {
		const r = await kasten(ziel);
		await page.mouse.move(r.x + r.width / 2, r.y + r.height * 0.85, { steps: 8 });
	}
	await page.mouse.up();
};

/** ⚓ des gewählten Elements auf die Sternchenaufgabe ziehen. */
const ankerAufStern = async (page: Page) => {
	const g = await mitte(page.locator('[data-gestaltung-griff="anker"]'));
	const z = await kasten(stern(page));
	await page.mouse.move(g.x, g.y);
	await page.mouse.down();
	await page.mouse.move(z.x + 80, z.y + z.height / 2, { steps: 8 });
	await expect(page.locator('[data-wert-am-zeiger]')).toHaveText('hängt an Sternchenaufgabe');
	await page.mouse.up();
	await schritt(page, 'An Sternchenaufgabe gehängt');
};

const sperre = async (page: Page, name: RegExp) => {
	const zeile = page.locator('[data-zeilen-art="anker"]').filter({ hasText: name });
	await zeile.hover();
	await zeile.locator('[data-ebenen-zeichen="schloss"]').click();
	await schritt(page, 'Gesperrt');
};

test.describe('Abnahme E3: Ein Blatt in fünf Griffen (123, Z6)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 860 });
	});

	test('Rezept, Bausteine, Wilma am Anker, Sprechblase, Sperren: Nummern, Lösung, s/w und Prüfung stimmen', async ({
		page,
	}) => {
		const u = await uhrzeit();
		await writeFile(u.material, START);
		await oeffne(page, u.id, u.dok);

		// 1. ⌥7 Rezepte: Dschungel, Würfeln.
		await page.keyboard.press('Alt+Digit7');
		await page.locator('[data-rezept-kachel="dschungel"]').click();
		await schritt(page, 'Rezept Dschungel');
		await page.locator('[data-schublade-rezepte] [data-rezept-wuerfeln]').click();
		await schritt(page, 'Rezept gewürfelt');

		// 2. ⌥2 Bausteine: Figur (Dreiecke zählen) und eine Aufgabe, die eine Sternchenaufgabe wird.
		await page.keyboard.press('Alt+Digit2');
		await ziehBaustein(page, 'x-figur', 'Dreieck', aufgabe(page, 0));
		await schritt(page, 'Figur eingefügt');
		await ziehBaustein(page, 'aufgabe', 'Aufgabe', aufgabe(page, 1));
		await schritt(page, 'Aufgabe eingefügt');
		await page.getByRole('switch', { name: 'Sternchenaufgabe' }).click();
		await schritt(page, 'Sternchenaufgabe geändert');
		expect(nummern(await quelle(page))).toEqual(['1', '2', '★']);

		// 3. ⌥4 Figuren: Wilma unter die Sternchenaufgabe, ⚓ auf die Aufgabe; eine Aufgabe davor, Wilma geht mit.
		await page.keyboard.press('Alt+Digit4');
		await stern(page).evaluate((e) => e.scrollIntoView({ block: 'center' }));
		const s = await kasten(stern(page));
		await ziehe(page, await mitte(page.locator('[data-schublade-figuren] [data-ablage-gut="Wilma"]')), {
			x: s.x + s.width - 90,
			y: s.y + s.height + 70,
		});
		await schritt(page, 'Wilma abgelegt');
		await ankerAufStern(page);
		expect(/<img class="figur-frei"[^>]*data-anker/.test(await quelle(page))).toBe(true);
		const sternVorher = await kasten(stern(page));
		const wilmaVorher = await kasten(wilma(page));
		await page.keyboard.press('Alt+Digit2');
		await ziehBaustein(page, 'aufgabe', 'Aufgabe', aufgabe(page, 0));
		await schritt(page, 'Aufgabe eingefügt');
		const sternNachher = await kasten(stern(page));
		const wilmaNachher = await kasten(wilma(page));
		expect(sternNachher.y - sternVorher.y).toBeGreaterThan(100);
		expect(Math.abs(wilmaNachher.y - wilmaVorher.y - (sternNachher.y - sternVorher.y))).toBeLessThanOrEqual(1);

		// 4. ⌥3 Formen: Sprechblase, „Zähl genau!“, neben Wilma, an dieselbe Aufgabe, Zipfel zu Wilma.
		await page.keyboard.press('Alt+Digit3');
		await page.locator('[data-blase-kachel="sprechblase-rund"]').click();
		await expect(material(page).locator('.form-text[contenteditable="true"]')).toBeFocused();
		await page.keyboard.type('Zähl genau!');
		// Esc beendet das Tippen, wie überall im Editor.
		await page.keyboard.press('Escape');
		await schritt(page, 'Sprechblase abgelegt');
		await expect.poll(() => quelle(page)).toMatch(/<div class="form-inhalt">Zähl genau!<\/div>/);
		await blase(page).click();
		const b = await kasten(blase(page));
		const w = await kasten(wilma(page));
		await ziehe(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, { x: w.x - b.width / 2 - 30, y: w.y + 10 });
		await schritt(page, 'Verschoben');
		await ankerAufStern(page);
		await wilma(page).evaluate((e) => e.scrollIntoView({ block: 'center' }));
		await ziehe(page, await mitte(page.locator('[data-gestaltung-griff="zipfel"]')), await mitte(wilma(page)));
		await schritt(page, 'Zipfel gezogen');

		// 5. ⌥1 Ebenen: Wilma und Sprechblase sperren; die Teile des Rezepts sind schon gesperrt.
		await page.keyboard.press('Alt+Digit1');
		await sperre(page, /^Sprech/);
		await sperre(page, /^Wilma/);

		const q = await quelle(page);
		expect(nummern(q)).toEqual(['1', '2', '3', '★']);
		expect(/<img class="figur-frei"[^>]*data-gesperrt/.test(q)).toBe(true);
		expect(/<div class="form-text"[^>]*data-gesperrt/.test(q)).toBe(true);
		expect(q).toContain('data-l="7"');
		await expect(page.getByText('Alles passt')).toBeVisible();

		// Lösung vollständig.
		await page.getByRole('button', { name: 'Lösung', exact: true }).click();
		await expect
			.poll(() =>
				material(page)
					.locator('.antwort')
					.first()
					.evaluate((e) => getComputedStyle(e, '::after').content),
			)
			.toBe('"7"');
		await page.getByRole('button', { name: 'Arbeitsblatt', exact: true }).click();

		// s/w: Fläche, Kopfband und Punkte weg, der Titel dunkel.
		await page.locator('[data-profilschalter]').getByRole('button', { name: 's/w', exact: true }).click();
		await expect
			.poll(() =>
				material(page)
					.locator('body')
					.evaluate((body) => {
						const sichtbar = (e: Element) => getComputedStyle(e).display !== 'none';
						const teile = [...body.querySelectorAll('[data-aufmachung-teil]')].filter(sichtbar);
						const kopf = body.querySelector('.kopf');
						const h1 = body.querySelector('h1');
						return {
							teile: teile.map((e) => e.getAttribute('data-aufmachung-teil')),
							band: kopf ? getComputedStyle(kopf, '::before').display : 'none',
							titel: h1 ? getComputedStyle(h1).color : '',
						};
					}),
			)
			.toEqual({ teile: ['rahmen'], band: 'none', titel: 'rgb(29, 29, 29)' });
		await expect(page.getByText('Alles passt')).toBeVisible();
	});
});
