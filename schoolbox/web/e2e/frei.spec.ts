import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { gespeichert, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, MATERIAL_DIR, test } from './hilfe';

/** Wie ein frei gestaltetes Blatt: eigene Klassen, Entitäten, ungewöhnliche Schreibweisen. Alles soll so bleiben. */
const FREI = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Fall 8</title>
<link rel="stylesheet" href="blatt.css"><link rel="stylesheet" href="../../reihe.css">
<script src="abbildungen.js" defer></script>
<style>.eigen{border:2px solid #333;padding:8px;margin:8px}.ab-rahmen{padding:4px}</style></head>
<body class="kl3 sw">
<div class="seite">
    <div class="ab-kopf"><span class="marke">Fall&nbsp;8</span></div>
    <div class="ab-rahmen">
        <div class="eigen" id="erster">K&auml;fer &amp; Krokodil <b class="zz">7</b><b>&lt;</b></div>
        <div class="eigen" id="zweiter">Zweite Spur</div>
    </div>
    <div class="eigen" id="dritter">Dritte Spur</div>
    <table id="plan"><tr><th>Tag</th><th>Spur</th></tr><tr><td id="zelle">Mo</td><td>Teich</td></tr></table>
    <table id="breit"><tr><td colspan="2" id="verbunden">Ganz</td></tr><tr><td>A</td><td>B</td></tr></table>
    <x-uhr stunde="3" minute="0" id="uhr"></x-uhr>
</div>
</body></html>
`;

const blatt = async (page: Page) => {
	const { dok, id, material: datei, ordner } = await uhrzeit();
	await writeFile(path.join(ordner, '..', '..', 'reihe.css'), '.eigen{outline:3px solid #123456}');
	await writeFile(datei, FREI);
	await oeffne(page, id, dok);
	return datei;
};

/** Mit dem Finger beginnt das Tippen im gewählten Text schon beim Antippen; „Fertig“ führt zu den Werkzeugen des Blocks. */
const zuDenWerkzeugen = async (page: Page, werkzeug: Locator) => {
	const fertig = page.getByRole('button', { name: 'Fertig' });
	await expect(werkzeug.or(fertig).first()).toBeVisible();
	if (await fertig.isVisible()) {
		await fertig.click();
	}
	await expect(werkzeug).toBeVisible();
};

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });

test.describe('Editor: frei gestaltetes Material (054)', () => {
	test('Text in fremden Elementen: nur das Wort ändert sich, zurück ist es Byte für Byte die alte Quelle', async ({
		druecke,
		page,
	}) => {
		const datei = await blatt(page);
		const ziel = material(page).locator('#erster');
		await druecke(ziel);
		await expect(page.locator('[data-auswahl="freitext"]')).toBeVisible();
		await expect(ziel).toHaveAttribute('contenteditable', 'true');
		await druecke(ziel);
		await page.keyboard.press('End');
		await page.keyboard.type('X');
		await page.keyboard.press('Escape');
		await expect.poll(() => readFile(datei, 'utf8')).toContain('&lt;X</b>');
		expect(await readFile(datei, 'utf8')).toBe(FREI.replace('<b>&lt;</b>', '<b>&lt;X</b>'));

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(FREI);
	});

	test('Tippen und wieder Löschen führt ohne Rückgängig zur alten Quelle, auch mit Entitäten', async ({
		druecke,
		page,
	}) => {
		const datei = await blatt(page);
		const ziel = material(page).locator('.marke');
		await druecke(ziel);
		await druecke(ziel);
		await page.keyboard.press('End');
		await page.keyboard.type('X');
		await page.keyboard.press('Escape');
		await expect.poll(() => readFile(datei, 'utf8')).toContain('Fall&nbsp;8X</span>');

		await druecke(ziel);
		await druecke(ziel);
		await page.keyboard.press('End');
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Escape');
		await expect.poll(() => readFile(datei, 'utf8')).toBe(FREI);
	});

	test('Antippen und Verlassen ohne Tippen ändert nichts', async ({ druecke, page }) => {
		const datei = await blatt(page);
		for (const stelle of ['#erster', '.marke', '#zelle', '#verbunden']) {
			const ziel = material(page).locator(stelle);
			await druecke(ziel);
			await druecke(ziel);
			await page.keyboard.press('Escape');
		}
		expect(await quelle(page)).toBe(FREI);
		expect(await readFile(datei, 'utf8')).toBe(FREI);
	});

	test('Blöcke lassen sich im Panel verschieben, kopieren und löschen, zwischen allen Geschwistern', async ({
		druecke,
		page,
	}) => {
		const datei = await blatt(page);
		await druecke(material(page).locator('.ab-kopf'));
		await expect(page.locator('[data-auswahl="block"], [data-auswahl="freitext"]')).toBeVisible();
		await zuDenWerkzeugen(page, page.getByRole('button', { name: 'Nach unten' }));
		await druecke(page.getByRole('button', { name: 'Nach unten' }));
		await gespeichert(page, datei);
		const eins = await readFile(datei, 'utf8');
		expect(eins.indexOf('ab-rahmen">')).toBeLessThan(eins.indexOf('ab-kopf'));

		await druecke(material(page).locator('#dritter'));
		await zuDenWerkzeugen(page, page.getByRole('button', { name: 'Duplizieren' }));
		await druecke(page.getByRole('button', { name: 'Duplizieren' }));
		await gespeichert(page, datei);
		expect((await readFile(datei, 'utf8')).match(/Dritte Spur/g)).toHaveLength(2);
		await druecke(page.getByRole('button', { name: 'Löschen' }));
		await gespeichert(page, datei);
		expect((await readFile(datei, 'utf8')).match(/Dritte Spur/g)).toHaveLength(1);
		await druecke(zurueck(page));
		await druecke(zurueck(page));
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(FREI);
	});

	test('Einfügen: Das Plus setzt hinter den gewählten fremden Block', async ({ druecke, page }) => {
		const datei = await blatt(page);
		await druecke(material(page).locator('#dritter'));
		await zuDenWerkzeugen(page, page.locator('[data-einfuegen-plus]'));
		await druecke(page.locator('[data-einfuegen-plus]'));
		const fenster = page.locator('[data-schnellauswahl]');
		await fenster.getByRole('searchbox').fill('Schreiblinie');
		await druecke(fenster.locator('[data-katalog-eintrag="schreiblinie"]'));
		await gespeichert(page, datei);
		const neu = await readFile(datei, 'utf8');
		expect(neu.length).toBeGreaterThan(FREI.length);
		const zwischen = neu.slice(neu.indexOf('Dritte Spur'), neu.indexOf('<table id="plan"'));
		expect(zwischen).toContain('schreiblinie');
	});

	test('Fremde Tabelle: Einfache bekommt die Tabellen-Werkzeuge, verbundene nur den Zellentext', async ({
		druecke,
		page,
	}) => {
		const datei = await blatt(page);
		const zelle = material(page).locator('#zelle');
		await druecke(zelle);
		await expect(page.locator('[data-auswahl="tabellenzelle"]')).toBeVisible();
		const zeile = page.locator('[data-bausteinleiste]').getByRole('button', { name: 'Zeile danach' });
		await zuDenWerkzeugen(page, zeile);
		await zeile.click();
		await gespeichert(page, datei);
		await expect(material(page).locator('#plan tr')).toHaveCount(3);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(FREI);

		await druecke(material(page).locator('#verbunden'));
		await expect(page.locator('[data-auswahl="freitext"]')).toBeVisible();
		await expect(page.locator('[data-tabelle-werkzeug]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Zeile danach' })).toHaveCount(0);
	});

	test('Abbildungen bleiben Abbildungen: ihr Inhalt ist nie freier Text', async ({ druecke, page }) => {
		await blatt(page);
		const uhr = material(page).locator('#uhr');
		await druecke(uhr);
		await expect(page.locator('[data-auswahl="abbildung"]')).toBeVisible();
		await expect(uhr).not.toHaveAttribute('contenteditable', 'true');
		expect(await uhr.evaluate((e) => e.querySelector('[contenteditable="true"]') === null)).toBe(true);
	});

	test('Mappen-Stylesheet und eigener Stil gelten auch im Editor', async ({ page }) => {
		await blatt(page);
		const stil = await material(page)
			.locator('#dritter')
			.evaluate((e) => {
				const { borderTopWidth, outlineWidth } = getComputedStyle(e);
				return { borderTopWidth, outlineWidth };
			});
		expect(stil).toEqual({ borderTopWidth: '2px', outlineWidth: '3px' });
	});
});

const kiFall = (name: string) => writeFile(path.join(`${MATERIAL_DIR}-ki`, 'fall.txt'), name);
const chat = (page: Page) => page.locator('[data-chat]');

const beauftrage = async (page: Page, text: string) => {
	await page.getByRole('button', { name: 'Claude', exact: true }).click();
	await chat(page).getByLabel('Was soll Claude ändern?').fill(text);
	await chat(page).getByRole('button', { name: 'Senden' }).click();
};

const nimmAn = async (page: Page, datei: string) => {
	await expect(chat(page).locator('[data-ki-vorschlag]')).toBeVisible();
	await chat(page).getByRole('button', { name: 'Vergleichen' }).click();
	await expect(page.frameLocator('[data-vorschlag-rahmen]').locator('figure[data-frei] svg')).toBeAttached();
	await page.getByRole('dialog').getByRole('button', { name: 'Annehmen' }).click();
	await expect(material(page).locator('[data-frei]')).toBeVisible();
	await gespeichert(page, datei);
};

test.describe('Freies Element von Claude (088)', () => {
	test.afterEach(async () => {
		await kiFall('gut');
	});

	test('Vorschlag annehmen, Hinweis im Inspektor, ordnen, löschen, Rückgängig', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await kiFall('frei');
		await oeffne(page, id, dok);
		await beauftrage(page, 'Mach ein Tangram in Form eines Waschbärs');
		await nimmAn(page, datei);
		const stand = await readFile(datei, 'utf8');

		const figur = material(page).locator('figure[data-frei]');
		await druecke(figur.locator('svg'));
		await expect(page.locator('[data-auswahl="freieselement"]')).toBeVisible();
		await expect(page.locator('[data-breadcrumb]')).toContainText('Tangram Waschbär');
		const hinweis = page.locator('[data-frei-hinweis]');
		await expect(hinweis).toContainText('Von Claude gebaut. Hier gibt es keine Einstellungen.');

		// Text im SVG bleibt zu, sonst bräche das Tippen seine Struktur.
		await expect(figur.locator('svg text')).not.toHaveAttribute('contenteditable', 'true');

		await druecke(hinweis.getByRole('button', { name: 'Claude fragen' }));
		await expect(chat(page)).toBeVisible();
		await expect(chat(page).locator('[data-chat-chip]')).toContainText('Tangram Waschbär');
		await page.keyboard.press('Escape');

		await zuDenWerkzeugen(page, page.getByRole('button', { name: 'Nach oben' }));
		await druecke(page.getByRole('button', { name: 'Nach oben' }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).not.toBe(stand);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);

		await druecke(figur.locator('svg'));
		await zuDenWerkzeugen(page, page.getByRole('button', { name: 'Löschen' }));
		await druecke(page.getByRole('button', { name: 'Löschen' }));
		await gespeichert(page, datei);
		await expect(figur).toHaveCount(0);
		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(stand);
	});

	test('Skript führt zu keinem Vorschlag: Meldung im Chat, Blatt unverändert', async ({ page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await kiFall('frei-skript');
		await oeffne(page, id, dok);
		await beauftrage(page, 'Mach etwas zum Anklicken');
		await expect(chat(page).getByText(/keinen Vorschlag/)).toBeVisible();
		await expect(chat(page).locator('[data-ki-vorschlag]')).toHaveCount(0);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});

	test('Im Vergleich läuft kein fremdes Skript, Abbildungen zeichnen trotzdem', async ({ page }) => {
		const { dok, id, material: datei, ordner } = await uhrzeit();
		const alt = await readFile(datei, 'utf8');
		const vorschlag = path.join(ordner, 'vorschlag');
		await mkdir(vorschlag, { recursive: true });
		// So käme es nur an der Prüfung vorbei: Die zweite Schicht muss es trotzdem aufhalten.
		await writeFile(path.join(vorschlag, 'material.html'), alt.replace('</section>', '<script>window.boese = 1</script><x-uhr zeit="4:30"></x-uhr></section>'));
		await writeFile(path.join(vorschlag, 'vorschlag.json'), JSON.stringify({ auftrag: 'a', umfang: 'Ganzes Blatt', zeit: new Date().toISOString(), basis: 'x', antwort: '', meldungen: [], fehler: 0 }));
		const seite = await page.goto(`/ansicht/${id}/dokumente/${dok}/?vorschlag=1`);
		expect(seite?.headers()['content-security-policy']).toContain("script-src 'self'");
		await expect(page.locator('x-uhr svg').last()).toBeVisible();
		expect(await page.evaluate(() => (window as unknown as { boese?: number }).boese)).toBeUndefined();
	});

	test('Druckansicht in s/w, Teilen-Link und Präsentation zeigen das Element', async ({ browser, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const alt = await readFile(datei, 'utf8');
		const frei =
			'<figure data-frei data-frei-titel="Tangram Waschbär"><svg viewBox="0 0 100 100" width="300" height="300"><polygon id="umriss" points="0,0 100,0 50,50" fill="#c33" stroke="#000" stroke-width="2"/></svg></figure>';
		await writeFile(datei, alt.replace('</section>', `${frei}</section>`));

		await page.goto(`/ansicht/${id}/dokumente/${dok}/?profil=sw`);
		await page.emulateMedia({ media: 'print' });
		const umriss = page.locator('#umriss');
		await expect(umriss).toBeVisible();
		const farbe = await umriss.evaluate((e) => getComputedStyle(e).fill);
		const [r, g, b] = (farbe.match(/\d+/g) ?? []).map(Number);
		expect(r).toBe(g);
		expect(g).toBe(b);
		await page.emulateMedia({ media: 'screen' });

		await page.goto(`/ansicht/${id}/dokumente/${dok}/?praesentation=1`);
		await expect(page.locator('#umriss').first()).toBeAttached();

		const antwort = await page.request.post('/api/freigaben', { headers: { 'x-schoolbox': '1' }, data: { mappe: id } });
		const { token } = (await antwort.json()) as { token: string };
		const fremd = await browser.newContext();
		const besuch = await fremd.newPage();
		await besuch.goto(`/f/${token}/ansicht/${id}/dokumente/${dok}/`);
		await expect(besuch.locator('#umriss')).toBeVisible();
		await fremd.close();
	});
});
