import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { geladen, oeffne, uhrzeit } from './editorhilfe';
import { dokumentOrdner, expect, MATERIAL_DIR, test } from './hilfe';

const fall = (name: string) => writeFile(path.join(`${MATERIAL_DIR}-ki`, 'fall.txt'), name);
const panel = (page: Page) => page.locator('[data-claude-blase]');
/** Ohne Auswahl öffnet ⌘J die Blase an der Seite; bei nur einer Seite meint sie das ganze Blatt (134). */
const oeffnePanel = (page: Page) => page.keyboard.press('ControlOrMeta+j');
const quelleAufPlatte = (mappe: string, dok: string) =>
	readFile(path.join(dokumentOrdner(mappe, dok), 'material.html'), 'utf8');

const leiste = (page: Page) => page.locator('[data-entwurfsleiste]');
const entwurfKarte = (page: Page) => page.locator('[data-entwurf-karte]');
const dokVon = (page: Page) => new URL(page.url()).pathname.split('/')[3] ?? '';

const beauftrage = async (page: Page, text = 'Mach es schöner') => {
	await panel(page).getByLabel('Was soll Claude ändern?').fill(text);
	await panel(page).getByRole('button', { name: 'Senden' }).click();
	await expect(panel(page).locator('[data-ki-vorschlag]')).toBeVisible();
};

const sperre = {
	verfuegbar: true,
	warnAb: 0.8,
	aktionen: [],
	limit: {
		status: 'rejected',
		zurueck: '2030-03-17T18:00:00.000Z',
		guthaben: 'abgelehnt',
		laeuftUeberGuthaben: false,
		fensterArt: 'woche',
		fenster: { fuenfStunden: { auslastung: 0.4, zurueck: null }, sieben: { auslastung: 1, zurueck: null } },
	},
};

/** Öffnet den Assistenten in der Mappe und wartet auf die Antwort, ob es Claude gibt. */
const assistent = async (page: Page, mappe: string) => {
	await page.goto(`/m/${mappe}`);
	await page.getByRole('button', { name: 'Material anlegen' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.locator('[data-hauptaktion]')).toBeEnabled();
	return dialog;
};

/** Mit allen Empfehlungen bis „Auftrag prüfen“: Art wählen, Thema tippen, sonst nur ⏎ (132). */
const bisZumAuftrag = async (page: Page, dialog: Locator, thema: string) => {
	await page.keyboard.press('Enter');
	await dialog.locator('[data-wahl="lesetext"]').click();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await expect(dialog.getByText('Bitte schreib, worum es geht.')).toBeVisible();
	await page.keyboard.type(thema);
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await expect(dialog.locator('[data-assistent="pruefen"]')).toBeVisible();
};

test.describe('Assistent: Mit Claude (132)', () => {
	// Eine andere Datei kann ihren Fall stehen lassen (Einheit).
	test.beforeEach(() => fall('gut'));
	test.afterEach(() => fall('gut'));

	test('Nur mit ⏎ zum Vorschlag; Claude bekommt genau den Auftrag aus der Vorschau', async ({ page }) => {
		const { id: mappe } = await uhrzeit();
		const dialog = await assistent(page, mappe);
		await expect(dialog.locator('[data-wahl="claude"]')).toHaveAttribute('aria-pressed', 'true');
		await bisZumAuftrag(page, dialog, 'Igel im Herbst');
		const vorschau = (await dialog.locator('[data-auftrag] p').allInnerTexts()).join('\n');
		expect(vorschau).toContain('Thema: „Igel im Herbst“');
		const prompts = path.join(`${MATERIAL_DIR}-ki`, 'prompts.txt');
		await writeFile(prompts, '');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/bearbeiten\?claude=1/);
		await expect(leiste(page)).toHaveAttribute('data-entwurfsleiste', 'offen');
		expect(await readFile(prompts, 'utf8')).toContain(
			`Antworten der Lehrkraft aus dem Assistenten (sie ersetzen die Start-Abfrage):\n${vorschau}`,
		);
		await leiste(page).getByRole('button', { name: 'Übernehmen' }).click();
		await expect(leiste(page)).toBeHidden();
		await expect.poll(() => quelleAufPlatte(mappe, dokVon(page))).toContain('von Claude');
	});

	test('Als Text bearbeitet: Claude bekommt den Text der Lehrkraft', async ({ page }) => {
		const { id: mappe } = await uhrzeit();
		const dialog = await assistent(page, mappe);
		await bisZumAuftrag(page, dialog, 'Igel');
		await dialog.getByRole('button', { name: 'Als Text bearbeiten' }).click();
		await dialog.getByRole('textbox', { name: 'Auftrag' }).fill('Ein Igel-Blatt mit EIGENEM Text.');
		const prompts = path.join(`${MATERIAL_DIR}-ki`, 'prompts.txt');
		await writeFile(prompts, '');
		await dialog.getByRole('button', { name: 'Mit Claude erstellen' }).click();
		await expect(leiste(page)).toBeVisible();
		const prompt = await readFile(prompts, 'utf8');
		expect(prompt).toContain('Ein Igel-Blatt mit EIGENEM Text.');
		expect(prompt).not.toContain('Thema: „Igel“');
	});

	test('Ohne angemeldetes claude bleibt nur das leere Blatt', async ({ page }) => {
		await page.route('**/api/ki/status', (r) =>
			r.fulfill({ json: { verfuegbar: false, limit: null, warnAb: 1, aktionen: [] } }),
		);
		const { id: mappe } = await uhrzeit();
		const dialog = await assistent(page, mappe);
		await expect(dialog.locator('[data-wahl="claude"]')).toBeDisabled();
		await expect(dialog.locator('[data-wahl="leer"]')).toHaveAttribute('aria-pressed', 'true');
		await expect(dialog).toContainText('nicht angemeldet');
		await page.keyboard.press('Enter');
		await expect(dialog.locator('[data-schritt="thema"]')).toHaveCount(0);
	});

	test('Am Limit: „Mit Claude erstellen“ ist gesperrt, das leere Blatt nie', async ({ page }) => {
		await page.route('**/api/ki/status', (r) => r.fulfill({ json: sperre }));
		const { id: mappe } = await uhrzeit();
		const dialog = await assistent(page, mappe);
		await bisZumAuftrag(page, dialog, 'Igel');
		await expect(dialog.locator('[data-ki-limit="gesperrt"]')).toContainText('Wieder möglich ab');
		await expect(dialog.getByRole('button', { name: 'Mit Claude erstellen' })).toBeDisabled();
		await dialog.getByRole('button', { name: 'Nur leeres Blatt anlegen' }).click();
		await expect(page).toHaveURL(/bearbeiten\?neu=1/);
	});
});

/** Ein neues Blatt mit Claude über den Assistenten, bis der Editor offen ist (133). */
const neuesBlatt = async (page: Page, thema = 'Igel') => {
	const { id: mappe } = await uhrzeit();
	const dialog = await assistent(page, mappe);
	await bisZumAuftrag(page, dialog, thema);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/bearbeiten\?claude=1/);
	return { mappe, dok: dokVon(page) };
};

test.describe('Neues Blatt im Editor (133)', () => {
	test.afterEach(async ({ page }) => {
		await fall('gut');
		await page.evaluate(() =>
			fetch('/api/ki/limit/pruefen', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-schoolbox': '1' },
				body: '{}',
			}),
		);
	});

	test('Karte und Pille, das Blatt ist gesperrt; Neuladen, Wiederkommen, zweiter Tab; Abbrechen löst alles', async ({
		page,
	}) => {
		await fall('haenger');
		const { mappe } = await neuesBlatt(page);
		const adresse = page.url();
		await expect(entwurfKarte(page)).toContainText('Claude plant „Igel“');
		await expect(entwurfKarte(page)).toContainText('Ändert das Blatt');
		await expect(page.locator('[data-entwurf-pille]')).toContainText('Claude arbeitet');
		await expect(page.locator('[data-schublade-knopf="bausteine"]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Versionen' })).toBeEnabled();

		await page.reload();
		await expect(entwurfKarte(page)).toHaveAttribute('data-entwurf-karte', 'laeuft');
		await page.goto(`/m/${mappe}`);
		await expect(page.locator('[data-claude-baut]')).toContainText('Claude baut');
		await page.goto(adresse);
		await expect(entwurfKarte(page)).toBeVisible();

		const zweite = await page.context().newPage();
		await zweite.goto(adresse);
		await expect(entwurfKarte(zweite)).toBeVisible();
		await entwurfKarte(page).getByRole('button', { name: 'Abbrechen' }).click();
		await expect(entwurfKarte(page)).toBeHidden();
		await expect(entwurfKarte(zweite)).toBeHidden();
		await zweite.close();
		await expect(leiste(page)).toContainText('Abgebrochen. Das leere Blatt bleibt');
		await expect(page.locator('[data-entwurf-pille]')).toHaveCount(0);
		await expect(page.locator('[data-schublade-knopf="bausteine"]')).toBeVisible();
		await page.reload();
		await expect(leiste(page)).toHaveCount(0);
	});

	test('Entwurfsleiste: Annahmen, Nachbessern im selben Gespräch, ⏎ übernimmt', async ({ page }) => {
		const auftraege: { gespraechId?: string; aufVorschlag?: boolean }[] = [];
		page.on('request', (r) => {
			if (r.method() === 'POST' && /\/api\/dokumente\/[^/]+\/[^/]+\/ki$/.test(r.url())) {
				auftraege.push(r.postDataJSON() as (typeof auftraege)[number]);
			}
		});
		const { dok, mappe } = await neuesBlatt(page);
		await expect(leiste(page)).toHaveAttribute('data-entwurfsleiste', 'offen');
		await expect(page.locator('[data-schublade-knopf="bausteine"]')).toHaveCount(0);
		await leiste(page).getByRole('button', { name: 'Annahmen (1)' }).click();
		await expect(leiste(page).locator('[data-entwurf-annahmen]')).toContainText('Klasse 2');

		await leiste(page).getByRole('button', { name: 'Nachbessern …' }).click();
		await leiste(page).getByRole('textbox', { name: 'Was soll Claude am Entwurf ändern?' }).fill('Größer');
		await page.keyboard.press('Enter');
		await expect.poll(() => auftraege.length).toBe(2);
		expect(auftraege[0]?.gespraechId).toBeTruthy();
		expect(auftraege[1]?.gespraechId).toBe(auftraege[0]?.gespraechId);
		expect(auftraege[1]?.aufVorschlag).toBe(true);
		await expect(leiste(page)).toHaveAttribute('data-entwurfsleiste', 'offen');
		await expect(entwurfKarte(page)).toBeHidden();

		await expect(leiste(page).getByRole('button', { name: 'Übernehmen' })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(leiste(page)).toBeHidden();
		await expect.poll(async () => (await quelleAufPlatte(mappe, dok)).split('von Claude').length).toBe(3);
		await expect(page.locator('[data-schublade-knopf="bausteine"]')).toBeVisible();
	});

	test('Aufgabenplan: erst der Plan zur Freigabe, „Ändern …“ zeigt ihn neu, „So bauen“ baut das Blatt', async ({
		page,
	}, testInfo) => {
		await fall('plan');
		const { dok, mappe } = await neuesBlatt(page);
		const karte = entwurfKarte(page);
		await expect(karte).toHaveAttribute('data-entwurf-karte', 'plan');
		await expect(karte.locator('[data-entwurf-plan]')).toContainText('Seite ● Grundlage (21 min)');
		await expect(page.locator('[data-schublade-knopf="bausteine"]')).toHaveCount(0);
		await page.screenshot({ path: testInfo.outputPath('plan-karte.png') });

		await page.reload();
		await expect(karte).toHaveAttribute('data-entwurf-karte', 'plan');
		await karte.getByRole('button', { name: 'Ändern …' }).click();
		await karte.getByLabel('Was soll am Plan anders sein?').fill('Nur 15 Minuten.');
		await karte.getByRole('button', { name: 'Plan ändern' }).click();
		await expect(karte.locator('[data-entwurf-plan]')).toContainText('Geänderter Aufgabenplan');
		expect(await quelleAufPlatte(mappe, dok)).not.toContain('von Claude');

		await karte.getByRole('button', { name: 'So bauen' }).click();
		await expect(leiste(page)).toHaveAttribute('data-entwurfsleiste', 'offen');
		await expect(karte).toBeHidden();
		await leiste(page).getByRole('button', { name: 'Übernehmen' }).click();
		await expect.poll(() => quelleAufPlatte(mappe, dok)).toContain('von Claude');
		const prompts = await readFile(path.join(`${MATERIAL_DIR}-ki`, 'prompts.txt'), 'utf8');
		expect(prompts).toContain('Freigegebener Aufgabenplan:');
		expect(prompts).toContain('Änderungswunsch der Lehrkraft: „Nur 15 Minuten.“');
	});

	test('Verwerfen lässt das leere Blatt, die Leiste führt zum Ordner', async ({ page }) => {
		const { dok, mappe } = await neuesBlatt(page);
		const vorher = await quelleAufPlatte(mappe, dok);
		await leiste(page).getByRole('button', { name: 'Verwerfen' }).click();
		await expect(leiste(page)).toContainText('Verworfen. Das leere Blatt bleibt im Ordner');
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);
		await expect(page.locator('[data-schublade-knopf="bausteine"]')).toBeVisible();
		await leiste(page).getByRole('button', { name: 'Ordner öffnen' }).click();
		await expect(page).toHaveURL(/\/(o\/[^/]+)?$/);
	});

	test('Fehler: Karte mit Grund, bleibt nach dem Neuladen, „Nochmal“ baut', async ({ page }) => {
		// Ein Fehler ohne Kontolimit („fehler“ meldet eines, dann wäre „Nochmal“ zu Recht gesperrt).
		await fall('limit-budget');
		await neuesBlatt(page);
		await expect(entwurfKarte(page)).toHaveAttribute('data-entwurf-karte', 'fehler');
		await expect(entwurfKarte(page).locator('[data-entwurf-grund]')).toContainText('zu umfangreich');
		await expect(page.locator('[data-schublade-knopf="bausteine"]')).toBeVisible();
		await page.reload();
		await expect(entwurfKarte(page)).toHaveAttribute('data-entwurf-karte', 'fehler');
		await fall('gut');
		await entwurfKarte(page).getByRole('button', { name: 'Nochmal' }).click();
		await expect(leiste(page)).toHaveAttribute('data-entwurfsleiste', 'offen');
		await expect(entwurfKarte(page)).toBeHidden();
	});

	test('Limit: Grund und Stand des Limits, „Nochmal“ gesperrt, „Selbst füllen“ schließt für immer', async ({
		page,
	}) => {
		await fall('limit-gesperrt');
		await neuesBlatt(page);
		await expect(entwurfKarte(page)).toHaveAttribute('data-entwurf-karte', 'fehler');
		await expect(entwurfKarte(page).locator('[data-ki-limit="gesperrt"]')).toContainText('Wieder möglich ab');
		await expect(entwurfKarte(page).getByRole('button', { name: 'Nochmal' })).toBeDisabled();
		const vergessen = page.waitForResponse((r) => r.url().endsWith('/ki/entwurf/vergessen'));
		await entwurfKarte(page).getByRole('button', { name: 'Selbst füllen' }).click();
		await expect(entwurfKarte(page)).toBeHidden();
		expect((await vergessen).status()).toBe(200);
		await page.reload();
		await expect(page.locator('[data-editor]')).toBeVisible();
		await expect(entwurfKarte(page)).toHaveCount(0);
	});
});

test.describe('Editor: Mit Claude ändern (058, 059)', () => {
	test.afterEach(() => fall('gut'));

	test('Auftrag, Vorschlag vergleichen, annehmen: genau dann ändert sich die Quelle', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		const vorher = await quelleAufPlatte(mappe, dok);
		await oeffnePanel(page);
		await expect(panel(page).getByText('Keine Namen von Kindern eintragen.')).toBeVisible();
		await beauftrage(page);
		await expect(panel(page).getByText('Annahme: Klasse 2')).toBeVisible();
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);

		await panel(page).getByRole('button', { name: 'Groß vergleichen' }).click();
		const rahmen = page.frameLocator('[data-vorschlag-rahmen]');
		await expect(rahmen.locator('h1').first()).toContainText('von Claude');
		await expect(rahmen.locator('[data-ki-geaendert]').first()).toBeVisible();
		// Das ganze Blatt ist in der Breite zu sehen, nichts ragt aus dem Rahmen
		await expect
			.poll(() => rahmen.locator('html').evaluate((el) => el.scrollWidth <= window.innerWidth + 1))
			.toBe(true);
		await page.getByRole('button', { name: 'Annehmen' }).click();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeHidden();
		await expect.poll(() => quelleAufPlatte(mappe, dok)).toContain('von Claude');
	});

	test('Verwerfen lässt die Quelle byteidentisch', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		const vorher = await quelleAufPlatte(mappe, dok);
		await oeffnePanel(page);
		await beauftrage(page);
		await panel(page).locator('[data-ki-vorschlag]').getByRole('button', { name: 'Verwerfen' }).click();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeHidden();
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);
	});

	test('Fortschritt und Abbrechen', async ({ page }) => {
		await fall('haenger');
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		await panel(page).getByLabel('Was soll Claude ändern?').fill('Dauert');
		await panel(page).getByRole('button', { name: 'Senden' }).click();
		const lauf = panel(page).locator('[data-ki-lauf]');
		await expect(lauf.getByText(/Claude ändert Seite 1/)).toBeVisible();
		await lauf.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(lauf).toBeHidden();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeHidden();
	});

	test('Aktionen passen zum gewählten Teil, Nachbessern arbeitet am Vorschlag', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		const aktionen = panel(page).locator('[data-ki-aktionen]');
		await expect(aktionen.getByRole('button', { name: 'Drei Niveaus' })).toBeVisible();
		await expect(aktionen.getByRole('button', { name: 'Baustein füllen' })).toBeHidden();
		await aktionen.getByRole('button', { name: 'Leichter' }).click();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeVisible();
		await expect(panel(page).locator('[data-chat-nachricht="lehrkraft"]').getByText('Leichter')).toBeVisible();

		await panel(page).getByRole('button', { name: 'Groß vergleichen' }).click();
		await page.getByRole('button', { name: 'Nachbessern' }).click();
		await expect(panel(page).getByLabel('Was soll Claude ändern?')).toBeFocused();
		await expect(panel(page).getByLabel('Was soll Claude ändern?')).toHaveAttribute('placeholder', 'Nachbessern …');
		await panel(page).getByLabel('Was soll Claude ändern?').fill('Noch etwas');
		await panel(page).getByRole('button', { name: 'Senden' }).click();
		await expect(panel(page).locator('[data-chat-nachricht="lehrkraft"]').getByText('Noch etwas')).toBeVisible();
		await expect(panel(page).locator('[data-ki-vorschlag]')).toBeVisible();
	});

	test('Geändertes Blatt: Der Vorschlag lässt sich nicht annehmen', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		await beauftrage(page);
		const datei = path.join(dokumentOrdner(mappe, dok), 'material.html');
		await writeFile(datei, (await readFile(datei, 'utf8')).replace('</h1>', ' Eigenes</h1>'));
		await page.reload();
		// Die Blase startet nach dem Neuladen zu (087); der Vorschlag wartet als Pille an der Seite (135).
		await expect(panel(page)).toHaveCount(0);
		await expect(page.locator('[data-claude-pille="vorschlag"]')).toBeVisible();
		await oeffnePanel(page);
		await expect(panel(page).getByRole('alert')).toContainText('seit dem Auftrag geändert');
		await expect(panel(page).getByRole('button', { name: 'Groß vergleichen' })).toHaveCount(0);
		await expect(panel(page).getByRole('button', { name: 'Neu starten' })).toBeVisible();
	});

	test('Limit: Hinweis davor, gesperrt danach', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		const antwort = (status: string, auslastung: number) => ({
			verfuegbar: true,
			warnAb: 0.8,
			aktionen: [],
			limit: {
				status,
				zurueck: '2030-03-17T18:00:00.000Z',
				guthaben: status === 'rejected' ? 'abgelehnt' : null,
				laeuftUeberGuthaben: false,
				fensterArt: 'fuenfStunden',
				fenster: { fuenfStunden: { auslastung, zurueck: null }, sieben: { auslastung: 0.1, zurueck: null } },
			},
		});
		await page.route('**/api/ki/status', (r) => r.fulfill({ json: antwort('allowed', 0.85) }));
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		await expect(panel(page).locator('[data-ki-limit="warnung"]')).toContainText('85 %');
		await expect(panel(page).locator('[data-ki-limit="warnung"]')).toContainText('Claude-App');

		await page.unroute('**/api/ki/status');
		await page.route('**/api/ki/status', (r) => r.fulfill({ json: antwort('rejected', 1) }));
		await page.reload();
		await geladen(page);
		await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();
		await oeffnePanel(page);
		await expect(panel(page).locator('[data-ki-limit="gesperrt"]')).toContainText('Wieder möglich ab');
		await panel(page).getByLabel('Was soll Claude ändern?').fill('Geht nicht');
		await expect(panel(page).getByRole('button', { name: 'Senden' })).toBeDisabled();
	});

	test('Ohne angemeldetes claude bleibt nur der Weg über die Claude-App', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await page.route('**/api/ki/status', (r) =>
			r.fulfill({ json: { verfuegbar: false, limit: null, warnAb: 1, aktionen: [] } }),
		);
		await oeffne(page, mappe, dok);
		await expect(page.locator('[data-schublade-knopf="ebenen"]')).toBeVisible();
		await oeffnePanel(page);
		await expect(panel(page).locator('#ki-auftrag')).toHaveCount(0);
		await expect(panel(page).getByRole('button', { name: 'In der Claude-App weiterarbeiten' })).toBeVisible();
	});

	test('Knöpfe in der Blase sind groß genug für den Finger', async ({ hasTouch, page }) => {
		test.skip(!hasTouch, 'nur mit dem Finger');
		const { dok, id: mappe } = await uhrzeit();
		await oeffne(page, mappe, dok);
		await oeffnePanel(page);
		const knoepfe = panel(page).getByRole('button');
		for (let i = 0; i < (await knoepfe.count()); i += 1) {
			const box = await knoepfe.nth(i).boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
		}
	});
});
