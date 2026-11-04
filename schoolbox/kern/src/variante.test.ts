import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { dokumentDir, legeVarianteAn, leseMappe, leseMeta, neueMappe, neuesDokument } from './ablage';
import { wuerfleNeu } from './variante';

describe('Variante (050)', () => {
	let material = '';
	before(async () => {
		material = await mkdtemp(path.join(tmpdir(), 'variante-'));
	});
	after(() => rm(material, { recursive: true, force: true }));

	it('Würfeln ändert nur die Zahlen, der Rest der Quelle bleibt Byte für Byte', () => {
		const quelle =
			'<!doctype html><html><head><title>T</title></head><body><section class="seite"><p>Text bleibt.</p><x-zahlenmauer basis="3 5 2" offen="0-1"></x-zahlenmauer><x-suchsel woerter="Hund; Maus" seed="alt"></x-suchsel></section></body></html>';
		const { geaendert, quelle: neu } = wuerfleNeu(quelle, 'seed');
		assert.equal(geaendert, 2);
		assert.notEqual(neu, quelle);
		const ohneWerte = (t: string) => t.replace(/basis="[^"]*"/, 'basis=""').replace(/seed="[^"]*"/, 'seed=""');
		assert.equal(ohneWerte(neu), ohneWerte(quelle), 'Gegenprobe: Nur basis und seed unterscheiden sich');
		assert.match(neu, /offen="0-1"/);
	});

	it('Ein Dokument ohne Generierbares bleibt unverändert', () => {
		const quelle = '<!doctype html><html><body><section class="seite"><p>Nur Text.</p></section></body></html>';
		assert.deepEqual(wuerfleNeu(quelle, 'a'), { quelle, geaendert: 0 });
	});

	it('Variante: zweites Dokument direkt hinter dem Original, Titel (B), dann (C), Original unverändert', async () => {
		const { mappe } = await neueMappe(material, { titel: 'Rechnen', fach: 'mathematik', klasse: 2 });
		const { id: dok, pfad } = await neuesDokument(material, mappe.id, {
			titel: 'Plus',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			druckprofil: 'farbe',
			druckhinweise: [],
			vorlage: 'arbeitsblatt',
		});
		const original = await readFile(pfad, 'utf8');
		const b = await legeVarianteAn(material, mappe.id, dok);
		assert.equal(b.titel, 'Plus (B)');
		assert.equal(await readFile(pfad, 'utf8'), original);
		assert.deepEqual((await leseMappe(material, mappe.id)).dokumente, [dok, b.id]);
		assert.equal((await leseMeta(material, mappe.id, b.id)).titel, 'Plus (B)');
		const kopie = await readFile(path.join(dokumentDir(material, mappe.id, b.id), 'material.html'), 'utf8');
		assert.notEqual(kopie, original);
		assert.match(kopie, /<title>Plus \(B\)<\/title>/);
		const c = await legeVarianteAn(material, mappe.id, b.id);
		assert.equal(c.titel, 'Plus (C)');
	});

	it('Ohne Zahlen entsteht keine Variante, und die Meldung sagt warum', async () => {
		const { mappe } = await neueMappe(material, { titel: 'Leer', fach: 'deutsch', klasse: 2 });
		const { id: dok } = await neuesDokument(material, mappe.id, {
			titel: 'Leer',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			druckprofil: 'farbe',
			druckhinweise: [],
		});
		await assert.rejects(() => legeVarianteAn(material, mappe.id, dok), /keine Zahlen/);
		assert.deepEqual((await leseMappe(material, mappe.id)).dokumente, [dok]);
	});
});
