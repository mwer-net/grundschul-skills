import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { BEREICH_SYMBOL } from '@schoolbox/kern/src/abbildungen';
import { MEINE_BAUSTEINE_SYMBOL } from '@schoolbox/kern/src/katalog';

describe('Symbole der Bereiche', () => {
	const quelle = readFileSync(new URL('./Symbol.tsx', import.meta.url), 'utf8');

	it('jeder Name aus dem Kern steht in Symbol.tsx', () => {
		for (const name of [...Object.values(BEREICH_SYMBOL), MEINE_BAUSTEINE_SYMBOL]) {
			assert.match(quelle, new RegExp(`^\\t'?${name}'?: \\w+,$`, 'm'), name);
		}
	});

	it('Streuen zeigt Konfetti, kein Diagramm (174)', () => {
		assert.match(quelle, /^\t'streuung': PartyPopper,$/m);
		assert.doesNotMatch(quelle, /ChartScatter/);
	});
});
