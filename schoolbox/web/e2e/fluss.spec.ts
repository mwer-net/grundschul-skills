/** 206: Seiten laufen weiter. Der Fluss legt nach einem Schritt die Seiten des betroffenen Blatts um. */

import { readFile, writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import type { TestZugriff } from './editorhilfe';
import { geladen, gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const AUTO = /data-weiter="auto"/g;
const automatische = (q: string) => q.match(AUTO)?.length ?? 0;

/** Eine hohe Aufgabe: sechs Schreiblinien. */
const hoheAufgabe = (n: number) =>
	`<div class="aufgabe">
    <span class="nr">${n}</span>
    <div class="anw"><span class="text">Schreibe ${n}.</span></div>
    <div class="koerper">${'<div class="schreiblinie"></div>'.repeat(6)}</div>
  </div>`;

/** Schreibt die Aufgaben vor den Fuß der ersten Seite, ohne Fluss (wie Claude). */
const mitAufgaben = (q: string, von: number, bis: number) => {
	const aufgaben = Array.from({ length: bis - von + 1 }, (_, i) => hoheAufgabe(von + i)).join('\n  ');
	return q.replace('  <!-- Fuß nur mit', `  ${aufgaben}\n\n  <!-- Fuß nur mit`);
};

/** Ein Schritt wie ein Befehl der Lehrkraft. Danach darf der Fluss die Quelle noch umlegen. */
const schritt = (page: Page, neu: string) =>
	page.evaluate(
		(text) => (window as unknown as { schoolboxEditor: TestZugriff }).schoolboxEditor.aendere(text),
		neu,
	);

const seiten = (page: Page) => material(page).locator('body > .seite');

/** Ragt etwas über den Satzspiegel einer Seite? (wie `pruefung.js`, nur Flussblöcke) */
const ueberstand = (page: Page) =>
	material(page)
		.locator('body')
		.evaluate((body) =>
			[...body.querySelectorAll(':scope > .seite')].some((seite) => {
				const unten = seite.getBoundingClientRect().bottom - parseFloat(getComputedStyle(seite).paddingBottom);
				return [...seite.children].some(
					(k) =>
						!k.matches('.loesung-marke, .fuss-zeile, .ebene, [data-lage]') &&
						k.getBoundingClientRect().bottom > unten + 1,
				);
			}),
		);

const vorbereiten = async (page: Page, von: number, bis: number) => {
	const doc = await uhrzeit();
	await writeFile(doc.material, mitAufgaben(await readFile(doc.material, 'utf8'), von, bis));
	await oeffne(page, doc.id, doc.dok);
	return doc;
};

test.describe('Seiten laufen weiter (206)', () => {
	test('Öffnen ändert nichts, auch wenn die Seite übersteht', async ({ page }) => {
		const doc = await vorbereiten(page, 4, 8);
		const vorher = await readFile(doc.material, 'utf8');
		await expect(seiten(page)).toHaveCount(1);
		expect(await quelle(page)).toBe(vorher);
		await page.waitForTimeout(2000);
		expect(await readFile(doc.material, 'utf8')).toBe(vorher);
	});

	test('Ein Schritt bricht um, ⌘Z nimmt Schritt und Umbruch zurück, Löschen holt zurück', async ({ page }) => {
		const doc = await vorbereiten(page, 4, 4);
		const vorher = await quelle(page);
		await schritt(page, mitAufgaben(vorher, 5, 8));
		await expect.poll(async () => automatische(await quelle(page))).toBe(1);
		await geladen(page);
		await expect(seiten(page)).toHaveCount(2);
		await expect(seiten(page).nth(1)).toHaveAttribute('data-weiter', 'auto');
		expect(await ueberstand(page)).toBe(false);
		// Der Fuß steht unten auf der letzten Seite, nicht allein.
		await expect(seiten(page).last().locator(':scope > .fuss')).toHaveCount(1);
		await expect(seiten(page).last().locator(':scope > .aufgabe')).not.toHaveCount(0);
		await expect(seiten(page).first().locator(':scope > .fuss')).toHaveCount(0);
		await gespeichert(page, doc.material);
		const umgebrochen = await quelle(page);

		await material(page).locator('.kopf').first().click();
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
		await geladen(page);
		await expect(seiten(page)).toHaveCount(1);
		await page.keyboard.press('ControlOrMeta+Shift+z');
		await expect.poll(() => quelle(page)).toBe(umgebrochen);

		// Die neuen Aufgaben löschen: Der Fuß rutscht zurück, die automatische Seite verschwindet.
		await geladen(page);
		const ohne = [5, 6, 7, 8].reduce((q, n) => q.replace(`${hoheAufgabe(n)}\n`, ''), umgebrochen);
		expect(ohne).not.toBe(umgebrochen);
		await schritt(page, ohne);
		await expect.poll(async () => automatische(await quelle(page))).toBe(0);
		await geladen(page);
		await expect(seiten(page)).toHaveCount(1);
	});

	test('Alter Überstand: ein Knopf je Seite bricht um, ein Schritt (206-05)', async ({ page }) => {
		await vorbereiten(page, 4, 8);
		const vorher = await quelle(page);
		await page.locator('[data-pruefung] > button').click();
		await expect(page.locator('[data-pruefliste] [data-pruefpunkt="ueberlauf"]').first()).toBeVisible();
		await expect(page.locator('[data-pruefliste] [data-pruefknopf="umbrechen"]')).toHaveCount(1);
		await page.locator('[data-pruefliste] [data-pruefknopf="umbrechen"]').click();
		await expect.poll(async () => automatische(await quelle(page))).toBeGreaterThan(0);
		await geladen(page);
		expect(await ueberstand(page)).toBe(false);
		// Aus der Abnahme von 193: Die Liste bleibt offen, ⌘Z wirkt trotzdem auf das Blatt.
		await expect(page.locator('[data-pruefliste]')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Ein zweites Blatt bleibt Zeichen für Zeichen', async ({ page }) => {
		const doc = await uhrzeit();
		const zweite = '<section class="seite">\n  <h2>Zweites Blatt</h2>\n</section>\n</body>';
		await writeFile(doc.material, (await readFile(doc.material, 'utf8')).replace('</body>', zweite));
		await oeffne(page, doc.id, doc.dok);
		const vorher = await quelle(page);
		const ende = vorher.slice(vorher.lastIndexOf('<section'));
		await schritt(page, mitAufgaben(vorher, 4, 8));
		await expect.poll(async () => automatische(await quelle(page))).toBe(1);
		expect((await quelle(page)).endsWith(ende)).toBe(true);
		await geladen(page);
		await expect(seiten(page)).toHaveCount(3);
	});

	test('Folien fließen nicht', async ({ page }) => {
		const doc = await uhrzeit();
		const q = (await readFile(doc.material, 'utf8')).replace('<body class="kl2', '<body class="kl2 folie');
		await writeFile(doc.material, q);
		await oeffne(page, doc.id, doc.dok);
		await schritt(page, mitAufgaben(await quelle(page), 4, 8));
		await page.waitForTimeout(2000);
		await geladen(page);
		expect(automatische(await quelle(page))).toBe(0);
	});

	test('Die Lösung wird mitgemessen: Was nur dort übersteht, geht auf die nächste Seite (206-04)', async ({ page }) => {
		const doc = await vorbereiten(page, 4, 4);
		const loesung = `<div class="aufgabe">
    <span class="nr">5</span>
    <div class="anw"><span class="text">Nur in der Lösung lang.</span></div>
    <div class="koerper"><div class="nur-loesung" style="height:700px">Lösung</div></div>
  </div>`;
		const q = await quelle(page);
		await schritt(page, q.replace('  <!-- Fuß nur mit', `  ${loesung}\n\n  <!-- Fuß nur mit`));
		await expect.poll(async () => automatische(await quelle(page))).toBe(1);
		await geladen(page);
		expect(await ueberstand(page)).toBe(false);
		await page.goto(`/m/${doc.id}/${doc.dok}/bearbeiten?fassung=loesung`);
		await geladen(page);
		expect(await ueberstand(page)).toBe(false);
	});

	test('Fester Umbruch: „Ab hier neue Seite“ und „An vorige Seite anschließen“ (206-06)', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'am iPad ist ⋯ der Weg');
		await vorbereiten(page, 4, 4);
		await schritt(page, mitAufgaben(await quelle(page), 5, 9));
		await expect.poll(async () => automatische(await quelle(page))).toBeGreaterThan(0);
		await geladen(page);
		const menue = page.getByRole('menu');
		const aufgabe4 = material(page).locator('.aufgabe').filter({ hasText: 'Schreibe 4.' });
		await aufgabe4.locator('.nr').click({ button: 'right' });
		await menue.getByRole('menuitem', { name: /Ab hier neue Seite/ }).click();
		await expect.poll(async () => /data-weiter[\s>]/.test(await quelle(page))).toBe(true);
		await geladen(page);
		// Bis Aufgabe 3 auf der ersten Seite, Aufgabe 4 beginnt die feste Seite, der Rest läuft dahinter weiter.
		await expect(seiten(page).first().locator(':scope > .aufgabe')).toHaveCount(3);
		const fest = seiten(page).and(material(page).locator('[data-weiter=""]'));
		await expect(fest.locator(':scope > .aufgabe').first()).toContainText('Schreibe 4.');
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
		expect(await ueberstand(page)).toBe(false);

		// Aufgabe 1 löschen: Die feste Seite beginnt weiter mit Aufgabe 4.
		await material(page).locator('.aufgabe').first().locator('.nr').click();
		await page.keyboard.press('Backspace');
		await geladen(page);
		await expect(seiten(page).first().locator(':scope > .aufgabe')).toHaveCount(2);
		await expect(fest.locator(':scope > .aufgabe').first()).toContainText('Schreibe 4.');

		await page.locator('[data-seite-zeile="2"]').click({ button: 'right' });
		await menue.getByRole('menuitem', { name: /An vorige Seite anschließen/ }).click();
		await expect.poll(async () => /data-weiter[\s>]/.test(await quelle(page))).toBe(false);
		await geladen(page);
		await expect(seiten(page).first().locator(':scope > .aufgabe')).not.toHaveCount(2);
		expect(await ueberstand(page)).toBe(false);
	});

	test('Beim Tippen laufen die Blöcke dahinter mit, die Quelle bleibt bis zum Ende (206-07)', async ({ page }) => {
		const doc = await vorbereiten(page, 4, 4);
		const vorher = await quelle(page);
		await expect(seiten(page)).toHaveCount(1);
		const anweisung = material(page).locator('.aufgabe').filter({ hasText: 'Schreibe 4.' }).locator('.anw .text');
		await anweisung.click();
		await anweisung.click();
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.press('End');
		await page.keyboard.insertText(' Und dann noch ein Satz, der immer weiter geht.'.repeat(30));
		// Der Fuß wandert sichtbar auf eine zweite Seite, die Quelle ist noch die alte.
		await expect(seiten(page)).toHaveCount(2);
		await expect(seiten(page).last().locator(':scope > .fuss')).toHaveCount(1);
		expect(await quelle(page)).toBe(vorher);
		// Die Schreibmarke bleibt im getippten Block.
		expect(
			await material(page)
				.locator('body')
				.evaluate(() => getSelection()?.anchorNode?.parentElement?.closest('[contenteditable="true"]') !== null),
		).toBe(true);

		// Zurück zum alten Text: Alles steht wie vorher, Esc beendet ohne Schritt.
		await anweisung.click({ clickCount: 3 });
		await page.keyboard.insertText('Schreibe 4.');
		await expect(seiten(page)).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-textbearbeitung]')).toBeHidden();
		expect(await quelle(page)).toBe(vorher);

		// Wieder tippen und beenden: Der echte Fluss legt die Quelle um. Passt der getippte Block selbst nicht mehr,
		// wandert jetzt auch er; beim Tippen blieb er stehen.
		await anweisung.click();
		await anweisung.click();
		await page.keyboard.press('End');
		await page.keyboard.insertText(' Und dann noch ein Satz, der immer weiter geht.'.repeat(30));
		await expect(seiten(page)).toHaveCount(2);
		await page.keyboard.press('Escape');
		await expect.poll(async () => automatische(await quelle(page))).toBeGreaterThan(0);
		await geladen(page);
		await expect(seiten(page).last().locator(':scope > .fuss')).toHaveCount(1);
		expect(await ueberstand(page)).toBe(false);
		await gespeichert(page, doc.material);
	});

	test('Namen zählen übers Blatt, ⌥↑ und ⌥↓ gehen über die Seitengrenze (N03, N08)', async ({ page }) => {
		await vorbereiten(page, 4, 4);
		await schritt(page, mitAufgaben(await quelle(page), 5, 8));
		await expect.poll(async () => automatische(await quelle(page))).toBe(1);
		await geladen(page);
		const oben = seiten(page).last().locator(':scope > .aufgabe').first();
		const nummer = (await oben.locator('.nr').innerText()).trim();
		const text = (await oben.locator('.anw .text').innerText()).trim();
		await oben.locator('.nr').click();
		// N08: wie im Blatt, nicht „Aufgabe 1“ auf der Folgeseite
		await expect(page.locator('[data-breadcrumb]')).toContainText(`Aufgabe ${nummer}`);

		const vorher = await quelle(page);
		await page.keyboard.press('Alt+ArrowUp');
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await geladen(page);
		await expect(seiten(page).first().locator(':scope > .aufgabe .anw .text', { hasText: text })).toHaveCount(1);
		expect(await ueberstand(page)).toBe(false);

		const hoch = await quelle(page);
		await page.keyboard.press('Alt+ArrowDown');
		await expect.poll(() => quelle(page)).not.toBe(hoch);
		await geladen(page);
		await expect(seiten(page).last().locator(':scope > .aufgabe').first()).toContainText(text);
	});

	test('Neutrale Änderung ändert nichts sonst: alter Überstand und eigene Zählung bleiben (Nachbesserung 2)', async ({
		page,
	}) => {
		// Die erste Seite steht über (wie Claude sie schrieb), dahinter ein Blatt, das selbst von 1 an zählt.
		const doc = await uhrzeit();
		const eigeneZaehlung = `<section class="seite">\n  ${hoheAufgabe(1)}\n</section>\n</body>`;
		const roh = mitAufgaben(await readFile(doc.material, 'utf8'), 4, 8).replace('</body>', eigeneZaehlung);
		await writeFile(doc.material, roh);
		await oeffne(page, doc.id, doc.dok);
		const vorher = await quelle(page);
		const stelle = vorher.indexOf('Schreibe 4.') + 'Schreibe 4'.length;
		const soll = `${vorher.slice(0, stelle)}x${vorher.slice(stelle)}`;
		await schritt(page, soll);
		await expect.poll(() => quelle(page)).toBe(soll);
		await geladen(page);
		// Der Fluss hätte jetzt umgelegt; er tut es nicht, weil der Schritt an der Passung nichts änderte.
		await page.waitForTimeout(1500);
		expect(await quelle(page)).toBe(soll);
		expect(automatische(soll)).toBe(0);
		await gespeichert(page, doc.material);
	});

	test('Einfügen und Löschen zählen nur im eigenen Zählbereich (Nachbesserung 3)', async ({ page }) => {
		// Hinter dem Blatt ein zweites, das selbst von 1 an zählt (wie im großen Übungsheft).
		const doc = await uhrzeit();
		const zweites = `<section class="seite">\n  ${hoheAufgabe(1)}\n  ${hoheAufgabe(2)}\n</section>`;
		await writeFile(doc.material, (await readFile(doc.material, 'utf8')).replace('</body>', `${zweites}\n</body>`));
		await oeffne(page, doc.id, doc.dok);
		const vorher = await quelle(page);
		const zweitesVorher = vorher.slice(vorher.lastIndexOf('<section'));
		await material(page).locator('body > .seite').first().locator(':scope > .aufgabe .nr').first().click();
		await page.keyboard.press('ControlOrMeta+d');
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await geladen(page);
		const nachher = await quelle(page);
		expect(nachher.slice(nachher.lastIndexOf('<section'))).toBe(zweitesVorher);
		await expect(seiten(page).last().locator(':scope > .aufgabe .nr')).toHaveText(['1', '2']);
		await page.keyboard.press('Backspace');
		await expect.poll(() => quelle(page)).toBe(vorher);
		await gespeichert(page, doc.material);
	});
});
