import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { BROWSER_HINWEIS, browserFehlt } from './browsertest';
import { ASSETS, BLATT_PY } from './konfig';
import { setzeLoesung } from './loesungen';
import type { Knoten } from './quelltext';
import {
	attribut,
	entschluessele,
	innenVon,
	klassenVon,
	schuetzeText,
	verschiebe,
	wendeAn,
	zerlege,
} from './quelltext';
import { verschiebeBaustein } from './struktur';

const ausfuehren = promisify(execFile);

const fehlt = (befehl: string, argumente: string[]) => {
	try {
		execFileSync(befehl, argumente, { stdio: 'ignore' });
		return false;
	} catch {
		return true;
	}
};

interface Bericht {
	seiten: unknown[];
	meldungen: { stufe: string; text: string }[];
}

const baue = async (ordner: string, name: string, html: string): Promise<Bericht> => {
	const datei = path.join(ordner, `${name}.html`);
	await writeFile(datei, html);
	const bericht = path.join(ordner, `${name}.json`);
	await ausfuehren('python3', [BLATT_PY, 'bauen', datei, '-o', path.join(ordner, name), '--bericht', bericht]);
	return JSON.parse(await readFile(bericht, 'utf8')) as Bericht;
};

/** Wie der Editor: Text ändern und eine Aufgabe nach vorn ziehen, nur über Text-Patches. */
const bearbeite = (quelle: string) => {
	let z = zerlege(quelle);
	const h1 = z.knoten.find((k) => k.tag === 'h1') as Knoten;
	let html = wendeAn(quelle, [{ von: h1.oeffnerEnde, bis: h1.schliesserStart, text: schuetzeText('Uhr & „ß“') }]);
	z = zerlege(html);
	const aufgaben = z.knoten.filter((k) => klassenVon(k).includes('aufgabe'));
	const [erste, , dritte] = aufgaben;
	if (erste && dritte) {
		html = wendeAn(html, verschiebe(z, dritte, erste, 'vor'));
	}
	return html;
};

/**
 * Die ersten drei Wörter der Anweisung einer Aufgabe, wie sie in der Vorlage steht. Mehr nicht, weil `pdftotext`
 * längere Anweisungen umbricht.
 */
const anfangDerAnweisung = (z: ReturnType<typeof zerlege>, aufgabe: Knoten) => {
	const anw = aufgabe.kinder.find((k) => klassenVon(k).includes('anw'));
	const text = anw?.kinder.find((k) => klassenVon(k).includes('text')) ?? anw;
	assert.ok(text, `Aufgabe ${aufgabe.nr} hat keine Anweisung`);
	return entschluessele(innenVon(z, text).replace(/<[^>]*>/g, ''))
		.trim()
		.split(/\s+/)
		.slice(0, 3)
		.join(' ');
};

describe('blatt.py auf im Editor bearbeiteten Dateien', () => {
	it('baut wie vorher, ohne Fehler und mit derselben Seitenzahl', { timeout: 300_000 }, async (t) => {
		if (browserFehlt()) {
			t.skip(BROWSER_HINWEIS);
			return;
		}
		const ordner = await mkdtemp(path.join(tmpdir(), 'schoolbox-editor-blatt-'));
		for (const name of ['vorlage-arbeitsblatt', 'beispiel-zehner-einer-kl2']) {
			const quelle = await readFile(path.join(ASSETS, `${name}.html`), 'utf8');
			const vorher = await baue(ordner, `${name}-vorher`, quelle);
			const nachher = await baue(ordner, `${name}-nachher`, bearbeite(quelle));
			assert.equal(nachher.seiten.length, vorher.seiten.length, name);
			assert.deepEqual(
				nachher.meldungen.filter((m) => m.stufe === 'FEHLER'),
				vorher.meldungen.filter((m) => m.stufe === 'FEHLER'),
				name,
			);
			const html = await readFile(path.join(ordner, `${name}-nachher`, `${name}-nachher.html`), 'utf8');
			assert.match(html, /<h1>Uhr &amp; „ß“<\/h1>/);
		}
	});

	it(
		'zeigt nach dem Umsortieren im Lösungsblatt dieselbe Reihenfolge und Nummern',
		{ timeout: 300_000 },
		async (t) => {
			if (browserFehlt() || fehlt('pdftotext', ['-v'])) {
				t.skip(BROWSER_HINWEIS);
				return;
			}
			const ordner = await mkdtemp(path.join(tmpdir(), 'schoolbox-struktur-blatt-'));
			const quelle = await readFile(path.join(ASSETS, 'vorlage-arbeitsblatt.html'), 'utf8');
			const z = zerlege(quelle);
			const aufgaben = z.knoten.filter((k) => klassenVon(k).includes('aufgabe'));
			const [erste, zweite, dritte] = aufgaben as [Knoten, Knoten, Knoten];
			const neu = verschiebeBaustein(quelle, dritte.nr, { nr: erste.nr, wo: 'vor' }, { jeSeite: false }).quelle;
			await baue(ordner, 'umsortiert', neu);
			for (const name of ['umsortiert', 'umsortiert-loesung']) {
				const pdf = path.join(ordner, 'umsortiert', `${name}.pdf`);
				const { stdout } = await ausfuehren('pdftotext', ['-layout', pdf, '-']);
				const text = stdout.replace(/\s+/g, ' ');
				const stellen = [dritte, erste, zweite].map((a, i) =>
					text.indexOf(`${i + 1} ${anfangDerAnweisung(z, a)}`),
				);
				const [vorn, mitte, hinten] = stellen as [number, number, number];
				assert.ok(vorn >= 0 && vorn < mitte && mitte < hinten, `${name}: ${stellen.join(', ')}: ${text}`);
			}
		},
	);

	it(
		'zeigt eine geänderte Lösung nur im Lösungsblatt, das Arbeitsblatt bleibt gleich',
		{ timeout: 300_000 },
		async (t) => {
			if (browserFehlt() || fehlt('pdftotext', ['-v'])) {
				t.skip(BROWSER_HINWEIS);
				return;
			}
			const ordner = await mkdtemp(path.join(tmpdir(), 'schoolbox-loesung-blatt-'));
			const quelle = await readFile(path.join(ASSETS, 'vorlage-arbeitsblatt.html'), 'utf8');
			const zweite = zerlege(quelle).knoten.filter((k) => klassenVon(k).includes('antwort'))[1] as Knoten;
			const alt = entschluessele(attribut(zweite, 'data-l')?.wert ?? '');
			const neu = 'halb fünf';
			assert.ok(alt, 'die zweite Antwort der Vorlage hat ein data-l');
			assert.ok(!quelle.includes(neu), `„${neu}“ steht schon in der Vorlage`);
			await baue(ordner, 'vorher', quelle);
			await baue(ordner, 'nachher', setzeLoesung(quelle, zweite.nr, neu));
			const pdfText = async (name: string, datei: string) =>
				(await ausfuehren('pdftotext', ['-layout', path.join(ordner, name, datei), '-'])).stdout;
			assert.equal(await pdfText('nachher', 'nachher.pdf'), await pdfText('vorher', 'vorher.pdf'));
			const loesungVorher = await pdfText('vorher', 'vorher-loesung.pdf');
			const loesungNachher = await pdfText('nachher', 'nachher-loesung.pdf');
			const anzahl = (text: string, was: string) => text.split(was).length - 1;
			assert.equal(anzahl(loesungVorher, neu), 0);
			assert.equal(anzahl(loesungNachher, neu), 1);
			assert.equal(anzahl(loesungNachher, alt), anzahl(loesungVorher, alt) - 1);
		},
	);
});
