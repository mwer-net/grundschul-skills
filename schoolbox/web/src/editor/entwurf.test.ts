import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { annahmenAus, entwurfPhase, laufzeit, sperrtBlatt } from './entwurf';
import type { KiAuftrag, Vorschlag } from './ki';

const auftrag = (status: KiAuftrag['status'], mehr: Partial<KiAuftrag> = {}): KiAuftrag => ({
	id: 'a1',
	status,
	schritte: [],
	fehler: null,
	ergebnis: null,
	antwort: null,
	neuesBlatt: true,
	...mehr,
});

const vorschlag = (konflikt = false): Vorschlag => ({
	auftrag: 'Neuer Entwurf',
	umfang: 'Ganzes Blatt',
	zeit: '2026-11-10T10:00:00.000Z',
	antwort: 'Annahme: Klasse 2',
	fehler: 0,
	konflikt,
	meldungen: [],
	neuesBlatt: true,
});

const ruhe = {
	auftrag: null,
	laeuft: false,
	vorschlag: null,
	fehler: null,
	startFehler: null,
	zu: null,
	verworfen: false,
};

describe('Was der Editor zum neuen Blatt zeigt (133)', () => {
	it('Lauf vor allem anderen, auch mit offenem Entwurf (Nachbessern)', () => {
		const a = auftrag('laeuft');
		assert.deepEqual(entwurfPhase({ ...ruhe, auftrag: a, laeuft: true }), {
			art: 'laeuft',
			auftrag: a,
			nachbessern: false,
		});
		const v = vorschlag();
		assert.equal(entwurfPhase({ ...ruhe, auftrag: a, laeuft: true, vorschlag: v })?.art, 'laeuft');
		assert.equal(sperrtBlatt(entwurfPhase({ ...ruhe, auftrag: a, laeuft: true })), true);
	});

	it('Der Entwurf sperrt das Blatt, ein veralteter nicht; ein Fehler beim Nachbessern steht in der Leiste', () => {
		const offen = entwurfPhase({ ...ruhe, auftrag: auftrag('fertig'), vorschlag: vorschlag() });
		assert.equal(offen?.art, 'vorschlag');
		assert.equal(sperrtBlatt(offen), true);
		assert.equal(sperrtBlatt(entwurfPhase({ ...ruhe, vorschlag: vorschlag(true) })), false);
		const mitFehler = entwurfPhase({
			...ruhe,
			auftrag: auftrag('fehler'),
			vorschlag: vorschlag(),
			fehler: 'Kaputt',
		});
		assert.deepEqual(mitFehler, { art: 'vorschlag', vorschlag: vorschlag(), fehler: 'Kaputt' });
	});

	it('Ohne Entwurf: Fehler, Ablehnung beim Start oder Antwort statt Blatt; geschlossen ist nichts mehr', () => {
		assert.deepEqual(entwurfPhase({ ...ruhe, auftrag: auftrag('fehler'), fehler: 'Kaputt' }), {
			art: 'fehler',
			text: 'Kaputt',
		});
		assert.deepEqual(entwurfPhase({ ...ruhe, startFehler: 'Limit' }), { art: 'fehler', text: 'Limit' });
		const antwort = auftrag('fertig', { ergebnis: 'antwort', antwort: 'Für welche Klasse?' });
		assert.deepEqual(entwurfPhase({ ...ruhe, auftrag: antwort }), { art: 'fehler', text: 'Für welche Klasse?' });
		assert.equal(entwurfPhase({ ...ruhe, auftrag: antwort, zu: 'a1' }), null);
		assert.equal(sperrtBlatt(entwurfPhase({ ...ruhe, startFehler: 'Limit' })), false);
	});

	it('Aufgabenplan: Die Antwort ist der Plan, das Blatt bleibt gesperrt, bis er freigegeben oder geschlossen ist', () => {
		const plan = auftrag('fertig', { ergebnis: 'antwort', antwort: 'Seite ● (20 min) …', plan: true });
		const phase = entwurfPhase({ ...ruhe, auftrag: plan });
		assert.deepEqual(phase, { art: 'plan', text: 'Seite ● (20 min) …', fehler: null });
		assert.equal(sperrtBlatt(phase), true);
		assert.equal(entwurfPhase({ ...ruhe, auftrag: plan, fehler: 'Limit' })?.art, 'plan');
		assert.equal(entwurfPhase({ ...ruhe, auftrag: plan, zu: 'a1' }), null);
		assert.equal(entwurfPhase({ ...ruhe, auftrag: plan, vorschlag: vorschlag() })?.art, 'vorschlag');
	});

	it('Abgebrochen und verworfen: eine Zeile, bis sie geschlossen ist; ein fertiger Lauf ohne Entwurf: nichts', () => {
		assert.deepEqual(entwurfPhase({ ...ruhe, auftrag: auftrag('abgebrochen') }), {
			art: 'ende',
			wie: 'abgebrochen',
		});
		assert.equal(entwurfPhase({ ...ruhe, auftrag: auftrag('abgebrochen'), zu: 'a1' }), null);
		assert.deepEqual(entwurfPhase({ ...ruhe, auftrag: auftrag('fertig'), verworfen: true }), {
			art: 'ende',
			wie: 'verworfen',
		});
		assert.equal(entwurfPhase({ ...ruhe, auftrag: auftrag('fertig', { ergebnis: 'vorschlag' }) }), null);
		assert.equal(entwurfPhase(ruhe), null);
	});
});

describe('Annahmen und Laufzeit', () => {
	it('nur die Zeilen „Annahme:“, auch als Aufzählung', () => {
		assert.deepEqual(annahmenAus('Fertig.\nAnnahme: Klasse 2\n- Annahme: drei Niveaus\n• annahme: kein Bild'), [
			'Klasse 2',
			'drei Niveaus',
			'kein Bild',
		]);
		assert.deepEqual(annahmenAus('Ich habe das Blatt gebaut.'), []);
	});

	it('Minuten und Sekunden seit dem Beginn, vorher nichts', () => {
		const beginn = '2026-11-10T10:00:00.000Z';
		assert.equal(laufzeit(beginn, Date.parse(beginn) + 72_000), '1:12');
		assert.equal(laufzeit(beginn, Date.parse(beginn) - 5000), '0:00');
		assert.equal(laufzeit(undefined, Date.now()), null);
	});
});
