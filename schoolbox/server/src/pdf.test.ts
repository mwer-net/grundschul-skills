import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';
import { promisify } from 'node:util';

import {
	BLATT_PY,
	dokumentDir,
	legeFreigabeAn,
	leseMeta,
	mappenDir,
	neueMappe,
	neuesDokument,
	schreibeMeta,
	widerrufeFreigabe,
} from '@schoolbox/kern';

import { inhaltsAngabe } from './pdf';
import type { TestServer } from './testhilfe';
import {
	baueErsatzAusgabe,
	BEISPIEL,
	legeDokumentAn,
	sammleEreignisse,
	schreibKoepfe,
	starteTestServer,
	UEBERLAUF,
	warte,
} from './testhilfe';

const ausfuehren = promisify(execFile);
const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';

interface Vorbereitet {
	adresse: string;
	dateiname: string;
	meldungen: { stufe: string; seite: number; text: string; dok: string; titel: string }[];
}

const FOLIE_HTML = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Folie</title><link rel="stylesheet" href="blatt.css"></head>
<body class="kl2 sw folie"><section class="seite"><h1>Wie spät ist es?</h1></section>
<section class="seite"><h1>Halb fünf</h1></section></body></html>
`;

/** Das Beispielblatt mit einer Aufgabe, die die Seite sprengt. */
const ueberlauf = async () =>
	(await readFile(BEISPIEL, 'utf8')).replace(
		'<section class="seite">',
		'<section class="seite"><div class="aufgabe" style="height:1300px" data-test-ueberlauf><span class="nr">9</span></div>',
	);

const ohneZeitstempel = (pdf: Buffer) =>
	Buffer.from(pdf.toString('latin1').replace(/\/(CreationDate|ModDate) \(D:[^)]*\)/g, ''), 'latin1');

const seitenGroessen = async (datei: string) => {
	const { stdout } = await ausfuehren('pdfinfo', ['-f', '1', '-l', '999', datei]);
	return [...stdout.matchAll(/^Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)/gm)].map((m) => `${m[1]}x${m[2]}`);
};

const vorbereiten = async (s: TestServer, pfad: string, variante: string) => {
	const antwort = await s.holen(`${s.url}${pfad}`, {
		method: 'POST',
		headers: schreibKoepfe,
		body: JSON.stringify({ variante }),
	});
	return { status: antwort.status, daten: (await antwort.json()) as Vorbereitet & { fehler?: string } };
};

const speichere = async (s: TestServer, adresse: string, ordner: string, name: string) => {
	const antwort = await s.holen(`${s.url}${adresse}`);
	assert.equal(antwort.status, 200, adresse);
	assert.equal(antwort.headers.get('content-type'), 'application/pdf');
	const datei = path.join(ordner, name);
	await writeFile(datei, Buffer.from(await antwort.arrayBuffer()));
	return datei;
};

/** Mappe mit drei Dokumenten: Beispielblatt, Blatt mit Überlauf, Folie. */
const legeDreiAn = async (materialDir: string) => {
	const { mappe } = await neueMappe(materialDir, { titel: 'Zehner und Einer', fach: 'mathematik', klasse: 2 });
	const angaben = { art: 'arbeitsblatt', druckprofil: 'sw', druckhinweise: [] } as const;
	const ids: string[] = [];
	for (const [titel, format, html] of [
		['Zehner und Einer', 'a4-hoch', await readFile(BEISPIEL, 'utf8')],
		['Zu lang', 'a4-hoch', await ueberlauf()],
		['Uhrzeit an der Tafel', 'folie', FOLIE_HTML],
	] as const) {
		const { id } = await neuesDokument(materialDir, mappe.id, { ...angaben, titel, format });
		await writeFile(path.join(dokumentDir(materialDir, mappe.id, id), 'material.html'), html);
		ids.push(id);
	}
	return { mappe: mappe.id, ids };
};

describe('PDF mit blatt.py', () => {
	let s: TestServer;
	let chromiumFehlt = false;
	let mappe = '';
	let ids: string[] = [];
	let ordner = '';

	before(async () => {
		s = await starteTestServer();
		chromiumFehlt = await ausfuehren(s.kontext.konfig.pythonBin, ['-c', CHROMIUM_DA, path.dirname(BLATT_PY)]).then(
			() => false,
			() => true,
		);
		({ ids, mappe } = await legeDreiAn(s.materialDir));
		ordner = await mkdtemp(path.join(tmpdir(), 'schoolbox-pdf-test-'));
	});
	after(() => s.stop());

	it('gleicht dem PDF aus blatt.py per Shell, mit eingebetteten Schriften', { timeout: 180_000 }, async (t) => {
		if (chromiumFehlt) {
			t.skip('kein Chromium für blatt.py gefunden');
			return;
		}
		const [dok = ''] = ids;
		const shell = path.join(ordner, 'shell');
		const quelle = path.join(dokumentDir(s.materialDir, mappe, dok), 'material.html');
		const [blatt, loesung] = await Promise.all([
			vorbereiten(s, `/api/dokumente/${mappe}/${dok}/pdf`, 'arbeitsblatt'),
			vorbereiten(s, `/api/dokumente/${mappe}/${dok}/pdf`, 'loesung'),
			ausfuehren(s.kontext.konfig.pythonBin, [BLATT_PY, 'bauen', quelle, '-o', shell]),
		]);
		assert.equal(blatt.status, 200);
		assert.deepEqual(blatt.daten.meldungen, []);
		assert.equal(blatt.daten.dateiname, 'Kl2 Mathe Zehner und Einer – Arbeitsblatt.pdf');
		for (const [antwort, referenz] of [
			[blatt, 'material.pdf'],
			[loesung, 'material-loesung.pdf'],
		] as const) {
			const datei = await speichere(s, antwort.daten.adresse, ordner, referenz);
			const [vonServer, vonShell] = await Promise.all([readFile(datei), readFile(path.join(shell, referenz))]);
			assert.ok(
				ohneZeitstempel(vonServer).equals(ohneZeitstempel(vonShell)),
				`${referenz}: bis auf die Zeitstempel byte-gleich`,
			);
			const { stdout } = await ausfuehren('pdffonts', [datei]);
			const schriften = stdout.split('\n').slice(2).filter(Boolean);
			assert.ok(schriften.some((z) => z.includes('Andika')));
			assert.ok(
				schriften.every((z) => /\byes\s+yes\s+yes\b/.test(z)),
				`${referenz}: alle Schriften eingebettet`,
			);
		}
	});

	it('kommt beim zweiten Mal aus dem Cache', { timeout: 180_000 }, async (t) => {
		if (chromiumFehlt) {
			t.skip('kein Chromium für blatt.py gefunden');
			return;
		}
		const [dok = ''] = ids;
		for (const variante of ['arbeitsblatt', 'beides']) {
			await vorbereiten(s, `/api/dokumente/${mappe}/${dok}/pdf`, variante);
			const start = performance.now();
			const { daten } = await vorbereiten(s, `/api/dokumente/${mappe}/${dok}/pdf`, variante);
			await speichere(s, daten.adresse, ordner, `${variante}.pdf`);
			const dauer = performance.now() - start;
			assert.ok(dauer < 300, `${variante}: ${Math.round(dauer)} ms`);
		}
		assert.deepEqual(await seitenGroessen(path.join(ordner, 'beides.pdf')), ['594.96x841.92', '594.96x841.92']);
	});

	it('warnt bei Überlauf, lässt aber herunterladen', { timeout: 180_000 }, async (t) => {
		if (chromiumFehlt) {
			t.skip('kein Chromium für blatt.py gefunden');
			return;
		}
		const dok = ids[1] ?? '';
		const { daten, status } = await vorbereiten(s, `/api/dokumente/${mappe}/${dok}/pdf`, 'arbeitsblatt');
		assert.equal(status, 200);
		assert.ok(daten.meldungen.length > 0);
		assert.ok(daten.meldungen.every((m) => m.stufe === 'FEHLER' && m.dok === dok && m.titel === 'Zu lang'));
		assert.ok(daten.meldungen.some((m) => m.text.includes(' ragt ')));
		assert.ok(
			daten.meldungen.every((m) => !m.text.startsWith('Lösungsblatt')),
			'nur das Arbeitsblatt',
		);
		await speichere(s, daten.adresse, ordner, 'zu-lang.pdf');
	});

	it('fasst alle Dokumente zu einem PDF zusammen, Lösungen am Ende', { timeout: 300_000 }, async (t) => {
		if (chromiumFehlt) {
			t.skip('kein Chromium für blatt.py gefunden');
			return;
		}
		const ohne = await vorbereiten(s, `/api/mappen/${mappe}/pdf`, 'alles');
		const mit = await vorbereiten(s, `/api/mappen/${mappe}/pdf`, 'alles-mit-loesungen');
		assert.equal(mit.daten.dateiname, 'Kl2 Mathe Zehner und Einer – Alles mit Lösungen.pdf');
		assert.ok(mit.daten.meldungen.some((m) => m.dok === ids[1]));

		const ausgaben = ids.map((dok) => path.join(dokumentDir(s.materialDir, mappe, dok), 'ausgabe'));
		const einzeln = async (datei: string) =>
			(
				await Promise.all(
					ausgaben
						.map((a) => path.join(a, datei))
						.filter(existsSync)
						.map(seitenGroessen),
				)
			).flat();
		const blaetter = await einzeln('material.pdf');
		const loesungen = await einzeln('material-loesung.pdf');
		assert.ok(blaetter.includes('960x540'), 'die Folie ist dabei');

		assert.deepEqual(await seitenGroessen(await speichere(s, ohne.daten.adresse, ordner, 'alles.pdf')), blaetter);
		const alles = await speichere(s, mit.daten.adresse, ordner, 'mit.pdf');
		assert.deepEqual(await seitenGroessen(alles), [...blaetter, ...loesungen]);
		assert.equal(loesungen.length, 2, 'Beispielblatt und Überlauf haben eine Lösung, die Folie nicht');
	});
});

describe('PDF: Ablauf', () => {
	let s: TestServer | undefined;
	let strom: ReturnType<typeof sammleEreignisse> | undefined;
	afterEach(async () => {
		strom?.stop();
		await s?.stop();
		s = undefined;
		strom = undefined;
	});

	it('baut je Dokument einmal, auch bei gleichzeitigen Anfragen, und meldet pdf-fertig', async () => {
		let bauten = 0;
		s = await starteTestServer({
			pdfBauer: async (dir) => {
				bauten += 1;
				await warte(150);
				await baueErsatzAusgabe(dir);
			},
		});
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir, { beispiel: true });
		strom = sammleEreignisse(s.url, s.cookie);
		await strom.bereit;
		const pfad = `/api/dokumente/${mappe}/${dok}/pdf`;
		const server = s;
		const antworten = await Promise.all(
			['arbeitsblatt', 'loesung', 'beides', 'arbeitsblatt'].map((v) => vorbereiten(server, pfad, v)),
		);
		assert.deepEqual(
			antworten.map((a) => a.status),
			[200, 200, 200, 200],
		);
		assert.equal(bauten, 1);
		assert.deepEqual(
			strom.ereignisse.map((e) => [e.typ, e.daten]),
			[['pdf-fertig', { mappe, dok }]],
		);

		await writeFile(path.join(dir, 'material.html'), (await readFile(BEISPIEL, 'utf8')).replace('Zehner', 'Zehn'));
		await vorbereiten(s, pfad, 'arbeitsblatt');
		assert.equal(bauten, 2, 'nach einer Änderung neu gebaut');
		assert.ok(!(await readdir(path.join(dir, 'ausgabe'))).includes('material-beides.pdf'), 'alte Teile sind weg');
	});

	it('baut höchstens zwei Dokumente zugleich, Vorschauen mitgezählt', async () => {
		let laufend = 0;
		let hoechstens = 0;
		const zaehle = async (arbeit: () => Promise<void>) => {
			laufend += 1;
			hoechstens = Math.max(hoechstens, laufend);
			await warte(120);
			await arbeit();
			laufend -= 1;
		};
		s = await starteTestServer({
			pdfBauer: (dir) => zaehle(() => baueErsatzAusgabe(dir)),
			vorschauBauer: (dir) => zaehle(() => writeFile(path.join(dir, 'ausgabe', 'material-s1.png'), 'PNG')),
		});
		const { ids, mappe } = await legeDreiAn(s.materialDir);
		await s.holen(`${s.url}/api/mappen/${mappe}`);
		const { daten, status } = await vorbereiten(s, `/api/mappen/${mappe}/pdf`, 'alles');
		assert.equal(status, 200);
		assert.equal(hoechstens, 2);
		assert.deepEqual(daten.meldungen, [
			{ stufe: 'FEHLER', seite: 1, text: UEBERLAUF, dok: ids[1], titel: 'Zu lang' },
		]);
	});

	it('nennt die Datei mit Umlauten richtig, als Download und zum Ansehen', async () => {
		s = await starteTestServer({ pdfBauer: baueErsatzAusgabe });
		const { dok, mappe } = await legeDokumentAn(s.materialDir, { beispiel: true });
		const meta = await leseMeta(s.materialDir, mappe, dok);
		await schreibeMeta(s.materialDir, mappe, dok, { ...meta, titel: 'Größen üben' });
		const { daten } = await vorbereiten(s, `/api/dokumente/${mappe}/${dok}/pdf`, 'arbeitsblatt');
		assert.equal(daten.dateiname, 'Kl2 Mathe Größen üben – Arbeitsblatt.pdf');
		assert.equal(
			daten.adresse,
			`/api/dokumente/${mappe}/${dok}/pdf/arbeitsblatt/Kl2%20Mathe%20Gr%C3%B6%C3%9Fen%20%C3%BCben%20%E2%80%93%20Arbeitsblatt.pdf`,
		);
		const herunter = await s.holen(`${s.url}${daten.adresse}`);
		assert.equal(
			herunter.headers.get('content-disposition'),
			'attachment; filename="Kl2 Mathe Groessen ueben - Arbeitsblatt.pdf"; filename*=UTF-8\'\'Kl2%20Mathe%20Gr%C3%B6%C3%9Fen%20%C3%BCben%20%E2%80%93%20Arbeitsblatt.pdf',
		);
		const ansehen = await s.holen(`${s.url}${daten.adresse}?anzeigen=1`);
		assert.match(ansehen.headers.get('content-disposition') ?? '', /^inline; /);
		assert.equal(
			inhaltsAngabe('inline', 'a"b\\c%d (1).pdf'),
			'inline; filename="a_b_c_d (1).pdf"; filename*=UTF-8\'\'a%22b%5Cc%25d%20%281%29.pdf',
		);
	});

	it('lehnt Unsinn ab und schützt die Dateien hinter der Anmeldung', async () => {
		s = await starteTestServer({ pdfBauer: baueErsatzAusgabe });
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir, { beispiel: true });
		await writeFile(
			path.join(dir, 'material.html'),
			(await readFile(BEISPIEL, 'utf8')).replace(/data-l=/g, 'data-x='),
		);
		const pfad = `/api/dokumente/${mappe}/${dok}/pdf`;
		assert.equal((await vorbereiten(s, pfad, 'loesung')).status, 404);
		assert.equal((await vorbereiten(s, pfad, 'loesung')).daten.fehler, 'Zu diesem Dokument gibt es keine Lösung.');
		assert.equal((await vorbereiten(s, pfad, 'alles')).status, 400);
		assert.equal((await vorbereiten(s, `/api/dokumente/${mappe}/gibt-es-nicht/pdf`, 'arbeitsblatt')).status, 404);
		assert.equal((await vorbereiten(s, '/api/mappen/gibt-es-nicht/pdf', 'alles')).status, 404);
		const ohneKopf = await s.holen(`${s.url}${pfad}`, { method: 'POST', body: '{}' });
		assert.equal(ohneKopf.status, 403);
		assert.equal((await fetch(`${s.url}${pfad}/arbeitsblatt/x.pdf`)).status, 401);
	});

	it('baut für eine Mappe, die währenddessen in den Papierkorb wandert, keinen Ordner neu', async () => {
		let weiter: () => void = () => undefined;
		const halt = new Promise<void>((resolve) => {
			weiter = resolve;
		});
		s = await starteTestServer({
			pdfBauer: async (dir) => {
				await halt;
				await baueErsatzAusgabe(dir);
			},
		});
		const { dok, mappe } = await legeDokumentAn(s.materialDir, { beispiel: true });
		const anfrage = vorbereiten(s, `/api/dokumente/${mappe}/${dok}/pdf`, 'arbeitsblatt');
		await warte(50);
		const geloescht = await s.holen(`${s.url}/api/mappen/${mappe}/loeschen`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: '{}',
		});
		assert.equal(geloescht.status, 200);
		weiter();
		assert.equal((await anfrage).status, 404);
		assert.equal(existsSync(mappenDir(s.materialDir, mappe)), false);
	});

	it('liefert über Teilen-Links nur das Freigegebene', async () => {
		s = await starteTestServer({ pdfBauer: baueErsatzAusgabe });
		const { ids, mappe } = await legeDreiAn(s.materialDir);
		const [erstes = '', zweites = ''] = ids;
		const dokLink = await legeFreigabeAn(s.materialDir, { mappe, dok: erstes });
		const mappenLink = await legeFreigabeAn(s.materialDir, { mappe, dok: null });
		const hole = async (pfad: string) => {
			const antwort = await fetch(`${s?.url}${pfad}`);
			return { status: antwort.status, daten: (await antwort.json().catch(() => null)) as Vorbereitet | null };
		};

		const blatt = await hole(`/f/${dokLink.token}/api/pdf/${erstes}/arbeitsblatt`);
		assert.equal(blatt.status, 200);
		assert.match(blatt.daten?.adresse ?? '', new RegExp(`^/f/${dokLink.token}/pdf/${erstes}/arbeitsblatt/Kl2`));
		const datei = await fetch(`${s.url}${blatt.daten?.adresse}`);
		assert.equal(datei.status, 200);
		assert.equal(datei.headers.get('content-type'), 'application/pdf');
		assert.equal((await hole(`/f/${dokLink.token}/api/pdf/${zweites}/arbeitsblatt`)).status, 404);
		assert.equal((await fetch(`${s.url}/f/${dokLink.token}/pdf/${zweites}/arbeitsblatt/x.pdf`)).status, 404);
		assert.equal((await hole(`/f/${dokLink.token}/api/alles/alles`)).status, 404);
		assert.equal((await fetch(`${s.url}/f/${dokLink.token}/alles/alles`)).status, 404);

		const alles = await hole(`/f/${mappenLink.token}/api/alles/alles-mit-loesungen`);
		assert.equal(alles.status, 200);
		assert.equal((await fetch(`${s.url}${alles.daten?.adresse}`)).status, 200);
		assert.equal((await hole(`/f/${mappenLink.token}/api/pdf/${zweites}/loesung`)).status, 200);

		await widerrufeFreigabe(s.materialDir, mappenLink.token);
		assert.equal((await hole(`/f/${mappenLink.token}/api/alles/alles`)).status, 410);
		assert.equal((await fetch(`${s.url}/f/${mappenLink.token}/alles/alles/x.pdf`)).status, 410);
	});
});
