import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { TestZugriff } from './editorhilfe';
import { aendere, gespeichert, material, oeffne, quelle, uhrzeit, versionen } from './editorhilfe';
import { expect, test } from './hilfe';

test.describe('Editor', () => {
	test('öffnet aus Dokument und Mappe und speichert nichts, solange nichts geändert ist', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei, ordner } = await uhrzeit();
		const vorher = { inhalt: await readFile(datei, 'utf8'), zeit: (await stat(datei)).mtimeMs };
		const versionenVorher = await versionen(ordner);
		const schreibend: string[] = [];
		page.on('request', (anfrage) => {
			if (anfrage.method() !== 'GET') {
				schreibend.push(`${anfrage.method()} ${anfrage.url()}`);
			}
		});

		await page.goto(`/m/${id}`);
		await druecke(page.locator(`[data-dokument="${dok}"]`).getByRole('link', { name: 'Bearbeiten' }));
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(page.getByRole('heading', { level: 1, name: 'Wie spät ist es?' })).toBeVisible();
		await expect(page.getByText('Gespeichert')).toBeVisible();
		await page.waitForTimeout(2500);
		await druecke(page.getByRole('button', { name: 'Zurück' }));
		await expect(page).toHaveURL(new RegExp(`/m/${id}/${dok}$`));
		await druecke(page.getByRole('link', { name: 'Bearbeiten' }));
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await page.goto(`/m/${id}`);

		expect(schreibend).toEqual([]);
		expect(await readFile(datei, 'utf8')).toBe(vorher.inhalt);
		expect((await stat(datei)).mtimeMs).toBe(vorher.zeit);
		expect(await versionen(ordner)).toEqual(versionenVorher);
	});

	test('wählt per Antippen den innersten Baustein und zeigt, wo er liegt', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('h1'));
		await expect(page.locator('[data-breadcrumb]')).toHaveText('Seite 1›Überschrift');
		await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();

		await druecke(material(page).locator('x-uhr').nth(1));
		await expect(page.locator('[data-breadcrumb]')).toHaveText('Seite 1›Aufgabe 1›Reihe›Item 2›Abbildung');
		await druecke(page.locator('[data-breadcrumb]').getByRole('button', { name: 'Aufgabe 1' }));
		await expect(page.locator('[data-auswahl="aufgabe"] h2')).toHaveText('Aufgabe 1');

		await druecke(material(page).locator('.nr.stern'));
		await expect(page.locator('[data-auswahl] h2')).toHaveText('Sternchenaufgabe');

		await page.keyboard.press('Escape');
		await expect(page.locator('[data-auswahlrahmen]')).toHaveCount(0);
		await expect(page.getByText('Tippe auf einen Teil des Blatts')).toBeVisible();

		await druecke(material(page).locator('.blase'));
		await expect(page.locator('[data-auswahl="blase"]')).toBeVisible();
		await page.locator('[data-leinwand]').click({ position: { x: 4, y: 30 } });
		await expect(page.locator('[data-auswahlrahmen]')).toHaveCount(0);

		// Gerenderte Uhren im Blatt, aber nie in der Quelle des Editors
		await expect(material(page).locator('x-uhr svg').first()).toBeAttached();
		expect(await quelle(page)).not.toMatch(/<svg|data-sb/);
	});

	test('eine Textänderung speichert nur diese Stelle und legt eine Version an', async ({ page }) => {
		const { dok, id, material: datei, ordner } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace('<h1>Wie spät ist es?</h1>', '<h1>Wie spät ist es jetzt?</h1>'),
		);
		await expect(page.locator('[data-speicherstand="speichert"]')).toBeVisible();
		await gespeichert(page, datei);
		await expect(material(page).locator('h1')).toHaveText('Wie spät ist es jetzt?');

		const nachher = await readFile(datei, 'utf8');
		expect(nachher).toBe(vorher.replace('<h1>Wie spät ist es?</h1>', '<h1>Wie spät ist es jetzt?</h1>'));
		expect(nachher).not.toMatch(/data-sb|<svg|<base/);
		expect((await versionen(ordner)).some((v) => v.endsWith('_lehrkraft.html'))).toBe(true);
	});

	test('macht 55 Schritte mit Knopf und Tastatur exakt rückgängig', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const original = await readFile(datei, 'utf8');
		test.setTimeout(90_000);
		await oeffne(page, id, dok);
		await page.evaluate(() => {
			const { schoolboxEditor } = window as unknown as { schoolboxEditor: TestZugriff };
			let fassung = schoolboxEditor.quelle() ?? '';
			for (let i = 1; i <= 55; i += 1) {
				fassung = fassung.replace(/<h1>[^<]*<\/h1>/, `<h1>Fassung ${i}</h1>`);
				schoolboxEditor.aendere(fassung, `Schritt ${i}`);
			}
		});
		await expect(material(page).locator('h1')).toHaveText('Fassung 55');
		const zurueck = page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
		for (let i = 0; i < 30; i += 1) {
			await druecke(zurueck);
		}
		const taste = process.platform === 'darwin' ? 'Meta+z' : 'Control+z';
		for (let i = 0; i < 25; i += 1) {
			await page.keyboard.press(taste);
		}
		await expect(zurueck).toBeDisabled();
		expect(await quelle(page)).toBe(original);
		await druecke(page.getByRole('button', { name: 'Wiederholen (⇧⌘Z)' }));
		expect(await quelle(page)).toContain('<h1>Fassung 1</h1>');
		await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
		await gespeichert(page, datei);
		await page.waitForTimeout(500);
		expect(await readFile(datei, 'utf8')).toBe(original);
	});

	test('lädt neu, wenn Claude ändert und nichts offen ist', async ({ page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const claude = (await readFile(datei, 'utf8')).replace('<h1>Wie spät ist es?</h1>', '<h1>Claude war hier</h1>');
		await writeFile(datei, claude);
		await expect(page.getByText('Claude hat das Material geändert.')).toBeVisible();
		await expect(material(page).locator('h1')).toHaveText('Claude war hier');
		expect(await quelle(page)).toBe(claude);
	});

	test('verliert bei gleichzeitiger Änderung durch Claude keine der beiden Fassungen', async ({ druecke, page }) => {
		const { dok, id, material: datei, ordner } = await uhrzeit();
		await oeffne(page, id, dok);
		const original = await readFile(datei, 'utf8');
		const meine = original.replace('<h1>Wie spät ist es?</h1>', '<h1>Meine Fassung</h1>');
		await aendere(page, meine);
		const claude = original.replace('Ich kann volle und halbe Stunden ablesen.', 'Claudes Fassung');
		await writeFile(datei, claude);

		await expect(page.locator('[data-konflikt]')).toHaveText('Claude hat das Material geändert. Neu laden?');
		await expect(page.locator('[data-speicherstand="konflikt"]')).toBeVisible();
		expect(await readFile(datei, 'utf8')).toBe(claude);
		await druecke(page.getByRole('button', { name: 'Neu laden' }));
		await expect(page.locator('[data-konflikt]')).toHaveCount(0);
		await expect(material(page).locator('.ziel').first()).toHaveText('Claudes Fassung');

		const inhalte = await Promise.all(
			(await versionen(ordner)).map((v) => readFile(path.join(ordner, 'versionen', v), 'utf8')),
		);
		expect(inhalte).toContain(meine);
		expect(inhalte).toContain(claude);
		expect(inhalte.at(-1)).toBe(claude);
	});

	test('zeigt Versionen und stellt eine wieder her, ohne etwas zu überschreiben', async ({ druecke, page }) => {
		const { dok, id, material: datei, ordner } = await uhrzeit();
		const original = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		await aendere(page, (await quelle(page)).replace('<h1>Wie spät ist es?</h1>', '<h1>Zweite Fassung</h1>'));
		await gespeichert(page, datei);
		const anzahl = (await versionen(ordner)).length;

		await druecke(page.getByRole('button', { name: 'Versionen' }));
		const liste = page.locator('[data-version]');
		await expect(liste).toHaveCount(anzahl);
		await expect(liste.first()).toContainText('Du');
		await expect(liste.last()).toContainText('Claude');
		await druecke(liste.last());
		await expect(page.locator('[data-vorschau]')).toBeVisible();
		await expect(material(page).locator('h1')).toHaveText('Wie spät ist es?');
		await druecke(page.getByRole('button', { name: 'Zurück zum jetzigen Stand' }));
		await expect(material(page).locator('h1')).toHaveText('Zweite Fassung');

		await druecke(liste.last());
		await druecke(page.getByRole('button', { name: 'Wiederherstellen' }));
		await expect(page.getByText('Die Version ist wiederhergestellt.')).toBeVisible();
		await expect(page.locator('[data-vorschau]')).toHaveCount(0);
		await expect(material(page).locator('h1')).toHaveText('Wie spät ist es?');
		expect(await readFile(datei, 'utf8')).toBe(original);
		const inhalte = await Promise.all(
			(await versionen(ordner)).map((v) => readFile(path.join(ordner, 'versionen', v), 'utf8')),
		);
		expect(inhalte.length).toBe(anzahl + 1);
		expect(inhalte.some((i) => i.includes('Zweite Fassung'))).toBe(true);
	});

	test('hat nur Bedienelemente, die groß genug für den Finger sind', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('h1'));
		const zuKlein = await page.evaluate(() =>
			[...document.querySelectorAll<HTMLElement>('a, button')]
				.filter((e) => e.getClientRects().length > 0)
				.filter((e) => {
					const { height, width } = e.getBoundingClientRect();
					return height < 44 || width < 44;
				})
				.map((e) => e.textContent || e.getAttribute('aria-label')),
		);
		expect(zuKlein).toEqual([]);
	});

	test('fehlt bei Teilen-Links', async ({ browser, page }) => {
		const { dok, id } = await uhrzeit();
		const antwort = await page.request.post('/api/freigaben', {
			headers: { 'x-schoolbox': '1' },
			data: { mappe: id },
		});
		const { token } = (await antwort.json()) as { token: string };
		const fremd = await browser.newContext();
		const besuch = await fremd.newPage();
		await besuch.goto(`/f/${token}`);
		await expect(besuch.locator('[data-dokument]')).toHaveCount(1);
		await expect(besuch.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0);
		await besuch.goto(`/f/${token}/d/${dok}`);
		await expect(besuch.getByRole('button', { name: 'PDF herunterladen' })).toBeVisible();
		await expect(besuch.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0);
		await fremd.close();
	});
});
