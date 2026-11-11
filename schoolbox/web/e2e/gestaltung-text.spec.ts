import { readFile, writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { geladen, gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, SCHMUCK, SCHMUCK_BOGEN, SCHMUCK_ETIKETT, SCHMUCK_STEMPEL } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/**
 * 105, 175: Schmuckschrift unter „Text“ in der Schublade „Werkzeuge“ (⌥3) liegt frei, Werkzeug T, zweifarbige Titel.
 * Inhalt (Absatz, Tipp, Lernziel, Kopf) kommt aus „Bausteine“ und rastet ein.
 */

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const schmuck = (page: Page) => material(page).locator('div.schmuck[data-lage="frei"]');
const anzahl = (html: string) => html.split('<div class="schmuck"').length - 1;
const schublade = (page: Page) => page.locator('[data-schublade-werkzeuge]');
const kachel = (page: Page, name: string) =>
	schublade(page).locator(`[data-formen-abschnitt="text"] [data-ablage-gut="${name}"]`);
const palette = (page: Page) => page.locator('[data-befehlspalette]');

const oeffneText = async (page: Page, vorne: string[] = []) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit({ vorne }));
	await oeffne(page, u.id, u.dok);
	await oeffneSchublade(page, 'werkzeuge');
	await expect(schublade(page)).toBeVisible();
};

/** Ein Punkt auf der ersten Seite, Anteile ihrer sichtbaren Box. */
const aufSeite = async (page: Page, ax: number, ay: number) => {
	const seite = material(page).locator('.seite').first();
	await seite.evaluate((s) => s.scrollIntoView({ block: 'center' }));
	const r = await seite.boundingBox();
	const sicht = await page.locator('main').boundingBox();
	if (!r || !sicht) {
		throw new Error('Seite nicht zu sehen');
	}
	const oben = Math.max(r.y, sicht.y);
	const unten = Math.min(r.y + r.height, sicht.y + sicht.height);
	return { x: r.x + r.width * ax, y: oben + (unten - oben) * ay };
};

/** Markiert `wort` im ersten Textknoten der laufenden Sitzung. */
const markiere = (page: Page, wort: string) =>
	schmuck(page)
		.last()
		.evaluate((e, w) => {
			const t = [...e.childNodes].find((n): n is Text => n instanceof Text && n.data.includes(w));
			if (!t) {
				throw new Error(`${w} fehlt`);
			}
			const r = e.ownerDocument.createRange();
			const i = t.data.indexOf(w);
			r.setStart(t, i);
			r.setEnd(t, i + w.length);
			const s = e.ownerDocument.getSelection();
			s?.removeAllRanges();
			s?.addRange(r);
		}, wort);

const griff = async (page: Page, name: string) => {
	const r = await page.locator(`[data-gestaltung-griff="${name}"]`).boundingBox();
	if (!r) {
		throw new Error(`Griff ${name} fehlt`);
	}
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

const ziehe = async (page: Page, von: { x: number; y: number }, dx: number, dy: number) => {
	await page.mouse.move(von.x, von.y);
	await page.mouse.down();
	await page.mouse.move(von.x + dx, von.y + dy, { steps: 6 });
	await page.mouse.up();
};

test.describe('Text in der Schublade „Werkzeuge“ (105, 175)', () => {
	test('Werkzeuge: Abschnitt Text mit genau Titel, Stempel, Etikett', async ({ page }) => {
		await oeffneText(page);
		const abschnitte = schublade(page).locator('[data-formen-abschnitt]');
		await expect(abschnitte.nth(0)).toHaveAttribute('data-formen-abschnitt', 'werkzeuge');
		await expect(abschnitte.nth(1)).toHaveAttribute('data-formen-abschnitt', 'text');
		const text = schublade(page).locator('[data-formen-abschnitt="text"]');
		await expect(text.getByRole('heading', { level: 3 })).toHaveText(/Text$/);
		await expect(text.locator('[data-schmuck-kachel]')).toHaveCount(3);
		for (const art of ['titel', 'stempel', 'etikett']) {
			await expect(text.locator(`[data-schmuck-kachel="${art}"]`)).toHaveCount(1);
		}
		await expect(schublade(page).locator('[data-ablage-gut="Titel mit Kontur"]')).toHaveCount(0);
		await expect(schublade(page).locator('[data-ablage-gut="Titel im Bogen"]')).toHaveCount(0);
		await expect(schublade(page).locator('[data-einfuegen]')).toHaveCount(0);
		// Gegenprobe: Die Kacheln der Grundformen stehen in derselben Schublade, die Abfrage greift also.
		await expect(schublade(page).locator('[data-grundformen] [data-ablage-gut]').first()).toBeVisible();
	});

	test('keine Überschrift „Werkzeuge“ in der Schublade, nur der Kopf heißt so', async ({ page }) => {
		await oeffneText(page);
		await expect(schublade(page).locator('[data-schubladenkopf]')).toHaveText('Werkzeuge');
		await expect(schublade(page).locator('[data-formen-abschnitt="werkzeuge"] h3')).toHaveCount(0);
		await expect(schublade(page).getByRole('heading', { name: 'Werkzeuge', level: 3 })).toHaveCount(0);
		await expect(schublade(page).getByRole('toolbar', { name: 'Werkzeuge' })).toBeVisible();
	});

	test('⌘K „Stempel“ legt einen Stempel ab, Gruppe „Werkzeuge“; „Titel mit Kontur“ gibt es nicht', async ({
		page,
	}) => {
		await oeffneText(page);
		await page.keyboard.press('ControlOrMeta+k');
		await palette(page).getByRole('combobox').fill('Titel mit Kontur');
		await expect(palette(page).locator('[data-palette-zeile^="ablegen:Titel "]')).toHaveCount(0);
		await palette(page).getByRole('combobox').fill('Stempel');
		const zeile = palette(page).locator('[data-palette-gruppe="Werkzeuge"] [data-palette-zeile="ablegen:Stempel"]');
		await expect(zeile).toHaveCount(1);
		await zeile.click();
		await expect(page.locator('[data-textknoepfe]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect.poll(async () => anzahl(await quelle(page))).toBe(1);
		expect(await quelle(page)).toContain('data-schmuck="stempel"');
	});

	test('Titel per Klick: Sitzung offen und markiert, Tippen ersetzt, Esc ist mit dem Anlegen ein Schritt', async ({
		page,
	}) => {
		await oeffneText(page);
		const vorher = await quelle(page);
		await kachel(page, 'Titel').click();
		await expect(page.locator('[data-textknoepfe]')).toBeVisible();
		await page.keyboard.type('Die Formen-Detektive');
		await page.keyboard.press('Escape');
		await expect.poll(() => quelle(page)).toMatch(/data-schmuck="titel"[^>]*>Die Formen-Detektive<\/div>/);
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
		await expect(zurueck(page)).toBeDisabled();
	});

	test('leer gelassen verschwindet die Schmuckschrift, ohne Schritt', async ({ page }) => {
		await oeffneText(page);
		const vorher = await quelle(page);
		await kachel(page, 'Titel').click();
		await expect(page.locator('[data-textknoepfe]')).toBeVisible();
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Escape');
		await expect.poll(() => quelle(page)).toBe(vorher);
		await expect(zurueck(page)).toBeDisabled();
	});

	test('Stempel liegt gedreht, Etikett in Akzent, beide frei vorne', async ({ page }) => {
		await oeffneText(page);
		await kachel(page, 'Stempel').click();
		await page.keyboard.press('Escape');
		await expect
			.poll(() => quelle(page))
			.toMatch(/data-schmuck="stempel" style="[^"]*--drehen:-8deg;[^"]*--gr:\d+px/);
		await kachel(page, 'Etikett').click();
		await page.keyboard.press('Escape');
		await expect.poll(async () => anzahl(await quelle(page))).toBe(2);
		await expect(material(page).locator('.ebene.vorne div.schmuck')).toHaveCount(2);
	});

	test('zweifarbiger Titel: ein Wort in Akzent', async ({ page }) => {
		await oeffneText(page);
		await kachel(page, 'Titel').click();
		await expect(page.locator('[data-textknoepfe]')).toBeVisible();
		await page.keyboard.type('Die Formen-Detektive');
		await expect(schmuck(page).last()).toHaveText('Die Formen-Detektive');
		await markiere(page, 'Formen');
		await page.locator('[data-wortfarbe-knopf]').click();
		await page.locator('[data-wortfarbe-knoepfe] [data-farbe="var(--akzent)"]').click();
		await page.keyboard.press('Escape');
		await expect
			.poll(() => quelle(page))
			.toContain('Die <span style="color:var(--akzent)">Formen</span>-Detektive</div>');
	});

	test('im Absatz gibt es keinen Farbknopf', async ({ page }) => {
		await oeffneText(page);
		await material(page).locator('.aufgabe').first().click();
		await oeffneSchublade(page, 'bausteine');
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).first().fill('Absatz');
		await page.locator('[data-bibliothek-eintrag="text"] [data-einfuegen]').click();
		const p = material(page).locator('p', { hasText: 'Hier steht ein kurzer Text' });
		await p.click();
		await p.click();
		await expect(page.locator('[data-textknoepfe]')).toBeVisible();
		await expect(page.locator('[data-wortfarbe-knopf]')).toHaveCount(0);
	});
});

test.describe('Werkzeug T (105)', () => {
	test('T + Klick: „Text“ markiert, Esc ein Schritt', async ({ page }) => {
		await oeffneText(page);
		await page.keyboard.press('KeyT');
		const p = await aufSeite(page, 0.5, 0.5);
		await page.mouse.click(p.x, p.y);
		await expect(page.locator('[data-textknoepfe]')).toBeVisible();
		await page.keyboard.type('Hallo');
		await page.keyboard.press('Escape');
		await expect.poll(() => quelle(page)).toMatch(/data-schmuck="titel"[^>]*>Hallo<\/div>/);
		await zurueck(page).click();
		await expect.poll(async () => anzahl(await quelle(page))).toBe(0);
	});

	test('T aufgezogen setzt die Breite', async ({ page }) => {
		await oeffneText(page);
		await page.keyboard.press('KeyT');
		const p = await aufSeite(page, 0.3, 0.5);
		await ziehe(page, p, 200, 0);
		await page.keyboard.press('Escape');
		await expect.poll(() => quelle(page)).toMatch(/data-schmuck="titel"[^>]*--b:\d+px/);
	});
});

test.describe('Schmuckschrift gestalten (105)', () => {
	test('Ecke skaliert --gr, Kante nur --b', async ({ page }) => {
		await oeffneText(page, [SCHMUCK]);
		await schmuck(page).first().click();
		await expect(page.locator('[data-gestaltung-rahmen]')).toBeVisible();
		const vorher = await quelle(page);
		const gr = Number(/--gr:(\d+)px/.exec(vorher)?.[1]);
		// Verkleinern: Größer gezogen läge der Kantengriff danach unter dem Inspektor.
		// Am Finger überlappen bei flacher Schrift die 44-px-Flächen von Ecke und Kante; die Kante liegt oben. Die Ecke
		// trifft dann nur ihr äußerer Teil (offene-punkte).
		const ecke = await griff(page, 'unten-rechts');
		const aussen = test.info().project.use.hasTouch ? 16 : 0;
		await ziehe(page, { x: ecke.x + aussen, y: ecke.y + aussen }, -40, -20);
		await expect.poll(async () => Number(/--gr:(\d+)px/.exec(await quelle(page))?.[1])).toBeLessThan(gr);
		const nachEcke = await quelle(page);
		await geladen(page);
		await ziehe(page, await griff(page, 'rechts'), -40, 0);
		await expect.poll(() => quelle(page)).not.toBe(nachEcke);
		expect(/--gr:(\d+)px/.exec(await quelle(page))?.[1]).toBe(/--gr:(\d+)px/.exec(nachEcke)?.[1]);
	});

	test('Inspektor: nur Fredoka und Andika, Farbe und Ausrichtung je ein Schritt', async ({ page }) => {
		await oeffneText(page, [SCHMUCK]);
		await schmuck(page).first().click();
		await expect(page.locator('[data-schmuck-schrift] button')).toHaveText(['Fredoka', 'Andika']);
		await page.locator('[data-schmuck-schrift] button', { hasText: 'Andika' }).click();
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Schrift geändert');
		await page.locator('[data-farbwahl="schmuck-farbe"] [data-farbe="var(--akzent)"]').click();
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Schriftfarbe geändert');
		await page.locator('[data-schmuck-ausrichtung] button', { hasText: 'Mitte' }).click();
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Ausrichtung geändert');
		const q = await quelle(page);
		expect(q).toContain('--schrift:Andika');
		expect(q).toContain('--farbe:var(--akzent)');
		expect(q).toContain('--ausrichtung:center');
	});

	test('Hintergrund nur beim Etikett', async ({ page }) => {
		await oeffneText(page, [SCHMUCK, SCHMUCK_ETIKETT]);
		await schmuck(page).first().click();
		await expect(page.locator('[data-farbwahl="schmuck-hintergrund"]')).toHaveCount(0);
		await material(page).locator('div.schmuck[data-schmuck="etikett"]').click();
		await expect(page.locator('[data-farbwahl="schmuck-hintergrund"]')).toBeVisible();
	});
});

test.describe('Bestand mit Schmuckschrift (175)', () => {
	test('Titel mit Kontur, Stempel, Etikett und Bogen bleiben in der Datei gleich und bearbeitbar', async ({
		page,
	}) => {
		const u = await uhrzeit();
		const vorher = blattMit({ vorne: [SCHMUCK, SCHMUCK_STEMPEL, SCHMUCK_ETIKETT, SCHMUCK_BOGEN] });
		await writeFile(u.material, vorher);
		await oeffne(page, u.id, u.dok);
		await expect(material(page).locator('.schmuck[data-lage="frei"]')).toHaveCount(4);
		expect(await quelle(page)).toBe(vorher);
		expect(await readFile(u.material, 'utf8')).toBe(vorher);

		const titel = material(page).locator('div.schmuck[data-schmuck="titel"]');
		await titel.click();
		await expect(page.locator('[data-leiste-kontur]')).toBeVisible();
		await expect(page.locator('[data-leiste-bogen]')).toBeVisible();
		await titel.dblclick();
		await expect(page.locator('[data-textknoepfe]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-textknoepfe]')).toHaveCount(0);
		expect(await quelle(page)).toBe(vorher);

		// Gegenprobe: „Bogen aus“ macht aus dem Bogen einen geraden Titel; eine Änderung sähe der Test also.
		await material(page).locator('svg.schmuck[data-schmuck="bogen"]').click();
		await page.locator('[data-leiste-bogen]').click();
		await page.getByRole('dialog').locator('[data-bogen-schalter]').click();
		await expect.poll(() => quelle(page)).not.toContain('data-schmuck="bogen"');
		await gespeichert(page, u.material);
		expect(await readFile(u.material, 'utf8')).not.toBe(vorher);
	});
});
