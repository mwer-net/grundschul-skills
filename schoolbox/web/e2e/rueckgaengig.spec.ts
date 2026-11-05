import { readFile, writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

type Druecke = (ziel: Locator) => Promise<void>;

const pfeilZurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const pfeilVor = (page: Page) => page.getByRole('button', { name: 'Wiederholen (⇧⌘Z)' });
const sitzung = (page: Page) => page.locator('[data-textbearbeitung]');
const inspektor = (page: Page) => page.locator('[data-panel="inspektor"]');
const zeigeBlatt = (page: Page, druecke: Druecke) =>
	druecke(inspektor(page).getByRole('button', { name: 'Blatt', exact: true }));

/** Beide Wege, die dasselbe tun müssen (Entscheidung 36). */
const WEGE = {
	taste: {
		zurueck: (page: Page) => page.keyboard.press('ControlOrMeta+z'),
		vor: (page: Page) => page.keyboard.press('ControlOrMeta+Shift+z'),
	},
	pfeil: {
		zurueck: (page: Page, druecke: Druecke) => druecke(pfeilZurueck(page)),
		vor: (page: Page, druecke: Druecke) => druecke(pfeilVor(page)),
	},
};

interface Umgebung {
	page: Page;
	druecke: Druecke;
	aufgabe: Locator;
}

/** Am iPad beginnt der erste Tipp schon die Sitzung, mit der Maus erst der zweite. */
const beginne = async ({ druecke, page }: Umgebung, ziel: Locator) => {
	await druecke(ziel);
	await expect(ziel).toHaveAttribute('contenteditable', 'true');
	if (!(await sitzung(page).isVisible())) {
		await druecke(ziel);
	}
	await expect(sitzung(page)).toBeVisible();
};

const dupliziere = async ({ aufgabe, druecke, page }: Umgebung) => {
	await druecke(aufgabe.first().locator('.nr'));
	const anzahl = await aufgabe.count();
	await druecke(page.getByRole('button', { name: 'Duplizieren' }));
	await expect(aufgabe).toHaveCount(anzahl + 1);
	await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();
};

const liste = (page: Page) => page.getByLabel('Format', { exact: true });

const absatz = (html: string) =>
	html.replace(/(<section class="seite"[^>]*>)/, '$1<p class="text">Die Biene fliegt zur Blume.</p>');

interface Fall {
	name: string;
	/** Das Material vor dem Öffnen anpassen. */
	material?: (html: string) => string;
	/** Bis direkt vor den Schritt: Danach gilt nur noch der eine Weg. */
	bereite: (u: Umgebung) => Promise<void>;
}

/** Jeder Fall läuft mit beiden Wegen, jeweils in einer eigenen Mappe. Das Ergebnis muss gleich sein. */
const FAELLE: Fall[] = [
	{ name: 'Struktur-Schritt', bereite: dupliziere },
	{
		name: 'Textsitzung mit Tippen',
		bereite: async (u) => {
			await beginne(u, material(u.page).locator('h1').first());
			await u.page.keyboard.type('Neu');
			await expect(pfeilZurueck(u.page)).toBeEnabled();
		},
	},
	{
		name: 'Textsitzung ohne Tippen nach Duplizieren (K)',
		bereite: async (u) => {
			await dupliziere(u);
			await beginne(u, material(u.page).locator('h1').first());
		},
	},
	{
		name: 'Auswahlliste im Inspektor (E)',
		bereite: async ({ druecke, page }) => {
			await zeigeBlatt(page, druecke);
			const vorher = await quelle(page);
			await liste(page).selectOption('a4-quer');
			await expect.poll(() => quelle(page)).not.toBe(vorher);
			await liste(page).focus();
		},
	},
	{
		name: 'Regler',
		bereite: async ({ druecke, page }) => {
			await zeigeBlatt(page, druecke);
			const regler = page.getByRole('slider', { name: 'Abstand zwischen Aufgaben' });
			const vorher = await quelle(page);
			await regler.fill('36');
			await expect.poll(() => quelle(page)).not.toBe(vorher);
			await regler.focus();
		},
	},
	{
		name: 'Zahlenfeld unverändert (J)',
		bereite: async ({ druecke, page }) => {
			await druecke(material(page).locator('.reihe').first().locator('x-uhr').first());
			await druecke(page.getByRole('button', { name: 'Eine Spalte mehr' }));
			await expect(page.locator('[data-spalten="5"]')).toBeVisible();
			await page.getByLabel('Anzahl der Spalten').focus();
		},
	},
	{
		name: 'Fokus auf body',
		bereite: async (u) => {
			await dupliziere(u);
			await u.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
		},
	},
	{
		name: 'Sprach-Werkzeug',
		material: absatz,
		bereite: async ({ druecke, page }) => {
			await druecke(material(page).locator('p.text').first());
			await page.locator('[data-sprache-silben]').getByRole('button', { name: 'Bögen', exact: true }).click();
			await expect.poll(() => quelle(page)).toContain('<x-silben>');
		},
	},
	{
		name: 'Einfügen aus der Bibliothek',
		bereite: async ({ page }) => {
			const vorher = await quelle(page);
			await page.getByRole('tab', { name: 'Bausteine' }).click();
			await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Uhr');
			await page.locator('[data-einfuegen="x-uhr"]').click();
			await expect.poll(() => quelle(page)).not.toBe(vorher);
			await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
		},
	},
	{
		name: 'Seite verschieben',
		bereite: async ({ druecke, page }) => {
			const leiste = page.locator('[data-seitenleiste]');
			await druecke(leiste.getByRole('button', { name: 'Seite hinzufügen' }));
			await expect(page.locator('[data-auswahl="seite"] h2')).toHaveText('Seite 2');
			await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();
			const vorher = await quelle(page);
			await page.keyboard.press('Alt+ArrowUp');
			await expect.poll(() => quelle(page)).not.toBe(vorher);
			await expect(page.locator('[data-auswahl="seite"] h2')).toHaveText('Seite 1');
		},
	},
	{
		name: 'Annehmen eines Vorschlags',
		bereite: async ({ page }) => {
			// Das Fenster merkt sich, dass es offen war: Beim zweiten Weg ist es schon da.
			if (!(await page.locator('[data-chat]').isVisible())) {
				await page.getByRole('button', { name: 'Claude', exact: true }).click();
			}
			const feld = page.locator('[data-chat] #ki-auftrag');
			await feld.fill('Mach es schöner');
			await feld.press('Enter');
			await page.locator('[data-ki-vorschlag]').getByRole('button', { name: 'Vergleichen' }).click();
			await page.getByRole('button', { name: 'Annehmen' }).click();
			await expect.poll(() => quelle(page)).toContain('von Claude');
			await expect(material(page).locator('h1').first()).toContainText('von Claude');
			await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
		},
	},
];

const stand = async (page: Page, adresse: string) => {
	const brotkrumen = page.locator('[data-breadcrumb]');
	return {
		quelle: await quelle(page),
		// Über die API: Was zählt, ist die gespeicherte `material.html`.
		gespeichert: ((await (await page.request.get(adresse)).json()) as { quelle: string }).quelle,
		pfad: (await brotkrumen.count()) > 0 ? ((await brotkrumen.textContent()) ?? '') : '',
		zurueck: await pfeilZurueck(page).isEnabled(),
		vor: await pfeilVor(page).isEnabled(),
	};
};

/** Bis nichts mehr lädt, die Auswahl steht und gespeichert ist. */
const ruhig = async (page: Page, adresse: string) => {
	let davor = '';
	await expect
		.poll(
			async () => {
				const s = await stand(page, adresse);
				const jetzt = JSON.stringify(s);
				const fest =
					jetzt === davor &&
					s.quelle === s.gespeichert &&
					(await page.locator('[data-editor-rahmen="laedt"]').count()) === 0;
				davor = jetzt;
				return fest;
			},
			{ intervals: [300], timeout: 15_000 },
		)
		.toBe(true);
	return stand(page, adresse);
};

const lauf = async (fall: Fall, weg: (typeof WEGE)[keyof typeof WEGE], u: Pick<Umgebung, 'page' | 'druecke'>) => {
	const { druecke, page } = u;
	const { dok, id, material: datei } = await uhrzeit();
	if (fall.material) {
		await writeFile(datei, fall.material(await readFile(datei, 'utf8')));
	}
	await oeffne(page, id, dok);
	const adresse = `/api/dokumente/${id}/${dok}`;
	await fall.bereite({ ...u, aufgabe: material(page).locator('.aufgabe') });
	// Erst wenn die Auswahl nach dem Befehl steht: Sie wird beim Schritt gemerkt.
	await ruhig(page, adresse);
	const davor = await quelle(page);
	await weg.zurueck(page, druecke);
	await expect(sitzung(page)).toHaveCount(0);
	const zurueck = await ruhig(page, adresse);
	await weg.vor(page, druecke);
	const vor = await ruhig(page, adresse);
	return { davor, zurueck, vor };
};

test.describe('Rückgängig: Pfeil und Taste (085)', () => {
	for (const fall of FAELLE) {
		test(`${fall.name}: Taste und Pfeil tun dasselbe, vor bringt die Quelle zurück`, async ({ druecke, page }) => {
			test.slow();
			const u = { page, druecke };
			const taste = await lauf(fall, WEGE.taste, u);
			const pfeil = await lauf(fall, WEGE.pfeil, u);
			expect(taste.zurueck).toEqual(pfeil.zurueck);
			expect(taste.vor).toEqual(pfeil.vor);
			// Der Vergleich der Wege allein reicht nicht: Täte keiner etwas, wären sie auch gleich.
			expect(pfeil.zurueck.vor).toBe(true);
			expect(pfeil.vor.vor).toBe(false);
			expect(pfeil.vor.zurueck).toBe(true);
			if (fall.name !== 'Textsitzung mit Tippen') {
				expect(pfeil.vor.quelle).toBe(pfeil.davor);
			}
			expect(pfeil.zurueck.quelle).not.toBe(pfeil.vor.quelle);
		});
	}

	test('Textsitzung: ein Schritt, ⇧⌘Z bringt alles zurück, im Blatt steht wieder der alte Text', async ({
		druecke,
		page,
	}) => {
		for (const weg of [WEGE.taste, WEGE.pfeil]) {
			const { dok, id } = await uhrzeit();
			await oeffne(page, id, dok);
			const anfang = await quelle(page);
			const h1 = material(page).locator('h1').first();
			const alt = await h1.textContent();
			await beginne({ page, druecke, aufgabe: h1 }, h1);
			await expect(pfeilZurueck(page)).toBeDisabled();
			await page.keyboard.type('Neu');
			await expect(pfeilZurueck(page)).toBeEnabled();
			await expect(pfeilZurueck(page)).toHaveAttribute('data-schritt', 'Text geändert');

			await weg.zurueck(page, druecke);
			await expect.poll(() => quelle(page)).toBe(anfang);
			await expect(sitzung(page)).toHaveCount(0);
			await expect(material(page).locator('h1').first()).toHaveText(alt ?? '');
			await expect(pfeilZurueck(page)).toBeDisabled();

			await weg.vor(page, druecke);
			await expect.poll(() => quelle(page)).toContain('Neu');
			await expect(material(page).locator('h1').first()).toContainText('Neu');
		}
	});

	test('Ein Druck auf den Pfeil in der Sitzung ist genau ein Schritt, nicht zwei', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const aufgabe = material(page).locator('.aufgabe');
		const u = { page, druecke, aufgabe };
		await dupliziere(u);
		const anzahl = await aufgabe.count();
		const nachKopie = await quelle(page);
		await beginne(u, material(page).locator('h1').first());
		await page.keyboard.type('Neu');
		await druecke(pfeilZurueck(page));
		await expect.poll(() => quelle(page)).toBe(nachKopie);
		await expect(aufgabe).toHaveCount(anzahl);
	});

	test('Geändertes Textfeld im Inspektor: Taste nativ im Feld, Pfeil beendet das Feld und geht einen Schritt', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await zeigeBlatt(page, druecke);
		await page.getByLabel('Format', { exact: true }).selectOption('a4-quer');
		await expect.poll(() => quelle(page)).toContain('a4-quer');
		const mitFormat = await quelle(page);
		const titel = page.locator('[data-einstellung="titel"]');
		const alt = await titel.inputValue();

		await titel.click();
		await page.keyboard.type('X');
		await page.keyboard.press('ControlOrMeta+z');
		await expect(titel).toHaveValue(alt);
		expect(await quelle(page)).toBe(mitFormat);

		// Jetzt ist das Feld wieder unverändert: Die Taste gehört dem Blatt.
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).not.toContain('a4-quer');
		await page.keyboard.press('ControlOrMeta+Shift+z');
		await expect.poll(() => quelle(page)).toBe(mitFormat);

		await titel.click();
		await page.keyboard.type('X');
		await druecke(pfeilZurueck(page));
		await expect.poll(() => quelle(page)).toBe(mitFormat);
		await expect(titel).not.toBeFocused();
		await expect(pfeilVor(page)).toBeEnabled();
	});

	test('Chat-Feld: Die Taste ändert nur das Feld, der Pfeil wirkt aufs Blatt', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await dupliziere({ page, druecke, aufgabe: material(page).locator('.aufgabe') });
		const blatt = await quelle(page);
		await page.getByRole('button', { name: 'Claude', exact: true }).click();
		const feld = page.locator('[data-chat] #ki-auftrag');
		await feld.click();
		await page.keyboard.type('Hallo');
		await page.keyboard.press('ControlOrMeta+z');
		await expect(feld).not.toHaveValue('Hallo');
		expect(await quelle(page)).toBe(blatt);

		await druecke(pfeilZurueck(page));
		await expect.poll(() => quelle(page)).not.toBe(blatt);
	});

	test('Nach dem Schritt ist der betroffene Baustein gewählt und zu sehen, der Pfeil nennt den Schritt', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const aufgabe = material(page).locator('.aufgabe');
		const letzte = aufgabe.last();
		await letzte.scrollIntoViewIfNeeded();
		await druecke(letzte.locator('.nr'));
		const name = await page.locator('[data-auswahl] h2').textContent();
		await druecke(page.getByRole('button', { name: 'Duplizieren' }));
		await expect(pfeilZurueck(page)).toHaveAttribute('data-schritt', 'Kopiert');

		// Woanders hingerollt: Der Schritt muss zurück zur Stelle führen.
		await page.locator('main').evaluate((m) => m.scrollTo(0, 0));
		await druecke(pfeilZurueck(page));
		await expect(page.locator('[data-auswahl] h2')).toHaveText(name ?? '');
		await expect(page.locator('[data-auswahlrahmen]')).toBeInViewport();
		await expect(pfeilVor(page)).toHaveAttribute('data-schritt', 'Kopiert');

		if (!hasTouch) {
			await page.mouse.move(0, 0);
			await pfeilVor(page).hover();
			await expect(page.getByText('Wiederholen: Kopiert')).toBeVisible();
		}
	});

	test('Rückgängig aus dem Menü des Browsers läuft über denselben Befehl', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const anfang = await quelle(page);
		const h1 = material(page).locator('h1').first();
		await beginne({ page, druecke, aufgabe: h1 }, h1);
		await page.keyboard.type('Neu');
		const abgefangen = await h1.evaluate((el) => {
			const menue = new InputEvent('beforeinput', { inputType: 'historyUndo', bubbles: true, cancelable: true });
			el.dispatchEvent(menue);
			return menue.defaultPrevented;
		});
		expect(abgefangen).toBe(true);
		await expect.poll(() => quelle(page)).toBe(anfang);
		await expect(sitzung(page)).toHaveCount(0);
	});
});
