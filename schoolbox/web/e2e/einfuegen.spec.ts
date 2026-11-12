import type { Locator, Page } from '@playwright/test';

import { material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const oeffneBausteine = async (page: Page) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await oeffneSchublade(page, 'bausteine');
	await expect(page.locator('[data-bereich]').first()).toBeVisible();
};
const suche = (page: Page) => page.getByRole('searchbox', { name: 'Baustein suchen' });
const alle = (page: Page) => page.getByRole('button', { name: 'Alle', exact: true });
const inhalt = (page: Page) => page.locator('[data-bibliothek] [data-schublade-inhalt]');
const MAC = { width: 1512, height: 982 };
/** `HALTEN_MS` (300) und etwas Luft. */
const HALTEN = 400;

interface Katalogeintrag {
	id: string;
	kategorie: string;
	herkunft: string;
	eigen?: string;
}
const katalog = async (page: Page) =>
	((await (await page.request.get('/api/katalog')).json()) as { eintraege: Katalogeintrag[] }).eintraege;

/** Größe der Vorschau in einer Kachel, gemessen in der Schublade am Mac neben den Ebenen. */
const vorschauGroesse = async (page: Page) => {
	await page.setViewportSize(MAC);
	await oeffneBausteine(page);
	await page.locator('[data-bereich="Aufgabe und Text"]').click();
	const rahmen = await page.locator('[data-karten-vorschau]').first().boundingBox();
	if (!rahmen) {
		throw new Error('keine Vorschau zu sehen');
	}
	return { width: Math.round(rahmen.width), height: Math.round(rahmen.height) };
};

/** Wirksame Schriftgröße des ersten Texts im Rahmen: berechnete Größe mal Maßstab des Körpers. */
const wirksameSchrift = (page: Page) =>
	page.evaluate(() => {
		const koerper = document.querySelector('body > .koerper');
		if (!koerper) {
			return NaN;
		}
		const gang = document.createTreeWalker(koerper, NodeFilter.SHOW_TEXT, {
			acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
		});
		const eltern = gang.nextNode()?.parentElement;
		if (!eltern) {
			return NaN;
		}
		const massstab = new DOMMatrix(getComputedStyle(koerper).transform).a;
		return parseFloat(getComputedStyle(eltern).fontSize) * massstab;
	});

const wartePlus = (page: Page) => expect(page.locator('[data-einfuegen-plus]')).toBeVisible();

test.describe('Editor: Bausteine einfügen', () => {
	test('Bibliothek: Klick fügt ein, ein Schritt in Rückgängig, Rest unverändert', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		await oeffneSchublade(page, 'bausteine');
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Uhr');
		await page.locator('[data-einfuegen="x-uhr"]').click();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Nach dem Einfügen ist der Baustein gewählt, bei Aufgabenpaket und Aufgabe die Aufgabe', async ({ page }) => {
		await oeffneBausteine(page);
		const titel = page.locator('[data-inspektor] [data-auswahl]');
		for (const [id, suchwort, soll] of [
			['x-tangram', 'Tangram', 'Tangram'],
			['paket-uhr', 'Uhr', 'Aufgabe'],
			['aufgabe', 'Aufgabe', 'Aufgabe'],
		] as const) {
			await suche(page).fill(suchwort);
			const vorher = await quelle(page);
			await page.locator(`[data-einfuegen="${id}"]`).click();
			await expect.poll(() => quelle(page)).not.toBe(vorher);
			await expect(titel).toBeVisible();
			await expect(titel).toContainText(soll);
		}
	});

	test('Baustein nur in der Lösung: Der Hinweis sagt es und schaltet um', async ({ page }) => {
		await oeffneBausteine(page);
		await suche(page).fill('Erwartungshorizont');
		await page.locator('[data-einfuegen="x-erwartungshorizont"]').click();
		const hinweis = page.locator('[data-hinweis="unsichtbar"]');
		await expect(hinweis).toContainText('nur in der Lösung');
		// E-B1: Die Sichtbarkeit gibt blatt.css vor, eine Auswahl darunter widerspräche dem Hinweis.
		await expect(page.locator('[data-abschnitt="sichtbarkeit"]')).toBeHidden();
		await hinweis.getByRole('button', { name: 'Zur Lösung' }).click();
		await expect(material(page).locator('body.loesung x-erwartungshorizont')).toBeVisible();
		await expect(hinweis).toBeHidden();
		await expect(page.locator('[data-abschnitt="sichtbarkeit"]')).toBeHidden();
	});

	test('„Beispiel“ wählt den Eintrag oder sagt, was zu wählen ist', async ({ druecke, page }) => {
		await oeffneBausteine(page);
		await suche(page).fill('Beispiel');
		const vorher = await quelle(page);
		await page.locator('[data-einfuegen="beispiel"]').click();
		await expect(page.locator('[role="status"]').filter({ hasText: 'zum Beispiel' }).first()).toBeVisible();
		expect(await quelle(page)).toBe(vorher);
		// Im Testblatt ist der erste Eintrag schon das Beispiel, also der zweite.
		await druecke(material(page).locator('.reihe > *').nth(1));
		await page.locator('[data-einfuegen="beispiel"]').click();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await expect(page.locator('[data-inspektor] [data-auswahl]')).toBeVisible();
	});

	test('„+ Baustein“ in der Leiste öffnet die Schnellauswahl', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await druecke(material(page).locator('.aufgabe').first().locator('.nr'));
		await wartePlus(page);
		await page.locator('[data-einfuegen-plus]').click();
		const fenster = page.locator('[data-schnellauswahl]');
		await fenster.getByRole('searchbox').fill('Schreiblinie');
		await fenster.locator('[data-katalog-eintrag="schreiblinie"]').click();
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
	});

	test('Ziehen aus der Bibliothek legt an der Stelle unter dem Zeiger ab', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await oeffneSchublade(page, 'bausteine');
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Schreiblinie');
		const kachel = await page.locator('[data-einfuegen="schreiblinie"]').boundingBox();
		const ziel = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
		if (!kachel || !ziel) {
			throw new Error('nicht zu sehen');
		}
		await page.mouse.move(kachel.x + kachel.width / 2, kachel.y + kachel.height / 2);
		await page.mouse.down();
		await page.mouse.move(ziel.x + ziel.width / 2, ziel.y + 300, { steps: 5 });
		await page.mouse.up();
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
	});

	test('Ziehen mit dem Finger: nach kurzem Halten (Pointer-Ereignisse mit Touch)', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await oeffneSchublade(page, 'bausteine');
		await page.getByRole('searchbox', { name: 'Baustein suchen' }).fill('Schreiblinie');
		const kachel = page.locator('[data-einfuegen="schreiblinie"]');
		const ziel = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
		if (!ziel) {
			throw new Error('nicht zu sehen');
		}
		const punkt = { pointerType: 'touch', pointerId: 7, isPrimary: true, bubbles: true };
		const ueberBlatt = { clientX: ziel.x + ziel.width / 2, clientY: ziel.y + 300 };
		await kachel.dispatchEvent('pointerdown', { ...punkt, clientX: 0, clientY: 0 });
		await page.waitForTimeout(HALTEN);
		await kachel.dispatchEvent('pointermove', { ...punkt, ...ueberBlatt });
		await kachel.dispatchEvent('pointerup', { ...punkt, ...ueberBlatt });
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
	});

	test('Suche im Mathe-Blatt findet „Silben“ unter „Aus anderen Fächern“, Einfügen wirkt', async ({ page }) => {
		await oeffneBausteine(page);
		await suche(page).fill('Silben');
		const anderswo = page.locator('[data-treffer-anderswo]');
		await expect(anderswo.getByRole('heading', { name: 'Aus anderen Fächern und Klassen' })).toBeVisible();
		const kachel = anderswo.locator('[data-bibliothek-eintrag="x-silben"]');
		await expect(kachel.locator('[data-treffer-bereich]')).toHaveText('Sprache');
		await anderswo.locator('[data-einfuegen="x-silben"]').click();
		await expect.poll(() => quelle(page)).toContain('x-silben');
	});

	test('Null-Ergebnis nennt die Anfrage', async ({ page }) => {
		await oeffneBausteine(page);
		await suche(page).fill('gibtsnicht');
		await expect(page.getByText('Nichts passt zu „gibtsnicht“.')).toBeVisible();
		await expect(page.getByText('Suche prüfen')).toHaveCount(0);
	});

	test('Umschalter steht über der Liste und bleibt nach dem Neuladen', async ({ page }) => {
		await oeffneBausteine(page);
		const alleKnopf = alle(page);
		const umschalter = await page.getByRole('group', { name: 'Welche Bausteine' }).boundingBox();
		const erste = await page.locator('[data-bereich]').first().boundingBox();
		expect(umschalter && erste && umschalter.y < erste.y).toBe(true);
		await expect(alleKnopf).toHaveAttribute('aria-pressed', 'false');
		await alleKnopf.click();
		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await oeffneSchublade(page, 'bausteine');
		await expect(alleKnopf).toHaveAttribute('aria-pressed', 'true');
	});

	test('Null-Bereiche nur unter „Alle“, „weitere“ schaltet um', async ({ page }) => {
		await oeffneBausteine(page);
		const sprache = page.locator('[data-bereich="Sprache"]');
		await expect(sprache).toHaveCount(0);
		const weitere = page.locator('[data-weitere]');
		const gesamt = await page.request.get('/api/katalog');
		const { eintraege } = (await gesamt.json()) as { eintraege: { kategorie: string }[] };
		const alleBereiche = new Set(eintraege.map((e) => e.kategorie)).size;
		const verborgen = alleBereiche - (await page.locator('[data-bereich]').count());
		await expect(weitere).toHaveText(`${verborgen} weitere unter Alle`);
		await weitere.click();
		await expect(page.getByRole('button', { name: 'Alle', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(sprache).toBeVisible();
		await expect(weitere).toHaveCount(0);
	});

	test('Vollständig: Über alle Bereiche unter „Alle“ gezählt ist der ganze Katalog', async ({ page }) => {
		await oeffneBausteine(page);
		await page.getByRole('button', { name: 'Alle', exact: true }).click();
		const anzahlen = await page.locator('[data-bereich-anzahl]').allTextContents();
		const { eintraege } = (await (await page.request.get('/api/katalog')).json()) as { eintraege: unknown[] };
		expect(anzahlen.reduce((s, a) => s + Number(a), 0)).toBe(eintraege.length);
	});

	test('Klick auf die Kachel fügt ein, es gibt keinen Griff', async ({ page }) => {
		await oeffneBausteine(page);
		await suche(page).fill('Schreiblinie');
		const vorher = await quelle(page);
		// Die Kachel ist ein einziger Knopf, ohne eigenen Griff daneben und ohne natives `title`.
		await expect(page.locator('[data-bibliothek-eintrag="schreiblinie"] button')).toHaveCount(1);
		const kachel = page.locator('[data-einfuegen="schreiblinie"]');
		await expect(kachel).toHaveAttribute('aria-label', 'Schreiblinie einfügen');
		expect(await kachel.getAttribute('title')).toBeNull();
		// Mitten in die Vorschau: Auch dort klickt die Kachel.
		await page.locator('[data-bibliothek-eintrag="schreiblinie"] [data-karten-vorschau]').click({ force: true });
		await expect.poll(() => quelle(page)).not.toBe(vorher);
	});

	test('Maus: Ziehen von der Kachel legt ab und fügt nicht zusätzlich per Klick ein', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'am Finger zieht erst das Halten (bausteine-ziehen.spec)');
		await oeffneBausteine(page);
		await suche(page).fill('Schreiblinie');
		const kachel = await page
			.locator('[data-bibliothek-eintrag="schreiblinie"] [data-karten-vorschau]')
			.boundingBox();
		const ziel = await page.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
		if (!kachel || !ziel) {
			throw new Error('nicht zu sehen');
		}
		const vorher = (await quelle(page)).match(/schreiblinie/g)?.length ?? 0;
		await page.mouse.move(kachel.x + kachel.width / 2, kachel.y + kachel.height / 2);
		await page.mouse.down();
		await page.mouse.move(ziel.x + ziel.width / 2, ziel.y + 300, { steps: 5 });
		await page.mouse.up();
		await expect.poll(async () => (await quelle(page)).match(/schreiblinie/g)?.length ?? 0).toBeGreaterThan(vorher);
		const danach = await quelle(page);
		await page.waitForTimeout(200);
		expect(await quelle(page)).toBe(danach);
	});

	test('Vorschau jeder Kachel passt ganz in den Rahmen', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Maß der Kachel am Mac');
		test.setTimeout(120_000);
		const groesse = await vorschauGroesse(page);
		// 147: Kachel 124 px im Raster(2) bei 280 px, Vorschau 108 × 80 px.
		expect(groesse).toEqual({ width: 108, height: 80 });
		const eintraege = await katalog(page);
		await page.setViewportSize(groesse);
		for (const { eigen, id } of eintraege) {
			if (eigen) {
				continue;
			}
			await page.goto(`/ansicht/_katalog/${id}?fit=1`);
			await page.locator('html[data-fit]').waitFor({ state: 'attached' });
			const passt = await page.evaluate(() => {
				const h = document.documentElement;
				return h.scrollHeight <= h.clientHeight && h.scrollWidth <= h.clientWidth;
			});
			expect(passt, id).toBe(true);
		}
	});

	test('Ein Maßstab: Absatz und Aufgabentext haben in der Vorschau fast dieselbe Schrift', async ({
		hasTouch,
		page,
	}) => {
		test.skip(hasTouch, 'Maß der Kachel am Mac');
		await page.setViewportSize(await vorschauGroesse(page));
		const schrift: number[] = [];
		for (const eintrag of ['text', 'anweisung']) {
			await page.goto(`/ansicht/_katalog/${eintrag}?fit=1`);
			await page.locator('html[data-fit]').waitFor({ state: 'attached' });
			schrift.push(await wirksameSchrift(page));
		}
		const [absatz = NaN, aufgabentext = NaN] = schrift;
		// 147: mit einem Maßstab 8,2 und 9,0 px; mit der alten Regel (Obergrenze 1, Streckung unter 120 px) 15,9 und 8,7 px.
		expect(Math.abs(absatz - aufgabentext), JSON.stringify(schrift)).toBeLessThanOrEqual(1.5);
	});

	test('Zwei Spalten, fester Kopf: Suche und Kopfzeile bleiben beim Rollen stehen', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Mac-Maß mit der Maus');
		await page.setViewportSize(MAC);
		await oeffneBausteine(page);
		await alle(page).click();
		const spalte = page.locator('[data-panel-links="bausteine"]');
		expect((await spalte.boundingBox())?.width).toBe(280);
		await spalte.locator('[data-bereich="Aufgabe und Text"]').click();
		const eintraege = spalte.locator('[data-bibliothek-eintrag]');
		const [a, b, c] = [
			await eintraege.nth(0).boundingBox(),
			await eintraege.nth(1).boundingBox(),
			await eintraege.nth(2).boundingBox(),
		];
		if (!a || !b || !c) {
			throw new Error('Kacheln nicht zu sehen');
		}
		expect(b.y).toBe(a.y);
		expect(b.x).toBeGreaterThan(a.x);
		expect(c.y).toBeGreaterThan(a.y);
		expect(c.x).toBe(a.x);

		const zurueck = spalte.locator('[data-bereich-zurueck]');
		const kopfVorher = await zurueck.boundingBox();
		const sucheVorher = await suche(page).boundingBox();
		await inhalt(page).evaluate((e) => e.scrollTo(0, e.scrollHeight));
		await expect.poll(() => inhalt(page).evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
		expect(await zurueck.boundingBox()).toEqual(kopfVorher);
		expect(await suche(page).boundingBox()).toEqual(sucheVorher);
		// Gegenprobe: Es wurde wirklich gerollt.
		await expect(eintraege.first()).not.toBeInViewport();

		// Die längsten Namen passen in zwei Zeilen, ohne Überlauf.
		const passtInZweiZeilen = (id: string) =>
			spalte.locator(`[data-bibliothek-eintrag="${id}"] [data-kachel-name]`).evaluate((e) => {
				const zeile = parseFloat(getComputedStyle(e).lineHeight);
				return (
					e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight && e.clientHeight <= 2 * zeile
				);
			});
		expect(await passtInZweiZeilen('paket-beobachtung')).toBe(true);
		await zurueck.click();
		await spalte.locator('[data-bereich="Rechnen"]').click();
		expect(await passtInZweiZeilen('paket-zahlenstrahl')).toBe(true);
	});

	test('Kopfzeile: Name und Anzahl der Kategorie, führt zurück, Rollstand von vorn', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 640 });
		await oeffneBausteine(page);
		await alle(page).click();
		const zeile = page.locator('[data-bereich="Rechnen"]');
		const anzahl = (await zeile.locator('[data-bereich-anzahl]').textContent()) ?? '';
		await zeile.click();
		const zurueck = page.locator('[data-bereich-zurueck]');
		await expect(zurueck).toHaveText('Rechnen');
		await expect(zurueck).toHaveAccessibleName('Rechnen');
		await expect(page.locator('[data-bereich-zurueck] + span')).toHaveText(anzahl);

		// Gerollt in der Kategorie, zurück: Der Start steht oben.
		await inhalt(page).evaluate((e) => e.scrollTo(0, e.scrollHeight));
		await expect.poll(() => inhalt(page).evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
		await zurueck.click();
		await expect(zurueck).toHaveCount(0);
		await expect(page.locator('[data-bereich-gruppe]').first()).toBeInViewport();
		expect(await inhalt(page).evaluate((e) => e.scrollTop)).toBe(0);

		// Gerollt am Start, dann eine Kategorie: Sie beginnt oben.
		await inhalt(page).evaluate((e) => e.scrollTo(0, e.scrollHeight));
		await page.locator('[data-bereich="Geometrie"]').click();
		await expect(zurueck).toHaveText('Geometrie');
		expect(await inhalt(page).evaluate((e) => e.scrollTop)).toBe(0);

		// Suchen und die Suche leeren: Das Feld behält den Fokus, die Kategorie steht wieder oben.
		await suche(page).fill('Tabelle');
		await expect(page.locator('[data-bibliothek-eintrag]').first()).toBeVisible();
		await suche(page).fill('');
		await expect(zurueck).toHaveText('Geometrie');
		await expect(suche(page)).toBeFocused();
		expect(await inhalt(page).evaluate((e) => e.scrollTop)).toBe(0);
	});

	test('„Fertige Aufgaben“ stehen am Ende der Kategorie, die Vorschau zeigt die Anweisung', async ({ page }) => {
		await oeffneBausteine(page);
		await alle(page).click();
		const soll = (await katalog(page))
			.filter((e) => e.herkunft === 'paket' && e.kategorie === 'Rechnen')
			.map((e) => e.id);
		expect(soll.length).toBeGreaterThan(0);
		await page.locator('[data-bereich="Rechnen"]').click();
		const fertig = page.locator('[data-fertige-aufgaben]');
		await expect(fertig.getByRole('heading', { name: 'Fertige Aufgaben' })).toBeAttached();
		const ids = (ort: Locator) =>
			ort.locator('[data-bibliothek-eintrag]').evaluateAll((l) => l.map((e) => e.dataset.bibliothekEintrag));
		expect(await ids(fertig)).toEqual(soll);
		const alleIds = await ids(page.locator('[data-bibliothek]'));
		expect(alleIds.slice(0, -soll.length).filter((id) => id && soll.includes(id))).toEqual([]);

		const vorschau = fertig.locator('[data-karten-vorschau]').first();
		await vorschau.scrollIntoViewIfNeeded();
		await expect(vorschau.contentFrame().locator('.aufgabe .anw')).toBeVisible();

		// Gegenprobe: Kopf und Rahmen hat keine Aufgabenpakete.
		await page.locator('[data-bereich-zurueck]').click();
		await page.locator('[data-bereich="Kopf und Rahmen"]').click();
		await expect(page.locator('[data-bibliothek-eintrag]').first()).toBeVisible();
		await expect(fertig).toHaveCount(0);
	});

	test('iPad quer: zwei Spalten, Tippen fügt ein', async ({ druecke, page }) => {
		test.skip(test.info().project.name !== 'ipad-quer', 'nur iPad quer');
		await oeffneBausteine(page);
		await druecke(page.locator('[data-bereich="Aufgabe und Text"]'));
		const eintraege = page.locator('[data-bibliothek-eintrag]');
		const [a, b] = [await eintraege.nth(0).boundingBox(), await eintraege.nth(1).boundingBox()];
		if (!a || !b) {
			throw new Error('Kacheln nicht zu sehen');
		}
		expect(b.y).toBe(a.y);
		expect(b.x).toBeGreaterThan(a.x);
		const vorher = await quelle(page);
		await druecke(page.locator('[data-einfuegen="aufgabe"]'));
		await expect.poll(() => quelle(page)).not.toBe(vorher);
	});

	test('Slash: / allein in einer Zeile öffnet das Menü, Esc lässt den Text stehen, mitten im Text nichts', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const text = material(page).locator('.aufgabe .anw .text').first();
		await druecke(text);
		await druecke(text);
		await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
		await page.keyboard.press('End');
		await page.keyboard.type('1/2');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Delete');
		await page.keyboard.type('/');
		await expect(page.locator('[data-slash-menue]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
		await expect(text).toHaveText('/');
		await page.keyboard.type('uhr');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
	});

	test('Slash: Weitertippen filtert, Enter fügt ein', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const text = material(page).locator('.aufgabe .anw .text').first();
		await druecke(text);
		await druecke(text);
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Delete');
		await page.keyboard.type('/schreiblin');
		await expect(page.locator('[data-slash-menue] [data-katalog-eintrag]').first()).toContainText('Schreib');
		await page.keyboard.press('Enter');
		await expect.poll(() => quelle(page)).toContain('schreiblinie');
		await expect(page.locator('[data-slash-menue]')).toHaveCount(0);
	});

	test('Überlauf: Die Meldung bietet das Verschieben an, danach passt alles', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const anweisung = material(page).locator('.aufgabe').nth(2).locator('.anw .text');
		await druecke(anweisung);
		await druecke(anweisung);
		await page.keyboard.press('End');
		await page.keyboard.insertText(' Und dann noch ein Satz, der immer weiter geht.'.repeat(20));
		await material(page).locator('.kopf').first().click();
		const summe = page.locator('[data-pruefung] > button');
		await expect(page.locator('[data-pruefung="fehler"]')).toBeVisible();
		await summe.click();
		await page.locator('[data-ueberlauf-verschieben]').first().click();
		await expect(page.locator('[data-pruefung="ok"]')).toBeVisible();
		await expect(material(page).locator('.seite')).toHaveCount(2);
	});

	test('Ebenen: Klick springt, das Menü ordnet', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'am iPad ordnet die Leiste am Baustein');
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const vorher = await quelle(page);
		const zeilen = page.locator('[data-gliederung-aufgabe] [data-gliederung-titel]');
		await zeilen.nth(0).click();
		await zeilen.nth(0).click({ button: 'right' });
		await page.getByRole('menuitem', { name: /Nach unten/ }).click();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
	});
});
