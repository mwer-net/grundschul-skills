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
		await page.locator('[data-gruppe="Lücken"] summary').click();
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
		await page.getByLabel('Verfahren bei Minus').selectOption({ label: 'Ergänzen, Erweitern' });
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
