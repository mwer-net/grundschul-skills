import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';

import type { Einordnung, Pruefbericht } from '@schoolbox/kern';
import { attribut, dokumentDir, KI_AKTIONEN, listeVersionen, WURZEL, zerlege } from '@schoolbox/kern';
import { erzeugeReferenz } from '@schoolbox/kern/src/referenz';

import {
	KI_EINORDNEN_MODELL,
	KI_GRENZEN,
	kiArgumente,
	kiTempWurzel,
	kiUmgebung,
	liesLimit,
	limitErreichtText,
} from './ki';
import { CSRF_HEADER } from './schutz';
import type { TestServer } from './testhilfe';
import { KI_ATTRAPPE, legeDokumentAn, ordnerVon, starteTestServer } from './testhilfe';

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
	const vorschlagQuelle = () =>
		readFile(path.join(dokumentDir(server.materialDir, mappe, dok), 'vorschlag', 'material.html'), 'utf8');
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
		await api(`/dokumente/${mappe}/${dok}/vorschlag/verwerfen`, { method: 'POST' });
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
		assert.deepEqual((await readdir(dir)).sort(), ['material.html', 'vorschlag.json']);
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

	it('Einordnen: gültig aus den Listen, sonst Rückfall; ohne Werkzeuge, MCP und Skills; nichts im Verbrauch', async () => {
		const ordnen = async (body: object) =>
			(await (await api('/ki/einordnen', { method: 'POST', body: JSON.stringify(body) })).json()) as Einordnung;
		const aufrufDatei = path.join(path.dirname(bin), 'aufrufe.jsonl');
		await writeFile(aufrufDatei, '');
		const wunsch = 'PERSOENLICH Uhrzeiten üben';
		const e = await ordnen({ text: wunsch });
		assert.equal(e.rueckfall, false);
		assert.equal(e.art, 'arbeitsblatt');
		assert.equal(e.ordner, null);

		const zeilen = (await readFile(aufrufDatei, 'utf8')).trim().split('\n');
		const { args } = JSON.parse(zeilen.at(-1) ?? '{}') as { args: string[] };
		const nach = (name: string) => args[args.indexOf(name) + 1];
		assert.equal(nach('--tools'), '');
		assert.equal(nach('--setting-sources'), '');
		assert.ok(args.includes('--strict-mcp-config'));
		assert.ok(args.includes('--no-session-persistence'));
		assert.equal(nach('--model'), KI_EINORDNEN_MODELL);
		assert.ok(!args.join(' ').includes('PERSOENLICH'));
		const schema = JSON.parse(nach('--json-schema') ?? '{}') as { properties: { fach: { enum: string[] } } };
		assert.ok(schema.properties.fach.enum.includes('mathematik'));

		const verbrauch = await readFile(path.join(server.materialDir, '_ki-verbrauch.jsonl'), 'utf8');
		assert.ok(!verbrauch.includes('PERSOENLICH'));

		const ordner = await ordnerVon(server, mappe);
		const imOrdner = await ordnen({ text: wunsch, ordner });
		assert.equal(imOrdner.ordner?.id, ordner);
		assert.equal(imOrdner.fest, true);

		await fall('einordnen-film');
		const film = await ordnen({ text: 'Einen Film' });
		assert.equal(film.rueckfall, true);
		assert.equal(film.art, 'arbeitsblatt');
		await fall('einordnen-fehler');
		const kaputt = await ordnen({ text: 'Arbeitsblatt Uhrzeiten volle und halbe Stunden Klasse 2' });
		assert.equal(kaputt.rueckfall, true);
		assert.equal(kaputt.titel, 'Arbeitsblatt Uhrzeiten volle und halbe Stunden');
		const zuLang = await api('/ki/einordnen', { method: 'POST', body: JSON.stringify({ text: 'x'.repeat(4001) }) });
		assert.equal(zuLang.status, 400);
		const fremd = await api('/ki/einordnen', {
			method: 'POST',
			body: JSON.stringify({ text: 'x', ordner: 'fehlt' }),
		});
		assert.equal(fremd.status, 404);
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
		const neu = await readFile(
			path.join(dokumentDir(server.materialDir, mappe, dok), 'vorschlag', 'material.html'),
			'utf8',
		);
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
		const neu = await readFile(
			path.join(dokumentDir(server.materialDir, mappe, dok), 'vorschlag', 'material.html'),
			'utf8',
		);
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
		const neu = await starte({ aktion: 'neu-entwurf', auftrag: 'Igel im Herbst' });
		await fertig(((await neu.json()) as { auftrag: { id: string } }).auftrag.id);
		const dritte = await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8');
		assert.match(dritte.split('---').at(-2) ?? '', /Wunsch der Lehrkraft: Igel im Herbst/);
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
				assert.ok(!arbeit.includes('von Claude'));
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
			const datei = path.join(dokumentDir(server.materialDir, mappe, dok), 'vorschlag', 'material.html');
			assert.equal((await readFile(datei, 'utf8')).split('von Claude').length, 3);
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
			for (const falsch of ['../raus', 'A-B', 'a b', 'a/b', '', 'x'.repeat(65), 7]) {
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
		const einordnen = async () =>
			(await (
				await api('/ki/einordnen', { method: 'POST', body: JSON.stringify({ text: 'Uhrzeiten üben' }) })
			).json()) as Einordnung;
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

		it('Einordnen: mit Guthaben ein Aufruf, echt gesperrt der Rückfall ohne Aufruf', async () => {
			await fall('limit-guthaben');
			await auftrag();
			let vorher = await anzahlAufrufe();
			assert.equal((await einordnen()).rueckfall, false);
			assert.equal(await anzahlAufrufe(), vorher + 1);

			await fall('limit-gesperrt');
			await auftrag();
			vorher = await anzahlAufrufe();
			assert.equal((await einordnen()).rueckfall, true);
			assert.equal(await anzahlAufrufe(), vorher);
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
		await mkdir(dir);
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
