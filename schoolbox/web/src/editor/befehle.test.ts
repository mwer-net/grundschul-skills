import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Kontext, Kuerzel, Modus } from './befehle';
import { BEFEHLE, befehlZuTaste, kuerzelText, MODUS_VORGABE, passtTaste } from './befehle';
import { befehleFuerWerkzeuge } from './gestaltung/werkzeuge/befehle';
import { WERKZEUGE } from './gestaltung/werkzeuge';
import type { Werkzeug } from './gestaltung/werkzeuge';
import { werkzeugStand, zurAuswahl } from './gestaltung/werkzeuge/stand';
import { JEDE_LAGE, SCHUBLADEN } from './schubladen';
import { alsSchublade, REIHE } from './schubladen/reihe';

/** Safari und deutsche Tastatur behalten diese für sich (069). */
const SPERRLISTE = [
	...['KeyL', 'KeyR', 'KeyW', 'KeyT', 'KeyN', 'KeyQ', 'KeyH', 'KeyM'],
	...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((z) => `Digit${z}`),
	...['[', ']', '\\', '/', '+', '-', '0'],
];

const schluessel = (k: Kuerzel) =>
	`${k.befehl ? 'B' : ''}${k.wahl ? 'W' : ''}${k.umschalt ? 'U' : ''}:${k.code ?? k.key}`;

describe('Befehlsregister', () => {
	it('⌘Z und ⇧⌘Z gelten in jedem Zustand, nur nicht in einem Feld, das sie selbst braucht', () => {
		const z = { code: 'KeyZ', key: 'z', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };
		const kontext = (feldBehaeltUndo: boolean) => ({ feldBehaeltUndo: () => feldBehaeltUndo }) as Kontext;
		for (const modus of ['auswahl', 'ohne', 'text'] as Modus[]) {
			assert.equal(befehlZuTaste(z, modus, kontext(false))?.id, 'dokument.rueckgaengig', modus);
			assert.equal(befehlZuTaste({ ...z, shiftKey: true }, modus, kontext(false))?.id, 'dokument.wiederholen');
			assert.equal(befehlZuTaste(z, modus, kontext(true)), undefined, modus);
		}
	});

	it('hat eindeutige ids', () => {
		const ids = BEFEHLE.map((b) => b.id);
		assert.deepEqual(
			ids.filter((id, i) => ids.indexOf(id) !== i),
			[],
		);
	});

	it('hat in keinem Zustand zwei Befehle auf derselben Taste', () => {
		for (const modus of ['auswahl', 'ohne', 'text'] as Modus[]) {
			const belegt = new Map<string, string>();
			for (const b of BEFEHLE) {
				if ((b.modus ?? MODUS_VORGABE).includes(modus)) {
					for (const k of b.kuerzel ?? []) {
						const s = schluessel(k);
						assert.equal(belegt.get(s), undefined, `${modus}: ${s} bei ${b.id} und ${belegt.get(s) ?? ''}`);
						belegt.set(s, b.id);
					}
				}
			}
		}
	});

	it('zeigt jeden Befehl mit Taste oder Menü auch sichtbar', () => {
		for (const b of BEFEHLE) {
			if (b.orte.includes('taste') || b.orte.includes('menue')) {
				assert.ok(b.sichtbarUnter, b.id);
			}
		}
	});

	it('jeder Befehl mit Kürzel steht auch am Ort „taste“', () => {
		for (const b of BEFEHLE) {
			assert.equal(Boolean(b.kuerzel?.length), b.orte.includes('taste'), b.id);
		}
	});

	it('nutzt kein Kürzel, das Safari oder die Tastatur für sich behalten', () => {
		for (const b of BEFEHLE) {
			for (const k of b.kuerzel ?? []) {
				if (k.befehl) {
					assert.ok(!SPERRLISTE.includes(k.code ?? k.key ?? ''), `${b.id}: ${schluessel(k)}`);
				}
			}
		}
	});

	it('kuerzelText zeigt ⌘ am Mac und Strg sonst', () => {
		const k: Kuerzel = { code: 'KeyD', befehl: true, umschalt: true };
		assert.equal(kuerzelText(k, true), '⇧⌘D');
		assert.equal(kuerzelText(k, false), 'Umschalt+Strg+D');
		assert.equal(kuerzelText({ key: 'Backspace' }, true), '⌫');
	});
});

describe('passtTaste', () => {
	const ohne = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };

	it('nimmt ⌥N über den Code, auch wenn die Taste am Mac „~“ liefert', () => {
		assert.ok(passtTaste({ code: 'KeyN', wahl: true }, { ...ohne, altKey: true, code: 'KeyN', key: '~' }));
	});

	it('nimmt „?“ und „/“ mit ⇧, wie die deutsche Tastatur sie liefert', () => {
		assert.ok(passtTaste({ key: '?' }, { ...ohne, shiftKey: true, code: 'Minus', key: '?' }));
		assert.ok(passtTaste({ key: '/' }, { ...ohne, shiftKey: true, code: 'Digit7', key: '/' }));
	});

	it('unterscheidet ⌘Z von ⇧⌘Z und Pfeil von ⌥Pfeil', () => {
		const z = { ...ohne, metaKey: true, code: 'KeyZ', key: 'z' };
		assert.ok(passtTaste({ code: 'KeyZ', befehl: true }, z));
		assert.ok(!passtTaste({ code: 'KeyZ', befehl: true }, { ...z, shiftKey: true }));
		assert.ok(!passtTaste({ key: 'ArrowUp' }, { ...ohne, altKey: true, code: 'ArrowUp', key: 'ArrowUp' }));
	});
});

describe('Was aus dem Inspektor gewandert ist', () => {
	it('liegt in Leiste oder Menü (072)', () => {
		for (const id of [
			'auswahl.hoch',
			'auswahl.runter',
			'auswahl.duplizieren',
			'auswahl.loeschen',
			'auswahl.kopieren',
			'auswahl.in-sammlung',
			'auswahl.einfuegen',
			'auswahl.neue-zahlen',
			'tabelle.zeile-davor',
			'tabelle.zeile-danach',
			'tabelle.spalte-davor',
			'tabelle.spalte-danach',
			'tabelle.zeile-weg',
			'tabelle.spalte-weg',
		]) {
			const befehl = BEFEHLE.find((b) => b.id === id);
			assert.ok(
				befehl?.orte.some((o) => o === 'menue' || o === 'leiste'),
				id,
			);
		}
	});
});

describe('Schubladen (093)', () => {
	it('jede Schublade hat genau einen Befehl `ansicht.links-<id>` mit ihrer Taste, ⌥1 bis ⌥7 in Reihenfolge', () => {
		assert.deepEqual(
			SCHUBLADEN.map((s) => s.id),
			REIHE.map((s) => s.id),
		);
		SCHUBLADEN.forEach((s, i) => {
			const befehle = BEFEHLE.filter((b) => b.id === `ansicht.links-${s.id}`);
			assert.equal(befehle.length, 1, s.id);
			assert.deepEqual(befehle[0]?.kuerzel, [{ code: s.taste, wahl: true }], s.id);
			assert.equal(s.taste, `Digit${i + 1}`, s.id);
		});
		assert.equal(BEFEHLE.filter((b) => b.id.startsWith('ansicht.links-')).length, SCHUBLADEN.length);
	});

	it('nicht bereite Schubladen: Taste reserviert, aber ohne Wirkung und nicht in der Übersicht', () => {
		const k = { frei: true } as Kontext;
		for (const s of SCHUBLADEN) {
			const b = BEFEHLE.find((x) => x.id === `ansicht.links-${s.id}`);
			assert.equal(b?.verfuegbar(k), s.bereit(JEDE_LAGE), s.id);
			assert.equal(b?.inUebersicht?.(), s.bereit(JEDE_LAGE), s.id);
		}
		assert.deepEqual(
			SCHUBLADEN.filter((s) => s.bereit(JEDE_LAGE)).map((s) => s.id),
			['ebenen', 'bausteine', 'bilder'],
		);
		const drei = { code: 'Digit3', key: '£', metaKey: false, ctrlKey: false, altKey: true, shiftKey: false };
		assert.equal(befehlZuTaste(drei, 'ohne', k)?.id, 'ansicht.links-formen');
	});

	it('„Bausteine“ nur, wo frei bearbeitet werden darf', () => {
		const b = BEFEHLE.find((x) => x.id === 'ansicht.links-bausteine');
		assert.equal(b?.verfuegbar({ frei: false } as Kontext), false);
	});

	it('Ebenen: Suche mit „gliederung“ trifft weiter; alte Speicherwerte führen zu den Ebenen', () => {
		assert.ok(BEFEHLE.find((b) => b.id === 'ansicht.links-ebenen')?.suchwoerter?.includes('gliederung'));
		assert.equal(BEFEHLE.find((b) => b.id === 'ansicht.links-ebenen')?.titel, 'Ebenen');
		assert.equal(alsSchublade('gliederung'), 'ebenen');
		assert.equal(alsSchublade('seiten'), 'ebenen');
		assert.equal(alsSchublade('bilder'), 'bilder');
		assert.equal(alsSchublade('zu'), null);
		assert.equal(alsSchublade(null), null);
	});
});

describe('Werkzeuge (098)', () => {
	const testZugang = (an: boolean) => {
		(globalThis as { __schoolboxTest?: { gestaltung?: boolean } }).__schoolboxTest = { gestaltung: an };
	};
	const taste = (code: string, mehr: Partial<KeyboardEvent> = {}) => ({
		code,
		key: code.replace('Key', '').toLowerCase(),
		metaKey: false,
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		...mehr,
	});
	const kontext = (mehr: Partial<Kontext> = {}) =>
		({ aktiv: true, frei: true, textsitzung: false, feldBehaeltUndo: () => false, ...mehr }) as Kontext;

	it('jedes Werkzeug hat genau einen Befehl `werkzeug.<id>`', () => {
		for (const w of WERKZEUGE) {
			assert.equal(BEFEHLE.filter((b) => b.id === `werkzeug.${w.id}`).length, 1, w.id);
		}
		assert.equal(BEFEHLE.filter((b) => b.id.startsWith('werkzeug.')).length, WERKZEUGE.length);
		assert.equal(WERKZEUGE[0]?.id, 'auswahl');
	});

	it('ohne bereites Werkzeug gibt es auch V nicht, und die Tasten bleiben beim Browser', () => {
		testZugang(false);
		const v = BEFEHLE.find((b) => b.id === 'werkzeug.auswahl');
		assert.equal(v?.verfuegbar(kontext()), false);
		assert.equal(v?.inUebersicht?.(), false);
		assert.equal(befehlZuTaste(taste('KeyV'), 'auswahl', kontext()), undefined);
		assert.equal(befehlZuTaste(taste('KeyQ'), 'ohne', kontext()), undefined);
	});

	it('Buchstaben wählen das Werkzeug, aber nie beim Tippen und nie statt ⌘V', () => {
		testZugang(true);
		try {
			assert.equal(befehlZuTaste(taste('KeyV'), 'auswahl', kontext())?.id, 'werkzeug.auswahl');
			assert.equal(befehlZuTaste(taste('KeyQ'), 'ohne', kontext())?.id, 'werkzeug.test');
			// Textsitzung, Suchfeld, Chat, Inspektor: Modus `text` oder ein Feld mit eigenem Undo.
			assert.equal(befehlZuTaste(taste('KeyQ'), 'text', kontext()), undefined);
			assert.equal(befehlZuTaste(taste('KeyQ'), 'ohne', kontext({ feldBehaeltUndo: () => true })), undefined);
			assert.equal(befehlZuTaste(taste('KeyQ'), 'ohne', kontext({ textsitzung: true })), undefined);
			assert.equal(
				befehlZuTaste(taste('KeyV', { metaKey: true }), 'auswahl', kontext({ hatAblage: true }))?.id,
				'auswahl.einfuegen',
			);
			for (const b of BEFEHLE.filter((x) => x.id.startsWith('werkzeug.'))) {
				for (const k of b.kuerzel ?? []) {
					assert.equal(k.befehl, false, b.id);
					assert.ok(!k.wahl, b.id);
				}
			}
		} finally {
			testZugang(false);
		}
	});

	it('⇧ beim Wählen hält das Werkzeug; V hält nie', () => {
		testZugang(true);
		try {
			const q = befehlZuTaste(taste('KeyQ', { shiftKey: true }), 'ohne', kontext());
			assert.equal(q?.id, 'werkzeug.test');
			q?.aus(kontext(), taste('KeyQ', { shiftKey: true }) as KeyboardEvent);
			assert.deepEqual(werkzeugStand(), { id: 'test', halten: true });
			BEFEHLE.find((b) => b.id === 'werkzeug.test')?.aus(kontext(), taste('KeyQ') as KeyboardEvent);
			assert.deepEqual(werkzeugStand(), { id: 'test', halten: false });
			assert.equal(befehlZuTaste(taste('KeyV', { shiftKey: true }), 'ohne', kontext()), undefined);
		} finally {
			zurAuswahl();
			testZugang(false);
		}
	});

	it('keine Taste kollidiert, auch wenn alle Werkzeuge aus 5.10 da sind (P Stift, ⇧P Pfad)', () => {
		const leer = { zeiger: 'crosshair', bereit: () => true, beginne: () => undefined, bewege: () => null, ende: () => null };
		const alle: Werkzeug[] = [
			WERKZEUGE[0] as Werkzeug,
			...(
				[
					['rechteck', 'KeyR'],
					['ellipse', 'KeyO'],
					['vieleck', 'KeyY'],
					['linie', 'KeyL'],
					['text', 'KeyT'],
					['stift', 'KeyP'],
				] as const
			).map(([id, code]): Werkzeug => ({ ...leer, id, titel: id, symbol: 'formen', taste: { code } })),
			{ ...leer, id: 'pfad', titel: 'Pfad', symbol: 'stift', taste: { code: 'KeyP', umschalt: true } },
			{ ...leer, id: 'schere', titel: 'Schere', symbol: 'formen', taste: { code: 'KeyM', umschalt: true } },
			{ ...leer, id: 'stern', titel: 'Stern', symbol: 'stern' },
		];
		const befehle = befehleFuerWerkzeuge(alle);
		assert.equal(befehle.length, alle.length);
		const belegt = new Map<string, string>();
		for (const b of [...BEFEHLE.filter((x) => !x.id.startsWith('werkzeug.')), ...befehle]) {
			if ((b.modus ?? MODUS_VORGABE).includes('auswahl')) {
				for (const k of b.kuerzel ?? []) {
					const s = schluessel(k);
					assert.equal(belegt.get(s), undefined, `${s} bei ${b.id} und ${belegt.get(s) ?? ''}`);
					belegt.set(s, b.id);
				}
			}
		}
		assert.equal(belegt.get('U:KeyP'), 'werkzeug.pfad');
		assert.equal(belegt.get('U:KeyR'), 'werkzeug.rechteck');
		assert.equal(befehle.find((b) => b.id === 'werkzeug.stern')?.kuerzel, undefined);
		assert.deepEqual(befehle.find((b) => b.id === 'werkzeug.stern')?.orte, ['palette']);
	});
});
