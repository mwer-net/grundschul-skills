import type { Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

/** Wo die erste Aufgabe auf der Seite liegt: Dorthin kommt die Figur, die sie verdeckt. */
const ersteAufgabe = (page: Page) =>
	material(page)
		.locator('.aufgabe')
		.first()
		.evaluate((e) => {
			const a = e.getBoundingClientRect();
			const s = (e.closest('.seite') ?? e).getBoundingClientRect();
			return { x: Math.round(a.left - s.left), y: Math.round(a.top - s.top) };
		});

/** Setzt eine Ebene `vorne` an das Ende der ersten Seite. */
const mitEbene = (text: string, elemente: string[]) =>
	text.replace('</section>', `  <div class="ebene vorne">\n    ${elemente.join('\n    ')}\n  </div>\n</section>`);

const zusammenfassung = (page: Page) => page.locator('[data-pruefung] > button');

test.describe('Prüfung der Gestaltung (096)', () => {
	test('Ein Klick auf „verdeckt“ wählt die Figur, auch wenn sie gesperrt ist', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const { x, y } = await ersteAufgabe(page);
		const figur = `<img class="figur-frei" data-lage="frei" data-gesperrt data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:${x + 40}px;--y:${y}px;--b:120px;--h:120px">`;
		await aendere(page, mitEbene(await quelle(page), [figur]));
		await expect(material(page).locator('img.figur-frei')).toBeVisible();

		await druecke(zusammenfassung(page));
		const hinweise = page.locator('[data-pruefliste] [data-hinweise]');
		await druecke(hinweise.locator('summary'));
		const eintrag = hinweise.locator('[data-pruefpunkt="verdeckt"]');
		await expect(eintrag).toContainText('Wilma verdeckt');
		await druecke(eintrag);
		await expect(page.locator('[data-auswahl="figurfrei"]')).toBeVisible();
		await expect(page.locator('[data-pruefhinweise]')).toContainText('verdeckt');
	});

	test('„In die Seite holen“ holt ein Element zurück, ein Schritt', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const form =
			'<svg class="form" data-lage="frei" data-form="kreis" viewBox="0 0 100 100" style="--x:-70px;--y:900px;--b:100px;--h:100px"><circle cx="50" cy="50" r="48" style="fill:var(--haupt)"/></svg>';
		const vorher = mitEbene(await quelle(page), [form]);
		await aendere(page, vorher);
		await expect(page.locator('[data-pruefung="fehler"]')).toBeVisible();

		await druecke(zusammenfassung(page));
		const eintrag = page.locator('[data-pruefliste] [data-pruefpunkt="aussen"]');
		await expect(eintrag).toContainText('liegt außerhalb der Seite');
		await druecke(page.locator('[data-pruefliste] [data-in-seite-holen]'));
		await expect.poll(() => quelle(page)).toContain('--x:20px;--y:900px;--b:100px;--h:100px');
		await expect(page.locator('[data-pruefpunkt="aussen"]')).toHaveCount(0);

		await druecke(page.getByRole('button', { name: 'Rückgängig (⌘Z)' }));
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Ausgeblendetes zeigt der Inspektor mit „Einblenden“', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const form =
			'<svg class="form" data-lage="frei" data-form="kreis" data-aus viewBox="0 0 100 100" style="--x:300px;--y:300px;--b:100px;--h:100px"><circle cx="50" cy="50" r="48"/></svg>';
		await aendere(page, mitEbene(await quelle(page), [form]));
		await expect(zusammenfassung(page)).toContainText('1 Hinweis');

		await druecke(zusammenfassung(page));
		const hinweise = page.locator('[data-pruefliste] [data-hinweise]');
		await druecke(hinweise.locator('summary'));
		const eintrag = hinweise.locator('[data-pruefpunkt="ausgeblendet"]');
		await expect(eintrag).toContainText('Ein Element ist ausgeblendet und wird nicht gedruckt.');
		await druecke(eintrag);
		const hinweis = page.locator('[data-hinweis="ausgeblendet"]');
		await expect(hinweis).toBeVisible();
		await expect(page.locator('[data-hinweis="unsichtbar"]')).toHaveCount(0);
		await druecke(hinweis.getByRole('button', { name: 'Einblenden' }));
		await expect.poll(() => quelle(page)).not.toContain('data-aus');
		await expect(material(page).locator('svg.form')).toBeVisible();
	});
});
