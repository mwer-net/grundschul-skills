import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fasseZusammen } from './gleiche';

describe('fasseZusammen (191-11)', () => {
	it('macht aus gleichen Sätzen eine Zeile mit der Zahl dahinter', () => {
		assert.deepEqual(fasseZusammen(['A.', 'B.', 'A.', 'A.']), ['A. (3 Stellen)', 'B.']);
	});

	it('lässt einzelne Sätze, wie sie sind', () => {
		assert.deepEqual(fasseZusammen(['A.', 'B.']), ['A.', 'B.']);
		assert.deepEqual(fasseZusammen([]), []);
	});
});
