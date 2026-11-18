import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';

import type { BildlaufStand, BildlaufWunsch, EinheitStand } from '@schoolbox/kern';
import { figurenDir, leseBibliothek } from '@schoolbox/kern';

import { BILDER_AUS, BILDER_GESPERRT } from './bild-zugang';
import type { BildlaufErgebnis } from './bild-lauf';
import { bildlaufWurzel, leseErgebnis } from './bild-lauf';
import { KI_GRENZEN, VERBRAUCH_DATEI } from './ki';
import { CSRF_HEADER } from './schutz';
import type { TestServer } from './testhilfe';
import { KI_ATTRAPPE, legeTestfigurenAn, starteTestServer } from './testhilfe';

const warte = async (bedingung: () => Promise<boolean> | boolean, ms = 20_000) => {
	const ende = Date.now() + ms;
	while (Date.now() < ende) {
		if (await bedingung()) {
			return;
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	assert.fail('Zeit abgelaufen');
};

const PNG_KOPF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WILLI_LUPE = 'Willi mit einer Lupe, der auf dem Boden genau etwas anschaut';

interface BildlaufEreignis {
	id: string;
	art: string;
	status: string;
	datei?: string;
}

describe('ergebnis.json (176)', () => {
	const mit = async (inhalt: unknown) => {
		const dir = await mkdtemp(path.join(tmpdir(), 'schoolbox-bildlauf-ergebnis-'));
		if (inhalt !== undefined) {
			await writeFile(path.join(dir, 'ergebnis.json'), JSON.stringify(inhalt));
		}
		return leseErgebnis(dir);
	};

	it('nimmt wort, name und steckbrief, wenn sie passen', async () => {
		assert.deepEqual(await mit({ wort: 'lupe', name: 'Igel', steckbrief: 'kleiner Igel' }), {
			fehler: null,
			wort: 'lupe',
			name: 'Igel',
			steckbrief: 'kleiner Igel',
		});
	});

	it('Gegenprobe: „Lupe!“ wird `neu`, Steuerzeichen und zu Langes fallen weg', async () => {
		assert.equal((await mit({ wort: 'Lupe!' })).wort, 'neu');
		assert.equal((await mit({ wort: 'a'.repeat(21) })).wort, 'neu');
		const e = await mit({ wort: 'lupe', name: 'Igel\u0007', steckbrief: 'x'.repeat(301) });
		assert.equal(e.name, null);
		assert.equal(e.steckbrief, null);
		assert.deepEqual(await mit(undefined), { fehler: null, wort: 'neu', name: null, steckbrief: null });
		assert.equal((await mit(['wort'])).wort, 'neu');
	});

	it('jeder Fehler ist bild-fehler, auch das alte canva-pause (237)', async () => {
		assert.equal((await mit({ fehler: 'canva-pause' })).fehler, 'bild-fehler');
		assert.equal((await mit({ fehler: 'bild-fehler' })).fehler, 'bild-fehler');
		assert.equal((await mit({ fehler: 'kaputt' })).fehler, 'bild-fehler');
		assert.equal((await mit({ fehler: false, wort: 'lupe' })).fehler, null);
	});
});

interface BildAufruf {
	argumente: { datei: string; prompt: string; referenzen?: string[] };
	fehler?: boolean;
	text?: string;
}

describe('Bild-Lauf der Schubladen (176, 237)', () => {
	let server: TestServer;
	let bin: string;
	const altHome = process.env.HOME;
	const ereignisse: BildlaufEreignis[] = [];
	const zeitMs = KI_GRENZEN.bildlauf.zeitMs;

	const fall = (name: string) => writeFile(path.join(path.dirname(bin), 'fall.txt'), name);
	const api = (pfad: string, init: { method?: string; body?: string } = {}) =>
		server.holen(`${server.url}/api${pfad}`, {
			...init,
			headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
		});
	const figur = (text: string) => api('/bildlauf/figur', { method: 'POST', body: JSON.stringify({ text }) });
	const starte = async (text: string) => {
		const antwort = await figur(text);
		assert.equal(antwort.status, 201, await antwort.clone().text());
		return ((await antwort.json()) as { id: string }).id;
	};
	const liste = async () => ((await (await api('/bildlauf')).json()) as { laeufe: BildlaufStand[] }).laeufe;
	const letztes = (id: string) => ereignisse.filter((e) => e.id === id).at(-1);
	const ende = async (id: string) => {
		await warte(() => ['fertig', 'fehler', 'abgebrochen'].includes(letztes(id)?.status ?? ''));
		return letztes(id);
	};
	const laeuft = (id: string) => warte(async () => (await liste()).find((l) => l.id === id)?.status === 'laeuft');
	const verbrauch = async () =>
		(await readFile(path.join(server.materialDir, VERBRAUCH_DATEI), 'utf8'))
			.trim()
			.split('\n')
			.map((z) => JSON.parse(z) as Record<string, unknown>);
	const letzterPrompt = async () =>
		(await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8')).split('\n---\n').at(-2) ?? '';
	const arbeit = (id: string) => path.join(bildlaufWurzel(server.materialDir), id);
	const sitzung = (id: string) =>
		path.join(process.env.HOME ?? '', '.claude', 'projects', arbeit(id).replace(/[^a-zA-Z0-9]/g, '-'));
	const pidDatei = () => path.join(path.dirname(bin), 'pid');
	/** Die Aufrufe von `bild_erzeugen`, wie die Attrappe von `claude` sie notiert. */
	const bildAufrufe = async () =>
		(await readFile(path.join(path.dirname(bin), 'bild.jsonl'), 'utf8').catch(() => ''))
			.split('\n')
			.filter(Boolean)
			.map((z) => JSON.parse(z) as BildAufruf);
	/** Die Herkunft einer Pose, wie `figuren.json` sie speichert. */
	const herkunft = async (figurId: string, datei: string) => {
		const roh = await readFile(path.join(figurenDir(server.materialDir), 'figuren.json'), 'utf8');
		const { figuren } = JSON.parse(roh) as { figuren: { id: string; posen: { datei: string; herkunft?: string; canva?: string }[] }[] };
		return figuren.find((f) => f.id === figurId)?.posen.find((p) => p.datei === datei);
	};
	const posen = async (figurId: string) =>
		(await leseBibliothek({ pythonBin: 'python3' }, server.materialDir))
			.find((f) => f.id === figurId)
			?.posen.map((p) => p.id);

	before(async () => {
		process.env.HOME = await mkdtemp(path.join(tmpdir(), 'bildlauf-home-'));
		const ordner = await mkdtemp(path.join(tmpdir(), 'bildlauf-bin-'));
		bin = path.join(ordner, 'claude');
		await writeFile(bin, KI_ATTRAPPE);
		await chmod(bin, 0o755);
		await fall('bildlauf-figur');
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-bildlauf-'));
		await legeTestfigurenAn(materialDir);
		server = await starteTestServer({ materialDir, env: { CLAUDE_BIN: bin } });
		server.kontext.ereignisse.abonniere((e) => {
			if (e.typ === 'bildlauf-stand') {
				ereignisse.push(e.daten);
			}
		});
	});

	after(async () => {
		process.env.HOME = altHome;
		await server.stop();
	});

	afterEach(async () => {
		KI_GRENZEN.bildlauf.zeitMs = zeitMs;
		for (const l of await liste()) {
			await api(`/bildlauf/${l.id}/abbrechen`, { method: 'POST' });
		}
		await warte(async () => (await liste()).length === 0);
		await fall('bildlauf-figur');
	});

	it('Pose: neue Pose von Willi in der Bibliothek, Ordner und Sitzung weg, Verbrauch notiert', async () => {
		const id = await starte(WILLI_LUPE);
		await warte(() => existsSync(path.join(arbeit(id), 'referenzen', 'willi.png')));
		assert.ok(!existsSync(path.join(arbeit(id), 'figur')), 'Willi hat eine Referenz: kein Bild zum Ansehen');
		const stand = (await liste()).find((l) => l.id === id);
		assert.deepEqual(stand?.ziel, { figur: 'willi', name: 'Willi' });
		assert.equal(stand?.text, WILLI_LUPE);

		assert.deepEqual(await ende(id), { id, art: 'figur', status: 'fertig', datei: 'willi-lupe.png' });
		assert.deepEqual(await posen('willi'), ['willi', 'willi-lupe']);
		const pose = (await leseBibliothek({ pythonBin: 'python3' }, server.materialDir))
			.find((f) => f.id === 'willi')
			?.posen.find((p) => p.id === 'willi-lupe');
		assert.equal(pose?.canva, undefined);
		assert.equal((await herkunft('willi', 'willi-lupe.png'))?.herkunft, 'openai');
		assert.ok(
			(await readFile(path.join(figurenDir(server.materialDir), 'willi-lupe.png')))
				.subarray(0, 8)
				.equals(PNG_KOPF),
		);
		assert.ok(!existsSync(arbeit(id)), 'Arbeitsordner weg');
		assert.ok(!existsSync(sitzung(id)), 'Sitzung weg');
		const zeile = (await verbrauch()).at(-1);
		assert.equal(zeile?.umfang, 'canva-figur');
		assert.equal(zeile?.status, 'fertig');
		assert.equal(zeile?.bildAufrufe, 1);
		assert.equal(zeile?.bildKostenUsd, 0.01);
		assert.deepEqual(await liste(), []);
		const aufruf = (await bildAufrufe()).at(-1);
		assert.deepEqual(aufruf?.argumente.referenzen, ['referenzen/willi.png']);
		assert.notEqual(aufruf?.fehler, true);
		assert.ok(!existsSync(`${arbeit(id)}-w`), 'der Ordner des Sockets ist weg');

		const prompt = await letzterPrompt();
		assert.match(prompt, /Wunsch: „Willi mit einer Lupe/);
		assert.match(prompt, /Figur Willi: Aussehen „grauer Waschbär-Junge/);
		assert.match(prompt, /; Referenz referenzen\/willi\.png$/m);
		assert.doesNotMatch(prompt, /MAHXV49zJZE/);
		assert.doesNotMatch(prompt, /^Neue Figur\./m);
	});

	it('uebernimm bekommt das geprüfte PNG, das Motiv und das Wort', async () => {
		const gesehen: (BildlaufErgebnis & { kopf: Buffer })[] = [];
		const wunsch: BildlaufWunsch = {
			art: 'figur',
			text: 'Willi mit Lupe',
			auftrag: 'Wunsch: „Willi mit Lupe“\nDatei: bild.png\n',
			ziel: { figur: 'willi', name: 'Willi' },
		};
		const { id } = server.kontext.bildlauf.starte(wunsch, {
			uebernimm: async (e) => {
				gesehen.push({ ...e, kopf: (await readFile(e.pfad)).subarray(0, 8) });
				return 'willi-test.png';
			},
		});
		assert.equal((await ende(id))?.status, 'fertig');
		const [e] = gesehen;
		assert.ok(e);
		assert.ok(e.kopf.equals(PNG_KOPF));
		assert.equal(e.datei, 'bild.png');
		assert.equal(e.motiv, 'Willi mit Lupe');
		assert.equal(e.wort, 'lupe');
		assert.equal(e.name, null);
		assert.equal(e.steckbrief, null);
	});

	it('Neue Figur: Stil-Referenz von Willi, Name und Steckbrief aus ergebnis.json', async () => {
		const id = await starte('ein Igel mit gelbem Halstuch');
		assert.deepEqual((await liste()).find((l) => l.id === id)?.ziel, { figur: null, name: null });
		assert.deepEqual(await ende(id), { id, art: 'figur', status: 'fertig', datei: 'igel.png' });
		const prompt = await letzterPrompt();
		assert.match(prompt, /^Neue Figur\. Stil-Referenz referenzen\/willi\.png \(nur der Zeichenstil\)\.$/m);
		assert.deepEqual((await bildAufrufe()).at(-1)?.argumente.referenzen, ['referenzen/willi.png']);
		const igel = (await leseBibliothek({ pythonBin: 'python3' }, server.materialDir)).find((f) => f.id === 'igel');
		assert.equal(igel?.name, 'Igel');
		assert.equal(igel?.steckbrief, 'kleiner brauner Igel mit hellem Bauch, gelbes Halstuch');
		assert.equal(igel?.canva, undefined, 'keine Canva-Referenz mehr');
		assert.equal((await herkunft('igel', 'igel.png'))?.herkunft, 'openai');
		assert.deepEqual(
			igel?.posen.map((p) => p.id),
			['igel'],
		);

		// Ein zweiter Igel ist eine neue Pose des ersten: Der Name steht jetzt in der Bibliothek.
		const zweiter = await starte('Igel mit Schal');
		assert.deepEqual(await ende(zweiter), { id: zweiter, art: 'figur', status: 'fertig', datei: 'igel-lupe.png' });
	});

	it('art „bild“ geht denselben Weg: eigenes uebernimm, Datei im Ereignis, Verbrauch canva-bild', async () => {
		const wunsch: BildlaufWunsch = {
			art: 'bild',
			text: 'Eine Uhr mit Zeigern',
			auftrag: 'Wunsch: „Eine Uhr mit Zeigern“\nDatei: bild.png\n',
			ziel: { mappe: 'mappe-a', dok: 'blatt-b' },
		};
		const { id } = server.kontext.bildlauf.starte(wunsch, { uebernimm: () => Promise.resolve('uhr.png') });
		assert.deepEqual(await ende(id), { id, art: 'bild', status: 'fertig', datei: 'uhr.png' });
		const zeile = (await verbrauch()).at(-1);
		assert.equal(zeile?.umfang, 'canva-bild');
		assert.equal(zeile?.mappe, 'mappe-a');
		assert.equal(zeile?.dok, 'blatt-b');
	});

	it('Bild-API gesperrt: Fehler mit dem Satz dazu, uebernimm wird nicht gerufen, Verwerfen nimmt ihn weg', async () => {
		await fall('bild-gesperrt');
		let gerufen = false;
		const { id } = server.kontext.bildlauf.starte(
			{ art: 'figur', text: 'Willi liest', auftrag: 'Wunsch: „Willi liest“\n', ziel: { figur: 'willi' } },
			{
				uebernimm: () => {
					gerufen = true;
					return Promise.resolve('x.png');
				},
			},
		);
		assert.equal((await ende(id))?.status, 'fehler');
		assert.equal(gerufen, false);
		const stand = (await liste()).find((l) => l.id === id);
		assert.equal(stand?.status, 'fehler');
		assert.equal(stand?.fehler, BILDER_GESPERRT);
		assert.equal((await bildAufrufe()).at(-1)?.fehler, true);
		assert.equal((await verbrauch()).at(-1)?.status, 'fehler');
		assert.equal((await api(`/bildlauf/${id}/verwerfen`, { method: 'POST' })).status, 200);
		assert.equal(letztes(id)?.status, 'abgebrochen');
		assert.deepEqual(await liste(), []);
	});

	it('bildlauf-kein-png: „Es ist kein Bild entstanden.“ (Gegenprobe zur Dateiprüfung)', async () => {
		await fall('bildlauf-kein-png');
		const id = await starte(WILLI_LUPE);
		assert.equal((await ende(id))?.status, 'fehler');
		assert.equal((await liste()).find((l) => l.id === id)?.fehler, 'Es ist kein Bild entstanden.');
		assert.deepEqual(await posen('willi'), ['willi', 'willi-lupe'], 'keine neue Pose');
	});

	it('Limit des Kontos: der Text mit dem Limit', async () => {
		await fall('fehler');
		const id = await starte(WILLI_LUPE);
		assert.equal((await ende(id))?.status, 'fehler');
		assert.match(
			(await liste()).find((l) => l.id === id)?.fehler ?? '',
			/^Das Limit des Claude-Kontos ist erreicht/,
		);
	});

	it('Frist: „Das hat zu lange gedauert.“', async () => {
		await fall('haenger');
		KI_GRENZEN.bildlauf.zeitMs = 500;
		const id = await starte(WILLI_LUPE);
		assert.equal((await ende(id))?.status, 'fehler');
		assert.equal((await liste()).find((l) => l.id === id)?.fehler, 'Das hat zu lange gedauert.');
	});

	it('Abbrechen beendet den Prozess; der Stand ist weg, der Verbrauch sagt abgebrochen', async () => {
		await fall('haenger');
		await rm(pidDatei(), { force: true });
		const id = await starte(WILLI_LUPE);
		await laeuft(id);
		await warte(() => existsSync(pidDatei()));
		const pid = Number(await readFile(pidDatei(), 'utf8'));
		const lebt = () => {
			try {
				process.kill(pid, 0);
				return true;
			} catch {
				return false;
			}
		};
		assert.ok(lebt());
		assert.equal((await api(`/bildlauf/${id}/abbrechen`, { method: 'POST' })).status, 200);
		assert.equal((await ende(id))?.status, 'abgebrochen');
		await warte(() => !lebt());
		assert.deepEqual(await liste(), []);
		const zeile = (await verbrauch()).at(-1);
		assert.equal(zeile?.status, 'abgebrochen');
		assert.equal(zeile?.umfang, 'canva-figur');
		assert.ok(!existsSync(arbeit(id)));
	});

	it('Reihe: einer läuft, fünf warten, der siebte bekommt 409; bricht der laufende ab, startet der nächste', async () => {
		await fall('haenger');
		const erster = await starte('Willi schläft');
		await laeuft(erster);
		const wartende: string[] = [];
		for (let i = 0; i < KI_GRENZEN.bildlauf.warten; i += 1) {
			wartende.push(await starte(`Willi schläft ${i}`));
		}
		const siebter = await figur('Willi schläft noch mehr');
		assert.equal(siebter.status, 409);
		assert.deepEqual(await siebter.json(), { fehler: 'Es warten schon fünf Bilder.' });
		assert.deepEqual(
			(await liste()).map((l) => l.status),
			['laeuft', 'wartet', 'wartet', 'wartet', 'wartet', 'wartet'],
		);
		const anzahl = (await verbrauch().catch(() => [])).length;
		await api(`/bildlauf/${wartende[4] ?? ''}/abbrechen`, { method: 'POST' });
		assert.equal((await liste()).length, 5);
		assert.equal((await verbrauch().catch(() => [])).length, anzahl, 'ein wartender Auftrag kostet nichts');

		await api(`/bildlauf/${erster}/abbrechen`, { method: 'POST' });
		await laeuft(wartende[0] ?? '');
	});

	it('Einheit mit Bildern: 409; ohne Bilder: 201', async () => {
		const einheit = async (bilder: boolean) => {
			await fall('einheit-haenger');
			const antwort = await api('/einheiten', {
				method: 'POST',
				body: JSON.stringify({
					angaben: { thema: 'Uhrzeit', fach: 'mathematik', klasse: 2, bilder, aussehen: 'eigen' },
					ordner: null,
				}),
			});
			assert.equal(antwort.status, 201, await antwort.clone().text());
			const { id } = (await antwort.json()) as { id: string };
			const stand = async () => (await (await api(`/einheiten/${id}`)).json()) as EinheitStand;
			// Gebaut wird erst nach der Freigabe des Plans.
			await warte(async () => (await stand()).status === 'plan');
			assert.equal((await api(`/einheiten/${id}/freigeben`, { method: 'POST', body: '{}' })).status, 200);
			await warte(async () => Object.keys((await stand()).importiert).length === 1);
			return {
				stopp: async () => {
					await api(`/einheiten/${id}/abbrechen`, { method: 'POST' });
					await warte(async () => (await stand()).status !== 'laeuft');
				},
			};
		};

		const mitBildern = await einheit(true);
		const abgelehnt = await figur(WILLI_LUPE);
		assert.equal(abgelehnt.status, 409);
		assert.deepEqual(await abgelehnt.json(), { fehler: 'Die Unterrichtseinheit erzeugt gerade Bilder.' });
		await mitBildern.stopp();

		const ohneBilder = await einheit(false);
		await fall('haenger');
		const id = await starte(WILLI_LUPE);
		await laeuft(id);
		await ohneBilder.stopp();
	});

	it('Referenz: Kiki ohne Steckbrief bekommt ihre Grundpose als Referenz, ohne Willi als Stil', async () => {
		await fall('haenger');
		const id = await starte('Kiki springt');
		await laeuft(id);
		const referenz = path.join(arbeit(id), 'referenzen', 'kiki.png');
		await warte(() => existsSync(referenz));
		assert.ok(
			(await readFile(referenz)).equals(await readFile(path.join(figurenDir(server.materialDir), 'kiki.png'))),
		);
		await warte(async () => (await letzterPrompt()).includes('Kiki springt'));
		const prompt = await letzterPrompt();
		assert.match(
			prompt,
			/^Figur Kiki: kein Steckbrief, Bild referenzen\/kiki\.png; Referenz referenzen\/kiki\.png$/m,
		);
		assert.ok(!existsSync(path.join(arbeit(id), 'referenzen', 'willi.png')), 'keine Stil-Referenz');
		await api(`/bildlauf/${id}/abbrechen`, { method: 'POST' });
		await ende(id);
		assert.ok(!existsSync(arbeit(id)), 'die Kopie geht mit dem Ordner');
	});

	it('API: 400 bei leerem Text, über 300 Zeichen und zwei Namen; 404 bei fremder Id; 409 beim Verwerfen eines Laufs', async () => {
		const fehler = async (text: unknown) => {
			const antwort = await api('/bildlauf/figur', { method: 'POST', body: JSON.stringify({ text }) });
			return [antwort.status, ((await antwort.json()) as { fehler: string }).fehler];
		};
		assert.deepEqual(await fehler(''), [400, 'Beschreibe die Figur.']);
		assert.deepEqual(await fehler('   '), [400, 'Beschreibe die Figur.']);
		assert.deepEqual(await fehler(42), [400, 'Beschreibe die Figur.']);
		assert.deepEqual(await fehler('a'.repeat(301)), [400, 'Höchstens 300 Zeichen.']);
		assert.deepEqual(await fehler('Willi und Wilma lesen'), [400, 'Eine Figur je Bild.']);
		assert.deepEqual(await liste(), [], 'keiner dieser Wünsche hat einen Lauf');

		for (const id of ['abcdefabcdef', '..%2F..%2Fetc', 'ABCDEFABCDEF']) {
			assert.equal((await api(`/bildlauf/${id}/abbrechen`, { method: 'POST' })).status, 404, id);
			assert.equal((await api(`/bildlauf/${id}/verwerfen`, { method: 'POST' })).status, 404, id);
		}

		await fall('haenger');
		const id = await starte(WILLI_LUPE);
		await laeuft(id);
		assert.equal((await api(`/bildlauf/${id}/verwerfen`, { method: 'POST' })).status, 409);
	});

	it('ohne Schlüssel für OpenAI: 409 mit dem Satz für die Lehrkraft, kein Lauf', async () => {
		const ohne = await starteTestServer({
			materialDir: await mkdtemp(path.join(tmpdir(), 'schoolbox-bildlauf-ohne-')),
			env: { CLAUDE_BIN: bin, OPENAI_API_KEY: '' },
		});
		try {
			const antwort = await ohne.holen(`${ohne.url}/api/bildlauf/figur`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
				body: JSON.stringify({ text: WILLI_LUPE }),
			});
			assert.equal(antwort.status, 409);
			assert.deepEqual(await antwort.json(), { fehler: BILDER_AUS });
			assert.deepEqual(ohne.kontext.bildlauf.liste(), []);
		} finally {
			await ohne.stop();
		}
	});
});
