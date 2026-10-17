import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const zusammenfassung = (page: Page) => page.locator('[data-pruefung] > button');

const box = async (ziel: Locator) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht zu sehen');
	}
	return b;
};

test.describe('Editor: Live-Prüfung', () => {
	test('Text, der die Seite sprengt, ist innerhalb einer Sekunde rot markiert; Antippen wählt die Stelle', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await expect(page.locator('[data-pruefung="ok"]')).toBeVisible();
		await expect(zusammenfassung(page)).toContainText('Alles passt');
		await expect(page.locator('[data-pruefrahmen]')).toHaveCount(0);

		const anweisung = material(page).locator('.aufgabe').nth(2).locator('.anw .text');
		await druecke(anweisung);
		await druecke(anweisung);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.press('End');
		await page.keyboard.insertText(' Und dann noch ein Satz, der immer weiter geht.'.repeat(30));
		const getippt = Date.now();

		const rahmen = page.locator('[data-pruefrahmen="FEHLER"][data-code="ueberlauf"]').first();
		await expect(rahmen).toBeVisible({ timeout: 1000 });
		expect(Date.now() - getippt).toBeLessThan(1000);
		await expect(page.locator('[data-pruefung="fehler"]')).toBeVisible();
		// Die Quelle ist noch die alte: geprüft wurde, was gerade getippt wird.
		expect(await quelle(page)).not.toContain('immer weiter geht');

		// Der Rahmen sitzt an dem, was unten aus der Seite ragt.
		const seite = await box(material(page).locator('.seite').first());
		const r = await box(rahmen);
		expect(r.y + r.height).toBeGreaterThan(seite.y + seite.height);
		expect(r.x).toBeGreaterThanOrEqual(seite.x - 4);

		await page.getByRole('button', { name: 'Fertig' }).click();
		await druecke(zusammenfassung(page));
		const eintrag = page.locator('[data-pruefliste] [data-stufe="FEHLER"]').first();
		await expect(eintrag).toContainText('ragt über das Blatt hinaus');
		await expect(eintrag).toContainText('Tipp:');
		await druecke(eintrag);
		await expect(page.locator('[data-pruefliste]')).toHaveCount(0);
		await expect(page.locator('[data-auswahl]')).toBeVisible();
		await expect(page.locator('[data-pruefhinweise]')).toContainText('ragt über das Blatt hinaus');

		await druecke(page.getByRole('button', { name: 'Rückgängig (⌘Z)' }));
		await expect(page.locator('[data-pruefung="ok"]')).toBeVisible();
		await expect(page.locator('[data-pruefrahmen]')).toHaveCount(0);
	});

	test('meldet den Tipp „Zu 1“, wenn Aufgabe 1 nach unten wandert', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await expect(page.locator('[data-pruefung="ok"]')).toBeVisible();

		await druecke(material(page).locator('.aufgabe').first().locator('.nr'));
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
		await druecke(page.getByRole('button', { name: 'Nach unten' }));
		await expect(material(page).locator('.aufgabe').nth(1).locator('.anw .text')).toContainText('Lies ab.');

		await expect(page.locator('[data-pruefung="warnung"]')).toBeVisible();
		await expect(page.locator('[data-pruefrahmen="WARNUNG"]')).toHaveCount(1);
		await druecke(zusammenfassung(page));
		const eintrag = page.locator('[data-pruefpunkt="verweis"]');
		await expect(eintrag).toContainText('Der Tipp „Zu 1“ gehört jetzt zu Aufgabe 2.');
		await druecke(eintrag);
		await expect(page.locator('[data-auswahl="blase"]')).toBeVisible();
	});

	test('Hinweise stehen grau und eingeklappt, fehlende Lösungen darunter', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await expect(page.locator('[data-pruefung="ok"]')).toBeVisible();
		const ohneLoesung = (await quelle(page)).replace(' data-l="halb 5"', '');
		await page.evaluate(
			(text) =>
				(window as unknown as { schoolboxEditor: { aendere: (t: string) => void } }).schoolboxEditor.aendere(
					text,
				),
			ohneLoesung,
		);
		await expect(zusammenfassung(page)).toContainText('Alles passt · 1 Hinweis');
		await druecke(zusammenfassung(page));
		const hinweise = page.locator('[data-hinweise]');
		await expect(hinweise).not.toHaveAttribute('open');
		await druecke(hinweise.locator('summary'));
		const eintrag = hinweise.locator('[data-pruefpunkt="loesung-fehlt"]');
		await expect(eintrag).toContainText('Eine Antwortlinie hat noch keine Lösung.');
		await druecke(eintrag);
		await expect(page).toHaveURL(/fassung=loesung/);
		await expect(page.locator('[data-auswahl="antwort"]')).toBeVisible();
	});
});
