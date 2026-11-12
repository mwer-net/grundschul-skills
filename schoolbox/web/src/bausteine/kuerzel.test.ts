import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import * as editor from '../editor/befehle';
import * as ablage from '../ordner/befehle';

/** Kürzel als Text in der Oberfläche (166, Entscheidung 53): Zeichen, Tastennamen, „Esc schließt“. */
const MUSTER = /[⌘⌥⇧⏎⌫]|\bEsc\b|\besc [a-zäöü]|\bLeertaste\b|\bPfeiltasten?\b|\bTaste [A-Z0-9]\b/u;

/** Hier stehen Kürzel zu Recht: Register, Anzeige, Tastenlisten, Hilfe und die Musterseite. */
const ERLAUBT = new Set([
	'bausteine/kuerzel.ts',
	'editor/befehle.ts',
	'ordner/dialoge.tsx',
	'seiten/Hilfe.tsx',
	'seiten/hilfe-gestalten.tsx',
	'seiten/hilfe-tasten.tsx',
	'seiten/Bausteine.tsx',
]);

/** Wer `Kuerzel` zeigt: Menü, Tooltip, Tastenliste, Palette, Hilfe und die Musterseiten. */
const ZEIGEN_KUERZEL = new Set([
	'bausteine/Menue.tsx',
	'bausteine/Tooltip.tsx',
	'bausteine/Tastenliste.tsx',
	'editor/Palette.tsx',
	'seiten/Hilfe.tsx',
	'seiten/hilfe-gestalten.tsx',
	'seiten/Schubladenliste.tsx',
	'seiten/Bausteine.tsx',
]);

/** Kommentare zählen nicht, ihre Zeilen bleiben (für die Zeilennummer). */
const ohneKommentare = (quelle: string) =>
	quelle.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** Zeilen mit einem Kürzel als Text, als „Zeile: Inhalt“. */
export const kuerzelImText = (quelle: string): string[] =>
	ohneKommentare(quelle)
		.split('\n')
		.flatMap((zeile, i) => (MUSTER.test(zeile) ? [`${i + 1}: ${zeile.trim()}`] : []));

const SRC = new URL('../', import.meta.url);
const DATEIEN = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
	.map((d) => d.replaceAll('\\', '/'))
	.filter((d) => /\.tsx?$/.test(d) && !d.endsWith('.test.ts'))
	.map((pfad) => ({ pfad, quelle: ohneKommentare(readFileSync(new URL(pfad, SRC), 'utf8')) }));

describe('Keine Kürzel in der Oberfläche (166)', () => {
	it('die Suche findet Kürzel im Text, aber nicht in Kommentaren und Namen', () => {
		assert.equal(kuerzelImText('<Knopf title="Fett (⌘B)" />').length, 1);
		assert.equal(kuerzelImText('<span>Punkte bearbeiten · Esc beendet</span>').length, 1);
		assert.deepEqual(kuerzelImText('// ⌘K öffnet die Palette\nconst esc = true;'), []);
	});

	it('Kürzel als Text stehen nur in Register, Tastenlisten und Hilfe', () => {
		for (const { pfad, quelle } of DATEIEN) {
			if (!ERLAUBT.has(pfad)) {
				assert.deepEqual(kuerzelImText(quelle), [], pfad);
			}
		}
	});

	it('`<kbd>` gibt es nur in `Kuerzel`', () => {
		for (const { pfad, quelle } of DATEIEN) {
			assert.equal(quelle.includes('<kbd'), pfad === 'bausteine/Kuerzel.tsx', pfad);
		}
	});

	it('`Kuerzel` zeigen nur Menü, Tooltip, Tastenliste, Palette und Hilfe', () => {
		for (const { pfad, quelle } of DATEIEN) {
			assert.equal(/from '[./]+(?:bausteine\/)?Kuerzel'/.test(quelle), ZEIGEN_KUERZEL.has(pfad), pfad);
		}
	});

	it('ein Kürzel kommt aus dem Register, nicht als Text', () => {
		for (const { pfad, quelle } of DATEIEN) {
			if (pfad !== 'seiten/Bausteine.tsx') {
				assert.doesNotMatch(quelle, /\bkuerzel="/, pfad);
			}
		}
	});

	it('jede Id in `kuerzelVon` gibt es im Register, aus dem sie kommt', () => {
		const register = { 'editor/befehle': editor.BEFEHLE, 'ordner/befehle': ablage.BEFEHLE };
		let gefunden = 0;
		for (const { pfad, quelle } of DATEIEN) {
			const herkunft = /import \{[^}]*\bkuerzelVon\b[^}]*\} from '([^']+)'/.exec(quelle)?.[1];
			const ids = [...quelle.matchAll(/kuerzelVon\('([^']+)'/g)].map((m) => m[1] ?? '');
			if (!herkunft || ids.length === 0) {
				continue;
			}
			const ziel = new URL(herkunft, new URL(pfad, SRC)).href.slice(SRC.href.length);
			const befehle = register[ziel as keyof typeof register];
			assert.ok(befehle, `${pfad}: kuerzelVon aus ${herkunft}`);
			for (const id of ids) {
				assert.ok(
					befehle.some((b) => b.id === id && b.kuerzel?.length),
					`${pfad}: ${id}`,
				);
				gefunden++;
			}
		}
		assert.ok(gefunden > 10, `nur ${gefunden} Aufrufe gefunden`);
	});
});
