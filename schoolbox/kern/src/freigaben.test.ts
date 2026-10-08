import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { neueMappe, neuesDokument } from './ablage';
import {
	findeFreigabe,
	FREIGABEN_DATEI,
	istToken,
	legeFreigabeAn,
	leseFreigaben,
	neuesToken,
	widerrufeFreigabe,
} from './freigaben';

const ablage = async () => {
	const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-freigaben-'));
	const { mappe } = await neueMappe(materialDir, { titel: 'Kartoffeln', fach: 'sachunterricht', klasse: 3 });
	const angaben = { titel: 'Blatt', art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'sw' } as const;
	const { id } = await neuesDokument(materialDir, mappe.id, { ...angaben, druckhinweise: [] });
	return { materialDir, mappe: mappe.id, dok: id };
};

describe('Freigaben', () => {
	it('Token: 128 Bit, URL-sicher, jedes Mal anders', () => {
		const token = neuesToken();
		assert.ok(istToken(token));
		assert.equal(Buffer.from(token, 'base64url').length, 16);
		assert.notEqual(neuesToken(), token);
		assert.equal(istToken('../../etc/passwd'), false);
	});

	it('legt an, findet und widerruft; ein Widerruf bleibt beim ersten Datum', async () => {
		const { dok, mappe, materialDir } = await ablage();
		assert.deepEqual(await leseFreigaben(materialDir), []);
		const fuerDokument = await legeFreigabeAn(materialDir, { mappe, dok });
		const fuerMappe = await legeFreigabeAn(materialDir, { mappe, dok: null });
		assert.equal((await leseFreigaben(materialDir)).length, 2);
		assert.deepEqual((await findeFreigabe(materialDir, fuerMappe.token))?.ziel, { mappe, dok: null });
		const erst = await widerrufeFreigabe(materialDir, fuerDokument.token, new Date('2026-10-08T10:00:00Z'));
		const nochmal = await widerrufeFreigabe(materialDir, fuerDokument.token, new Date('2026-10-09T10:00:00Z'));
		assert.equal(erst?.widerrufen, '2026-10-08T10:00:00.000Z');
		assert.equal(nochmal?.widerrufen, '2026-10-08T10:00:00.000Z');
		assert.equal((await findeFreigabe(materialDir, fuerMappe.token))?.widerrufen, null);
		assert.equal(await widerrufeFreigabe(materialDir, neuesToken()), null);
		assert.equal(await findeFreigabe(materialDir, 'kein-token'), null);
	});

	it('lehnt Ziele ab, die es nicht gibt, und meldet eine kaputte Datei verständlich', async () => {
		const { mappe, materialDir } = await ablage();
		await assert.rejects(legeFreigabeAn(materialDir, { mappe, dok: 'gibt-es-nicht' }), /gibt es nicht/);
		await assert.rejects(legeFreigabeAn(materialDir, { mappe: 'gibt-es-nicht', dok: null }), /gibt es nicht/);
		await writeFile(path.join(materialDir, FREIGABEN_DATEI), '{ kaputt');
		await assert.rejects(leseFreigaben(materialDir), /kein gültiges JSON/);
	});
});
