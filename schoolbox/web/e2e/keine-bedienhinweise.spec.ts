/**
 * Keine Bedienhinweise (169, Entscheidung 53): Werkzeuge, Figuren, Bilder und Bausteine zeigen in keinem
 * Auswahlzustand einen Text, der eine Geste erklärt oder auf eine andere Schublade verweist. Zustände bleiben.
 * Läuft am Mac und am iPad; geklickt bzw. getippt wird nur über `druecke`.
 */
import type { Locator, Page } from '@playwright/test';

import { aendere, material, oeffne, uhrzeit } from './editorhilfe';
import { BILD_FREI, blattMit } from './gestaltung-daten';
import { expect, test } from './hilfe';
import type { SchubladenName } from './schubladen-hilfe';
import { oeffneSchublade } from './schubladen-hilfe';

const BEDIENUNG = /[Kk]lick|[Zz]iehen|⌘|antippen|[Tt]ippe/;

/** Ein Bild, das es im Testdokument gibt. */
const BILD = BILD_FREI.replace('bilder/marktplatz.jpg', 'bilder/wachstum.png');

/** Die Spalte einer Schublade; neben ihr können die Ebenen offen stehen. */
const links = (page: Page, name: SchubladenName) => page.locator(`[data-panel-links="${name}"]`);

const ohneBedienung = async (page: Page, name: SchubladenName) => {
	await expect(links(page, name)).toBeVisible();
	expect(await links(page, name).innerText()).not.toMatch(BEDIENUNG);
};

const zurSammlung = async (page: Page, druecke: (ziel: Locator) => Promise<void>) => {
	await oeffneSchublade(page, 'bilder');
	await druecke(links(page, 'bilder').getByRole('button', { name: 'Sammlung', exact: true }));
	await expect(links(page, 'bilder').locator('[data-bilder-gruppe="sammlung"]')).toBeVisible();
};

test.describe('Keine Bedienhinweise (169)', () => {
	test('das Muster trifft die alten Gesten-Texte, nicht die Zustände', () => {
		for (const alt of [
			'Klick oder ziehen',
			'Bild hineinziehen',
			'Ziehen: frei hinlegen · mit ⌘: als Tipp in die Zeile',
			'Klick auf ein Bild füllt den Bildrahmen. Ziehen legt es frei aufs Blatt, mit ⌘ als Baustein.',
			'Doppelklick wählt ein Teil.',
		]) {
			expect(alt).toMatch(BEDIENUNG);
		}
		// Wegweiser und „Suche prüfen.“ prüfen `[data-hinweis="figuren"]` unten und `einfuegen.spec` am Wortlaut.
		for (const bleibt of [
			'Willi & Co. findest du unter Figuren ⌥4.',
			'Suche prüfen.',
			'Kein Bild passt zur Suche.',
			'Nichts passt zu „x“.',
			'Bitte keine Fotos, auf denen Kinder zu erkennen sind.',
		]) {
			expect(bleibt).not.toMatch(BEDIENUNG);
		}
	});

	test('Werkzeuge, Figuren, Bilder und Bausteine ohne Bedienhinweis, in jedem Auswahlzustand', async ({
		druecke,
		page,
	}) => {
		const { dok, id } = await uhrzeit();
		await oeffne(page, id, dok);
		await aendere(page, blattMit({ vorne: [BILD] }));
		await expect(material(page).locator('img.bild-frei')).toBeVisible();

		// Werkzeuge: kein Hinweis hinter den Titeln, die Titel stehen ganz.
		await oeffneSchublade(page, 'werkzeuge');
		await ohneBedienung(page, 'werkzeuge');
		const titel = links(page, 'werkzeuge').locator('[data-formen-abschnitt] h3 > span:last-child');
		expect(await titel.count()).toBeGreaterThan(0);
		const gekuerzt = await titel.evaluateAll((liste) =>
			liste.filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent),
		);
		expect(gekuerzt).toEqual([]);

		// Figuren: keine Fußzeile.
		await oeffneSchublade(page, 'figuren');
		await ohneBedienung(page, 'figuren');
		await expect(page.locator('[data-schubladenhinweis]')).toHaveCount(0);

		// Bilder ohne Auswahl: keine Fußzeile, kein Wegweiser zu den Figuren.
		await zurSammlung(page, druecke);
		await ohneBedienung(page, 'bilder');
		await expect(page.locator('[data-schubladenhinweis]')).toHaveCount(0);
		await expect(page.locator('[data-hinweis="figuren"]')).toHaveCount(0);

		// Bilder mit gewähltem freiem Bild.
		const bild = material(page).locator('img.bild-frei');
		await bild.evaluate((e) => e.scrollIntoView({ block: 'center' }));
		await druecke(bild);
		await expect(page.locator('[data-gestaltung-inspektor="bildfrei"]')).toBeVisible();
		await oeffneSchublade(page, 'bilder');
		await ohneBedienung(page, 'bilder');

		// Bilder mit gewähltem leerem Bildrahmen, abgelegt aus „Werkzeuge“.
		await oeffneSchublade(page, 'werkzeuge');
		await druecke(page.locator('[data-bildrahmen-kachel="kreis"]'));
		await expect(page.locator('[data-gestaltung-inspektor="bildrahmen"]')).toBeVisible();
		await zurSammlung(page, druecke);
		await ohneBedienung(page, 'bilder');
		await expect(page.locator('[data-schubladenhinweis]')).toHaveCount(0);

		// Bausteine: Die Suche ohne Treffer nennt nur den Zustand.
		await oeffneSchublade(page, 'bausteine');
		await links(page, 'bausteine').getByRole('searchbox', { name: 'Baustein suchen' }).fill('gibtsnicht');
		await expect(links(page, 'bausteine').getByText('Nichts passt zu „gibtsnicht“.')).toBeVisible();
		await ohneBedienung(page, 'bausteine');
	});
});
