import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/** Was eine Schublade nicht selbst baut (167): eigene Überschrift, Nummer im Kreis, Linie zwischen Abschnitten. */
const EIGENER_AUFBAU = /<h[23][\s>]|rounded-full|border-t\b/;

/** Zeilen, die den Aufbau aus `Schublade.tsx` nachbauen, als „Zeile: Inhalt“. */
const eigenerAufbau = (quelle: string): string[] =>
	quelle.split('\n').flatMap((zeile, i) => (EIGENER_AUFBAU.test(zeile) ? [`${i + 1}: ${zeile.trim()}`] : []));

const SRC = new URL('../', import.meta.url);
const lies = (pfad: string) => readFileSync(new URL(pfad, SRC), 'utf8');
const QUELLEN = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
	.map((d) => d.replaceAll('\\', '/'))
	.filter((d) => /\.tsx?$/.test(d) && !d.endsWith('.test.ts'));
/** Die Teile jeder Schublade und die Abschnitte von „Werkzeuge“. */
const TEILE = QUELLEN.filter((d) => /^editor\/schubladen\/(formen\/)?[^/]+-teile\.tsx$/.test(d));

describe('Ein Aufbau für alle Schubladen (167)', () => {
	it('die Prüfhilfe meldet eine eigene Überschrift und schweigt beim Abschnitt', () => {
		assert.equal(eigenerAufbau('<h3 className="x">Formen</h3>').length, 1);
		assert.equal(eigenerAufbau('<div className="border-t border-rand">').length, 1);
		assert.deepEqual(eigenerAufbau('<Schubladenabschnitt titel="x">'), []);
	});

	it('die Schubladen bauen keine Überschrift, keine Nummer und keine Linie selbst', () => {
		assert.ok(TEILE.length >= 8, TEILE.join(', '));
		for (const pfad of TEILE) {
			assert.deepEqual(eigenerAufbau(lies(pfad)), [], pfad);
		}
	});

	it('„Bausteine“ hat außerhalb der Schnellauswahl keine eigene Überschrift', () => {
		const quelle = lies('editor/Bibliothek.tsx');
		const schublade = quelle.slice(quelle.indexOf('const EigenVerwalten'));
		assert.ok(schublade.length < quelle.length);
		assert.doesNotMatch(schublade, /<h[23][\s>]/);
	});

	it('der Kopf lebt nur in Schublade.tsx', () => {
		assert.equal(existsSync(new URL('bausteine/Schubladenkopf.tsx', SRC)), false);
		const mitKopf = QUELLEN.filter((d) => lies(d).includes('data-schubladenkopf'));
		assert.deepEqual(mitKopf, ['bausteine/Schublade.tsx']);
	});

	it('jede Spaltenzahl des Rasters steht ausgeschrieben, damit Tailwind sie findet', () => {
		const quelle = lies('bausteine/schubladenhilfe.ts');
		for (const n of [2, 3, 4, 5]) {
			assert.match(quelle, new RegExp(`'grid-cols-${n}'`), String(n));
		}
	});
});
