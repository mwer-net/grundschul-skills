/**
 * Neue Figuren mit KI-Bildern (176, 237): „Figur beschreiben“ in der Schublade „Figuren“, die Kacheln während des
 * Laufs, Fehler und „Noch einmal“, Abbrechen, Entfernen über ⋯ und die Meldung. Die Claude-Attrappe malt (Fälle
 * `bildlauf-figur`, `bild-gesperrt`, `haenger`) und wartet 2,5 s, damit die Kachel mit dem Spinner zu sehen ist. Die
 * Bibliothek mit Kiki wird vor jedem Test gesichert und danach zurückgelegt.
 */
import { existsSync } from 'node:fs';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';
import { FIGUREN_ORDNER } from '@schoolbox/kern';

import { oeffne, uhrzeit } from './editorhilfe';
import { expect, MATERIAL_DIR, test } from './hilfe';
import { oeffneSchublade, schubladenKnopf } from './schubladen-hilfe';

const kiFall = (name: string) => writeFile(path.join(`${MATERIAL_DIR}-ki`, 'fall.txt'), name);
const BIBLIOTHEK = path.join(MATERIAL_DIR, FIGUREN_ORDNER);
const WILLI_LUPE = 'Willi mit einer Lupe, der auf dem Boden genau etwas anschaut';
/** Die Attrappe wartet 2,5 s; mit Start und Neuladen der Bibliothek bleibt Luft. */
const LAUF = { timeout: 15_000 };

const schublade = (page: Page) => page.locator('[data-schublade-figuren]');
const feld = (page: Page) => page.locator('#figur-beschreiben');
const senden = (page: Page) => schublade(page).getByRole('button', { name: 'Senden' });
const gruppe = (page: Page, id: string) => schublade(page).locator(`[data-figuren-gruppe="${id}"]`);
const BILDLAUF_KACHEL = '[data-bildlauf-kachel]';
const bildlaufKacheln = (page: Page) => schublade(page).locator(BILDLAUF_KACHEL);
const neueFigur = (page: Page) => schublade(page).locator('[data-bildlauf-neu]');
const kachel = (page: Page, name: string) => schublade(page).locator(`[data-ablage-gut="${name}"]`);
/** Das ⋯ liegt neben der Kachel im selben Rahmen, nicht darin. */
const mehr = (page: Page, name: string) =>
	kachel(page, name).locator('xpath=..').getByRole('button', { name: 'Weitere Aktionen' });
const hinweis = (page: Page) => page.locator('div[role="status"][aria-live]');

const beschreibe = async (page: Page, text: string) => {
	await feld(page).fill(text);
	await feld(page).press('Enter');
};

const oeffneFiguren = async (page: Page) => {
	const u = await uhrzeit();
	await oeffne(page, u.id, u.dok);
	await oeffneSchublade(page, 'figuren');
	await expect(feld(page)).toBeVisible();
	await expect(gruppe(page, 'kiki')).toBeVisible();
};

let sicherung = '';

test.beforeEach(async () => {
	sicherung = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-sicherung-'));
	await cp(BIBLIOTHEK, sicherung, { recursive: true });
	await kiFall('bildlauf-figur');
});

test.afterEach(async ({ page }) => {
	// Kein Lauf darf nach dem Test noch in die Bibliothek schreiben.
	const laeufe = async () =>
		((await (await page.request.get('/api/bildlauf')).json()) as { laeufe: { id: string }[] }).laeufe;
	for (const { id } of await laeufe()) {
		await page.request.post(`/api/bildlauf/${id}/abbrechen`, { headers: { 'x-schoolbox': '1' }, data: {} });
	}
	await expect.poll(async () => (await laeufe()).length).toBe(0);
	await rm(BIBLIOTHEK, { recursive: true, force: true });
	await cp(sicherung, BIBLIOTHEK, { recursive: true });
	await rm(sicherung, { recursive: true, force: true });
	await kiFall('gut');
});

test.describe('Neue Figuren mit KI-Bildern (176)', () => {
	test('Pose: Kachel mit Spinner in Willis Abschnitt, dann „Willi lupe“; Enter noch einmal gibt „Willi lupe 2“', async ({
		hasTouch,
		page,
	}) => {
		await oeffneFiguren(page);
		await expect(senden(page)).toBeDisabled();
		await beschreibe(page, WILLI_LUPE);

		const laufend = gruppe(page, 'willi').locator(BILDLAUF_KACHEL);
		await expect(laufend).toHaveAttribute('data-status', 'laeuft');
		await expect(laufend).toHaveAttribute('aria-label', WILLI_LUPE);
		await expect(laufend.locator('.animate-spin')).toBeVisible();
		// 199-22: am Ende der Gruppe, wo die fertige Pose erscheint.
		await expect(gruppe(page, 'willi').locator('[data-bildlauf-kachel], [data-ablage-gut]').last()).toHaveAttribute(
			'data-bildlauf-kachel',
		);
		// Nach der Antwort steht der Text markiert im Feld.
		await expect
			.poll(() => feld(page).evaluate((e: HTMLInputElement) => [e.value, e.selectionStart, e.selectionEnd]))
			.toEqual([WILLI_LUPE, 0, WILLI_LUPE.length]);

		await expect(kachel(page, 'Willi lupe')).toBeVisible(LAUF);
		await expect(bildlaufKacheln(page)).toHaveCount(0);
		if (!hasTouch) {
			await kachel(page, 'Willi lupe').hover();
			await expect(page.locator('[data-tooltip]')).toHaveText('Willi lupe');
		}
		// Die Schublade ist offen: keine Meldung.
		await expect(hinweis(page)).not.toContainText('ist fertig');

		await feld(page).press('Enter');
		await expect(kachel(page, 'Willi lupe 2')).toBeVisible(LAUF);
		await expect(gruppe(page, 'willi').locator('[data-ablage-gut]')).toHaveCount(3);
	});

	test('Neue Figur: erst der Abschnitt „Neue Figur“ ganz oben, dann der Abschnitt der Figur', async ({ page }) => {
		await oeffneFiguren(page);
		await expect(neueFigur(page)).toHaveCount(0);
		await beschreibe(page, 'ein Igel mit gelbem Halstuch');

		await expect(neueFigur(page)).toBeVisible();
		await expect(neueFigur(page).locator('h3')).toHaveText('Neue Figur');
		await expect(neueFigur(page).locator(BILDLAUF_KACHEL)).toHaveCount(1);
		await expect(schublade(page).locator('[data-schublade-abschnitt]').first()).toHaveAttribute(
			'data-bildlauf-neu',
			'',
		);

		await expect(gruppe(page, 'igel')).toBeVisible(LAUF);
		await expect(gruppe(page, 'igel').locator('h3')).toHaveText('Igel');
		await expect(neueFigur(page)).toHaveCount(0);
		await expect(schublade(page).locator('[data-figuren-gruppe] > h3')).toHaveText([
			'Willi',
			'Wilma',
			'Igel',
			'Kiki',
		]);
	});

	test('Suche: Steht etwas im Suchfeld, ist keine Kachel eines Auftrags zu sehen', async ({ page }) => {
		await kiFall('haenger');
		await oeffneFiguren(page);
		await beschreibe(page, 'Kiki springt');
		await expect(gruppe(page, 'kiki').locator(BILDLAUF_KACHEL)).toHaveCount(1);

		const suche = schublade(page).getByRole('searchbox', { name: 'Figuren suchen' });
		await suche.fill('Kiki');
		await expect(kachel(page, 'Kiki')).toBeVisible();
		await expect(bildlaufKacheln(page)).toHaveCount(0);
		await suche.fill('');
		await expect(bildlaufKacheln(page)).toHaveCount(1);
	});

	test('Entfernen über ⋯: eine Pose, dann die ganze Figur; Willi und Wilma ohne ⋯ an der Grundpose', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		await oeffneFiguren(page);
		await expect(gruppe(page, 'willi').getByRole('button', { name: 'Weitere Aktionen' })).toHaveCount(0);
		await expect(gruppe(page, 'wilma').getByRole('button', { name: 'Weitere Aktionen' })).toHaveCount(0);

		if (!hasTouch) {
			await kachel(page, 'Kiki winkt').hover();
		}
		await druecke(mehr(page, 'Kiki winkt'));
		await expect(page.getByRole('menuitem')).toHaveText(['Figur umbenennen', 'Pose entfernen']);
		await druecke(page.getByRole('menuitem', { name: 'Pose entfernen' }));
		await expect(kachel(page, 'Kiki winkt')).toHaveCount(0);
		await expect(kachel(page, 'Kiki')).toBeVisible();
		expect(existsSync(path.join(BIBLIOTHEK, 'kiki-winkt.png'))).toBe(true);
		// 199-03: Der Hinweis bietet „Rückgängig“; die Pose steht wieder an ihrer Stelle.
		const leiste = hinweis(page);
		await expect(leiste).toContainText('Pose entfernt.');
		await druecke(leiste.getByRole('button', { name: 'Rückgängig' }));
		await expect(kachel(page, 'Kiki winkt')).toBeVisible();
		if (!hasTouch) {
			await kachel(page, 'Kiki winkt').hover();
		}
		await druecke(mehr(page, 'Kiki winkt'));
		await druecke(page.getByRole('menuitem', { name: 'Pose entfernen' }));
		await expect(kachel(page, 'Kiki winkt')).toHaveCount(0);

		if (!hasTouch) {
			await kachel(page, 'Kiki').hover();
		}
		await druecke(mehr(page, 'Kiki'));
		await druecke(page.getByRole('menuitem', { name: 'Figur entfernen' }));
		await expect(gruppe(page, 'kiki')).toHaveCount(0);
		expect(existsSync(path.join(BIBLIOTHEK, 'kiki.png'))).toBe(true);
		await expect(leiste).toContainText('Kiki entfernt.');
		await druecke(leiste.getByRole('button', { name: 'Rückgängig' }));
		await expect(gruppe(page, 'kiki')).toBeVisible();
	});

	test('199: Enter zweimal mit demselben Text startet einen Auftrag und sagt, warum', async ({ page }) => {
		await oeffneFiguren(page);
		await beschreibe(page, 'Willi winkt');
		await expect(bildlaufKacheln(page)).toHaveCount(1);
		await feld(page).press('Enter');
		await expect(schublade(page).locator('[data-figur-laeuft-schon]')).toBeVisible();
		await expect(bildlaufKacheln(page)).toHaveCount(1);
		await expect(schublade(page).getByRole('button', { name: 'Senden' })).toBeDisabled();
	});

	test('199: Figur umbenennen per Doppelklick auf den Titel; Willi heißt fest', async ({ page }) => {
		await oeffneFiguren(page);
		await gruppe(page, 'willi').locator('[data-figur-titel]').dblclick();
		await expect(schublade(page).locator('[data-figur-name-feld]')).toHaveCount(0);
		await gruppe(page, 'kiki').locator('[data-figur-titel]').dblclick();
		const name = schublade(page).locator('[data-figur-name-feld="kiki"]');
		await expect(name).toBeFocused();
		await name.fill('Kiki die Katze');
		await name.press('Enter');
		await expect(gruppe(page, 'kiki').locator('[data-figur-titel]')).toHaveText('Kiki die Katze');
		// Esc bricht ab.
		await gruppe(page, 'kiki').locator('[data-figur-titel]').dblclick();
		await name.fill('Anders');
		await name.press('Escape');
		await expect(gruppe(page, 'kiki').locator('[data-figur-titel]')).toHaveText('Kiki die Katze');
	});

	test('Zwei Namen: „Eine Figur je Bild.“ unter dem Feld, keine Kachel; Tippen nimmt den Text weg', async ({
		page,
	}) => {
		await oeffneFiguren(page);
		await beschreibe(page, 'Willi und Wilma lesen');
		await expect(schublade(page).locator('[data-figur-fehler]')).toHaveText('Eine Figur je Bild.');
		await expect(schublade(page).getByRole('alert')).toHaveText('Eine Figur je Bild.');
		await expect(bildlaufKacheln(page)).toHaveCount(0);
		await feld(page).press('End');
		await feld(page).pressSequentially(' zusammen');
		await expect(schublade(page).locator('[data-figur-fehler]')).toHaveCount(0);
	});

	test('Fehler: Kachel über die ganze Zeile; „Noch einmal“ wird fertig, die Fehler-Kachel ist weg', async ({
		druecke,
		page,
	}) => {
		await kiFall('bild-gesperrt');
		await oeffneFiguren(page);
		await beschreibe(page, 'Wilma mit einem Buch');
		const fehler = gruppe(page, 'wilma').locator(BILDLAUF_KACHEL);
		await expect(fehler).toHaveAttribute('data-status', 'fehler', LAUF);
		await expect(fehler).toContainText('OpenAI hat keine Bilder mehr erzeugt (Guthaben, Ausgabenlimit oder Schlüssel).');
		await expect(fehler.getByRole('button', { name: 'Entfernen' })).toBeVisible();

		await kiFall('bildlauf-figur');
		await druecke(fehler.getByRole('button', { name: 'Noch einmal' }));
		await expect(gruppe(page, 'wilma').locator('[data-bildlauf-kachel][data-status="fehler"]')).toHaveCount(0);
		await expect(kachel(page, 'Wilma lupe')).toBeVisible(LAUF);
		await expect(bildlaufKacheln(page)).toHaveCount(0);
	});

	test('× an einer Fehler-Kachel entfernt sie', async ({ druecke, page }) => {
		await kiFall('bild-gesperrt');
		await oeffneFiguren(page);
		await beschreibe(page, 'Wilma mit einem Buch');
		const fehler = gruppe(page, 'wilma').locator(BILDLAUF_KACHEL);
		await expect(fehler).toHaveAttribute('data-status', 'fehler', LAUF);
		await druecke(fehler.getByRole('button', { name: 'Entfernen' }));
		await expect(bildlaufKacheln(page)).toHaveCount(0);
	});

	test('Abbrechen: × an der laufenden Kachel nimmt sie weg', async ({ druecke, page }) => {
		await kiFall('haenger');
		await oeffneFiguren(page);
		await beschreibe(page, WILLI_LUPE);
		const laufend = gruppe(page, 'willi').locator(BILDLAUF_KACHEL);
		await expect(laufend).toHaveAttribute('data-status', 'laeuft');
		await druecke(laufend.getByRole('button', { name: 'Abbrechen' }));
		await expect(bildlaufKacheln(page)).toHaveCount(0);
		await expect(kachel(page, 'Willi lupe')).toHaveCount(0);
	});

	test('Meldung: Schublade gewechselt, fertig, dann die Meldung; „Ansehen“ öffnet „Figuren“', async ({
		druecke,
		page,
	}) => {
		await oeffneFiguren(page);
		await beschreibe(page, WILLI_LUPE);
		await expect(bildlaufKacheln(page)).toHaveCount(1);
		await druecke(schubladenKnopf(page, 'bilder'));
		await expect(schubladenKnopf(page, 'figuren')).toHaveAttribute('aria-pressed', 'false');

		await expect(hinweis(page)).toContainText('Neue Pose von Willi ist fertig.', LAUF);
		await druecke(hinweis(page).getByRole('button', { name: 'Ansehen' }));
		await expect(schubladenKnopf(page, 'figuren')).toHaveAttribute('aria-pressed', 'true');
		await expect(kachel(page, 'Willi lupe')).toBeVisible();
	});

	test('iPad: Feld, Senden, × und ⋯ in den iPad-Maßen, das ⋯ immer sichtbar', async ({ hasTouch, page }) => {
		test.skip(!hasTouch, 'nur am Finger');
		await kiFall('haenger');
		await oeffneFiguren(page);
		const hoehe = async (ziel: Locator) => (await ziel.boundingBox())?.height ?? 0;
		expect(await hoehe(feld(page))).toBeGreaterThanOrEqual(44);
		expect(await hoehe(senden(page))).toBeGreaterThanOrEqual(44);
		await expect(mehr(page, 'Kiki winkt')).toHaveCSS('opacity', '1');
		expect(await hoehe(mehr(page, 'Kiki winkt'))).toBeGreaterThanOrEqual(44);

		await beschreibe(page, WILLI_LUPE);
		const laufend = gruppe(page, 'willi').locator(BILDLAUF_KACHEL);
		await expect(laufend).toBeVisible();
		expect(await hoehe(laufend.getByRole('button', { name: 'Abbrechen' }))).toBeGreaterThanOrEqual(44);
	});
});

test.describe('Neue Figuren mit KI-Bildern am Limit (176)', () => {
	/** Der Stand lebt im Server: Das Konto neu fragen, die Attrappe meldet wieder Luft. */
	test.afterEach(async ({ page }) => {
		await kiFall('gut');
		await page.request.post('/api/ki/limit/pruefen', { headers: { 'x-schoolbox': '1' }, data: {} });
	});

	test('Gesperrt: Senden aus, darunter die Zeile mit dem Limit', async ({ page }) => {
		await kiFall('limit-gesperrt');
		await page.request.post('/api/ki/limit/pruefen', { headers: { 'x-schoolbox': '1' }, data: {} });
		await oeffneFiguren(page);
		await feld(page).fill(WILLI_LUPE);
		await expect(senden(page)).toBeDisabled();
		await expect(schublade(page).locator('[data-ki-limit="gesperrt"]')).toBeVisible();
		await feld(page).press('Enter');
		await expect(bildlaufKacheln(page)).toHaveCount(0);
	});
});
