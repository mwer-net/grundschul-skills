import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';
import { expect, test as basis } from '@playwright/test';
import type { Art, Fach, Format, Klasse } from '@schoolbox/kern';
import {
	dokumentDir,
	entwurfVorschauDatei,
	leseMeta,
	neueMappe,
	neuesDokument,
	registriereEntwuerfe,
	schreibeMeta,
	waehleEntwurf,
} from '@schoolbox/kern';

const MATERIAL_DIR = process.env.E2E_MATERIAL_DIR ?? '';
/** Wie `TEST_PASSWORT` in server/src/testhilfe.ts; der Testserver kennt nur dieses. */
export const PASSWORT = 'drei-kleine-woerter';

interface NeuesDokument {
	titel: string;
	art?: Art;
	format?: Format;
	/** Mit Lösungsblatt, wie es `schoolbox fertig` in meta.json einträgt. */
	loesung?: boolean;
	/** Der Ersatz-Bauer des Testservers meldet dann, dass etwas über die Seite ragt. */
	ueberlauf?: boolean;
	druckhinweise?: string[];
	/** Vorlage aus den Skill-Assets, z. B. `praesentation` (Kartoffel-Kreisinput mit allen Folien-Bausteinen). */
	vorlage?: string;
}

/** Legt eine Mappe so an, wie Claude es tut: direkt in der Ablage, am Server vorbei. */
export const legeMappeAn = async (titel: string, fach: Fach, klasse: Klasse, dokumente: NeuesDokument[] = []) => {
	const { mappe } = await neueMappe(MATERIAL_DIR, { titel, fach, klasse });
	const ids: string[] = [];
	for (const {
		art = 'arbeitsblatt',
		druckhinweise = [],
		format = 'a4-hoch',
		loesung,
		titel: dokTitel,
		ueberlauf,
		vorlage,
	} of dokumente) {
		const druckprofil = vorlage ? 'farbe' : 'sw';
		const angaben = { titel: dokTitel, art, format, druckprofil, druckhinweise, vorlage } as const;
		const { id, pfad } = await neuesDokument(MATERIAL_DIR, mappe.id, angaben);
		if (loesung || ueberlauf) {
			const zusatz = `<p${loesung ? ' data-l="7"' : ''}${ueberlauf ? ' data-test-ueberlauf' : ''}>3 + 4 = …</p>`;
			await writeFile(pfad, (await readFile(pfad, 'utf8')).replace('</body>', `${zusatz}</body>`));
			const meta = await leseMeta(MATERIAL_DIR, mappe.id, id);
			await schreibeMeta(MATERIAL_DIR, mappe.id, id, { ...meta, hatLoesung: Boolean(loesung) });
		}
		ids.push(id);
	}
	return { id: mappe.id, dokumente: ids };
};

/** Weiß, im Seitenverhältnis von A4: Für die Tests zählt das Format der Vorschau, nicht ihr Inhalt. */
const WEISSE_SEITE = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAB4AAAAqCAIAAAAruXxOAAAAKElEQVR42u3MQREAAAwCIPuX1hS7fSAA6Zmo1Wq1Wq1Wq9VqtVr9Uw9hEbYPF9a3kwAAAABJRU5ErkJggg==',
	'base64',
);
export const UEBERSTAND = '„2 Zeichne die Zeiger ein.“ ragt aus der Seite (120 px) → kürzen oder zweite Seite';

/**
 * Registriert Entwürfe wie `schoolbox entwuerfe`, nur ohne blatt.py: Vorschau und Prüfung sind vorgegeben. Jeder
 * Entwurf enthält „Inhalt <Buchstabe>“.
 */
export const legeEntwuerfeAn = async (mappe: string, dok: string, entwuerfe: { titel: string; passt?: boolean }[]) => {
	const dir = dokumentDir(MATERIAL_DIR, mappe, dok);
	const material = await readFile(path.join(dir, 'material.html'), 'utf8');
	const dateien: string[] = [];
	for (const [i, { titel }] of entwuerfe.entries()) {
		const name = String.fromCharCode(65 + i);
		const datei = path.join(dir, `entwurf-${name.toLowerCase()}.html`);
		const html = material
			.replace(/<title>.*?<\/title>/s, `<title>${name} · ${titel}</title>`)
			.replace('</section>', `<p>Inhalt ${name}</p></section>`);
		await writeFile(datei, html);
		dateien.push(datei);
	}
	await registriereEntwuerfe(MATERIAL_DIR, { mappe, dok }, dateien);
	const meta = await leseMeta(MATERIAL_DIR, mappe, dok);
	for (const [i, entwurf] of meta.entwuerfe.entries()) {
		const passt = entwuerfe[i]?.passt ?? true;
		await writeFile(path.join(dir, 'entwuerfe', entwurfVorschauDatei(entwurf.name)), WEISSE_SEITE);
		const meldungen = passt ? [] : [{ stufe: 'FEHLER' as const, seite: 1, text: UEBERSTAND }];
		entwurf.pruefung = { seiten: 1, passt, meldungen };
	}
	await schreibeMeta(MATERIAL_DIR, mappe, dok, meta);
};

export const waehle = (mappe: string, dok: string, name: string) => waehleEntwurf(MATERIAL_DIR, { mappe, dok }, name);

const leereAblage = async () => {
	const namen = await readdir(MATERIAL_DIR);
	await Promise.all(namen.map((name) => rm(path.join(MATERIAL_DIR, name), { recursive: true, force: true })));
};

export const meldeAn = async (page: Page) => {
	const antwort = await page.request.post('/api/anmelden', {
		headers: { 'x-schoolbox': '1' },
		data: { passwort: PASSWORT },
	});
	expect(antwort.status()).toBe(200);
};

interface Hilfen {
	/** Tippt mit dem Finger, wo das Gerät einen Touchscreen hat, sonst klickt die Maus. */
	druecke: (ziel: Locator) => Promise<void>;
}

/** Jeder Test beginnt angemeldet und mit leerer Ablage. */
export const test = basis.extend<Hilfen>({
	page: async ({ page }, nutze) => {
		await leereAblage();
		await meldeAn(page);
		await nutze(page);
	},
	druecke: async ({ hasTouch }, nutze) => {
		await nutze((ziel) => (hasTouch ? ziel.tap() : ziel.click()));
	},
});

export { expect };
