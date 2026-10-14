import { existsSync } from 'node:fs';
import path from 'node:path';

import type { MappenEintrag, MappenFilter } from '@schoolbox/kern';
import {
	dupliziereMappe,
	FAECHER,
	legeInPapierkorb,
	leseMappenEintrag,
	mappenDir,
	sammleMappen,
	STATUS,
	waehleKlasse,
	waehleWert,
} from '@schoolbox/kern';
import { Router } from 'express';

import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { pruefeIdParam } from './schutz';

const text = (wert: unknown) => (typeof wert === 'string' && wert.trim() ? wert : undefined);

const leseFilter = (query: Record<string, unknown>): MappenFilter => {
	const fach = text(query.fach);
	const klasse = text(query.klasse);
	const status = text(query.status);
	return {
		fach: fach === undefined ? undefined : waehleWert('Fach', fach, FAECHER),
		klasse: klasse === undefined ? undefined : waehleKlasse(klasse),
		status: status === undefined ? undefined : waehleWert('Status', status, STATUS),
		suche: text(query.suche),
	};
};

const verlangeMappe = (kontext: Kontext, mappe: string) => {
	if (!existsSync(path.join(mappenDir(kontext.konfig.materialDir, mappe), 'mappe.json'))) {
		throw new HttpFehler(404, `Die Mappe „${mappe}“ gibt es nicht.`);
	}
};

/**
 * Ergänzt je Dokument die Kennung seiner Vorschau. In der Übersicht braucht es nur die des ersten Dokuments (das
 * Titelbild der Kachel), in der Mappenansicht alle; nur diese werden bei Bedarf gebaut.
 */
const mitVorschau = async (kontext: Kontext, { dokumente, mappe }: MappenEintrag, alle: boolean) => ({
	mappe,
	dokumente: await Promise.all(
		dokumente.map(async ({ id, meta }, i) => ({
			id,
			meta,
			vorschau: await kontext.vorschau.stand(mappe.id, id, alle || i === 0),
		})),
	),
});

/** Mappen auflisten, ansehen, duplizieren und in den Papierkorb legen (unter `/api/mappen`). */
export const mappenApi = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router();
	router.param('mappe', pruefeIdParam('Mappe'));

	router.get('/', async (req, res) => {
		const { defekt, mappen } = await sammleMappen(materialDir, leseFilter(req.query));
		res.json({ mappen: await Promise.all(mappen.map((e) => mitVorschau(kontext, e, false))), defekt });
	});

	router.get('/:mappe', async (req, res) => {
		verlangeMappe(kontext, req.params.mappe);
		res.json(await mitVorschau(kontext, await leseMappenEintrag(materialDir, req.params.mappe), true));
	});

	router.post('/:mappe/duplizieren', async (req, res) => {
		verlangeMappe(kontext, req.params.mappe);
		res.status(201).json({ mappe: await dupliziereMappe(materialDir, req.params.mappe) });
	});

	router.post('/:mappe/loeschen', async (req, res) => {
		const { mappe } = req.params;
		verlangeMappe(kontext, mappe);
		const eintrag = await legeInPapierkorb(materialDir, mappe);
		for (const schluessel of [...kontext.bekannt.keys()].filter((k) => k.startsWith(`${mappe}/`))) {
			kontext.bekannt.delete(schluessel);
		}
		res.json({ eintrag });
	});

	return router;
};
