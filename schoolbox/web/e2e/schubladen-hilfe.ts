/** Schubladen links im Editor (093): Ein Klick auf die offene schließt sie, darum öffnen die Tests nur, was zu ist. */

import type { Page } from '@playwright/test';

import { expect } from './hilfe';

export type SchubladenName = 'ebenen' | 'bausteine' | 'formen' | 'figuren' | 'text' | 'bilder' | 'rezepte';

export const schubladenKnopf = (page: Page, name: SchubladenName) => page.locator(`[data-schublade-knopf="${name}"]`);

/** Öffnet die Schublade, falls sie nicht schon offen ist. */
export const oeffneSchublade = async (page: Page, name: SchubladenName) => {
	const knopf = schubladenKnopf(page, name);
	await expect(knopf).toBeVisible();
	if ((await knopf.getAttribute('aria-pressed')) !== 'true') {
		await knopf.click();
	}
	await expect(knopf).toHaveAttribute('aria-pressed', 'true');
};

/**
 * Öffnet die Schublade mit ihrem Kürzel (⌥1 …). Lädt das Blatt gerade in einen neuen Rahmen, geht der Druck verloren;
 * dann noch einmal, aber nur, solange sie zu ist: Ein zweiter Druck auf die offene schlösse sie.
 */
export const oeffnePerTaste = async (page: Page, name: SchubladenName, taste: string) => {
	const knopf = schubladenKnopf(page, name);
	await expect(async () => {
		if ((await knopf.getAttribute('aria-pressed')) !== 'true') {
			await page.keyboard.press(taste);
		}
		await expect(knopf).toHaveAttribute('aria-pressed', 'true', { timeout: 1500 });
	}).toPass();
};
