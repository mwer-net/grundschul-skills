import type { Locator, Page } from '@playwright/test';

import { aendere, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { expect, legeMappeAn, test } from './hilfe';
import { schubladenKnopf } from './schubladen-hilfe';

interface Punkt {
	x: number;
	y: number;
}

const GERAETE = ['chromium', 'mac-safari', 'ipad-quer'];

const mitte = async (ziel: Locator): Promise<Punkt> => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('Nicht sichtbar');
	}
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/** Oberes bzw. unteres Viertel einer Zeile, Mitte ist für die Seitenzeile. */
const an = async (ziel: Locator, wo: 'oben' | 'unten' | 'mitte'): Promise<Punkt> => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('Nicht sichtbar');
	}
	const faktor = { oben: 0.25, mitte: 0.5, unten: 0.75 }[wo];
	return { x: b.x + b.width / 2, y: b.y + b.height * faktor };
};

/**
 * Ein Zeiger für Maus und Finger. Playwright kennt für Touch nur `tap`; die Pointer-Ereignisse entstehen im Dokument,
 * so wie Safari sie schickt. Der Zug läuft in Schritten, damit sich mittendrin prüfen lässt, was zu sehen ist.
 */
const zeiger = (page: Page, hasTouch: boolean) => {
	const sende = (typ: string, p: Punkt) =>
		page.evaluate(
			({ p: { x, y }, typ: art }) => {
				const unter = document.elementFromPoint(x, y) ?? document.body;
				unter.dispatchEvent(
					new PointerEvent(art, {
						bubbles: true,
						cancelable: true,
						composed: true,
						clientX: x,
						clientY: y,
						pointerId: 7,
						pointerType: 'touch',
						isPrimary: true,
					}),
				);
			},
			{ p, typ },
		);
	let wo: Punkt = { x: 0, y: 0 };
	const zu = async (p: Punkt) => {
		for (let i = 1; i <= 5; i += 1) {
			const schritt = { x: wo.x + ((p.x - wo.x) * i) / 5, y: wo.y + ((p.y - wo.y) * i) / 5 };

			await (hasTouch ? sende('pointermove', schritt) : page.mouse.move(schritt.x, schritt.y));
		}
		wo = p;
	};
	return {
		runter: async (p: Punkt) => {
			wo = p;
			if (hasTouch) {
				await sende('pointerdown', p);
			} else {
				await page.mouse.move(p.x, p.y);
				await page.mouse.down();
			}
			await zu({ x: p.x + 2, y: p.y + 10 });
		},
		zu,
		los: () => (hasTouch ? sende('pointerup', wo) : page.mouse.up()),
	};
};

const aufgaben = (page: Page) => page.locator('[data-gliederung-aufgabe]');
const griffVon = (zeile: Locator) => zeile.getByRole('button', { name: /ziehen$/ });
const seitenZeile = (page: Page, n: number) => page.locator(`[data-seite-zeile="${n}"]`);
const marke = (page: Page) => page.locator('[data-gliederung] [data-einfuegemarke]');
const zurueck = (page: Page) => page.getByRole('button', { name: /^Rückgängig/ }).first();
const anweisungen = (html: string) => [...html.matchAll(/<span class="text">([^<]{0,12})/g)].map((m) => m[1]);
const nummern = (html: string) => [...html.matchAll(/<span class="nr( stern)?">([^<]*)</g)].map((m) => m[2]);
const ANFANG = ['Lies ab. Sch', 'Zeichne die ', 'Willi sagt: ', 'Sternchenauf'];

const zeileMit = (page: Page, text: RegExp) => page.locator('[data-zeile-nr]').filter({ hasText: text });

/** Öffnet Aufgabe 1, ihre Reihe und den ersten Eintrag: Unter der Seite ist ohne Zutun alles zu. */
const oeffneErstenEintrag = async (page: Page, druecke: (z: Locator) => Promise<void>) => {
	await druecke(aufgaben(page).nth(0).getByRole('button', { name: 'Aufklappen' }));
	await druecke(
		zeileMit(page, /^Reihe$/)
			.first()
			.getByRole('button', { name: 'Aufklappen' }),
	);
	await druecke(
		zeileMit(page, /^Eintrag 1$/)
			.first()
			.getByRole('button', { name: 'Aufklappen' }),
	);
};

const neueSeite = async (page: Page, druecke: (z: Locator) => Promise<void>, zahl: number) => {
	await druecke(page.getByRole('button', { name: 'Seite hinzufügen' }));
	await expect(page.locator('[data-seite-zeile]')).toHaveCount(zahl);
};

test.describe('Ebenen, bis 093 „Gliederung“ (080)', () => {
	test.beforeEach(() => {
		test.skip(
			!GERAETE.includes(test.info().project.name),
			'läuft in Chromium, Safari am Mac und auf dem iPad quer',
		);
	});

	const blatt = async (page: Page) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
	};

	test('Griff ohne Hover sichtbar, an jeder Zeile außer den festen Teilen', async ({ page }) => {
		await blatt(page);
		await expect(aufgaben(page)).toHaveCount(4);
		const zeilen = page.locator('[data-ziehbar]');
		expect(await zeilen.count()).toBeGreaterThanOrEqual(4);
		for (const zeile of await zeilen.all()) {
			await expect(griffVon(zeile)).toBeVisible();
		}
		await expect(page.locator('[data-gliederung-fest]')).toHaveText(['Namenszeile', 'Kopf', 'Fuß']);
		await expect(page.locator('[data-gliederung-fest]').getByRole('button', { name: /ziehen$/ })).toHaveCount(0);
		await expect(griffVon(seitenZeile(page, 1))).toBeVisible();
	});

	test('Klick auf eine feste Zeile wählt sie, auch im Blatt', async ({ druecke, page }) => {
		await blatt(page);
		await druecke(page.locator('[data-gliederung-fest]').nth(1).locator('[data-gliederung-titel]'));
		await expect(page.locator('[data-auswahl="kopf"]')).toBeVisible();
	});

	test('Aufgabe innerhalb der Seite ziehen: Quelle und Nummern stimmen, ein Schritt macht es rückgängig', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		await blatt(page);
		const vorher = await quelle(page);
		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(aufgaben(page).nth(2))));
		await hand.zu(await an(aufgaben(page).nth(0), 'oben'));
		await expect(marke(page)).toBeVisible();
		await expect(page.locator('[data-zug]')).toHaveText('Aufgabe 3');
		await expect(aufgaben(page).nth(2)).toHaveCSS('opacity', '0.35');
		await hand.los();
		await expect
			.poll(async () => anweisungen(await quelle(page)))
			.toEqual(['Willi sagt: ', 'Lies ab. Sch', 'Zeichne die ', 'Sternchenauf']);
		expect(nummern(await quelle(page))).toEqual(['1', '2', '3', '★']);
		await expect(marke(page)).toHaveCount(0);
		await expect(page.locator('[data-zug]')).toHaveCount(0);
		await expect(aufgaben(page).nth(0).locator('[data-gliederung-titel]')).toContainText('Willi');
		await expect(aufgaben(page).nth(0).locator('[data-gliederung-titel]')).toHaveAttribute('aria-current', 'true');
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();

		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Aufgabe verschoben');
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Aufgabe auf eine andere Seite: Linie zwischen den Zeilen, auf die eingeklappte ans Ende', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		await blatt(page);
		await neueSeite(page, druecke, 2);
		const hand = zeiger(page, hasTouch);

		// Auf die Seitenzeile: ans Ende, die Zeile färbt sich, keine Linie.
		await druecke(seitenZeile(page, 2).getByRole('button', { name: 'Einklappen' }));
		await hand.runter(await mitte(griffVon(aufgaben(page).nth(1))));
		await hand.zu(await an(seitenZeile(page, 2), 'mitte'));
		await expect(marke(page)).toHaveCount(0);
		await expect(seitenZeile(page, 2)).toHaveClass(/bg-brand-50/);
		await hand.los();
		await expect.poll(async () => (await quelle(page)).lastIndexOf('Zeichne die ')).toBeGreaterThan(0);
		const nach = await quelle(page);
		expect(nach.lastIndexOf('class="seite"')).toBeLessThan(nach.indexOf('Zeichne die '));
		// Sie liegt jetzt dort und ist gewählt, die Seite ging dafür auf.
		await expect(seitenZeile(page, 2)).not.toHaveAttribute('data-zu');
		await expect(page.locator('[data-gliederung-seite="2"] [data-gliederung-aufgabe]')).toHaveCount(1);

		// Zwischen Zeilen der anderen Seite: Linie, und sie steht danach dort.
		const hand2 = zeiger(page, hasTouch);
		await hand2.runter(await mitte(griffVon(aufgaben(page).nth(0))));
		await hand2.zu(
			await an(page.locator('[data-gliederung-seite="2"] [data-gliederung-aufgabe]').first(), 'unten'),
		);
		await expect(marke(page)).toBeVisible();
		await hand2.los();
		await expect(page.locator('[data-gliederung-seite="2"] [data-gliederung-aufgabe]')).toHaveCount(2);
		await expect.poll(async () => nummern(await quelle(page))).toEqual(['1', '★', '2', '3']);
	});

	test('Über einer eingeklappten Seite klappt sie nach kurzer Zeit auf', async ({ druecke, hasTouch, page }) => {
		await blatt(page);
		await neueSeite(page, druecke, 2);
		await druecke(seitenZeile(page, 2).getByRole('button', { name: 'Einklappen' }));
		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(aufgaben(page).nth(0))));
		await hand.zu(await an(seitenZeile(page, 2), 'mitte'));
		await expect(seitenZeile(page, 2)).not.toHaveAttribute('data-zu', { timeout: 2000 });
		await hand.zu(await mitte(griffVon(aufgaben(page).nth(0))));
		await hand.los();
	});

	test('Seite ziehen: Liste klappt zu, Reihenfolge stimmt, der Zustand kehrt zurück', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		await blatt(page);
		await neueSeite(page, druecke, 2);
		await neueSeite(page, druecke, 3);
		await druecke(seitenZeile(page, 1).getByRole('button', { name: 'Einklappen' }));
		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(seitenZeile(page, 3))));
		await expect(aufgaben(page)).toHaveCount(0);
		await expect(page.locator('[data-seite-anzahl]')).toHaveText(['4', '0', '0']);
		// Vor die erste Seite: Die neuen Seiten 2 und 3 sind beide leer, ein Tausch der beiden änderte die Quelle nicht.
		await hand.zu(await an(seitenZeile(page, 1), 'oben'));
		await expect(marke(page)).toBeVisible();
		await hand.los();

		await expect
			.poll(async () => {
				const q = await quelle(page);
				return q.indexOf('class="seite"', q.indexOf('class="seite"') + 1) < q.indexOf('Lies ab. Sch');
			})
			.toBe(true);
		expect(anweisungen(await quelle(page))).toEqual(ANFANG);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Seite verschoben');
		// Die Seite mit den Aufgaben (jetzt Seite 2) blieb zu, die anderen beiden stehen wieder offen.
		await expect(seitenZeile(page, 2)).toHaveAttribute('data-zu');
		await expect(seitenZeile(page, 2).locator('[data-seite-anzahl]')).toHaveText('4');
		await expect(page.locator('[data-seite-zeile][data-zu]')).toHaveCount(1);

		// Jetzt wandert die eingeklappte Seite selbst: Sie bleibt zu, nicht die Zeile, die jetzt an ihrer Stelle steht.
		const hand2 = zeiger(page, hasTouch);
		await hand2.runter(await mitte(griffVon(seitenZeile(page, 2))));
		await hand2.zu(await an(seitenZeile(page, 3), 'unten'));
		await hand2.los();
		await expect(seitenZeile(page, 3)).toHaveAttribute('data-zu');
		await expect(seitenZeile(page, 2)).not.toHaveAttribute('data-zu');
		expect((await quelle(page)).lastIndexOf('class="seite"')).toBeLessThan(
			(await quelle(page)).indexOf('Lies ab. Sch'),
		);
	});

	test('Esc bricht ab, die Quelle bleibt gleich', async ({ hasTouch, page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(aufgaben(page).nth(2))));
		await hand.zu(await an(aufgaben(page).nth(0), 'oben'));
		await expect(marke(page)).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(marke(page)).toHaveCount(0);
		await expect(page.locator('[data-zug]')).toHaveCount(0);
		await hand.los();
		expect(await quelle(page)).toBe(vorher);
	});

	test('Ungültiges Ziel: keine Linie, verbotener Zeiger, Ablegen ändert nichts', async ({ hasTouch, page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(aufgaben(page).nth(1))));

		await hand.zu(await an(page.locator('[data-gliederung-fest]').nth(1), 'mitte'));
		await expect(marke(page)).toHaveCount(0);
		await expect.poll(() => page.evaluate(() => document.documentElement.style.cursor)).toBe('not-allowed');

		await hand.zu({ x: 700, y: 400 });
		await expect(marke(page)).toHaveCount(0);
		await hand.los();
		await expect.poll(() => page.evaluate(() => document.documentElement.style.cursor)).toBe('');
		expect(await quelle(page)).toBe(vorher);
	});

	test('Freier Block erscheint und lässt sich ziehen', async ({ hasTouch, page }) => {
		await blatt(page);
		const mitBlock = (await quelle(page)).replace(
			'<div class="aufgabe"',
			'<h2>Zwischen</h2>\n<div class="aufgabe"',
		);
		await page.evaluate((t) => {
			(window as unknown as { schoolboxEditor: { aendere: (neu: string) => void } }).schoolboxEditor.aendere(t);
		}, mitBlock);
		const block = page.locator('[data-gliederung-zeile]').filter({ hasText: 'Zwischen' });
		await expect(block).toHaveCount(1);
		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(block)));
		await hand.zu(await an(aufgaben(page).nth(2), 'oben'));
		await expect(page.locator('[data-zug]')).toHaveText('Überschrift');
		await hand.los();
		await expect
			.poll(async () => {
				const q = await quelle(page);
				return q.indexOf('Zwischen') > q.indexOf('Zeichne die ');
			})
			.toBe(true);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Überschrift verschoben');
	});

	test('Einklappen: Seite zu, „Alle einklappen“, Klick im Blatt klappt auf', async ({ druecke, page }) => {
		await blatt(page);
		await druecke(seitenZeile(page, 1).getByRole('button', { name: 'Einklappen' }));
		await expect(aufgaben(page)).toHaveCount(0);
		await expect(page.locator('[data-seite-anzahl]')).toHaveText('4');
		await druecke(seitenZeile(page, 1).getByRole('button', { name: 'Aufklappen' }));
		await expect(aufgaben(page)).toHaveCount(4);

		await druecke(page.getByRole('button', { name: 'Alle einklappen' }));
		await expect(aufgaben(page)).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Alle aufklappen' })).toBeVisible();

		// Die Zeile der Seite wählt, ohne sie aufzuklappen.
		// Eingeklappt steht die Zahl der Aufgaben mit im Namen des Knopfs („Seite 1 4“).
		await druecke(seitenZeile(page, 1).getByRole('button', { name: /^Seite 1( \d+)?$/ }));
		await expect(page.locator('[data-auswahl="seite"]')).toBeVisible();
		await expect(aufgaben(page)).toHaveCount(0);

		await druecke(material(page).locator('.aufgabe .nr').first());
		await expect(aufgaben(page)).toHaveCount(4);
	});

	test('Der Stand bleibt, wenn die Schublade wechselt', async ({ druecke, page }) => {
		await blatt(page);
		await druecke(seitenZeile(page, 1).getByRole('button', { name: 'Einklappen' }));
		await druecke(schubladenKnopf(page, 'bausteine'));
		await druecke(schubladenKnopf(page, 'ebenen'));
		await expect(seitenZeile(page, 1)).toHaveAttribute('data-zu');
	});

	test('Keine Miniaturen und kein Umschalter dafür', async ({ page }) => {
		await blatt(page);
		await expect(page.locator('[data-gliederung] iframe')).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Miniaturen/ })).toHaveCount(0);
	});

	test('Der Baum reicht bis zum Innersten: Klick im Blatt markiert es, klappt auf und rollt es in Sicht', async ({
		druecke,
		page,
	}) => {
		await blatt(page);
		const aufgabe = aufgaben(page).nth(0);
		await expect(aufgabe).toBeVisible();
		await druecke(page.getByRole('button', { name: 'Alle einklappen' }));
		await expect(aufgaben(page)).toHaveCount(0);

		await druecke(material(page).locator('.reihe').first().locator('x-uhr').nth(2));
		const aktiv = page.locator('[data-gliederung] [aria-current="true"]');
		await expect(aktiv).toHaveText('Uhr');
		await expect(aktiv).toBeInViewport();
		// Eintrag 3 der ersten Aufgabe: Seite, Aufgabe, Reihe und Eintrag liegen offen.
		await expect(aufgaben(page)).toHaveCount(4);
		await expect(zeileMit(page, /^Eintrag 3$/).first()).toBeVisible();
		await expect(page.locator('[data-auswahl="abbildung"]')).toBeVisible();
	});

	test('Klick auf eine tiefe Zeile wählt im Blatt und zeigt rechts die Einstellungen', async ({ druecke, page }) => {
		await blatt(page);
		await expect(zeileMit(page, /^Antwortlinie$/)).toHaveCount(0);
		await oeffneErstenEintrag(page, druecke);
		await druecke(
			zeileMit(page, /^Antwortlinie$/)
				.first()
				.locator('[data-gliederung-titel]'),
		);
		await expect(page.locator('[data-inspektor="auswahl"]')).toBeVisible();
		await expect(page.locator('[data-auswahl="antwort"]')).toBeVisible();
		await expect(page.locator('[data-gliederung] [aria-current="true"]')).toHaveText('Antwortlinie');
	});

	test('Einträge lassen sich in ihrer Reihe ziehen, nicht in eine andere Aufgabe', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		await blatt(page);
		await oeffneErstenEintrag(page, druecke);
		const uhren = (html: string) => [...html.matchAll(/<x-uhr[^>]*>/g)].map((m) => m[0]);
		const vorher = await quelle(page);
		const eintraege = zeileMit(page, /^Eintrag \d$/);
		// Ein einzelnes Element (die Uhr im Eintrag) hat nirgendwohin zu gehen und darum keinen Griff.
		const uhr = zeileMit(page, /^Uhr$/).first();
		await expect(griffVon(uhr)).toHaveCount(0);
		await expect(griffVon(eintraege.nth(0))).toBeVisible();

		const falsch = zeiger(page, hasTouch);
		await falsch.runter(await mitte(griffVon(eintraege.nth(0))));
		await falsch.zu(await an(aufgaben(page).nth(1), 'mitte'));
		await expect(marke(page)).toHaveCount(0);
		await expect.poll(() => page.evaluate(() => document.documentElement.style.cursor)).toBe('not-allowed');
		await falsch.los();
		expect(await quelle(page)).toBe(vorher);

		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(eintraege.nth(0))));
		await hand.zu(await an(eintraege.nth(2), 'oben'));
		await expect(marke(page)).toBeVisible();
		await expect(page.locator('[data-zug]')).toHaveText('Eintrag 1');
		await hand.los();
		const [a, b, c] = uhren(vorher);
		await expect.poll(async () => uhren(await quelle(page)).slice(0, 3)).toEqual([b, a, c]);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Eintrag verschoben');
	});

	test('⌥1 und ⌥2 passen, alte Speicherwerte `seiten` und `gliederung` öffnen die Ebenen', async ({ page }) => {
		await blatt(page);
		const panel = page.locator('[data-panel-links]');
		await expect(page.getByRole('tab', { name: 'Seiten', exact: true })).toHaveCount(0);
		for (const alt of ['seiten', 'gliederung']) {
			await page.evaluate((wert) => localStorage.setItem('schoolbox-panel-links', wert), alt);
			await page.reload();
			await expect(panel).toHaveAttribute('data-panel-links', 'ebenen');
		}
		await expect(panel).toHaveCSS('width', '240px');
		await expect(page.getByRole('navigation', { name: 'Ebenen' })).toBeVisible();
		await page.keyboard.press('Alt+Digit2');
		await expect(panel).toHaveAttribute('data-panel-links', 'bausteine');
		await page.keyboard.press('Alt+Digit1');
		await expect(panel).toHaveAttribute('data-panel-links', 'ebenen');
	});

	test('Mini-Book: kein Griff an Seiten, kein „+ Seite“', async ({ page }) => {
		const { dokumente, id } = await legeMappeAn('Farben', 'englisch', 3, [
			{ titel: 'Farben', format: 'minibuch', vorlage: 'minibuch' },
		]);
		await oeffne(page, id, dokumente[0] ?? '');
		await expect(page.locator('[data-seite-zeile]')).toHaveCount(8);
		await expect(page.getByRole('button', { name: 'Seite ziehen' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Seite hinzufügen' })).toHaveCount(0);
		await expect(page.locator('[data-feste-seiten]')).toBeVisible();
	});

	test('Finger: Der Griff zieht, die Zeile lässt die Liste rollen', async ({ hasTouch, page }) => {
		test.skip(!hasTouch, 'nur mit Finger');
		await blatt(page);
		const griff = griffVon(aufgaben(page).nth(0));
		await expect(griff).toHaveCSS('touch-action', 'none');
		const titel = aufgaben(page).nth(0).locator('[data-gliederung-titel]');
		await expect(titel).not.toHaveCSS('touch-action', 'none');
		const box = await griff.boundingBox();
		expect(box?.width).toBeGreaterThanOrEqual(44);
		expect(box?.height).toBeGreaterThanOrEqual(44);

		const vorher = await quelle(page);
		const hand = zeiger(page, true);
		await hand.runter(await mitte(titel));
		await hand.zu(await an(aufgaben(page).nth(2), 'unten'));
		await expect(page.locator('[data-zug]')).toHaveCount(0);
		await hand.los();
		expect(await quelle(page)).toBe(vorher);

		const griffHand = zeiger(page, true);
		await griffHand.runter(await mitte(griff));
		await griffHand.zu(await an(aufgaben(page).nth(2), 'unten'));
		await expect(page.locator('[data-zug]')).toBeVisible();
		await griffHand.los();
		await expect.poll(() => quelle(page)).not.toBe(vorher);
	});

	test('Maus zieht auch von der Zeile, ein Klick dort wählt nur', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'nur mit Maus');
		await blatt(page);
		const vorher = await quelle(page);
		const titel = aufgaben(page).nth(0).locator('[data-gliederung-titel]');
		await titel.click();
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
		expect(await quelle(page)).toBe(vorher);
		const hand = zeiger(page, false);
		await hand.runter(await mitte(titel));
		await hand.zu(await an(aufgaben(page).nth(2), 'unten'));
		await expect(marke(page)).toBeVisible();
		await hand.los();
		await expect.poll(async () => anweisungen(await quelle(page))[0]).toBe('Zeichne die ');
	});
});

/** Eine Form mit Namen, damit Quelle und Zeile sie gleich nennen. */
const form = (name: string, x: number, y: number, mehr = '') =>
	`<svg class="form" data-lage="frei" data-name="${name}"${mehr} data-form="kreis" viewBox="0 0 100 100" style="--x:${x}px;--y:${y}px;--b:100px;--h:100px"><circle cx="50" cy="50" r="48" style="fill:var(--akzent)"/></svg>`;

/** Hängt die Ebenen ans Ende der ersten Seite. */
const mitEbenen = (text: string, vorne: string[], hinten: string[]) =>
	text.replace(
		'</section>',
		`  <div class="ebene hinten">\n    ${hinten.join('\n    ')}\n  </div>\n  <div class="ebene vorne">\n    ${vorne.join('\n    ')}\n  </div>\n</section>`,
	);

/** Die Namen in einer Ebene der ersten Seite, in der Reihenfolge der Quelle (hinten zuerst). */
const inEbene = (html: string, ebene: 'vorne' | 'hinten', seite = 0) => {
	const teil = html.split('class="seite"')[seite + 1] ?? '';
	const block = new RegExp(`<div class="ebene ${ebene}">([\\s\\S]*?)</div>`).exec(teil)?.[1] ?? '';
	return [...block.matchAll(/data-name="([^"]*)"/g)].map((m) => m[1]);
};

const zeileVon = (page: Page, name: string) =>
	page.locator('[data-zeilen-art="vorne"], [data-zeilen-art="hinten"]').filter({ hasText: new RegExp(`^${name}`) });
const arten = (page: Page) =>
	page
		.locator('[data-gliederung-seite="1"] [data-zeilen-art]')
		.evaluateAll((z) => z.map((e) => (e as HTMLElement).dataset.zeilenArt).filter((a) => a !== 'baustein'));
const titel = (page: Page) =>
	page
		.locator(
			'[data-gliederung-seite="1"] [data-zeilen-art="vorne"], [data-gliederung-seite="1"] [data-zeilen-art="hinten"]',
		)
		.locator('[data-gliederung-titel]')
		.allInnerTexts();

test.describe('Ebenen mit Gestaltung (101)', () => {
	test.beforeEach(() => {
		test.skip(
			!GERAETE.includes(test.info().project.name),
			'läuft in Chromium, Safari am Mac und auf dem iPad quer',
		);
	});

	/** Vorne liegen A, B, C (C ganz vorne), hinten D; C liegt über der ersten Aufgabe. */
	const blatt = async (page: Page) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const aufgabe = await material(page)
			.locator('.aufgabe')
			.first()
			.evaluate((e) => {
				const a = e.getBoundingClientRect();
				const s = (e.closest('.seite') ?? e).getBoundingClientRect();
				return { x: Math.round(a.left - s.left), y: Math.round(a.top - s.top) };
			});
		const text = mitEbenen(
			await quelle(page),
			[form('A', 500, 700), form('B', 560, 760), form('C', aufgabe.x + 20, aufgabe.y)],
			[form('D', 40, 900)],
		);
		await aendere(page, text);
		await expect(zeileVon(page, 'D')).toBeVisible();
		return text;
	};

	test('Baum: vorne, Hauptstapel, hinten, Rahmen, Fläche; oben liegt vorne', async ({ page }) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		const unten =
			'<div class="seitenflaeche" data-flaeche="farbe" style="--f1:#fff7e6"></div><div class="seitenrahmen" data-rahmen="linie"></div>';
		await aendere(
			page,
			mitEbenen(await quelle(page), [form('A', 500, 700), form('B', 560, 760)], [unten, form('D', 40, 900)]),
		);
		await expect
			.poll(() => arten(page))
			.toEqual(['vorne', 'vorne', 'hauptstapel', 'hinten', 'seitenrahmen', 'seitenflaeche']);
		expect(await titel(page)).toEqual(['B', 'A', 'D']);
		// Die Aufgaben stehen unter dem Hauptstapel, mit ihren Nummern, und der Hauptstapel ist offen.
		const stapel = page.locator('[data-zeilen-art="hauptstapel"]');
		await expect(stapel).toContainText('fließt');
		await expect(aufgaben(page)).toHaveCount(4);
		await expect(aufgaben(page).first()).toContainText('1');
	});

	test('Reihenfolge ziehen: ein Schritt, ⌘Z nimmt ihn zurück; „Nach vorne“ im Blatt schiebt die Zeile hoch', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		const vorher = await blatt(page);
		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(zeileVon(page, 'A'))));
		await hand.zu(await an(zeileVon(page, 'C'), 'oben'));
		await expect(marke(page)).toBeVisible();
		await hand.los();
		await expect.poll(async () => inEbene(await quelle(page), 'vorne')).toEqual(['B', 'C', 'A']);
		expect(await titel(page)).toEqual(['A', 'C', 'B', 'D']);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'A verschoben');
		await druecke(zurueck(page));
		await expect.poll(() => quelle(page)).toBe(vorher);

		// Im Blatt: B gewählt, „Nach vorne“ (100) im ⋯ der Leiste am Element.
		await druecke(zeileVon(page, 'B').locator('[data-gliederung-titel]'));
		await druecke(page.getByRole('button', { name: 'Mehr zu B' }));
		await druecke(page.getByRole('menuitem', { name: /^Nach vorne/ }));
		await expect.poll(() => titel(page)).toEqual(['B', 'C', 'A', 'D']);
	});

	test('Ebene wechseln: unter den Hauptstapel nach hinten, die Lage bleibt', async ({ hasTouch, page }) => {
		await blatt(page);
		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(zeileVon(page, 'B'))));
		await hand.zu(await an(page.locator('[data-zeilen-art="hauptstapel"]'), 'unten'));
		await expect(marke(page)).toBeVisible();
		await hand.los();
		await expect.poll(async () => inEbene(await quelle(page), 'hinten')).toEqual(['D', 'B']);
		expect(inEbene(await quelle(page), 'vorne')).toEqual(['A', 'C']);
		expect(await quelle(page)).toContain(
			'data-name="B" data-form="kreis" viewBox="0 0 100 100" style="--x:560px;--y:760px',
		);
		// Und zurück: über den Hauptstapel, also zuunterst nach vorne.
		const hand2 = zeiger(page, hasTouch);
		await hand2.runter(await mitte(griffVon(zeileVon(page, 'D'))));
		await hand2.zu(await an(page.locator('[data-zeilen-art="hauptstapel"]'), 'oben'));
		await hand2.los();
		await expect.poll(async () => inEbene(await quelle(page), 'vorne')).toEqual(['D', 'A', 'C']);
	});

	test('Auf Seite 2 ziehen und mit ⌥ kopieren', async ({ druecke, hasTouch, page }) => {
		await blatt(page);
		await neueSeite(page, druecke, 2);
		const hand = zeiger(page, hasTouch);
		await hand.runter(await mitte(griffVon(zeileVon(page, 'A'))));
		await hand.zu(await an(seitenZeile(page, 2), 'mitte'));
		await expect(seitenZeile(page, 2)).toHaveClass(/bg-brand-50/);
		await hand.los();
		await expect.poll(async () => inEbene(await quelle(page), 'vorne', 1)).toEqual(['A']);
		expect(inEbene(await quelle(page), 'vorne')).toEqual(['B', 'C']);

		test.skip(hasTouch, '⌥ nur mit Tastatur');
		const start = await mitte(griffVon(zeileVon(page, 'C')));
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		const ziel = await an(zeileVon(page, 'B'), 'unten');
		await page.mouse.move(ziel.x, ziel.y, { steps: 6 });
		await page.keyboard.down('Alt');
		await page.mouse.move(ziel.x, ziel.y + 1, { steps: 2 });
		await expect(page.locator('[data-zug]')).toHaveText('C (Kopie)');
		await page.mouse.up();
		await page.keyboard.up('Alt');
		await expect.poll(async () => inEbene(await quelle(page), 'vorne')).toEqual(['C', 'B', 'C']);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'C kopiert');
	});

	test('Auge blendet aus: nicht im Blatt, nicht im Druck, die Prüfung meldet es', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		test.skip(hasTouch, 'Zeichen in der Zeile mit der Maus; am iPad im ⋯');
		await blatt(page);
		const a = zeileVon(page, 'A');
		await a.hover();
		await druecke(a.locator('[data-ebenen-zeichen="auge"]'));
		await expect.poll(() => quelle(page)).toContain('data-name="A" data-aus');
		await expect(a).toHaveAttribute('data-aus');
		await expect(a.locator('[data-ebenen-zeichen="auge"]')).toHaveAttribute('aria-pressed', 'true');
		await expect(material(page).locator('[data-name="A"]')).toBeHidden();
		await page.emulateMedia({ media: 'print' });
		await expect(material(page).locator('[data-name="A"]')).toBeHidden();
		await page.emulateMedia({ media: 'screen' });
		await expect(page.locator('[data-pruefung] > button')).toContainText('Hinweis');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Ausgeblendet');

		// Die Zeile bleibt wählbar, der Inspektor bietet „Einblenden“.
		await druecke(a.locator('[data-gliederung-titel]'));
		await expect(page.locator('[data-hinweis="ausgeblendet"]')).toBeVisible();
		// Wieder einblenden mit der Taste.
		await page.keyboard.press('Alt+Shift+KeyH');
		await expect.poll(() => quelle(page)).not.toContain('data-aus');
	});

	test('Schloss sperrt: der Klick im Blatt geht darunter, die Zeile bleibt wählbar', async ({
		druecke,
		hasTouch,
		page,
	}) => {
		test.skip(hasTouch, 'Zeichen in der Zeile mit der Maus; am iPad im ⋯');
		await blatt(page);
		const c = zeileVon(page, 'C');
		await c.hover();
		await druecke(c.locator('[data-ebenen-zeichen="schloss"]'));
		await expect.poll(() => quelle(page)).toContain('data-name="C" data-gesperrt');
		await expect(c.locator('[data-ebenen-zeichen="schloss"]')).toBeVisible();
		await material(page).locator('[data-name="C"]').click({ force: true });
		await expect(page.locator('[data-auswahl="form"]')).toHaveCount(0);
		await druecke(c.locator('[data-gliederung-titel]'));
		await expect(page.locator('[data-auswahl="form"]')).toBeVisible();
		await expect(c.locator('[data-gliederung-titel]')).toHaveAttribute('aria-current', 'true');
		// Entsperren mit der Taste, während C gewählt ist.
		await page.keyboard.press('Alt+Shift+KeyL');
		await expect.poll(() => quelle(page)).not.toContain('data-gesperrt');
	});

	test('Umbenennen per Doppelklick, leer gibt den Namen frei', async ({ hasTouch, page }) => {
		test.skip(hasTouch, 'Doppelklick mit der Maus');
		await blatt(page);
		await zeileVon(page, 'B').locator('[data-gliederung-titel]').dblclick();
		const feld = page.locator('[data-umbenennen]');
		await expect(feld).toBeFocused();
		await feld.fill('Sonne');
		await feld.press('Enter');
		await expect.poll(() => quelle(page)).toContain('data-name="Sonne"');
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Umbenannt');
		await zeileVon(page, 'Sonne').locator('[data-gliederung-titel]').dblclick();
		await page.locator('[data-umbenennen]').fill('');
		await page.locator('[data-umbenennen]').press('Enter');
		await expect.poll(() => quelle(page)).not.toContain('data-name="Sonne"');
		await expect(page.locator('[data-zeilen-art="vorne"]').filter({ hasText: /^Kreis/ })).toHaveCount(1);
	});

	test('iPad: Auge und Schloss stehen im ⋯ der Zeile', async ({ druecke, page }) => {
		test.skip(test.info().project.name !== 'ipad-quer', 'nur am iPad');
		await blatt(page);
		const a = zeileVon(page, 'A');
		await expect(a.locator('[data-ebenen-zeichen="auge"]')).toBeHidden();
		await druecke(a.getByRole('button', { name: 'A: mehr' }));
		await expect(page.getByRole('menuitem', { name: 'Ausblenden' })).toBeVisible();
		await expect(page.getByRole('menuitem', { name: 'Sperren' })).toBeVisible();
		await druecke(page.getByRole('menuitem', { name: 'Sperren' }));
		await expect.poll(() => quelle(page)).toContain('data-name="A" data-gesperrt');
		await expect(a.locator('[data-ebenen-zeichen="schloss"]')).toBeVisible();
	});
});
