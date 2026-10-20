import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';
import { BAUSTEINE } from '@schoolbox/kern/src/bausteine';
import { ASSETS } from '@schoolbox/kern/src/konfig';
import { zerlege } from '@schoolbox/kern/src/quelltext';
import { bausteinVonKnoten, liesReferenzen, loeseReferenz, pfadText } from '@schoolbox/kern/src/referenz';

import { material, oeffne, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const KOPIERT = 'Kopiert. Füge es im Claude-Chat ein und schreib dahinter, was du ändern möchtest.';
const TESTDATEN = path.join(__dirname, '../../kern/src/testdaten');

interface Ablage {
	kopiert: string[];
}

/** Die Zwischenablage gibt es in den Test-Browsern nicht verlässlich; so sieht der Test, was kopiert wurde. */
const fangeZwischenablage = (page: Page, geht: boolean) =>
	page.addInitScript((ok) => {
		const ablage: Ablage = { kopiert: [] };
		(window as unknown as { ablage: Ablage }).ablage = ablage;
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: (text: string) => {
					ablage.kopiert.push(text);
					return ok ? Promise.resolve() : Promise.reject(new Error('NotAllowedError'));
				},
			},
		});
	}, geht);

const kopiert = (page: Page) => page.evaluate(() => (window as unknown as { ablage: Ablage }).ablage.kopiert);
const claudeFragen = (page: Page) => page.getByRole('button', { name: 'Claude fragen' });
const breadcrumb = (page: Page) => page.locator('[data-breadcrumb]');

test.describe('Claude fragen', () => {
	test('kopiert die Referenz der Auswahl, sie führt zurück auf dasselbe Element', async ({ druecke, page }) => {
		await fangeZwischenablage(page, true);
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);

		await druecke(material(page).locator('.aufgabe').nth(1).locator('.nr'));
		await expect(breadcrumb(page)).toHaveText('Seite 1›Aufgabe 2');
		await druecke(claudeFragen(page));
		await expect(page.getByText(KOPIERT)).toBeVisible();

		const [text = ''] = await kopiert(page);
		const [zeile1, zeile2] = text.split('\n');
		expect(zeile1).toMatch(
			/^Schoolbox · „Uhrzeit“ \(Mathematik Kl\. 2\) · Wie spät ist es\? · Seite 1 › Aufgabe 2 \(„.+“\)$/,
		);
		expect(zeile2).toBe(`[sb:${id}/${dok}#seite1/aufgabe2]`);

		const [ref] = liesReferenzen(text);
		const z = zerlege(await readFile(datei, 'utf8'));
		const ergebnis = ref && loeseReferenz(z, ref);
		expect(ergebnis?.befund).toBe('pfad');
		expect(pfadText(ergebnis?.ziel?.pfad ?? [])).toBe('Seite 1 › Aufgabe 2');

		await druecke(page.getByRole('button', { name: 'Auswahl aufheben' }));
		await druecke(claudeFragen(page));
		await expect.poll(async () => (await kopiert(page)).at(-1)?.split('\n')[1]).toBe(`[sb:${id}/${dok}]`);
	});

	test('nach dem Tippen kopiert sie den neuen Text, und die Datei ist schon gespeichert', async ({
		druecke,
		page,
	}) => {
		await fangeZwischenablage(page, true);
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);

		const ueberschrift = material(page).locator('h1');
		await druecke(ueberschrift);
		await druecke(ueberschrift);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await ueberschrift.evaluate((el) => el.ownerDocument.getSelection()?.selectAllChildren(el));
		await page.keyboard.type('Wie spät ist es jetzt?');
		await druecke(claudeFragen(page));

		await expect
			.poll(async () => (await kopiert(page)).at(-1) ?? '')
			.toContain('Überschrift („Wie spät ist es jetzt?“)');
		await expect.poll(() => readFile(datei, 'utf8')).toContain('Wie spät ist es jetzt?');
	});

	test('ohne Zwischenablage steht der Text zum Kopieren von Hand da', async ({ druecke, page }) => {
		await fangeZwischenablage(page, false);
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);

		await druecke(material(page).locator('.aufgabe').first().locator('.nr'));
		await druecke(claudeFragen(page));
		const feld = page.locator('[data-claude-text]');
		await expect(feld).toBeVisible();
		await expect(feld).toHaveValue(new RegExp(`\\[sb:${id}/${dok}#seite1/aufgabe1\\]$`));
		await druecke(page.getByRole('button', { name: 'Fertig' }));
		await expect(feld).toHaveCount(0);
	});

	test('kern erkennt dieselben Bausteine wie der Browser', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const register = BAUSTEINE.map((b) => [b.art, b.selektor] as const);
		const beispiele = [
			readFileSync(path.join(ASSETS, 'beispiel-zehner-einer-kl2.html'), 'utf8'),
			readFileSync(path.join(TESTDATEN, 'pruefung-blatt.html'), 'utf8'),
			readFileSync(path.join(ASSETS, 'vorlage-praesentation.html'), 'utf8'),
			readFileSync(datei, 'utf8'),
		];
		for (const quelle of beispiele) {
			await writeFile(datei, quelle);
			await oeffne(page, id, dok);
			const z = zerlege(quelle);
			const loesungChip = page
				.getByRole('group', { name: 'Was zeigen?' })
				.getByRole('button', { name: 'Lösung' });
			const fassungen = (await loesungChip.count()) > 0 ? [false, true] : [false];
			for (const loesung of fassungen) {
				if (loesung) {
					await druecke(loesungChip);
					await expect(material(page).locator('body.loesung')).toHaveCount(1);
				}
				const imBrowser = await material(page)
					.locator('body')
					.evaluate(
						(body, liste) =>
							[...body.ownerDocument.querySelectorAll('[data-sb]')].map((e) => [
								Number(e.getAttribute('data-sb')),
								liste.find(([, selektor]) => e.matches(selektor))?.[0] ?? null,
							]),
						register,
					);
				const imKern = imBrowser.map(([nr]) => {
					const k = z.knoten[nr as number];
					return [nr, k ? (bausteinVonKnoten(k, loesung)?.art ?? null) : 'fehlt'];
				});
				expect(imKern).toEqual(imBrowser);
			}
		}
	});
});
