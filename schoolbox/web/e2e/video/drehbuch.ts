/**
 * Drehbuch des Demo-Videos (`pnpm run video`, Konfiguration `playwright.video.config.ts`). Kein Test: Jede Szene legt
 * an, was sie braucht, bedient die Oberfläche wie die Lehrkraft und wird dabei aufgenommen; die letzte schneidet alles
 * zusammen. Einzelne Szenen lassen sich mit `--grep` neu aufnehmen, solange der Testserver mit seiner Ablage läuft.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Browser, Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { WURZEL } from '@schoolbox/kern';

import type { Szene } from './buehne';
import { AUFNAHME_DIR, BASIS, neueSzene, stillerKontext, warte } from './buehne';
import type { Nachricht } from './chat';
import { oeffneChat } from './chat';
import type { Ziel } from './material';
import {
	grundbestand,
	kartoffeln,
	kopieZuruecksetzen,
	machAufgabe2Schwerer,
	uhrzeitEntwuerfe,
	uhrzeitFertig,
	uhrzeitKopie,
	uhrzeitZuruecksetzen,
} from './material';
import type { Teil } from './schnitt';
import { ABSPANN, dauerVon, kontrollbilder, schneide, zeitText } from './schnitt';

const PASSWORT = 'drei-kleine-woerter';
const ANMELDUNG = path.join(AUFNAHME_DIR, 'anmeldung.json');
const WECKER = path.join(AUFNAHME_DIR, 'wecker.png');
const ZIEL = process.env.VIDEO_ZIEL ?? path.join(WURZEL, 'lokal', 'video', 'schoolbox-demo.mp4');

const FOLGE: Teil[] = [
	{ art: 'vorspann' },
	{ art: 'karte', nr: 1, titel: 'Anmelden' },
	{ art: 'szene', name: 'k01-anmelden' },
	{ art: 'karte', nr: 2, titel: 'Ein Wunsch an Claude' },
	{ art: 'szene', name: 'k02-wunsch' },
	{ art: 'karte', nr: 3, titel: 'Entwürfe vergleichen' },
	{ art: 'szene', name: 'k03-entwuerfe' },
	{ art: 'karte', nr: 4, titel: 'Alle Mappen' },
	{ art: 'szene', name: 'k04-uebersicht' },
	{ art: 'karte', nr: 5, titel: 'Eine Mappe' },
	{ art: 'szene', name: 'k05-mappe' },
	{ art: 'karte', nr: 6, titel: 'Ansehen, PDF, Drucken' },
	{ art: 'szene', name: 'k06-dokument' },
	{ art: 'karte', nr: 7, titel: 'Selbst ändern im Editor' },
	{ art: 'szene', name: 'k07a-text' },
	{ art: 'szene', name: 'k07b-bilder' },
	{ art: 'szene', name: 'k07c-pruefen' },
	{ art: 'szene', name: 'k07d-claude' },
	{ art: 'szene', name: 'k07e-ipad' },
	{ art: 'karte', nr: 8, titel: 'Präsentieren' },
	{ art: 'szene', name: 'k08a-praesentieren' },
	{ art: 'szene', name: 'k08b-ipad' },
	{ art: 'karte', nr: 9, titel: 'Teilen' },
	{ art: 'szene', name: 'k09-teilen' },
	{ art: 'karte', nr: 10, titel: 'Papierkorb' },
	{ art: 'szene', name: 'k10-papierkorb' },
	{ art: 'karte', nr: 11, titel: 'Hilfe' },
	{ art: 'szene', name: 'k11-hilfe' },
	{ art: 'abspann' },
];

// ---------------------------------------------------------------- Chat-Texte (nach vorlagen/CLAUDE.lehrkraft.md)

const WUNSCH = 'Ich brauche ein Arbeitsblatt zur Uhrzeit für Klasse 2, volle und halbe Stunden.';

const FRAGE_FORMAT = `<p>Gern! Ein paar kurze Fragen, dann zeige ich dir drei Entwürfe.</p>
<p><b>Welches Format soll das Blatt haben?</b></p>
<div class="wahl"><div>a) A4 hoch ← meine Empfehlung, passt in jeden Ordner</div><div>b) A4 quer</div><div>c) A5, fürs Heft</div></div>`;

const TRENNER = '· · · vier kurze Fragen später: schwarz-weiß, Selbsteinschätzung, Niveaus, Sternchenaufgabe · · ·';

const link = (ziel: Ziel, pfad: string, text: string) =>
	`<a href="${BASIS}/m/${ziel.mappe}/${ziel.dok}${pfad}" target="schoolbox">${text}</a>`;

const entwuerfeText = (ziel: Ziel) => `<p>Hier sind drei Entwürfe für dein Arbeitsblatt Uhrzeit, Klasse 2:</p>
<ul><li><b>A · Uhren mit Willi:</b> Willi erklärt, große Uhren, wenig Text</li>
<li><b>B · Uhren-Rallye:</b> ablesen, Zeiger zeichnen, prüfen</li>
<li><b>C · Tagesablauf:</b> Uhrzeiten in Willis Tag, passt noch nicht ganz auf die Seite</li></ul>
<p>Welcher soll es werden, und was soll anders sein? ${link(ziel, '/entwuerfe', 'Entwürfe ansehen')}</p>`;

const PLAN = `<p>Gute Wahl! So baue ich das Blatt:</p>
<ol><li>Uhren ablesen: vier Uhren, volle und halbe Stunden, mit Beispiel</li>
<li>Zeiger einzeichnen: 9 Uhr, halb 5, halb 12</li>
<li>Stimmt das? Willi behauptet etwas über die halbe Stunde.</li></ol>
<p>Dazu eine Sternchenaufgabe zum Knobeln. Willi gibt oben einen Tipp zum kleinen Zeiger, unten schätzen sich die Kinder selbst ein.</p>
<p>Passt das so?</p>`;

const fertigText = (ziel: Ziel) => `<p>Fertig! Dein Arbeitsblatt Uhrzeit, Klasse 2, mit Lösungsblatt.</p>
<p class="klein">Ich kann volle und halbe Stunden ablesen · drei Niveaus und eine Sternchenaufgabe · etwa 20 Minuten</p>
<p>Dort kannst du es ansehen, als PDF herunterladen und drucken: ${link(ziel, '', 'Arbeitsblatt öffnen')}</p>`;

const geaendertText = (
	ziel: Ziel,
) => `<p>Ist geändert: In Aufgabe 2 zeichnen die Kinder jetzt auch Viertelstunden ein.</p>
<p>Hast du das Blatt in der Schoolbox offen, zeigt sie die Änderung gleich. ${link(ziel, '', 'Arbeitsblatt öffnen')}</p>`;

const verlaufBisEntwuerfe = (ziel: Ziel): Nachricht[] => [
	{ von: 'lehrkraft', html: WUNSCH },
	{ von: 'claude', html: FRAGE_FORMAT },
	{ von: 'lehrkraft', html: 'A4 hoch' },
	{ von: 'trenner', html: TRENNER },
	{ von: 'schritt', html: 'Mappe „Uhrzeit“ anlegen' },
	{ von: 'schritt', html: 'Drei Entwürfe bauen und prüfen' },
	{ von: 'claude', html: entwuerfeText(ziel) },
];

const verlaufBisFertig = (ziel: Ziel): Nachricht[] => [
	...verlaufBisEntwuerfe(ziel),
	{ von: 'lehrkraft', html: 'B, aber mit Willi.' },
	{ von: 'claude', html: PLAN },
	{ von: 'lehrkraft', html: 'Ja, passt!' },
	{ von: 'schritt', html: 'Arbeitsblatt bauen und prüfen' },
	{ von: 'claude', html: fertigText(ziel) },
];

// ---------------------------------------------------------------- Hilfen

/** Wartet, bis jedes sichtbare Bild da ist; Vorschauen laden erst, wenn sie ins Bild kommen. */
const bilderGeladen = async (seite: Page) => {
	await warte(300);
	await seite.waitForFunction(
		() =>
			[...document.images]
				.filter((bild) => {
					const r = bild.getBoundingClientRect();
					return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
				})
				.every((bild) => bild.complete && bild.naturalWidth > 0),
		undefined,
		{ timeout: 30_000 },
	);
};

/** Nach einem Klick, der eine andere Seite öffnet: das Laden aus dem Video schneiden. */
const nachLaden = async (szene: Szene, seite: Page, bereit: Locator) => {
	szene.aus();
	await bereit.waitFor();
	await bilderGeladen(seite);
	szene.an();
};

/** Seite laden, ohne dass das Laden im Video steht. */
const starte = async (szene: Szene, url: string, bereit: Locator) => {
	szene.aus();
	await szene.seite.goto(url);
	await bereit.waitFor({ timeout: 30_000 });
	await bilderGeladen(szene.seite);
	await warte(700);
	szene.an();
	await szene.pause(600);
};

const editorBereit = (seite: Page) => seite.locator('[data-leinwand][data-geladen]');
const blatt = (seite: Page) => seite.frameLocator('[data-editor-rahmen="sichtbar"]');
const gespeichert = (seite: Page) =>
	expect(seite.locator('[data-speicherstand="gespeichert"]')).toBeVisible({ timeout: 15_000 });

/** Bildschirmpunkt mitten auf einem Wort im Blatt; der Editor zeigt das Blatt verkleinert im Rahmen. */
const wortPunkt = async (seite: Page, element: Locator, wort: string) => {
	const innen = await element.evaluate((el, w) => {
		const gang = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		while (gang.nextNode()) {
			const knoten = gang.currentNode;
			const i = knoten.textContent?.indexOf(w) ?? -1;
			if (i >= 0) {
				const bereich = document.createRange();
				bereich.setStart(knoten, i);
				bereich.setEnd(knoten, i + w.length);
				const r = bereich.getBoundingClientRect();
				return { x: r.x + r.width / 2, y: r.y + r.height / 2, breite: window.innerWidth };
			}
		}
		return null;
	}, wort);
	const rahmen = await seite.locator('[data-editor-rahmen="sichtbar"]').boundingBox();
	if (!innen || !rahmen) {
		throw new Error(`Wort „${wort}“ nicht gefunden`);
	}
	const massstab = rahmen.width / innen.breite;
	return { x: Math.round(rahmen.x + innen.x * massstab), y: Math.round(rahmen.y + innen.y * massstab) };
};

const macSzene = (browser: Browser, name: string) => neueSzene(browser, name, { storageState: ANMELDUNG });

// ---------------------------------------------------------------- Szenen

test.describe.configure({ mode: 'serial' });

test('Vorbereitung: Testmaterial und Anmeldung', async ({ browser }) => {
	test.setTimeout(600_000);
	await grundbestand();
	const kontext = await stillerKontext(browser);
	const seite = await kontext.newPage();
	await seite.goto('/anmelden');
	await seite.getByLabel('Passwort').fill(PASSWORT);
	await seite.getByRole('checkbox').check();
	await seite.getByRole('button', { name: 'Anmelden' }).click();
	await expect(seite.getByRole('heading', { name: 'Meine Mappen' })).toBeVisible();
	await kontext.storageState({ path: ANMELDUNG });
	await seite.setContent(`<div id="w" style="width:900px;height:900px;display:grid;place-items:center;background:#f4efe6">
		<svg viewBox="0 0 200 200" width="760" height="760">
			<circle cx="58" cy="40" r="26" fill="#d9a400"/><circle cx="142" cy="40" r="26" fill="#d9a400"/>
			<path d="M60 168 l-18 22 M140 168 l18 22" stroke="#444" stroke-width="10" stroke-linecap="round"/>
			<circle cx="100" cy="108" r="74" fill="#d8352a"/><circle cx="100" cy="108" r="60" fill="#fffdf6"/>
			${Array.from({ length: 12 }, (_, i) => `<rect x="98" y="52" width="4" height="${i % 3 === 0 ? 12 : 7}" fill="#333" transform="rotate(${i * 30} 100 108)"/>`).join('')}
			<path d="M100 108 L100 70" stroke="#222" stroke-width="5" stroke-linecap="round"/>
			<path d="M100 108 L126 120" stroke="#222" stroke-width="7" stroke-linecap="round"/>
			<circle cx="100" cy="108" r="6" fill="#222"/>
		</svg></div>`);
	await seite.locator('#w').screenshot({ path: WECKER });
	await kontext.close();
});

test('1 · Anmelden', async ({ browser }) => {
	const szene = await neueSzene(browser, 'k01-anmelden');
	const { seite } = szene;
	await starte(szene, '/', seite.getByLabel('Passwort'));
	szene.text('Anmelden mit einem Passwort');
	await szene.klicke(seite.getByLabel('Passwort'), { pause: 300 });
	await szene.tippe(PASSWORT, { verzoegerung: 70 });
	await szene.gehe(seite.getByText('Auf diesem Gerät angemeldet bleiben'));
	await szene.pause(1100);
	await szene.klicke(seite.getByRole('button', { name: 'Anmelden' }), { pause: 300 });
	await nachLaden(szene, seite, seite.getByRole('heading', { name: 'Meine Mappen' }));
	await szene.pause(1800);
	await szene.ende();
});

test('2 · Wunsch an Claude', async ({ browser }) => {
	const szene = await macSzene(browser, 'k02-wunsch');
	szene.aus();
	const chat = await oeffneChat(szene, szene.seite);
	await warte(500);
	szene.an();
	await szene.pause(500);
	szene.text('Wunsch in der Claude-App');
	await chat.schreibe(WUNSCH);
	await chat.claude(FRAGE_FORMAT, { pause: 1500 });
	await chat.schreibe('A4 hoch');
	await chat.trenner(TRENNER, 1600);
	szene.text('Claude baut drei Entwürfe');
	await chat.schritt('Mappe „Uhrzeit“ anlegen');
	await szene.pause(500);
	await chat.schrittFertig(300);
	await chat.schritt('Drei Entwürfe bauen und prüfen');
	await szene.pause(700);
	szene.aus();
	const ziel = await uhrzeitEntwuerfe();
	szene.an();
	await chat.schrittFertig(400);
	await chat.claude(entwuerfeText(ziel), { pause: 1800 });
	await szene.gehe(szene.seite.getByRole('link', { name: 'Entwürfe ansehen' }));
	await szene.pause(700);
	await szene.ende();
});

test('3 · Entwürfe vergleichen', async ({ browser }) => {
	const ziel = await uhrzeitEntwuerfe();
	const szene = await macSzene(browser, 'k03-entwuerfe');
	szene.aus();
	const chat = await oeffneChat(szene, szene.seite, verlaufBisEntwuerfe(ziel));
	await warte(500);
	szene.an();
	await szene.pause(700);
	const tab = await szene.folge(() =>
		szene.klicke(chat.seite.getByRole('link', { name: 'Entwürfe ansehen' }), { pause: 0 }),
	);
	szene.aus();
	await tab.locator('[data-entwurf="C"]').waitFor();
	await bilderGeladen(tab);
	await warte(600);
	szene.an();
	szene.text('Drei Entwürfe nebeneinander');
	await szene.pause(900);
	await szene.gehe(tab.getByText('Passt auf die Seite').nth(1));
	await szene.pause(800);
	await szene.gehe(tab.getByText('Passt nicht ganz auf die Seite'));
	await szene.pause(1200);
	await szene.klicke(tab.locator('[data-entwurf="B"]'), { pause: 300 });
	await tab.getByRole('heading', { level: 1, name: /Entwurf B/ }).waitFor();
	await bilderGeladen(tab);
	szene.text('Einen Entwurf groß ansehen');
	await szene.pause(1800);

	szene.zeige(chat.seite);
	szene.text('Die Wahl schreibst du Claude');
	await szene.pause(400);
	await chat.schreibe('B, aber mit Willi.');
	await chat.claude(PLAN, { pause: 1900 });
	await chat.schreibe('Ja, passt!');
	szene.text('Claude baut das Arbeitsblatt');
	await chat.schritt('Arbeitsblatt bauen und prüfen');
	await szene.pause(700);
	szene.aus();
	await uhrzeitFertig();
	szene.an();
	await chat.schrittFertig(400);
	await chat.claude(fertigText(ziel), { pause: 1500 });
	await szene.klicke(chat.seite.getByRole('link', { name: 'Arbeitsblatt öffnen' }), { pause: 0 });
	szene.aus();
	await tab.waitForURL(`**/m/${ziel.mappe}/${ziel.dok}`);
	await tab.getByRole('button', { name: 'PDF herunterladen' }).waitFor();
	await bilderGeladen(tab);
	await warte(800);
	szene.zeige(tab);
	szene.an();
	szene.text('Fertig: dein Arbeitsblatt');
	await szene.pause(2200);
	await szene.ende();
});

test('4 · Übersicht', async ({ browser }) => {
	await uhrzeitFertig();
	const szene = await macSzene(browser, 'k04-uebersicht');
	const { seite } = szene;
	await starte(szene, '/', seite.getByRole('heading', { name: 'Meine Mappen' }));
	szene.text('Alle Mappen mit Vorschau');
	await szene.gehe(seite.locator('[data-mappe]').nth(2));
	await szene.pause(1000);
	szene.text('Suchen und filtern');
	const suche = seite.getByRole('searchbox', { name: 'Material suchen' });
	await szene.klicke(suche, { pause: 200 });
	await szene.tippe('Kartoffel', { verzoegerung: 50, pause: 1100 });
	await suche.selectText();
	await szene.taste('Backspace', 500);
	await szene.klicke(seite.getByRole('button', { name: 'Mathematik' }), { pause: 800 });
	await szene.klicke(seite.getByRole('button', { name: 'Klasse 2' }), { pause: 1300 });
	await szene.klicke(seite.getByRole('button', { name: 'Mathematik' }), { pause: 200 });
	await szene.klicke(seite.getByRole('button', { name: 'Klasse 2' }), { pause: 500 });
	await szene.klicke(seite.getByRole('button', { name: 'Präsentation' }), { pause: 1500 });
	await szene.klicke(seite.getByRole('button', { name: 'Präsentation' }), { pause: 800 });
	await szene.ende();
});

test('5 · Mappe', async ({ browser }) => {
	const { mappe } = await kartoffeln();
	const uhrzeit = await uhrzeitFertig();
	const szene = await macSzene(browser, 'k05-mappe');
	const { seite } = szene;
	await starte(szene, '/', seite.getByRole('heading', { name: 'Meine Mappen' }));
	await szene.klicke(seite.locator(`[data-mappe="${mappe}"]`), { pause: 250 });
	await nachLaden(szene, seite, seite.getByRole('heading', { level: 1, name: 'Kartoffeln' }));
	szene.text('Blatt, Karten, Präsentation');
	await szene.pause(900);
	for (const kachel of [0, 1, 2]) {
		await szene.gehe(seite.locator('[data-dokument]').nth(kachel));
		await szene.pause(500);
	}
	szene.text('Alles als ein PDF');
	await szene.klicke(seite.getByRole('button', { name: 'Alles als PDF' }), { pause: 900 });
	await szene.klicke(seite.getByRole('menuitem', { name: 'Ohne Lösungen' }), { pause: 300 });
	const warnung = seite.getByRole('dialog', { name: 'Beim Prüfen ist etwas aufgefallen' });
	szene.tempo(3);
	await warnung.waitFor({ timeout: 90_000 });
	szene.tempo(1);
	szene.text('Prüffehler? Die Schoolbox warnt');
	await szene.pause(2300);
	await szene.klicke(warnung.getByRole('button', { name: 'Trotzdem herunterladen' }), { pause: 700 });

	await szene.klicke(seite.getByRole('link', { name: 'Alle Mappen' }), { pause: 250 });
	await nachLaden(szene, seite, seite.getByRole('heading', { name: 'Meine Mappen' }));
	await szene.klicke(seite.locator(`[data-mappe="${uhrzeit.mappe}"]`), { pause: 250 });
	await nachLaden(szene, seite, seite.getByRole('heading', { level: 1, name: 'Uhrzeit' }));
	szene.text('Kopie für die Parallelklasse');
	await szene.pause(700);
	await szene.klicke(seite.getByRole('button', { name: 'Duplizieren' }), { pause: 250 });
	await nachLaden(szene, seite, seite.getByRole('heading', { level: 1, name: 'Uhrzeit (Kopie)' }));
	await szene.pause(1500);
	await szene.ende();
});

test('6 · Dokument', async ({ browser }) => {
	const ziel = await uhrzeitFertig();
	const szene = await macSzene(browser, 'k06-dokument');
	const { seite } = szene;
	await starte(szene, `/m/${ziel.mappe}/${ziel.dok}`, seite.getByRole('button', { name: 'PDF herunterladen' }));
	szene.text('Mit Druckhinweis');
	await szene.gehe(seite.getByText('Einseitig kopieren.'));
	await szene.pause(1200);
	szene.text('Arbeitsblatt oder Lösung');
	await szene.klicke(seite.getByRole('button', { name: 'Lösung', exact: true }), { pause: 300 });
	await bilderGeladen(seite);
	await szene.pause(1500);
	await szene.klicke(seite.getByRole('button', { name: 'Arbeitsblatt', exact: true }), { pause: 700 });
	szene.text('PDF: Blatt, Lösung oder beides');
	await szene.klicke(seite.getByRole('button', { name: 'PDF herunterladen' }), { pause: 1300 });
	await szene.klicke(seite.getByRole('menuitem', { name: 'Arbeitsblatt und Lösung' }), { pause: 300 });
	szene.tempo(3);
	await expect(seite.getByRole('button', { name: 'PDF herunterladen' })).toBeEnabled({ timeout: 60_000 });
	szene.tempo(1);
	await szene.pause(800);
	szene.text('Drucken: das PDF im Browser');
	const druck = await szene.folge(() => szene.klicke(seite.getByRole('link', { name: 'Drucken' }), { pause: 0 }));
	szene.tempo(3);
	await druck.waitForURL(/anzeigen=1/, { timeout: 60_000 });
	await warte(2500);
	szene.tempo(1);
	await szene.pause(2200);
	await szene.ende();
});

/** Szene im Editor eines Uhrzeit-Blatts. */
const imEditor = async (browser: Browser, name: string, ziel: Ziel) => {
	const szene = await macSzene(browser, name);
	await starte(szene, `/m/${ziel.mappe}/${ziel.dok}/bearbeiten`, editorBereit(szene.seite));
	await gespeichert(szene.seite);
	return { szene, ziel, seite: szene.seite, m: blatt(szene.seite) };
};

test('7a · Editor: Text und Aufbau', async ({ browser }) => {
	const { m, seite, szene } = await imEditor(browser, 'k07a-text', await uhrzeitZuruecksetzen());
	szene.text('Antippen und tippen');
	const h1 = m.locator('h1');
	await szene.klicke(h1, { pause: 400 });
	await szene.klicke(h1, { pause: 250 });
	await szene.taste('ControlOrMeta+A', 350);
	await szene.tippe('Uhren-Rallye', { verzoegerung: 55, pause: 300 });
	await szene.klicke(seite.getByRole('button', { name: 'Fertig' }), { pause: 500 });
	await gespeichert(seite);
	szene.text('Speichert von selbst');
	await szene.gehe(seite.locator('[data-speicherstand="gespeichert"]'));
	await szene.pause(1000);

	szene.text('Fett und unterstrichen');
	const blase = m.locator('.blase');
	await szene.klicke(blase, { pause: 300 });
	await szene.klicke(blase, { pause: 250 });
	await szene.doppelklicke(await wortPunkt(seite, blase, 'kleine'), { pause: 400 });
	await szene.klicke(seite.getByRole('button', { name: 'Fett' }), { pause: 350 });
	await szene.klicke(seite.getByRole('button', { name: 'Unterstrichen' }), { pause: 350 });
	await szene.klicke(seite.getByRole('button', { name: 'Fertig' }), { pause: 500 });

	szene.text('Aufgaben ordnen');
	const aufgabe3 = m.locator('.aufgabe').nth(2);
	await szene.klicke(aufgabe3.locator('.nr'), { pause: 500 });
	await szene.klicke(seite.getByRole('button', { name: 'Nach oben' }), { pause: 800 });
	await szene.ziehe(m.locator('.aufgabe').nth(1).locator('.nr'), m.locator('.aufgabe').nth(2), {
		dauer: 1000,
		pause: 700,
	});

	szene.text('Seiten, Spalten, Abstand');
	await szene.klicke(seite.getByRole('button', { name: 'Seite hinzufügen' }), { pause: 900 });
	await szene.klicke(seite.getByRole('button', { name: /^Rückgängig \(/ }), { pause: 500 });
	await szene.klicke(m.locator('.aufgabe').first().locator('x-uhr').nth(1), { pause: 500 });
	await szene.klicke(seite.getByRole('button', { name: 'Eine Spalte weniger' }), { pause: 900 });
	await szene.klicke(seite.getByRole('button', { name: 'Eine Spalte mehr' }), { pause: 600 });
	await szene.klicke(seite.getByRole('button', { name: 'Auswahl aufheben' }), { pause: 400 });
	const abstand = seite.getByRole('slider', { name: 'Abstand zwischen Aufgaben' });
	const anteil = await abstand.evaluate((el) => {
		const r = el as HTMLInputElement;
		return (Number(r.value) - Number(r.min)) / (Number(r.max) - Number(r.min));
	});
	await szene.gehe(abstand, { x: 0.03 + anteil * 0.94, y: 0.5 });
	await abstand.focus();
	await szene.pause(200);
	for (let i = 0; i < 6; i++) {
		await szene.taste('ArrowRight', 130);
	}
	await szene.pause(500);
	for (let i = 0; i < 6; i++) {
		await szene.taste('ArrowLeft', 80);
	}
	await gespeichert(seite);
	await szene.pause(500);
	await szene.ende();
});

test('7b · Editor: Bilder, Uhr, Lösung', async ({ browser }) => {
	const { m, seite, szene } = await imEditor(browser, 'k07b-bilder', await uhrzeitFertig());
	szene.text('Bild aus der Sammlung');
	await szene.klicke(m.locator('img.figur').first(), { pause: 600 });
	await szene.klicke(seite.getByRole('button', { name: 'Aus der Sammlung' }), { pause: 700 });
	const sammlung = seite.getByRole('dialog', { name: 'Bild aus der Sammlung' });
	await szene.klicke(sammlung.locator('[data-sammlung-bild="_assets/bilder/wilma.png"]'), { pause: 800 });
	szene.text('Farbig? Graustufen für s/w');
	const farbig = seite.locator('[data-hinweis="farbig"]');
	await szene.gehe(farbig);
	await szene.pause(800);
	await szene.klicke(seite.getByRole('button', { name: 'In Graustufen umwandeln' }), { pause: 300 });
	szene.tempo(3);
	await farbig.waitFor({ state: 'detached', timeout: 30_000 });
	szene.tempo(1);
	await szene.pause(700);
	szene.text('An der Ecke größer ziehen');
	const griff = seite.locator('[data-griff="unten-rechts"]');
	const ecke = await griff.boundingBox({ timeout: 10_000 });
	if (!ecke) {
		throw new Error('Kein Griff an der Ecke');
	}
	await szene.ziehe(
		griff,
		{ x: ecke.x + ecke.width / 2 + 30, y: ecke.y + ecke.height / 2 + 30 },
		{
			dauer: 900,
			pause: 1200,
		},
	);
	await expect(seite.getByText(/^(?!84 )\d+ px$/).first()).toBeVisible();
	szene.text('Oder ein eigenes Foto');
	await szene.klicke(seite.getByRole('button', { name: 'Foto hochladen' }), { pause: 1500 });
	const [auswahl] = await Promise.all([
		seite.waitForEvent('filechooser'),
		szene.klicke(seite.getByText('Verstanden, Foto wählen'), { pause: 0 }),
	]);
	await auswahl.setFiles(WECKER);
	await szene.pause(1400);
	await szene.klicke(seite.getByRole('button', { name: /^Rückgängig \(/ }), { pause: 700 });

	szene.text('Die Uhrzeit einer Uhr ändern');
	const uhr = m.locator('.aufgabe').first().locator('x-uhr').nth(2);
	await szene.klicke(uhr, { pause: 600 });
	await szene.waehle(seite.getByLabel('Stunde'), '8');
	await szene.waehle(seite.getByLabel('Minuten'), '30');
	await szene.pause(700);

	szene.text('Lösung eintragen');
	await szene.klicke(seite.getByRole('group', { name: 'Was zeigen?' }).getByRole('button', { name: 'Lösung' }), {
		pause: 800,
	});
	await szene.klicke(m.locator('.aufgabe').first().locator('.antwort').nth(2), { pause: 600 });
	const antwort = seite.getByLabel('Richtige Antwort');
	await szene.klicke(antwort, { pause: 300 });
	await antwort.selectText();
	await szene.tippe('halb 9', { verzoegerung: 60, pause: 400 });
	await szene.taste('Enter', 900);
	await szene.klicke(
		seite.getByRole('group', { name: 'Was zeigen?' }).getByRole('button', { name: 'Arbeitsblatt' }),
		{
			pause: 600,
		},
	);
	await gespeichert(seite);
	await szene.ende();
});

test('7c · Editor: Prüfen, Zoom, Versionen', async ({ browser }) => {
	const { m, seite, szene } = await imEditor(browser, 'k07c-pruefen', await uhrzeitFertig());
	szene.text('Zu voll? Die Prüfung meldet es');
	await szene.klicke(m.locator('.aufgabe').nth(1).locator('.nr'), { pause: 500 });
	await szene.klicke(seite.getByRole('button', { name: 'Duplizieren' }), { pause: 400 });
	const fehler = seite.locator('[data-pruefung="fehler"]');
	await fehler.waitFor({ timeout: 20_000 });
	await szene.pause(800);
	await szene.klicke(fehler.locator('button').first(), { pause: 1100 });
	await szene.klicke(seite.locator('[data-pruefliste] [data-stufe="FEHLER"]').first(), { pause: 1300 });
	szene.text('Kürzen, dann passt es');
	await szene.klicke(m.locator('.aufgabe').nth(2).locator('.nr'), { pause: 500 });
	await szene.klicke(seite.getByRole('button', { name: 'Löschen' }), { pause: 400 });
	await seite.locator('[data-pruefung="ok"]').waitFor({ timeout: 20_000 });
	await szene.gehe(seite.locator('[data-pruefung="ok"]'));
	await szene.pause(1000);

	szene.text('Rückgängig, Wiederholen, Zoom');
	const zoom = seite.getByRole('group', { name: 'Größe' }).first();
	await szene.klicke(seite.getByRole('button', { name: /^Rückgängig \(/ }), { pause: 700 });
	await szene.klicke(seite.getByRole('button', { name: /^Wiederholen \(/ }), { pause: 700 });
	await szene.klicke(zoom.getByRole('button', { name: 'Größer' }), { pause: 900 });
	await szene.klicke(zoom.getByRole('button', { name: 'Kleiner' }), { pause: 500 });

	szene.text('Frühere Versionen zurückholen');
	await szene.klicke(seite.getByRole('button', { name: 'Versionen' }), { pause: 900 });
	const claude = seite.locator('[data-version]').filter({ hasText: 'Claude' }).last();
	await szene.klicke(claude, { pause: 1200 });
	await szene.klicke(seite.getByRole('button', { name: 'Wiederherstellen' }), { pause: 300 });
	await gespeichert(seite);
	await szene.pause(1100);
	await szene.ende();
});

test('7d · Editor: Claude fragen', async ({ browser }) => {
	const uhrzeit = await uhrzeitFertig();
	const { m, seite, szene, ziel } = await imEditor(browser, 'k07d-claude', await kopieZuruecksetzen());
	const chatSeite = await szene.neueSeite();
	const chat = await oeffneChat(szene, chatSeite, verlaufBisFertig(uhrzeit));
	szene.text('Parallelklasse: Claude fragen');
	await szene.klicke(m.locator('.aufgabe').nth(1).locator('.nr'), { pause: 700 });
	await szene.klicke(seite.getByRole('button', { name: 'Claude fragen' }), { pause: 200 });
	szene.textAus();
	await szene.pause(1500);
	szene.zeige(chatSeite);
	// Sonst steht nach dem Neuladen kurz ein verrutschter Auswahlrahmen im Bild.
	await seite.getByRole('button', { name: 'Auswahl aufheben' }).click();
	szene.text('Einfügen, Wunsch dazu');
	await szene.pause(400);
	await chat.fuegeEin(' Mach die Aufgabe für die Parallelklasse schwerer.');
	await chat.schritt('Aufgabe 2 schwerer machen');
	await szene.pause(800);
	await chat.schrittFertig(300);
	await chat.claude(geaendertText(ziel), { pause: 1300 });
	szene.zeige(seite);
	szene.text('Claude ändert, Editor lädt neu');
	await szene.pause(500);
	const fertig = machAufgabe2Schwerer(ziel);
	await expect(seite.getByText('Claude hat das Material geändert.')).toBeVisible({ timeout: 20_000 });
	szene.textAus();
	await szene.pause(1000);
	await szene.inSicht(m.locator('.aufgabe').nth(1));
	await szene.gehe(m.locator('.aufgabe').nth(1).locator('.reihe'));
	await szene.pause(1800);
	szene.aus();
	await fertig;
	await szene.ende();
});

test('7e · Editor am iPad', async ({ browser }) => {
	const ziel = await uhrzeitFertig();
	const szene = await neueSzene(browser, 'k07e-ipad', { geraet: 'ipad', storageState: ANMELDUNG });
	const { seite } = szene;
	await starte(szene, `/m/${ziel.mappe}/${ziel.dok}/bearbeiten`, editorBereit(seite));
	const m = blatt(seite);
	szene.text('Am iPad mit dem Finger');
	await szene.tippeFinger(m.locator('.aufgabe').nth(2).locator('.nr'), { pause: 800 });
	await szene.zieheFinger(m.locator('.aufgabe').nth(2).locator('.nr'), m.locator('.aufgabe').nth(1).locator('.nr'), {
		dauer: 1200,
		pause: 1200,
	});
	await szene.tippeFinger(seite.getByRole('button', { name: /^Rückgängig \(/ }), { pause: 1200 });
	await szene.ende();
});

test('8a · Präsentieren', async ({ browser }) => {
	const { mappe, praesentation } = await kartoffeln();
	const szene = await macSzene(browser, 'k08a-praesentieren');
	const { seite } = szene;
	await seite.clock.install();
	await seite.clock.resume();
	await starte(szene, `/m/${mappe}/${praesentation}`, seite.getByRole('link', { name: 'Präsentieren' }));
	const folie = seite.frameLocator('iframe').first();
	szene.text('Präsentieren im Vollbild');
	await szene.klicke(seite.getByRole('link', { name: 'Präsentieren' }), { pause: 800 });
	await szene.klicke(seite.getByRole('button', { name: 'Präsentation starten' }), { pause: 1300 });
	await szene.taste('ArrowRight', 1100);
	await szene.taste('ArrowRight', 900);
	szene.text('Schritt für Schritt aufdecken');
	for (let i = 0; i < 3; i++) {
		await szene.taste('ArrowRight', 1000);
	}
	await szene.taste('ArrowRight', 900);
	szene.text('Lösung antippen');
	await szene.klicke(folie.locator('.seite.aktiv .aufdecken'), { pause: 1300 });
	await szene.taste('ArrowRight', 900);
	szene.text('Timer für die Lernzeit');
	await szene.klicke(folie.locator('.seite.aktiv x-timer'), { pause: 900 });
	szene.tempo(4);
	for (let i = 0; i < 12; i++) {
		await seite.clock.fastForward('01:00');
		await warte(400);
	}
	szene.tempo(1);
	await szene.pause(900);
	szene.text('Taste B: schwarzer Bildschirm');
	await szene.taste('b', 1400);
	await szene.taste('b', 700);
	szene.text('Unten die Foliennummer');
	await szene.gehe(folie.locator('.praesentation-nummer'));
	await szene.pause(1500);
	await szene.taste('Escape', 300);
	const ohneInternet = seite.getByRole('button', { name: 'Ohne Internet' });
	await ohneInternet.waitFor();
	await bilderGeladen(seite);
	szene.text('Offline: PDF, Datei, Notizen');
	await szene.klicke(ohneInternet, { pause: 2600 });
	await szene.taste('Escape', 400);
	await szene.ende();
});

test('8b · Präsentieren am iPad', async ({ browser }) => {
	const { mappe, praesentation } = await kartoffeln();
	const szene = await neueSzene(browser, 'k08b-ipad', { geraet: 'ipad', storageState: ANMELDUNG });
	const { seite } = szene;
	await starte(
		szene,
		`/m/${mappe}/${praesentation}/praesentation`,
		seite.getByRole('button', { name: 'Präsentation starten' }),
	);
	szene.text('Am iPad: wischen und antippen');
	await szene.tippeFinger(seite.getByRole('button', { name: 'Präsentation starten' }), { pause: 1200 });
	await szene.wische({ x: 900, y: 420 }, { x: 320, y: 420 }, { pause: 1100 });
	await szene.wische({ x: 900, y: 420 }, { x: 320, y: 420 }, { pause: 1000 });
	await szene.tippeFinger({ x: 1000, y: 420 }, { pause: 900 });
	await szene.tippeFinger({ x: 1000, y: 420 }, { pause: 900 });
	await szene.tippeFinger({ x: 1000, y: 420 }, { pause: 1100 });
	await szene.ende();
});

test('9 · Teilen', async ({ browser }) => {
	const ziel = await uhrzeitFertig();
	const szene = await macSzene(browser, 'k09-teilen');
	const { seite } = szene;
	await starte(szene, `/m/${ziel.mappe}/${ziel.dok}`, seite.getByRole('button', { name: 'PDF herunterladen' }));
	szene.text('Teilen mit einem Link');
	await szene.klicke(seite.getByRole('button', { name: 'Teilen' }), { pause: 800 });
	const dialog = seite.getByRole('dialog');
	await szene.klicke(dialog.getByRole('button', { name: 'Link erstellen', exact: true }), { pause: 900 });
	await szene.klicke(dialog.getByRole('button', { name: 'Link kopieren' }), { pause: 1000 });
	const adresse = await dialog.getByRole('textbox', { name: 'Link zum Teilen' }).inputValue();

	const fremd = await szene.zweiterKontext();
	const besuch = await szene.neueSeite(fremd);
	await besuch.goto(adresse);
	await besuch.getByRole('button', { name: 'PDF herunterladen' }).waitFor();
	await bilderGeladen(besuch);
	await warte(600);
	szene.zeige(besuch);
	szene.banner('Zweites Fenster · ohne Anmeldung');
	szene.text('Ansehen und laden, nicht ändern');
	await szene.pause(1000);
	await szene.klicke(besuch.getByRole('button', { name: 'Lösung', exact: true }), { pause: 1000 });
	await szene.gehe(besuch.getByRole('button', { name: 'PDF herunterladen' }));
	await szene.pause(1000);

	szene.bannerAus();
	szene.zeige(seite);
	szene.text('Link abschalten');
	await szene.pause(400);
	await szene.klicke(dialog.getByRole('button', { name: 'Abschalten', exact: true }), { pause: 700 });
	await szene.klicke(seite.getByRole('button', { name: 'Ja, abschalten' }), { pause: 800 });
	await besuch.reload();
	await besuch.getByRole('heading', { name: 'Schade!' }).waitFor();
	szene.zeige(besuch);
	szene.banner('Zweites Fenster · ohne Anmeldung');
	await szene.pause(1800);
	await szene.ende();
});

test('10 · Papierkorb', async ({ browser }) => {
	const kopie = await uhrzeitKopie();
	const szene = await macSzene(browser, 'k10-papierkorb');
	const { seite } = szene;
	await starte(szene, `/m/${kopie}`, seite.getByRole('heading', { level: 1, name: 'Uhrzeit (Kopie)' }));
	szene.text('Löschen geht in den Papierkorb');
	await szene.klicke(seite.getByRole('button', { name: 'Löschen' }), { pause: 250 });
	await nachLaden(szene, seite, seite.getByRole('heading', { name: 'Meine Mappen' }));
	await szene.pause(900);
	await szene.klicke(seite.getByRole('link', { name: 'Papierkorb' }), { pause: 250 });
	await nachLaden(szene, seite, seite.getByRole('heading', { level: 1, name: 'Papierkorb' }));
	szene.text('30 Tage Zeit, es zurückzuholen');
	const eintrag = seite.getByRole('listitem').filter({ hasText: 'Uhrzeit (Kopie)' });
	await szene.gehe(eintrag);
	await szene.pause(1200);
	await szene.klicke(eintrag.getByRole('button', { name: 'Wiederherstellen' }), { pause: 1000 });
	await szene.klicke(seite.getByRole('status').getByRole('button', { name: 'Öffnen' }), { pause: 250 });
	await nachLaden(szene, seite, seite.getByRole('heading', { level: 1, name: 'Uhrzeit (Kopie)' }));
	await szene.pause(1200);
	await szene.ende();
});

test('11 · Hilfe', async ({ browser }) => {
	const szene = await macSzene(browser, 'k11-hilfe');
	const { seite } = szene;
	await starte(szene, '/', seite.getByRole('heading', { name: 'Meine Mappen' }));
	szene.text('Hilfe mit Bildern');
	await szene.klicke(seite.getByRole('link', { name: 'Hilfe', exact: true }), { pause: 250 });
	await nachLaden(szene, seite, seite.getByRole('heading', { level: 1, name: 'Hilfe' }));
	await szene.pause(800);
	await szene.scrolle(700, { x: 960, y: 700 });
	await szene.pause(1100);
	await szene.scrolle(-700);
	szene.text('Kurzanleitung zum Ausdrucken');
	await szene.klicke(seite.getByRole('link', { name: 'Kurzanleitung öffnen' }), { pause: 250 });
	await nachLaden(szene, seite, seite.getByRole('button', { name: 'PDF herunterladen' }));
	await szene.pause(800);
	await szene.scrolle(600, { x: 960, y: 700 });
	await szene.pause(1700);
	await szene.ende();
});

/** `VIDEO_NUR=k07,k08` schneidet zur Probe nur diese Szenen (mit ihrer Titelkarte) nach `probe.mp4`. */
const probeFolge = (muster: string) =>
	FOLGE.filter((teil, i) => {
		const naechste = FOLGE[i + 1];
		const passt = (t: Teil | undefined) =>
			t?.art === 'szene' && muster.split(',').some((m) => t.name.startsWith(m));
		return passt(teil) || (teil.art === 'karte' && passt(naechste));
	});

test('Schnitt', async ({ browser }) => {
	test.setTimeout(1_800_000);
	const nur = process.env.VIDEO_NUR;
	const ziel = nur ? path.join(AUFNAHME_DIR, 'probe.mp4') : ZIEL;
	const marken = await schneide(browser, nur ? probeFolge(nur) : FOLGE, ziel);
	const dauer = await dauerVon(ziel);
	const kontrolle = await kontrollbilder(ziel);
	const kapitel = marken.map((k) => `${zeitText(k.zeit)}  ${k.titel}`).join('\n');
	const bericht = `${ziel}\nLänge ${zeitText(dauer)}\n\n${kapitel}\n\nAbspann:\n${ABSPANN.join('\n')}\n`;
	await writeFile(path.join(AUFNAHME_DIR, 'kapitel.txt'), bericht);
	console.log(bericht);
	console.log(`Kontrollbilder: ${kontrolle}`);
});
