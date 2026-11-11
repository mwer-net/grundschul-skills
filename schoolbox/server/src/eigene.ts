import {
	benenneBausteinUm,
	bilderIn,
	dokumentDir,
	legeInSammlung,
	loescheEigenenBaustein,
	sammlungsOrdner,
	uebernimmBilder,
} from '@schoolbox/kern';
import { Router } from 'express';

import { verlangeDokument } from './dokumente';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';

const name = (wert: unknown) => {
	const text = typeof wert === 'string' ? wert.trim() : '';
	if (text.length === 0 || text.length > 120) {
		throw new HttpFehler(400, 'Gib einen Namen mit höchstens 120 Zeichen an.');
	}
	return text;
};

const ORTE = ['seite', 'aufgabe', 'zeile'] as const;

/** Sammlung „Meine Bausteine“ (051), nur für die angemeldete Lehrkraft. */
export const eigeneApi = (kontext: Kontext) => {
	const router = Router();
	const { materialDir } = kontext.konfig;

	router.post('/sammlung', async (req, res) => {
		const b = (req.body ?? {}) as Record<string, unknown>;
		const { dok, html, mappe, ort } = b;
		if (typeof mappe !== 'string' || typeof dok !== 'string' || typeof html !== 'string' || html.trim() === '') {
			throw new HttpFehler(400, 'Wähle zuerst einen Baustein aus.');
		}
		if (!ORTE.includes(ort as (typeof ORTE)[number])) {
			throw new HttpFehler(400, 'Dieser Ort passt nicht.');
		}
		verlangeDokument(kontext, mappe, dok);
		const baustein = await legeInSammlung(materialDir, {
			mappe,
			dok,
			html,
			name: name(b.name),
			ort: ort as (typeof ORTE)[number],
		});
		res.status(201).json({ baustein });
	});

	router.post('/sammlung/:id/aendern', async (req, res) => {
		await benenneBausteinUm(materialDir, req.params.id, name((req.body as { name?: unknown }).name));
		res.json({ ok: true });
	});

	router.post('/sammlung/:id/loeschen', async (req, res) => {
		await loescheEigenenBaustein(materialDir, req.params.id);
		res.json({ ok: true });
	});

	/** Bilder für einen Baustein aus der Sammlung oder einem anderen Dokument ins Ziel kopieren: alt → neu. */
	router.post('/bilder/:mappe/:dok', async (req, res) => {
		const { dok, mappe } = req.params;
		const ziel = verlangeDokument(kontext, mappe, dok);
		const { html, von } = (req.body ?? {}) as {
			html?: unknown;
			von?: { sammlung?: unknown; mappe?: unknown; dok?: unknown };
		};
		if (typeof html !== 'string' || !von) {
			throw new HttpFehler(400, 'Es fehlt, woher der Baustein kommt.');
		}
		let quelle: string;
		if (typeof von.sammlung === 'string') {
			quelle = sammlungsOrdner(materialDir, von.sammlung);
		} else if (typeof von.mappe === 'string' && typeof von.dok === 'string') {
			quelle = dokumentDir(materialDir, von.mappe, von.dok);
		} else {
			throw new HttpFehler(400, 'Es fehlt, woher der Baustein kommt.');
		}
		res.json({ umbenannt: await uebernimmBilder(quelle, ziel, bilderIn(html, quelle)) });
	});

	return router;
};
