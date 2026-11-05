import type { Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const oeffneBausteine = async (page: Page) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await page.getByRole('tab', { name: 'Bausteine' }).click();
	await expect(page.locator('[data-bereich]').first()).toBeVisible();
};
const suche = (page: Page) => page.getByRole('searchbox', { name: 'Baustein suchen' });

const wartePlus = (page: Page) => expect(page.locator('[data-einfuegen-plus]')).toBeVisible();

test.describe('Editor: Bausteine einfügen', () => {
	test('Bibliothek: Klick fügt ein, ein Schritt in Rückgängig, Rest unverändert', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		await page.getByRole('tab', { name: 'Bausteine' }).click();
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Uhr');
		await page.locator('[data-einfuegen="x-uhr"]').click();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Nach dem Einfügen ist der Baustein gewählt, bei Rezept und Aufgabe die Aufgabe', async ({ page }) => {
		await oeffneBausteine(page);
		const titel = page.locator('[data-inspektor] [data-auswahl]');
		for (const [id, soll] of [
			['x-tangram', 'Tangram'],
			['rezept-uhr', 'Aufgabe'],
			['aufgabe', 'Aufgabe'],
		] as const) {
			await suche(page).fill(id === 'x-tangram' ? 'Tangram' : id === 'aufgabe' ? 'Aufgabe' : 'Uhr');
			const vorher = await quelle(page);
			await page.locator(`[data-einfuegen="${id}"]`).click();
			await expect.poll(() => quelle(page)).not.toBe(vorher);
			await expect(titel).toBeVisible();
			await expect(titel).toContainText(soll);
		}
	});

	test('Baustein nur in der Lösung: Der Hinweis sagt es und schaltet um', async ({ page }) => {
		await oeffneBausteine(page);
		await suche(page).fill('Erwartungshorizont');
		await page.locator('[data-einfuegen="x-erwartungshorizont"]').click();
		const hinweis = page.locator('[data-hinweis="unsichtbar"]');
		await expect(hinweis).toContainText('nur in der Lösung');
		// E-B1: Die Sichtbarkeit gibt blatt.css vor, eine Auswahl darunter widerspräche dem Hinweis.
		await expect(page.locator('[data-abschnitt="sichtbarkeit"]')).toBeHidden();
		await hinweis.getByRole('button', { name: 'Zur Lösung' }).click();
		await expect(material(page).locator('body.loesung x-erwartungshorizont')).toBeVisible();
		await expect(hinweis).toBeHidden();
		await expect(page.locator('[data-abschnitt="sichtbarkeit"]')).toBeHidden();
	});

	test('„Beispiel“ wählt den Eintrag oder sagt, was zu wählen ist', async ({ druecke, page }) => {
		await oeffneBausteine(page);
		await suche(page).fill('Beispiel');
		const vorher = await quelle(page);
		await page.locator('[data-einfuegen="beispiel"]').click();
		await expect(page.locator('[role="status"]').filter({ hasText: 'zum Beispiel' }).first()).toBeVisible();
		expect(await quelle(page)).toBe(vorher);
		// Im Testblatt ist der erste Eintrag schon das Beispiel, also der zweite.
		await druecke(material(page).locator('.reihe > *').nth(1));
		await page.locator('[data-einfuegen="beispiel"]').click();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await expect(page.locator('[data-inspektor] [data-auswahl]')).toBeVisible();
	});

	test('„+ Baustein“ in der Leiste öffnet die Schnellauswahl', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.aufgabe').first().locator('.nr'));
		await wartePlus(page);
		await page.locator('[data-einfuegen-plus]').click();
		const fenster = page.locator('[data-schnellauswahl]');
		await fenster.getByRole('searchbox').fill('Schreiblinie');
		await fenster.locator('[data-katalog-eintrag="schreiblinie"]').click();
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
	});

	test('Ziehen aus der Bibliothek legt an der Stelle unter dem Zeiger ab', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.getByRole('tab', { name: 'Bausteine' }).click();
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Schreiblinie');
		const griff = await page.locator('[data-ziehgriff="schreiblinie"]').boundingBox();
		const ziel = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
		if (!griff || !ziel) {
			throw new Error('nicht zu sehen');
		}
		await page.mouse.move(griff.x + griff.width / 2, griff.y + griff.height / 2);
		await page.mouse.down();
		await page.mouse.move(ziel.x + ziel.width / 2, ziel.y + 300, { steps: 5 });
		await page.mouse.up();
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
	});

	test('Ziehen mit dem Finger (Pointer-Ereignisse mit Touch)', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.getByRole('tab', { name: 'Bausteine' }).click();
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Schreiblinie');
		const griff = page.locator('[data-ziehgriff="schreiblinie"]');
		const ziel = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
		if (!ziel) {
			throw new Error('nicht zu sehen');
		}
		const punkt = { pointerType: 'touch', pointerId: 7, bubbles: true };
		await griff.dispatchEvent('pointerdown', { ...punkt, clientX: 0, clientY: 0 });
		await griff.dispatchEvent('pointermove', { ...punkt, clientX: ziel.x + ziel.width / 2, clientY: ziel.y + 300 });
		await griff.dispatchEvent('pointerup', { ...punkt, clientX: ziel.x + ziel.width / 2, clientY: ziel.y + 300 });
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
	});

	test('Suche im Mathe-Blatt findet „Silben“ unter „Aus anderen Fächern“, Einfügen wirkt', async ({ page }) => {
		await oeffneBausteine(page);
		await suche(page).fill('Silben');
		const anderswo = page.locator('[data-treffer-anderswo]');
		await expect(anderswo.getByRole('heading', { name: 'Aus anderen Fächern und Klassen' })).toBeVisible();
		const karte = anderswo.locator('[data-bibliothek-eintrag="x-silben"]');
		await expect(karte.locator('[data-treffer-bereich]')).toHaveText('Sprache');
		await anderswo.locator('[data-einfuegen="x-silben"]').click();
		await expect.poll(() => quelle(page)).toContain('x-silben');
	});

	test('Null-Ergebnis nennt die Anfrage', async ({ page }) => {
		await oeffneBausteine(page);
		await suche(page).fill('gibtsnicht');
		await expect(page.getByText('Nichts zu „gibtsnicht“. Suche prüfen.')).toBeVisible();
	});

	test('Umschalter steht über der Liste und bleibt nach dem Neuladen', async ({ page }) => {
		await oeffneBausteine(page);
		const alle = page.getByRole('button', { name: 'Alle', exact: true });
		const umschalter = await page.getByRole('group', { name: 'Welche Bausteine' }).boundingBox();
		const erste = await page.locator('[data-bereich]').first().boundingBox();
		expect(umschalter && erste && umschalter.y < erste.y).toBe(true);
		await expect(alle).toHaveAttribute('aria-pressed', 'false');
		await alle.click();
		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await page.getByRole('tab', { name: 'Bausteine' }).click();
		await expect(alle).toHaveAttribute('aria-pressed', 'true');
	});

	test('Null-Bereiche nur unter „Alle“, „weitere“ schaltet um', async ({ page }) => {
		await oeffneBausteine(page);
		const sprache = page.locator('[data-bereich="Sprache"]');
		await expect(sprache).toHaveCount(0);
		const weitere = page.locator('[data-weitere]');
		const gesamt = await page.request.get('/api/katalog');
		const { eintraege } = (await gesamt.json()) as { eintraege: { kategorie: string }[] };
		const alleBereiche = new Set(eintraege.map((e) => e.kategorie)).size;
		const verborgen = alleBereiche - (await page.locator('[data-bereich]').count());
		await expect(weitere).toHaveText(`${verborgen} weitere unter Alle`);
		await weitere.click();
		await expect(page.getByRole('button', { name: 'Alle', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(sprache).toBeVisible();
		await expect(weitere).toHaveCount(0);
	});

	test('Vollständig: Über alle Bereiche unter „Alle“ gezählt ist der ganze Katalog', async ({ page }) => {
		await oeffneBausteine(page);
		await page.getByRole('button', { name: 'Alle', exact: true }).click();
		const anzahlen = await page.locator('[data-bereich-anzahl]').allTextContents();
		const { eintraege } = (await (await page.request.get('/api/katalog')).json()) as { eintraege: unknown[] };
		expect(anzahlen.reduce((s, a) => s + Number(a), 0)).toBe(eintraege.length);
	});

	test('Klick auf die Karte fügt ein, Klick auf den Griff nicht', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'der Griff zieht am Finger sofort');
		await oeffneBausteine(page);
		await suche(page).fill('Schreiblinie');
		const vorher = await quelle(page);
		const griff = page.locator('[data-ziehgriff="schreiblinie"]');
		await expect(griff).toHaveAttribute('title', 'Ins Blatt ziehen');
		await griff.click();
		await page.waitForTimeout(200);
		expect(await quelle(page)).toBe(vorher);

		const karte = page.locator('[data-einfuegen="schreiblinie"]');
		await expect(karte).toHaveAttribute('aria-label', 'Schreiblinie einfügen');
		// Mitten in die Vorschau: Auch dort klickt die Karte.
		await page
			.locator('[data-bibliothek-eintrag="schreiblinie"] [data-karten-vorschau]')
			.click({ force: true });
		await expect.poll(() => quelle(page)).not.toBe(vorher);
	});

	test('Maus: Ziehen von der Karte legt ab und fügt nicht zusätzlich per Klick ein', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'am Finger zieht nur der Griff');
		await oeffneBausteine(page);
		await suche(page).fill('Schreiblinie');
		const karte = await page.locator('[data-bibliothek-eintrag="schreiblinie"] [data-karten-vorschau]').boundingBox();
		const ziel = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
		if (!karte || !ziel) {
			throw new Error('nicht zu sehen');
		}
		const vorher = (await quelle(page)).match(/schreiblinie/g)?.length ?? 0;
		await page.mouse.move(karte.x + karte.width / 2, karte.y + karte.height / 2);
		await page.mouse.down();
		await page.mouse.move(ziel.x + ziel.width / 2, ziel.y + 300, { steps: 5 });
		await page.mouse.up();
		await expect.poll(async () => (await quelle(page)).match(/schreiblinie/g)?.length ?? 0).toBeGreaterThan(vorher);
		const danach = await quelle(page);
		await page.waitForTimeout(200);
		expect(await quelle(page)).toBe(danach);
	});

	test('Vorschau jeder Karte passt ganz in den Rahmen', async ({ page }) => {
		test.setTimeout(120_000);
		await oeffneBausteine(page);
		const { eintraege } = (await (await page.request.get('/api/katalog')).json()) as {
			eintraege: { id: string; eigen?: string }[];
		};
		await page.setViewportSize({ width: 202, height: 96 });
		for (const { eigen, id } of eintraege) {
			if (eigen) {
				continue;
			}
			await page.goto(`/ansicht/_katalog/${id}?fit=1`);
			await page.locator('html[data-fit]').waitFor({ state: 'attached' });
			const passt = await page.evaluate(() => {
				const h = document.documentElement;
				return h.scrollHeight <= h.clientHeight && h.scrollWidth <= h.clientWidth;
			});
			expect(passt, id).toBe(true);
		}
	});

	test('Slash: / allein in einer Zeile öffnet das Menü, Esc lässt den Text stehen, mitten im Text nichts', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const text = material(page).locator('.aufgabe .anw .text').first();
		await druecke(text);
		await druecke(text);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.press('End');
		await page.keyboard.type('1/2');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Delete');
		await page.keyboard.type('/');
		await expect(page.locator('[data-slash-menue]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
		await expect(text).toHaveText('/');
		await page.keyboard.type('uhr');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
	});

	test('Slash: Weitertippen filtert, Enter fügt ein', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const text = material(page).locator('.aufgabe .anw .text').first();
		await druecke(text);
		await druecke(text);
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Delete');
		await page.keyboard.type('/schreiblin');
		await expect(page.locator('[data-slash-menue] [data-katalog-eintrag]').first()).toContainText('Schreib');
		await page.keyboard.press('Enter');
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
	});

	test('Überlauf: Die Meldung bietet das Verschieben an, danach passt alles', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const anweisung = material(page).locator('.aufgabe').nth(2).locator('.anw .text');
		await druecke(anweisung);
		await druecke(anweisung);
		await page.keyboard.press('End');
		await page.keyboard.insertText(' Und dann noch ein Satz, der immer weiter geht.'.repeat(20));
		await material(page).locator('.kopf').first().click();
		const summe = page.locator('[data-pruefung] > button');
		await expect(page.locator('[data-pruefung="fehler"]')).toBeVisible();
		await summe.click();
		await page.locator('[data-ueberlauf-verschieben]').first().click();
		await expect(page.locator('[data-pruefung="ok"]')).toBeVisible();
		await expect(material(page).locator('.seite')).toHaveCount(2);
	});

	test('Gliederung: Klick springt, das Menü ordnet', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'am iPad ordnet die Leiste am Baustein');
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const zeilen = page.locator('[data-gliederung-aufgabe] [data-gliederung-titel]');
		await zeilen.nth(0).click();
		await zeilen.nth(0).click({ button: 'right' });
		await page.getByRole('menuitem', { name: /Nach unten/ }).click();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
	});
});
