import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect, legeMappeAn, MATERIAL_DIR, objekt, objektMenue, oeffneObjekt, test, waehleObjekt } from './hilfe';

const leiste = (page: Page) => page.locator('[data-werkzeugleiste]');
const baum = (page: Page, name: string) => page.locator('[data-baum-ordner]').filter({ hasText: name }).first();
const pfad = (page: Page) => page.locator('[data-pfad]');
const status = (page: Page) => page.locator('[data-statuszeile]');
const kacheln = (page: Page) => page.locator('[data-objekt]');
const meldung = (page: Page) => page.getByRole('status');
const eintrag = (page: Page, name: string | RegExp) => page.getByRole('menuitem', { name });

const reihe = () =>
	legeMappeAn('Reihe', 'mathematik', 3, [
		{ titel: 'Station 1' },
		{ titel: 'Station 2' },
		{ titel: 'Station 3' },
		{ titel: 'Station 10' },
	]);

/** Mit dem Knopf „Neuer Ordner“ anlegen: kein Dialog, nur tippen. */
const neuerOrdner = async (page: Page, name: string) => {
	await leiste(page).locator('[data-neuer-ordner]').click();
	await expect(page.locator('[data-namensfeld] input')).toBeFocused();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.keyboard.type(name);
	await page.keyboard.press('Enter');
	await expect(objekt(page, name)).toBeVisible();
};

/** Zieht wie mit der Maus, in Schritten, damit die Schwelle überschritten wird. */
const zieheBis = async (page: Page, von: Locator, nach: Locator) => {
	const a = await von.boundingBox();
	const b = await nach.boundingBox();
	if (!a || !b) {
		throw new Error('nicht zu sehen');
	}
	await page.mouse.move(a.x + a.width / 2, a.y + a.height / 3);
	await page.mouse.down();
	await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 3 + 12, { steps: 3 });
	await page.mouse.move(b.x + Math.min(50, b.width / 2), b.y + b.height / 2, { steps: 8 });
};

test.describe('Kerngeschichte', () => {
	test('⌘K gilt auch in der Ablage, ⌘J und ein Knopf „Claude“ gibt es dort nicht (136)', async ({
		hasTouch,
		page,
	}) => {
		test.skip(hasTouch, 'Tasten nur mit Maus und Tastatur');
		await page.goto('/');
		await expect(leiste(page)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Claude', exact: true })).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+k');
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+j');
		await expect(page.locator('#ki-auftrag')).toHaveCount(0);
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});

	test('Ein alter Tab, der noch einordnen will, liest „Bitte lade die Seite neu“ (136)', async ({ page }) => {
		await page.goto('/');
		const antwort = await page.evaluate(async () => {
			const r = await fetch('/api/ki/einordnen', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-schoolbox': '1' },
				body: '{"text":"Uhrzeit"}',
			});
			return { status: r.status, fehler: ((await r.json()) as { fehler?: string }).fehler ?? '' };
		});
		expect(antwort.status).toBe(404);
		expect(antwort.fehler).toContain('Bitte lade die Seite neu');
	});

	test('Ordner anlegen, ziehen, in die Tiefe, ausschneiden, einfügen, alles per ⌘Z zurück', async ({
		hasTouch,
		page,
	}) => {
		test.skip(hasTouch, 'Am Finger: eigener Test unten');
		await reihe();
		await legeMappeAn('Herbst', 'sachunterricht', 1, [{ titel: 'Igel' }]);
		await page.goto('/');
		await expect(kacheln(page)).toHaveCount(2);

		// Rechtsklick auf die Fläche: „Neuer Ordner“, danach steht das Namensfeld bereit
		await page.locator('[data-flaeche]').click({ button: 'right', position: { x: 900, y: 500 } });
		await eintrag(page, 'Neuer Ordner').click();
		await expect(page.locator('[data-namensfeld] input')).toBeFocused();
		await page.keyboard.type('AI generiert');
		await page.keyboard.press('Enter');
		await expect(objekt(page, 'AI generiert')).toBeVisible();

		await objekt(page, 'AI generiert').click({ button: 'right' });
		await eintrag(page, 'Neuer Unterordner').click();
		await expect(page.locator('[data-namensfeld] input')).toBeFocused();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await page.keyboard.type('Mathe');
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { level: 1, name: 'AI generiert' })).toHaveCount(1);
		await expect(pfad(page)).toContainText('AI generiert');
		await page.goto('/');

		// Mehrere wählen und ziehen
		await objekt(page, 'Herbst').click();
		await objekt(page, 'Reihe').click({ modifiers: ['Shift'] });
		await expect(status(page)).toContainText('2 von 3');
		await zieheBis(page, objekt(page, 'Reihe'), objekt(page, 'AI generiert'));
		await expect(status(page)).toContainText('nach');
		await page.mouse.up();
		await expect(kacheln(page)).toHaveCount(1);
		await expect(meldung(page)).toContainText('nach');

		// In die Tiefe und zurück: Auswahl bleibt
		await oeffneObjekt(page, 'AI generiert');
		await expect(page).toHaveURL(/\/o\//);
		await objekt(page, 'Reihe').click();
		await oeffneObjekt(page, 'Reihe');
		await expect(kacheln(page)).toHaveCount(4);
		await expect(pfad(page)).toContainText('AI generiert');
		await page.goBack();
		await expect(objekt(page, 'Reihe')).toHaveAttribute('aria-selected', 'true');
		await oeffneObjekt(page, 'Reihe');

		// 3 Blätter ausschneiden, woanders einfügen
		await objekt(page, 'Station 1').first().click();
		await objekt(page, 'Station 3').click({ modifiers: ['Shift'] });
		await page.keyboard.press('ControlOrMeta+x');
		await expect(meldung(page)).toContainText('gemerkt');
		await baum(page, 'Mathe').click();
		await expect(page.getByRole('heading', { level: 1, name: 'Mathe' })).toBeVisible();
		await page.keyboard.press('ControlOrMeta+v');
		await expect(kacheln(page)).toHaveCount(3);

		// Alles zurück
		await page.keyboard.press('ControlOrMeta+z');
		await expect(kacheln(page)).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+z');
		await page.goto('/');
		await page.keyboard.press('ControlOrMeta+z');
	});

	test('sechs Ebenen tief, per Pfad und Baum erreichbar', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Der Weg über das Namensfeld wird oben mit Maus geprüft');
		await page.goto('/');
		for (const name of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']) {
			await neuerOrdner(page, name);
			await oeffneObjekt(page, name);
			await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
		}
		await expect(baum(page, 'E6')).toBeVisible();
		await baum(page, 'E2').click();
		await expect(page.getByRole('heading', { level: 1, name: 'E2' })).toBeVisible();
		await page.getByRole('link', { name: 'Mein Material' }).click();
		await expect(page).toHaveURL(/\/$/);
	});
});

test.describe('Ansicht', () => {
	test('Kacheln und Liste per Knopf und Taste, gemerkt über Neuladen, Auswahl bleibt', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		await reihe();
		await page.goto('/');
		await oeffneObjekt(page, 'Reihe');
		await expect(kacheln(page)).toHaveCount(4);
		await druecke(leiste(page).getByRole('button', { name: 'Liste' }));
		await expect(page.getByRole('button', { name: /^Name/ })).toBeVisible();
		await page.reload();
		await expect(page.getByRole('button', { name: /^Name/ })).toBeVisible();
		if (!hasTouch) {
			await objekt(page, 'Station 2').click();
			await page.keyboard.press('Alt+Digit1');
			await expect(page.getByRole('button', { name: /^Name/ })).toHaveCount(0);
			await expect(objekt(page, 'Station 2')).toHaveAttribute('aria-selected', 'true');
			await page.keyboard.press('Alt+Digit2');
			await expect(page.getByRole('button', { name: /^Name/ })).toBeVisible();
			await expect(objekt(page, 'Station 2')).toHaveAttribute('aria-selected', 'true');
		}
	});

	test('Reihe steht in Erstellt-Reihenfolge, Spaltenkopf sortiert natürlich, Dreieck klappt auf', async ({
		druecke,
		page,
	}) => {
		await reihe();
		await page.goto('/');
		await druecke(leiste(page).getByRole('button', { name: 'Liste' }));
		await druecke(objekt(page, 'Reihe').locator('[data-dreieck]'));
		await expect(kacheln(page)).toHaveCount(5);
		await oeffneObjekt(page, 'Reihe');
		const namen = async () =>
			(await page.locator('[data-objekt] [data-objekt-name]').allInnerTexts()).map((t) => t.split('\n')[0]);
		await expect.poll(namen).toEqual(['Station 1', 'Station 2', 'Station 3', 'Station 10']);
		await druecke(page.getByRole('button', { name: /^Name/ }));
		await expect.poll(namen).toEqual(['Station 1', 'Station 2', 'Station 3', 'Station 10']);
		await druecke(page.getByRole('button', { name: /^Name/ }));
		await expect.poll(namen).toEqual(['Station 10', 'Station 3', 'Station 2', 'Station 1']);
	});

	test('Statuszeile und Pfad zeigen, wo ich bin und wie viel gewählt ist', async ({ page }) => {
		await reihe();
		await page.goto('/');
		await oeffneObjekt(page, 'Reihe');
		await expect(status(page)).toContainText('4 Objekte');
		await waehleObjekt(page, 'Station 2');
		await expect(status(page)).toContainText('1 von 4');
		await expect(pfad(page)).toContainText('Mein Material');
		await expect(pfad(page)).toContainText('Reihe');
	});
});

test.describe('Ordner zeigen, was drin ist', () => {
	/** `ordner` oder `blatt`, in der Reihenfolge der Kachel. */
	const vorne = (kachel: Locator) =>
		kachel.locator('[data-vorne]').evaluateAll((teile) => teile.map((t) => t.getAttribute('data-vorne')));
	const quellen = (kachel: Locator) =>
		kachel.locator('[data-vorne] img').evaluateAll((bilder) => bilder.map((b) => b.getAttribute('src') ?? ''));
	const von = (dok: string | undefined) => expect.stringContaining(`/dokumente/${dok ?? ''}/`);

	test('Kachel: bis zu drei Blätter in der Sortierung des Ordners, darunter die Zahl', async ({ druecke, page }) => {
		const { dokumente } = await reihe();
		await page.goto('/');
		const kachel = objekt(page, 'Reihe');
		await expect(kachel).toContainText('4 Materialien');
		await expect(kachel.locator('[data-ordner-bild]')).toHaveAttribute('aria-hidden', 'true');
		await expect(kachel.locator('[data-vorne]')).toHaveCount(3);
		expect(await vorne(kachel)).toEqual(['blatt', 'blatt', 'blatt']);
		// Die Ablage fragt die fehlenden Vorschauen selbst an; fertige erscheinen ohne Neuladen.
		await expect(kachel.locator('[data-vorne] img')).toHaveCount(3, { timeout: 15_000 });
		const vorher = await quellen(kachel);
		expect(vorher).toEqual([von(dokumente[0]), von(dokumente[1]), von(dokumente[2])]);
		expect(vorher.some((q) => q.includes(`/dokumente/${dokumente[3] ?? ''}/`))).toBe(false);
		await expect(objekt(page, 'Station 1')).toHaveCount(0);
		await expect(kachel).not.toContainText('Objekt');

		// Die Sortierung gehört dem Ordner: In „Reihe“ nach Name absteigend, dann schaut Station 10 vorn heraus.
		await oeffneObjekt(page, 'Reihe');
		await druecke(leiste(page).getByRole('button', { name: 'Liste' }));
		await druecke(page.getByRole('button', { name: /^Name/ }));
		await druecke(page.getByRole('button', { name: /^Name/ }));
		await druecke(leiste(page).getByRole('button', { name: 'Kacheln' }));
		await druecke(page.locator('[data-pfad-stueck="wurzel"]'));
		await expect
			.poll(() => quellen(objekt(page, 'Reihe')), { timeout: 15_000 })
			.toEqual([von(dokumente[3]), von(dokumente[2]), von(dokumente[1])]);
	});

	test('Leer, nur Ordner, gemischt: Kachel, Liste und Informationen sagen dasselbe, auch nach dem Bewegen', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		const bewege = async (name: string, ziel: string) => {
			await objektMenue(page, name);
			await druecke(eintrag(page, /Bewegen nach/));
			const wahl = page.getByRole('dialog');
			await druecke(wahl.locator('[data-baum-ordner]').filter({ hasText: ziel }));
			await druecke(wahl.getByRole('button', { name: 'Hierher bewegen' }));
			await expect(wahl).toBeHidden();
		};
		await reihe();
		await page.goto('/');
		await neuerOrdner(page, 'Hülle');
		const huelle = objekt(page, 'Hülle');
		await expect(huelle).toContainText('Leer');
		await expect(huelle.locator('[data-ordner-bild]')).toBeVisible();
		await expect(huelle.locator('[data-vorne]')).toHaveCount(0);

		await bewege('Hülle', 'Reihe');
		const reiheKachel = objekt(page, 'Reihe');
		await expect(reiheKachel).toContainText('1 Ordner · 4 Materialien');
		await expect.poll(() => vorne(reiheKachel)).toEqual(['ordner', 'blatt', 'blatt']);

		await neuerOrdner(page, 'Klasse');
		await bewege('Reihe', 'Klasse');
		const klasse = objekt(page, 'Klasse');
		await expect(klasse).toContainText('1 Ordner');
		await expect.poll(() => vorne(klasse)).toEqual(['ordner']);

		if (!hasTouch) {
			// Am iPad hoch fällt die Spalte weg.
			await druecke(leiste(page).getByRole('button', { name: 'Liste' }));
			await expect(page.getByText('Inhalt', { exact: true })).toBeVisible();
			await expect(page.getByText('Seiten', { exact: true })).toHaveCount(0);
			await expect(klasse).toContainText('1 Ordner');
			await druecke(klasse.locator('[data-dreieck]'));
			await expect(objekt(page, 'Reihe')).toContainText('1 Ordner · 4 Materialien');
			await druecke(objekt(page, 'Reihe').locator('[data-dreieck]'));
			await expect(objekt(page, 'Hülle')).toContainText('Leer');
		}

		await objektMenue(page, 'Klasse');
		await druecke(eintrag(page, /^Informationen/));
		const info = page.getByRole('dialog');
		await expect(info).toContainText('Inhalt');
		await expect(info).toContainText('1 Ordner');
		await expect(info).not.toContainText('Objekt');
	});
});

test.describe('Ziehen', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Maus; der Finger hat einen eigenen Test');

	const zwei = async (page: Page) => {
		await legeMappeAn('Quelle', 'mathematik', 3, [{ titel: 'Blatt A' }]);
		await legeMappeAn('Ziel', 'mathematik', 3, [{ titel: 'Blatt B' }]);
		await page.goto('/');
		await expect(kacheln(page)).toHaveCount(2);
	};

	test('in Baum und Pfad; ⌥ kopiert, Esc bricht ab; beim Ziehen wird kein Text markiert', async ({ page }) => {
		await zwei(page);
		await zieheBis(page, objekt(page, 'Quelle'), baum(page, 'Ziel'));
		await expect(page.locator('[data-geist]')).toBeVisible();
		expect(await page.evaluate(() => String(window.getSelection()))).toBe('');
		await page.keyboard.press('Escape');
		await page.mouse.up();
		await expect(kacheln(page)).toHaveCount(2);

		await zieheBis(page, objekt(page, 'Quelle'), objekt(page, 'Ziel'));
		await page.keyboard.down('Alt');
		await expect(status(page)).toContainText('kopieren');
		await page.mouse.up();
		await page.keyboard.up('Alt');
		await expect(meldung(page)).toContainText('kopiert');
		await expect(kacheln(page)).toHaveCount(2);

		await zieheBis(page, objekt(page, 'Quelle'), baum(page, 'Ziel'));
		await page.mouse.up();
		await expect(kacheln(page)).toHaveCount(1);

		await oeffneObjekt(page, 'Ziel');
		await expect(objekt(page, 'Quelle').first()).toBeVisible();
		await zieheBis(page, objekt(page, 'Blatt B'), page.locator('[data-pfad-stueck="wurzel"]'));
		await page.mouse.up();
		await expect(objekt(page, 'Blatt B')).toHaveCount(0);
	});

	test('in den Papierkorb, Ordner nicht in sich selbst: vor dem Loslassen zu sehen', async ({ page }) => {
		await zwei(page);
		await zieheBis(page, objekt(page, 'Quelle'), baum(page, 'Quelle'));
		await expect(status(page)).toContainText(/nicht/);
		await page.mouse.up();
		await expect(kacheln(page)).toHaveCount(2);

		await zieheBis(page, objekt(page, 'Quelle'), page.locator('[data-ablage-ziel="papierkorb"]'));
		await page.mouse.up();
		await expect(kacheln(page)).toHaveCount(1);
		await expect(meldung(page)).toContainText('Papierkorb');
		await page.keyboard.press('ControlOrMeta+z');
		await expect(kacheln(page)).toHaveCount(2);
	});

	test('Federn öffnet den Ordner beim Halten', async ({ page }) => {
		await legeMappeAn('Quelle', 'mathematik', 3, [{ titel: 'Blatt A' }]);
		await page.goto('/');
		await neuerOrdner(page, 'Oben');
		await oeffneObjekt(page, 'Oben');
		await neuerOrdner(page, 'Mitte');
		await page.goto('/');
		await zieheBis(page, objekt(page, 'Quelle'), objekt(page, 'Oben'));
		await expect(page.getByRole('heading', { level: 1, name: 'Oben' })).toBeVisible({ timeout: 4_000 });
		await page.keyboard.press('Escape');
		await page.mouse.up();
	});

	test('der Rahmen wählt auf der freien Fläche', async ({ page }) => {
		await zwei(page);
		await page.mouse.move(900, 600);
		await page.mouse.down();
		await page.mouse.move(250, 120, { steps: 6 });
		await expect(page.locator('[data-lasso]')).toBeVisible();
		expect(await page.evaluate(() => String(window.getSelection()))).toBe('');
		await page.mouse.up();
		await expect(status(page)).toContainText('2 von 2');
	});
});

test.describe('Ohne Ziehen', () => {
	test('Bewegen nach … über das Menü, auch am iPad', async ({ druecke, page }) => {
		await legeMappeAn('Quelle', 'mathematik', 3, [{ titel: 'Blatt A' }]);
		await legeMappeAn('Ziel', 'mathematik', 3, [{ titel: 'Blatt B' }]);
		await page.goto('/');
		await objektMenue(page, 'Quelle');
		// Die Ablage behält ihr Bild (170); zugleich die Gegenprobe, dass der Klassen-Selektor greift.
		await expect(eintrag(page, /Bewegen nach/).locator('svg.lucide-folder-input')).toBeVisible();
		await druecke(eintrag(page, /Bewegen nach/));
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('„Quelle“ bewegen nach');
		await druecke(dialog.locator('[data-baum-ordner]').filter({ hasText: 'Ziel' }));
		await druecke(dialog.getByRole('button', { name: 'Hierher bewegen' }));
		await expect(dialog).toBeHidden();
		await expect(kacheln(page)).toHaveCount(1);
		await druecke(meldung(page).getByRole('button', { name: 'Rückgängig' }));
		await expect(kacheln(page)).toHaveCount(2);
	});

	test('Ausschneiden und Einfügen über das Menü', async ({ druecke, page }) => {
		await legeMappeAn('Quelle', 'mathematik', 3, [{ titel: 'Blatt A' }]);
		await legeMappeAn('Ziel', 'mathematik', 3, [{ titel: 'Blatt B' }]);
		await page.goto('/');
		await objektMenue(page, 'Quelle');
		await druecke(eintrag(page, /^Ausschneiden/));
		await objektMenue(page, 'Ziel');
		await druecke(eintrag(page, /^Einfügen/));
		await expect(kacheln(page)).toHaveCount(1);
	});

	test('Umbenennen über das Menü; bei gleichem Namen bleibt das Feld offen', async ({ druecke, page }) => {
		await legeMappeAn('Eins', 'mathematik', 3, [{ titel: 'Blatt A' }]);
		await legeMappeAn('Zwei', 'mathematik', 3, [{ titel: 'Blatt B' }]);
		await page.goto('/');
		await objektMenue(page, 'Zwei');
		await druecke(eintrag(page, /^Umbenennen/));
		await page.locator('[data-namensfeld] input').fill('Eins');
		await page.keyboard.press('Enter');
		await expect(page.getByRole('alert')).toContainText('Diesen Namen gibt es hier schon.');
		await expect(page.locator('[data-namensfeld] input')).toBeFocused();
		await page.locator('[data-namensfeld] input').fill('Drei');
		await page.keyboard.press('Enter');
		await expect(meldung(page)).toContainText('heißt jetzt');
		await expect(objekt(page, 'Drei')).toHaveCount(1);
	});

	test('Tasten: F2-freies Umbenennen, ⌘C/⌘V kopieren, ⌘⌫ löschen, Esc bricht ab', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Tasten nur mit Maus und Tastatur');
		await legeMappeAn('Eins', 'mathematik', 3, [{ titel: 'Blatt A' }]);
		await page.goto('/');
		await objekt(page, 'Eins').click();
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-namensfeld] input')).toBeFocused();
		await page.keyboard.press('Escape');
		await page.keyboard.press('ControlOrMeta+c');
		await page.keyboard.press('ControlOrMeta+v');
		await expect(kacheln(page)).toHaveCount(2);
		await page.keyboard.press('ControlOrMeta+z');
		await expect(kacheln(page)).toHaveCount(1);
		await objekt(page, 'Eins').click();
		await page.keyboard.press('ControlOrMeta+Backspace');
		await expect(kacheln(page)).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+z');
		await expect(kacheln(page)).toHaveCount(1);
	});

	test('⌘C und ⌥⌘V bewegen; Esc bricht ⌘X ab', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Tasten nur mit Maus und Tastatur');
		await legeMappeAn('Quelle', 'mathematik', 3, [{ titel: 'Blatt A' }]);
		await legeMappeAn('Ziel', 'mathematik', 3, [{ titel: 'Blatt B' }]);
		await page.goto('/');
		await oeffneObjekt(page, 'Quelle');
		await expect(kacheln(page)).toHaveCount(1);

		await objekt(page, 'Blatt A').click();
		await page.keyboard.press('ControlOrMeta+x');
		await expect(meldung(page)).toContainText('gemerkt');
		await page.keyboard.press('Escape');
		await baum(page, 'Ziel').click();
		await expect(page.getByRole('heading', { level: 1, name: 'Ziel' })).toBeVisible();
		await page.keyboard.press('ControlOrMeta+v');
		await expect(kacheln(page)).toHaveCount(1);

		await baum(page, 'Quelle').click();
		await expect(page.getByRole('heading', { level: 1, name: 'Quelle' })).toBeVisible();
		await objekt(page, 'Blatt A').click();
		await page.keyboard.press('ControlOrMeta+c');
		await baum(page, 'Ziel').click();
		await expect(page.getByRole('heading', { level: 1, name: 'Ziel' })).toBeVisible();
		await page.keyboard.press('ControlOrMeta+Alt+KeyV');
		await expect(kacheln(page)).toHaveCount(2);
		await baum(page, 'Quelle').click();
		await expect(page.getByRole('heading', { level: 1, name: 'Quelle' })).toBeVisible();
		await expect(kacheln(page)).toHaveCount(0);
	});
});

test.describe('Übersicht und Informationen', () => {
	test('Leertaste öffnet, ←→ wechselt, Esc schließt; Informationen per ⌥I', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Am Finger über das Menü, siehe unten');
		const { dokumente, id } = await reihe();
		await page.goto(`/m/${id}`);
		await objekt(page, 'Station 1').first().click();
		await page.keyboard.press(' ');
		const dialog = page.getByRole('dialog');
		await expect(dialog.locator(`[data-uebersicht="${id}/${dokumente[0]}"]`)).toBeVisible();
		await page.keyboard.press('ArrowRight');
		await expect(dialog.locator(`[data-uebersicht="${id}/${dokumente[1]}"]`)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await page.keyboard.press('Alt+KeyI');
		await expect(page.getByRole('dialog')).toContainText('Informationen');
		await expect(page.getByRole('dialog')).toContainText('Mein Material › Reihe');
	});

	test('über das Menü, auch am iPad', async ({ druecke, page }) => {
		const { id } = await reihe();
		await page.goto(`/m/${id}`);
		await objektMenue(page, 'Station 1');
		await druecke(eintrag(page, /^Übersicht/));
		await expect(page.getByRole('dialog').locator('[data-uebersicht]')).toBeVisible();
		await page.keyboard.press('Escape');
		await objektMenue(page, 'Station 1');
		await druecke(eintrag(page, /^Informationen/));
		await expect(page.getByRole('dialog')).toContainText('Mathematik');
	});
});

test.describe('Suche, Zuletzt, Papierkorb', () => {
	test('„Zuletzt geändert“ zeigt Material mit Ort', async ({ druecke, page }) => {
		await reihe();
		await page.goto('/');
		await druecke(page.getByRole('button', { name: 'Zuletzt geändert' }));
		await expect(kacheln(page)).toHaveCount(4);
		await expect(page.locator('[data-objekt]').first()).toContainText('Mein Material › Reihe');
	});

	test('Zurücklegen an den alten Ort, auch wenn der Eltern-Ordner verschwunden ist', async ({ druecke, page }) => {
		await reihe();
		await page.goto('/');
		await oeffneObjekt(page, 'Reihe');
		await objektMenue(page, 'Station 2');
		await druecke(eintrag(page, /In den Papierkorb/));
		await expect(kacheln(page)).toHaveCount(3);
		await page.goto('/');
		await objektMenue(page, 'Reihe');
		await druecke(eintrag(page, /In den Papierkorb/));
		await expect(kacheln(page)).toHaveCount(0);
		await page.goto('/papierkorb');
		await druecke(page.getByRole('button', { name: 'Station 2 wiederherstellen' }));
		await expect(page.locator('[data-korb-eintrag="Station 2"]')).toHaveCount(0);
		await page.goto('/');
		await expect(objekt(page, 'Reihe')).toBeVisible();
		await oeffneObjekt(page, 'Reihe');
		await expect(objekt(page, 'Station 2')).toBeVisible();
	});
});

test.describe('Bestand', () => {
	test('„Alles als PDF“ nennt den Ordner; Material im Ordner ohne Behälter fragt Fach und Klasse', async ({
		page,
	}) => {
		await page.goto('/');
		await neuerOrdner(page, 'Leer');
		await oeffneObjekt(page, 'Leer');
		await page.locator('[data-werkzeugleiste] [data-material-anlegen]').click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('Neues Material im Ordner „Leer“');
		for (let i = 0; i < 3; i += 1) {
			await dialog.getByRole('button', { name: 'Weiter' }).click();
		}
		await expect(dialog.getByRole('group', { name: 'Fach' })).toBeVisible();
		await expect(dialog.getByRole('group', { name: 'Fach' }).locator('button').first()).toBeEnabled();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});

	test('Claude legt an der Platte vorbei an: erscheint live', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Noch kein Material' })).toBeVisible();
		await legeMappeAn('Von Claude', 'mathematik', 2, [{ titel: 'Blatt' }]);
		await expect(objekt(page, 'Von Claude')).toBeVisible();
	});

	test('Bewegen ändert keine Adresse und keine Datei des Materials', async ({ druecke, page }) => {
		const { dokumente, id } = await legeMappeAn('Bleibt', 'mathematik', 2, [{ titel: 'Blatt' }]);
		await legeMappeAn('Ziel', 'mathematik', 2, [{ titel: 'Blatt 2' }]);
		const datei = path.join(MATERIAL_DIR, id, 'dokumente', dokumente[0] ?? '', 'material.html');
		const vorher = await readFile(datei, 'utf8');
		await page.goto('/');
		await objektMenue(page, 'Bleibt');
		await druecke(eintrag(page, /Bewegen nach/));
		const dialog = page.getByRole('dialog');
		await druecke(dialog.locator('[data-baum-ordner]').filter({ hasText: 'Ziel' }));
		await druecke(dialog.getByRole('button', { name: 'Hierher bewegen' }));
		await expect(dialog).toBeHidden();
		expect(await readFile(datei, 'utf8')).toBe(vorher);
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Blatt' })).toBeVisible();
		await page.goto(`/m/${id}`);
		await expect(page).toHaveURL(/\/o\//);
		await expect(pfad(page)).toContainText('Ziel');
	});

	test('kaputter Baum ohne Sicherung: sichtbare Meldung, kein Material betroffen', async ({ page }) => {
		await legeMappeAn('Sicher', 'mathematik', 2, [{ titel: 'Blatt' }]);
		await page.goto('/');
		await expect(objekt(page, 'Sicher')).toBeVisible();
		const baumDatei = path.join(MATERIAL_DIR, '_ordner.json');
		await lstat(baumDatei);
		await writeFile(baumDatei, '{ kaputt');
		await page.reload();
		await expect(objekt(page, 'Sicher')).toBeVisible();
		await expect(meldung(page)).toContainText('Dein Material ist vollständig.');
	});
});

test.describe('Geteilter Ordner', () => {
	test('zeigt Unterordner, Hineinbewegen sagt es, Herausbewegtes ist weg', async ({ browser, druecke, page }) => {
		await legeMappeAn('Geteilt', 'mathematik', 2, [{ titel: 'Offen' }]);
		await legeMappeAn('Privat', 'mathematik', 2, [{ titel: 'Geheim' }]);
		await page.goto('/');
		await objektMenue(page, 'Geteilt');
		await druecke(eintrag(page, /^Teilen/));
		const dialog = page.getByRole('dialog', { name: '„Geteilt“ teilen' });
		await druecke(dialog.getByRole('button', { name: 'Link erstellen', exact: true }));
		const link = await dialog.getByRole('textbox', { name: 'Link zum Teilen' }).inputValue();
		await druecke(dialog.getByRole('button', { name: 'Schließen' }));

		const fremd = await browser.newContext();
		const besuch = await fremd.newPage();
		await besuch.goto(link);
		await expect(besuch.getByRole('heading', { level: 1, name: 'Geteilt' })).toBeVisible();
		await expect(besuch.getByText('Geheim')).toHaveCount(0);

		await objektMenue(page, 'Privat');
		await druecke(eintrag(page, /Bewegen nach/));
		const wahl = page.getByRole('dialog');
		await druecke(wahl.locator('[data-baum-ordner]').filter({ hasText: 'Geteilt' }));
		await druecke(wahl.getByRole('button', { name: 'Hierher bewegen' }));
		await expect(meldung(page)).toContainText('ist geteilt');

		await besuch.reload();
		const unter = besuch.locator('[data-geteilt-ordner]');
		await expect(unter).toContainText('Privat');
		await expect(unter).toContainText('1 Material');
		await expect(unter.locator('[data-vorne="blatt"]')).toHaveCount(1);
		// Das Ordnerbild trägt keinen Namen: „Geheim“ steht erst nach dem Öffnen da.
		await expect(besuch.getByText('Geheim')).toHaveCount(0);
		await unter.getByRole('link').click();
		await expect(besuch.locator('[data-dokument]')).toContainText('Geheim');

		await druecke(meldung(page).getByRole('button', { name: 'Rückgängig' }));
		await expect(objekt(page, 'Privat')).toBeVisible();
		await besuch.goto(link);
		await expect(besuch.locator('[data-geteilt-ordner]')).toHaveCount(0);
		await fremd.close();
	});
});

test.describe('Am Finger', () => {
	test.skip(({ hasTouch }) => !hasTouch, 'nur am iPad');

	test('Tippen öffnet, ⋯ und Zeilen mindestens 44 px, Auswählen statt Lasso', async ({ druecke, page }) => {
		await reihe();
		await page.goto('/');
		const ziel = objekt(page, 'Reihe');
		expect((await ziel.locator('[data-finger-menue]').boundingBox())?.height).toBeGreaterThanOrEqual(44);
		await ziel.tap();
		await expect(page.getByRole('heading', { level: 1, name: 'Reihe' })).toBeVisible();
		await druecke(leiste(page).getByRole('button', { name: 'Liste' }));
		expect((await objekt(page, 'Station 1').first().boundingBox())?.height).toBeGreaterThanOrEqual(44);
		await druecke(page.locator('[data-auswaehlen]'));
		await objekt(page, 'Station 1').first().tap();
		await objekt(page, 'Station 2').tap();
		await expect(status(page)).toContainText('2 von 4');
		expect(await leiste(page).evaluate((l) => l.scrollWidth <= l.clientWidth)).toBe(true);
		await expect(pfad(page)).toContainText('Reihe');
		await druecke(page.locator('[data-auswaehlen]'));
		await expect(status(page)).toContainText('4 Objekte');
	});

	test('Halten und Ziehen legt in einen Ordner', async ({ page }) => {
		await legeMappeAn('Quelle', 'mathematik', 3, [{ titel: 'Blatt A' }]);
		await legeMappeAn('Ziel', 'mathematik', 3, [{ titel: 'Blatt B' }]);
		await page.goto('/');
		const von = await objekt(page, 'Quelle').boundingBox();
		const nach = await baum(page, 'Ziel').boundingBox();
		if (!von || !nach) {
			throw new Error('nicht zu sehen');
		}
		// Zeigerereignisse direkt an die Fläche, wie sie der Finger in Safari auslöst (pointerType touch)
		await page
			.locator('[data-objekt]')
			.filter({ hasText: 'Quelle' })
			.evaluate(
				async (el, { a, b }) => {
					const sende = (ziel: Element | Window, typ: string, x: number, y: number) =>
						ziel.dispatchEvent(
							new PointerEvent(typ, {
								bubbles: true,
								pointerType: 'touch',
								pointerId: 7,
								isPrimary: true,
								clientX: x,
								clientY: y,
								button: 0,
								buttons: 1,
							}),
						);
					sende(el, 'pointerdown', a.x, a.y);
					await new Promise((r) => setTimeout(r, 650));
					sende(el, 'pointermove', a.x + 12, a.y + 12);
					await new Promise((r) => setTimeout(r, 50));
					sende(el, 'pointermove', b.x, b.y);
					await new Promise((r) => setTimeout(r, 100));
					sende(el, 'pointerup', b.x, b.y);
				},
				{ a: { x: von.x + 60, y: von.y + 60 }, b: { x: nach.x + 60, y: nach.y + 20 } },
			);
		await expect(kacheln(page)).toHaveCount(1);
	});
});

test('Kein Text „Mappe“ auf den Seiten der Lehrkraft', async ({ page }) => {
	const { dokumente, id } = await legeMappeAn('Blätter', 'mathematik', 2, [{ titel: 'Blatt' }]);
	for (const adresse of [
		'/',
		'/zuletzt',
		'/suche?q=bl',
		'/papierkorb',
		'/hilfe',
		`/m/${id}`,
		`/m/${id}/${dokumente[0]}`,
	]) {
		await page.goto(adresse);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('body')).not.toContainText(/\bMappen?\b/);
	}
});
