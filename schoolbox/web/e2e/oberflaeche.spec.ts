import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import {
	dateiname,
	expect,
	legeEntwuerfeAn,
	legeMappeAn,
	objekt,
	objektMenue,
	oeffneMehr,
	oeffneObjekt,
	PASSWORT,
	test,
	waehle,
	waehleObjekt,
} from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

/** Mit Finger 44 px, am Mac die Höhe der kleinsten Knöpfe (Issue 063, Entscheidungen 28 und 33). */
const KLEINSTE_TIPPFLAECHE = { finger: 44, maus: 20 };

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

/** Sichtbare Links, Knöpfe und Felder, die kleiner sind als eine Fingerspitze. */
const zuKleinAuf = (page: Page) =>
	page.evaluate((grenzen) => {
		const minimum = matchMedia('(any-pointer: coarse)').matches ? grenzen.finger : grenzen.maus;
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

/** Eine Uhrzeit-Mappe mit einem Arbeitsblatt und drei Entwürfen; B passt nicht auf die Seite. */
const uhrzeitMitEntwuerfen = async () => {
	const { dokumente, id } = await legeMappeAn('Uhrzeit', 'mathematik', 2, [{ titel: 'Uhrzeit ablesen' }]);
	const dok = dokumente[0] ?? '';
	await legeEntwuerfeAn(id, dok, [
		{ titel: 'Uhren lesen – nur Aufgaben' },
		{ titel: 'Willis Tag – Geschichte als Rahmen', passt: false },
		{ titel: 'Uhren-Rallye – Stationen im Klassenzimmer' },
	]);
	return { id, dok };
};

const blattGeladen = (page: Page) => expect(page.locator('[data-blattansicht][data-geladen]')).toBeVisible();

test.describe('Mein Material', () => {
	test('lädt ein, wenn es noch nichts gibt, und zeigt neues Material von selbst', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Noch kein Material' })).toBeVisible();
		await expect(page.getByText('Schreib Claude, was du brauchst')).toBeVisible();
		await page.evaluate(() => {
			document.body.dataset.nichtNeuGeladen = 'ja';
		});

		const titel = `Wetter ${Date.now().toString(36)}`;
		await legeMappeAn(titel, 'sachunterricht', 1, [{ titel: 'Wolken' }]);
		const kachel = objekt(page, titel);
		await expect(kachel).toBeVisible();
		await expect(kachel).toContainText('1 Objekt');
		await expect(page.locator('body')).toHaveAttribute('data-nicht-neu-geladen', 'ja');
		await oeffneObjekt(page, titel);
		const blatt = objekt(page, 'Wolken');
		await expect(blatt).toContainText('Entwurf');
		// Die Vorschau entsteht im Hintergrund; bis dahin steht ein Platzhalter da
		await expect(blatt.locator('[data-platzhalter]')).toBeVisible();
		await expect(blatt.locator('img')).toBeVisible();
	});

	test('sucht und filtert: Treffer sind Dokumente und nennen ihren Ort', async ({ druecke, page }) => {
		await dreiMappen();
		await page.goto('/');
		await expect(page.locator('[data-objekt]')).toHaveCount(3);
		const treffer = page.locator('[data-objekt]');

		const suche = page.getByPlaceholder('Material und Ordner suchen');
		await suche.fill('kartoffel');
		await expect(page).toHaveURL(/\/suche\?/);
		await expect(treffer).toHaveCount(2);
		await expect(treffer.first()).toContainText('Die Kartoffel');
		await suche.fill('meterstab');
		await expect(treffer).toHaveCount(1);
		await expect(treffer).toContainText('Lernspiel Meterstab');
		await expect(treffer).toContainText('Mein Material › Größen und Messen');

		await suche.fill('dinosaurier');
		await expect(page.getByRole('heading', { name: 'Dazu habe ich nichts gefunden' })).toBeVisible();
		await suche.fill('');

		const filter = async (knopf: string, eintrag: string) => {
			await druecke(page.getByRole('button', { name: knopf, exact: true }));
			await druecke(page.getByRole('menuitem', { name: eintrag }));
		};
		await expect(page.locator('[data-suchleiste]')).toBeVisible();
		await filter('Fach', 'Mathematik');
		await expect(page.getByRole('button', { name: 'Fach: Mathematik' })).toBeVisible();
		await expect(page).toHaveURL(/fach=mathematik/);
		await expect(treffer).toHaveCount(2);
		await filter('Klasse', 'Klasse 4');
		await expect(treffer).toHaveCount(1);
		await page.reload();
		await expect(page.getByRole('button', { name: 'Fach: Mathematik' })).toBeVisible();
		await expect(treffer).toHaveCount(1);
		await druecke(page.getByRole('button', { name: 'Zurücksetzen' }));
		await expect(treffer).toHaveCount(4);
		await expect(page.getByRole('button', { name: 'Zurücksetzen' })).toHaveCount(0);
		await filter('Art', 'Präsentation');
		await expect(treffer).toHaveCount(1);
		await expect(treffer).toContainText('Vom Feld auf den Teller');
	});
});

test.describe('Ordner', () => {
	test('zeigt die Dokumente, Öffnen führt hin, der Weg zurück führt zum Ordner', async ({ druecke, page }) => {
		const { dokumente, id } = await dreiMappen();
		await page.goto(`/m/${id}`);
		await expect(page).toHaveURL(/\/o\//);
		const ordnerSeite = page.url();
		await expect(page.getByRole('heading', { level: 1, name: 'Die Kartoffel' })).toBeVisible();
		const kacheln = page.locator('[data-objekt]');
		await expect(kacheln).toHaveCount(2);
		await expect(kacheln.nth(0)).toContainText('Arbeitsblatt · A4 hoch');
		await expect(kacheln.nth(1)).toContainText('Präsentation · Folie');
		await expect(kacheln.nth(0).locator('img')).toBeVisible();
		await expect(kacheln.nth(1).locator('img')).toBeVisible();

		await oeffneObjekt(page, 'Vom Feld auf den Teller');
		await expect(page).toHaveURL(new RegExp(`/m/${id}/${dokumente[1]}$`));
		await expect(page.getByRole('heading', { level: 1, name: 'Vom Feld auf den Teller' })).toBeVisible();
		await blattGeladen(page);
		await druecke(page.getByRole('link', { name: 'Die Kartoffel' }));
		await expect(page).toHaveURL(ordnerSeite);
	});

	test('dupliziert, löscht, macht rückgängig und stellt aus dem Papierkorb wieder her', async ({ druecke, page }) => {
		await dreiMappen();
		await page.goto('/');
		const kacheln = page.locator('[data-objekt]');
		await expect(kacheln).toHaveCount(3);

		await objektMenue(page, 'Die Kartoffel');
		await druecke(page.getByRole('menuitem', { name: 'Duplizieren' }));
		await expect(kacheln).toHaveCount(4);
		await expect(objekt(page, 'Die Kartoffel (Kopie)')).toBeVisible();

		await objektMenue(page, 'Die Kartoffel (Kopie)');
		await druecke(page.getByRole('menuitem', { name: 'In den Papierkorb' }));
		const meldung = page.getByRole('status');
		await expect(meldung).toContainText('„Die Kartoffel (Kopie)“ in den Papierkorb gelegt.');
		await expect(kacheln).toHaveCount(3);
		await druecke(meldung.getByRole('button', { name: 'Rückgängig' }));
		await expect(kacheln).toHaveCount(4);

		await objektMenue(page, 'Die Kartoffel (Kopie)');
		await druecke(page.getByRole('menuitem', { name: 'In den Papierkorb' }));
		await expect(kacheln).toHaveCount(3);
		await druecke(page.locator('[data-ablage-ziel="papierkorb"]'));
		await expect(page.getByRole('heading', { level: 1, name: 'Papierkorb' })).toBeVisible();
		const eintrag = page.locator('[data-korb-eintrag="Die Kartoffel (Kopie)"]');
		await expect(eintrag).toContainText('Noch 30 Tage');
		await druecke(eintrag.getByRole('button', { name: 'Die Kartoffel (Kopie) wiederherstellen' }));
		await expect(page.getByRole('heading', { name: 'Der Papierkorb ist leer' })).toBeVisible();
		await page.goto('/');
		await expect(objekt(page, 'Die Kartoffel (Kopie)')).toBeVisible();
	});

	test('ein unbekannter Ordner führt nicht ins Leere', async ({ page }) => {
		await page.goto('/o/gibt-es-nicht');
		await expect(page.getByRole('heading', { name: 'Diesen Ordner gibt es nicht mehr' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Im Papierkorb nachsehen' })).toBeVisible();
		await page.goto('/irgendwo/anders');
		await expect(page.getByRole('heading', { name: 'Diese Seite gibt es nicht' })).toBeVisible();
	});
});

test.describe('Teilen', () => {
	test('ein Link aus dem Dialog öffnet den Ordner ohne Anmeldung, bis er abgeschaltet wird', async ({
		browser,
		druecke,
		page,
	}) => {
		const { id } = await dreiMappen();
		await page.goto('/');
		await objektMenue(page, 'Die Kartoffel');
		await druecke(page.getByRole('menuitem', { name: 'Teilen' }));
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
		expect((await besuch.request.get('/api/ordner')).status()).toBe(401);

		// Ein Link nur für ein Dokument steht für sich und zeigt nur dieses
		await druecke(dialog.getByRole('button', { name: 'Schließen' }));
		await expect(dialog).toBeHidden();
		await page.goto(`/m/${id}`);
		await objektMenue(page, 'Teile der Kartoffel');
		await druecke(page.getByRole('menuitem', { name: 'Teilen' }));
		const einzeln = page.getByRole('dialog', { name: '„Teile der Kartoffel“ teilen' });
		await expect(einzeln.getByRole('textbox')).toHaveCount(0);
		await druecke(einzeln.getByRole('button', { name: 'Link erstellen', exact: true }));
		await besuch.goto(await einzeln.getByRole('textbox', { name: 'Link zum Teilen' }).inputValue());
		await expect(besuch.getByRole('heading', { level: 1, name: 'Teile der Kartoffel' })).toBeVisible();
		await expect(besuch.getByRole('link', { name: 'Die Kartoffel' })).toHaveCount(0);
		await expect(besuch.getByRole('button', { name: 'Teilen' })).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(einzeln).toBeHidden();

		await page.goto('/');
		await objektMenue(page, 'Die Kartoffel');
		await druecke(page.getByRole('menuitem', { name: 'Teilen' }));
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
		await expect(blatt).toHaveAttribute('src', `/ansicht/${id}/dokumente/${dokumente[0]}/?profil=sw`);

		const loesung = page.getByRole('button', { name: 'Lösung', exact: true });
		await druecke(loesung);
		await expect(loesung).toHaveAttribute('aria-pressed', 'true');
		await expect(page).toHaveURL(/\?fassung=loesung$/);
		await expect(blatt).toHaveAttribute('src', /\?loesung=1&profil=sw$/);
		const druckTab = page.context().waitForEvent('page');
		await oeffneMehr(druecke, page);
		await druecke(page.getByRole('menuitem', { name: 'Drucken' }));
		const gedruckt = await druckTab;
		expect(gedruckt.url()).toMatch(/fassung=loesung&profil=sw/);
		await gedruckt.close();

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

	test('ohne Knopf „Claude“, ⌘J tut dort nichts (136)', async ({ hasTouch, page }) => {
		const { dokumente, id } = await herbst();
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await blattGeladen(page);
		await expect(page.getByRole('button', { name: 'Claude', exact: true })).toHaveCount(0);
		if (!hasTouch) {
			await page.keyboard.press('ControlOrMeta+j');
			await expect(page.locator('#ki-auftrag')).toHaveCount(0);
			await expect(page.getByRole('dialog')).toHaveCount(0);
		}
	});

	test('lädt PDFs mit lesbarem Namen herunter', async ({ druecke, page }) => {
		const { dokumente, id } = await herbst();
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await druecke(page.getByRole('button', { name: 'PDF', exact: true }));
		const menue = page.getByRole('menu');
		await expect(menue.getByRole('menuitem')).toHaveText([
			'Arbeitsblatt',
			'Lösung',
			'Arbeitsblatt und Lösung',
			'Arbeitsblatt (in Farbe)',
			'Lösung (in Farbe)',
			'Arbeitsblatt und Lösung (in Farbe)',
		]);
		const download = page.waitForEvent('download');
		await druecke(menue.getByRole('menuitem', { name: 'Lösung', exact: true }));
		await expect(page.getByRole('button', { name: 'PDF wird erstellt …' })).toBeVisible();
		expect(await dateiname(download)).toBe('Kl2 Sachunterricht Blätter sammeln – Lösung (schwarz-weiß).pdf');

		await page.goto('/');
		await waehleObjekt(page, 'Bäume im Herbst');
		await druecke(page.locator('[data-werkzeugleiste]').getByRole('button', { name: 'PDF' }));
		const alles = page.waitForEvent('download');
		await druecke(page.getByRole('menuitem', { name: 'Ohne Lösungen, in Farbe' }));
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
		await context.route(/\/pdf\/.*[?&]anzeigen=1$/, (route) =>
			route.fulfill({ contentType: 'text/html', body: '<p>Hier ist das PDF</p>' }),
		);
		await page.goto(`/m/${id}/${dokumente[0]}`);
		const tab = context.waitForEvent('page');
		await oeffneMehr(druecke, page);
		await druecke(page.getByRole('menuitem', { name: 'Drucken' }));
		const druck = await tab;
		await expect(druck.getByText('Hier ist das PDF')).toBeVisible();
		expect(decodeURIComponent(druck.url())).toMatch(
			/\/pdf\/arbeitsblatt\/Kl2 Sachunterricht Blätter sammeln – Arbeitsblatt \(schwarz-weiß\)\.pdf\?profil=sw&anzeigen=1$/,
		);

		await page.goto(`/m/${id}/${dokumente[1]}`);
		const zweiter = context.waitForEvent('page');
		await oeffneMehr(druecke, page);
		await druecke(page.getByRole('menuitem', { name: 'Drucken' }));
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
		await oeffneMehr(druecke, besuch);
		await expect(besuch.getByRole('menuitem', { name: 'Drucken' })).toBeVisible();
		await expect(besuch.getByRole('menuitem', { name: 'Teilen' })).toHaveCount(0);
		await besuch.keyboard.press('Escape');
		const download = besuch.waitForEvent('download');
		await druecke(besuch.getByRole('button', { name: 'PDF', exact: true }));
		await druecke(besuch.getByRole('menuitem', { name: 'Arbeitsblatt (in Farbe)' }));
		expect(await dateiname(download)).toBe('Kl2 Sachunterricht Kastanien zählen – Arbeitsblatt.pdf');
		await druecke(besuch.getByRole('link', { name: 'Bäume im Herbst' }));
		await expect(besuch).toHaveURL(new RegExp(`/f/${token}$`));
		await fremd.close();
	});
});

test.describe('Entwürfe', () => {
	test('drei Entwürfe nebeneinander bzw. zum Wischen, ohne Auswahlknopf; was nicht passt, ist markiert', async ({
		page,
	}) => {
		const { dok, id } = await uhrzeitMitEntwuerfen();
		await page.goto(`/m/${id}`);
		const kachel = page.locator(`[data-objekt="${id}/${dok}"]`);
		await expect(kachel.locator('[data-entwurf-minis] img')).toHaveCount(3);
		await expect(page.locator('[data-werkzeugleiste]').getByRole('button', { name: 'PDF' })).toHaveCount(0);
		await oeffneObjekt(page, 'Uhrzeit ablesen');
		await expect(page).toHaveURL(new RegExp(`/m/${id}/${dok}/entwuerfe$`));

		await expect(page.getByText('Schreib Claude, welcher Entwurf es werden soll')).toBeVisible();
		await expect(page.getByRole('button', { name: /wähl/i })).toHaveCount(0);
		const entwuerfe = page.locator('[data-entwurf]');
		await expect(entwuerfe).toHaveCount(3);
		await expect(entwuerfe.nth(0)).toContainText('Uhren lesen');
		await expect(entwuerfe.nth(0)).toContainText('nur Aufgaben');
		await expect(entwuerfe.nth(0).locator('[data-status="passt"]')).toBeVisible();
		await expect(entwuerfe.nth(1).locator('[data-status="passt-nicht"]')).toHaveText(
			'Passt nicht ganz auf die Seite',
		);
		for (const nr of [0, 1, 2]) {
			await expect(entwuerfe.nth(nr).locator('img')).toHaveJSProperty('complete', true);
		}

		const { height, width } = page.viewportSize() ?? { height: 0, width: 0 };
		const kaesten = await Promise.all([0, 1, 2].map((nr) => entwuerfe.nth(nr).boundingBox()));
		if (width >= 1024) {
			// Mac und iPad quer: alle drei ganz im Bild, gleich groß, nebeneinander
			for (const kasten of kaesten) {
				expect(kasten).not.toBeNull();
				expect((kasten?.y ?? 0) + (kasten?.height ?? 0)).toBeLessThanOrEqual(height);
				expect((kasten?.x ?? 0) + (kasten?.width ?? 0)).toBeLessThanOrEqual(width);
				expect(kasten?.width).toBeCloseTo(kaesten[0]?.width ?? 0, 0);
				expect(kasten?.y).toBeCloseTo(kaesten[0]?.y ?? 0, 0);
			}
		} else {
			// iPad hoch: A ist zu sehen, C liegt rechts daneben und kommt durch Wischen ins Bild
			expect(kaesten[0]?.x ?? -1).toBeGreaterThanOrEqual(0);
			expect(kaesten[2]?.x ?? 0).toBeGreaterThan(width);
			await page.locator('[data-entwuerfe]').evaluate((liste) => liste.scrollBy({ left: liste.scrollWidth }));
			await expect(entwuerfe.nth(2)).toBeInViewport({ ratio: 0.9 });
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		expect(await zuKleinAuf(page)).toEqual([]);
	});

	test('öffnet einen Entwurf groß und blättert zum nächsten', async ({ druecke, page }) => {
		const { dok, id } = await uhrzeitMitEntwuerfen();
		await page.goto(`/m/${id}/${dok}/entwuerfe`);
		await druecke(page.locator('[data-entwurf="B"] a'));
		await expect(page).toHaveURL(new RegExp('/entwuerfe/B$'));
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entwurf B: Willis Tag');
		await blattGeladen(page);
		const blatt = page.locator('[data-blattansicht] iframe').last();
		await expect(blatt).toHaveAttribute('src', `/ansicht/${id}/dokumente/${dok}/?entwurf=B`);
		await expect(page.frameLocator('[data-blattansicht] iframe').last().getByText('Inhalt B')).toBeVisible();
		await expect(page.locator('[data-meldungen]')).toContainText('ragt über das Blatt hinaus');

		await druecke(page.getByRole('link', { name: 'Entwurf C' }));
		await expect(page).toHaveURL(new RegExp('/entwuerfe/C$'));
		await expect(page.locator('[data-meldungen]')).toHaveCount(0);
		await expect(page.frameLocator('[data-blattansicht] iframe').last().getByText('Inhalt C')).toBeVisible();
		await druecke(page.getByRole('link', { name: 'Alle Entwürfe' }));
		await expect(page).toHaveURL(new RegExp(`/m/${id}/${dok}/entwuerfe$`));
	});

	test('nach „schoolbox waehle … B“ zeigt die Dokumentseite B, die Entwürfe bleiben erreichbar', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeitMitEntwuerfen();
		await page.goto(`/m/${id}/${dok}`);
		await expect(page.locator('[data-entwuerfe-offen]')).toBeVisible();

		await waehle(id, dok, 'B');
		await expect(page.locator('[data-entwuerfe-offen]')).toHaveCount(0);
		await expect(page.frameLocator('[data-blattansicht] iframe').last().getByText('Inhalt B')).toBeVisible();

		await oeffneMehr(druecke, page);
		await druecke(page.getByRole('menuitem', { name: 'Entwürfe', exact: true }));
		await expect(page).toHaveURL(new RegExp(`/m/${id}/${dok}/entwuerfe$`));
		await expect(page.getByText('Entwurf B ist gewählt.')).toBeVisible();
		await expect(page.locator('[data-entwurf="B"]')).toContainText('Gewählt');
		await expect(page.locator('[data-entwurf]')).toHaveCount(3);

		await page.goto(`/m/${id}`);
		const kachel = page.locator(`[data-objekt="${id}/${dok}"]`);
		await expect(kachel).toBeVisible();
		await expect(kachel.locator('[data-entwurf-minis]')).toHaveCount(0);
	});
});

test.describe('Bedienung', () => {
	test('alles Bedienbare ist groß genug für den Finger', async ({ druecke, page }) => {
		const { id } = await dreiMappen();
		const zuKlein = () => zuKleinAuf(page);

		await page.goto('/');
		await expect(page.locator('[data-objekt]')).toHaveCount(3);
		expect(await zuKlein()).toEqual([]);
		await page.goto(`/m/${id}`);
		await expect(page.locator('[data-objekt]')).toHaveCount(2);
		expect(await zuKlein()).toEqual([]);
		await objektMenue(page, 'Teile der Kartoffel');
		await druecke(page.getByRole('menuitem', { name: 'Teilen' }));
		await druecke(page.getByRole('button', { name: 'Link erstellen', exact: true }));
		await expect(page.getByRole('textbox', { name: 'Link zum Teilen' })).toBeVisible();
		expect(await zuKlein()).toEqual([]);
		await page.keyboard.press('Escape');

		const { dokumente, id: herbstId } = await herbst();
		await page.goto(`/m/${herbstId}/${dokumente[0]}`);
		await blattGeladen(page);
		expect(await zuKlein()).toEqual([]);
		await druecke(page.getByRole('button', { name: 'PDF', exact: true }));
		await expect(page.getByRole('menu')).toBeVisible();
		expect(await zuKlein()).toEqual([]);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await page.goto(`/m/${herbstId}/${dokumente[1]}`);
		await druecke(page.getByRole('button', { name: 'PDF', exact: true }));
		await druecke(page.getByRole('menuitem', { name: 'Arbeitsblatt', exact: true }));
		await expect(page.getByRole('dialog')).toBeVisible();
		expect(await zuKlein()).toEqual([]);
		// Nichts ragt seitlich über den Bildschirm hinaus
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});

	test('abmelden führt zur Anmeldung, anmelden zurück zur gewünschten Seite', async ({ druecke, page }) => {
		const { id } = await dreiMappen();
		await page.goto('/');
		await oeffneMehr(druecke, page, 'Konto');
		await druecke(page.getByRole('menuitem', { name: 'Abmelden' }));
		await expect(page).toHaveURL(/\/anmelden$/);
		await page.goto(`/m/${id}`);
		await expect(page).toHaveURL(/\/anmelden\?weiter=/);
		await page.getByLabel('Passwort').fill(PASSWORT);
		await druecke(page.getByRole('button', { name: 'Anmelden' }));
		await expect(page.getByRole('heading', { level: 1, name: 'Die Kartoffel' })).toBeVisible();
	});
});

test.describe('Bedienoptik (063)', () => {
	test('Bedienung in Inter und dicht am Mac, 44 px mit Finger; das Material behält seine Schrift', async ({
		page,
	}) => {
		const { dokumente, id } = await legeMappeAn('Optik', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await blattGeladen(page);
		expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Inter Variable');
		const knopf = page.getByRole('button', { name: 'PDF', exact: true });
		const finger = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
		expect((await knopf.boundingBox())?.height).toBe(finger ? 44 : 26);
		const rahmen = await knopf.evaluate((e) => getComputedStyle(e).borderTopWidth);
		expect(['0px', '1px']).toContain(rahmen);

		await page.goto(`/m/${id}/${dokumente[0]}/bearbeiten`);
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		const blatt = page.frameLocator('[data-editor-rahmen="sichtbar"]').locator('.seite').first();
		expect(await blatt.evaluate((s) => getComputedStyle(s).fontFamily)).toContain('Andika');
	});
});

test.describe('Menü (064)', () => {
	test('PDF-Menü geht per Tastatur, der Fokus kommt zurück', async ({ page }) => {
		const { dokumente, id } = await legeMappeAn('Menü', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt', loesung: true },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await blattGeladen(page);
		const knopf = page.getByRole('button', { name: 'PDF', exact: true });
		await knopf.focus();
		await page.keyboard.press('Enter');
		const menue = page.getByRole('menu');
		await expect(menue).toBeVisible();
		const eintraege = menue.getByRole('menuitem');
		await expect(eintraege.first()).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(eintraege.nth(1)).toBeFocused();
		await page.keyboard.press('Home');
		await expect(eintraege.first()).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(menue).toBeHidden();
		await expect(knopf).toBeFocused();
	});

	test('ein Klick ins Blatt schließt ein offenes Menü', async ({ druecke, page }) => {
		const { dokumente, id } = await legeMappeAn('Menü', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}/bearbeiten`);
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await druecke(page.getByRole('button', { name: 'PDF', exact: true }));
		await expect(page.getByRole('menu')).toBeVisible();
		await page
			.frameLocator('[data-editor-rahmen="sichtbar"]')
			.locator('.seite')
			.first()
			.click({
				position: { x: 5, y: 5 },
			});
		await expect(page.getByRole('menu')).toBeHidden();
	});

	test('mit dem Finger sind Menüeinträge mindestens 44 px hoch', async ({ druecke, page }) => {
		const { dokumente, id } = await legeMappeAn('Menü', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt', loesung: true },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await blattGeladen(page);
		await druecke(page.getByRole('button', { name: 'PDF', exact: true }));
		const finger = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
		const hoehe = (await page.getByRole('menuitem').first().boundingBox())?.height ?? 0;
		expect(hoehe).toBeGreaterThanOrEqual(finger ? 44 : 20);
	});
});

test.describe('Dialoge (065)', () => {
	test('„Material anlegen“ öffnet den Assistenten, Schließen gibt den Fokus zurück', async ({ druecke, page }) => {
		await page.goto('/');
		const ausloeser = page.locator('[data-werkzeugleiste] [data-material-anlegen]');
		await druecke(ausloeser);
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('Neues Material');
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(ausloeser).toBeFocused();
	});
});

test.describe('Editor-Rahmen (066)', () => {
	const blattOben = (page: Page) =>
		page.evaluate(() => {
			const rahmen = document.querySelector<HTMLIFrameElement>('[data-editor-rahmen="sichtbar"]');
			const seite = rahmen?.contentDocument?.querySelector('.seite');
			if (!rahmen || !seite) {
				return null;
			}
			const r = rahmen.getBoundingClientRect();
			const skala = r.width / rahmen.offsetWidth;
			const s = seite.getBoundingClientRect();
			const unten = document.querySelector('[data-statusleiste]')?.getBoundingClientRect().top ?? 0;
			return { oben: r.top + s.top * skala, unten: r.top + s.bottom * skala, grenze: unten };
		});

	const oeffneBlatt = async (page: Page) => {
		const { dokumente, id } = await legeMappeAn('Rahmen', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}/bearbeiten`);
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
	};

	test('Kopf höchstens 40 px, einzeilig, Blatt ab 52 px, bei 100 % mindestens 69 % sichtbar', async ({ page }) => {
		test.skip(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches), 'nur mit Maus');
		await page.setViewportSize({ width: 1512, height: 860 });
		await oeffneBlatt(page);
		expect((await page.locator('[data-kopf]').boundingBox())?.height).toBeLessThanOrEqual(40);
		const mass = await blattOben(page);
		expect(mass?.oben ?? 999).toBeLessThanOrEqual(52);
		const sichtbar = ((mass?.grenze ?? 0) - (mass?.oben ?? 0)) / ((mass?.unten ?? 1) - (mass?.oben ?? 0));
		expect(sichtbar).toBeGreaterThanOrEqual(0.69);
		await expect(page.locator('[data-kopf]').getByRole('button', { name: /PDF/ })).toBeVisible();
	});

	for (const [breite, hoehe] of [
		[1440, 790],
		[1728, 1000],
	] as const) {
		test(`kein Überlauf im Kopf bei ${breite}×${hoehe}`, async ({ page }) => {
			test.skip(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches), 'nur mit Maus');
			await page.setViewportSize({ width: breite, height: hoehe });
			await oeffneBlatt(page);
			const kopf = page.locator('[data-kopf]');
			expect(await kopf.evaluate((k) => k.scrollWidth <= k.clientWidth)).toBe(true);
			expect((await kopf.boundingBox())?.height).toBeLessThanOrEqual(40);
		});
	}

	test('Einpassen zeigt die ganze Seite, die Stufen gehen von dort weiter, Überlagerung sitzt', async ({
		druecke,
		page,
	}) => {
		await page.setViewportSize({ width: 1440, height: 790 });
		await oeffneBlatt(page);
		await druecke(page.getByRole('button', { name: 'Einpassen' }));
		await expect
			.poll(async () => {
				const m = await blattOben(page);
				return m !== null && m.unten <= m.grenze + 1 && m.oben >= 40;
			})
			.toBe(true);
		const wert = page.locator('[data-zoom-wert]');
		const eingepasst = parseInt((await wert.textContent()) ?? '0', 10);
		expect(eingepasst).toBeLessThan(100);
		await expect(page.getByRole('button', { name: 'Kleiner' })).toBeEnabled();
		await druecke(page.getByRole('button', { name: 'Größer' }));
		await expect.poll(async () => parseInt((await wert.textContent()) ?? '0', 10)).toBeGreaterThan(eingepasst);

		await druecke(page.getByRole('button', { name: 'Einpassen' }));
		const aufgabe = page.frameLocator('[data-editor-rahmen="sichtbar"]').locator('.aufgabe').first();
		await aufgabe.click({ position: { x: 10, y: 10 } });
		const rahmen = await page.locator('[data-auswahlrahmen]').boundingBox();
		const ziel = await aufgabe.boundingBox();
		expect(Math.abs((rahmen?.y ?? 0) - (ziel?.y ?? 99))).toBeLessThanOrEqual(6);
		expect(Math.abs((rahmen?.x ?? 0) - (ziel?.x ?? 99))).toBeLessThanOrEqual(6);
	});

	test('Einpassen wird je Gerät gemerkt', async ({ druecke, page }) => {
		await oeffneBlatt(page);
		await druecke(page.getByRole('button', { name: 'Einpassen' }));
		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Einpassen' })).toHaveAttribute('aria-pressed', 'true');
	});

	test('nur PDF ist Hauptaktion, Zustände sind Segmente', async ({ page }) => {
		await oeffneBlatt(page);
		const gruppe = page.locator('[data-profilschalter]').getByRole('button', { name: 'Farbe' });
		await expect(gruppe).toHaveAttribute('aria-pressed', /true|false/);
		const haupt = await page
			.locator('[data-kopf] button')
			.evaluateAll((knoepfe) =>
				knoepfe.filter((k) => getComputedStyle(k).color === 'rgb(255, 255, 255)').map((k) => k.textContent),
			);
		expect(haupt).toEqual(['PDF']);
	});

	test('beide Leisten lassen sich schließen und öffnen', async ({ druecke, page }) => {
		await oeffneBlatt(page);
		await expect(page.locator('[data-panel-links]')).toBeVisible();
		await druecke(page.getByRole('button', { name: 'Linke Leiste' }));
		await expect(page.locator('[data-panel-links]')).toHaveCount(0);
		await druecke(page.getByRole('button', { name: 'Rechte Leiste' }));
		await expect(page.locator('[data-panel]')).toHaveCount(0);
		await druecke(page.getByRole('button', { name: 'Linke Leiste' }));
		await druecke(page.getByRole('button', { name: 'Rechte Leiste' }));
		await expect(page.locator('[data-panel-links]')).toBeVisible();
		await expect(page.locator('[data-panel="inspektor"]')).toBeVisible();
	});
});

test.describe('Linke Leiste (067)', () => {
	const oeffneBausteine = async (page: Page) => {
		const { dokumente, id } = await legeMappeAn('Leiste', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}/bearbeiten`);
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await oeffneSchublade(page, 'bausteine');
		await expect(page.locator('[data-bereich]').first()).toBeVisible();
	};

	test('Startansicht ohne Scrollen, jeder Katalogeintrag liegt in genau einem Bereich', async ({ page }) => {
		test.skip(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches), 'nur mit Maus');
		await page.setViewportSize({ width: 1512, height: 860 });
		await oeffneBausteine(page);
		const panel = page.locator('[data-panel-links] > div').last();
		expect(await panel.evaluate((p) => p.scrollHeight <= p.clientHeight)).toBe(true);

		await page.getByRole('button', { name: 'Alle', exact: true }).click();
		expect(await panel.evaluate((p) => p.scrollHeight <= p.clientHeight)).toBe(true);
		const anzahlen = await page.locator('[data-bereich-anzahl]').allTextContents();
		const summe = anzahlen.reduce((s, a) => s + Number(a), 0);
		const { eintraege } = (await (await page.request.get('/api/katalog')).json()) as { eintraege: unknown[] };
		expect(summe).toBe(eintraege.length);
		await expect(page.locator('[data-panel="inspektor"]')).toBeVisible();
	});

	test('Bereich auf und zurück; „Zuletzt benutzt“ erscheint erst nach dem Einfügen', async ({ page }) => {
		await oeffneBausteine(page);
		await expect(page.locator('[data-zuletzt-benutzt]')).toHaveCount(0);
		await page.locator('[data-bereich="Aufgabe und Text"]').click();
		await expect(page.locator('[data-bereich]')).toHaveCount(0);
		await page.locator('[data-einfuegen="aufgabe"]').click();
		await page.getByRole('button', { name: 'Aufgabe und Text' }).click();
		await expect(page.locator('[data-zuletzt="aufgabe"]')).toBeVisible();
	});

	test('„+ Seite ▾“ legt beide Seitenarten an und merkt sich die Wahl', async ({ druecke, page }) => {
		const { dokumente, id } = await legeMappeAn('Leiste', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}/bearbeiten`);
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		const blatt = page.frameLocator('[data-editor-rahmen="sichtbar"]');
		const namen = () => blatt.locator('.seite .namenszeile');
		const vorher = await namen().count();
		const seitenZeilen = page.locator('[data-seite-zeile]');
		await expect(seitenZeilen).toHaveCount(1);

		await druecke(page.getByRole('button', { name: 'Art der neuen Seite' }));
		await druecke(page.getByRole('menuitem', { name: 'Leere Seite' }));
		await expect(seitenZeilen).toHaveCount(2);
		expect(await namen().count()).toBe(vorher);

		await druecke(page.getByRole('button', { name: 'Art der neuen Seite' }));
		await druecke(page.getByRole('menuitem', { name: 'Seite mit Namenszeile' }));
		await expect(seitenZeilen).toHaveCount(3);
		await expect.poll(() => namen().count()).toBeGreaterThan(vorher);

		const mit = await namen().count();
		await druecke(page.getByRole('button', { name: 'Seite hinzufügen' }));
		await expect(seitenZeilen).toHaveCount(4);
		await expect.poll(() => namen().count()).toBeGreaterThan(mit);
	});
});

test.describe('Leisten im Blatt (071)', () => {
	const blatt = (page: Page) => page.frameLocator('[data-editor-rahmen="sichtbar"]');
	const leiste = (page: Page) => page.locator('[data-bausteinleiste]');

	const oeffneBlatt = async (page: Page) => {
		const { dokumente, id } = await legeMappeAn('Leisten', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}/bearbeiten`);
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
	};

	const uberlappt = (a: Box, b: Box) =>
		a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

	test('verdeckt den gewählten Baustein nicht und liegt in der Leinwand, auch eingepasst', async ({
		druecke,
		page,
	}) => {
		await oeffneBlatt(page);
		for (const einpassen of [false, true]) {
			if (einpassen) {
				await druecke(page.getByRole('button', { name: 'Einpassen' }));
			}
			await druecke(blatt(page).locator('.aufgabe').first());
			await expect(leiste(page)).toBeVisible();
			const eigene = await leiste(page).boundingBox();
			const rahmen = await page.locator('[data-auswahlrahmen]').boundingBox();
			const flaeche = await page.locator('main').boundingBox();
			if (!eigene || !rahmen || !flaeche) {
				throw new Error('nicht zu sehen');
			}
			expect(uberlappt(eigene, rahmen)).toBe(false);
			expect(eigene.x).toBeGreaterThanOrEqual(flaeche.x);
			expect(eigene.x + eigene.width).toBeLessThanOrEqual(flaeche.x + flaeche.width);
			expect(eigene.y).toBeGreaterThanOrEqual(flaeche.y);
		}
	});

	test('bleibt beim Scrollen eines hohen Bausteins sichtbar', async ({ hasTouch, page }) => {
		await oeffneBlatt(page);
		await page.setViewportSize({ width: 1280, height: 600 });
		const rand = { position: { x: 6, y: 6 } };
		const seite = blatt(page).locator('.seite').first();
		await (hasTouch ? seite.tap(rand) : seite.click(rand));
		await expect(leiste(page)).toHaveAttribute('data-bausteinleiste', 'seite');
		await page.locator('main').evaluate((el) => el.scrollTo(0, 500));
		const flaeche = await page.locator('main').boundingBox();
		await expect
			.poll(async () => ((await leiste(page).boundingBox())?.y ?? 0) - (flaeche?.y ?? 0))
			.toBeGreaterThanOrEqual(0);
		await expect(leiste(page)).toBeInViewport();
	});

	test('jede Art zeigt ihre Einträge, die Leiste bleibt schmal', async ({ druecke, hasTouch, page }) => {
		await oeffneBlatt(page);
		const pruefe = async (ziel: Locator, art: string, namen: string[]) => {
			await druecke(ziel);
			await expect(leiste(page)).toHaveAttribute('data-bausteinleiste', art);
			for (const name of namen) {
				await expect(leiste(page).getByRole('button', { name })).toBeVisible();
			}
			expect((await leiste(page).boundingBox())?.width ?? 999).toBeLessThanOrEqual(640);
		};
		await pruefe(blatt(page).locator('x-uhr').first(), 'abbildung', ['Mehr zu diesem Baustein', 'Duplizieren']);
		if (hasTouch) {
			// Am iPad passt das Feld nicht mehr in die Leiste; es bleibt im Inspektor (071).
			await expect(page.locator('[data-panel]').getByRole('combobox', { name: 'Stunde' })).toBeVisible();
			return;
		}
		await expect(leiste(page).getByRole('combobox', { name: 'Stunde' })).toBeVisible();
		// Esc führt bis zur Aufgabe hoch: Die Leiste eines Eintrags stünde sonst über der Anweisung.
		for (let i = 0; i < 4; i++) {
			if ((await leiste(page).getAttribute('data-bausteinleiste')) === 'aufgabe') {
				break;
			}
			await page.keyboard.press('Escape');
		}
		await expect(leiste(page)).toHaveAttribute('data-bausteinleiste', 'aufgabe');
		await pruefe(blatt(page).locator('.anw .text').first(), 'anweisung', ['Unterstrichen', 'Hervorheben']);
		await expect(leiste(page).getByRole('button', { name: 'Fertig' })).toHaveCount(0);
	});

	test('Änderung in der Leiste steht auch im Inspektor und umgekehrt', async ({ druecke, hasTouch, page }) => {
		test.skip(hasTouch, 'Am iPad steht das Feld nur im Inspektor (071).');
		await oeffneBlatt(page);
		await druecke(blatt(page).locator('x-uhr').first());
		const stunde = leiste(page).getByRole('combobox', { name: 'Stunde' });
		const imInspektor = page.locator('[data-panel]').getByRole('combobox', { name: 'Stunde' });
		await stunde.selectOption('7');
		await expect(imInspektor).toHaveValue('7');
		await imInspektor.selectOption('11');
		await expect(stunde).toHaveValue('11');
	});

	test('Schnellauswahl am unteren Rand ist ganz sichtbar', async ({ druecke, page }) => {
		await oeffneBlatt(page);
		await page.setViewportSize({ width: 1280, height: 600 });
		const letzte = blatt(page).locator('.aufgabe').last();
		await letzte.scrollIntoViewIfNeeded();
		await druecke(letzte);
		// Der Treffer kann ein Text oder ein Eintrag sein: Esc führt hoch bis zur Aufgabe, dort gibt es „+ Baustein“.
		const plus = page.locator('[data-einfuegen-plus]');
		for (let i = 0; i < 4 && (await plus.count()) === 0; i++) {
			await page.keyboard.press('Escape');
		}
		await druecke(plus);
		const fenster = page.locator('[data-schnellauswahl]');
		await expect(fenster).toBeInViewport({ ratio: 1 });
		await page.keyboard.press('Escape');
		await expect(fenster).toHaveCount(0);
	});

	test('Am iPad: Antippen zeigt die Leiste, ⋯ ist erreichbar, Ziele mindestens 44 px', async ({ hasTouch, page }) => {
		test.skip(!hasTouch, 'nur mit Finger');
		await oeffneBlatt(page);
		await blatt(page).locator('.aufgabe').first().tap();
		await expect(leiste(page)).toBeVisible();
		for (const knopf of await leiste(page).locator('button:visible').all()) {
			if ((await knopf.getAttribute('data-leiste-griff')) === null) {
				expect((await knopf.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
			}
		}
		await leiste(page).getByRole('button', { name: 'Mehr zu diesem Baustein' }).tap();
		await expect(page.getByRole('menu')).toBeVisible();
	});
});

test.describe('Inspektor (072)', () => {
	const blatt = (page: Page) => page.frameLocator('[data-editor-rahmen="sichtbar"]');
	const REIHENFOLGE = [
		'hinweise',
		'lesehilfen',
		'uebung',
		'inhalt',
		'darstellung',
		'loesung',
		'bewertung',
		'sichtbarkeit',
		'eltern',
		'weitere',
	];

	const oeffneBlatt = async (page: Page) => {
		const { dokumente, id } = await legeMappeAn('Inspektor', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}/bearbeiten`);
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
	};

	test('Abschnitte in fester Reihenfolge, Aufgabe und Uhr ohne Scrollen, wenig Hilfetext', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		await page.setViewportSize({ width: 1512, height: 860 });
		await oeffneBlatt(page);
		for (const ziel of [blatt(page).locator('.aufgabe').first(), blatt(page).locator('x-uhr').first()]) {
			await druecke(ziel);
			const namen = await page
				.locator('[data-panel] [data-abschnitt]:visible')
				.evaluateAll((liste) => liste.map((e) => (e as HTMLElement).dataset.abschnitt ?? ''));
			const stellen = namen.map((n) => REIHENFOLGE.indexOf(n));
			expect(stellen).toEqual([...stellen].sort((a, b) => a - b));
			expect(stellen).not.toContain(-1);
			if (!hasTouch) {
				const { innen, sichtbar } = await page
					.locator('[data-panel] > div')
					.first()
					.evaluate((e) => ({ innen: e.scrollHeight, sichtbar: e.clientHeight }));
				expect(innen).toBeLessThanOrEqual(sichtbar);
			}
			const worte = await page
				.locator('[data-panel] [data-auswahl] p:visible:not([data-hinweis])')
				.evaluateAll(
					(liste) => liste.flatMap((e) => (e.textContent ?? '').split(/\s+/).filter(Boolean)).length,
				);
			expect(worte).toBeLessThanOrEqual(10);
		}
	});

	test('Überfahren einer Stufe rahmt genau diese Ebene, auch eingepasst; Klick wählt sie', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		test.skip(hasTouch, 'Überfahren gibt es nur mit Maus');
		await oeffneBlatt(page);
		for (const einpassen of [false, true]) {
			if (einpassen) {
				await druecke(page.getByRole('button', { name: 'Einpassen' }));
			}
			await druecke(blatt(page).locator('x-uhr').first());
			const stufe = page.locator('[data-breadcrumb]').getByRole('button', { name: 'Aufgabe 1' });
			await stufe.hover();
			const umriss = await page.locator('[data-umriss]').boundingBox();
			const aufgabe = await blatt(page).locator('.aufgabe').first().boundingBox();
			expect(Math.abs((umriss?.x ?? 0) - (aufgabe?.x ?? 99))).toBeLessThanOrEqual(6);
			expect(Math.abs((umriss?.y ?? 0) - (aufgabe?.y ?? 99))).toBeLessThanOrEqual(6);
			expect(Math.abs((umriss?.width ?? 0) - (aufgabe?.width ?? 99))).toBeLessThanOrEqual(10);
			await stufe.click();
			await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
			await expect(page.locator('[data-umriss]')).toHaveCount(0);
		}
	});

	test('Reiter: ohne Auswahl nur Blatt, mit Auswahl frei wählbar, ohne die Auswahl zu verlieren', async ({
		druecke,
		page,
	}) => {
		await oeffneBlatt(page);
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Auswahl' })).toBeDisabled();
		await druecke(blatt(page).locator('.aufgabe').first());
		await expect(page.locator('[data-inspektor="auswahl"]')).toBeVisible();
		await druecke(page.getByRole('tab', { name: 'Blatt' }));
		await expect(page.locator('[data-inspektor="blatt"]')).toBeVisible();
		await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();
		await druecke(blatt(page).locator('x-uhr').first());
		await expect(page.locator('[data-inspektor="auswahl"]')).toBeVisible();
	});

	test('Farbschema zeigt zwei Farben mit Namen; die Klassen im Material bleiben', async ({ druecke, page }) => {
		await oeffneBlatt(page);
		const knoepfe = page.locator('[data-palette]').getByRole('button');
		await expect(knoepfe).toHaveCount(4);
		await expect(knoepfe.first()).toHaveAttribute('title', 'Orange und Türkis');
		await expect(knoepfe.first().locator('span')).toHaveAttribute('style', /linear-gradient/);
		await druecke(knoepfe.nth(2));
		await expect(blatt(page).locator('body')).toHaveClass(/palette-wiese/);
		await expect(page.getByText('Niveau-Punkte')).toHaveCount(0);
	});
});

test.describe('Ordner und Dokumentansicht (075)', () => {
	const neunDokumente = () =>
		legeMappeAn(
			'Neun Blätter',
			'mathematik',
			3,
			Array.from({ length: 9 }, (_, i) => ({ titel: `Blatt ${i + 1}`, vorlage: 'arbeitsblatt' })),
		);

	test('neun Dokumente kommen ohne Knöpfe auf den Kacheln aus', async ({ hasTouch, page }) => {
		const { id } = await neunDokumente();
		await page.goto(`/m/${id}`);
		const kacheln = page.locator('[data-objekt]');
		await expect(kacheln).toHaveCount(9);
		for (const kachel of await kacheln.all()) {
			// Am Mac gar keine, am iPad nur das ⋯
			expect(await kachel.locator('button:visible, a[href]:visible').count()).toBeLessThanOrEqual(
				hasTouch ? 1 : 0,
			);
		}
	});

	test('Rechtsklick auf die Kachel zeigt dieselbe Liste wie das ⋯ der Leiste', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		test.skip(hasTouch, 'Rechtsklick gibt es nur mit Maus');
		const { id } = await neunDokumente();
		await page.goto(`/m/${id}`);
		const kachel = page.locator('[data-objekt]').first();
		await kachel.click();
		await oeffneMehr(druecke, page.locator('[data-werkzeugleiste]'));
		const namen = await page.getByRole('menuitem').allInnerTexts();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toHaveCount(0);
		expect(namen.join()).toContain('Variante anlegen');
		expect(namen.join()).not.toContain('Als Vorlage');
		await kachel.click({ button: 'right' });
		await expect(page.getByRole('menuitem')).toHaveCount(namen.length);
		expect(await page.getByRole('menuitem').allInnerTexts()).toEqual(namen);
		await page.keyboard.press('Escape');
	});

	test('das ⋯ der Kachel ist auch mit dem Finger groß genug', async ({ page }, info) => {
		test.skip(!info.project.name.startsWith('ipad'), 'nur mit Finger');
		const { id } = await neunDokumente();
		await page.goto(`/m/${id}`);
		const box = await page.locator('[data-objekt]').first().locator('[data-finger-menue]').boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(box?.width).toBeGreaterThanOrEqual(44);
	});

	test('das Blatt beginnt oben im Fenster, der Ordner bleibt erreichbar', async ({ druecke, page }, info) => {
		test.skip(info.project.name !== 'mac-safari', 'Maß gilt für den Mac');
		await page.setViewportSize({ width: 1512, height: 860 });
		const { dokumente, id } = await legeMappeAn('Maß', 'mathematik', 2, [
			{ titel: 'Blatt', vorlage: 'arbeitsblatt' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await blattGeladen(page);
		const oben = await page.locator('[data-blattansicht] iframe').last().boundingBox();
		expect(oben?.y).toBeLessThanOrEqual(64);
		await druecke(page.getByRole('link', { name: 'Maß' }));
		await expect(page).toHaveURL(/\/o\//);
		await expect(page.locator('header')).toBeVisible();
		const kopf = await page.locator('header').boundingBox();
		expect(kopf?.height).toBeLessThanOrEqual(41);
	});
});
