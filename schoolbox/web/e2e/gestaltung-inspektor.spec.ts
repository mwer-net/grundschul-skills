import type { Locator, Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { FIGUR_FREI } from './gestaltung-daten';
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
	test('Bei einer Figur: Position, Ebene, Druck in dieser Reihenfolge', async ({ druecke, page }) => {
		await mitGewaehlterFigur(page, druecke);
		await expect(inspektor(page).locator('[data-abschnitt]')).toHaveCount(3);
		const namen = await inspektor(page)
			.locator('[data-abschnitt]')
			.evaluateAll((alle) => alle.map((a) => a.getAttribute('data-abschnitt')));
		expect(namen).toEqual(['position', 'ebene', 'druck']);
		await expect(inspektor(page).locator('[data-abschnitt="position"] h3')).toHaveText('Position und Größe');
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

	test('„In s/w: weg“ setzt data-sw, zurück auf den Standard entfernt es', async ({ druecke, page }) => {
		await mitGewaehlterFigur(page, druecke);
		const sw = page.getByRole('group', { name: 'In s/w' });
		await expect(sw.getByRole('button', { name: 'grau' })).toHaveAttribute('aria-pressed', 'true');
		await druecke(sw.getByRole('button', { name: 'weg' }));
		await expect.poll(() => quelle(page)).toContain('data-sw="weg"');
		await druecke(sw.getByRole('button', { name: 'grau' }));
		await expect.poll(() => quelle(page)).not.toContain('data-sw');
	});

	test('„nur in der Lösung“ setzt nur-loesung', async ({ druecke, page }) => {
		await mitGewaehlterFigur(page, druecke);
		await page.getByRole('combobox', { name: 'Zeigen' }).selectOption({ label: 'nur in der Lösung' });
		await expect.poll(() => quelle(page)).toContain('class="figur-frei nur-loesung"');
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
