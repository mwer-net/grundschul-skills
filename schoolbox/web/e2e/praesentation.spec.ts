import type { Frame, Locator, Page } from '@playwright/test';

import { expect, legeMappeAn, test } from './hilfe';

/** Der Kartoffel-Kreisinput aus der Vorlage: Folie 3 mit drei Schritten, 4 mit Aufdecken, 5 mit Timer, 6 mit Schritt. */
const kreisinput = () =>
	legeMappeAn('Kartoffeln', 'sachunterricht', 3, [
		{ titel: 'Kreisinput Kartoffel', art: 'praesentation', format: 'folie', vorlage: 'praesentation' },
		{ titel: 'Teile der Kartoffel' },
	]);

const starte = async (page: Page, druecke: (ziel: Locator) => Promise<void>) => {
	await expect(page.getByText('Alles geladen.')).toBeVisible();
	await druecke(page.getByRole('button', { name: 'Präsentation starten' }));
	await expect(page.getByRole('toolbar', { name: 'Präsentation steuern' })).toBeAttached();
	return page.frameLocator('iframe');
};

const folienFenster = (page: Page): Frame => {
	const fenster = page.frames().find((f) => f.url().includes('praesentation=1'));
	if (!fenster) {
		throw new Error('Kein Iframe mit den Folien');
	}
	return fenster;
};

const gehe = (page: Page, folie: number) =>
	folienFenster(page).evaluate((n) => {
		(window as unknown as { praesentation: { gehe: (n: number) => void } }).praesentation.gehe(n);
	}, folie);

/** Wischen mit dem Finger: Playwright kennt keine Wischgeste, also Pointer-Ereignisse wie in Safari. */
const wischeMitFinger = (page: Page, dx: number) =>
	folienFenster(page).evaluate((weg) => {
		const ziel = document.elementFromPoint(innerWidth / 2, innerHeight / 2) ?? document.body;
		const punkt = (x: number) =>
			({
				pointerId: 7,
				isPrimary: true,
				pointerType: 'touch',
				clientX: x,
				clientY: innerHeight / 2,
				bubbles: true,
			}) as const;
		ziel.dispatchEvent(new PointerEvent('pointerdown', punkt(innerWidth / 2)));
		ziel.dispatchEvent(new PointerEvent('pointermove', punkt(innerWidth / 2 + weg / 2)));
		ziel.dispatchEvent(new PointerEvent('pointerup', punkt(innerWidth / 2 + weg)));
	}, dx);

test.describe('Präsentation', () => {
	test('Tasten und Klicker: Schritte, Aufdecken, Folien; Zurück stellt den vorigen Zustand genau her', async ({
		druecke,
		page,
	}) => {
		const { dokumente, id } = await kreisinput();
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await druecke(page.getByRole('link', { name: 'Präsentieren' }));
		await expect(page).toHaveURL(new RegExp(`/m/${id}/${dokumente[0]}/praesentation$`));
		await expect(page.getByText('Präsentation · 6 Folien')).toBeVisible();
		const folie = await starte(page, druecke);
		const nummer = folie.locator('.praesentation-nummer');
		await expect(folie.locator('.seite.aktiv h1')).toHaveText('Was passiert mit dieser Kartoffel?');
		await expect(nummer).toHaveText('1 / 6');
		await expect(folie.locator('.seite >> visible=true')).toHaveCount(1);
		await expect(folie.locator('.notiz >> visible=true')).toHaveCount(0);

		await page.keyboard.press('ArrowRight');
		await expect(nummer).toHaveText('2 / 6');
		await page.keyboard.press('PageDown');
		await expect(nummer).toHaveText('3 / 6');
		const schritte = folie.locator('.seite.aktiv [data-schritt]');
		await expect(schritte).toHaveCount(3);
		for (const i of [0, 1, 2]) {
			await expect(schritte.nth(i)).toBeHidden();
		}
		await page.keyboard.press('Space');
		await expect(schritte.nth(0)).toBeVisible();
		await expect(schritte.nth(1)).toBeHidden();
		await page.keyboard.press('Enter');
		await expect(schritte.nth(1)).toBeVisible();
		await page.keyboard.press('ArrowDown');
		await expect(schritte.nth(2)).toBeVisible();
		await expect(nummer).toHaveText('3 / 6');

		await page.keyboard.press('ArrowRight');
		await expect(nummer).toHaveText('4 / 6');
		const loesung = folie.locator('.seite.aktiv .aufdecken');
		await expect(loesung).toHaveClass(/\bzu\b/);
		await page.keyboard.press('ArrowRight');
		await expect(loesung).not.toHaveClass(/\bzu\b/);
		await expect(nummer).toHaveText('4 / 6');
		await page.keyboard.press('ArrowRight');
		await expect(nummer).toHaveText('5 / 6');

		// Zurück: jede Folie steht wieder so da, wie sie verlassen wurde, dann geht es Schritt für Schritt zurück
		await page.keyboard.press('Backspace');
		await expect(nummer).toHaveText('4 / 6');
		await expect(loesung).not.toHaveClass(/\bzu\b/);
		await page.keyboard.press('ArrowLeft');
		await expect(loesung).toHaveClass(/\bzu\b/);
		await page.keyboard.press('ArrowLeft');
		await expect(nummer).toHaveText('3 / 6');
		for (const i of [0, 1, 2]) {
			await expect(schritte.nth(i)).toBeVisible();
		}
		await page.keyboard.press('PageUp');
		await expect(schritte.nth(2)).toBeHidden();
		await expect(schritte.nth(1)).toBeVisible();

		await page.keyboard.press('End');
		await expect(nummer).toHaveText('6 / 6');
		await expect(folie.locator('.seite.aktiv [data-schritt]')).toBeHidden();
		await page.keyboard.press('Home');
		await expect(nummer).toHaveText('1 / 6');

		const schwarz = folie.locator('.praesentation-schwarz');
		await page.keyboard.press('b');
		await expect(schwarz).toBeVisible();
		await page.keyboard.press('.');
		await expect(schwarz).toBeHidden();

		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(new RegExp(`/m/${id}/${dokumente[0]}$`));
	});

	test('Antippen, Wischen, Aufdecken und Timer', async ({ druecke, hasTouch, page }) => {
		await page.clock.install();
		const { dokumente, id } = await kreisinput();
		await page.goto(`/m/${id}/${dokumente[0]}/praesentation`);
		const folie = await starte(page, druecke);
		const nummer = folie.locator('.praesentation-nummer');
		const { height, width } = page.viewportSize() ?? { width: 0, height: 0 };
		const tippe = (x: number) =>
			hasTouch ? page.touchscreen.tap(x, height * 0.4) : page.mouse.click(x, height * 0.4);

		await tippe(width * 0.8);
		await expect(nummer).toHaveText('2 / 6');
		await tippe(width * 0.15);
		await expect(nummer).toHaveText('1 / 6');

		if (hasTouch) {
			await wischeMitFinger(page, -300);
			await expect(nummer).toHaveText('2 / 6');
			await wischeMitFinger(page, 300);
		} else {
			// Mit der Maus gezogen: zählt als Wischen, nicht zusätzlich als Antippen.
			await page.mouse.move(width * 0.7, height * 0.4);
			await page.mouse.down();
			await page.mouse.move(width * 0.5, height * 0.4, { steps: 4 });
			await page.mouse.up();
			await expect(nummer).toHaveText('2 / 6');
			await page.mouse.move(width * 0.3, height * 0.4);
			await page.mouse.down();
			await page.mouse.move(width * 0.6, height * 0.4, { steps: 4 });
			await page.mouse.up();
		}
		await expect(nummer).toHaveText('1 / 6');

		await gehe(page, 4);
		const loesung = folie.locator('.seite.aktiv .aufdecken');
		await expect(loesung).toHaveClass(/\bzu\b/);
		await druecke(loesung);
		await expect(loesung).not.toHaveClass(/\bzu\b/);
		await druecke(loesung);
		await expect(nummer).toHaveText('4 / 6');

		await gehe(page, 5);
		const timer = folie.locator('.seite.aktiv x-timer');
		const text = timer.locator('.timer-text');
		await expect(text).toHaveText('25 Minuten');
		await druecke(timer);
		await expect(timer).toHaveAttribute('data-zustand', 'laeuft');
		await expect(nummer).toHaveText('5 / 6');
		await page.clock.fastForward('10:00');
		await expect(text).toHaveText('noch 15 Minuten');
		await druecke(timer);
		await expect(text).toHaveText('Pause');
		await page.clock.fastForward('05:00');
		await druecke(timer);
		await expect(text).toHaveText('noch 15 Minuten');
		await expect(timer).not.toHaveClass(/letzte-minute/);
		await page.clock.fastForward('14:30');
		await expect(text).toHaveText('noch 1 Minute');
		await expect(timer).toHaveClass(/letzte-minute/);
		await page.clock.fastForward('01:00');
		await expect(text).toHaveText('Die Zeit ist um.');
		await expect(timer).toHaveAttribute('data-zustand', 'um');
		await druecke(timer);
		await expect(text).toHaveText('25 Minuten');
	});

	test('läuft nach dem Start ohne Netz bis zum Ende', async ({ context, druecke, page }) => {
		const { dokumente, id } = await kreisinput();
		await page.goto(`/m/${id}/${dokumente[0]}/praesentation`);
		const folie = await starte(page, druecke);
		const fehlgeschlagen: string[] = [];
		page.on('requestfailed', (anfrage) => fehlgeschlagen.push(anfrage.url()));
		await context.setOffline(true);

		// 1 → 2 → 3 (drei Schritte) → 4 (Aufdecken) → 5 → 6 (ein Schritt)
		for (let i = 0; i < 10; i++) {
			await page.keyboard.press('ArrowRight');
		}
		await expect(folie.locator('.praesentation-nummer')).toHaveText('6 / 6');
		await expect(folie.locator('.seite.aktiv [data-schritt]')).toBeVisible();
		const geladen = await folienFenster(page).evaluate(
			() =>
				[...document.querySelectorAll('img')].every((bild) => bild.complete && bild.naturalWidth > 0) &&
				document.fonts.check('700 40px Andika') &&
				document.fonts.check('600 64px Fredoka'),
		);
		expect(geladen).toBe(true);
		expect(fehlgeschlagen).toEqual([]);
		await context.setOffline(false);
	});

	test('Teilen-Links öffnen die Präsentation ohne Anmeldung; Präsentieren gibt es nur für Folien', async ({
		browser,
		druecke,
		page,
	}) => {
		const { dokumente, id } = await kreisinput();
		const teile = async (dok?: string) => {
			const antwort = await page.request.post('/api/freigaben', {
				headers: { 'x-schoolbox': '1' },
				data: dok ? { mappe: id, dok } : { mappe: id },
			});
			expect(antwort.status()).toBe(201);
			return ((await antwort.json()) as { token: string }).token;
		};
		const dokLink = await teile(dokumente[0]);
		const mappenLink = await teile();

		const fremd = await browser.newContext({ hasTouch: test.info().project.use.hasTouch });
		const besuch = await fremd.newPage();
		await besuch.goto(`/f/${dokLink}`);
		await druecke(besuch.getByRole('link', { name: 'Präsentieren' }));
		await expect(besuch).toHaveURL(new RegExp(`/f/${dokLink}/d/${dokumente[0]}/praesentation$`));
		const folie = await starte(besuch, druecke);
		await besuch.keyboard.press('ArrowRight');
		await expect(folie.locator('.praesentation-nummer')).toHaveText('2 / 6');
		await besuch.goto(`/f/${dokLink}/praesentation`);
		await expect(besuch.getByRole('button', { name: 'Präsentation starten' })).toBeVisible();

		await besuch.goto(`/f/${mappenLink}`);
		const kacheln = besuch.locator('[data-dokument]');
		await expect(kacheln.nth(0).getByRole('link', { name: 'Präsentieren' })).toBeVisible();
		await expect(kacheln.nth(1).getByRole('link', { name: 'Ansehen' })).toBeVisible();
		await expect(kacheln.nth(1).getByRole('link', { name: 'Präsentieren' })).toHaveCount(0);
		await druecke(kacheln.nth(0).getByRole('link', { name: 'Präsentieren' }));
		await starte(besuch, druecke);
		await fremd.close();
	});
});
