/** Gemeinsame Hilfen für die Editor-Tests: Testdokument, Öffnen, Quelle lesen und ändern, auf Speichern warten. */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { dokumentOrdner, expect, legeMappeAn } from './hilfe';

export interface TestZugriff {
	quelle: () => string | null;
	aendere: (neu: string, beschreibung?: string) => void;
	art: (element: Element) => string | null;
}

export const uhrzeit = async () => {
	const { dokumente, id } = await legeMappeAn('Uhrzeit', 'mathematik', 2, [
		{ titel: 'Wie spät ist es?', vorlage: 'arbeitsblatt' },
	]);
	const dok = dokumente[0] ?? '';
	const ordner = dokumentOrdner(id, dok);
	return { id, dok, ordner, material: path.join(ordner, 'material.html') };
};

export const versionen = async (ordner: string) =>
	(await readdir(path.join(ordner, 'versionen')).catch(() => [])).sort();

export const oeffne = async (page: Page, mappe: string, dok: string) => {
	await page.goto(`/m/${mappe}/${dok}/bearbeiten`);
	await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
	await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();
};

/** Der neue Rahmen steht: Bis dahin zeigt der alte noch `data-geladen`, und der Editor kennt die Auswahl nicht. */
export const geladen = async (page: Page) => {
	await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
	await expect(page.locator('[data-editor-rahmen="laedt"]')).toHaveCount(0);
};

export const material = (page: Page) => page.frameLocator('[data-editor-rahmen="sichtbar"]');

export const quelle = (page: Page) =>
	page.evaluate(() => (window as unknown as { schoolboxEditor: TestZugriff }).schoolboxEditor.quelle() ?? '');

/** Bis zum nächsten Render liest `quelle()` noch den alten Stand; darum erst weiter, wenn der Editor `neu` hat. */
export const aendere = async (page: Page, neu: string) => {
	await page.evaluate(
		(text) => (window as unknown as { schoolboxEditor: TestZugriff }).schoolboxEditor.aendere(text),
		neu,
	);
	await expect.poll(() => quelle(page)).toBe(neu);
};

/**
 * Gespeichert ist der Stand, den der Editor zuletzt hat: Der Fluss (206) kann nach einer Änderung noch eine Seite
 * anhängen, und das Speichern wartet darauf. Klappt es nicht, zeigt der Fehler den Unterschied.
 */
export const gespeichert = async (page: Page, datei: string) => {
	try {
		await expect
			.poll(async () => (await readFile(datei, 'utf8')) === (await quelle(page)), { timeout: 10_000 })
			.toBe(true);
	} catch {
		expect(await readFile(datei, 'utf8')).toBe(await quelle(page));
	}
	await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();
};

/** Ein Befehl aus dem ⋯ der Leiste am gewählten Baustein oder Gestaltungselement (204-12: derselbe Bauplan). */
export const imMehr = async (page: Page, name: string | RegExp) => {
	await page
		.locator('[data-bausteinleiste], [data-gestaltungsleiste]')
		.getByRole('button', { name: /^Mehr zu diesem (Baustein|Element)$/ })
		.click();
	await page.getByRole('menuitem', { name }).click();
};
