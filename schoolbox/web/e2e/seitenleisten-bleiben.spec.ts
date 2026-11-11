/**
 * 171: Die Seitenleisten zeigen, was das Blatt zeigt, bis das nächste Bild da ist. Beim Drehen, bei Feldern, Füllung,
 * Schatten, Aufgabe und ⌘Z wird im Inspektor, in den Ebenen und in der Bausteinleiste nichts ersetzt; der Reiter bleibt
 * auf „Auswahl“, und „Drehung“ läuft während der Geste mit. Geschrieben wird ein Schritt beim Loslassen, Esc schreibt
 * nichts. Nach einem Strukturschritt (⌘D) wechselt die Auswahl erst mit dem neuen Bild.
 */
import { writeFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import { blattMit, FORM } from './gestaltung-daten';
import { expect, test } from './hilfe';

const MAUS = ['chromium', 'mac-safari'];

type Druecke = (ziel: Locator) => Promise<void>;
type Bereich = 'inspektor' | 'ebenen' | 'bausteinleiste';

interface Probe {
	/** Ist schon das neue Bild zu sehen? */
	neu: boolean;
	/** `data-zeile-nr` der markierten Zeile in den Ebenen. */
	zeile: string | null;
	/** Der Pfad über dem Inspektor. */
	pfad: string;
}

interface Befund {
	/** Entfernte Elemente samt Inhalt; Textknoten und Hinweise zählen nicht. */
	entfernt: Record<Bereich, number>;
	nichtAuswahl: boolean;
	wenigerAbschnitte: boolean;
	ohneMarkierung: boolean;
	proben: Probe[];
}

interface Beobachtung {
	befund: Befund;
	fertig: boolean;
	stopp: () => void;
}

type Fenster = Window & { schoolboxBeobachtung?: Beobachtung };

/**
 * Hängt vor der Aktion Beobachter an die rechte Seitenleiste, die Ebenen und, falls da, die Bausteinleiste und tastet
 * bei jeder Änderung und je Bild ab. Die zurückgegebene Funktion wartet, bis das neue Bild steht, und liefert den
 * Befund.
 */
const beobachte = async (page: Page) => {
	await page.evaluate(() => {
		const orte: Record<Bereich, string> = {
			inspektor: '[data-panel]',
			ebenen: '[data-gliederung]',
			bausteinleiste: '[data-bausteinleiste]',
		};
		const abschnitte = () =>
			document.querySelectorAll('[data-panel] [data-abschnitt]:not([data-abschnitt="hinweise"])').length;
		const anfang = abschnitte();
		const altesBild = document.querySelector('[data-editor-rahmen="sichtbar"]');
		const befund: Befund = {
			entfernt: { inspektor: 0, ebenen: 0, bausteinleiste: 0 },
			nichtAuswahl: false,
			wenigerAbschnitte: false,
			ohneMarkierung: false,
			proben: [],
		};
		const b: Beobachtung = { befund, fertig: false, stopp: () => undefined };
		const probe = () => {
			const markiert = document.querySelector('[data-gliederung] [aria-current="true"]');
			const neu = document.querySelector('[data-editor-rahmen="sichtbar"]') !== altesBild;
			const reiter = document.querySelector('[data-inspektor]')?.getAttribute('data-inspektor');
			befund.nichtAuswahl ||= reiter !== 'auswahl';
			befund.wenigerAbschnitte ||= abschnitte() < anfang;
			befund.ohneMarkierung ||= markiert === null;
			befund.proben.push({
				neu,
				zeile: markiert?.closest('[data-zeile-nr]')?.getAttribute('data-zeile-nr') ?? null,
				pfad: document.querySelector('[data-breadcrumb]')?.textContent ?? '',
			});
			b.fertig ||= neu && document.querySelector('[data-editor-rahmen="laedt"]') === null;
		};
		const zaehle = (bereich: Bereich) => (liste: MutationRecord[]) => {
			for (const eintrag of liste) {
				const ziel = eintrag.target;
				const inHinweisen = ziel instanceof Element && ziel.closest('[data-abschnitt="hinweise"]') !== null;
				eintrag.removedNodes.forEach((n) => {
					if (!inHinweisen && n instanceof Element && !n.matches('[data-abschnitt="hinweise"]')) {
						befund.entfernt[bereich] += 1 + n.querySelectorAll('*').length;
					}
				});
			}
			probe();
		};
		const beobachter = (Object.entries(orte) as [Bereich, string][]).flatMap(([bereich, wahl]) => {
			const ort = document.querySelector(wahl);
			if (!ort) {
				return [];
			}
			const m = new MutationObserver(zaehle(bereich));
			m.observe(ort, { childList: true, subtree: true });
			return [m];
		});
		// Bildwechsel, Reiter und Markierung auch dort, wo keine Liste sich ändert.
		const ganz = new MutationObserver(probe);
		ganz.observe(document.body, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['data-editor-rahmen', 'data-inspektor', 'aria-current'],
		});
		let laeuft = true;
		const tick = () => {
			if (laeuft) {
				probe();
				requestAnimationFrame(tick);
			}
		};
		requestAnimationFrame(tick);
		b.stopp = () => {
			laeuft = false;
			ganz.disconnect();
			for (const m of beobachter) {
				m.disconnect();
			}
		};
		probe();
		(window as Fenster).schoolboxBeobachtung = b;
	});
	return async () => {
		await expect
			.poll(() => page.evaluate(() => (window as Fenster).schoolboxBeobachtung?.fertig ?? false))
			.toBe(true);
		await geladen(page);
		return page.evaluate(async () => {
			// Was gleich nach dem Bild noch rendert, zählt mit.
			await new Promise((weiter) => {
				requestAnimationFrame(() => requestAnimationFrame(weiter));
			});
			const b = (window as Fenster).schoolboxBeobachtung;
			b?.stopp();
			return b?.befund ?? null;
		});
	};
};

/** Nichts ersetzt, Reiter immer „Auswahl“, kein Abschnitt weniger, die Markierung in den Ebenen immer da. */
const nichtsErsetzt = (befund: Befund | null, bereiche: Bereich[] = ['inspektor', 'ebenen']) => {
	expect(befund).not.toBeNull();
	for (const bereich of bereiche) {
		expect(befund?.entfernt[bereich], `entfernt in ${bereich}`).toBe(0);
	}
	expect(befund?.nichtAuswahl, 'Reiter nicht „Auswahl“').toBe(false);
	expect(befund?.wenigerAbschnitte, 'Abschnitt weg').toBe(false);
	expect(befund?.ohneMarkierung, 'Markierung in den Ebenen weg').toBe(false);
};

const stern = (page: Page) => material(page).locator('svg.form[data-form="stern"]');
const rahmen = (page: Page) => page.locator('[data-gestaltung-rahmen]');
const griff = (page: Page, name: string) => page.locator(`[data-gestaltung-griff="${name}"]`);
const drehung = (page: Page) => page.locator('[data-panel] [data-zahl="Drehung"] input');
const schwarz = (page: Page) => page.locator('[data-panel] [data-form-farben="form-fuellung"] [data-farbe="#000000"]');
/** Der Teil der rechten Seitenleiste, der rollt. */
const rollt = (page: Page) => page.locator('[data-panel] > div').first();
const rollstand = (page: Page) => rollt(page).evaluate((e) => e.scrollTop);
const zurueck = (page: Page) => page.getByRole('button', { name: /^Rückgängig/ }).first();
const zeileJetzt = (page: Page) =>
	page.evaluate(
		() =>
			document
				.querySelector('[data-gliederung] [aria-current="true"]')
				?.closest('[data-zeile-nr]')
				?.getAttribute('data-zeile-nr') ?? null,
	);

const mitte = async (ziel: Locator) => {
	const b = await ziel.boundingBox();
	if (!b) {
		throw new Error('nicht sichtbar');
	}
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/** Das Blatt mit dem Stern aus den Testdaten (`--drehen:12deg`), der Stern gewählt. */
const mitStern = async (page: Page, druecke: Druecke) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit({ vorne: [FORM] }));
	await oeffne(page, u.id, u.dok);
	await geladen(page);
	await druecke(stern(page));
	await expect(page.locator('[data-gestaltung-inspektor="form"]')).toBeVisible();
	await expect(drehung(page)).toHaveValue('12');
};

/** Das Uhrzeit-Blatt, wie es angelegt wird; gewählt ist, was der Pfad über der ersten Uhr `name` nennt. */
const imUhrzeitBlatt = async (page: Page, name: string) => {
	const u = await uhrzeit();
	await oeffne(page, u.id, u.dok);
	await geladen(page);
	await material(page).locator('.reihe').first().locator('x-uhr').first().click();
	await page.locator('[data-breadcrumb]').getByRole('button', { name, exact: true }).click();
	await expect(page.locator('[data-breadcrumb]')).toHaveText(new RegExp(`›${name}$`));
};

/** Dreht den gewählten Stern mit dem Griff um `grad`; `mittendrin` läuft, solange die Taste gedrückt ist. */
const dreheMitGriff = async (page: Page, grad: number, mittendrin?: () => Promise<void>) => {
	const g = await mitte(griff(page, 'drehen'));
	const m = await mitte(rahmen(page));
	const abstand = Math.hypot(g.x - m.x, g.y - m.y);
	const start = Math.atan2(g.y - m.y, g.x - m.x);
	await page.mouse.move(g.x, g.y);
	await page.mouse.down();
	for (const anteil of [0.25, 0.5, 0.75, 1]) {
		const w = start + (grad * anteil * Math.PI) / 180;
		await page.mouse.move(m.x + abstand * Math.cos(w), m.y + abstand * Math.sin(w), { steps: 3 });
	}
	await mittendrin?.();
	await page.mouse.up();
};

/** Fall 2: 30 tippen, ⏎. */
const feldDrehung = async (page: Page, druecke: Druecke) => {
	await mitStern(page, druecke);
	await drehung(page).fill('30');
	const vorher = await rollstand(page);
	const ende = await beobachte(page);
	await drehung(page).press('Enter');
	nichtsErsetzt(await ende());
	expect(await quelle(page)).toContain('--drehen:30deg');
	expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Drehung');
	expect(await rollstand(page)).toBe(vorher);
};

/** Fall 4: andere Füllung, dann ganz unten Schatten „Leicht“. */
const fuellungUndSchatten = async (page: Page, druecke: Druecke) => {
	await mitStern(page, druecke);
	const fuellung = await beobachte(page);
	await druecke(schwarz(page));
	nichtsErsetzt(await fuellung());
	expect(await quelle(page)).not.toContain('fill:var(--akzent)');
	await expect(schwarz(page)).toHaveAttribute('aria-pressed', 'true');

	const leicht = page
		.locator('[data-panel]')
		.getByRole('group', { name: 'Schatten', exact: true })
		.getByRole('button', { name: 'Leicht', exact: true });
	await rollt(page).evaluate((e) => {
		e.scrollTop = e.scrollHeight;
	});
	await leicht.scrollIntoViewIfNeeded();
	const vorher = await rollstand(page);
	const schatten = await beobachte(page);
	await druecke(leicht);
	nichtsErsetzt(await schatten());
	expect(await quelle(page)).toContain('data-schatten="leicht"');
	expect(Math.abs((await rollstand(page)) - vorher)).toBeLessThanOrEqual(1);
};

test.describe('Seitenleisten bleiben beim Bearbeiten stehen (171), mit der Maus', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test('Drehgriff: „Drehung“ läuft mit wie das Schild am Zeiger, danach ist nichts ersetzt', async ({
		druecke,
		page,
	}) => {
		await mitStern(page, druecke);
		const ende = await beobachte(page);
		await dreheMitGriff(page, 45, async () => {
			const schild = await page.locator('[data-wert-am-zeiger]').innerText();
			const amZeiger = Number(schild.trim().replace('−', '-').replace('°', ''));
			expect(amZeiger).not.toBe(12);
			await expect.poll(async () => Math.round(Number(await drehung(page).inputValue()))).toBe(amZeiger);
		});
		nichtsErsetzt(await ende());
		const wert = await drehung(page).inputValue();
		expect(wert).not.toBe('12');
		expect(await quelle(page)).toContain(`--drehen:${wert}deg`);
	});

	test('Feld „Drehung“, ⏎: nichts ersetzt, Fokus und Rollstand bleiben', async ({ druecke, page }) => {
		await feldDrehung(page, druecke);
	});

	test('↑ ↑ schnell im Feld „Drehung“: 14°, zwei Schritte', async ({ druecke, page }) => {
		await mitStern(page, druecke);
		const vorher = await quelle(page);
		await drehung(page).focus();
		await drehung(page).press('ArrowUp');
		await drehung(page).press('ArrowUp');
		await expect.poll(() => quelle(page)).toContain('--drehen:14deg');
		await geladen(page);
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toContain('--drehen:13deg');
		await geladen(page);
		await zurueck(page).click();
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Füllung und Schatten: nichts ersetzt, der Rollstand bleibt', async ({ druecke, page }) => {
		await fuellungUndSchatten(page, druecke);
	});

	test('Sternchenaufgabe umschalten: nichts im Inspektor und in der Bausteinleiste ersetzt', async ({ page }) => {
		await imUhrzeitBlatt(page, 'Aufgabe 1');
		await expect(page.locator('[data-bausteinleiste]')).toBeVisible();
		const schalter = page.locator('[data-panel]').getByRole('switch', { name: 'Sternchenaufgabe' });
		await expect(schalter).not.toBeChecked();
		const ende = await beobachte(page);
		await schalter.click();
		nichtsErsetzt(await ende(), ['inspektor', 'bausteinleiste']);
		await expect(schalter).toBeChecked();
		await expect(page.locator('[data-auswahl="aufgabe"]')).toBeVisible();
	});

	test('Spalten an der Reihe: Reiter bleibt „Auswahl“, kein Abschnitt fehlt, dieselbe Reihe bleibt gewählt', async ({
		page,
	}) => {
		await imUhrzeitBlatt(page, 'Reihe');
		const zeile = await zeileJetzt(page);
		await expect(page.locator('[data-panel] [data-spalten]')).toHaveAttribute('data-spalten', '4');
		const ende = await beobachte(page);
		await page.locator('[data-panel]').getByRole('button', { name: 'Eine Spalte mehr' }).click();
		const befund = await ende();
		expect(befund?.nichtAuswahl).toBe(false);
		expect(befund?.wenigerAbschnitte).toBe(false);
		await expect(page.locator('[data-panel] [data-spalten]')).toHaveAttribute('data-spalten', '5');
		await expect(page.locator('[data-breadcrumb]')).toHaveText(/›Reihe$/);
		expect(await zeileJetzt(page)).toBe(zeile);
	});

	test('⌘Z nach einer Füllung: nichts ersetzt, danach ist die alte Füllung gewählt', async ({ druecke, page }) => {
		await mitStern(page, druecke);
		const vorher = await quelle(page);
		await druecke(schwarz(page));
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await geladen(page);
		const ende = await beobachte(page);
		await page.keyboard.press('ControlOrMeta+z');
		nichtsErsetzt(await ende());
		expect(await quelle(page)).toBe(vorher);
		await expect(page.locator('[data-gestaltung-inspektor="form"]')).toBeVisible();
		await expect(schwarz(page)).toHaveAttribute('aria-pressed', 'false');
	});

	test('⌘D: Beim Nachladen bleibt der Inspektor beim Original, mit dem neuen Bild ist die Kopie gewählt', async ({
		druecke,
		page,
	}) => {
		await mitStern(page, druecke);
		const original = await zeileJetzt(page);
		const pfad = await page.locator('[data-breadcrumb]').textContent();
		expect(original).not.toBeNull();
		const ende = await beobachte(page);
		await page.keyboard.press('ControlOrMeta+d');
		const befund = await ende();
		expect(befund?.nichtAuswahl).toBe(false);
		const proben = befund?.proben ?? [];
		const davor = proben.filter((p) => !p.neu);
		const danach = proben.filter((p) => p.neu);
		expect(davor.length).toBeGreaterThan(0);
		expect(danach.length).toBeGreaterThan(0);
		// Kein Bild mit der falschen Auswahl: vorher das Original, mit dem neuen Bild schon die Kopie.
		expect(davor.every((p) => p.zeile === original && p.pfad === pfad)).toBe(true);
		expect(danach.every((p) => p.zeile !== original)).toBe(true);
		expect((await quelle(page)).split('data-form="stern"')).toHaveLength(3);
		const kopie = await zeileJetzt(page);
		expect(kopie).not.toBeNull();
		expect(kopie).not.toBe(original);
	});

	test('Esc mitten in der Drehung schreibt nichts; ⌘Z nimmt eine ganze Drehung in einem Schritt zurück', async ({
		druecke,
		page,
	}) => {
		await mitStern(page, druecke);
		const vorher = await quelle(page);
		const schritt = await zurueck(page).getAttribute('data-schritt');
		await dreheMitGriff(page, 45, async () => {
			await expect(drehung(page)).not.toHaveValue('12');
			await page.keyboard.press('Escape');
			await expect(drehung(page)).toHaveValue('12');
		});
		await page.waitForTimeout(300);
		expect(await quelle(page)).toBe(vorher);
		expect(await zurueck(page).getAttribute('data-schritt')).toBe(schritt);

		await dreheMitGriff(page, 45);
		await expect.poll(() => quelle(page)).not.toBe(vorher);
		await geladen(page);
		await expect(zurueck(page)).toHaveAttribute('data-schritt', 'Gedreht');
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});
});

test.describe('Seitenleisten bleiben beim Bearbeiten stehen (171), iPad quer', () => {
	test.skip(() => test.info().project.name !== 'ipad-quer', 'nur iPad quer');

	test('Feld „Drehung“, ⏎: nichts ersetzt, Fokus und Rollstand bleiben', async ({ druecke, page }) => {
		await feldDrehung(page, druecke);
	});

	test('Füllung und Schatten: nichts ersetzt, der Rollstand bleibt', async ({ druecke, page }) => {
		await fuellungUndSchatten(page, druecke);
	});
});
