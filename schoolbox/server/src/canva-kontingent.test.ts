import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { neuesKontingent, notiereKontingent } from './canva-kontingent';

const SPERRE =
	'{"status":"failed","failure":{"code":"quota_cooldown","message":"Your credit usage is cooling down. Please try again later."}}';

/** Ein Aufruf mit seinem Ergebnis, wie im Strom von `stream-json`. */
const aufruf = (id: string, name: string, content: unknown, isError = false) => [
	{ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input: {} }] } },
	{ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] } },
];

const nach = (...ereignisse: Record<string, unknown>[][]) => {
	const k = neuesKontingent();
	for (const e of ereignisse.flat()) {
		notiereKontingent(k, e);
	}
	return { gesperrt: k.gesperrt, imLauf: k.imLauf };
};

describe('Canva-Kontingent im Strom (235)', () => {
	it('Sperre von generate-image, als String und als Liste von Texten', () => {
		assert.deepEqual(nach(aufruf('a', 'mcp__canva__generate-image', SPERRE)), { gesperrt: true, imLauf: true });
		assert.deepEqual(nach(aufruf('a', 'mcp__canva__get-generate-image-job', [{ type: 'text', text: SPERRE }])), {
			gesperrt: true,
			imLauf: true,
		});
	});

	it('Ein neu angenommener Job setzt zurück, ein fertiges Bild eines älteren Jobs nicht; die Sperre im Lauf bleibt', () => {
		const job = aufruf('b', 'mcp__canva__generate-image', '{"jobId":"acs-quota-v1.xyz"}');
		const bild = aufruf('c', 'mcp__canva__get-generate-image-job', [
			{ type: 'text', text: '[Resource link: MAabc] https://www.canva.com/M/MAabc' },
		]);
		const sperre = aufruf('a', 'mcp__canva__generate-image', SPERRE);
		assert.deepEqual(nach(sperre, job), { gesperrt: false, imLauf: true });
		assert.deepEqual(nach(sperre, bild), { gesperrt: true, imLauf: true });
	});

	it('Sperre nach Erfolg zählt wieder', () => {
		assert.deepEqual(
			nach(
				aufruf('a', 'mcp__canva__generate-image', '{"jobId":"j"}'),
				aufruf('b', 'mcp__canva__generate-image', SPERRE),
			),
			{ gesperrt: true, imLauf: true },
		);
	});

	it('Warten, 503 und anderes setzen nicht zurück', () => {
		const sperre = aufruf('a', 'mcp__canva__generate-image', SPERRE);
		assert.deepEqual(nach(sperre, aufruf('b', 'mcp__canva__get-generate-image-job', '{"status":"PENDING"}')), {
			gesperrt: true,
			imLauf: true,
		});
		assert.deepEqual(
			nach(
				sperre,
				aufruf('c', 'mcp__canva__get-generate-image-job', 'Error: {"statusCode":503,"error":"x"}', true),
			),
			{ gesperrt: true, imLauf: true },
		);
		assert.deepEqual(nach(sperre, aufruf('d', 'mcp__canva__search-designs', '{"items":[]}')), {
			gesperrt: true,
			imLauf: true,
		});
	});

	it('Fremde Werkzeuge, die „quota_cooldown“ lesen, zählen nicht', () => {
		assert.deepEqual(nach(aufruf('a', 'Read', `Meldet Canva ${SPERRE}, warte einige Minuten.`)), {
			gesperrt: false,
			imLauf: false,
		});
		// Ein Ergebnis ohne bekannten Aufruf auch nicht.
		assert.deepEqual(
			nach([
				{ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: SPERRE }] } },
			]),
			{ gesperrt: false, imLauf: false },
		);
	});
});
