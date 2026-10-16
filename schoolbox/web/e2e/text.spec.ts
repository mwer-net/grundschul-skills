import { readFile, writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { aendere, gespeichert, material, oeffne, quelle, uhrzeit, versionen } from './editorhilfe';
import { expect, test } from './hilfe';

/** Erst wählen, dann noch einmal hinein: So beginnt die Bearbeitung mit Finger und Maus. */
const beginne = async (page: Page, druecke: (ziel: Locator) => Promise<void>, ziel: Locator) => {
	await druecke(ziel);
	await expect(ziel).toHaveAttribute('contenteditable', 'true');
	await druecke(ziel);
	await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
	expect(await ziel.evaluate((el) => el.ownerDocument.activeElement === el)).toBe(true);
};

/** Setzt den Cursor hinter bzw. vor `text` oder markiert `text`, wie es die Lehrkraft mit Finger oder Maus täte. */
const waehleText = (ziel: Locator, text: string, wie: 'nach' | 'vor' | 'markieren' = 'nach') =>
	ziel.evaluate(
		(el, [t, art]) => {
			const doc = el.ownerDocument;
			const gang = doc.createTreeWalker(el, 4);
			for (let n = gang.nextNode(); n; n = gang.nextNode()) {
				const i = n.textContent?.indexOf(t) ?? -1;
				if (i >= 0) {
					const r = doc.createRange();
					r.setStart(n, art === 'nach' ? i + t.length : i);
					r.setEnd(n, art === 'vor' ? i : i + t.length);
					doc.getSelection()?.removeAllRanges();
					doc.getSelection()?.addRange(r);
					return;
				}
			}
			throw new Error(`„${t}“ steht nicht im Text.`);
		},
		[text, wie] as const,
	);

const alles = (ziel: Locator) => ziel.evaluate((el) => el.ownerDocument.getSelection()?.selectAllChildren(el));

const fertig = async (page: Page) => {
	await page.getByRole('button', { name: 'Fertig' }).click();
	await expect(page.locator('[data-textbearbeitung]')).toHaveCount(0);
};

test.describe('Editor: Text', () => {
	test('zweimal antippen, tippen, daneben tippen: gespeichert als ein Schritt und nur an dieser Stelle', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		const h1 = material(page).locator('h1');
		await beginne(page, druecke, h1);
		await alles(h1);
		await page.keyboard.type('Wie spät ist es heute?');
		await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();

		await druecke(material(page).locator('.ziel'));
		await expect(page.locator('[data-auswahl="ziel"]')).toBeVisible();
		await expect(page.locator('[data-textbearbeitung]')).toHaveCount(0);
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(
			vorher.replace('<h1>Wie spät ist es?</h1>', '<h1>Wie spät ist es heute?</h1>'),
		);

		await druecke(page.getByRole('button', { name: 'Rückgängig (⌘Z)' }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});

	test('Enter und Esc beenden einzeilige Texte', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const anweisung = material(page).locator('.anw .text').first();
		await beginne(page, druecke, anweisung);
		await waehleText(anweisung, 'Uhrzeit auf.');
		await page.keyboard.type(' Gut!');
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-textbearbeitung]')).toHaveCount(0);
		await expect(page.locator('[data-auswahl="anweisung"]')).toBeVisible();

		const ziel = material(page).locator('.ziel');
		await beginne(page, druecke, ziel);
		await waehleText(ziel, 'ablesen.');
		await page.keyboard.type(' Toll.');
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-textbearbeitung]')).toHaveCount(0);
		await expect(page.locator('[data-auswahl="ziel"]')).toBeVisible();

		await gespeichert(page, datei);
		const html = await readFile(datei, 'utf8');
		expect(html).toContain('<span class="text">Lies ab. Schreibe die Uhrzeit auf. Gut!</span>');
		expect(html).toContain('<div class="ziel">Ich kann volle und halbe Stunden ablesen. Toll.</div>');
		expect(html).not.toMatch(/contenteditable|spellcheck|data-sb|&nbsp;/);
	});

	test('fett und unterstrichen über das Panel und die Tastatur, gespeichert nur als <b> und <u>', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const h1 = material(page).locator('h1');
		await beginne(page, druecke, h1);
		await expect(page.getByRole('button', { name: 'Fett' })).toBeDisabled();
		await fertig(page);

		const blase = material(page).locator('.blase');
		await beginne(page, druecke, blase);
		await waehleText(blase, 'kleine', 'markieren');
		await druecke(page.getByRole('button', { name: 'Fett' }));
		await expect(page.getByRole('button', { name: 'Fett' })).toHaveAttribute('aria-pressed', 'true');
		await waehleText(blase, 'Zeiger', 'markieren');
		await page.keyboard.press('ControlOrMeta+b');
		await waehleText(blase, 'Stunde', 'markieren');
		await page.keyboard.press('ControlOrMeta+u');
		await expect(page.getByRole('button', { name: 'Unterstrichen' })).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('ControlOrMeta+i');
		await fertig(page);

		// Anweisungen sind schon fett: Dort gibt es nur Unterstreichen.
		const anweisung = material(page).locator('.anw .text').first();
		await beginne(page, druecke, anweisung);
		await expect(page.getByRole('button', { name: 'Fett' })).toBeDisabled();
		await waehleText(anweisung, 'Lies', 'markieren');
		await druecke(page.getByRole('button', { name: 'Unterstrichen' }));
		await fertig(page);

		await gespeichert(page, datei);
		const html = await readFile(datei, 'utf8');
		expect(html).toContain(
			'<div class="blase">Zu 1: Erst der <b>kleine</b> <b>Zeiger</b>. Er zeigt die <u>Stunde</u>.</div>',
		);
		expect(html).toContain('<span class="text"><u>Lies</u> ab. Schreibe die Uhrzeit auf.</span>');
	});

	test('Einfügen aus Word oder Pages bringt nur den Text', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const ziel = material(page).locator('.ziel');
		await beginne(page, druecke, ziel);
		await alles(ziel);
		await ziel.evaluate((el) => {
			const daten = new DataTransfer();
			daten.setData('text/html', '<p class="MsoNormal"><span style="color:red"><i>Kartoffeln</i></span></p>');
			daten.setData('text/plain', 'Ich kann „Kartoffeln“\r\nbeschreiben.');
			el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: daten, bubbles: true, cancelable: true }));
		});
		await fertig(page);
		await gespeichert(page, datei);
		const html = await readFile(datei, 'utf8');
		expect(html).toContain('<div class="ziel">Ich kann „Kartoffeln“ beschreiben.</div>');
		expect(html).not.toMatch(/MsoNormal|color:red|<i>Kartoffeln/);
	});

	test('Umlaute, ß, „…“, Gedankenstrich und geschütztes Leerzeichen bleiben richtig', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace('Zu 1: Erst der kleine Zeiger. Er zeigt die Stunde.', 'Es sind 5&nbsp;cm.'),
		);
		const blase = material(page).locator('.blase');
		await beginne(page, druecke, blase);
		await waehleText(blase, 'cm.');
		await page.keyboard.insertText(' Größe – „Maß“ äöü ÄÖÜ ß');
		await page.keyboard.type(' ');
		await fertig(page);
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(
			'<div class="blase">Es sind 5&nbsp;cm. Größe – „Maß“ äöü ÄÖÜ ß </div>',
		);
	});

	test('Enter macht in der Sprechblase eine Zeile und im Absatz einen neuen Absatz', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace('</section>', '  <p>Der Igel schläft im Winter.</p>\n</section>'),
		);
		const blase = material(page).locator('.blase');
		await beginne(page, druecke, blase);
		await waehleText(blase, 'Zeiger.');
		await page.keyboard.press('Enter');
		await page.keyboard.type('Dann');
		await fertig(page);
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(
			'<div class="blase">Zu 1: Erst der kleine Zeiger.<br>Dann Er zeigt die Stunde.</div>',
		);

		const absatz = material(page).locator('p', { hasText: 'Igel' });
		await beginne(page, druecke, absatz);
		await waehleText(absatz, 'Igel ');
		await page.keyboard.press('Enter');
		await expect(material(page).locator('section p')).toHaveCount(2);
		await page.keyboard.press('Backspace');
		await expect(material(page).locator('section p')).toHaveCount(1);
		await page.keyboard.press('Enter');
		await page.keyboard.type('Er ');
		await fertig(page);
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(
			'  <p>Der Igel </p>\n  <p>Er schläft im Winter.</p>\n</section>',
		);
	});

	test('Antwortlinien und Abbildungen im Text bleiben geschützt', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const luecke = '<p>Es ist <span class="antwort" data-l="halb 1"></span> Uhr.</p>';
		await aendere(page, (await quelle(page)).replace('</section>', `  ${luecke}\n</section>`));
		const absatz = material(page).locator('p', { hasText: 'Es ist' });
		await beginne(page, druecke, absatz);
		await waehleText(absatz, ' Uhr.', 'vor');
		await page.keyboard.press('Backspace');
		await waehleText(absatz, 'Es ist ');
		await page.keyboard.press('Delete');
		await alles(absatz);
		await page.keyboard.type('x');
		await expect(absatz.locator('.antwort')).toHaveCount(1);
		await waehleText(absatz, 'Uhr.');
		await page.keyboard.type(' Genau.');
		await fertig(page);
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(
			'<p>Es ist <span class="antwort" data-l="halb 1"></span> Uhr. Genau.</p>',
		);
	});

	test('ändert Claude während des Tippens, geht keine Fassung verloren', async ({ druecke, page }) => {
		const { dok, id, material: datei, ordner } = await uhrzeit();
		await oeffne(page, id, dok);
		const original = await readFile(datei, 'utf8');
		const h1 = material(page).locator('h1');
		await beginne(page, druecke, h1);
		await alles(h1);
		await page.keyboard.type('Meine Überschrift');
		const claude = original.replace('Ich kann volle und halbe Stunden ablesen.', 'Claudes Fassung');
		await writeFile(datei, claude);
		await page.waitForTimeout(1000);
		await expect(h1).toHaveText('Meine Überschrift');

		await fertig(page);
		await expect(page.locator('[data-konflikt]')).toHaveText('Claude hat das Material geändert. Neu laden?');
		const meine = original.replace('<h1>Wie spät ist es?</h1>', '<h1>Meine Überschrift</h1>');
		await expect
			.poll(async () => {
				const liste = await versionen(ordner);
				return Promise.all(liste.map((v) => readFile(`${ordner}/versionen/${v}`, 'utf8')));
			})
			.toContain(meine);
		expect(await readFile(datei, 'utf8')).toBe(claude);
	});
});
