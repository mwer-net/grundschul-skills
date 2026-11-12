/**
 * Bild beschreiben (179): das Feld in der Steuerzeile von „Bilder“, die Bildchen der erkannten Figuren, die Kacheln der
 * Aufträge in „Dieser Ordner“, Fehler, Abbrechen, Limit, Meldung und Wiederkommen. Die Claude-Attrappe malt (Fälle
 * `canva-bild`, `canva-pause`, `haenger`) und wartet 2,5 s. Die Figurenbibliothek wird vor jedem Test gesichert und
 * danach zurückgelegt.
 */
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';
import { FIGUREN_ORDNER } from '@schoolbox/kern';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, MATERIAL_DIR, test } from './hilfe';
import { oeffneSchublade, schubladenKnopf } from './schubladen-hilfe';

const kiFall = (name: string) => writeFile(path.join(`${MATERIAL_DIR}-ki`, 'fall.txt'), name);
const BIBLIOTHEK = path.join(MATERIAL_DIR, FIGUREN_ORDNER);
const WACHSTUM = path.join(__dirname, '../../../skills/html-materialerstellung/assets/bilder/wachstum.png');
const WUNSCH = 'Willi und Wilma pflanzen im Garten eine Sonnenblume';
const NEU = 'willi-und-wilma-im-garten.jpg';
/** Die Attrappe wartet 2,5 s; mit Start und Neuladen der Liste bleibt Luft. */
const LAUF = { timeout: 15_000 };
const BEDIENUNG = /[Kk]lick|[Zz]iehen|⌘|antippen|[Tt]ippe/;
const STERN_RAHMEN =
	'<div class="bildrahmen platzhalter" data-lage="frei" data-maske="stern" data-zacken="5" data-innen="0.45" style="--x:300px;--y:420px;--b:240px;--h:240px;clip-path:polygon(50% 0%, 61.75% 34.43%, 97.55% 34.55%, 69.02% 55.9%, 79.39% 90.45%, 50% 69.1%, 20.61% 90.45%, 30.98% 55.9%, 2.45% 34.55%, 38.25% 34.43%)"></div>';

const schublade = (page: Page) => page.locator('[data-schublade-bilder]');
const steuerung = (page: Page) => schublade(page).locator('[data-schublade-steuerung]');
const feld = (page: Page) => schublade(page).getByRole('textbox', { name: 'Bild beschreiben' });
const senden = (page: Page) => schublade(page).getByRole('button', { name: 'Senden' });
const hochladen = (page: Page) => schublade(page).getByText('Foto hochladen', { exact: true });
const gruppenKnopf = (page: Page, name: string) => schublade(page).getByRole('button', { name, exact: true });
const suche = (page: Page) => schublade(page).getByRole('searchbox', { name: 'Bilder suchen' });
const figuren = (page: Page) => schublade(page).locator('[data-bild-figur]');
const liste = (page: Page) => schublade(page).locator('[data-sammlung="mappe"]');
const CANVA_KACHEL = '[data-canva-kachel]';
const canvaKacheln = (page: Page) => schublade(page).locator(CANVA_KACHEL);
const bildKacheln = (page: Page) => liste(page).locator('[data-sammlung-bild]');
const notiz = (page: Page) => schublade(page).locator('[data-bilder-gruppe] > h3 > span').nth(1);
const fehler = (page: Page) => schublade(page).locator('[data-bild-fehler]');
const hinweis = (page: Page) => page.locator('div[role="status"][aria-live]');

const beschreibe = async (page: Page, text: string) => {
	await feld(page).fill(text);
	await feld(page).press('Enter');
};

/** Ein Blatt in einem neuen Ordner, darin schon ein Bild von vor einer Stunde. */
const oeffneBilder = async (page: Page, html?: string) => {
	const u = await uhrzeit();
	const bilder = path.join(MATERIAL_DIR, u.id, 'bilder');
	await mkdir(bilder, { recursive: true });
	await copyFile(WACHSTUM, path.join(bilder, 'beet.png'));
	const alt = new Date(Date.now() - 60 * 60 * 1000);
	await utimes(path.join(bilder, 'beet.png'), alt, alt);
	await oeffne(page, u.id, u.dok);
	if (html) {
		await aendere(page, html);
		await expect(material(page).locator('.seite').first()).toBeVisible();
	}
	await oeffneSchublade(page, 'bilder');
	await expect(feld(page)).toBeVisible();
	return { ...u, bilder };
};

/** Bär und Max mit Steckbrief, Igel nur mit Media-ID: Mit Willi und Wilma sind es fünf Figuren für ein Bild. */
const legeBildfigurenAn = async () => {
	const datei = path.join(BIBLIOTHEK, 'figuren.json');
	const gespeichert = JSON.parse(await readFile(datei, 'utf8')) as { version: number; figuren: unknown[] };
	for (const id of ['baer', 'igel', 'max']) {
		await copyFile(path.join(BIBLIOTHEK, 'kiki.png'), path.join(BIBLIOTHEK, `${id}.png`));
	}
	gespeichert.figuren.push(
		{ id: 'baer', name: 'Bär', steckbrief: 'brauner Bär mit grüner Mütze', posen: [{ datei: 'baer.png' }] },
		{ id: 'igel', name: 'Igel', canva: 'MAigel00001', posen: [{ datei: 'igel.png' }] },
		{ id: 'max', name: 'Max', steckbrief: 'Junge mit roter Jacke', posen: [{ datei: 'max.png' }] },
	);
	await writeFile(datei, JSON.stringify(gespeichert));
};

const mitte = async (ziel: Locator) => {
	const r = await ziel.boundingBox();
	return r ? r.y + r.height / 2 : Number.NaN;
};

let sicherung = '';

test.beforeEach(async () => {
	sicherung = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-sicherung-'));
	await cp(BIBLIOTHEK, sicherung, { recursive: true });
	await kiFall('canva-bild');
});

test.afterEach(async ({ page }) => {
	// Kein Lauf darf nach dem Test noch schreiben.
	const laeufe = async () =>
		((await (await page.request.get('/api/canva')).json()) as { laeufe: { id: string }[] }).laeufe;
	for (const { id } of await laeufe()) {
		await page.request.post(`/api/canva/${id}/abbrechen`, { headers: { 'x-schoolbox': '1' }, data: {} });
	}
	await expect.poll(async () => (await laeufe()).length).toBe(0);
	await rm(BIBLIOTHEK, { recursive: true, force: true });
	await cp(sicherung, BIBLIOTHEK, { recursive: true });
	await rm(sicherung, { recursive: true, force: true });
	await kiFall('gut');
});

test.describe('Bild beschreiben (179)', () => {
	test('Aufbau: Suche, „Welche Bilder?“, dann das Feld; „Foto hochladen“ im selben Rahmen', async ({ page }) => {
		await oeffneBilder(page);
		const y = async (ziel: Locator) => (await ziel.boundingBox())?.y ?? Number.NaN;
		const reihe = [
			suche(page),
			steuerung(page).getByRole('group', { name: 'Welche Bilder?' }),
			steuerung(page).getByRole('textbox', { name: 'Bild beschreiben' }),
		];
		const oben = await Promise.all(reihe.map(y));
		expect(oben).toEqual([...oben].sort((a, b) => a - b));
		await expect(feld(page)).toHaveAttribute('placeholder', 'Bild beschreiben …');
		await expect(schublade(page).locator('[data-bild-beschreiben]').getByText('Foto hochladen')).toBeVisible();
		await expect(schublade(page).locator('[data-bild-datei]')).toHaveCount(1);
		await expect(senden(page)).toBeDisabled();
	});

	test('Bildchen: Willi und Wilma, kein Paul, kein „Williams“', async ({ page, hasTouch }) => {
		await oeffneBilder(page);
		await feld(page).fill('Willi und Wilmas Garten');
		await expect(figuren(page)).toHaveCount(2);
		expect(await figuren(page).evaluateAll((e) => e.map((x) => x.getAttribute('data-bild-figur')))).toEqual([
			'willi',
			'wilma',
		]);
		if (!hasTouch) {
			await figuren(page).first().hover();
			await expect(page.locator('[data-tooltip]')).toHaveText('Willi');
		}
		await feld(page).fill('Paul gießt');
		await expect(figuren(page)).toHaveCount(0);
		await feld(page).fill('Williams Garten');
		await expect(figuren(page)).toHaveCount(0);
	});

	test('Senden: „Dieser Ordner“, Kachel vorn, Text markiert; das neue Bild füllt den gewählten Rahmen', async ({
		page,
	}) => {
		const { id } = await oeffneBilder(page, blattMit({ vorne: [STERN_RAHMEN] }));
		const rahmen = material(page).locator('.bildrahmen');
		await rahmen.evaluate((e) => e.scrollIntoView({ block: 'center' }));
		await rahmen.click();
		await expect(page.locator('[data-gestaltung-inspektor="bildrahmen"]')).toBeVisible();
		await gruppenKnopf(page, 'Dieser Ordner').click();
		await expect(notiz(page)).toHaveText('1 Bild');
		await gruppenKnopf(page, 'Sammlung').click();
		await suche(page).fill('x');

		await beschreibe(page, WUNSCH);
		await expect(gruppenKnopf(page, 'Dieser Ordner')).toHaveAttribute('aria-pressed', 'true');
		await expect(suche(page)).toHaveValue('');
		await expect(liste(page).locator('> li').first().locator(CANVA_KACHEL)).toBeVisible();
		await expect
			.poll(() => feld(page).evaluate((e: HTMLTextAreaElement) => [e.value, e.selectionStart, e.selectionEnd]))
			.toEqual([WUNSCH, 0, WUNSCH.length]);
		await expect(feld(page)).toBeFocused();

		await expect(canvaKacheln(page)).toHaveCount(0, LAUF);
		await expect(bildKacheln(page).first()).toHaveAttribute('data-sammlung-bild', `${id}/bilder/${NEU}`);
		await expect(notiz(page)).toHaveText('2 Bilder');
		// Nichts wird von selbst eingesetzt.
		expect(await quelle(page)).toContain('bildrahmen');

		await bildKacheln(page).first().click();
		await expect.poll(() => quelle(page)).toMatch(new RegExp(`<img class="bild-frei"[^>]*src="[^"]*${NEU}"`));
		expect(await quelle(page)).not.toContain('bildrahmen');
	});

	test('Abbrechen: × an der laufenden Kachel nimmt sie weg, kein neues Bild', async ({ page, druecke }) => {
		await kiFall('haenger');
		const { bilder } = await oeffneBilder(page);
		const vorher = await readdir(bilder);
		await beschreibe(page, WUNSCH);
		const laufend = canvaKacheln(page);
		await expect(laufend).toHaveAttribute('data-status', 'laeuft');
		await expect(laufend.locator('.animate-spin')).toBeVisible();
		await druecke(laufend.getByRole('button', { name: 'Abbrechen' }));
		await expect(canvaKacheln(page)).toHaveCount(0);
		expect(await readdir(bilder)).toEqual(vorher);
	});

	test('Fehler: Kachel über die ganze Zeile; „Noch einmal“ wird fertig, die Fehler-Kachel ist weg', async ({
		page,
		druecke,
	}) => {
		await kiFall('canva-pause');
		const { id } = await oeffneBilder(page);
		await beschreibe(page, WUNSCH);
		const kachel = canvaKacheln(page);
		await expect(kachel).toHaveAttribute('data-status', 'fehler', LAUF);
		await expect(kachel).toContainText('Canva macht gerade eine Pause.');
		const breite = async (ziel: Locator) => (await ziel.boundingBox())?.width ?? 0;
		expect(Math.abs((await breite(kachel)) - (await breite(liste(page))))).toBeLessThanOrEqual(1);

		await kiFall('canva-bild');
		await druecke(kachel.getByRole('button', { name: 'Noch einmal' }));
		await expect(schublade(page).locator('[data-canva-kachel][data-status="fehler"]')).toHaveCount(0);
		await expect(bildKacheln(page).first()).toHaveAttribute('data-sammlung-bild', `${id}/bilder/${NEU}`, LAUF);
		await expect(canvaKacheln(page)).toHaveCount(0);
	});

	test('Fünf Namen: „Höchstens vier Figuren je Bild.“ unter dem Rahmen, keine Kachel', async ({ page }) => {
		await legeBildfigurenAn();
		await oeffneBilder(page);
		await beschreibe(page, 'Willi, Wilma, Bär, Igel und Max spielen Fangen');
		await expect(figuren(page)).toHaveCount(5);
		await expect(fehler(page)).toHaveText('Höchstens vier Figuren je Bild.');
		await expect(schublade(page).getByRole('alert')).toHaveText('Höchstens vier Figuren je Bild.');
		await expect(canvaKacheln(page)).toHaveCount(0);
		await feld(page).press('End');
		await feld(page).pressSequentially(' zusammen');
		await expect(fehler(page)).toHaveCount(0);
	});

	test('Ohne Claude: kein Feld, „Foto hochladen“ so breit wie die Steuerzeile', async ({ page }) => {
		await page.route('**/api/ki/status', (r) =>
			r.fulfill({ json: { verfuegbar: false, limit: null, warnAb: 1, aktionen: [] } }),
		);
		const u = await uhrzeit();
		await oeffne(page, u.id, u.dok);
		await oeffneSchublade(page, 'bilder');
		await expect(hochladen(page)).toBeVisible();
		await expect(schublade(page).getByRole('textbox', { name: 'Bild beschreiben' })).toHaveCount(0);
		const breite = async (ziel: Locator) => (await ziel.boundingBox())?.width ?? 0;
		expect(Math.abs((await breite(hochladen(page))) - (await breite(suche(page))))).toBeLessThanOrEqual(1);
	});

	test('Ruhig: kein Bedienhinweis und kein Kürzel in der Schublade', async ({ page }) => {
		await kiFall('haenger');
		await oeffneBilder(page);
		await feld(page).fill('Willi und Wilma im Garten');
		await feld(page).press('Enter');
		await expect(canvaKacheln(page)).toHaveCount(1);
		const text = await schublade(page).innerText();
		expect(text).not.toMatch(BEDIENUNG);
		expect(text).not.toMatch(/[⌥⌘⏎]/);
	});

	test('Wiederkommen: Nach dem Neuladen steht die Kachel wieder vorn', async ({ page }) => {
		await kiFall('haenger');
		await oeffneBilder(page);
		await beschreibe(page, WUNSCH);
		await expect(canvaKacheln(page)).toHaveAttribute('data-status', 'laeuft');
		await page.reload();
		await oeffneSchublade(page, 'bilder');
		await gruppenKnopf(page, 'Dieser Ordner').click();
		await expect(liste(page).locator('> li').first().locator(CANVA_KACHEL)).toHaveAttribute('aria-label', WUNSCH);
	});

	test('Meldung: „Figuren“ offen, fertig, dann die Meldung; „Ansehen“ öffnet „Bilder“', async ({ page, druecke }) => {
		const { id } = await oeffneBilder(page);
		await beschreibe(page, WUNSCH);
		await expect(canvaKacheln(page)).toHaveCount(1);
		await druecke(schubladenKnopf(page, 'figuren'));
		await expect(schubladenKnopf(page, 'bilder')).toHaveAttribute('aria-pressed', 'false');

		await expect(hinweis(page)).toContainText('Neues Bild ist fertig.', LAUF);
		await druecke(hinweis(page).getByRole('button', { name: 'Ansehen' }));
		await expect(schubladenKnopf(page, 'bilder')).toHaveAttribute('aria-pressed', 'true');
		await expect(bildKacheln(page).first()).toHaveAttribute('data-sammlung-bild', `${id}/bilder/${NEU}`);
	});

	test('iPad quer: „Foto hochladen“ einzeilig, Bildchen und Senden auf einer Linie', async ({ page }, info) => {
		test.skip(info.project.name !== 'ipad-quer', 'nur iPad quer');
		await oeffneBilder(page);
		await feld(page).fill('Willi und Wilma im Garten');
		await expect(figuren(page)).toHaveCount(2);
		const knopf = hochladen(page);
		const [breit, hoch] = await knopf.evaluate((e) => [e.scrollWidth <= e.clientWidth, e.clientHeight]);
		expect(breit).toBe(true);
		expect(hoch).toBeLessThanOrEqual(48);
		const linie = await Promise.all([mitte(figuren(page).first()), mitte(senden(page)), mitte(knopf)]);
		expect(Math.abs((linie[0] ?? 0) - (linie[1] ?? 0))).toBeLessThanOrEqual(1);
		expect(Math.abs((linie[1] ?? 0) - (linie[2] ?? 0))).toBeLessThanOrEqual(1);
	});
});

test.describe('Bild beschreiben am Limit (179)', () => {
	/** Der Stand lebt im Server: Das Konto neu fragen, die Attrappe meldet wieder Luft. */
	test.afterEach(async ({ page }) => {
		await kiFall('gut');
		await page.request.post('/api/ki/limit/pruefen', { headers: { 'x-schoolbox': '1' }, data: {} });
	});

	test('Gesperrt: Senden aus, darunter die Zeile mit dem Limit', async ({ page }) => {
		await kiFall('limit-gesperrt');
		await page.request.post('/api/ki/limit/pruefen', { headers: { 'x-schoolbox': '1' }, data: {} });
		await oeffneBilder(page);
		await feld(page).fill(WUNSCH);
		await expect(senden(page)).toBeDisabled();
		await expect(schublade(page).locator('[data-ki-limit="gesperrt"]')).toBeVisible();
		await feld(page).press('Enter');
		await expect(canvaKacheln(page)).toHaveCount(0);
	});
});
