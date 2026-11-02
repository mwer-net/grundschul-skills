import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
		await expect(page.locator('[data-breadcrumb]')).toHaveText('Seite 1›Aufgabe 1›Reihe›Item 1›Uhr');
		await expect(page.locator('[data-hinweis="beispiel"]')).toContainText('Das ist das Beispiel.');

		await druecke(material(page).locator('x-uhr').nth(1));
		await expect(panel(page)).toBeVisible();
		await expect(page.locator('[data-hinweis="beispiel"]')).toHaveCount(0);
		expect(await minutenzeiger(page, 1)).toBe('50 77');

		await page.getByLabel('Stunde').selectOption('5');
		await page.getByLabel('Minuten').selectOption('45');
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
			await druecke(page.getByRole('button', { name: 'Eingekreiste Zehner: mehr' }));
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

	test('Liste, Raster und Form', async ({ druecke, page }) => {
		test.slow();
		const { datei } = await mitProbe(page, 'eintraege="Hund: 7; Katze: 4"');
		await druecke(probe(page));
		await page.locator('[data-gruppe="Listen"] summary').click();
		const liste = page.locator('[data-liste="eintraege"]');
		await expect(liste.locator('[data-zeile]')).toHaveCount(2);

		await liste.getByLabel('Zahl in Zeile 1').fill('8');
		await liste.getByLabel('Zahl in Zeile 1').press('Enter');
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Hund: 8; Katze: 4"');

		await liste.getByLabel('Zahl in Zeile 1').fill('200');
		await expect(page.locator('[data-fehler="eintraege"]')).toContainText('0 bis 99');
		await liste.getByLabel('Zahl in Zeile 1').fill('8');

		await druecke(page.getByRole('button', { name: 'Zeile 2 nach oben' }));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Katze: 4; Hund: 8"');

		await druecke(page.locator('[data-zeile-neu="eintraege"]'));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Katze: 4; Hund: 8; Neu: 1"');

		await druecke(page.getByRole('button', { name: 'Zeile 3 löschen' }));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('eintraege="Katze: 4; Hund: 8"');

		await page.locator('[data-gruppe="Raster"] summary').click();
		await druecke(page.locator('[data-raster="feld"] [data-zelle="0-1"]'));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).toContain('feld="0 1 0 / 0 0 0"');
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await tagVon(datei)).not.toContain('feld=');

		await druecke(probe(page));
		await page.locator('[data-gruppe="Raster"] summary').click();
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
		expect(await seite.locator('x-gluecksrad').getByText('Rot = schraffiert').count()).toBe(1);

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
		await page.locator('[data-gruppe="Figur"] summary').click();
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
		await page.locator('[data-gruppe="Aufgabe"] summary').click();
		await page.getByLabel('Achse nach Kästchen', { exact: true }).fill('3');
		await page.getByLabel('Achse nach Kästchen', { exact: true }).press('Enter');
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
