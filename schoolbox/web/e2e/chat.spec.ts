import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { material, oeffne, uhrzeit } from './editorhilfe';
import { dokumentOrdner, expect, MATERIAL_DIR, test } from './hilfe';

const kiOrdner = `${MATERIAL_DIR}-ki`;
const fall = (name: string) => writeFile(path.join(kiOrdner, 'fall.txt'), name);
const chat = (page: Page) => page.locator('[data-chat]');
const feld = (page: Page) => chat(page).locator('#ki-auftrag');
const chip = (page: Page) => chat(page).locator('[data-chat-chip]');
const karte = (page: Page) => chat(page).locator('[data-ki-vorschlag]');
const quelleAufPlatte = (mappe: string, dok: string) =>
	readFile(path.join(dokumentOrdner(mappe, dok), 'material.html'), 'utf8');
const fokusIm = (page: Page) => page.evaluate(() => document.activeElement?.tagName);

const offenesBlatt = async (page: Page) => {
	const { dok, id: mappe } = await uhrzeit();
	await oeffne(page, mappe, dok);
	return { dok, mappe };
};

const schreibe = async (page: Page, text: string) => {
	if (!(await chat(page).isVisible())) {
		await page.getByRole('button', { name: 'Claude', exact: true }).click();
	}
	await feld(page).fill(text);
	await feld(page).press('Enter');
};

test.describe('Chat im Editor (074)', () => {
	test.afterEach(() => fall('gut'));

	test('⌘J öffnet mit Fokus, Esc klappt ein und schließt, danach gehören die Tasten dem Blatt', async ({ page }) => {
		await offenesBlatt(page);
		await material(page).locator('.aufgabe').first().locator('.nr').click();
		const anzahl = await material(page).locator('.aufgabe').count();

		await page.keyboard.press('ControlOrMeta+j');
		await expect(feld(page)).toBeFocused();
		await expect(chip(page)).toContainText('Aufgabe 1');
		await page.keyboard.press('ControlOrMeta+j');
		await expect(chat(page)).toHaveCount(0);

		await page.keyboard.press('ControlOrMeta+j');
		await schreibe(page, 'Mach es schöner');
		await expect(chat(page)).toHaveAttribute('data-chat-fenster', 'verlauf');
		await expect(karte(page)).toBeVisible();
		await feld(page).focus();
		await page.keyboard.press('Escape');
		await expect(chat(page)).toHaveAttribute('data-chat-fenster', 'zeile');
		await page.keyboard.press('Escape');
		await expect(chat(page)).toHaveCount(0);
		await expect.poll(() => fokusIm(page)).toBe('IFRAME');
		await page.keyboard.press('Backspace');
		await expect(material(page).locator('.aufgabe')).toHaveCount(anzahl - 1);
	});

	test('Der Chip folgt der Auswahl, der Fokus bleibt im Blatt, im Chip wählt man die Ebene', async ({ page }) => {
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(chip(page)).toHaveText('Ganzes Blatt');

		await material(page).locator('.aufgabe').nth(1).locator('.nr').click();
		await expect(chip(page)).toContainText('Aufgabe 2');
		await expect(chat(page)).toBeVisible();
		await expect.poll(() => fokusIm(page)).toBe('IFRAME');

		await chip(page).click();
		const menue = page.getByRole('menu');
		await expect(menue.getByRole('menuitem', { name: /Seite 1/ })).toBeVisible();
		await expect(menue.getByRole('menuitem', { name: /Ganzes Blatt/ })).toContainText('verbraucht deutlich mehr');
		await menue.getByRole('menuitem', { name: /Ganzes Blatt/ }).click();
		await expect(chip(page)).toHaveText('Ganzes Blatt');
		await expect(feld(page)).toBeFocused();
	});

	test('„Mit Claude ändern …“ am Baustein öffnet den Chat dazu', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Rechtsklick gibt es nur mit der Maus');
		await offenesBlatt(page);
		await material(page).locator('.aufgabe').first().locator('.nr').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Mit Claude ändern …' }).click();
		await expect(feld(page)).toBeFocused();
		await expect(chip(page)).toContainText('Aufgabe 1');
	});

	test('Das Fenster verdeckt die Auswahl nicht, auch nicht unten am Blatt', async ({ page }) => {
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+j');
		await page.evaluate(() => {
			const ansicht = document.querySelector('main');
			ansicht?.scrollTo(0, ansicht.scrollHeight);
		});
		const letzte = material(page).locator('.seite > *').last();
		await letzte.click({ position: { x: 5, y: 5 } });
		await expect
			.poll(async () => {
				const rahmen = await page.locator('[data-auswahlrahmen]').boundingBox();
				const fenster = await chat(page).boundingBox();
				return rahmen && fenster ? rahmen.y + rahmen.height <= fenster.y : false;
			})
			.toBe(true);
	});

	test('Nachricht, Vergleich, Annehmen, Rückgängig; Verwerfen lässt die Quelle byteidentisch', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		const vorher = await quelleAufPlatte(mappe, dok);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);
		await karte(page).getByRole('button', { name: 'Verwerfen' }).click();
		await expect(karte(page)).toHaveCount(0);
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);

		await schreibe(page, 'Noch einmal');
		await karte(page).getByRole('button', { name: 'Vergleichen' }).click();
		await page.getByRole('button', { name: 'Annehmen' }).click();
		await expect.poll(() => quelleAufPlatte(mappe, dok)).toContain('von Claude');
		await expect(material(page).locator('h1').first()).toContainText('von Claude');
		await page.getByRole('button', { name: 'Rückgängig' }).click();
		await expect.poll(() => quelleAufPlatte(mappe, dok)).not.toContain('von Claude');
	});

	test('Nachricht auf offenen Vorschlag bessert ihn nach', async ({ page }) => {
		await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		await expect(feld(page)).toHaveAccessibleName('Was soll Claude am Vorschlag ändern?');
		await fall('haenger');
		await schreibe(page, 'Noch kürzer');
		await expect(chat(page).locator('[data-ki-lauf]')).toContainText('Claude bessert den Vorschlag nach');
		await feld(page).fill('Zweite Nachricht');
		await feld(page).press('Enter');
		await expect(feld(page)).toHaveValue('Zweite Nachricht');
		await expect(chat(page).locator('[data-chat-nachricht="lehrkraft"]')).toHaveCount(2);
		await chat(page).locator('[data-ki-lauf]').getByRole('button', { name: 'Abbrechen' }).click();
		await expect(karte(page)).toBeVisible();
	});

	test('Eine Frage bekommt eine Antwort, und das Blatt bleibt', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		const vorher = await quelleAufPlatte(mappe, dok);
		await schreibe(page, 'FRAGE: Wie viele Uhren sind das?');
		await expect(chat(page).locator('[data-chat-nachricht="claude"]')).toHaveText('Das Blatt hat vier Uhren.');
		await expect(karte(page)).toHaveCount(0);
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);
	});

	test('Geändertes Blatt: Annehmen ist gesperrt, „Neu starten“ schickt dieselbe Nachricht', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		const datei = path.join(dokumentOrdner(mappe, dok), 'material.html');
		await writeFile(datei, (await readFile(datei, 'utf8')).replace('</h1>', ' Eigenes</h1>'));
		await expect(karte(page).getByRole('alert')).toContainText('seit dem Auftrag geändert');
		await karte(page).getByRole('button', { name: 'Neu starten' }).click();
		await expect(chat(page).locator('[data-chat-nachricht="lehrkraft"]')).toHaveCount(2);
		await expect(karte(page).getByRole('button', { name: 'Vergleichen' })).toBeVisible();
		await expect(karte(page).getByRole('alert')).toHaveCount(0);
	});

	test('Neu laden: Der Verlauf ist weg, Vorschlag und laufender Auftrag sind wieder da', async ({ page }) => {
		await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(chat(page)).toHaveCount(0);
		await page.getByRole('button', { name: 'Claude', exact: true }).click();
		await expect(karte(page)).toBeVisible();
		await expect(chat(page).locator('[data-chat-nachricht]')).toHaveCount(0);

		await fall('haenger');
		await feld(page).fill('Dauert');
		await feld(page).press('Enter');
		await expect(chat(page).locator('[data-ki-lauf]')).toBeVisible();
		await page.reload();
		await expect(page.locator('[data-claude-stand="arbeitet"]')).toContainText('Claude arbeitet');
		await page.locator('[data-claude-stand]').click();
		await expect(chat(page).locator('[data-ki-lauf]')).toBeVisible();
		await chat(page).locator('[data-ki-lauf]').getByRole('button', { name: 'Abbrechen' }).click();
		await expect(chat(page).locator('[data-ki-lauf]')).toHaveCount(0);
	});

	test('Die Markierung der Textsitzung kommt beim Wechsel mit und geht zum Auftrag', async ({ page }) => {
		await offenesBlatt(page);
		const ueberschrift = material(page).locator('h1');
		await ueberschrift.click();
		await ueberschrift.click();
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await ueberschrift.evaluate((el) => el.ownerDocument.getSelection()?.selectAllChildren(el));
		await page.keyboard.press('ControlOrMeta+j');
		const zitat = chat(page).locator('[data-chat-zitat]');
		await expect(zitat).toContainText('Wie spät ist es?');
		await expect(feld(page)).toBeFocused();
		await expect(page.locator('[data-textbearbeitung]')).toHaveCount(0);
		const prompts = path.join(kiOrdner, 'prompts.txt');
		await writeFile(prompts, '');
		await feld(page).fill('Kürzer');
		await feld(page).press('Enter');
		await expect(karte(page)).toBeVisible();
		await expect(zitat).toHaveCount(0);
		expect(await readFile(prompts, 'utf8')).toContain('markierte Stelle');
	});

	test('Die Palette schreibt ins Feld und schickt nichts ab', async ({ page }) => {
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+k');
		await page.locator('[data-befehlspalette]').getByRole('combobox').fill('Mach die Uhren größer');
		const zeile = page.locator('[data-palette-zeile="claude:schicken"]');
		await expect(zeile).toContainText('An Claude schicken: Mach die Uhren größer');
		await zeile.click();
		await expect(feld(page)).toHaveValue('Mach die Uhren größer');
		await expect(feld(page)).toBeFocused();
		await expect(chat(page).locator('[data-ki-lauf]')).toHaveCount(0);
		await expect(chat(page).locator('[data-chat-nachricht]')).toHaveCount(0);
	});

	test('Präsentation und Druck haben keinen Chat', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		await page.goto(`/m/${mappe}/${dok}/drucken`);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(page.locator('[data-chat]')).toHaveCount(0);
		await page.goto(`/m/${mappe}/${dok}/praesentation`);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(page.locator('[data-chat]')).toHaveCount(0);
	});
});

test.describe('Chat als Gespräch (087)', () => {
	test.afterEach(() => fall('gut'));

	const aufrufe = path.join(kiOrdner, 'aufrufe.jsonl');
	const nachrichten = (page: Page) => chat(page).locator('[data-chat-nachricht]');

	/** Was der Browser an den Server schickt, von Anfang bis Ende des Tests. */
	const beobachte = (page: Page) => {
		const auftraege: { gespraechId?: string; aufVorschlag?: boolean; auftrag?: string; verlauf?: unknown[] }[] = [];
		const enden: string[] = [];
		page.on('request', (r) => {
			if (r.method() === 'POST' && /\/api\/dokumente\/[^/]+\/[^/]+\/ki$/.test(r.url())) {
				auftraege.push(r.postDataJSON() as (typeof auftraege)[number]);
			}
			const ende = /\/api\/ki\/gespraech\/([^/]+)$/.exec(r.url());
			if (r.method() === 'DELETE' && ende?.[1]) {
				enden.push(ende[1]);
			}
		});
		return { auftraege, enden };
	};

	const letzterAufruf = async () => {
		const zeilen = (await readFile(aufrufe, 'utf8')).trim().split('\n');
		const laeufe = zeilen
			.map((z) => JSON.parse(z) as { args: string[]; cwd: string })
			.filter((a) => a.args[0] !== 'auth');
		const letzter = laeufe.at(-1);
		expect(letzter).toBeTruthy();
		return letzter as { args: string[]; cwd: string };
	};

	/** `…/gespraech-<id>/arbeit`: Den Ordner darüber nimmt das Ende des Gesprächs mit. */
	const gespraechOrdner = (cwd: string) => path.dirname(cwd);

	const chatSchluessel = (page: Page) =>
		page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('schoolbox-chat')));

	test('Rückfrage, Antwort, Vorschlag: „Ja, mach das“ erreicht den Server mit derselben Id', async ({ page }) => {
		const { auftraege } = beobachte(page);
		await offenesBlatt(page);
		await schreibe(page, 'RUECKFRAGE: Mach mir ein Rätsel');
		await expect(nachrichten(page).last()).toHaveText('Für welche Klasse soll das Rätsel sein?');
		await expect(karte(page)).toHaveCount(0);
		await expect(feld(page)).toHaveAttribute('placeholder', 'Antworten…');
		await expect(feld(page)).toBeFocused();

		await page.keyboard.type('Ja, mach das');
		await page.keyboard.press('Enter');
		await expect(karte(page)).toBeVisible();
		await expect(feld(page)).not.toHaveAttribute('placeholder', 'Antworten…');
		expect(auftraege).toHaveLength(2);
		expect(auftraege[1]?.auftrag).toBe('Ja, mach das');
		expect(auftraege[1]?.gespraechId).toBe(auftraege[0]?.gespraechId);
		expect(auftraege[0]?.gespraechId).toMatch(/^[a-z0-9]+$/);
		expect(auftraege[1]?.verlauf?.length).toBe(2);
		expect((await letzterAufruf()).args).toContain('--resume');
	});

	test('Eine Antwort ohne Frage ändert den Platzhalter nicht', async ({ page }) => {
		await offenesBlatt(page);
		await schreibe(page, 'FRAGE: Wie viele Uhren?');
		await expect(nachrichten(page).last()).toHaveText('Das Blatt hat vier Uhren.');
		await expect(feld(page)).toHaveAttribute('placeholder', 'Was soll sich ändern?');
	});

	test('Schließen und wieder Öffnen: Verlauf leer, neue Id, Ordner weg, Vorschlag steht noch da', async ({
		page,
	}) => {
		const { auftraege, enden } = beobachte(page);
		await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		const ordner = gespraechOrdner((await letzterAufruf()).cwd);
		expect(existsSync(ordner)).toBe(true);
		expect(await chatSchluessel(page)).toEqual([]);

		await chat(page).getByRole('button', { name: 'Chat schließen' }).click();
		await expect(chat(page)).toHaveCount(0);
		await expect.poll(() => enden).toEqual([auftraege[0]?.gespraechId]);
		await expect.poll(() => existsSync(ordner)).toBe(false);

		await page.keyboard.press('ControlOrMeta+j');
		await expect(karte(page)).toBeVisible();
		await expect(nachrichten(page)).toHaveCount(0);
		expect(await chatSchluessel(page)).toEqual([]);

		await schreibe(page, 'Noch etwas');
		await expect(nachrichten(page).first()).toHaveText(/Noch etwas/);
		await expect.poll(() => auftraege.length).toBe(2);
		expect(auftraege[1]?.gespraechId).not.toBe(auftraege[0]?.gespraechId);
		expect((await letzterAufruf()).args).not.toContain('--resume');
	});

	test('Esc aus der Zeile beendet das Gespräch, die Fußzeile sagt es; Esc im Menü nicht', async ({ page }) => {
		const { enden } = beobachte(page);
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+j');
		const tasten = chat(page).locator('[data-chat-tasten]');
		await expect(tasten).toContainText('esc schließen');
		await schreibe(page, 'FRAGE: Wie viele?');
		await expect(nachrichten(page)).toHaveCount(2);
		await expect(tasten).toContainText('esc einklappen');
		await chat(page).getByRole('button', { name: 'Chat: weitere Aktionen' }).click();
		await expect(page.getByRole('menu')).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toHaveCount(0);
		await expect(nachrichten(page)).toHaveCount(2);

		await feld(page).focus();
		await page.keyboard.press('Escape');
		await expect(chat(page)).toHaveAttribute('data-chat-fenster', 'zeile');
		await expect(tasten).toContainText('esc beendet das Gespräch');
		expect(enden).toEqual([]);
		await page.keyboard.press('Escape');
		await expect(chat(page)).toHaveCount(0);
		await expect.poll(() => enden.length).toBe(1);
	});

	test('Einklappen und Ausklappen: dieselbe Id, der Verlauf bleibt', async ({ page }) => {
		const { auftraege, enden } = beobachte(page);
		await offenesBlatt(page);
		await schreibe(page, 'FRAGE: Wie viele?');
		await expect(nachrichten(page)).toHaveCount(2);
		await chat(page).getByRole('button', { name: 'Verlauf einklappen' }).click();
		await expect(chat(page)).toHaveAttribute('data-chat-fenster', 'zeile');
		await chat(page).getByRole('button', { name: 'Verlauf zeigen' }).click();
		await expect(nachrichten(page)).toHaveCount(2);
		await schreibe(page, 'FRAGE: Und jetzt?');
		await expect(nachrichten(page)).toHaveCount(4);
		expect(auftraege[1]?.gespraechId).toBe(auftraege[0]?.gespraechId);
		expect(enden).toEqual([]);
		expect((await letzterAufruf()).args).toContain('--resume');
	});

	test('„Neu beginnen“ verhält sich wie Schließen, das Fenster bleibt offen', async ({ page }) => {
		const { auftraege, enden } = beobachte(page);
		await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		const ordner = gespraechOrdner((await letzterAufruf()).cwd);
		await chat(page).getByRole('button', { name: 'Chat: weitere Aktionen' }).click();
		await page.getByRole('menuitem', { name: 'Neu beginnen' }).click();
		await expect(nachrichten(page)).toHaveCount(0);
		await expect(chat(page)).toBeVisible();
		await expect(karte(page)).toBeVisible();
		await expect.poll(() => enden).toEqual([auftraege[0]?.gespraechId]);
		await expect.poll(() => existsSync(ordner)).toBe(false);
		await schreibe(page, 'Noch einmal');
		await expect.poll(() => auftraege.length).toBe(2);
		expect(auftraege[1]?.gespraechId).not.toBe(auftraege[0]?.gespraechId);
	});

	test('Neu laden: leer, das Ende kam auf dem Server an, und alte Einträge im Speicher sind weg', async ({
		page,
	}) => {
		await page.addInitScript(() => {
			if (!sessionStorage.getItem('gesetzt')) {
				sessionStorage.setItem('gesetzt', '1');
				localStorage.setItem('schoolbox-chat-verlauf:m/d', '[{"text":"Alter Materialtext"}]');
			}
		});
		await offenesBlatt(page);
		await expect.poll(() => chatSchluessel(page)).toEqual([]);
		await schreibe(page, 'FRAGE: Wie viele?');
		await expect(nachrichten(page)).toHaveCount(2);
		const ordner = gespraechOrdner((await letzterAufruf()).cwd);
		await page.reload();
		await expect.poll(() => existsSync(ordner)).toBe(false);
		await page.getByRole('button', { name: 'Claude', exact: true }).click();
		await expect(nachrichten(page)).toHaveCount(0);
		expect(await chatSchluessel(page)).toEqual([]);
	});

	test('Folgenachricht baut auf dem offenen Vorschlag auf', async ({ page }) => {
		const { auftraege } = beobachte(page);
		const { dok, mappe } = await offenesBlatt(page);
		await schreibe(page, 'Die Ohren größer');
		await expect(karte(page)).toBeVisible();
		await feld(page).fill('Noch größer');
		await feld(page).press('Enter');
		const vorschlag = path.join(dokumentOrdner(mappe, dok), 'vorschlag', 'material.html');
		await expect.poll(async () => (await readFile(vorschlag, 'utf8')).split('von Claude').length).toBe(3);
		expect(auftraege[1]?.aufVorschlag).toBe(true);
		expect(auftraege[1]?.gespraechId).toBe(auftraege[0]?.gespraechId);
		expect(await quelleAufPlatte(mappe, dok)).not.toContain('von Claude');
	});

	test('Von der Ansicht in den Editor: dasselbe Dokument, dasselbe Gespräch', async ({ page }) => {
		const { auftraege, enden } = beobachte(page);
		const { dok, id: mappe } = await uhrzeit();
		await page.goto(`/m/${mappe}/${dok}`);
		await page.getByRole('button', { name: 'Claude', exact: true }).click();
		await feld(page).fill('Mach es schöner');
		await feld(page).press('Enter');
		await expect(karte(page)).toBeVisible();
		await chat(page).getByRole('button', { name: 'Im Editor ansehen' }).click();
		await expect(page).toHaveURL(new RegExp(`/m/${mappe}/${dok}/bearbeiten`));
		await expect(nachrichten(page).first()).toContainText('Mach es schöner');
		expect(enden).toEqual([]);
		await feld(page).fill('Noch etwas');
		await feld(page).press('Enter');
		await expect.poll(() => auftraege.length).toBe(2);
		expect(auftraege[1]?.gespraechId).toBe(auftraege[0]?.gespraechId);
	});

	test('Editor verlassen beendet das Gespräch, Seiten ohne Dokument teilen sich eines', async ({ page }) => {
		const { enden } = beobachte(page);
		await offenesBlatt(page);
		await schreibe(page, 'FRAGE: Wie viele?');
		await expect(nachrichten(page)).toHaveCount(2);
		await page.evaluate(() => {
			window.history.pushState({}, '', '/');
			window.dispatchEvent(new PopStateEvent('popstate'));
		});
		await expect(page).toHaveURL(/\/$/);
		await expect.poll(() => enden.length).toBe(1);
		await expect(nachrichten(page)).toHaveCount(0);
	});

	test('Neues Material: Das Gespräch geht im neuen Dokument weiter', async ({ page }) => {
		const { auftraege, enden } = beobachte(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Claude', exact: true })).toBeVisible();
		await page.keyboard.press('ControlOrMeta+j');
		await feld(page).fill('Arbeitsblatt Uhrzeiten, Klasse 2');
		await feld(page).press('Enter');
		await expect(chat(page).locator('[data-chat-neu]')).toBeVisible();
		await feld(page).press('Enter');
		await expect(page).toHaveURL(/\/bearbeiten\?claude=1/);
		// 133: Der Entwurf steht über dem Blatt, nachgebessert wird dort, im selben Gespräch.
		const leiste = page.locator('[data-entwurfsleiste="offen"]');
		await expect(leiste).toBeVisible();
		await leiste.getByRole('button', { name: 'Nachbessern …' }).click();
		await leiste.getByRole('textbox').fill('Mach die Uhren größer');
		await leiste.getByRole('textbox').press('Enter');
		await expect.poll(() => auftraege.length).toBe(2);
		expect(auftraege[0]?.gespraechId).toBeTruthy();
		expect(auftraege[1]?.gespraechId).toBe(auftraege[0]?.gespraechId);
		expect(enden).toEqual([]);
		await expect.poll(async () => (await letzterAufruf()).args.includes('--resume')).toBe(true);
	});

	test('Ein sehr langes Gespräch schlägt „Neu beginnen“ vor und tut nichts von selbst', async ({ page }) => {
		const { enden } = beobachte(page);
		await offenesBlatt(page);
		await fall('kontext-gross');
		await schreibe(page, 'Mach es schöner');
		const hinweis = chat(page).locator('[data-chat-lang]');
		await expect(hinweis).toBeVisible();
		expect(enden).toEqual([]);
		await expect(nachrichten(page)).not.toHaveCount(0);
		await hinweis.getByRole('button', { name: 'Neu beginnen' }).click();
		await expect(nachrichten(page)).toHaveCount(0);
		await expect(hinweis).toHaveCount(0);
		await expect.poll(() => enden.length).toBe(1);
	});
});

test.describe('Chat am Limit (086)', () => {
	const hinweis = (page: Page, art: string) => chat(page).locator(`[data-ki-limit="${art}"]`);
	const sendenKnopf = (page: Page) => chat(page).getByRole('button', { name: 'Senden' });

	/** Der Stand lebt im Server und überlebt den Test: Das Konto neu fragen, die Attrappe meldet wieder Luft. */
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

	test('Limit erreicht, Guthaben erlaubt: Hinweis nennt das Guthaben, Senden geht weiter', async ({ page }) => {
		await offenesBlatt(page);
		await fall('limit-guthaben');
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		await expect(hinweis(page, 'guthaben')).toContainText('Wochenlimit erreicht');
		await expect(hinweis(page, 'guthaben')).toContainText('über dein Guthaben');
		await expect(hinweis(page, 'guthaben').getByRole('button')).toHaveCount(0);

		await schreibe(page, 'Noch etwas schöner');
		await expect(chat(page).locator('[data-ki-fehler]')).toHaveCount(0);
		await expect(karte(page)).toBeVisible();
		await feld(page).fill('Weiter');
		await expect(sendenKnopf(page)).toBeEnabled();
	});

	test('Echt gesperrt: Text bleibt im Feld, „Noch einmal versuchen“ fragt das Konto neu', async ({ page }) => {
		await offenesBlatt(page);
		await fall('limit-gesperrt');
		await schreibe(page, 'Mach es schöner');
		await expect(hinweis(page, 'gesperrt')).toContainText('Wieder möglich ab');
		await expect(hinweis(page, 'gesperrt')).not.toContainText('Claude-App');
		await expect(feld(page)).toHaveValue('Mach es schöner');
		await expect(sendenKnopf(page)).toBeDisabled();
		await expect(chat(page).locator('[data-ki-fehler]').getByRole('button')).toHaveCount(0);

		// Noch kein Guthaben: Die Antwort des Kontos bleibt dieselbe, der Knopf sagt das auch.
		await hinweis(page, 'gesperrt').getByRole('button', { name: 'Noch einmal versuchen' }).click();
		await expect(hinweis(page, 'gesperrt')).toContainText('noch gesperrt');
		await expect(feld(page)).toHaveValue('Mach es schöner');

		// Guthaben gekauft: Die Sperre löst sich ohne Neustart.
		await fall('limit-guthaben');
		await hinweis(page, 'gesperrt').getByRole('button', { name: 'Noch einmal versuchen' }).click();
		await expect(hinweis(page, 'guthaben')).toBeVisible();
		await expect(chat(page).locator('[data-ki-fehler]')).toHaveCount(0);
		await expect(feld(page)).toHaveValue('Mach es schöner');
		await expect(sendenKnopf(page)).toBeEnabled();
		await sendenKnopf(page).click();
		await expect(karte(page)).toBeVisible();
		await expect(feld(page)).toHaveValue('');
	});
});

test.describe('Neues Material aus dem Chat (077)', () => {
	test.afterEach(() => fall('gut'));

	const neuKarte = (page: Page) => chat(page).locator('[data-chat-neu]');
	const mappenZahl = async () =>
		(await readdir(MATERIAL_DIR, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith('_'))
			.length;
	const dokZahl = async (mappe: string) => {
		const eintraege = await readdir(path.join(MATERIAL_DIR, mappe, 'dokumente'), { withFileTypes: true });
		return eintraege.filter((e) => e.isDirectory()).length;
	};
	/** Erst wenn der Ordner offen ist, kennt der Chat ihn; vorher landete der Wunsch in „Mein Material“. */
	const zumOrdner = async (page: Page, mappe: string) => {
		await page.goto(`/m/${mappe}`);
		await expect(page).toHaveURL(/\/o\/o-/);
		await expect(page.getByRole('treeitem', { name: 'Uhrzeit', selected: true })).toBeVisible();
	};
	const auftrag = async (page: Page, text: string) => {
		await expect(page.getByRole('button', { name: 'Claude', exact: true })).toBeVisible();
		await page.keyboard.press('ControlOrMeta+j');
		await expect(feld(page)).toBeFocused();
		await feld(page).fill(text);
		await feld(page).press('Enter');
	};

	test('Mein Material: Nachricht, Karte, Enter; das Dokument entsteht, am Ende steht ein Vorschlag', async ({
		page,
	}) => {
		await page.goto('/');
		const vorher = await mappenZahl();
		await auftrag(page, 'Arbeitsblatt Uhrzeiten, Klasse 2');
		await expect(neuKarte(page)).toContainText('Uhrzeiten üben');
		await expect(neuKarte(page)).toContainText('Ablage: Mein Material');
		expect(await mappenZahl()).toBe(vorher);

		await feld(page).press('Enter');
		await expect(page).toHaveURL(/\/bearbeiten\?claude=1/);
		await expect(page.locator('[data-entwurfsleiste="offen"]')).toBeVisible();
		await expect(karte(page)).toHaveCount(0);
		expect(await mappenZahl()).toBe(vorher + 1);
		await page.goBack();
		await expect(page).toHaveURL(/\/$/);
	});

	test('Ordner: Das Dokument landet in diesem Ordner', async ({ page }) => {
		const { id: mappe } = await uhrzeit();
		await zumOrdner(page, mappe);
		const vorher = await dokZahl(mappe);
		await auftrag(page, 'Noch ein Blatt zur Uhr');
		await expect(chip(page)).toContainText('Neues Material in diesem Ordner');
		await expect(neuKarte(page).locator('[data-chat-neu-ort]')).toContainText('Ablage:');
		await neuKarte(page)
			.getByRole('button', { name: /Anlegen/ })
			.click();
		await expect(page).toHaveURL(new RegExp(`/m/${mappe}/[^/]+/bearbeiten`));
		expect(await dokZahl(mappe)).toBe(vorher + 1);
	});

	test('„Ändern“ öffnet den Assistenten vorbelegt, der Wunsch bleibt', async ({ page }) => {
		await page.goto('/');
		await auftrag(page, 'Arbeitsblatt Uhrzeiten, Klasse 2');
		await neuKarte(page).getByRole('button', { name: 'Ändern' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('Neues Material');
		await expect(dialog.locator('[data-assistent="pruefen"]')).toBeVisible();
		await expect(dialog.getByRole('textbox', { name: /^Titel/ })).toHaveValue('Uhrzeiten üben');
		await expect(dialog.locator('[data-auftrag]')).toContainText('„Arbeitsblatt Uhrzeiten, Klasse 2“');
	});

	test('Schlägt das Einordnen fehl, kommt die Karte trotzdem: Im Ordner legt sie an, ohne Ordner fragt der Dialog', async ({
		page,
	}) => {
		await fall('einordnen-fehler');
		await page.goto('/');
		await auftrag(page, 'Arbeitsblatt Uhrzeiten, Klasse 2');
		await expect(neuKarte(page)).toContainText('Bitte kurz prüfen.');
		const vorher = await mappenZahl();
		await feld(page).press('Enter');
		await expect(page.getByRole('dialog').locator('[data-assistent="fuerWen"]')).toBeVisible();
		expect(await mappenZahl()).toBe(vorher);
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toBeHidden();

		const { id: mappe } = await uhrzeit();
		await zumOrdner(page, mappe);
		await auftrag(page, 'Noch ein Blatt zur Uhr');
		await expect(neuKarte(page)).toContainText('Bitte kurz prüfen.');
		await feld(page).press('Enter');
		await expect(page).toHaveURL(new RegExp(`/m/${mappe}/[^/]+/bearbeiten`));
	});

	test('Eine unbekannte Art wird nicht still ersetzt', async ({ page }) => {
		await fall('einordnen-film');
		await page.goto('/');
		await auftrag(page, 'Ein Film über Igel');
		await expect(neuKarte(page)).toContainText('Bitte kurz prüfen.');
	});

	test('Abbrechen legt nichts an, Enter zweimal legt nur eines an', async ({ page }) => {
		const { id: mappe } = await uhrzeit();
		await zumOrdner(page, mappe);
		const vorher = await dokZahl(mappe);
		await auftrag(page, 'Noch ein Blatt zur Uhr');
		await neuKarte(page).getByRole('button', { name: 'Abbrechen' }).click();
		await expect(neuKarte(page)).toHaveCount(0);
		expect(await dokZahl(mappe)).toBe(vorher);

		await auftrag(page, 'Noch ein Blatt zur Uhr');
		await expect(neuKarte(page)).toBeVisible();
		await feld(page).press('Enter');
		await feld(page)
			.press('Enter', { timeout: 1000 })
			.catch(() => undefined);
		await expect(page).toHaveURL(new RegExp(`/m/${mappe}/[^/]+/bearbeiten`));
		expect(await dokZahl(mappe)).toBe(vorher + 1);
	});

	test('Dokumentansicht: Auftrag aufs Dokument, die Karte führt in den Editor', async ({ page }) => {
		const { dok, id: mappe } = await uhrzeit();
		await page.goto(`/m/${mappe}/${dok}`);
		await page.getByRole('button', { name: 'Claude', exact: true }).click();
		await expect(chip(page)).toContainText('Dieses Dokument');
		await feld(page).fill('Mach es schöner');
		await feld(page).press('Enter');
		await expect(karte(page)).toBeVisible();
		await chat(page).getByRole('button', { name: 'Im Editor ansehen' }).click();
		await expect(page).toHaveURL(new RegExp(`/m/${mappe}/${dok}/bearbeiten\\?chat=1`));
		await expect(karte(page)).toBeVisible();
	});

	test('Im Editor wählt man „Neues Material“ im Chip', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+j');
		await chat(page).getByRole('button', { name: 'Worauf bezieht sich der Auftrag?' }).click();
		await page.getByRole('menuitem', { name: /Neues Material/ }).click();
		await expect(chip(page)).toContainText('Neues Material');
		await feld(page).fill('Noch ein Blatt zur Uhr');
		await feld(page).press('Enter');
		await expect(neuKarte(page)).toBeVisible();
		expect(page.url()).toContain(`/m/${mappe}/${dok}/bearbeiten`);
	});

	test('Geteilte Seiten haben keinen Chat', async ({ page }) => {
		await page.goto('/f/gibt-es-nicht');
		await page.keyboard.press('ControlOrMeta+j');
		await expect(page.locator('[data-chat]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Claude', exact: true })).toHaveCount(0);
	});
});
