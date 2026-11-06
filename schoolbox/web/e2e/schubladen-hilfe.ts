/** Schubladen links im Editor (093): Ein Klick auf die offene schließt sie, darum öffnen die Tests nur, was zu ist. */

import type { Page } from '@playwright/test';

import { expect } from './hilfe';

export type SchubladenName = 'ebenen' | 'bausteine' | 'formen' | 'figuren' | 'text' | 'bilder' | 'rezepte';

export const schubladenKnopf = (page: Page, name: SchubladenName) =>
	page.locator(`[data-schublade-knopf="${name}"]`);

/** Öffnet die Schublade, falls sie nicht schon offen ist. */
export const oeffneSchublade = async (page: Page, name: SchubladenName) => {
	const knopf = schubladenKnopf(page, name);
	await expect(knopf).toBeVisible();
	if ((await knopf.getAttribute('aria-pressed')) !== 'true') {
		await knopf.click();
	}
	await expect(knopf).toHaveAttribute('aria-pressed', 'true');
};
