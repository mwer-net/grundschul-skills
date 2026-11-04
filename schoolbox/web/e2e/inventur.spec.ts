import type { Page } from '@playwright/test';

import { imMehr, material, oeffne, uhrzeit } from './editorhilfe';
import { expect, legeMappeAn, oeffneMehr, test } from './hilfe';

/**
 * Funktions-Inventur aus 076: Jede Funktion hat einen sichtbaren Weg, ohne Taste und ohne Rechtsklick. Geprüft wird der
 * Weg, die Wirkung im Detail prüfen die genannten Specs:
 *
 * - Speichern und Erneut, Rückgängig, Versionen: `editor.spec.ts`
 * - Zoom, Einpassen, Leisten, „+ Seite“: `oberflaeche.spec.ts`
 * - Miniatur ziehen, Ziehen im Blatt, Griffe, Spalten, Nach oben und unten: `struktur.spec.ts`, `bilder.spec.ts`
 * - Prüfliste, Punkt zeigen, Verschieben, Prüfhinweise, Prüfrahmen: `pruefung.spec.ts`, `einfuegen.spec.ts`
 * - Plus, Schnellauswahl, Slash, erster Baustein, Bibliothek: `einfuegen.spec.ts`
 * - Sprachwerkzeug, Lösungswerkzeug, Neue Zahlen, Sammlung, Als Vorlage: `formate.spec.ts`
 * - Textleiste: `blatt.spec.ts`; Abbildungswerkzeug und Kit-Felder: `oberflaeche.spec.ts`, `formate.spec.ts`
 * - Chat, Vorschlag, Vergleich, Nachbessern, Claude-App: `chat.spec.ts`, `ki.spec.ts`, `claude.spec.ts`
 * - Anmeldung, Papierkorb, Teilen-Dialog, Geteilt, Entwürfe: `oberflaeche.spec.ts`; Präsentation: `praesentation.spec.ts`
 */

const leiste = (page: Page) => page.locator('[data-bausteinleiste]');
const kopf = (page: Page) => page.locator('[data-kopf]');
const status = (page: Page) => page.locator('[data-statusleiste]');

const offenesBlatt = async (page: Page) => {
	const { dok, id } = await uhrzeit();
	await oeffne(page, id, dok);
	return { dok, id };
};

test.describe('Inventur Editor', () => {
	test('Kopf: Zurück, Titel, Stand, Rückgängig, Ansichten, Claude, Versionen, Vorlage, PDF', async ({ page }) => {
		const { id } = await offenesBlatt(page);
		await expect(kopf(page).getByRole('heading', { level: 1 })).toContainText('Wie spät ist es?');
		await expect(page.locator('[data-speicherstand="gespeichert"]')).toBeVisible();
		await expect(kopf(page).getByRole('button', { name: 'Rückgängig' })).toBeVisible();
		await expect(kopf(page).getByRole('button', { name: 'Wiederholen' })).toBeVisible();
		await expect(kopf(page).getByRole('button', { name: 'PDF' })).toBeVisible();

		await kopf(page).getByRole('button', { name: 's/w' }).click();
		await expect(kopf(page).getByRole('button', { name: 's/w' })).toHaveAttribute('aria-pressed', 'true');
		await kopf(page).getByRole('button', { name: 'Farbe' }).click();

		await kopf(page).getByRole('button', { name: 'Claude', exact: true }).click();
		await expect(page.locator('[data-chat]')).toBeVisible();
		await page.locator('[data-chat]').getByRole('button', { name: 'Chat schließen' }).click();

		await kopf(page).getByRole('button', { name: 'Versionen' }).click();
		await expect(page.locator('[data-panel="versionen"]')).toBeVisible();
		await kopf(page).getByRole('button', { name: 'Versionen' }).click();

		await kopf(page).getByRole('button', { name: 'Weitere Aktionen' }).click();
		await expect(page.getByRole('menuitem', { name: /Als Vorlage/ })).toBeVisible();
		await page.keyboard.press('Escape');

		await kopf(page).getByRole('button', { name: 'Zurück' }).click();
		await expect(page).toHaveURL(new RegExp(`/m/${id}`));
		await expect(page).not.toHaveURL(/bearbeiten/);
	});

	test('Folien haben „Präsentieren“ im Kopf', async ({ page }) => {
		const { dokumente, id } = await legeMappeAn('Kartoffeln', 'sachunterricht', 3, [
			{ titel: 'Kreisinput', art: 'praesentation', format: 'folie', vorlage: 'praesentation' },
		]);
		await oeffne(page, id, dokumente[0] ?? '');
		await expect(kopf(page).getByRole('button', { name: 'Präsentieren' })).toBeVisible();
	});

	test('Statusleiste: Zoom, Prüfstatus, Befehle, Tasten, beide Leisten', async ({ page }) => {
		await offenesBlatt(page);
		for (const name of ['Kleiner', 'Größer', 'Einpassen', 'Befehle', 'Tasten', 'Linke Leiste', 'Rechte Leiste']) {
			await expect(status(page).getByRole('button', { name })).toBeVisible();
		}
		await expect(status(page).locator('[data-seite-von]')).toContainText('Seite 1 von');
		await expect(status(page).locator('[data-zoom-wert]')).toBeVisible();
		await status(page).getByRole('button', { name: 'Tasten' }).click();
		await expect(page.locator('[data-tasten-uebersicht]')).toBeVisible();
		await page.keyboard.press('Escape');
		await status(page).getByRole('button', { name: 'Befehle' }).click();
		await expect(page.getByRole('combobox')).toBeFocused();
	});

	test('Linke Leiste: Seiten, Gliederung, Bausteine, „+ Seite“', async ({ page }) => {
		await offenesBlatt(page);
		await expect(page.locator('[data-seite-miniatur="1"]')).toBeVisible();
		await expect(page.getByRole('button', { name: /Seite$/ }).first()).toBeVisible();
		await page.getByRole('tab', { name: 'Gliederung' }).click();
		await expect(page.locator('[data-gliederung-aufgabe]').first()).toBeVisible();
		await page.getByRole('tab', { name: 'Bausteine' }).click();
		await expect(page.locator('[data-bereich]').first()).toBeVisible();
	});

	test('Reiter „Blatt“: Lösungsübersicht, Klasse, Farbschema, Format, Trennlinien, Punkte', async ({ page }) => {
		await offenesBlatt(page);
		for (const name of ['Klasse', 'Format']) {
			await expect(page.locator('[data-panel]').getByLabel(name, { exact: true })).toBeVisible();
		}
		for (const text of ['Farbschema', 'Trennlinien', 'Punkte drucken']) {
			await expect(page.locator('[data-panel]').getByText(text, { exact: true })).toBeVisible();
		}
	});

	test('Leiste am Baustein: Ebene, Pfeile, Duplizieren, Löschen, Einfügen, Ablage, Sammlung', async ({ page }) => {
		await offenesBlatt(page);
		await material(page).locator('.aufgabe').first().locator('.nr').click();
		await expect(leiste(page)).toBeVisible();
		for (const name of ['Nach oben', 'Nach unten', 'Duplizieren', 'Löschen', 'Mehr zu diesem Baustein']) {
			await expect(leiste(page).getByRole('button', { name })).toBeVisible();
		}
		await expect(leiste(page).getByRole('button', { name: /Baustein/ }).first()).toBeVisible();

		await leiste(page).getByRole('button', { name: 'Mehr zu diesem Baustein' }).click();
		for (const name of [/Kopieren/, /Ausschneiden/, /In Sammlung legen/, /Mit Claude ändern/]) {
			await expect(page.getByRole('menuitem', { name })).toBeVisible();
		}
		await page.keyboard.press('Escape');
		await expect(leiste(page)).toBeVisible();
	});

	test('Inspektor: Pfad wählt jede Ebene, × hebt die Auswahl auf, Sichtbarkeit steht dort', async ({ page }) => {
		await offenesBlatt(page);
		await material(page).locator('x-uhr').first().click();
		await expect(page.locator('[data-breadcrumb]')).toBeVisible();
		const stufen = page.locator('[data-pfad-stufe]');
		expect(await stufen.count()).toBeGreaterThan(1);
		await stufen.last().click();
		await expect(page.locator('[data-auswahl]')).toBeVisible();
		await page.getByRole('button', { name: 'Auswahl aufheben' }).click();
		await expect(page.locator('[data-auswahl]')).toHaveCount(0);

		await material(page).locator('.aufgabe').first().locator('.nr').click();
		await expect(page.locator('[data-abschnitt="sichtbarkeit"]')).toBeVisible();
	});

	test('Tabelle, Spalten und Neue Zahlen haben ihren Platz', async ({ page }) => {
		await offenesBlatt(page);
		await material(page).locator('x-uhr').first().click();
		await expect(leiste(page).getByRole('button', { name: 'Neue Zahlen' })).toBeVisible();
		await expect(page.locator('[data-abschnitt="eltern"]')).toBeVisible();
	});

	test('Claude-App: ⋯ im Chat', async ({ page }) => {
		await offenesBlatt(page);
		await kopf(page).getByRole('button', { name: 'Claude', exact: true }).click();
		await page.locator('[data-chat]').getByRole('button', { name: 'Chat: weitere Aktionen' }).click();
		await expect(page.getByRole('menuitem', { name: 'In der Claude-App weiterarbeiten' })).toBeVisible();
	});

	test('Der Hinweis nach dem Umbau kommt einmal und führt zur Hilfe', async ({ page }) => {
		await offenesBlatt(page);
		const hinweis = page.locator('[data-neu-hinweis]');
		await expect(hinweis).toContainText('direkt am Baustein');
		await hinweis.getByRole('button', { name: 'Hinweis ausblenden' }).click();
		await expect(hinweis).toHaveCount(0);
		await page.reload();
		await expect(page.locator('[data-leinwand][data-geladen]')).toBeVisible();
		await expect(hinweis).toHaveCount(0);

		await page.evaluate(() => localStorage.removeItem('schoolbox-neu-gesehen'));
		await page.reload();
		await hinweis.getByRole('link', { name: 'Zur Hilfe' }).click();
		await expect(page).toHaveURL(/\/hilfe#schneller$/);
		await expect(page.locator('[data-abschnitt="schneller"]')).toBeInViewport();
	});

	test('Über „imMehr“ wirkt ein Eintrag tatsächlich', async ({ page }) => {
		await offenesBlatt(page);
		const anzahl = await material(page).locator('.aufgabe').count();
		await material(page).locator('.aufgabe').first().locator('.nr').click();
		await imMehr(page, /Duplizieren/);
		await expect(material(page).locator('.aufgabe')).toHaveCount(anzahl + 1);
	});
});

test.describe('Inventur außerhalb des Editors', () => {
	test('Übersicht: Suche, Filter, Mappe anlegen; Kopf: Hilfe, Papierkorb, Abmelden', async ({ druecke, page }) => {
		await legeMappeAn('Die Kartoffel', 'sachunterricht', 3, [{ titel: 'Teile der Kartoffel' }]);
		await page.goto('/');
		await expect(page.getByPlaceholder('Mappen und Material suchen')).toBeVisible();
		await expect(page.getByRole('button', { name: /Fach/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /Klasse/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /Art/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Mappe anlegen' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Hilfe' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Papierkorb' })).toBeVisible();
		await oeffneMehr(druecke, page.locator('[data-kopf-rechts]'));
		await expect(page.getByRole('menuitem', { name: 'Abmelden' })).toBeVisible();
	});

	test('Mappe: Material anlegen, Alles als PDF, Teilen, Duplizieren, Löschen', async ({ druecke, page }) => {
		const { id } = await legeMappeAn('Die Kartoffel', 'sachunterricht', 3, [{ titel: 'Teile der Kartoffel' }]);
		await page.goto(`/m/${id}`);
		await expect(page.getByRole('button', { name: 'Material anlegen' })).toBeVisible();
		await expect(page.getByRole('button', { name: /Alles als PDF/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Teilen' })).toBeVisible();
		await oeffneMehr(druecke, page, 'Mappe: weitere Aktionen');
		for (const name of [/Duplizieren/, /Löschen/]) {
			await expect(page.getByRole('menuitem', { name })).toBeVisible();
		}
	});

	test('Kachel: Bild öffnet, Bearbeiten und PDF sichtbar, der Rest im ⋯', async ({ druecke, page }) => {
		const { dokumente, id } = await legeMappeAn('Kartoffeln', 'sachunterricht', 3, [
			{ titel: 'Kreisinput', art: 'praesentation', format: 'folie' },
		]);
		await page.goto(`/m/${id}`);
		const kachel = page.locator('main').getByRole('listitem').first();
		await expect(kachel.getByRole('link', { name: 'Bearbeiten' })).toBeVisible();
		await expect(kachel.getByRole('button', { name: 'PDF' })).toBeVisible();
		await oeffneMehr(druecke, kachel);
		for (const name of [/Präsentieren/, /Als Vorlage/, /Variante/, /Teilen/]) {
			await expect(page.getByRole('menuitem', { name })).toBeVisible();
		}
		await page.keyboard.press('Escape');
		await kachel.getByRole('link').first().click();
		await expect(page).toHaveURL(new RegExp(`/m/${id}/${dokumente[0]}`));
	});

	test('Dokument: Bearbeiten, PDF, Schalter; Drucken und Teilen im ⋯', async ({ druecke, page }) => {
		const { dokumente, id } = await legeMappeAn('Kartoffeln', 'sachunterricht', 3, [
			{ titel: 'Teile der Kartoffel', vorlage: 'arbeitsblatt', loesung: true },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await expect(page.getByRole('link', { name: 'Bearbeiten' })).toBeVisible();
		await expect(page.getByRole('button', { name: /PDF/ }).first()).toBeVisible();
		await expect(page.locator('[data-profilschalter]').getByRole('button', { name: 'Farbe' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Lösung' })).toBeVisible();
		await oeffneMehr(druecke, page);
		for (const name of ['Drucken', 'Teilen']) {
			await expect(page.getByRole('menuitem', { name })).toBeVisible();
		}
	});

	test('Folien im Dokument: Präsentieren und Ohne Internet', async ({ druecke, page }) => {
		const { dokumente, id } = await legeMappeAn('Kartoffeln', 'sachunterricht', 3, [
			{ titel: 'Kreisinput', art: 'praesentation', format: 'folie', vorlage: 'praesentation' },
		]);
		await page.goto(`/m/${id}/${dokumente[0]}`);
		await expect(page.getByRole('link', { name: 'Präsentieren' })).toBeVisible();
		await oeffneMehr(druecke, page);
		await expect(page.getByRole('menuitem', { name: 'Ohne Internet' })).toBeVisible();
	});
});
