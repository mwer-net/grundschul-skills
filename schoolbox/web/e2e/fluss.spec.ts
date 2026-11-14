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

	test('Die Lösung wird mitgemessen und läuft nicht über', async ({ page }) => {
		const doc = await vorbereiten(page, 4, 4);
		await page.goto(`/m/${doc.id}/${doc.dok}/bearbeiten?fassung=loesung`);
		await geladen(page);
		await schritt(page, mitAufgaben(await quelle(page), 5, 8));
		await expect.poll(async () => automatische(await quelle(page))).toBe(1);
		await geladen(page);
		expect(await ueberstand(page)).toBe(false);
	});
});
