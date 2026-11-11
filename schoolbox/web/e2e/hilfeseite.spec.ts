import { neueMappe, neuesDokument } from '@schoolbox/kern';

import { oeffne, uhrzeit } from './editorhilfe';
import { expect, test } from './hilfe';

const MATERIAL_DIR = process.env.E2E_MATERIAL_DIR ?? '';
const ABSCHNITTE = [
	'Ordner und Material ordnen',
	'Material anlegen',
	'Material von Claude',
	'Entwürfe auswählen',
	'Drucken und PDF',
	'Präsentieren',
	'Bearbeiten',
	'Gestalten',
	'Schneller arbeiten',
	'Tasten',
	'Mit Claude arbeiten',
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
		await expect(bilder).toHaveCount(16);
		for (const bild of await bilder.all()) {
			await bild.scrollIntoViewIfNeeded();
			await expect.poll(() => bild.evaluate((b) => (b as HTMLImageElement).naturalWidth)).toBeGreaterThan(500);
		}
	});

	test('„Tasten“ zeigt alle Tasten: Editor wie in der Tastenübersicht, Ablage und die ohne Register', async ({
		page,
	}) => {
		await page.goto('/hilfe#tasten');
		await expect(page.locator('[data-abschnitt="tasten"]')).toBeInViewport();
		const zeile = (bereich: string, id: string) =>
			page.locator(`[data-hilfe-tasten="${bereich}"] [data-taste="${id}"]`);
		await expect(zeile('editor', 'ansicht.palette')).toContainText(/Befehle.*K/);
		await expect(zeile('editor', 'ansicht.links-werkzeuge')).toContainText(/3/);
		await expect(zeile('ablage', 'seitenleiste')).toContainText(/S/);
		await expect(zeile('weitere', 'praesentation-schwarz')).toContainText('B');
		await expect(zeile('weitere', 'schreiben-fett')).toContainText(/B/);
		await expect(page.locator('[data-abschnitt="schneller"] [data-taste]')).toHaveCount(0);
		const inDerHilfe = await page.locator('[data-hilfe-tasten="editor"] [data-taste]').count();
		expect(inDerHilfe).toBeGreaterThan(20);

		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await page.locator('[data-tasten-knopf]').click();
		await expect(page.getByRole('dialog').locator('[data-taste]')).toHaveCount(inDerHilfe);
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

	test('Die Hilfe kennt keine Formen-Schere (173)', async ({ page }) => {
		await page.goto('/hilfe#gestalten');
		const gestalten = page.locator('[data-abschnitt="gestalten"]');
		// Gegenprobe: Der Absatz zum Kombinieren steht da, der Test liest also den richtigen Abschnitt.
		await expect(gestalten.locator('[data-hilfe-kombinieren]')).toContainText('Vereinen');
		await expect(page.locator('[data-hilfe-formenschere]')).toHaveCount(0);
		await expect(gestalten).not.toContainText('Formen-Schere');
		await expect(gestalten).not.toContainText('⇧M');
	});
});
