import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { behaeltUndo, beobachteFelder, istFeld, istTextfeld } from './tasten';

const eingabe = (type: string) => ({ tagName: 'INPUT', type, value: '', closest: () => null });
const anderes = (tagName: string) => ({ tagName, closest: () => null });

describe('Was als Text zählt', () => {
	it('nur Eingaben mit Text, Textflächen und Bearbeitbares', () => {
		for (const type of ['text', 'search', 'url', 'email', 'password', 'tel', 'number']) {
			assert.equal(istTextfeld(eingabe(type) as never), true, type);
		}
		assert.equal(istTextfeld(anderes('TEXTAREA') as never), true);
		assert.equal(istTextfeld({ isContentEditable: true, tagName: 'H1' } as never), true);
	});

	it('Regler, Kästchen, Auswahllisten und Knöpfe sind Felder, aber kein Text', () => {
		for (const type of ['range', 'checkbox', 'radio', 'file', 'color']) {
			assert.equal(istTextfeld(eingabe(type) as never), false, type);
			assert.equal(istFeld(eingabe(type) as never), true, type);
		}
		assert.equal(istTextfeld(anderes('SELECT') as never), false);
		assert.equal(istFeld(anderes('SELECT') as never), true);
		assert.equal(istTextfeld(anderes('BUTTON') as never), false);
		assert.equal(istTextfeld(null), false);
	});
});

describe('Wer ⌘Z behält', () => {
	/** Ein Fenster nur für die Hörer: So lassen sich Fokus und Eingabe von Hand auslösen. */
	const fenster = () => {
		const hoerer = new Map<string, (e: Event) => void>();
		const beende = beobachteFelder({
			addEventListener: (typ: string, fn: (e: Event) => void) => hoerer.set(typ, fn),
			removeEventListener: () => undefined,
		} as never);
		const sende = (typ: string, target: unknown, mehr: object = {}) =>
			hoerer.get(typ)?.({ target, ...mehr } as unknown as Event);
		return { beende, sende };
	};

	it('ein Feld mit eigener Geschichte immer', () => {
		const chat = { ...eingabe('text'), closest: () => ({}) };
		assert.equal(behaeltUndo(chat as never), true);
	});

	it('ein Textfeld nur, solange es sich seit dem Fokus unterscheidet', () => {
		const { beende, sende } = fenster();
		const feld = { ...eingabe('text'), value: 'a' };
		sende('focusin', feld);
		assert.equal(behaeltUndo(feld as never), false);
		feld.value = 'ab';
		sende('input', feld);
		assert.equal(behaeltUndo(feld as never), true);
		feld.value = 'a';
		sende('input', feld);
		assert.equal(behaeltUndo(feld as never), false);
		beende();
	});

	it('⏎ übernimmt den Wert: Danach gehört die Taste wieder dem Blatt', () => {
		const { beende, sende } = fenster();
		const feld = { ...eingabe('text'), value: 'a' };
		sende('focusin', feld);
		feld.value = 'ab';
		sende('input', feld);
		sende('keydown', feld, { key: 'Enter' });
		assert.equal(behaeltUndo(feld as never), false);
		beende();
	});

	it('eine Auswahlliste nie', () => {
		assert.equal(behaeltUndo(anderes('SELECT') as never), false);
	});
});
