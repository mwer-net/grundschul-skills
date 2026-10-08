import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ERLAUBTE_FEHLVERSUCHE, erstelleBremse, FENSTER_MS, ipSchluessel } from './bremse';
import { DAUER, leseCookie, pruefeSitzung, signiereSitzung, sollErneuern } from './sitzung';

const schluessel = { passwortHash: 'scrypt:10:8:1:salz:hash', sitzungGeheimnis: 'g'.repeat(64) };
const JETZT = Date.UTC(2026, 9, 8, 10);

describe('Sitzung', () => {
	it('Signatur: gültig, manipuliert, falsches Geheimnis, neues Passwort', () => {
		const wert = signiereSitzung(schluessel, { ausgestellt: JETZT, dauerhaft: true });
		assert.deepEqual(pruefeSitzung(schluessel, wert, JETZT), { ausgestellt: JETZT, dauerhaft: true });
		const zuSitzung = wert.replace('.d.', '.s.');
		assert.equal(pruefeSitzung(schluessel, zuSitzung, JETZT), null, 'Art umgeschrieben');
		const juenger = wert.replace(/^v1\.[0-9a-z]+/, `v1.${(JETZT + 1000).toString(36)}`);
		assert.equal(pruefeSitzung(schluessel, juenger, JETZT), null, 'Zeit umgeschrieben');
		assert.equal(pruefeSitzung({ ...schluessel, sitzungGeheimnis: 'h'.repeat(64) }, wert, JETZT), null);
		assert.equal(pruefeSitzung({ ...schluessel, passwortHash: 'scrypt:10:8:1:salz:neu' }, wert, JETZT), null);
		for (const falsch of [undefined, '', 'v1', `${wert}x`, wert.slice(0, -1)]) {
			assert.equal(pruefeSitzung(schluessel, falsch, JETZT), null, String(falsch));
		}
	});

	it('Ablauf: angemeldet bleiben 1 Jahr, sonst 12 Stunden', () => {
		const dauerhaft = signiereSitzung(schluessel, { ausgestellt: JETZT, dauerhaft: true });
		const kurz = signiereSitzung(schluessel, { ausgestellt: JETZT, dauerhaft: false });
		const { dauerhaft: jahr, sitzung } = DAUER;
		assert.ok(pruefeSitzung(schluessel, dauerhaft, JETZT + jahr.gueltig));
		assert.equal(pruefeSitzung(schluessel, dauerhaft, JETZT + jahr.gueltig + 1), null);
		assert.ok(pruefeSitzung(schluessel, kurz, JETZT + sitzung.gueltig));
		assert.equal(pruefeSitzung(schluessel, kurz, JETZT + sitzung.gueltig + 1), null);
		assert.equal(pruefeSitzung(schluessel, kurz, JETZT - 10 * 60_000), null, 'aus der Zukunft');
	});

	it('wird nach einem Tag bzw. einer Stunde Nutzung neu ausgestellt', () => {
		assert.equal(sollErneuern({ ausgestellt: JETZT, dauerhaft: true }, JETZT + 3_600_001), false);
		assert.equal(sollErneuern({ ausgestellt: JETZT, dauerhaft: true }, JETZT + 86_400_001), true);
		assert.equal(sollErneuern({ ausgestellt: JETZT, dauerhaft: false }, JETZT + 3_600_001), true);
	});

	it('liest Cookies aus dem Kopf', () => {
		assert.equal(leseCookie('a=1; schoolbox_sitzung=v1.x; b=2', 'schoolbox_sitzung'), 'v1.x');
		assert.equal(leseCookie('xschoolbox_sitzung=1', 'schoolbox_sitzung'), undefined);
		assert.equal(leseCookie(undefined, 'schoolbox_sitzung'), undefined);
	});
});

describe('Bremse', () => {
	it('sperrt nach 5 Fehlversuchen 15 Minuten, danach wachsend', () => {
		const bremse = erstelleBremse();
		for (let i = 0; i < ERLAUBTE_FEHLVERSUCHE; i += 1) {
			assert.equal(bremse.versuch('a', JETZT + i), 0);
		}
		assert.ok(bremse.versuch('a', JETZT + 10) > FENSTER_MS - 100);
		assert.equal(bremse.versuch('b', JETZT + 10), 0, 'andere Adresse geht weiter');
		const nachSperre = JETZT + 4 + FENSTER_MS;
		assert.equal(bremse.versuch('a', nachSperre), 0);
		assert.equal(bremse.versuch('a', nachSperre + 1), 2 * FENSTER_MS - 1, 'zweite Sperre doppelt so lang');
	});

	it('vergisst Fehlversuche nach dem Fenster und nach Erfolg', () => {
		const bremse = erstelleBremse();
		for (let i = 0; i < ERLAUBTE_FEHLVERSUCHE - 1; i += 1) {
			bremse.versuch('a', JETZT);
		}
		assert.equal(bremse.versuch('a', JETZT + FENSTER_MS + 1), 0, 'neues Fenster');
		for (let i = 0; i < ERLAUBTE_FEHLVERSUCHE - 2; i += 1) {
			bremse.versuch('a', JETZT + FENSTER_MS + 2);
		}
		bremse.erfolg('a');
		for (let i = 0; i < ERLAUBTE_FEHLVERSUCHE - 1; i += 1) {
			assert.equal(bremse.versuch('a', JETZT + FENSTER_MS + 3), 0);
		}
	});

	it('fasst IPv6 je /64 zusammen und erkennt IPv4 in IPv6', () => {
		assert.equal(ipSchluessel('203.0.113.7'), '203.0.113.7');
		assert.equal(ipSchluessel('::ffff:203.0.113.7'), '203.0.113.7');
		assert.equal(ipSchluessel('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
		assert.equal(ipSchluessel('2001:db8:1:2:bbbb:cccc:dddd:eeee'), '2001:db8:1:2::/64');
		assert.equal(ipSchluessel('2001:db8::1'), '2001:db8:0:0::/64');
		assert.equal(ipSchluessel(undefined), 'unbekannt');
	});
});
