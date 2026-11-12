import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Kontext, Kuerzel, Modus } from './befehle';
import {
	BEFEHLE,
	befehlZuTaste,
	istZoomTaste,
	kuerzelText,
	kuerzelVon,
	MODUS_VORGABE,
	passtTaste,
	tastenAbschnitte,
	tastenBeimTippen,
} from './befehle';
import type { Werkzeug } from './gestaltung/werkzeuge';
import { WERKZEUGE, werkzeugVon } from './gestaltung/werkzeuge';
import { befehleFuerWerkzeuge } from './gestaltung/werkzeuge/befehle';
import { werkzeugStand, zurAuswahl } from './gestaltung/werkzeuge/stand';
import { suchePalette } from './palette-suche';
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

	it('hat in keinem Zustand zwei Befehle auf derselben Taste, außer einer hat Vorrang über `wenn` (100)', () => {
		for (const modus of ['auswahl', 'ohne', 'text'] as Modus[]) {
			const belegt = new Map<string, string>();
			for (const b of BEFEHLE) {
				if ((b.modus ?? MODUS_VORGABE).includes(modus)) {
					for (const k of (b.kuerzel ?? []).filter((t) => !t.wenn)) {
						const s = schluessel(k);
						assert.equal(belegt.get(s), undefined, `${modus}: ${s} bei ${b.id} und ${belegt.get(s) ?? ''}`);
						belegt.set(s, b.id);
					}
				}
			}
			const mitWenn = new Map<string, string>();
			for (const b of BEFEHLE) {
				if ((b.modus ?? MODUS_VORGABE).includes(modus)) {
					for (const k of (b.kuerzel ?? []).filter((t) => t.wenn)) {
						const s = schluessel(k);
						const da = mitWenn.get(s);
						assert.ok(
							da === undefined || da === b.id,
							`${modus}: ${s} mit wenn bei ${b.id} und ${da ?? ''}`,
						);
						mitWenn.set(s, b.id);
					}
				}
			}
		}
	});

	it('Pfeiltasten: bei Gestaltung schieben, bei Bausteinen wählen (100)', () => {
		const pfeil = {
			code: 'ArrowRight',
			key: 'ArrowRight',
			metaKey: false,
			ctrlKey: false,
			altKey: false,
			shiftKey: false,
		};
		const k = (gestaltung: boolean) =>
			({
				gestaltung: gestaltung ? {} : null,
				feldBehaeltUndo: () => false,
				textMarkiert: () => false,
			}) as unknown as Kontext;
		assert.equal(befehlZuTaste(pfeil, 'auswahl', k(true))?.id, 'auswahl.schiebe-rechts');
		assert.equal(befehlZuTaste({ ...pfeil, shiftKey: true }, 'auswahl', k(true))?.id, 'auswahl.schiebe-rechts');
		assert.equal(befehlZuTaste(pfeil, 'auswahl', k(false))?.id, 'auswahl.naechster');
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
		// Den Zoom übernimmt der Editor bewusst: ⌘+, ⌘- und ⌘0 zoomen dort das Blatt (56).
		const zoom = ['ansicht.zoom-rein', 'ansicht.zoom-raus', 'ansicht.zoom-100'];
		for (const b of BEFEHLE.filter((x) => !zoom.includes(x.id))) {
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
	it('jede Schublade hat genau einen Befehl `ansicht.links-<id>` mit ihrer Taste, ⌥1 bis ⌥5 in Reihenfolge', () => {
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

	it('ohne Rezepte und Text: fünf Schubladen, ⌥6 und ⌥7 frei, kein Befehl `rezept.*`', () => {
		assert.equal(SCHUBLADEN.length, 5);
		assert.equal(REIHE.length, 5);
		const sechs = { code: 'Digit6', key: '§', metaKey: false, ctrlKey: false, altKey: true, shiftKey: false };
		assert.equal(befehlZuTaste(sechs, 'ohne', { frei: true } as Kontext), undefined);
		const sieben = { code: 'Digit7', key: '¶', metaKey: false, ctrlKey: false, altKey: true, shiftKey: false };
		assert.equal(befehlZuTaste(sieben, 'ohne', { frei: true } as Kontext), undefined);
		assert.deepEqual(
			BEFEHLE.filter((b) => b.id.startsWith('rezept.') || b.id === 'ansicht.links-rezepte').map((b) => b.id),
			[],
		);
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
			['ebenen', 'bausteine', 'werkzeuge', 'figuren', 'bilder'],
		);
		const drei = { code: 'Digit3', key: '£', metaKey: false, ctrlKey: false, altKey: true, shiftKey: false };
		assert.equal(befehlZuTaste(drei, 'ohne', k)?.id, 'ansicht.links-werkzeuge');
		const fuenf = { code: 'Digit5', key: '[', metaKey: false, ctrlKey: false, altKey: true, shiftKey: false };
		assert.equal(befehlZuTaste(fuenf, 'ohne', k)?.id, 'ansicht.links-bilder');
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
		// Die Rezepte gibt es nicht mehr (180): Wer sie zuletzt offen hatte, sieht die Ebenen.
		assert.equal(alsSchublade('rezepte'), null);
	});

	it('kein Befehl zum Anheften; aktiv ist jede sichtbare Spalte, die Ebenen auch neben einer Schublade (183)', () => {
		assert.equal(
			BEFEHLE.find((b) => b.id === 'ansicht.ebenen-anheften'),
			undefined,
		);
		const aktiv = (linksOffen: Kontext['linksOffen'], id: string) =>
			BEFEHLE.find((b) => b.id === `ansicht.links-${id}`)?.aktiv?.({ linksOffen } as Kontext);
		assert.equal(aktiv(['ebenen', 'bausteine'], 'ebenen'), true);
		assert.equal(aktiv(['ebenen', 'bausteine'], 'bausteine'), true);
		assert.equal(aktiv(['ebenen', 'bausteine'], 'figuren'), false);
		assert.equal(aktiv(['bausteine'], 'ebenen'), false);
		assert.equal(aktiv(['bausteine'], 'bausteine'), true);
	});

	it('„Werkzeuge“ statt „Formen“ und „Text“ (175): alte Speicherwerte und Suchwörter führen dorthin', () => {
		assert.equal(alsSchublade('formen'), 'werkzeuge');
		assert.equal(alsSchublade('text'), 'werkzeuge');
		assert.equal(alsSchublade('werkzeuge'), 'werkzeuge');
		const b = BEFEHLE.find((x) => x.id === 'ansicht.links-werkzeuge');
		assert.equal(b?.titel, 'Werkzeuge');
		const schubladen = BEFEHLE.filter((x) => x.id.startsWith('ansicht.links-')).map((x) => ({
			id: x.id,
			titel: typeof x.titel === 'string' ? x.titel : '',
			gruppe: '',
			...(x.suchwoerter ? { suchwoerter: x.suchwoerter } : {}),
			aus: () => undefined,
		}));
		for (const wort of ['text', 'formen', 'Schrift']) {
			assert.deepEqual(
				suchePalette(wort, schubladen).map((e) => e.id),
				['ansicht.links-werkzeuge'],
				wort,
			);
		}
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

	it('V zeigt den Zeiger, jedes Werkzeug hat ein eigenes Symbol (170)', () => {
		assert.equal(werkzeugVon('auswahl')?.symbol, 'auswahl');
		assert.equal(new Set(WERKZEUGE.map((w) => w.symbol)).size, WERKZEUGE.length);
	});

	it('ohne bereites Werkzeug gibt es auch V nicht, und die Tasten bleiben beim Browser', () => {
		testZugang(false);
		// T ist überall bereit, wo frei bearbeitet wird; ohne freie Lage bleibt kein Werkzeug.
		const ohne = kontext({ frei: false });
		const v = BEFEHLE.find((b) => b.id === 'werkzeug.auswahl');
		assert.equal(v?.verfuegbar(ohne), false);
		assert.equal(befehlZuTaste(taste('KeyV'), 'auswahl', ohne), undefined);
		assert.equal(befehlZuTaste(taste('KeyQ'), 'ohne', ohne), undefined);
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
		const leer = {
			zeiger: 'crosshair',
			bereit: () => true,
			beginne: () => undefined,
			bewege: () => null,
			ende: () => null,
		};
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
			{ ...leer, id: 'stern', titel: 'Stern', symbol: 'stern' },
		];
		const befehle = befehleFuerWerkzeuge(alle);
		assert.equal(befehle.length, alle.length);
		const belegt = new Map<string, string>();
		for (const b of [...BEFEHLE.filter((x) => !x.id.startsWith('werkzeug.')), ...befehle]) {
			// Die Pfeile schieben mit Vorrang vor Vorheriger/Nächster (100); das prüft „Pfeiltasten: bei Gestaltung …“.
			if ((b.modus ?? MODUS_VORGABE).includes('auswahl') && !b.id.startsWith('auswahl.schiebe-')) {
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

	it('Keine Formen-Schere (173)', () => {
		assert.equal(werkzeugVon('schere'), undefined);
		assert.ok(!WERKZEUGE.some((w) => w.id === 'schere'));
		assert.equal(
			BEFEHLE.find((b) => b.id === 'werkzeug.schere'),
			undefined,
		);
		const mitTaste = (s: string) =>
			BEFEHLE.filter(
				(b) =>
					(b.modus ?? MODUS_VORGABE).includes('auswahl') &&
					(b.kuerzel ?? []).some((k) => schluessel(k) === s),
			).map((b) => b.id);
		assert.deepEqual(mitTaste('U:KeyM'), []);
		// Gegenprobe: ⇧P gehört dem Pfad, der Test findet die Tasten der Werkzeuge also.
		assert.deepEqual(mitTaste('U:KeyP'), ['werkzeug.pfad']);
	});

	it('⌘K findet Streuen unter „Konfetti“, „Punkte“ und „Sterne“ (174)', () => {
		const woerter = BEFEHLE.find((b) => b.id === 'werkzeug.streuen')?.suchwoerter ?? [];
		for (const wort of ['werkzeug', 'zeichnen', 'streuung', 'konfetti', 'punkte', 'sterne']) {
			assert.ok(woerter.includes(wort), wort);
		}
		const rechteck = BEFEHLE.find((b) => b.id === 'werkzeug.rechteck')?.suchwoerter ?? [];
		assert.ok(rechteck.includes('werkzeug'));
		assert.ok(!rechteck.includes('konfetti'));
	});

	it('die Suchwörter eines Werkzeugs kommen in seinen Befehl (174)', () => {
		const werkzeug: Werkzeug = {
			id: 'xy',
			titel: 'Xy',
			symbol: 'formen',
			suchwoerter: ['xy'],
			zeiger: 'crosshair',
			bereit: () => true,
			beginne: () => undefined,
			bewege: () => null,
			ende: () => null,
		};
		assert.deepEqual(befehleFuerWerkzeuge([werkzeug])[0]?.suchwoerter, ['werkzeug', 'zeichnen', 'xy']);
	});
});

describe('Kürzel aus dem Register (166)', () => {
	it('die Tastenliste zeigt jeden Befehl mit Taste genau einmal, mit einem Namen aus Text', () => {
		const zeilen = tastenAbschnitte(undefined, true).flatMap((a) => a.zeilen);
		const sichtbar = BEFEHLE.filter((b) => b.kuerzel?.length && (b.inUebersicht?.() ?? true));
		assert.deepEqual(zeilen.map((z) => z.id).sort(), sichtbar.map((b) => b.id).sort());
		for (const z of zeilen) {
			assert.notEqual(z.titel, z.id, z.id);
			assert.ok(z.tasten.length > 0, z.id);
		}
	});

	it('jeder Befehl mit Taste und wechselndem Namen hat einen Namen für Hilfe und Tastenliste', () => {
		for (const b of BEFEHLE) {
			if (b.kuerzel?.length && typeof b.titel === 'function') {
				assert.ok(b.hilfeTitel, b.id);
			}
		}
	});

	it('kuerzelVon nimmt das erste Kürzel und kennt jeden Befehl', () => {
		assert.equal(kuerzelVon('dokument.rueckgaengig', true), kuerzelText({ code: 'KeyZ', befehl: true }, true));
		assert.equal(kuerzelVon('ansicht.links-werkzeuge', true), '⌥3');
		assert.throws(() => kuerzelVon('gibt-es-nicht'), /gibt-es-nicht/);
	});

	it('beim Tippen gelten nur ⌘+, ⌘-, ⌘0, ⌘J, ⌘K, ⌘Z und ⇧⌘Z', () => {
		assert.deepEqual(new Set(tastenBeimTippen(true)), new Set(['⌘+', '⌘-', '⌘0', '⌘J', '⌘K', '⌘Z', '⇧⌘Z']));
	});

	it('die Leertaste heißt so', () => {
		assert.equal(kuerzelText({ key: ' ' }, true), 'Leertaste');
	});
});

type Taste = Parameters<typeof befehlZuTaste>[0];

describe('Zoom-Tasten (184)', () => {
	const taste = (t: Partial<Taste>): Taste => ({
		code: '',
		key: '',
		metaKey: false,
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		...t,
	});
	const k = { feldBehaeltUndo: () => false, textMarkiert: () => false } as unknown as Kontext;
	const id = (t: Partial<Taste>, modus: Modus) => befehlZuTaste(taste(t), modus, k)?.id;

	it('⌘+, ⌘- und ⌘0 zoomen auch beim Tippen, mit ⌘ oder Strg', () => {
		for (const modus of ['auswahl', 'ohne', 'text'] as Modus[]) {
			assert.equal(id({ key: '+', code: 'BracketRight', metaKey: true }, modus), 'ansicht.zoom-rein', modus);
			assert.equal(id({ key: '+', code: 'BracketRight', ctrlKey: true }, modus), 'ansicht.zoom-rein', modus);
			assert.equal(id({ key: '+', code: 'Equal', metaKey: true, shiftKey: true }, modus), 'ansicht.zoom-rein');
			assert.equal(id({ key: '-', code: 'Slash', metaKey: true }, modus), 'ansicht.zoom-raus', modus);
			assert.equal(id({ key: '0', code: 'Digit0', metaKey: true }, modus), 'ansicht.zoom-100', modus);
		}
	});

	it('`+` beim Tippen bleibt ein Zeichen, sonst zoomt es', () => {
		assert.equal(id({ key: '+', code: 'BracketRight' }, 'text'), undefined);
		assert.equal(id({ key: '-', code: 'Slash' }, 'text'), undefined);
		assert.equal(id({ key: '1', code: 'Digit1' }, 'text'), undefined);
		assert.equal(id({ key: '+', code: 'BracketRight' }, 'ohne'), 'ansicht.zoom-rein');
		assert.equal(id({ key: '1', code: 'Digit1' }, 'auswahl'), 'ansicht.zoom-100');
	});

	it('beim Tippen bleibt ⌥C ein Zeichen, ⌘J ruft weiter Claude', () => {
		assert.equal(id({ key: 'ç', code: 'KeyC', altKey: true }, 'text'), undefined);
		assert.equal(id({ key: 'j', code: 'KeyJ', metaKey: true }, 'text'), 'ansicht.claude');
	});

	it('istZoomTaste: nur die ⌘-Kürzel der drei Befehle', () => {
		assert.ok(istZoomTaste(taste({ key: '+', metaKey: true })));
		assert.ok(istZoomTaste(taste({ key: '-', ctrlKey: true })));
		assert.ok(istZoomTaste(taste({ key: '0', code: 'Digit0', metaKey: true })));
		assert.ok(!istZoomTaste(taste({ key: '+' })));
		assert.ok(!istZoomTaste(taste({ key: '+', metaKey: true, altKey: true })));
		assert.ok(!istZoomTaste(taste({ key: 'k', code: 'KeyK', metaKey: true })));
	});

	it('Tooltip und Tastenliste zeigen das ⌘-Kürzel zuerst, die Taste ohne ⌘ bleibt', () => {
		assert.equal(kuerzelVon('ansicht.zoom-rein', true), '⌘+');
		assert.equal(kuerzelVon('ansicht.zoom-raus', true), '⌘-');
		assert.equal(kuerzelVon('ansicht.zoom-100', true), '⌘0');
		assert.equal(kuerzelVon('ansicht.einpassen', true), '0');
		const ansicht = tastenAbschnitte(undefined, true).find((a) => a.titel === 'Ansicht');
		const zeile = ansicht?.zeilen.find((z) => z.id === 'ansicht.zoom-100');
		assert.deepEqual(zeile?.tasten, ['⌘0', '1']);
	});
});
