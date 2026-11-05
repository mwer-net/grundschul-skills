import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ChatNachricht, ChatSpeicher } from './chat-verlauf';
import {
	istRueckfrage,
	loescheAlteVerlaeufe,
	SERVER_LETZTE_ZEICHEN,
	SERVER_NACHRICHTEN,
	SERVER_ZEICHEN,
	verlaufFuerServer,
} from './chat-verlauf';

const speicher = (): ChatSpeicher & { daten: Map<string, string> } => {
	const daten = new Map<string, string>();
	return {
		daten,
		get length() {
			return daten.size;
		},
		key: (i) => [...daten.keys()][i] ?? null,
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
	it('Alte Einträge verschwinden aus dem Speicher, alles andere bleibt', () => {
		const s = speicher();
		s.daten.set('schoolbox-chat-verlauf:m/d', '[{"text":"Materialtext"}]');
		s.daten.set('schoolbox-chat-verlauf:global', '[]');
		s.daten.set('schoolbox-chat-fenster', 'verlauf');
		s.daten.set('schoolbox-zoom', '1');
		loescheAlteVerlaeufe(s);
		assert.deepEqual([...s.daten.keys()], ['schoolbox-zoom']);
	});

	it('an den Server gehen die letzten Nachrichten innerhalb der Grenzen, ohne Kontext und Zeit', () => {
		const viele = Array.from({ length: SERVER_NACHRICHTEN + 5 }, (_, i) => nachricht(String(i)));
		const kurz = verlaufFuerServer(viele);
		assert.equal(kurz.length, SERVER_NACHRICHTEN);
		assert.deepEqual(kurz.at(-1), { rolle: 'lehrkraft', text: String(SERVER_NACHRICHTEN + 4) });
		const lang = verlaufFuerServer([
			nachricht('alt'),
			nachricht('x'.repeat(SERVER_ZEICHEN + 10), 'claude'),
			nachricht('neu'),
		]);
		assert.equal(
			lang.slice(0, -1).reduce((n, m) => n + m.text.length, 0),
			SERVER_ZEICHEN,
		);
		assert.equal(lang.length, 2);
		assert.equal(lang.at(-1)?.text, 'neu');
		assert.deepEqual(verlaufFuerServer([]), []);
	});

	it('die Nachricht vor der neuen bleibt ganz, auch wenn sie allein länger ist als die Grenze', () => {
		const lang = 'y'.repeat(SERVER_ZEICHEN + 500);
		const kurz = verlaufFuerServer([nachricht('davor'), nachricht(lang, 'claude')]);
		assert.equal(kurz.at(-1)?.text, lang);
		assert.equal(kurz[0]?.text, 'davor');
		const riesig = verlaufFuerServer([nachricht('z'.repeat(SERVER_LETZTE_ZEICHEN + 1), 'claude')]);
		assert.equal(riesig[0]?.text.length, SERVER_LETZTE_ZEICHEN);
	});

	it('Rückfrage: eine Antwort, die mit einer Frage endet', () => {
		assert.equal(istRueckfrage('Für welche Klasse?'), true);
		assert.equal(istRueckfrage('Für welche Klasse?\n'), true);
		assert.equal(istRueckfrage('Das Blatt hat vier Uhren.'), false);
		assert.equal(istRueckfrage(undefined), false);
	});
});
