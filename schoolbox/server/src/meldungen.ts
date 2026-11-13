import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { json, Router } from 'express';

import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';

/** Ablage für Meldungen aus dem Käferknopf; Claude macht später daraus Tickets. Kein gültiger Mappen-Name. */
export const MELDUNGEN_ORDNER = '_meldungen';
const MAX_MELDUNG = '25mb';
const MAX_TEXT = 20_000;
const ARTEN = ['fehler', 'wunsch', 'aussehen'] as const;
const PNG_DATEN = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

const zweistellig = (n: number) => String(n).padStart(2, '0');

const zeitstempel = (d: Date) =>
	`${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}-` +
	`${zweistellig(d.getHours())}${zweistellig(d.getMinutes())}${zweistellig(d.getSeconds())}`;

const kurzname = (text: string) =>
	text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40)
		.replace(/-+$/, '') || 'meldung';

export const meldungenApi = (kontext: Kontext) => {
	const router = Router();
	router.post('/meldungen', json({ limit: MAX_MELDUNG }), async (req, res) => {
		const { art, bild, text, umgebung } = (req.body ?? {}) as Record<string, unknown>;
		if (typeof text !== 'string' || !text.trim()) {
			throw new HttpFehler(400, 'Bitte kurz beschreiben, was auffällt.');
		}
		if (text.length > MAX_TEXT) {
			throw new HttpFehler(400, 'Die Beschreibung ist zu lang.');
		}
		const sorte = ARTEN.find((a) => a === art) ?? 'fehler';
		const png = typeof bild === 'string' ? PNG_DATEN.exec(bild)?.[1] : undefined;
		const jetzt = new Date();
		const name = `${zeitstempel(jetzt)}-${kurzname(text)}`;
		const dir = path.join(kontext.konfig.materialDir, MELDUNGEN_ORDNER, name);
		await mkdir(dir, { recursive: true });
		if (png) {
			await writeFile(path.join(dir, 'bildschirm.png'), Buffer.from(png, 'base64'));
		}
		const daten = {
			art: sorte,
			zeit: jetzt.toISOString(),
			version: kontext.version,
			text: text.trim(),
			umgebung: umgebung ?? null,
		};
		await writeFile(path.join(dir, 'meldung.json'), `${JSON.stringify(daten, null, '\t')}\n`);
		await writeFile(
			path.join(dir, 'meldung.md'),
			[
				`# Meldung (${sorte}) vom ${jetzt.toLocaleString('de-DE')}`,
				'',
				'## Beschreibung der Lehrkraft',
				'',
				text.trim(),
				'',
				png ? '## Bildschirmausschnitt\n\n![Ausschnitt](bildschirm.png)\n' : '_Kein Bildschirmausschnitt._\n',
				'## Umgebung',
				'',
				'```json',
				JSON.stringify(umgebung ?? null, null, '\t'),
				'```',
				'',
			].join('\n'),
		);
		res.status(201).json({ name });
	});
	return router;
};
