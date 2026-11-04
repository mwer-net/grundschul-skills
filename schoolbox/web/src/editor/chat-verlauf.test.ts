import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ChatNachricht, ChatSpeicher } from './chat-verlauf';
import {
	liesVerlauf,
	loescheAlleVerlaeufe,
	MAX_NACHRICHTEN,
	schreibeVerlauf,
	SERVER_NACHRICHTEN,
	SERVER_ZEICHEN,
	verlaufFuerServer,
	verlaufSchluessel,
} from './chat-verlauf';

const speicher = (): ChatSpeicher & { daten: Map<string, string> } => {
	const daten = new Map<string, string>();
	return {
		daten,
		get length() {
			return daten.size;
		},
		key: (i) => [...daten.keys()][i] ?? null,
		getItem: (k) => daten.get(k) ?? null,
		setItem: (k, w) => void daten.set(k, w),
		removeItem: (k) => void daten.delete(k),
	};
};

const nachricht = (text: string, rolle: ChatNachricht['rolle'] = 'lehrkraft'): ChatNachricht => ({
	rolle,
	text,
	kontext: null,
	zeit: '2026-11-04T10:00:00.000Z',
	auftragId: null,
});

describe('Verlauf des Chats', () => {
	it('hat je Dokument, je Mappe und einmal global einen eigenen Schlüssel', () => {
		const alle = [
			verlaufSchluessel('m', 'd'),
			verlaufSchluessel('m', 'e'),
			verlaufSchluessel('m'),
			verlaufSchluessel(),
		];
		assert.equal(new Set(alle).size, 4);
	});

	it('hält höchstens 50 Nachrichten und hebt die jüngsten auf', () => {
		const s = speicher();
		const viele = Array.from({ length: MAX_NACHRICHTEN + 5 }, (_, i) => nachricht(String(i)));
		schreibeVerlauf(s, 'k', viele);
		const gelesen = liesVerlauf(s, 'k');
		assert.equal(gelesen.length, MAX_NACHRICHTEN);
		assert.equal(gelesen.at(-1)?.text, String(MAX_NACHRICHTEN + 4));
	});

	it('Kaputtes wird zu einem leeren Verlauf', () => {
		const s = speicher();
		for (const kaputt of ['{', 'null', '{"a":1}', '[{"rolle":"system","text":"x"}]', '[1]']) {
			s.setItem('k', kaputt);
			assert.deepEqual(liesVerlauf(s, 'k'), [], kaputt);
		}
	});

	it('Abmelden löscht alle Verläufe und nur sie', () => {
		const s = speicher();
		schreibeVerlauf(s, verlaufSchluessel('m', 'd'), [nachricht('a')]);
		schreibeVerlauf(s, verlaufSchluessel(), [nachricht('b')]);
		s.setItem('schoolbox-zoom', '1');
		loescheAlleVerlaeufe(s);
		assert.deepEqual([...s.daten.keys()], ['schoolbox-zoom']);
	});

	it('an den Server gehen die letzten Nachrichten innerhalb der Grenzen, ohne Kontext und Zeit', () => {
		const viele = Array.from({ length: 10 }, (_, i) => nachricht(String(i)));
		const kurz = verlaufFuerServer(viele);
		assert.equal(kurz.length, SERVER_NACHRICHTEN);
		assert.deepEqual(kurz.at(-1), { rolle: 'lehrkraft', text: '9' });
		const lang = verlaufFuerServer([
			nachricht('alt'),
			nachricht('x'.repeat(SERVER_ZEICHEN + 10), 'claude'),
			nachricht('neu'),
		]);
		assert.equal(
			lang.reduce((n, m) => n + m.text.length, 0),
			SERVER_ZEICHEN,
		);
		assert.equal(lang.length, 2);
		assert.equal(lang.at(-1)?.text, 'neu');
	});
});
