import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Download, Page } from '@playwright/test';

import { expect, legeMappeAn, PASSWORT, test } from './hilfe';

const KLEINSTE_TIPPFLAECHE = 44;

const dreiMappen = async () => {
	const kartoffel = await legeMappeAn('Die Kartoffel', 'sachunterricht', 3, [
		{ titel: 'Teile der Kartoffel' },
		{ titel: 'Vom Feld auf den Teller', art: 'praesentation', format: 'folie' },
	]);
	await legeMappeAn('Uhrzeit ablesen', 'mathematik', 2, [{ titel: 'Volle und halbe Stunden' }]);
	await legeMappeAn('Größen und Messen', 'mathematik', 4, [{ titel: 'Lernspiel Meterstab', art: 'lernspiel' }]);
	return kartoffel;
};

/** Mit Umlauten im Titel, Lösung und Druckhinweis; das zweite Blatt ragt über die Seite. */
const herbst = () =>
	legeMappeAn('Bäume im Herbst', 'sachunterricht', 2, [
		{ titel: 'Blätter sammeln', loesung: true, druckhinweise: ['Auf festes Papier drucken'] },
		{ titel: 'Kastanien zählen', ueberlauf: true },
	]);

/** WebKit unter Linux macht im Download-Namen aus Leerzeichen `_`; Umlaute und Gedankenstrich bleiben. */
const dateiname = async (download: Promise<Download>) => (await download).suggestedFilename().replaceAll('_', ' ');

const blattGeladen = (page: Page) => expect(page.locator('[data-blattansicht][data-geladen]')).toBeVisible();

test.describe('Übersicht', () => {
	test('lädt ein, wenn es noch nichts gibt, und zeigt eine neue Mappe von selbst', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Noch kein Material' })).toBeVisible();
		await expect(page.getByText('Schreib Claude, was du brauchst')).toBeVisible();
		await page.evaluate(() => {
			document.body.dataset.nichtNeuGeladen = 'ja';
		});

		const { id } = await legeMappeAn(`Wetter ${Date.now().toString(36)}`, 'sachunterricht', 1, [
			{ titel: 'Wolken' },
		]);
		const kachel = page.locator(`[data-mappe="${id}"]`);
		await expect(kachel).toBeVisible();
		await expect(kachel).toContainText('Sachunterricht · Klasse 1');
		await expect(kachel).toContainText('Ein Dokument · Heute');
		await expect(kachel).toContainText('Entwurf');
		// Die Vorschau entsteht im Hintergrund; bis dahin steht ein Platzhalter da
		await expect(kachel.locator('[data-platzhalter]')).toBeVisible();
		await expect(kachel.locator('img')).toBeVisible();
		await expect(page.locator('body')).toHaveAttribute('data-nicht-neu-geladen', 'ja');
	});

	test('sucht und filtert', async ({ druecke, page }) => {
		await dreiMappen();
		await page.goto('/');
		const kacheln = page.locator('[data-mappe]');
		await expect(kacheln).toHaveCount(3);

		const suche = page.getByRole('searchbox', { name: 'Material suchen' });
		await suche.fill('kartoffel');
		await expect(kacheln).toHaveCount(1);
		await expect(kacheln).toContainText('Die Kartoffel');
		await suche.fill('groessen');
		await expect(kacheln).toContainText('Größen und Messen');
		await suche.fill('meterstab');
		await expect(kacheln).toContainText('Größen und Messen');
		await suche.fill('mathe 2');
		await expect(kacheln).toContainText('Uhrzeit ablesen');

		await suche.fill('dinosaurier');
		await expect(page.getByRole('heading', { name: 'Dazu habe ich nichts gefunden' })).toBeVisible();
		await druecke(page.getByRole('button', { name: 'Alle Mappen zeigen' }));
		await expect(kacheln).toHaveCount(3);
		await expect(suche).toHaveValue('');

		const mathe = page.getByRole('button', { name: 'Mathematik' });
		await druecke(mathe);
		await expect(mathe).toHaveAttribute('aria-pressed', 'true');
		await expect(kacheln).toHaveCount(2);
		await druecke(page.getByRole('button', { name: 'Klasse 4' }));
		await expect(kacheln).toHaveCount(1);
		await druecke(page.getByRole('button', { name: 'Klasse 4' }));
		await druecke(mathe);
		await druecke(page.getByRole('button', { name: 'Präsentation' }));
		await expect(kacheln).toHaveCount(1);
		await expect(kacheln).toContainText('Die Kartoffel');
	});
});

test.describe('Mappe', () => {
	test('zeigt die Dokumente, „Ansehen“ öffnet eins', async ({ druecke, page }) => {
		const { dokumente, id } = await dreiMappen();
		await page.goto(`/m/${id}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Die Kartoffel' })).toBeVisible();
		const kacheln = page.locator('[data-dokument]');
		await expect(kacheln).toHaveCount(2);
		await expect(kacheln.nth(0)).toContainText('Arbeitsblatt · A4 hoch');
		await expect(kacheln.nth(1)).toContainText('Präsentation · Folie');
		await expect(kacheln.nth(0).locator('img')).toBeVisible();
		await expect(kacheln.nth(1).locator('img')).toBeVisible();

		await druecke(kacheln.nth(1).getByRole('link', { name: 'Ansehen' }));
		await expect(page).toHaveURL(new RegExp(`/m/${id}/${dokumente[1]}$`));
		await expect(page.getByRole('heading', { level: 1, name: 'Vom Feld auf den Teller' })).toBeVisible();
		await blattGeladen(page);
		await druecke(page.getByRole('link', { name: 'Die Kartoffel' }));
		await expect(page).toHaveURL(new RegExp(`/m/${id}$`));
	});

	test('dupliziert, löscht, macht rückgängig und stellt aus dem Papierkorb wieder her', async ({ druecke, page }) => {
		const { id } = await dreiMappen();
		await page.goto('/');
		await druecke(page.locator(`[data-mappe="${id}"]`));
		await expect(page).toHaveURL(new RegExp(`/m/${id}$`));

		await druecke(page.getByRole('button', { name: 'Duplizieren' }));
		await expect(page.getByRole('heading', { level: 1, name: 'Die Kartoffel (Kopie)' })).toBeVisible();
		await expect(page).toHaveURL(/kartoffel-kopie/);
		await expect(page.locator('[data-dokument]')).toHaveCount(2);

		await druecke(page.getByRole('button', { name: 'Löschen' }));
		await expect(page).toHaveURL(/\/$/);
		const meldung = page.getByRole('status');
		await expect(meldung).toContainText('„Die Kartoffel (Kopie)“ liegt jetzt im Papierkorb.');
		const kacheln = page.locator('[data-mappe]');
		await expect(kacheln).toHaveCount(3);
		await druecke(meldung.getByRole('button', { name: 'Rückgängig' }));
		await expect(kacheln).toHaveCount(4);
		await expect(meldung).toContainText('ist wieder da');

		await druecke(page.locator('[data-mappe*="kartoffel-kopie"]'));
		await druecke(page.getByRole('button', { name: 'Löschen' }));
		await expect(kacheln).toHaveCount(3);
		await druecke(page.getByRole('link', { name: 'Papierkorb' }));
		await expect(page.getByRole('heading', { level: 1, name: 'Papierkorb' })).toBeVisible();
		const eintrag = page.getByRole('listitem').filter({ hasText: 'Die Kartoffel (Kopie)' });
		await expect(eintrag).toContainText('Gelöscht: Heute · Wird in 30 Tagen endgültig gelöscht');
		await druecke(eintrag.getByRole('button', { name: 'Wiederherstellen' }));
		await expect(page.getByRole('heading', { name: 'Der Papierkorb ist leer' })).toBeVisible();
		await druecke(page.getByRole('status').getByRole('button', { name: 'Öffnen' }));
		await expect(page.getByRole('heading', { level: 1, name: 'Die Kartoffel (Kopie)' })).toBeVisible();
	});

	test('eine gelöschte oder unbekannte Mappe führt nicht ins Leere', async ({ page }) => {
		await page.goto('/m/gibt-es-nicht');
		await expect(page.getByRole('heading', { name: 'Diese Mappe gibt es nicht mehr' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Im Papierkorb nachsehen' })).toBeVisible();
		await page.goto('/irgendwo/anders');
		await expect(page.getByRole('heading', { name: 'Diese Seite gibt es nicht' })).toBeVisible();
	});
});

test.describe('Teilen', () => {
	test('ein Link aus dem Dialog öffnet die Mappe ohne Anmeldung, bis er abgeschaltet wird', async ({
		browser,
		druecke,
		page,
	}) => {
		const { id } = await dreiMappen();
		await page.goto(`/m/${id}`);
		await druecke(page.getByRole('button', { name: 'Mappe teilen' }));
		const dialog = page.getByRole('dialog', { name: '„Die Kartoffel“ teilen' });
		await expect(dialog).toBeVisible();
		await druecke(dialog.getByRole('button', { name: 'Link erstellen', exact: true }));
		const feld = dialog.getByRole('textbox', { name: 'Link zum Teilen' });
		await expect(feld).toHaveValue(/^http:\/\/127\.0\.0\.1:\d+\/f\/[\w-]+$/);
		const link = await feld.inputValue();
		await druecke(dialog.getByRole('button', { name: 'Link kopieren' }));
		await expect(dialog.getByText(/Kopiert|Der Link ist markiert/)).toBeVisible();

		const fremd = await browser.newContext();
		const besuch = await fremd.newPage();
		await besuch.goto(link);
		await expect(besuch.getByRole('heading', { level: 1, name: 'Die Kartoffel' })).toBeVisible();
		await expect(besuch.getByRole('link', { name: 'Ansehen' })).toHaveCount(2);
		expect((await besuch.request.get('/api/mappen')).status()).toBe(401);

		// Ein Link nur für ein Dokument steht für sich und zeigt nur dieses
		await druecke(dialog.getByRole('button', { name: 'Schließen' }));
		await expect(dialog).toBeHidden();
		await druecke(page.locator('[data-dokument]').first().getByRole('button', { name: 'Teilen' }));
		const einzeln = page.getByRole('dialog', { name: '„Teile der Kartoffel“ teilen' });
		await expect(einzeln.getByRole('textbox')).toHaveCount(0);
		await druecke(einzeln.getByRole('button', { name: 'Link erstellen', exact: true }));
		await besuch.goto(await einzeln.getByRole('textbox', { name: 'Link zum Teilen' }).inputValue());
		await expect(besuch.getByRole('heading', { level: 1, name: 'Teile der Kartoffel' })).toBeVisible();
		await expect(besuch.getByRole('link', { name: 'Die Kartoffel' })).toHaveCount(0);
		await expect(besuch.getByRole('button', { name: 'Teilen' })).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(einzeln).toBeHidden();

		await druecke(page.getByRole('button', { name: 'Mappe teilen' }));
		await expect(feld).toHaveValue(link);
		await druecke(dialog.getByRole('button', { name: 'Abschalten', exact: true }));
		await druecke(dialog.getByRole('button', { name: 'Ja, abschalten' }));
		await expect(feld).toHaveCount(0);
		await besuch.goto(link);
		await expect(besuch.getByRole('heading', { name: 'Schade!' })).toBeVisible();
		await fremd.close();
	});
});

test.describe('Dokument und PDF', () => {
	test('zeigt das Material, schaltet auf die Lösung um und aktualisiert sich von selbst', async ({
		druecke,
		page,
	}) => {
		const { dokumente, id } = await herbst();
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Blätter sammeln' })).toBeVisible();
		await expect(page.getByText('Auf festes Papier drucken')).toBeVisible();
		await blattGeladen(page);
		const blatt = page.locator('[data-blattansicht] iframe').last();
		await expect(blatt).toHaveAttribute('src', `/ansicht/${id}/dokumente/${dokumente[0]}/`);

		const loesung = page.getByRole('button', { name: 'Lösung', exact: true });
		await druecke(loesung);
		await expect(loesung).toHaveAttribute('aria-pressed', 'true');
		await expect(page).toHaveURL(/\?fassung=loesung$/);
		await expect(blatt).toHaveAttribute('src', /\?loesung=1$/);
		await expect(page.getByRole('link', { name: 'Drucken' })).toHaveAttribute('href', /fassung=loesung$/);

		// Claude ändert das Material: Die Ansicht lädt neu, ohne die Seite neu zu laden
		await page.evaluate(() => {
			document.body.dataset.nichtNeuGeladen = 'ja';
		});
		const quelle = path.join(
			process.env.E2E_MATERIAL_DIR ?? '',
			id,
			'dokumente',
			dokumente[0] ?? '',
			'material.html',
		);
		await writeFile(quelle, (await readFile(quelle, 'utf8')).replace('</body>', '<p>Neu</p></body>'));
		await expect(page.getByRole('status')).toContainText('Aktualisiert');
		await blattGeladen(page);
		await expect(page.locator('body')).toHaveAttribute('data-nicht-neu-geladen', 'ja');
	});

	test('lädt PDFs mit lesbarem Namen herunter', async ({ druecke, page }) => {
		const { dokumente, id } = await herbst();
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await druecke(page.getByRole('button', { name: 'PDF herunterladen' }));
		const menue = page.getByRole('menu');
		await expect(menue.getByRole('menuitem')).toHaveText(['Arbeitsblatt', 'Lösung', 'Arbeitsblatt und Lösung']);
		const download = page.waitForEvent('download');
		await druecke(menue.getByRole('menuitem', { name: 'Lösung', exact: true }));
		await expect(page.getByRole('button', { name: 'PDF wird erstellt …' })).toBeVisible();
		expect(await dateiname(download)).toBe('Kl2 Sachunterricht Blätter sammeln – Lösung.pdf');

		await page.goto(`/m/${id}`);
		await druecke(page.getByRole('button', { name: 'Alles als PDF' }));
		const alles = page.waitForEvent('download');
		await druecke(page.getByRole('menuitem', { name: 'Ohne Lösungen' }));
		// Ein Blatt ragt über die Seite: erst fragen, dann trotzdem herunterladen
		const dialog = page.getByRole('dialog', { name: 'Beim Prüfen ist etwas aufgefallen' });
		await expect(dialog).toContainText('Kastanien zählen');
		await expect(dialog).toContainText('„Aufgabe 4“ ragt über das Blatt hinaus');
		await druecke(dialog.getByRole('button', { name: 'Claude bitten, es zu reparieren' }));
		await expect(dialog.getByText(/Kopiert|Kopiere diesen Text/)).toBeVisible();
		await druecke(dialog.getByRole('button', { name: 'Trotzdem herunterladen' }));
		await expect(dialog).toBeHidden();
		expect(await dateiname(alles)).toBe('Kl2 Sachunterricht Bäume im Herbst – Alles.pdf');
	});

	test('„Drucken“ öffnet das PDF in einem eigenen Tab', async ({ context, druecke, page }) => {
		const { dokumente, id } = await herbst();
		// Den PDF-Betrachter des Browsers gibt es im Test nicht; geprüft wird, dass der Tab das PDF zum Ansehen öffnet.
		await context.route(/\/pdf\/.*\?anzeigen=1$/, (route) =>
			route.fulfill({ contentType: 'text/html', body: '<p>Hier ist das PDF</p>' }),
		);
		await page.goto(`/m/${id}/${dokumente[0]}`);
		const tab = context.waitForEvent('page');
		await druecke(page.getByRole('link', { name: 'Drucken' }));
		const druck = await tab;
		await expect(druck.getByText('Hier ist das PDF')).toBeVisible();
		expect(decodeURIComponent(druck.url())).toMatch(
			/\/pdf\/arbeitsblatt\/Kl2 Sachunterricht Blätter sammeln – Arbeitsblatt\.pdf\?anzeigen=1$/,
		);

		await page.goto(`/m/${id}/${dokumente[1]}`);
		const zweiter = context.waitForEvent('page');
		await druecke(page.getByRole('link', { name: 'Drucken' }));
		const warnung = (await zweiter).getByRole('dialog', { name: 'Beim Prüfen ist etwas aufgefallen' });
		await expect(warnung).toBeVisible();
		await druecke(warnung.getByRole('button', { name: 'Schließen' }));
		await expect((await zweiter).getByRole('heading', { name: 'Nicht gedruckt' })).toBeVisible();
		await druecke((await zweiter).getByRole('button', { name: 'Doch drucken' }));
		await expect((await zweiter).getByText('Hier ist das PDF')).toBeVisible();
	});

	test('ein Teilen-Link zeigt Dokumente und lädt PDFs, ohne zu warnen', async ({ browser, druecke, page }) => {
		const { id } = await herbst();
		const antwort = await page.request.post('/api/freigaben', {
			headers: { 'x-schoolbox': '1' },
			data: { mappe: id },
		});
		expect(antwort.status()).toBe(201);
		const { token } = (await antwort.json()) as { token: string };

		const fremd = await browser.newContext({ hasTouch: test.info().project.use.hasTouch });
		const besuch = await fremd.newPage();
		await besuch.goto(`/f/${token}`);
		await druecke(besuch.locator('[data-dokument]').nth(1).getByRole('link', { name: 'Ansehen' }));
		await expect(besuch.getByRole('heading', { level: 1, name: 'Kastanien zählen' })).toBeVisible();
		await blattGeladen(besuch);
		await expect(besuch.getByRole('button', { name: 'Teilen' })).toHaveCount(0);
		const download = besuch.waitForEvent('download');
		await druecke(besuch.getByRole('button', { name: 'PDF herunterladen' }));
		expect(await dateiname(download)).toBe('Kl2 Sachunterricht Kastanien zählen – Arbeitsblatt.pdf');
		await druecke(besuch.getByRole('link', { name: 'Bäume im Herbst' }));
		await expect(besuch).toHaveURL(new RegExp(`/f/${token}$`));
		await fremd.close();
	});
});

test.describe('Bedienung', () => {
	test('alles Bedienbare ist groß genug für den Finger', async ({ druecke, page }) => {
		const { id } = await dreiMappen();
		const zuKlein = () =>
			page.evaluate((minimum) => {
				const sichtbar = [...document.querySelectorAll<HTMLElement>('a, button, input')].filter(
					(e) => e.getClientRects().length > 0 && !e.classList.contains('sr-only'),
				);
				return sichtbar
					.filter((e) => {
						const { height, width } = e.getBoundingClientRect();
						return height < minimum || width < minimum;
					})
					.map((e) => `${e.tagName} „${e.textContent || e.getAttribute('aria-label')}“`);
			}, KLEINSTE_TIPPFLAECHE);

		await page.goto('/');
		await expect(page.locator('[data-mappe]')).toHaveCount(3);
		expect(await zuKlein()).toEqual([]);
		await page.goto(`/m/${id}`);
		await expect(page.locator('[data-dokument]')).toHaveCount(2);
		expect(await zuKlein()).toEqual([]);
		await druecke(page.getByRole('button', { name: 'Mappe teilen' }));
		await druecke(page.getByRole('button', { name: 'Link erstellen', exact: true }));
		await expect(page.getByRole('textbox', { name: 'Link zum Teilen' })).toBeVisible();
		expect(await zuKlein()).toEqual([]);
		await page.keyboard.press('Escape');

		const { dokumente, id: herbstId } = await herbst();
		await page.goto(`/m/${herbstId}/${dokumente[0]}`);
		await blattGeladen(page);
		expect(await zuKlein()).toEqual([]);
		await druecke(page.getByRole('button', { name: 'PDF herunterladen' }));
		await expect(page.getByRole('menu')).toBeVisible();
		expect(await zuKlein()).toEqual([]);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await page.goto(`/m/${herbstId}/${dokumente[1]}`);
		await druecke(page.getByRole('button', { name: 'PDF herunterladen' }));
		await expect(page.getByRole('dialog')).toBeVisible();
		expect(await zuKlein()).toEqual([]);
		// Nichts ragt seitlich über den Bildschirm hinaus
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});

	test('abmelden führt zur Anmeldung, anmelden zurück zur gewünschten Seite', async ({ druecke, page }) => {
		const { id } = await dreiMappen();
		await page.goto('/');
		await druecke(page.getByRole('button', { name: 'Abmelden' }));
		await expect(page).toHaveURL(/\/anmelden$/);
		await page.goto(`/m/${id}`);
		await expect(page).toHaveURL(/\/anmelden\?weiter=/);
		await page.getByLabel('Passwort').fill(PASSWORT);
		await druecke(page.getByRole('button', { name: 'Anmelden' }));
		await expect(page.getByRole('heading', { level: 1, name: 'Die Kartoffel' })).toBeVisible();
	});
});
