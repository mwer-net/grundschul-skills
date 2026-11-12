import type { Locator, Page } from '@playwright/test';
import { formHtml } from '@schoolbox/kern/src/formen';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { BILD_FREI, blattMit, FIGUR_ANKER, FIGUR_FREI, FORM, SCHMUCK } from './gestaltung-daten';
import { expect, test } from './hilfe';

/** Setzt eine Ebene `vorne` mit der Figur aus den Testdaten an das Ende der ersten Seite. */
const mitFigur = (text: string) =>
	text.replace('</section>', `  <div class="ebene vorne">\n    ${FIGUR_FREI}\n  </div>\n</section>`);

const figur = (page: Page) => material(page).locator('img.figur-frei');
const inspektor = (page: Page) => page.locator('[data-gestaltung-inspektor="figurfrei"]');
const leiste = (page: Page) => page.locator('[data-gestaltungsleiste="figurfrei"]');

/** Öffnet das Testblatt mit der Figur und wählt sie per Klick im Blatt. */
const mitGewaehlterFigur = async (page: Page, druecke: (ziel: Locator) => Promise<void>) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	const vorher = mitFigur(await quelle(page));
	await aendere(page, vorher);
	await expect(figur(page)).toBeVisible();
	await druecke(figur(page));
	await expect(inspektor(page)).toBeVisible();
	return vorher;
};

test.describe('Inspektor und Leiste am Element (099)', () => {
	test('Bei einer Figur: Bild, Aussehen, Anordnen, Sichtbarkeit in dieser Reihenfolge (185)', async ({
		druecke,
		page,
	}) => {
		await mitGewaehlterFigur(page, druecke);
		// „Bild“: Figur tauschen (102); Schatten und Deckkraft (108) stehen unter „Aussehen“.
		await expect(inspektor(page).locator('[data-abschnitt]')).toHaveCount(4);
		const namen = await inspektor(page)
			.locator('[data-abschnitt]')
			.evaluateAll((alle) => alle.map((a) => a.getAttribute('data-abschnitt')));
		expect(namen).toEqual(['bild', 'aussehen', 'anordnen', 'sichtbarkeit']);
		await expect(inspektor(page).locator('[data-abschnitt="anordnen"] h3')).toHaveText('Anordnen');
		await expect(page.locator('[data-abschnitt="inhalt"]')).toHaveCount(0);
	});

	test('X ändern ist ein Schritt', async ({ druecke, page }) => {
		const vorher = await mitGewaehlterFigur(page, druecke);
		const x = page.getByRole('textbox', { name: 'X-Position' });
		await expect(x).toHaveValue('610');
		await x.fill('300');
		await x.press('Enter');
		await expect.poll(() => quelle(page)).toContain('--x:300px;--y:520px');
		await druecke(page.getByRole('button', { name: 'Rückgängig (⌘Z)' }));
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Vorne → Hinten verschiebt in die hintere Ebene', async ({ druecke, page }) => {
		await mitGewaehlterFigur(page, druecke);
		await druecke(page.locator('[data-gestaltung-ebene]').getByRole('button', { name: 'Hinten' }));
		await expect.poll(() => quelle(page)).toMatch(/<div class="ebene hinten">\s*<img class="figur-frei"/);
		expect(await quelle(page)).not.toContain('ebene vorne');
		await expect(material(page).locator('.ebene.hinten img.figur-frei')).toHaveCount(1);
		await expect(page.locator('[data-gestaltung-ebene="hinten"]')).toBeVisible();
	});

	test('„In s/w: Weg“ setzt data-sw, zurück auf den Standard entfernt es', async ({ druecke, page }) => {
		await mitGewaehlterFigur(page, druecke);
		const sw = page.getByRole('group', { name: 'In s/w' });
		await expect(sw.getByRole('button', { name: 'Grau', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await druecke(sw.getByRole('button', { name: 'Weg', exact: true }));
		await expect.poll(() => quelle(page)).toContain('data-sw="weg"');
		await druecke(sw.getByRole('button', { name: 'Grau', exact: true }));
		await expect.poll(() => quelle(page)).not.toContain('data-sw');
	});

	test('Sichtbarkeit wie bei den Bausteinen: „Nur Lösung“ setzt nur-loesung (185)', async ({ druecke, page }) => {
		await mitGewaehlterFigur(page, druecke);
		const menue = page.getByRole('combobox', { name: 'Sichtbarkeit' });
		await expect(menue).toHaveValue('');
		await expect(menue.locator('option')).toHaveText(['Arbeitsblatt und Lösung', 'Nur Arbeitsblatt', 'Nur Lösung']);
		await menue.selectOption({ label: 'Nur Lösung' });
		await expect.poll(() => quelle(page)).toContain('class="figur-frei nur-loesung"');
	});

	test('Bestand mit nicht-loesung zeigt „Nur Arbeitsblatt“ (185)', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const text = mitFigur(await quelle(page));
		await aendere(page, text.replace('class="figur-frei"', 'class="figur-frei nicht-loesung"'));
		await druecke(figur(page));
		await expect(inspektor(page)).toBeVisible();
		await expect(page.getByRole('combobox', { name: 'Sichtbarkeit' })).toHaveValue('arbeitsblatt');
	});

	test('Die Leiste steht über der Figur, ⋯ hat Duplizieren, Kopieren, Löschen, Claude', async ({ druecke, page }) => {
		await mitGewaehlterFigur(page, druecke);
		await expect(leiste(page)).toBeVisible();
		await expect(page.locator('[data-bausteinleiste]')).toHaveCount(0);
		const l = await leiste(page).boundingBox();
		const f = await figur(page).boundingBox();
		expect(l && f && l.y + l.height <= f.y + 1).toBe(true);

		await druecke(leiste(page).getByRole('button', { name: /^Mehr zu/ }));
		const eintraege = await page.getByRole('menuitem').allTextContents();
		const stelle = (wort: string) => eintraege.findIndex((e) => e.includes(wort));
		const reihe = ['Duplizieren', 'Kopieren', 'Löschen', 'Claude'].map(stelle);
		expect(reihe.every((i) => i !== -1)).toBe(true);
		expect([...reihe].sort((a, b) => a - b)).toEqual(reihe);
	});

	test('Bei einem Baustein erscheint die alte Bausteinleiste', async ({ druecke, page }) => {
		await mitGewaehlterFigur(page, druecke);
		await druecke(material(page).locator('.aufgabe .anw').first());
		await expect(page.locator('[data-bausteinleiste]')).toBeVisible();
		await expect(page.locator('[data-gestaltungsleiste]')).toHaveCount(0);
		await expect(page.locator('[data-gestaltung-inspektor]')).toHaveCount(0);
	});
});

/** Eine Form aus `formHtml` mit Lage auf der ersten Seite. */
const frei = (svg: string, lage: string) => svg.replace(' viewBox=', ` style="${lage}" viewBox=`);
const LINIE = frei(formHtml({ art: 'linie', b: 200, h: 10 }), '--x:200px;--y:620px;--b:200px;--h:10px');
const RECHTECK = frei(formHtml({ art: 'rechteck', b: 160, h: 100 }), '--x:200px;--y:420px;--b:160px;--h:100px');

const blattOeffnen = async (page: Page, html: string) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, html);
};

const waehle = async (druecke: (ziel: Locator) => Promise<void>, page: Page, element: Locator, art: string) => {
	await druecke(element);
	await expect(page.locator(`[data-gestaltung-inspektor="${art}"]`)).toBeVisible();
};

/** Die Titel der sichtbaren Abschnitte im Inspektor der Gestaltung, von oben. */
const abschnitte = (page: Page) =>
	page
		.locator('[data-gestaltung-inspektor] [data-abschnitt]')
		.evaluateAll((alle) =>
			alle.filter((a) => a.getClientRects().length > 0).map((a) => a.querySelector('h3')?.textContent?.trim()),
		);

const stern = (page: Page) => material(page).locator('svg.form[data-form="stern"]');

test.describe('Abschnitte der Gestaltung (185)', () => {
	test('Stern: Form, Füllung und Kontur, Aussehen, Anordnen, Sichtbarkeit', async ({ druecke, page }) => {
		await blattOeffnen(page, blattMit({ vorne: [FORM] }));
		await waehle(druecke, page, stern(page), 'form');
		expect(await abschnitte(page)).toEqual(['Form', 'Füllung und Kontur', 'Aussehen', 'Anordnen', 'Sichtbarkeit']);
		// Kein „Form › Form“: Das Menü hat keine Zeilenbeschriftung, der Abschnitt ist die Überschrift.
		const form = page.locator('[data-abschnitt="form"]');
		await expect(form.locator('[data-zeile] label').filter({ hasText: /^Form$/ })).toHaveCount(0);
		await expect(form.locator('select[aria-label="Form"]')).toBeVisible();
		const fuellung = page.locator('[data-abschnitt="fuellung"]');
		await expect(fuellung.getByRole('group', { name: 'Stil der Kontur' })).toBeVisible();
		const aussehen = page.locator('[data-abschnitt="aussehen"]');
		await expect(aussehen.getByRole('group', { name: 'Schatten' })).toBeVisible();
	});

	test('Schmuckschrift: Text, Aussehen, Anordnen, Sichtbarkeit; keine Füllung, keine Zeile „Art“', async ({
		druecke,
		page,
	}) => {
		await blattOeffnen(page, blattMit({ vorne: [SCHMUCK] }));
		await waehle(druecke, page, material(page).locator('.schmuck'), 'schmuck');
		expect(await abschnitte(page)).toEqual(['Text', 'Aussehen', 'Anordnen', 'Sichtbarkeit']);
		await expect(page.locator('[data-abschnitt="fuellung"]')).toHaveCount(0);
		const zeilen = page.locator('[data-gestaltung-inspektor] [data-zeile] label');
		await expect(zeilen.filter({ hasText: /^Art$/ })).toHaveCount(0);
	});

	test('Bild: Deckkraft unter „Aussehen“, nicht unter „Bild“', async ({ druecke, page }) => {
		await blattOeffnen(page, blattMit({ vorne: [BILD_FREI] }));
		await waehle(druecke, page, material(page).locator('img.bild-frei'), 'bildfrei');
		await expect(page.locator('[data-abschnitt="aussehen"] [data-aussehen-deckkraft]')).toBeVisible();
		await expect(page.locator('[data-abschnitt="bild"] [data-aussehen-deckkraft]')).toHaveCount(0);
	});

	test('Linie: kein Menü „Form“, keine Enden; beim Rechteck Enden nur mit Strichen', async ({ druecke, page }) => {
		await blattOeffnen(page, blattMit({ vorne: [LINIE, RECHTECK] }));
		const stil = page.getByRole('group', { name: 'Stil der Kontur' });
		const enden = page.getByRole('group', { name: 'Enden der Kontur' });

		await waehle(druecke, page, material(page).locator('svg.form[data-form="linie"]'), 'form');
		await expect(page.locator('select[aria-label="Form"]')).toHaveCount(0);
		await expect(stil).toBeVisible();
		await druecke(stil.getByRole('button', { name: 'Striche' }));
		await expect(material(page).locator('svg.form[data-form="linie"]')).toHaveAttribute(
			'data-kontur-stil',
			'gestrichelt',
		);
		await expect(enden).toHaveCount(0);

		// Gegenprobe
		await waehle(druecke, page, material(page).locator('svg.form[data-form="rechteck"]'), 'form');
		await expect(page.locator('select[aria-label="Form"]')).toBeVisible();
		await expect(enden).toHaveCount(0);
		await druecke(stil.getByRole('button', { name: 'Striche' }));
		await expect(enden).toBeVisible();
		await druecke(stil.getByRole('button', { name: 'Linie' }));
		await expect(enden).toHaveCount(0);
	});

	test('Mehrfachauswahl: Der Titel lautet „2 Elemente“', async ({ page }) => {
		test.skip(test.info().project.name.startsWith('ipad'), 'Mehrfachauswahl mit ⇧ und Maus');
		await blattOeffnen(page, blattMit({ vorne: [FORM, RECHTECK] }));
		await stern(page).click();
		await expect(page.locator('[data-breadcrumb] h2')).toHaveText('Stern');
		await material(page).locator('svg.form[data-form="rechteck"]').click({ modifiers: ['Shift'] });
		await expect(page.locator('[data-breadcrumb] h2')).toHaveText('2 Elemente');
	});

	test('Figur am Anker: keine Zeile „Ebene“, „Hängt an“ zeigt den Baustein', async ({ druecke, page }) => {
		await blattOeffnen(page, blattMit({ anker: [FIGUR_ANKER] }));
		await waehle(druecke, page, material(page).locator('img.figur-frei[data-anker]'), 'figurfrei');
		const anordnen = page.locator('[data-abschnitt="anordnen"]');
		await expect(anordnen.locator('[data-zeile] label').filter({ hasText: /^Ebene$/ })).toHaveCount(0);
		await expect(anordnen.getByRole('group', { name: 'Ebene' })).toHaveCount(0);
		const haengtAn = anordnen.getByRole('combobox', { name: 'Hängt an' });
		await expect(haengtAn).not.toHaveValue('');
		await expect(haengtAn.locator('option:checked')).toContainText('Aufgabe 1');
	});

	test.describe('am Mac', () => {
		test.skip(({ hasTouch }) => hasTouch || !['chromium', 'mac-safari'].includes(test.info().project.name), 'Maus');

		test('Stern ohne Prüfhinweis: Der Inspektor rollt nicht', async ({ druecke, page }) => {
			await page.setViewportSize({ width: 1512, height: 982 });
			// Ohne Prüfhinweis „verdeckt …“: Der Stern darf Inhalt überdecken.
			const ohneHinweis = FORM.replace('<svg class="form"', '<svg class="form" data-ueberlagert-ok');
			await blattOeffnen(page, blattMit({ vorne: [ohneHinweis] }));
			await waehle(druecke, page, stern(page), 'form');
			await expect(page.locator('[data-panel="inspektor"]')).not.toContainText('verdeckt');
			const box = page.locator('[data-panel="inspektor"] > div');
			const { hoehe, sichtbar } = await box.evaluate((e) => ({
				hoehe: e.scrollHeight,
				sichtbar: e.clientHeight,
			}));
			expect(hoehe).toBeLessThanOrEqual(sichtbar);
		});
	});
});
