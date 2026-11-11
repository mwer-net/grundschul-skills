/**
 * Claude am Element (134, 135): die Blase unter der Auswahl, ihre Pille, mehrere Gespräche. Die Fälle aus dem früheren
 * Chat (074, 086, 087) gelten weiter, nur am Element.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { dokumentOrdner, expect, MATERIAL_DIR, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const kiOrdner = `${MATERIAL_DIR}-ki`;
const fall = (name: string) => writeFile(path.join(kiOrdner, 'fall.txt'), name);
const blase = (page: Page) => page.locator('[data-claude-blase]');
const feld = (page: Page) => blase(page).locator('#ki-auftrag');
const bezug = (page: Page) => blase(page).locator('[data-claude-bezug]');
const karte = (page: Page) => blase(page).locator('[data-ki-vorschlag]');
const lauf = (page: Page) => blase(page).locator('[data-ki-lauf]');
const nachrichten = (page: Page) => blase(page).locator('[data-chat-nachricht]');
const pille = (page: Page, stand?: string) =>
	page.locator(stand ? `[data-claude-pille="${stand}"]` : '[data-claude-pille]');
const aufgabe = (page: Page, i: number) => material(page).locator('.aufgabe').nth(i);
const quelleAufPlatte = (mappe: string, dok: string) =>
	readFile(path.join(dokumentOrdner(mappe, dok), 'material.html'), 'utf8');
const fokusIm = (page: Page) => page.evaluate(() => document.activeElement?.tagName);

let offen: { dok: string; mappe: string } | null = null;

const offenesBlatt = async (page: Page) => {
	const { dok, id: mappe } = await uhrzeit();
	await oeffne(page, mappe, dok);
	offen = { dok, mappe };
	return offen;
};

/** Scheitert ein Test mitten im Lauf, hielte `haenger` die Warteschlange acht Minuten lang auf und risse die nächsten mit. */
test.afterEach(async ({ page }) => {
	const blatt = offen;
	offen = null;
	if (!blatt) {
		return;
	}
	await page
		.evaluate(async ({ dok, mappe }) => {
			const r = await fetch(`/api/dokumente/${mappe}/${dok}/ki`);
			const { auftraege } = (await r.json()) as { auftraege: { id: string }[] };
			const kopf = { 'Content-Type': 'application/json', 'x-schoolbox': '1' };
			await Promise.all(
				auftraege.map((a) => fetch(`/api/ki/${a.id}/abbrechen`, { method: 'POST', headers: kopf, body: '{}' })),
			);
		}, blatt)
		.catch(() => undefined);
});

/** Ohne offene Blase öffnet ⌘J sie an der Auswahl, ohne Auswahl an der Seite. */
const schreibe = async (page: Page, text: string) => {
	if (!(await blase(page).isVisible())) {
		await page.keyboard.press('ControlOrMeta+j');
	}
	await feld(page).fill(text);
	await feld(page).press('Enter');
};

const kasten = async (ort: Locator) => {
	const b = await ort.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return b;
};

/** Was der Browser an den Server schickt, von Anfang bis Ende des Tests. */
const beobachte = (page: Page) => {
	const auftraege: {
		gespraechId?: string;
		aufVorschlag?: boolean;
		auftrag?: string;
		referenz?: string;
		verlauf?: unknown[];
	}[] = [];
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

test.describe('Blase am Element (134)', () => {
	test.afterEach(() => fall('gut'));

	test('„Claude“ steht in den Leisten von Aufgabe, Seite und Gestaltung', async ({ page }) => {
		const u = await uhrzeit();
		await writeFile(
			u.material,
			blattMit({
				vorne: [
					'<img class="figur-frei" data-lage="frei" data-name="Wilma" data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:420px;--y:620px;--b:130px">',
				],
			}),
		);
		await oeffne(page, u.id, u.dok);

		await aufgabe(page, 0).locator('.nr').click();
		await page.locator('[data-bausteinleiste="aufgabe"] [data-claude-knopf]').click();
		await expect(bezug(page)).toHaveText('Aufgabe 1');
		await expect(feld(page)).toBeFocused();

		await bezug(page).click();
		await page.getByRole('menuitem', { name: /Seite 1/ }).click();
		await expect(bezug(page)).toHaveText('Seite 1');
		await expect(page.locator('[data-bausteinleiste="seite"] [data-claude-knopf]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(blase(page)).toHaveCount(0);

		await material(page).locator('[data-name="Wilma"]').click();
		await page.locator('[data-gestaltungsleiste] [data-claude-knopf]').click();
		await expect(bezug(page)).toHaveText('Wilma');
	});

	test('⌘J ohne Auswahl: die Seite, Blase oben; mit Auswahl: unter dem Element, die Spitze zeigt hin', async ({
		page,
	}) => {
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(bezug(page)).toHaveText('Seite 1');
		await expect(feld(page)).toBeFocused();
		const seite = await kasten(material(page).locator('.seite').first());
		const oben = await kasten(blase(page));
		expect(oben.y).toBeGreaterThan(seite.y);
		expect(oben.y).toBeLessThan(seite.y + 120);
		await page.keyboard.press('Escape');
		await expect(blase(page)).toHaveCount(0);

		await aufgabe(page, 1).locator('.nr').click();
		await page.keyboard.press('ControlOrMeta+j');
		await expect(bezug(page)).toHaveText('Aufgabe 2');
		const ziel = await kasten(aufgabe(page, 1));
		const unter = await kasten(blase(page));
		expect(unter.y).toBeGreaterThanOrEqual(ziel.y + ziel.height);
		expect(unter.y).toBeLessThan(ziel.y + ziel.height + 40);
		const spitze = await kasten(blase(page).locator('[data-claude-spitze]'));
		const mitte = spitze.x + spitze.width / 2;
		expect(mitte).toBeGreaterThan(ziel.x);
		expect(mitte).toBeLessThan(ziel.x + ziel.width);
	});

	test('Passt die Blase unten nicht, rollt die Leinwand, bis sie passt', async ({ page }) => {
		await offenesBlatt(page);
		await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0));
		await aufgabe(page, 3).locator('.nr').click();
		await page.keyboard.press('ControlOrMeta+j');
		await expect(feld(page)).toBeFocused();
		const hoehe = page.viewportSize()?.height ?? 0;
		await expect
			.poll(async () => {
				const b = await blase(page).boundingBox();
				return b ? b.y + b.height <= hoehe : false;
			})
			.toBe(true);
	});

	test('Die Stufe im Kopf wählt das Element, die Chips passen zur Stufe', async ({ page }) => {
		await offenesBlatt(page);
		await aufgabe(page, 0).locator('.nr').click();
		await page.keyboard.press('ControlOrMeta+j');
		const chips = blase(page).locator('[data-ki-aktionen]');
		await expect(chips).toContainText('Baustein füllen');
		await expect(chips).not.toContainText('Drei Niveaus');

		await bezug(page).click();
		const menue = page.getByRole('menu');
		await expect(menue.getByRole('menuitem', { name: /Aufgabe 1/ })).toBeVisible();
		// Eine Seite: „Ganzes Material“ gibt es erst ab zwei Seiten.
		await expect(menue.getByRole('menuitem', { name: /Ganzes Material/ })).toHaveCount(0);
		await menue.getByRole('menuitem', { name: /Seite 1/ }).click();
		await expect(bezug(page)).toHaveText('Seite 1');
		await expect(feld(page)).toBeFocused();
		await expect(page.locator('[data-bausteinleiste="seite"]')).toBeVisible();
		await expect(chips).toContainText('Aufgabe hinzufügen');
		await expect(chips).toContainText('Drei Niveaus');
	});

	test('Bei zwei Seiten gibt es „Ganzes Material“: Claude bekommt dann keine Referenz', async ({ druecke, page }) => {
		const { auftraege } = beobachte(page);
		await offenesBlatt(page);
		await druecke(page.getByRole('button', { name: 'Seite hinzufügen' }));
		await expect(material(page).locator('.seite')).toHaveCount(2);
		await aufgabe(page, 0).locator('.nr').click();
		await page.keyboard.press('ControlOrMeta+j');
		await bezug(page).click();
		const ganz = page.getByRole('menuitem', { name: /Ganzes Material/ });
		await expect(ganz).toContainText('verbraucht deutlich mehr');
		await ganz.click();
		await expect(bezug(page)).toHaveText('Ganzes Material');
		await expect(blase(page).locator('[data-ki-aktionen]')).toContainText('Drei Niveaus');
		await schreibe(page, 'FRAGE: Wie viele Seiten?');
		await expect(nachrichten(page)).toHaveCount(2);
		expect(auftraege[0]?.referenz).toBeUndefined();
	});

	test('„Mit Claude ändern …“ am Baustein öffnet die Blase dort', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Rechtsklick gibt es nur mit der Maus');
		await offenesBlatt(page);
		await aufgabe(page, 0).locator('.nr').click({ button: 'right' });
		await page.getByRole('menuitem', { name: 'Mit Claude ändern …' }).click();
		await expect(feld(page)).toBeFocused();
		await expect(bezug(page)).toHaveText('Aufgabe 1');
	});

	test('Vorschlag gestrichelt mit Miniaturen; Verwerfen lässt die Quelle byteidentisch; ⏎ übernimmt, Rückgängig', async ({
		page,
	}) => {
		const { dok, mappe } = await offenesBlatt(page);
		const vorher = await quelleAufPlatte(mappe, dok);
		await aufgabe(page, 0).locator('.nr').click();
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		await expect(page.locator('[data-claude-vorschlag-rahmen]')).toBeVisible();
		await expect(material(page).locator('.aufgabe[data-von-claude]')).toHaveCount(1);
		const miniaturen = karte(page).locator('[data-claude-miniatur] iframe');
		await expect(miniaturen).toHaveCount(2);
		for (const m of await miniaturen.all()) {
			await expect(m).toBeVisible();
		}
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);

		await karte(page).getByRole('button', { name: 'Verwerfen' }).click();
		await expect(karte(page)).toHaveCount(0);
		await expect(page.locator('[data-claude-vorschlag-rahmen]')).toHaveCount(0);
		await expect(material(page).locator('.aufgabe[data-von-claude]')).toHaveCount(0);
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);

		await schreibe(page, 'Noch einmal');
		await expect(karte(page)).toBeVisible();
		await expect(blase(page).locator('[data-chat-tasten]')).toHaveCount(0);
		await expect(blase(page).getByRole('button', { name: 'Übernehmen', exact: true })).toBeVisible();
		await feld(page).press('Enter');
		await expect.poll(() => quelleAufPlatte(mappe, dok)).toContain('data-von-claude');
		await expect(karte(page)).toHaveCount(0);
		await expect(material(page).locator('.aufgabe').first()).toHaveAttribute('data-von-claude', '');
		await page.getByRole('button', { name: 'Rückgängig' }).click();
		await expect.poll(() => quelleAufPlatte(mappe, dok)).not.toContain('data-von-claude');
	});

	test('„Groß vergleichen“ zeigt beide Fassungen, dort lässt sich annehmen', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await karte(page).getByRole('button', { name: 'Groß vergleichen' }).click();
		await page.getByRole('button', { name: 'Annehmen' }).click();
		await expect.poll(() => quelleAufPlatte(mappe, dok)).toContain('von Claude');
		await expect(material(page).locator('h1').first()).toContainText('von Claude');
	});

	test('Nachricht auf offenen Vorschlag bessert ihn nach', async ({ page }) => {
		await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		await expect(feld(page)).toHaveAttribute('placeholder', 'Nachbessern …');
		await fall('haenger');
		await schreibe(page, 'Noch kürzer');
		await expect(lauf(page)).toContainText('Claude ändert Seite 1');
		await feld(page).fill('Zweite Nachricht');
		await feld(page).press('Enter');
		await expect(feld(page)).toHaveValue('Zweite Nachricht');
		await expect(blase(page).locator('[data-chat-nachricht="lehrkraft"]')).toHaveCount(2);
		await lauf(page).getByRole('button', { name: 'Abbrechen' }).click();
		await expect(karte(page)).toBeVisible();
	});

	test('Eine Frage bekommt eine Antwort, und das Blatt bleibt', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		const vorher = await quelleAufPlatte(mappe, dok);
		await schreibe(page, 'FRAGE: Wie viele Uhren sind das?');
		await expect(blase(page).locator('[data-chat-nachricht="claude"]')).toHaveText('Das Blatt hat vier Uhren.');
		await expect(karte(page)).toHaveCount(0);
		expect(await quelleAufPlatte(mappe, dok)).toBe(vorher);
	});

	test('Geändertes Blatt: Übernehmen ist gesperrt, „Neu starten“ schickt dieselbe Nachricht', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		const datei = path.join(dokumentOrdner(mappe, dok), 'material.html');
		await writeFile(datei, (await readFile(datei, 'utf8')).replace('</h1>', ' Eigenes</h1>'));
		await expect(karte(page).getByRole('alert')).toContainText('seit dem Auftrag geändert');
		await expect(karte(page).locator('[data-claude-uebernehmen]')).toHaveCount(0);
		await karte(page).getByRole('button', { name: 'Neu starten' }).click();
		await expect(blase(page).locator('[data-chat-nachricht="lehrkraft"]')).toHaveCount(2);
		await expect(karte(page).getByRole('button', { name: 'Groß vergleichen' })).toBeVisible();
		await expect(karte(page).getByRole('alert')).toHaveCount(0);
	});

	test('Neu laden: Der Verlauf ist weg, Vorschlag und laufender Auftrag kommen als Pille wieder', async ({
		page,
	}) => {
		await offenesBlatt(page);
		await aufgabe(page, 0).locator('.nr').click();
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(blase(page)).toHaveCount(0);
		await expect(pille(page, 'vorschlag')).toHaveText('Vorschlag bereit');
		await pille(page, 'vorschlag').click();
		await expect(bezug(page)).toHaveText('Aufgabe 1');
		await expect(karte(page)).toBeVisible();
		await expect(nachrichten(page)).toHaveCount(0);

		await fall('haenger');
		await feld(page).fill('Dauert');
		await feld(page).press('Enter');
		await expect(lauf(page)).toBeVisible();
		await page.reload();
		await expect(pille(page, 'laeuft')).toContainText('Claude arbeitet an');
		await expect(page.locator('[data-claude-stand="arbeitet"]')).toBeVisible();
		await page.locator('[data-claude-stand]').click();
		await expect(lauf(page)).toBeVisible();
		await lauf(page).getByRole('button', { name: 'Abbrechen' }).click();
		await expect(lauf(page)).toHaveCount(0);
	});

	test('Die Markierung der Textsitzung kommt beim Wechsel mit und geht zum Auftrag', async ({ page }) => {
		await offenesBlatt(page);
		const ueberschrift = material(page).locator('h1');
		await ueberschrift.click();
		await ueberschrift.click();
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await ueberschrift.evaluate((el) => el.ownerDocument.getSelection()?.selectAllChildren(el));
		await page.keyboard.press('ControlOrMeta+j');
		const zitat = blase(page).locator('[data-chat-zitat]');
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

	test('Die Palette schreibt ins Feld der Blase und schickt nichts ab', async ({ page }) => {
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+k');
		await page.locator('[data-befehlspalette]').getByRole('combobox').fill('Mach die Uhren größer');
		const zeile = page.locator('[data-palette-zeile="claude:schicken"]');
		await expect(zeile).toContainText('An Claude schicken: Mach die Uhren größer');
		await zeile.click();
		await expect(feld(page)).toHaveValue('Mach die Uhren größer');
		await expect(feld(page)).toBeFocused();
		await expect(lauf(page)).toHaveCount(0);
		await expect(nachrichten(page)).toHaveCount(0);
	});

	test('Präsentation und Druck haben keine Blase', async ({ page }) => {
		const { dok, mappe } = await offenesBlatt(page);
		await page.goto(`/m/${mappe}/${dok}/drucken`);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(page.locator('[data-claude-blase]')).toHaveCount(0);
		await page.goto(`/m/${mappe}/${dok}/praesentation`);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(page.locator('[data-claude-blase]')).toHaveCount(0);
	});
});

test.describe('Gespräch in der Blase (087)', () => {
	test.afterEach(() => fall('gut'));

	const aufrufe = path.join(kiOrdner, 'aufrufe.jsonl');

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
		await expect(feld(page)).toHaveAttribute('placeholder', 'Antworten …');
		await expect(feld(page)).toBeFocused();

		await page.keyboard.type('Ja, mach das');
		await page.keyboard.press('Enter');
		await expect(karte(page)).toBeVisible();
		await expect(feld(page)).not.toHaveAttribute('placeholder', 'Antworten …');
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

	test('× beendet das Gespräch: Verlauf leer, neue Id, Ordner weg, der Vorschlag bleibt', async ({ page }) => {
		const { auftraege, enden } = beobachte(page);
		await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		const ordner = gespraechOrdner((await letzterAufruf()).cwd);
		expect(existsSync(ordner)).toBe(true);
		expect(await chatSchluessel(page)).toEqual([]);

		await blase(page).getByRole('button', { name: 'Gespräch beenden' }).click();
		await expect(blase(page)).toHaveCount(0);
		await expect.poll(() => enden).toEqual([auftraege[0]?.gespraechId]);
		await expect.poll(() => existsSync(ordner)).toBe(false);
		await expect(pille(page, 'vorschlag')).toBeVisible();

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

	test('Esc klappt ein, das Gespräch bleibt; Esc im Menü schließt nur das Menü', async ({ page }) => {
		const { auftraege, enden } = beobachte(page);
		await offenesBlatt(page);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(feld(page)).toBeFocused();
		await expect(blase(page).locator('[data-chat-tasten]')).toHaveCount(0);
		await schreibe(page, 'FRAGE: Wie viele?');
		await expect(nachrichten(page)).toHaveCount(2);
		await blase(page).getByRole('button', { name: 'Claude: weitere Aktionen' }).click();
		await expect(page.getByRole('menu')).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toHaveCount(0);
		await expect(nachrichten(page)).toHaveCount(2);

		await feld(page).focus();
		await page.keyboard.press('Escape');
		await expect(blase(page)).toHaveCount(0);
		await expect(pille(page)).toHaveCount(1);
		await expect.poll(() => fokusIm(page)).toBe('IFRAME');
		expect(enden).toEqual([]);

		await page.keyboard.press('ControlOrMeta+j');
		await expect(nachrichten(page)).toHaveCount(2);
		await schreibe(page, 'FRAGE: Und jetzt?');
		await expect(nachrichten(page)).toHaveCount(4);
		expect(auftraege[1]?.gespraechId).toBe(auftraege[0]?.gespraechId);
		expect(enden).toEqual([]);
	});

	test('— und ⌘J klappen ein, die Pille klappt auf: dieselbe Id, der Verlauf bleibt', async ({ page }) => {
		const { auftraege, enden } = beobachte(page);
		await offenesBlatt(page);
		await schreibe(page, 'FRAGE: Wie viele?');
		await expect(nachrichten(page)).toHaveCount(2);
		await blase(page).getByRole('button', { name: 'Einklappen' }).click();
		await expect(blase(page)).toHaveCount(0);
		await pille(page).click();
		await expect(nachrichten(page)).toHaveCount(2);
		await feld(page).focus();
		await page.keyboard.press('ControlOrMeta+j');
		await expect(blase(page)).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(nachrichten(page)).toHaveCount(2);
		await schreibe(page, 'FRAGE: Und jetzt?');
		await expect(nachrichten(page)).toHaveCount(4);
		expect(auftraege[1]?.gespraechId).toBe(auftraege[0]?.gespraechId);
		expect(enden).toEqual([]);
		expect((await letzterAufruf()).args).toContain('--resume');
	});

	test('„Neu beginnen“ verhält sich wie ×, die Blase bleibt offen', async ({ page }) => {
		const { auftraege, enden } = beobachte(page);
		await offenesBlatt(page);
		await schreibe(page, 'Mach es schöner');
		await expect(karte(page)).toBeVisible();
		const ordner = gespraechOrdner((await letzterAufruf()).cwd);
		await blase(page).getByRole('button', { name: 'Claude: weitere Aktionen' }).click();
		await page.getByRole('menuitem', { name: 'Neu beginnen' }).click();
		await expect(nachrichten(page)).toHaveCount(0);
		await expect(blase(page)).toBeVisible();
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
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect.poll(() => existsSync(ordner)).toBe(false);
		await expect(pille(page)).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(blase(page)).toBeVisible();
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
		const id = auftraege[0]?.gespraechId ?? '';
		const vorschlag = path.join(dokumentOrdner(mappe, dok), 'vorschlag', id, 'material.html');
		await expect
			.poll(async () => (await readFile(vorschlag, 'utf8').catch(() => '')).split('von Claude').length)
			.toBe(3);
		expect(auftraege[1]?.aufVorschlag).toBe(true);
		expect(auftraege[1]?.gespraechId).toBe(id);
		expect(await quelleAufPlatte(mappe, dok)).not.toContain('von Claude');
	});

	test('Editor verlassen beendet das Gespräch', async ({ page }) => {
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
		await expect(blase(page)).toHaveCount(0);
	});

	test('Ein sehr langes Gespräch schlägt „Neu beginnen“ vor und tut nichts von selbst', async ({ page }) => {
		const { enden } = beobachte(page);
		await offenesBlatt(page);
		await fall('kontext-gross');
		await schreibe(page, 'Mach es schöner');
		const hinweis = blase(page).locator('[data-chat-lang]');
		await expect(hinweis).toBeVisible();
		expect(enden).toEqual([]);
		await expect(nachrichten(page)).not.toHaveCount(0);
		await hinweis.getByRole('button', { name: 'Neu beginnen' }).click();
		await expect(nachrichten(page)).toHaveCount(0);
		await expect(hinweis).toHaveCount(0);
		await expect.poll(() => enden.length).toBe(1);
	});
});

test.describe('Blase am Limit (086)', () => {
	const hinweis = (page: Page, art: string) => blase(page).locator(`[data-ki-limit="${art}"]`);
	const sendenKnopf = (page: Page) => blase(page).getByRole('button', { name: 'Senden' });

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
		await expect(blase(page).locator('[data-ki-fehler]')).toHaveCount(0);
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
		await expect(blase(page).locator('[data-ki-fehler]').getByRole('button')).toHaveCount(0);

		// Noch kein Guthaben: Die Antwort des Kontos bleibt dieselbe, der Knopf sagt das auch.
		await hinweis(page, 'gesperrt').getByRole('button', { name: 'Noch einmal versuchen' }).click();
		await expect(hinweis(page, 'gesperrt')).toContainText('noch gesperrt');
		await expect(feld(page)).toHaveValue('Mach es schöner');

		// Guthaben gekauft: Die Sperre löst sich ohne Neustart.
		await fall('limit-guthaben');
		await hinweis(page, 'gesperrt').getByRole('button', { name: 'Noch einmal versuchen' }).click();
		await expect(hinweis(page, 'guthaben')).toBeVisible();
		await expect(blase(page).locator('[data-ki-fehler]')).toHaveCount(0);
		await expect(feld(page)).toHaveValue('Mach es schöner');
		await expect(sendenKnopf(page)).toBeEnabled();
		await sendenKnopf(page).click();
		await expect(karte(page)).toBeVisible();
		await expect(feld(page)).toHaveValue('');
	});
});

test.describe('Mehrere Gespräche (135)', () => {
	test.afterEach(() => fall('gut'));

	test('Ein zweites Element wartet und startet nach dem ersten; Pillen je Stand, ✦ in den Ebenen', async ({
		page,
	}) => {
		const { dok, mappe } = await offenesBlatt(page);
		await fall('haenger');
		await aufgabe(page, 0).locator('.nr').click();
		await schreibe(page, 'Länger');
		await expect(lauf(page)).toContainText('Claude ändert Aufgabe 1');

		// Eine andere Auswahl klappt die Blase ein, das Gespräch läuft als Pille weiter. Über die Ebenen, denn die
		// Blase verdeckt Aufgabe 2 auf kleinen Bildschirmen.
		await oeffneSchublade(page, 'ebenen');
		await page.locator('[data-gliederung-titel]', { hasText: 'Zeichne die Zeiger' }).click();
		await expect(blase(page)).toHaveCount(0);
		await expect(pille(page, 'laeuft')).toContainText('Claude arbeitet an Aufgabe 1');
		await page.keyboard.press('ControlOrMeta+j');
		await expect(bezug(page)).toHaveText('Aufgabe 2');
		await schreibe(page, 'Kürzer');
		await expect(lauf(page)).toContainText('Wartet auf Claude: Aufgabe 2');
		await expect(blase(page).locator('[data-claude-warteschlange]')).toHaveText(
			'Claude ist noch bei Aufgabe 1. Dein Auftrag zu Aufgabe 2 startet direkt danach.',
		);
		await expect(page.locator('[data-claude-stand="arbeitet"]')).toBeVisible();
		await oeffneSchublade(page, 'ebenen');
		await expect(page.locator('[data-ebenen-claude]')).toHaveCount(2);

		// Das erste bricht ab, das zweite kommt dran und endet mit einem Vorschlag.
		await fall('gut');
		await pille(page, 'laeuft').click();
		await expect(bezug(page)).toHaveText('Aufgabe 1');
		await expect(pille(page, 'wartet')).toContainText('Wartet auf Claude');
		await lauf(page).getByRole('button', { name: 'Abbrechen' }).click();
		await expect(nachrichten(page).last()).toHaveText('Abgebrochen.');
		await expect(pille(page, 'vorschlag')).toHaveText('Vorschlag bereit', { timeout: 15_000 });
		await expect(page.locator('[data-ebenen-claude]')).toHaveCount(1);

		// Die offene Blase an Aufgabe 1 liegt über Aufgabe 2 und ihrer Pille; erst einklappen.
		await blase(page).getByRole('button', { name: 'Einklappen' }).click();
		await pille(page, 'vorschlag').click();
		await expect(bezug(page)).toHaveText('Aufgabe 2');
		await karte(page).locator('[data-claude-uebernehmen]').click();
		await expect.poll(async () => (await quelleAufPlatte(mappe, dok)).match(/data-von-claude/g)?.length).toBe(1);
		await expect(material(page).locator('.aufgabe').nth(1)).toHaveAttribute('data-von-claude', '');
	});

	test('Ein Klick in der Statusleiste rollt zum Gespräch und klappt es auf', async ({ page }) => {
		await offenesBlatt(page);
		await fall('haenger');
		await aufgabe(page, 3).locator('.nr').click();
		await schreibe(page, 'Länger');
		await expect(lauf(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(blase(page)).toHaveCount(0);
		await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0));
		await page.locator('[data-claude-stand]').click();
		await expect(bezug(page)).toHaveText('Sternchenaufgabe');
		await expect(blase(page)).toBeInViewport();
		await lauf(page).getByRole('button', { name: 'Abbrechen' }).click();
		await expect(lauf(page)).toHaveCount(0);
	});

	test('Wer das Element löscht, beendet sein Gespräch', async ({ page }) => {
		const { enden } = beobachte(page);
		await offenesBlatt(page);
		const anzahl = await material(page).locator('.aufgabe').count();
		await aufgabe(page, 1).locator('.nr').click();
		await schreibe(page, 'FRAGE: Wie viele?');
		await expect(nachrichten(page)).toHaveCount(2);
		await page.keyboard.press('Escape');
		await expect(pille(page)).toHaveCount(1);
		await expect.poll(() => fokusIm(page)).toBe('IFRAME');
		await page.keyboard.press('Backspace');
		await expect(material(page).locator('.aufgabe')).toHaveCount(anzahl - 1);
		await expect.poll(() => enden.length).toBe(1);
		await expect(pille(page)).toHaveCount(0);
	});
});
