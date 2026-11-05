import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Locator, Page } from '@playwright/test';
import { ASSETS } from '@schoolbox/kern/src/konfig';

import { aendere, gespeichert, imMehr, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, objektMenue, test } from './hilfe';

const zeichne = async (page: Page, html: string, klasse = 'kl3 sw') => {
	const ordner = await mkdtemp(path.join(tmpdir(), 'formate-'));
	const datei = path.join(ordner, 'probe.html');
	const assets = pathToFileURL(ASSETS).href;
	await writeFile(
		datei,
		`<!doctype html><html lang="de"><head><meta charset="utf-8"><base href="${assets}/"><link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head><body class="${klasse}"><section class="seite">${html}</section></body></html>`,
	);
	await page.goto(pathToFileURL(datei).href);
	return page;
};

/** Stelle auf dem Bild in Koordinaten der Seite: Der Rahmen ist verschoben und skaliert. */
const aufDemBild = async (page: Page, bild: Locator, x: number, y: number) => {
	const rahmen = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
	const r = await bild.evaluate((e) => {
		const b = e.getBoundingClientRect();
		return { left: b.left, top: b.top, width: b.width, height: b.height, innen: window.innerWidth };
	});
	const skala = (rahmen?.width ?? r.innen) / r.innen;
	return {
		x: (rahmen?.x ?? 0) + (r.left + (r.width * x) / 100) * skala,
		y: (rahmen?.y ?? 0) + (r.top + (r.height * y) / 100) * skala,
	};
};

test.describe('Aufgabenformate (049)', () => {
	test('Zuordnen: Blatt ohne Lösung, Lösung mit genau den richtigen Linien', async ({ page }) => {
		const paare = 'paare="a: 1; b: 2; c: 3; d: 4"';
		await zeichne(page, `<x-zuordnen ${paare}></x-zuordnen>`);
		const rechts = await page.locator('x-zuordnen .rechts span').allTextContents();
		expect([...rechts].sort()).toEqual(['1', '2', '3', '4']);
		['1', '2', '3', '4'].forEach((wert, i) => expect(rechts[i]).not.toBe(wert));
		await expect(page.locator('x-zuordnen line')).toHaveCount(0);

		await zeichne(page, `<x-zuordnen ${paare}></x-zuordnen>`, 'kl3 sw loesung');
		const linien = await page
			.locator('x-zuordnen line')
			.evaluateAll((l) => l.map((e) => [Number(e.getAttribute('y1')) - 0.5, Number(e.getAttribute('y2')) - 0.5]));
		expect(linien).toHaveLength(4);
		const loesung = await page.locator('x-zuordnen .rechts span').allTextContents();
		for (const [links, zeile] of linien as [number, number][]) {
			expect(loesung[zeile]).toBe(String(links + 1));
		}
		// Die Punkte der Linien liegen auf den Mitten der Einträge.
		const lage = await page.locator('x-zuordnen').evaluate((el) => {
			const svg = el.querySelector('svg')?.getBoundingClientRect();
			const erste = el.querySelector('.rechts')?.getBoundingClientRect();
			return {
				svgTop: svg?.top ?? 0,
				svgHoehe: svg?.height ?? 0,
				mitte: (erste?.top ?? 0) + (erste?.height ?? 0) / 2,
			};
		});
		expect(Math.abs(lage.svgTop + lage.svgHoehe / 8 - lage.mitte)).toBeLessThan(1);
	});

	test('Zuordnen mit Ziffern, Sortieren: Lösung nur auf dem Lösungsblatt', async ({ page }) => {
		const html =
			'<x-zuordnen darstellung="ziffern" paare="a: 1; b: 2; c: 3"></x-zuordnen><x-sortieren eintraege="eins; zwei; drei"></x-sortieren>';
		await zeichne(page, html);
		await expect(page.locator('.feld').first()).toBeEmpty();
		expect((await page.locator('.feld').allTextContents()).join('')).toBe('');
		await zeichne(page, html, 'kl3 sw loesung');
		const text = await page
			.locator('x-sortieren .eintrag')
			.evaluateAll((e) =>
				e.map((x) => [x.querySelector('.feld')?.textContent, x.querySelector('span:last-child')?.textContent]),
			);
		const richtig: Record<string, string> = { eins: '1', zwei: '2', drei: '3' };
		for (const [ziffer, wort] of text) {
			expect(ziffer).toBe(richtig[wort ?? '']);
		}
	});

	test('Fehler: zu viele Punkte, zu wenige Paare, ohne Bild', async ({ page }) => {
		const voll = Array.from({ length: 7 }, (_, i) => `10,${i * 10}: W${i}`).join('; ');
		await zeichne(
			page,
			`<x-beschriften bild="bilder/wachstum.png" punkte="${voll}"></x-beschriften><x-zuordnen paare="a: 1"></x-zuordnen><x-beschriften punkte=""></x-beschriften>`,
		);
		await expect(page.locator('x-beschriften').first()).toContainText('höchstens 6');
		await expect(page.locator('x-zuordnen')).toContainText('mindestens 2');
		await expect(page.locator('x-beschriften').nth(1)).toContainText('Wähle zuerst ein Bild');
	});

	test('Schreibrahmen: Lineatur folgt der Klasse, Beispiel nur in der Lösung', async ({ page }) => {
		const html =
			'<x-schreibrahmen planung="1" satzanfaenge="Zuerst; Dann" beispiel="Zuerst kam er."></x-schreibrahmen>';
		await zeichne(page, html, 'kl1 sw');
		await expect(page.locator('x-schreibrahmen x-lineatur')).toHaveCount(2);
		await expect(page.locator('x-schreibrahmen x-lineatur').first()).toHaveAttribute('art', '1');
		await expect(page.locator('x-schreibrahmen .planung')).toContainText('Hauptteil');
		await expect(page.locator('x-schreibrahmen')).not.toContainText('Zuerst kam er.');
		await zeichne(page, html, 'kl4 sw loesung');
		await expect(page.locator('x-schreibrahmen x-lineatur').first()).toHaveAttribute('art', '4');
		await expect(page.locator('x-schreibrahmen')).toContainText('Zuerst kam er.');
	});

	test('Beschriften: Punkte setzen, verschieben, Wort eintragen und entfernen, mit Maus und Finger', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		test.slow();
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(
			page,
			// Oben und über die volle Breite: In einer schmalen Zelle wäre ein Pixel schon mehrere Prozent, und am Seitenende
			// schnitte der Rand den Griffpunkt ab.
			(await quelle(page)).replace(
				'<div class="kopf">',
				'<x-beschriften bild="bilder/wachstum.png" alt="Pflanze" punkte="10,50: Samen"></x-beschriften><div class="kopf">',
			),
		);
		await gespeichert(page, datei);
		const element = material(page).locator('x-beschriften').first();
		const bild = element.locator('.bildflaeche');
		await expect
			.poll(() => element.locator('img').evaluate((b: HTMLImageElement) => b.naturalWidth))
			.toBeGreaterThan(0);
		await druecke(element);
		await page.locator('[data-punkte-setzen]').click();
		await expect(page.locator('[data-punkte-setzen]')).toHaveAttribute('aria-pressed', 'true');

		// Neuer Punkt per Maus oder Finger.
		const neu = await aufDemBild(page, bild, 80, 30);
		if (hasTouch) {
			await page.touchscreen.tap(neu.x, neu.y);
		} else {
			await page.mouse.click(neu.x, neu.y);
		}
		await expect.poll(() => quelle(page)).toMatch(/punkte="10,50: Samen; (79|80|81),(29|30|31): Wort"/);
		await gespeichert(page, datei);

		// Das Wort steht im Panel.
		await page.getByLabel('Wort zu Punkt 2').fill('Blüte');
		await page.getByLabel('Wort zu Punkt 2').blur();
		await expect.poll(() => quelle(page)).toMatch(/: Blüte"/);
		await gespeichert(page, datei);

		// Verschieben: Ziehen greift den nahen Punkt, es entsteht kein dritter.
		// Nach dem Speichern lädt der Rahmen neu; solange gehört das Bild noch nicht wieder dem Werkzeug.
		await expect.poll(() => element.evaluate((e: HTMLElement) => e.style.touchAction)).toBe('none');
		// Das Bild im neuen Rahmen muss geladen sein, sonst hat die Fläche noch keine Höhe.
		await expect
			.poll(() => element.locator('img').evaluate((b: HTMLImageElement) => b.naturalWidth))
			.toBeGreaterThan(0);
		// WebKit in Playwright kann mit dem Finger nur tippen, ziehen nicht. Der Griff läuft über dieselben Pointer-Ereignisse.
		if (!hasTouch) {
			const von = await aufDemBild(page, bild, 10, 50);
			const nach = await aufDemBild(page, bild, 30, 70);
			await page.mouse.move(von.x, von.y);
			await page.mouse.down();
			await page.mouse.move(nach.x, nach.y, { steps: 4 });
			await page.mouse.up();
			await expect.poll(() => quelle(page)).toMatch(/punkte="(29|30|31),(69|70|71): Samen; /);
		}

		// Entfernen, dann beendet „Punkte setzen“ den Griff aufs Bild: Der Klick wählt wieder das Element.
		await page.getByLabel('Punkt 1 entfernen').click();
		await expect.poll(() => quelle(page)).toMatch(/punkte="\d+,\d+: Blüte"/);
		await page.locator('[data-punkte-setzen]').click();
		const stand = await quelle(page);
		const danach = await aufDemBild(page, bild, 50, 50);
		await page.mouse.click(danach.x, danach.y);
		expect(await quelle(page)).toBe(stand);
		await gespeichert(page, datei);
	});

	test('Katalog: Alle vier lassen sich einfügen und bleiben ohne Fehler', async ({ druecke, page }) => {
		test.slow();
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		for (const [art, suche] of [
			['x-zuordnen', 'Zuordnen'],
			['x-sortieren', 'Sortieren'],
			['x-beschriften', 'Beschriften'],
			['x-schreibrahmen', 'Schreibrahmen'],
		] as const) {
			await druecke(material(page).locator('.aufgabe').first().locator('.nr'));
			await expect(page.locator('[data-einfuegen-plus]')).toBeVisible();
			await page.locator('[data-einfuegen-plus]').click();
			const fenster = page.locator('[data-schnellauswahl]');
			await fenster.getByRole('searchbox').fill(suche);
			await fenster.locator(`[data-katalog-eintrag="${art}"]`).click();
			await expect.poll(() => quelle(page)).toContain(`<${art} `);
			const neu = material(page).locator(art).first();
			// Das Beschriften-Blatt zeigt ohne Lösung nur das Bild, darum zählen gezeichnete Kinder, nicht der Text.
			await expect.poll(() => neu.evaluate((e) => e.children.length)).toBeGreaterThan(0);
			await expect(neu.locator('.fehler, [data-fehler]')).toHaveCount(0);
		}
	});
});

test.describe('Generatoren (050)', () => {
	const mitElement = async (page: Page, html: string) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(page, (await quelle(page)).replace('<div class="kopf">', `${html}<div class="kopf">`));
		await gespeichert(page, datei);
		return { dok, id, datei };
	};

	test('Neue Zahlen: nur die Zahlen ändern sich, ein Schritt in Rückgängig', async ({ druecke, hasTouch, page }) => {
		test.slow();
		const { datei } = await mitElement(page, '<x-zahlenmauer basis="3 5 2" offen="0-1"></x-zahlenmauer>');
		const vorher = await quelle(page);
		await druecke(material(page).locator('x-zahlenmauer'));
		const leiste = page.locator('[data-bausteinleiste]');
		// Am iPad passt die Leiste nur ohne die spezifischen Einträge; Befehle stehen dann im ⋯ (071).
		if (hasTouch) {
			await druecke(leiste.getByRole('button', { name: 'Mehr zu diesem Baustein' }));
			await druecke(page.getByRole('menuitem', { name: /Neue Zahlen/ }));
		} else {
			await druecke(leiste.getByRole('button', { name: 'Neue Zahlen' }));
		}
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		const nachher = await quelle(page);
		expect(nachher.replace(/basis="[^"]*"/, '')).toBe(vorher.replace(/basis="[^"]*"/, ''));
		expect(nachher).toContain('offen="0-1"');
		await gespeichert(page, datei);
		await page.getByRole('button', { name: 'Rückgängig (⌘Z)' }).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Rechenreihe: Einstellung ändert die Aufgaben in der Quelle, Unerfüllbares sperrt mit Meldung', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { datei } = await mitElement(
			page,
			'<x-rechenreihe rechenart="+" zahlenraum="20" anzahl="4" aufgaben="1 + 1 = _; 1 + 2 = _; 2 + 2 = _; 3 + 2 = _"></x-rechenreihe>',
		);
		await druecke(material(page).locator('x-rechenreihe'));
		await page.getByLabel('Rechenart').selectOption({ label: 'Minus' });
		await expect.poll(() => quelle(page)).toMatch(/rechenart="−"[^>]* aufgaben="\d+ − \d+ = _;/);
		await gespeichert(page, datei);
		const stand = await quelle(page);
		await page.getByLabel('Zehnerübergang').selectOption({ label: 'Mit Übergang' });
		await page.locator('[data-feld="anzahl"] input').fill('60');
		await page.locator('[data-feld="anzahl"] input').press('Enter');
		await expect(page.locator('[data-fehler="_element"]')).toContainText('verschiedene Aufgaben');
		// Keine falschen Aufgaben: Ob die Einstellung schon in der Quelle steht, hängt am Neuladen des Rahmens, Aufgaben stehen dort nie.
		expect(await quelle(page)).not.toMatch(/anzahl="60"[^>]*aufgaben=/);
		expect(stand).toContain('rechenart="−"');
	});

	test('Variante: zweites Dokument mit anderen Zahlen, Original bleibt', async ({ page }) => {
		test.slow();
		const { id } = await mitElement(page, '<x-zahlenmauer basis="3 5 2"></x-zahlenmauer>');
		await page.goto(`/m/${id}`);
		await expect(page.locator('[data-objekt]')).toHaveCount(1);
		await objektMenue(page, 'Wie spät ist es?');
		await page.getByRole('menuitem', { name: 'Variante anlegen' }).click();
		await expect(page.getByText('Wie spät ist es? (B)', { exact: true }).first()).toBeVisible();
		await expect(page.locator('[data-objekt]')).toHaveCount(2);
	});
});

test.describe('Eigene Vorlagen und Sammlung (051)', () => {
	test('Als Vorlage speichern: Assistent zeigt sie, neues Dokument trägt den Inhalt', async ({ page }) => {
		test.slow();
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
		await page.getByRole('menuitem', { name: 'Als Vorlage speichern' }).click();
		await page.locator('[data-vorlage-name]').fill('Uhr-Vorlage');
		await page.locator('[data-vorlage-speichern]').click();
		await expect(page.getByText('Vorlage „Uhr-Vorlage“ gespeichert.', { exact: false })).toBeVisible();

		await page.goto(`/m/${id}`);
		await page.getByRole('button', { name: 'Material anlegen' }).first().click();
		await page.getByRole('button', { name: 'Weiter', exact: true }).click();
		await page.getByRole('button', { name: 'Weiter', exact: true }).click();
		await page.getByRole('textbox', { name: 'Titel' }).fill('Aus Vorlage');
		await page.getByRole('button', { name: 'Weiter', exact: true }).click();
		await page.locator('[data-eigene-vorlage="uhr-vorlage"] button').first().click();
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await page.waitForURL(/bearbeiten/);
		await expect(material(page).locator('x-uhr').first()).toBeVisible();
		expect(await quelle(page)).toContain('<title>Aus Vorlage</title>');
	});

	test('Sammlung und Kopieren: im anderen Dokument einfügbar, in Bibliothek und Slash-Menü', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('x-uhr').first());
		await imMehr(page, 'In Sammlung legen');
		await page.locator('[data-sammlung-name]').fill('Meine Uhr');
		await page.locator('[data-sammlung-speichern]').click();
		await expect(page.getByText('In „Meine Bausteine“ gelegt.')).toBeVisible();
		await imMehr(page, 'Kopieren');

		const anderes = await uhrzeit();
		await oeffne(page, anderes.id, anderes.dok);
		const vorher = await quelle(page);
		const uhren = (vorher.match(/<x-uhr/g) ?? []).length;
		await druecke(material(page).locator('.aufgabe').first());
		await imMehr(page, /einfügen/i);
		await expect.poll(async () => ((await quelle(page)).match(/<x-uhr/g) ?? []).length).toBe(uhren + 1);

		await page.getByRole('tab', { name: 'Bausteine' }).click();
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Meine Uhr');
		await page.locator('[data-einfuegen="eigen-meine-uhr"]').click();
		await expect.poll(async () => ((await quelle(page)).match(/<x-uhr/g) ?? []).length).toBe(uhren + 2);
		await page.getByRole('button', { name: 'Auswahl' }).click();

		// Im Slash-Menü steht derselbe Baustein.
		const text = material(page).locator('.aufgabe .anw .text').first();
		await druecke(text);
		await druecke(text);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Delete');
		await page.keyboard.type('/Meine Uhr');
		await expect(page.locator('[data-slash-menue]')).toContainText('Meine Uhr');
	});
});

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });

test.describe('Sprach-Werkzeuge (052, 083)', () => {
	const absatz = 'Die Biene fliegt zur Blume. Der Hund bellt laut.';
	const lesetext = async (wiederholung = 1) => {
		const { dok, id, material: pfad } = await uhrzeit();
		const alt = await readFile(pfad, 'utf8');
		const text = `<p class="text">${absatz}</p>`.repeat(wiederholung);
		await writeFile(pfad, alt.replace(/(<section class="seite"[^>]*>)/, `$1${text}`));
		return { dok, id };
	};
	const silben = (page: Page) => page.locator('[data-sprache-silben]');
	const silbenKnopf = (page: Page, name: string) => silben(page).getByRole('button', { name, exact: true });
	const aktivIn = (bereich: Locator, name: string) =>
		expect(bereich.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
	const keinesAktiv = (page: Page) => expect(silben(page).locator('[aria-pressed="true"]')).toHaveCount(0);
	const vokale = (page: Page) => page.locator('[data-sprache-vokale] [role="switch"]');
	const waehleAbsatz = async (page: Page, druecke: (z: Locator) => Promise<void>, nr = 0) => {
		await druecke(material(page).locator('p.text').nth(nr));
		await expect(page.locator('[data-sprachwerkzeug]')).toBeVisible();
	};
	const oeffneUebung = async (page: Page, druecke: (z: Locator) => Promise<void>) => {
		const knopf = page.locator('[data-abschnitt="uebung"] > button');
		if ((await knopf.getAttribute('aria-expanded')) !== 'true') {
			await druecke(knopf);
		}
		await expect(page.locator('[data-sprache="luecken"]')).toBeVisible();
	};
	const pfad = (page: Page) => page.locator('[data-breadcrumb] h2');

	test('Bögen an und aus: Das Segment zeigt den Stand, der Text bleibt zeichengleich', async ({ druecke, page }) => {
		test.slow();
		const { dok, id } = await lesetext();
		await oeffne(page, id, dok);
		const anfang = await quelle(page);
		await waehleAbsatz(page, druecke);
		await aktivIn(silben(page), 'Aus');
		await druecke(silbenKnopf(page, 'Bögen'));
		await expect.poll(() => quelle(page)).toContain('<x-silben>Die Bie|ne');
		await aktivIn(silben(page), 'Bögen');
		await expect(material(page).locator('x-silben .silbe').first()).toBeVisible();
		await druecke(silbenKnopf(page, 'Farbe'));
		await expect.poll(() => quelle(page)).toContain('<x-silben darstellung="farbe">Die Bie|ne');
		await aktivIn(silben(page), 'Farbe');
		await druecke(silbenKnopf(page, 'Beides'));
		await expect.poll(() => quelle(page)).toContain('<x-silben darstellung="beides">Die Bie|ne');
		await aktivIn(silben(page), 'Beides');
		await druecke(silbenKnopf(page, 'Aus'));
		await expect.poll(() => quelle(page)).toBe(anfang);
		await aktivIn(silben(page), 'Aus');
		await expect(pfad(page), 'Die Auswahl steht noch auf dem Absatz').toHaveText('Absatz');
	});

	test('Klick ins Blatt wählt die Silben: dieselben Regler; Aus lässt den Text und wählt das Elternteil', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id } = await lesetext();
		await oeffne(page, id, dok);
		const anfang = await quelle(page);
		await waehleAbsatz(page, druecke);
		await druecke(silbenKnopf(page, 'Farbe'));
		await aktivIn(silben(page), 'Farbe');
		await druecke(page.getByRole('button', { name: 'Auswahl aufheben' }));
		await druecke(material(page).locator('p.text x-silben'));
		await expect(pfad(page)).toHaveText('Silben');
		await aktivIn(silben(page), 'Farbe');
		await expect(vokale(page)).toBeVisible();
		await expect(page.getByLabel('Darstellung', { exact: true }), 'Das Segment ersetzt das Feld').toHaveCount(0);
		await expect(page.locator('[data-abschnitt="weitere"]')).toBeVisible();
		await druecke(silbenKnopf(page, 'Bögen'));
		await aktivIn(silben(page), 'Bögen');
		await expect(pfad(page), 'Ein Wechsel lässt die Silben gewählt').toHaveText('Silben');
		await druecke(silbenKnopf(page, 'Aus'));
		await expect.poll(() => quelle(page)).toBe(anfang);
		await expect(pfad(page)).toHaveText('Absatz');
		await aktivIn(silben(page), 'Aus');
	});

	for (const [name, zurueckWeg, vorWeg] of [
		[
			'Taste',
			(page: Page) => page.keyboard.press('ControlOrMeta+z'),
			(page: Page) => page.keyboard.press('ControlOrMeta+Shift+z'),
		],
		[
			'Pfeil',
			(page: Page) => zurueck(page).click(),
			(page: Page) => page.getByRole('button', { name: 'Wiederholen (⇧⌘Z)' }).click(),
		],
	] as const) {
		test(`Rückgängig und Wiederholen per ${name}: Das Segment folgt`, async ({ druecke, page }) => {
			test.slow();
			const { dok, id } = await lesetext();
			await oeffne(page, id, dok);
			const anfang = await quelle(page);
			await waehleAbsatz(page, druecke);
			await druecke(silbenKnopf(page, 'Bögen'));
			await aktivIn(silben(page), 'Bögen');
			await zurueckWeg(page);
			await expect.poll(() => quelle(page)).toBe(anfang);
			await aktivIn(silben(page), 'Aus');
			await vorWeg(page);
			await expect.poll(() => quelle(page)).toContain('<x-silben>');
			await aktivIn(silben(page), 'Bögen');
		});
	}

	test('Vokale an und aus; zusammen mit Silben in beiden Reihenfolgen gleich, und sie bleiben sichtbar', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id } = await lesetext();
		await oeffne(page, id, dok);
		const anfang = await quelle(page);
		await waehleAbsatz(page, druecke);
		await druecke(vokale(page));
		await expect.poll(() => quelle(page)).toContain('D<mark>ie</mark> B<mark>ie</mark>n<mark>e</mark>');
		await expect(vokale(page)).toHaveAttribute('aria-checked', 'true');
		await druecke(vokale(page));
		await expect.poll(() => quelle(page)).toBe(anfang);
		await expect(vokale(page)).toHaveAttribute('aria-checked', 'false');

		await druecke(vokale(page));
		await expect(vokale(page)).toHaveAttribute('aria-checked', 'true');
		await druecke(silbenKnopf(page, 'Bögen'));
		await aktivIn(silben(page), 'Bögen');
		const erst = await quelle(page);
		expect(erst).toContain('B<mark>ie</mark>|n<mark>e</mark>');
		await expect(material(page).locator('x-silben mark').first()).toBeVisible();
		await expect(material(page).locator('x-silben .silbe mark').first()).toHaveText('ie');

		await druecke(silbenKnopf(page, 'Aus'));
		await aktivIn(silben(page), 'Aus');
		await druecke(vokale(page));
		await expect.poll(() => quelle(page)).toBe(anfang);
		await druecke(silbenKnopf(page, 'Bögen'));
		await aktivIn(silben(page), 'Bögen');
		await druecke(vokale(page));
		await expect.poll(() => quelle(page)).toBe(erst);
	});

	test('Buchstaben: Feld, Schalter, Stand', async ({ druecke, page }) => {
		test.slow();
		const { dok, id } = await lesetext();
		await oeffne(page, id, dok);
		const anfang = await quelle(page);
		await waehleAbsatz(page, druecke);
		const feld = page.locator('[data-sprache-buchstaben]');
		const schalter = page.locator('[data-sprache-buchstaben-an] [role="switch"]');
		await expect(schalter).toBeDisabled();
		await feld.fill('ie, au');
		await druecke(schalter);
		await expect.poll(() => quelle(page)).toContain('B<mark>ie</mark>ne');
		await expect.poll(() => quelle(page)).toContain('l<mark>au</mark>t');
		await expect(schalter).toHaveAttribute('aria-checked', 'true');
		await druecke(schalter);
		await expect.poll(() => quelle(page)).toBe(anfang);
		await expect(feld).toHaveValue('ie, au');
	});

	const markiere = (page: Page, wort: string) =>
		material(page)
			.locator('p.text')
			.first()
			.evaluate((p, gesucht) => {
				const gang = p.ownerDocument.createTreeWalker(p, NodeFilter.SHOW_TEXT);
				for (let t = gang.nextNode() as Text | null; t; t = gang.nextNode() as Text | null) {
					const i = t.data.indexOf(gesucht);
					if (i >= 0) {
						const r = p.ownerDocument.createRange();
						r.setStart(t, i);
						r.setEnd(t, i + gesucht.length);
						const s = p.ownerDocument.getSelection();
						s?.removeAllRanges();
						s?.addRange(r);
						return;
					}
				}
				throw new Error(`„${gesucht}“ steht hier nicht.`);
			}, wort);

	test('Teilmarkierung: Hinweis, zwei Stellen, eine entfernen, dann überall entfernen', async ({ druecke, page }) => {
		test.slow();
		const { dok, id } = await lesetext();
		await oeffne(page, id, dok);
		const anfang = await quelle(page);
		await waehleAbsatz(page, druecke);
		await expect(page.locator('[data-sprache-markierung]')).toHaveCount(0);
		await markiere(page, 'Biene');
		await expect(page.locator('[data-sprache-markierung]')).toHaveText('Wirkt auf die Markierung: „Biene“');
		await druecke(silbenKnopf(page, 'Bögen'));
		await expect.poll(() => quelle(page)).toContain('Die <x-silben im-text>Bie|ne</x-silben> fliegt');
		await keinesAktiv(page);
		await expect(page.locator('[data-sprache-teilweise]')).toContainText('In einem Teil des Texts');
		await expect(page.locator('[data-sprache-markierung]')).toHaveCount(0);

		await markiere(page, 'Blume');
		await druecke(silbenKnopf(page, 'Farbe'));
		await expect.poll(() => quelle(page)).toContain('<x-silben im-text darstellung="farbe">Blu|me</x-silben>');
		await expect.poll(() => quelle(page)).toContain('<x-silben im-text>Bie|ne</x-silben>');

		// Eine Stelle allein: Klick auf sie wählt sie, „Aus“ nimmt nur sie weg (083). Eine Markierung innerhalb der
		// Stelle hält WebKit nicht: Sie steht in der Textsitzung als nicht editierbare Insel, die Auswahl bleibt leer.
		await druecke(page.getByRole('button', { name: 'Auswahl aufheben' }));
		await druecke(material(page).locator('p.text x-silben').first());
		await expect(pfad(page)).toHaveText('Silben');
		await aktivIn(silben(page), 'Bögen');
		await druecke(silbenKnopf(page, 'Aus'));
		await expect.poll(() => quelle(page)).not.toContain('Bie|ne');
		await expect.poll(() => quelle(page)).toContain('Blu|me');
		await expect(pfad(page)).toHaveText('Absatz');

		await druecke(page.locator('[data-sprache-teilweise]').getByRole('button', { name: 'Überall entfernen' }));
		await expect.poll(() => quelle(page)).toBe(anfang);
		await aktivIn(silben(page), 'Aus');
	});

	test('Aufgabentext: keine Übung, keine Zeilennummern; Silben auch mit Zahlen im Text', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.anw .text').nth(2));
		await expect(page.locator('[data-sprachwerkzeug]')).toBeVisible();
		await expect(page.locator('[data-abschnitt="uebung"]')).toHaveCount(0);
		await expect(page.locator('[data-sprache-zeilennummern]')).toHaveCount(0);
		await druecke(silbenKnopf(page, 'Bögen'));
		await aktivIn(silben(page), 'Bögen');
		await expect(material(page).locator('.anw .text x-silben').first()).not.toHaveAttribute('data-fehler');
	});

	test('Überschrift: nur Silben', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('h1').first());
		await expect(silben(page)).toBeVisible();
		await expect(vokale(page)).toHaveCount(0);
		await expect(page.locator('[data-sprache-buchstaben]')).toHaveCount(0);
		await expect(page.locator('[data-sprache-zeilennummern]')).toHaveCount(0);
		await expect(page.locator('[data-abschnitt="uebung"]')).toHaveCount(0);
	});

	test('Absatz: Jede Übung wirkt, ist ein Schritt rückgängig und zeigt vorher, was wegfällt', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id } = await lesetext();
		await oeffne(page, id, dok);
		const anfang = await quelle(page);
		await waehleAbsatz(page, druecke);
		await expect(page.locator('[data-sprache="luecken"]'), 'Eingeklappt').toHaveCount(0);
		for (const [knopf, erwartet] of [
			[
				'woerter-mischen',
				'<x-sortieren art="woerter" eintraege="Die; Biene; fliegt; zur; Blume."></x-sortieren>',
			],
			['luecken', '<x-lueckentext>Die Biene fliegt zur [Blume]. Der Hund bellt laut.</x-lueckentext>'],
		] as const) {
			await oeffneUebung(page, druecke);
			await page.locator(`[data-sprache="${knopf}"]`).click();
			await expect.poll(() => quelle(page)).toContain(erwartet);
			await druecke(zurueck(page));
			await expect.poll(() => quelle(page)).toBe(anfang);
			await expect(page.locator('[data-sprachwerkzeug]')).toBeVisible();
		}
		await oeffneUebung(page, druecke);
		await page.locator('[data-sprache-regel]').selectOption('nomen');
		await page.locator('[data-sprache="luecken"]').click();
		await expect.poll(() => quelle(page)).toContain('Die [Biene] fliegt zur [Blume]. Der [Hund] bellt laut.');
		await expect(material(page).locator('x-lueckentext [data-fehler]')).toHaveCount(0);
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(anfang);

		await oeffneUebung(page, druecke);
		await expect(page.locator('[data-sprache-folge]')).not.toContainText('fallen dabei weg');
		await druecke(silbenKnopf(page, 'Bögen'));
		await aktivIn(silben(page), 'Bögen');
		await expect(page.locator('[data-sprache-folge]')).toContainText('fallen dabei weg');
	});

	const markiereBiene = (page: Page) => markiere(page, 'Biene');

	test('Nur markierter Text; s/w bleibt erkennbar', async ({ druecke, page }) => {
		test.slow();
		const { dok, id } = await lesetext();
		await oeffne(page, id, dok);
		await waehleAbsatz(page, druecke);
		await oeffneUebung(page, druecke);
		await markiereBiene(page);
		await page.locator('[data-sprache="buchstaben-mischen"]').click();
		await expect.poll(() => quelle(page)).toContain('→ [Biene]</x-lueckentext>');
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).not.toContain('→ [Biene]');
		await waehleAbsatz(page, druecke);
		await markiereBiene(page);
		await druecke(vokale(page));
		await expect.poll(() => quelle(page)).toContain('Die B<mark>ie</mark>n<mark>e</mark> fliegt');
		const stil = await material(page)
			.locator('mark')
			.first()
			.evaluate((m) => {
				m.ownerDocument.body.classList.add('sw');
				const s = getComputedStyle(m);
				return { fett: Number(s.fontWeight), linie: s.textDecorationLine };
			});
		expect(stil.fett).toBeGreaterThanOrEqual(700);
		expect(stil.linie).toContain('underline');
	});

	test('Zeilennummern stimmen über mehrere Seiten, nach Klasse und Format', async ({ druecke, page }) => {
		test.slow();
		const { dok, id } = await lesetext(2);
		await oeffne(page, id, dok);
		await waehleAbsatz(page, druecke);
		const nummern = page.locator('[data-sprache-zeilennummern]');
		await aktivIn(nummern, 'Aus');
		await druecke(nummern.getByRole('button', { name: 'Jede Zeile' }));
		await expect.poll(() => quelle(page)).toContain('data-zeilennummern="1"');
		await aktivIn(nummern, 'Jede Zeile');
		const m = material(page);
		await expect(m.locator('.zeilennummer').first()).toBeVisible();
		const zaehle = () =>
			m.locator('body').evaluate(() => {
				const absaetze = [...document.querySelectorAll<HTMLElement>('[data-zeilennummern]')];
				const zeilen = absaetze.reduce((summe, a) => {
					const hoehe = Number.parseFloat(getComputedStyle(a).lineHeight);
					return summe + Math.round(a.getBoundingClientRect().height / hoehe);
				}, 0);
				const gezeigt = [...document.querySelectorAll('.zeilennummer')].map((n) => Number(n.textContent));
				return { zeilen, nummern: gezeigt };
			});
		const pruefe = async () => {
			const { nummern: gezeigt, zeilen } = await zaehle();
			expect(zeilen).toBeGreaterThan(1);
			expect(gezeigt).toEqual(Array.from({ length: zeilen }, (_, i) => i + 1));
			return zeilen;
		};
		const kl3 = await pruefe();
		await m.locator('body').evaluate(() => {
			document.body.classList.remove('kl3', 'kl2', 'kl4');
			document.body.classList.add('kl1');
			(window as unknown as { zeichneAbbildungen: () => void }).zeichneAbbildungen();
		});
		const kl1 = await pruefe();
		expect(kl1, 'Gegenprobe: Größere Schrift ergibt mehr Zeilen').toBeGreaterThanOrEqual(kl3);
		await m.locator('body').evaluate(() => {
			document.body.classList.add('a5-hoch');
			(window as unknown as { zeichneAbbildungen: () => void }).zeichneAbbildungen();
		});
		expect(await pruefe()).toBeGreaterThan(kl3);
		// Über die Seite hinweg: Die zweite Seite zählt weiter.
		await m.locator('body').evaluate(() => {
			const seite = document.querySelector('.seite') as HTMLElement;
			const neu = document.createElement('section');
			neu.className = 'seite';
			const p = seite.querySelector('[data-zeilennummern]')?.cloneNode(true) as HTMLElement;
			neu.append(p);
			document.body.append(neu);
			(window as unknown as { zeichneAbbildungen: () => void }).zeichneAbbildungen();
		});
		await pruefe();
	});
});

test.describe('Punkte und Noten (053)', () => {
	const aufgabe = (nr: number, punkte: string, loesung: string) =>
		`<div class="aufgabe"><span class="nr">${nr}</span><div class="anw"><span class="text">Aufgabe ${nr}</span><span class="punkte">${punkte}</span></div><div class="koerper"><span class="antwort" data-l="${loesung}"></span></div></div>`;
	const arbeit = async () => {
		const { dok, id, material: pfad } = await uhrzeit();
		const alt = await readFile(pfad, 'utf8');
		const seite = `<section class="seite">${aufgabe(1, '(4 P.)', 'vier')}${aufgabe(2, '(2,5 P.)', 'zwei')}${aufgabe(3, '(3 P.)', 'drei')}<div class="aufgabe"><span class="nr stern">★</span><div class="anw"><span class="text">Extra</span><span class="punkte">(9 P.)</span></div></div><x-gesamtpunkte></x-gesamtpunkte><x-notenschluessel></x-notenschluessel><x-erwartungshorizont></x-erwartungshorizont></section>`;
		await writeFile(pfad, alt.replace(/<section class="seite"[\s\S]*<\/section>/, seite));
		return { dok, id };
	};

	test('Gesamtpunkte nach Löschen, Duplizieren und Verschieben; Schlüssel passt sich an', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id } = await arbeit();
		await oeffne(page, id, dok);
		const m = material(page);
		const gesamt = m.locator('x-gesamtpunkte');
		await expect(gesamt, 'Sternchenaufgabe zählt nicht').toContainText('von 9,5 Punkten');
		await expect(m.locator('x-notenschluessel')).toContainText('Punkte (von 9,5)');
		await expect(m.locator('x-notenschluessel')).toContainText('Vorschlag');

		await druecke(m.locator('.aufgabe').nth(1));
		await page.getByRole('button', { name: 'Nach unten' }).click();
		await expect.poll(() => quelle(page)).toMatch(/Aufgabe 3[\s\S]*2,5 P/);
		await expect(gesamt).toContainText('von 9,5 Punkten');

		await druecke(m.locator('.aufgabe').first());
		await page.getByRole('button', { name: 'Duplizieren' }).click();
		await expect(gesamt).toContainText('von 13,5 Punkten');

		await druecke(m.locator('.aufgabe').first());
		await page.getByRole('button', { name: 'Löschen' }).click();
		await expect(gesamt).toContainText('von 9,5 Punkten');
	});

	test('Eigene Grenzen bleiben; Erwartungshorizont nur in der Lösung, passend zu den Antworten', async ({
		druecke,
		page,
	}) => {
		test.slow();
		const { dok, id } = await arbeit();
		await oeffne(page, id, dok);
		const m = material(page);
		await druecke(m.locator('x-notenschluessel'));
		await page.getByLabel('Grenzen in Prozent', { exact: true }).fill('1:90; 2:75; 3:60; 4:45; 5:20');
		await page.getByLabel('Grenzen in Prozent', { exact: true }).press('Tab');
		await expect.poll(() => quelle(page)).toContain('grenzen="1:90; 2:75; 3:60; 4:45; 5:20"');
		await expect(m.locator('x-notenschluessel')).not.toContainText('Vorschlag');
		await page.getByRole('button', { name: 'Auswahl aufheben' }).click();

		await expect(m.locator('x-erwartungshorizont')).toBeHidden();
		await druecke(m.locator('.aufgabe').first());
		await page.locator('[data-panel]').getByLabel('Anforderung', { exact: true }).selectOption('II');
		await expect.poll(() => quelle(page)).toContain('data-afb="II"');
		await page
			.getByRole('group', { name: 'Was zeigen?' })
			.getByRole('button', { name: 'Lösung', exact: true })
			.click();
		const horizont = material(page).locator('x-erwartungshorizont');
		await expect(horizont).toBeVisible();
		await expect(horizont.locator('tbody tr').first()).toContainText('vier');
		await expect(horizont.locator('tbody tr').first()).toContainText('4');
		await expect(horizont.locator('tbody tr').first()).toContainText('II');
		await expect(horizont.locator('tbody tr').nth(2)).toContainText('drei');
	});
});
