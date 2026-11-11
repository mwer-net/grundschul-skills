/**
 * Kombinieren (121, Briefing 3-formen, Z9): Kreis und Rechteck werden ein Pfad, je ein Schritt. Die Formen-Schere gibt
 * es nicht mehr (173); was sie geschrieben hat, bleibt ein gewöhnlicher Pfad.
 */
import { readFile, writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { geladen, material, oeffne, quelle, uhrzeit } from './editorhilfe';
import type { Einsatz } from './gestaltung-daten';
import { blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const MAUS = ['chromium', 'mac-safari'];

const KREIS =
	'<svg class="form" data-lage="frei" data-name="Kreis" data-form="ellipse" viewBox="0 0 160 160" style="--x:200px;--y:300px;--b:160px;--h:160px">' +
	'<path d="M80 1.5 C123.4 1.5 158.5 36.6 158.5 80 C158.5 123.4 123.4 158.5 80 158.5 C36.6 158.5 1.5 123.4 1.5 80 C1.5 36.6 36.6 1.5 80 1.5 Z" style="fill:#ff0000;stroke:var(--dunkel);stroke-width:3px"/></svg>';
const RECHTECK =
	'<svg class="form" data-lage="frei" data-name="Rechteck" data-form="rechteck" viewBox="0 0 240 200" style="--x:120px;--y:260px;--b:240px;--h:200px">' +
	'<path d="M1.5 1.5 L238.5 1.5 L238.5 198.5 L1.5 198.5 Z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px"/></svg>';
const RECHTS = KREIS.replace('data-name="Kreis"', 'data-name="Rechts"').replace('--x:200px', '--x:300px');

const blatt = async (page: Page, einsatz: Einsatz = { vorne: [RECHTECK, KREIS] }) => {
	const u = await uhrzeit();
	await writeFile(u.material, blattMit(einsatz));
	await oeffne(page, u.id, u.dok);
	return u;
};

const form = (page: Page, name: string) => material(page).locator(`[data-name="${name}"]`);
const pfade = (q: string) => (q.match(/data-form="pfad"/g) ?? []).length;

/** `a` am Rand (das Rechteck liegt teils unter dem Kreis), `b` in der Mitte. */
const waehle = async (page: Page, a: string, b: string) => {
	await form(page, a).click(a === 'Rechteck' ? { position: { x: 15, y: 120 } } : {});
	await form(page, b).click({ modifiers: ['Shift'] });
	await expect(page.locator('[data-gestaltung-rahmen="mehrfach"]')).toHaveAttribute('data-mehrfach-anzahl', '2');
};

const ueberMehr = async (page: Page, befehl: string) => {
	await page
		.locator('[data-gestaltungsleiste="mehrfach"]')
		.getByRole('button', { name: /^Mehr zu/ })
		.click();
	await page.locator(`[data-befehl="${befehl}"]`).click();
};

test.describe('Kombinieren (121)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	test('Vereinen im Inspektor: ein Pfad, ein Schritt, ⌘Z bringt beide zurück', async ({ page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		await waehle(page, 'Rechteck', 'Kreis');
		await page.locator('[data-kombinieren] [data-befehl="auswahl.vereinen"]').click();
		await expect.poll(async () => pfade(await quelle(page))).toBe(1);
		const q = await quelle(page);
		expect(q).not.toContain('data-form="ellipse"');
		expect(q).not.toContain('data-form="rechteck"');
		expect(q).toContain('fill:#ff0000'); // Aussehen der vordersten Form
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});

	test('Abziehen, Schnitt und Ausschluss über das ⋯', async ({ page }) => {
		await blatt(page);
		const vorher = await quelle(page);
		for (const [befehl, evenodd] of [
			['auswahl.abziehen', true],
			['auswahl.schneiden', false],
			['auswahl.ausschliessen', true],
		] as const) {
			await waehle(page, 'Rechteck', 'Kreis');
			await ueberMehr(page, befehl);
			await expect.poll(async () => pfade(await quelle(page))).toBe(1);
			expect((await quelle(page)).includes('fill-rule:evenodd')).toBe(evenodd);
			await geladen(page);
			await page.keyboard.press('ControlOrMeta+z');
			await expect.poll(() => quelle(page)).toBe(vorher);
			await geladen(page);
		}
	});

	test('Form mit Text: Die Knöpfe sind aus und sagen warum', async ({ page }) => {
		const blase =
			'<div class="form-text" data-lage="frei" data-name="Blase" data-form="sprechblase" style="--x:500px;--y:300px;--b:180px;--h:84px">' +
			'<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="2" y="2" width="176" height="80" rx="18" style="fill:#fff;stroke:var(--dunkel);stroke-width:3px"/></svg>' +
			'<div class="form-inhalt">Hallo!</div></div>';
		await blatt(page, { vorne: [KREIS, blase] });
		await waehle(page, 'Kreis', 'Blase');
		await expect(page.locator('[data-kombi-hinweis]')).toHaveText('Nur Formen ohne Text lassen sich kombinieren.');
		await expect(page.locator('[data-kombinieren] [data-befehl="auswahl.vereinen"]')).toBeDisabled();
	});

	test('Leeres Ergebnis ändert nichts und sagt es', async ({ page }) => {
		const weit = KREIS.replace('data-name="Kreis"', 'data-name="Weit"').replace('--x:200px', '--x:520px');
		await blatt(page, { vorne: [RECHTECK, weit] });
		const vorher = await quelle(page);
		await waehle(page, 'Rechteck', 'Weit');
		await page.locator('[data-kombinieren] [data-befehl="auswahl.schneiden"]').click();
		await expect(page.locator('[data-kombi-hinweis]')).toHaveText('Das Ergebnis wäre leer.');
		expect(await quelle(page)).toBe(vorher);
	});

	test('Das Ergebnis lässt sich per Doppelklick wie jeder Pfad bearbeiten', async ({ page }) => {
		await blatt(page);
		await waehle(page, 'Rechteck', 'Kreis');
		await page.locator('[data-kombinieren] [data-befehl="auswahl.abziehen"]').click();
		await expect.poll(async () => pfade(await quelle(page))).toBe(1);
		await geladen(page);
		const pfad = material(page).locator('svg[data-form="pfad"]');
		await pfad.dblclick({ position: { x: 10, y: 10 } });
		await expect(page.locator('[data-pfad-punkt]').first()).toBeVisible();
	});
});

/** Was ein ⌥-Zug der früheren Formen-Schere (121, entfernt in 173) über die Linse zweier Kreise schrieb. */
const SCHERE_MONDE = [
	'<svg class="form" data-lage="frei" data-name="Kreis" data-form="pfad" viewBox="0 0 130 160" style="--x:200px;--y:300px;--b:130px;--h:160px"><path d="M128.5 18.89 C89.83 48.18 89.83 111.82 128.5 141.11 C117.29 149.6 105.27 155.58 91.22 157.65 C79.81 159.33 68.11 158.5 57.07 155.18 C-16.58 133.03 -16.58 26.97 57.07 4.82 C68.11 1.5 79.81 0.67 91.22 2.35 C105.27 4.42 117.29 10.4 128.5 18.89 Z" style="fill:#ff0000;stroke:var(--dunkel);stroke-width:3px"/></svg>',
	'<svg class="form" data-lage="frei" data-name="Rechts" data-form="pfad" viewBox="0 0 130 160" style="--x:330px;--y:300px;--b:130px;--h:160px"><path d="M1.5 18.89 C12.71 10.4 24.73 4.42 38.78 2.35 C50.19 0.67 61.89 1.5 72.93 4.82 C146.58 26.97 146.58 133.03 72.93 155.18 C61.89 158.5 50.19 159.33 38.78 157.65 C24.73 155.58 12.71 149.6 1.5 141.11 C40.17 111.82 40.17 48.18 1.5 18.89 Z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px"/></svg>',
];

/** Die Werkzeugreihe ohne Schere, in der Reihenfolge der Knöpfe. */
const WERKZEUGE = ['auswahl', 'rechteck', 'ellipse', 'vieleck', 'linie', 'stern', 'text', 'stift', 'pfad', 'streuen'];

test.describe('Ohne Formen-Schere (173)', () => {
	test.skip(({ hasTouch }) => hasTouch || !MAUS.includes(test.info().project.name), 'mit der Maus');

	const reihe = (page: Page) => page.getByRole('toolbar', { name: 'Werkzeuge' }).locator('[data-werkzeug]');
	const aktiv = (page: Page) => page.getByRole('toolbar', { name: 'Werkzeuge' }).locator('[aria-pressed="true"]');

	test('Die Schublade zeigt zehn Werkzeuge ohne Schere, am Mac in zwei Reihen', async ({ page }) => {
		await page.setViewportSize({ width: 1512, height: 982 });
		await blatt(page);
		await oeffneSchublade(page, 'werkzeuge');
		// Gegenprobe: Die Reihe hat zehn Knöpfe, der Test findet sie also.
		await expect(reihe(page)).toHaveCount(10);
		await expect(page.locator('[data-werkzeug="schere"]')).toHaveCount(0);
		const ids = await reihe(page).evaluateAll((knoepfe) => knoepfe.map((k) => k.getAttribute('data-werkzeug')));
		expect(ids).toEqual(WERKZEUGE);
		if (test.info().project.name === 'mac-safari') {
			const oben = new Set<number>();
			for (const knopf of await reihe(page).all()) {
				const r = await knopf.boundingBox();
				oben.add(Math.round(r?.y ?? -1));
			}
			expect(oben.size).toBeLessThanOrEqual(2);
		}
	});

	test('⇧M tut nichts: kein Werkzeug, die Auswahl und das Blatt bleiben', async ({ page }) => {
		await blatt(page, { vorne: [KREIS, RECHTS] });
		await oeffneSchublade(page, 'werkzeuge');
		const vorher = await quelle(page);
		await waehle(page, 'Kreis', 'Rechts');
		await page.keyboard.press('Shift+KeyM');
		await expect(page.locator('[data-werkzeugflaeche]')).toHaveCount(0);
		await expect(page.locator('[data-schere-anzeige]')).toHaveCount(0);
		await expect(aktiv(page)).toHaveAttribute('data-werkzeug', 'auswahl');
		await expect(page.locator('[data-gestaltung-rahmen="mehrfach"]')).toHaveAttribute('data-mehrfach-anzahl', '2');
		expect(await quelle(page)).toBe(vorher);

		// Gegenprobe: ⇧P kommt an und wählt den Pfad.
		await page.keyboard.press('Shift+KeyP');
		await expect(page.locator('[data-werkzeugflaeche="pfad"]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-werkzeugflaeche]')).toHaveCount(0);
	});

	test('⌘K kennt keine Formen-Schere', async ({ page }) => {
		await blatt(page);
		await page.keyboard.press('ControlOrMeta+k');
		const palette = page.locator('[data-befehlspalette]');
		await palette.getByRole('combobox').fill('Schere');
		// „An Claude schicken“ bietet jede Suche an: Danach steht die Liste.
		await expect(palette.locator('[data-palette-zeile="claude:schicken"]')).toBeVisible();
		await expect(palette.locator('[data-palette-zeile="werkzeug.schere"]')).toHaveCount(0);
		// Gegenprobe: Werkzeuge stehen in der Palette.
		await palette.getByRole('combobox').fill('Pfad');
		await expect(palette.locator('[data-palette-zeile="werkzeug.pfad"]')).toBeVisible();
	});

	test('Bestand: Was die Schere schrieb, bleibt gleich, lässt sich bearbeiten und kombinieren', async ({ page }) => {
		const u = await uhrzeit();
		await writeFile(u.material, blattMit({ vorne: SCHERE_MONDE }));
		const datei = await readFile(u.material, 'utf8');
		await oeffne(page, u.id, u.dok);
		await geladen(page);
		expect(await readFile(u.material, 'utf8')).toBe(datei);

		await form(page, 'Kreis').dblclick();
		await expect(page.locator('[data-pfad-punkt]').first()).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-pfad-punkt]')).toHaveCount(0);

		const vorher = await quelle(page);
		await waehle(page, 'Kreis', 'Rechts');
		await page.locator('[data-kombinieren] [data-befehl="auswahl.vereinen"]').click();
		await expect.poll(async () => pfade(await quelle(page))).toBe(1);
		expect(await quelle(page)).toContain('fill-rule:evenodd');
		await geladen(page);
		await page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => quelle(page)).toBe(vorher);
	});
});
