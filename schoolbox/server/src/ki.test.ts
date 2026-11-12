import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';

import type { Pruefbericht } from '@schoolbox/kern';
import {
	attribut,
	AUFTRAG_ZEICHEN,
	auftragAus,
	dokumentDir,
	KI_AKTIONEN,
	leereAntworten,
	listeVersionen,
	WURZEL,
	zerlege,
} from '@schoolbox/kern';
import { erzeugeReferenz } from '@schoolbox/kern/src/referenz';

import {
	canvaEinstellungen,
	KI_GRENZEN,
	kiArgumente,
	kiTempWurzel,
	kiUmgebung,
	liesLimit,
	limitErreichtText,
} from './ki';
import { CSRF_HEADER } from './schutz';
import type { TestServer } from './testhilfe';
import { KI_ATTRAPPE, legeDokumentAn, starteTestServer } from './testhilfe';

const warte = async (bedingung: () => Promise<boolean> | boolean, ms = 15_000) => {
	const ende = Date.now() + ms;
	while (Date.now() < ende) {
		if (await bedingung()) {
			return;
		}
		await new Promise((r) => setTimeout(r, 50));
	}
	assert.fail('Zeit abgelaufen');
};

describe('Aufträge an Claude', () => {
	let server: TestServer;
	let bin: string;
	let home: string;
	const altHome = process.env.HOME;
	let mappe: string;
	let dok: string;
	let pruefbericht: Pruefbericht = { seiten: [], meldungen: [], fehler: 0 };
	let pruefungKaputt = false;
	let pruefungZaehlt: () => void = () => undefined;
	let pruefungHaelt: Promise<void> | null = null;
	const fall = (name: string) => writeFile(path.join(path.dirname(bin), 'fall.txt'), name);
	const api = (pfad: string, init: { method?: string; body?: string } = {}) =>
		server.holen(`${server.url}/api${pfad}`, {
			...init,
			headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
		});
	const starte = (body: object) =>
		api(`/dokumente/${mappe}/${dok}/ki`, { method: 'POST', body: JSON.stringify(body) });
	const fertig = async (id: string) => {
		let a: { status: string; fehler: string | null; schritte: string[] } = {
			status: '',
			fehler: null,
			schritte: [],
		};
		await warte(async () => {
			a = ((await (await api(`/ki/${id}`)).json()) as { auftrag: typeof a }).auftrag;
			return ['fertig', 'fehler', 'abgebrochen'].includes(a.status);
		});
		return a;
	};
	const auftrag = async (body: object = { auftrag: 'Mach es schöner' }) => {
		const res = await starte(body);
		assert.equal(res.status, 202);
		return fertig(((await res.json()) as { auftrag: { id: string } }).auftrag.id);
	};
	const quelle = () => readFile(path.join(dokumentDir(server.materialDir, mappe, dok), 'material.html'), 'utf8');
	/** Aufträge ohne Gespräch legen ihren Vorschlag unter `blatt` ab, sonst unter der Id des Gesprächs (135). */
	const vorschlagQuelle = (schluessel = 'blatt') =>
		readFile(
			path.join(dokumentDir(server.materialDir, mappe, dok), 'vorschlag', schluessel, 'material.html'),
			'utf8',
		);
	const aufrufe = async () =>
		(await readFile(path.join(path.dirname(bin), 'aufrufe.jsonl'), 'utf8')).trim().split('\n').length;
	const vorschlag = async () =>
		(
			(await (await api(`/dokumente/${mappe}/${dok}/vorschlag`)).json()) as {
				vorschlag: Record<string, unknown> | null;
			}
		).vorschlag;
	const tmpLeer = async () =>
		(await readdir(kiTempWurzel(server.materialDir)).catch(() => [] as string[])).filter((d) =>
			d.startsWith('lauf-'),
		);

	before(async () => {
		home = await mkdtemp(path.join(tmpdir(), 'ki-home-'));
		process.env.HOME = home;
		const ordner = await mkdtemp(path.join(tmpdir(), 'ki-bin-'));
		bin = path.join(ordner, 'claude');
		await writeFile(bin, KI_ATTRAPPE);
		await chmod(bin, 0o755);
		await writeFile(path.join(ordner, 'fall.txt'), 'gut');
		server = await starteTestServer({
			env: { CLAUDE_BIN: bin },
			kiPruefer: async () => {
				await pruefungHaelt;
				pruefungZaehlt();
				if (pruefungKaputt) {
					throw new Error('blatt.py kaputt');
				}
				return pruefbericht;
			},
		});
		({ dok, mappe } = await legeDokumentAn(server.materialDir, { beispiel: true }));
	});

	after(async () => {
		process.env.HOME = altHome;
		await server.stop();
	});

	afterEach(async () => {
		await fall('gut');
		const { vorschlaege } = (await (await api(`/dokumente/${mappe}/${dok}/vorschlaege`)).json()) as {
			vorschlaege: { schluessel: string }[];
		};
		for (const v of vorschlaege) {
			await api(`/dokumente/${mappe}/${dok}/vorschlag/verwerfen`, {
				method: 'POST',
				body: JSON.stringify({ gespraech: v.schluessel }),
			});
		}
	});

	it('Auftrag läuft bis zum Vorschlag: Quelle unverändert, Temp-Ordner und Sitzung weg', async () => {
		const vorher = await quelle();
		const a = await auftrag();
		assert.equal(a.status, 'fertig', a.fehler ?? '');
		assert.deepEqual(a.schritte.slice(0, 2), ['Liest die Regeln: fach-mathematik', 'Ändert das Blatt']);
		assert.equal(await quelle(), vorher);
		const v = await vorschlag();
		assert.equal(v?.antwort, 'Annahme: Klasse 2');
		assert.equal(v?.konflikt, false);
		assert.deepEqual(await tmpLeer(), []);
		const projekte = await readdir(path.join(home, '.claude', 'projects')).catch(() => []);
		assert.deepEqual(
			projekte.filter((n) => n.includes('schoolbox-ki')),
			[],
		);
	});

	it('Der Aufruf bleibt abgeschottet', async () => {
		await auftrag();
		const zeilen = (await readFile(path.join(path.dirname(bin), 'aufrufe.jsonl'), 'utf8')).trim().split('\n');
		const { args, cwd, env } = JSON.parse(zeilen.at(-1) ?? '{}') as { args: string[]; cwd: string; env: string[] };
		const nach = (name: string) => args[args.indexOf(name) + 1];
		assert.equal(nach('--model'), 'opus');
		assert.equal(nach('--effort'), 'medium');
		assert.equal(nach('--max-budget-usd'), '5');
		assert.equal(nach('--tools'), 'Read,Edit,Skill');
		assert.equal(nach('--setting-sources'), 'project');
		assert.equal(args.includes('--strict-mcp-config'), true);
		assert.equal(args.includes('--disable-slash-commands'), false);
		assert.equal(args.includes('--bare'), false);
		assert.equal(nach('--permission-mode'), 'dontAsk');
		assert.match(nach('--disallowedTools') ?? '', /\.claude/);
		const ablage = nach('--add-dir') ?? '';
		assert.equal(ablage.startsWith(tmpdir()), true);
		assert.equal(ablage.includes(server.materialDir), false);
		assert.equal(cwd.endsWith('arbeit'), true);
		assert.deepEqual(
			env.filter((n) => /KEY|TOKEN|PASSWORT|GEHEIMNIS/i.test(n)),
			[],
		);
		assert.equal(env.includes('HOME'), true);
	});

	it('Umgebung ohne Geheimnisse, auch wenn der Server welche hat', () => {
		process.env.ANTHROPIC_API_KEY = 'nie-weitergeben';
		try {
			assert.equal(kiUmgebung('/x/claude').ANTHROPIC_API_KEY, undefined);
			assert.equal(Object.keys(kiUmgebung('/x/claude')).sort().join(), 'HOME,LANG,PATH');
		} finally {
			delete process.env.ANTHROPIC_API_KEY;
		}
		const args = kiArgumente({ ablage: '/a', auftragDatei: '/b', modell: 'sonnet' });
		assert.equal(args.includes('--resume'), false);
	});

	it('Annehmen schreibt genau eine Version von Claude, Verwerfen lässt die Quelle byteidentisch', async () => {
		const vorher = await quelle();
		await auftrag();
		await api(`/dokumente/${mappe}/${dok}/vorschlag/verwerfen`, { method: 'POST' });
		assert.equal(await quelle(), vorher);
		assert.equal(await vorschlag(), null);

		await auftrag();
		const dir = dokumentDir(server.materialDir, mappe, dok);
		const anzahl = (await listeVersionen(dir)).length;
		const res = await api(`/dokumente/${mappe}/${dok}/vorschlag/annehmen`, { method: 'POST' });
		assert.equal(res.status, 200);
		assert.match(await quelle(), /von Claude<\/h1>/);
		const versionen = await listeVersionen(dir);
		assert.equal(versionen.length, anzahl + 1);
		assert.equal(versionen.at(-1)?.urheber, 'claude');
		assert.equal(await vorschlag(), null);
	});

	it('Konflikt: Geänderte Quelle wird nicht überschrieben', async () => {
		await auftrag();
		const dir = dokumentDir(server.materialDir, mappe, dok);
		const datei = path.join(dir, 'material.html');
		const geaendert = (await readFile(datei, 'utf8')).replace('</h1>', ' Eigenes</h1>');
		await writeFile(datei, geaendert);
		assert.equal((await vorschlag())?.konflikt, true);
		const res = await api(`/dokumente/${mappe}/${dok}/vorschlag/annehmen`, { method: 'POST' });
		assert.equal(res.status, 409);
		assert.equal(await readFile(datei, 'utf8'), geaendert);
	});

	it('Abbruch beendet den Prozess und räumt auf', async () => {
		await fall('haenger');
		const pidDatei = path.join(path.dirname(bin), 'pid');
		await rm(pidDatei, { force: true });
		const res = await starte({ auftrag: 'Häng' });
		const { auftrag: a } = (await res.json()) as { auftrag: { id: string } };
		await warte(() => existsSync(pidDatei));
		const pid = Number(await readFile(pidDatei, 'utf8'));
		await api(`/ki/${a.id}/abbrechen`, { method: 'POST' });
		assert.equal((await fertig(a.id)).status, 'abgebrochen');
		assert.throws(() => process.kill(pid, 0));
		assert.deepEqual(await tmpLeer(), []);
		assert.equal(await vorschlag(), null);
	});

	it('Zweiter Auftrag wartet, ein Fehler blockiert die Warteschlange nicht', async () => {
		await fall('abmeldung');
		const erst = (await (await starte({ auftrag: 'eins' })).json()) as { auftrag: { id: string } };
		const zweit = (await (await starte({ auftrag: 'zwei' })).json()) as { auftrag: { id: string; status: string } };
		assert.equal(zweit.auftrag.status, 'wartet');
		const a = await fertig(erst.auftrag.id);
		assert.equal(a.status, 'fehler');
		await fall('gut');
		const b = await fertig(zweit.auftrag.id);
		assert.ok(['fertig', 'fehler'].includes(b.status));
	});

	it('Fehlerbilder sind verständlich, und was Claude sonst anlegt, wird verworfen', async () => {
		await fall('abmeldung');
		assert.match((await auftrag()).fehler ?? '', /nicht angemeldet/);
		await fall('leer');
		assert.match((await auftrag()).fehler ?? '', /nichts am Blatt geändert/);
		await fall('gross');
		assert.match((await auftrag()).fehler ?? '', /zu groß/);
		await fall('aussen');
		assert.equal((await auftrag()).status, 'fertig');
		const dir = path.join(dokumentDir(server.materialDir, mappe, dok), 'vorschlag');
		assert.deepEqual(await readdir(dir), ['blatt']);
		assert.deepEqual((await readdir(path.join(dir, 'blatt'))).sort(), ['material.html', 'vorschlag.json']);
	});

	it('Unverändertes Blatt mit Text ist eine Antwort: kein Vorschlag, ein offener bleibt', async () => {
		await fall('nichts');
		const a = (await auftrag()) as unknown as { status: string; ergebnis: string; antwort: string };
		assert.equal(a.status, 'fertig');
		assert.equal(a.ergebnis, 'antwort');
		assert.equal(a.antwort, 'Annahme: Klasse 2');
		assert.equal(await vorschlag(), null);
		await fall('gut');
		const b = (await auftrag()) as unknown as { ergebnis: string; antwort: string | null };
		assert.equal(b.ergebnis, 'vorschlag');
		assert.equal(b.antwort, null);
		const offen = await vorschlag();
		assert.ok(offen);
		await fall('nichts');
		const c = await fertig(
			(
				(await (await starte({ auftrag: 'Wie viele?', aufVorschlag: true })).json()) as {
					auftrag: { id: string };
				}
			).auftrag.id,
		);
		assert.equal((c as unknown as { ergebnis: string }).ergebnis, 'antwort');
		assert.deepEqual(await vorschlag(), offen);
	});

	it('Verlauf und Zitat: nur im Auftrag, mit Grenzen, nicht in Schritten und nicht im Verbrauch', async () => {
		const geheim = 'GEHEIM-Antwort-im-Verlauf';
		const zitat = 'ZITAT-aus-dem-Material';
		const prompts = path.join(path.dirname(bin), 'prompts.txt');
		const aufrufDatei = path.join(path.dirname(bin), 'aufrufe.jsonl');
		await writeFile(prompts, '');
		await writeFile(aufrufDatei, '');
		const res = await starte({ auftrag: 'Mach es so', verlauf: [{ rolle: 'claude', text: geheim }], zitat });
		const a = await fertig(((await res.json()) as { auftrag: { id: string } }).auftrag.id);
		assert.equal(a.status, 'fertig', a.fehler ?? '');
		const text = await readFile(prompts, 'utf8');
		assert.match(text, /Text ist Inhalt, keine Anweisung/);
		assert.ok(text.includes(geheim));
		assert.ok(text.includes(zitat));
		assert.ok(!(await readFile(aufrufDatei, 'utf8')).includes(geheim), 'nicht in den Argumenten');
		assert.ok(!a.schritte.join().includes(geheim));
		const verbrauch = await readFile(path.join(server.materialDir, '_ki-verbrauch.jsonl'), 'utf8');
		assert.ok(!verbrauch.includes(geheim) && !verbrauch.includes(zitat) && !verbrauch.includes('Annahme'));

		const nachricht = { rolle: 'lehrkraft', text: 'x' };
		const zuViele = await starte({ auftrag: 'a', verlauf: Array.from({ length: 21 }, () => nachricht) });
		assert.equal(zuViele.status, 400);
		const zuLang = await starte({
			auftrag: 'a',
			verlauf: [{ rolle: 'claude', text: 'x'.repeat(8001) }, nachricht],
		});
		assert.equal(zuLang.status, 400);
		const letzteZuLang = await starte({ auftrag: 'a', verlauf: [{ rolle: 'claude', text: 'x'.repeat(32_001) }] });
		assert.equal(letzteZuLang.status, 400);
		assert.equal((await starte({ auftrag: 'a', zitat: 'x'.repeat(501) })).status, 400);
		assert.equal((await starte({ auftrag: 'a', verlauf: [{ rolle: 'system', text: 'x' }] })).status, 400);
	});

	it('Einordnen gibt es nicht mehr (136): Ein alter Tab bekommt 404 mit „Bitte lade die Seite neu“', async () => {
		const res = await api('/ki/einordnen', { method: 'POST', body: JSON.stringify({ text: 'Uhrzeiten' }) });
		assert.equal(res.status, 404);
		const { fehler } = (await res.json()) as { fehler: string };
		assert.match(fehler, /Bitte lade die Seite neu/);
	});

	it('Freies Element: ganzes Blatt, wird ein Vorschlag, läuft durch die Blattprüfung', async () => {
		await fall('frei');
		const a = await auftrag({ auftrag: 'Mach ein Tangram in Form eines Waschbärs' });
		assert.equal(a.status, 'fertig', a.fehler ?? '');
		assert.equal(a.schritte.includes('Bessert nach'), false);
		const neu = await vorschlagQuelle();
		assert.match(neu, /data-frei-titel="Tangram Waschbär"/);
		assert.match(neu, /viewBox="0 0 100 100"/);
	});

	for (const [art, muster] of [
		['frei-skript', /<script>/],
		['frei-ereignis', /onload/],
		['frei-extern', /boese\.example/],
		['frei-use', /boese\.example/],
	] as const) {
		it(`${art}: kein Vorschlag, eine Korrekturrunde, Meldung im Chat, nichts still entfernt`, async () => {
			const vorher = await quelle();
			await fall(art);
			const laeufe = await aufrufe();
			const a = await auftrag();
			assert.equal(a.status, 'fehler');
			assert.match(a.fehler ?? '', /keinen Vorschlag/);
			assert.equal(a.schritte.includes('Bessert nach'), true);
			assert.equal(await vorschlag(), null);
			assert.equal(await quelle(), vorher);
			assert.equal((await aufrufe()) - laeufe, 2);
			const prompts = await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8');
			assert.match(prompts.split('---').at(-2) ?? '', /Sicherheitsprüfung/);
			assert.doesNotMatch(await quelle(), muster);
		});
	}

	it('Die Blattprüfung öffnet gesperrtes HTML nie im Browser', async () => {
		let geprueft = 0;
		const alt = pruefungZaehlt;
		pruefungZaehlt = () => {
			geprueft += 1;
		};
		try {
			await fall('frei-skript');
			await auftrag();
			assert.equal(geprueft, 0);
		} finally {
			pruefungZaehlt = alt;
		}
	});

	it('Korrekturrunde behebt den Fund: Der Vorschlag entsteht sauber', async () => {
		await fall('frei-nachgebessert');
		const a = await auftrag();
		assert.equal(a.status, 'fertig', a.fehler ?? '');
		assert.equal(a.schritte.includes('Bessert nach'), true);
		const neu = await vorschlagQuelle();
		assert.doesNotMatch(neu, /<script>window/);
		assert.match(neu, /data-frei/);
		assert.equal((await vorschlag())?.antwort, 'Ohne Skript gebaut.');
	});

	it('Claude stellt das Blatt wieder her und erklärt: Antwort statt Vorschlag', async () => {
		await fall('frei-absage');
		const a = await auftrag();
		assert.equal(a.status, 'fertig', a.fehler ?? '');
		assert.equal((a as unknown as { ergebnis: string }).ergebnis, 'antwort');
		assert.equal((a as unknown as { antwort: string }).antwort, 'Etwas zum Anklicken geht hier nicht.');
		assert.equal(await vorschlag(), null);
	});

	it('Ein offener Vorschlag bleibt, wenn Nachbessern an der Sperre scheitert', async () => {
		await auftrag();
		const offen = await vorschlagQuelle();
		await fall('frei-skript');
		const a = await auftrag({ auftrag: 'Noch etwas', aufVorschlag: true });
		assert.equal(a.status, 'fehler');
		assert.equal(await vorschlagQuelle(), offen);
	});

	it('Bestands-Skript bleibt beim Tipp-Vorschlag, die Quelle wird nicht bereinigt', async () => {
		const pfad = path.join(dokumentDir(server.materialDir, mappe, dok), 'material.html');
		const alt = await quelle();
		const mitSkript = alt.replace('</head>', '<script>window.bestand = 1</script></head>');
		assert.notEqual(mitSkript, alt);
		await writeFile(pfad, mitSkript);
		try {
			const a = await auftrag({ auftrag: 'Tippfehler' });
			assert.equal(a.status, 'fertig', a.fehler ?? '');
			const neu = await vorschlagQuelle();
			assert.match(neu, /<script>window\.bestand = 1<\/script>/);
			assert.match(neu, / von Claude<\/h1>/);
		} finally {
			await writeFile(pfad, alt);
		}
	});

	const teilReferenz = async (tag: string) => {
		const z = zerlege(await quelle());
		const k = z.knoten.find((n) => n.tag === tag || attribut(n, 'class')?.wert?.split(' ').includes(tag));
		assert.ok(k);
		return erzeugeReferenz(
			z,
			k.nr,
			{ mappe: { id: mappe, titel: 'M', fach: 'mathematik', klasse: 2 }, dokument: { id: dok, titel: 'D' } },
			false,
		);
	};

	it('Ausschnitt: Das äußere Element darf ersetzt werden, der Rest bleibt byteidentisch', async () => {
		const vorher = await quelle();
		const z = zerlege(vorher);
		const k = z.knoten.find((n) => attribut(n, 'class')?.wert?.split(' ').includes('aufgabe'));
		assert.ok(k);
		await fall('frei');
		const a = await auftrag({ auftrag: 'Waschbär', referenz: await teilReferenz('aufgabe') });
		assert.equal(a.status, 'fertig', a.fehler ?? '');
		const neu = await vorschlagQuelle();
		assert.ok(neu.startsWith(`${vorher.slice(0, k.start)}<figure data-frei`));
		assert.ok(neu.endsWith(`</figure>${vorher.slice(k.ende)}`));
		const prompts = await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8');
		assert.match(prompts.split('---').at(-2) ?? '', /durch ein freies Element ersetzen/);
		assert.equal(zerlege(neu).knoten.filter((n) => attribut(n, 'data-frei')).length, 1);
	});

	it('Ausschnitt: Zwei Elemente statt einem gehen in die Korrekturrunde', async () => {
		await fall('frei-zwei');
		const a = await auftrag({ auftrag: 'Waschbär', referenz: await teilReferenz('aufgabe') });
		assert.equal(a.status, 'fertig', a.fehler ?? '');
		assert.equal(a.schritte.includes('Bessert nach'), true);
		const prompts = await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8');
		assert.match(prompts.split('---').at(-2) ?? '', /genau ein Element/);
		assert.equal(zerlege(await vorschlagQuelle()).knoten.filter((n) => attribut(n, 'data-frei')).length, 1);
	});

	it('Das Werkzeug bleibt: Der Quellcode ist für freie Elemente nicht freigegeben', () => {
		const args = kiArgumente({ ablage: '/a', auftragDatei: '/b', modell: 'm' });
		assert.equal(args[args.indexOf('--tools') + 1], 'Read,Edit,Skill');
		assert.equal(args[args.indexOf('--allowedTools') + 1], 'Edit(./material.html)');
	});

	it('Der Auftrag sagt: nicht absagen, frei bauen, und verweist auf den Skill', async () => {
		const text = await readFile(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'auftrag.md'), 'utf8');
		assert.match(text, /nie ab/);
		assert.match(text, /Freies Element/);
		// Eine Quelle (Entscheidung 27): Die Liste steht im Kern, nicht im Prompt.
		assert.doesNotMatch(text, /foreignObject|<iframe>/);
	});

	it('Ausschnitt: Claude sieht nur den Teil, der Rest des Blatts bleibt byteidentisch', async () => {
		const vorher = await quelle();
		const z = zerlege(vorher);
		const h1 = z.knoten.find((k) => k.tag === 'h1');
		assert.ok(h1);
		const seite = z.knoten.find((k) => k.tag === 'section' || attribut(k, 'class')?.wert?.includes('seite'));
		assert.ok(seite);
		const referenz = erzeugeReferenz(
			z,
			seite.nr,
			{ mappe: { id: mappe, titel: 'M', fach: 'mathematik', klasse: 2 }, dokument: { id: dok, titel: 'D' } },
			false,
		);
		const a = await auftrag({ auftrag: 'Teil', referenz });
		assert.equal(a.status, 'fertig', a.fehler ?? '');
		const v = await vorschlag();
		assert.notEqual(v?.umfang, 'Ganzes Blatt');
		const neu = await vorschlagQuelle();
		const ende = vorher.indexOf('</h1>');
		assert.equal(neu, `${vorher.slice(0, ende)} von Claude${vorher.slice(ende)}`);
		const prompts = await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8');
		assert.match(prompts.split('---').at(-2) ?? '', /enthält nur diesen Teil/);
	});

	it('Falsche Referenz wird gleich abgelehnt', async () => {
		const res = await starte({ auftrag: 'x', referenz: '[sb:andere-mappe/anderes-dok#seite1]' });
		assert.equal(res.status, 400);
	});

	it('Nachbessern arbeitet auf dem Vorschlag und behält die Basis', async () => {
		await auftrag();
		const erst = await vorschlag();
		await auftrag({ auftrag: 'Noch einmal', aufVorschlag: true });
		const zweit = await vorschlag();
		assert.equal(zweit?.basis, erst?.basis);
		const neu = await vorschlagQuelle();
		assert.equal(neu.split('von Claude').length, (await quelle()).split('von Claude').length + 2);
	});

	it('Serverneustart: Reste werden beendet und entfernt', async () => {
		const wurzel = kiTempWurzel(server.materialDir);
		await mkdir(path.join(wurzel, 'lauf-alt'), { recursive: true });
		const kind = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', wurzel], { stdio: 'ignore' });
		const zu = new Promise((r) => kind.once('close', r));
		await writeFile(path.join(wurzel, 'pid'), String(kind.pid));
		const fremd = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
		await server.kontext.ki.beendeReste();
		await zu;
		assert.equal(existsSync(wurzel), false);
		// Eine fremde PID in der Datei trifft keinen fremden Prozess
		await mkdir(wurzel, { recursive: true });
		await writeFile(path.join(wurzel, 'pid'), String(fremd.pid));
		await server.kontext.ki.beendeReste();
		assert.equal(process.kill(fremd.pid ?? 0, 0), true);
		fremd.kill();
	});

	it('Korrekturrunde höchstens einmal, mit dem Bericht und derselben Sitzung', async () => {
		pruefbericht = {
			seiten: [],
			meldungen: [{ stufe: 'FEHLER', seite: 1, text: 'Überlauf auf Seite 1' }],
			fehler: 1,
		};
		try {
			const vorher = (await readFile(path.join(path.dirname(bin), 'aufrufe.jsonl'), 'utf8'))
				.trim()
				.split('\n').length;
			const a = await auftrag();
			assert.equal(a.status, 'fertig');
			assert.equal(a.schritte.includes('Bessert nach'), true);
			const zeilen = (await readFile(path.join(path.dirname(bin), 'aufrufe.jsonl'), 'utf8')).trim().split('\n');
			assert.equal(zeilen.length, vorher + 2);
			const { args } = JSON.parse(zeilen.at(-1) ?? '{}') as { args: string[] };
			assert.equal(args[args.indexOf('--resume') + 1], 's1');
			const prompts = await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8');
			assert.match(prompts.split('---').at(-2) ?? '', /Überlauf auf Seite 1/);
			assert.equal((await vorschlag())?.fehler, 1);
		} finally {
			pruefbericht = { seiten: [], meldungen: [], fehler: 0 };
		}
	});

	it('Scheitert nur die Prüfung, bleibt der Vorschlag mit einem Hinweis', async () => {
		pruefungKaputt = true;
		try {
			assert.equal((await auftrag()).status, 'fertig');
			const v = (await vorschlag()) as { meldungen: { stufe: string; text: string }[] } | null;
			assert.equal(v?.meldungen[0]?.stufe, 'WARNUNG');
			assert.match(v?.meldungen[0]?.text ?? '', /nicht automatisch prüfen/);
		} finally {
			pruefungKaputt = false;
		}
	});

	it('Verbrauch ohne Inhalte im Log', async () => {
		await auftrag({ auftrag: 'GEHEIMER-AUFTRAGSTEXT' });
		const log = await readFile(path.join(server.materialDir, '_ki-verbrauch.jsonl'), 'utf8');
		const letzte = JSON.parse(log.trim().split('\n').at(-1) ?? '{}') as Record<string, unknown>;
		assert.equal(letzte.kostenUsd, 0.01);
		assert.equal(log.includes('GEHEIMER-AUFTRAGSTEXT'), false);
	});

	it('Aktionen laden ihre Skills und tragen ihren Namen', async () => {
		const res = await starte({ aktion: 'einfache-sprache' });
		assert.equal(res.status, 202);
		const { auftrag: a } = (await res.json()) as { auftrag: { id: string } };
		assert.equal((await fertig(a.id)).status, 'fertig');
		assert.equal((await vorschlag())?.auftrag, 'Einfache Sprache');
		const prompts = await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8');
		assert.match(prompts.split('---').at(-2) ?? '', /Lade zuerst diese Skills: grundschul-didaktik\./);
		await api(`/dokumente/${mappe}/${dok}/vorschlag/verwerfen`, { method: 'POST' });
		const fach = await starte({ aktion: 'leichter' });
		await fertig(((await fach.json()) as { auftrag: { id: string } }).auftrag.id);
		const zweite = await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8');
		assert.match(zweite.split('---').at(-2) ?? '', /grundschul-didaktik, fach-mathematik, arbeitsblatt/);
		assert.equal((await starte({ aktion: 'gibt-es-nicht' })).status, 400);
		await api(`/dokumente/${mappe}/${dok}/vorschlag/verwerfen`, { method: 'POST' });
		assert.equal((await starte({ aktion: 'neu-entwurf' })).status, 400);
		// Den freien Wunsch ohne Antworten gibt es seit 136 nicht mehr.
		const frei = await starte({ aktion: 'neu-entwurf', auftrag: 'Igel im Herbst' });
		assert.equal(frei.status, 400);
		assert.match(((await frei.json()) as { fehler: string }).fehler, /Material anlegen/);
	});

	it('Neuer Entwurf aus dem Assistenten: Auftrag aus den Antworten, Format von Claude (131)', async () => {
		const zweit = await legeDokumentAn(server.materialDir, { beispiel: true });
		const pfad = `/dokumente/${zweit.mappe}/${zweit.dok}`;
		const neu = (body: object) =>
			api(`${pfad}/ki`, { method: 'POST', body: JSON.stringify({ aktion: 'neu-entwurf', ...body }) });
		const durch = async (body: object) => {
			const res = await neu(body);
			assert.equal(res.status, 202);
			const a = await fertig(((await res.json()) as { auftrag: { id: string } }).auftrag.id);
			assert.equal(a.status, 'fertig');
			const prompts = await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8');
			return prompts.split('---').at(-2) ?? '';
		};
		const verwerfen = () => api(`${pfad}/vorschlag/verwerfen`, { method: 'POST' });

		// Fach und Klasse bestimmt der Behälter, nicht der Browser.
		const antworten = { thema: 'Igel im Herbst', lerngruppe: ['daz' as const], fach: 'englisch', klasse: 4 };
		const erwartet = auftragAus({
			...leereAntworten({ fach: 'mathematik', klasse: 2 }),
			...antworten,
			fach: 'mathematik',
			klasse: 2,
		});
		assert.ok((await durch({ antworten })).includes(`Auftrag der Lehrkraft (aus dem Assistenten):\n${erwartet}`));
		await verwerfen();

		for (const falsch of [
			{ art: 'quiz', thema: 'x' },
			{ boese: 1, thema: 'x' },
			{ weg: 'leer', titel: 'x' },
			{},
			[],
		]) {
			assert.equal((await neu({ antworten: falsch })).status, 400, JSON.stringify(falsch));
		}
		assert.equal((await neu({ antworten, auftragText: 'x'.repeat(AUFTRAG_ZEICHEN + 1) })).status, 400);

		const eigen = await durch({ antworten, auftragText: 'Ein Igel-Blatt mit EIGENEM Text.' });
		assert.match(eigen, /Ein Igel-Blatt mit EIGENEM Text\./);
		assert.doesNotMatch(eigen, /Thema: „Igel im Herbst“/);
		await verwerfen();
		// Der längste Auftrag passt samt Vorlage unter die Grenze des Servers.
		await durch({ antworten, auftragText: 'x'.repeat(AUFTRAG_ZEICHEN) });
		await verwerfen();

		try {
			await fall('format-fremd');
			await durch({ antworten });
			const v = (await (await api(`${pfad}/vorschlag`)).json()) as {
				vorschlag: { meldungen: { stufe: string; text: string }[] };
			};
			assert.ok(
				v.vorschlag.meldungen.some((m) => m.stufe === 'FEHLER' && /„a2-hoch“ gibt es nicht/.test(m.text)),
			);
			await verwerfen();

			await fall('format-quer');
			await durch({ antworten });
			assert.equal((await api(`${pfad}/vorschlag/annehmen`, { method: 'POST' })).status, 200);
			const meta = JSON.parse(await readFile(path.join(zweit.dir, 'meta.json'), 'utf8')) as { format: string };
			assert.equal(meta.format, 'a4-quer');
		} finally {
			await fall('gut');
		}
	});

	it('Neues Blatt (133): gekennzeichnet, nach dem Neuladen wiederzufinden, Nachbessern und Nochmal am Server', async () => {
		const blatt = await legeDokumentAn(server.materialDir, { beispiel: true });
		const pfad = `/dokumente/${blatt.mappe}/${blatt.dok}`;
		type Auftrag = { id: string; status: string; neuesBlatt?: boolean; seit?: string };
		const stand = async () =>
			(await (await api(`${pfad}/ki`)).json()) as { auftraege: Auftrag[]; entwurf: Auftrag | null };
		const vorschlagHier = async (frage = '') =>
			(
				(await (await api(`${pfad}/vorschlag${frage}`)).json()) as {
					vorschlag: { neuesBlatt?: boolean; quelle?: string } | null;
				}
			).vorschlag;
		const starteHier = async (body: object, ziel = `${pfad}/ki`) => {
			const res = await api(ziel, { method: 'POST', body: JSON.stringify(body) });
			assert.equal(res.status, 202);
			return (await fertig(((await res.json()) as { auftrag: { id: string } }).auftrag.id)) as unknown as Auftrag;
		};

		// Ein Auftrag aus dem Chat zählt nicht als neues Blatt.
		await starteHier({ auftrag: 'Mach es schöner' });
		assert.equal((await stand()).entwurf, null);
		assert.equal((await vorschlagHier())?.neuesBlatt, undefined);
		await api(`${pfad}/vorschlag/verwerfen`, { method: 'POST' });

		const erst = await starteHier({ aktion: 'neu-entwurf', antworten: { thema: 'Igel' } });
		assert.equal(erst.neuesBlatt, true);
		assert.ok(erst.seit);
		assert.equal((await stand()).entwurf?.id, erst.id);
		assert.equal((await vorschlagHier())?.neuesBlatt, true);
		assert.equal((await vorschlagHier())?.quelle, undefined);
		assert.match((await vorschlagHier('?quelle=1'))?.quelle ?? '', /von Claude/);

		// Nachbessern erkennt der Server am offenen Entwurf.
		const nach = await starteHier({ auftrag: 'Größer', aufVorschlag: true });
		assert.equal(nach.neuesBlatt, true);
		assert.equal((await stand()).entwurf?.id, nach.id);
		assert.equal((await vorschlagHier())?.neuesBlatt, true);

		// Verwerfen vergisst den Entwurf; „Nochmal“ startet denselben ersten Auftrag.
		await api(`${pfad}/vorschlag/verwerfen`, { method: 'POST' });
		assert.equal((await stand()).entwurf, null);
		const prompts = path.join(path.dirname(bin), 'prompts.txt');
		const nochmal = await starteHier({}, `${pfad}/ki/nochmal`);
		assert.equal(nochmal.neuesBlatt, true);
		assert.match((await readFile(prompts, 'utf8')).split('---').at(-2) ?? '', /Thema: „Igel“/);
		assert.equal((await api(`${pfad}/vorschlag/annehmen`, { method: 'POST' })).status, 200);
		assert.equal((await stand()).entwurf, null);

		// Eine Meldung lässt sich schließen; ohne ersten Auftrag gibt es kein „Nochmal“.
		await fall('fehler');
		try {
			const kaputt = await starteHier({ aktion: 'neu-entwurf', antworten: { thema: 'Igel' } });
			assert.equal(kaputt.status, 'fehler');
			assert.equal((await stand()).entwurf?.status, 'fehler');
			assert.equal((await api(`${pfad}/ki/entwurf/vergessen`, { method: 'POST' })).status, 200);
			assert.equal((await stand()).entwurf, null);
		} finally {
			// Der Fall „fehler“ meldet ein Limit und sperrt damit jeden weiteren Auftrag.
			await fall('gut');
			await api('/ki/limit/pruefen', { method: 'POST' });
		}
		const ander = await legeDokumentAn(server.materialDir, { beispiel: true });
		const res = await api(`/dokumente/${ander.mappe}/${ander.dok}/ki/nochmal`, { method: 'POST' });
		assert.equal(res.status, 404);
	});

	it('Laufende neue Blätter stehen in der Liste für die Ablage (133)', async () => {
		const blatt = await legeDokumentAn(server.materialDir, { beispiel: true });
		await fall('haenger');
		try {
			const res = await api(`/dokumente/${blatt.mappe}/${blatt.dok}/ki`, {
				method: 'POST',
				body: JSON.stringify({ aktion: 'neu-entwurf', antworten: { thema: 'Igel' } }),
			});
			const { auftrag: lauf } = (await res.json()) as { auftrag: { id: string } };
			const liste = async () =>
				((await (await api('/ki/entwuerfe')).json()) as { entwuerfe: { dok: string }[] }).entwuerfe;
			assert.ok((await liste()).some((e) => e.dok === blatt.dok));
			await api(`/ki/${lauf.id}/abbrechen`, { method: 'POST' });
			assert.equal((await fertig(lauf.id)).status, 'abgebrochen');
			assert.equal((await liste()).length, 0);
		} finally {
			await fall('gut');
		}
	});

	it('Prompts: Jede Aktion hat einen, ohne Regeln, Pfade oder Namen', async () => {
		const ids = new Set(KI_AKTIONEN.map((a) => a.id));
		assert.equal(ids.size, KI_AKTIONEN.length);
		for (const { id, skills } of KI_AKTIONEN) {
			const text = await readFile(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', `${id}.md`), 'utf8');
			assert.doesNotMatch(text, /x-[a-z]|data-|class=|<[a-z]|\d+\s?(mm|px)|https?:/i, id);
			assert.equal(text.includes(homedir()), false, id);
			for (const skill of skills) {
				assert.equal(existsSync(path.join(WURZEL, 'skills', skill, 'SKILL.md')), true, skill);
			}
		}
	});

	it('Am Limit: klare Meldung, kein Neuversuch, kein neuer Auftrag', async () => {
		await fall('fehler');
		const promptAnzahl = async () =>
			(await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8')).split('---').length;
		const vorher = await promptAnzahl();
		const a = await auftrag();
		assert.match(a.fehler ?? '', /Limit des Claude-Kontos ist erreicht/);
		assert.equal(await promptAnzahl(), vorher + 1);
		const zweiter = await starte({ auftrag: 'noch einer' });
		assert.equal(zweiter.status, 429);
		assert.equal(await promptAnzahl(), vorher + 1);
		const { limit } = (await (await api('/ki/status')).json()) as { limit: { status: string } };
		assert.equal(limit.status, 'rejected');
		await fall('gut');
		await api('/ki/limit/pruefen', { method: 'POST' });
	});

	it('Limit-Ereignis: Auslastung und Zeitpunkt', () => {
		const l = liesLimit({
			status: 'allowed_warning',
			resetsAt: 1794265200,
			unifiedWindows: {
				five_hour: { utilization: 0.25, resetsAt: 1793756400 },
				seven_day: { utilization: 0.45 },
			},
		});
		assert.equal(l.status, 'allowed_warning');
		assert.equal(l.fenster.fuenfStunden.auslastung, 0.25);
		assert.equal(l.fenster.sieben.zurueck, null);
		assert.equal(l.zurueck, new Date(1794265200 * 1000).toISOString());
		assert.equal(l.guthaben, null);
		assert.equal(l.laeuftUeberGuthaben, false);
		assert.equal(l.fensterArt, null);
	});

	it('Limit-Ereignis: Guthaben aus dem Konto, Unbekanntes gilt nicht als erlaubt', () => {
		const gemessen = {
			status: 'rejected',
			resetsAt: 1794265200,
			rateLimitType: 'seven_day',
			overageStatus: 'allowed',
			overageResetsAt: 1796083200,
			isUsingOverage: true,
		};
		const l = liesLimit(gemessen);
		assert.equal(l.guthaben, 'erlaubt');
		assert.equal(l.laeuftUeberGuthaben, true);
		assert.equal(l.fensterArt, 'woche');
		// Das Guthaben-Limit hat ein eigenes Datum, das des Abos zählt.
		assert.equal(l.zurueck, new Date(1794265200 * 1000).toISOString());
		assert.equal(liesLimit({ ...gemessen, overageStatus: 'rejected' }).guthaben, 'abgelehnt');
		assert.equal(liesLimit({ ...gemessen, overageStatus: 'irgendwas' }).guthaben, null);
		assert.equal(liesLimit({ ...gemessen, overageStatus: 1 }).guthaben, null);
		assert.equal(liesLimit({ ...gemessen, isUsingOverage: 'true' }).laeuftUeberGuthaben, false);
		assert.equal(liesLimit({ ...gemessen, rateLimitType: 'five_hour' }).fensterArt, 'fuenfStunden');
	});

	it('limitErreichtText: mit Datum, ohne Aussage über die Claude-App', () => {
		const text = limitErreichtText('2030-03-17T23:00:00.000Z');
		assert.match(text, /Wieder möglich ab Montag, 18\.3\., 00:00 Uhr/);
		assert.doesNotMatch(text, /Claude-App/);
		assert.doesNotMatch(limitErreichtText(null), /Claude-App|ab /);
	});

	it('älteres Blatt mit data-aufmachung: Vorschlag steht so da, wie Claude ihn schreibt (180)', async () => {
		const datei = path.join(dokumentDir(server.materialDir, mappe, dok), 'material.html');
		const alt = await quelle();
		const bestand = await readFile(
			path.join(WURZEL, 'schoolbox', 'kern', 'src', 'testdaten', 'bestand-aufmachung.html'),
			'utf8',
		);
		await writeFile(datei, bestand);
		try {
			pruefbericht = { seiten: [], meldungen: [], fehler: 0 };
			await fall('flaeche-gelb');
			assert.equal((await auftrag({ auftrag: 'Mach die Fläche gelb' })).status, 'fertig');
			const erwartet = bestand.replace('--f1:var(--a-flaeche)', '--f1:#fff3c4');
			assert.notEqual(erwartet, bestand);
			// Kein Abgleich mehr: Früher setzte er die Fläche aus den Werten am body zurück.
			assert.equal(await vorschlagQuelle(), erwartet);
			assert.deepEqual((await vorschlag())?.meldungen, []);
		} finally {
			await writeFile(datei, alt);
		}
	});

	describe('Gespräch (087)', () => {
		const benutzt = new Set<string>();
		const gespraech = (name: string) => {
			benutzt.add(name);
			return name;
		};
		const ordner = (id: string) => path.join(kiTempWurzel(server.materialDir), `gespraech-${id}`);
		const projektVon = (cwd: string) => path.join(home, '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
		const projektDer = (id: string) => projektVon(path.join(ordner(id), 'arbeit'));
		const beende = (id: string) => api(`/ki/gespraech/${id}`, { method: 'DELETE', body: '{}' });
		const cliAufrufe = async () =>
			(await readFile(path.join(path.dirname(bin), 'aufrufe.jsonl'), 'utf8'))
				.trim()
				.split('\n')
				.map((z) => JSON.parse(z) as { args: string[]; cwd: string })
				.filter((a) => a.args[0] !== 'auth');
		const letzterAufruf = async () => {
			const a = (await cliAufrufe()).at(-1);
			assert.ok(a);
			return a;
		};
		const resumeVon = ({ args }: { args: string[] }) =>
			args.includes('--resume') ? args[args.indexOf('--resume') + 1] : null;
		const letzterPrompt = async () =>
			(await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8')).split('\n---\n').at(-2) ?? '';
		const letzterVerbrauch = async () => {
			const zeilen = (await readFile(path.join(server.materialDir, '_ki-verbrauch.jsonl'), 'utf8'))
				.trim()
				.split('\n');
			return JSON.parse(zeilen.at(-1) ?? '{}') as Record<string, unknown>;
		};

		afterEach(async () => {
			await Promise.all([...benutzt].map(beende));
			benutzt.clear();
		});

		it('Zweiter Auftrag setzt fort: dieselbe Sitzung, derselbe Ordner. Ein anderes Gespräch nicht', async () => {
			const id = gespraech('erstes-gespraech');
			await auftrag({ auftrag: 'Mach es schöner', gespraechId: id });
			const erst = await letzterAufruf();
			assert.equal(resumeVon(erst), null);
			assert.equal(erst.cwd, path.join(ordner(id), 'arbeit'));
			assert.ok(!(await letzterPrompt()).includes('jetzige Stand'));

			const stand = JSON.parse(await readFile(path.join(ordner(id), 'sitzung.json'), 'utf8')) as Record<
				string,
				unknown
			>;
			assert.equal(stand.sitzung, 's1');
			assert.equal(stand.mappe, mappe);
			assert.equal(stand.dok, dok);
			assert.equal(typeof stand.zuletzt, 'string');

			await auftrag({
				auftrag: 'Ja, mach das',
				gespraechId: id,
				verlauf: [{ rolle: 'claude', text: 'NUR-IM-RUECKFALL' }],
			});
			const zweit = await letzterAufruf();
			assert.equal(resumeVon(zweit), 's1');
			assert.equal(zweit.cwd, erst.cwd);
			const text = await letzterPrompt();
			assert.ok(text.includes('material.html ist der jetzige Stand'));
			assert.ok(!text.includes('NUR-IM-RUECKFALL'), 'Fortsetzen braucht den Verlauf nicht');
			const verbrauch = await letzterVerbrauch();
			assert.equal(verbrauch.fortgesetzt, true);
			assert.equal(verbrauch.rueckfall, false);

			await auftrag({ auftrag: 'Anderes', gespraechId: gespraech('zweites-gespraech') });
			const anderes = await letzterAufruf();
			assert.equal(resumeVon(anderes), null);
			assert.notEqual(anderes.cwd, erst.cwd);
			assert.ok(existsSync(projektDer(id)), 'Das Ende eines anderen Laufs räumt dieses Gespräch nicht weg');
		});

		it('material.html wird vor jedem Lauf frisch aus der Quelle geschrieben', async () => {
			const id = gespraech('frisch');
			await auftrag({ auftrag: 'Eins', gespraechId: id });
			const datei = path.join(dokumentDir(server.materialDir, mappe, dok), 'material.html');
			const vorher = await readFile(datei, 'utf8');
			try {
				await writeFile(datei, vorher.replace('</h1>', ' VON-HAND</h1>'));
				await fall('nichts');
				await auftrag({ auftrag: 'Zwei', gespraechId: id });
				const arbeit = await readFile(path.join(ordner(id), 'arbeit', 'material.html'), 'utf8');
				assert.ok(arbeit.includes('VON-HAND'));
				// Die Quelle kann aus früheren Tests schon „von Claude“ tragen; der erste Lauf darf nichts dazutun.
				assert.equal(arbeit.split('von Claude').length, vorher.split('von Claude').length);
			} finally {
				await writeFile(datei, vorher);
			}
		});

		it('Der jeweils aktuelle Ausschnitt geht mit, auch wenn die Auswahl wechselt', async () => {
			const id = gespraech('ausschnitt');
			await fall('nichts');
			await auftrag({ auftrag: 'Eins', gespraechId: id });
			const voll = (await readFile(path.join(ordner(id), 'arbeit', 'material.html'), 'utf8')).length;
			const q = await quelle();
			const z = zerlege(q);
			const seite = z.knoten.find((k) => k.tag === 'section' || attribut(k, 'class')?.wert?.includes('seite'));
			assert.ok(seite);
			const referenz = erzeugeReferenz(
				z,
				seite.nr,
				{ mappe: { id: mappe, titel: 'M', fach: 'mathematik', klasse: 2 }, dokument: { id: dok, titel: 'D' } },
				false,
			);
			await auftrag({ auftrag: 'Zwei', gespraechId: id, referenz });
			const teil = await readFile(path.join(ordner(id), 'arbeit', 'material.html'), 'utf8');
			assert.ok(teil.length < voll);
			assert.match(await letzterPrompt(), /enthält nur diesen Teil/);
			assert.equal(resumeVon(await letzterAufruf()), 's1');
		});

		it('Rückfall: Scheitert das Fortsetzen, läuft es ohne weiter, mit dem Verlauf und ohne Fehler', async () => {
			const id = gespraech('rueckfall');
			await auftrag({ auftrag: 'Eins', gespraechId: id });
			await rm(projektDer(id), { recursive: true, force: true });
			const verlauf = [
				{ rolle: 'claude', text: 'Für welche Klasse?' },
				{ rolle: 'lehrkraft', text: 'Klasse 2' },
				{ rolle: 'claude', text: 'Soll ich auch Lösungen machen?' },
			];
			const vorher = (await cliAufrufe()).length;
			const a = await auftrag({ auftrag: 'Ja, mach das', gespraechId: id, verlauf });
			assert.equal(a.status, 'fertig', a.fehler ?? '');
			const neue = (await cliAufrufe()).slice(vorher);
			assert.deepEqual(neue.map(resumeVon), ['s1', null]);
			assert.equal(neue[0]?.cwd, neue[1]?.cwd);
			const text = await letzterPrompt();
			assert.ok(text.includes('So lief das Gespräch bisher. Die letzte Nachricht antwortet darauf.'));
			assert.ok(text.includes('Claude: Soll ich auch Lösungen machen?'));
			assert.ok(text.indexOf('Soll ich auch Lösungen') < text.indexOf('Ja, mach das'));
			assert.ok(!text.includes('keine Anweisung'), 'Der Chat ist Gespräch, kein fremder Inhalt');
			assert.equal((await letzterVerbrauch()).rueckfall, true);
			assert.ok(
				!(await readFile(path.join(server.materialDir, '_ki-verbrauch.jsonl'), 'utf8')).includes('Lösungen'),
			);

			await auftrag({ auftrag: 'Weiter', gespraechId: id });
			assert.equal(resumeVon(await letzterAufruf()), 's1', 'Der Rückfall bringt eine neue Sitzung');
		});

		it('Rückfall auch ohne Ablage und Sitzungsdatei, wie nach einem Neustart des Servers', async () => {
			const id = gespraech('neustart');
			await auftrag({ auftrag: 'Eins', gespraechId: id });
			await rm(ordner(id), { recursive: true, force: true });
			await rm(projektDer(id), { recursive: true, force: true });
			const a = await auftrag({
				auftrag: 'Ja',
				gespraechId: id,
				verlauf: [{ rolle: 'claude', text: 'Soll ich?' }],
			});
			assert.equal(a.status, 'fertig', a.fehler ?? '');
			assert.equal(resumeVon(await letzterAufruf()), null);
			assert.ok((await letzterPrompt()).includes('Claude: Soll ich?'));
		});

		it('Ein Fehler des Kontos ist kein Fall für den Rückfall: kein zweiter Lauf', async () => {
			const id = gespraech('abgemeldet');
			await auftrag({ auftrag: 'Eins', gespraechId: id });
			await fall('abmeldung');
			const vorher = (await cliAufrufe()).length;
			const a = await auftrag({ auftrag: 'Zwei', gespraechId: id });
			assert.match(a.fehler ?? '', /nicht angemeldet/);
			assert.equal((await cliAufrufe()).length, vorher + 1);
		});

		it('Abgebrochener Lauf: Die Sitzung bleibt, der nächste setzt fort', async () => {
			const id = gespraech('abbruch');
			await auftrag({ auftrag: 'Eins', gespraechId: id });
			await fall('haenger');
			const pidDatei = path.join(path.dirname(bin), 'pid');
			await rm(pidDatei, { force: true });
			const res = await starte({ auftrag: 'Häng', gespraechId: id });
			const { auftrag: a } = (await res.json()) as { auftrag: { id: string } };
			await warte(() => existsSync(pidDatei));
			await new Promise((r) => setTimeout(r, 200));
			await api(`/ki/${a.id}/abbrechen`, { method: 'POST' });
			assert.equal((await fertig(a.id)).status, 'abgebrochen');
			await fall('gut');
			assert.equal((await auftrag({ auftrag: 'Weiter', gespraechId: id })).status, 'fertig');
			assert.equal(resumeVon(await letzterAufruf()), 's1');
		});

		it('Folgenachricht baut auf dem offenen Vorschlag auf, die Basis bleibt die alte Quelle', async () => {
			const id = gespraech('nachbessern');
			const vorher = await quelle();
			await auftrag({ auftrag: 'Die Ohren größer', gespraechId: id });
			const basis = (await vorschlag())?.basis;
			await auftrag({ auftrag: 'Noch größer', gespraechId: id, aufVorschlag: true });
			assert.match(await letzterPrompt(), /deinen offenen Vorschlag/);
			// Zwei Läufe, zwei Zusätze, gezählt gegen die Quelle (sie kann aus früheren Tests schon einen tragen).
			assert.equal((await vorschlagQuelle(id)).split('von Claude').length, vorher.split('von Claude').length + 2);
			assert.equal((await vorschlag())?.basis, basis);
			assert.equal((await vorschlag())?.konflikt, false);
			assert.equal(await quelle(), vorher);
		});

		it('Ein Gespräch gehört zu einem Dokument: Mit einem anderen beginnt es neu', async () => {
			const id = gespraech('ein-dokument');
			await auftrag({ auftrag: 'Eins', gespraechId: id });
			const anderes = await legeDokumentAn(server.materialDir, { beispiel: true });
			const res = await api(`/dokumente/${anderes.mappe}/${anderes.dok}/ki`, {
				method: 'POST',
				body: JSON.stringify({ auftrag: 'Zwei', gespraechId: id }),
			});
			const { auftrag: a } = (await res.json()) as { auftrag: { id: string } };
			assert.equal((await fertig(a.id)).status, 'fertig');
			assert.equal(resumeVon(await letzterAufruf()), null);
			const stand = JSON.parse(await readFile(path.join(ordner(id), 'sitzung.json'), 'utf8')) as { dok: string };
			assert.equal(stand.dok, anderes.dok);
		});

		it('DELETE löscht Ordner und Sitzungsablage sofort, ein offener Vorschlag bleibt', async () => {
			const id = 'loeschen';
			await auftrag({ auftrag: 'Eins', gespraechId: id });
			assert.ok(existsSync(ordner(id)));
			assert.ok(existsSync(projektDer(id)));
			assert.equal((await beende(id)).status, 200);
			assert.ok(!existsSync(ordner(id)));
			assert.ok(!existsSync(projektDer(id)));
			assert.ok(await vorschlag());
			assert.equal((await beende(id)).status, 200, 'Zweimal beenden ist kein Fehler');
		});

		it('DELETE während eines Auftrags: Er läuft zu Ende, sein Vorschlag bleibt, gelöscht wird danach', async () => {
			const id = 'laeuft-noch';
			let weiter = () => undefined as void;
			pruefungHaelt = new Promise<void>((r) => {
				weiter = r;
			});
			try {
				const res = await starte({ auftrag: 'Eins', gespraechId: id });
				const { auftrag: a } = (await res.json()) as { auftrag: { id: string } };
				await warte(async () => (await (await api(`/ki/${a.id}`)).text()).includes('Prüft das Ergebnis'));
				assert.equal((await beende(id)).status, 200);
				assert.ok(existsSync(ordner(id)), 'Erst am Ende des Laufs');
				weiter();
				assert.equal((await fertig(a.id)).status, 'fertig');
				await warte(() => !existsSync(ordner(id)) && !existsSync(projektDer(id)));
				assert.ok(await vorschlag());
			} finally {
				pruefungHaelt = null;
				weiter();
			}
		});

		it('Ungültige Kennungen ergeben 400 und berühren nichts', async () => {
			for (const falsch of ['../raus', 'A-B', 'a b', 'a/b', '', 'x'.repeat(65), 7, 'blatt', 'alt']) {
				const res = await starte({ auftrag: 'a', gespraechId: falsch });
				assert.equal(res.status, 400, String(falsch));
			}
			assert.equal((await beende('..%2F..%2Fraus')).status, 400);
			assert.equal((await beende('GROSS')).status, 400);
		});

		it('Aufräumen löscht nur Abgelaufene und nur mit eigenem Prefix', async () => {
			const alt = 'abgelaufen';
			const frisch = gespraech('noch-frisch');
			await auftrag({ auftrag: 'Eins', gespraechId: alt });
			await auftrag({ auftrag: 'Zwei', gespraechId: frisch });
			const datei = path.join(ordner(alt), 'sitzung.json');
			const stand = JSON.parse(await readFile(datei, 'utf8')) as Record<string, unknown>;
			const vorGrenze = Date.now() - KI_GRENZEN.gespraechMs - 1000;
			await writeFile(datei, JSON.stringify({ ...stand, zuletzt: new Date(vorGrenze).toISOString() }));
			const fremd = path.join(home, '.claude', 'projects', '-tmp-schoolbox-ki-fremdeablage-gespraech-x-arbeit');
			await mkdir(fremd, { recursive: true });
			const fremderOrdner = path.join(tmpdir(), 'schoolbox-ki-fremdeablage', 'gespraech-x');
			await mkdir(fremderOrdner, { recursive: true });
			try {
				await server.kontext.ki.raeumeAuf();
				assert.ok(!existsSync(ordner(alt)));
				assert.ok(!existsSync(projektDer(alt)));
				assert.ok(existsSync(ordner(frisch)));
				assert.ok(existsSync(projektDer(frisch)));
				assert.ok(existsSync(fremd), 'Fremdes Projekt bleibt');
				assert.ok(existsSync(fremderOrdner), 'Fremder Ordner bleibt');
			} finally {
				await rm(fremd, { recursive: true, force: true });
				await rm(path.dirname(fremderOrdner), { recursive: true, force: true });
			}
		});

		it('Beim Serverstart verschwinden alle eigenen Gespräche', async () => {
			const id = 'vor-dem-neustart';
			await auftrag({ auftrag: 'Eins', gespraechId: id });
			await server.kontext.ki.beendeReste();
			assert.ok(!existsSync(ordner(id)));
			assert.ok(!existsSync(projektDer(id)));
		});

		it('Verbrauch: Cache getrennt gezählt; ab 100.000 Token im Kontext ein Hinweis, nichts automatisch', async () => {
			const id = gespraech('sehr-langes-gespraech');
			await fall('kontext-gross');
			const a = (await auftrag({ auftrag: 'Eins', gespraechId: id })) as unknown as {
				kontextGross: boolean;
				status: string;
			};
			assert.equal(a.status, 'fertig');
			assert.equal(a.kontextGross, true);
			assert.ok(existsSync(ordner(id)), 'Das Gespräch bleibt');
			const verbrauch = await letzterVerbrauch();
			assert.equal(verbrauch.fortgesetzt, false);
			assert.ok(!Object.values(verbrauch).some((w) => String(w).includes(id)));
			await fall('gut');
			const b = (await auftrag({ auftrag: 'Zwei', gespraechId: id })) as unknown as { kontextGross: boolean };
			assert.equal(b.kontextGross, false);
		});

		describe('Mehrere Gespräche an einem Blatt (135)', () => {
			type Offen = { schluessel: string; gespraech?: string; konflikt: boolean; umfang: string; quelle?: string };
			let gesichert = '';
			const quellDatei = () => path.join(dokumentDir(server.materialDir, mappe, dok), 'material.html');
			const alle = async () =>
				((await (await api(`/dokumente/${mappe}/${dok}/vorschlaege`)).json()) as { vorschlaege: Offen[] })
					.vorschlaege;
			const vorschlagVon = async (schluessel: string) =>
				(
					(await (await api(`/dokumente/${mappe}/${dok}/vorschlag?gespraech=${schluessel}`)).json()) as {
						vorschlag: Offen | null;
					}
				).vorschlag;
			/** Frühere Tests können der Quelle schon etwas angehängt haben, darum wird gezählt. */
			const anzahl = (html: string, was = 'von Claude') => html.split(was).length - 1;
			const nimm = (schluessel: string) =>
				api(`/dokumente/${mappe}/${dok}/vorschlag/annehmen`, {
					method: 'POST',
					body: JSON.stringify({ gespraech: schluessel }),
				});

			before(async () => {
				gesichert = await quelle();
			});
			afterEach(async () => {
				await writeFile(quellDatei(), gesichert);
			});

			it('Zwei Gespräche: je ein Vorschlag, der zweite wartet; Annehmen zieht den anderen nach', async () => {
				const eins = gespraech('blase-titel');
				const zwei = gespraech('blase-aufgabe');
				const [titel, aufgabe] = [await teilReferenz('h1'), await teilReferenz('aufgabe')];
				const vorher = await quelle();
				const [n, d] = [anzahl(vorher), anzahl(vorher, 'data-von-claude')];
				const r1 = (await (await starte({ auftrag: 'Titel', gespraechId: eins, referenz: titel })).json()) as {
					auftrag: { id: string };
				};
				const r2 = (await (
					await starte({ auftrag: 'Aufgabe', gespraechId: zwei, referenz: aufgabe })
				).json()) as { auftrag: { id: string; status: string } };
				assert.equal(r2.auftrag.status, 'wartet');
				assert.equal((await fertig(r1.auftrag.id)).status, 'fertig');
				assert.equal((await fertig(r2.auftrag.id)).status, 'fertig');

				const offen = await alle();
				assert.deepEqual(
					offen.map((v) => [v.schluessel, v.gespraech, v.konflikt]),
					[
						[eins, eins, false],
						[zwei, zwei, false],
					],
				);
				assert.ok(offen.every((v) => !('ausschnitt' in v) && v.umfang !== 'Ganzes Blatt'));
				const [a, b] = [await vorschlagQuelle(eins), await vorschlagQuelle(zwei)];
				assert.deepEqual([anzahl(a), anzahl(a, 'data-von-claude')], [n + 1, d]);
				assert.deepEqual([anzahl(b), anzahl(b, 'data-von-claude')], [n, d + 1]);

				// Beide Gespräche räumen für sich auf, die Vorschläge bleiben.
				await beende(eins);
				assert.ok(!existsSync(ordner(eins)));
				assert.ok(existsSync(ordner(zwei)));
				await beende(zwei);
				assert.equal((await alle()).length, 2);

				assert.equal((await nimm(eins)).status, 200);
				assert.equal(anzahl(await quelle()), n + 1);
				const nachgezogen = await vorschlagVon(zwei);
				assert.equal(nachgezogen?.konflikt, false);
				const ansicht = await server.holen(
					`${server.url}/ansicht/${mappe}/dokumente/${dok}/?vorschlag=${zwei}`,
				);
				const gezeigt = await ansicht.text();
				assert.deepEqual([anzahl(gezeigt), anzahl(gezeigt, 'data-von-claude')], [n + 1, d + 1]);
				assert.equal((await nimm(zwei)).status, 200);
				const ende = await quelle();
				assert.deepEqual([anzahl(ende), anzahl(ende, 'data-von-claude')], [n + 1, d + 1]);
				assert.deepEqual(await alle(), []);
			});

			it('Seite und Baustein darin: Nach dem einen ist der andere ein Konflikt, die Quelle bleibt', async () => {
				const seite = gespraech('blase-seite');
				const baustein = gespraech('blase-baustein');
				await auftrag({ auftrag: 'Seite', gespraechId: seite, referenz: await teilReferenz('seite') });
				await auftrag({ auftrag: 'Baustein', gespraechId: baustein, referenz: await teilReferenz('aufgabe') });
				assert.equal((await nimm(baustein)).status, 200);
				assert.equal((await vorschlagVon(seite))?.konflikt, true);
				const vorher = await quelle();
				assert.equal((await nimm(seite)).status, 409);
				assert.equal(await quelle(), vorher);
			});

			it('Eine Änderung außerhalb des Teils hält den Vorschlag nicht auf, eine darin schon', async () => {
				const id = gespraech('blase-aussen');
				await auftrag({ auftrag: 'Titel', gespraechId: id, referenz: await teilReferenz('h1') });
				await writeFile(quellDatei(), (await quelle()).replace('Ich kann Zahlen', 'Ich kann alle Zahlen'));
				assert.equal((await vorschlagVon(id))?.konflikt, false);
				await writeFile(quellDatei(), (await quelle()).replace('<h1>Zehner und Einer', '<h1>Zehner, Einer'));
				assert.equal((await vorschlagVon(id))?.konflikt, true);
				assert.equal((await nimm(id)).status, 409);
			});

			it('Nachbessern am Element: derselbe Teil, der Vorschlag lässt sich danach noch nachziehen', async () => {
				const id = gespraech('blase-nachbessern-teil');
				const n = anzahl(await quelle());
				await auftrag({ auftrag: 'Titel', gespraechId: id, referenz: await teilReferenz('h1') });
				const umfang = (await vorschlagVon(id))?.umfang;
				await auftrag({ auftrag: 'Noch einmal', gespraechId: id, aufVorschlag: true });
				assert.match(await letzterPrompt(), /enthält nur diesen Teil/);
				assert.equal((await vorschlagVon(id))?.umfang, umfang);
				assert.equal(anzahl(await vorschlagQuelle(id)), n + 2);
				await writeFile(quellDatei(), (await quelle()).replace('Ich kann Zahlen', 'Ich kann alle Zahlen'));
				assert.equal((await nimm(id)).status, 200);
				const ende = await quelle();
				assert.equal(anzahl(ende), n + 2);
				assert.match(ende, /Ich kann alle Zahlen/);
			});

			it('Ein Vorschlag von vor 135 (ohne Unterordner) bleibt lesbar, annehmbar und verwerfbar', async () => {
				const dir = path.join(dokumentDir(server.materialDir, mappe, dok), 'vorschlag');
				const alsAlt = async () => {
					await auftrag();
					for (const name of ['material.html', 'vorschlag.json']) {
						await rename(path.join(dir, 'blatt', name), path.join(dir, name));
					}
					await rm(path.join(dir, 'blatt'), { recursive: true });
				};
				const n = anzahl(await quelle());
				await alsAlt();
				assert.deepEqual(
					(await alle()).map((v) => v.schluessel),
					['alt'],
				);
				assert.equal((await vorschlag())?.schluessel, 'alt');
				assert.equal((await nimm('alt')).status, 200);
				assert.equal(anzahl(await quelle()), n + 1);
				assert.deepEqual(await alle(), []);

				await alsAlt();
				await api(`/dokumente/${mappe}/${dok}/vorschlag/verwerfen`, {
					method: 'POST',
					body: JSON.stringify({ gespraech: 'alt' }),
				});
				assert.deepEqual(await readdir(dir), []);
			});

			it('Unbekannte Schlüssel ergeben 400 und berühren nichts', async () => {
				for (const schluessel of ['../x', 'A', 'x'.repeat(200)]) {
					const res = await api(
						`/dokumente/${mappe}/${dok}/vorschlag?gespraech=${encodeURIComponent(schluessel)}`,
					);
					assert.equal(res.status, 400, schluessel);
					assert.equal((await nimm(schluessel)).status, 400, schluessel);
				}
			});
		});
	});

	describe('Am Limit, mit und ohne Guthaben (086)', () => {
		const letzteArgumente = async () => {
			const zeilen = (await readFile(path.join(path.dirname(bin), 'aufrufe.jsonl'), 'utf8')).trim().split('\n');
			return (JSON.parse(zeilen.at(-1) ?? '{}') as { args: string[] }).args;
		};
		const budget = async () => {
			const args = await letzteArgumente();
			return args[args.indexOf('--max-budget-usd') + 1];
		};
		const stand = async () =>
			((await (await api('/ki/status')).json()) as { limit: { status: string; guthaben: string | null } | null })
				.limit;
		const frageNeu = () => api('/ki/limit/pruefen', { method: 'POST' });
		const anzahlAufrufe = async () =>
			(await readFile(path.join(path.dirname(bin), 'aufrufe.jsonl'), 'utf8')).trim().split('\n').length;

		afterEach(async () => {
			await fall('gut');
			await frageNeu();
		});

		it('rejected und allowed: startet, auch der nächste Auftrag; das Budget sinkt auf den Guthaben-Wert', async () => {
			await fall('limit-guthaben');
			assert.equal((await auftrag()).status, 'fertig');
			assert.equal((await stand())?.guthaben, 'erlaubt');
			assert.equal((await auftrag()).status, 'fertig');
			assert.equal(await budget(), '1');
		});

		it('Ohne Guthaben-Lauf bleibt das Budget', async () => {
			await auftrag();
			assert.equal(await budget(), '5');
		});

		it('Budget über Guthaben erschöpft: Die Meldung nennt das Guthaben', async () => {
			await fall('limit-guthaben');
			await auftrag();
			await fall('limit-budget');
			const a = await auftrag();
			assert.equal(a.status, 'fehler');
			assert.match(a.fehler ?? '', /Guthaben/);
		});

		it('rejected und rejected: Der Lauf meldet es, der nächste Auftrag bekommt 429 ohne Aufruf', async () => {
			await fall('limit-gesperrt');
			const a = await auftrag();
			assert.match(a.fehler ?? '', /Limit des Claude-Kontos ist erreicht/);
			assert.equal((a as { limitErreicht?: boolean }).limitErreicht, true);
			const vorher = await anzahlAufrufe();
			const zweiter = await starte({ auftrag: 'noch einer' });
			assert.equal(zweiter.status, 429);
			assert.equal(await anzahlAufrufe(), vorher);
		});

		it('rejected ohne Feld: wird nicht vorab gesperrt', async () => {
			await fall('limit-ohne-feld');
			assert.equal((await auftrag()).status, 'fertig');
			assert.equal((await stand())?.guthaben, null);
			assert.equal((await starte({ auftrag: 'noch einer' })).status, 202);
		});

		it('Nach einem Lauf mit allowed ist eine alte Ablehnung weg', async () => {
			await fall('limit-guthaben');
			await auftrag();
			assert.equal((await stand())?.status, 'rejected');
			await fall('gut');
			await auftrag();
			assert.equal((await stand())?.status, 'allowed');
		});

		it('Neu fragen löst eine Sperre ohne Neustart und ohne Auftrag', async () => {
			await fall('limit-gesperrt');
			await auftrag();
			assert.equal((await starte({ auftrag: 'gesperrt' })).status, 429);

			// Das Konto lehnt weiter ab: Es bleibt gesperrt.
			await frageNeu();
			assert.equal((await starte({ auftrag: 'gesperrt' })).status, 429);

			// Guthaben gekauft.
			await fall('limit-guthaben');
			const res = await frageNeu();
			const { limit } = (await res.json()) as { limit: { guthaben: string } };
			assert.equal(limit.guthaben, 'erlaubt');
			const args = await letzteArgumente();
			assert.equal(args[args.indexOf('--tools') + 1], '');
			assert.ok(args.includes('--no-session-persistence'));
			assert.equal(args[args.indexOf('--max-budget-usd') + 1], '0.1');
			assert.equal((await auftrag()).status, 'fertig');
		});

		it('Warteschlange: Ein Auftrag hinter einem sperrenden Lauf endet, statt zu hängen', async () => {
			await fall('limit-gesperrt');
			const erster = await starte({ auftrag: 'eins' });
			const zweiter = await starte({ auftrag: 'zwei' });
			assert.equal(erster.status, 202);
			assert.equal(zweiter.status, 202);
			const ids = await Promise.all(
				[erster, zweiter].map(async (r) => ((await r.json()) as { auftrag: { id: string } }).auftrag.id),
			);
			const [a, b] = await Promise.all(ids.map(fertig));
			assert.equal(a?.status, 'fehler');
			assert.equal(b?.status, 'fehler');
			assert.match(b?.fehler ?? '', /Limit des Claude-Kontos/);
		});
	});
});

describe('Aufträge an Claude: Zugang', () => {
	let server: TestServer;
	let ordner: string;
	before(async () => {
		ordner = await mkdtemp(path.join(tmpdir(), 'ki-ab-'));
		const bin = path.join(ordner, 'claude');
		await writeFile(bin, KI_ATTRAPPE);
		await chmod(bin, 0o755);
		await writeFile(path.join(ordner, 'fall.txt'), 'abgemeldet');
		server = await starteTestServer({ env: { CLAUDE_BIN: bin } });
	});
	after(() => server.stop());

	it('Ohne Anmeldung: Status sagt es, die Route antwortet klar', async () => {
		const { dok, mappe } = await legeDokumentAn(server.materialDir, { beispiel: true });
		const headers = { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' };
		const { verfuegbar } = (await (await server.holen(`${server.url}/api/ki/status`)).json()) as {
			verfuegbar: boolean;
		};
		assert.equal(verfuegbar, false);
		const res = await server.holen(`${server.url}/api/dokumente/${mappe}/${dok}/ki`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ auftrag: 'x' }),
		});
		assert.equal(res.status, 409);
		assert.match(((await res.json()) as { fehler: string }).fehler, /nicht angemeldet/);
	});

	it('Ohne Sitzung und über Teilen-Links nicht erreichbar', async () => {
		const { dok, mappe } = await legeDokumentAn(server.materialDir, { beispiel: true });
		const ohne = await fetch(`${server.url}/api/dokumente/${mappe}/${dok}/ki`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
			body: JSON.stringify({ auftrag: 'x' }),
		});
		assert.equal(ohne.status, 401);
		const anlegen = await server.holen(`${server.url}/api/freigaben`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
			body: JSON.stringify({ mappe, dok }),
		});
		const { pfad } = (await anlegen.json()) as { pfad: string };
		const dir = path.join(dokumentDir(server.materialDir, mappe, dok), 'vorschlag');
		await mkdir(dir, { recursive: true });
		await writeFile(path.join(dir, 'material.html'), 'GEHEIMER VORSCHLAG');
		await writeFile(path.join(dir, 'vorschlag.json'), '{"basis":"x"}');
		const f = `${server.url}${pfad}`;
		// Gegenprobe: Das Dokument selbst ist über den Link erreichbar
		assert.equal((await fetch(`${f}/ansicht/${mappe}/dokumente/${dok}/`)).status, 200);
		for (const [url, init] of [
			[`${f}/api/dokumente/${mappe}/${dok}/ki`, { method: 'POST', headers: { [CSRF_HEADER]: '1' } }],
			[`${f}/api/ki/status`, {}],
			[`${f}/api/ki/limit/pruefen`, { method: 'POST', headers: { [CSRF_HEADER]: '1' } }],
			[`${f}/api/dokumente/${mappe}/${dok}/vorschlag`, {}],
			[`${f}/ansicht/${mappe}/dokumente/${dok}/?vorschlag=1`, {}],
			[`${f}/ansicht/${mappe}/dokumente/${dok}/vorschlag/material.html`, {}],
		] as const) {
			const res = await fetch(url, init);
			assert.ok(res.status >= 400, `${url} -> ${res.status}`);
			assert.equal((await res.text()).includes('GEHEIMER VORSCHLAG'), false);
		}
	});
});

describe('Aufruf für ein Canva-Bild (176)', () => {
	const basis = { ablage: '/tmp/a', auftragDatei: '/tmp/b.md', modell: 'opus', budgetUsd: 1, sitzung: null };
	const SPERREN = ['Read(~/.claude/**)', 'Read(~/.ssh/**)', 'Read(**/.env)', 'Read(**/materialien/**)'];
	const KOPF = ['-p', '--output-format', 'stream-json', '--verbose', '--model', 'opus', '--effort', 'medium'];
	const CANVA = [
		'generate-image',
		'get-generate-image-job',
		'remove-background',
		'get-assets',
		'search-designs',
		'read-design',
		'edit-design',
		'resize-design',
		'export-design',
	].map((w) => `mcp__claude_ai_Canva__${w}`);
	const KONNEKTOREN = ['mcp__claude_ai_Gmail', 'mcp__claude_ai_Google_Drive', 'mcp__claude_ai_Claude_Docs'];
	const SCHLUSS = ['--permission-mode', 'dontAsk'];

	it('Schnappschuss: genau diese Liste', () => {
		assert.deepEqual(kiArgumente({ ...basis, canvaBild: true }), [
			...KOPF,
			'--setting-sources',
			'project',
			'--add-dir',
			'/tmp/a',
			'--settings',
			canvaEinstellungen(),
			'--tools',
			'Read,Edit,Write',
			'--allowedTools',
			'Write(./bilder.json)',
			'Edit(./bilder.json)',
			'Write(./ergebnis.json)',
			'Edit(./ergebnis.json)',
			...CANVA,
			'--disallowedTools',
			...SPERREN,
			...KONNEKTOREN,
			...SCHLUSS,
			'--max-turns',
			'40',
			'--max-budget-usd',
			'1',
			'--append-system-prompt-file',
			'/tmp/b.md',
		]);
		const ohneBudget = kiArgumente({
			ablage: '/tmp/a',
			auftragDatei: '/tmp/b.md',
			modell: 'opus',
			canvaBild: true,
		});
		assert.equal(ohneBudget[ohneBudget.indexOf('--max-budget-usd') + 1], String(KI_GRENZEN.canva.budgetUsd));
	});

	it('Gegenprobe: kein Skill, kein Material, Gmail, Drive und Docs gesperrt, nur Canva geladen', () => {
		const args = kiArgumente({ ...basis, canvaBild: true });
		const text = args.join(' ');
		assert.ok(!/\bSkill\b/.test(text));
		assert.ok(!text.includes('material.html'));
		assert.ok(!text.includes('dokumente/'));
		assert.ok(!text.includes('--resume'));
		assert.ok(!args.includes('--strict-mcp-config'));
		const verboten = args.slice(args.indexOf('--disallowedTools') + 1, args.indexOf('--permission-mode'));
		for (const k of KONNEKTOREN) {
			assert.ok(verboten.includes(k), k);
		}
		const einstellungen = JSON.parse(args[args.indexOf('--settings') + 1] ?? '{}') as {
			allowedMcpServers: unknown[];
		};
		assert.deepEqual(einstellungen.allowedMcpServers, [{ serverUrl: 'https://mcp.canva.com/*' }]);
	});

	it('Blase und Einheit bleiben unverändert', () => {
		const ende = ['--append-system-prompt-file', '/tmp/b.md'];
		assert.deepEqual(kiArgumente(basis), [
			...KOPF,
			'--setting-sources',
			'project',
			'--add-dir',
			'/tmp/a',
			'--strict-mcp-config',
			'--tools',
			'Read,Edit,Skill',
			'--allowedTools',
			'Edit(./material.html)',
			'Skill',
			'--disallowedTools',
			...SPERREN,
			...SCHLUSS,
			'--max-turns',
			'40',
			'--max-budget-usd',
			'1',
			...ende,
		]);
		const einheitRechte = [
			'Write(./einheit.json)',
			'Edit(./einheit.json)',
			'Write(./thema.css)',
			'Edit(./thema.css)',
			'Write(./dokumente/**)',
			'Edit(./dokumente/**)',
			'Write(./bilder.json)',
			'Edit(./bilder.json)',
		];
		assert.deepEqual(kiArgumente({ ...basis, einheit: true, mitCanva: true }), [
			...KOPF,
			'--setting-sources',
			'project',
			'--add-dir',
			'/tmp/a',
			'--settings',
			canvaEinstellungen(),
			'--tools',
			'Read,Edit,Write,Skill',
			'--allowedTools',
			...einheitRechte,
			'Skill',
			...CANVA,
			'--disallowedTools',
			...SPERREN,
			...KONNEKTOREN,
			...SCHLUSS,
			'--max-turns',
			'400',
			'--max-budget-usd',
			'1',
			...ende,
		]);
	});
});
