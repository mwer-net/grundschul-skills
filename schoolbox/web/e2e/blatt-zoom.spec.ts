/**
 * Zoomen zoomt das Blatt, nicht die Oberfläche (184, Entscheidung 56). Playwright kann nicht aufziehen (WebKit-Bug
 * 256157): Die Tests schicken `gesture*` selbst an das Element unter dem Punkt, wie Safari es täte, im Rahmen mit
 * dessen unskalierten Koordinaten.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { material, oeffne, uhrzeit } from './editorhilfe';
import { blattMit, FORM } from './gestaltung-daten';
import { expect, test } from './hilfe';

const MAUS = ['chromium', 'mac-safari'];
const SPEICHER = 'schoolbox-blatt-zoom';

interface Punkt {
	x: number;
	y: number;
}

const wert = (page: Page) => page.locator('[data-zoom-wert]');
const prozent = async (page: Page) => parseInt((await wert(page).textContent()) ?? '0', 10);
const rahmen = (page: Page) => page.locator('[data-editor-rahmen="sichtbar"]');
const flaeche = (page: Page) => page.locator('main');
const gemerkt = (page: Page, schluessel: string) => page.evaluate((k) => localStorage.getItem(k), schluessel);

const blatt = async (page: Page) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
};

const neuLaden = async (page: Page) => {
	await page.reload();
	await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
};

/** Zwei Bilder warten: Erst dann kennt die Leinwand den Rollstand. */
const zweiBilder = (page: Page) =>
	page.evaluate(
		() =>
			new Promise((weiter) => {
				requestAnimationFrame(() => requestAnimationFrame(weiter));
			}),
	);

const mitte = async (ziel: Locator): Promise<Punkt> => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const nah = (ist: Punkt, soll: Punkt, toleranz: number) => {
	expect(Math.abs(ist.x - soll.x)).toBeLessThanOrEqual(toleranz);
	expect(Math.abs(ist.y - soll.y)).toBeLessThanOrEqual(toleranz);
};

/** Schickt die Ereignisse an das Element unter (x, y); gibt `defaultPrevented` je Ereignis zurück. */
const gesten = (page: Page, x: number, y: number, folge: [string, number][]) =>
	page.evaluate(
		({ folge: liste, x: px, y: py }) => {
			let ziel: Element | null = document.elementFromPoint(px, py);
			let punkt = { x: px, y: py };
			if (ziel instanceof HTMLIFrameElement && ziel.contentDocument) {
				const r = ziel.getBoundingClientRect();
				const skala = r.width / ziel.offsetWidth;
				punkt = { x: (px - r.left) / skala, y: (py - r.top) / skala };
				ziel = ziel.contentDocument.elementFromPoint(punkt.x, punkt.y) ?? ziel.contentDocument.documentElement;
			}
			return liste.map(([typ, scale]) => {
				const e = new Event(typ, { bubbles: true, cancelable: true });
				Object.assign(e, { scale, clientX: punkt.x, clientY: punkt.y });
				ziel?.dispatchEvent(e);
				return e.defaultPrevented;
			});
		},
		{ folge, x, y },
	);

/** Aufziehen in Safari: Start, je Faktor ein Wechsel, Ende. */
const geste = (page: Page, x: number, y: number, faktoren: number[]) =>
	gesten(page, x, y, [
		['gesturestart', 1],
		...faktoren.map((f): [string, number] => ['gesturechange', f]),
		['gestureend', faktoren.at(-1) ?? 1],
	]);

/** Strg+Rad, wie Chrome und Firefox das Aufziehen am Trackpad schicken. */
const radMitStrg = async (page: Page, x: number, y: number, deltaY: number, n: number) => {
	await page.mouse.move(x, y);
	await page.keyboard.down('Control');
	for (let i = 0; i < n; i++) {
		await page.mouse.wheel(0, deltaY);
	}
	await page.keyboard.up('Control');
};

/** Ein Strg+Rad, das der Test selbst schickt: `true`, wenn jemand es abfängt. */
const eigenesRad = (page: Page, x: number, y: number) =>
	page.evaluate(
		({ x: px, y: py }) => {
			const e = new WheelEvent('wheel', {
				bubbles: true,
				cancelable: true,
				ctrlKey: true,
				deltaY: -10,
				clientX: px,
				clientY: py,
			});
			(document.elementFromPoint(px, py) ?? document.body).dispatchEvent(e);
			return e.defaultPrevented;
		},
		{ x, y },
	);

/** Die Stelle des Blatts unter einem Punkt am Bildschirm, in Pixeln des Blatts. */
const stelle = (page: Page, p: Punkt) =>
	rahmen(page).evaluate((f, q) => {
		const r = f.getBoundingClientRect();
		const s = r.width / (f as HTMLElement).offsetWidth;
		return { x: (q.x - r.left) / s, y: (q.y - r.top) / s };
	}, p);

/** Wo diese Stelle des Blatts jetzt am Bildschirm steht. */
const amSchirm = (page: Page, b: Punkt) =>
	rahmen(page).evaluate((f, q) => {
		const r = f.getBoundingClientRect();
		const s = r.width / (f as HTMLElement).offsetWidth;
		return { x: r.left + q.x * s, y: r.top + q.y * s };
	}, b);

/** Ob das Element senkrecht in der Fläche des Blatts zu sehen ist. */
const imBild = async (page: Page, ziel: Locator) => {
	const a = await ziel.boundingBox();
	const m = await flaeche(page).boundingBox();
	return Boolean(a && m && a.y < m.y + m.height && a.y + a.height > m.y);
};

/** Merkt am Fenster (Bubble-Phase) je Zoom-Taste, ob sie abgefangen ist. */
const lauscheTasten = (page: Page) =>
	page.evaluate(() => {
		const w = window as unknown as { zoomTasten: boolean[] };
		w.zoomTasten = [];
		window.addEventListener('keydown', (e) => {
			if ((e.metaKey || e.ctrlKey) && (['+', '-'].includes(e.key) || e.code === 'Digit0')) {
				setTimeout(() => w.zoomTasten.push(e.defaultPrevented));
			}
		});
	});
const abgefangen = (page: Page) => page.evaluate(() => (window as unknown as { zoomTasten: boolean[] }).zoomTasten);

test.describe('Zoom nur das Blatt (184)', () => {
	test.describe('am Mac', () => {
		test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit Maus und Trackpad');
		test.beforeEach(async ({ page }) => {
			await page.setViewportSize({ width: 1512, height: 982 });
		});

		test('Aufziehen über dem Blatt zoomt nur das Blatt, die Stelle unter dem Zeiger bleibt', async ({ page }) => {
			await blatt(page);
			await expect(wert(page)).toHaveText('100 %');
			// Die Mitte der ersten Anweisung, nicht ihre Nummer: Links davon kappt der Browser das Rollen bei 0.
			const text = material(page).locator('.aufgabe .anw .text').first();
			const vorher = await mitte(text);
			expect(await geste(page, vorher.x, vorher.y, [1.2, 1.4, 1.6])).toEqual([true, true, true, true, true]);
			await expect(wert(page)).toHaveText('160 %');
			nah(await mitte(text), vorher, 3);
			expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
		});

		test('Strg+Rad zoomt um den Zeiger, ohne Strg rollt das Rad', async ({ page }) => {
			await blatt(page);
			// Bei 125 % kann das Rollen den Anker auch nach links und oben halten.
			await page.getByRole('button', { name: 'Größer' }).click();
			await expect(wert(page)).toHaveText('125 %');
			const m = await mitte(flaeche(page));
			const p = { x: m.x + 40, y: m.y - 30 };
			const vorher = await stelle(page, p);
			await radMitStrg(page, p.x, p.y, -10, 4);
			await expect.poll(() => prozent(page)).toBeGreaterThan(125);
			// Kommen die Räder unter Last weiter auseinander als `RAD_ENDE_MS`, endet die Geste mehrmals: Der letzte Wert zählt.
			let zuletzt = '';
			await expect
				.poll(
					async () => {
						const neu = (await wert(page).textContent()) ?? '';
						const fest = neu === zuletzt;
						zuletzt = neu;
						return fest;
					},
					{ intervals: [500] },
				)
				.toBe(true);
			nah(await amSchirm(page, vorher), p, 3);

			const jetzt = zuletzt;
			const oben = await flaeche(page).evaluate((e) => e.scrollTop);
			await page.mouse.wheel(0, 120);
			await expect.poll(() => flaeche(page).evaluate((e) => e.scrollTop)).toBeGreaterThan(oben);
			await expect(wert(page)).toHaveText(jetzt);
		});

		test('Nahe einer Stufe rastet die Geste ein', async ({ page }) => {
			await blatt(page);
			const p = await mitte(flaeche(page));
			await geste(page, p.x, p.y, [0.9, 0.99]);
			await expect.poll(() => gemerkt(page, SPEICHER)).toBe('1');
			await expect(wert(page)).toHaveText('100 %');
			expect(Math.round((await rahmen(page).boundingBox())?.width ?? 0)).toBe(826);
		});

		test('Über Ebenen und Inspektor zoomt nichts, abgefangen ist es trotzdem', async ({ page }) => {
			await blatt(page);
			for (const ort of [page.locator('[data-panel-links="ebenen"]'), page.locator('aside[data-panel]')]) {
				const p = await mitte(ort);
				expect(await geste(page, p.x, p.y, [1.5])).toEqual([true, true, true]);
				expect(await eigenesRad(page, p.x, p.y)).toBe(true);
			}
			await expect(wert(page)).toHaveText('100 %');
			expect(await gemerkt(page, SPEICHER)).toBeNull();
			// Gegenprobe neben dem Blatt, noch in `main`: Hätte eines davon gezoomt, stünde hier nicht 150 %.
			const leinwand = await page.locator('[data-leinwand]').boundingBox();
			await geste(page, (leinwand?.x ?? 0) + 20, (leinwand?.y ?? 0) + 300, [1.5]);
			await expect(wert(page)).toHaveText('150 %');
		});

		test('Prozentwert und Speicher ändern sich erst am Ende der Geste', async ({ page }) => {
			await blatt(page);
			const p = await mitte(flaeche(page));
			const breite = (await rahmen(page).boundingBox())?.width ?? 0;
			expect(
				await gesten(page, p.x, p.y, [
					['gesturestart', 1],
					['gesturechange', 1.5],
				]),
			).toEqual([true, true]);
			await expect.poll(async () => (await rahmen(page).boundingBox())?.width ?? 0).toBeGreaterThan(breite * 1.4);
			await expect(wert(page)).toHaveText('100 %');
			expect(await gemerkt(page, SPEICHER)).toBeNull();
			expect(await gesten(page, p.x, p.y, [['gestureend', 1.5]])).toEqual([true]);
			await expect(wert(page)).toHaveText('150 %');
			expect(await gemerkt(page, SPEICHER)).toBe('1.5');
		});

		test('⌘+, ⌘- und ⌘0 zoomen das Blatt, auch beim Tippen; bei offenem Menü sind sie abgefangen', async ({
			page,
		}) => {
			await blatt(page);
			await lauscheTasten(page);
			// Auf der US-Tastatur von Playwright ist „+“ Shift+Equal.
			await page.keyboard.press('ControlOrMeta+Shift+Equal');
			await expect(wert(page)).toHaveText('125 %');
			await page.keyboard.press('ControlOrMeta+Minus');
			await expect(wert(page)).toHaveText('100 %');
			await page.keyboard.press('ControlOrMeta+Minus');
			await expect(wert(page)).toHaveText('75 %');
			await page.keyboard.press('ControlOrMeta+Digit0');
			await expect(wert(page)).toHaveText('100 %');
			await expect.poll(() => abgefangen(page)).toEqual([true, true, true, true]);

			const titel = material(page).locator('h1');
			await titel.click();
			await expect(titel).toHaveAttribute('contenteditable', 'true');
			await titel.click();
			await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
			const text = (await titel.textContent()) ?? '';
			await page.keyboard.press('ControlOrMeta+Shift+Equal');
			await expect(wert(page)).toHaveText('125 %');
			await expect(titel).toHaveText(text);
			await expect(page.locator('[data-textbearbeitung]')).toBeVisible();
			// Gegenprobe: Ohne ⌘ ist „+“ ein Zeichen.
			await page.keyboard.type('+');
			await expect.poll(async () => ((await titel.textContent()) ?? '').length).toBe(text.length + 1);
			await expect(titel).toContainText('+');
			await expect(wert(page)).toHaveText('125 %');
			await page.keyboard.press('ControlOrMeta+KeyZ');
			await expect(titel).toHaveText(text);
			await page.keyboard.press('Escape');
			await expect(page.locator('[data-textbearbeitung]')).toHaveCount(0);

			await page.keyboard.press('ControlOrMeta+KeyK');
			await expect(page.locator('[data-befehlspalette]')).toBeVisible();
			const bisher = (await abgefangen(page)).length;
			await page.keyboard.press('ControlOrMeta+Shift+Equal');
			await expect.poll(async () => (await abgefangen(page)).slice(bisher)).toEqual([true]);
			await expect(wert(page)).toHaveText('125 %');
		});

		test('Knöpfe zoomen um die Mitte der Fläche', async ({ page }) => {
			await blatt(page);
			await flaeche(page).evaluate((e) => {
				e.scrollTop = (e.scrollHeight - e.clientHeight) / 2;
			});
			await zweiBilder(page);
			const m = await mitte(flaeche(page));
			const kasten = await flaeche(page).boundingBox();
			const obenAmRand = { x: m.x, y: (kasten?.y ?? 0) + 20 };
			const inDerMitte = await stelle(page, m);
			const amRand = await stelle(page, obenAmRand);
			await page.getByRole('button', { name: 'Größer' }).click();
			await expect(wert(page)).toHaveText('125 %');
			nah(await amSchirm(page, inDerMitte), m, 8);
			// Gegenprobe: Was am Rand stand, wandert.
			expect(Math.abs((await amSchirm(page, amRand)).y - obenAmRand.y)).toBeGreaterThan(50);
		});

		test('Verkleinern am Ende verliert die Stelle nicht', async ({ page }) => {
			await blatt(page);
			for (const soll of ['125 %', '150 %', '200 %']) {
				await page.keyboard.press('ControlOrMeta+Shift+Equal');
				await expect(wert(page)).toHaveText(soll);
			}
			await flaeche(page).evaluate((e) => {
				e.scrollTop = e.scrollHeight;
			});
			await zweiBilder(page);
			const letzte = material(page).locator('.aufgabe').last();
			expect(await imBild(page, letzte)).toBe(true);
			await page.keyboard.press('ControlOrMeta+Minus');
			await expect(wert(page)).toHaveText('150 %');
			expect(await imBild(page, letzte)).toBe(true);
		});

		test('Der Zoom wird je Gerät gemerkt, ein altes „Einpassen“ wird übernommen', async ({ page }) => {
			await blatt(page);
			const p = await mitte(flaeche(page));
			await geste(page, p.x, p.y, [1.3, 1.6]);
			await expect(wert(page)).toHaveText('160 %');
			await neuLaden(page);
			await expect(wert(page)).toHaveText('160 %');

			const einpassen = page.getByRole('button', { name: 'Einpassen' });
			await page.evaluate((neu) => {
				localStorage.removeItem(neu);
				localStorage.setItem('schoolbox-zoom', 'einpassen');
			}, SPEICHER);
			await neuLaden(page);
			await expect(einpassen).toHaveAttribute('aria-pressed', 'true');
			await page.getByRole('button', { name: 'Größer' }).click();
			await expect(einpassen).toHaveAttribute('aria-pressed', 'false');
			expect(await gemerkt(page, 'schoolbox-zoom')).toBeNull();

			// Gegenprobe: Eine alte Stufe hing an der Fensterbreite; das Blatt startet wie auf einem neuen Gerät.
			await page.evaluate((neu) => {
				localStorage.removeItem(neu);
				localStorage.setItem('schoolbox-zoom', '1.5');
			}, SPEICHER);
			await neuLaden(page);
			await expect(wert(page)).toHaveText('100 %');
			await expect(einpassen).toHaveAttribute('aria-pressed', 'false');
		});

		test('„Auf 100 %“ zeigt 100 %, auch mit Ebenen und Schublade (183)', async ({ page }) => {
			await blatt(page);
			await page.keyboard.press('Alt+Digit2');
			await expect(page.locator('[data-panel-links="bausteine"]')).toBeVisible();
			await expect(wert(page)).toHaveText('81 %');
			await wert(page).click();
			await expect(wert(page)).toHaveText('100 %');
			await expect
				.poll(async () => Math.abs(((await rahmen(page).boundingBox())?.width ?? 0) - 826))
				.toBeLessThanOrEqual(2);
		});

		test('Solange eine Gestaltung gezogen wird, zoomt Aufziehen nicht', async ({ page }) => {
			const { dok, id, material: datei } = await uhrzeit();
			await writeFile(datei, blattMit({ vorne: [FORM] }));
			await oeffne(page, id, dok);
			const html = material(page).locator('html');
			const von = await mitte(material(page).locator('svg.form[data-form="stern"]'));
			const p = await mitte(flaeche(page));
			await page.mouse.move(von.x, von.y);
			await page.mouse.down();
			await page.mouse.move(von.x + 10, von.y + 10, { steps: 4 });
			await page.mouse.move(von.x + 20, von.y + 20, { steps: 4 });
			await expect(html).toHaveAttribute('data-geste-laeuft', '');
			expect(await geste(page, p.x, p.y, [1.5])).toEqual([true, true, true]);
			await page.mouse.up();
			await expect(html).not.toHaveAttribute('data-geste-laeuft');
			await expect(wert(page)).toHaveText('100 %');
			await geste(page, p.x, p.y, [1.5]);
			await expect(wert(page)).toHaveText('150 %');
		});

		test('In der Ablage bleibt der Browser-Zoom unberührt', async ({ page }) => {
			await page.goto('/');
			await expect(page.getByPlaceholder('Material und Ordner suchen')).toBeVisible();
			await lauscheTasten(page);
			await page.keyboard.press('ControlOrMeta+Shift+Equal');
			await expect.poll(() => abgefangen(page)).toEqual([false]);
			expect(await eigenesRad(page, 600, 400)).toBe(false);
		});
	});

	test.describe('am iPad quer', () => {
		test.skip(() => test.info().project.name !== 'ipad-quer', 'ein iPad genügt');

		test('`touch-action` ist im Blatt `pan-x pan-y`', async ({ page }) => {
			await blatt(page);
			expect(await flaeche(page).evaluate((e) => getComputedStyle(e).touchAction)).toBe('pan-x pan-y');
			expect(
				await material(page)
					.locator('html')
					.evaluate((e) => getComputedStyle(e).touchAction),
			).toBe('pan-x pan-y');
		});

		test('Eine Geste zoomt das Blatt, danach wählt Antippen', async ({ page }) => {
			await blatt(page);
			const vorher = await prozent(page);
			const p = await mitte(flaeche(page));
			expect(await geste(page, p.x, p.y, [1.1, 1.3])).toEqual([true, true, true, true]);
			await expect.poll(() => prozent(page)).toBeGreaterThan(vorher);
			await material(page).locator('.aufgabe').first().tap();
			await expect(page.locator('[data-bausteinleiste]')).toBeVisible();
		});
	});
});
