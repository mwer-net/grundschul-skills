import { readFile } from 'node:fs/promises';

import { aendere, gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

/** UX 186 (196, 197): die A-Befunde des Inspektors im laufenden Editor. */
test.describe('Inspektor: Bausteine und Abbildungen (196, 197)', () => {
	test('196-01: „Punkte“ ändert in der Punkte-Zeile mit Linie nur die Zahl', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/(<div class="anw">)/,
				'$1<span class="punkte"><span class="antwort kurz"></span> / 6 P.</span>',
			),
		);
		await druecke(material(page).locator('.aufgabe').first().locator('.nr'));
		await page.locator('[data-kit="aufgabe"]').getByRole('button', { name: 'Punkte größer' }).click();
		await expect.poll(() => quelle(page)).toContain('<span class="punkte"><span class="antwort kurz"></span> / 6,5 P.</span>');
	});

	test('196-02: Nach „Namenszeile zeigen“ aus bleibt der Kopf gewählt', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.kopf h1').first());
		await druecke(page.locator('[data-breadcrumb]').getByRole('button', { name: 'Kopf' }));
		const schalter = page.locator('[data-kit="kopf"]').getByRole('switch', { name: 'Namenszeile zeigen' });
		await expect(schalter).toHaveAttribute('aria-checked', 'true');
		await schalter.click();
		await expect.poll(() => quelle(page)).not.toContain('class="namenszeile"');
		await expect(page.locator('[data-breadcrumb] [aria-current="true"]')).toHaveText('Kopf');
		await expect(page.locator('[data-kit="kopf"]').getByRole('switch')).toHaveCount(3);
	});

	test('197-02: Ein ungültiger Wert wird nicht gezeichnet, gültige sofort', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(page, (await quelle(page)).replace(/<x-uhr[^>]*><\/x-uhr>/, '<x-zahlenmauer basis="3 5 2"></x-zahlenmauer>'));
		await druecke(material(page).locator('x-zahlenmauer'));
		const feld = page.getByLabel('Unterste Reihe');
		const fehler: string[] = [];
		page.on('pageerror', (e) => fehler.push(e.message));
		for (const unsinn of ['999999 5 2', 'abc']) {
			await feld.fill(unsinn);
			await expect(material(page).locator('x-zahlenmauer')).toHaveAttribute('basis', '3 5 2');
		}
		await feld.fill('4 5 2');
		await expect(material(page).locator('x-zahlenmauer')).toHaveAttribute('basis', '4 5 2');
		expect(fehler).toEqual([]);
	});

	test('197-03: Eigene Aufgaben der Rechenreihe bleiben bei „Spalten“', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-rechenreihe rechenart="+" zahlenraum="20" anzahl="2" aufgaben="3 + 4 = _; 5 + 6 = _"></x-rechenreihe>',
			),
		);
		await druecke(material(page).locator('x-rechenreihe'));
		await page.getByRole('button', { name: 'Spalten: mehr' }).click();
		await expect.poll(() => quelle(page)).toContain('aufgaben="3 + 4 = _; 5 + 6 = _"');
	});

	test('197-04: Ein Komma in einer Liste ganzer Zahlen meldet sich am Feld', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(page, (await quelle(page)).replace(/<x-uhr[^>]*><\/x-uhr>/, '<x-zahlenmauer basis="3 5 2"></x-zahlenmauer>'));
		await gespeichert(page, datei);
		await druecke(material(page).locator('x-zahlenmauer'));
		await page.getByLabel('Unterste Reihe').fill('1,5 2 3');
		await page.getByLabel('Unterste Reihe').press('Enter');
		await expect(page.getByText('Hier gehen nur ganze Zahlen.')).toBeVisible();
		expect(await readFile(datei, 'utf8')).toContain('basis="3 5 2"');
	});

	test('197-05: „Neue Zahlen“ bleibt im Zahlenraum der Klasse', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page))
				.replace(/\bkl2\b/, 'kl3')
				.replace(/<x-uhr[^>]*><\/x-uhr>/, '<x-schriftlich art="plus" zahlen="345 278 96"></x-schriftlich>'),
		);
		await druecke(material(page).locator('x-schriftlich'));
		for (let i = 0; i < 5; i++) {
			const vorher = await quelle(page);
			await page.getByRole('button', { name: 'Neue Zahlen' }).first().click();
			await expect.poll(() => quelle(page)).not.toBe(vorher);
			await expect(material(page).locator('x-schriftlich')).not.toHaveAttribute('data-fehler', /.+/);
			// 207: Über dem Zahlenraum zeichnet das Blatt mit Warnung; „Neue Zahlen“ bleibt trotzdem darin.
			await expect(material(page).locator('x-schriftlich')).not.toHaveAttribute('data-warnung', /.+/);
		}
	});

	test('197-02 (Abnahme): Das Raster im Panel wächst nicht mit einem ungültigen Entwurf', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const figur = '0 0 0 0 0 0 / 0 0 0 1 1 1 / 0 0 1 1 0 0 / 0 1 1 1 0 0 / 0 0 0 1 1 1 / 0 0 0 0 0 0';
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				`<x-gitter spalten="12" zeilen="6" aufgabe="spiegeln" achse="senkrecht" achse-bei="6" figur="${figur}"></x-gitter>`,
			),
		);
		await druecke(material(page).locator('x-gitter'));
		const zellen = page.locator('[data-raster="figur"] > div > *');
		await expect(zellen).toHaveCount(72);
		const spalten = page.locator('[data-feld="spalten"] input[type="text"]');
		for (const unsinn of ['9999', '999999']) {
			await spalten.fill(unsinn);
			await expect(zellen).toHaveCount(72);
			await spalten.press('Tab');
			await expect(zellen).toHaveCount(72);
			await expect(material(page).locator('x-gitter')).toHaveAttribute('spalten', '12');
		}
	});

	test('197-N01: Anklicken und Verlassen eines cm-Felds schreibt nichts; ohne Fokus folgt es dem Blatt', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(page, (await quelle(page)).replace(/<x-uhr[^>]*><\/x-uhr>/, '<x-uhr zeit="3:00" groesse="88"></x-uhr>'));
		await druecke(material(page).locator('x-uhr').first());
		const groesse = page.locator('[data-feld="groesse"] input[type="text"]');
		await expect(groesse).toHaveValue('2,3');
		const vorher = await quelle(page);
		await groesse.click();
		await groesse.press('Tab');
		await groesse.click();
		await groesse.press('Enter');
		expect(await quelle(page)).toBe(vorher);
		await groesse.press('Tab');
		await aendere(page, vorher.replace('groesse="88"', 'groesse="120"'));
		await expect(groesse).toHaveValue('3,2');
	});
});

