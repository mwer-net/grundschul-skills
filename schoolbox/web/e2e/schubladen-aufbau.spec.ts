/**
 * Ein Aufbau für alle Schubladen (167, Entscheidung 54): Kopf mit Namen, darunter fest die Suche, Abschnitte mit fetter
 * Überschrift ohne Nummer und Linie, graue Kacheln mit Namen im Tooltip, nach einer Suche ohne Treffer „Nichts passt
 * zu „…“.“. Am Mac 1512 × 982, am Ende die Stufen am iPad.
 */
import type { Locator, Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import type { SchubladenName } from './schubladen-hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const ALLE: SchubladenName[] = ['ebenen', 'bausteine', 'werkzeuge', 'figuren', 'bilder'];
const MIT_ABSCHNITTEN: SchubladenName[] = ['bausteine', 'werkzeuge', 'figuren', 'bilder'];
const MIT_SUCHE = [
	['bausteine', 'Baustein suchen'],
	['werkzeuge', 'In Werkzeugen suchen'],
	['figuren', 'Figuren suchen'],
	['bilder', 'Bilder suchen'],
] as const;

const SCHWARZ = 'rgb(28, 28, 31)';
const LEISE = 'rgb(91, 91, 102)';
const KACHELGRAU = 'rgb(241, 241, 243)';

const spalte = (page: Page, name: SchubladenName) => page.locator(`[data-panel-links="${name}"]`);
const kopf = (page: Page, name: SchubladenName) => spalte(page, name).locator('[data-schubladenkopf] h2');
const titel = (page: Page, name: SchubladenName) => spalte(page, name).locator('[data-schublade-abschnitt] > h3');
const suchfeld = (page: Page, name: SchubladenName) => spalte(page, name).getByRole('searchbox');
const tooltip = (page: Page) => page.locator('[data-tooltip]');
const herz = (page: Page) => spalte(page, 'werkzeuge').locator('[data-grundformen] [data-ablage-gut="Herz"]');
const formen = (html: string) => html.split('<svg class="form"').length - 1;

/** Schriftgröße, Gewicht und Farbe jedes Treffers. */
const schrift = (ort: Locator) =>
	ort.evaluateAll((liste) =>
		liste.map((e) => {
			const s = getComputedStyle(e);
			return { groesse: s.fontSize, gewicht: s.fontWeight, farbe: s.color };
		}),
	);

/** Grund, Rand oben und Rundung jedes Treffers. */
const kachelStil = (ort: Locator) =>
	ort.evaluateAll((liste) =>
		liste.map((e) => {
			const s = getComputedStyle(e);
			return { grund: s.backgroundColor, rand: s.borderTopWidth, rundung: s.borderRadius };
		}),
	);

const links = async (ort: Locator) => (await ort.boundingBox())?.x ?? NaN;
const oben = async (ort: Locator) => (await ort.boundingBox())?.y ?? NaN;

const blatt = async (page: Page) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
};

/** „Bilder“ mit der gewählten Gruppe; die Kacheln oder der Leerzustand stehen. */
const bilderGruppe = async (page: Page, gruppe: 'Dieser Ordner' | 'Sammlung') => {
	await oeffneSchublade(page, 'bilder');
	await spalte(page, 'bilder').getByRole('button', { name: gruppe, exact: true }).click();
	await expect(spalte(page, 'bilder').locator('[data-schublade-leer], [data-sammlung-bild]').first()).toBeVisible();
};

/** Ein Punkt in der Mitte der ersten Seite, soweit sie zu sehen ist. */
const aufSeite = async (page: Page) => {
	const seite = material(page).locator('.seite').first();
	await seite.evaluate((s) => s.scrollIntoView({ block: 'center' }));
	const r = await seite.boundingBox();
	const sicht = await page.locator('main').boundingBox();
	if (!r || !sicht) {
		throw new Error('Seite nicht zu sehen');
	}
	const von = Math.max(r.y, sicht.y);
	const bis = Math.min(r.y + r.height, sicht.y + sicht.height);
	return { x: r.x + r.width / 2, y: (von + bis) / 2 };
};

test.describe('Ein Aufbau für alle Schubladen am Mac (167)', () => {
	test.skip(({ hasTouch }) => hasTouch, 'Mac-Maß mit der Maus');

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 982 });
	});

	test('Kopf: Name in 14 px fett und schwarz, größer als ein Eintrag', async ({ page }) => {
		await blatt(page);
		for (const name of ALLE) {
			await oeffneSchublade(page, name);
			await expect(kopf(page, name)).toHaveCount(1);
			expect(await schrift(kopf(page, name)), name).toEqual([
				{ groesse: '14px', gewicht: '600', farbe: SCHWARZ },
			]);
		}
		// Gegenprobe: Ein Eintrag in „Bausteine“ ist kleiner als der Kopf.
		await oeffneSchublade(page, 'bausteine');
		const eintrag = await schrift(spalte(page, 'bausteine').locator('[data-bereich]').first());
		expect(eintrag[0]?.groesse).toBe('12px');
	});

	test('Abschnitte: 13 px fett und schwarz, ohne Linie und ohne Nummer', async ({ page }) => {
		await blatt(page);
		for (const name of MIT_ABSCHNITTEN) {
			if (name === 'bilder') {
				await bilderGruppe(page, 'Sammlung');
			} else {
				await oeffneSchublade(page, name);
			}
			await expect(titel(page, name).first()).toBeVisible();
			for (const stil of await schrift(titel(page, name))) {
				expect(stil, name).toEqual({ groesse: '13px', gewicht: '600', farbe: SCHWARZ });
			}
			const linien = await spalte(page, name)
				.locator('[data-schublade-abschnitt]')
				.evaluateAll((liste) => liste.map((e) => getComputedStyle(e).borderTopWidth));
			expect(linien.length, name).toBeGreaterThan(0);
			expect(new Set(linien), name).toEqual(new Set(['0px']));
		}
		await oeffneSchublade(page, 'werkzeuge');
		await expect(titel(page, 'werkzeuge')).toHaveText(['Text', 'Grundformen', 'Blasen und Linien', 'Bildrahmen']);
		const nummern = await page
			.locator('[data-panel-links] .rounded-full')
			.evaluateAll((liste) => liste.filter((e) => /^\d+$/.test(e.textContent?.trim() ?? '')).length);
		expect(nummern).toBe(0);
	});

	test('eine Kante für Name, Suche und erste Überschrift', async ({ page }) => {
		await blatt(page);
		for (const [name] of MIT_SUCHE) {
			if (name === 'bilder') {
				await bilderGruppe(page, 'Sammlung');
			} else {
				await oeffneSchublade(page, name);
			}
			const kante = await links(kopf(page, name));
			expect(Math.abs((await links(suchfeld(page, name))) - kante), name).toBeLessThanOrEqual(1);
			expect(Math.abs((await links(titel(page, name).first())) - kante), name).toBeLessThanOrEqual(1);
		}
	});

	test('die Suche steht fest, nur der Inhalt rollt', async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 640 });
		await blatt(page);
		await oeffneSchublade(page, 'werkzeuge');
		const inhalt = spalte(page, 'werkzeuge').locator('[data-schublade-inhalt]');
		const suche = await oben(suchfeld(page, 'werkzeuge'));
		const erste = await oben(titel(page, 'werkzeuge').first());
		await inhalt.evaluate((e) => e.scrollTo(0, e.scrollHeight));
		await expect.poll(() => inhalt.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
		expect(await oben(suchfeld(page, 'werkzeuge'))).toBe(suche);
		// Gegenprobe: Die erste Überschrift ist mitgerollt.
		expect(await oben(titel(page, 'werkzeuge').first())).toBeLessThan(erste);
	});

	test('ein Suchfeld: „Suchen …“, gleich hoch, mit dem Namen der Schublade', async ({ page }) => {
		await blatt(page);
		const hoehen: number[] = [];
		for (const [name, beschriftung] of MIT_SUCHE) {
			await oeffneSchublade(page, name);
			const feld = spalte(page, name).getByRole('searchbox', { name: beschriftung });
			await expect(feld).toHaveAttribute('placeholder', 'Suchen …');
			hoehen.push(Math.round((await feld.boundingBox())?.height ?? 0));
		}
		expect(hoehen).toEqual([26, 26, 26, 26]);
	});

	test('eine Kachel: grau, ohne Rand, 5 px gerundet', async ({ page }) => {
		await blatt(page);
		// „Zuletzt benutzt“ erscheint erst nach dem Einfügen.
		await oeffneSchublade(page, 'bausteine');
		await spalte(page, 'bausteine').locator('[data-bereich="Aufgabe und Text"]').click();
		await spalte(page, 'bausteine').locator('[data-einfuegen="aufgabe"]').click();
		await spalte(page, 'bausteine').getByRole('button', { name: 'Aufgabe und Text' }).click();
		await expect(spalte(page, 'bausteine').locator('[data-zuletzt]').first()).toBeVisible();
		await page.mouse.move(1, 1);
		const kacheln = [...(await kachelStil(spalte(page, 'bausteine').locator('[data-zuletzt]')))];

		for (const name of ['werkzeuge', 'figuren'] as const) {
			await oeffneSchublade(page, name);
			await expect(spalte(page, name).locator('[data-ablage-gut]').first()).toBeVisible();
			await page.mouse.move(1, 1);
			kacheln.push(...(await kachelStil(spalte(page, name).locator('[data-ablage-gut]'))));
		}
		await bilderGruppe(page, 'Sammlung');
		await page.mouse.move(1, 1);
		kacheln.push(...(await kachelStil(spalte(page, 'bilder').locator('[data-sammlung-bild]'))));

		expect(kacheln.length).toBeGreaterThan(20);
		expect(new Set(kacheln.map((k) => JSON.stringify(k)))).toEqual(
			new Set([JSON.stringify({ grund: KACHELGRAU, rand: '0px', rundung: '5px' })]),
		);
	});

	test('jede Suche ohne Treffer sagt „Nichts passt zu „…“.“ in derselben Schrift', async ({ page }) => {
		await blatt(page);
		for (const [name] of MIT_SUCHE) {
			if (name === 'bilder') {
				await bilderGruppe(page, 'Sammlung');
			} else {
				await oeffneSchublade(page, name);
			}
			await suchfeld(page, name).fill('zebra');
			const leer = spalte(page, name).locator('[data-schublade-leer] p');
			await expect(leer).toHaveText('Nichts passt zu „zebra“.');
			expect(await schrift(leer), name).toEqual([{ groesse: '12px', gewicht: '400', farbe: LEISE }]);
		}
	});

	test('Kacheln zeigen ihren Namen im Tooltip, nicht beim Ziehen', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(page, blattMit());
		await oeffneSchublade(page, 'werkzeuge');
		await expect(spalte(page, 'werkzeuge').locator('[data-ablage-gut][title]')).toHaveCount(0);

		const r = await herz(page).boundingBox();
		if (!r) {
			throw new Error('Herz nicht zu sehen');
		}
		await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
		await expect(tooltip(page)).toHaveText('Herz');

		const vorher = formen(await quelle(page));
		await page.mouse.down();
		await page.mouse.move(r.x + r.width / 2 + 20, r.y + r.height / 2, { steps: 4 });
		await expect(page.locator('[data-zug-anzeige]')).toBeVisible();
		await expect(tooltip(page)).toHaveCount(0);
		const ziel = await aufSeite(page);
		await page.mouse.move(ziel.x, ziel.y, { steps: 8 });
		await expect(tooltip(page)).toHaveCount(0);
		await page.mouse.up();
		await expect.poll(async () => formen(await quelle(page))).toBe(vorher + 1);

		// Gegenprobe: Nach dem Zug zeigt die Kachel ihren Namen wieder.
		await page.mouse.move(1, 1);
		await expect(tooltip(page)).toHaveCount(0);
		await herz(page).hover();
		await expect(tooltip(page)).toHaveText('Herz');
	});

	test('„Bilder“ zählt „1 Bild“ bzw. „N Bilder“, bei 0 nichts', async ({ page }) => {
		await blatt(page);
		await bilderGruppe(page, 'Dieser Ordner');
		const gruppe = spalte(page, 'bilder').locator('[data-bilder-gruppe]');
		await expect(gruppe.locator('h3')).toHaveText('Dieser Ordner');
		await expect(gruppe.locator('h3')).not.toHaveText(/\d/);
		await expect(gruppe.locator('[data-schublade-leer]')).toHaveText('Hier gibt es noch keine Bilder.');

		await bilderGruppe(page, 'Sammlung');
		await expect(gruppe.locator('h3 > span').nth(1)).toHaveText(/^(1 Bild|\d+ Bilder)$/);
	});
});

test.describe('Ein Aufbau für alle Schubladen am iPad (167)', () => {
	test.skip(({ hasTouch }) => !hasTouch, 'mit Finger');

	test('am Finger eine Stufe größer; der Umschalter in „Bilder“ passt', async ({ page }) => {
		await blatt(page);
		await oeffneSchublade(page, 'werkzeuge');
		expect((await schrift(kopf(page, 'werkzeuge')))[0]?.groesse).toBe('18px');
		expect((await schrift(titel(page, 'werkzeuge').first()))[0]?.groesse).toBe('16px');

		await oeffneSchublade(page, 'bausteine');
		expect((await schrift(spalte(page, 'bausteine').locator('[data-bereich]').first()))[0]?.groesse).toBe('14px');

		await oeffneSchublade(page, 'bilder');
		const knoepfe = spalte(page, 'bilder').getByRole('group', { name: 'Welche Bilder?' }).getByRole('button');
		await expect(knoepfe).toHaveCount(3);
		const abgeschnitten = await knoepfe.evaluateAll((liste) =>
			liste.filter((k) => k.scrollWidth > k.clientWidth).map((k) => k.textContent),
		);
		expect(abgeschnitten).toEqual([]);
	});
});
