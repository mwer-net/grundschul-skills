import { writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, SCHMUCK, SCHMUCK_ETIKETT } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/** 105: Schublade Text (⌥5), Inhalt rastet ein, Schmuckschrift liegt frei, Werkzeug T, zweifarbige Titel. */

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const schmuck = (page: Page) => material(page).locator('div.schmuck[data-lage="frei"]');
const anzahl = (html: string) => html.split('<div class="schmuck"').length - 1;
const kachel = (page: Page, name: string) => page.locator(`[data-schmuck-kacheln] [data-ablage-gut="${name}"]`);

const oeffneText = async (page: Page, vorne: string[] = []) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit({ vorne }));
	await oeffne(page, u.id, u.dok);
	await oeffneSchublade(page, 'text');
	await expect(page.locator('[data-schublade-text]')).toBeVisible();
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

test.describe('Schublade Text (105)', () => {
	test('zwei Abschnitte, Inhalt zuerst; Inhalt rastet ein, nicht in einer Ebene', async ({ page }) => {
		await oeffneText(page);
		await expect(page.locator('[data-text-abschnitt]')).toHaveCount(2);
		await expect(page.locator('[data-text-abschnitt]').first()).toHaveAttribute('data-text-abschnitt', 'inhalt');
		await expect(page.locator('[data-text-abschnitt="inhalt"] [data-text-hinweis]')).toHaveText('rastet ein');
		await expect(page.locator('[data-text-abschnitt="schmuck"] [data-text-hinweis]')).toHaveText('liegt frei');
		await material(page).locator('.aufgabe').first().click();
		await page.locator('[data-text-abschnitt="inhalt"] [data-einfuegen="text"]').click();
		await expect.poll(() => quelle(page)).toContain('Hier steht ein kurzer Text.');
		await expect(material(page).locator('.ebene p')).toHaveCount(0);
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
		await page.locator('[data-einfuegen="text"]').click();
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
