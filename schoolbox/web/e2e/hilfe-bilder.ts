/**
 * Bildschirmfotos für die Hilfeseite (`pnpm run hilfe:bilder`, Konfiguration `playwright.hilfe.config.ts`). Kein Test:
 * Jeder Schritt legt Testmaterial an, öffnet die Seite wie die Lehrkraft und fotografiert sie.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';
import {
	aktualisiereMappe,
	ASSETS,
	baueEntwurfsVorschauen,
	leseMeta,
	registriereEntwuerfe,
	schreibeMeta,
} from '@schoolbox/kern';

import { material, oeffne } from './editorhilfe';
import { dokumentOrdner, expect, legeMappeAn, test } from './hilfe';

const MATERIAL_DIR = process.env.E2E_MATERIAL_DIR ?? '';
const ZIEL = path.join(__dirname, '..', 'public', 'hilfe-bilder');

/** Wie `schoolbox fertig`, ohne blatt.py: Die Vorschau baut der Server selbst. */
const fertig = async (mappe: string, dok: string) => {
	const meta = await leseMeta(MATERIAL_DIR, mappe, dok);
	await schreibeMeta(MATERIAL_DIR, mappe, dok, {
		...meta,
		status: 'fertig',
		hatLoesung: meta.art !== 'praesentation',
	});
	await aktualisiereMappe(MATERIAL_DIR, mappe, new Date());
};

const ersetze = async (mappe: string, dok: string, aenderung: (html: string) => string) => {
	const datei = path.join(dokumentOrdner(mappe, dok), 'material.html');
	await writeFile(datei, aenderung(await readFile(datei, 'utf8')));
};

const uhrzeit = async () => {
	const { dokumente, id } = await legeMappeAn('Uhrzeit', 'mathematik', 2, [
		{ titel: 'Wie spät ist es?', vorlage: 'arbeitsblatt', druckhinweise: ['Lösung auf die Rückseite kopieren'] },
	]);
	const dok = dokumente[0] ?? '';
	await fertig(id, dok);
	return { id, dok };
};

const kartoffeln = async () => {
	const { dokumente, id } = await legeMappeAn('Kartoffeln', 'sachunterricht', 3, [
		{ titel: 'Kreisinput Kartoffel', art: 'praesentation', format: 'folie', vorlage: 'praesentation' },
	]);
	const dok = dokumente[0] ?? '';
	await fertig(id, dok);
	return { id, dok };
};

const einmaleins = async () => {
	const { dokumente, id } = await legeMappeAn('Einmaleins mit 6 und 7', 'mathematik', 2, [
		{ titel: 'Malaufgaben üben', vorlage: 'arbeitsblatt' },
	]);
	const dok = dokumente[0] ?? '';
	await ersetze(id, dok, (html) =>
		html
			.replace('palette-himmel', 'palette-wiese')
			.replace('Wie spät ist es?', 'Malaufgaben mit 6 und 7')
			.replace('Ich kann volle und halbe Stunden ablesen.', 'Ich kann Malaufgaben mit 6 und 7 rechnen.'),
	);
	await fertig(id, dok);
	return { id, dok };
};

/** Wartet, bis alle Vorschaubilder auf der Seite da sind; blatt.py braucht dafür einige Sekunden je Blatt. */
const vorschauenDa = async (page: Page, anzahl: number) => {
	await expect(page.locator('main img')).toHaveCount(anzahl, { timeout: 60_000 });
	await expect
		.poll(() =>
			page.locator('main img').evaluateAll((bilder) => bilder.every((b) => (b as HTMLImageElement).complete)),
		)
		.toBe(true);
};

const foto = async (page: Page, name: string) => {
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: path.join(ZIEL, name), type: 'jpeg', quality: 80, scale: 'css' });
};

const nurAuf = (geraet: 'mac' | 'ipad') => test.skip(test.info().project.name !== geraet, `nur ${geraet}`);

test.describe('Bildschirmfotos für die Hilfe', () => {
	test('Übersicht', async ({ page }) => {
		nurAuf('mac');
		await kartoffeln();
		await einmaleins();
		await uhrzeit();
		await page.goto('/');
		await vorschauenDa(page, 3);
		await foto(page, 'uebersicht-mac.jpg');
	});

	test('Entwürfe', async ({ page }) => {
		nurAuf('mac');
		const { dokumente, id } = await legeMappeAn('Uhrzeit', 'mathematik', 2, [{ titel: 'Wie spät ist es?' }]);
		const dok = dokumente[0] ?? '';
		const vorlage = await readFile(path.join(ASSETS, 'vorlage-arbeitsblatt.html'), 'utf8');
		const varianten = [
			['A · Uhren lesen – Uhren mit Willi', (h: string) => h],
			['B · Schwarz-weiß – sparsam zum Kopieren', (h: string) => h.replace('farbe palette-himmel', 'sw')],
			['C · Bunt – mit grüner Palette', (h: string) => h.replace('palette-himmel', 'palette-wiese')],
		] as const;
		const dateien = await Promise.all(
			varianten.map(async ([titel, aendere], i) => {
				const datei = path.join(dokumentOrdner(id, dok), `entwurf-${'abc'[i] ?? ''}.html`);
				await writeFile(datei, aendere(vorlage).replace(/<title>.*?<\/title>/s, `<title>${titel}</title>`));
				return datei;
			}),
		);
		await registriereEntwuerfe(MATERIAL_DIR, { mappe: id, dok }, dateien);
		await baueEntwurfsVorschauen({ materialDir: MATERIAL_DIR, pythonBin: 'python3' }, { mappe: id, dok });
		await page.goto(`/m/${id}/${dok}/entwuerfe`);
		await vorschauenDa(page, 3);
		await foto(page, 'entwuerfe-mac.jpg');
	});

	test('Dokument', async ({ page }) => {
		nurAuf('mac');
		const { dok, id } = await uhrzeit();
		await page.goto(`/m/${id}/${dok}`);
		await expect(page.frameLocator('iframe').locator('.seite').first()).toBeVisible();
		await foto(page, 'dokument-mac.jpg');
	});

	test('Präsentieren', async ({ druecke, page }) => {
		nurAuf('ipad');
		const { dok, id } = await kartoffeln();
		await page.goto(`/m/${id}/${dok}`);
		await druecke(page.getByRole('button', { name: 'Ohne Internet' }));
		await expect(page.getByRole('menu')).toBeVisible();
		await foto(page, 'ohne-internet-ipad.jpg');

		await page.goto(`/m/${id}/${dok}/praesentation`);
		await expect(page.getByText('Alles geladen.')).toBeVisible();
		await druecke(page.getByRole('button', { name: 'Präsentation starten' }));
		await expect(page.getByRole('toolbar', { name: 'Präsentation steuern' })).toBeAttached();
		await page.waitForTimeout(800);
		await foto(page, 'praesentation-ipad.jpg');
	});

	for (const geraet of ['mac', 'ipad'] as const) {
		test(`Editor ${geraet}`, async ({ druecke, page }) => {
			nurAuf(geraet);
			const { dok, id } = await uhrzeit();
			await oeffne(page, id, dok);
			await druecke(material(page).locator('.aufgabe').first().locator('.nr'));
			await expect(page.locator('[data-breadcrumb]')).toContainText('Aufgabe 1');
			await foto(page, `editor-${geraet}.jpg`);
		});
	}

	test('Teilen', async ({ druecke, page }) => {
		nurAuf('mac');
		const { dok, id } = await uhrzeit();
		await page.goto(`/m/${id}/${dok}`);
		await druecke(page.getByRole('button', { name: 'Teilen' }));
		const dialog = page.getByRole('dialog');
		await druecke(dialog.getByRole('button', { name: 'Link erstellen' }).first());
		await expect(dialog.getByRole('textbox', { name: 'Link zum Teilen' }).first()).toBeVisible();
		await foto(page, 'teilen-mac.jpg');
	});
});
