import type { Page } from '@playwright/test';

import { aendere, imMehr, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

/**
 * 103: Bilder frei. Ziehen aus der Schublade „Bilder“ legt frei ab (höchstens 320 px), auf ein Bild tauscht es aus, in
 * einen Platzhalter füllt es ihn, mit ⌘ wird es Bild-Baustein; eine Datei aus dem Finder lädt hoch und liegt frei;
 * „Frei legen“ macht aus einem Bild-Baustein ein freies Bild an derselben Stelle.
 */

const WACHSTUM = '_assets/bilder/wachstum.png';
const BAUSTEIN = '<img src="bilder/wachstum.png" alt="Wachstum" style="width:240px">';
const FREI =
	'<img class="bild-frei" data-lage="frei" src="bilder/wachstum.png" alt="Wachstum" style="--x:420px;--y:700px;--b:200px;--drehen:-4deg">';
const PLATZHALTER = '<div class="platzhalter" style="--h:120px;width:220px">Bild: Blume</div>';

const bilder = (page: Page) => page.locator('[data-schublade-bilder]');
const kachel = (page: Page, schluessel: string) => bilder(page).locator(`[data-sammlung-bild="${schluessel}"]`);
const anzeige = (page: Page) => page.locator('[data-zug-anzeige]');
const zurueck = (page: Page) => page.getByRole('button', { name: 'Rückgängig (⌘Z)' });
const skala = (page: Page) =>
	page
		.locator('[data-editor-rahmen="sichtbar"]')
		.evaluate((f: HTMLElement) => f.getBoundingClientRect().width / f.offsetWidth);

const oeffneMit = async (page: Page, html: string) => {
	await page.setViewportSize({ width: 1512, height: 860 });
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	await aendere(page, html);
	await expect(material(page).locator('.seite').first()).toBeVisible();
};

const zurGruppe = async (page: Page, titel: string, schluessel: string) => {
	await oeffneSchublade(page, 'bilder');
	await bilder(page).getByRole('button', { name: titel, exact: true }).click();
	await expect(kachel(page, schluessel)).toBeVisible();
	// Die Maße der Vorschau braucht das Gut für die Breite.
	await expect
		.poll(() =>
			kachel(page, schluessel)
				.locator('img')
				.evaluate((i: HTMLImageElement) => i.naturalWidth),
		)
		.toBeGreaterThan(0);
};

const mitteVon = async (page: Page, selektor: string) => {
	const e = material(page).locator(selektor).first();
	await e.evaluate((x) => x.scrollIntoView({ block: 'center' }));
	const r = await e.boundingBox();
	if (!r) {
		throw new Error(`${selektor} nicht zu sehen`);
	}
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

/** Zieht eine Kachel bis `ziel` (Bildschirm) und lässt los; mit `cmd` hält ⌘ dabei. */
const ziehe = async (page: Page, schluessel: string, ziel: { x: number; y: number }, cmd = false) => {
	const r = await kachel(page, schluessel).boundingBox();
	if (!r) {
		throw new Error('Kachel nicht zu sehen');
	}
	await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
	await page.mouse.down();
	await page.mouse.move(r.x + r.width / 2 + 20, r.y + r.height / 2 + 10, { steps: 3 });
	await expect(anzeige(page)).toBeVisible();
	await page.mouse.move(ziel.x, ziel.y, { steps: 10 });
	if (cmd) {
		await page.keyboard.down('Meta');
	}
	return async () => {
		await page.mouse.up();
		if (cmd) {
			await page.keyboard.up('Meta');
		}
	};
};

/** Ein Punkt auf der ersten Seite unterhalb der Aufgaben, in Bildschirm-px. */
const freieStelle = async (page: Page) => {
	await material(page)
		.locator('.seite')
		.first()
		.evaluate((s) => s.scrollIntoView({ block: 'end' }));
	const r = await material(page).locator('.seite').first().boundingBox();
	const sicht = await page.locator('main').boundingBox();
	if (!r || !sicht) {
		throw new Error('Seite nicht zu sehen');
	}
	return { x: r.x + r.width * 0.5, y: Math.min(r.y + r.height, sicht.y + sicht.height) - 120 };
};

/** Lässt eine erzeugte PNG-Datei (`breite` × `hoehe`) auf `selektor` bzw. die freie Stelle fallen, wie aus dem Finder. */
const ausDemFinder = async (
	page: Page,
	{
		breite,
		cmd = false,
		hoehe,
		name,
		selektor,
	}: { breite: number; hoehe: number; name: string; selektor?: string; cmd?: boolean },
) => {
	if (selektor) {
		await material(page)
			.locator(selektor)
			.first()
			.evaluate((e) => e.scrollIntoView({ block: 'center' }));
	}
	await material(page)
		.locator('body')
		.evaluate(
			async (body, a) => {
				const doc = body.ownerDocument;
				const leinwand = doc.createElement('canvas');
				leinwand.width = a.breite;
				leinwand.height = a.hoehe;
				const c = leinwand.getContext('2d');
				if (c) {
					c.fillStyle = '#e07a2f';
					c.fillRect(0, 0, a.breite, a.hoehe);
				}
				const blob = await new Promise<Blob | null>((fertig) => leinwand.toBlob(fertig, 'image/png'));
				if (!blob) {
					throw new Error('kein PNG');
				}
				const ziel = a.selektor ? doc.querySelector(a.selektor) : doc.querySelector('.seite');
				const r = ziel?.getBoundingClientRect();
				if (!ziel || !r) {
					throw new Error('kein Ziel');
				}
				const x = r.left + r.width / 2;
				const y = a.selektor
					? r.top + r.height / 2
					: Math.min(r.bottom, doc.documentElement.clientHeight) - 150;
				const daten = new DataTransfer();
				daten.items.add(new File([blob], a.name, { type: 'image/png' }));
				const optionen = {
					bubbles: true,
					cancelable: true,
					clientX: x,
					clientY: y,
					dataTransfer: daten,
					metaKey: a.cmd,
				};
				const unter = doc.elementFromPoint(x, y) ?? doc.body;
				unter.dispatchEvent(new DragEvent('dragover', optionen));
				unter.dispatchEvent(new DragEvent('drop', optionen));
			},
			{ breite, hoehe, name, selektor: selektor ?? null, cmd },
		);
	// Einmal je Sitzung der Hinweis zum Datenschutz.
	const hinweis = page.getByRole('button', { name: 'Verstanden, hochladen' });
	if (await hinweis.isVisible().catch(() => false)) {
		await hinweis.click();
	}
};

test.describe('Bilder frei (103)', () => {
	test('Ziehen aus der Sammlung legt frei ab, höchstens 320 px, gewählt; ⌘Z nimmt es zurück', async ({ page }) => {
		const vorher = blattMit();
		await oeffneMit(page, vorher);
		await zurGruppe(page, 'Sammlung', WACHSTUM);
		const loslassen = await ziehe(page, WACHSTUM, await freieStelle(page));
		await expect(material(page).locator('[data-ablage-vorschau] img.bild-frei')).toBeVisible();
		await loslassen();
		await expect.poll(() => quelle(page)).toMatch(/<img class="bild-frei"[^>]*src="bilder\/wachstum\.png"/);
		const html = await quelle(page);
		expect(html).toMatch(/<div class="ebene vorne">[\s\S]*class="bild-frei"[^>]*--b:320px/);
		expect(html).not.toContain('/ansicht/');
		await expect(page.locator('[data-auswahl="bildfrei"]')).toBeVisible();
		await expect(page.locator('[data-auswahlrahmen]')).toBeVisible();
		const s = await skala(page);
		const r = await material(page).locator('img.bild-frei').boundingBox();
		expect(Math.round((r?.width ?? 0) / s)).toBe(320);
		// Inspektor: Abschnitt „Bild“ ohne Größen-Regler.
		await expect(page.locator('[data-gestaltung-inspektor] [data-bildwerkzeug="bild"]')).toBeVisible();
		await expect(page.locator('[data-bild-groesse]')).toHaveCount(0);
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Ziehen aus „Dieser Ordner“ legt frei ab, kleiner als 320 px bleibt die Breite der Datei', async ({
		page,
	}) => {
		await oeffneMit(page, blattMit());
		await ausDemFinder(page, { breite: 150, hoehe: 100, name: 'kuerbis.png' });
		await expect.poll(() => quelle(page)).toMatch(/class="bild-frei"[^>]*--b:150px/);
		await aendere(page, blattMit());
		await oeffneSchublade(page, 'bilder');
		await bilder(page).getByRole('button', { name: 'Dieser Ordner', exact: true }).click();
		const k = bilder(page).locator('[data-sammlung-bild*="kuerbis"]').first();
		await expect(k).toBeVisible();
		const schluessel = (await k.getAttribute('data-sammlung-bild')) ?? '';
		await expect
			.poll(() =>
				kachel(page, schluessel)
					.locator('img')
					.evaluate((i: HTMLImageElement) => i.naturalWidth),
			)
			.toBe(150);
		const loslassen = await ziehe(page, schluessel, await freieStelle(page));
		await loslassen();
		await expect.poll(() => quelle(page)).toMatch(/class="bild-frei"[^>]*alt="Kuerbis"[^>]*--b:150px/);
	});

	test('Auf ein Bild gezogen tauscht es aus, Lage und Größe bleiben; ⌘Z stellt es wieder her', async ({ page }) => {
		const vorher = blattMit({ vorne: [FREI.replace('wachstum.png', 'wilma.png')] });
		await oeffneMit(page, vorher);
		await zurGruppe(page, 'Sammlung', WACHSTUM);
		const loslassen = await ziehe(page, WACHSTUM, await mitteVon(page, 'img.bild-frei'));
		await expect(anzeige(page)).toHaveText('austauschen');
		await expect(material(page).locator('img.bild-frei[data-ablage-ziel]')).toHaveCount(1);
		await loslassen();
		await expect.poll(() => quelle(page)).toContain('src="bilder/wachstum.png"');
		const html = await quelle(page);
		expect(html).toContain('style="--x:420px;--y:700px;--b:200px;--drehen:-4deg"');
		expect(html.split('class="bild-frei"')).toHaveLength(2);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'austauschen');
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Auf einen Platzhalter gezogen füllt es ihn', async ({ page }) => {
		await oeffneMit(page, blattMit({ stapel: [PLATZHALTER] }));
		await zurGruppe(page, 'Sammlung', WACHSTUM);
		const loslassen = await ziehe(page, WACHSTUM, await mitteVon(page, '.platzhalter'));
		await expect(anzeige(page)).toHaveText('einsetzen');
		await loslassen();
		await expect.poll(() => quelle(page)).not.toContain('class="platzhalter"');
		const html = await quelle(page);
		expect(html).toMatch(/<img src="bilder\/wachstum\.png" alt="Wachstum[^"]*" style="width:\d+px">/);
		expect(html).not.toContain('bild-frei');
	});

	test('Mit ⌘ entsteht ein Bild-Baustein im Stapel, mit Lücke', async ({ page }) => {
		await oeffneMit(page, blattMit());
		await zurGruppe(page, 'Sammlung', WACHSTUM);
		const loslassen = await ziehe(page, WACHSTUM, await mitteVon(page, '.aufgabe:nth-of-type(2)'), true);
		await expect(material(page).locator('[data-luecke]')).toBeVisible();
		await loslassen();
		await expect.poll(() => quelle(page)).toMatch(/<img src="bilder\/wachstum\.png"[^>]*style="width:\d+px">/);
		const html = await quelle(page);
		expect(html).not.toContain('bild-frei');
		expect(html).not.toContain('data-lage');
	});

	test('Eine Datei aus dem Finder lädt hoch und liegt frei; mit ⌘ wird sie Baustein', async ({ page }) => {
		await oeffneMit(page, blattMit());
		await ausDemFinder(page, { breite: 900, hoehe: 600, name: 'kuerbis-ernte.png' });
		await expect
			.poll(() => quelle(page))
			.toMatch(/<img class="bild-frei"[^>]*src="bilder\/[^"]+"[^>]*alt="Kuerbis ernte"/);
		expect(await quelle(page)).toMatch(/class="bild-frei"[^>]*--b:320px/);
		await expect(page.locator('[data-auswahl="bildfrei"]')).toBeVisible();

		await aendere(page, blattMit());
		await ausDemFinder(page, { breite: 300, hoehe: 200, name: 'apfel.png', selektor: '.aufgabe', cmd: true });
		await expect.poll(() => quelle(page)).toMatch(/<img src="bilder\/[^"]+" alt="Apfel" style="width:\d+px">/);
		expect(await quelle(page)).not.toContain('bild-frei');
	});

	test('Eine andere Datei aus dem Finder ändert nichts', async ({ page }) => {
		const vorher = blattMit();
		await oeffneMit(page, vorher);
		await material(page)
			.locator('body')
			.evaluate((body) => {
				const daten = new DataTransfer();
				daten.items.add(new File(['hallo'], 'notiz.txt', { type: 'text/plain' }));
				const s = body.ownerDocument.querySelector('.seite')?.getBoundingClientRect();
				body.dispatchEvent(
					new DragEvent('drop', {
						bubbles: true,
						cancelable: true,
						dataTransfer: daten,
						clientX: s?.left ?? 0,
						clientY: s?.top ?? 0,
					}),
				);
			});
		await page.waitForTimeout(300);
		expect(await quelle(page)).toBe(vorher);
	});

	test('„Frei legen“ macht einen Bild-Baustein frei, an derselben Stelle', async ({ druecke, page }) => {
		await oeffneMit(page, blattMit({ stapel: [BAUSTEIN] }));
		const bild = material(page).locator('img[src="bilder/wachstum.png"]');
		await bild.evaluate((e) => e.scrollIntoView({ block: 'center' }));
		const vorher = await bild.boundingBox();
		await druecke(bild);
		await expect(page.locator('[data-auswahl="bild"]')).toBeVisible();
		await imMehr(page, 'Frei legen');
		await expect.poll(() => quelle(page)).toMatch(/<div class="ebene vorne">\s*<img class="bild-frei"/);
		expect(await quelle(page)).not.toContain(BAUSTEIN);
		const nachher = await material(page).locator('img.bild-frei').boundingBox();
		expect(Math.abs((nachher?.x ?? 0) - (vorher?.x ?? 0))).toBeLessThan(2);
		expect(Math.abs((nachher?.y ?? 0) - (vorher?.y ?? 0))).toBeLessThan(2);
		expect(Math.abs((nachher?.width ?? 0) - (vorher?.width ?? 0))).toBeLessThan(2);
		await expect(page.locator('[data-auswahl="bildfrei"]')).toBeVisible();
	});

	test('Bild-Bausteine behalten den Regler „Größe“', async ({ druecke, page }) => {
		await oeffneMit(page, blattMit({ stapel: [BAUSTEIN] }));
		await druecke(material(page).locator('img[src="bilder/wachstum.png"]'));
		await expect(page.locator('[data-bild-groesse]')).toBeVisible();
	});

	test('bild-unscharf auch bei einem freien Bild: kleines Bild auf 400 px', async ({ druecke, page }) => {
		await oeffneMit(page, blattMit());
		await ausDemFinder(page, { breite: 60, hoehe: 40, name: 'klein.png' });
		await expect.poll(() => quelle(page)).toMatch(/class="bild-frei"[^>]*--b:60px/);
		await aendere(page, (await quelle(page)).replace('--b:60px', '--b:400px'));
		await druecke(page.locator('[data-pruefung] > button'));
		const hinweise = page.locator('[data-pruefliste] [data-hinweise]');
		await druecke(hinweise.locator('summary'));
		await expect(hinweise.locator('[data-pruefpunkt="bild-unscharf"]')).toBeVisible();
	});
});
