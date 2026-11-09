/**
 * Rezept „Auf alle Blätter im Ordner übernehmen“ (122): Dialog mit Zahlen, Übernehmen, ein zweiter Tab mit einem
 * anderen Blatt zeigt das Rezept, „Versionen“ dort holt den alten Stand zurück. Ohne Ordner ist der Knopf aus.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { wendeAufmachungAn } from '@schoolbox/kern/src/aufmachungen';

import { material, oeffne, quelle } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { dokumentOrdner, expect, legeMappeAn, test } from './hilfe';

const datei = (mappe: string, dok: string) => path.join(dokumentOrdner(mappe, dok), 'material.html');

test.describe('Rezept auf alle Blätter übernehmen (122)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Schublade nur am Mac');

	test('Dialog nennt Zahl, Minibuch und anderes Rezept; der zweite Tab zeigt das Rezept, Versionen holt es zurück', async ({
		context,
		druecke,
		page,
	}) => {
		const { dokumente, id } = await legeMappeAn('Reihe Formen', 'mathematik', 2, [
			{ titel: 'Blatt eins' },
			{ titel: 'Blatt zwei' },
			{ titel: 'Blatt drei' },
			{ titel: 'Faltbuch', format: 'minibuch', vorlage: 'minibuch' },
		]);
		const [eins = '', zwei = '', drei = ''] = dokumente;
		await writeFile(datei(id, eins), wendeAufmachungAn(blattMit(), 'zirkus', { saat: 3 }));
		await writeFile(datei(id, zwei), blattMit());
		await writeFile(datei(id, drei), wendeAufmachungAn(blattMit(), 'detektiv'));
		const zweiVorher = await readFile(datei(id, zwei), 'utf8');

		// Zweiter Tab: Blatt zwei offen, bevor übernommen wird.
		const zweiterTab = await context.newPage();
		await oeffne(zweiterTab, id, zwei);
		await expect(material(zweiterTab).locator('[data-aufmachung-teil]')).toHaveCount(0);

		await oeffne(page, id, eins);
		await page.keyboard.press('Alt+Digit7');
		const knopf = page.locator('[data-rezept-uebernehmen]');
		await expect(knopf).toBeEnabled();
		await druecke(knopf);
		const dialog = page.locator('[data-uebernehmen-dialog]');
		await expect(dialog).toBeVisible();
		await expect(page.getByRole('heading', { name: /Rezept Zirkus auf alle Blätter im Ordner „Reihe Formen“/ })).toBeVisible();
		await expect(dialog.locator('[data-uebernehmen-zahl="2"]')).toHaveText('2 Materialien bekommen das Rezept.');
		await expect(dialog.locator('[data-uebernehmen-minibuch]')).toContainText('„Faltbuch“');
		await expect(dialog.locator('[data-uebernehmen-anderes]')).toContainText('„Blatt drei“');
		const vorherEins = await quelle(page);
		await druecke(page.locator('[data-uebernehmen-los]'));
		await expect(page.getByText('Rezept auf 2 Materialien übernommen.', { exact: false })).toBeVisible();
		expect(await quelle(page)).toBe(vorherEins);

		// Der zweite Tab lädt nach und zeigt das Rezept.
		await expect.poll(() => readFile(datei(id, zwei), 'utf8')).toContain('data-aufmachung="zirkus"');
		await expect(material(zweiterTab).locator('[data-aufmachung-teil]').first()).toBeAttached({ timeout: 15_000 });

		// Versionen holt den Stand vor dem Rezept zurück.
		await druecke(zweiterTab.getByRole('button', { name: 'Versionen' }));
		const liste = zweiterTab.locator('[data-version]');
		await expect(liste.nth(1)).toBeVisible();
		await druecke(liste.nth(1));
		await druecke(zweiterTab.getByRole('button', { name: 'Wiederherstellen' }));
		await expect(zweiterTab.getByText('Die Version ist wiederhergestellt.')).toBeVisible();
		await expect(material(zweiterTab).locator('[data-aufmachung-teil]')).toHaveCount(0);
		await expect.poll(() => readFile(datei(id, zwei), 'utf8')).toBe(zweiVorher);
		await zweiterTab.close();
	});

	test('Ohne Ordner ist der Knopf aus', async ({ page }) => {
		const { dokumente, id } = await legeMappeAn('Einzeln', 'deutsch', 1, [{ titel: 'Allein' }]);
		const dok = dokumente[0] ?? '';
		await writeFile(datei(id, dok), wendeAufmachungAn(blattMit(), 'ruhig'));
		// Aus dem Ordner seines Behälters nach „Mein Material“ ohne Ordner.
		const bewegt = await page.request.post('/api/ordner/aktion', {
			headers: { 'x-schoolbox': '1' },
			data: { art: 'bewegen', knoten: [{ mappe: id, dok }], ziel: null },
		});
		expect(bewegt.ok()).toBe(true);
		await oeffne(page, id, dok);
		await page.keyboard.press('Alt+Digit7');
		const knopf = page.locator('[data-rezept-uebernehmen]');
		await expect(knopf).toBeDisabled();
		await expect(knopf).toHaveAttribute('title', 'Nur für Materialien in einem Ordner');
	});
});
