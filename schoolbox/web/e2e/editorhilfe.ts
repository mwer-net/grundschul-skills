/** Gemeinsame Hilfen für die Editor-Tests: Testdokument, Öffnen, Quelle lesen und ändern, auf Speichern warten. */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { dokumentOrdner, expect, legeMappeAn } from './hilfe';

export interface TestZugriff {
	quelle: () => string | null;
	aendere: (neu: string, beschreibung?: string) => void;
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

export const material = (page: Page) => page.frameLocator('[data-editor-rahmen="sichtbar"]');

export const quelle = (page: Page) =>
	page.evaluate(() => (window as unknown as { schoolboxEditor: TestZugriff }).schoolboxEditor.quelle() ?? '');

export const aendere = (page: Page, neu: string) =>
	page.evaluate((text) => (window as unknown as { schoolboxEditor: TestZugriff }).schoolboxEditor.aendere(text), neu);

export const gespeichert = async (page: Page, datei: string) => {
	const stand = await quelle(page);
	await expect.poll(() => readFile(datei, 'utf8'), { timeout: 10_000 }).toBe(stand);
	await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();
};
