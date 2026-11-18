import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BILD_FORMAT_NAMEN, BILD_FORMATE, bildGroesse, formatFuerMasse } from '@schoolbox/kern';

import type { BildAnfrage, BildApiEinstellung, BildApiUmgebung } from './bild-api';
import { BILD_API_GESPERRT, BildApiFehler, erzeugeBild, TRANSPARENT_SATZ } from './bild-api';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 5, 6]);
const EINSTELLUNG: BildApiEinstellung = { schluessel: 'test-schluessel', modell: 'gpt-image-test', qualitaet: 'low' };

interface Aufruf {
	url: string;
	koerper: Record<string, unknown>;
	kopf: Record<string, string>;
}

const ok = (inhalt: Buffer = PNG, usage: unknown = {}) =>
	new Response(JSON.stringify({ data: [{ b64_json: inhalt.toString('base64') }], usage }), { status: 200 });

const fehler = (status: number, error: Record<string, string>, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify({ error }), { status, headers });

/** Ein falsches `fetch`, das die Antworten der Reihe nach liefert und jeden Aufruf mitschreibt. */
const falsch = (...antworten: (Response | Error)[]) => {
	const aufrufe: Aufruf[] = [];
	const wartezeiten: number[] = [];
	const laden = ((url: string, init: RequestInit) => {
		aufrufe.push({
			url,
			koerper: JSON.parse(String(init.body)) as Record<string, unknown>,
			kopf: init.headers as Record<string, string>,
		});
		const naechste = antworten.shift();
		if (!naechste) {
			throw new Error('zu viele Aufrufe');
		}
		return naechste instanceof Error ? Promise.reject(naechste) : Promise.resolve(naechste);
	}) as typeof fetch;
	const umgebung: BildApiUmgebung = {
		laden,
		warte: (ms) => {
			wartezeiten.push(ms);
			return Promise.resolve();
		},
		zufall: () => 0.5,
	};
	return { aufrufe, wartezeiten, umgebung };
};

const anfrage = (teil: Partial<BildAnfrage> = {}): BildAnfrage => ({
	prompt: 'Eine kleine runde Eule.',
	format: 'LANDSCAPE_5_4',
	typ: 'png',
	transparent: false,
	referenzen: [],
	...teil,
});

const wirft = async (versprechen: Promise<unknown>, art: BildApiFehler['art'], text?: RegExp) => {
	await assert.rejects(versprechen, (f: unknown) => {
		assert.ok(f instanceof BildApiFehler);
		assert.equal(f.art, art);
		if (text) {
			assert.match(f.message, text);
		}
		return true;
	});
};

describe('Bild-API (237): Aufruf', () => {
	it('ohne Referenz an generations, mit n 1, size, quality, output_format und Schlüssel im Kopf', async () => {
		const { aufrufe, umgebung } = falsch(ok());
		const ergebnis = await erzeugeBild(anfrage(), EINSTELLUNG, umgebung);
		assert.deepEqual(ergebnis.inhalt, PNG);
		const [a] = aufrufe;
		assert.equal(a?.url, 'https://api.openai.com/v1/images/generations');
		assert.deepEqual(a?.koerper, {
			model: 'gpt-image-test',
			prompt: 'Eine kleine runde Eule.',
			n: 1,
			size: '1440x1152',
			quality: 'low',
			output_format: 'png',
		});
		assert.equal(a?.kopf.Authorization, 'Bearer test-schluessel');
		assert.equal(a?.kopf['Content-Type'], 'application/json');
		for (const nie of ['input_fidelity', 'complexity', 'moderation', 'mask', 'markup', 'stream', 'images']) {
			assert.equal(nie in (a?.koerper ?? {}), false, nie);
		}
	});

	it('mit Referenzen an edits, als JSON mit mehreren images als Data-URL', async () => {
		const { aufrufe, umgebung } = falsch(ok(JPG));
		await erzeugeBild(anfrage({ typ: 'jpg', referenzen: [PNG, JPG] }), EINSTELLUNG, umgebung);
		const [a] = aufrufe;
		assert.equal(a?.url, 'https://api.openai.com/v1/images/edits');
		assert.deepEqual(a?.koerper.images, [
			{ image_url: `data:image/png;base64,${PNG.toString('base64')}` },
			{ image_url: `data:image/jpeg;base64,${JPG.toString('base64')}` },
		]);
	});

	it('Format → Pixel: jede Kante ein Vielfaches von 16, alle Größen in den Grenzen der Doku', () => {
		assert.equal(bildGroesse('LANDSCAPE_5_4'), '1440x1152');
		assert.equal(bildGroesse('PORTRAIT_9_16'), '928x1664');
		assert.equal(bildGroesse('SQUARE_1_1'), '1264x1264');
		for (const name of BILD_FORMAT_NAMEN) {
			const { breite, hoehe } = BILD_FORMATE[name];
			assert.equal(breite % 16, 0, name);
			assert.equal(hoehe % 16, 0, name);
			assert.ok(breite * hoehe >= 655_360 && breite * hoehe <= 8_294_400, name);
			assert.ok(breite / hoehe <= 3 && hoehe / breite <= 3, name);
			assert.equal(formatFuerMasse(breite, hoehe), name);
		}
		assert.equal(formatFuerMasse(1200, 960), 'LANDSCAPE_5_4');
	});

	it('transparent → background und PNG; .jpg → JPEG mit Kompression 90 und ohne background', async () => {
		const { aufrufe, umgebung } = falsch(ok(), ok(JPG));
		await erzeugeBild(anfrage({ transparent: true }), EINSTELLUNG, umgebung);
		await erzeugeBild(anfrage({ typ: 'jpg', transparent: true }), EINSTELLUNG, umgebung);
		assert.equal(aufrufe[0]?.koerper.background, 'transparent');
		assert.equal(aufrufe[0]?.koerper.output_format, 'png');
		assert.equal('output_compression' in (aufrufe[0]?.koerper ?? {}), false);
		assert.equal(aufrufe[0]?.koerper.prompt, 'Eine kleine runde Eule.');
		assert.equal(aufrufe[1]?.koerper.output_format, 'jpeg');
		assert.equal(aufrufe[1]?.koerper.output_compression, 90);
		assert.equal('background' in (aufrufe[1]?.koerper ?? {}), false);
	});

	it('Bearbeiten eines transparenten Bilds: background und der Satz zum transparenten Hintergrund', async () => {
		const { aufrufe, umgebung } = falsch(ok());
		await erzeugeBild(
			anfrage({ prompt: 'Ändere nur den Schal: blau. ', transparent: true, bearbeiten: true, referenzen: [PNG] }),
			EINSTELLUNG,
			umgebung,
		);
		assert.equal(aufrufe[0]?.url.endsWith('/edits'), true);
		assert.equal(aufrufe[0]?.koerper.background, 'transparent');
		assert.equal(aufrufe[0]?.koerper.prompt, `Ändere nur den Schal: blau. ${TRANSPARENT_SATZ}`);
	});

	it('usage wird ausgewertet, die Kosten aus den Token-Sätzen geschätzt', async () => {
		const usage = { input_tokens_details: { image_tokens: 1520, text_tokens: 300 }, output_tokens: 1000 };
		const { umgebung } = falsch(ok(PNG, usage));
		const ergebnis = await erzeugeBild(anfrage(), EINSTELLUNG, umgebung);
		assert.deepEqual(ergebnis.verbrauch, { bildToken: 1520, textToken: 300, ausgabeToken: 1000 });
		assert.equal(ergebnis.kostenUsd, 0.0437);
		assert.equal(ergebnis.wiederholungen, 0);
	});

	it('ein Ergebnis, das nicht zur Endung passt, ist ein Fehler', async () => {
		const { umgebung } = falsch(ok(JPG));
		await wirft(erzeugeBild(anfrage(), EINSTELLUNG, umgebung), 'antwort');
	});
});

describe('Bild-API (237): Fehler und Wiederholungen', () => {
	it('429 rate_limit_exceeded mit Retry-After → wartet mindestens so lange, dann geht es weiter', async () => {
		const { aufrufe, umgebung, wartezeiten } = falsch(
			fehler(429, { code: 'rate_limit_exceeded', type: 'requests', message: 'Rate limit' }, { 'retry-after': '7' }),
			ok(),
		);
		const ergebnis = await erzeugeBild(anfrage(), EINSTELLUNG, umgebung);
		assert.equal(aufrufe.length, 2);
		assert.deepEqual(wartezeiten, [7000 + 2500]);
		assert.equal(ergebnis.wiederholungen, 1);
	});

	it('ohne Retry-After 20, 40, 80 s; nach drei Wiederholungen „Bild-API ausgelastet“', async () => {
		const { aufrufe, umgebung, wartezeiten } = falsch(
			fehler(503, { code: 'server_is_overloaded', type: 'server_error', message: 'busy' }),
			fehler(500, { type: 'server_error', message: 'oops' }),
			fehler(429, { code: 'slow_down', type: 'requests', message: 'slow' }),
			fehler(503, { code: 'server_is_overloaded', type: 'server_error', message: 'busy' }),
		);
		await wirft(erzeugeBild(anfrage(), EINSTELLUNG, umgebung), 'ausgelastet', /Bild-API ausgelastet/);
		assert.equal(aufrufe.length, 4);
		assert.deepEqual(wartezeiten, [20_000, 40_000, 80_000]);
	});

	it('429 credit_balance_exhausted und insufficient_quota → bild-api-gesperrt ohne Wiederholung', async () => {
		for (const error of [
			{ code: 'credit_balance_exhausted', type: 'billing', message: 'no credit' },
			{ code: 'organization_spend_limit_exceeded', type: 'billing', message: 'limit' },
			{ code: '', type: 'insufficient_quota', message: 'quota' },
		]) {
			const { aufrufe, umgebung, wartezeiten } = falsch(fehler(429, error, { 'retry-after': '1' }));
			await wirft(erzeugeBild(anfrage(), EINSTELLUNG, umgebung), 'gesperrt', new RegExp(BILD_API_GESPERRT));
			assert.equal(aufrufe.length, 1);
			assert.deepEqual(wartezeiten, []);
		}
		for (const status of [401, 403]) {
			const { aufrufe, umgebung } = falsch(fehler(status, { type: 'invalid_request_error', message: 'key' }));
			await wirft(erzeugeBild(anfrage(), EINSTELLUNG, umgebung), 'gesperrt');
			assert.equal(aufrufe.length, 1);
		}
	});

	it('moderation_blocked → Sicherheitsfilter, ohne Wiederholung', async () => {
		const { aufrufe, umgebung } = falsch(
			fehler(400, { code: 'moderation_blocked', type: 'image_generation_user_error', message: 'blocked' }),
		);
		await wirft(erzeugeBild(anfrage(), EINSTELLUNG, umgebung), 'sicherheit', /Sicherheitsfilter: Motiv harmloser/);
		assert.equal(aufrufe.length, 1);
	});

	it('übrige 4xx: kurzer Fehlertext aus error.message, ohne Wiederholung', async () => {
		const { aufrufe, umgebung } = falsch(
			fehler(400, { code: 'invalid_value', type: 'image_generation_user_error', message: 'Invalid size.' }),
		);
		await wirft(erzeugeBild(anfrage(), EINSTELLUNG, umgebung), 'abgelehnt', /Invalid size/);
		assert.equal(aufrufe.length, 1);
	});

	it('Zeitüberschreitung und Netzfehler: kurzer Fehlertext', async () => {
		const haengt = ((_url: string, init: RequestInit) =>
			new Promise<Response>((_, reject) => {
				init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
			})) as typeof fetch;
		await wirft(erzeugeBild(anfrage(), EINSTELLUNG, { laden: haengt, zeitMs: 20 }), 'zeit', /nicht rechtzeitig/);
		const { umgebung } = falsch(new TypeError('fetch failed'));
		await wirft(erzeugeBild(anfrage(), EINSTELLUNG, umgebung), 'netz', /nicht erreichbar/);
	});

	it('keine Wiederholung über die Frist des Aufrufs hinaus', async () => {
		const { aufrufe, umgebung } = falsch(
			fehler(429, { code: 'rate_limit_exceeded', type: 'requests', message: 'Rate limit' }, { 'retry-after': '60' }),
		);
		const jetzt = 1_000_000;
		await wirft(
			erzeugeBild(anfrage(), EINSTELLUNG, { ...umgebung, jetzt: () => jetzt, bis: jetzt + 30_000 }),
			'ausgelastet',
		);
		assert.equal(aufrufe.length, 1);
	});
});
