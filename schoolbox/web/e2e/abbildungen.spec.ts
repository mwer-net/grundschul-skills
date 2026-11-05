import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Page } from '@playwright/test';
import { ASSETS } from '@schoolbox/kern/src/konfig';

import { aendere, gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const panel = (page: Page) => page.locator('[data-abbildungswerkzeug]');

/** Zeilen der neuen Fassung, die sich geändert haben. */
const geaendert = (alt: string, neu: string) => {
	const vorher = alt.split('\n');
	return neu.split('\n').filter((zeile, i) => zeile !== vorher[i]);
};

/** Der Minutenzeiger einer gezeichneten Uhr: Endpunkt der dritten Linie vom Mittelpunkt aus. */
const minutenzeiger = (page: Page, nr: number) =>
	material(page)
		.locator('x-uhr')
		.nth(nr)
		.evaluate((uhr) => {
			const zeiger = [...uhr.querySelectorAll('line[x1="50"][y1="50"]')].at(-1);
			return `${zeiger?.getAttribute('x2') ?? ''} ${zeiger?.getAttribute('y2') ?? ''}`;
		});

test.describe('Editor: Abbildungen', () => {
	test('Uhrzeit ändern: sofort neu gezeichnet, nur das Attribut in der Quelle, jede Änderung ein Schritt', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);

		await druecke(material(page).locator('x-uhr').first());
		await expect(page.locator('[data-breadcrumb]')).toHaveText(/^(Seite 1›Aufgabe 1|…)›Reihe›Eintrag 1›Uhr$/);
		await expect(page.locator('[data-hinweis="beispiel"]')).toContainText('Das ist das Beispiel.');

		await druecke(material(page).locator('x-uhr').nth(1));
		await expect(panel(page)).toBeVisible();
		await expect(page.locator('[data-hinweis="beispiel"]')).toHaveCount(0);
		expect(await minutenzeiger(page, 1)).toBe('50 77');

		await page.locator('[data-inspektor]').getByLabel('Stunde').selectOption('5');
		await page.locator('[data-inspektor]').getByLabel('Minuten').selectOption('45');
		await expect.poll(() => minutenzeiger(page, 1)).toBe('23 50');
		await gespeichert(page, datei);
		const nachher = await readFile(datei, 'utf8');
		expect(geaendert(vorher, nachher)).toEqual([
			'        <div class="zelle"><x-uhr zeit="5:45"></x-uhr><span class="antwort breit" data-l="halb 5"></span></div>',
		]);
		expect(nachher).not.toContain('<svg');
		await expect(page.locator('[data-auswahl="abbildung"]')).toBeVisible();

		await page.getByLabel('Zeiger nur in der Lösung').check();
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-uhr loesung="5:45"></x-uhr>');
		await expect.poll(() => minutenzeiger(page, 1)).toBe(' ');

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(nachher);
		await druecke(zurueck(page));
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});

	test('ungültige Eingaben zeigen einen Hinweis und werden nicht gespeichert', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await writeFile(
			datei,
			(await readFile(datei, 'utf8'))
				.replace(
					'<x-uhr zeit="4:30"></x-uhr>',
					'<x-zahlenstrahl von="0" bis="20" pfeile="7 13"></x-zahlenstrahl>',
				)
				.replace('<x-uhr zeit="7:00"></x-uhr>', '<x-menge n="23" form="nuss"></x-menge>'),
		);
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		const strahl = material(page).locator('x-zahlenstrahl');
		await druecke(strahl);
		await expect(page.locator('[data-breadcrumb]')).toContainText('Zahlenstrahl');

		const bis = page.getByLabel('Bis', { exact: true });
		await bis.fill('10');
		await bis.press('Enter');
		await expect(page.locator('[data-fehler="pfeile"]')).toHaveText('13 liegt nicht zwischen 0 und 10.');
		await expect(page.locator('[data-nicht-uebernommen]')).toBeVisible();
		await expect(strahl).toHaveAttribute('bis', '10');
		expect(await quelle(page)).toBe(vorher);
		await page.waitForTimeout(2000);
		expect(await readFile(datei, 'utf8')).toBe(vorher);

		await druecke(page.getByRole('button', { name: 'Zurücksetzen' }));
		await expect(strahl).toHaveAttribute('bis', '20');
		await expect(page.locator('[data-fehler]')).toHaveCount(0);

		await bis.fill('30');
		await bis.press('Enter');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-zahlenstrahl von="0" bis="30" pfeile="7 13">');

		await druecke(material(page).locator('x-menge'));
		const buendel = page.locator('[data-feld="buendel"]');
		for (let i = 0; i < 3; i += 1) {
			await druecke(page.getByRole('button', { name: 'Zehnerbündel: mehr' }));
		}
		await expect(page.locator('[data-fehler="buendel"]')).toHaveText('Es gibt nur 2 volle Zehnerreihen.');
		await expect(buendel.locator('input[type="text"]')).toHaveValue('3');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-menge buendel="2" n="23" form="nuss">');
		await expect(material(page).locator('x-menge rect')).toHaveCount(3);

		await druecke(page.getByRole('button', { name: 'Auswahl aufheben' }));
		await expect(material(page).locator('x-menge rect')).toHaveCount(2);
		await druecke(zurueck(page));
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-menge n="23" form="nuss">');
	});
});

/** Ein Blatt mit einem Testelement; ersetzt die erste Uhr, damit der Rest des Blatts bleibt. */
const mitProbe = async (page: Page, attribute: string, innen = '') => {
	const { dok, id, material: datei } = await uhrzeit();
	await oeffne(page, id, dok);
	const stand = await quelle(page);
	await aendere(page, stand.replace(/<x-uhr[^>]*><\/x-uhr>/, `<x-probe ${attribute}>${innen}</x-probe>`));
	await gespeichert(page, datei);
	return { dok, id, datei };
};
const probe = (page: Page) => material(page).locator('x-probe');
const tagVon = async (datei: string) => /<x-probe[^>]*>.*?<\/x-probe>/s.exec(await readFile(datei, 'utf8'))?.[0] ?? '';

test.describe('Editor: Feldtypen (023)', () => {
	test('jede Eingabe ändert die Quelle, und jede Änderung ist ein Rückgängig-Schritt', async ({ druecke, page }) => {
		test.slow();
		const { datei } = await mitProbe(page, 'titel="Start" eintraege="Hund: 7" seed="1"', 'Ro|si');
		const start = await tagVon(datei);
		await druecke(probe(page));
		await expect(panel(page)).toBeVisible();
		await expect(page.locator('[data-abbildung-info]')).toHaveText('1 Einträge');

		const schritte: [string, () => Promise<void>, RegExp][] = [
			[
				'text',
				async () => {
					await page.getByLabel('Titel').fill('Neu');
					await page.getByLabel('Titel').press('Enter');
				},
				/titel="Neu"/,
			],
			[
				'text am Inhalt',
				async () => {
					await page.getByLabel('Wort').fill('Ro|si|ne');
					await page.getByLabel('Wort').press('Enter');
				},
				/>Ro\|si\|ne<\/x-probe>/,
			],
			['muster', () => druecke(page.locator('[data-muster="blau"]')), /farbe="blau"/],
			['mehrfach', () => druecke(page.getByText('Zwei', { exact: true })), /arten="zwei"/],
			['mischen', () => druecke(page.locator('[data-mischen="seed"]')), /seed="(?!1")\d+"/],
		];
		for (const [name, tu, erwartet] of schritte) {
			const vorher = await tagVon(datei);
			await tu();
			await gespeichert(page, datei);
			const nachher = await tagVon(datei);
			expect(nachher, name).toMatch(erwartet);
			await druecke(zurueck(page));
			await gespeichert(page, datei);
			expect(await tagVon(datei), `${name}: ein Schritt zurück`).toBe(vorher);
			await page.getByRole('button', { name: /Wiederholen/ }).click();
			await gespeichert(page, datei);
			expect(await tagVon(datei), name).toBe(nachher);
			await druecke(probe(page));
		}
		expect(start).toContain('Ro|si');
	});

	test('Griff: Ziehen sortiert in einem Schritt um, Esc bricht ab', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Am Finger gehen ↑ und ↓ im Menü der Zeile.');
		const { datei } = await mitProbe(page, 'eintraege="Hund: 7; Katze: 4; Maus: 2"');
		await probe(page).click();
		const griff = page.getByRole('button', { name: 'Zeile 1 verschieben' });
		const ziel = page.locator('[data-liste="eintraege"] [data-zeile="2"]');
		const a = await griff.boundingBox();
		const b = await ziel.boundingBox();
		if (!a || !b) {
			throw new Error('Griff oder Ziel fehlt');
		}
		const zieheZu = async () => {
			await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
			await page.mouse.down();
			await page.mouse.move(a.x + a.width / 2, b.y + b.height - 1, { steps: 6 });
		};
		await zieheZu();
		await page.keyboard.press('Escape');
		await page.mouse.up();
		expect(await tagVon(datei)).toContain('eintraege="Hund: 7; Katze: 4; Maus: 2"');

		await zieheZu();
		await page.mouse.up();
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Katze: 4; Maus: 2; Hund: 7"');
		await zurueck(page).click();
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Hund: 7; Katze: 4; Maus: 2"');
	});

	test('Als Text bearbeiten: eine Zeile je Eintrag, zurück zur Liste', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(/<x-uhr[^>]*><\/x-uhr>/, '<x-suchsel woerter="HUND; MAUS" seed="1"></x-suchsel>'),
		);
		await gespeichert(page, datei);
		await druecke(material(page).locator('x-suchsel'));
		await druecke(page.locator('[data-liste-als-text="woerter"]'));
		const text = page.locator('[data-liste-text="woerter"]');
		await expect(text).toHaveValue('HUND\nMAUS');
		await text.fill('HUND\nMAUS\nIGEL');
		await text.blur();
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('woerter="HUND; MAUS; IGEL"');
		await druecke(page.locator('[data-liste-als-text="woerter"]'));
		await expect(page.locator('[data-liste="woerter"] [data-zeile]')).toHaveCount(3);
	});

	test('Felder ohne Wirkung sind verborgen, ihr Wert bleibt stehen', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(/<x-uhr[^>]*><\/x-uhr>/, '<x-gitter spalten="6" zeilen="4" faktor="0.5"></x-gitter>'),
		);
		await gespeichert(page, datei);
		await druecke(material(page).locator('x-gitter'));
		await expect(panel(page).locator('[data-feld="faktor"]')).toHaveCount(0);
		await panel(page).locator('[data-feld="aufgabe"] select').selectOption('weg');
		await expect(panel(page).locator('[data-feld="wegart"]')).toBeVisible();
		await expect(panel(page).locator('[data-feld="faktor"]')).toHaveCount(0);
		expect(await readFile(datei, 'utf8')).toContain('faktor="0.5"');
	});

	test('Liste, Raster und Form', async ({ druecke, page }) => {
		test.slow();
		const { datei } = await mitProbe(page, 'eintraege="Hund: 7; Katze: 4"');
		await druecke(probe(page));
		const liste = page.locator('[data-liste="eintraege"]');
		await expect(liste.locator('[data-zeile]')).toHaveCount(2);

		await liste.getByLabel('Zahl in Zeile 1').fill('8');
		await liste.getByLabel('Zahl in Zeile 1').press('Enter');
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Hund: 8; Katze: 4"');

		await liste.getByLabel('Zahl in Zeile 1').fill('200');
		await expect(page.locator('[data-fehler="eintraege"]')).toContainText('0 bis 99');
		await liste.getByLabel('Zahl in Zeile 1').fill('8');

		// Der Griff tauscht auch per Pfeiltaste und behält den Fokus.
		const griff = page.getByRole('button', { name: 'Zeile 2 verschieben' });
		await griff.focus();
		await griff.press('ArrowUp');
		await expect(page.getByRole('button', { name: 'Zeile 1 verschieben' })).toBeFocused();
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Katze: 4; Hund: 8"');

		await druecke(page.locator('[data-zeile-neu="eintraege"]'));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Katze: 4; Hund: 8; Neu: 1"');

		await druecke(page.getByRole('button', { name: 'Zeile 3: mehr' }));
		await druecke(page.getByRole('button', { name: 'Zeile 3 löschen' }));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Katze: 4; Hund: 8"');

		await druecke(page.locator('[data-raster="feld"] [data-zelle="0-1"]'));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('feld="0 1 0 / 0 0 0"');
		// Die Farbe des gewählten Felds gewinnt gegen den Grund der leeren Zelle.
		await expect(page.locator('[data-raster="feld"] [data-zelle="0-1"]')).not.toHaveCSS(
			'background-color',
			'rgb(255, 255, 255)',
		);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).not.toContain('feld=');

		await druecke(probe(page));
		await page.locator('[data-raster="hoehen"] [data-zelle="0-0"]').fill('3');
		await page.locator('[data-raster="hoehen"] [data-zelle="0-0"]').press('Enter');
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('hoehen="3"');
		await druecke(page.getByRole('button', { name: 'Spalte +' }));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('hoehen="3 0"');

		await druecke(page.locator('[data-form-raster="form"] [data-zelle="2"]'));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('form="2"');
	});

	test('Fehler aus dem Element: gestrichelter Kasten, Hinweis im Panel, nicht gespeichert', async ({
		druecke,
		page,
	}) => {
		const { datei } = await mitProbe(page, 'titel="gut"');
		const stand = await readFile(datei, 'utf8');
		await druecke(probe(page));
		await page.getByLabel('Titel').fill('falsch');
		await page.getByLabel('Titel').press('Enter');
		await expect(page.locator('[data-fehler="_element"]')).toHaveText('Dieser Titel geht nicht.');
		await expect(probe(page)).toHaveAttribute('data-fehler', 'Dieser Titel geht nicht.');
		await expect(probe(page)).toContainText('Dieser Titel geht nicht.');
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await page.getByLabel('Titel').fill('wieder gut');
		await page.getByLabel('Titel').press('Enter');
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler="_element"]')).toHaveCount(0);
		expect(await tagVon(datei)).toContain('titel="wieder gut"');
	});

	test('gleicher Seed: gleiches Bild in Vorschau und außerhalb des Editors, mit und ohne Lösung', async ({
		page,
	}) => {
		const { datei } = await mitProbe(page, 'seed="4711"');
		const imEditor = await probe(page).locator('.probe-punkt').getAttribute('cx');
		const zeichnung = await readFile(path.join(ASSETS, 'abbildungen.js'), 'utf8');
		const html = await tagVon(datei);
		for (const klasse of ['kl2 sw', 'kl2 sw loesung', 'kl2 farbe']) {
			const seite = await page.context().newPage();
			await seite.setContent(`<!doctype html><html><body class="${klasse}">${html}</body></html>`);
			await seite.addScriptTag({ content: zeichnung });
			expect(await seite.locator('.probe-punkt').getAttribute('cx'), klasse).toBe(imEditor);
			await seite.close();
		}
	});
});

/** Ein Element außerhalb des Editors gezeichnet, wie es blatt.py auch tut. */
const gezeichnet = async (page: Page, html: string, klasse = 'kl3 sw') => {
	const seite = await page.context().newPage();
	await seite.setContent(`<!doctype html><html><body class="${klasse}">${html}</body></html>`);
	await seite.addScriptTag({ path: path.join(ASSETS, 'abbildungen.js') });
	return seite;
};

test.describe('Daten und Zufall (024)', () => {
	test('Glücksrad: Winkel genau, Muster unterscheidbar, Bastelvorlage 12 cm', async ({ page }) => {
		const seite = await gezeichnet(page, '<x-gluecksrad felder="rot; blau; gruen" anteile="1 1 2"></x-gluecksrad>');
		const winkel = await seite
			.locator('path[data-winkel]')
			.evaluateAll((p) => p.map((e) => e.getAttribute('data-winkel')));
		expect(winkel).toEqual(['90', '90', '180']);
		const fuellungen = await seite
			.locator('path[data-winkel]')
			.evaluateAll((p) => p.map((e) => e.getAttribute('fill')));
		expect(new Set(fuellungen).size).toBe(3);
		expect(await seite.locator('x-gluecksrad').getByText('Rot', { exact: true }).count()).toBe(1);

		const bastel = await gezeichnet(page, '<x-gluecksrad bastel="ja" felder="rot; blau"></x-gluecksrad>');
		await expect(bastel.locator('x-gluecksrad')).toHaveAttribute('data-masstab', '');
		const r = Number(await bastel.locator('.rad-rand').getAttribute('r'));
		expect((2 * r * 2.54) / 96).toBeCloseTo(12, 2);
		const zu = await gezeichnet(page, '<x-gluecksrad felder="rot; blau" anteile="1 40"></x-gluecksrad>');
		await expect(zu.locator('x-gluecksrad')).toHaveAttribute('data-fehler', /unter 20°/);
	});

	test('Diagramm: Skala mit Schritt 2, alle Säulen enden genau auf dem Wert', async ({ page }) => {
		const seite = await gezeichnet(page, '<x-diagramm werte="A: 3; B: 7; C: 12"></x-diagramm>');
		await expect(seite.locator('x-diagramm')).toHaveAttribute('data-skala', '2');
		const y = async (v: number) => Number(await seite.locator(`.gitter[data-v="${v}"]`).getAttribute('y1'));
		const basis = await y(0);
		const proEinheit = (basis - (await y(12))) / 12;
		for (const v of [3, 7, 12]) {
			const oben = Number(await seite.locator(`.wert[data-wert="${v}"]`).getAttribute('y'));
			expect(oben).toBeCloseTo(basis - v * proEinheit, 1);
		}
		const offen = await gezeichnet(page, '<x-diagramm werte="A: 3; B: 7" offen="2"></x-diagramm>');
		await expect(offen.locator('.wert')).toHaveCount(1);
		const loesung = await gezeichnet(
			page,
			'<x-diagramm werte="A: 3; B: 7" offen="2"></x-diagramm>',
			'kl3 sw loesung',
		);
		await expect(loesung.locator('.wert')).toHaveCount(2);
	});

	test('Möglichkeiten: 2 aus 3 ohne Reihenfolge sind 3, mit Wiederholung 6', async ({ page }) => {
		const stufen = 'stufen="E S V / E S V" art="liste" reihenfolge="nein"';
		const ohne = await gezeichnet(
			page,
			`<x-kombinatorik ${stufen} wiederholung="nein"></x-kombinatorik>`,
			'kl3 sw loesung',
		);
		await expect(ohne.locator('x-kombinatorik')).toHaveAttribute('data-anzahl', '3');
		await expect(ohne.locator('.ast')).toHaveCount(3);
		const mit = await gezeichnet(page, `<x-kombinatorik ${stufen}></x-kombinatorik>`);
		await expect(mit.locator('x-kombinatorik')).toHaveAttribute('data-anzahl', '6');
	});

	test('Strichliste bündelt zu fünft, die fehlende Spalte steht nur in der Lösung', async ({ page }) => {
		const blatt = await gezeichnet(page, '<x-strichliste werte="A: 7" zeige="zahl"></x-strichliste>');
		await expect(blatt.locator('.strich')).toHaveCount(0);
		const loesung = await gezeichnet(
			page,
			'<x-strichliste werte="A: 7" zeige="zahl"></x-strichliste>',
			'kl3 sw loesung',
		);
		await expect(loesung.locator('.strich')).toHaveCount(7);
		const schraeg = await loesung
			.locator('.strich')
			.evaluateAll((l) => l.filter((e) => e.getAttribute('x1') !== e.getAttribute('x2')).length);
		expect(schraeg).toBe(1);
	});

	test('Panel: Wert ändern und Feld hinzufügen sind je ein Schritt, Würfel-Fehler sperrt', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-diagramm werte="A: 3; B: 7"></x-diagramm><x-gluecksrad felder="rot; blau"></x-gluecksrad><x-wuerfel ansicht="raeumlich" oben="1" vorne="2" rechts="3"></x-wuerfel>',
			),
		);
		await gespeichert(page, datei);

		await druecke(material(page).locator('x-diagramm'));
		const stand = await readFile(datei, 'utf8');
		await page.getByLabel('Wert in Zeile 1').fill('4');
		await page.getByLabel('Wert in Zeile 1').press('Enter');
		await gespeichert(page, datei);
		const nachher = await readFile(datei, 'utf8');
		expect(nachher).toContain('<x-diagramm werte="A: 4; B: 7">');
		expect(geaendert(stand, nachher)).toHaveLength(1);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-gluecksrad'));
		await druecke(page.locator('[data-zeile-neu="felder"]'));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-gluecksrad felder="rot; blau; rot">');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-wuerfel'));
		const vorne = page.getByLabel('Vorne', { exact: true });
		await vorne.fill('6');
		await vorne.press('Enter');
		await expect(page.locator('[data-fehler="_element"]')).toContainText('liegen auf dem Würfel gegenüber');
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});
});

test.describe('Ebene Geometrie (025)', () => {
	const zellen = (seite: Page, klasse: string) =>
		seite
			.locator(klasse)
			.evaluateAll((l) => l.map((e) => `${e.getAttribute('data-x')},${e.getAttribute('data-y')}`).sort());

	test('Kästchen misst 1 cm, Hinweis zum Maßstab, Fehler bei Achse und Weg', async ({ page }) => {
		const seite = await gezeichnet(
			page,
			'<x-gitter kaestchen="1" spalten="3" zeilen="2" figur="1 0 0"></x-gitter>',
		);
		await expect(seite.locator('x-gitter')).toHaveAttribute('data-masstab', '');
		const breite = Number(await seite.locator('.kaestchen').getAttribute('width'));
		expect((breite * 2.54) / 96).toBeCloseTo(1, 2);
		const kreuzt = await gezeichnet(
			page,
			'<x-gitter spalten="8" zeilen="2" aufgabe="spiegeln" achse="senkrecht" achse-bei="1" figur="1 1"></x-gitter>',
		);
		await expect(kreuzt.locator('x-gitter')).toHaveAttribute('data-fehler', /kreuzt die Achse/);
		const weg = await gezeichnet(
			page,
			'<x-gitter spalten="3" zeilen="3" aufgabe="weg" start="0,0" weg="9→"></x-gitter>',
		);
		await expect(weg.locator('x-gitter')).toHaveAttribute('data-fehler', /verlässt das Gitter/);
	});

	test('Kästchen im Panel: je ein Schritt, die Lösung spiegelt sie genau', async ({ druecke, page }) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-gitter spalten="8" zeilen="3" kaestchen="0.5" aufgabe="spiegeln" achse="senkrecht" achse-bei="4" figur="0 0 1 1 0 0 0 0 / 0 0 0 0 0 0 0 0 / 0 0 0 0 0 0 0 0"></x-gitter>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');
		await druecke(material(page).locator('x-gitter'));
		await druecke(page.locator('[data-raster="figur"] [data-zelle="1-2"]'));
		await gespeichert(page, datei);
		await druecke(page.locator('[data-raster="figur"] [data-zelle="2-1"]'));
		await gespeichert(page, datei);
		const nachher = await readFile(datei, 'utf8');
		expect(nachher).toContain('figur="0 0 1 1 0 0 0 0 / 0 0 1 0 0 0 0 0 / 0 1 0 0 0 0 0 0"');
		expect(geaendert(stand, nachher)).toHaveLength(1);

		const tag = /<x-gitter[^>]*><\/x-gitter>/.exec(nachher)?.[0] ?? '';
		const loesung = await gezeichnet(page, tag, 'kl3 sw loesung');
		expect(await zellen(loesung, '.kaestchen')).toEqual(['1,2', '2,0', '2,1', '3,0']);
		expect(await zellen(loesung, '.kaestchen-loesung')).toEqual(['4,0', '5,0', '5,1', '6,2']);
		const blatt = await gezeichnet(page, tag);
		await expect(blatt.locator('.kaestchen-loesung')).toHaveCount(0);

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('figur="0 0 1 1 0 0 0 0 / 0 0 1 0 0 0 0 0 / 0 0 0 0 0 0 0 0"');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-gitter'));
		await page.getByLabel('Achse nach', { exact: true }).fill('3');
		await page.getByLabel('Achse nach', { exact: true }).press('Enter');
		await expect(page.locator('[data-fehler="_element"]')).toContainText('kreuzt die Achse');
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});

	test('Figur kennzeichnet rechte Winkel, Tangram-Bogen zeigt sieben Teile', async ({ page }) => {
		const blatt = await gezeichnet(page, '<x-figur form="dreieck" loesung="rechter-winkel"></x-figur>');
		await expect(blatt.locator('.rechter-winkel')).toHaveCount(0);
		const loesung = await gezeichnet(
			page,
			'<x-figur form="dreieck" loesung="rechter-winkel"></x-figur>',
			'kl3 sw loesung',
		);
		await expect(loesung.locator('.rechter-winkel')).toHaveCount(1);
		const bogen = await gezeichnet(page, '<x-tangram bogen="ja"></x-tangram>');
		await expect(bogen.locator('.teil')).toHaveCount(7);
		await expect(bogen.locator('x-tangram')).toHaveAttribute('data-masstab', '');
		const umriss = await gezeichnet(page, '<x-tangram umriss="kerze"></x-tangram>');
		await expect(umriss.locator('.teil')).toHaveCount(0);
		const voll = await gezeichnet(page, '<x-tangram umriss="kerze"></x-tangram>', 'kl3 sw loesung');
		await expect(voll.locator('.teil')).toHaveCount(7);
	});
});

test.describe('Räumliche Geometrie (026)', () => {
	test('Alle Netze: Lösung markiert sie richtig; Bastelwürfel misst 4 cm, gegenüber 7', async ({ page }) => {
		const alle = [
			...Array.from({ length: 11 }, (_, i) => `${i + 1}`),
			...Array.from({ length: 8 }, (_, i) => `n${i + 1}`),
		];
		const html = alle.map(
			(n) => `<x-wuerfelnetz netz="${n}" aufgabe="netz-oder-nicht" groesse="18"></x-wuerfelnetz>`,
		);
		const blatt = await gezeichnet(page, html.join(''));
		await expect(blatt.locator('.haken, .kreuz')).toHaveCount(0);
		const loesung = await gezeichnet(page, html.join(''), 'kl3 sw loesung');
		await expect(loesung.locator('.haken')).toHaveCount(11);
		await expect(loesung.locator('.kreuz')).toHaveCount(8);

		const bastel = await gezeichnet(
			page,
			'<x-wuerfelnetz netz="1" augen="ja" bastel="ja" kante="4"></x-wuerfelnetz>',
		);
		await expect(bastel.locator('x-wuerfelnetz')).toHaveAttribute('data-masstab', '');
		await expect(bastel.locator('.lasche')).toHaveCount(7);
		const felder = await bastel
			.locator('.feld')
			.evaluateAll((l) =>
				l.map((e) => [e.getAttribute('data-normale') ?? '', Number(e.getAttribute('data-augen'))] as const),
			);
		expect(felder).toHaveLength(6);
		const augen = new Map(felder);
		for (const [seite, zahl] of felder) {
			const gegen = seite
				.split(',')
				.map((a) => -Number(a) || 0)
				.join();
			expect(zahl + (augen.get(gegen) ?? 0)).toBe(7);
		}
		const zu = await gezeichnet(page, '<x-wuerfelnetz netz="1" bastel="ja" kante="8"></x-wuerfelnetz>');
		await expect(zu.locator('x-wuerfelnetz')).toHaveAttribute('data-fehler', /Größte Kante/);
	});

	test('Augen ergänzen zeigt die Lösung, Gegenüber markiert die Gegenfläche', async ({ page }) => {
		const tag = '<x-wuerfelnetz netz="10" aufgabe="augen-ergaenzen" seed="a"></x-wuerfelnetz>';
		const blatt = await gezeichnet(page, tag);
		await expect(blatt.locator('.augen')).toHaveCount(3);
		const voll = await gezeichnet(page, tag, 'kl3 sw loesung');
		await expect(voll.locator('.augen')).toHaveCount(6);
		const netz = '<x-wuerfelnetz netz="3" aufgabe="gegenueber" markiere="2"></x-wuerfelnetz>';
		const vorher = await gezeichnet(page, netz);
		await expect(vorher.locator('.marke')).toHaveCount(1);
		const nachher = await gezeichnet(page, netz, 'kl3 sw loesung');
		await expect(nachher.locator('.marke')).toHaveCount(2);
	});

	test('Bauplan im Panel: Schrägbild und Ansichten ändern sich gemeinsam, Verdecktes wird abgelehnt', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-wuerfelbau bauplan="1 2 / 1 1" zeige="schraegbild vorne rechts" fragen="anzahl"></x-wuerfelbau>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');
		const bau = material(page).locator('x-wuerfelbau');
		await expect(bau.locator('.baustein')).toHaveCount(5);
		await expect(bau.locator('[data-ansicht="vorne"]')).toHaveAttribute('data-hoehen', '1 2');
		await expect(bau.locator('[data-ansicht="rechts"]')).toHaveAttribute('data-hoehen', '1 2');

		await druecke(bau);
		const zelle = page.locator('[data-raster="bauplan"] [data-zelle="1-1"]');
		await zelle.fill('3');
		await zelle.press('Enter');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('bauplan="1 2 / 1 3"');
		await expect(bau.locator('.baustein')).toHaveCount(7);
		await expect(bau.locator('[data-ansicht="vorne"]')).toHaveAttribute('data-hoehen', '1 3');
		await expect(bau.locator('[data-ansicht="rechts"]')).toHaveAttribute('data-hoehen', '3 2');

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(bau);
		const eckzelle = page.locator('[data-raster="bauplan"] [data-zelle="0-0"]');
		await eckzelle.fill('2');
		await eckzelle.press('Enter');
		await expect(page.locator('[data-fehler="_element"]')).toContainText('nicht zu sehen');
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});

	test('Netz im Panel mit Vor und Zurück durchsehen', async ({ druecke, page }) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(/<x-uhr[^>]*><\/x-uhr>/, '<x-wuerfelnetz netz="2"></x-wuerfelnetz>'),
		);
		await gespeichert(page, datei);
		await druecke(material(page).locator('x-wuerfelnetz'));
		await druecke(page.getByRole('button', { name: 'Netz: vor' }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('netz="3"');
		await druecke(page.getByRole('button', { name: 'Netz: zurück' }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('netz="2"');
	});

	test('Körper: Lösung markiert Ecken und nennt die Anzahl', async ({ page }) => {
		const tag = '<x-koerper form="pyramide" markiere="ecken"></x-koerper>';
		const blatt = await gezeichnet(page, tag);
		await expect(blatt.locator('.ecke')).toHaveCount(0);
		const voll = await gezeichnet(page, tag, 'kl3 sw loesung');
		await expect(voll.locator('.ecke')).toHaveCount(5);
		await expect(voll.locator('x-koerper')).toHaveAttribute('data-ecken', '5');
		const modell = await gezeichnet(page, '<x-koerper form="quader" ansicht="kantenmodell"></x-koerper>');
		await expect(modell.locator('.kugel-ecke')).toHaveCount(8);
	});
});

test.describe('Zahldarstellungen (027)', () => {
	const werte = (seite: Page, klasse: string) =>
		seite
			.locator(klasse)
			.evaluateAll((l) =>
				l.map(
					(e) =>
						`${e.getAttribute('data-wert')}:${e.getAttribute('data-sichtbar')}:${(e.textContent ?? '').trim()}`,
				),
			);

	test('Rechenstrich 47 +30 +4: Blatt zeigt 47 und Sprünge, Lösung 77 und 81', async ({ page }) => {
		const tag = '<x-rechenstrich start="47" spruenge="+30 +4"></x-rechenstrich>';
		const blatt = await gezeichnet(page, tag);
		expect(await werte(blatt, '.strich-wert')).toEqual(['47:ja:47', '77:nein:', '81:nein:']);
		expect(await werte(blatt, '.strich-sprung')).toEqual(['30:ja:+30', '4:ja:+4']);
		const voll = await gezeichnet(page, tag, 'kl3 sw loesung');
		expect(await werte(voll, '.strich-wert')).toEqual(['47:ja:47', '77:nein:77', '81:nein:81']);
		const gemischt = await gezeichnet(page, '<x-rechenstrich start="50" spruenge="+30 −4"></x-rechenstrich>');
		await expect(gemischt.locator('x-rechenstrich')).toHaveAttribute('data-fehler', /Gemischte Sprünge/);
		const eng = await gezeichnet(
			page,
			'<x-rechenstrich start="0" spruenge="+1 +99" massstab="ja"></x-rechenstrich>',
		);
		await expect(eng.locator('x-rechenstrich')).toHaveAttribute('data-fehler', /px breit/);
	});

	test('Stellentafel: 7 Stellen mit Plättchen passen, Stellenfarben nur in Farbe, Fehler ab 8 Stellen', async ({
		page,
	}) => {
		const tag =
			'<x-stellentafel stellen="M HT ZT T H Z E" art="plaettchen" plaettchen="15 15 15 15 15 15 15"></x-stellentafel>';
		const seite = await gezeichnet(page, tag);
		await expect(seite.locator('.plaettchen')).toHaveCount(105);
		const breite = await seite.locator('.stellentafel').evaluate((t) => t.getBoundingClientRect().width);
		expect(breite).toBeLessThanOrEqual(620);
		const acht = await gezeichnet(page, '<x-stellentafel stellen="A M HT ZT T H Z E"></x-stellentafel>');
		await expect(acht.locator('x-stellentafel')).toHaveAttribute('data-fehler', /höchstens 7/);
		const zuViele = await gezeichnet(page, '<x-stellentafel art="plaettchen" plaettchen="16 0"></x-stellentafel>');
		await expect(zuViele.locator('x-stellentafel')).toHaveAttribute('data-fehler', /0 bis 15/);
	});

	test('Hunderterfeld, Rahmen und Blöcke zeigen die Lösung erst im Lösungsblatt', async ({ page }) => {
		const feld = '<x-hunderterfeld n="30" n2="6"></x-hunderterfeld>';
		const blatt = await gezeichnet(page, feld);
		await expect(blatt.locator('.plaettchen-voll')).toHaveCount(30);
		await expect(blatt.locator('.plaettchen-ring')).toHaveCount(6);
		const winkel = '<x-hunderterfeld loesung="3x7"></x-hunderterfeld>';
		await expect((await gezeichnet(page, winkel)).locator('.malwinkel')).toHaveCount(0);
		await expect((await gezeichnet(page, winkel, 'kl3 sw loesung')).locator('.malwinkel')).toHaveCount(1);
		const rahmen = '<x-rechenrahmen loesung="7 3"></x-rechenrahmen>';
		await expect((await gezeichnet(page, rahmen)).locator('x-rechenrahmen')).toHaveAttribute('data-summe', '0');
		await expect((await gezeichnet(page, rahmen, 'kl3 sw loesung')).locator('x-rechenrahmen')).toHaveAttribute(
			'data-summe',
			'10',
		);
		const bloecke = await gezeichnet(page, '<x-dienes t="1" h="2" z="3" e="4"></x-dienes>');
		await expect(bloecke.locator('x-dienes')).toHaveAttribute('data-wert', '1234');
		await expect(bloecke.locator('.tausender')).toHaveCount(1);
		await expect(bloecke.locator('.hunderter')).toHaveCount(2);
	});

	test('Panel: Lücke antippen und Sprung hinzufügen sind je ein Schritt', async ({ druecke, page }) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-hundertertafel ausschnitt="kreuz" mitte="45"></x-hundertertafel><x-rechenstrich start="47" spruenge="+30 +4"></x-rechenstrich>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');
		const orte = await material(page)
			.locator('.tafel-zelle')
			.evaluateAll((l) =>
				l.map((e) => [e.getAttribute('data-zahl'), e.getAttribute('data-x'), e.getAttribute('data-y')].join()),
			);
		expect(orte).toEqual(['35,1,0', '44,0,1', '45,1,1', '46,2,1', '55,1,2']);

		await druecke(material(page).locator('x-hundertertafel'));
		await druecke(page.locator('[data-form-raster="luecken"] [data-zelle="44"]'));
		await gespeichert(page, datei);
		const mitLuecke = await readFile(datei, 'utf8');
		expect(mitLuecke).toContain('luecken="44"');
		await expect(material(page).locator('.luecke')).toHaveCount(1);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-rechenstrich'));
		await druecke(page.getByRole('button', { name: 'Zeile hinzufügen' }));
		const neu = page.getByLabel('Sprung in Zeile 3');
		await neu.fill('+5');
		await neu.press('Enter');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('spruenge="+30 +4 +5"');
		await expect(material(page).locator('.strich-wert')).toHaveCount(4);
	});

	test('Zahlen: Art und Ausschnitt nehmen mit, was sie brauchen, die Felder zeigen es (084)', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-zwanzigerfeld n="13"></x-zwanzigerfeld>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');

		await druecke(material(page).locator('x-zwanzigerfeld'));
		await page.locator('[data-feld="art"] select').selectOption({ label: 'Fünferfeld' });
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toMatch(/<x-zwanzigerfeld [^>]*art="fuenfer"/);
		expect(await readFile(datei, 'utf8')).toMatch(/<x-zwanzigerfeld [^>]*n="3"/);
		await expect(page.locator('[data-feld="n"] input')).toHaveValue('3');
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		await expect(material(page).locator('x-zwanzigerfeld circle')).toHaveCount(3);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-zwanzigerfeld[^>]*><\/x-zwanzigerfeld>/,
				'<x-hundertertafel luecken="7 23" markiert="5 45"></x-hundertertafel>',
			),
		);
		await gespeichert(page, datei);
		await druecke(material(page).locator('x-hundertertafel'));
		await page.locator('[data-feld="ausschnitt"] select').selectOption({ label: 'Kreuz' });
		await gespeichert(page, datei);
		const kreuz = await readFile(datei, 'utf8');
		expect(kreuz).toMatch(/<x-hundertertafel [^>]*mitte="45"/);
		expect(kreuz).toMatch(/<x-hundertertafel [^>]*markiert="45"/);
		expect(kreuz).not.toContain('luecken="');
		await expect(page.locator('[data-feld="mitte"] input')).toHaveValue('45');
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		await expect(material(page).locator('.tafel-zelle')).toHaveCount(5);
	});
});

test.describe('Rechenformate (028)', () => {
	const felder = (seite: Page) =>
		seite
			.locator('.rechenfeld')
			.evaluateAll((l) => l.map((e) => `${e.getAttribute('data-id')}=${(e.textContent ?? '').trim()}`).sort());

	test('Zahlenmauer 3 5 2: Lösung 8, 7, 15, Raum und Eindeutigkeit werden geprüft', async ({ page }) => {
		const tag = '<x-zahlenmauer basis="3 5 2"></x-zahlenmauer>';
		expect(await felder(await gezeichnet(page, tag))).toEqual(['0-0=3', '0-1=5', '0-2=2', '1-0=', '1-1=', '2-0=']);
		expect(await felder(await gezeichnet(page, tag, 'kl3 sw loesung'))).toEqual([
			'0-0=3',
			'0-1=5',
			'0-2=2',
			'1-0=8',
			'1-1=7',
			'2-0=15',
		]);
		const decke = await gezeichnet(
			page,
			'<x-zahlenmauer basis="3 5 2" offen="0-0 0-1 0-2 1-0 1-1"></x-zahlenmauer>',
		);
		await expect(decke.locator('x-zahlenmauer')).toHaveAttribute('data-fehler', /mehrere Lösungen/);
		const raum = await gezeichnet(page, '<x-zahlenmauer basis="6 6 7"></x-zahlenmauer>', 'kl1 sw');
		await expect(raum.locator('x-zahlenmauer')).toHaveAttribute('data-fehler', /über 20/);
	});

	test('Zauberdreieck mit Summe 9 und zwei Ecken ist eindeutig, Rad mit Rest wird abgelehnt', async ({ page }) => {
		const tag = '<x-zauberdreieck summe="9" vorgegeben="e0 e1"></x-zauberdreieck>';
		const blatt = await gezeichnet(page, tag, 'kl3 sw loesung');
		await expect(blatt.locator('x-zauberdreieck')).toHaveAttribute('data-loesungen', '1');
		const w = await blatt
			.locator('.rechenfeld')
			.evaluateAll((l) =>
				Object.fromEntries(
					l.map((e) => [e.getAttribute('data-id') ?? '', Number(e.getAttribute('data-wert'))] as const),
				),
			);
		expect((w.e0 ?? 0) + (w.s0 ?? 0) + (w.e1 ?? 0)).toBe(9);
		expect((w.e1 ?? 0) + (w.s1 ?? 0) + (w.e2 ?? 0)).toBe(9);
		expect((w.e2 ?? 0) + (w.s2 ?? 0) + (w.e0 ?? 0)).toBe(9);
		const offen = await gezeichnet(page, '<x-zauberdreieck summe="9"></x-zauberdreieck>');
		await expect(offen.locator('x-zauberdreieck')).toHaveAttribute('data-fehler', /mehrere Lösungen/);
		const forscher = await gezeichnet(page, '<x-zauberdreieck></x-zauberdreieck>', 'kl3 sw loesung');
		await expect(forscher.locator('x-zauberdreieck')).toContainText('eine von 24 Lösungen');
		const rad = await gezeichnet(page, '<x-rechenrad mitte=":4" zahlen="4 8 12 16 20 25"></x-rechenrad>');
		await expect(rad.locator('x-rechenrad')).toHaveAttribute('data-fehler', /ohne Rest/);
		const haus = await gezeichnet(page, '<x-zahlenhaus dach="7" zerlegungen="3 5"></x-zahlenhaus>');
		await expect(haus.locator('x-zahlenhaus')).toHaveAttribute('data-fehler', /ergeben nicht 7/);
	});

	test('Panel: Stein antippen und Basis ändern sind je ein Schritt, Mehrdeutiges sperrt', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(/<x-uhr[^>]*><\/x-uhr>/, '<x-zahlenmauer basis="3 5 2"></x-zahlenmauer>'),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');

		await druecke(material(page).locator('x-zahlenmauer'));
		const stein = (nr: string) => page.locator(`[data-form-raster="offen"] [data-zelle="${nr}"]`);
		await expect(stein('2-0')).toHaveAttribute('aria-pressed', 'true');
		await expect(stein('2-0')).toContainText('15');
		await druecke(stein('2-0'));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('offen="1-0 1-1"');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
		await expect(material(page).locator('x-zahlenmauer')).not.toHaveAttribute('offen');

		await druecke(material(page).locator('x-zahlenmauer'));
		await expect(stein('2-0')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByLabel('Unterste Reihe')).toHaveValue('3 5 2');
		await page.getByLabel('Unterste Reihe').fill('4 5 2');
		await page.getByLabel('Unterste Reihe').press('Enter');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('basis="4 5 2"');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
		await expect(material(page).locator('x-zahlenmauer')).toHaveAttribute('basis', '3 5 2');

		await druecke(material(page).locator('x-zahlenmauer'));
		await druecke(stein('0-0'));
		await expect(page.locator('[data-fehler="_element"]')).toContainText('mehrere Lösungen');
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});
});

test.describe('Rechnen: Wahlen nehmen mit, was sie brauchen (084)', () => {
	const mitTag = async (page: Page, tag: string) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(page, (await quelle(page)).replace(/<x-uhr[^>]*><\/x-uhr>/, tag));
		await gespeichert(page, datei);
		return { datei, stand: await readFile(datei, 'utf8') };
	};

	test('Zahlenmauer: Minus stellt die Reihe um, ein Schritt zurück stellt alles her', async ({ druecke, page }) => {
		const { datei, stand } = await mitTag(page, '<x-zahlenmauer basis="3 5 2"></x-zahlenmauer>');
		await druecke(material(page).locator('x-zahlenmauer'));
		await page.locator('[data-feld="art"] select').selectOption({ label: 'Minus' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		expect(await readFile(datei, 'utf8')).toMatch(/<x-zahlenmauer [^>]*basis="5 3 2"/);
		await expect(page.getByLabel('Unterste Reihe')).toHaveValue('5 3 2');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});

	test('Rechenreihe: Rechenart, Reihe, Rest und Zahlenraum gehen vom Starter aus', async ({ druecke, page }) => {
		const { datei } = await mitTag(
			page,
			'<x-rechenreihe rechenart="+" zahlenraum="20" anzahl="8" uebergang="mit" aufgaben="7 + 5 = _; 8 + 6 = _"></x-rechenreihe>',
		);
		await druecke(material(page).locator('x-rechenreihe'));
		const feld = (name: string) => page.locator(`[data-feld="${name}"] select`);
		const tag = async () => /<x-rechenreihe[^>]*>/.exec(await readFile(datei, 'utf8'))?.[0] ?? '';

		await feld('zahlenraum').selectOption({ label: 'bis 10' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		expect(await tag()).toContain('zahlenraum="10"');
		expect(await tag()).not.toContain('uebergang=');

		await feld('zahlenraum').selectOption({ label: 'bis 20' });
		await feld('uebergang').selectOption({ label: 'Mit Übergang' });
		await feld('rechenart').selectOption({ label: 'Mal' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		expect(await tag()).not.toContain('uebergang=');

		await feld('reihe').selectOption({ label: '7er-Reihe' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		expect(await tag()).toContain('zahlenraum="100"');
		expect(await tag()).toContain('reihe="7"');

		await feld('rechenart').selectOption({ label: 'Plus' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		expect(await tag()).not.toContain('reihe=');
	});

	test('Rechenkette: Die Meldung sagt, was vorgegeben sein muss', async ({ druecke, page }) => {
		await mitTag(page, '<x-zahlenkette start="8" operatoren="+5 −3 ·2"></x-zahlenkette>');
		await druecke(material(page).locator('x-zahlenkette'));
		const haken = (name: string) => page.locator('[data-feld="zeige"]').getByRole('switch', { name, exact: true });
		await druecke(haken('Start'));
		await expect(page.locator('[data-fehler="_element"]')).toContainText('der Start, das Ziel oder die Zwischenergebnisse');
		await druecke(haken('Start'));
		await druecke(haken('Rechenschritte'));
		await expect(page.locator('[data-fehler="_element"]')).toContainText(
			'Gib auch die Rechenschritte oder die Zwischenergebnisse vor.',
		);
	});

	test('Zauberdreieck: Das magische Quadrat nimmt seine Summe und Vorgaben mit', async ({ druecke, page }) => {
		const { datei, stand } = await mitTag(page, '<x-zauberdreieck summe="9" vorgegeben="e0 e1"></x-zauberdreieck>');
		await druecke(material(page).locator('x-zauberdreieck'));
		await page.locator('[data-feld="art"] select').selectOption({ label: 'Magisches Quadrat (9 Zahlen)' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		const neu = await readFile(datei, 'utf8');
		expect(neu).toMatch(/<x-zauberdreieck [^>]*summe="15"/);
		expect(neu).toMatch(/<x-zauberdreieck [^>]*vorgegeben="z0 z4 z5"/);
		await expect(material(page).locator('x-zauberdreieck .rechenfeld')).toHaveCount(9);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});
});

test.describe('Geometrie: Wahlen nehmen mit, was sie brauchen (084)', () => {
	const mitTag = async (page: Page, tag: string) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(page, (await quelle(page)).replace(/<x-uhr[^>]*><\/x-uhr>/, tag));
		await gespeichert(page, datei);
		return { datei, stand: await readFile(datei, 'utf8') };
	};
	const STARTER =
		'<x-gitter spalten="12" zeilen="6" aufgabe="spiegeln" achse="senkrecht" achse-bei="6" figur="0 0 0 0 0 0 / 0 0 0 1 1 1 / 0 0 1 1 0 0 / 0 1 1 1 0 0 / 0 0 0 1 1 1 / 0 0 0 0 0 0"></x-gitter>';

	test('Gitter: Fortsetzen und Vergrößern gehen vom Starter aus, ein Schritt zurück stellt alles her', async ({
		druecke,
		page,
	}) => {
		const { datei, stand } = await mitTag(page, STARTER);
		await druecke(material(page).locator('x-gitter'));
		const aufgabe = page.locator('[data-feld="aufgabe"] select');
		await aufgabe.selectOption({ label: 'Fortsetzen' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		expect(await readFile(datei, 'utf8')).toMatch(/<x-gitter [^>]*spalten="24"/);
		await expect(page.locator('[data-feld="spalten"] input')).toHaveValue('24');
		await expect(page.locator('[data-feld="rapport"] input')).toHaveValue('6');
		await page.locator('[data-feld="rapportart"] select').selectOption({ label: 'Drehen im Wechsel' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-gitter'));
		await aufgabe.selectOption({ label: 'Vergrößern' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		const tag = /<x-gitter[^>]*>/.exec(await readFile(datei, 'utf8'))?.[0] ?? '';
		expect(tag).toContain('zeilen="8"');
		expect(tag).not.toContain('achse');
		await expect(material(page).locator('x-gitter .achse')).toHaveCount(0);
		await expect(page.locator('[data-feld="faktor"] option')).toHaveText(['Doppelt so groß', 'Halb so groß']);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});

	test('Gitter: Die Meldung nennt die nötige Größe in Zahlen', async ({ page }) => {
		const klein = await gezeichnet(page, '<x-gitter spalten="2" zeilen="1" figur="0 0 1 / 0 0 0 / 1 0 0"></x-gitter>');
		await expect(klein.locator('x-gitter')).toHaveAttribute('data-fehler', /3 Spalten und 3 Zeilen/);
		const ziel = await gezeichnet(
			page,
			'<x-gitter spalten="4" zeilen="2" aufgabe="vergroessern" figur="1 1 / 1 1"></x-gitter>',
			'kl3 sw',
		);
		await expect(ziel.locator('x-gitter')).toHaveAttribute('data-fehler', /4 Spalten und 4 Zeilen/);
	});

	test('Würfelgebäude: Eine Frage nimmt die Vorgabe weg, jede Wahl unter „Gefragt“ geht', async ({ druecke, page }) => {
		const { datei, stand } = await mitTag(
			page,
			'<x-wuerfelbau bauplan="2 1 / 3 1" zeige="schraegbild bauplan vorne rechts links oben"></x-wuerfelbau>',
		);
		const gefragt = page.locator('[data-feld="fragen"]');
		for (const name of ['Bauplan', 'Ansicht von vorne', 'Ansicht von rechts', 'Ansicht von links', 'Ansicht von oben']) {
			await druecke(material(page).locator('x-wuerfelbau'));
			await druecke(gefragt.getByRole('switch', { name, exact: true }));
			await gespeichert(page, datei);
			await expect(page.locator('[data-fehler]')).toHaveCount(0);
			await druecke(zurueck(page));
			await gespeichert(page, datei);
			expect(await readFile(datei, 'utf8')).toBe(stand);
		}
		await druecke(material(page).locator('x-wuerfelbau'));
		await druecke(gefragt.getByRole('switch', { name: 'Bauplan', exact: true }));
		await gespeichert(page, datei);
		const tag = /<x-wuerfelbau[^>]*>/.exec(await readFile(datei, 'utf8'))?.[0] ?? '';
		expect(tag).toContain('fragen="bauplan"');
		expect(tag).toContain('zeige="schraegbild vorne rechts links oben"');
		await expect(material(page).locator('x-wuerfelbau .verdeckt').first()).toBeAttached();
	});

	test('Würfelbau: Die Meldung zum verdeckten Würfel nennt den Ausweg', async ({ page }) => {
		const blatt = await gezeichnet(page, '<x-wuerfelbau bauplan="2 1 / 3 1" fragen="anzahl"></x-wuerfelbau>');
		await expect(blatt.locator('x-wuerfelbau')).toHaveAttribute('data-fehler', /Zeige die verdeckten Würfel/);
	});

	test('Würfelnetz: „Kein Netz“ setzt die Aufgabe, der Quader seine Maße', async ({ druecke, page }) => {
		const { datei, stand } = await mitTag(page, '<x-wuerfelnetz netz="3" aufgabe="gegenueber" markiere="2"></x-wuerfelnetz>');
		await druecke(material(page).locator('x-wuerfelnetz'));
		await page.locator('[data-feld="netz"] select').selectOption({ label: 'Kein Netz 3' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		expect(await readFile(datei, 'utf8')).toMatch(/<x-wuerfelnetz [^>]*aufgabe="netz-oder-nicht"/);
		await expect(page.locator('[data-feld="markiere"]')).toHaveCount(0);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-wuerfelnetz'));
		await page.locator('[data-feld="art"] select').selectOption({ label: 'Quader' });
		await gespeichert(page, datei);
		await expect(page.locator('[data-fehler]')).toHaveCount(0);
		expect(await readFile(datei, 'utf8')).toMatch(/<x-wuerfelnetz [^>]*masse="4 2 1"/);
		await expect(page.getByLabel('Maße des Quaders')).toHaveValue('4 2 1');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});

	test('Körper: Die Maße wirken auch bei Kugel und Kegel', async ({ page }) => {
		const breite = async (tag: string) =>
			(await gezeichnet(page, tag)).locator('svg').first().getAttribute('width');
		expect(await breite('<x-koerper form="kugel" masse="2"></x-koerper>')).not.toBe(
			await breite('<x-koerper form="kugel" masse="4"></x-koerper>'),
		);
		expect(await breite('<x-koerper form="kegel" masse="2 3"></x-koerper>')).not.toBe(
			await breite('<x-koerper form="kegel" masse="4 3"></x-koerper>'),
		);
	});
});

test.describe('Einmaleins und schriftliches Rechnen (029)', () => {
	const ziffern = (seite: Page, rolle: string) =>
		seite.locator(`.stelle[data-rolle="${rolle}"]`).evaluateAll((l) =>
			l
				.filter((e) => (e.textContent ?? '') !== '')
				.map((e) => e.textContent ?? '')
				.join(''),
		);

	test('Punktfeld und Malkreuz: Teilaufgaben und Offenes erst in der Lösung', async ({ page }) => {
		const feld = '<x-punktfeld zeilen="6" spalten="7" trenner="5" loesung="ja"></x-punktfeld>';
		const blatt = await gezeichnet(page, feld);
		await expect(blatt.locator('.punkt')).toHaveCount(42);
		await expect(blatt.locator('.trennlinie')).toHaveCount(0);
		await expect(blatt.locator('x-punktfeld')).not.toContainText('5 · 7');
		const loesung = await gezeichnet(page, feld, 'kl3 sw loesung');
		await expect(loesung.locator('.trennlinie')).toHaveCount(1);
		await expect(loesung.locator('x-punktfeld')).toContainText('5 · 7 + 1 · 7');
		const zuViel = await gezeichnet(page, '<x-punktfeld zeilen="6" spalten="7" trenner="6"></x-punktfeld>');
		await expect(zuViel.locator('x-punktfeld')).toHaveAttribute('data-fehler', /innerhalb des Feldes/);

		const kreuz = '<x-malkreuz a="23" b="45"></x-malkreuz>';
		const offen = await gezeichnet(page, kreuz, 'kl4 sw');
		await expect(offen.locator('.rechenfeld[data-id="s0"]')).toHaveText('20');
		await expect(offen.locator('.rechenfeld[data-id="p0-0"]')).toHaveText('');
		const voll = await gezeichnet(page, kreuz, 'kl4 sw loesung');
		await expect(voll.locator('.rechenfeld[data-id="p0-0"]')).toHaveText('800');
		await expect(voll.locator('.rechenfeld[data-id="summe"]')).toHaveText('1035');
	});

	test('Schriftlich: 0,5 cm im Druckmaß, Ziffern mittig, Lösung vollständig', async ({ page }) => {
		const tag = '<x-schriftlich art="minus" zahlen="903 478" verfahren="ergaenzen-erweitern"></x-schriftlich>';
		const blatt = await gezeichnet(page, tag);
		expect(await ziffern(blatt, 'ergebnis')).toBe('');
		expect(await ziffern(blatt, 'uebertrag')).toBe('');
		expect(await ziffern(blatt, 'aufgabe')).toBe('309874−');
		const lage = await blatt.locator('x-schriftlich').evaluate((el) => {
			const raster = el.querySelector('.karo')?.getBoundingClientRect();
			const wort = el.querySelector('.stelle[data-r="0"][data-c="1"] text')?.getBoundingClientRect();
			return {
				breite: raster?.width ?? 0,
				mitte: (wort?.left ?? 0) + (wort?.width ?? 0) / 2,
				links: raster?.left ?? 0,
			};
		});
		const kaestchen = (0.5 * 96) / 2.54;
		expect(lage.breite / 4).toBeCloseTo(kaestchen, 1);
		expect(lage.mitte - lage.links).toBeCloseTo(kaestchen * 1.5, 0);
		const loesung = await gezeichnet(page, tag, 'kl3 sw loesung');
		expect(await ziffern(loesung, 'ergebnis')).toBe('524');
		expect(await ziffern(loesung, 'uebertrag')).toBe('11');

		const bund = await gezeichnet(
			page,
			tag.replace('ergaenzen-erweitern', 'abziehen-entbuendeln'),
			'kl3 sw loesung',
		);
		expect(await ziffern(bund, 'uebertrag')).toBe('1398');
		await expect(bund.locator('.durch')).toHaveCount(3);
		const fremd = await gezeichnet(
			page,
			'<x-schriftlich art="minus" zahlen="3 5" verfahren="abziehen-erweitern"></x-schriftlich>',
		);
		await expect(fremd.locator('x-schriftlich')).toHaveAttribute('data-fehler', /mindestens so groß/);
		const ohne = await gezeichnet(page, '<x-schriftlich art="minus" zahlen="9 5"></x-schriftlich>');
		await expect(ohne.locator('x-schriftlich')).toHaveAttribute('data-fehler', /Verfahren/);
		const klasse = await gezeichnet(page, '<x-schriftlich zahlen="800 700"></x-schriftlich>');
		await expect(klasse.locator('x-schriftlich')).toHaveAttribute('data-fehler', /über 1000/);
	});

	test('Fehler zum Finden: Blatt und Lösung passen zusammen, anderer seed ändert ihn', async ({ page }) => {
		const tag = (seed: number) =>
			`<x-schriftlich art="plus" zahlen="478 356 7" fehlerhaft="ja" seed="${seed}"></x-schriftlich>`;
		const blatt = await gezeichnet(page, tag(1));
		const falsch = await blatt.locator('x-schriftlich').getAttribute('data-falsch');
		expect(falsch).not.toBe('841');
		await expect(blatt.locator('.fehlerkreis')).toHaveCount(0);
		const ergebnis = await ziffern(blatt, 'ergebnis');
		const loesung = await gezeichnet(page, tag(1), 'kl3 sw loesung');
		await expect(loesung.locator('x-schriftlich')).toHaveAttribute('data-falsch', falsch ?? '');
		expect(await ziffern(loesung, 'ergebnis')).toBe(ergebnis);
		expect(await loesung.locator('.fehlerkreis').count()).toBeGreaterThan(0);
		await expect(loesung.locator('x-schriftlich')).toContainText('Richtig: 478 + 356 + 7 = 841');
		const andere = new Set<string | null>([falsch]);
		for (let seed = 2; seed < 12; seed++) {
			const neu = await gezeichnet(page, tag(seed));
			andere.add(await neu.locator('x-schriftlich').getAttribute('data-falsch'));
		}
		expect(andere.size).toBeGreaterThan(1);
	});

	test('Panel: Zahl ändern rechnet neu, Verfahren wechseln, je ein Rückgängig-Schritt', async ({ druecke, page }) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-schriftlich art="minus" zahlen="93 48" verfahren="abziehen-entbuendeln"></x-schriftlich>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');
		const element = material(page).locator('x-schriftlich');

		await druecke(element);
		const info = page.locator('[data-abbildung-info]');
		await expect(info).toContainText('Ergebnis: 45');
		await page.getByLabel('Zahlen').fill('93 50');
		await page.getByLabel('Zahlen').press('Enter');
		await gespeichert(page, datei);
		await expect(info).toContainText('Ergebnis: 43');
		await expect(element).toHaveAttribute('data-ergebnis', '43');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
		await expect(element).toHaveAttribute('data-ergebnis', '45');

		await druecke(element);
		await expect(page.getByLabel('Zahlen')).toHaveValue('93 48');
		await page.getByLabel('Verfahren bei Minus', { exact: true }).selectOption({ label: 'Ergänzen, Erweitern' });
		await gespeichert(page, datei);
		await expect(element).toHaveAttribute('verfahren', 'ergaenzen-erweitern');
		await expect(info).toContainText('8 + 5 = 13, 1 gemerkt');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(element);
		await page.getByLabel('Zahlen').fill('5 9');
		await page.getByLabel('Zahlen').press('Enter');
		await expect(page.locator('[data-fehler="zahlen"]')).toContainText('mindestens so groß');
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});
});

test.describe('Größen (030)', () => {
	const cmPx = 96 / 2.54;

	test('Geld: echte Verhältnisse, Scheine höchstens 75 %, Betrag und Legen', async ({ page }) => {
		const blatt = await gezeichnet(page, '<x-geld stuecke="1ct 5ct 10ct 2€ 200€" massstab="original"></x-geld>');
		const mass = async (name: string, a: string) =>
			Number(await blatt.locator(`[data-stueck="${name}"]`).getAttribute(a));
		expect(await mass('10ct', 'data-d')).toBeLessThan(await mass('5ct', 'data-d'));
		expect((await mass('2€', 'data-d')) / (await mass('1ct', 'data-d'))).toBeCloseTo(25.75 / 16.25, 2);
		expect(await mass('2€', 'data-d')).toBeCloseTo(2.575 * cmPx, 0);
		expect(await mass('200€', 'data-b')).toBeLessThanOrEqual(15.3 * cmPx * 0.75 + 0.1);
		await expect(blatt.locator('x-geld')).toHaveAttribute('data-masstab', '');
		await expect(blatt.locator('[data-stueck="200€"]')).toContainText('Spielgeld');

		const betrag = '<x-geld stuecke="2€ 1€ 20ct 20ct 5ct" aufgabe="betrag"></x-geld>';
		await expect((await gezeichnet(page, betrag)).locator('x-geld')).not.toContainText('3,45');
		await expect((await gezeichnet(page, betrag, 'kl3 sw loesung')).locator('x-geld')).toContainText('3,45 €');
		await expect((await gezeichnet(page, betrag, 'kl2 sw loesung')).locator('x-geld')).toContainText('3 € 45 ct');
		const legen = await gezeichnet(page, '<x-geld aufgabe="legen" betrag="3,45"></x-geld>', 'kl3 sw loesung');
		await expect(legen.locator('x-geld')).toHaveAttribute('data-stueckelung', '2€ 1€ 20ct 20ct 5ct');
		await expect(legen.locator('.stueck')).toHaveCount(5);
		const nicht = await gezeichnet(page, '<x-geld stuecke="20ct" aufgabe="legen" betrag="0,30"></x-geld>');
		await expect(nicht.locator('x-geld')).toHaveAttribute('data-fehler', /nicht legen/);
	});

	test('Skala und Strecke: Originalgröße, Wert erst in der Lösung, unpassende Einheit abgelehnt', async ({
		page,
	}) => {
		const lineal = await gezeichnet(page, '<x-skala von="0" bis="10" wert="7" aufgabe="ablesen"></x-skala>');
		await expect(lineal.locator('x-skala')).toHaveAttribute('data-masstab', '');
		await expect(lineal.locator('.marke')).toHaveCount(1);
		await expect(lineal.locator('x-skala')).not.toContainText('7 cm');
		const x = (w: string) =>
			lineal.locator(`.strich[data-wert="${w}"]`).evaluate((e) => e.getBoundingClientRect().left);
		expect((await x('1')) - (await x('0'))).toBeCloseTo(cmPx, 1);
		const zeichnen = '<x-skala art="thermometer" wert="-5" aufgabe="einzeichnen"></x-skala>';
		await expect((await gezeichnet(page, zeichnen)).locator('.pegel')).toHaveCount(0);
		await expect((await gezeichnet(page, zeichnen, 'kl3 sw loesung')).locator('.pegel')).toHaveCount(1);
		const falsch = await gezeichnet(page, '<x-skala art="lineal" einheit="°C"></x-skala>');
		await expect(falsch.locator('x-skala')).toHaveAttribute('data-fehler', /passt nicht/);
		const aussen = await gezeichnet(page, '<x-skala von="0" bis="10" wert="12"></x-skala>');
		await expect(aussen.locator('x-skala')).toHaveAttribute('data-fehler', /zwischen/);

		const strecke = await gezeichnet(page, '<x-strecke laenge="7" beschriftung="A B"></x-strecke>');
		await expect(strecke.locator('x-strecke')).toHaveAttribute('data-masstab', '');
		const breite = await strecke.locator('.strecke').evaluate((e) => e.getBoundingClientRect().width);
		expect(breite).toBeCloseTo(7 * cmPx, 0);
		const lang = await gezeichnet(page, '<x-strecke laenge="30"></x-strecke>');
		await expect(lang.locator('x-strecke')).toHaveAttribute('data-fehler', /passt in Originalgröße nicht/);
	});

	test('Kalender: Februar 2028 beginnt am Dienstag und hat 29 Tage, Lücken erst in der Lösung', async ({ page }) => {
		const tag = '<x-kalender monat="2" jahr="2028" luecken="8" markiert="14"></x-kalender>';
		const blatt = await gezeichnet(page, tag);
		await expect(blatt.locator('.kal-tag')).toHaveCount(29);
		await expect(blatt.locator('.kal-tag[data-tag="1"]')).toHaveAttribute('data-wt', '1');
		await expect(blatt.locator('.kal-tag[data-tag="8"]')).toHaveText('');
		await expect(blatt.locator('.kal-ring')).toHaveCount(1);
		const loesung = await gezeichnet(page, tag, 'kl3 sw loesung');
		await expect(loesung.locator('.kal-tag[data-tag="8"]')).toHaveText('8');
		const jahr = await gezeichnet(page, '<x-kalender art="jahr" jahr="2028"></x-kalender>');
		await expect(jahr.locator('.kal-monat')).toHaveCount(12);
		await expect(jahr.locator('.kal-tag')).toHaveCount(366);
	});

	test('Uhr digital und Sektor, Zeitspanne', async ({ page }) => {
		const uhr = await gezeichnet(page, '<x-uhr zeit="16:30" digital="ja" format="12" sektor="4:30-4:50"></x-uhr>');
		await expect(uhr.locator('.uhr-digital')).toHaveText('4:30');
		await expect(uhr.locator('.uhr-sektor')).toHaveCount(1);
		const nur = await gezeichnet(page, '<x-uhr loesung="4:30" digital="nur" sektor-loesung="4:30-4:50"></x-uhr>');
		await expect(nur.locator('.uhr-digital')).toHaveText('');
		const voll = await gezeichnet(
			page,
			'<x-uhr loesung="4:30" digital="ja" sektor-loesung="4:30-4:50"></x-uhr>',
			'kl3 sw loesung',
		);
		await expect(voll.locator('.uhr-digital')).toHaveText('04:30');
		await expect(voll.locator('.uhr-sektor')).toHaveCount(1);
		const zuLang = await gezeichnet(page, '<x-uhr sektor="4:00-5:30"></x-uhr>');
		await expect(zuLang.locator('x-uhr')).toHaveAttribute('data-fehler', /60 Minuten/);

		const spanne = '<x-zeitspanne von="8:20" bis="9:45"></x-zeitspanne>';
		const blatt = await gezeichnet(page, spanne);
		await expect(blatt.locator('.rechenfeld[data-id="o0"]')).toHaveText('8:20');
		await expect(blatt.locator('.rechenfeld[data-id="dauer"]')).toHaveText('');
		const loesung = await gezeichnet(page, spanne, 'kl3 sw loesung');
		await expect(loesung.locator('.rechenfeld[data-id="o1"]')).toHaveText('9:00');
		await expect(loesung.locator('.rechenfeld[data-id="dauer"]')).toHaveText('1 h 25 min');
		const nacht = '<x-zeitspanne von="23:30" bis="0:30"></x-zeitspanne>';
		await expect((await gezeichnet(page, nacht, 'kl2 sw')).locator('x-zeitspanne')).toHaveAttribute(
			'data-fehler',
			/Mitternacht/,
		);
		await expect(
			(await gezeichnet(page, nacht, 'kl3 sw loesung')).locator('.rechenfeld[data-id="dauer"]'),
		).toHaveText('1 h');
	});

	test('Panel: Münze hinzufügen, Wert ändern, Tag antippen, je ein Rückgängig-Schritt', async ({ druecke, page }) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-geld stuecke="1€"></x-geld><x-skala von="0" bis="10" wert="7"></x-skala><x-kalender monat="2" jahr="2028"></x-kalender>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');

		const geld = material(page).locator('x-geld');
		await druecke(geld);
		await expect(page.locator('[data-abbildung-info]')).toContainText('1 €');
		await druecke(page.getByRole('button', { name: 'Zeile hinzufügen' }));
		await gespeichert(page, datei);
		await expect(geld.locator('.stueck')).toHaveCount(2);
		expect(await readFile(datei, 'utf8')).toContain('stuecke="1€ 1€"');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		const skala = material(page).locator('x-skala');
		await druecke(skala);
		await page.getByLabel('Wert', { exact: true }).fill('4');
		await page.getByLabel('Wert', { exact: true }).press('Enter');
		await gespeichert(page, datei);
		await expect(skala).toHaveAttribute('data-wert', '4');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-kalender'));
		await druecke(page.locator('[data-form-raster="markiert"] [data-zelle="14"]'));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('markiert="14"');
		await expect(material(page).locator('.kal-ring')).toHaveCount(1);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});
});

test.describe('Lineatur und Silben (031)', () => {
	const cmPx = 96 / 2.54;
	const mitSchrift = async (page: Page, html: string) => {
		const ordner = await mkdtemp(path.join(tmpdir(), 'lineatur-'));
		const datei = path.join(ordner, 'blatt.html');
		const css = pathToFileURL(path.join(ASSETS, 'blatt.css')).href;
		const js = pathToFileURL(path.join(ASSETS, 'abbildungen.js')).href;
		await writeFile(
			datei,
			`<!doctype html><html><head><link rel="stylesheet" href="${css}"><script src="${js}"></script></head><body class="kl2 sw">${html}</body></html>`,
		);
		const seite = await page.context().newPage();
		await seite.goto(pathToFileURL(datei).href);
		return seite;
	};

	test('Lineatur 2: vier Linien im Abstand 4 mm, Originalgröße, Lösung erst im Lösungsblatt', async ({ page }) => {
		const tag = '<x-lineatur art="2" zeilen="2" vorlage="Rosine" loesung="Der Hund."></x-lineatur>';
		const blatt = await gezeichnet(page, tag);
		await expect(blatt.locator('x-lineatur')).toHaveAttribute('data-masstab', '');
		const lagen = await blatt
			.locator('.linie[data-z="0"]')
			.evaluateAll((l) => l.map((e) => e.getBoundingClientRect().top));
		expect(lagen).toHaveLength(4);
		lagen.slice(1).forEach((y, i) => {
			expect(y - (lagen[i] ?? 0)).toBeCloseTo(0.4 * cmPx, 1);
		});
		await expect(blatt.locator('.loesungstext')).toHaveCount(0);
		await expect(blatt.locator('.vorlage text')).toHaveAttribute('fill', '#808080');
		await expect((await gezeichnet(page, tag, 'kl2 sw loesung')).locator('.loesungstext')).toHaveText('Der Hund.');
		const lang =
			'<x-lineatur art="1" vorlage="Dieser Satz ist für eine einzige Schreibzeile viel zu lang."></x-lineatur>';
		await expect((await gezeichnet(page, lang)).locator('x-lineatur')).toHaveAttribute('data-fehler', /zu lang/);
		const voll = '<x-lineatur art="karo" zeilen="1" breite="200" vorlage="Rosine am Morgen"></x-lineatur>';
		await expect((await gezeichnet(page, voll)).locator('x-lineatur')).toHaveAttribute('data-fehler', /zu lang/);
	});

	test('Nachspurwort: x-Höhe genau im Mittelband, Grundlinie auf der Grundlinie', async ({ page }) => {
		const blatt = await mitSchrift(page, '<x-lineatur art="2" zeilen="1" vorlage="xxx"></x-lineatur>');
		const m = await blatt.locator('x-lineatur').evaluate(async (el) => {
			await document.fonts.load('100px Andika');
			const wort = el.querySelector('.vorlage text');
			const groesse = Number(wort?.getAttribute('font-size'));
			const zeichnung = document.createElement('canvas').getContext('2d');
			if (!zeichnung) {
				throw new Error('Kein Canvas');
			}
			zeichnung.font = '1000px Andika';
			const lage = (name: string) =>
				el.querySelector(`.linie[data-art="${name}"]`)?.getBoundingClientRect().top ?? 0;
			return {
				band: lage('grund') - lage('mitte'),
				grund: Number(el.querySelector('.linie[data-art="grund"]')?.getAttribute('y1')),
				y: Number(wort?.getAttribute('y')),
				x: (zeichnung.measureText('x').actualBoundingBoxAscent / 1000) * groesse,
			};
		});
		expect(Math.abs(m.x - m.band)).toBeLessThan(0.02 * cmPx);
		expect(m.y).toBe(m.grund);
	});

	test('Mittelband getönt nur im Farbprofil', async ({ page }) => {
		const tag = '<x-lineatur art="1" zeilen="1" mittelband="getoent"></x-lineatur>';
		await expect((await gezeichnet(page, tag)).locator('.getoent')).toHaveCount(0);
		await expect((await gezeichnet(page, tag, 'kl1 farbe')).locator('.getoent')).toHaveCount(1);
	});

	test('Silben: Marke und Fett bleiben im Bild, je Silbe; Zahlen stehen ohne Bogen', async ({ page }) => {
		const seite = await gezeichnet(page, '<x-silben>Um 8 B<mark>ie</mark>|<b>ne</b></x-silben>');
		await expect(seite.locator('x-silben')).not.toHaveAttribute('data-fehler');
		await expect(seite.locator('x-silben')).toHaveText('Um 8 Biene');
		await expect(seite.locator('.silbe mark')).toHaveText('ie');
		await expect(seite.locator('.silbe b')).toHaveText('ne');
		await expect(seite.locator('.silbe')).toHaveCount(3);
	});

	test('Silben: s/w Bögen, Farbe blau-rot-blau, Aufgaben erst in der Lösung', async ({ page }) => {
		const tag = '<x-silben>Ro|si|ne</x-silben>';
		const sw = await gezeichnet(page, tag);
		await expect(sw.locator('.silbe')).toHaveCount(3);
		await expect(sw.locator('.bogen')).toHaveCount(3);
		const bunt = await gezeichnet(page, '<x-silben darstellung="farbe">Ro|si|ne</x-silben>', 'kl2 farbe');
		await expect(bunt.locator('.bogen')).toHaveCount(0);
		expect(await bunt.locator('.silbe').evaluateAll((l) => l.map((e) => e.getAttribute('data-farbe')))).toEqual([
			'blau',
			'rot',
			'blau',
		]);
		const swFarbe = await gezeichnet(page, '<x-silben darstellung="farbe">Ro|si|ne</x-silben>');
		await expect(swFarbe.locator('.bogen')).toHaveCount(3);

		const boegen = '<x-silben aufgabe="boegen">Ta|fel</x-silben>';
		await expect((await gezeichnet(page, boegen)).locator('.bogen')).toHaveCount(0);
		await expect((await gezeichnet(page, boegen, 'kl2 sw loesung')).locator('.bogen')).toHaveCount(2);
		const trennen = '<x-silben aufgabe="trennen">Ta|fel</x-silben>';
		await expect((await gezeichnet(page, trennen)).locator('x-silben')).toHaveText('Tafel');
		await expect((await gezeichnet(page, trennen, 'kl2 sw loesung')).locator('x-silben')).toHaveText('Ta|fel');
		const unter = await mitSchrift(page, '<x-silben>gut pg</x-silben>');
		const lage = await unter
			.locator('.silbe')
			.first()
			.evaluate(async (e) => {
				await document.fonts.load('100px Andika');
				const marke = document.createElement('span');
				marke.style.cssText = 'display:inline-block;height:0;width:0';
				e.prepend(marke);
				const grundlinie = marke.getBoundingClientRect().bottom;
				marke.remove();
				const zeichnung = document.createElement('canvas').getContext('2d');
				if (!zeichnung) {
					throw new Error('Kein Canvas');
				}
				zeichnung.font = '1000px Andika';
				const groesse = Number.parseFloat(getComputedStyle(e).fontSize);
				return {
					bogen: e.querySelector('.bogen')?.getBoundingClientRect().top ?? 0,
					unterlaenge: grundlinie + (zeichnung.measureText('p').actualBoundingBoxDescent / 1000) * groesse,
				};
			});
		expect(lage.bogen).toBeGreaterThanOrEqual(lage.unterlaenge);
		const falsch = await gezeichnet(page, '<x-silben>Ro||si</x-silben>');
		await expect(falsch.locator('x-silben')).toHaveAttribute('data-fehler', /nebeneinander/);
	});

	test('Panel: Lineatur wechseln und Silbenstrich einfügen, je ein Rückgängig-Schritt', async ({ druecke, page }) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-lineatur art="1" zeilen="1"></x-lineatur><x-silben>Rosi|ne</x-silben>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');

		const linien = material(page).locator('x-lineatur');
		await druecke(linien);
		await page.getByLabel('Lineatur', { exact: true }).selectOption({ label: 'Lineatur 2' });
		await gespeichert(page, datei);
		await expect(linien).toHaveAttribute('art', '2');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
		await expect(linien).toHaveAttribute('art', '1');

		const silben = material(page).locator('x-silben');
		await druecke(silben);
		const feld = page.getByLabel('Text', { exact: true });
		await expect(feld).toHaveValue('Rosi|ne');
		await feld.evaluate((e: HTMLTextAreaElement) => {
			e.focus();
			e.setSelectionRange(2, 2);
		});
		await druecke(page.getByRole('button', { name: 'Silbenstrich einfügen' }));
		await expect(feld).toHaveValue('Ro|si|ne');
		await feld.press('Tab');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<x-silben>Ro|si|ne</x-silben>');
		await expect(silben.locator('.silbe')).toHaveCount(3);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
		await expect(silben.locator('.silbe')).toHaveCount(2);

		await druecke(silben);
		await feld.fill('Ro||si');
		await expect(page.locator('[data-fehler="inhalt"]')).toContainText('nebeneinander');
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});
});

test.describe('Sprache untersuchen (032)', () => {
	test('Wortarten: Symbole, Linien und Bestimmen', async ({ page }) => {
		const tag = '<x-wortarten>Der/Art Hund/N bellt/V laut/A heute.</x-wortarten>';
		const blatt = await gezeichnet(page, tag);
		await expect(blatt.locator('.wortart[data-wortart] svg:not(.wa-leer)')).toHaveCount(4);
		await expect(blatt.locator('.wortart')).toHaveCount(5);
		await expect(blatt.locator('x-wortarten')).toContainText('Der Hund bellt laut heute.');
		const formen = await blatt
			.locator('.wa-symbol')
			.evaluateAll((l) => l.map((e) => `${e.innerHTML}|${e.getAttribute('fill')}`));
		expect(new Set(formen).size).toBe(4);
		const nur = await gezeichnet(page, tag.replace('<x-wortarten>', '<x-wortarten nur="N V">'));
		await expect(nur.locator('.wa-symbol')).toHaveCount(2);

		const aufgabe = tag.replace('<x-wortarten>', '<x-wortarten aufgabe="bestimmen">');
		const blattAufgabe = await gezeichnet(page, aufgabe);
		await expect(blattAufgabe.locator('.wa-leer')).toHaveCount(4);
		await expect(blattAufgabe.locator('.wa-symbol:not(.wa-leer)')).toHaveCount(0);
		const loesung = await gezeichnet(page, aufgabe, 'kl3 sw loesung');
		await expect(loesung.locator('.wa-symbol:not(.wa-leer)')).toHaveCount(4);

		const linien = tag.replace('<x-wortarten>', '<x-wortarten darstellung="unterstreichen">');
		const stile = await (
			await gezeichnet(page, linien)
		)
			.locator('.wa-linie')
			.evaluateAll((l) => l.map((e) => getComputedStyle(e).textDecorationStyle));
		expect(stile).toEqual(['dotted', 'solid', 'wavy', 'dashed']);
		const farbe = await gezeichnet(
			page,
			tag.replace('<x-wortarten>', '<x-wortarten farben="V: blau">'),
			'kl3 farbe',
		);
		await expect(farbe.locator('[data-wortart="V"] .wa-symbol')).toHaveAttribute('stroke', '#1f4fb8');
		const falsch = await gezeichnet(page, '<x-wortarten>Der/X Hund.</x-wortarten>');
		await expect(falsch.locator('x-wortarten')).toHaveAttribute('data-fehler', /Kürzel/);
	});

	test('Satzglieder: Kästchen, Rollen, Umstellung nur in der Lösung', async ({ page }) => {
		const satz = '[Der Hund]S [bellt]P [den Briefträger]AkO [an]P.';
		const blatt = await gezeichnet(page, `<x-satzglieder>${satz}</x-satzglieder>`);
		await expect(blatt.locator('.sg-kasten')).toHaveCount(4);
		await expect(blatt.locator('.praedikat')).toHaveCount(2);
		await expect(blatt.locator('.sg-rolle').first()).toHaveText('Subjekt');

		const bestimmen = `<x-satzglieder aufgabe="bestimmen">${satz}</x-satzglieder>`;
		await expect((await gezeichnet(page, bestimmen)).locator('.sg-rolle.frei')).toHaveCount(4);
		const gelöst = await gezeichnet(page, bestimmen, 'kl3 sw loesung');
		await expect(gelöst.locator('.sg-rolle').nth(2)).toHaveText('Akkusativobjekt');
		const fragen = `<x-satzglieder aufgabe="fragen">${satz}</x-satzglieder>`;
		await expect((await gezeichnet(page, fragen, 'kl3 sw loesung')).locator('.sg-rolle').nth(2)).toHaveText(
			'Wen oder was?',
		);

		const um = `<x-satzglieder aufgabe="umstellen">${satz}</x-satzglieder>`;
		const leer = (await gezeichnet(page, um)).locator('.sg-umstellung');
		await expect(leer.locator('.sg-kasten')).toHaveCount(4);
		await expect(leer).toHaveText('');
		const voll = (await gezeichnet(page, um, 'kl3 sw loesung')).locator('.sg-umstellung');
		expect(await voll.locator('.sg-kasten').allTextContents()).toEqual([
			'Den Briefträger',
			'bellt',
			'der Hund',
			'an',
		]);

		const streifen = `<x-satzglieder ausschneiden="ja">${satz}</x-satzglieder>`;
		const geschnitten = await gezeichnet(page, streifen);
		await expect(geschnitten.locator('.schnitt')).toHaveCount(4);
		await expect(geschnitten.locator('.sg-rolle')).toHaveCount(0);
		const ohne = await gezeichnet(page, '<x-satzglieder>[Der Hund]S schläft.</x-satzglieder>');
		await expect(ohne.locator('x-satzglieder')).toHaveAttribute('data-fehler', /Prädikat/);
	});

	test('Wortbausteine: Stamm, Zerlegen, Zusammensetzen, Familie', async ({ page }) => {
		const wort = '<x-wortbausteine stamm="fahr">ver|fahr|en</x-wortbausteine>';
		const blatt = await gezeichnet(page, wort);
		await expect(blatt.locator('.wb-kasten')).toHaveCount(3);
		await expect(blatt.locator('.wb-kasten.stamm')).toHaveText('fahr');
		const falsch = await gezeichnet(page, '<x-wortbausteine stamm="lauf">ver|fahr|en</x-wortbausteine>');
		await expect(falsch.locator('x-wortbausteine')).toHaveAttribute('data-fehler', /keiner der Bausteine/);

		const zerlegen = '<x-wortbausteine aufgabe="zerlegen" stamm="fahr">ver|fahr|en</x-wortbausteine>';
		await expect((await gezeichnet(page, zerlegen)).locator('.wb-ganz')).toHaveText('verfahren');
		await expect((await gezeichnet(page, zerlegen, 'kl3 sw loesung')).locator('.wb-kasten')).toHaveCount(3);
		const setzen = '<x-wortbausteine aufgabe="zusammensetzen">ver|fahr|en</x-wortbausteine>';
		await expect((await gezeichnet(page, setzen)).locator('.wb-ergebnis')).toHaveText('');
		await expect((await gezeichnet(page, setzen, 'kl3 sw loesung')).locator('.wb-ergebnis')).toHaveText(
			'verfahren',
		);
		const familie =
			'<x-wortbausteine art="familie" aufgabe="familie" woerter="Fahrer; Abfahrt">fahr</x-wortbausteine>';
		await expect((await gezeichnet(page, familie)).locator('.wb-wort.leer')).toHaveCount(2);
		await expect((await gezeichnet(page, familie, 'kl3 sw loesung')).locator('.wb-wort').first()).toHaveText(
			'Fahrer',
		);
	});

	test('Panel: Wortart ändern und Wörter verbinden, je ein Rückgängig-Schritt', async ({ druecke, page }) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-wortarten>Der/Art Hund bellt/V.</x-wortarten><x-satzglieder>Der Hund [bellt]P.</x-satzglieder>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');

		const arten = material(page).locator('x-wortarten');
		await druecke(arten);
		await druecke(panel(page).locator('[data-chip="1"]'));
		await page.getByLabel('Wortart von „Hund“').selectOption({ label: 'Nomen' });
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('Der/Art Hund/N bellt/V.');
		await expect(arten.locator('[data-wortart="N"]')).toHaveCount(1);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(arten);
		const satzFeld = page.getByLabel('Satz', { exact: true });
		await expect(satzFeld).toHaveValue('Der Hund bellt.');
		await satzFeld.fill('Der Dackel bellt.');
		await satzFeld.blur();
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('Der/Art Dackel bellt/V.');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		const glieder = material(page).locator('x-satzglieder');
		await druecke(glieder);
		await druecke(panel(page).locator('[data-chip="0"]'));
		await druecke(page.getByRole('button', { name: 'Mit „Hund“ verbinden' }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('[Der Hund] [bellt]P.');
		await page.getByLabel('Satzglied von „Der“').selectOption({ label: 'Subjekt' });
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('[Der Hund]S [bellt]P.');
		await expect(glieder.locator('[data-rolle="S"]')).toHaveText('Der Hund');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});
});

test.describe('Sachunterricht: Zeit und Raum (033)', () => {
	const cmPxPlan = 96 / 2.54;
	const kasten = (t: string) => t.split(' ').map(Number) as [number, number, number, number];

	test('Zeitleiste maßstäblich, Beschriftungen ohne Überlappung', async ({ page }) => {
		const tag =
			'<x-zeitleiste von="1900" bis="2020" schritt="10" ereignisse="1914: Erster Weltkrieg; 1918: Kriegsende; 1969: Mondlandung; 1989: Mauerfall"></x-zeitleiste>';
		const blatt = await gezeichnet(page, tag);
		const lagen = await blatt.locator('.ereignis').evaluateAll((l) =>
			l.map((e) => ({
				jahr: Number(e.getAttribute('data-jahr')),
				x: Number(e.getAttribute('data-x')),
				box: e.getAttribute('data-box') ?? '',
			})),
		);
		expect(lagen.map((l) => l.jahr)).toEqual([1914, 1918, 1969, 1989]);
		const erstes = lagen[0];
		const letztes = lagen.at(-1);
		const proJahr = ((letztes?.x ?? 0) - (erstes?.x ?? 0)) / 75;
		for (const l of lagen) {
			expect(Math.abs(l.x - (erstes?.x ?? 0) - (l.jahr - 1914) * proJahr)).toBeLessThan(0.2);
		}
		for (const a of lagen) {
			for (const b of lagen) {
				if (a !== b) {
					const [ax, ay, aw, ah] = kasten(a.box);
					const [bx, by, bw, bh] = kasten(b.box);
					expect(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay).toBe(true);
				}
			}
		}
		const eng = await gezeichnet(
			page,
			'<x-zeitleiste von="1900" bis="2020" ereignisse="1914: A; 1915: B; 1916: C; 1917: D; 1918: E; 1919: F; 1920: G; 1921: H"></x-zeitleiste>',
		);
		await expect(eng.locator('x-zeitleiste')).toHaveAttribute('data-fehler', /zu dicht/);
	});

	test('Zeitleiste: offen, Zeitraum und v. Chr.', async ({ page }) => {
		const tag =
			'<x-zeitleiste von="-500" bis="500" schritt="100" ereignisse="-58-260: Römer am Rhein; 260: Alamannen: offen"></x-zeitleiste>';
		const blatt = await gezeichnet(page, tag);
		await expect(blatt.locator('.zeitraum')).toHaveCount(1);
		await expect(blatt.locator('[data-offen]')).not.toContainText('Alamannen');
		await expect(blatt.locator('.zl-liste')).toHaveText('Alamannen');
		await expect(blatt.locator('svg')).toContainText('500 v. Chr.');
		await expect((await gezeichnet(page, tag, 'kl3 sw loesung')).locator('[data-offen]')).toContainText(
			'Alamannen',
		);
		const ohne = await gezeichnet(page, '<x-zeitleiste von="-10" bis="10" ereignisse="0: Null"></x-zeitleiste>');
		await expect(ohne.locator('x-zeitleiste')).toHaveAttribute('data-fehler', /Jahr 0/);
	});

	test('Jahreskreis: Januar oben, im Uhrzeigersinn, Jahreszeiten meteorologisch', async ({ page }) => {
		const blatt = await gezeichnet(page, '<x-jahreskreis jahreszeiten="ja" markiert="Juli"></x-jahreskreis>');
		await expect(blatt.locator('.segment[data-nr="0"]')).toHaveAttribute('data-name', 'Januar');
		await expect(blatt.locator('.segment[data-nr="0"]')).toHaveAttribute('data-start', '0');
		await expect(blatt.locator('.segment[data-nr="3"]')).toHaveAttribute('data-start', '90');
		await expect(blatt.locator('.segment[data-markiert]')).toHaveAttribute('data-name', 'Juli');
		await expect(blatt.locator('.jahreszeit[data-zeit="Frühling"]')).toHaveCount(3);
		await expect(blatt.locator('.legende')).toHaveCount(4);
		const leer = '<x-jahreskreis beschriftung="leer" art="woche"></x-jahreskreis>';
		await expect((await gezeichnet(page, leer)).locator('.kreistext')).toHaveCount(0);
		await expect((await gezeichnet(page, leer, 'kl3 sw loesung')).locator('.kreistext')).toHaveCount(7);
		await expect(
			(await gezeichnet(page, '<x-jahreskreis art="stunden"></x-jahreskreis>')).locator('.segment'),
		).toHaveCount(24);
	});

	test('Windrose: deutsche Kürzel, leer erst in der Lösung', async ({ page }) => {
		const namen = async (html: string, klasse?: string) =>
			(await gezeichnet(page, html, klasse))
				.locator('.richtung')
				.evaluateAll((l) => l.map((e) => e.textContent ?? ''));
		expect(await namen('<x-windrose></x-windrose>')).toEqual(['N', 'O', 'S', 'W']);
		expect(await namen('<x-windrose richtungen="8"></x-windrose>')).toEqual([
			'N',
			'O',
			'S',
			'W',
			'NO',
			'SO',
			'SW',
			'NW',
		]);
		expect(await namen('<x-windrose beschriftung="norden"></x-windrose>')).toEqual(['N', '', '', '']);
		expect(await namen('<x-windrose beschriftung="leer"></x-windrose>', 'kl3 sw loesung')).toEqual([
			'N',
			'O',
			'S',
			'W',
		]);
	});

	test('Plan: Legende vollständig, Muster verschieden, Aufgaben', async ({ page }) => {
		const tag =
			'<x-plan spalten="4" zeilen="2" boden="wasser wald wiese strasse / leer platz leer leer" objekte="schule: A1; baum: B1 B2" massstab="1 Kästchen = 100 m"></x-plan>';
		const blatt = await gezeichnet(page, tag);
		expect(
			await blatt.locator('.legende').evaluateAll((l) => l.map((e) => e.getAttribute('data-legende')).sort()),
		).toEqual(['baum', 'platz', 'schule', 'strasse', 'wald', 'wasser', 'wiese'].sort());
		const fuellungen = await blatt.locator('.flaeche').evaluateAll((l) => l.map((e) => e.getAttribute('fill')));
		expect(new Set(fuellungen).size).toBe(5);
		await expect(blatt.locator('x-plan')).toHaveAttribute('data-masstab', '');
		const k = await blatt.locator('.massstabsleiste').getAttribute('data-laenge');
		expect(Number(k)).toBeCloseTo(1.2 * cmPxPlan, 0);
		await expect(blatt.locator('x-plan .massstabsleiste')).toContainText('100 m');
		const falsch = await gezeichnet(page, '<x-plan objekte="ufo: A1"></x-plan>');
		await expect(falsch.locator('x-plan')).toHaveAttribute('data-fehler', /Symbol/);

		const finden = '<x-plan aufgabe="finden" objekte="schule: B3"></x-plan>';
		await expect((await gezeichnet(page, finden)).locator('.planfrage')).not.toContainText('B3');
		await expect((await gezeichnet(page, finden, 'kl3 sw loesung')).locator('.planfrage')).toContainText('B3');
		const ein = '<x-plan aufgabe="einzeichnen" objekte="schule: B3"></x-plan>';
		await expect((await gezeichnet(page, ein)).locator('.flaeche, g.symbol:not(.legende g)')).toHaveCount(0);
		await expect((await gezeichnet(page, ein, 'kl3 sw loesung')).locator('g.symbol:not(.legende g)')).toHaveCount(
			1,
		);
		const weg = '<x-plan aufgabe="weg" weg="A1 A2 B2"></x-plan>';
		await expect((await gezeichnet(page, weg)).locator('.weg')).toHaveCount(0);
		await expect((await gezeichnet(page, weg)).locator('.wegmarke')).toHaveCount(2);
		await expect((await gezeichnet(page, weg, 'kl3 sw loesung')).locator('.weg')).toHaveCount(1);
		const schief = await gezeichnet(page, '<x-plan aufgabe="weg" weg="A1 C3"></x-plan>');
		await expect(schief.locator('x-plan')).toHaveAttribute('data-fehler', /nebeneinander/);
	});

	test('Panel: Ereignis hinzufügen, Kästchen belegen, je ein Rückgängig-Schritt', async ({ druecke, page }) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-zeitleiste ereignisse="1914: Krieg"></x-zeitleiste><x-plan spalten="3" zeilen="2"></x-plan>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');

		const leiste = material(page).locator('x-zeitleiste');
		await druecke(leiste);
		await druecke(page.getByRole('button', { name: 'Zeile hinzufügen' }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('ereignisse="1914: Krieg; 2000: Ereignis"');
		await expect(leiste.locator('.ereignis')).toHaveCount(2);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		const plan = material(page).locator('x-plan');
		await druecke(plan);
		await druecke(panel(page).locator('[data-plan-zelle="B2"]'));
		await page.getByLabel('Symbol in B2').selectOption({ label: 'Schule' });
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('objekte="schule: B2"');
		await expect(plan.locator('.legende[data-legende="schule"]')).toHaveCount(1);
		await page.getByLabel('Fläche in B2').selectOption({ label: 'Wiese' });
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('boden="leer leer leer / leer wiese leer"');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});
});

test.describe('Sachunterricht: Natur und Technik (034)', () => {
	test('Stromkreis: berechnet, ob die Lampe leuchtet, und meldet den Kurzschluss', async ({ page }) => {
		const kreis = (teile: string, dazu = '') =>
			`<x-schaltplan teile="${teile}" aufgabe="leuchtet"${dazu}></x-schaltplan>`;
		const offen = await gezeichnet(page, kreis('batterie schalter:offen lampe'), 'kl3 sw loesung');
		await expect(offen.locator('x-schaltplan')).toHaveAttribute('data-ergebnis', 'nein');
		await expect(offen.locator('.lichtstrahl')).toHaveCount(0);
		const zu = await gezeichnet(page, kreis('batterie schalter:zu lampe'), 'kl3 sw loesung');
		await expect(zu.locator('x-schaltplan')).toHaveAttribute('data-ergebnis', 'ja');
		await expect(zu.locator('.lichtstrahl')).toHaveCount(8);
		const aufgabe = await gezeichnet(page, kreis('batterie schalter:zu lampe'));
		await expect(aufgabe.locator('.lichtstrahl')).toHaveCount(0);
		const kurz = await gezeichnet(page, kreis('batterie lampe', ' zweig="kabel"'), 'kl3 sw loesung');
		await expect(kurz.locator('.kurzschluss')).toContainText('Kurzschluss: Batterie wird heiß');
		await expect(kurz.locator('.lichtstrahl')).toHaveCount(0);
		const ohne = await gezeichnet(page, '<x-schaltplan teile="schalter:zu lampe"></x-schaltplan>');
		await expect(ohne.locator('x-schaltplan')).toHaveAttribute('data-fehler', /Batterie/);
		const luecke = '<x-schaltplan teile="batterie lampe" aufgabe="vervollstaendigen"></x-schaltplan>';
		await expect((await gezeichnet(page, luecke)).locator('.kabel-loesung')).toHaveCount(0);
		await expect((await gezeichnet(page, luecke, 'kl3 sw loesung')).locator('.kabel-loesung')).toHaveCount(1);
	});

	test('Verkehrszeichen: Variante nach Druckprofil, unbekannte Nummer wird gemeldet', async ({ page }) => {
		const src = async (tag: string, klasse: string) =>
			(await gezeichnet(page, tag, klasse)).locator('img').getAttribute('src');
		expect(await src('<x-verkehrszeichen nummer="205"></x-verkehrszeichen>', 'kl3 sw')).toBe(
			'bilder/verkehrszeichen/205-grau.svg',
		);
		expect(await src('<x-verkehrszeichen nummer="205"></x-verkehrszeichen>', 'kl3 farbe')).toBe(
			'bilder/verkehrszeichen/205.svg',
		);
		const aus = '<x-verkehrszeichen nummer="306" ausmalen="ja"></x-verkehrszeichen>';
		expect(await src(aus, 'kl3 farbe')).toBe('bilder/verkehrszeichen/306-kontur.svg');
		expect(await src(aus, 'kl3 farbe loesung')).toBe('bilder/verkehrszeichen/306.svg');
		const falsch = await gezeichnet(page, '<x-verkehrszeichen nummer="999"></x-verkehrszeichen>');
		await expect(falsch.locator('x-verkehrszeichen')).toHaveAttribute('data-fehler', /999/);
	});

	test('Kreislauf: offene Stationen, Grenzen, Pfeile ohne Überschneidung', async ({ page }) => {
		const tag = (offen: string) =>
			`<x-kreislauf stationen="Meer; Wolken; Regen; Fluss" pfeile="verdunsten; ziehen; fließen; münden" offen="${offen}"></x-kreislauf>`;
		const blatt = await gezeichnet(page, tag('2 p3'));
		await expect(blatt.locator('.kl-station')).toHaveCount(4);
		await expect(blatt.locator('.kl-station.leer')).toHaveCount(1);
		await expect(blatt.locator('.kl-bogen')).toHaveCount(4);
		await expect(blatt.locator('.kl-kreis')).not.toContainText('fließen');
		const loesung = await gezeichnet(page, tag('2 p3'), 'kl3 sw loesung');
		await expect(loesung.locator('.kl-station.leer')).toHaveCount(0);
		await expect(loesung.locator('.kl-kreis')).toContainText('fließen');
		const zuWenig = await gezeichnet(page, '<x-kreislauf stationen="A; B"></x-kreislauf>');
		await expect(zuWenig.locator('x-kreislauf')).toHaveAttribute('data-fehler', /3 bis 8/);
		const ablauf = await gezeichnet(page, '<x-kreislauf art="ablauf" stationen="A; B; C"></x-kreislauf>');
		await expect(ablauf.locator('.kl-pfeil')).toHaveCount(2);
	});

	test('Wettersymbol und Temperaturverlauf mit deutlicher Null-Linie', async ({ page }) => {
		const geheim = '<x-wetter loesung="regen"></x-wetter>';
		await expect((await gezeichnet(page, geheim)).locator('.wetter-leer')).toHaveCount(1);
		await expect((await gezeichnet(page, geheim, 'kl3 sw loesung')).locator('x-wetter')).toHaveAttribute(
			'data-symbol',
			'regen',
		);
		const wind = await gezeichnet(page, '<x-wetter symbol="wolke" wind="3"></x-wetter>');
		await expect(wind.locator('.wetter-wind')).toHaveCount(3);
		const falsch = await gezeichnet(page, '<x-wetter symbol="hagel"></x-wetter>');
		await expect(falsch.locator('x-wetter')).toHaveAttribute('data-fehler', /hagel/);

		const linie = await gezeichnet(
			page,
			'<x-diagramm art="linie" werte="Mo: -5; Di: 0; Mi: 5" von="-10" bis="10" skala="5"></x-diagramm>',
		);
		await expect(linie.locator('.nulllinie')).toHaveAttribute('stroke-width', '3');
		await expect(linie.locator('circle.wert')).toHaveCount(3);
		await expect(linie.locator('polyline.verlauf')).toHaveCount(1);
		const leer = await gezeichnet(
			page,
			'<x-diagramm art="linie" werte="Mo; Di" von="-10" bis="30" skala="5"></x-diagramm>',
			'kl3 sw loesung',
		);
		await expect(leer.locator('circle.wert')).toHaveCount(0);
		const saeulen = await gezeichnet(page, '<x-diagramm werte="Mo: -5"></x-diagramm>');
		await expect(saeulen.locator('x-diagramm')).toHaveAttribute('data-fehler', /ab 0/);
	});

	test('Panel: Schalter schließen, Station mit Bild aus der Sammlung, je ein Rückgängig-Schritt', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				'<x-schaltplan teile="batterie schalter:offen lampe" aufgabe="leuchtet"></x-schaltplan><x-kreislauf stationen="A; B; C"></x-kreislauf><x-verkehrszeichen nummer="205"></x-verkehrszeichen>',
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');

		const kreis = material(page).locator('x-schaltplan');
		await expect(kreis).toHaveAttribute('data-ergebnis', 'nein');
		await druecke(kreis);
		await page.getByLabel('Teil in Zeile 2').first().selectOption({ label: 'Schalter zu' });
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('teile="batterie schalter:zu lampe"');
		await expect(kreis).toHaveAttribute('data-ergebnis', 'ja');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		const lauf = material(page).locator('x-kreislauf');
		await druecke(lauf);
		const zeile = panel(page).locator('[data-liste="stationen"] [data-zeile="0"]');
		await druecke(zeile.locator('[data-bild-knopf]').first());
		await druecke(page.getByRole('menuitem', { name: 'Aus der Sammlung' }));
		const dialog = page.getByRole('dialog', { name: 'Bild aus der Sammlung' });
		await druecke(dialog.locator('[data-sammlung-bild="_assets/bilder/wachstum.png"]'));
		await expect(dialog).toBeHidden();
		await expect.poll(() => readFile(datei, 'utf8')).toMatch(/stationen="A: [^;"]*wachstum[^;"]*\.png; B; C"/);
		await expect(lauf.locator('.kl-station img')).toHaveCount(1);
		await expect
			.poll(() => lauf.locator('.kl-station img').evaluate((b: HTMLImageElement) => b.naturalWidth))
			.toBeGreaterThan(0);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-verkehrszeichen'));
		const vorschau = panel(page).locator('img[data-vorschau="205"]');
		await expect.poll(() => vorschau.evaluate((b: HTMLImageElement) => b.naturalWidth)).toBeGreaterThan(0);
	});
});

/** Noten schreiben Oktaven mit Apostrophen; so bleiben sie lesbar. */
const T = String.raw;

test.describe('Musik (035)', () => {
	test('Rhythmus: Taktfehler, Silben, Aufgaben, Kopfgröße', async ({ page }) => {
		const falsch = await gezeichnet(page, '<x-rhythmus takt="4/4" noten="4 4 8 8 4 4 | 4 4 2"></x-rhythmus>');
		await expect(falsch.locator('x-rhythmus')).toHaveAttribute('data-fehler', /Takt 1 hat 5 Viertel statt 4/);
		const karte = await gezeichnet(
			page,
			'<x-rhythmus art="karte" takt="2/4" noten="4 8 8" silben="ta"></x-rhythmus>',
		);
		expect(Number(await karte.locator('x-rhythmus').getAttribute('data-kopf-mm'))).toBeGreaterThanOrEqual(8);
		await expect(karte.locator('.balken')).toHaveCount(1);
		expect(await karte.locator('.silbe').evaluateAll((l) => l.map((e) => e.getAttribute('data-silbe')))).toEqual([
			'ta',
			'ti',
			'ti',
		]);
		const zwei = await gezeichnet(page, '<x-rhythmus art="karte" takt="2/4" noten="4 4 | 2"></x-rhythmus>');
		await expect(zwei.locator('x-rhythmus')).toHaveAttribute('data-fehler', /genau einen Takt/);
		const liste = await gezeichnet(page, '<x-rhythmus takt="2/4" noten="4 4" silben="du"></x-rhythmus>');
		await expect(liste.locator('x-rhythmus')).toHaveAttribute('data-fehler', /1 Silben passen nicht zu 2/);

		const notenAufgabe = '<x-rhythmus takt="2/4" noten="4 4" aufgabe="noten"></x-rhythmus>';
		await expect((await gezeichnet(page, notenAufgabe)).locator('.note')).toHaveCount(0);
		await expect((await gezeichnet(page, notenAufgabe, 'kl3 sw loesung')).locator('.note')).toHaveCount(2);
		const ergaenzen = '<x-rhythmus takt="2/4" noten="4 4" aufgabe="ergaenzen" offen="2"></x-rhythmus>';
		await expect((await gezeichnet(page, ergaenzen)).locator('.note')).toHaveCount(1);
		await expect((await gezeichnet(page, ergaenzen)).locator('.notenluecke')).toHaveCount(1);
		const grafisch = await gezeichnet(page, '<x-rhythmus art="grafisch" takt="2/4" noten="4 8 8"></x-rhythmus>');
		await expect(grafisch.locator('.lang')).toHaveCount(1);
		await expect(grafisch.locator('.kurz')).toHaveCount(2);
	});

	test('Noten: Linien und Zwischenräume, Hälse, Hilfslinie, Aufgaben', async ({ page }) => {
		const tag = T`<x-noten takt="4/4" noten="c'4 e'4 f'4 h'4 | f''4 g''4 a''4 r4" namen="ja"></x-noten>`;
		const blatt = await gezeichnet(page, tag);
		const linien = await blatt
			.locator('.notenlinie')
			.evaluateAll((l) => l.map((e) => Number(e.getAttribute('y1'))).sort((a, b) => a - b));
		expect(linien).toHaveLength(5);
		const lage = await blatt
			.locator('.note')
			.evaluateAll((l) =>
				Object.fromEntries(
					l.map((e) => [e.getAttribute('data-stufe') ?? '', Number(e.getAttribute('data-y'))] as const),
				),
			);
		const [oben, , mitte, , unten] = linien as [number, number, number, number, number];
		const sp = (unten - oben) / 4;
		expect(lage['2']).toBeCloseTo(unten, 1);
		expect(lage['3']).toBeCloseTo(unten - sp / 2, 1);
		expect(lage['6']).toBeCloseTo(mitte, 1);
		expect(lage['10']).toBeCloseTo(oben, 1);
		expect(lage['0']).toBeCloseTo(unten + sp, 1);
		expect(lage['12']).toBeCloseTo(oben - sp, 1);
		await expect(blatt.locator('.hilfslinie')).toHaveCount(2);
		expect(
			await blatt.locator('line.hals').evaluateAll((l) => l.map((e) => e.getAttribute('data-richtung'))),
		).toEqual(['oben', 'oben', 'oben', 'unten', 'unten', 'unten', 'unten']);
		expect(await blatt.locator('.notenname').evaluateAll((l) => l.map((e) => e.getAttribute('data-name')))).toEqual(
			['c', 'e', 'f', 'h', 'f', 'g', 'a'],
		);
		const b = await gezeichnet(page, T`<x-noten vorzeichen="b" noten="h'1" namen="ja"></x-noten>`);
		await expect(b.locator('.notenname')).toHaveAttribute('data-name', 'b');
		const hoch = await gezeichnet(page, T`<x-noten noten="h''1"></x-noten>`);
		await expect(hoch.locator('x-noten')).toHaveAttribute('data-fehler', /zu hoch/);
		const zeichnen = T`<x-noten takt="2/4" noten="g'2" aufgabe="zeichnen"></x-noten>`;
		await expect((await gezeichnet(page, zeichnen)).locator('.note')).toHaveCount(0);
		await expect((await gezeichnet(page, zeichnen, 'kl3 sw loesung')).locator('.note')).toHaveCount(1);
		const leer = await gezeichnet(page, '<x-noten systeme="2"></x-noten>');
		await expect(leer.locator('.notenlinie.leer')).toHaveCount(10);
	});

	test('Panel: Note anfügen und zurücknehmen, Tonhöhe ändern, je ein Rückgängig-Schritt', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			(await quelle(page)).replace(
				/<x-uhr[^>]*><\/x-uhr>/,
				T`<x-rhythmus takt="2/4" noten="4 4"></x-rhythmus><x-noten takt="2/4" noten="g'4 a'4"></x-noten>`,
			),
		);
		await gespeichert(page, datei);
		const stand = await readFile(datei, 'utf8');

		await druecke(material(page).locator('x-rhythmus'));
		const leiste = panel(page).getByRole('group', { name: 'Note anfügen' });
		await druecke(leiste.getByRole('button', { name: 'Halbe', exact: true }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('noten="4 4 | 2"');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-rhythmus'));
		await druecke(panel(page).getByRole('button', { name: 'Letzte Note zurücknehmen' }));
		await expect(panel(page).locator('[data-fehler="_element"]')).toContainText('Takt 1 hat 1 Viertel statt 2');
		expect(await readFile(datei, 'utf8')).toBe(stand);
		await druecke(
			panel(page)
				.getByRole('group', { name: 'Note anfügen' })
				.getByRole('button', { name: 'Viertel', exact: true }),
		);
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(material(page).locator('x-noten'));
		await druecke(panel(page).getByRole('button', { name: 'Höher ↑' }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(T`noten="g'4 h'4"`);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});
});

const BINGO_EINTRAEGE = Array.from({ length: 24 }, (_, i) => `${i + 3}·2: ${(i + 3) * 2}`).join('; ');

test.describe('Spiele (037)', () => {
	test('Bingo: Karten, Folgeseiten, Rufliste und Fehler bei zu wenigen Einträgen', async ({ page }) => {
		const tag = `<x-bingo felder="4" karten="8" je-seite="2" seed="a" eintraege="${BINGO_EINTRAEGE}"></x-bingo>`;
		const blatt = await gezeichnet(page, `<section class="seite" data-sb="1">${tag}</section>`);
		await expect(blatt.locator('.bingo-karte')).toHaveCount(8);
		await expect(blatt.locator('.seite')).toHaveCount(4);
		await expect(blatt.locator('.seite[data-erzeugt]')).toHaveCount(3);
		await expect(blatt.locator('[data-ruf]')).toHaveCount(0);
		const karten = await blatt.locator('.bingo-karte').evaluateAll((k) => k.map((e) => e.textContent));
		expect(new Set(karten).size).toBe(8);
		await blatt.evaluate(() => {
			document.body.classList.add('loesung');
			(window as unknown as { zeichneAbbildungen: () => void }).zeichneAbbildungen();
		});
		await expect(blatt.locator('.seite')).toHaveCount(5);
		await expect(blatt.locator('[data-ruf]')).toHaveCount(24);
		expect(await blatt.locator('.bingo-karte').evaluateAll((k) => k.map((e) => e.textContent))).toEqual(karten);

		await blatt.locator('x-bingo').evaluate((el) => {
			el.setAttribute('eintraege', Array.from({ length: 14 }, (_, i) => `e${i}`).join('; '));
			(window as unknown as { zeichneAbbildungen: () => void }).zeichneAbbildungen();
		});
		await expect(blatt.locator('x-bingo')).toHaveAttribute('data-fehler', /mindestens 20/);
		await expect(blatt.locator('.seite')).toHaveCount(1);
	});

	test('Domino: gemischt auf dem Blatt, Kette in der Lösung, doppelte Lösung abgelehnt', async ({ page }) => {
		const paare = Array.from({ length: 12 }, (_, i) => `a${i}: l${i}`).join('; ');
		const html = `<section class="seite"><x-domino seed="1" paare="${paare}"></x-domino></section>`;
		const blatt = await gezeichnet(page, html);
		const folge = () =>
			blatt.locator('.domino-stein').evaluateAll((s) => s.map((e) => Number(e.getAttribute('data-stein'))));
		const sortiert = Array.from({ length: 12 }, (_, i) => i + 1);
		expect(await folge()).not.toEqual(sortiert);
		await blatt.evaluate(() => {
			document.body.classList.add('loesung');
			(window as unknown as { zeichneAbbildungen: () => void }).zeichneAbbildungen();
		});
		expect(await folge()).toEqual(sortiert);
		await expect(blatt.locator('.domino-stein').first()).toContainText('l11');
		const doppelt = paare.replace('l3', 'l2');
		const falsch = await gezeichnet(page, `<x-domino paare="${doppelt}"></x-domino>`);
		await expect(falsch.locator('x-domino')).toHaveAttribute('data-fehler', /zweimal/);
	});

	test('Spielplan: Felder überlappen nicht, Leitern, Mini-Inhalt, Lernlandkarte', async ({ page }) => {
		const blatt = await gezeichnet(
			page,
			'<x-spielplan felder="24" form="leiter" inhalt="; uhr:7:30; +3; ★" leitern="3-14; 17-5"></x-spielplan>',
		);
		await expect(blatt.locator('[data-feld]')).toHaveCount(24);
		await expect(blatt.locator('[data-feld="2"] x-uhr svg')).toHaveCount(1);
		await expect(blatt.locator('[data-feld="3"].spiel-sonder')).toHaveCount(1);
		await expect(blatt.locator('[data-leiter]')).toHaveCount(2);
		const falsch = await gezeichnet(page, '<x-spielplan felder="24" leitern="3-99"></x-spielplan>');
		await expect(falsch.locator('x-spielplan')).toHaveAttribute('data-fehler', /endet nicht auf einem Feld/);
		const unbekannt = await gezeichnet(page, '<x-spielplan felder="24" inhalt="; katze:1"></x-spielplan>');
		await expect(unbekannt.locator('x-spielplan')).toHaveAttribute('data-fehler', /gibt es nicht/);
		const land = await gezeichnet(
			page,
			'<x-spielplan art="lernlandkarte" inhalt="Ich kann A.; Ich kann B."></x-spielplan>',
		);
		await expect(land.locator('[data-station]')).toHaveCount(2);
		await expect(land.locator('[data-station] .ampel i')).toHaveCount(6);
	});

	test('Editor: Folgeseiten zählen nicht, Antippen wählt das Element, Neu mischen als ein Schritt', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const tag = `<x-bingo felder="4" karten="6" je-seite="2" seed="a" eintraege="${BINGO_EINTRAEGE}"></x-bingo>`;
		const alt = await quelle(page);
		await aendere(
			page,
			alt.replace(/<section class="seite">[\s\S]*<\/section>/, `<section class="seite">\n  ${tag}\n</section>`),
		);
		await gespeichert(page, datei);
		const inhalt = material(page);
		await expect(inhalt.locator('.seite')).toHaveCount(3);
		await expect(inhalt.locator('.seite[data-erzeugt]')).toHaveCount(2);
		await expect(page.locator('[data-seitenleiste] [data-seite-miniatur]')).toHaveCount(1);

		await druecke(inhalt.locator('.seite[data-erzeugt] .bingo-karte').first());
		await expect(panel(page)).toBeVisible();
		await expect(page.locator('[data-seitenleiste] [data-seite-miniatur]')).toHaveCount(1);
		await expect(inhalt.locator('.seite[data-erzeugt]')).toHaveCount(2);

		const vorher = await inhalt.locator('.seite[data-erzeugt] .bingo-karte').first().textContent();
		await druecke(page.locator('[data-mischen="seed"]'));
		await gespeichert(page, datei);
		await expect(inhalt.locator('.seite[data-erzeugt] .bingo-karte').first()).not.toHaveText(vorher ?? '');
		await expect(inhalt.locator('.seite[data-erzeugt]')).toHaveCount(2);
		expect(await readFile(datei, 'utf8')).not.toMatch(/data-erzeugt/);

		await druecke(zurueck(page));
		await expect(inhalt.locator('.seite[data-erzeugt] .bingo-karte').first()).toHaveText(vorher ?? '');
	});
});

test.describe('Rätsel (038)', () => {
	test('Suchsel Klasse 1: nur waagerecht und groß, die Lösung rahmt jedes Wort', async ({ page }) => {
		const blatt = await gezeichnet(
			page,
			'<x-suchsel seed="1" woerter="Oma; Opa; Mama; Papa; Ball; Hut"></x-suchsel>',
			'kl1 sw',
		);
		await expect(blatt.locator('.suchsel-zelle')).toHaveCount(100);
		await expect(blatt.locator('.raetsel-liste li').first()).toHaveText('OMA');
		await expect(blatt.locator('.suchsel-wort')).toHaveCount(0);
		await blatt.evaluate(() => {
			document.body.classList.add('loesung');
			(window as unknown as { zeichneAbbildungen: () => void }).zeichneAbbildungen();
		});
		const rahmen = blatt.locator('.suchsel-wort');
		await expect(rahmen).toHaveCount(6);
		const winkel = await rahmen.evaluateAll((r) => r.map((e) => e.getAttribute('data-winkel')));
		expect(new Set(winkel)).toEqual(new Set(['0']));
	});

	test('Suchsel: Wort im Wort, zu langes Wort und zu kleines Gitter melden einen Fehler', async ({ page }) => {
		const fehler = async (attribute: string) => {
			const blatt = await gezeichnet(page, `<x-suchsel ${attribute}></x-suchsel>`);
			return blatt.locator('x-suchsel');
		};
		await expect(await fehler('woerter="Oma; Omas"')).toHaveAttribute('data-fehler', /steckt in/);
		await expect(await fehler('spalten="5" zeilen="5" woerter="Schildkröte; Hund"')).toHaveAttribute(
			'data-fehler',
			/länger als das Gitter/,
		);
		await expect(
			await fehler('spalten="5" zeilen="5" woerter="Hunde; Katze; Maus; Vogel; Fisch; Pferd"'),
		).toHaveAttribute('data-fehler', /größeres Gitter/);
	});

	test('Kreuzworträtsel: Lösung zeigt alle Wörter, senkrecht prüft die Buchstaben', async ({ page }) => {
		const eintraege = 'a: STUHL; b: STIFT; c: SCHULE; d: LINEAL; e: RADIERER; f: DOSE; g: TAFEL; h: RANZEN';
		const blatt = await gezeichnet(
			page,
			`<x-kreuzwort seed="1" loesungswort="HEFT" eintraege="${eintraege}"></x-kreuzwort>`,
		);
		await expect(blatt.locator('[data-hinweis]')).toHaveCount(8);
		await expect(blatt.locator('.kreuz-titel')).toHaveText(['Waagerecht', 'Senkrecht']);
		await expect(blatt.locator('.kreuz-loesung')).toHaveCount(4);
		await expect(blatt.locator('.raetsel-wort text')).toHaveCount(4);
		await blatt.evaluate(() => {
			document.body.classList.add('loesung');
			(window as unknown as { zeichneAbbildungen: () => void }).zeichneAbbildungen();
		});
		await expect(blatt.locator('.raetsel-wort text')).toHaveCount(8);
		const falsch = await gezeichnet(
			page,
			'<x-kreuzwort art="senkrecht" loesungswort="BA" eintraege="a: HUND; b: HAUS"></x-kreuzwort>',
		);
		await expect(falsch.locator('x-kreuzwort')).toHaveAttribute('data-fehler', /enthält kein B/);
		const unmoeglich = await gezeichnet(page, '<x-kreuzwort eintraege="a: HUND; b: KLEE"></x-kreuzwort>');
		await expect(unmoeglich.locator('x-kreuzwort')).toHaveAttribute('data-fehler', /neu mischen/);
	});

	test('Editor: Wort hinzufügen und Neu mischen sind je ein Schritt', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const alt = await quelle(page);
		await aendere(
			page,
			alt.replace(
				/<section class="seite">[\s\S]*<\/section>/,
				'<section class="seite">\n  <x-suchsel seed="a" woerter="Hund; Katze; Maus"></x-suchsel>\n</section>',
			),
		);
		await gespeichert(page, datei);
		const inhalt = material(page);
		const gitter = () => inhalt.locator('x-suchsel svg').first().textContent();
		await druecke(inhalt.locator('x-suchsel svg').first());
		await expect(panel(page)).toBeVisible();

		const vorher = await gitter();
		await druecke(page.locator('[data-mischen="seed"]'));
		await gespeichert(page, datei);
		await expect.poll(gitter).not.toBe(vorher);
		await druecke(zurueck(page));
		await expect.poll(gitter).toBe(vorher);

		await druecke(inhalt.locator('x-suchsel svg').first());
		await druecke(panel(page).getByRole('button', { name: 'Zeile hinzufügen' }));
		await expect(inhalt.locator('.raetsel-liste li')).toHaveCount(4);
		await gespeichert(page, datei);
		await druecke(zurueck(page));
		await expect(inhalt.locator('.raetsel-liste li')).toHaveCount(3);
	});

	test('Editor: Item-Lösung ändern zeigt den Fehler im Panel des Lösungsworts', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const alt = await quelle(page);
		const seite =
			'<section class="seite"><div class="aufgabe"><span class="nr">3</span><div class="anw"><span class="text">Rechne.</span></div>' +
			'<div class="koerper"><div class="reihe" style="--spalten:2"><div class="zelle"><span class="antwort" data-l="42"></span></div>' +
			'<div class="zelle"><span class="antwort" data-l="64"></span></div></div>' +
			'<x-loesungswort wort="SO" bezug="3" zuordnung="42: S; 64: O"></x-loesungswort></div></div></section>';
		await aendere(page, alt.replace(/<section class="seite">[\s\S]*<\/section>/, seite));
		await gespeichert(page, datei);
		const inhalt = material(page);
		await expect(inhalt.locator('x-loesungswort')).not.toHaveAttribute('data-fehler');

		await druecke(
			page.getByRole('group', { name: 'Was zeigen?' }).getByRole('button', { name: 'Lösung', exact: true }),
		);
		await druecke(inhalt.locator('.antwort').nth(1));
		await page.getByLabel('Richtige Antwort').fill('48');
		await page.getByLabel('Richtige Antwort').press('Enter');
		await gespeichert(page, datei);
		await expect(inhalt.locator('x-loesungswort')).toHaveAttribute(
			'data-fehler',
			/Eintrag 2 hat jetzt die Lösung 48/,
		);

		await druecke(inhalt.locator('x-loesungswort').first());
		await expect(page.locator('[data-fehler="_element"]')).toContainText('Eintrag 2 hat jetzt die Lösung 48');

		await druecke(zurueck(page));
		await expect(inhalt.locator('x-loesungswort')).not.toHaveAttribute('data-fehler');
	});
});
