import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { gespeichert, material, oeffne, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

/** Ein Foto wie vom iPad, mit Kamera und GPS-Ort in den EXIF-Daten. */
const GPS_FOTO = `
import io, sys
from PIL import Image
exif = Image.Exif()
exif[0x010F] = "Apple"
exif[0x8825] = {1: "N", 2: (48.0, 46.0, 0.0), 3: "E", 4: (9.0, 10.0, 0.0)}
puffer = io.BytesIO()
Image.new("RGB", (1200, 900), "#3c8c3c").save(puffer, "JPEG", exif=exif.tobytes())
sys.stdout.buffer.write(puffer.getvalue())
`;
const EXIF = 'import sys; from PIL import Image; b = Image.open(sys.argv[1]); print(len(b.getexif()), b.size)';

const WILLI = '<img class="figur" src="bilder/willi.png" alt="Willi">';
const GRAFIK = '<img src="bilder/wachstum.png" alt="Samen, Keimling, Pflanze, Blume">';

/** Wartet, bis eine Arbeit am Server (Hochladen, Umwandeln) in der Datei angekommen ist. */
const bisDarin = (datei: string, text: string) =>
	expect.poll(() => readFile(datei, 'utf8'), { timeout: 15_000 }).toContain(text);

const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const hinweis = (page: Page) => page.locator('div[role="status"][aria-live]');

/** Zeilen der neuen Fassung, die sich geändert haben. */
const geaendert = (alt: string, neu: string) => {
	const vorher = alt.split('\n');
	return neu.split('\n').filter((zeile, i) => zeile !== vorher[i]);
};

/** Zieht einen Griff um `dx` Bildschirm-Pixel nach rechts: mit der Maus über Playwright, mit dem Finger per Ereignis. */
const zieheGriff = async (page: Page, hasTouch: boolean, griff: Locator, dx: number) => {
	const box = await griff.boundingBox();
	if (!box) {
		throw new Error('Griff nicht sichtbar');
	}
	const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	if (!hasTouch) {
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		for (let i = 1; i <= 8; i += 1) {
			await page.mouse.move(start.x + (dx * i) / 8, start.y);
		}
		await page.mouse.up();
		return;
	}
	await griff.evaluate(
		async (element, { versatz, x, y }) => {
			const warte = (n: number) => new Promise((fertig) => setTimeout(fertig, n));
			const sende = (typ: string, px: number) =>
				element.dispatchEvent(
					new PointerEvent(typ, {
						bubbles: true,
						cancelable: true,
						clientX: px,
						clientY: y,
						pointerId: 9,
						pointerType: 'touch',
						isPrimary: true,
					}),
				);
			sende('pointerdown', x);
			for (let i = 1; i <= 8; i += 1) {
				await warte(20);
				sende('pointermove', x + (versatz * i) / 8);
			}
			sende('pointerup', x + versatz);
		},
		{ versatz: dx, x: start.x, y: start.y },
	);
};

const sammlung = async (page: Page, druecke: (z: Locator) => Promise<void>, schluessel: string) => {
	await druecke(page.getByRole('button', { name: 'Aus der Sammlung' }));
	const dialog = page.getByRole('dialog', { name: 'Bild aus der Sammlung' });
	await expect(dialog).toBeVisible();
	await druecke(dialog.locator(`[data-sammlung-bild="${schluessel}"]`));
	await expect(dialog).toBeHidden();
};

test.describe('Editor: Bilder', () => {
	test('tauscht die Leitfigur aus der Sammlung: nur src und alt, Größe bleibt', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		await writeFile(
			datei,
			(await readFile(datei, 'utf8')).replace(
				WILLI,
				WILLI.replace('class="figur"', 'class="figur" style="--figur:70px"'),
			),
		);
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		await druecke(material(page).locator('img.figur'));
		await expect(page.locator('[data-bildwerkzeug="bild"]')).toBeVisible();

		await druecke(page.getByRole('button', { name: 'Aus der Sammlung' }));
		const dialog = page.getByRole('dialog', { name: 'Bild aus der Sammlung' });
		await dialog.getByRole('searchbox').fill('wilma');
		await expect(dialog.locator('[data-sammlung-bild]')).toHaveCount(1);
		await druecke(dialog.locator('[data-sammlung-bild="_assets/bilder/wilma.png"]'));
		await gespeichert(page, datei);
		const nachher = await readFile(datei, 'utf8');
		expect(geaendert(vorher, nachher)).toEqual([
			'    <div class="tipp"><img class="figur" style="--figur:70px" src="bilder/wilma.png" alt="Wilma"><div class="blase">Zu 1: Erst der kleine Zeiger. Er zeigt die Stunde.</div></div>',
		]);
		await expect(page.locator('[data-auswahl="figur"]')).toBeVisible();
		await expect(material(page).locator('img.figur')).toHaveAttribute('src', 'bilder/wilma.png');

		await druecke(zurueck(page));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});

	test('ändert Größe mit Regler und Ecke, nie breiter als die Spalte, und die Beschreibung', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		const { dok, id, material: datei } = await uhrzeit();
		await oeffne(page, id, dok);
		const grafik = material(page).locator('img[src="bilder/wachstum.png"]');
		await druecke(grafik);
		await expect(page.locator('[data-auswahl="bild"]')).toBeVisible();

		await page.locator('[data-bild-groesse]').fill('200');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(
			'<img style="width:200px" src="bilder/wachstum.png" alt="Samen, Keimling, Pflanze, Blume">',
		);
		await expect(page.locator('[data-griff]')).toHaveCount(4);

		const spalte = await grafik.evaluate((b) => {
			const eltern = b.parentElement as HTMLElement;
			const stil = getComputedStyle(eltern);
			return Math.floor(eltern.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight));
		});
		await zieheGriff(page, hasTouch, page.locator('[data-griff="unten-rechts"]'), 2000);
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(`<img style="width:${spalte}px" src="bilder/wachstum.png"`);
		expect(await grafik.evaluate((b) => Math.round(b.getBoundingClientRect().width))).toBe(spalte);

		const beschreibung = page.locator('[data-bild-beschreibung]');
		await beschreibung.fill('Vom Samen zur Blume');
		await beschreibung.press('Enter');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain(
			`<img style="width:${spalte}px" src="bilder/wachstum.png" alt="Vom Samen zur Blume">`,
		);
	});

	test('entfernt ein Bild mit Hinweis „Rückgängig“', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		await druecke(material(page).locator('img[src="bilder/wachstum.png"]'));
		await druecke(page.getByRole('button', { name: 'Bild entfernen' }));
		await expect(hinweis(page)).toContainText('Bild entfernt.');
		await gespeichert(page, datei);
		const ohne = await readFile(datei, 'utf8');
		expect(ohne).not.toContain(GRAFIK);
		expect(ohne.split('\n').length).toBe(vorher.split('\n').length - 1);
		await druecke(hinweis(page).getByRole('button', { name: 'Rückgängig' }));
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toBe(vorher);
	});

	test('lädt ein Foto hoch: Datenschutz-Hinweis einmal, ohne EXIF/GPS, nur src ändert sich', async ({
		druecke,
		page,
	}) => {
		const { dok, id, material: datei, ordner } = await uhrzeit();
		const vorher = await readFile(datei, 'utf8');
		await oeffne(page, id, dok);
		await druecke(material(page).locator('img[src="bilder/wachstum.png"]'));
		await druecke(page.getByRole('button', { name: 'Foto hochladen' }));
		await expect(page.getByText('Bitte keine Fotos, auf denen Kinder zu erkennen sind.')).toBeVisible();
		const foto = {
			name: 'IMG_0042.JPG',
			mimeType: 'image/jpeg',
			buffer: execFileSync('python3', ['-c', GPS_FOTO]),
		};
		const waehler = page.waitForEvent('filechooser');
		await druecke(page.getByText('Verstanden, Foto wählen'));
		await (await waehler).setFiles(foto);
		await bisDarin(datei, 'bilder/foto.jpg');
		await gespeichert(page, datei);

		const nachher = await readFile(datei, 'utf8');
		expect(geaendert(vorher, nachher)).toEqual(['    <img src="bilder/foto.jpg" alt="">']);
		const gespeichertesFoto = path.join(ordner, 'bilder', 'foto.jpg');
		expect(execFileSync('python3', ['-c', EXIF, gespeichertesFoto], { encoding: 'utf8' }).trim()).toBe(
			'0 (1200, 900)',
		);
		await expect(page.locator('[data-auswahl="bild"]')).toBeVisible();
		await expect(page.getByText('Beschreibe das Bild in ein paar Worten.')).toBeVisible();
		await expect(material(page).locator('img[src="bilder/foto.jpg"]')).toHaveJSProperty('naturalWidth', 1200);

		// In derselben Sitzung kein Hinweis mehr: „Foto hochladen“ öffnet gleich die Auswahl.
		const nochmal = page.waitForEvent('filechooser');
		await druecke(page.locator('label', { hasText: 'Foto hochladen' }));
		await (await nochmal).setFiles({ ...foto, name: 'Kürbis Ernte.jpg' });
		await bisDarin(datei, 'bilder/kuerbis-ernte.jpg');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<img src="bilder/kuerbis-ernte.jpg" alt="Kürbis Ernte">');
		expect(existsSync(gespeichertesFoto)).toBe(true);
	});

	test('wandelt ein farbiges Bild im s/w-Blatt in Graustufen um', async ({ druecke, page }) => {
		const { dok, id, material: datei, ordner } = await uhrzeit();
		const roh = await readFile(datei, 'utf8');
		await writeFile(datei, roh.replace('<body class="kl2 farbe', '<body class="kl2 sw'));
		await oeffne(page, id, dok);
		await druecke(material(page).locator('img.figur'));
		const farbig = page.locator('[data-hinweis="farbig"]');
		await expect(farbig).toContainText('Das Bild ist farbig');
		await expect(farbig).toContainText('Für eine Strichzeichnung schreib Claude.');
		await druecke(farbig.getByRole('button', { name: 'In Graustufen umwandeln' }));
		await bisDarin(datei, 'willi-grau.png');
		await gespeichert(page, datei);
		expect(await readFile(datei, 'utf8')).toContain('<img class="figur" src="bilder/willi-grau.png" alt="Willi">');
		expect(existsSync(path.join(ordner, 'bilder', 'willi-grau.png'))).toBe(true);
		await expect(page.locator('[data-auswahl="figur"]')).toBeVisible();
		await expect(material(page).locator('img.figur')).toHaveJSProperty('complete', true);
		await expect(page.locator('[data-bildwerkzeug="bild"]')).toBeVisible();
		await expect(farbig).toHaveCount(0);
	});

	test('setzt ein Bild an die Stelle eines Platzhalters', async ({ druecke, page }) => {
		const { dok, id, material: datei } = await uhrzeit();
		const roh = await readFile(datei, 'utf8');
		const linie = '<div class="schreiblinie nicht-loesung"></div>';
		await writeFile(
			datei,
			roh.replace(linie, `<div class="platzhalter" style="--h:120px">Pflanze wächst</div>${linie}`),
		);
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.platzhalter'));
		await expect(page.locator('[data-bildwerkzeug="platzhalter"]')).toContainText(
			'Hier soll ein Bild hin: Pflanze wächst',
		);
		await sammlung(page, druecke, '_assets/bilder/wachstum.png');
		await bisDarin(datei, 'style="width:238px"');
		await gespeichert(page, datei);
		// 120 px hoch bei 1776 × 896 Pixeln ergibt 238 px Breite.
		expect(await readFile(datei, 'utf8')).toContain(
			`<img src="bilder/wachstum.png" alt="Samen, Keimling, Pflanze, Blume" style="width:238px">${linie}`,
		);
		await expect(page.locator('[data-auswahl="bild"]')).toBeVisible();
	});
});
