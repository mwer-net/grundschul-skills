import { neueMappe, neuesDokument } from '@schoolbox/kern';

import { expect, test } from './hilfe';

const MATERIAL_DIR = process.env.E2E_MATERIAL_DIR ?? '';
const ABSCHNITTE = [
	'So bekommst du Material',
	'Entwürfe auswählen',
	'Drucken und PDF',
	'Präsentieren',
	'Bearbeiten',
	'Teilen mit Kolleginnen',
	'Wenn etwas nicht klappt',
];

test.describe('Hilfe', () => {
	test('ist aus der Kopfzeile erreichbar, mit allen Abschnitten und Bildschirmfotos', async ({ druecke, page }) => {
		await page.goto('/');
		await druecke(page.getByRole('link', { name: 'Hilfe' }));
		await expect(page).toHaveURL(/\/hilfe$/);
		await expect(page).toHaveTitle('Hilfe – Schoolbox');
		await expect(page.getByRole('heading', { level: 2 })).toHaveText(ABSCHNITTE);
		await expect(page.getByText('Kurzanleitung zum Ausdrucken')).toHaveCount(0);

		const inhalt = page.getByRole('navigation', { name: 'Inhalt' });
		await druecke(inhalt.getByRole('link', { name: 'Teilen mit Kolleginnen' }));
		await expect(page).toHaveURL(/\/hilfe#teilen$/);
		await expect(page.locator('[data-abschnitt="teilen"]')).toBeInViewport();

		const bilder = page.locator('main img');
		await expect(bilder).toHaveCount(8);
		for (const bild of await bilder.all()) {
			await bild.scrollIntoViewIfNeeded();
			await expect.poll(() => bild.evaluate((b) => (b as HTMLImageElement).naturalWidth)).toBeGreaterThan(500);
		}
	});

	test('verweist auf die Kurzanleitung, sobald es sie gibt', async ({ druecke, page }) => {
		const angaben = { titel: 'Schoolbox-Hilfe', fach: 'faecheruebergreifend', klasse: 'gemischt' } as const;
		await neueMappe(MATERIAL_DIR, { ...angaben, id: 'schoolbox-hilfe' });
		const dok = { titel: 'Kurzanleitung', art: 'sonstiges', format: 'a4-hoch', druckprofil: 'farbe' } as const;
		await neuesDokument(MATERIAL_DIR, 'schoolbox-hilfe', { ...dok, druckhinweise: [] });

		await page.goto('/hilfe');
		await druecke(page.getByRole('link', { name: 'Kurzanleitung öffnen' }));
		await expect(page).toHaveURL(/\/m\/schoolbox-hilfe\/kurzanleitung$/);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Kurzanleitung');
	});

	test('steht auch auf der leeren Übersicht', async ({ druecke, page }) => {
		await page.goto('/');
		await druecke(page.getByRole('link', { name: 'So geht’s' }));
		await expect(page).toHaveURL(/\/hilfe$/);
	});
});
