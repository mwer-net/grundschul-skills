import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/**
 * 111: Rahmen-Stile am freien Bild, Bildrahmen in „Werkzeuge“, ein Bild auf eine Form ohne Text, Ausschnitt
 * verschieben. Jede Änderung ist ein Schritt. 172: Der leere Rahmen wird gefüllt wie ein Platzhalter.
 */

const WACHSTUM = '_assets/bilder/wachstum.png';
/** Dieselbe Datei als Foto zum Hochladen. */
const WACHSTUM_DATEI = path.join(__dirname, '../../../skills/html-materialerstellung/assets/bilder/wachstum.png');
const BILD =
	'<img class="bild-frei" data-lage="frei" src="bilder/wachstum.png" alt="Wachstum" style="--x:300px;--y:420px;--b:240px">';
const STERN_RAHMEN =
	'<div class="bildrahmen platzhalter" data-lage="frei" data-maske="stern" data-zacken="5" data-innen="0.45" style="--x:300px;--y:420px;--b:240px;--h:240px;clip-path:polygon(50% 0%, 61.75% 34.43%, 97.55% 34.55%, 69.02% 55.9%, 79.39% 90.45%, 50% 69.1%, 20.61% 90.45%, 30.98% 55.9%, 2.45% 34.55%, 38.25% 34.43%)"></div>';
const KREIS =
	'<svg class="form" data-lage="frei" data-form="ellipse" viewBox="0 0 200 200" style="--x:300px;--y:420px;--b:200px;--h:200px"><path d="M100 1.5 C154.4 1.5 198.5 45.6 198.5 100 C198.5 154.4 154.4 198.5 100 198.5 C45.6 198.5 1.5 154.4 1.5 100 C1.5 45.6 45.6 1.5 100 1.5 Z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px;stroke-linejoin:round"/></svg>';

const bilder = (page: Page) => page.locator('[data-schublade-bilder]');
const kachel = (page: Page, schluessel: string) => bilder(page).locator(`[data-sammlung-bild="${schluessel}"]`);
const anzeige = (page: Page) => page.locator('[data-zug-anzeige]');
const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const abschnitt = (page: Page) => page.locator('[data-abschnitt="bild"] [data-gestaltung-rahmenstil]');

const oeffneMit = async (page: Page, html: string) => {
	await page.setViewportSize({ width: 1512, height: 860 });
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, html);
	await expect(material(page).locator('.seite').first()).toBeVisible();
};

const waehle = async (page: Page, element: Locator, art: string) => {
	await element.evaluate((e) => e.scrollIntoView({ block: 'center' }));
	await element.click();
	await expect(page.locator(`[data-gestaltung-inspektor="${art}"]`)).toBeVisible();
};

const mitteVon = async (element: Locator) => {
	await element.evaluate((e) => e.scrollIntoView({ block: 'center' }));
	const r = await element.boundingBox();
	if (!r) {
		throw new Error('nicht zu sehen');
	}
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

/**
 * Zieht ein Bild aus der Sammlung bis in die Mitte von `ziel` und lässt los; vorher steht `text` am Zeiger. Das Ziel
 * wird erst gemessen, wenn die Schublade offen ist: Am Mac rückt das Blatt dann zur Seite (183).
 */
const zieheBild = async (page: Page, ziel: Locator, text: string) => {
	await oeffneSchublade(page, 'bilder');
	await bilder(page).getByRole('button', { name: 'Sammlung', exact: true }).click();
	await expect(kachel(page, WACHSTUM)).toBeVisible();
	await expect
		.poll(() =>
			kachel(page, WACHSTUM)
				.locator('img')
				.evaluate((i: HTMLImageElement) => i.naturalWidth),
		)
		.toBeGreaterThan(0);
	const m = await mitteVon(ziel);
	const r = await kachel(page, WACHSTUM).boundingBox();
	if (!r) {
		throw new Error('Kachel nicht zu sehen');
	}
	await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
	await page.mouse.down();
	await page.mouse.move(r.x + r.width / 2 + 20, r.y + r.height / 2 + 10, { steps: 3 });
	await expect(anzeige(page)).toBeVisible();
	await page.mouse.move(m.x, m.y, { steps: 10 });
	await expect(anzeige(page)).toHaveText(text);
	await page.mouse.up();
};

/** Farben (RGBA) an Anteilen der Box des Elements, aus einem Bildschirmfoto. */
const pixel = async (page: Page, element: Locator, punkte: [number, number][]) => {
	const bild = await element.screenshot();
	return page.evaluate(
		async ({ daten, liste }) => {
			const img = new Image();
			img.src = `data:image/png;base64,${daten}`;
			await img.decode();
			const c = document.createElement('canvas');
			c.width = img.width;
			c.height = img.height;
			const g = c.getContext('2d');
			g?.drawImage(img, 0, 0);
			return liste.map(([ax, ay]) => [
				...(g?.getImageData(Math.round((img.width - 1) * ax), Math.round((img.height - 1) * ay), 1, 1).data ??
					[]),
			]);
		},
		{ daten: bild.toString('base64'), liste: punkte },
	);
};

/** Ersetzt nur in der Darstellung das Bild durch eine einfarbige Fläche (für Pixel-Stichproben). */
const einfarbig = (bild: Locator, farbe: string) =>
	bild.evaluate(async (e: HTMLImageElement, f) => {
		const c = e.ownerDocument.createElement('canvas');
		c.width = 40;
		c.height = 40;
		const g = c.getContext('2d');
		if (g) {
			g.fillStyle = f;
			g.fillRect(0, 0, 40, 40);
		}
		e.src = c.toDataURL('image/png');
		await e.decode();
	}, farbe);

const weiss = (p: number[]) => (p[0] ?? 0) > 245 && (p[1] ?? 0) > 245 && (p[2] ?? 0) > 245;
const rot = (p: number[]) => (p[0] ?? 0) > 200 && (p[1] ?? 0) < 60 && (p[2] ?? 0) < 60;
const grau = (p: number[]) =>
	Math.max(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0) - Math.min(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0) <= 12;

test.describe('Rahmen-Stile und Bildrahmen (111)', () => {
	test('Jeder Rahmen-Stil an einem freien Bild ist ein Schritt; schräg dreht um −3°', async ({ page }) => {
		const vorher = blattMit({ vorne: [BILD] });
		await oeffneMit(page, vorher);
		const bild = material(page).locator('img.bild-frei');
		await waehle(page, bild, 'bildfrei');
		for (const [stil, titel] of [
			['polaroid', 'Polaroid'],
			['rund', 'Rund'],
			['kontur', 'Kontur'],
			['schraeg', 'Schräg'],
		] as const) {
			const davor = await quelle(page);
			await abschnitt(page).getByRole('button', { name: titel, exact: true }).click();
			await expect(bild).toHaveAttribute('data-rahmenstil', stil);
			await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Rahmen-Stil geändert');
			await zurueck(page).click();
			await expect.poll(() => quelle(page)).toBe(davor);
			await abschnitt(page).getByRole('button', { name: titel, exact: true }).click();
			await expect(bild).toHaveAttribute('data-rahmenstil', stil);
		}
		expect(await quelle(page)).toContain('--drehen:-3deg');
		// Die Leiste am Bild zeigt dieselbe Wahl im Popover.
		await page.locator('[data-leiste-rahmenstil]').click();
		await page.locator('[role="dialog"] [data-rahmenstil-knopf="gerade"]').click();
		await expect(bild).not.toHaveAttribute('data-rahmenstil');
		expect(vorher).not.toContain('data-rahmenstil');
	});

	test('Polaroid und schräg: Rand weiß, Schatten außen; auch in s/w', async ({ page }) => {
		await oeffneMit(page, blattMit({ vorne: [BILD] }));
		const bild = material(page).locator('img.bild-frei');
		await waehle(page, bild, 'bildfrei');
		await abschnitt(page).getByRole('button', { name: 'Polaroid', exact: true }).click();
		await expect(bild).toHaveAttribute('data-rahmenstil', 'polaroid');
		const stil = await bild.evaluate((e) => {
			const s = getComputedStyle(e);
			return { unten: s.paddingBottom, grund: s.backgroundColor, schatten: s.boxShadow, filter: s.filter };
		});
		expect(stil.unten).toBe('36px');
		expect(stil.grund).toBe('rgb(255, 255, 255)');
		expect(stil.schatten).toContain('rgba(0, 0, 0');
		await page.locator('[data-profilschalter]').getByRole('button', { name: 's/w', exact: true }).click();
		await expect(material(page).locator('body.sw')).toHaveCount(1);
		// Unten im breiten Rand: weiß; die Farbe des Rands bleibt, der Schatten ist grau.
		const [rand] = await pixel(page, bild, [[0.5, 0.97]]);
		expect(weiss(rand ?? [])).toBe(true);
		const schatten = await bild.evaluate((e) => getComputedStyle(e).boxShadow);
		expect(schatten).toMatch(/rgba\(0, 0, 0, 0\.\d+\)/);
	});

	test('Ein Bild in einen Stern-Rahmen gezogen ist sternförmig; ein Klick in die Mitte wählt es', async ({
		page,
	}) => {
		const vorher = blattMit({ vorne: [STERN_RAHMEN] });
		await oeffneMit(page, vorher);
		const rahmen = material(page).locator('.bildrahmen');
		await expect(rahmen).toBeVisible();
		// 172: Über dem leeren Rahmen „einsetzen“ wie beim Platzhalter; über einer Form bleibt es „zuschneiden“.
		await zieheBild(page, rahmen, 'einsetzen');
		await expect.poll(() => quelle(page)).toMatch(/<img class="bild-frei" data-lage="frei"[^>]*data-maske="stern"/);
		const html = await quelle(page);
		expect(html).not.toContain('bildrahmen');
		expect(html).not.toContain('/ansicht/');
		expect(html).toContain('style="--x:300px;--y:420px;--b:240px;--h:240px;clip-path:polygon(');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'einsetzen');

		const bild = material(page).locator('img.bild-frei');
		await einfarbig(bild, '#ff0000');
		const [mitte, ecke, spitze] = await pixel(page, bild, [
			[0.5, 0.5],
			[0.04, 0.04],
			[0.5, 0.08],
		]);
		expect(rot(mitte ?? [])).toBe(true);
		expect(rot(spitze ?? [])).toBe(true);
		expect(rot(ecke ?? [])).toBe(false);

		// Außerhalb der Maske trifft man das Bild nicht, in der Mitte schon.
		await page.keyboard.press('Escape');
		await bild.click({ position: { x: 120, y: 130 } });
		await expect(page.locator('[data-gestaltung-inspektor="bildfrei"]')).toBeVisible();
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Ein Bild auf einen Kreis gezogen: rund zugeschnitten, die Form ist weg, ⌘Z bringt sie zurück', async ({
		page,
	}) => {
		const vorher = blattMit({ vorne: [KREIS] });
		await oeffneMit(page, vorher);
		const kreis = material(page).locator('svg.form');
		await zieheBild(page, kreis, 'zuschneiden');
		await expect.poll(() => quelle(page)).toContain('data-maske="ellipse"');
		const html = await quelle(page);
		expect(html).not.toContain('data-form="ellipse"');
		expect(html).toMatch(
			/<img class="bild-frei" data-lage="frei" data-maske="ellipse" src="bilder\/wachstum\.png"/,
		);
		expect(html).toContain('--x:300px;--y:420px;--b:200px;--h:200px;clip-path:ellipse(50% 50% at 50% 50%)');
		await expect(material(page).locator('svg.form')).toHaveCount(0);
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
		await expect(material(page).locator('svg.form')).toHaveCount(1);
	});

	test('Doppelklick verschiebt den Ausschnitt, Esc beendet; ein Schritt', async ({ page }) => {
		const zugeschnitten = BILD.replace('--b:240px', '--b:120px;--h:240px');
		const vorher = blattMit({ vorne: [zugeschnitten] });
		await oeffneMit(page, vorher);
		const bild = material(page).locator('img.bild-frei');
		await waehle(page, bild, 'bildfrei');
		await bild.dblclick();
		await expect(bild).toHaveAttribute('data-ausschnitt', '');
		const m = await mitteVon(bild);
		await page.mouse.move(m.x, m.y);
		await expect(page.locator('[data-ausschnitt-zeiger]')).toHaveText('Ausschnitt');
		await page.mouse.down();
		await page.mouse.move(m.x + 40, m.y, { steps: 6 });
		await page.mouse.up();
		// Das Bild bewegt sich nicht, nur der Ausschnitt.
		expect(await quelle(page)).toBe(vorher);
		await page.keyboard.press('Escape');
		await expect(bild).not.toHaveAttribute('data-ausschnitt');
		await expect.poll(() => quelle(page)).toMatch(/--bx:\d+%;--by:50%/);
		const html = await quelle(page);
		expect(html).toContain('--x:300px;--y:420px;--b:120px;--h:240px');
		expect(html).toMatch(/--bx:(\d+)%;--by:50%/);
		expect(Number(/--bx:(\d+)%/.exec(html)?.[1])).toBeLessThan(50);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Ausschnitt verschoben');
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Ein leerer Rahmen ist grau und meldet „platzhalter“; ein Klick in der Schublade füllt ihn', async ({
		druecke,
		page,
	}) => {
		await oeffneMit(page, blattMit({ vorne: [STERN_RAHMEN] }));
		const rahmen = material(page).locator('.bildrahmen');
		await expect(rahmen).toBeVisible();
		const [mitte] = await pixel(page, rahmen, [[0.5, 0.75]]);
		expect(grau(mitte ?? []) && !weiss(mitte ?? [])).toBe(true);

		await druecke(page.locator('[data-pruefung] > button'));
		const hinweise = page.locator('[data-pruefliste] [data-hinweise]');
		await druecke(hinweise.locator('summary'));
		const punkt = hinweise.locator('[data-pruefpunkt="platzhalter"]');
		await expect(punkt).toBeVisible();
		// 172: Ein Rahmen, ein Bild; kein Tipp, denn der Weg steht am gewählten Rahmen.
		await expect(punkt).toContainText('Hier fehlt noch ein Bild.');
		await expect(punkt).not.toContainText('Tipp');
		await page.keyboard.press('Escape');

		await waehle(page, rahmen, 'bildrahmen');
		await expect(abschnitt(page).locator('[data-maske-wahl="stern"]')).toBeVisible();
		await oeffneSchublade(page, 'bilder');
		await bilder(page).getByRole('button', { name: 'Sammlung', exact: true }).click();
		await kachel(page, WACHSTUM).click();
		await expect
			.poll(() => quelle(page))
			.toMatch(/<img class="bild-frei"[^>]*data-maske="stern" src="bilder\/wachstum\.png"/);
		expect(await quelle(page)).not.toContain('bildrahmen');
	});

	test('Bildrahmen aus der Schublade „Werkzeuge“: Klick legt einen leeren Rahmen ab', async ({ page }) => {
		await oeffneMit(page, blattMit());
		await oeffneSchublade(page, 'werkzeuge');
		await page.locator('[data-bildrahmen-kachel="kreis"]').click();
		await expect
			.poll(() => quelle(page))
			.toMatch(/<div class="bildrahmen platzhalter" data-lage="frei" data-maske="ellipse"/);
		await expect(page.locator('[data-gestaltung-inspektor="bildrahmen"]')).toBeVisible();
	});
});

test.describe('Bildrahmen füllen wie einen Platzhalter (172)', () => {
	const rahmenVon = (page: Page) => material(page).locator('.bildrahmen');
	const gefuellt = /<img class="bild-frei"[^>]*data-maske="stern" src="bilder\//;

	test('Leiste „Bild einsetzen“ öffnet „Bilder“, ein Klick füllt den Rahmen, ⌘Z holt ihn zurück', async ({
		page,
	}) => {
		const vorher = blattMit({ vorne: [STERN_RAHMEN] });
		await oeffneMit(page, vorher);
		await waehle(page, rahmenVon(page), 'bildrahmen');
		await expect(page.locator('[data-bild-austauschen]')).toHaveCount(0);
		await page.locator('[data-bild-einsetzen]').click();
		await expect(page.locator('[data-panel-links="bilder"]')).toBeVisible();

		await bilder(page).getByRole('button', { name: 'Sammlung', exact: true }).click();
		await kachel(page, WACHSTUM).click();
		await expect.poll(() => quelle(page)).toMatch(/<img class="bild-frei"[^>]*data-maske="stern"/);
		await expect(page.locator('[data-gestaltung-inspektor="bildfrei"]')).toBeVisible();
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Bild eingesetzt');
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);

		// Gegenprobe: Am freien Bild steht „Austauschen“, nicht „Bild einsetzen“.
		await aendere(page, blattMit({ vorne: [BILD] }));
		await waehle(page, material(page).locator('img.bild-frei'), 'bildfrei');
		await expect(page.locator('[data-bild-austauschen]')).toBeVisible();
		await expect(page.locator('[data-bild-einsetzen]')).toHaveCount(0);
	});

	test('„Foto hochladen“ in „Bilder“ füllt den gewählten Rahmen, kein neuer Baustein', async ({ page }) => {
		await oeffneMit(page, blattMit({ vorne: [STERN_RAHMEN] }));
		const aufgaben = (await quelle(page)).split('class="aufgabe"').length;
		await waehle(page, rahmenVon(page), 'bildrahmen');
		await oeffneSchublade(page, 'bilder');
		await bilder(page).getByRole('button', { name: 'Foto hochladen' }).click();
		const foto = { name: 'wachstum.png', mimeType: 'image/png', buffer: await readFile(WACHSTUM_DATEI) };
		const waehler = page.waitForEvent('filechooser');
		await bilder(page).getByText('Verstanden, Foto wählen').click();
		await (await waehler).setFiles(foto);
		await expect.poll(() => quelle(page), { timeout: 15_000 }).toMatch(gefuellt);
		const html = await quelle(page);
		expect(html).not.toMatch(/<img (?![^>]*bild-frei)/);
		expect(html.split('class="aufgabe"').length).toBe(aufgaben);
	});

	test('Inspektor des leeren Rahmens: „Aus der Sammlung“ füllt ihn', async ({ page }) => {
		await oeffneMit(page, blattMit({ vorne: [STERN_RAHMEN] }));
		await waehle(page, rahmenVon(page), 'bildrahmen');
		const werkzeug = page.locator('[data-abschnitt="bild"] [data-bildwerkzeug="platzhalter"]');
		await expect(werkzeug).toBeVisible();
		await expect(werkzeug).not.toContainText('Hier soll');
		const davor = await werkzeug.evaluate((w) => {
			const form = w.ownerDocument.querySelector('[data-abschnitt="bild"] [data-gestaltung-rahmenstil]');
			return Boolean(form && w.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING);
		});
		expect(davor).toBe(true);

		await werkzeug.getByRole('button', { name: 'Aus der Sammlung' }).click();
		const dialog = page.getByRole('dialog', { name: 'Bild aus der Sammlung' });
		await expect(dialog).toBeVisible();
		await dialog.locator(`[data-sammlung-bild="${WACHSTUM}"]`).click();
		await expect(dialog).toBeHidden();
		await expect.poll(() => quelle(page)).toMatch(gefuellt);
		expect(await quelle(page)).not.toContain('bildrahmen');
	});

	test('Rechtsklick auf den leeren Rahmen bietet „Bild ersetzen“', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Rechtsklick gibt es nur mit der Maus');
		await oeffneMit(page, blattMit({ vorne: [STERN_RAHMEN] }));
		const rahmen = rahmenVon(page);
		await rahmen.evaluate((e) => e.scrollIntoView({ block: 'center' }));
		await rahmen.click({ button: 'right' });
		const eintrag = page.getByRole('menuitem', { name: /Bild ersetzen/ });
		await expect(eintrag).toBeVisible();
		await eintrag.click();
		await expect
			.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[data-bildwerkzeug]'))))
			.toBe(true);

		// Gegenprobe: Eine Form ohne Text nimmt kein Bild über das Menü.
		await aendere(page, blattMit({ vorne: [KREIS] }));
		const kreis = material(page).locator('svg.form');
		await kreis.evaluate((e) => e.scrollIntoView({ block: 'center' }));
		await kreis.click({ button: 'right' });
		await expect(page.getByRole('menu')).toBeVisible();
		await expect(page.getByRole('menuitem', { name: /Duplizieren/ })).toBeVisible();
		await expect(page.getByRole('menuitem', { name: /Bild ersetzen/ })).toHaveCount(0);
	});

	test('iPad quer: „Bild einsetzen“ ist ohne Rollen zu sehen', async ({ page }) => {
		await oeffneMit(page, blattMit({ vorne: [STERN_RAHMEN] }));
		await page.setViewportSize({ width: 1180, height: 820 });
		await waehle(page, rahmenVon(page), 'bildrahmen');
		await expect(page.locator('[data-bild-einsetzen]')).toBeInViewport();
	});
});
